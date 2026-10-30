import { useCallback, useEffect, useRef, useState } from 'react';
import { useContainer } from '@app/ContainerProvider';
import {
  applyRefinement,
  generateRefinement,
  loadRefinement,
  undoRefinement,
  supportsRefinementImages,
  hasRefinementOriginal,
} from '@app/usecases/refinement';
import {
  loadAiOptions,
  normalizeAiOptions,
  presentAiOptions,
} from '@app/usecases/aiOptions';
import { pageLabel } from '@core/ids';
import type { RefinementRun } from '@core/refinement';
import type { ConversationConfig } from '@features/settings/types';
import type { RefinementState } from './types';
import { presentRefinementContent } from './presenters';

export function useRefinementVM(
  bookId: string,
  sectionId: string | null | undefined,
) {
  const c = useContainer();
  const [visible, setVisible] = useState(false),
    [run, setRun] = useState<RefinementRun>();
  const [applied, setApplied] = useState<RefinementRun>();
  const [mode, setMode] = useState<'structure' | 'vision'>('structure');
  const [activity, setActivity] = useState<RefinementState['activity']>(null),
    [error, setError] = useState<string>();
  const [selected, setSelected] = useState<number[]>([]);
  const selectionRun = useRef<number | undefined>(undefined);
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAiOptions>>>({
    providers: [],
    config: null,
  });
  const [pdf, setPdf] = useState(false),
    [offset, setOffset] = useState(0),
    [scope, setScope] = useState('');
  const controller = useRef<AbortController | null>(null),
    revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    revision.current++;
    controller.current?.abort();
    controller.current = null;
    setVisible(false);
    setRun(undefined);
    setApplied(undefined);
    setActivity(null);
    setError(undefined);
    selectionRun.current = undefined;
    setSelected([]);
  }, [bookId, sectionId]);
  const showError = (cause: unknown) => {
    if (mounted.current)
      setError(cause instanceof Error ? cause.message : '精修失败，请重试');
  };
  const open = useCallback(async () => {
    if (!sectionId) return;
    if (controller.current) {
      setVisible(true);
      return;
    }
    const token = ++revision.current;
    setVisible(true);
    setError(undefined);
    setActivity('loading');
    try {
      const [value, currentApplied, models, book, section, hasOriginal] =
        await Promise.all([
          loadRefinement(c, bookId, sectionId),
          c.repos.refinements.applied(bookId, sectionId),
          loadAiOptions(c, 'tidy'),
          c.repos.books.get(bookId),
          c.repos.sections.get(bookId, sectionId),
          hasRefinementOriginal(c, bookId),
        ]);
      if (!mounted.current || token !== revision.current) return;
      setRun(value);
      setApplied(currentApplied);
      if (selectionRun.current !== value?.id) {
        selectionRun.current = value?.id;
        setSelected(value?.document.selected ?? []);
      }
      setMode(value?.mode ?? 'structure');
      setData({
        ...models,
        config: value?.config
          ? (value.config as ConversationConfig)
          : models.config,
      });
      setPdf(hasOriginal);
      setOffset(book?.page_offset ?? 0);
      setScope([section?.no, section?.title].filter(Boolean).join(' '));
    } catch (cause) {
      if (token === revision.current) showError(cause);
    } finally {
      if (mounted.current && token === revision.current) setActivity(null);
    }
  }, [c, bookId, sectionId]);
  const config = presentAiOptions(data.providers, data.config).config;
  const canVision = pdf && supportsRefinementImages(data.providers, config);
  const busy = activity !== null;
  const canResume =
    !!run &&
    ['paused', 'failed'].includes(run.status) &&
    run.mode === mode &&
    run.config?.providerId === config?.providerId &&
    run.config?.model === config?.model &&
    run.config?.effort === config?.effort;
  const start = (resume: boolean) => {
    if (!sectionId || busy || !config || (mode === 'vision' && !canVision))
      return;
    const token = ++revision.current;
    const control = new AbortController();
    controller.current = control;
    setActivity('generate');
    setError(undefined);
    generateRefinement(c, bookId, sectionId, {
      mode,
      config,
      resume,
      signal: control.signal,
      onProgress: value => {
        if (mounted.current && token === revision.current) setRun(value);
      },
    })
      .then(value => {
        if (mounted.current && token === revision.current) {
          setRun(value);
          selectionRun.current = value.id;
          setSelected(value.document.selected);
        }
      })
      .catch(cause => {
        if (token === revision.current) showError(cause);
      })
      .finally(() => {
        if (controller.current === control) controller.current = null;
        if (mounted.current && token === revision.current) setActivity(null);
      });
  };
  const mutate = async (action: 'apply' | 'undo') => {
    const target = action === 'undo' ? applied : run;
    if (!target || busy) return;
    const token = ++revision.current;
    setActivity('save');
    setError(undefined);
    try {
      const value =
        action === 'apply'
          ? await applyRefinement(c, target.id, selected)
          : await undoRefinement(c, target.id);
      if (!mounted.current || token !== revision.current) return;
      setApplied(action === 'apply' ? value : undefined);
      if (value.id === run?.id) setRun(value);
    } catch (cause) {
      if (token === revision.current) showError(cause);
    } finally {
      if (mounted.current && token === revision.current) setActivity(null);
    }
  };
  const location = (seq: number) => {
    const source = run?.document.source.find(b => b.seq === seq);
    return source?.page == null
      ? source?.loc ?? `段落 ${seq}`
      : pageLabel({ page_offset: offset }, source.page);
  };
  const state: RefinementState | undefined = !visible
    ? undefined
    : {
        busy,
        activity,
        scope,
        canResume,
        hasPreviousApplied: !!applied && applied.id !== run?.id,
        error: error ?? run?.error ?? undefined,
        mode,
        canVision,
        aiOptions: {
          ...presentAiOptions(data.providers, config),
          search: { ok: false, reason: '精修只依据原书，不使用联网搜索' },
        },
        status: run?.status ?? 'idle',
        completed: run?.completed ?? 0,
        total: run?.document.chunks.length ?? 0,
        tokens: run
          ? `${run.input_tokens.toLocaleString()} 输入 / ${run.output_tokens.toLocaleString()} 输出 tokens`
          : undefined,
        edits: (run?.document.edits ?? []).map(e => {
          const source = run!.document.source.find(b => b.seq === e.seq)!;
          return {
            seq: e.seq,
            location: location(e.seq),
            before: presentRefinementContent(source),
            after: presentRefinementContent(e),
            reason: [
              e.reason,
              e.type === 'title' ? `标题层级 ${e.level}` : null,
              e.continuesFrom != null ? '接续上一段，保留原页定位' : null,
            ]
              .filter(Boolean)
              .join(' · '),
            selected: selected.includes(e.seq),
          };
        }),
        issues:
          run?.document.issues.map(i => ({
            seq: i.seq,
            location: location(i.seq),
            reason: i.reason,
          })) ?? [],
      };
  return {
    state,
    open: () => {
      open().catch(showError);
    },
    action(action: string) {
      if (action === 'close') {
        controller.current?.abort();
        setVisible(false);
      } else if (action === 'stop') controller.current?.abort();
      else if (action === 'start') start(false);
      else if (action === 'resume' && canResume) start(true);
      else if (action === 'apply' || action === 'undo')
        mutate(action).catch(showError);
    },
    setMode: (value: 'structure' | 'vision') => {
      if (!busy) setMode(value);
    },
    toggle(seq: number) {
      if (!busy)
        setSelected(old =>
          old.includes(seq) ? old.filter(n => n !== seq) : [...old, seq],
        );
    },
    setOptions(patch: Partial<ConversationConfig>) {
      if (!busy && data.config)
        setData(old => ({
          ...old,
          config: normalizeAiOptions(
            { ...data.config!, ...patch, search: false },
            old.providers,
          ),
        }));
    },
  };
}
