import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';
import type { BookVisualAxis, BookVisualData } from './contracts';
import { useTokens } from './context';
import { makeStyles } from './makeStyles';
import { Button } from './proxy';

export const visualPosition = (value: number, axis: BookVisualAxis) =>
  axis.scale === 'log'
    ? (Math.log(value) - Math.log(axis.min)) /
      (Math.log(axis.max) - Math.log(axis.min))
    : (value - axis.min) / (axis.max - axis.min);

function lines(text: string, capacity: number): string[] {
  const result: string[] = [];
  let row = '',
    length = 0;
  for (const ch of text) {
    const size = /[\u2e80-\uffff]/u.test(ch) ? 1 : 0.58;
    if (ch === '\n' || (length + size > capacity && row)) {
      result.push(row.trim());
      row = '';
      length = 0;
      if (ch === '\n') continue;
    }
    row += ch;
    length += size;
  }
  if (row) result.push(row.trim());
  return result;
}

/** Native vectors stay sharp, themed, and separate from the retained scan. */
export function BookVisualView({
  data,
  onOriginal,
}: {
  data: BookVisualData;
  onOriginal?(): void;
}) {
  const s = useStyles(),
    t = useTokens();
  const { fontScale } = useWindowDimensions();
  const [available, setAvailable] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [details, setDetails] = useState(false);
  const scale = (fontScale * t.type.bookBody.fontSize) / 17;
  const width = Math.max(available, 360 * scale);
  return (
    <View
      style={s.root}
      onLayout={e => setAvailable(e.nativeEvent.layout.width)}
      testID="book-visual"
    >
      {data.title ? (
        <Text style={s.title} selectable>
          {data.title}
        </Text>
      ) : null}
      {data.kind === 'chart' && data.y.label ? (
        <Text style={s.label}>{data.y.label}</Text>
      ) : null}
      <ScrollView
        horizontal
        nestedScrollEnabled
        onContentSizeChange={setContentWidth}
        accessibilityLabel="重绘图表，可横向滚动"
      >
        {data.kind === 'chart' ? (
          <Chart data={data} width={width} scale={scale} />
        ) : (
          <Diagram data={data} width={width} scale={scale} />
        )}
      </ScrollView>
      {available > 0 && contentWidth > available + 8 ? (
        <Text style={s.provenance}>左右滑动查看完整图</Text>
      ) : null}
      {data.kind === 'chart' ? (
        <>
          <Text style={s.axisLabel}>{data.x.label}</Text>
          <View style={s.legend}>
            {data.series.map((series, i) =>
              series.name ? (
                <View key={i} style={s.legendItem}>
                  <Svg width={28} height={14}>
                    <Line
                      x1={0}
                      y1={7}
                      x2={28}
                      y2={7}
                      stroke={palette(t)[i % 4]}
                      strokeWidth={2}
                      strokeDasharray={series.dashed ? '5 3' : undefined}
                    />
                  </Svg>
                  <Text style={s.label}>{series.name}</Text>
                </View>
              ) : null,
            )}
          </View>
        </>
      ) : null}
      <Text style={s.provenance}>
        {data.kind === 'chart'
          ? 'AI 近似重绘 · 数值按原图估读'
          : 'AI 重绘 · 结构复原'}
      </Text>
      {details ? (
        <Text selectable style={s.description}>
          {data.description}
        </Text>
      ) : null}
      <View style={s.actions}>
        <Button
          variant="text"
          size="sm"
          label={details ? '收起说明' : '图表说明'}
          onPress={() => setDetails(!details)}
        />
        {onOriginal ? (
          <Button
            variant="text"
            size="sm"
            label="对照原扫描图"
            onPress={onOriginal}
          />
        ) : null}
      </View>
    </View>
  );
}

