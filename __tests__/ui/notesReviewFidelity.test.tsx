import Renderer, { act } from 'react-test-renderer';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon, ListSection, SkinProvider } from '@ui/kit';
import { ReviewSessionView } from '@ui/screens/ReviewSessionView';
import { ReviewView } from '@ui/screens/ReviewView';
import { NotesView } from '@ui/screens/NotesView';
import { NotesBookView } from '@ui/screens/NotesBookView';
import { NoteDetailView } from '@ui/screens/NoteDetailView';
import { reviewSamples, reviewSessionSamples } from '@features/review/samples';
import {
  notesSamples,
  notesBookSamples,
  noteDetailSamples,
} from '@features/notes/samples';
import type { ReviewSessionIntents } from '@features/review/types';
const no = () => {};
const sessionIntents: ReviewSessionIntents = {
  flip: no,
  rate: no,
  openSource: no,
  askAi: no,
  done: no,
  retry: no,
  back: no,
};
const notesIntents = {
  back: no,
  openSource: no,
  openHighlight: no,
  setUserText: no,
  retry: no,
};
const bookIntents = {
  back: no,
  openSection: no,
  openExport: no,
  setFormat: no,
  setStrip: no,
  closeOverlay: no,
  exportNow: no,
  retry: no,
};
let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
async function render(skin: 'paper' | 'glass', content: React.ReactNode) {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId={skin} scheme="light" reduceMotion>
        {content}
      </SkinProvider>,
    );
  });
  return renderer.root;
}
const style = (node: Renderer.ReactTestInstance) =>
  StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({ pressed: false })
      : node.props.style,
  ) as ViewStyle & TextStyle;
