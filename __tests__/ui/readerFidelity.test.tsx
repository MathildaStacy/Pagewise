import Renderer, { act } from 'react-test-renderer';
import { FlatList, StyleSheet, Text } from 'react-native';
import { SkinProvider } from '@ui/kit';
import { ReaderContent } from '@ui/screens/ReaderView';
import { readerSamples } from '@features/study/samples';
import type { ReaderState, StudyIntents } from '@features/study/types';

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
