import type { Card, CardRating } from '@core/types';
import { nextReview } from '@core/review';
import { createRepos } from '@data/repos';
import type { Container } from '../container';

export class ReviewCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewCardError';
  }
}

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
export async function loadReviewCards(c: Container, sessionLimit?: number) {
  const data = await loadReview(c);
  const limit =
    sessionLimit == null || !Number.isFinite(sessionLimit)
      ? data.limit
      : Math.min(data.limit, Math.max(0, Math.trunc(sessionLimit)));
  const cards = await c.repos.cards.due(c.clock.today(), limit);
  return { ...data, cards };
}
export async function editReviewCard(
  c: Container,
  id: number,
  content: Pick<Card, 'front' | 'back'>,
) {
  const front = content.front.trim(),
    back = content.back.trim();
  if (!front || !back) throw new ReviewCardError('问题和答案都需要填写');
  const card = await c.repos.cards.edit(id, { front, back });
  c.events.emit('cards.changed', { bookId: card.book_id });
  return card;
}
export async function setReviewCardSuspended(
  c: Container,
  id: number,
  suspended: boolean,
) {
  const card = await c.repos.cards.setSuspended(id, suspended);
  c.events.emit('cards.changed', { bookId: card.book_id });
  return card;
}
export async function rateReviewCard(
  c: Container,
  card: Card,
  rating: CardRating,
) {
  const at = c.clock.now().toISOString();
  await c.db.transaction(async tx => {
    const repos = createRepos(tx, () => at);
    const current = await repos.cards.get(card.id);
    if (!current) throw new ReviewCardError('闪卡不存在，请重新读取卡片');
    if (current.suspended)
      throw new ReviewCardError('这张闪卡已暂停，请重新读取卡片');
    if (current.front !== card.front || current.back !== card.back)
      throw new ReviewCardError('闪卡已更新，请重新读取并确认答案后再评分');
    const next = nextReview(current.box, rating, c.clock.today());
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
