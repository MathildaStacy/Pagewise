import type { Container } from '../container';
import { StudySession } from './StudySession';

const sessions = new WeakMap<Container, Map<string, StudySession>>();
export function getStudySession(
  container: Container,
  bookId: string,
): StudySession {
  let books = sessions.get(container);
  if (!books) {
    books = new Map();
    sessions.set(container, books);
  }
  let session = books.get(bookId);
  if (!session) {
    session = new StudySession(container, bookId);
    books.set(bookId, session);
  }
  return session;
}
export async function disposeContainerSessions(
  container: Container,
): Promise<void> {
  const books = sessions.get(container);
  sessions.delete(container);
  if (books)
    await Promise.all([...books.values()].map(session => session.dispose()));
}
