import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useContainer } from '@app/ContainerProvider';
import { toAppError } from '@app/errors';
import {
  loadBookNotes,
  loadNoteDetail,
  loadNotes,
  loadExportPreferences,
  saveExportPreferences,
  saveUserNote,
  type BookNotesData,
} from '@app/usecases/notes';
import { useAppNav } from '@features/nav';
import {
  exportPreview,
  presentNoteDetail,
  presentNotes,
  presentNotesBook,
} from './presenters';
import type {
  NoteDetailIntents,
  NoteDetailState,
  NotesBookIntents,
  NotesBookState,
  NotesIntents,
  NotesState,
} from './types';

export function useNotesVM(): { state: NotesState; intents: NotesIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const [state, setState] = useState<NotesState>({ books: [], loading: true });
  const alive = useRef(true);
  const refresh = useCallback(() => {
    loadNotes(c)
      .then(data => {
        if (alive.current) setState(presentNotes(data));
      })
      .catch(error => {
        if (alive.current)
          setState(s => ({
            ...s,
            loading: false,
            error: toAppError(error).message,
          }));
      });
  }, [c]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  return {
    state,
    intents: {
      retry: refresh,
      openBook: id => nav.open({ name: 'NotesBook', bookId: id }),
    },
  };
}
export function useNotesBookVM(bookId: string): {
  state: NotesBookState;
  intents: NotesBookIntents;
} {
  const c = useContainer(),
    nav = useAppNav();
  const [data, setData] = useState<BookNotesData>();
  const [state, setState] = useState<NotesBookState>({
    title: '书籍笔记',
    chapters: [],
    overlay: null,
    loading: true,
  });
  const alive = useRef(true);
  const refresh = useCallback(() => {
    loadBookNotes(c, bookId)
      .then(value => {
        if (alive.current) {
          setData(value);
          setState(presentNotesBook(value));
        }
      })
      .catch(error => {
        if (alive.current)
          setState(s => ({
            ...s,
            loading: false,
            error: toAppError(error).message,
          }));
      });
  }, [bookId, c]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const setPreference = (format: 'md' | 'anki', strip: boolean) => {
    const preview = exportPreview(state.title, format, data?.cardCount ?? 0);
    setState(s => ({
      ...s,
      overlay: s.overlay ? { ...s.overlay, ...preview, format, strip } : null,
    }));
    saveExportPreferences(c, format, strip).catch(error => {
      if (alive.current)
        setState(s => ({ ...s, error: toAppError(error).message }));
    });
  };
  return {
    state,
    intents: {
      back: nav.back,
      retry: refresh,
      openSection: sectionId =>
        nav.open({ name: 'NoteDetail', bookId, sectionId }),
      closeOverlay: () => setState(s => ({ ...s, overlay: null })),
      openExport: () => {
        loadExportPreferences(c)
          .then(prefs => {
            if (alive.current)
              setState(s => ({
                ...s,
                overlay: {
                  kind: 'export',
                  ...prefs,
                  ...exportPreview(s.title, prefs.format, data?.cardCount ?? 0),
                  stripHint: '高亮只保留前 30 字，方便分享',
                  busy: false,
                },
              }));
          })
          .catch(error =>
            setState(s => ({ ...s, error: toAppError(error).message })),
          );
      },
      setFormat: value => {
        if (value === 'md' || value === 'anki')
          setPreference(value, state.overlay?.strip ?? true);
      },
      setStrip: strip => setPreference(state.overlay?.format ?? 'md', strip),
      exportNow: () =>
        setState(s => ({
          ...s,
          notice: '导出预览已准备好，当前版本暂不支持保存文件。',
        })),
    },
  };
}
export function useNoteDetailVM(
  bookId: string,
  sectionId: string,
): { state: NoteDetailState; intents: NoteDetailIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const [state, setState] = useState<NoteDetailState>({
    title: sectionId,
    subtitle: '笔记',
    canOpenSource: false,
    qa: [],
    detourQa: [],
    stuck: [],
    highlights: [],
    pins: [],
    userText: '',
    loading: true,
    saveStatus: '',
  });
  const alive = useRef(true),
    dirty = useRef(false),
    text = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (!dirty.current) return true;
    const value = text.current;
    if (alive.current) setState(s => ({ ...s, saveStatus: '正在保存…' }));
    try {
      await saveUserNote(c, bookId, sectionId, value);
      if (text.current === value) dirty.current = false;
      if (alive.current)
        setState(s => ({
          ...s,
          saveStatus: dirty.current ? '待保存' : '已保存',
          error: undefined,
        }));
      return true;
    } catch (error) {
      c.log.warn('保存个人笔记失败');
      if (alive.current)
        setState(s => ({
          ...s,
          saveStatus: '保存失败',
          error: toAppError(error).message,
        }));
      return false;
    }
  }, [bookId, c, sectionId]);
  const refresh = useCallback(() => {
    loadNoteDetail(c, bookId, sectionId)
      .then(data => {
        if (alive.current) {
          const next = presentNoteDetail(data, sectionId);
          if (dirty.current) next.userText = text.current;
          else text.current = next.userText;
          setState(next);
        }
      })
      .catch(error => {
        if (alive.current)
          setState(s => ({
            ...s,
            loading: false,
            error: toAppError(error).message,
          }));
      });
  }, [bookId, c, sectionId]);
  useEffect(() => {
    alive.current = true;
    refresh();
    return () => {
      alive.current = false;
      flush();
    };
  }, [refresh, flush]);
  return {
    state,
    intents: {
      back: () => {
        flush().then(saved => {
          if (saved) nav.back();
        });
      },
      retry: () => {
        if (dirty.current) flush();
        else refresh();
      },
      openSource: () => {
        if (state.canOpenSource)
          nav.open({ name: 'Reader', bookId, sectionId });
      },
      openHighlight: blockRef =>
        nav.open({ name: 'Reader', bookId, sectionId, blockRef }),
      setUserText: value => {
        text.current = value;
        dirty.current = true;
        setState(s => ({ ...s, userText: value, saveStatus: '待保存' }));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          flush();
        }, 800);
      },
    },
  };
}
