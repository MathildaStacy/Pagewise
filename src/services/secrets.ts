/**
 * AI 服务配置（PRODUCT_DESIGN §6.5、M4 界面清单「编辑服务」）：配置存在 settings 表（aiServices），
 * API Key 存 Android Keystore（react-native-keychain），代码、日志、记忆、上下文页都不出现 Key。
 */
/**
 * 来源：AShareSim/src/ai/services.ts 的 KeyStore / keychainStore，GPL-3.0-only。
 * Key 不进数据库；设备凭据由 Android Keystore 保护，测试使用独立内存实现。
 */
import * as Keychain from 'react-native-keychain';

export interface KeyStore {
  get(serviceId: string): Promise<string | null>;
  set(serviceId: string, key: string): Promise<void>;
  remove(serviceId: string): Promise<void>;
}

export interface KeyStoreOptions {
  onSecret?: (value: string) => void;
}

const keychainService = (id: string) => 'pagewise.secret.' + id;

export function createKeychainStore(options: KeyStoreOptions = {}): KeyStore {
  return {
    async get(id) {
      const result = await Keychain.getGenericPassword({
        service: keychainService(id),
      });
      if (!result) {
        return null;
      }
      options.onSecret?.(result.password);
      return result.password;
    },
    async set(id, key) {
      // 写入失败时，同一个 Key 也不能被后续错误日志泄露。
      options.onSecret?.(key);
      const result = await Keychain.setGenericPassword('api-key', key, {
        service: keychainService(id),
        // 不要求指纹：每次提问都要读 Key。
        storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
      });
      if (result === false) {
        throw new Error('无法保存密钥，请重试');
      }
    },
    async remove(id) {
      await Keychain.resetGenericPassword({ service: keychainService(id) });
    },
  };
}

export const keychainStore: KeyStore = createKeychainStore();

export function createMemoryKeyStore(options: KeyStoreOptions = {}): KeyStore {
  const keys = new Map<string, string>();
  return {
    async get(id) {
      const value = keys.get(id) ?? null;
      if (value !== null) {
        options.onSecret?.(value);
      }
      return value;
    },
    async set(id, value) {
      options.onSecret?.(value);
      keys.set(id, value);
    },
    async remove(id) {
      keys.delete(id);
    },
  };
}
