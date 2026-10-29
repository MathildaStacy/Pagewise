import BlobUtil from 'react-native-blob-util';
import {
  pick,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { unzip } from 'react-native-zip-archive';
import type { IntakeFile } from './Intake';
export const bookFiles = {
  documentDir: BlobUtil.fs.dirs.DocumentDir,
  cacheDir: BlobUtil.fs.dirs.CacheDir,
  exists: (path: string) => BlobUtil.fs.exists(path),
  async mkdir(path: string) {
    if (!(await BlobUtil.fs.exists(path))) await BlobUtil.fs.mkdir(path);
  },
  readText: (path: string) => BlobUtil.fs.readFile(path, 'utf8'),
  writeText: (path: string, text: string) =>
    BlobUtil.fs.writeFile(path, text, 'utf8').then(() => {}),
  list: (path: string) => BlobUtil.fs.ls(path),
  isDirectory: (path: string) => BlobUtil.fs.isDir(path),
  move: (from: string, to: string) => BlobUtil.fs.mv(from, to).then(() => {}),
  copy: (from: string, to: string) => BlobUtil.fs.cp(from, to).then(() => {}),
  async remove(path: string) {
    if (await BlobUtil.fs.exists(path)) await BlobUtil.fs.unlink(path);
  },
  unzip: (zip: string, dest: string, signal?: AbortSignal) =>
    unzip(zip, dest, { signal }),
};
export async function chooseBookFile(): Promise<IntakeFile | null> {
  try {
    const [file] = await pick({
      type: ['application/pdf', 'application/epub+zip'],
      allowMultiSelection: false,
      mode: 'import',
    });
    return { uri: file.uri, name: file.name, mime: file.type };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED)
      return null;
    throw error;
  }
}
