import native from './specs/NativeFileTools';
function moduleOf() {
  if (!native) throw new Error('文件模块暂时不可用，请重启 Pagewise');
  return native;
}
export const FileTools = {
  sha256: (path: string) => moduleOf().sha256(path),
  stat: (path: string) => moduleOf().stat(path),
  copyFromUri: (uri: string, dest: string) => moduleOf().copyFromUri(uri, dest),
  saveToDownloads: (path: string, name: string, mime: string) =>
    moduleOf().saveToDownloads(path, name, mime),
  share: (path: string, mime: string) => moduleOf().share(path, mime),
  freeSpace: () => moduleOf().freeSpace(),
  dirSize: (path: string) => moduleOf().dirSize(path),
  remove: (path: string) => moduleOf().remove(path),
  restart: () => moduleOf().restart(),
};
