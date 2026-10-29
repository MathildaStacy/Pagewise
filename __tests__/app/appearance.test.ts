import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createAppearanceSettings } from '@app/appearance';
import { createDb, type Db, type Row } from '@data/db';
import { openMemoryDb } from '@data/drivers/nodeSqlite';
import { migrate } from '@data/migrations';
import { createSettingsRepo } from '@data/repos/settings';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});
afterEach(async () => db.close());
function openFileDb(path: string): Db {
  const connection = new DatabaseSync(path);
  return createDb({
    async query(sql, params) {
      const statement = connection.prepare(sql);
      if (statement.columns().length)
        return { rows: statement.all(...params) as Row[], changes: 0 };
      const result = statement.run(...params);
      return { rows: [], changes: Number(result.changes) };
    },
    async close() {
      connection.close();
    },
  });
}

it('缺省外观与未知枚举采用默认值，不建立全局单例', async () => {
  const settings = createSettingsRepo(db);
  let controller = await createAppearanceSettings(settings, db);
  expect(controller.store.getState()).toEqual({
    skin: 'paper',
    scheme: 'system',
    readingSize: 'm',
    error: null,
  });
  await settings.set('ui.skin', { invalid: true });
  await settings.set('ui.scheme', 'unknown');
  await settings.set('ui.readingSize', 12);
  controller = await createAppearanceSettings(settings, db);
  expect(controller.store.getState()).toEqual({
    skin: 'paper',
    scheme: 'system',
    readingSize: 'm',
    error: null,
  });
  await settings.set('ui.skin', 'glass');
  await settings.set('ui.scheme', 'dark');
  await settings.set('ui.readingSize', 'l');
  const loaded = await createAppearanceSettings(settings, db);
  expect(loaded.store.getState()).toEqual({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
    error: null,
  });
  expect(controller.store.getState().skin).toBe('paper');
});

it('连续局部更新按提交顺序合并，flush等待全部写入', async () => {
  const settings = createSettingsRepo(db);
  const controller = await createAppearanceSettings(settings, db);
  const updates = [
    controller.update({ skin: 'glass' }),
    controller.update({ scheme: 'dark' }),
    controller.update({ readingSize: 'l' }),
  ];
  await controller.flush();
  await Promise.all(updates);
  expect(controller.store.getState()).toEqual({
    skin: 'glass',
    scheme: 'dark',
    readingSize: 'l',
    error: null,
  });
  expect(await settings.get('ui.skin', '')).toBe('glass');
  expect(await settings.get('ui.scheme', '')).toBe('dark');
  expect(await settings.get('ui.readingSize', '')).toBe('l');
});

it('数据库提交前不乐观更新store', async () => {
  const settings = createSettingsRepo(db);
  const controller = await createAppearanceSettings(settings, db);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => {
    release = resolve;
  });
  const holding = db.transaction(async () => waiting);
  const update = controller.update({ skin: 'glass' });
  await Promise.resolve();
  await Promise.resolve();
  expect(controller.store.getState().skin).toBe('paper');
  release();
  await holding;
  await update;
  expect(controller.store.getState().skin).toBe('glass');
});

it('三键写入失败全部回滚，状态保持上次已保存值，错误可见且后续更新可恢复', async () => {
  const settings = createSettingsRepo(db);
  const controller = await createAppearanceSettings(settings, db);
  await controller.update({ skin: 'paper', scheme: 'light', readingSize: 's' });
  await db.run(
    "CREATE TRIGGER appearance_reject BEFORE UPDATE ON setting WHEN NEW.key = 'ui.scheme' BEGIN SELECT RAISE(ABORT,'test disk failure'); END",
  );
  await expect(
    controller.update({ skin: 'glass', scheme: 'dark', readingSize: 'l' }),
  ).resolves.toBeUndefined();
  expect(controller.store.getState()).toEqual({
    skin: 'paper',
    scheme: 'light',
    readingSize: 's',
    error: '外观设置没有保存，请重试',
  });
  expect(await settings.get('ui.skin', '')).toBe('paper');
  expect(await settings.get('ui.scheme', '')).toBe('light');
  expect(await settings.get('ui.readingSize', '')).toBe('s');
  await controller.flush();
  await db.run('DROP TRIGGER appearance_reject');
  await controller.update({ scheme: 'dark' });
  expect(controller.store.getState()).toEqual({
    skin: 'paper',
    scheme: 'dark',
    readingSize: 's',
    error: null,
  });
});

it('两个数据库的外观状态与更新队列互相隔离', async () => {
  const other = openMemoryDb();
  await migrate(other);
  try {
    const first = await createAppearanceSettings(createSettingsRepo(db), db);
    const second = await createAppearanceSettings(
      createSettingsRepo(other),
      other,
    );
    await first.update({ skin: 'glass' });
    expect(second.store.getState().skin).toBe('paper');
    await second.update({ scheme: 'dark' });
    expect(first.store.getState()).toMatchObject({
      skin: 'glass',
      scheme: 'system',
    });
    expect(second.store.getState()).toMatchObject({
      skin: 'paper',
      scheme: 'dark',
    });
  } finally {
    await other.close();
  }
});

it('关闭并重开真实SQLite文件后外观仍在', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pagewise-appearance-'));
  const path = join(directory, 'test.sqlite');
  const opened: Db[] = [];
  try {
    const first = openFileDb(path);
    opened.push(first);
    await migrate(first);
    const original = await createAppearanceSettings(
      createSettingsRepo(first),
      first,
    );
    await original.update({ skin: 'glass', scheme: 'dark', readingSize: 'l' });
    await original.flush();
    await first.close();
    opened.pop();
    const next = openFileDb(path);
    opened.push(next);
    await migrate(next);
    const restored = await createAppearanceSettings(
      createSettingsRepo(next),
      next,
    );
    expect(restored.store.getState()).toEqual({
      skin: 'glass',
      scheme: 'dark',
      readingSize: 'l',
      error: null,
    });
  } finally {
    for (const connection of opened) await connection.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
