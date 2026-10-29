import type { StudyOpenOptions } from '@app/study/types';
import { StudyView } from '@ui/screens/StudyView';
import { ReaderView } from '@ui/screens/ReaderView';
import { SectionDoneView } from '@ui/screens/SectionDoneView';
import { useReaderVM, useSectionDoneVM, useStudyVM } from './useStudyVM';
export function StudyScreen({
  bookId,
  ...options
}: { bookId: string } & StudyOpenOptions) {
  return <StudyView {...useStudyVM(bookId, options)} />;
}
export function ReaderScreen({
  bookId,
  sectionId,
  blockRef,
}: {
  bookId: string;
  sectionId?: string;
  blockRef?: string;
}) {
  return <ReaderView {...useReaderVM(bookId, sectionId, blockRef)} />;
}
export function SectionDoneScreen({
  bookId,
  sectionId,
  draftId,
}: {
  bookId: string;
  sectionId: string;
  draftId: string;
}) {
  return <SectionDoneView {...useSectionDoneVM(bookId, sectionId, draftId)} />;
}
