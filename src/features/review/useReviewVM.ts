import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useContainer } from '@app/ContainerProvider';
import {
  loadReview,
  loadReviewCards,
  rateReviewCard,
  resolveStuck,
  type ReviewData,
} from '@app/usecases/review';
import { toAppError } from '@app/errors';
import { useAppNav } from '@features/nav';
import { presentReview, presentReviewCard } from './presenters';
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
    state,
    intents: {
      start: () => {
        if (state.start.enabled) nav.open({ name: 'ReviewSession' });
      },
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

export function useReviewSessionVM(): {
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
  const lock = useRef(false),
    mounted = useRef(false);
  const refresh = useCallback(() => {
    loadReviewCards(c)
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
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  const card = data?.cards[index];
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
        }
      : {
          title: '复习',
          card: null,
          rate: null,
          loading: !data && !error,
          busy,
          error,
          finished: data
            ? {
                title: '今天复习完了',
                text: `记得 ${result.good} · 模糊 ${result.hard} · 忘了 ${
                  result.again
                }${result.again ? '\n忘了的已加入卡点清单' : ''}`,
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
        if (card && !busy) setFlipped(true);
      },
      rate,
      retry: refresh,
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
