import { useState } from 'react';
import Renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import {
  AppBar,
  Button,
  Dialog,
  IconButton,
  ReadEnd,
  RichView,
  Sheet,
  SkinProvider,
} from '@ui/kit';
import {
  ReaderContent,
  ReaderView,
  StudyOverlays,
} from '@ui/screens/ReaderView';
import { StudyView } from '@ui/screens/StudyView';
import { readerSamples, studySamples } from '@features/study/samples';
import type {
  ReaderState,
  StudyIntents,
  StudyOverlay,
} from '@features/study/types';

const no = () => {};
const intents: StudyIntents = {
  back: no,
  setMode: no,
  openMenu: no,
  menuSelect: no,
  quick: no,
  setText: no,
  send: no,
  stop: no,
  clearQuote: no,
  pressStep: no,
  openRoadmap: no,
  openContext: no,
  pressCite: no,
  pressFigure: no,
  pressTable: no,
  toggleFold: no,
  toggleHistory: no,
  answerQuiz: no,
  resolveProposal: no,
  resumeAction: no,
  retry: no,
  setView: no,
  toggleGuide: no,
  pressBlock: no,
  menuAction: no,
  reportAnchor: no,
  pressPin: no,
  finishReading: no,
  overlayAction: no,
  setNoteText: no,
  closeOverlay: no,
};
let renderer: Renderer.ReactTestRenderer;
let toOffset: jest.SpyInstance;
let toIndex: jest.SpyInstance;
beforeEach(() => {
  toOffset = jest
    .spyOn(FlatList.prototype, 'scrollToOffset')
    .mockImplementation(no);
  toIndex = jest
    .spyOn(FlatList.prototype, 'scrollToIndex')
    .mockImplementation(no);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
async function render(
  skin: 'paper' | 'glass',
  state = readerSamples.normal.read,
  actions = intents,
) {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId={skin} scheme="light" reduceMotion>
        <ReaderContent state={state} intents={actions} />
      </SkinProvider>,
    );
  });
  return renderer.root;
}
const layout = (y: number, height: number) => ({
  nativeEvent: { layout: { x: 0, y, width: 360, height } },
});
async function measure(ref: string, y: number, height: number) {
  await act(async () =>
    renderer.root
      .findByProps({ testID: `reader-cell-${ref}` })
      .props.onLayout(layout(y, height)),
  );
}

it('lands on the actual target paragraph deep within a page after its cell is measured', async () => {
  const root = await render('glass', {
    ...readerSamples.normal.read,
    scrollTo: { ref: 'b3', flash: true, token: 1 },
  });
  const list = root.findByType(FlatList);
  expect(toIndex).toHaveBeenCalledWith({
    index: 2,
    animated: false,
    viewPosition: 0.3,
  });
  await act(async () => list.props.onLayout(layout(0, 400)));
  await measure('b1', 40, 70);
  await measure('b2', 110, 790);
  await measure('b3', 900, 80);
  expect(toOffset).toHaveBeenLastCalledWith({ offset: 780, animated: false });
});

it('reports the paragraph at the viewport center rather than a fixed middle block of the PDF page', async () => {
  const reportAnchor = jest.fn();
  const root = await render('paper', readerSamples.normal.read, {
    ...intents,
    reportAnchor,
  });
  await measure('b1', 40, 70);
  await measure('b2', 110, 790);
  await measure('b3', 900, 80);
  const list = root.findByType(FlatList);
  const scroll = (y: number) =>
    list.props.onScroll({
      nativeEvent: { contentOffset: { y }, layoutMeasurement: { height: 400 } },
    });
  await act(async () => scroll(0));
  expect(reportAnchor).toHaveBeenLastCalledWith('b2');
  await act(async () => scroll(740));
  expect(reportAnchor).toHaveBeenLastCalledWith('b3');
});

