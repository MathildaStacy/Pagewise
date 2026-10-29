import type { DetourFrame } from '../types';

export interface DetourState {
  main: string;
  stack: DetourFrame[];
}
export type DetourEvent =
  | { t: 'load'; sectionId: string; detourId?: number }
  | { t: 'review'; sectionId: string; stuckId: number; detourId?: number }
  | { t: 'back' }
  | { t: 'rebase' };
export type DetourEffect =
  | 'startDetour'
  | 'endDetour'
  | 'askReturnFirst'
  | 'changeMain'
  | 'none';
export type DetourOperation =
  | {
      t: 'startDetour';
      frame: DetourFrame;
      fromSection: string;
      depth: number;
      pendingId: boolean;
    }
  | { t: 'endDetour'; frame: DetourFrame }
  | { t: 'changeMain'; fromSection: string; toSection: string }
  | { t: 'askReturnFirst'; message: string };
export interface DetourReduction {
  next: DetourState;
  effects: DetourEffect[];
  operations: DetourOperation[];
}

/** IO belongs to StudySession. Supply an allocated detourId, or reconcile the pending 0 after startDetour. */
export function reduceDetour(
  state: DetourState,
  event: DetourEvent,
): DetourReduction {
  const unchanged = (): DetourReduction => ({
    next: state,
    effects: ['none'],
    operations: [],
  });
  const current = state.stack.at(-1);
  if (event.t === 'load' || event.t === 'review') {
    if (
      event.t === 'load' &&
      (event.sectionId === state.main || event.sectionId === current?.sectionId)
    )
      return unchanged();
    if (
      event.t === 'review' &&
      event.sectionId === current?.sectionId &&
      event.stuckId === current.reviewStuckId
    )
      return unchanged();
    if (state.stack.length >= 2)
      return {
        next: state,
        effects: ['askReturnFirst'],
        operations: [
          {
            t: 'askReturnFirst',
            message: '已在第 2 层岔路，先请用户决定是否回主线',
          },
        ],
      };
    const frame: DetourFrame = {
      sectionId: event.sectionId,
      detourId: event.detourId ?? 0,
      ...(event.t === 'review' ? { reviewStuckId: event.stuckId } : {}),
    };
    return {
      next: { main: state.main, stack: [...state.stack, frame] },
      effects: ['startDetour'],
      operations: [
        {
          t: 'startDetour',
          frame,
          fromSection: current?.sectionId ?? state.main,
          depth: state.stack.length + 1,
          pendingId: event.detourId === undefined,
        },
      ],
    };
  }
  if (!current) return unchanged();
  const operations: DetourOperation[] = [...state.stack]
    .reverse()
    .map(frame => ({ t: 'endDetour', frame }));
  if (event.t === 'rebase')
    operations.push({
      t: 'changeMain',
      fromSection: state.main,
      toSection: current.sectionId,
    });
  return {
    next: {
      main: event.t === 'rebase' ? current.sectionId : state.main,
      stack: [],
    },
    effects: operations.map(operation => operation.t),
    operations,
  };
}
export const reduce = reduceDetour;
export function activeSection(state: DetourState): string {
  return state.stack.at(-1)?.sectionId ?? state.main;
}
