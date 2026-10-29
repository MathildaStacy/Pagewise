import { createLogger, redact } from '@app/log';
import { createTestClock } from '@app/clock';
import type { LogFileStore } from '@platform/logFiles';

function memoryFiles() {
  const days = new Map<string, string>();
  const files: LogFileStore = {
    append: jest.fn(async (day, line) => {
      days.set(day, (days.get(day) ?? '') + line + '\n');
    }),
    prune: jest.fn(async before => {
      for (const day of days.keys()) {
        if (day < before) {
          days.delete(day);
        }
      }
    }),
    readAll: jest.fn(async () =>
      [...days]
        .sort()
        .map(([, value]) => value)
        .join(''),
    ),
  };
  return { days, files };
}

test.each([
  'Authorization: Bearer plain-value',
  'authorization=Basic YWxhZGRpbjpvcGVuc2VzYW1l',
  '{"Authorization":"Bearer plain-value"}',
  'sk-provider-secret and mnr_mineru-token',
  'api_key="plain-value", token=another-value',
])('redacts headers and token patterns: %s', input => {
  const output = redact(input);
  expect(output).not.toMatch(
    /plain-value|YWxhZGRpbjpvcGVuc2VzYW1l|provider-secret|mineru-token|another-value/,
  );
  expect(output).toContain('[REDACTED]');
});

test('known secrets without prefixes and metadata/errors are removed from every path', async () => {
  const { files } = memoryFiles();
  const log = createLogger({ files });
  log.registerSecret('custom-exact-key');
  log.info('request custom-exact-key', {
    apiKey: 'another-key',
    token: 'another-token',
    Authorization: 'Bearer arbitrary',
    headers: { 'X-API-Key': 'header-key' },
    nested: {
      note: 'custom-exact-key',
      error: new Error('authorization: Bearer opaque-value'),
    },
    content: 'book original text',
    prompt: 'user question',
  });
  await log.flush();
  const output = JSON.stringify(log.entries()) + (await log.export());
  expect(output).not.toMatch(
    /custom-exact-key|another-key|another-token|opaque-value|arbitrary|header-key|book original text|user question/,
  );
  expect(output).toContain('[内容已省略]');
});

test('old and replacement known secrets stay masked, even for already buffered messages', async () => {
  const log = createLogger();
  log.info('first-key second-key');
  log.registerSecret('first-key');
  log.registerSecret('second-key');
  expect(log.entries()[0].message).toBe('[REDACTED] [REDACTED]');
  expect(await log.export()).not.toMatch(/first-key|second-key/);
});

test('keeps a 2000-entry ring and returns detached entries', () => {
  const log = createLogger();
  for (let i = 0; i < 2002; i++) {
    log.debug('event', { id: i });
  }
  expect(log.entries()).toHaveLength(2000);
  expect(log.entries()[0].fields).toEqual({ id: 2 });
  log.entries()[0].message = 'changed';
  log.entries()[0].fields!.id = 'changed';
  expect(log.entries()[0]).toMatchObject({
    message: 'event',
    fields: { id: 2 },
  });
  expect(() => createLogger({ capacity: 0 })).toThrow('正整数');
});

test('serializes asynchronous writes, rotates UTC days, retains today and two prior days', async () => {
  const clock = createTestClock('2026-10-29T23:59:59Z');
  const { files, days } = memoryFiles();
  days.set('2026-10-26', 'too old');
  const log = createLogger({ files, clock });
  log.info('before midnight');
  clock.advance(2000);
  log.warn('after midnight');
  log.error('next');
  await log.flush();
  expect(days.has('2026-10-26')).toBe(false);
  expect([...days.keys()]).toEqual(['2026-10-29', '2026-10-30']);
  expect(files.prune).toHaveBeenNthCalledWith(1, '2026-10-27');
  expect(files.prune).toHaveBeenNthCalledWith(2, '2026-10-28');
  expect(await log.export()).toContain('before midnight');
  const lines = days
    .get('2026-10-30')!
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  expect(lines.map(line => line.message)).toEqual(['after midnight', 'next']);
});

test('file write failures preserve memory logs and cannot leak raw errors', async () => {
  const { files } = memoryFiles();
  jest
    .mocked(files.append)
    .mockRejectedValueOnce(new Error('custom-key in filesystem path'));
  const log = createLogger({ files });
  log.info('first');
  log.info('second');
  await log.flush();
  expect(files.append).toHaveBeenCalledTimes(2);
  expect(await log.export()).toContain('first');
  expect(await log.export()).not.toContain('custom-key');
  expect(
    log.entries().some(entry => entry.message.includes('日志文件写入失败')),
  ).toBe(true);
});

test('file read failures fall back to memory and circular metadata does not crash logging', async () => {
  const { files } = memoryFiles();
  jest
    .mocked(files.readAll)
    .mockRejectedValueOnce(new Error('private filesystem error'));
  const log = createLogger({ files });
  const fields: Record<string, unknown> = {
    elapsed: 1n,
    values: ['sk-secret', 2],
  };
  fields.loop = fields;
  log.info('ready', fields);
  const exported = await log.export();
  expect(exported).toContain('[循环引用]');
  expect(exported).not.toContain('private filesystem error');
  expect(exported).not.toContain('sk-secret');
  expect(exported).toContain('日志文件读取失败');
});
