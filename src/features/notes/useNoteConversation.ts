import { useCallback, useEffect, useRef, useState } from 'react';
import type { Container } from '@app/container';
import { toAppError } from '@app/errors';
import {
  loadNoteConversation,
  type NoteConversationData,
} from '@app/usecases/noteConversation';
import { messageDoc } from '@features/study/presenters';
import type { NoteConversationState } from './types';

export function useNoteConversation(
  c: Container,
  bookId: string,
  sectionId: string,
) {
  const [state, setState] = useState<NoteConversationState | null>(null);
  const request = useRef(0),
    selected = useRef<number | null>(null),
    loaded = useRef<NoteConversationData | null>(null);
  useEffect(
    () => () => {
      request.current++;
    },
    [c, bookId, sectionId],
  );
  const open = useCallback(
    (id: number) => {
      selected.current = id;
      loaded.current = null;
      const current = ++request.current;
      setState({ title: '完整问答', loading: true, messages: [] });
      loadNoteConversation(c, bookId, sectionId, id)
        .then(data => {
          if (request.current !== current) return;
          loaded.current = data;
          const blocks = new Map(data.blocks.map(block => [block.seq, block]));
          setState({
            title: data.question,
            loading: false,
            missing: data.missing,
            messages: data.messages.map(message => ({
              id: String(message.id),
              role: message.kind,
              doc: messageDoc(
                message.content,
                message.allowedRefs,
                blocks,
                data.book,
                sectionId,
              ),
              detour: message.detour_id !== null,
            })),
          });
        })
        .catch(error => {
          if (request.current === current)
            setState({
              title: '完整问答',
              loading: false,
              messages: [],
              error: toAppError(error).message,
            });
        });
    },
    [c, bookId, sectionId],
  );
  return {
    state,
    open,
    close() {
      request.current++;
      loaded.current = null;
      setState(null);
    },
    retry() {
      if (selected.current !== null) open(selected.current);
    },
    source(ref: number) {
      return loaded.current?.blocks.find(block => block.seq === ref);
    },
  };
}
