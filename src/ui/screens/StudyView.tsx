import { memo, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  View,
} from 'react-native';
import {
  AiMessage,
  AppBar,
  Button,
  Composer,
  DetourBanner,
  DoneCard,
  Empty,
  FoldCard,
  IconButton,
  ModeSwitch,
  Note,
  ProposalCard,
  QuickActions,
  QuizCard,
  ResumeCard,
  Screen,
  StepHeader,
  StepProgress,
  SysDivider,
  ToastHost,
  ToolSteps,
  Typing,
  UserBubble,
  makeStyles,
  usePresentation,
  useStableHandlers,
  useStickToBottom,
  BottomFade,
} from '@ui/kit';
import type {
  StudyIntents,
  StudyState,
  ThreadItem,
} from '@features/study/types';
import { ReaderContent, StudyOverlays } from './ReaderView';
export function StudyView({
  state,
  intents,
}: {
  state: StudyState;
  intents: StudyIntents;
}) {
  const { groupedLists, floatingChrome, brand } = usePresentation();
  const [dockHeight, setDockHeight] = useState(0);
  const [previousOpen, setPreviousOpen] = useState(false);
  const s = useStyles(),
    list = useRef<FlatList<ThreadItem>>(null),
    lastScroll = useRef<number | undefined>(undefined),
    // Stable identity lets unchanged rows skip rendering while text streams in.
    rowIntents = useStableHandlers(intents);
  const resumeIndex = brand
    ? state.listen.thread.findIndex(item => item.kind === 'resume')
    : -1;
  const previous =
    resumeIndex > 0 ? state.listen.thread.slice(0, resumeIndex) : [];
  const thread: ThreadItem[] = previous.length
    ? [
        {
          kind: 'history',
          id: 'resume-history',
          label: `更早的学习记录 · ${previous.length} 条消息`,
          expanded:
            previousOpen ||
            previous.some(item => item.id === state.listen.scroll.toItemId),
          items: previous,
        },
        ...state.listen.thread.slice(resumeIndex),
      ]
    : state.listen.thread;
  const index = state.listen.scroll.toItemId
    ? thread.findIndex(item => item.id === state.listen.scroll.toItemId)
    : -1;
  const stick = useStickToBottom(list, {
    resumeWhen: state.listen.composer.streaming,
    disabled: index >= 0,
    animated: !state.loading,
  });
  useEffect(() => {
    if (state.mode !== 'listen') return;
    if (index >= 0) {
      list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
      return;
    }
    if (lastScroll.current === state.listen.scroll.toEndToken) return;
    lastScroll.current = state.listen.scroll.toEndToken;
    stick.scrollToEnd({ animated: true });
  }, [
    state.mode,
    state.listen.scroll.toEndToken,
    state.listen.scroll.toItemId,
    state.listen.scroll.toItemToken,
    index,
    stick,
  ]);
  const comp = state.listen.composer;
  const paperReader = !groupedLists && state.mode === 'read';
  return (
    <Screen
      edges={
        groupedLists
          ? ['top', 'left', 'right']
          : ['top', 'left', 'right', 'bottom']
      }
    >
      <KeyboardAvoidingView style={s.root} behavior="padding">
        <AppBar
          variant="push"
          title={
            paperReader ? `原文 · ${state.header.title}` : state.header.title
          }
          subtitle={
            paperReader
              ? state.header.readSubtitle ?? state.header.subtitle
              : state.header.subtitle
          }
          onBack={paperReader ? () => intents.setMode('listen') : intents.back}
          backLabel={paperReader ? '返回' : state.header.backLabel}
          right={
            <View style={s.headerActions}>
              {brand?.kind !== 'win11' ? (
                <ModeSwitch value={state.mode} onChange={intents.setMode} />
              ) : null}
              {paperReader ? (
                <View
                  testID="reader-header-spacer"
                  style={s.readerHeaderSpacer}
                />
              ) : (
                <IconButton
                  icon="more"
                  label="伴读菜单"
                  onPress={intents.openMenu}
                />
              )}
            </View>
          }
        />
        {brand?.kind === 'win11' ? (
          <View style={s.selectorRow}>
            <ModeSwitch value={state.mode} onChange={intents.setMode} />
            <Button
              variant="text"
              size="sm"
              label="AI 看到的内容 ›"
              onPress={intents.openContext}
            />
          </View>
        ) : null}
        {state.mode === 'read' ? (
          <ReaderContent state={state.read} intents={intents} />
        ) : (
          <>
            <StepProgress
              steps={state.listen.progress.steps}
              label={
                groupedLists
                  ? state.listen.progress.label
                  : state.listen.progress.label.replace('步', '段')
              }
              onPressStep={intents.pressStep}
              onPressBar={intents.openRoadmap}
              right={
                brand?.kind !== 'win11' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="AI 看到的内容"
                    hitSlop={12}
                    onPress={intents.openContext}
                    style={s.context}
                  >
                    <Text style={s.contextLabel}>AI 看到的内容 ›</Text>
                  </Pressable>
                ) : undefined
              }
            />
            {state.listen.detour ? (
              <DetourBanner
                {...state.listen.detour}
                onBack={() => intents.quick('backMain')}
              />
            ) : null}
            <View style={s.listenArea}>
              <FlatList
                ref={list}
                style={s.root}
                contentContainerStyle={[
                  s.thread,
                  floatingChrome
                    ? { paddingBottom: dockHeight + 8 + 24 }
                    : undefined,
                ]}
                data={thread}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <ThreadRow
                    item={item}
                    intents={
                      item.id === 'resume-history'
                        ? {
                            ...rowIntents,
                            toggleHistory: () =>
                              setPreviousOpen(value => !value),
                          }
                        : rowIntents
                    }
                  />
                )}
                ListEmptyComponent={
                  <Empty
                    body={
                      state.loading
                        ? '正在准备本节路线图…'
                        : '从当前小节开始，一步一步读懂。'
                    }
                  />
                }
                {...stick.listProps}
                onScrollToIndexFailed={info =>
                  list.current?.scrollToOffset({
                    offset: Math.max(0, info.averageItemLength * info.index),
                    animated: true,
                  })
                }
              />
              <View
                onLayout={event =>
                  setDockHeight(event.nativeEvent.layout.height)
                }
                style={s.dock}
                pointerEvents="box-none"
              >
                {floatingChrome ? <BottomFade /> : null}
                {state.listen.quickActions.length ? (
                  <QuickActions
                    items={state.listen.quickActions.map(item =>
                      !groupedLists &&
                      (item.key === 'next' || item.key === 'nextPart')
                        ? { ...item, label: '懂了，继续' }
                        : groupedLists && item.kind === 'primary'
                        ? { ...item, icon: 'next' as const }
                        : item,
                    )}
                    onPress={intents.quick}
                  />
                ) : null}
                <Composer
                  value={comp.value}
                  onChange={intents.setText}
                  placeholder={
                    brand?.kind === 'win11' && !state.listen.detour
                      ? '问点什么，或说「讲慢一点」'
                      : comp.placeholder
                  }
                  onSend={intents.send}
                  onAdd={intents.openAdd}
                  sendDisabled={!comp.canSend}
                  micAvailable={false}
                  busy={comp.streaming}
                  onStop={intents.stop}
                  quote={
                    comp.quote
                      ? { ...comp.quote, onClear: intents.clearQuote }
                      : undefined
                  }
                />
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
      <StudyOverlays overlay={state.overlay} intents={intents} />
      <ToastHost toast={state.toast ? { message: state.toast } : null} />
    </Screen>
  );
}
function ThreadCard({
  item,
  intents,
  inRun = false,
}: {
  item: ThreadItem;
  intents: StudyIntents;
  inRun?: boolean;
}) {
  const s = useStyles();
  switch (item.kind) {
    case 'history':
      return (
        <FoldCard
          title={item.label}
          count=""
          expanded={item.expanded}
          onToggle={intents.toggleHistory}
        >
          {item.items.map(child => (
            <ThreadCard key={child.id} item={child} intents={intents} />
          ))}
        </FoldCard>
      );
    case 'divider':
      return <SysDivider text={item.text} tone={item.tone} />;
    case 'stepHeader':
      return (
        <StepHeader
          step={item.step}
          label={item.label}
          title={item.title}
          pages={item.pages}
        />
      );
    case 'user':
      return (
        <UserBubble text={item.text} quote={item.quote} detour={item.detour} />
      );
    case 'ai':
      return (
        <AiMessage
          doc={item.doc}
          streaming={item.streaming}
          detour={item.detour && !inRun}
          onCite={intents.pressCite}
          onFigure={intents.pressFigure}
        />
      );
    case 'tools':
      return <ToolSteps lines={item.lines} detour={item.detour} />;
    case 'resume':
      return (
        <ResumeCard
          title={item.title}
          lines={item.lines}
          actions={item.actions}
          onAction={intents.resumeAction}
        />
      );
    case 'fold':
      return (
        <FoldCard
          title={item.title}
          count={item.count}
          expanded={item.expanded}
          onToggle={() => intents.toggleFold(item.id)}
        >
          {item.items.map(child => (
            <ThreadCard key={child.id} item={child} intents={intents} />
          ))}
        </FoldCard>
      );
    case 'detourRun':
      return (
        <View style={s.detourRun}>
          {item.items.map(child => (
            <ThreadCard key={child.id} item={child} intents={intents} inRun />
          ))}
        </View>
      );
    case 'quiz':
      return (
        <View style={s.quiz}>
          <QuizCard
            title={item.title}
            question={item.question}
            options={item.options}
            locked={item.locked}
            onPick={index => intents.answerQuiz(item.id, index)}
          />
          {item.explain ? <Note tone="neutral">{item.explain}</Note> : null}
        </View>
      );
    case 'proposal':
      return (
        <ProposalCard
          title={item.title}
          body={item.body}
          state={item.state}
          resultText={item.resultText}
          actions={item.actions}
          onAction={key => intents.resolveProposal(item.id, key === 'accept')}
        />
      );
    case 'done':
      return (
        <DoneCard
          title={item.title}
          text={item.text}
          onPress={intents.finishReading}
        />
      );
    case 'typing':
      return <Typing />;
    case 'error':
      return (
        <View style={s.error}>
          <Note tone="bad">{item.text}</Note>
          {item.retry ? (
            <Button variant="secondary" onPress={() => intents.retry(item.id)}>
              重试
            </Button>
          ) : null}
          <Text style={s.hint}>可在「我的 → AI 服务」检查模型与密钥。</Text>
        </View>
      );
  }
}
const ThreadRow = memo(ThreadCard);
const useStyles = makeStyles(t => ({
  root: { flex: 1 },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  listenArea: { flex: 1 },
  dock: {
    position:
      t.layout.groupedLists && (!t.brand || t.brand.kind === 'win11')
        ? 'absolute'
        : 'relative',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop:
      t.layout.groupedLists && (!t.brand || t.brand.kind === 'win11') ? 26 : 0,
    backgroundColor: t.brand?.kind === 'meta' ? t.color.surface : undefined,
  },
  context: {
    paddingHorizontal: t.layout.groupedLists ? 0 : 8,
    paddingVertical: t.layout.groupedLists ? 0 : 1,
    borderWidth: t.layout.groupedLists ? 0 : 1,
    borderColor: t.color.line,
    borderRadius: t.shape.pill,
    backgroundColor: t.layout.groupedLists ? undefined : t.color.surface,
  },
  contextLabel: {
    ...t.type.micro,
    fontSize: t.layout.groupedLists
      ? t.type.caption.fontSize
      : t.type.micro.fontSize,
    fontWeight: t.layout.groupedLists ? '500' : '400',
    color: t.layout.groupedLists ? t.color.accent : t.color.ink2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  readerHeaderSpacer: { width: 40, flexShrink: 0 },
  thread: {
    paddingHorizontal: t.brand ? 16 : t.layout.groupedLists ? 20 : 14,
    paddingTop: t.layout.groupedLists ? 4 : 12,
    paddingBottom: t.layout.groupedLists ? 24 : 18,
    gap: 12,
  },
  detourRun: {
    borderLeftWidth: 3,
    borderLeftColor: t.color.detour,
    paddingLeft: t.space.gap,
    gap: t.space.gap,
  },
  quiz: { gap: t.space.gap },
  error: { paddingVertical: t.space.gap, gap: t.space.gap },
  hint: { ...t.type.caption, color: t.color.ink2 },
}));
