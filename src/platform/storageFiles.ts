import { NativeModules } from 'react-native';
import { zip } from 'react-native-zip-archive';
import {
  pick,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { bookFiles } from './bookFiles';
import { FileTools } from './FileTools';

const databaseDirectory = () => {
  const module = NativeModules.OPSQLite;
  const constants = module.getConstants ? module.getConstants() : module;
  return String(constants.ANDROID_DATABASE_PATH).replace(/\/$/, '');
};
export const storageFiles = {
  ...bookFiles,
  zip,
  dirSize: FileTools.dirSize,
  share: FileTools.share,
  saveDownloads: FileTools.saveToDownloads,
  async pickBackup(): Promise<string | null> {
    try {
      const [file] = await pick({
        type: ['application/zip', 'application/octet-stream'],
        mode: 'import',
      });
      const path = `${bookFiles.cacheDir}/picked-backup.zip`;
      await FileTools.copyFromUri(file.uri, path);
      return path;
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      )
        return null;
      throw error;
    }
  },
  async replaceDatabase(source: string) {
    const destination = `${databaseDirectory()}/pagewise.db`;
    const backup = `${destination}.restore-previous`;
    const prepared = `${destination}.restore-next`;
    await bookFiles.copy(source, prepared);
    if (await bookFiles.exists(destination))
      await bookFiles.copy(destination, backup);
    try {
      await bookFiles.remove(destination);
      await bookFiles.remove(`${destination}-wal`);
      await bookFiles.remove(`${destination}-shm`);
      await bookFiles.move(prepared, destination);
    } catch (error) {
      if (await bookFiles.exists(backup))
        await bookFiles.copy(backup, destination);
      throw error;
    }
  },
  async restart() {
    await FileTools.restart();
  },
};
