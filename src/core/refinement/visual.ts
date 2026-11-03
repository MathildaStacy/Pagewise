/** Declarative reconstruction only: models never supply executable SVG or drawing code. */
export interface VisualAxis {
  label: string;
  min: number;
  max: number;
  scale: 'linear' | 'log';
  ticks: { value: number; label: string }[];
}
export interface ReconstructedChart {
  kind: 'chart';
  title: string;
  description: string;
  x: VisualAxis;
  y: VisualAxis;
  series: {
    name: string;
    type: 'line' | 'bar' | 'scatter';
    points: [number, number][];
    dashed: boolean;
  }[];
  annotations: { x: number; y: number; text: string }[];
}
export interface ReconstructedDiagram {
  kind: 'diagram';
  title: string;
  description: string;
  nodes: { id: string; label: string; x: number; y: number }[];
  edges: { from: string; to: string; label: string }[];
}
export type VisualReconstruction = ReconstructedChart | ReconstructedDiagram;

const fail = (reason = '结构不完整或坐标无效'): never => {
  throw new Error(`图表重绘${reason}，请核对原页`);
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
}
function label(v: unknown, limit = 240): string {
  if (typeof v !== 'string' || v.length > limit) return fail();
  return v.trim();
}
function number(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail();
  return v;
}
function list(v: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) return fail();
  return v;
}
function inRange(v: unknown, min: number, max: number): number {
  const n = number(v);
  if (n < min || n > max) return fail(`坐标 ${n} 超出轴范围 [${min}, ${max}]`);
  return n;
}
function axis(v: unknown): VisualAxis {
  const a = object(v),
    min = number(a.min),
    max = number(a.max);
  if (min >= max || !['linear', 'log'].includes(String(a.scale))) return fail();
  if (a.scale === 'log' && min <= 0) return fail();
  const ticks = list(a.ticks, 2, 80).map(item => {
    const tick = object(item);
    return {
      value: inRange(tick.value, min, max),
      label: label(tick.label, 50),
    };
  });
  if (
    ticks.some((t, i) => !t.label || (i > 0 && t.value <= ticks[i - 1].value))
  )
    return fail();
  return {
    label: label(a.label),
    min,
    max,
    scale: a.scale as VisualAxis['scale'],
    ticks,
  };
}

/** Reject incomplete reconstructions atomically so the reader always retains the source. */
export function parseVisual(value: unknown): VisualReconstruction {
  const v = object(value);
  const title = label(v.title),
    description = label(v.description, 1200);
  if (!description) return fail();
  if (v.kind === 'chart') {
    const x = axis(v.x),
      y = axis(v.y);
    const sourceSeries = list(v.series, 1, 8);
    const series = sourceSeries.map(item => {
      const s = object(item);
      if (!['line', 'bar', 'scatter'].includes(String(s.type))) return fail();
      const points = list(s.points, s.type === 'line' ? 2 : 1, 400).map(
        itemPoint => {
          const p = list(itemPoint, 2, 2);
          return [inRange(p[0], x.min, x.max), inRange(p[1], y.min, y.max)] as [
            number,
            number,
          ];
        },
      );
      if (
        s.type !== 'scatter' &&
        points.some((p, i) => i > 0 && p[0] <= points[i - 1][0])
      )
        return fail();
      if (s.type === 'bar' && (y.scale !== 'linear' || y.min > 0 || y.max < 0))
        return fail();
      const name = label(s.name);
      if (!name && sourceSeries.length > 1) return fail();
      return {
        name,
        type: s.type as ReconstructedChart['series'][number]['type'],
        points,
        dashed: s.dashed === true,
      };
    });
    const annotations = list(v.annotations ?? [], 0, 12).map(item => {
      const a = object(item);
      return {
        x: inRange(a.x, x.min, x.max),
        y: inRange(a.y, y.min, y.max),
        text: label(a.text, 100),
      };
    });
    return { kind: 'chart', title, description, x, y, series, annotations };
  }
  if (v.kind === 'diagram') {
    const nodes = list(v.nodes, 1, 30).map(item => {
      const n = object(item);
      const id = label(n.id, 40),
        text = label(n.label, 100);
      if (!id || !text) return fail();
      return { id, label: text, x: inRange(n.x, 0, 1), y: inRange(n.y, 0, 1) };
    });
    const ids = new Set(nodes.map(n => n.id));
    if (ids.size !== nodes.length) return fail();
    const edges = list(v.edges, 0, 60).map(item => {
      const e = object(item),
        from = label(e.from, 40),
        to = label(e.to, 40);
      if (!ids.has(from) || !ids.has(to) || from === to) return fail();
      return { from, to, label: label(e.label ?? '', 100) };
    });
    return { kind: 'diagram', title, description, nodes, edges };
  }
  return fail();
}

/** The prompt is also the model-facing contract used by the real-book acceptance run. */
export const VISUAL_PROMPT = `
对 image 块：识别扫描内容。若为表格，返回 {seq,type:"table",html:"完整<table>...</table>",reason}，逐格转录并保留合并关系，禁止猜数字。若为可辨认的折线图、柱状图、散点图或流程结构图，返回 {seq,visual:下列结构,reason}。
图表 visual={kind:"chart",title:"原图标题",description:"图中可见信息及估读局限",x:轴,y:轴,series:[{name:"原图图例",type:"line|bar|scatter",points:[[x,y],...],dashed:false}],annotations:[{x,y,text:"原图的重要注释"}]}。
轴={label:"原坐标名称和单位",min:数字,max:数字,scale:"linear|log",ticks:[{value:数字,label:"原刻度文字"},...]}。刻度从小到大；日期轴使用连续数值（如相隔天数）并保留日期刻度标签。不要把时间跨度不同的日期画成等距点。数值和负号严格按原图，保留非零起点、对数轴、全部图例、峰谷和关键注释。每条曲线最多400点，按x递增，按可辨认细节采样；不能仅用首尾直线代替走势。柱图y轴必须包含0。曲线采样均视为估读，不声称是原始精确数据。
流程结构 visual={kind:"diagram",title:"原图标题",description:"原图结构",nodes:[{id:"a",label:"原节点文字",x:0.5,y:0.1}],edges:[{from:"a",to:"b",label:"原连线文字或空串"}]}。x/y为0到1的相对位置，保持阅读顺序、箭头方向与分支关系。此结构不支持外框分组或包含关系；遇到这些图只报告issues，不把组名改成节点、不改变箭头目标。
只能返回结构化数据，不要SVG、代码、图片URL或base64。照片、封面、无法辨认、双轴/多面板或本结构无法忠实表达的图，写入issues说明，不重绘、不删掉。中文原图保留中文。`;
