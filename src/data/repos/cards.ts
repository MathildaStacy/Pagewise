import type { Card, CardBox, CardInsert, CardRating } from '@core/types';
import type { Db } from '../db';
import { insertRow } from './shared';
const columns = [
  'id',
  'book_id',
  'section_id',
  'front',
  'back',
  'box',
  'due_on',
  'origin',
  'created_at',
] as const;
export interface CardStats {
  total: number;
  due: number;
  boxes: number[];
}
function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}
export function createCardsRepo(db: Db, now = () => new Date().toISOString()) {
  const get = (id: number) =>
    db.get<Card>('SELECT * FROM card WHERE id = ?', [id]);
  return {
    get,
    async addMany(cards: readonly CardInsert[]): Promise<Card[]> {
      return db.transaction(async tx => {
        const saved: Card[] = [];
        for (const card of cards) {
          const id = await insertRow(tx, 'card', columns, card);
          saved.push(
            (await tx.get<Card>('SELECT * FROM card WHERE id = ?', [id]))!,
          );
        }
        return saved;
      });
    },
    due: (today: string, limit = 30) =>
      db.all<Card>(
        'SELECT * FROM card WHERE due_on <= ? ORDER BY due_on ASC, id ASC LIMIT ?',
        [today, Math.max(0, Math.trunc(limit))],
      ),
    async rate(
      id: number,
      rated: CardRating,
      boxTo: CardBox,
      dueOn: string,
      at = now(),
    ): Promise<Card> {
      return db.transaction(async tx => {
        const card = await tx.get<Card>('SELECT * FROM card WHERE id = ?', [
          id,
        ]);
        if (!card) throw new Error('闪卡不存在');
        await tx.run('UPDATE card SET box = ?, due_on = ? WHERE id = ?', [
          boxTo,
          dueOn,
          id,
        ]);
        await tx.run(
          'INSERT INTO review_log (card_id,rated,box_from,box_to,at) VALUES (?,?,?,?,?)',
          [id, rated, card.box, boxTo, at],
        );
        return (await tx.get<Card>('SELECT * FROM card WHERE id = ?', [id]))!;
      });
    },
    async stats(today = localDate(now())): Promise<CardStats> {
      const rows = await db.all<{ box: CardBox; count: number; due: number }>(
        'SELECT box, COUNT(*) AS count, SUM(CASE WHEN due_on <= ? THEN 1 ELSE 0 END) AS due FROM card GROUP BY box',
        [today],
      );
      return rows.reduce<CardStats>(
        (stats, row) => {
          stats.total += row.count;
          stats.due += row.due;
          stats.boxes[row.box - 1] = row.count;
          return stats;
        },
        { total: 0, due: 0, boxes: [0, 0, 0, 0, 0] },
      );
    },
  };
}
