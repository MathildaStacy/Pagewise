import { ReviewView } from '@ui/screens/ReviewView';
import { ReviewSessionView } from '@ui/screens/ReviewSessionView';
import { useReviewVM, useReviewSessionVM } from './useReviewVM';
export function ReviewScreen() {
  return <ReviewView {...useReviewVM()} />;
}
export function ReviewSessionScreen() {
  return <ReviewSessionView {...useReviewSessionVM()} />;
}
