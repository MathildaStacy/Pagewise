import Renderer, { act } from 'react-test-renderer';
import {
  Button,
  RichView,
  SkinProvider,
  docLength,
  type RichDoc,
  type SkinId,
} from '@ui/kit';
import {
  ConversationList,
  ConversationPicker,
} from '@ui/screens/ConversationList';
import { StudyOverlays } from '@ui/screens/ReaderView';
import type { ConversationSummary } from '@features/library/types';
import type { StudyIntents } from '@features/study/types';

let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(() => renderer.unmount());
});
const doc = (text: string): RichDoc => [
  { t: 'p', c: [{ t: 'text', v: text }] },
];
const items: ConversationSummary[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  bookId: i % 2 ? 'b' : 'a',
  sectionId: '1.2',
  title: `对话 ${i + 1}`,
  subtitle: `技术书 ${i % 2} · 1.2 章节 · 3 条消息`,
  bookTitle: `技术书 ${i % 2}`,
  sectionTitle: '1.2 章节',
  messageCount: 3,
  updatedAt: '2026-10-31T12:00:00Z',
}));
const pressable = (testID: string) =>
  renderer.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  )[0];

it('limits the recent list, expands all conversations and preserves navigation', async () => {
  const onOpen = jest.fn();
  await act(() => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <ConversationList items={items} onOpen={onOpen} />
      </SkinProvider>,
    );
  });
  expect(pressable('conversation-4')).toBeUndefined();
  const expand = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === '查看全部 6 段对话' &&
      typeof node.props.onPress === 'function',
  )[0];
  await act(() => expand.props.onPress());
  expect(pressable('conversation-6')).toBeDefined();
  await act(() => pressable('conversation-6').props.onPress());
  expect(onOpen).toHaveBeenCalledWith(6);
});

it('marks the current conversation and keeps new and switch actions independent', async () => {
  const onOpen = jest.fn(),
    onNew = jest.fn();
  await act(() => {
    renderer = Renderer.create(
      <SkinProvider skinId="glass" scheme="dark" fontScale={1.3} reduceMotion>
        <ConversationPicker
          items={items}
          currentId={2}
          onOpen={onOpen}
          onNew={onNew}
        />
      </SkinProvider>,
    );
  });
  expect(pressable('conversation-2').props.accessibilityState.selected).toBe(
    true,
  );
  expect(pressable('conversation-1').props.accessibilityState.selected).toBe(
    false,
  );
  await act(() => renderer.root.findByType(Button).props.onPress());
  expect(onNew).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
  await act(() => pressable('conversation-3').props.onPress());
  expect(onOpen).toHaveBeenCalledWith(3);
});

it.each(
  (['paper', 'glass', 'meta', 'google', 'win11'] as SkinId[]).flatMap(skinId =>
    (['light', 'dark'] as const).map(scheme => ({ skinId, scheme })),
  ),
)(
  'places the translation below expandable original text in $skinId/$scheme',
  async ({ skinId, scheme }) => {
    const overlayAction = jest.fn();
    const quote = doc('An original paragraph. '.repeat(30));
    const intents = { overlayAction } as unknown as StudyIntents;
    await act(() => {
      renderer = Renderer.create(
        <SkinProvider
          skinId={skinId}
          scheme={scheme}
          fontScale={1.3}
          reduceMotion
        >
          <StudyOverlays
            overlay={{
              kind: 'sectionTranslation',
              sectionId: '1.2',
              subtitle: '1.2',
              quote,
              answer: doc('中文译文正在流入。'),
              streaming: true,
            }}
            intents={intents}
          />
        </SkinProvider>,
      );
    });
    const source = renderer.root.findByProps({ testID: 'translation-source' });
    expect(docLength(source.findByType(RichView).props.doc)).toBe(180);
    const texts = renderer.root.findAllByType(RichView);
    expect(texts[0].props.typography).toBe('sheetQuote');
    expect(texts[1].props.doc).toEqual(doc('中文译文正在流入。'));
    const expand = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === '展开全部原文' &&
        typeof node.props.onPress === 'function',
    )[0];
    await act(() => expand.props.onPress());
    expect(source.findByType(RichView).props.doc).toEqual(quote);
    const stop = renderer.root
      .findAllByType(Button)
      .find(node => node.props.label === '停止翻译')!;
    await act(() => stop.props.onPress());
    expect(overlayAction).toHaveBeenCalledWith('stop');
  },
);
