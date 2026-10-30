import type { Block } from '@core/types';
import { parseJson } from '@data/repos/shared';
import { resolveStudyBlockImage } from '../bookImages';
import type { Container } from '../container';

interface ConversationRow {
  id: number;
  kind: 'user' | 'assistant';
  content: string;
  section_id: string;
  allowed_refs_json: string | null;
  quote_seq: number | null;
  detour_id: number | null;
}
function numberIds(value: unknown): number[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is number => Number.isSafeInteger(id) && id >= 0,
          ),
        ),
      ]
    : [];
}

/** Exact stored QA links also find conversations older than the latest 200 messages. */
export async function loadNoteConversation(
  c: Container,
  bookId: string,
  sectionId: string,
  qaId: number,
) {
  const qa = await c.db.get<{ q: string; message_ids_json: string }>(
    'SELECT q,message_ids_json FROM qa WHERE id=? AND book_id=? AND section_id=?',
    [qaId, bookId, sectionId],
  );
  if (!qa) throw new Error('找不到这条问答，请返回笔记重试');
  const ids = numberIds(parseJson<unknown>(qa.message_ids_json, []));
  const messages: ConversationRow[] = [];
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = ids.slice(offset, offset + 400);
    messages.push(
      ...(await c.db.all<ConversationRow>(
        `SELECT id,kind,content,section_id,allowed_refs_json,quote_seq,detour_id
         FROM message WHERE book_id=? AND id IN (${batch
           .map(() => '?')
           .join(',')})
         AND kind IN ('user','assistant') ORDER BY id`,
        [bookId, ...batch],
      )),
    );
  }
  messages.sort((a, b) => a.id - b.id);
  const refs = new Set<number>();
  for (const message of messages) {
    for (const match of message.content.matchAll(/\[\[(?:b|q|fig):(\d+)\]\]/g))
      refs.add(Number(match[1]));
    if (message.quote_seq !== null) refs.add(message.quote_seq);
  }
  const blocks: Block[] = [],
    seqs = [...refs];
  for (let offset = 0; offset < seqs.length; offset += 400) {
    const batch = seqs.slice(offset, offset + 400);
    blocks.push(
      ...(await c.db.all<Block>(
        `SELECT * FROM block WHERE book_id=? AND seq IN (${batch
          .map(() => '?')
          .join(',')})`,
        [bookId, ...batch],
      )),
    );
  }
  return {
    question: qa.q,
    book: (await c.repos.books.get(bookId)) ?? null,
    missing: messages.length < ids.length,
    messages: messages.map(({ allowed_refs_json, ...message }) => ({
      ...message,
      allowedRefs: numberIds(parseJson<unknown>(allowed_refs_json, [])),
    })),
    blocks: blocks.map(block => resolveStudyBlockImage(c, bookId, block)),
  };
}
export type NoteConversationData = Awaited<
  ReturnType<typeof loadNoteConversation>
>;
