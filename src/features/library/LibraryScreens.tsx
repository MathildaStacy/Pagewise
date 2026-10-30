import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { ShelfView } from '@ui/screens/ShelfView';
import { BookMapView } from '@ui/screens/BookMapView';
import { ParseProgressView } from '@ui/screens/ParseProgressView';
import { ImportSettingsView } from '@ui/screens/ImportSettingsView';
import {
  useBookMapVM,
  useImportSettingsVM,
  useParseProgressVM,
  useShelfVM,
} from './useLibraryVM';
export function ShelfScreen() {
  const vm = useShelfVM();
  const focused = useIsFocused();
  const wasFocused = useRef(focused);
  const refresh = vm.intents.refresh;
  useEffect(() => {
    if (focused && !wasFocused.current) refresh();
    wasFocused.current = focused;
  }, [focused, refresh]);
  return <ShelfView {...vm} />;
}
export function BookMapScreen({ bookId }: { bookId: string }) {
  return <BookMapView {...useBookMapVM(bookId)} />;
}
export function ParseProgressScreen({ bookId }: { bookId: string }) {
  return <ParseProgressView {...useParseProgressVM(bookId)} />;
}
export function ImportSettingsScreen({ draftId }: { draftId: string }) {
  return <ImportSettingsView {...useImportSettingsVM(draftId)} />;
}
