import { Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Empty,
  ListSection,
  Note,
  Row,
  Screen,
  Segmented,
  Sheet,
  Switch,
  Tag,
  makeStyles,
} from '@ui/kit';
import type { NotesBookIntents, NotesBookState } from '@features/notes/types';

export function NotesBookView({
  state,
  intents,
}: {
  state: NotesBookState;
  intents: NotesBookIntents;
}) {
  const overlay = state.overlay;
  const styles = useStyles();
  return (
    <Screen scroll>
      <AppBar
        title={state.title}
        subtitle="笔记"
        variant="push"
        backLabel="笔记"
        onBack={intents.back}
        right={
          <Button variant="text" size="sm" onPress={intents.openExport}>
            导出
          </Button>
        }
      />
      {state.error ? (
        <View style={styles.s0}>
          <Note tone="bad">{state.error}</Note>
          <Button variant="text" onPress={intents.retry}>
            重试
          </Button>
        </View>
      ) : null}
      {state.loading ? (
        <Empty body="正在整理章节笔记…" />
      ) : !state.chapters.length ? (
        <Empty
          title="这本书还没有笔记"
          body="学完一节后，摘要、问答、卡点和你的笔记会按节收在这里。"
        />
      ) : (
        state.chapters.map((chapter, index) => (
          <ListSection key={`${chapter.title}-${index}`} title={chapter.title}>
            {chapter.sections.map(s => (
              <View key={s.id} style={styles.s1}>
                <Row
                  title={s.label}
                  subtitle={s.summary}
                  onPress={() => intents.openSection(s.id)}
                  chevron
                  right={
                    s.status ? (
                      <Tag
                        label={s.status === 'done' ? '已学' : '在学'}
                        tone={s.status === 'done' ? 'ok' : 'accent'}
                      />
                    ) : undefined
                  }
                />
                <View style={styles.s2}>
                  {s.tags.map(tag => (
                    <Tag
                      key={tag.label}
                      tone={tag.tone === 'default' ? 'neutral' : tag.tone}
                      label={tag.label}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ListSection>
        ))
      )}
      <Sheet
        visible={!!overlay}
        title="导出笔记"
        subtitle={state.title}
        onClose={intents.closeOverlay}
        actions={[
          {
            label: '导出到「下载」',
            kind: 'primary',
            onPress: intents.exportNow,
          },
        ]}
      >
        {overlay ? (
          <View style={styles.s3}>
            <Segmented
              options={[
                { key: 'md', label: 'Markdown' },
                { key: 'anki', label: 'Anki CSV' },
              ]}
              value={overlay.format}
              onChange={intents.setFormat}
              accessibilityLabel="导出格式"
            />
            <Text style={styles.s4}>{overlay.tree}</Text>
            <Text style={styles.s5}>{overlay.desc}</Text>
            <Row
              title="去掉大段原文引用"
              subtitle={overlay.stripHint}
              right={
                <Switch
                  value={overlay.strip}
                  onChange={intents.setStrip}
                  accessibilityLabel="去掉大段原文引用"
                />
              }
            />
            {state.notice ? <Note tone="neutral">{state.notice}</Note> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  s0: { padding: t.space.pageX },
  s1: { paddingBottom: t.space.gap },
  s2: {
    flexDirection: 'row',
    gap: t.space.gap,
    flexWrap: 'wrap',
    paddingHorizontal: t.space.pageX,
  },
  s3: { padding: t.space.pageX, gap: t.space.sectionGap },
  s4: {
    ...t.type.caption,
    color: t.color.ink,
    backgroundColor: t.color.surfaceAlt,
    padding: t.space.pageX,
    borderRadius: t.shape.sm,
  },
  s5: { ...t.type.caption, color: t.color.ink2 },
}));
