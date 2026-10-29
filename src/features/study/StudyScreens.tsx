import type { StudyOpenOptions } from '@app/study/types';
import { useIsFocused } from '@react-navigation/native';
import { useSkin } from '@ui/kit';
import { SkinContext } from '@ui/kit/context';
import { StudyView } from '@ui/screens/StudyView';
import { ReaderView } from '@ui/screens/ReaderView';
import { SectionDoneView } from '@ui/screens/SectionDoneView';
import { useReaderVM, useSectionDoneVM, useStudyVM } from './useStudyVM';
import { useLearningActivity } from '@features/home/useHomeVM';
export function StudyScreen({
  bookId,
  ...options
}: { bookId: string } & StudyOpenOptions) {
  const vm = useStudyVM(bookId, options);
  const skin = useSkin();
  const focused = useIsFocused();
  useLearningActivity(focused);
  // 隐藏的 Android BlurView 会影响 push 页；会话与页面状态继续保留。
  return (
    <SkinContext.Provider
      value={focused ? skin : { ...skin, blurEnabled: false }}
    >
      <StudyView {...vm} />
    </SkinContext.Provider>
  );
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
  useLearningActivity(useIsFocused());
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