it('corrects a virtualized unmeasured jump when the destination cell mounts', async () => {
  const root = await render('paper', {
    ...readerSamples.normal.read,
    scrollTo: { ref: 'b3', flash: true, token: 1 },
  });
  const list = root.findByType(FlatList);
  await act(async () => list.props.onLayout(layout(0, 400)));
  await act(async () =>
    list.props.onScrollToIndexFailed({
      averageItemLength: 100,
      index: 2,
      highestMeasuredFrameIndex: 0,
    }),
  );
  expect(toOffset).toHaveBeenLastCalledWith({ offset: 200, animated: false });
  await measure('b3', 1500, 80);
  expect(toOffset).toHaveBeenLastCalledWith({ offset: 1380, animated: false });
});

it('does not persist a coarse jump and respects a user drag before the target mounts', async () => {
  const reportAnchor = jest.fn();
  const root = await render(
    'glass',
    {
      ...readerSamples.normal.read,
      scrollTo: { ref: 'b3', flash: true, token: 1 },
    },
    { ...intents, reportAnchor },
  );
  const list = root.findByType(FlatList);
  await measure('b2', 0, 500);
  const event = {
    nativeEvent: {
      contentOffset: { y: 0 },
      layoutMeasurement: { height: 400 },
    },
  };
  await act(async () => list.props.onScroll(event));
  expect(reportAnchor).not.toHaveBeenCalled();
  await act(async () => list.props.onScrollBeginDrag());
  await act(async () => list.props.onScroll(event));
  expect(reportAnchor).toHaveBeenLastCalledWith('b2');
  await measure('b3', 1500, 80);
  expect(toOffset).not.toHaveBeenCalled();
});

it.each(['paper', 'glass'] as const)(
  'uses %s page boundaries without splitting the Apple reading article',
  async skin => {
    const block = readerSamples.normal.read.items.find(
      item => item.kind === 'block',
    )!;
    const read: ReaderState = {
      ...readerSamples.normal.read,
      items: [
        ...readerSamples.normal.read.items,
        { kind: 'pageBreak', id: 'p104', page: 'p.104' },
        { ...block, ref: 'b4', seq: 4 },
      ],
    };
    const root = await render(skin, read);
    const list = root.findByType(FlatList);
    const rows = list.props.data;
    const firstPageNumber = rows.find(
      (row: { label?: string }) => row.label === 'p.103',
    );
    const nextPageBlock = rows.find((row: { id: string }) => row.id === 'b4');
    expect(nextPageBlock.start).toBe(skin === 'paper');
    expect(firstPageNumber.end).toBe(skin === 'paper');
    const pageNumber = list.props.renderItem({ item: firstPageNumber });
    const style = StyleSheet.flatten(pageNumber.props.style);
    expect(style).toMatchObject({
      marginHorizontal: skin === 'glass' ? 16 : 12,
      paddingHorizontal: skin === 'glass' ? 20 : 16,
    });
    if (skin === 'paper')
      expect(style).toMatchObject({
        backgroundColor: undefined,
        paddingBottom: 14,
        marginBottom: 14,
      });
    else expect(style.borderBottomLeftRadius).toBeUndefined();
    const label = pageNumber.props.children;
    if (skin === 'paper')
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({
        color: '#A8A196',
        borderTopColor: '#DDD6C8',
      });
    expect(StyleSheet.flatten(label.props.style).textAlign).toBe(
      skin === 'glass' ? 'center' : 'left',
    );
  },
);

it.each(['paper', 'glass'] as const)(
  'gives %s reader titles their prototype heading hierarchy',
  async skin => {
    const root = await render(skin);
    const title = root
      .findAllByType(Text)
      .find(node => node.props.accessibilityRole === 'header')!;
    expect(title.props.children).toBe('3.5.2 A*搜索');
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      fontSize: skin === 'glass' ? 22.1 : 20.625,
      fontWeight: '700',
      fontFamily: 'sans-serif',
    });
  },
);

it.each(['flow', 'orig'] as const)(
  'shows the Apple labelled guide in %s mode and routes expansion through the same intent',
  async view => {
    const toggleGuide = jest.fn();
    const root = await render(
      'glass',
      {
        ...readerSamples.normal.read,
        view,
        original: { available: true, loading: false, pages: [] },
      },
      { ...intents, toggleGuide },
    );
    const guide = root.findByProps({ accessibilityLabel: '本节导读' });
    expect(
      root.findAllByType(Text).some(node => node.props.children === '本节导读'),
    ).toBe(true);
    expect(
      root
        .findAllByType(Text)
        .find(
          node =>
            node.props.children === readerSamples.normal.read.guide!.oneLine,
        )!.props.numberOfLines,
    ).toBe(1);
    await act(async () => guide.props.onPress());
    expect(toggleGuide).toHaveBeenCalledTimes(1);
  },
);

