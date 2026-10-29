import { MeAppearanceView } from '@ui/screens/MeAppearanceView';
import { useAppearanceVM } from './useAppearanceVM';

export function AppearanceScreen({ back }: { back(): void }) {
  return <MeAppearanceView {...useAppearanceVM(back)} />;
}
