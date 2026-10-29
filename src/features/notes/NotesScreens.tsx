import { NotesView } from '@ui/screens/NotesView';
import { NotesBookView } from '@ui/screens/NotesBookView';
import { NoteDetailView } from '@ui/screens/NoteDetailView';
import { useNotesVM, useNotesBookVM, useNoteDetailVM } from './useNotesVM';
export function NotesScreen() {
  return <NotesView {...useNotesVM()} />;
}
export function NotesBookScreen({ bookId }: { bookId: string }) {
  return <NotesBookView {...useNotesBookVM(bookId)} />;
}
export function NoteDetailScreen({
  bookId,
  sectionId,
}: {
  bookId: string;
  sectionId: string;
}) {
  return <NoteDetailView {...useNoteDetailVM(bookId, sectionId)} />;
}
