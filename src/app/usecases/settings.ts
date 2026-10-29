import { Share } from 'react-native';
import type { AiProvider, ModelEntry } from '@services/ai/types';
import { listModels } from '@services/ai/catalog';
import { createAiGateway } from '@services/ai/gateway';
import type { FetchLike } from '@services/ai/http';
import { normaliseConfig, resolvedService } from '@services/ai/models';
import {
  emptyForm,
  keyTailOf,
  newServiceId,
  parseServiceForm,
  type ServiceForm,
} from '@services/ai/services';
import { createSettingsRepo } from '@data/repos/settings';
import type { Container } from '../container';
import {
  createSqliteAiConfiguration,
  type ModelAssignment,
} from '../aiConfiguration';
export type { ServiceForm } from '@services/ai/services';
export type { AiProvider } from '@services/ai/types';
export interface ServiceCatalog {
  models: ModelEntry[];
  fetchedAt?: string;
}
export const serviceModelIds = (text: string) => [
  ...new Set(
    text
      .split(/[,，\n]/)
      .map(m => m.trim())
      .filter(Boolean),
  ),
];

export interface TeachPrefs {
  intuitionFirst: boolean;
  length: '短' | '中' | '长';
  askEachStep: boolean;
  quizAtEnd: boolean;
  bilingual: boolean;
  recap: boolean;
  extra: string;
}
export interface MineruSettings {
  model: 'vlm' | 'pipeline';
  confirmUpload: boolean;
  tokenTail: string;
  tokenExpiresOn?: string;
  usedToday: { date: string; pages: number };
}
export type Assignments = Partial<Record<'teach' | 'tidy', ModelAssignment>>;
export const defaultPrefs: TeachPrefs = {
  intuitionFirst: true,
  length: '中',
  askEachStep: true,
  quizAtEnd: true,
  bilingual: true,
  recap: true,
  extra: '',
};
export class SettingsInputError extends Error {}
export const readPrefs = (c: Container) =>
  c.repos.settings.get<TeachPrefs>('prefs.teach', defaultPrefs);
export const readMineru = (c: Container) =>
  c.repos.settings.get<MineruSettings>('mineru', {
    model: 'vlm',
    confirmUpload: true,
    tokenTail: '',
    usedToday: { date: c.clock.today(), pages: 0 },
  });

export async function patchPrefs(c: Container, patch: Partial<TeachPrefs>) {
  return c.db.transaction(async tx => {
    const settings = createSettingsRepo(tx);
    const next = {
      ...defaultPrefs,
      ...(await settings.get<Partial<TeachPrefs>>('prefs.teach', {})),
      ...patch,
    };
    await settings.set('prefs.teach', next);
    return next;
  });
}
export async function patchMineru(
  c: Container,
  patch: Partial<MineruSettings>,
  token = '',
) {
  const value = token.trim();
  if (value && /\s/.test(value))
    throw new SettingsInputError('Token 里不能有空格或换行');
  if (patch.tokenExpiresOn) {
    const date = new Date(patch.tokenExpiresOn + 'T00:00:00Z');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(patch.tokenExpiresOn) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== patch.tokenExpiresOn
    )
      throw new SettingsInputError('有效期请填写 YYYY-MM-DD');
  }
  const previous = value ? await c.secrets.get('mineru.token') : null;
  if (value) await c.secrets.set('mineru.token', value);
  try {
    return await c.db.transaction(async tx => {
      const settings = createSettingsRepo(tx);
      const current = await settings.get<MineruSettings>('mineru', {
        model: 'vlm',
        confirmUpload: true,
        tokenTail: '',
        usedToday: { date: c.clock.today(), pages: 0 },
      });
      const next = {
        ...current,
        ...patch,
        ...(value ? { tokenTail: keyTailOf(value) } : {}),
      };
      await settings.set('mineru', next);
      return next;
    });
  } catch (error) {
    if (value) {
      if (previous) await c.secrets.set('mineru.token', previous);
      else await c.secrets.remove('mineru.token');
    }
    throw error;
  }
}
export async function readSettingsOverview(c: Container) {
  const [mineru, prefs, providers, assign, books] = await Promise.all([
    readMineru(c),
    readPrefs(c),
    readProviders(c),
    readAssignments(c),
    c.repos.books.list(),
  ]);
  return {
    mineru,
    prefs,
    providers,
    assign,
    books,
    today: c.clock.today(),
    mode: c.mode,
  };
}
export const readProviders = (c: Container) =>
  c.repos.settings.get<AiProvider[]>('ai.providers', []);
