import { Text, View } from 'react-native';
import { Button, Empty, Note, Segmented, Sheet, makeStyles } from '@ui/kit';
import type {
  CardManagementIntents,
  CardManagementState,
} from '@features/review/types';
import { CardEditorSheet } from './CardEditorSheet';

export function CardManagementSheet({
  state,
  intents,
}: {
  state: CardManagementState;
  intents: CardManagementIntents;
}) {
  const s = useStyles();
  return (
    <>
      <Sheet
        visible={state.open && !state.editor}
        title="管理闪卡"
        subtitle="暂停后不再安排复习，随时可以恢复。"
        detent="full"
        onClose={intents.close}
      >
        <View style={s.content}>
          <Segmented
            accessibilityLabel="闪卡范围"
            options={[
              { key: 'all', label: `全部 ${state.total}` },
              { key: 'suspended', label: `已暂停 ${state.suspended}` },
            ]}
            value={state.filter}
            onChange={value => {
              if (value === 'all' || value === 'suspended')
                intents.setFilter(value);
            }}
          />
          {state.error ? (
            <View>
              <Note tone="bad">{state.error}</Note>
              <Button variant="text" onPress={intents.retry}>
                重试
              </Button>
            </View>
          ) : null}
          {state.loading ? (
            <Empty body="正在读取闪卡…" />
          ) : !state.cards.length ? (
            <Empty
              body={
                state.filter === 'suspended'
                  ? '没有已暂停的闪卡。'
                  : '还没有闪卡。学完一节后可以把要点留下来复习。'
              }
            />
          ) : (
            state.cards.map(card => (
              <View key={card.id} style={s.card}>
                <Text style={s.source}>
                  {card.source} · {card.suspended ? '已暂停' : '参与复习'}
                </Text>
                <Text style={s.front} numberOfLines={3}>
                  {card.front}
                </Text>
                <Text style={s.back} numberOfLines={3}>
                  {card.back}
                </Text>
                <View style={s.actions}>
                  <Button
                    variant="secondary"
                    disabled={state.busy}
                    accessibilityLabel={`编辑闪卡：${card.front}`}
                    onPress={() => intents.edit(card.id)}
                  >
                    编辑
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={state.busy}
                    accessibilityLabel={`${
                      card.suspended ? '恢复' : '暂停'
                    }闪卡：${card.front}`}
                    onPress={() => intents.toggleSuspended(card.id)}
                  >
                    {card.suspended ? '恢复复习' : '暂停复习'}
                  </Button>
                </View>
              </View>
            ))
          )}
        </View>
      </Sheet>
      <CardEditorSheet state={state.editor} intents={intents.editor} />
    </>
  );
}
const useStyles = makeStyles(t => ({
  content: { gap: t.space.gap },
  card: {
    paddingVertical: t.space.gap,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
  source: {
    ...t.type.caption,
    color: t.color.ink2,
    marginBottom: t.space.gap / 2,
  },
  front: { ...t.type.body, color: t.color.ink, fontWeight: '600' },
  back: { ...t.type.body, color: t.color.ink2, marginTop: t.space.gap / 2 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.gap,
    marginTop: t.space.gap,
  },
}));
