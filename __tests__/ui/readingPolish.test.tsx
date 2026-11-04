import Renderer, { act } from 'react-test-renderer';
import { FlatList, Modal } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  Button,
  AiMessage,
  AppBar,
  RichView,
  Segmented,
  MathView,
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
import { TranslationView } from '@ui/screens/TranslationView';
import type { ConversationSummary } from '@features/library/types';
import type { StudyIntents } from '@features/study/types';
import { BilingualReading } from '@ui/screens/BilingualReading';
import { blockDoc, presentTranslation } from '@features/study/presenters';
import type { Block } from '@core/types';

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

it('keeps the same source passage when switching between bilingual and Chinese reading', async () => {
  const scroll = jest
    .spyOn(FlatList.prototype, 'scrollToIndex')
    .mockImplementation(() => {});
  const passages = Array.from({ length: 20 }, (_, index) => ({
    id: `${index}:0`,
    ref: index,
    page: 'p.1',
    type: 'text',
    source: doc('A long source paragraph.'),
    answer: doc('一段中文译文。'),
    complete: true,
    preserved: false,
  }));
  try {
    await act(() => {
      renderer = Renderer.create(
        <SkinProvider skinId="paper" scheme="light" reduceMotion>
          <BilingualReading
            intents={{} as StudyIntents}
            overlay={{
              kind: 'sectionTranslation',
              sectionId: '1',
              subtitle: '1',
              answer: null,
              streaming: false,
              passages,
            }}
          />
        </SkinProvider>,
      );
    });
    renderer.root
      .findByType(FlatList)
      .props.onViewableItemsChanged({
        viewableItems: [{ item: passages[12] }],
      });
    await act(() => {
      renderer.root
        .findAllByType(Segmented)
        .find(node => node.props.accessibilityLabel === '双语阅读方式')!
        .props.onChange('chinese');
    });
    // Layout can briefly report the old viewport while the rows resize.
    renderer.root.findByType(FlatList).props.onViewableItemsChanged({
      viewableItems: [{ item: passages[0] }, { item: passages[12] }],
    });
    expect(scroll).not.toHaveBeenCalled();
    renderer.root.findByType(FlatList).props.onContentSizeChange(430, 5000);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(scroll).toHaveBeenCalledWith({
      index: 12,
      animated: false,
      viewPosition: 0,
    });
  } finally {
    scroll.mockRestore();
  }
});

it('names an explanation as teaching and copies its complete text with math and list numbering', async () => {
  const content: RichDoc = [
    ...doc('先看这个等式。'),
    { t: 'math', tex: 'x^2' },
    {
      t: 'list',
      ordered: true,
      start: 3,
      items: [[{ t: 'text', v: '保留编号' }]],
    },
  ];
  await act(() => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <AiMessage doc={content} />
      </SkinProvider>,
    );
  });
  expect(renderer.root.findByType(RichView).props.selectable).toBe(true);
  await act(() =>
    renderer.root
      .findAllByType(Button)
      .find(button => button.props.label === '复制讲解')!
      .props.onPress(),
  );
  expect(Clipboard.setString).toHaveBeenCalledWith(
    '先看这个等式。\n\n$$x^2$$\n\n3. 保留编号',
  );
  await act(() =>
    renderer.update(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <StudyOverlays
          intents={{} as StudyIntents}
          overlay={{
            kind: 'explain',
            seq: 1,
            quote: doc('Source'),
            answer: content,
            streaming: false,
            subtitle: 'p.1',
          }}
        />
      </SkinProvider>,
    ),
  );
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('AI 讲解');
  expect(text).toContain('讲解完成');
  expect(text).not.toContain('中文译文');
  expect(text).not.toContain('翻译完成');
  expect(
    renderer.root.findAllByType(RichView).every(view => view.props.selectable),
  ).toBe(true);
});

