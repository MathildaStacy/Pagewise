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
  return <ShelfView {...useShelfVM()} />;
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
