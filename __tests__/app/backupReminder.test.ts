import { exportBackup } from '@app/usecases/storage';
import { createTestContainer } from '@app/testing';
import type { Container } from '@app/container';
import { createTestClock } from '@app/clock';
import {
  loadBackupReminder,
  dismissBackupReminder,
} from '@app/usecases/backupReminder';

let c: Container;
const clock = createTestClock('2026-11-01T12:00:00.000Z');
beforeEach(async () => {
  clock.set('2026-11-01T12:00:00.000Z');
  c = await createTestContainer({ clock });
});
afterEach(async () => c.close());
async function activity() {
  await c.repos.books.insert({
    id: 'book',
    sha256: 'backup-test',
    title: 'Book',
    format: 'epub',
    size_bytes: 10,
    cover_color: '#123456',
    status: 'ready',
    created_at: '2026-10-20T12:00:00.000Z',
  });
  await c.repos.study.put({
    book_id: 'book',
    last_active_at: '2026-10-31T12:00:00.000Z',
  });
}
it('does not interrupt an empty library', async () => {
  expect(await loadBackupReminder(c)).toBeNull();
});
it('reminds for never-backed-up learning after the first week', async () => {
  await activity();
  expect((await loadBackupReminder(c))?.message).toContain('还没有备份');
  await c.repos.books.update('book', {
    created_at: '2026-10-30T12:00:00.000Z',
  });
  expect(await loadBackupReminder(c)).toBeNull();
});
it('requires both an old backup and new activity; successful backup removes the reminder', async () => {
  await activity();
  await c.repos.settings.set('backup.lastExport', {
    createdAt: '2026-10-24T12:00:00.000Z',
  });
  expect((await loadBackupReminder(c))?.message).toContain('8 天前');
  await c.repos.settings.set('backup.lastExport', {
    createdAt: clock.now().toISOString(),
  });
  expect(await loadBackupReminder(c)).toBeNull();
  clock.advance(9 * 86400000);
  expect(await loadBackupReminder(c)).toBeNull();
});
it('snoozes until the next local day and survives reload', async () => {
  await activity();
  await dismissBackupReminder(c);
  expect(await loadBackupReminder(c)).toBeNull();
  clock.advance(86400000);
  expect(await loadBackupReminder(c)).not.toBeNull();
});
it('keeps the prompt when the backup destination fails', async () => {
  await activity();
  await expect(exportBackup(c)).rejects.toThrow();
  expect(await loadBackupReminder(c)).not.toBeNull();
  expect(await c.repos.settings.get('backup.lastExport', null)).toBeNull();
});
