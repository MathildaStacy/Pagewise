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
  'suspended',
  'created_at',
] as const;
type CardRow = Omit<Card, 'suspended'> & { suspended: number };
const fromRow = ({ suspended, ...card }: CardRow): Card => ({
  ...card,
  suspended: Boolean(suspended),
});
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
  const get = async (id: number): Promise<Card | undefined> => {
    const row = await db.get<CardRow>('SELECT * FROM card WHERE id = ?', [id]);
    return row && fromRow(row);
  };
  return {
    get,
    async list(): Promise<Card[]> {
      return (
        await db.all<CardRow>(
          'SELECT * FROM card ORDER BY created_at DESC, id DESC',
        )
      ).map(fromRow);
    },
    async addMany(cards: readonly CardInsert[]): Promise<Card[]> {
      return db.transaction(async tx => {
        const saved: Card[] = [];
        for (const card of cards) {
          const id = await insertRow(tx, 'card', columns, {
            ...card,
            suspended: Number(card.suspended ?? false),
          });
          saved.push(
            fromRow(
              (await tx.get<CardRow>('SELECT * FROM card WHERE id = ?', [id]))!,
            ),
          );
        }
        return saved;
      });
    },
    async due(today: string, limit = 30): Promise<Card[]> {
      return (
        await db.all<CardRow>(
          'SELECT * FROM card WHERE suspended = 0 AND due_on <= ? ORDER BY due_on ASC, id ASC LIMIT ?',
          [today, Math.max(0, Math.trunc(limit))],
        )
      ).map(fromRow);
    },
    async edit(
      id: number,
      content: Pick<Card, 'front' | 'back'>,
    ): Promise<Card> {
      return db.transaction(async tx => {
        await tx.run('UPDATE card SET front = ?, back = ? WHERE id = ?', [
          content.front,
          content.back,
          id,
        ]);
        const row = await tx.get<CardRow>('SELECT * FROM card WHERE id = ?', [
          id,
        ]);
        if (!row) throw new Error('闪卡不存在');
        return fromRow(row);
      });
    },
    async setSuspended(id: number, suspended: boolean): Promise<Card> {
      return db.transaction(async tx => {
        await tx.run('UPDATE card SET suspended = ? WHERE id = ?', [
          Number(suspended),
          id,
        ]);
        const row = await tx.get<CardRow>('SELECT * FROM card WHERE id = ?', [
          id,
        ]);
        if (!row) throw new Error('闪卡不存在');
        return fromRow(row);
      });
    },
    async rate(
      id: number,
      rated: CardRating,
      boxTo: CardBox,
      dueOn: string,
      at = now(),
    ): Promise<Card> {
      return db.transaction(async tx => {
        const card = await tx.get<CardRow>('SELECT * FROM card WHERE id = ?', [
          id,
        ]);
        if (!card) throw new Error('闪卡不存在');
        if (card.suspended) throw new Error('这张闪卡已暂停，请先恢复后再复习');
        await tx.run('UPDATE card SET box = ?, due_on = ? WHERE id = ?', [
          boxTo,
          dueOn,
          id,
        ]);
        await tx.run(
          'INSERT INTO review_log (card_id,rated,box_from,box_to,at) VALUES (?,?,?,?,?)',
          [id, rated, card.box, boxTo, at],
        );
        return fromRow(
          (await tx.get<CardRow>('SELECT * FROM card WHERE id = ?', [id]))!,
        );
      });
    },
    async stats(today = localDate(now())): Promise<CardStats> {
      const rows = await db.all<{ box: CardBox; count: number; due: number }>(
        'SELECT box, COUNT(*) AS count, SUM(CASE WHEN due_on <= ? THEN 1 ELSE 0 END) AS due FROM card WHERE suspended = 0 GROUP BY box',
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
