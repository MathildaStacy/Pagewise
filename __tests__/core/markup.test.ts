import { blockRef, isBlockRef, parseBlockRef } from '@core/ids';
import {
  parse,
  parseInline,
  parseSourceCode,
  stableStreamText,
  type Inline,
  type RichDoc,
} from '@core/markup';
import { exploreSource } from '@app/demo/source';
import { remapDemoCitations } from '@app/demo/seed';

const text = (v: string) => ({ t: 'text', v });
const paragraph = (v: string) => ({ t: 'p', c: [text(v)] });
function inlineText(nodes: Inline[]): string {
  return nodes
    .map(n =>
      n.t === 'text' || n.t === 'code'
        ? n.v
        : n.t === 'b'
        ? inlineText(n.c)
        : n.t === 'math'
        ? n.tex
        : '',
    )
    .join('');
}
function plain(doc: RichDoc): string {
  return doc
    .map(b =>
      b.t === 'p' || b.t === 'check'
        ? inlineText(b.c)
        : b.t === 'code'
        ? b.text
        : b.t === 'math'
        ? b.tex
        : b.t === 'aux'
        ? plain(b.body)
        : b.t === 'list'
        ? b.items.map(inlineText).join('\n')
        : '',
    )
    .join('\n');
}

it('parses emphasis, inline math and literal content refs in mixed Chinese and English', () => {
  expect(parse('直觉 **A* 与 $g(n)$**：看这里 [[b:103005]]。')).toEqual([
    {
      t: 'p',
      c: [
        text('直觉 '),
        { t: 'b', c: [text('A* 与 '), { t: 'math', tex: 'g(n)' }] },
        text('：看这里 '),
        { t: 'cite', ref: 103005, verified: false, detour: false },
        text('。'),
      ],
    },
  ]);
  expect(
    parse('普通 [方括号] 与 [[unknown]]、[[b:abc]]、[[b:-1]]、[[b:1.2]]'),
  ).toEqual([
    paragraph('普通 [方括号] 与 [[unknown]]、[[b:abc]]、[[b:-1]]、[[b:1.2]]'),
  ]);
  expect(parse('[[b:9007199254740992]]')).toEqual([
    paragraph('[[b:9007199254740992]]'),
  ]);
  expect(parse('[[b:0]]')).toEqual([
    { t: 'p', c: [{ t: 'cite', ref: 0, verified: false, detour: false }] },
  ]);
});
it('renders display math as a block and leaves math contents untouched', () => {
  expect(parse('前面\n\n$$\nf(n) = g(n) + h(n)\n$$\n\n后面')).toEqual([
    paragraph('前面'),
    { t: 'math', tex: 'f(n) = g(n) + h(n)' },
    paragraph('后面'),
  ]);
  expect(parse('前 $$x^2$$ 后')).toEqual([
    paragraph('前 '),
    { t: 'math', tex: 'x^2' },
    paragraph(' 后'),
  ]);
  expect(parse('$x + [[derive]] + y$')).toEqual([
    { t: 'p', c: [{ t: 'math', tex: 'x + [[derive]] + y' }] },
  ]);
  expect(parse('$$x + [[example]]$$')).toEqual([
    { t: 'math', tex: 'x + [[example]]' },
  ]);
  expect(parseInline('x $$a+b$$ y')).toEqual([
    text('x '),
    { t: 'math', tex: 'a+b' },
    text(' y'),
  ]);
});
it('recognizes quote and figure cards only on a standalone line', () => {
  expect(parse('  [[q:103005]]\n[[fig:104002]]\n文字 [[q:1]]')).toEqual([
    { t: 'quote', ref: 103005, verified: false },
    { t: 'figure', ref: 104002, verified: false },
    paragraph('文字 [[q:1]]'),
  ]);
  expect(parse('[[q:abc]]\n[[fig:9007199254740992]]')).toEqual([
    paragraph('[[q:abc]]\n[[fig:9007199254740992]]'),
  ]);
});
it('parses nested auxiliary content with citations, formulas, lists and a check', () => {
  expect(
    parse(
      '先讲。[[derive]]推导 $x$ [[b:1]]\n\n[[example]]- **例子**\n- 第二个[[/example]]\n[[check]]懂了 $x$ 吗？ [[b:2]][[/check]][[/derive]]继续。',
    ),
  ).toEqual([
    paragraph('先讲。'),
    {
      t: 'aux',
      kind: 'derive',
      open: false,
      body: [
        {
          t: 'p',
          c: [
            text('推导 '),
            { t: 'math', tex: 'x' },
            text(' '),
            { t: 'cite', ref: 1, verified: false, detour: false },
          ],
        },
        {
          t: 'aux',
          kind: 'example',
          open: false,
          body: [
            {
              t: 'list',
              ordered: false,
              items: [[{ t: 'b', c: [text('例子')] }], [text('第二个')]],
            },
          ],
        },
        {
          t: 'check',
          c: [
            text('懂了 '),
            { t: 'math', tex: 'x' },
            text(' 吗？ '),
            { t: 'cite', ref: 2, verified: false, detour: false },
          ],
        },
      ],
    },
    paragraph('继续。'),
  ]);
  expect(parse('[[derive]]外[[derive]]内[[/derive]]外[[/derive]]')).toEqual([
    {
      t: 'aux',
      kind: 'derive',
      open: false,
      body: [
        paragraph('外'),
        { t: 'aux', kind: 'derive', open: false, body: [paragraph('内')] },
        paragraph('外'),
      ],
    },
  ]);
  expect(
    parse(
      '[[check]]\n第一段\n\n- 问题一\n- 问题二\n$$x$$\n```\ncode\n```\n[[example]]例子[[/example]]\n[[q:2]][[/check]]',
    )[0],
  ).toEqual({
    t: 'check',
    c: [
      text('第一段\n'),
      text('问题一\n'),
      text('问题二\n'),
      { t: 'math', tex: 'x' },
      text('\n'),
      text('code\n'),
      text('例子\n'),
      { t: 'cite', ref: 2, verified: false, detour: false },
    ],
  });
});
it('handles markdown headings, both list kinds and plain-text tables', () => {
  expect(
    parse(
      '# 小标题\r\n\r\n正文第一行\r第二行\n\n- 一\n- 二\n1. first\n2. **second**\n\n| A | B |\n|---|---|',
    ),
  ).toEqual([
    { t: 'p', c: [{ t: 'b', c: [text('小标题')] }] },
    paragraph('正文第一行\n第二行'),
    { t: 'list', ordered: false, items: [[text('一')], [text('二')]] },
    {
      t: 'list',
      ordered: true,
      items: [[text('first')], [{ t: 'b', c: [text('second')] }]],
    },
    paragraph('| A | B |\n|---|---|'),
  ]);
  expect(parse('### 正文标题 ###')).toEqual([
    { t: 'p', c: [{ t: 'b', c: [text('正文标题')] }] },
  ]);
});
it('keeps code fences literal, including markup syntax and unfinished fences', () => {
  expect(
    parse('开头\n```ts\nconst x = "[[b:1]] $$x$$ **bold**";\n```\n结束'),
  ).toEqual([
    paragraph('开头'),
    { t: 'code', text: 'const x = "[[b:1]] $$x$$ **bold**";', language: 'ts' },
    paragraph('结束'),
  ]);
  expect(parse('~~~\na\n~~~\n')).toEqual([{ t: 'code', text: 'a' }]);
  expect(parse('````\n```\ncode\n````')).toEqual([
    { t: 'code', text: '```\ncode' },
  ]);
  expect(parse('```js\nunfinished', { streaming: true })).toEqual([
    { t: 'code', text: 'unfinished', language: 'js' },
  ]);
  expect(parse('```')).toEqual([{ t: 'code', text: '' }]);
  expect(parse('```\ncode\nnot a closing fence')).toEqual([
    { t: 'code', text: 'code\nnot a closing fence' },
  ]);
});
it('retains language, indentation and blank lines in imported fenced code', () => {
  const code =
    '#include <iostream>\n\nint main() {\n\tstd::cout << "你好";\n}\n';
  expect(
    parseSourceCode('```cpp\r\n' + code.replace(/\n/g, '\r\n') + '```'),
  ).toEqual({
    t: 'code',
    language: 'cpp',
    text: code.slice(0, -1),
  });
  expect(parseSourceCode(code)).toEqual({ t: 'code', text: code });
  expect(parse('~~~python title="sample"\n  return 2\n~~~')).toEqual([
    { t: 'code', language: 'python', text: '  return 2' },
  ]);
});
it('treats inline code as literal text, including formulas, citations and auxiliary tags', () => {
  const code = '[[derive]] $x$ **raw** [[b:1]]';
  const source = `调用 \`${code}\`。`;
  expect(parse(source)).toEqual([
    { t: 'p', c: [text('调用 '), { t: 'code', v: code }, text('。')] },
  ]);
  expect(parseInline('`` a ` b ``')).toEqual([{ t: 'code', v: 'a ` b' }]);
  expect(parseInline('`not closed')).toEqual([text('`not closed')]);
  expect(parseInline(String.raw`\`literal\``)).toEqual([text('`literal`')]);
  expect(stableStreamText(source)).toBe(source);
  expect(stableStreamText('调用 `尚未完成')).toBe('调用 ');
});
it('preserves escaped syntax, including escaped math delimiters', () => {
  expect(parse(String.raw`\$5 \**bold\** \[[b:1]] \\end`)).toEqual([
    paragraph('$5 **bold** [[b:1]] \\end'),
  ]);
  expect(parse(String.raw`$x\$y$`)).toEqual([
    { t: 'p', c: [{ t: 'math', tex: String.raw`x\$y` }] },
  ]);
  expect(parse(String.raw`**a\**b**`)).toEqual([
    { t: 'p', c: [{ t: 'b', c: [text('a**b')] }] },
  ]);
  expect(parse(String.raw`\[[derive]]raw\[[/derive]]`)).toEqual([
    paragraph('[[derive]]raw[[/derive]]'),
  ]);
});
it.each(['**没闭合', '$x + y', '$$x + y'])(
  'keeps incomplete emphasis/formula %s readable in both modes',
  source => {
    expect(plain(parse(source, { streaming: true }))).toBe(source);
    expect(plain(parse(source, { final: true }))).toBe(source);
  },
);
it.each([
  '[[',
  '[[b',
  '[[b:',
  '[[b:12',
  '[[b:12]',
  '[[q:103',
  '[[fig:10',
  '[[der',
  '[[/exam',
  '[[che',
])('hides a supported trailing tag prefix %s only while streaming', prefix => {
  expect(parse('正文 ' + prefix, { streaming: true })).toEqual([
    paragraph('正文 '),
  ]);
  expect(parse('正文 ' + prefix, { streaming: true, final: true })).toEqual([
    paragraph('正文 ' + prefix),
  ]);
});
it('keeps ordinary brackets and known invalid tags visible during streaming', () => {
  for (const suffix of ['[abc', '[[普通文字', '[[b:abc', '[[other', '[[b:-1'])
    expect(parse('正文 ' + suffix, { streaming: true })).toEqual([
      paragraph('正文 ' + suffix),
    ]);
  expect(parse('[[b:12', { streaming: true })).toEqual([]);
  expect(parse('[[/derive]]')).toEqual([paragraph('[[/derive]]')]);
});
it('marks unfinished aux as open and clears it when final, without losing its contents', () => {
  expect(parse('[[derive]]$x$ [[b:1]] [[exam', { streaming: true })).toEqual([
    {
      t: 'aux',
      kind: 'derive',
      open: true,
      body: [
        {
          t: 'p',
          c: [
            { t: 'math', tex: 'x' },
            text(' '),
            { t: 'cite', ref: 1, verified: false, detour: false },
            text(' '),
          ],
        },
      ],
    },
  ]);
  expect(parse('[[derive]]text', { streaming: true, final: true })).toEqual([
    { t: 'aux', kind: 'derive', open: false, body: [paragraph('text')] },
  ]);
  expect(parse('[[derive]]text[[/derive]]', { streaming: true })).toEqual(
    parse('[[derive]]text[[/derive]]'),
  );
  expect(parse('[[check]]问题 [[b:1', { streaming: true })).toEqual([
    { t: 'check', c: [text('问题 ')] },
  ]);
});
it('reparses every prefix and reaches the same final AST as a completed response', () => {
  const source =
    '讲 **直觉** $g(n)$ [[b:1]]。\n\n[[derive]]公式 $$f=g+h$$ [[b:2]][[/derive]]\n[[q:2]]\n[[check]]能解释吗？[[/check]]';
  for (let i = 0; i <= source.length; i++)
    expect(() => parse(source.slice(0, i), { streaming: true })).not.toThrow();
  expect(parse(source, { streaming: true })).toEqual(parse(source));
});
it('regresses the complete explore LESSON scripts with modern block refs', () => {
  const docs: RichDoc[] = [];
  for (const step of exploreSource.LESSON)
    for (const entry of step) {
      if (entry.k === 'src') {
        docs.push(parse(`[[q:${entry.b === 'b5' ? 103000 : 104001}]]`));
        continue;
      }
      const content = remapDemoCitations(entry.t);
      const tag =
        entry.k === 'derive'
          ? 'derive'
          : entry.k === 'ex'
          ? 'example'
          : entry.k === 'check'
          ? 'check'
          : null;
      const doc = parse(tag ? `[[${tag}]]${content}[[/${tag}]]` : content);
      expect(doc.length).toBeGreaterThan(0);
      expect(
        parse(tag ? `[[${tag}]]${content}[[/${tag}]]` : content, {
          streaming: true,
        }),
      ).toEqual(doc);
      docs.push(doc);
    }
  expect(docs).toHaveLength(14);
  expect(docs.some(doc => doc.some(block => block.t === 'aux'))).toBe(true);
});
it('parses a 10k-character response below the 3ms Node budget after warm-up', () => {
  const unit =
    '讲解 **A* 的直觉**：$f(n)=g(n)+h(n)$ [[b:103005]]。\n\n[[derive]]- 推导公式 $x+y$\n- 下一步 [[b:104002]][[/derive]]\n\n';
  const source = unit.repeat(Math.ceil(10000 / unit.length)).slice(0, 10000);
  for (let i = 0; i < 30; i++) parse(source, { streaming: true });
  const batches: number[] = [];
  for (let batch = 0; batch < 5; batch++) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < 50; i++) parse(source, { streaming: true });
    batches.push(Number(process.hrtime.bigint() - start) / 1e6 / 50);
  }
  batches.sort((a, b) => a - b);
  expect(batches[2]).toBeLessThan(3);
});
it('serializes and validates safe block refs without guessing malformed IDs', () => {
  expect(blockRef(103005)).toBe('b103005');
  expect(parseBlockRef('b103005')).toBe(103005);
  expect(isBlockRef('b0')).toBe(true);
  for (const value of [
    '103005',
    'b:103005',
    'b-1',
    'b1.5',
    'bInfinity',
    'b9007199254740992',
  ])
    expect(parseBlockRef(value)).toBeNull();
  for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => blockRef(value)).toThrow();
  expect(parse('')).toEqual([]);
  expect(parse(' \n\n ')).toEqual([]);
});
