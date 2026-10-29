import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { useContainer } from '@app/ContainerProvider';
import { toAppError } from '@app/errors';
import {
  defaultPrefs,
  SettingsInputError,
  readSettingsOverview,
  readMineru,
  patchMineru,
  readAI,
  assignModel,
  readServiceEditor,
  fetchServiceModels,
  testServiceConnection,
  serviceModelIds,
  saveService,
  deleteService,
  readPrefs,
  patchPrefs,
  shareLogs,
  type ServiceForm,
  type TeachPrefs,
  type MineruSettings,
  type ServiceCatalog,
} from '@app/usecases/settings';
import { useAppNav } from '@features/nav';
import { loadHome } from '@app/usecases/home';
import {
  loadStorage,
  clearParseCache,
  exportBackup,
  restoreBackup,
  BackupError,
} from '@app/usecases/storage';
import { getParseQueue } from '@app/usecases/parseQueue';
import { ImportInputError, reparseBook } from '@app/usecases/importBooks';
import type {
  MeState,
  MeIntents,
  MineruState,
  MineruIntents,
  AIState,
  AIIntents,
  AIEditState,
  AIEditIntents,
  PrefsState,
  PrefsIntents,
  StorageState,
  StorageIntents,
  AboutState,
  AboutIntents,
  SettingStatus,
} from './types';
import {
  formatBytes,
  modelKey,
  protocolLabel,
  tokenExpiry,
  tokens,
} from './presenters';
import { version } from '../../../package.json';