export const readAssignments = (c: Container) =>
  c.repos.settings.get<Assignments>('ai.assign', {});
export async function readAI(c: Container) {
  const [providers, assign, usage, month, books, cache] = await Promise.all([
    readProviders(c),
    readAssignments(c),
    c.repos.usage.byBook(),
    c.repos.usage.month(c.clock.today().slice(0, 7)),
    c.repos.books.list(),
    c.db.all<{
      book_id: string | null;
      reported: number;
      input: number;
      cache_read: number;
      cache_write: number;
    }>(
      'SELECT book_id, COUNT(*) AS reported, SUM(input) AS input, ' +
        'SUM(cache_read) AS cache_read, SUM(cache_write) AS cache_write ' +
        'FROM ai_usage WHERE cache_reported = 1 GROUP BY book_id',
    ),
  ]);
  return {
    providers,
    assign,
    month,
    books,
    usage: usage.map(u => {
      const reported = cache.find(r => r.book_id === u.book_id);
      const input = reported
        ? reported.input + reported.cache_read + reported.cache_write
        : 0;
      return {
        ...u,
        cacheHit: reported && input > 0 ? reported.cache_read / input : null,
        cacheReports: reported?.reported ?? 0,
      };
    }),
    demo: c.mode === 'demo',
  };
}
export async function assignModel(
  c: Container,
  purpose: 'teach' | 'tidy',
  providerId: string,
  model: string,
) {
  const providers = await readProviders(c);
  if (
    !providers.some(
      p =>
        p.id === providerId && p.models.some(m => m.id === model && m.enabled),
    )
  )
    throw new SettingsInputError('请选择可用的模型');
  await c.db.transaction(async tx => {
    const settings = createSettingsRepo(tx);
    const current = await settings.get<Assignments>('ai.assign', {});
    await settings.set('ai.assign', {
      ...current,
      [purpose]: { providerId, model },
    });
  });
}
export async function readServiceEditor(c: Container, id?: string) {
  const provider = (await readProviders(c)).find(p => p.id === id);
  if (id && !provider) throw new SettingsInputError('服务不存在，可能已被删除');
  const form: ServiceForm = provider
    ? {
        ...emptyForm(provider.protocol),
        name: provider.name,
        baseUrl: provider.baseUrl,
        auth: provider.auth,
        cache: provider.cache,
        model: provider.models
          .filter(m => m.enabled)
          .map(m => m.id)
          .join(', '),
      }
    : emptyForm();
  return {
    form,
    keyTail: provider?.keyTail ?? '',
    catalog: { models: provider?.models ?? [], fetchedAt: provider?.fetchedAt },
  };
}

/** Draft requests never persist credentials or change the saved provider. */
async function serviceDraft(
  c: Container,
  form: ServiceForm,
  id?: string,
  options: { catalog?: ServiceCatalog; requireModel?: boolean } = {},
) {
  const previous = (await readProviders(c)).find(p => p.id === id);
  if (id && !previous) throw new SettingsInputError('服务不存在，可能已被删除');
  const savedKey = id ? await c.secrets.get('ai.key.' + id) : null;
  const ids = serviceModelIds(form.model);
  const parsed = parseServiceForm(
    {
      ...form,
      model: ids[0] ?? (options.requireModel === false ? 'catalog' : ''),
    },
    Boolean(savedKey) || c.mode === 'demo',
  );
  if (!parsed.ok) return parsed;
  for (const model of ids) {
    const check = parseServiceForm({ ...form, model }, true);
    if (!check.ok) return check;
  }
  const key = parsed.key ?? savedKey ?? '';
  if (key) c.log.registerSecret(key);
  const known = options.catalog?.models ?? previous?.models ?? [];
  const models = new Map(
    known.map(m => [m.id, { ...m, enabled: ids.includes(m.id) }]),
  );
  for (const model of ids) {
    const old = models.get(model);
    models.set(model, {
      ...old,
      id: model,
      enabled: true,
      price: parsed.service.price ?? old?.price ?? null,
    });
  }
  const provider: AiProvider = {
    id: id ?? 'unsaved',
    kind: previous?.kind ?? 'custom',
    name: parsed.service.name,
    protocol: parsed.service.protocol,
    baseUrl: parsed.service.baseUrl,
    auth: parsed.service.auth,
    cache: parsed.service.cache,
    keyTail: parsed.key ? keyTailOf(parsed.key) : previous?.keyTail ?? '',
    models: [...models.values()],
    fetchedAt: options.catalog?.fetchedAt ?? previous?.fetchedAt,
  };
  return { ok: true as const, provider, key, parsed, ids };
}

