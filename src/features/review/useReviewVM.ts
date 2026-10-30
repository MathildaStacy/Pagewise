import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Card } from '@core/types';
import { useContainer } from '@app/ContainerProvider';
import {
  loadReview,
  loadReviewCards,
  rateReviewCard,
  resolveStuck,
  setReviewCardSuspended,
  type ReviewData,
} from '@app/usecases/review';
import { toAppError } from '@app/errors';
import { useAppNav } from '@features/nav';
import { presentReview, presentReviewCard } from './presenters';
import { useCardEditorVM } from './useCardEditorVM';
import { useCardManagementVM } from './useCardManagementVM';
import { reviewErrorMessage } from './errors';
import type {
  ReviewIntents,
  ReviewSessionIntents,
  ReviewSessionState,
  ReviewState,
  Rating,
} from './types';

export function useReviewVM(): { state: ReviewState; intents: ReviewIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const [data, setData] = useState<ReviewData>();
  const management = useCardManagementVM(
    c,
    data?.books ?? [],
    data?.sections ?? [],
  );
  const [error, setError] = useState<string>();
  const mounted = useRef(false);
  const refresh = useCallback(() => {
    loadReview(c)
      .then(value => {
        if (mounted.current) {
          setData(value);
          setError(undefined);
        }
      })
      .catch(cause => {
        if (mounted.current) setError(toAppError(cause).message);
      });
  }, [c]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const off = [
      c.events.subscribe('cards.changed', refresh),
      c.events.subscribe('stuck.changed', refresh),
    ];
    const active = AppState.addEventListener('change', value => {
      if (value === 'active') refresh();
    });
    return () => {
      mounted.current = false;
      off.forEach(fn => fn());
      active.remove();
    };
  }, [c, refresh]);
  const state: ReviewState = data
    ? { ...presentReview(data), error }
    : {
        hero: { due: 0, stuck: 0, total: 0 },
        boxes: [],
        start: { enabled: false, label: '正在读取复习卡片…' },
        stuckList: [],
        loading: !error,
        error,
      };
  return {
    state: { ...state, management: management.state },
    intents: {
      start: () => {
        if (state.start.enabled) nav.open({ name: 'ReviewSession' });
      },
      startQuick: () => {
        if (state.start.enabled) nav.open({ name: 'ReviewSession', limit: 5 });
      },
      management: management.intents,
      retry: refresh,
      reteach: id => {
        const s = data?.stuck.find(item => String(item.id) === id);
        if (s)
          nav.open({
            name: 'Study',
            bookId: s.book_id,
            sectionId: s.section_id,
            stuckId: s.id,
            question: `重讲这个卡点：${s.text}`,
          });
      },
      markResolved: id => {
        resolveStuck(c, Number(id)).catch(cause =>
          setError(toAppError(cause).message),
        );
      },
    },
  };
}

