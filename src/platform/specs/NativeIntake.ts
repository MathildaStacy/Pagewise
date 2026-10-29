import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
export type IntakeFile = {
  uri: string;
  name: string | null;
  mime: string | null;
};
export interface Spec extends TurboModule {
  initial(): Promise<IntakeFile | null>;
  readonly onIntake: CodegenTypes.EventEmitter<IntakeFile>;
}
export default TurboModuleRegistry.get<Spec>('Intake');
