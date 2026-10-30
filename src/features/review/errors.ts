import { ReviewCardError } from '@app/usecases/review';
import { toAppError } from '@app/errors';

export function reviewErrorMessage(cause: unknown, fallback?: string): string {
  return cause instanceof ReviewCardError
    ? cause.message
    : fallback ?? toAppError(cause).message;
}
