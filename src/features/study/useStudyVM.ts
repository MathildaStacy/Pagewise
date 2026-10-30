import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseStudyCard } from '@app/study/types';
import { useStore } from 'zustand';
import { useContainer } from '@app/ContainerProvider';
import { resolveStudyBlockImage } from '@app/bookImages';
import { getStudySession } from '@app/study/registry';
import type { SectionDraft, StudySessionApi } from '@app/study/types';
import {
  addStudyStuck,
  loadStudyBlock,
  loadStudyReader,
  loadOriginalReaderWindow,
  loadOriginalReaderInfo,
  saveStudyBlockNote,
  saveStudyPin,
  toggleStudyHighlight,
} from '@app/usecases/studyReader';
import { pageRangeLabel, parseBlockRef } from '@core/ids';
import type { Block, Section } from '@core/types';
import { useAppNav } from '@features/nav';
import {
  blockDoc,
  blockPage,
  messageDoc,
  presentReaderItems,
  presentOriginalPages,
  presentThread,
  quickActions,
  sectionLabel,
  stepPages,
  tableRows,
} from './presenters';
import type {
  BlockMenuKey,
  Rect,
  ReaderScreenState,
  SectionDoneState,
  StudyEntryOptions,
  StudyIntents,
  StudyOverlay,
  StudyState,
} from './types';

