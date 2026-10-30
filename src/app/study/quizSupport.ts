import type { Message } from '@core/types';
import { createMessagesRepo } from '@data/repos/messages';
import type { Container } from '../container';
import { asJson, parseStudyCard } from './types';

/** Close the model's pending tool call while keeping the question available to revisit. */
export async function deferQuizzes(
  c: Container,
  messages: readonly Message[],
  messageId?: number,
): Promise<{ updated: Message[]; results: Message[] }> {
  return c.db.transaction(async tx => {
    const repo = createMessagesRepo(tx);
    const updated: Message[] = [];
    const results: Message[] = [];
    for (const message of messages) {
      if (messageId !== undefined && message.id !== messageId) continue;
      const card =
        message.kind === 'card' ? parseStudyCard(message.content) : null;
      if (card?.kind !== 'quiz' || card.picked !== null || card.deferred)
        continue;
      const saved = await repo.update(message.id, {
        content: JSON.stringify({
          ...card,
          deferred: true,
          toolCall: undefined,
        }),
      });
      if (!saved) continue;
      updated.push(saved);
      if (card.toolCall) {
        const output = JSON.stringify({
          deferred: true,
          reason: '用户暂时跳过测验，可以继续提问；这不表示已掌握。',
        });
        results.push(
          await repo.append({
            book_id: message.book_id,
            section_id: message.section_id,
            conversation_id: message.conversation_id,
            part_no: message.part_no,
            step_no: message.step_no,
            detour_id: message.detour_id,
            kind: 'tool',
            content: output,
            parts: asJson([
              {
                t: 'result',
                id: card.toolCall.id,
                name: card.toolCall.name,
                output,
              },
            ]) as Message['parts'],
            created_at: c.clock.now().toISOString(),
          }),
        );
      }
    }
    return { updated, results };
  });
}
