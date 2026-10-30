import { ListSection, Row } from '@ui/kit';
import type { ConversationSummary } from '@features/library/types';

export function ConversationList({
  items,
  onOpen,
}: {
  items?: ConversationSummary[];
  onOpen?(id: number): void;
}) {
  if (!items?.length) return null;
  return (
    <ListSection title="所有对话" note="书籍 · 章节 · 消息数">
      {items.map(item => (
        <Row
          key={item.id}
          title={item.title}
          subtitle={item.subtitle}
          chevron
          onPress={() => onOpen?.(item.id)}
        />
      ))}
    </ListSection>
  );
}
