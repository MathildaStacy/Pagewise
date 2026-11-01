import type { Container } from '../container';

const week = 7 * 24 * 60 * 60 * 1000;

/** Only local learning activity is inspected; no document text or keys are read. */
export async function loadBackupReminder(
  c: Container,
): Promise<{ message: string } | null> {
  if (c.mode === 'demo') return null;
  const [backup, dismissedUntil, activity, firstBook] = await Promise.all([
    c.repos.settings.get<{ createdAt: string } | null>(
      'backup.lastExport',
      null,
    ),
    c.repos.settings.get<string | null>('backup.remindAfter', null),
    c.db.get<{ latest: string | null }>(`SELECT MAX(at) AS latest FROM (
      SELECT last_active_at AS at FROM study_state
      UNION ALL SELECT updated_at FROM section_note WHERE user_text != ''
      UNION ALL SELECT created_at FROM highlight
      UNION ALL SELECT created_at FROM qa
      UNION ALL SELECT created_at FROM pin
      UNION ALL SELECT created_at FROM card
      UNION ALL SELECT created_at FROM stuck
      UNION ALL SELECT created_at FROM message
      UNION ALL SELECT at FROM review_log
      UNION ALL SELECT resolved_at FROM stuck
    )`),
    c.db.get<{ first: string | null }>(
      'SELECT MIN(created_at) AS first FROM book',
    ),
  ]);
  const now = c.clock.now().getTime();
  if (dismissedUntil && Date.parse(dismissedUntil) > now) return null;
  const latest = Date.parse(activity?.latest ?? '');
  const last = Date.parse(backup?.createdAt ?? '');
  const since = Number.isFinite(last)
    ? last
    : Date.parse(firstBook?.first ?? '');
  if (!Number.isFinite(latest) || !Number.isFinite(since) || now - since < week)
    return null;
  if (Number.isFinite(last) && latest <= last) return null;
  return {
    message: Number.isFinite(last)
      ? `上次备份是 ${Math.floor(
          (now - last) / 86400000,
        )} 天前，之后有新的学习记录。`
      : '学习记录还没有备份，目前只存在这台手机上。',
  };
}

export async function dismissBackupReminder(c: Container): Promise<void> {
  const tomorrow = new Date(c.clock.now());
  tomorrow.setHours(24, 0, 0, 0);
  await c.repos.settings.set('backup.remindAfter', tomorrow.toISOString());
  c.events.emit('backup.changed', undefined);
}
