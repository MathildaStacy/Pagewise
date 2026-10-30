import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Empty, Icon, makeStyles, useTokens } from '@ui/kit';
import type { ConversationSummary } from '@features/library/types';

function ConversationRow({
  item,
  current,
  onOpen,
  showSection = true,
}: {
  item: ConversationSummary;
  current?: boolean;
  onOpen?(id: number): void;
  showSection?: boolean;
}) {
  const s = useStyles(),
    t = useTokens();
  const date = item.updatedAt?.slice(0, 10).replace(/-/g, '.');
  return (
    <Pressable
      testID={`conversation-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}，${item.subtitle}${
        current ? '，当前对话' : ''
      }`}
      accessibilityState={{ selected: !!current }}
      onPress={() => onOpen?.(item.id)}
      style={({ pressed }) => [
        s.row,
        current && s.current,
        pressed && s.pressed,
      ]}
    >
      <View style={s.rowBody}>
        <View style={s.titleLine}>
          <Text numberOfLines={2} style={s.title}>
            {item.title}
          </Text>
          {current ? <Text style={s.currentLabel}>当前</Text> : null}
        </View>
        {showSection ? (
          <Text numberOfLines={2} style={s.section}>
            {item.sectionTitle ?? item.subtitle}
          </Text>
        ) : null}
        {item.messageCount !== undefined ? (
          <Text style={s.meta}>
            {item.messageCount ? `${item.messageCount} 条消息` : '还没有消息'}
            {date ? ` · ${date}` : ''}
          </Text>
        ) : null}
      </View>
      <Icon
        name={current ? 'check' : 'chev'}
        size={18}
        color={current ? t.color.accentInk : t.color.ink3}
      />
    </Pressable>
  );
}

export function ConversationList({
  items,
  onOpen,
  initialLimit = 3,
}: {
  items?: ConversationSummary[];
  onOpen?(id: number): void;
  initialLimit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = useStyles(),
    t = useTokens();
  if (!items?.length) return null;
  const visible = expanded ? items : items.slice(0, initialLimit);
  const groups = new Map<string, ConversationSummary[]>();
  for (const item of visible)
    groups.set(item.bookId, [...(groups.get(item.bookId) ?? []), item]);
  return (
    <View style={s.root}>
      <View style={s.heading}>
        <Text accessibilityRole="header" style={s.headingTitle}>
          最近对话
        </Text>
        <Text style={s.count}>{items.length} 段</Text>
      </View>
      <View style={s.list}>
        {[...groups].map(([bookId, conversations], index) => (
          <View key={bookId} style={index > 0 && s.bookDivider}>
            <View style={s.bookHeading}>
              <Icon name="bookOpen" size={16} color={t.color.ink2} />
              <Text numberOfLines={2} style={s.bookTitle}>
                {conversations[0].bookTitle ??
                  conversations[0].subtitle.split(' · ')[0]}
              </Text>
            </View>
            {conversations.map(item => (
              <ConversationRow key={item.id} item={item} onOpen={onOpen} />
            ))}
          </View>
        ))}
        {items.length > initialLimit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? '收起对话' : `查看全部 ${items.length} 段对话`
            }
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(value => !value)}
            style={({ pressed }) => [s.more, pressed && s.pressed]}
          >
            <Text style={s.moreLabel}>
              {expanded ? '收起对话' : `查看全部 ${items.length} 段对话`}
            </Text>
            <Icon
              name={expanded ? 'updown' : 'arrowDown'}
              size={16}
              color={t.color.accentInk}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ConversationPicker({
  items,
  currentId,
  onOpen,
  onNew,
}: {
  items: ConversationSummary[];
  currentId?: number;
  onOpen(id: number): void;
  onNew(): void;
}) {
  const s = useStyles();
  return (
    <View>
      <View style={s.pickerHeading}>
        <Text style={s.count}>{items.length} 段对话</Text>
        <Button
          variant="secondary"
          icon="add"
          label="新建对话"
          onPress={onNew}
        />
      </View>
      {items.length ? (
        items.map(item => (
          <ConversationRow
            key={item.id}
            item={item}
            current={item.id === currentId}
            showSection={false}
            onOpen={onOpen}
          />
        ))
      ) : (
        <Empty body="还没有对话，从本节开始聊聊吧。" />
      )}
    </View>
  );
}

const useStyles = makeStyles(t => ({
  root: {
    marginHorizontal: t.space.pageX,
    marginTop: t.space.sectionGap,
    marginBottom: 16,
    gap: 12,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingTitle: { ...t.type.headline, color: t.color.ink },
  count: { ...t.type.caption, color: t.color.ink2 },
  list: {
    borderRadius: t.shape.md,
    backgroundColor: t.color.surface,
    overflow: 'hidden',
  },
  bookHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  bookTitle: { ...t.type.caption, color: t.color.ink2, flex: 1 },
  bookDivider: { borderTopWidth: 1, borderTopColor: t.color.line },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowBody: { flex: 1, gap: 6, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    ...t.type.body,
    fontWeight: t.type.headline.fontWeight,
    color: t.color.ink,
    flex: 1,
  },
  section: { ...t.type.caption, color: t.color.ink2 },
  meta: { ...t.type.micro, color: t.color.ink2 },
  current: { backgroundColor: t.color.accentBg, borderRadius: t.shape.md },
  currentLabel: { ...t.type.micro, color: t.color.accentInk },
  pressed: { backgroundColor: t.color.pressed },
  more: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: t.color.line,
  },
  moreLabel: { ...t.type.caption, color: t.color.accentInk },
  pickerHeading: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: t.color.line,
  },
}));
