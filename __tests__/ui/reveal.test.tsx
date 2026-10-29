import { createElement } from 'react';
import Renderer, { act } from 'react-test-renderer';
import { parse } from '@core/markup';
import {
  AiMessage,
  SkinProvider,
  docLength,
  revealDoc,
  type RichDoc,
  type RichInline,
} from '@ui/kit';
import { fadeClock } from '@ui/kit/reveal/doc';

const kitDoc = (text: string) => parse(text) as unknown as RichDoc;
function visible(doc: RichDoc): string {
  const inline = (nodes: RichInline[]): string =>
    nodes
      .map(n =>
        n.t === 'text'
          ? n.v
          : n.t === 'b'
          ? inline(n.c)
          : n.t === 'math'
          ? '∑'
          : '¶',
      )
      .join('');
  return doc
    .map(b =>
      b.t === 'p' || b.t === 'check'
        ? inline(b.c)
        : b.t === 'list'
        ? b.items.map(inline).join('')
        : b.t === 'aux'
        ? visible(b.body)
        : b.t === 'code'
        ? b.text
        : '∑',
    )
    .join('');
}

describe('revealDoc', () => {
  const source =
    '讲 **直觉** $g(n)$ [[b:1]]。\n\n[[derive]]公式 $$f=g+h$$[[/derive]]\n- 第一 **要点**\n- 第二\n```js\nconst a = 1;\n```';
  const doc = kitDoc(source);

  it('grows one unit at a time and keeps markdown structure at every step', () => {
    const total = docLength(doc);
    let previous = '';
    for (let n = 0; n <= total; n++) {
      const cut = revealDoc(doc, n);
      const text = visible(cut);
      expect(text.length).toBe(n);
      expect(text.startsWith(previous)).toBe(true);
      expect(text).not.toMatch(/\*\*|\$/);
      previous = text;
    }
    expect(revealDoc(doc, total)).toBe(doc);
  });

  it('keeps bold formatting for a partially revealed bold span', () => {
    const cut = revealDoc(kitDoc('讲 **直觉很重要**'), 4);
    expect(cut).toEqual([
      {
        t: 'p',
        c: [
          { t: 'text', v: '讲 ' },
          { t: 'b', c: [{ t: 'text', v: '直觉' }] },
        ],
      },
    ]);
  });

  it('reuses fully revealed blocks so memoized rows skip rendering', () => {
    const two = kitDoc('第一段\n\n第二段很长');
    const cut = revealDoc(two, 5);
    expect(cut[0]).toBe(two[0]);
    expect(cut[1]).not.toBe(two[1]);
  });

  it('marks only the freshly revealed tail with fade levels', () => {
    const one = kitDoc('一二三四五六');
    const fade = fadeClock(
      [
        { at: 1000, upto: 4 },
        { at: 1100, upto: 6 },
      ],
      2,
      1150,
      300,
    );
    const cut = revealDoc(one, 6, 2, fade);
    expect(cut).toEqual([
      {
        t: 'p',
        c: [
          { t: 'text', v: '一二' },
          { t: 'text', v: '三四', fade: 3 / 6 },
          { t: 'text', v: '五六', fade: 1 / 6 },
        ],
      },
    ]);
  });

  it('never splits a surrogate pair', () => {
    const emoji = kitDoc('😀😀😀');
    for (let n = 0; n <= 6; n++)
      expect(visible(revealDoc(emoji, n)).length % 2).toBe(0);
  });
});

describe('AiMessage reveal', () => {
  const long = kitDoc('一'.repeat(400));
  let renderer: Renderer.ReactTestRenderer | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback =>
        Number(setTimeout(() => callback(Date.now()), 16)),
      );
    jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation(handle => clearTimeout(handle));
  });
  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  const view = (doc: RichDoc, streaming: boolean, reduceMotion = false) =>
    createElement(
      SkinProvider,
      { skinId: 'paper', scheme: 'light', reduceMotion },
      createElement(AiMessage, { doc, streaming }),
    );
  const shownText = () => {
    const parts: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node === 'string') parts.push(node);
      else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object' && 'children' in node)
        walk((node as { children: unknown }).children);
    };
    walk(renderer!.toJSON());
    return parts.join('').replace(/[^一]/g, '');
  };
  const skipButton = () =>
    renderer!.root.findAll(
      n => n.props.accessibilityLabel === '显示全部' && !!n.props.onPress,
    )[0];

  it('reveals gradually, fades new text, and can skip once generation ends', () => {
    act(() => {
      renderer = Renderer.create(view(long, true));
    });
    expect(shownText()).toBe('');
    act(() => jest.advanceTimersByTime(600));
    const partial = shownText().length;
    expect(partial).toBeGreaterThan(5);
    expect(partial).toBeLessThan(400);
    expect(
      renderer!.root.findAll(
        n =>
          typeof n.props.style?.color === 'string' &&
          n.props.style.color.startsWith('rgba(') &&
          n.props.style.textShadowRadius !== undefined,
      ).length,
    ).toBeGreaterThan(0);
    expect(skipButton()).toBeUndefined();
    act(() => renderer!.update(view(long, false)));
    act(() => jest.advanceTimersByTime(50));
    expect(skipButton()).toBeDefined();
    act(() => skipButton().props.onPress());
    expect(shownText().length).toBe(400);
    expect(skipButton()).toBeUndefined();
  });

  it('finishes on its own and settles every span to plain text', () => {
    act(() => {
      renderer = Renderer.create(view(kitDoc('短短一句话'), true));
    });
    act(() => renderer!.update(view(kitDoc('短短一句话'), false)));
    act(() => jest.advanceTimersByTime(2000));
    const faded = renderer!.root.findAll(
      n => n.props.style?.textShadowRadius !== undefined,
    );
    expect(faded).toHaveLength(0);
    expect(skipButton()).toBeUndefined();
  });

  it('shows history and reduced-motion messages in full immediately', () => {
    act(() => {
      renderer = Renderer.create(view(long, false));
    });
    expect(shownText().length).toBe(400);
    act(() => renderer!.update(view(kitDoc('一'.repeat(10)), true, true)));
    expect(shownText().length).toBe(10);
  });
});
