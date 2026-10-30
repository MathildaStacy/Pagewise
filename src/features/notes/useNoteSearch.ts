import { useEffect, useRef, useState } from 'react';
import type { Container } from '@app/container';
import { toAppError } from '@app/errors';
import { searchNotes } from '@app/usecases/noteSearch';
import { presentNoteSearch } from './searchPresenter';
import type { NoteSearchState } from './types';

export function useNoteSearch(c: Container) {
  const [query, setQuery] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<NoteSearchState, 'query'>>({
    busy: false,
    results: [],
    hasMore: false,
  });
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    let active = true;
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      searchNotes(c, query)
        .then(data => {
          if (active && request.current === current)
            setState({
              busy: false,
              results: presentNoteSearch(data),
              hasMore: data.hasMore,
            });
        })
        .catch(error => {
          if (active && request.current === current)
            setState({
              busy: false,
              results: [],
              hasMore: false,
              error: toAppError(error).message,
            });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      active = false;
    };
  }, [c, query, attempt]);
  return {
    state: { ...state, query },
    setQuery(value: string) {
      if (value === query) return;
      request.current++;
      setState({ busy: !!value.trim(), results: [], hasMore: false });
      setQuery(value);
    },
    retry() {
      request.current++;
      setState({ busy: !!query.trim(), results: [], hasMore: false });
      setAttempt(value => value + 1);
    },
  };
}
