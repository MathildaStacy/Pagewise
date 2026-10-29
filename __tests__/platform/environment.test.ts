import type { UiEnvironmentState } from '@platform/specs/NativeUiEnvironment';

function nativeModule(initial: UiEnvironmentState) {
  const listeners = new Set<(value: UiEnvironmentState) => void>();
  const remove = jest.fn();
  return {
    getCurrent: jest.fn(async () => initial),
    startObserving: jest.fn(),
    stopObserving: jest.fn(),
    onChange: jest.fn((listener: (value: UiEnvironmentState) => void) => {
      listeners.add(listener);
      return {
        remove: () => {
          remove();
          listeners.delete(listener);
        },
      };
    }),
    emit: (value: UiEnvironmentState) =>
      listeners.forEach(listener => listener(value)),
    remove,
  };
}

function load(native: ReturnType<typeof nativeModule> | null) {
  jest.resetModules();
  const get = jest.fn(() => native);
  jest.doMock('react-native', () => ({ TurboModuleRegistry: { get } }));
  const environment =
    require('@platform/environment') as typeof import('@platform/environment');
  return { ...environment, get };
}

const capable = { lowRam: false, powerSave: false, blurAllowed: true };
const unavailable = { lowRam: false, powerSave: false, blurAllowed: false };

test('loads UiEnvironment through the nullable TurboModule registry', async () => {
  const native = nativeModule(capable);
  const env = load(native);
  expect(env.get).toHaveBeenCalledWith('UiEnvironment');
  expect(await env.readUiEnvironment()).toEqual(capable);
  expect(native.getCurrent).toHaveBeenCalledTimes(1);
  expect(native.startObserving).not.toHaveBeenCalled();
});

test.each([
  { lowRam: true, powerSave: false, blurAllowed: true },
  { lowRam: false, powerSave: true, blurAllowed: true },
  { lowRam: false, powerSave: false, blurAllowed: false },
])(
  'disables blur when low memory or power saving prohibits it',
  async value => {
    expect(await load(nativeModule(value)).readUiEnvironment()).toEqual({
      ...value,
      blurAllowed: false,
    });
  },
);

test('missing native module returns a detached conservative fallback without throwing', async () => {
  const env = load(null);
  const current = await env.readUiEnvironment();
  expect(current).toEqual(unavailable);
  current.blurAllowed = true;
  expect(await env.readUiEnvironment()).toEqual(unavailable);
  const listener = jest.fn();
  const off = env.subscribeUiEnvironment(listener);
  expect(listener).toHaveBeenCalledWith(unavailable);
  expect(() => {
    off();
    off();
  }).not.toThrow();
});

test('failed native reads return conservative material settings', async () => {
  const native = nativeModule(capable);
  native.getCurrent.mockRejectedValueOnce(new Error('native unavailable'));
  expect(await load(native).readUiEnvironment()).toEqual(unavailable);
});

test('subscribes to typed events and removes the last native receiver exactly once', () => {
  const native = nativeModule(capable);
  const env = load(native);
  const first = jest.fn();
  const second = jest.fn();
  const offFirst = env.subscribeUiEnvironment(first);
  const offSecond = env.subscribeUiEnvironment(second);
  expect(native.startObserving).toHaveBeenCalledTimes(1);
  native.emit({ lowRam: false, powerSave: true, blurAllowed: true });
  expect(first).toHaveBeenLastCalledWith({
    lowRam: false,
    powerSave: true,
    blurAllowed: false,
  });
  expect(second).toHaveBeenCalledTimes(1);
  offFirst();
  offFirst();
  expect(native.stopObserving).not.toHaveBeenCalled();
  native.emit(capable);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenLastCalledWith(capable);
  offSecond();
  expect(native.remove).toHaveBeenCalledTimes(2);
  expect(native.stopObserving).toHaveBeenCalledTimes(1);
  const offThird = env.subscribeUiEnvironment(jest.fn());
  expect(native.startObserving).toHaveBeenCalledTimes(2);
  offThird();
  expect(native.stopObserving).toHaveBeenCalledTimes(2);
});

test('failed receiver registration removes the event listener and falls back', () => {
  const native = nativeModule(capable);
  native.startObserving.mockImplementationOnce(() => {
    throw new Error('registration failed');
  });
  const env = load(native);
  const listener = jest.fn();
  const off = env.subscribeUiEnvironment(listener);
  expect(listener).toHaveBeenCalledWith(unavailable);
  expect(native.remove).toHaveBeenCalledTimes(1);
  off();
  expect(native.stopObserving).not.toHaveBeenCalled();
  const later = env.subscribeUiEnvironment(jest.fn());
  expect(native.startObserving).toHaveBeenCalledTimes(2);
  later();
  expect(native.stopObserving).toHaveBeenCalledTimes(1);
});
