import { useCallback, useEffect, useRef, useState } from 'react';
import { useContainer } from '@app/ContainerProvider';
import {
  confirmMapFlag,
  createDemoImportDraft,
  loadBookMap,
  loadImportDraft,
  loadParseProgress,
  loadSection,
  loadShelf,
  openLibraryBook,
  searchBook,
  splitMapSection,
  startSection,
  type MapRecord,
} from '@app/usecases/library';
import { useAppNav } from '@features/nav';
import {
  bookMeta,
  markSnippet,
  pageRange,
  parsePart,
  presentMap,
  presentShelf,
  sectionName,
} from './presenters';
import type {
  BookMapState,
  ImportSettingsState,
  ParseProgressState,
  ShelfState,
} from './types';

function message(error: unknown) {
  return error instanceof Error ? error.message : '操作没有完成，请重试';
}
export function useShelfVM() {
  const c = useContainer();
  const nav = useAppNav();
  const [state, setState] = useState<ShelfState>({
    loading: true,
    error: null,
    toast: null,
    demo: c.mode === 'demo',
    books: [],
    continueCard: null,
    empty: false,
    overlay: null,
  });
  const mounted = useRef(true);
  const refresh = useCallback(() => {
    loadShelf(c)
      .then(records => {
        if (mounted.current)
          setState(s => ({
            ...s,
            ...presentShelf(records, c.clock.now(), c.mode === 'demo'),
            loading: false,
            error: null,
          }));
      })
      .catch(error => {
        if (mounted.current)
          setState(s => ({ ...s, loading: false, error: message(error) }));
      });
  }, [c]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const stops = [
      c.events.subscribe('book.parse', refresh),
      c.events.subscribe('section.status', refresh),
    ];
    return () => {
      mounted.current = false;
      stops.forEach(stop => stop());
    };
  }, [c, refresh]);
  const fail = (error: unknown) => {
    if (mounted.current) setState(s => ({ ...s, toast: message(error) }));
  };
  const openBook = (id: string) => {
    openLibraryBook(c, id)
      .then(book =>
        nav.open({
          name: ['parsing', 'paused', 'failed', 'importing'].includes(
            book.status,
          )
            ? 'ParseProgress'
            : 'BookMap',
          bookId: id,
        }),
      )
      .catch(fail);
  };
  const pickRecent = (key: string) => {
    createDemoImportDraft(c, key)
      .then(draftId => {
        setState(s => ({ ...s, overlay: null }));
        nav.open({ name: 'ImportSettings', draftId });
      })
      .catch(fail);
  };
  return {
    state,
    intents: {
      refresh,
      openBook,
      openContinue: () => {
        if (state.continueCard)
          nav.open({ name: 'Study', bookId: state.continueCard.bookId });
      },
      openImport: () =>
        setState(s => ({
          ...s,
          toast: null,
          overlay: {
            kind: 'import',
            recent:
              c.mode === 'demo'
                ? s.books.map(b => ({
                    key: b.id,
                    name: b.title,
                    meta: b.meta,
                    format: b.id === 'ddia' ? 'EPUB' : 'PDF',
                  }))
                : [],
            note: '支持 PDF 和 EPUB。也可以在其他 App 里把文件“分享到 Pagewise”。同一本书按文件内容识别，不会重复解析。',
            busy: false,
          },
        })),
      openSearch: () =>
        setState(s => ({
          ...s,
          toast: null,
          overlay: { kind: 'search', query: '', results: s.books },
        })),
      setSearch: (query: string) =>
        setState(s => ({
          ...s,
          overlay:
            s.overlay?.kind === 'search'
              ? {
                  ...s.overlay,
                  query,
                  results: s.books.filter(b =>
                    `${b.title} ${b.meta}`
                      .toLocaleLowerCase()
                      .includes(query.trim().toLocaleLowerCase()),
                  ),
                }
              : s.overlay,
        })),
      closeOverlay: () => setState(s => ({ ...s, overlay: null, toast: null })),
      pickRecent,
      pickOther: () =>
        setState(s => ({
          ...s,
          toast: '系统文件选择将在导入功能中接入。可先使用演示书库体验。',
        })),
    },
  };
}
export function useBookMapVM(bookId: string) {
  const c = useContainer();
  const nav = useAppNav();
  const [record, setRecord] = useState<MapRecord | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [local, setLocal] = useState<
    Pick<BookMapState, 'loading' | 'error' | 'toast' | 'overlay'>
  >({ loading: true, error: null, toast: null, overlay: null });
  const mounted = useRef(true);
  const searchId = useRef(0);
  const fail = (error: unknown) => {
    if (mounted.current)
      setLocal(s => ({ ...s, loading: false, error: message(error) }));
  };
  const refresh = useCallback(() => {
    loadBookMap(c, bookId)
      .then(value => {
        if (mounted.current) {
          setRecord(value);
          setLocal(s => ({ ...s, loading: false, error: null }));
        }
      })
      .catch(error => {
        if (mounted.current)
          setLocal(s => ({ ...s, loading: false, error: message(error) }));
      });
  }, [c, bookId]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const stops = [
      c.events.subscribe('section.status', refresh),
      c.events.subscribe('stuck.changed', refresh),
      c.events.subscribe('book.parse', refresh),
    ];
    return () => {
      mounted.current = false;
      stops.forEach(stop => stop());
    };
  }, [c, refresh]);
  const closeOverlay = () => {
    searchId.current++;
    setLocal(s => ({ ...s, overlay: null }));
  };
  const openSection = (id: string) => {
    loadSection(c, bookId, id)
      .then(value => {
        if (!mounted.current) return;
        const { section, parent, study, qa, stuck, blocks, plan } = value;
        if (section.flag) {
          setLocal(s => ({
            ...s,
            error: null,
            overlay: {
              kind: 'flag',
              id,
              title: `确认 ${section.no ?? section.id} 的标题`,
              body: `${section.title}（${pageRange(section)}）需要核对。${
                section.flag === 'merged'
                  ? '识别结果已将相邻标题合并。可以保持合并；如正文存在第二个标题，也可以拆成两个小节。'
                  : '确认后会保留为手动修正的小节，重新解析时不会覆盖。'
              }`,
              confirm: '确认当前结果',
              cancel: section.flag === 'merged' ? '拆成两个' : '稍后核对',
            },
          }));
          return;
        }
        const current = study?.main_section === id;
        setLocal(s => ({
          ...s,
          error: null,
          overlay: {
            kind: 'section',
            id,
            title: sectionName(section),
            subtitle: parent ? sectionName(parent) : '',
            facts: [
              { k: '页码', v: pageRange(section) },
              {
                k: '状态',
                v:
                  section.status === 'done'
                    ? '已学'
                    : current
                    ? `在学${
                        plan
                          ? ` · 第 ${study.main_step + 1}/${
                              plan.steps.length
                            } 步`
                          : ''
                      }`
                    : '未学',
              },
              { k: '问答', v: `${qa.length} 条` },
            ],
            summary: section.summary ?? undefined,
            stuck: stuck.map(item => item.text),
            actions: [
              ...(blocks.length
                ? [{ key: 'read' as const, label: '看原文' }]
                : []),
              { key: 'notes', label: '看笔记' },
              {
                key: 'start',
                label: current
                  ? '继续讲'
                  : section.status === 'done'
                  ? '再讲一遍'
                  : '从这里开始讲',
                primary: true,
              },
            ],
          },
        }));
      })
      .catch(fail);
  };
  const start = (id: string) => {
    startSection(c, bookId, id)
      .then(() => {
        closeOverlay();
        nav.open({ name: 'Study', bookId, sectionId: id });
      })
      .catch(fail);
  };
  const sectionAction = (key: 'read' | 'notes' | 'start') => {
    if (local.overlay?.kind !== 'section') return;
    const { id } = local.overlay;
    if (key === 'read') {
      closeOverlay();
      nav.open({ name: 'Reader', bookId, sectionId: id });
    } else if (key === 'notes') {
      closeOverlay();
      nav.open({ name: 'NoteDetail', bookId, sectionId: id });
    } else if (
      record?.study?.main_section &&
      record.study.main_section !== id
    ) {
      setLocal(s => ({
        ...s,
        overlay: {
          kind: 'changeMain',
          id,
          title: `从 ${id} 开始学？`,
          body: `当前进度 ${record.study!.main_section} 会保留为在学。`,
          confirm: '从这里开始讲',
          cancel: '取消',
        },
      }));
    } else start(id);
  };
  const state: BookMapState = {
    ...local,
    demo: c.mode === 'demo',
    ...(record
      ? presentMap(record, expanded)
      : {
          title: '书的地图',
          check: { ok: true, text: '正在读取地图', tone: 'muted' as const },
          chapters: [],
        }),
  };
  return {
    state,
    intents: {
      back: nav.back,
      refresh,
      toggle: (id: string) => {
        const section = record?.sections.find(s => s.id === id);
        if (section?.is_leaf) {
          openSection(id);
          return;
        }
        const find = (
          nodes: BookMapState['chapters'][number]['children'],
        ): boolean | undefined => {
          for (const node of nodes) {
            if (node.id === id) return node.expanded;
            const found = find(node.children);
            if (found !== undefined) return found;
          }
          return undefined;
        };
        const current =
          state.chapters.find(ch => ch.id === id)?.expanded ??
          find(state.chapters.flatMap(ch => ch.children)) ??
          false;
        setExpanded(s => ({ ...s, [id]: !current }));
      },
      openSection,
      sectionAction,
      closeOverlay,
      confirmFlag: () => {
        if (local.overlay?.kind !== 'flag') return;
        confirmMapFlag(c, bookId, local.overlay.id)
          .then(() => {
            closeOverlay();
            refresh();
          })
          .catch(fail);
      },
      rejectFlag: () => {
        if (local.overlay?.kind !== 'flag') return;
        const section = record?.sections.find(
          s => s.id === (local.overlay as { id: string }).id,
        );
        if (section?.flag !== 'merged') {
          closeOverlay();
          return;
        }
        splitMapSection(c, bookId, local.overlay.id)
          .then(() => {
            closeOverlay();
            refresh();
          })
          .catch(fail);
      },
      confirmStart: () => {
        if (local.overlay?.kind === 'changeMain') start(local.overlay.id);
      },
      openSearch: () =>
        setLocal(s => ({
          ...s,
          error: null,
          overlay: {
            kind: 'search',
            query: '',
            hint: '在已解析的正文、标题和图注里搜索',
            results: [],
            busy: false,
          },
        })),
      setQuery: (query: string) => {
        const request = ++searchId.current;
        setLocal(s => ({
          ...s,
          overlay:
            s.overlay?.kind === 'search'
              ? { ...s.overlay, query, busy: Boolean(query.trim()) }
              : s.overlay,
        }));
        searchBook(c, bookId, query)
          .then(hits => {
            if (!mounted.current || request !== searchId.current) return;
            setLocal(s => ({
              ...s,
              overlay:
                s.overlay?.kind === 'search'
                  ? {
                      ...s.overlay,
                      busy: false,
                      results: hits.map(hit => ({
                        ref: hit.ref,
                        title:
                          record?.sections.find(
                            section => section.id === hit.section_id,
                          )?.title ?? '正文',
                        snippet: markSnippet(hit.snippet, query),
                        page:
                          hit.page === null
                            ? hit.loc ?? '章节位置'
                            : `p.${hit.page - (record?.book.page_offset ?? 0)}`,
                      })),
                      empty:
                        query.trim() && !hits.length
                          ? '没有找到，试试更短的词'
                          : undefined,
                    }
                  : s.overlay,
            }));
          })
          .catch(error => {
            if (request === searchId.current) fail(error);
          });
      },
      openResult: (blockRef: string) => {
        closeOverlay();
        nav.open({ name: 'Reader', bookId, blockRef });
      },
    },
  };
}
export function useParseProgressVM(bookId: string) {
  const c = useContainer();
  const nav = useAppNav();
  const [state, setState] = useState<ParseProgressState>({
    loading: true,
    error: null,
    toast: null,
    title: '解析进度',
    meta: '',
    cover: null,
    parts: [],
    ready: false,
    footer: '',
    demo: c.mode === 'demo',
  });
  const refresh = useCallback(() => {
    loadParseProgress(c, bookId)
      .then(({ book, parts }) =>
        setState(s => ({
          ...s,
          loading: false,
          error: null,
          title: book.title,
          meta: bookMeta(book),
          cover: { title: book.title, color: book.cover_color },
          parts: parts.map(parsePart),
          ready: book.ready_to_page > 0 || book.status === 'ready',
          footer:
            book.status === 'ready'
              ? '全书已解析完成，地图已就绪'
              : book.ready_to_page
              ? `p.1–${book.ready_to_page} 已就绪，这部分的章节现在就能学。`
              : '每片完成后，那部分的章节就能开始学。',
        })),
      )
      .catch(error =>
        setState(s => ({ ...s, loading: false, error: message(error) })),
      );
  }, [c, bookId]);
  useEffect(() => {
    refresh();
    return c.events.subscribe('book.parse', refresh);
  }, [c, refresh]);
  return {
    state,
    intents: {
      back: nav.back,
      refresh,
      retryPart: (_number: number) =>
        setState(s => ({
          ...s,
          toast:
            c.mode === 'demo'
              ? '这是演示进度。真实解析队列将在导入功能中接入。'
              : '解析队列将在导入功能中接入。',
        })),
      goUpdateToken: () => nav.open({ name: 'MeMineru' }),
      openMap: () => nav.open({ name: 'BookMap', bookId }),
    },
  };
}
export function useImportSettingsVM(draftId: string) {
  const c = useContainer();
  const nav = useAppNav();
  const [existing, setExisting] = useState<string | null>(null);
  const [state, setState] = useState<ImportSettingsState>({
    loading: true,
    error: null,
    toast: null,
    title: '解析设置',
    subtitle: '',
    format: 'PDF',
    facts: [],
    model: 'vlm',
    modelHint: '公式、表格、复杂排版效果更好，速度稍慢。',
    ocr: false,
    priorityFrom: '1',
    parts: '',
    quota: '',
    confirmUpload: true,
    canStart: false,
    overlay: false,
    demo: c.mode === 'demo',
  });
  useEffect(() => {
    let active = true;
    loadImportDraft(c, draftId)
      .then(({ info, mineru }) => {
        if (!active) return;
        const pages = Number(info.pages) || 0;
        const format = info.format === 'epub' ? 'EPUB' : 'PDF';
        setExisting(
          typeof info.existingBookId === 'string' ? info.existingBookId : null,
        );
        setState(s => ({
          ...s,
          loading: false,
          title: String(info.title ?? '导入的书'),
          subtitle: String(info.author ?? ''),
          format,
          facts: [
            {
              label: pages ? '页数' : '章节',
              value: pages ? String(pages) : '本地解析后确定',
            },
            {
              label: '大小',
              value: `${(Number(info.size_bytes ?? 0) / 1024 / 1024).toFixed(
                1,
              )} MB`,
            },
            {
              label: '文字层',
              value: info.has_text_layer ? '有' : '没有 · 扫描版',
            },
            {
              label: '书签目录',
              value: info.has_outline ? '有 · 用来核对地图' : '没有',
            },
          ],
          ocr: !info.has_text_layer,
          parts: pages
            ? Array.from(
                { length: Math.ceil(pages / 200) },
                (_, i) => `p.${i * 200 + 1}–${Math.min((i + 1) * 200, pages)}`,
              ).join('、')
            : 'EPUB 在本机解析',
          quota: `${
            mineru.usedToday?.date === c.clock.today()
              ? mineru.usedToday.pages
              : 0
          } → ${
            (mineru.usedToday?.date === c.clock.today()
              ? mineru.usedToday.pages
              : 0) + pages
          } / 1000`,
          confirmUpload: mineru.confirmUpload ?? true,
          canStart: true,
        }));
      })
      .catch(error => {
        if (active)
          setState(s => ({ ...s, loading: false, error: message(error) }));
      });
    return () => {
      active = false;
    };
  }, [c, draftId]);
  const confirm = () => {
    setState(s => ({ ...s, overlay: false }));
    if (existing) {
      setState(s => ({ ...s, toast: '这本书已经在书架上了' }));
      nav.replace({ name: 'BookMap', bookId: existing });
    } else
      setState(s => ({
        ...s,
        toast: '文件上传与解析队列将在导入功能中接入。',
      }));
  };
  return {
    state,
    intents: {
      back: nav.back,
      setModel: (model: string) => {
        if (model === 'vlm' || model === 'pipeline')
          setState(s => ({
            ...s,
            model,
            modelHint:
              model === 'vlm'
                ? '公式、表格、复杂排版效果更好，速度稍慢。'
                : '速度更快；公式密集的书效果会差一些。',
          }));
      },
      setOcr: (ocr: boolean) => setState(s => ({ ...s, ocr })),
      setPriorityFrom: (priorityFrom: string) =>
        setState(s => ({ ...s, priorityFrom })),
      start: () => {
        if (
          !/^\d+$/.test(state.priorityFrom) ||
          Number(state.priorityFrom) < 1
        ) {
          setState(s => ({ ...s, error: '开始页码需要是大于 0 的整数' }));
          return;
        }
        if (state.format === 'PDF' && state.confirmUpload)
          setState(s => ({ ...s, overlay: true, error: null }));
        else confirm();
      },
      confirm,
      closeOverlay: () => setState(s => ({ ...s, overlay: false })),
    },
  };
}