export async function fetchServiceModels(
  c: Container,
  form: ServiceForm,
  id?: string,
  opts: {
    catalog?: ServiceCatalog;
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
) {
  const draft = await serviceDraft(c, form, id, {
    ...opts,
    requireModel: false,
  });
  if (!draft.ok) return draft;
  const models =
    c.mode === 'demo'
      ? draft.provider.models
      : await listModels(draft.provider, draft.key, opts);
  return {
    ok: true as const,
    demo: c.mode === 'demo',
    catalog: { models, fetchedAt: c.clock.now().toISOString() },
  };
}

export async function testServiceConnection(
  c: Container,
  form: ServiceForm,
  id?: string,
  opts: {
    catalog?: ServiceCatalog;
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
) {
  const draft = await serviceDraft(c, form, id, opts);
  if (!draft.ok) return draft;
  if (c.mode === 'demo')
    return { ok: true as const, demo: true as const, model: draft.ids[0] };
  const configuration = createSqliteAiConfiguration(c.repos);
  const config = normaliseConfig(
    {
      providerId: draft.provider.id,
      model: draft.ids[0],
      effort: form.effort,
      search: false,
    },
    [draft.provider],
  );
  const service = resolvedService([draft.provider], config);
  if (!service) throw new SettingsInputError('请选择支持对话的模型');
  const connection = {
    service,
    key: draft.key,
    cacheKey: await configuration.cacheKey(),
  };
  const gateway = createAiGateway({
    resolve: () => connection,
    resolveProvider: () => connection,
    recordUsage: record => configuration.recordUsage(record),
    fetchImpl: opts.fetchImpl,
    now: () => c.clock.now(),
  });
  const result = await gateway.test(draft.provider.id, draft.ids[0], opts);
  return { ...result, demo: false as const };
}

export async function saveService(
  c: Container,
  form: ServiceForm,
  id?: string,
  catalog?: ServiceCatalog,
) {
  const draft = await serviceDraft(c, form, id, { catalog });
  if (!draft.ok) return draft;
  const { parsed, ids: models } = draft;
  const providerId = id ?? newServiceId();
  const keyId = 'ai.key.' + providerId;
  const oldKey = parsed.key ? await c.secrets.get(keyId) : null;
  if (parsed.key) await c.secrets.set(keyId, parsed.key);
  const provider: AiProvider = { ...draft.provider, id: providerId };
  try {
    await c.db.transaction(async tx => {
      const settings = createSettingsRepo(tx);
      const current = await settings.get<AiProvider[]>('ai.providers', []);
      await settings.set(
        'ai.providers',
        id
          ? current.map(p => (p.id === providerId ? provider : p))
          : [...current, provider],
      );
      const assign = await settings.get<Assignments>('ai.assign', {});
      for (const purpose of ['teach', 'tidy'] as const) {
        if (
          !assign[purpose] ||
          (assign[purpose]?.providerId === providerId &&
            !models.includes(assign[purpose]!.model))
        )
          assign[purpose] = { providerId, model: models[0] };
      }
      await settings.set('ai.assign', assign);
    });
  } catch (error) {
    if (parsed.key) {
      if (oldKey) await c.secrets.set(keyId, oldKey);
      else await c.secrets.remove(keyId);
    }
    throw error;
  }
  return { ok: true as const, providerId };
}
export async function deleteService(c: Container, id: string) {
  await c.db.transaction(async tx => {
    const settings = createSettingsRepo(tx);
    const providers = await settings.get<AiProvider[]>('ai.providers', []);
    await settings.set(
      'ai.providers',
      providers.filter(p => p.id !== id),
    );
    const assign = await settings.get<Assignments>('ai.assign', {});
    for (const purpose of ['teach', 'tidy'] as const)
      if (assign[purpose]?.providerId === id) delete assign[purpose];
    await settings.set('ai.assign', assign);
  });
  await c.secrets.remove('ai.key.' + id);
}
export async function readStorage(c: Container) {
  const books = await c.repos.books.list();
  return books.map(b => ({
    id: b.id,
    title: b.title,
    sizeBytes: b.size_bytes,
  }));
}
export async function shareLogs(c: Container) {
  await Share.share({ message: (await c.log.export()) || '暂无日志' });
}