const palette = (t: ReturnType<typeof useTokens>) => [
  t.color.accentInk,
  t.color.detour,
  t.color.okInk,
  t.color.paperInk,
];
function Chart({
  data,
  width,
  scale,
}: {
  data: Extract<BookVisualData, { kind: 'chart' }>;
  width: number;
  scale: number;
}) {
  const t = useTokens(),
    colors = palette(t);
  const font = t.type.caption.fontSize * scale;
  const left = 62 * scale,
    right = 20 * scale,
    top = 26 * scale,
    height = 280 * scale,
    bottom = 55 * scale;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const bars = data.series.filter(series => series.type === 'bar');
  const inset = bars.length
    ? (plotWidth / Math.max(...bars.map(s => s.points.length))) * 0.4
    : 0;
  const x = (n: number) =>
    left + inset + visualPosition(n, data.x) * (plotWidth - 2 * inset);
  const y = (n: number) => top + (1 - visualPosition(n, data.y)) * plotHeight;
  const tickCount = Math.min(
    data.x.ticks.length,
    Math.max(2, Math.floor(plotWidth / ((bars.length ? 25 : 65) * scale))),
  );
  const shownTicks = new Set(
    Array.from({ length: tickCount }, (_, i) =>
      Math.round((i * (data.x.ticks.length - 1)) / (tickCount - 1)),
    ),
  );
  return (
    <Svg
      width={width}
      height={height}
      accessibilityLabel={`${data.title}。${data.description}`}
    >
      {data.y.ticks.map(tick => (
        <G key={tick.value}>
          <Line
            x1={left}
            y1={y(tick.value)}
            x2={width - right}
            y2={y(tick.value)}
            stroke={t.color.readerPageRule}
            strokeOpacity={t.scheme === 'dark' ? 0.28 : 0.7}
            strokeWidth={1}
          />
          <SvgText
            x={left - 8 * scale}
            y={y(tick.value) + font * 0.35}
            fontSize={font}
            fontFamily={t.type.sansFamily}
            fill={t.color.paperInk}
            textAnchor="end"
          >
            {tick.label}
          </SvgText>
        </G>
      ))}
      <Line
        x1={left}
        y1={top}
        x2={left}
        y2={top + plotHeight}
        stroke={t.color.paperInk}
      />
      <Line
        x1={left}
        y1={top + plotHeight}
        x2={width - right}
        y2={top + plotHeight}
        stroke={t.color.paperInk}
      />
      {data.x.ticks.map((tick, i) =>
        shownTicks.has(i) ? (
          <G key={tick.value}>
            <Line
              x1={x(tick.value)}
              y1={top + plotHeight}
              x2={x(tick.value)}
              y2={top + plotHeight + 4 * scale}
              stroke={t.color.paperInk}
            />
            <SvgText
              x={x(tick.value)}
              y={top + plotHeight + 19 * scale}
              fontSize={font}
              fill={t.color.paperInk}
              fontFamily={t.type.sansFamily}
              textAnchor={
                bars.length
                  ? 'middle'
                  : i === 0
                  ? 'start'
                  : i === data.x.ticks.length - 1
                  ? 'end'
                  : 'middle'
              }
            >
              {lines(tick.label, 9).map((line, index) => (
                <TSpan
                  key={index}
                  x={x(tick.value)}
                  dy={index ? font * 1.2 : 0}
                >
                  {line}
                </TSpan>
              ))}
            </SvgText>
          </G>
        ) : null,
      )}
      {data.series.map((series, i) => {
        const color = colors[i % colors.length];
        if (series.type === 'line')
          return (
            <Path
              key={i}
              d={series.points
                .map((p, j) => `${j ? 'L' : 'M'}${x(p[0])},${y(p[1])}`)
                .join(' ')}
              stroke={color}
              strokeWidth={1.8 * scale}
              strokeDasharray={
                series.dashed ? `${6 * scale} ${4 * scale}` : undefined
              }
              fill="none"
            />
          );
        if (series.type === 'scatter')
          return (
            <G key={i}>
              {series.points.map((p, j) => (
                <Circle
                  key={j}
                  cx={x(p[0])}
                  cy={y(p[1])}
                  r={2.4 * scale}
                  fill={color}
                />
              ))}
            </G>
          );
        const gap = Math.min(
          plotWidth / Math.max(1, series.points.length),
          ...series.points
            .slice(1)
            .map((p, j) => x(p[0]) - x(series.points[j][0])),
        );
        const barWidth = (gap * 0.65) / bars.length,
          offset = bars.indexOf(series) - (bars.length - 1) / 2;
        return (
          <G key={i}>
            {series.points.map((p, j) => (
              <Rect
                key={j}
                x={x(p[0]) - barWidth / 2 + offset * barWidth}
                y={Math.min(y(p[1]), y(0))}
                width={barWidth}
                height={Math.abs(y(p[1]) - y(0))}
                fill={color}
              />
            ))}
          </G>
        );
      })}
      {data.annotations.map((a, i) => {
        const labelX = Math.max(
          left + 60 * scale,
          Math.min(width - right - 60 * scale, x(a.x)),
        );
        const labelY = Math.max(top + font, y(a.y) - 24 * scale);
        return (
          <G key={i}>
            <Circle
              cx={x(a.x)}
              cy={y(a.y)}
              r={4 * scale}
              fill={t.color.paper}
              stroke={t.color.paperInk}
            />
            <Line
              x1={x(a.x)}
              y1={y(a.y) - 5 * scale}
              x2={labelX}
              y2={labelY + 3 * scale}
              stroke={t.color.paperInk}
            />
            <SvgText
              x={labelX}
              y={labelY}
              fontSize={font}
              fill={t.color.paperInk}
              stroke={t.color.paper}
              strokeWidth={0.2}
              textAnchor="middle"
            >
              {a.text}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

type DiagramData = Extract<BookVisualData, { kind: 'diagram' }>;

/** Fit real label widths while preserving the source's relative node positions. */
export function diagramLayout(
  data: DiagramData,
  width: number,
  font: number,
  scale: number,
) {
  const minX = Math.min(...data.nodes.map(n => n.x)),
    maxX = Math.max(...data.nodes.map(n => n.x)),
    minY = Math.min(...data.nodes.map(n => n.y)),
    maxY = Math.max(...data.nodes.map(n => n.y));
  const nodes = data.nodes.map(n => {
    const text = lines(n.label, 10);
    const units = (row: string) =>
      Array.from(row).reduce(
        (sum, ch) => sum + (/[\u2e80-\uffff]/u.test(ch) ? 1 : 0.58),
        0,
      );
    return {
      ...n,
      text,
      w: Math.max(70 * scale, Math.max(...text.map(units)) * font + 24 * scale),
      h: Math.max(42 * scale, (text.length + 1) * font * 1.4),
      nx: maxX === minX ? 0.5 : (n.x - minX) / (maxX - minX),
      ny: maxY === minY ? 0.5 : (n.y - minY) / (maxY - minY),
    };
  });
  const pad = 12 * scale,
    left = Math.max(...nodes.filter(n => n.x === minX).map(n => n.w / 2)) + pad,
    right =
      Math.max(...nodes.filter(n => n.x === maxX).map(n => n.w / 2)) + pad,
    top = Math.max(...nodes.map(n => n.h / 2)) + pad;
  let spanY =
    Math.max(
      180,
      (new Set(nodes.map(n => Math.round(n.y * 10))).size - 1) * 100,
    ) * scale;
  // Vertically aligned labels need room even when the model placed them close together.
  for (const a of nodes)
    for (const b of nodes) {
      if (a.nx === b.nx && a.ny < b.ny)
        spanY = Math.max(
          spanY,
          (a.h / 2 + b.h / 2 + 32 * scale) / (b.ny - a.ny),
        );
    }
  let spanX = Math.max(0, width - left - right);
  for (const a of nodes) {
    if (a.nx > 0) spanX = Math.max(spanX, (a.w / 2 + pad - left) / a.nx);
    if (a.nx < 1) spanX = Math.max(spanX, (a.w / 2 + pad - right) / (1 - a.nx));
    for (const b of nodes) {
      if (a.nx < b.nx && Math.abs(a.ny - b.ny) * spanY < (a.h + b.h) / 2 + pad)
        spanX = Math.max(spanX, ((a.w + b.w) / 2 + pad) / (b.nx - a.nx));
    }
  }
  return {
    width: left + spanX + right,
    height: top * 2 + spanY,
    nodes: new Map(
      nodes.map(n => [
        n.id,
        { ...n, cx: left + n.nx * spanX, cy: top + n.ny * spanY },
      ]),
    ),
  };
}

function Diagram({
  data,
  width,
  scale,
}: {
  data: DiagramData;
  width: number;
  scale: number;
}) {
  const t = useTokens(),
    font = t.type.caption.fontSize * scale;
  const layout = diagramLayout(data, width, font, scale),
    { nodes, height } = layout;
  return (
    <Svg
      width={layout.width}
      height={height}
      accessibilityLabel={`${data.title}。${data.description}`}
    >
      {data.edges.map((e, i) => {
        const a = nodes.get(e.from)!,
          b = nodes.get(e.to)!;
        const dx = b.cx - a.cx,
          dy = b.cy - a.cy;
        const exit = Math.min(
          Math.abs(dx) ? a.w / 2 / Math.abs(dx) : Infinity,
          Math.abs(dy) ? a.h / 2 / Math.abs(dy) : Infinity,
        );
        const enter = Math.min(
          Math.abs(dx) ? b.w / 2 / Math.abs(dx) : Infinity,
          Math.abs(dy) ? b.h / 2 / Math.abs(dy) : Infinity,
        );
        if (!Number.isFinite(exit) || !Number.isFinite(enter)) return null;
        const paired = data.edges.some(
          other => other.from === e.to && other.to === e.from,
        );
        const offset = paired ? 6 * scale : 0,
          distance = Math.hypot(dx, dy),
          ox = (-dy / distance) * offset,
          oy = (dx / distance) * offset;
        const x1 = a.cx + dx * exit + ox,
          y1 = a.cy + dy * exit + oy,
          x2 = b.cx - dx * enter + ox,
          y2 = b.cy - dy * enter + oy;
        const angle = Math.atan2(y2 - y1, x2 - x1),
          length = 8 * scale;
        const arrow = `${x2},${y2} ${x2 - length * Math.cos(angle - 0.45)},${
          y2 - length * Math.sin(angle - 0.45)
        } ${x2 - length * Math.cos(angle + 0.45)},${
          y2 - length * Math.sin(angle + 0.45)
        }`;
        return (
          <G key={i}>
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={t.color.paperInk}
              strokeWidth={1.3 * scale}
            />
            <Polygon points={arrow} fill={t.color.paperInk} />
            {e.label ? (
              <SvgText
                x={(x1 + x2) / 2 + 5 * scale}
                y={(y1 + y2) / 2 - 6 * scale}
                fontSize={font}
                fill={t.color.paperInk}
              >
                {e.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
      {[...nodes.values()].map(n => (
        <G key={n.id}>
          <Rect
            x={n.cx - n.w / 2}
            y={n.cy - n.h / 2}
            width={n.w}
            height={n.h}
            fill={t.color.paper}
            stroke={t.color.paperInk}
            strokeWidth={1.2 * scale}
          />
          <SvgText
            x={n.cx}
            y={n.cy - (n.text.length - 1) * font * 0.7 + font * 0.35}
            fontSize={font}
            fontFamily={t.type.sansFamily}
            fill={t.color.paperInk}
            textAnchor="middle"
          >
            {n.text.map((line, i) => (
              <TSpan key={i} x={n.cx} dy={i ? font * 1.4 : 0}>
                {line}
              </TSpan>
            ))}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

const useStyles = makeStyles(t => ({
  root: { gap: 10, paddingVertical: 12, backgroundColor: t.color.paper },
  title: { ...t.type.bookBody, fontWeight: '600', color: t.color.paperInk },
  label: { ...t.type.caption, color: t.color.paperInk, flexShrink: 1 },
  axisLabel: {
    ...t.type.caption,
    color: t.color.paperInk,
    textAlign: 'center',
  },
  legend: { gap: 7 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  provenance: { ...t.type.caption, color: t.color.ink2 },
  description: {
    ...t.type.caption,
    lineHeight: t.type.caption.fontSize * 1.6,
    color: t.color.paperInk,
  },
}));