function errorText(error: unknown) {
  return error instanceof Error ? error.message : '操作没有完成，请重试';
}
type ReaderData = Awaited<ReturnType<typeof loadStudyReader>>;
const menuKeys: BlockMenuKey[] = [
  'explain',
  'translate',
  'ask',
  'startHere',
  'highlight',
  'note',
];
const menuLabels: Record<BlockMenuKey, string> = {
  explain: '解释',
  translate: '翻译',
  ask: '问 AI',
  startHere: '从这里开始讲',
  highlight: '高亮',
  unhighlight: '取消高亮',
  note: '笔记',
};
function guideText(text: string | null) {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as { one_line?: string; full?: string };
    return {
      oneLine: data.one_line ?? data.full ?? text,
      full: data.full ?? data.one_line ?? text,
    };
  } catch {
    return { oneLine: text.split('\n')[0], full: text };
  }
}
export function useStudyVM(
  bookId: string,
  options: StudyEntryOptions = {},
  standalone = false,
) {
  const c = useContainer(),
    nav = useAppNav();
  const session = useMemo<StudySessionApi>(
    () => getStudySession(c, bookId),
    [c, bookId],
  );
  const raw = useStore(session.store);
  const [text, setText] = useState(''),
    [composerFocusRequest, setComposerFocusRequest] = useState<
      number | undefined
    >(),
    [overlay, setOverlay] = useState<StudyOverlay | null>(null),
    [toast, setToast] = useState<string | null>(null);
  const [loadedReader, setReader] = useState<ReaderData | null>(null),
    [readerError, setReaderError] = useState<string | null>(null),
    [readerLoading, setReaderLoading] = useState(true);
  const [readerTarget, setReaderTarget] = useState<{
    bookId: string;
    blockRef: string;
    sectionId: string;
  } | null>(null);
  const [cache, setCache] = useState<Map<number, Block>>(new Map());
  const [pageImages, setPageImages] = useState<
    Map<number, { uri: string; w: number; h: number }>
  >(new Map());
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [pageError, setPageError] = useState<string>();
  const [pageLoading, setPageLoading] = useState(false);
  const pageRequest = useRef(0),
    readerRequest = useRef(0),
    anchorRef = useRef<number | null>(null);
  const [selection, setSelection] = useState<{
      seq: number;
      anchor: Rect;
    } | null>(null),
    [guideExpanded, setGuideExpanded] = useState(false),
    [guideLoading, setGuideLoading] = useState(false);
  const [stepScrollToken, setStepScrollToken] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set()),
    [history, setHistory] = useState(false),
    [localScroll, setLocalScroll] = useState<
      { ref: string; token: number } | undefined
    >();
  const restoredReader = useRef<string | undefined>(undefined);
  const mounted = useRef(true),
    explainRequest = useRef(0),
    anchorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRefs = useRef(new Set<number>());
  const mode = standalone ? 'read' : raw.mode;
  useEffect(() => {
    if (mode === 'read') setComposerFocusRequest(undefined);
  }, [mode]);
  const blockTarget =
    readerTarget?.bookId === bookId &&
    readerTarget.blockRef === options.blockRef
      ? readerTarget.sectionId
      : null;
  const readerId = standalone
    ? options.blockRef
      ? blockTarget
      : options.sectionId ?? raw.readerSectionId ?? raw.main.sectionId
    : raw.readerSectionId ?? raw.main.sectionId;
  const reader =
    loadedReader?.book.id === bookId && loadedReader.section.id === readerId
      ? loadedReader
      : null;
  useEffect(() => {
    const restoreKey = `${bookId}:${readerId}:${
      standalone ? options.blockRef ?? '' : ''
    }`;
    if (
      mode !== 'read' ||
      !readerId ||
      !reader ||
      reader.section.id !== readerId ||
      restoredReader.current === restoreKey
    )
      return;
    restoredReader.current = restoreKey;
    const anchor =
      standalone && options.blockRef
        ? parseBlockRef(options.blockRef)
        : raw.readAnchor;
    if (anchor !== null && reader.blocks.some(b => b.seq === anchor)) {
      anchorRef.current = anchor;
      setLocalScroll({ ref: `b${anchor}`, token: Date.now() });
    }
  }, [
    bookId,
    standalone,
    options.blockRef,
    mode,
    readerId,
    reader,
    raw.readAnchor,
  ]);
  const fail = useCallback((error: unknown) => {
    if (mounted.current) setToast(errorText(error));
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (anchorTimer.current) clearTimeout(anchorTimer.current);
    };
  }, []);
  const {
    mode: initialMode,
    sectionId,
    blockRef,
    question,
    draftQuestion,
    focusComposer,
    stuckId,
    preserveMain,
    autoStart,
  } = options;
  useEffect(() => {
    let active = true;
    const open = async () => {
      let targetSection = sectionId;
      if (standalone && blockRef) {
        setReaderLoading(true);
        setReaderError(null);
        const seq = parseBlockRef(blockRef);
        if (seq === null) throw new Error('找不到引用的原文');
        const block = await loadStudyBlock(c, bookId, seq);
        if (!active) return;
        if (!block.section_id) throw new Error('这段原文还没有对应的小节');
        targetSection = block.section_id;
        setReaderTarget({ bookId, blockRef, sectionId: targetSection });
      }
      if (!active) return;
      await session.open({
        mode: standalone ? 'read' : initialMode,
        sectionId: targetSection,
        blockRef,
        question: draftQuestion === undefined ? question : undefined,
        stuckId,
        preserveMain: standalone || preserveMain,
        autoStart:
          standalone || draftQuestion !== undefined || focusComposer
            ? false
            : autoStart,
      });
      if (active && !standalone) {
        if (draftQuestion !== undefined) setText(draftQuestion);
        if (draftQuestion !== undefined || focusComposer)
          setComposerFocusRequest(request => (request ?? 0) + 1);
      }
    };
    open().catch(error => {
      if (!active) return;
      if (standalone && blockRef) {
        setReaderError(errorText(error));
        setReaderLoading(false);
      }
      fail(error);
    });
    return () => {
      active = false;
    };
  }, [
    c,
    bookId,
    session,
    standalone,
    initialMode,
    sectionId,
    blockRef,
    question,
    draftQuestion,
    focusComposer,
    stuckId,
    preserveMain,
    autoStart,
    fail,
  ]);
  const refreshReader = useCallback(() => {
    const request = ++readerRequest.current;
    if (!readerId) return;
    setReaderLoading(true);
    loadStudyReader(c, bookId, readerId)
      .then(data => {
        if (mounted.current && request === readerRequest.current) {
          setReader(data);
          setReaderError(null);
          setReaderLoading(false);
        }
      })
      .catch(error => {
        if (mounted.current && request === readerRequest.current) {
          setReaderError(errorText(error));
          setReaderLoading(false);
        }
      });
  }, [c, bookId, readerId]);
  useEffect(() => {
    refreshReader();
    const stops = [
      c.events.subscribe('section.status', refreshReader),
      c.events.subscribe('stuck.changed', refreshReader),
    ];
    return () => stops.forEach(stop => stop());
  }, [c, refreshReader]);
  const blocks = useMemo(
    () =>
      new Map([
        ...cache,
        ...raw.blocks.map(
          b => [b.seq, resolveStudyBlockImage(c, bookId, b)] as const,
        ),
        ...(reader?.originalBlocks ?? reader?.blocks ?? []).map(
          b => [b.seq, b] as const,
        ),
      ]),
    [c, bookId, cache, raw.blocks, reader],
  );
  useEffect(() => {
    const refs = new Set([
      ...raw.messages.flatMap(m => [
        ...(m.allowed_refs ?? []),
        ...(m.quote_seq !== null ? [m.quote_seq] : []),
      ]),
      ...(raw.streaming?.allowedRefs ?? []),
      ...(raw.pendingQuote !== null ? [raw.pendingQuote] : []),
    ]);
    refs.forEach(seq => {
      if (blocks.has(seq) || pendingRefs.current.has(seq)) return;
      pendingRefs.current.add(seq);
      loadStudyBlock(c, bookId, seq)
        .then(block => {
          if (mounted.current) setCache(old => new Map(old).set(seq, block));
        })
        .catch(() => {});
    });
  }, [
    c,
    bookId,
    raw.messages,
    raw.streaming?.allowedRefs,
    raw.pendingQuote,
    blocks,
  ]);
  useEffect(() => {
    const value = toast ?? raw.notice;
    if (!value) return;
    const timer = setTimeout(() => {
      setToast(null);
      session.clearNotice();
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast, raw.notice, session]);
  useEffect(() => {
    if (raw.flashRef !== null) {
      anchorRef.current = raw.flashRef;
      setLocalScroll({ ref: `b${raw.flashRef}`, token: Date.now() });
    }
  }, [raw.flashRef]);
  useEffect(() => {
    if (!localScroll) return;
    const token = localScroll.token;
    const timer = setTimeout(
      () =>
        setLocalScroll(value => (value?.token === token ? undefined : value)),
      2000,
    );
    return () => clearTimeout(timer);
  }, [localScroll]);
  useEffect(() => {
    if (raw.notice === '已在第 2 层岔路，请先回到主线')
      setOverlay({
        kind: 'switchMain',
        body: '已在第 2 层岔路。先回到主线，再继续探索其他小节。',
        rebase: false,
      });
  }, [raw.notice]);
  const highlights = new Set(reader?.highlights.map(h => h.block_seq) ?? []);
  const pins = new Map(
    reader?.pins.map(p => [
      p.block_seq,
      { id: String(p.id), label: p.question },
    ]) ?? [],
  );
  const active = raw.detours[raw.detours.length - 1];
  const activeSection = active
    ? raw.sections.find(s => s.id === active.sectionId)
    : null;
  const readSection = reader?.section;
  const originalAvailable = c.mode !== 'demo' && reader?.book.format === 'pdf';
  const guide = guideText(readSection?.guide ?? null);
  const flashSeq = localScroll
    ? parseBlockRef(localScroll.ref) ?? undefined
    : undefined;
  const itemToScroll =
    raw.scrollToStep === null
      ? undefined
      : raw.messages.find(
          m =>
            m.kind === 'card' &&
            (() => {
              try {
                const card = JSON.parse(m.content) as {
                  kind: string;
                  step: number;
                };
                return (
                  card.kind === 'stepHeader' &&
                  card.step === raw.scrollToStep! + 1
                );
              } catch {
                return false;
              }
            })(),
        );
  const quoteBlock =
    raw.pendingQuote === null ? undefined : blocks.get(raw.pendingQuote);
  const quotePage = blockPage(quoteBlock, raw.book);
  const quoteExcerpt = quoteBlock?.text ?? '原文';
  const readSubtitle = (() => {
    const section =
      mode === 'read' ? readSection : activeSection ?? raw.section;
    if (!section?.page_from) return undefined;
    return pageRangeLabel(
      raw.book ?? { page_offset: 0 },
      section.page_from,
      section.page_to,
    );
  })();
  const state: StudyState = {
    header: {
      title:
        mode === 'read'
          ? sectionLabel(readSection)
          : sectionLabel(activeSection ?? raw.section),
      subtitle: [standalone ? undefined : raw.book?.title, readSubtitle]
        .filter(Boolean)
        .join(' · '),
      readSubtitle,
      backLabel: '地图',
    },
    mode,
    loading: raw.loading,
    toast: toast ?? raw.notice,
    listen: {
      progress: {
        label: `第 ${raw.main.step + 1}/${raw.plan?.steps.length ?? 0} 步${
          raw.parts.length > 1
            ? ` · 第 ${raw.main.part + 1}/${raw.parts.length} 段`
            : ''
        }`,
        steps:
          raw.plan?.steps.map(s => ({ title: s.title, state: s.status })) ?? [],
      },
      detour: active
        ? {
            title: `岔路 · ${sectionLabel(activeSection)}`,
            backLabel: `回到主线 ${raw.section?.no ?? ''}`,
          }
        : null,
      thread: presentThread(raw, blocks, expanded, history),
      scroll: {
        // Streaming growth is followed through content size changes, not per-text tokens.
        toEndToken: raw.messages.length * 2 + (raw.streaming ? 1 : 0),
        toItemId: itemToScroll ? String(itemToScroll.id) : undefined,
        toItemToken: stepScrollToken,
      },
      quickActions: quickActions(raw),
      composer: {
        value: text,
        focusRequest: composerFocusRequest,
        placeholder: active ? '在岔路里继续问，或说「回到主线」' : '不懂就问…',
        canSend: !!text.trim() && !raw.busy && !raw.loading,
        streaming: raw.busy,
        quote:
          raw.pendingQuote !== null
            ? {
                label: `引用 ${quotePage} · ${quoteExcerpt.slice(0, 70)}`,
                page: quotePage,
                excerpt: quoteExcerpt,
              }
            : null,
      },
      busy: raw.busy,
    },
    read: {
      view: raw.readerView,
      hint:
        readSection?.status === 'done'
          ? '已学 · 点段落可解释、提问'
          : readSection?.id === raw.main.sectionId
          ? `讲到第 ${raw.main.step + 1} 步 · 点段落可解释、提问`
          : '点段落可解释、提问',
      loading: readerLoading,
      error: readerError,
      guide: readSection
        ? {
            oneLine: guide?.oneLine ?? '本节导读',
            full: guide?.full,
            expanded: guideExpanded,
            loading: guideLoading,
          }
        : null,
      items: presentReaderItems(
        reader?.blocks ?? [],
        raw.book,
        raw,
        highlights,
        pins,
        selection?.seq,
        flashSeq,
      ),
      original: {
        available: originalAvailable,
        reason:
          c.mode === 'demo'
            ? 'Demo 只有示意原文，真实 PDF 导入后可用原版阅读'
            : reader?.book.format === 'epub'
            ? 'EPUB 只有重排模式'
            : undefined,
        loading: pageLoading,
        error: pageError,
        pages: presentOriginalPages(
          reader?.originalBlocks ?? [],
          raw.book,
          readSection ?? null,
          raw,
          highlights,
          pins,
          pageImages,
          pageSizes,
          selection?.seq,
          flashSeq,
        ),
      },
      scrollTo: localScroll ? { ...localScroll, flash: true } : undefined,
      readEnd: {
        visible: readSection?.id === raw.main.sectionId,
        label: '读完这一节',
        hint: '和听讲一样生成摘要和闪卡草稿',
      },
      selection: selection
        ? {
            ref: `b${selection.seq}`,
            anchor: selection.anchor,
            items: menuKeys.map(key => {
              const actual =
                key === 'highlight' && highlights.has(selection.seq)
                  ? 'unhighlight'
                  : key;
              return { key: actual, label: menuLabels[actual] };
            }),
          }
        : null,
    },
    overlay,
  };
  const run = (promise: Promise<unknown>) => {
    promise.catch(fail);
  };
  const guard = () => {
    if (raw.busy) {
      setToast('正在回答…');
      return false;
    }
    return true;
  };
  const closeOverlay = () => {
    explainRequest.current++;
    setOverlay(null);
    setSelection(null);
  };
  const finish = () => {
    if (!guard()) return;
    session
      .finishDraft()
      .then(draft => {
        if (draft)
          nav.open({
            name: 'SectionDone',
            bookId,
            sectionId: draft.sectionId,
            draftId: draft.id,
          });
      })
      .catch(fail);
  };
  const setMode = (next: 'listen' | 'read') => {
    setSelection(null);
    if (next === 'read')
      anchorRef.current =
        raw.plan?.steps[raw.main.step]?.block_from ?? raw.readAnchor;
    if (next === 'listen' && anchorRef.current !== null) {
      if (anchorTimer.current) clearTimeout(anchorTimer.current);
      session.reportAnchor(anchorRef.current);
    }
    if (standalone && next === 'listen') {
      run(session.setMode('listen'));
      nav.replace({ name: 'Study', bookId });
      return;
    }
    run(session.setMode(next));
  };
  const showPeek = async (seq: number, figure = false) => {
    try {
      const block = blocks.get(seq) ?? (await loadStudyBlock(c, bookId, seq));
      setCache(old => new Map(old).set(seq, block));
      if (figure && block.image_path) {
        setOverlay({
          kind: 'figure',
          uri: block.image_path,
          caption: block.text,
          page: blockPage(block, raw.book),
        });
        return;
      }
      if (block.type === 'table') {
        setOverlay({
          kind: 'table',
          rows: tableRows(block.html, block.text),
          caption: blockPage(block, raw.book),
        });
        return;
      }
      const neighbors = [...blocks.values()]
        .filter(
          b => b.section_id === block.section_id && Math.abs(b.seq - seq) <= 1,
        )
        .sort((a, b) => a.seq - b.seq);
      setOverlay({
        kind: 'peek',
        seq,
        title: `原书 ${blockPage(block, raw.book)}`,
        subtitle: sectionLabel(
          raw.sections.find(s => s.id === block.section_id),
        ),
        blocks: (neighbors.length ? neighbors : [block]).map(b => ({
          ref: `b${b.seq}`,
          doc: blockDoc(b, raw.book),
          target: b.seq === seq,
        })),
        detour: block.section_id !== raw.main.sectionId,
      });
    } catch (error) {
      fail(error);
    }
  };
  const askBlock = (seq: number, start = false) => {
    closeOverlay();
    if (start) {
      run(session.setMode('listen', seq));
      if (standalone) nav.replace({ name: 'Study', bookId });
    } else {
      session.setQuote(seq);
      run(
        session.setMode('listen').then(() => {
          if (!mounted.current) return;
          if (standalone)
            nav.replace({
              name: 'Study',
              bookId,
              mode: 'listen',
              focusComposer: true,
            });
          else setComposerFocusRequest(request => (request ?? 0) + 1);
        }),
      );
    }
  };
  const menuAction = (key: string) => {
    const seq = selection?.seq;
    if (seq === undefined) return;
    const block = blocks.get(seq);
    if (!block) return;
    setSelection(null);
    if (key === 'ask' || key === 'startHere') {
      askBlock(seq, key === 'startHere');
      return;
    }
    if (key === 'highlight' || key === 'unhighlight') {
      toggleStudyHighlight(c, bookId, seq)
        .then(() => {
          setToast(
            key === 'highlight' ? '已高亮，可在笔记里查看' : '已取消高亮',
          );
          refreshReader();
        })
        .catch(fail);
      return;
    }
    if (key === 'note') {
      setOverlay({
        kind: 'note',
        seq,
        quote: blockDoc(block, raw.book),
        value: reader?.highlights.find(h => h.block_seq === seq)?.note ?? '',
        subtitle: blockPage(block, raw.book),
      });
      return;
    }
    if (key !== 'explain' && key !== 'translate') return;
    const request = ++explainRequest.current;
    setOverlay({
      kind: key,
      seq,
      quote: blockDoc(block, raw.book),
      answer: null,
      streaming: true,
      subtitle: `${blockPage(block, raw.book)} · 整理模型`,
    });
    session
      .explainBlock(seq, key)
      .then(answer => {
        if (mounted.current && explainRequest.current === request)
          setOverlay(current =>
            current &&
            (current.kind === 'explain' || current.kind === 'translate')
              ? {
                  ...current,
                  streaming: false,
                  answer: messageDoc(
                    answer,
                    [seq],
                    new Map([[seq, block]]),
                    raw.book,
                    raw.main.sectionId,
                  ),
                }
              : current,
          );
      })
      .catch(error => {
        if (mounted.current && explainRequest.current === request)
          setOverlay(current =>
            current &&
            (current.kind === 'explain' || current.kind === 'translate')
              ? { ...current, streaming: false, error: errorText(error) }
              : current,
          );
      });
  };
  const pressStep = (index: number) => {
    if (!guard()) return;
    const step = raw.plan?.steps[index];
    if (!step) return;
    if (step.status !== 'todo') {
      setStepScrollToken(value => value + 1);
      run(session.jumpStep(index));
      setOverlay(null);
      return;
    }
    setOverlay({
      kind: 'jumpStep',
      index,
      title: `从第 ${index + 1} 步开始讲？`,
      body: `「${step.title}」· ${stepPages(
        step.block_from,
        step.block_to,
        raw.blocks,
        raw.book,
      )}。中间没讲的步骤会留着，随时可以回来讲。`,
    });
  };
  const openContext = () =>
    setOverlay({
      kind: 'context',
      layers: raw.context.map(l => ({
        name: l.name,
        detail: `第 ${l.layer} 层`,
        tokens: formatTokens(l.tokens),
        value: l.tokens,
        cached: l.cached,
      })),
      total: formatTokens(raw.context.reduce((n, l) => n + l.tokens, 0)),
      lastActual: raw.lastUsage
        ? `上一轮实际：输入 ${formatTokens(
            raw.lastUsage.input,
          )} · 缓存读 ${formatTokens(
            raw.lastUsage.cacheRead ?? 0,
          )} · 输出 ${formatTokens(raw.lastUsage.output)}${
            raw.lastUsage.cacheReported ? '' : ' · 该服务没有报告缓存数据'
          }`
        : undefined,
      note: 'AI 只能引用本轮已读取的原文。你问到别的小节时，它会先读取，再回答。预计值与服务返回的实际用量可能不同。',
    });
  const intents: StudyIntents = {
    back: () =>
      standalone ? nav.back() : nav.replace({ name: 'BookMap', bookId }),
    setMode,
    openAdd: () =>
      setOverlay({
        kind: 'menu',
        title: '添加到问题',
        rows: [
          {
            key: 'addRead',
            title: '引用一段原文',
            sub: '切到读书，点一段，选「问 AI」',
          },
          {
            key: 'addStuck',
            title: '从卡点里选',
            sub: '让 AI 结合这个卡点回答',
          },
          {
            key: 'addPhoto',
            title: '拍一张图',
            sub: '手写推导、书页照片（M5）',
          },
        ],
      }),
    openMenu: () =>
      setOverlay({
        kind: 'menu',
        rows: [
          { key: 'map', title: '书的地图', sub: '全书目录、进度和每节状态' },
          { key: 'notes', title: '本节笔记', sub: '摘要、问答、卡点、高亮' },
          { key: 'context', title: 'AI 看到的内容', sub: '本轮上下文和 token' },
          { key: 'finish', title: '结束本节', sub: '生成摘要、卡点和闪卡草稿' },
        ],
      }),
    menuSelect: key => {
      setOverlay(null);
      if (key === 'map') nav.open({ name: 'BookMap', bookId });
      else if (key === 'notes')
        nav.open({
          name: 'NoteDetail',
          bookId,
          sectionId: readSection?.id ?? raw.main.sectionId,
        });
      else if (key === 'context') openContext();
      else if (key === 'addRead') {
        setMode('read');
        setToast('点一段原文，选「问 AI」');
      } else if (key === 'addStuck')
        c.repos.notes.stuck
          .list(bookId, undefined, { resolved: false })
          .then(stuck => {
            if (stuck.length) setText(`结合我的卡点「${stuck[0].text}」讲讲`);
            else setToast('还没有卡点');
          })
          .catch(fail);
      else if (key === 'addPhoto') setToast('拍照提问：M5');
      else if (key === 'finish') finish();
      else if (key === 'switchMain')
        setOverlay({
          kind: 'switchMain',
          body: '将当前岔路设为新的主线？之前的学习进度会保留。',
          rebase: true,
        });
    },
    quick: key => {
      if (!guard()) return;
      if (key === 'nextSection') finish();
      else run(session.act(key as Parameters<typeof session.act>[0]));
    },
    setText,
    send: () => {
      if (!guard() || !text.trim()) return;
      const sent = text;
      setText('');
      session.send(sent).catch(error => {
        fail(error);
        setText(current => current || sent);
      });
    },
    stop: () => session.stop(),
    clearQuote: () => session.setQuote(null),
    pressStep,
    openRoadmap: () =>
      setOverlay({
        kind: 'roadmap',
        title: sectionLabel(raw.section),
        steps:
          raw.plan?.steps.map(s => ({
            title: s.title,
            pages: stepPages(s.block_from, s.block_to, raw.blocks, raw.book),
            state: s.status,
            kindLabel: {
              intuition: '直觉',
              definition: '定义',
              derivation: '推导',
              example: '例子',
              check: '检查',
            }[s.kind],
          })) ?? [],
      }),
    openContext,
    pressCite: seq => {
      run(showPeek(seq));
    },
    pressFigure: seq => {
      run(showPeek(seq, true));
    },
    pressTable: ref => {
      const seq = parseBlockRef(ref);
      if (seq !== null) run(showPeek(seq));
    },
    toggleFold: id =>
      setExpanded(old => {
        const next = new Set(old);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    toggleHistory: () => setHistory(old => !old),
    answerQuiz: (id, index) => {
      if (guard()) run(session.answerQuiz(Number(id), index));
    },
    deferQuiz: id => {
      if (guard()) run(session.deferQuiz?.(Number(id)) ?? Promise.resolve());
    },
    quizHint: id => {
      const message = session.store
        .getState()
        .messages.find(item => item.id === Number(id));
      const quiz = message ? parseStudyCard(message.content) : null;
      if (guard() && quiz?.kind === 'quiz')
        run(
          session.send(
            `关于这道题：${quiz.question}。请只给一个提示，先不要透露正确选项。`,
          ),
        );
    },
    resolveProposal: (id, accept) => {
      if (guard()) run(session.resolveProposal(Number(id), accept));
    },
    resumeAction: key => {
      if (guard() && (key === 'go' || key === 'review'))
        run(session.resume(key));
    },
    retry: () => {
      run(session.retry());
      refreshReader();
    },
    setView: view => {
      setSelection(null);
      if (view === 'orig' && !originalAvailable) {
        setToast(
          c.mode === 'demo'
            ? 'Demo 只有示意原文，真实 PDF 导入后可用原版阅读'
            : 'EPUB 只有重排模式',
        );
        return;
      }
      const anchor = anchorRef.current ?? raw.readAnchor;
      if (anchor !== null) {
        session.reportAnchor(anchor);
        setLocalScroll({ ref: `b${anchor}`, token: Date.now() });
      }
      run(session.setReaderView(view));
    },
    requestPage: (page, width) => {
      if (!originalAvailable) return;
      const revision = ++pageRequest.current;
      setPageLoading(true);
      setPageError(undefined);
      Promise.all([
        loadOriginalReaderInfo(c, bookId),
        loadOriginalReaderWindow(c, bookId, page, width),
      ])
        .then(([info, results]) => {
          if (mounted.current && pageRequest.current === revision) {
            setPageSizes(info?.sizes ?? []);
            setPageImages(new Map(results.map(r => [r.page, r.image])));
          }
        })
        .catch(error => {
          if (mounted.current && pageRequest.current === revision)
            setPageError(errorText(error));
        })
        .finally(() => {
          if (mounted.current && pageRequest.current === revision)
            setPageLoading(false);
        });
    },
    toggleGuide: () => {
      setGuideExpanded(old => !old);
      if (!guide && !guideLoading) {
        setGuideLoading(true);
        session
          .generateGuide()
          .then(() => refreshReader())
          .catch(fail)
          .finally(() => {
            if (mounted.current) setGuideLoading(false);
          });
      }
    },
    pressBlock: (ref, anchor) => {
      const seq = parseBlockRef(ref);
      if (seq !== null && blocks.get(seq)?.type !== 'title')
        setSelection({ seq, anchor });
    },
    menuAction,
    reportAnchor: ref => {
      const seq = parseBlockRef(ref);
      if (seq === null) return;
      anchorRef.current = seq;
      if (anchorTimer.current) clearTimeout(anchorTimer.current);
      anchorTimer.current = setTimeout(() => session.reportAnchor(seq), 500);
    },
    pressPin: id => {
      const pin = reader?.pins.find(p => String(p.id) === id);
      if (pin)
        setOverlay({
          kind: 'pin',
          seq: pin.block_seq,
          title: pin.question,
          answer: messageDoc(
            pin.answer_summary,
            [pin.block_seq],
            blocks,
            raw.book,
            raw.main.sectionId,
          ),
          subtitle: blockPage(blocks.get(pin.block_seq), raw.book),
        });
    },
    finishReading: finish,
    closeOverlay,
    setNoteText: value =>
      setOverlay(old => (old?.kind === 'note' ? { ...old, value } : old)),
    overlayAction: key => {
      const shown = overlay;
      if (!shown) return;
      if (key === 'close') {
        closeOverlay();
        return;
      }
      if (shown.kind === 'jumpStep' && key === 'confirm') {
        setOverlay(null);
        run(session.jumpStep(shown.index));
        return;
      }
      if (shown.kind === 'switchMain' && key === 'confirm') {
        if (!guard()) return;
        setOverlay(null);
        run(session.backMain(shown.rebase ?? true));
        return;
      }
      if (shown.kind === 'peek' && key === 'openInReader') {
        closeOverlay();
        setLocalScroll({ ref: `b${shown.seq}`, token: Date.now() });
        run(session.setMode('read', shown.seq));
        return;
      }
      if (
        (shown.kind === 'explain' ||
          shown.kind === 'translate' ||
          shown.kind === 'pin') &&
        key === 'ask'
      ) {
        askBlock(shown.seq);
        return;
      }
      if (
        (shown.kind === 'explain' || shown.kind === 'translate') &&
        key === 'stuck'
      ) {
        const b = blocks.get(shown.seq);
        if (b)
          run(
            addStudyStuck(
              c,
              bookId,
              b.section_id ?? raw.main.sectionId,
              b.text.slice(0, 160),
            ).then(() => setToast('已记为卡点')),
          );
        return;
      }
      if (
        (shown.kind === 'explain' || shown.kind === 'translate') &&
        key === 'ok'
      ) {
        const b = blocks.get(shown.seq);
        if (!b || !shown.answer) return;
        const answer = docText(shown.answer);
        run(
          saveStudyPin(
            c,
            bookId,
            b.section_id ?? raw.main.sectionId,
            shown.seq,
            `${shown.kind === 'explain' ? '解释' : '翻译'}：${b.text.slice(
              0,
              45,
            )}`,
            answer,
          ).then(() => {
            closeOverlay();
            refreshReader();
            setToast('已贴为问答便签');
          }),
        );
        return;
      }
      if (shown.kind === 'note' && key === 'save') {
        const b = blocks.get(shown.seq);
        if (b)
          run(
            saveStudyBlockNote(
              c,
              bookId,
              b.section_id ?? raw.main.sectionId,
              shown.seq,
              shown.value,
            ).then(() => {
              closeOverlay();
              refreshReader();
              setToast('笔记已保存');
            }),
          );
      }
    },
  };
  return { state, intents };
}
function formatTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function docText(doc: import('@ui/kit').RichDoc): string {
  const inline = (items: import('@ui/kit').RichInline[]): string =>
    items
      .map(i =>
        i.t === 'text'
          ? i.v
          : i.t === 'b'
          ? inline(i.c)
          : i.t === 'math'
          ? `$${i.tex}$`
          : i.t === 'cite'
          ? ` [[b:${i.ref}]]`
          : '（未核验）',
      )
      .join('');
  return doc
    .map(b =>
      b.t === 'p' || b.t === 'check'
        ? inline(b.c)
        : b.t === 'math'
        ? `$$${b.tex}$$`
        : b.t === 'list'
        ? b.items.map(inline).join('\n')
        : b.t === 'aux'
        ? docText(b.body)
        : b.t === 'code'
        ? b.text
        : b.text ?? '',
    )
    .join('\n\n');
}
export function useReaderVM(
  bookId: string,
  sectionId?: string,
  blockRef?: string,
) {
  const vm = useStudyVM(bookId, { sectionId, blockRef }, true);
  const state: ReaderScreenState = {
    header: vm.state.header,
    read: vm.state.read,
    overlay: vm.state.overlay,
    toast: vm.state.toast,
  };
  return { state, intents: vm.intents };
}
export function useSectionDoneVM(
  bookId: string,
  sectionId: string,
  draftId: string,
) {
  const c = useContainer(),
    nav = useAppNav(),
    session = useMemo<StudySessionApi>(
      () => getStudySession(c, bookId),
      [c, bookId],
    );
  const raw = useStore(session.store);
  const [draft, setDraft] = useState<SectionDraft | null>(() =>
      raw.draft?.id === draftId ? raw.draft : null,
    ),
    [loading, setLoading] = useState(!draft),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | undefined>(),
    [toast, setToast] = useState<string | null>(null),
    [editing, setEditing] = useState<SectionDoneState['editing']>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const retry = useCallback(() => {
    setLoading(true);
    session
      .finishDraft()
      .then(value => {
        if (mounted.current) {
          setDraft(value);
          setError(value?.error);
        }
      })
      .catch(e => {
        if (mounted.current) setError(errorText(e));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
  }, [session]);
  useEffect(() => {
    if (!draft) retry();
  }, [draft, retry]);
  const section = raw.sections.find(s => s.id === sectionId) ?? raw.section;
  const state: SectionDoneState = {
    hero: {
      kicker: chapterLabel(raw.sections, section),
      title: `${sectionLabel(section)} · 讲完了`,
      stats: `${raw.plan?.steps.length ?? 0} 步 · 跳过 ${
        raw.plan?.steps.filter(s => s.status === 'skipped').length ?? 0
      } 步 · ${
        raw.messages.filter(m => m.kind === 'user').length
      } 次提问 · 岔路 ${
        new Set(raw.messages.map(m => m.detour_id).filter(id => id !== null))
          .size
      } 次`,
    },
    summary: { value: draft?.summary ?? '', hint: 'AI 起草，可以改' },
    stuck: draft?.stuck ?? [],
    cards: draft?.cards ?? [],
    detours: draft?.detours ?? [],
    next: {
      label: draft?.nextSection
        ? `保存，开始 ${sectionLabel(draft.nextSection)}`
        : '保存',
      hint: draft?.nextSection
        ? `保存后主线进度移到 ${
            draft.nextSection.no ?? draft.nextSection.title
          }`
        : '摘要和勾选的卡点、闪卡会保存到本节',
    },
    loading,
    error: error ?? draft?.error,
    saving,
    toast,
    editing,
  };
  const editCard = (id: string, front: string, back: string) =>
    setDraft(old =>
      old
        ? {
            ...old,
            cards: old.cards.map(card =>
              card.id === id ? { ...card, front, back } : card,
            ),
          }
        : old,
    );
  return {
    state,
    intents: {
      back: () => nav.back(),
      setSummary: (summary: string) =>
        setDraft(old => (old ? { ...old, summary } : old)),
      toggleStuck: (id: string) =>
        setDraft(old =>
          old
            ? {
                ...old,
                stuck: old.stuck.map(s =>
                  s.id === id ? { ...s, checked: !s.checked } : s,
                ),
              }
            : old,
        ),
      toggleCard: (id: string) =>
        setDraft(old =>
          old
            ? {
                ...old,
                cards: old.cards.map(card =>
                  card.id === id ? { ...card, checked: !card.checked } : card,
                ),
              }
            : old,
        ),
      editCard,
      openEditCard: (id: string) => {
        const card = draft?.cards.find(item => item.id === id);
        if (card) setEditing({ id, front: card.front, back: card.back });
      },
      setEditFront: (front: string) =>
        setEditing(old => (old ? { ...old, front } : old)),
      setEditBack: (back: string) =>
        setEditing(old => (old ? { ...old, back } : old)),
      closeEditCard: () => setEditing(null),
      saveEditCard: () => {
        if (editing && editing.front.trim() && editing.back.trim()) {
          editCard(editing.id, editing.front.trim(), editing.back.trim());
          setEditing(null);
        }
      },
      retry,
      save: () => {
        if (saving || !draft) return;
        setSaving(true);
        setError(undefined);
        session
          .saveDraft({
            bookId,
            sectionId,
            summary: draft.summary,
            stuck: draft.stuck,
            cards: draft.cards,
          })
          .then(next => {
            const saveError = session.store.getState().error;
            if (saveError) throw new Error(saveError);
            if (next)
              nav.replace({ name: 'Study', bookId, sectionId: next.id });
            else nav.replace({ name: 'BookMap', bookId });
          })
          .catch(e => {
            if (mounted.current) {
              setError(errorText(e));
              setToast('没有保存，请重试');
            }
          })
          .finally(() => {
            if (mounted.current) setSaving(false);
          });
      },
    },
  };
}

function chapterLabel(
  sections: Section[],
  section: Section | null | undefined,
) {
  let current = section;
  while (current?.parent_id) {
    const parent = sections.find(s => s.id === current?.parent_id);
    if (!parent) break;
    current = parent;
  }
  return sectionLabel(current);
}
