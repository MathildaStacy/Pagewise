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
  confirmImportDraft,
  describeImportParts,
  importPriorityPages,
  importCoverColor,
  listImportDrafts,
  pickImportDraft,
  type ImportSelection,
} from '@app/usecases/importBooks';
import { getParseQueue } from '@app/usecases/parseQueue';
import {
  loadEpubImportError,
  loadParseWarnings,
} from '@app/usecases/importResults';
import {
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
    if (c.mode !== 'demo') {
      setState(s => ({ ...s, overlay: null }));
      nav.open({ name: 'ImportSettings', draftId: key });
      return;
    }
    createDemoImportDraft(c, key)
      .then(draftId => {
        setState(s => ({ ...s, overlay: null }));
        nav.open({ name: 'ImportSettings', draftId });
      })
      .catch(fail);
  };
  const selected = (result: ImportSelection | null) => {
    if (!result) return;
    setState(s => ({
      ...s,
      overlay: null,
      toast:
        result.kind === 'duplicate'
          ? result.restored
            ? '原文件已补回，学习记录已保留'
            : '这本书已经在书架上了'
          : null,
    }));
    if (result.kind === 'duplicate') openBook(result.bookId);
    else nav.open({ name: 'ImportSettings', draftId: result.draftId });
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
      openImport: () => {
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
        }));
        if (c.mode !== 'demo')
          listImportDrafts(c)
            .then(recent =>
              setState(s => ({
                ...s,
                overlay:
                  s.overlay?.kind === 'import'
                    ? { ...s.overlay, recent }
                    : s.overlay,
              })),
            )
            .catch(fail);
      },
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
      pickOther: () => {
        if (c.mode === 'demo') {
          setState(s => ({
            ...s,
            toast: '当前是演示书库，请切换到我的书库后导入文件',
          }));
          return;
        }
        if (state.overlay?.kind === 'import' && state.overlay.busy) return;
        setState(s => ({
          ...s,
          overlay:
            s.overlay?.kind === 'import'
              ? { ...s.overlay, busy: true }
              : s.overlay,
        }));
        pickImportDraft(c)
          .then(selected)
          .catch(fail)
          .finally(() =>
            setState(s => ({
              ...s,
              overlay:
                s.overlay?.kind === 'import'
                  ? { ...s.overlay, busy: false }
                  : s.overlay,
            })),
          );
      },
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
        const { section, parent, study, qa, stuck, blocks, plan, userText } =
          value;
        if (section.flag) {
          setLocal(s => ({
            ...s,
            error: null,
            overlay: {
              kind: 'flag',
              id,
              title: `确认 ${section.no ?? section.id} 的标题`,
              body: `${section.title}（${pageRange(
                section,
                record?.book,
              )}）需要核对。${
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
              { k: '页码', v: pageRange(section, record?.book) },
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
              ...(qa.length ? [{ k: '问答', v: `${qa.length} 条` }] : []),
            ],
            summary: section.summary ?? undefined,
            stuck: stuck.map(item => item.text),
            actions: [
              ...(blocks.length
                ? [{ key: 'read' as const, label: '看原文' }]
                : []),
              ...(qa.length || section.summary || userText?.user_text
                ? [{ key: 'notes' as const, label: '看笔记' }]
                : []),
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
                        title: (() => {
                          const foundSection = record?.sections.find(
                            section => section.id === hit.section_id,
                          );
                          return foundSection
                            ? sectionName(foundSection)
                            : '正文';
                        })(),
                        snippet: markSnippet(hit.snippet, query),
                        page:
                          hit.page === null
                            ? hit.loc ?? '章节位置'
                            : pageRange(
                                { page_from: hit.page, page_to: hit.page },
                                record?.book,
                              ),
                      })),
                      empty:
                        query.trim() && !hits.length
                          ? `没有找到「${query.trim()}」`
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
    Promise.all([
      loadParseProgress(c, bookId),
      loadParseWarnings(c, bookId),
      loadEpubImportError(c, bookId),
    ])
      .then(([{ book, parts }, warnings, epubError]) =>
        setState(s => ({
          ...s,
          loading: false,
          error:
            book.format === 'epub' && book.status === 'failed'
              ? epubError ?? 'EPUB 没能完成解析，请检查文件后重试'
              : null,
          title: book.title,
          meta:
            book.format === 'pdf'
              ? [
                  book.pages ? `${book.pages} 页` : null,
                  'MinerU',
                  book.parse_model,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'EPUB · 本机解析',
          cover: { title: book.title, color: book.cover_color },
          parts: parts.map(part => ({
            ...parsePart(part),
            warning: warnings[String(part.part_no)],
          })),
          ready:
            parts.some(p => p.stage === 'done') ||
            book.ready_to_page > 0 ||
            book.status === 'ready',
          footer:
            book.status === 'ready'
              ? book.format === 'pdf' && book.has_outline
                ? '全书已解析完成，书的地图已和书签核对。'
                : '全书已解析完成，书的地图已就绪。'
              : book.format === 'epub'
              ? '正在本机解析 EPUB，完成后即可学习。'
              : book.ready_to_page
              ? `p.1–${book.ready_to_page} 已就绪，这部分的章节现在就能学。`
              : '解析在后台进行，可以离开这个页面。每片完成后，那部分的章节就能开始学。',
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
      retryPart: (number: number, ocr = false) => {
        if (c.mode === 'demo') {
          setState(s => ({
            ...s,
            toast: '这是演示进度，不会上传文件或消耗额度',
          }));
          return;
        }
        getParseQueue(c)
          .retry(bookId, number, { ocr })
          .then(refresh)
          .catch(error => setState(s => ({ ...s, toast: message(error) })));
      },
      goUpdateToken: () => nav.open({ name: 'MeMineru' }),
      retryBook: () =>
        getParseQueue(c)
          .retry(bookId, 0)
          .then(refresh)
          .catch(error => setState(s => ({ ...s, toast: message(error) }))),
      openMap: () => nav.open({ name: 'BookMap', bookId }),
    },
  };
}
export function useImportSettingsVM(draftId: string) {
  const c = useContainer();
  const nav = useAppNav();
  const [existing, setExisting] = useState<string | null>(null);
  const draftMeta = useRef({ pages: 0, size: 0 });
  const submitting = useRef(false);
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
        draftMeta.current = { pages, size: Number(info.size_bytes ?? 0) };
        const format = info.format === 'epub' ? 'EPUB' : 'PDF';
        setExisting(
          typeof info.existingBookId === 'string' ? info.existingBookId : null,
        );
        setState(s => ({
          ...s,
          loading: false,
          title: String(info.title ?? '导入的书'),
          subtitle: String(info.author ?? ''),
          fileName: typeof info.name === 'string' ? info.name : undefined,
          cover: {
            title: String(info.title ?? '导入的书'),
            color: importCoverColor(String(info.title ?? '导入的书')),
          },
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
            ...(format === 'PDF'
              ? [
                  {
                    label: '文字层',
                    value: info.has_text_layer ? '有' : '没有 · 扫描版',
                  },
                  {
                    label: '书签目录',
                    value: info.has_outline ? '有 · 用来核对地图' : '没有',
                  },
                ]
              : [
                  {
                    label: '目录',
                    value: info.has_outline ? '有' : '解析后确定',
                  },
                  { label: '解析位置', value: '本机' },
                ]),
          ],
          ocr: !info.has_text_layer,
          parts: pages
            ? describeImportParts(pages, Number(info.size_bytes), 1)
            : 'EPUB 在本机解析',
          quota: `${
            mineru.usedToday?.date === c.clock.today()
              ? mineru.usedToday.pages
              : 0
          } → ${
            (mineru.usedToday?.date === c.clock.today()
              ? mineru.usedToday.pages
              : 0) + pages
          } / ${importPriorityPages}`,
          overQuota:
            (mineru.usedToday?.date === c.clock.today()
              ? mineru.usedToday.pages
              : 0) +
              pages >
            importPriorityPages,
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
    if (submitting.current || !state.canStart) return;
    setState(s => ({ ...s, overlay: false }));
    if (existing) {
      setState(s => ({ ...s, toast: '这本书已经在书架上了' }));
      nav.replace({ name: 'BookMap', bookId: existing });
    } else {
      submitting.current = true;
      setState(s => ({ ...s, canStart: false, error: null }));
      confirmImportDraft(c, draftId, {
        model: state.model,
        ocr: state.ocr,
        priorityFrom: Number(state.priorityFrom),
      })
        .then(bookId => nav.replace({ name: 'ParseProgress', bookId }))
        .catch(error =>
          setState(s => ({ ...s, error: message(error), canStart: true })),
        )
        .finally(() => {
          submitting.current = false;
        });
    }
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
        setState(s => {
          const { pages, size } = draftMeta.current,
            value = Number(priorityFrom);
          return {
            ...s,
            priorityFrom,
            parts:
              Number.isInteger(value) && value >= 1 && value <= pages
                ? describeImportParts(pages, size, value)
                : s.parts,
          };
        }),
      start: () => {
        if (
          !/^\d+$/.test(state.priorityFrom) ||
          Number(state.priorityFrom) < 1 ||
          (state.format === 'PDF' &&
            Number(state.priorityFrom) > draftMeta.current.pages)
        ) {
          setState(s => ({
            ...s,
            error: `开始页码需要是大于 0 且不超过 ${draftMeta.current.pages} 的整数`,
          }));
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
