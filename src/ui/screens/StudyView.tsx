import { useEffect, useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Text, View } from 'react-native';
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
  const s = useStyles(),
    list = useRef<FlatList<ThreadItem>>(null),
    lastScroll = useRef<number | undefined>(undefined);
  const index = state.listen.scroll.toItemId
    ? state.listen.thread.findIndex(
        item => item.id === state.listen.scroll.toItemId,
      )
    : -1;
  useEffect(() => {
    if (state.mode !== 'listen') return;
    if (index >= 0) {
      list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
      return;
    }
    if (lastScroll.current === state.listen.scroll.toEndToken) return;
    lastScroll.current = state.listen.scroll.toEndToken;
    list.current?.scrollToEnd({ animated: true });
  }, [
    state.mode,
    state.listen.scroll.toEndToken,
    state.listen.scroll.toItemId,
    state.listen.scroll.toItemToken,
    index,
  ]);
  const comp = state.listen.composer;
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.root} behavior="padding">
        <AppBar
          variant="push"
          title={state.header.title}
          subtitle={state.header.subtitle}
          onBack={intents.back}
          backLabel={state.header.backLabel}
          right={
            <View style={s.headerActions}>
              <ModeSwitch value={state.mode} onChange={intents.setMode} />
              <IconButton
                icon="more"
                label="伴读菜单"
                onPress={intents.openMenu}
              />
            </View>
          }
        />
        {state.mode === 'read' ? (
          <ReaderContent state={state.read} intents={intents} />
        ) : (
          <>
            <StepProgress
              steps={state.listen.progress.steps}
              label={state.listen.progress.label}
              onPressStep={intents.pressStep}
              onPressBar={intents.openRoadmap}
              right={
                <Button size="sm" variant="ghost" onPress={intents.openContext}>
                  AI 看到的内容 ›
                </Button>
              }
            />
            {state.listen.detour ? (
              <DetourBanner
                {...state.listen.detour}
                onBack={() => intents.quick('backMain')}
              />
            ) : null}
            <FlatList
              ref={list}
              style={s.root}
              contentContainerStyle={s.thread}
              data={state.listen.thread}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <ThreadCard item={item} intents={intents} />
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
              onContentSizeChange={() => {
                if (index < 0)
                  list.current?.scrollToEnd({ animated: !state.loading });
              }}
              onScrollToIndexFailed={info =>
                list.current?.scrollToOffset({
                  offset: Math.max(0, info.averageItemLength * info.index),
                  animated: true,
                })
              }
            />
            {state.listen.quickActions.length ? (
              <QuickActions
                items={state.listen.quickActions}
                onPress={intents.quick}
              />
            ) : null}
            <Composer
              value={comp.value}
              onChange={intents.setText}
              placeholder={comp.placeholder}
              onSend={intents.send}
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
const useStyles = makeStyles(t => ({
  root: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.gap,
  },
  thread: {
    paddingHorizontal: t.space.pageX,
    paddingBottom: t.space.pageX,
    gap: t.space.gap,
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
