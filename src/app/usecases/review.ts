import type { Card, CardRating } from '@core/types';
import { nextReview } from '@core/review';
import { createRepos } from '@data/repos';
import type { Container } from '../container';

export async function loadReview(c: Container) {
  const [stats, stuck, books] = await Promise.all([
    c.repos.cards.stats(c.clock.today()),
    c.repos.notes.stuck.list(),
    c.repos.books.list(),
  ]);
  const sections = (
    await Promise.all(books.map(book => c.repos.sections.tree(book.id)))
  ).flat();
  const limit = await c.repos.settings.get<number>('review.dailyLimit', 30);
  return {
    stats,
    stuck,
    books,
    sections,
    limit: Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : 30,
  };
}
export type ReviewData = Awaited<ReturnType<typeof loadReview>>;
export async function loadReviewCards(c: Container) {
  const data = await loadReview(c);
  const cards = await c.repos.cards.due(c.clock.today(), data.limit);
  return { ...data, cards };
}
export async function rateReviewCard(
  c: Container,
  card: Card,
  rating: CardRating,
) {
  const at = c.clock.now().toISOString();
  const next = nextReview(card.box, rating, c.clock.today());
  await c.db.transaction(async tx => {
    const repos = createRepos(tx, () => at);
    await repos.cards.rate(card.id, rating, next.box, next.dueOn, at);
    if (rating === 'again') {
      const existing = await repos.notes.stuck.list(
        card.book_id,
        card.section_id,
        { resolved: false },
      );
      if (!existing.some(item => item.text === card.front)) {
        await repos.notes.stuck.add({
          book_id: card.book_id,
          section_id: card.section_id,
          text: card.front,
          source: 'card',
          card_id: card.id,
          created_at: at,
        });
      }
    }
  });
  c.events.emit('cards.changed', { bookId: card.book_id });
  if (rating === 'again')
    c.events.emit('stuck.changed', {
      bookId: card.book_id,
      sectionId: card.section_id,
    });
}
export async function resolveStuck(c: Container, id: number) {
  const stuck = await c.repos.notes.stuck.resolve(
    id,
    c.clock.now().toISOString(),
  );
  if (stuck)
    c.events.emit('stuck.changed', {
      bookId: stuck.book_id,
      sectionId: stuck.section_id,
    });
}
