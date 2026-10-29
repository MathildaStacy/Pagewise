import { Pressable, Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Cover,
  Empty,
  Icon,
  ListSection,
  Note,
  Screen,
  makeStyles,
  usePresentation,
  useTokens,
} from '@ui/kit';
import type { NotesIntents, NotesState } from '@features/notes/types';

export function NotesView({
  state,
  intents,
}: {
  state: NotesState;
  intents: NotesIntents;
}) {
  const styles = useStyles();
  const { groupedLists } = usePresentation(),
    t = useTokens();
  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <AppBar title="笔记" variant="root" />
      {state.error ? (
        <View style={styles.s0}>
          <Note tone="bad">{state.error}</Note>
          <Button variant="text" onPress={intents.retry}>
            重试
          </Button>
        </View>
      ) : null}
      {state.loading ? (
        <Empty body="正在整理笔记…" />
      ) : !state.books.length ? (
        <Empty
          title="还没有笔记"
          body="导入一本书，学习后会留下摘要、问答和自己的理解。"
        />
      ) : (
        <ListSection>
          {state.books.map((book, index) => (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityLabel={`${book.title}，${book.meta}`}
              onPress={() => intents.openBook(book.id)}
              style={({ pressed }) => [
                styles.s1,
                pressed ? styles.pressed : undefined,
              ]}
            >
              {groupedLists && index > 0 ? (
                <View style={styles.separator} />
              ) : null}
              <Cover {...book.cover} />
              <View style={styles.s2}>
                <Text style={styles.s3}>{book.title}</Text>
                <Text style={styles.s4}>{book.meta}</Text>
              </View>
              {groupedLists && book.hasNotes ? (
                <View style={styles.chevron}>
                  <Icon name="chev" size={15} color={t.color.ink3} />
                </View>
              ) : null}
            </Pressable>
          ))}
        </ListSection>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(t => {
  const grouped = t.layout.groupedLists,
    scale = t.type.body.fontSize / (grouped ? 17 : 14);
  return {
    s0: { padding: t.space.pageX },
    s1: {
      flexDirection: 'row',
      paddingHorizontal: t.space.pageX,
      paddingVertical: 12,
      gap: grouped ? 14 : 12,
      backgroundColor: t.color.surface,
      borderBottomWidth: grouped ? 0 : 1,
      borderBottomColor: t.color.line,
      alignItems: grouped ? 'center' : 'flex-start',
    },
    pressed: { backgroundColor: t.color.pressed },
    separator: {
      position: 'absolute',
      top: 0,
      right: 0,
      left: 84,
      height: 0.5,
      backgroundColor: t.color.line,
    },
    chevron: { marginRight: -4 },
    s2: { flex: 1 },
    s3: {
      ...t.type.body,
      fontSize: (grouped ? 16 : 15) * scale,
      lineHeight: (grouped ? 21.6 : 20.25) * scale,
      fontWeight: '600',
      color: t.color.ink,
    },
    s4: {
      ...t.type.caption,
      lineHeight: (grouped ? 18.85 : 18) * scale,
      color: grouped ? t.color.ink2 : t.color.ink3,
      marginTop: grouped ? 1 : 2,
    },
  };
});
