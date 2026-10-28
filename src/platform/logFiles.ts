import ReactNativeBlobUtil from 'react-native-blob-util';

/** 每行是已脱敏的 JSON；day / beforeDay 是 UTC YYYY-MM-DD。 */
export interface LogFileStore {
  append(day: string, line: string): Promise<void>;
  prune(beforeDay: string): Promise<void>;
  readAll(): Promise<string>;
}

export function createDeviceLogFileStore(): LogFileStore {
  const fs = ReactNativeBlobUtil.fs;
  const directory = `${fs.dirs.DocumentDir}/logs`;
  const ensureDirectory = async () => {
    if (!(await fs.exists(directory))) {
      await fs.mkdir(directory);
    }
  };
  const days = async () => {
    if (!(await fs.exists(directory))) {
      return [];
    }
    return (await fs.ls(directory))
      .filter(name => /^\d{4}-\d{2}-\d{2}\.log$/.test(name))
      .sort();
  };
  return {
    async append(day, line) {
      await ensureDirectory();
      await fs.appendFile(`${directory}/${day}.log`, line + '\n', 'utf8');
    },
    async prune(beforeDay) {
      for (const name of await days()) {
        if (name.slice(0, 10) < beforeDay) {
          await fs.unlink(`${directory}/${name}`);
        }
      }
    },
    async readAll() {
      const contents: string[] = [];
      for (const name of await days()) {
        contents.push(await fs.readFile(`${directory}/${name}`, 'utf8'));
      }
      return contents.join('');
    },
  };
}
