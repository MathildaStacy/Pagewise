import type { Detour, DetourInsert } from '@core/types';
import type { Db } from '../db';
import { insertRow } from './shared';
const columns = [
  'id',
  'book_id',
  'from_section',
  'to_section',
  'depth',
  'title',
  'stuck_id',
  'started_at',
  'ended_at',
] as const;
export function createDetoursRepo(
  db: Db,
  now = () => new Date().toISOString(),
) {
  return {
    get: (id: number) =>
      db.get<Detour>('SELECT * FROM detour WHERE id = ?', [id]),
    async start(input: DetourInsert): Promise<Detour> {
      return db.transaction(async tx => {
        const id = await insertRow(tx, 'detour', columns, input);
        return (await tx.get<Detour>('SELECT * FROM detour WHERE id = ?', [
          id,
        ]))!;
      });
    },
    async end(
      id: number,
      title: string,
      at = now(),
    ): Promise<Detour | undefined> {
      return db.transaction(async tx => {
        await tx.run('UPDATE detour SET title = ?, ended_at = ? WHERE id = ?', [
          title,
          at,
          id,
        ]);
        return tx.get<Detour>('SELECT * FROM detour WHERE id = ?', [id]);
      });
    },
  };
}
