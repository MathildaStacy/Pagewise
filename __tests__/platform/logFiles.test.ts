import ReactNativeBlobUtil from 'react-native-blob-util';
import { createDeviceLogFileStore } from '@platform/logFiles';

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: {
      dirs: { DocumentDir: '/private/app' },
      exists: jest.fn(),
      mkdir: jest.fn(),
      ls: jest.fn(),
      appendFile: jest.fn(),
      unlink: jest.fn(),
      readFile: jest.fn(),
    },
  },
}));

const fs = ReactNativeBlobUtil.fs;
beforeEach(() => jest.resetAllMocks());

test('appends redacted JSON lines under the private App directory', async () => {
  jest.mocked(fs.exists).mockResolvedValue(false);
  const files = createDeviceLogFileStore();
  await files.append('2026-10-29', '{"message":"ok"}');
  expect(fs.mkdir).toHaveBeenCalledWith('/private/app/logs');
  expect(fs.appendFile).toHaveBeenCalledWith(
    '/private/app/logs/2026-10-29.log',
    '{"message":"ok"}\n',
    'utf8',
  );
});

test('prunes only old daily logs and exports remaining files in chronological order', async () => {
  jest.mocked(fs.exists).mockResolvedValue(true);
  jest
    .mocked(fs.ls)
    .mockResolvedValue([
      '2026-10-29.log',
      'not-a-log',
      '2026-10-26.log',
      '2026-10-28.log',
    ]);
  jest.mocked(fs.readFile).mockImplementation(async file => file + '\n');
  const files = createDeviceLogFileStore();
  await files.prune('2026-10-27');
  expect(fs.unlink).toHaveBeenCalledTimes(1);
  expect(fs.unlink).toHaveBeenCalledWith('/private/app/logs/2026-10-26.log');
  const value = await files.readAll();
  expect(value.indexOf('2026-10-28.log')).toBeLessThan(
    value.indexOf('2026-10-29.log'),
  );
  expect(value).not.toContain('not-a-log');
});

test('missing log directory reads as empty and append errors propagate to logger', async () => {
  jest.mocked(fs.exists).mockResolvedValue(false);
  const files = createDeviceLogFileStore();
  expect(await files.readAll()).toBe('');
  await files.prune('2026-10-27');
  expect(fs.ls).not.toHaveBeenCalled();
  const failure = new Error('disk full');
  jest.mocked(fs.mkdir).mockRejectedValueOnce(failure);
  await expect(files.append('2026-10-29', 'ready')).rejects.toBe(failure);
});