function useStatus() {
  const [status, setStatus] = useState<SettingStatus>({
    loading: true,
    saving: false,
  });
  const alive = useRef(true);
  const revision = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback((task: () => Promise<void>, saving = false) => {
    const current = ++revision.current;
    setStatus(s => ({ ...s, saving, error: undefined, notice: undefined }));
    task()
      .then(() => {
        if (alive.current && revision.current === current)
          setStatus(s => ({ ...s, loading: false, saving: false }));
      })
      .catch(error => {
        if (alive.current && revision.current === current)
          setStatus(s => ({
            ...s,
            loading: false,
            saving: false,
            error:
              error instanceof SettingsInputError ||
              error instanceof BackupError ||
              error instanceof ImportInputError
                ? error.message
                : toAppError(error).message,
          }));
      });
  }, []);
  const notice = (value: string) => setStatus(s => ({ ...s, notice: value }));
  return { status, run, notice };
}
export function useMeVM(): { state: MeState; intents: MeIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const appearance = useStore(c.appearance.store);
  const { status, run } = useStatus();
  const [groups, setGroups] = useState<MeState['groups']>([]);
  const [overview, setOverview] = useState<MeState['overview']>();
  const refresh = useCallback(
    () =>
      run(async () => {
        const data = await readSettingsOverview(c);
        if (appearance.skin === 'win11') {
          const home = await loadHome(c);
          setOverview({
            storage:
              c.mode === 'demo'
                ? '612 MB'
                : formatBytes(
                    data.books.reduce((sum, b) => sum + b.size_bytes, 0),
                  ),
            intuition: data.prefs.intuitionFirst,
            quiz: data.prefs.quizAtEnd,
            streak: home.stats.streak,
            goal: home.goal,
          });
        }
        const expiry = tokenExpiry(data.mineru.tokenExpiresOn, data.today);
        const used =
          data.mineru.usedToday.date === data.today
            ? data.mineru.usedToday.pages
            : 0;
        setGroups([
          [
            {
              key: 'MeMineru',
              title: '解析服务',
              subtitle:
                'MinerU 官方 API · 今日 ' +
                used +
                '/1000 页 · ' +
                (data.mineru.tokenTail ? expiry.label : '未配置 Token'),
              tone: expiry.expired ? 'bad' : expiry.warn ? 'stuck' : 'neutral',
            },
            {
              key: 'MeAI',
              title: 'AI 服务',
              subtitle:
                data.providers.length +
                ' 个服务 · ' +
                (data.assign.teach
                  ? '讲解用 ' + data.assign.teach.model
                  : '还没有配置讲解模型'),
              tone: 'neutral',
            },
            {
              key: 'MePrefs',
              title: '讲解偏好',
              subtitle:
                (data.prefs.intuitionFirst ? '先直觉后公式' : '先定义后直觉') +
                ' · 每段' +
                data.prefs.length +
                ' · ' +
                (data.prefs.bilingual ? '术语中英对照' : '只用中文术语'),
              tone: 'neutral',
            },
          ],
          [
            {
              key: 'MeAppearance',
              title: '外观',
              subtitle: '',
              tone: 'neutral',
            },
            {
              key: 'MeStorage',
              title: '存储与备份',
              subtitle:
                data.books.length +
                ' 本书 · 原文件 ' +
                formatBytes(
                  data.books.reduce((sum, b) => sum + b.size_bytes, 0),
                ),
              tone: 'neutral',
            },
            {
              key: 'About',
              title: '关于 Pagewise',
              subtitle: `版本 ${version} · GPL-3.0`,
              tone: 'neutral',
            },
          ],
        ]);
      }),
    [c, run, appearance.skin],
  );
  useEffect(refresh, [refresh]);
  return {
    state: {
      ...status,
      overview,
      groups: groups.map(group =>
        group
          .map(row =>
            row.key === 'MeAppearance'
              ? {
                  ...row,
                  subtitle: `${
                    {
                      paper: '纸感',
                      glass: '苹果风',
                      meta: 'Meta 风',
                      google: '新谷歌风',
                      win11: 'Win11 风',
                    }[appearance.skin]
                  } · ${
                    { system: '跟随系统', light: '浅色', dark: '深色' }[
                      appearance.scheme
                    ]
                  } · 正文${
                    { s: '小', m: '中', l: '大' }[appearance.readingSize]
                  }`,
                }
              : row,
          )
          .flatMap(row =>
            appearance.skin === 'win11' && row.key === 'MePrefs'
              ? [
                  row,
                  {
                    key: 'LearningStats',
                    title: '学习记录',
                    subtitle: `连续 ${overview?.streak ?? 0} 天 · 每日目标 ${
                      overview?.goal ?? 20
                    } 分钟`,
                    tone: 'neutral' as const,
                  },
                ]
              : appearance.skin === 'win11' && row.key === 'About'
              ? [
                  {
                    key: 'Welcome',
                    title: '新手引导',
                    subtitle: '重新走一遍首次启动的三步',
                    tone: 'neutral' as const,
                  },
                  row,
                ]
              : [row],
          ),
      ),
    },
    intents: {
      refresh,
      quick: key =>
        run(async () => {
          if (key === 'dark')
            await c.appearance.update({
              scheme: appearance.scheme === 'dark' ? 'light' : 'dark',
            });
          else {
            const field = key === 'intuition' ? 'intuitionFirst' : 'quizAtEnd';
            const prefs = await readPrefs(c);
            const next = await patchPrefs(c, { [field]: !prefs[field] });
            setOverview(value =>
              value
                ? {
                    ...value,
                    intuition: next.intuitionFirst,
                    quiz: next.quizAtEnd,
                  }
                : value,
            );
          }
        }),
      open: key => {
        if (
          key === 'MeMineru' ||
          key === 'MeAI' ||
          key === 'MePrefs' ||
          key === 'MeAppearance' ||
          key === 'MeStorage' ||
          key === 'About' ||
          key === 'LearningStats' ||
          key === 'Welcome'
        )
          nav.open({ name: key });
      },
    },
  };
}
export function useMineruVM(): { state: MineruState; intents: MineruIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const { status, run, notice } = useStatus();
  const [data, setData] = useState<MineruSettings>({
    model: 'vlm' as 'vlm' | 'pipeline',
    confirmUpload: true,
    tokenTail: '',
    tokenExpiresOn: undefined as string | undefined,
    usedToday: { date: c.clock.today(), pages: 0 },
  });
  const [token, setToken] = useState(''),
    [expiresOn, setExpiresOn] = useState('');
  const refresh = useCallback(
    () =>
      run(async () => {
        const value = await readMineru(c);
        setData(value);
        setExpiresOn(value.tokenExpiresOn ?? '');
      }),
    [c, run],
  );
  useEffect(refresh, [refresh]);
  const expiry = tokenExpiry(data.tokenExpiresOn, c.clock.today());
  const pages =
    data.usedToday.date === c.clock.today() ? data.usedToday.pages : 0;
  const patch = (value: Partial<typeof data>) =>
    run(async () => {
      setData(await patchMineru(c, value));
    }, true);
  return {
    state: {
      ...status,
      token,
      expiresOn,
      tokenLabel: data.tokenTail
        ? '已保存 · 末 4 位 ' + data.tokenTail
        : '尚未配置 Token',
      expiresHint: expiry.label,
      expired: expiry.expired,
      model: data.model,
      confirmUpload: data.confirmUpload,
      quotaLabel: pages + '/1000 页',
      quotaRatio: Math.min(1, pages / 1000),
    },
    intents: {
      back: nav.back,
      refresh,
      setToken,
      setExpiresOn,
      setModel: value => {
        if (value === 'vlm' || value === 'pipeline') patch({ model: value });
      },
      setConfirmUpload: confirmUpload => patch({ confirmUpload }),
      saveToken: () =>
        run(async () => {
          setData(
            await patchMineru(
              c,
              { tokenExpiresOn: expiresOn || undefined },
              token,
            ),
          );
          setToken('');
          notice('Token 与有效期已保存');
          await getParseQueue(c)
            .resume()
            .catch(() => c.log.warn('解析队列将在下次打开时继续'));
        }, true),
      testConnection: () =>
        notice('连接测试将在解析服务接入后启用；当前设置已可保存'),
    },
  };
}
export function useAIVM(): { state: AIState; intents: AIIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const { status, run } = useStatus();
  const [data, setData] = useState<Omit<AIState, keyof SettingStatus>>({
    providers: [],
    options: [],
    teach: '',
    tidy: '',
    usage: [],
    month: '本月合计 0 tokens',
  });
  const refresh = useCallback(
    () =>
      run(async () => {
        const value = await readAI(c);
        const assignment = (purpose: 'teach' | 'tidy') =>
          value.assign[purpose]
            ? modelKey(
                value.assign[purpose]!.providerId,
                value.assign[purpose]!.model,
              )
            : '';
        setData({
          demo: value.demo,
          providers: value.providers.map(p => ({
            id: p.id,
            name: p.name,
            meta:
              protocolLabel(p.protocol) +
              ' · ' +
              p.baseUrl.replace(/^https:\/\//, ''),
          })),
          options: value.providers.flatMap(p =>
            p.models
              .filter(m => m.enabled)
              .map(m => ({
                key: modelKey(p.id, m.id),
                label: p.name + ' · ' + m.id,
              })),
          ),
          teach: assignment('teach'),
          tidy: assignment('tidy'),
          usage: value.usage.map(u => ({
            title:
              value.books.find(b => b.id === u.book_id)?.title ?? '其他任务',
            detail:
              tokens(u.total) +
              ' tokens · ' +
              (u.cacheHit !== null
                ? '缓存命中 ' +
                  Math.round(u.cacheHit * 100) +
                  '%' +
                  (u.cacheReports < u.count ? '（仅已报告请求）' : '')
                : u.cacheReports
                ? '暂无缓存输入数据'
                : '该服务没有报告缓存数据'),
          })),
          month: '本月合计 ' + tokens(value.month.totals.total) + ' tokens',
        });
      }),
    [c, run],
  );
  useEffect(refresh, [refresh]);
  return {
    state: { ...status, ...data },
    intents: {
      back: nav.back,
      refresh,
      add: () => nav.open({ name: 'MeAIEdit' }),
      edit: providerId => nav.open({ name: 'MeAIEdit', providerId }),
      assign: (purpose, key) =>
        run(async () => {
          const [providerId, model] = JSON.parse(key) as [string, string];
          await assignModel(c, purpose, providerId, model);
          setData(s => ({ ...s, [purpose]: key }));
        }, true),
    },
  };
}
export function useAIEditVM(providerId?: string): {
  state: AIEditState;
  intents: AIEditIntents;
} {
  const c = useContainer(),
    nav = useAppNav();
  const { status, run, notice } = useStatus();
  const [form, setForm] = useState<ServiceForm>({
    name: '',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: '',
    effort: 'low',
    cache: 'auto',
    auth: 'x-api-key',
    key: '',
    priceInput: '',
    priceCacheRead: '',
    priceCacheWrite: '',
    priceOutput: '',
  });
  const [keyTail, setKeyTail] = useState(''),
    [errors, setErrors] = useState<AIEditState['errors']>({}),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [catalog, setCatalog] = useState<ServiceCatalog>({ models: [] });
  const [busy, setBusy] = useState<AIEditState['busy']>();
  const operation = useRef<AbortController | undefined>(undefined);
  const cancel = () => {
    operation.current?.abort();
    operation.current = undefined;
    setBusy(undefined);
  };
  useEffect(() => {
    let active = true;
    run(async () => {
      const data = await readServiceEditor(c, providerId);
      if (!active) return;
      setForm(data.form);
      setKeyTail(data.keyTail);
      setCatalog(data.catalog);
    });
    return () => {
      active = false;
      operation.current?.abort();
      operation.current = undefined;
    };
  }, [c, providerId, run]);
  const request = (kind: 'models' | 'test') => {
    cancel();
    const controller = new AbortController();
    operation.current = controller;
    setBusy(kind);
    setErrors({});
    run(async () => {
      try {
        const options = { catalog, signal: controller.signal };
        if (kind === 'models') {
          const result = await fetchServiceModels(c, form, providerId, options);
          if (controller.signal.aborted) return;
          if (!result.ok) setErrors(result.errors);
          else {
            setCatalog(result.catalog);
            notice(
              result.demo
                ? 'Demo 演示 · 使用脚本模式，未读取远程模型'
                : '已读取 ' +
                    result.catalog.models.length +
                    ' 个模型，勾选后保存',
            );
          }
        } else {
          const result = await testServiceConnection(
            c,
            form,
            providerId,
            options,
          );
          if (controller.signal.aborted) return;
          if (!result.ok) setErrors(result.errors);
          else
            notice(
              result.demo
                ? 'Demo 演示 · 使用脚本模式，未测试真实连接'
                : '连接正常 · ' +
                    result.model +
                    ' · 延迟 ' +
                    result.latencyMs +
                    ' ms',
            );
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        if (operation.current === controller) {
          operation.current = undefined;
          setBusy(undefined);
        }
      }
    });
  };
  return {
    state: {
      ...status,
      title: providerId ? '编辑服务' : '添加服务',
      form,
      keyLabel: keyTail
        ? '已保存 · 末 4 位 ' + keyTail + '，留空保留'
        : '只保存在 Android Keystore',
      errors,
      canDelete: Boolean(providerId),
      confirmDelete,
      demo: c.mode === 'demo',
      busy,
      models: catalog.models.map(m => ({
        id: m.id,
        label: m.name && m.name !== m.id ? m.name + ' · ' + m.id : m.id,
        selected: serviceModelIds(form.model).includes(m.id),
      })),
    },
    intents: {
      back: () => {
        cancel();
        nav.back();
      },
      field: (key, value) => {
        cancel();
        setForm(s => ({ ...s, [key]: value }));
        if (key === 'protocol' || key === 'baseUrl') setCatalog({ models: [] });
        setErrors({});
      },
      save: () =>
        run(async () => {
          cancel();
          const result = await saveService(c, form, providerId, catalog);
          if (!result.ok) setErrors(result.errors);
          else {
            setForm(s => ({ ...s, key: '' }));
            nav.back();
          }
        }, true),
      remove: () => setConfirmDelete(true),
      confirmRemove: () =>
        run(async () => {
          if (providerId) await deleteService(c, providerId);
          setConfirmDelete(false);
          nav.back();
        }, true),
      closeOverlay: () => setConfirmDelete(false),
      testConnection: () => request('test'),
      readModels: () => request('models'),
      toggleModel: id => {
        cancel();
        setForm(s => {
          const ids = serviceModelIds(s.model);
          return {
            ...s,
            model: (ids.includes(id)
              ? ids.filter(m => m !== id)
              : [...ids, id]
            ).join(', '),
          };
        });
        setErrors({});
      },
    },
  };
}
export function usePrefsVM(): { state: PrefsState; intents: PrefsIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const { status, run } = useStatus();
  const [prefs, setPrefs] = useState<TeachPrefs>(defaultPrefs);
  const revision = useRef(0);
  const refresh = useCallback(
    () => run(async () => setPrefs(await readPrefs(c))),
    [c, run],
  );
  useEffect(refresh, [refresh]);
  return {
    state: { ...status, prefs },
    intents: {
      back: nav.back,
      refresh,
      set: (key, value) => {
        const current = ++revision.current;
        setPrefs(p => ({ ...p, [key]: value }));
        run(async () => {
          const saved = await patchPrefs(c, { [key]: value });
          if (current === revision.current) setPrefs(saved);
        }, true);
      },
    },
  };
}
export function useStorageVM(): {
  state: StorageState;
  intents: StorageIntents;
} {
  const c = useContainer(),
    nav = useAppNav(),
    { status, run, notice } = useStatus();
  const [books, setBooks] = useState<StorageState['books']>([]),
    [includeOriginals, setIncludeOriginals] = useState(false),
    [confirmClean, setConfirmClean] = useState<string | null>(null),
    [confirmReparse, setConfirmReparse] = useState<string | null>(null),
    [confirmRestore, setConfirmRestore] = useState(false);
  const refresh = useCallback(
    () =>
      run(async () =>
        setBooks(
          (await loadStorage(c)).map(book => ({
            id: book.id,
            title: book.title,
            needsReparse: book.needsReparse,
            meta: `原文件 ${formatBytes(
              book.sizeBytes,
            )} · 解析结果 ${formatBytes(book.parsedBytes)}`,
          })),
        ),
      ),
    [c, run],
  );
  useEffect(refresh, [refresh]);
  return {
    state: {
      ...status,
      books,
      includeOriginals,
      confirmClean,
      confirmReparse,
      confirmRestore,
    },
    intents: {
      back: nav.back,
      refresh,
      setIncludeOriginals,
      clean: id => setConfirmClean(id),
      reparse: id => setConfirmReparse(id),
      exportBackup: () =>
        run(async () => {
          await exportBackup(c, includeOriginals);
          notice('备份已保存到下载 / Pagewise导出');
        }, true),
      restoreBackup: () => setConfirmRestore(true),
      confirmClean: () => {
        if (!confirmClean || status.saving) return;
        const id = confirmClean;
        setConfirmClean(null);
        run(async () => {
          await clearParseCache(c, id);
          setBooks(
            (await loadStorage(c)).map(book => ({
              id: book.id,
              title: book.title,
              needsReparse: book.needsReparse,
              meta: `原文件 ${formatBytes(
                book.sizeBytes,
              )} · 解析结果 ${formatBytes(book.parsedBytes)}`,
            })),
          );
          notice('已清理解析缓存，学习记录已保留');
        }, true);
      },
      confirmReparse: () => {
        if (!confirmReparse || status.saving) return;
        const id = confirmReparse;
        setConfirmReparse(null);
        run(async () => {
          await reparseBook(c, id);
          nav.open({ name: 'ParseProgress', bookId: id });
        }, true);
      },
      confirmRestore: () => {
        setConfirmRestore(false);
        run(async () => {
          await restoreBackup(c);
        }, true);
      },
      closeOverlay: () => {
        setConfirmClean(null);
        setConfirmReparse(null);
        setConfirmRestore(false);
      },
    },
  };
}
export function useAboutVM(): { state: AboutState; intents: AboutIntents } {
  const c = useContainer(),
    nav = useAppNav();
  const { status, run } = useStatus();
  return {
    state: {
      ...status,
      loading: false,
      demo: c.mode === 'demo',
      development: __DEV__,
      version,
    },
    intents: {
      back: nav.back,
      demo: c.mode === 'demo' ? nav.exitDemo : nav.enterDemo,
      gallery: () => nav.open({ name: 'SkinGallery' }),
      exportLogs: () => run(() => shareLogs(c), true),
    },
  };
}
