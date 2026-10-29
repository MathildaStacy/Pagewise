import native from './specs/NativePdfPages';
export type { PdfInfo, PageSize, OutlineItem } from './specs/NativePdfPages';
function moduleOf() {
  if (!native) throw new Error('PDF 模块暂时不可用，请重启 Pagewise');
  return native;
}
export const PdfPages = {
  info: (path: string) => moduleOf().info(path),
  render: (path: string, page: number, widthPx: number) =>
    moduleOf().render(path, page, widthPx),
  outline: (path: string) => moduleOf().outline(path),
  pageLabels: (path: string) => moduleOf().pageLabels(path),
  textLayer: (path: string, pages: number[]) =>
    moduleOf().textLayer(path, pages),
  split: (path: string, from: number, to: number, outPath: string) =>
    moduleOf().split(path, from, to, outPath),
  close: (path: string) => moduleOf().close(path),
};
