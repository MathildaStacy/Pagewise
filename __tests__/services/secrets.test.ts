import * as Keychain from 'react-native-keychain';
import { createKeychainStore, createMemoryKeyStore } from '@services/secrets';

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'AES_GCM_NO_AUTH' },
}));

beforeEach(() => jest.resetAllMocks());

test('memory keys are isolated and retain no value after removal', async () => {
  const onSecret = jest.fn();
  const store = createMemoryKeyStore({ onSecret });
  await store.set('ai.key.teach', 'first-value');
  await store.set('mineru.token', 'second-value');
  expect(await store.get('ai.key.teach')).toBe('first-value');
  expect(await createMemoryKeyStore().get('ai.key.teach')).toBeNull();
  await store.remove('ai.key.teach');
  expect(await store.get('ai.key.teach')).toBeNull();
  expect(await store.get('mineru.token')).toBe('second-value');
  expect(onSecret).toHaveBeenCalledWith('first-value');
});

test('device credentials use separate Pagewise namespaces and Keystore storage', async () => {
  const onSecret = jest.fn();
  const store = createKeychainStore({ onSecret });
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue(false);
  expect(await store.get('ai.key.teach')).toBeNull();
  await store.set('mineru.token', 'token-value');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
    'api-key',
    'token-value',
    {
      service: 'pagewise.secret.mineru.token',
      storage: 'AES_GCM_NO_AUTH',
    },
  );
  jest.mocked(Keychain.getGenericPassword).mockResolvedValue({
    password: 'returned-key',
    username: 'api-key',
    service: 'x',
    storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
  });
  expect(await store.get('ai.key.teach')).toBe('returned-key');
  expect(Keychain.getGenericPassword).toHaveBeenLastCalledWith({
    service: 'pagewise.secret.ai.key.teach',
  });
  await store.remove('ai.key.teach');
  expect(Keychain.resetGenericPassword).toHaveBeenCalledWith({
    service: 'pagewise.secret.ai.key.teach',
  });
  expect(onSecret.mock.calls.flat()).toContain('returned-key');
});

test('failed storage still registers the attempted secret for log redaction', async () => {
  const onSecret = jest.fn();
  const failure = new Error('Keystore unavailable');
  jest.mocked(Keychain.setGenericPassword).mockRejectedValue(failure);
  await expect(
    createKeychainStore({ onSecret }).set('ai.key.p', 'new-value'),
  ).rejects.toBe(failure);
  expect(onSecret).toHaveBeenCalledWith('new-value');
});

test('a false Keychain result is reported as a failed save', async () => {
  jest.mocked(Keychain.setGenericPassword).mockResolvedValue(false);
  await expect(
    createKeychainStore().set('ai.key.p', 'new-value'),
  ).rejects.toThrow('无法保存密钥');
});
