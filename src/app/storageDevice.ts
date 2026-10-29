import { openDeviceDb } from '@data/drivers/opSqlite';
import { storageFiles } from '@platform/storageFiles';
import type { Container } from './container';
import { configureStorageRuntime } from './usecases/storage';

export function configureDeviceStorage(c: Container) {
  configureStorageRuntime(c, {
    ...storageFiles,
    async openSnapshot(path) {
      const slash = path.lastIndexOf('/');
      return openDeviceDb(path.slice(slash + 1), path.slice(0, slash));
    },
  });
}