it('includes measured guide height in original-page offsets', async () => {
  const root = await render('glass', {
    ...readerSamples.normal.read,
    view: 'orig',
    original: {
      available: true,
      loading: false,
      pages: [
        {
          page: 103,
          label: 'p.103',
          size: { w: 600, h: 800 },
          image: null,
          blocks: [],
        },
      ],
    },
  });
  const list = root.findByType(FlatList);
  await act(async () =>
    list.props.ListHeaderComponent.props.onLayout(layout(0, 70)),
  );
  expect(
    root.findByType(FlatList).props.getItemLayout(undefined, 0).offset,
  ).toBe(70);
});

it.each(['paper', 'glass'] as const)(
  'keeps the standalone Reader header from the %s prototype',
  async skin => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <ReaderView state={readerSamples.normal} intents={intents} />
        </SkinProvider>,
      );
    });
    const bar = renderer.root.findByType(AppBar);
    expect(bar.props.title).toBe(
      skin === 'paper' ? '原文 · 3.5.2 A*搜索' : '3.5.2 A*搜索',
    );
    expect(bar.props.subtitle).toBe('p.103–105');
    expect(
      StyleSheet.flatten(
        renderer.root.findByProps({ testID: 'reader-header-spacer' }).props
          .style,
      ),
    ).toMatchObject({ width: skin === 'paper' ? 40 : 44, flexShrink: 0 });
  },
);

it.each(['paper', 'glass'] as const)(
  'keeps the %s Study reading header and return action from its prototype',
  async skin => {
    const setMode = jest.fn(),
      back = jest.fn();
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <StudyView
            state={{ ...studySamples.normal, mode: 'read' }}
            intents={{ ...intents, setMode, back }}
          />
        </SkinProvider>,
      );
    });
    const bar = renderer.root.findByType(AppBar);
    expect(bar.props.title).toBe(
      skin === 'paper'
        ? `原文 · ${studySamples.normal.header.title}`
        : studySamples.normal.header.title,
    );
    expect(bar.props.subtitle).toBe(
      skin === 'paper' ? 'p.103–105' : studySamples.normal.header.subtitle,
    );
    expect(
      renderer.root
        .findAllByType(IconButton)
        .filter(button => button.props.icon === 'more'),
    ).toHaveLength(skin === 'paper' ? 0 : 1);
    expect(
      renderer.root.findAllByProps({ testID: 'reader-header-spacer' }).length >
        0,
    ).toBe(skin === 'paper');
    await act(async () => bar.props.onBack());
    if (skin === 'paper') {
      expect(setMode).toHaveBeenCalledWith('listen');
      expect(back).not.toHaveBeenCalled();
    } else expect(back).toHaveBeenCalledTimes(1);
  },
);

it('keeps the Apple thread spacing outside the floating dock', async () => {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="glass" scheme="light" reduceMotion>
        <StudyView state={studySamples.normal} intents={intents} />
      </SkinProvider>,
    );
  });
  const list = () => renderer.root.findByType(FlatList);
  expect(StyleSheet.flatten(list().props.contentContainerStyle)).toMatchObject({
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  });
  const dock = renderer.root.findAll(
    node =>
      node.props.pointerEvents === 'box-none' &&
      typeof node.props.onLayout === 'function',
  )[0];
  await act(async () => dock.props.onLayout(layout(0, 100)));
  expect(
    StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom,
  ).toBe(132);
});

