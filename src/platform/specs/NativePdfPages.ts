import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
export type PageSize = { w: number; h: number };
export type PdfInfo = {
  pageCount: number;
  sizes: PageSize[];
  title: string | null;
  author: string | null;
};
export type OutlineItem = { title: string; page: number; level: number };
export interface Spec extends TurboModule {
  info(path: string): Promise<PdfInfo>;
  render(
    path: string,
    page: number,
    widthPx: number,
  ): Promise<{ uri: string; w: number; h: number }>;
  outline(path: string): Promise<OutlineItem[]>;
  pageLabels(path: string): Promise<string[] | null>;
  textLayer(
    path: string,
    pages: number[],
  ): Promise<{ withText: number; sampled: number }>;
  split(
    path: string,
    from: number,
    to: number,
    outPath: string,
  ): Promise<{ sizeBytes: number }>;
  close(path: string): Promise<void>;
}
export default TurboModuleRegistry.get<Spec>('PdfPages');
