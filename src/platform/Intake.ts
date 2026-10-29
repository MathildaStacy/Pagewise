import native from './specs/NativeIntake';
export type { IntakeFile } from './specs/NativeIntake';
export const Intake = {
  initial: () => native?.initial() ?? Promise.resolve(null),
  subscribe: (
    listener: (file: import('./specs/NativeIntake').IntakeFile) => void,
  ) => {
    const sub = native?.onIntake(listener);
    return () => sub?.remove();
  },
};
