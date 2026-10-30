import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book, Card, Section } from '@core/types';
import type { Container } from '@app/container';
import { setReviewCardSuspended } from '@app/usecases/review';
import { toAppError } from '@app/errors';
import { sectionLabel } from './presenters';
import { useCardEditorVM } from './useCardEditorVM';
import type { CardManagementIntents, CardManagementState } from './types';

export function useCardManagementVM(
  c: Container,
  books: Book[],
  sections: Section[],
) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'suspended'>('all');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false),
    mounted = useRef(false);
  const refresh = useCallback(() => {
    setLoading(true);
    setError(undefined);
    c.repos.cards
      .list()
      .then(value => {
        if (mounted.current) setCards(value);
      })
      .catch(cause => {
        if (mounted.current) setError(toAppError(cause).message);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [c]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    refresh();
    return c.events.subscribe('cards.changed', refresh);
  }, [c, open, refresh]);
  const replace = (card: Card) =>
    setCards(previous =>
      previous.map(item => (item.id === card.id ? card : item)),
    );
  const editor = useCardEditorVM(c, lock, replace);
  const state: CardManagementState = {
    open,
    filter,
    total: cards.length,
    suspended: cards.filter(card => card.suspended).length,
    cards: cards
      .filter(card => filter === 'all' || card.suspended)
      .map(card => ({
        id: String(card.id),
        front: card.front,
        back: card.back,
        suspended: !!card.suspended,
        source: [
          books.find(book => book.id === card.book_id)?.title,
          sectionLabel(sections, card.book_id, card.section_id),
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    loading,
    busy,
    error,
    editor: editor.state,
  };
  const intents: CardManagementIntents = {
    open: () => setOpen(true),
    close: () => {
      if (!lock.current) setOpen(false);
    },
    setFilter,
    retry: refresh,
    editor: editor.intents,
    edit: id => {
      const card = cards.find(item => String(item.id) === id);
      if (card) editor.open(card);
    },
    toggleSuspended: id => {
      const card = cards.find(item => String(item.id) === id);
      if (!card || lock.current) return;
      lock.current = true;
      setBusy(true);
      setError(undefined);
      setReviewCardSuspended(c, card.id, !card.suspended)
        .then(updated => {
          if (mounted.current) replace(updated);
        })
        .catch(cause => {
          if (mounted.current) setError(toAppError(cause).message);
        })
        .finally(() => {
          lock.current = false;
          if (mounted.current) setBusy(false);
        });
    },
  };
  return { state, intents };
}
