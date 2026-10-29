import type { Section } from '@core/types';
import { newCardSchedule } from '@core/review';
import { createRepos } from '@data/repos';
import type { Container } from '../container';
import type { FinishSectionInput } from './types';

/** One commit owns the notes, review material, completed section and next main pointer. */
export async function finishSection(
  c: Container,
  input: FinishSectionInput & { draftId?: string },
): Promise<Section | null> {
  const now = c.clock.now().toISOString();
  const result = await c.db.transaction(async tx => {
    const repos = createRepos(tx, () => now);
    const completedKey = input.draftId
      ? `study.finished.${input.draftId}`
      : null;
    if (completedKey) {
      const saved = await repos.settings.get<{ nextId: string | null } | null>(
        completedKey,
        null,
      );
      if (saved)
        return {
          next: saved.nextId
            ? (await repos.sections.get(input.bookId, saved.nextId)) ?? null
            : null,
          alreadySaved: true,
        };
    }
    const section = await repos.sections.get(input.bookId, input.sectionId);
    if (!section) throw new Error('小节不存在');
    await repos.sections.update(input.bookId, input.sectionId, {
      summary: input.summary,
      status: 'done',
    });
    const existing = await repos.notes.stuck.list(
      input.bookId,
      input.sectionId,
      { resolved: false },
    );
    for (const stuck of input.stuck.filter(
      item => item.checked && item.text.trim(),
    )) {
      if (!existing.some(item => item.text === stuck.text)) {
        const saved = await repos.notes.stuck.add({
          book_id: input.bookId,
          section_id: input.sectionId,
          text: stuck.text,
          source: 'section_end',
          created_at: now,
        });
        existing.push(saved);
      }
    }
    const schedule = newCardSchedule(c.clock.today());
    await repos.cards.addMany(
      input.cards
        .filter(card => card.checked && card.front.trim() && card.back.trim())
        .map(card => ({
          book_id: input.bookId,
          section_id: input.sectionId,
          front: card.front,
          back: card.back,
          box: schedule.box,
          due_on: schedule.dueOn,
          origin: card.fromDetour
            ? ('detour' as const)
            : ('section_end' as const),
          created_at: now,
        })),
    );
    const next =
      (await repos.sections.nextLeaf(input.bookId, input.sectionId)) ?? null;
    if (next)
      await repos.sections.update(input.bookId, next.id, {
        status: 'learning',
      });
    const previous = await repos.study.get(input.bookId);
    await repos.study.put({
      ...previous,
      book_id: input.bookId,
      main_section: next?.id ?? null,
      main_part: 0,
      main_step: 0,
      phase: 'idle',
      detours: [],
      last_active_at: now,
      read_anchor: next?.block_from ?? null,
    });
    if (completedKey)
      await repos.settings.set(completedKey, { nextId: next?.id ?? null });
    return { next, alreadySaved: false };
  });
  if (!result.alreadySaved) {
    c.events.emit('section.status', {
      bookId: input.bookId,
      sectionId: input.sectionId,
      status: 'done',
    });
    if (result.next)
      c.events.emit('section.status', {
        bookId: input.bookId,
        sectionId: result.next.id,
        status: 'learning',
      });
    c.events.emit('cards.changed', { bookId: input.bookId });
    c.events.emit('stuck.changed', {
      bookId: input.bookId,
      sectionId: input.sectionId,
    });
  }
  return result.next;
}
