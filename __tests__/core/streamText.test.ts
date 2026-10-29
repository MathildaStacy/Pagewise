import {
  parse,
  stableStreamText,
  type Inline,
  type RichDoc,
} from '@core/markup';
import { exploreSource } from '@app/demo/source';

/** Only literal text nodes; formulas and code are rendered, not shown as markup. */
function literal(doc: RichDoc): string {
  const inline = (nodes: Inline[]): string =>
    nodes
      .map(n => (n.t === 'text' ? n.v : n.t === 'b' ? inline(n.c) : ''))
      .join('');
  return doc
    .map(b =>
      b.t === 'p' || b.t === 'check'
        ? inline(b.c)
        : b.t === 'list'
        ? b.items.map(inline).join('\n')
        : b.t === 'aux'
        ? literal(b.body)
        : '',
    )
    .join('\n');
}

it.each([
  ['讲 **加粗', '讲 '],
  ['讲 **加粗**', '讲 **加粗**'],
  ['公式 $x^2', '公式 '],
  ['公式 $x^2$ 继续', '公式 $x^2$ 继续'],
  ['推导 $$f = g', '推导 '],
  ['第一点\n-', '第一点\n'],
  ['第一点\n2.', '第一点\n'],
  ['段落\n##', '段落\n'],
  ['代码\n``', '代码\n'],
  ['- **要点', '- '],
])('holds back a still-open marker: %j', (source, expected) => {
  expect(stableStreamText(source)).toBe(expected);
});

it.each([
  '价格 $5，很便宜',
  '```js\nconst a = "**";',
  '```\na ** b\n```\n后文',
  String.raw`转义 \*\* 与 \$ 保持原样`,
  '上一段 **未闭合**\n\n新段落',
  '第一点\n- 已经有内容',
])('leaves complete or literal text untouched: %j', source => {
  expect(stableStreamText(source)).toBe(source);
});

it('treats a far-back dollar as literal instead of hiding the paragraph', () => {
  const source = 'Costs $5 ' + 'and more '.repeat(30);
  expect(stableStreamText(source)).toBe(source);
});

it.each([
  [
    'mixed sample',
    '讲 **直觉** $g(n)$ [[b:1]]。\n\n[[derive]]公式 $$f=g+h$$ [[b:2]][[/derive]]\n- 第一 **要点**\n1. 第二 $x$\n## 标题 **粗**\n```js\nconst a = 1;\n```\n结尾 **完**',
  ],
  ...exploreSource.LESSON.flat()
    .flatMap(entry => ('t' in entry && entry.t ? [entry.t] : []))
    .map((text, i) => [`lesson ${i}`, text]),
])('never renders raw ** or $ at any streamed prefix (%s)', (_name, source) => {
  for (let i = 0; i <= source.length; i++) {
    const shown = literal(
      parse(stableStreamText(source.slice(0, i)), { streaming: true }),
    );
    expect(shown).not.toMatch(/\*\*|\$/);
  }
  expect(stableStreamText(source)).toBe(source);
});
