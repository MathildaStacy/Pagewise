import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { MeView } from '@ui/screens/MeView';
import { MeMineruView } from '@ui/screens/MeMineruView';
import { MeAIView } from '@ui/screens/MeAIView';
import { MeAIEditView } from '@ui/screens/MeAIEditView';
import { MePrefsView } from '@ui/screens/MePrefsView';
import { MeStorageView } from '@ui/screens/MeStorageView';
import { AboutView } from '@ui/screens/AboutView';
import {
  useMeVM,
  useMineruVM,
  useAIVM,
  useAIEditVM,
  usePrefsVM,
  useStorageVM,
  useAboutVM,
} from './useSettingsVM';
export function MeScreen() {
  const vm = useMeVM();
  const refresh = vm.intents.refresh;
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  return <MeView {...vm} />;
}
export function MeMineruScreen() {
  return <MeMineruView {...useMineruVM()} />;
}
export function MeAIScreen() {
  const vm = useAIVM();
  const refresh = vm.intents.refresh;
  useFocusEffect(useCallback(() => refresh(), [refresh]));
  return <MeAIView {...vm} />;
}
export function MeAIEditScreen({ providerId }: { providerId?: string }) {
  return <MeAIEditView {...useAIEditVM(providerId)} />;
}
export function MePrefsScreen() {
  return <MePrefsView {...usePrefsVM()} />;
}
export function MeStorageScreen() {
  return <MeStorageView {...useStorageVM()} />;
}
export function AboutScreen() {
  return <AboutView {...useAboutVM()} />;
}
