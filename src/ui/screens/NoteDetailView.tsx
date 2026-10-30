import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  AppBar,
  AiMessage,
  Button,
  Empty,
  ListSection,
  Note,
  Screen,
  Sheet,
  RichView,
  useTokens,
  makeStyles,
  usePresentation,
} from '@ui/kit';
import type { NoteDetailIntents, NoteDetailState } from '@features/notes/types';

function NoteGroup({
  title,
  grouped,
  children,
}: {
  title: string;
  grouped: boolean;
  children: ReactNode;
}) {
  const s = useStyles();
  return grouped ? (
    <ListSection title={title}>{children}</ListSection>
  ) : (
    <>
      <Text style={s.heading}>{title}</Text>
      {children}
    </>
  );
}
export function NoteDetailView({
  state,
  intents,
}: {
  state: NoteDetailState;
  intents: NoteDetailIntents;
}) {
  const s = useStyles(),
    t = useTokens();
  const { groupedLists: grouped } = usePresentation();
  const separator = (index: number) =>
    grouped && index > 0 ? <View style={s.separator} /> : null;
  return (
    <Screen scroll>
      <AppBar
        title={state.title}
        subtitle={state.subtitle}
        variant="push"
        backLabel="笔记"
        onBack={intents.back}
        right={
          state.canOpenSource ? (
            <Button variant="text" size="sm" onPress={intents.openSource}>
              原文
            </Button>
          ) : undefined
        }
      />
      {state.error ? (
        <View style={s.error}>
          <Note tone="bad">{state.error}</Note>
          <Button variant="text" onPress={intents.retry}>
            重试
          </Button>
        </View>
      ) : null}
      {state.loading ? (
        <Empty body="正在读取这节笔记…" />
      ) : (
        <View style={s.document}>
          <NoteGroup title="摘要" grouped={grouped}>
            <View style={s.summaryPanel}>
              <Text style={[s.summary, !state.summary ? s.muted : undefined]}>
                {state.summary ?? '学完这一节后生成'}
              </Text>
            </View>
          </NoteGroup>
          {state.qa.length ? (
            <NoteGroup title="问答" grouped={grouped}>
              {state.qa.map((qa, index) => (
                <View key={index} style={s.qa}>
                  {separator(index)}
                  <Text style={s.question}>{qa.q}</Text>
                  <Text style={s.answer}>{qa.a}</Text>
                  {qa.id && qa.messageIds?.length ? (
                    <Button
                      variant="text"
                      size="sm"
                      onPress={() => intents.openConversation?.(qa.id!)}
                    >
                      完整问答
                    </Button>
                  ) : null}
                </View>
              ))}
            </NoteGroup>
          ) : null}
          {state.detourQa.length ? (
            <NoteGroup title="岔路记录" grouped={grouped}>
              {state.detourQa.map((qa, index) => (
                <View key={index} style={s.qa}>
                  {separator(index)}
                  <Text style={s.detour}>{qa.from}</Text>
                  <Text style={s.question}>{qa.q}</Text>
                  <Text style={s.answer}>{qa.a}</Text>
                  {qa.id && qa.messageIds?.length ? (
                    <Button
                      variant="text"
                      size="sm"
                      onPress={() => intents.openConversation?.(qa.id!)}
                    >
                      完整问答
                    </Button>
                  ) : null}
                </View>
              ))}
            </NoteGroup>
          ) : null}
          {grouped && state.pins.length ? (
            <NoteGroup title="问答便签" grouped={grouped}>
              {state.pins.map((item, index) => (
                <Pressable
                  key={item.ref}
                  onPress={() => intents.openHighlight(item.ref)}
                  style={s.qa}
                  accessibilityRole="button"
                  accessibilityLabel={`打开便签 ${item.page}`}
                >
                  {separator(index)}
                  <Text style={s.question}>{item.q}</Text>
                  <Text style={s.answer}>{item.page}</Text>
                </Pressable>
              ))}
            </NoteGroup>
          ) : null}
          {state.stuck.length ? (
            <NoteGroup title="卡点" grouped={grouped}>
              {state.stuck.map((item, index) => (
                <View key={index} style={s.qa}>
                  {separator(index)}
                  <Text
                    style={[s.stuck, item.resolved ? s.resolved : undefined]}
                  >
                    {item.text}
                  </Text>
                </View>
              ))}
            </NoteGroup>
          ) : null}
          {state.highlights.length ? (
            <NoteGroup title="高亮" grouped={grouped}>
              {state.highlights.map((item, index) => (
                <Pressable
                  key={item.ref}
                  onPress={() => intents.openHighlight(item.ref)}
                  style={s.qa}
                  accessibilityRole="button"
                  accessibilityLabel={`打开高亮 ${item.page}`}
                >
                  {separator(index)}
                  <Text style={s.highlightLine}>
                    <Text style={s.highlight}>{item.text}</Text>
                  </Text>
                  <Text style={s.page}>{item.page}</Text>
                </Pressable>
              ))}
            </NoteGroup>
          ) : null}
          <NoteGroup title="我的笔记" grouped={grouped}>
            <TextInput
              style={s.editor}
              multiline
              textAlignVertical="top"
              value={state.userText}
              onChangeText={intents.setUserText}
              placeholder="写点自己的理解…"
              placeholderTextColor={t.color.ink3}
              accessibilityLabel="我的笔记"
            />
          </NoteGroup>
          {state.saveStatus !== '已保存' ? (
            <Text accessibilityLiveRegion="polite" style={s.saveStatus}>
              {state.saveStatus}
            </Text>
          ) : null}
        </View>
      )}
      <Sheet
        visible={!!state.conversation}
        title={state.conversation?.title ?? '完整问答'}
        subtitle="当时的提问与完整回答"
        detent="full"
        onClose={() => intents.closeConversation?.()}
        actions={
          state.canOpenSource
            ? [
                {
                  label: '本节原文',
                  kind: 'ghost',
                  onPress: intents.openSource,
                },
              ]
            : []
        }
      >
        {state.conversation?.loading ? (
          <Empty body="正在读取完整问答…" />
        ) : null}
        {state.conversation?.error ? (
          <View style={s.conversationMessage}>
            <Note tone="bad">{state.conversation.error}</Note>
            <Button
              variant="text"
              onPress={() => intents.retryConversation?.()}
            >
              重试
            </Button>
          </View>
        ) : state.conversation &&
          !state.conversation.loading &&
          !state.conversation.messages.length ? (
          <Empty body="这条问答的完整对话已不在本地，仍可查看笔记中的摘要。" />
        ) : null}
        {state.conversation?.missing && state.conversation.messages.length ? (
          <Note tone="warn">部分对话已不在本地，以下显示仍保留的内容。</Note>
        ) : null}
        {state.conversation?.messages.map(message => (
          <View key={message.id} style={s.conversationMessage}>
            <Text style={s.conversationRole}>
              {message.role === 'user' ? '我的提问' : 'AI 回答'}
            </Text>
            {message.role === 'user' ? (
              <RichView
                doc={message.doc}
                onCite={intents.openConversationSource}
                onFigure={intents.openConversationSource}
              />
            ) : (
              <AiMessage
                doc={message.doc}
                detour={message.detour}
                onCite={intents.openConversationSource}
                onFigure={intents.openConversationSource}
              />
            )}
          </View>
        ))}
      </Sheet>
    </Screen>
  );
}
const useStyles = makeStyles(t => {
  const grouped = t.layout.groupedLists,
    scale = t.type.body.fontSize / (grouped ? 17 : 14);
  return {
    error: { padding: t.space.pageX },
    conversationMessage: { paddingVertical: t.space.gap },
    conversationRole: {
      ...t.type.label,
      color: t.color.ink2,
      marginBottom: t.space.gap,
    },
    document: {
      backgroundColor: grouped ? t.color.bg : t.color.surface,
      paddingHorizontal: grouped ? 0 : 14,
      paddingTop: grouped ? 0 : 4,
      paddingBottom: grouped ? 0 : 14,
      marginBottom: grouped ? 0 : 8,
    },
    heading: {
      ...t.type.label,
      color: t.color.ink3,
      paddingTop: 12,
      paddingBottom: 6,
    },
    summaryPanel: {
      paddingVertical: grouped ? 14 : 0,
      paddingHorizontal: grouped ? 16 : 0,
    },
    summary: {
      ...t.type.body,
      fontSize: (grouped ? 15 : 14) * scale,
      lineHeight: (grouped ? 25.5 : 24.5) * scale,
      color: t.color.ink,
    },
    muted: { color: grouped ? t.color.ink2 : t.color.ink3 },
    qa: {
      paddingVertical: grouped ? 10 : 8,
      paddingHorizontal: grouped ? 16 : 0,
      borderBottomWidth: grouped ? 0 : 1,
      borderBottomColor: t.color.line,
      borderStyle: grouped ? 'solid' : 'dashed',
      backgroundColor: t.color.surface,
    },
    separator: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 16,
      height: 0.5,
      backgroundColor: t.color.line,
    },
    question: {
      ...t.type.body,
      fontSize: (grouped ? 15 : 14) * scale,
      lineHeight: (grouped ? 22.5 : 22.4) * scale,
      fontWeight: '600',
      color: t.color.ink,
    },
    answer: {
      ...t.type.body,
      fontSize: (grouped ? 14 : 13) * scale,
      lineHeight: (grouped ? 23.1 : 22.1) * scale,
      color: t.color.ink2,
      marginTop: grouped ? 2 : 0,
    },
    detour: {
      ...t.type.micro,
      lineHeight: (grouped ? 19.8 : 18.7) * scale,
      fontWeight: grouped ? '600' : '400',
      color: t.color.detour,
      marginBottom: grouped ? 2 : 0,
    },
    stuck: {
      ...t.type.body,
      fontSize: (grouped ? 15 : 14) * scale,
      lineHeight: (grouped ? 22.5 : 22.4) * scale,
      fontWeight: grouped ? '400' : '500',
      color: t.color.ink,
    },
    resolved: {
      textDecorationLine: 'line-through',
      color: grouped ? t.color.ink2 : t.color.ink3,
    },
    highlightLine: {
      ...t.type.body,
      fontSize: (grouped ? 14 : 13) * scale,
      lineHeight: (grouped ? 25.9 : 23.4) * scale,
    },
    highlight: {
      fontFamily: t.type.serifFamily,
      color: grouped ? t.color.ink : t.color.ink2,
      backgroundColor: t.color.highlight,
      paddingVertical: grouped ? 1 : 2,
      paddingHorizontal: 4,
      borderRadius: (t.shape.xs * 2) / 3,
    },
    page: {
      ...t.type.micro,
      fontWeight: '400',
      color: grouped ? t.color.ink2 : t.color.ink3,
      marginTop: grouped ? 2 : 0,
    },
    editor: {
      ...t.type.body,
      fontSize: (grouped ? 16 : 14) * scale,
      lineHeight: (grouped ? 25.6 : 23.8) * scale,
      minHeight: 120,
      borderWidth: grouped ? 0 : 1,
      borderColor: t.color.line,
      borderRadius: grouped ? t.shape.md - 4 : t.shape.sm,
      paddingVertical: grouped ? 13 : 9,
      paddingHorizontal: grouped ? 16 : 10,
      backgroundColor: t.color.editor,
      color: t.color.ink,
    },
    saveStatus: {
      ...t.type.micro,
      color: t.color.ink3,
      marginTop: 6,
      marginHorizontal: grouped ? 32 : 0,
    },
  };
});
