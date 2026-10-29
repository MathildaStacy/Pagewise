import { Pressable, ScrollView, Text, View } from 'react-native';
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
  usePresentation,
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
  const { groupedLists } = usePresentation();
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
            {chapter.sections.map((s, sectionIndex) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.sectionRow,
                  pressed ? styles.pressed : undefined,
                ]}
                onPress={() => intents.openSection(s.id)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
              >
                {groupedLists && sectionIndex > 0 ? (
                  <View style={styles.separator} />
                ) : null}
                <View style={styles.sectionTop}>
                  <Text style={styles.sectionLabel}>{s.label}</Text>
                  {s.status ? (
                    <Tag
                      label={s.status === 'done' ? '已学' : '在学'}
                      tone={s.status === 'done' ? 'ok' : 'accent'}
                    />
                  ) : null}
                </View>
                {s.summary ? (
                  <Text style={styles.sectionSummary} numberOfLines={2}>
                    {s.summary}
                  </Text>
                ) : null}
                {s.tags.length ? (
                  <View style={styles.tags}>
                    {s.tags.map(tag => (
                      <Tag
                        key={tag.label}
                        tone={tag.tone === 'default' ? 'neutral' : tag.tone}
                        label={tag.label}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ListSection>
        ))
      )}
      <Sheet
        visible={!!overlay}
        title="导出笔记"
        subtitle={`${state.title} · ${state.chapters.reduce(
          (count, chapter) => count + chapter.sections.length,
          0,
        )} 节`}
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
          <View style={styles.exportBody}>
            <View style={styles.format}>
              <Segmented
                options={[
                  { key: 'md', label: 'Markdown' },
                  { key: 'anki', label: 'Anki CSV' },
                ]}
                value={overlay.format}
                onChange={intents.setFormat}
                accessibilityLabel="导出格式"
              />
            </View>
            <ScrollView horizontal style={styles.tree}>
              <Text style={styles.treeText}>{overlay.tree}</Text>
            </ScrollView>
            <Text style={styles.exportDescription}>{overlay.desc}</Text>
            <View style={styles.exportOptions}>
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
            </View>
            {state.notice ? <Note tone="neutral">{state.notice}</Note> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const useStyles = makeStyles(t => {
  const grouped = t.layout.groupedLists,
    scale = t.type.body.fontSize / (grouped ? 17 : 14);
  return {
    s0: { padding: t.space.pageX },
    sectionRow: {
      paddingHorizontal: t.space.pageX,
      paddingVertical: 12,
      borderBottomWidth: grouped ? 0 : 1,
      borderBottomColor: t.color.line,
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
    pressed: { backgroundColor: t.color.pressed },
    sectionTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      alignItems: grouped ? 'center' : 'flex-start',
    },
    sectionLabel: {
      ...t.type.body,
      fontSize: (grouped ? 16 : 14) * scale,
      lineHeight: (grouped ? 23.2 : 21) * scale,
      fontWeight: grouped ? '400' : '500',
      color: t.color.ink,
      flex: 1,
    },
    sectionSummary: {
      ...t.type.label,
      fontSize: 13 * scale,
      fontWeight: t.type.body.fontWeight,
      color: t.color.ink2,
      lineHeight: (grouped ? 19.5 : 20.15) * scale,
      marginTop: 3,
    },
    tags: {
      flexDirection: 'row',
      gap: grouped ? 5 : 4,
      marginTop: grouped ? 7 : 6,
      flexWrap: 'wrap',
    },
    exportBody: {
      paddingHorizontal: grouped ? 18 : 0,
      paddingTop: grouped ? 4 : 0,
      paddingBottom: grouped ? 6 : 0,
    },
    format: {
      paddingHorizontal: grouped ? 0 : 16,
      paddingTop: grouped ? 2 : 4,
      paddingBottom: grouped ? 12 : 10,
    },
    tree: {
      marginHorizontal: grouped ? 0 : 16,
      marginBottom: 10,
      backgroundColor: grouped ? t.color.surface : t.color.bg,
      borderRadius: grouped ? t.shape.md - 4 : t.shape.sm,
    },
    treeText: {
      ...t.type.caption,
      fontFamily: 'monospace',
      fontSize: 11.5 * scale,
      lineHeight: 19.55 * scale,
      color: t.color.ink2,
      paddingVertical: grouped ? 12 : 8,
      paddingHorizontal: grouped ? 14 : 10,
    },
    exportDescription: {
      ...t.type.caption,
      fontSize: 13 * scale,
      lineHeight: (grouped ? 18.85 : 22.75) * scale,
      color: t.color.ink2,
      paddingHorizontal: grouped ? 4 : 16,
      paddingTop: grouped ? 0 : 4,
      paddingBottom: grouped ? 12 : 0,
    },
    exportOptions: {
      borderRadius: grouped ? t.shape.md : 0 * t.shape.md,
      overflow: 'hidden',
    },
  };
});