it.each(['flow', 'orig'] as const)(
  'uses one Apple read-end spacing container in %s mode',
  async view => {
    const finishReading = jest.fn();
    const root = await render(
      'glass',
      {
        ...readerSamples.normal.read,
        view,
        original: { available: true, loading: false, pages: [] },
        readEnd: { visible: true, label: '读完了', hint: '生成本节小结' },
      },
      { ...intents, finishReading },
    );
    expect(root.findByType(FlatList).props.ListFooterComponent.type).toBe(
      ReadEnd,
    );
    const end = root.findByType(ReadEnd);
    const region = end.findByProps({
      accessibilityRole: 'none',
      accessibilityLabel: '读完了',
    });
    expect(StyleSheet.flatten(region.props.style)).toMatchObject({
      paddingTop: 22,
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
      alignItems: 'center',
    });
    const button = end.findByType(Button);
    expect(button.props.icon).toBeUndefined();
    const hint = end
      .findAllByType(Text)
      .find(node => node.props.children === '生成本节小结')!;
    expect(StyleSheet.flatten(hint.props.style)).toMatchObject({
      fontSize: 12,
      textAlign: 'center',
    });
    await act(async () => button.props.onPress());
    expect(finishReading).toHaveBeenCalledTimes(1);
  },
);

const explanation: Extract<StudyOverlay, { kind: 'explain' | 'translate' }> = {
  kind: 'explain',
  seq: 3,
  quote: [{ t: 'p', c: [{ t: 'text', v: '书中的原文' }] }],
  answer: [{ t: 'p', c: [{ t: 'text', v: '这一段的解释' }] }],
  streaming: false,
  subtitle: 'p.103 · 3.5.2 A*搜索 · 整理模型',
};
async function renderOverlay(
  skin: 'paper' | 'glass',
  overlay: StudyOverlay,
  actions = intents,
) {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId={skin} scheme="light" reduceMotion>
        <StudyOverlays overlay={overlay} intents={actions} />
      </SkinProvider>,
    );
  });
  return renderer.root;
}
function insideSheetBody(node: ReactTestInstance) {
  let ancestor = node.parent;
  while (ancestor) {
    if (ancestor.props.testID === 'sheet-scroll-body') return true;
    ancestor = ancestor.parent;
  }
  return false;
}
it.each(['paper', 'glass'] as const)(
  'keeps the %s explain actions in their prototype order and sheet region',
  async skin => {
    const overlayAction = jest.fn();
    const root = await renderOverlay(skin, explanation, {
      ...intents,
      overlayAction,
    });
    const footer = root.findByProps({ testID: 'sheet-actions' });
    const buttons = footer.findAllByType(Button);
    expect(buttons.map(button => button.props.label)).toEqual(
      skin === 'glass'
        ? ['带到听讲里继续问', '好的', '记为卡点']
        : ['记为卡点', '带到伴读里继续问'],
    );
    expect(buttons.map(button => button.props.variant)).toEqual(
      skin === 'glass' ? ['primary', 'ghost', 'ghost'] : ['ghost', 'primary'],
    );
    expect(StyleSheet.flatten(footer.props.style).flexDirection).toBe(
      skin === 'glass' ? 'column' : 'row',
    );
    expect(insideSheetBody(footer)).toBe(skin === 'paper');
    const body = root.findByProps({ testID: 'sheet-body' });
    expect(body.findAllByType(Button)).toHaveLength(0);
    const quote = body
      .findAllByType(RichView)
      .find(node => node.props.typography === 'sheetQuote')!;
    const quoteText = quote
      .findAllByType(Text)
      .find(
        node => StyleSheet.flatten(node.props.style)?.fontFamily === 'serif',
      )!;
    expect(StyleSheet.flatten(quoteText.props.style)).toMatchObject({
      fontFamily: 'serif',
      fontSize: skin === 'glass' ? 15 : 13,
      lineHeight: skin === 'glass' ? 27 : 23.4,
    });
    await act(async () => buttons.forEach(button => button.props.onPress()));
    expect(overlayAction.mock.calls.map(([action]) => action)).toEqual(
      skin === 'glass' ? ['ask', 'ok', 'stuck'] : ['stuck', 'ask'],
    );
  },
);
it.each([
  { ...explanation, answer: null },
  { ...explanation, streaming: true },
])('prevents pin confirmation before the answer is ready', async overlay => {
  const overlayAction = jest.fn();
  const root = await renderOverlay('glass', overlay, {
    ...intents,
    overlayAction,
  });
  const okay = root
    .findByProps({ testID: 'sheet-actions' })
    .findAllByType(Button)
    .find(button => button.props.label === '好的')!;
  expect(okay.props.disabled).toBe(true);
  const nativeButton = okay.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === '好的' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(nativeButton.props.accessibilityState.disabled).toBe(true);
  await act(async () => okay.props.onPress());
  expect(overlayAction).not.toHaveBeenCalled();
});
it.each(['paper', 'glass'] as const)(
  'uses the %s translation footer from its prototype',
  async skin => {
    const closeOverlay = jest.fn();
    const root = await renderOverlay(
      skin,
      { ...explanation, kind: 'translate' },
      { ...intents, closeOverlay },
    );
    const actions = root.findByType(Sheet).props.actions;
    expect(
      root
        .findAllByType(RichView)
        .some(node => node.props.typography === 'sheetQuote'),
    ).toBe(true);
    expect(actions.map((action: { label: string }) => action.label)).toEqual(
      skin === 'glass' ? ['好的'] : [],
    );
    if (skin === 'glass') {
      expect(actions[0].kind).toBe('primary');
      await act(async () => actions[0].onPress());
      expect(closeOverlay).toHaveBeenCalledTimes(1);
    }
  },
);
it.each(['paper', 'glass'] as const)(
  'edits a %s note in a keyboard-aware dialog and requires nonempty text',
  async skin => {
    const overlayAction = jest.fn(),
      closeOverlay = jest.fn();
    function Draft({
      skinId,
      scheme,
    }: {
      skinId: 'paper' | 'glass';
      scheme: 'light' | 'dark';
    }) {
      const [value, setNoteText] = useState('');
      return (
        <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
          <StudyOverlays
            overlay={{
              kind: 'note',
              seq: 3,
              quote: explanation.quote,
              value,
              subtitle: 'p.103',
            }}
            intents={{ ...intents, setNoteText, overlayAction, closeOverlay }}
          />
        </SkinProvider>
      );
    }
    await act(async () => {
      renderer = Renderer.create(<Draft skinId={skin} scheme="light" />);
    });
    const dialog = () => renderer.root.findByType(Dialog);
    const input = () => renderer.root.findByType(TextInput);
    expect(renderer.root.findAllByType(Sheet)).toHaveLength(0);
    expect(dialog().props.title).toBe('记笔记 · p.103');
    expect(dialog().props.confirm).toBe('保存');
    expect(dialog().props.cancel).toBe('取消');
    expect(input().props).toMatchObject({
      multiline: true,
      autoFocus: true,
      placeholder: '写下你的理解',
    });
    const quote = renderer.root
      .findByProps({ testID: 'dialog-body-slot' })
      .findAllByType(Text)
      .find(
        node => StyleSheet.flatten(node.props.style)?.fontFamily === 'serif',
      )!;
    expect(StyleSheet.flatten(quote.props.style)).toMatchObject({
      fontFamily: 'serif',
      fontSize: 13,
      lineHeight: 23.4,
    });
    const scroll = renderer.root.findByType(ScrollView);
    expect(scroll.props).toMatchObject({
      keyboardShouldPersistTaps: 'handled',
      keyboardDismissMode: 'interactive',
      automaticallyAdjustKeyboardInsets: true,
    });
    await act(async () => input().props.onChangeText('  '));
    await act(async () => dialog().props.onConfirm());
    expect(overlayAction).not.toHaveBeenCalled();
    await act(async () => input().props.onChangeText('保留这段理解'));
    for (const [skinId, scheme] of [
      ['glass', 'dark'],
      ['paper', 'dark'],
      ['paper', 'light'],
    ] as const) {
      await act(async () =>
        renderer.update(<Draft skinId={skinId} scheme={scheme} />),
      );
      expect(input().props.value).toBe('保留这段理解');
    }
    await act(async () => dialog().props.onConfirm());
    expect(overlayAction).toHaveBeenCalledWith('save');
    await act(async () => dialog().props.onCancel());
    expect(closeOverlay).toHaveBeenCalledTimes(1);
  },
);
