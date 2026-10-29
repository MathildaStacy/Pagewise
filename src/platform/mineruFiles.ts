import BlobUtil, {
  type StatefulPromise,
  type FetchBlobResponse,
} from 'react-native-blob-util';
import { bookFiles } from './bookFiles';

type TransferOptions = {
  headers: Record<string, string>;
  signal: AbortSignal;
  onProgress(sent: number, total: number): void;
};
function cancelled() {
  const error = new Error('已停止');
  error.name = 'AbortError';
  return error;
}
async function transfer(
  start: () => StatefulPromise<FetchBlobResponse>,
  options: TransferOptions,
  upload: boolean,
) {
  if (options.signal.aborted) throw cancelled();
  const task = start();
  const abort = () => task.cancel();
  options.signal.addEventListener('abort', abort, { once: true });
  if (upload) task.uploadProgress({ interval: 200 }, options.onProgress);
  else task.progress({ interval: 200 }, options.onProgress);
  try {
    const response = await task;
    if (options.signal.aborted) throw cancelled();
    return { status: response.info().status };
  } catch (error) {
    if (options.signal.aborted) throw cancelled();
    throw error;
  } finally {
    options.signal.removeEventListener('abort', abort);
  }
}

/** Signed transfer URLs are passed directly to native streaming IO, never logged. */
export const mineruFiles = {
  put(url: string, path: string, options: TransferOptions) {
    return transfer(
      () => BlobUtil.fetch('PUT', url, options.headers, BlobUtil.wrap(path)),
      options,
      true,
    );
  },
  download(url: string, path: string, options: TransferOptions) {
    return transfer(
      () => BlobUtil.config({ path }).fetch('GET', url, options.headers),
      options,
      false,
    );
  },
  async unzip(zip: string, dest: string, signal?: AbortSignal) {
    if (signal?.aborted) throw cancelled();
    await bookFiles.unzip(zip, dest, signal);
    if (signal?.aborted) throw cancelled();
  },
  mkdir: bookFiles.mkdir,
  remove: bookFiles.remove,
};