export function useReviewSessionVM(sessionLimit?: number): {
  state: ReviewSessionState;
  intents: ReviewSessionIntents;
} {
  const c = useContainer(),
    nav = useAppNav();
  const [data, setData] =
    useState<Awaited<ReturnType<typeof loadReviewCards>>>();
  const [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const [result, setResult] = useState({ again: 0, hard: 0, good: 0 });
  const [suspendedCount, setSuspendedCount] = useState(0);
  const [lastSuspended, setLastSuspended] = useState<Card>();
  const lock = useRef(false),
    mounted = useRef(false);
  const refresh = useCallback(() => {
    loadReviewCards(c, sessionLimit)
      .then(value => {
        if (mounted.current) {
          setData(value);
          setError(undefined);
        }
      })
      .catch(cause => {
        if (mounted.current) setError(toAppError(cause).message);
      });
  }, [c, sessionLimit]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  const card = data?.cards[index];
  const replaceCard = (updated: Card) => {
    setData(
      previous =>
        previous && {
          ...previous,
          cards: previous.cards.map(item =>
            item.id === updated.id ? updated : item,
          ),
        },
    );
    setFlipped(false);
    setError(undefined);
  };
  const editor = useCardEditorVM(c, lock, replaceCard);
  const notice = lastSuspended
    ? '已暂停这张卡，不再安排复习。也可以在闪卡管理中恢复。'
    : undefined;
  const state: ReviewSessionState =
    card && data
      ? {
          ...presentReviewCard(
            card,
            data.sections,
            flipped,
            index,
            data.cards.length,
            c.clock.today(),
          ),
          busy,
          error,
          editor: editor.state,
          notice,
        }
      : {
          title: '复习',
          card: null,
          rate: null,
          loading: !data && !error,
          busy,
          error,
          notice,
          finished: data
            ? {
                title: sessionLimit == null ? '今天复习完了' : '这组复习完成了',
                text: `记得 ${result.good} · 模糊 ${result.hard} · 忘了 ${
                  result.again
                }${result.again ? '\n忘了的已加入卡点清单' : ''}${
                  suspendedCount
                    ? `\n已暂停 ${suspendedCount} 张，可在闪卡管理中恢复`
                    : ''
                }`,
              }
            : null,
        };
  function rate(rating: Rating) {
    if (!card || !flipped || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    rateReviewCard(c, card, rating)
      .then(() => {
        if (mounted.current) {
          setResult(previous => ({
            ...previous,
            [rating]: previous[rating] + 1,
          }));
          setIndex(i => i + 1);
          setFlipped(false);
        }
      })
      .catch(cause => {
        if (mounted.current) setError(reviewErrorMessage(cause));
      })
      .finally(() => {
        lock.current = false;
        if (mounted.current) setBusy(false);
      });
  }
  function suspend() {
    if (!card || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setReviewCardSuspended(c, card.id, true)
      .then(updated => {
        if (!mounted.current) return;
        setData(
          previous =>
            previous && {
              ...previous,
              cards: previous.cards.filter(item => item.id !== updated.id),
            },
        );
        setSuspendedCount(count => count + 1);
        setLastSuspended(updated);
        setFlipped(false);
      })
      .catch(cause => {
        if (mounted.current) setError(toAppError(cause).message);
      })
      .finally(() => {
        lock.current = false;
        if (mounted.current) setBusy(false);
      });
  }
  function undoSuspend() {
    if (!lastSuspended || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setReviewCardSuspended(c, lastSuspended.id, false)
      .then(updated => {
        if (!mounted.current) return;
        setData(previous => {
          if (!previous) return previous;
          const cards = [...previous.cards];
          cards.splice(index, 0, updated);
          return { ...previous, cards };
        });
        setSuspendedCount(count => count - 1);
        setLastSuspended(undefined);
        setFlipped(false);
      })
      .catch(cause => {
        if (mounted.current) setError(toAppError(cause).message);
      })
      .finally(() => {
        lock.current = false;
        if (mounted.current) setBusy(false);
      });
  }
  function retry() {
    if (lock.current) return;
    if (!data) {
      refresh();
      return;
    }
    if (!card) {
      setError(undefined);
      return;
    }
    lock.current = true;
    setBusy(true);
    c.repos.cards
      .get(card.id)
      .then(updated => {
        if (!mounted.current) return;
        if (updated && !updated.suspended) replaceCard(updated);
        else {
          setData(
            previous =>
              previous && {
                ...previous,
                cards: previous.cards.filter(item => item.id !== card.id),
              },
          );
          setFlipped(false);
          setError(undefined);
        }
      })
      .catch(cause => {
        if (mounted.current) setError(toAppError(cause).message);
      })
      .finally(() => {
        lock.current = false;
        if (mounted.current) setBusy(false);
      });
  }
  return {
    state,
    intents: {
      flip: () => {
        if (card && !lock.current) setFlipped(true);
      },
      rate,
      retry,
      editCard: () => {
        if (card) editor.open(card);
      },
      editor: editor.intents,
      suspendCard: suspend,
      undoSuspend,
      back: nav.back,
      done: () => nav.open({ name: 'Tabs', tab: 'Review' }),
      openSource: () => {
        if (card && state.card?.canOpenSource)
          nav.open({
            name: 'Reader',
            bookId: card.book_id,
            sectionId: card.section_id,
          });
      },
      askAi: () => {
        if (card)
          nav.open({
            name: 'Study',
            bookId: card.book_id,
            sectionId: card.section_id,
            question: `关于这张卡：${card.front}`,
          });
      },
    },
  };
}
