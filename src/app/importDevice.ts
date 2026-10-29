import { FileTools } from '@platform/FileTools';
import { PdfPages } from '@platform/PdfPages';
import { bookFiles, chooseBookFile } from '@platform/bookFiles';
import { mineruFiles } from '@platform/mineruFiles';
import { createMineruClient } from '@services/mineru/client';
import { createMineruAdapter } from '@services/mineru/adapter';
import { createEpubParser } from '@services/epub/parser';
import type { Container } from './container';
import { configureImportRuntime } from './usecases/importRuntime';

export function configureDeviceImports(c: Container) {
  const adapter = createMineruAdapter({
    async list(dir) {
      const walk = async (path: string, prefix: string): Promise<string[]> => {
        const children = await bookFiles.list(path);
        const nested = await Promise.all(
          children.map(async name => {
            const full = `${path}/${name}`;
            if (await bookFiles.isDirectory(full))
              return walk(full, `${prefix}${name}/`);
            return [`${prefix}${name}`];
          }),
        );
        return nested.flat();
      };
      return walk(dir, '');
    },
    readText: bookFiles.readText,
  });
  const epub = createEpubParser({
    unzip: (source, dest) => bookFiles.unzip(source, dest).then(() => {}),
    readText: bookFiles.readText,
    mkdir: bookFiles.mkdir,
    copyFile: bookFiles.copy,
  });
  configureImportRuntime(c, {
    files: {
      ...bookFiles,
      sha256: FileTools.sha256,
      copyFromUri: FileTools.copyFromUri,
    },
    pdf: PdfPages,
    chooseFile: chooseBookFile,
    mineru: createMineruClient({
      getToken: () => c.secrets.get('mineru.token'),
      files: mineruFiles,
    }),
    adapt: (dir, part, sizes) => adapter.adapt(dir, part, sizes),
    epub: {
      inspect: epub.inspect,
      async parse(source, dir, bookId) {
        const parsed = await epub.parse(source, dir, bookId);
        return {
          ...parsed,
          warnings: parsed.warnings.map(
            warning => `${warning.code}: ${warning.path}`,
          ),
        };
      },
    },
  });
}