it.each([
  { streaming: true, status: '正在讲解', action: '停止讲解', key: 'stop' },
  { stopped: true, status: '已停止', action: '重新讲解', key: 'regenerate' },
  {
    error: '网络连接中断',
    status: '讲解中断',
    action: '重试讲解',
    key: 'regenerate',
  },
])('keeps explanation status and recovery accurate: $status', async scenario => {
  const overlayAction = jest.fn();
  await act(() => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="dark" reduceMotion>
        <StudyOverlays
          intents={{ overlayAction } as unknown as StudyIntents}
          overlay={{
            kind: 'explain',
            seq: 1,
            quote: doc('Source'),
            answer: doc('已有讲解。'),
            subtitle: 'p.1',
            streaming: scenario.streaming ?? false,
            stopped: scenario.stopped,
            error: scenario.error,
          }}
        />
      </SkinProvider>,
    );
  });
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain(scenario.status);
  expect(text).not.toContain('中文译文');
  expect(text).not.toContain('翻译完成');
  await act(() =>
    renderer.root
      .findAllByType(Button)
      .find(button => button.props.label === scenario.action)!
      .props.onPress(),
  );
  expect(overlayAction).toHaveBeenCalledWith(scenario.key);
});

it('restores MinerU bullets and keeps the source table visible until its translated shape is validated', () => {
  expect(
    blockDoc(
      {
        type: 'text',
        text: '\\- First limitation\n\\- Second limitation',
      } as Block,
      null,
    ),
  ).toEqual([
    {
      t: 'list',
      ordered: false,
      items: [
        [{ t: 'text', v: 'First limitation' }],
        [{ t: 'text', v: 'Second limitation' }],
      ],
    },
  ]);
  const [part] = presentTranslation(
    [
      {
        id: '1:0',
        block: {
          seq: 1,
          type: 'table',
          page: 1,
          text: '',
          html: '<table><tr><td>A</td></tr></table>',
        } as Block,
        source: '<table><tr><td>A</td></tr></table>',
        translate: true,
        answer: '<table><tr><td>中',
        complete: false,
      },
    ],
    null,
  );
  expect(part.sourceGrid?.cells).toHaveLength(1);
  expect(part.answer).toBeNull();
  expect(part.answerGrid).toBeUndefined();
});

it.each(
  (['paper', 'glass', 'meta', 'google', 'win11'] as SkinId[]).flatMap(skinId =>
    (['light', 'dark'] as const).map(scheme => ({ skinId, scheme })),
  ),
)(
  'keeps paragraph pairing, missing translations and source references usable in $skinId/$scheme',
  async ({ skinId, scheme }) => {
    const pressCite = jest.fn();
    await act(() => {
      renderer = Renderer.create(
        <SkinProvider
          skinId={skinId}
          scheme={scheme}
          readingSize="l"
          fontScale={1.3}
          reduceMotion
        >
          <BilingualReading
            intents={{ pressCite } as unknown as StudyIntents}
            overlay={{
              kind: 'sectionTranslation',
              sectionId: '1',
              subtitle: 'A real chapter',
              answer: null,
              streaming: false,
              stopped: true,
              passages: [
                {
                  id: '1:0',
                  ref: 1,
                  page: 'p.1',
                  type: 'text',
                  source: doc('First source paragraph.'),
                  answer: [...doc('第一段。'), ...doc('模型分成两段。')],
                  complete: true,
                  preserved: false,
                },
                {
                  id: '2:0',
                  ref: 2,
                  page: 'p.2',
                  type: 'text',
                  source: doc('Untranslated paragraph.'),
                  answer: null,
                  complete: false,
                  preserved: false,
                },
                {
                  id: '3:0',
                  ref: 3,
                  page: 'p.2',
                  type: 'equation',
                  source: [{ t: 'math', tex: 'E=mc^2' }],
                  answer: null,
                  complete: true,
                  preserved: true,
                },
              ],
            }}
          />
        </SkinProvider>,
      );
    });
    const ids = (id: string) => renderer.root.findAllByProps({ testID: id });
    expect(ids('translation-original-1:0').length).toBeGreaterThan(0);
    expect(ids('translation-chinese-1:0').length).toBeGreaterThan(0);
    expect(
      renderer.root
        .findAllByType(RichView)
        .every(view => view.props.typography === 'book'),
    ).toBe(true);
    expect(renderer.root.findAllByType(MathView)).toHaveLength(1);
    await act(() =>
      renderer.root.findByType(Segmented).props.onChange('chinese'),
    );
    expect(ids('translation-original-1:0')).toHaveLength(0);
    expect(ids('translation-original-2:0').length).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(MathView)).toHaveLength(1);
    await act(() =>
      renderer.root.findByType(Segmented).props.onChange('source'),
    );
    expect(ids('translation-chinese-1:0')).toHaveLength(0);
    expect(ids('translation-original-1:0').length).toBeGreaterThan(0);
    await act(() =>
      renderer.root
        .findAllByType(Button)
        .find(button => button.props.label === '查看原文 · p.1')!
        .props.onPress(),
    );
    expect(pressCite).toHaveBeenCalledWith(1);
  },
);

