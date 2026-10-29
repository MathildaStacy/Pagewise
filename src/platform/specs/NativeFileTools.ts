import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
export interface Spec extends TurboModule {
  sha256(path: string): Promise<string>;
  stat(path: string): Promise<{ size: number; exists: boolean }>;
  copyFromUri(
    uri: string,
    destPath: string,
  ): Promise<{ size: number; name: string | null; mime: string | null }>;
  saveToDownloads(srcPath: string, name: string, mime: string): Promise<string>;
  share(path: string, mime: string): Promise<void>;
  freeSpace(): Promise<number>;
  dirSize(path: string): Promise<number>;
  remove(path: string): Promise<void>;
  restart(): Promise<void>;
}
export default TurboModuleRegistry.get<Spec>('FileTools');
