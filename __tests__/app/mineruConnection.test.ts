import { createTestContainer, createTestDemoContainer } from '@app/testing';
import {
  configureImportRuntime,
  type ImportRuntime,
} from '@app/usecases/importRuntime';
import { testMineruConnection } from '@app/usecases/mineruConnection';
import { MineruError } from '@services/mineru/types';

it('uses the non-uploading authentication probe and returns its actual result', async () => {
  const c = await createTestContainer();
  const test = jest.fn().mockResolvedValue({ ok: true, latencyMs: 24.2 });
  const requestUpload = jest.fn();
  configureImportRuntime(c, {
    mineru: { test, requestUpload },
  } as unknown as ImportRuntime);
  try {
    await expect(testMineruConnection(c)).resolves.toContain('24 ms');
    expect(test).toHaveBeenCalledTimes(1);
    expect(requestUpload).not.toHaveBeenCalled();
    test.mockResolvedValueOnce({
      ok: false,
      latencyMs: 1,
      error: new MineruError('A0211'),
    });
    await expect(testMineruConnection(c)).rejects.toThrow('Token 已过期');
  } finally {
    await c.close();
  }
});

it('keeps the example library isolated from the real MinerU service', async () => {
  const c = await createTestDemoContainer();
  try {
    await expect(testMineruConnection(c)).resolves.toContain('不会连接');
  } finally {
    await c.close();
  }
});
