import type { Db } from '../db';
import { createBooksRepo } from './books';
import { createPartsRepo } from './parts';
import { createBlocksRepo } from './blocks';
import { createSectionsRepo } from './sections';
import { createPlansRepo } from './plans';
import { createStudyRepo } from './study';
import { createMessagesRepo } from './messages';
import { createDetoursRepo } from './detours';
import { createNotesRepo } from './notes';
import { createCardsRepo } from './cards';
import { createUsageRepo } from './usage';
import { createSettingsRepo } from './settings';
import { createMathRepo } from './math';
import { createDraftsRepo } from './drafts';
import { createConversationsRepo } from './conversations';

/** Recreate this collection with the transaction Db inside an atomic use case. */
export function createRepos(db: Db, now = () => new Date().toISOString()) {
  return {
    books: createBooksRepo(db, now),
    parts: createPartsRepo(db, now),
    blocks: createBlocksRepo(db),
    sections: createSectionsRepo(db),
    plans: createPlansRepo(db),
    study: createStudyRepo(db),
    messages: createMessagesRepo(db),
    conversations: createConversationsRepo(db, now),
    detours: createDetoursRepo(db, now),
    notes: createNotesRepo(db, now),
    cards: createCardsRepo(db, now),
    usage: createUsageRepo(db),
    settings: createSettingsRepo(db),
    math: createMathRepo(db, now),
    drafts: createDraftsRepo(db),
  };
}

export type Repos = ReturnType<typeof createRepos>;