function text(root: Renderer.ReactTestInstance, value: string) {
  return root.findAllByType(Text).find(node => node.props.children === value)!;
}
it('matches the paper flashcard CSS: 300 minimum height, 19px prompt, expanded answer and 54px ratings', async () => {
  const root = await render(
    'paper',
    <ReviewSessionView
      state={reviewSessionSamples.answer}
      intents={sessionIntents}
    />,
  );
  expect(
    style(root.findByProps({ testID: 'flashcard-expanded' })),
  ).toMatchObject({
    minHeight: 300,
    marginHorizontal: 14,
    marginVertical: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 18,
  });
  expect(
    style(text(root, reviewSessionSamples.answer.card!.front)),
  ).toMatchObject({
    fontSize: 19,
    lineHeight: 29.45,
    marginTop: 26,
    textAlign: 'left',
  });
  expect(
    style(text(root, reviewSessionSamples.answer.card!.back!)),
  ).toMatchObject({
    fontSize: 15,
    lineHeight: 27,
    borderTopWidth: 1,
    paddingTop: 12,
  });
  expect(
    style(root.findByProps({ accessibilityLabel: '忘了，1 天后' })),
  ).toMatchObject({ height: 54, borderRadius: 12, borderWidth: 1 });
  expect(root.findAllByProps({ testID: 'flashcard-back' })).toHaveLength(0);
});
it('uses the Apple 380px two-face card, hides the inaccessible back until flipped and reveals 66px tinted ratings', async () => {
  let root = await render(
    'glass',
    <ReviewSessionView
      state={reviewSessionSamples.front}
      intents={sessionIntents}
    />,
  );
  expect(style(root.findByProps({ testID: 'flashcard-front' }))).toMatchObject({
    borderRadius: 22,
    paddingHorizontal: 20,
    backfaceVisibility: 'hidden',
  });
  expect(
    style(root.findByProps({ testID: 'flashcard-front' })).transform?.[0],
  ).toEqual({ perspective: 1400 });
  expect(
    root.findByProps({ testID: 'flashcard-back' }).props
      .accessibilityElementsHidden,
  ).toBe(true);
  expect(root.findAllByProps({ testID: 'flashcard-ratings' })).toHaveLength(0);
  const front = text(root, reviewSessionSamples.front.card!.front);
  expect(style(front)).toMatchObject({
    fontSize: 22,
    lineHeight: 31.9,
    textAlign: 'center',
  });
  expect(style(root.findByProps({ testID: 'flashcard-front' })).bottom).toBe(0);
  await act(async () =>
    renderer.update(
      <SkinProvider skinId="glass" scheme="light" reduceMotion>
        <ReviewSessionView
          state={reviewSessionSamples.answer}
          intents={sessionIntents}
        />
      </SkinProvider>,
    ),
  );
  root = renderer.root;
  expect(
    root.findByProps({ testID: 'flashcard-front' }).props
      .accessibilityElementsHidden,
  ).toBe(true);
  expect(
    root.findByProps({ testID: 'flashcard-back' }).props
      .accessibilityElementsHidden,
  ).toBe(false);
  expect(
    style(root.findByProps({ accessibilityLabel: '忘了，1 天后' })),
  ).toMatchObject({ height: 66, borderRadius: 20, borderWidth: 0 });
  expect(
    style(text(root, reviewSessionSamples.answer.card!.back!)),
  ).toMatchObject({ fontSize: 18, lineHeight: 30.6, borderTopWidth: 0 });
});
it.each(['paper', 'glass'] as const)(
  '%s matches the prototype metric and notebook typography',
  async skin => {
    let root = await render(
      skin,
      <ReviewView
        state={reviewSamples.normal}
        intents={{ start: no, reteach: no, markResolved: no, retry: no }}
      />,
    );
    const number = root
      .findAllByType(Text)
      .find(node => node.props.children === 12)!;
    expect(style(number).fontSize).toBe(skin === 'paper' ? 26 : 30);
    expect(style(text(root, '卡点清单')).fontSize).toBe(
      skin === 'paper' ? 15 : 20,
    );
    await act(async () => renderer.unmount());
    root = await render(
      skin,
      <NotesView
        state={notesSamples.normal}
        intents={{ openBook: no, retry: no }}
      />,
    );
    const title = root
      .findAllByType(Text)
      .filter(
        node => node.props.children === notesSamples.normal.books[0].title,
      )
      .at(-1)!;
    expect(style(title)).toMatchObject({
      fontSize: skin === 'paper' ? 15 : 16,
      fontWeight: '600',
    });
    expect(
      root.findAllByType(Icon).filter(node => node.props.name === 'chev'),
    ).toHaveLength(skin === 'paper' ? 0 : 1);
    await act(async () => renderer.unmount());
    root = await render(
      skin,
      <NotesBookView state={notesBookSamples.normal} intents={bookIntents} />,
    );
    expect(
      style(
        text(root, notesBookSamples.normal.chapters[0].sections[0].summary!),
      ),
    ).toMatchObject({
      fontSize: 13,
      lineHeight: skin === 'paper' ? 20.15 : 19.5,
    });
  },
);
it.each(['paper', 'glass'] as const)(
  '%s keeps the note document composition and editor geometry from its prototype',
  async skin => {
    const state = {
      ...noteDetailSamples.normal,
      detourQa: [{ from: '学 3.5.2 时回来问的', q: '岔路问题', a: '岔路回答' }],
      pins: [{ ref: 'b1', q: '便签问题', page: 'p.1' }],
      highlights: [{ ref: 'b2', text: '高亮原文', page: 'p.2' }],
    };
    const root = await render(
      skin,
      <NoteDetailView state={state} intents={notesIntents} />,
    );
    const groups = root
      .findAllByType(ListSection)
      .map(node => node.props.title);
    expect(groups).toEqual(
      skin === 'paper'
        ? []
        : ['摘要', '问答', '岔路记录', '问答便签', '卡点', '高亮', '我的笔记'],
    );
    expect(style(root.findByType(TextInput))).toMatchObject(
      skin === 'paper'
        ? {
            fontSize: 14,
            minHeight: 120,
            borderWidth: 1,
            borderRadius: 8,
            paddingVertical: 9,
            paddingHorizontal: 10,
          }
        : {
            fontSize: 16,
            minHeight: 120,
            borderWidth: 0,
            borderRadius: 16,
            paddingVertical: 13,
            paddingHorizontal: 16,
          },
    );
    expect(
      root.findAllByType(Text).some(node => node.props.children === '已保存'),
    ).toBe(false);
  },
);
it.each(['paper', 'glass'] as const)(
  '%s preserves its distinct finished-card composition and completion action',
  async skin => {
    const done = jest.fn();
    const root = await render(
      skin,
      <ReviewSessionView
        state={reviewSessionSamples.finished}
        intents={{ ...sessionIntents, done }}
      />,
    );
    expect(style(text(root, '今天复习完了'))).toMatchObject({
      fontSize: skin === 'paper' ? 17 : 22,
      fontWeight: skin === 'paper' ? '600' : '700',
    });
    expect(
      root
        .findAllByType(Icon)
        .filter(node => node.props.name === 'check' && node.props.size === 36),
    ).toHaveLength(skin === 'paper' ? 0 : 1);
    const button = root
      .findAllByProps({ accessibilityLabel: '完成' })
      .find(node => typeof node.props.onPress === 'function')!;
    await act(async () => button.props.onPress());
    expect(done).toHaveBeenCalledTimes(1);
  },
);
it.each(['paper', 'glass'] as const)(
  '%s uses the export prototype monospaced tree without changing its real export action',
  async skin => {
    const exportNow = jest.fn();
    const state = {
      ...notesBookSamples.normal,
      overlay: {
        kind: 'export' as const,
        format: 'md' as const,
        tree: 'Pagewise导出/课程讲义/\n  3.5.2-A星.md',
        desc: '每节一个文件',
        strip: true,
        stripHint: '高亮只保留前 30 字，方便分享',
        busy: false,
      },
    };
    const root = await render(
      skin,
      <NotesBookView state={state} intents={{ ...bookIntents, exportNow }} />,
    );
    expect(style(text(root, state.overlay.tree))).toMatchObject({
      fontFamily: 'monospace',
      fontSize: 11.5,
      lineHeight: 19.55,
      paddingVertical: skin === 'paper' ? 8 : 12,
      paddingHorizontal: skin === 'paper' ? 10 : 14,
    });
    const button = root
      .findAllByProps({ accessibilityLabel: '导出到「下载」' })
      .find(node => typeof node.props.onPress === 'function')!;
    await act(async () => button.props.onPress());
    expect(exportNow).toHaveBeenCalledTimes(1);
  },
);
