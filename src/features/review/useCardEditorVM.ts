import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Card } from '@core/types';
import type { Container } from '@app/container';
import { editReviewCard } from '@app/usecases/review';
import { reviewErrorMessage } from './errors';
import type { CardEditorIntents, CardEditorState } from './types';

type Draft = CardEditorState & { id: number };

/** The same lock covers editing and rating, including taps before React rerenders. */
export function useCardEditorVM(
  c: Container,
  lock: RefObject<boolean>,
  onSaved: (card: Card) => void,
) {
  const [state, setState] = useState<Draft>();
  const draft = useRef<Draft | undefined>(undefined);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const update = (value: Draft | undefined) => {
    draft.current = value;
    setState(value);
  };
  const close = () => {
    if (!draft.current || draft.current.saving) return;
    update(undefined);
    lock.current = false;
  };
  const intents: CardEditorIntents = {
    close,
    setFront: front => {
      if (draft.current && !draft.current.saving)
        update({ ...draft.current, front, error: undefined });
    },
    setBack: back => {
      if (draft.current && !draft.current.saving)
        update({ ...draft.current, back, error: undefined });
    },
    save: () => {
      const value = draft.current;
      if (!value || value.saving) return;
      if (!value.front.trim() || !value.back.trim()) {
        update({ ...value, error: '问题和答案都需要填写' });
        return;
      }
      update({ ...value, saving: true, error: undefined });
      editReviewCard(c, value.id, value)
        .then(card => {
          if (!mounted.current) return;
          onSaved(card);
          update(undefined);
          lock.current = false;
        })
        .catch(cause => {
          if (mounted.current)
            update({
              ...value,
              saving: false,
              error: reviewErrorMessage(
                cause,
                '保存失败，请重试。修改内容已保留。',
              ),
            });
        });
    },
  };
  return {
    state,
    intents,
    open(card: Card) {
      if (lock.current) return;
      lock.current = true;
      update({
        id: card.id,
        front: card.front,
        back: card.back,
        saving: false,
      });
    },
  };
}
