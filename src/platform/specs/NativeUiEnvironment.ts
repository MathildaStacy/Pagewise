import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type UiEnvironmentState = {
  lowRam: boolean;
  powerSave: boolean;
  blurAllowed: boolean;
};

export interface Spec extends TurboModule {
  getCurrent(): Promise<UiEnvironmentState>;
  startObserving(): void;
  stopObserving(): void;
  readonly onChange: CodegenTypes.EventEmitter<UiEnvironmentState>;
}

export default TurboModuleRegistry.get<Spec>('UiEnvironment');
