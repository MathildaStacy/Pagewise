import { Pressable, Text, View } from 'react-native';
import {
  AppBar,
  Button,
  Cover,
  Empty,
  Note,
  Screen,
  makeStyles,
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
        state.books.map(book => (
          <Pressable
            key={book.id}
            accessibilityRole="button"
            accessibilityLabel={`${book.title}，${book.meta}`}
            onPress={() => intents.openBook(book.id)}
            style={styles.s1}
          >
            <Cover {...book.cover} />
            <View style={styles.s2}>
              <Text style={styles.s3}>{book.title}</Text>
              <Text style={styles.s4}>{book.meta}</Text>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const useStyles = makeStyles(t => ({
  s0: { padding: t.space.pageX },
  s1: {
    flexDirection: 'row',
    padding: t.space.pageX,
    gap: t.space.pageX,
    backgroundColor: t.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
    alignItems: 'center',
  },
  s2: { flex: 1, gap: t.space.gap },
  s3: { ...t.type.headline, color: t.color.ink },
  s4: { ...t.type.caption, color: t.color.ink2 },
}));
