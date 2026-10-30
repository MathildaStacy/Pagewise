import Renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Modal, ScrollView, StyleSheet, Text } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { RichView, SkinProvider, type SkinId } from '@ui/kit';
import { highlightCode, codeColors, codeLanguage } from '@ui/kit/code/syntax';
import { codeFontFamily } from '@ui/kit/code/CodeBlock';
import { contrastRatio } from '@ui/kit/color';
import { blockDoc, messageDoc } from '@features/study/presenters';
import { docLength, revealDoc } from '@ui/kit/reveal/doc';
import { parse } from '@core/markup';
import type { Block } from '@core/types';

const code =
  '#include <iostream>\n\nint main() {\n\tstd::cout << "Hello, 世界"; // comment\n\treturn 0;\n}';
const button = (root: ReactTestInstance, name: string) =>
  root.findAll(
    node =>
      node.props.accessibilityLabel === name &&
      typeof node.props.onPress === 'function',
  )[0];
let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.clearAllMocks();
});

it.each([
  'cpp',
  'java',
  'go',
  'python',
  'js',
  'ts',
  'tsx',
  'json',
  'sh',
  'sql',
  'rust',
  'kotlin',
  'yaml',
  'swift',
  'cs',
  'html',
  'css',
])('preserves every source character while highlighting %s', language => {
  const source =
    language === 'cpp'
      ? code
      : language === 'yaml'
      ? 'enabled: true\nport: 42\nname: "世界"\n'
      : 'return "<你好 & world>"; // 123\n\tvalue = 2;\n';
  const spans = highlightCode(source, language);
  expect(spans.map(span => span.text).join('')).toBe(source);
  expect(spans.some(span => span.kind)).toBe(true);
});
it('uses language aliases and leaves an unknown language readable', () => {
  expect(codeLanguage('c++')).toEqual({ grammar: 'cpp', label: 'C++' });
  expect(codeLanguage('language-ts')).toEqual({
    grammar: 'typescript',
    label: 'TypeScript',
  });
  expect(highlightCode(code, 'unknown-language')).toEqual([{ text: code }]);
  expect(highlightCode(code)).toEqual([{ text: code }]);
});
it.each(['light', 'dark'] as const)(
  'keeps all syntax ink readable in %s mode',
  scheme => {
    const { bg, ...ink } = codeColors[scheme];
    for (const color of Object.values(ink))
      expect(contrastRatio(color, bg)).toBeGreaterThanOrEqual(4.5);
  },
);
const variants = (
  ['paper', 'glass', 'meta', 'google', 'win11'] as SkinId[]
).flatMap(skinId =>
  (['light', 'dark'] as const).map(scheme => ({ skinId, scheme })),
);
it.each(variants)(
  'renders source and AI code in $skinId/$scheme with exact copy and Back dismissal',
  async ({ skinId, scheme }) => {
    const source = blockDoc(
      { type: 'code', text: '```cpp\n' + code + '\n```' } as Block,
      null,
    );
    const reply = messageDoc(
      '```cpp\n' + code + '\n```',
      [],
      new Map(),
      null,
      '1',
    );
    expect(source).toEqual(reply);
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skinId} scheme={scheme}>
          <RichView doc={source} />
        </SkinProvider>,
      );
    });
    const selectable = renderer.root
      .findAllByType(Text)
      .find(node => node.props.selectable)!;
    expect(StyleSheet.flatten(selectable.props.style).fontFamily).toBe(
      codeFontFamily,
    );
    expect(
      renderer.root
        .findAllByType(ScrollView)
        .some(node => node.props.horizontal),
    ).toBe(true);
    await act(async () => button(renderer.root, '复制代码').props.onPress());
    expect(Clipboard.setString).toHaveBeenCalledWith(code);
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === '已复制'),
    ).toBe(true);
    await act(async () =>
      button(renderer.root, '全屏阅读代码').props.onPress(),
    );
    expect(renderer.root.findByType(Modal).props.visible).toBe(true);
    await act(async () =>
      renderer.root.findByType(Modal).props.onRequestClose(),
    );
    expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  },
);
it('preserves inline code styling and language while streaming through partial code', () => {
  const doc = parse('用 `hello()` 调用\n```js\nreturn 2;\n```');
  const cut = revealDoc(doc, docLength(doc) - 1);
  expect(cut.at(-1)).toEqual({ t: 'code', language: 'js', text: 'return 2' });
  expect(revealDoc(parse('`abcdef`'), 3)).toEqual([
    { t: 'p', c: [{ t: 'code', v: 'abc' }] },
  ]);
});