it('shows a cached translation in full immediately even when reading animations are enabled', async () => {
  const intents = { overlayAction: jest.fn() } as unknown as StudyIntents;
  const answer = doc('已经保存的完整中文译文。'.repeat(100));
  const view = (cached: boolean) => (
    <SkinProvider skinId="paper" scheme="light" reduceMotion={false}>
      <TranslationView
        intents={intents}
        overlay={{
          kind: 'sectionTranslation',
          sectionId: '1',
          subtitle: '1',
          answer: cached ? answer : null,
          streaming: !cached,
          fromCache: cached,
        }}
      />
    </SkinProvider>
  );
  await act(() => {
    renderer = Renderer.create(view(false));
  });
  await act(() => renderer.update(view(true)));
  expect(renderer.root.findByType(RichView).props.doc).toEqual(answer);
  expect(
    renderer.root.findByProps({ testID: 'translation-answer' }).props
      .accessibilityState.busy,
  ).toBe(false);
});

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
    const closeOverlay = jest.fn();
    const quote = doc('An original paragraph. '.repeat(30));
    const intents = { overlayAction, closeOverlay } as unknown as StudyIntents;
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
    expect(renderer.root.findByType(Modal).props.transparent).not.toBe(true);
    expect(
      renderer.root
        .findByProps({ testID: 'reading-sheet-body' })
        .findAllByType(Button)
        .some(node => node.props.label === '停止翻译'),
    ).toBe(false);
    expect(docLength(source.findByType(RichView).props.doc)).toBe(180);
    const texts = renderer.root.findAllByType(RichView);
    expect(texts[0].props.typography).toBe('book');
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
    await act(() => renderer.root.findByType(AppBar).props.onBack());
    await act(() => renderer.root.findByType(Modal).props.onRequestClose());
    expect(closeOverlay).toHaveBeenCalledTimes(2);
  },
);

it('lets a long explained paragraph narrow to one sentence and return to the whole block', async () => {
  const overlayAction = jest.fn();
  const intents = { overlayAction } as unknown as StudyIntents;
  const sentences = ['动量来自风险补偿。', '也有人认为来自行为偏差。'];
  const view = (focus: number | null) => (
    <SkinProvider skinId="paper" scheme="light" reduceMotion>
      <TranslationView
        intents={intents}
        overlay={{
          kind: 'explain',
          seq: 1,
          quote: doc(sentences.join('')),
          answer: doc('讲解'),
          streaming: false,
          subtitle: 'p.1',
          sentences,
          focus,
        }}
      />
    </SkinProvider>
  );
  await act(() => {
    renderer = Renderer.create(view(null));
  });
  const byLabel = (label: string) =>
    renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )[0];
  await act(() => byLabel('选一句只讲这一句').props.onPress());
  await act(() => byLabel('只讲第 2 句').props.onPress());
  expect(overlayAction).toHaveBeenLastCalledWith('focus:1');
  await act(() => renderer.update(view(1)));
  expect(
    renderer.root
      .findByProps({ testID: 'explain-focus' })
      .findAllByType(Button)[0].props.label,
  ).toBe('讲整段');
  await act(() =>
    renderer.root
      .findByProps({ testID: 'explain-focus' })
      .findAllByType(Button)[0]
      .props.onPress(),
  );
  expect(overlayAction).toHaveBeenLastCalledWith('focus:none');
});

it('shows a one-line preview for a collapsed AI example so it never looks empty', async () => {
  await act(() => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <RichView
          doc={[
            {
              t: 'aux',
              kind: 'example',
              open: false,
              body: doc('估计吃掉 5 档以内 10 万股的平均成本，L2 足够。'),
            },
          ]}
        />
      </SkinProvider>,
    );
  });
  const preview = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel ===
        '展开AI 举例：估计吃掉 5 档以内 10 万股的平均成本，L2 足够。' &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(preview).toBeDefined();
  await act(() => preview.props.onPress());
  expect(
    renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === '收起AI 举例' &&
        typeof node.props.onPress === 'function',
    ),
  ).toHaveLength(1);
});
