import type { Db } from '@data/db';
import { migrate } from '@data/migrations';
import { createRepos, type Repos } from '@data/repos';
import {
  createAiGateway,
  type AiGateway,
  type AiPurpose,
} from '@services/ai/gateway';
import { AiError, type FetchLike } from '@services/ai/http';
import { normaliseConfig, resolvedService } from '@services/ai/models';
import { createMemoryKeyStore, type KeyStore } from '@services/secrets';
import {
  createSqliteAiConfiguration,
  type AiConfiguration,
  type ModelAssignment,
} from './aiConfiguration';
import { systemClock, type Clock } from './clock';
import {
  createAppearanceSettings,
  type AppearanceSettings,
} from './appearance';
import { createEventBus, type EventBus } from './events';
import { disposeContainerSessions } from './study/registry';
import { disposeMathRuntime } from './math';
import { getParseQueue } from './usecases/parseQueue';
import { disposeReaderRuntime } from './readerRuntime';
import { createLogger, type Logger } from './log';
import { disposeRefinements } from './usecases/refinement';

/** 所有 IO 和应用设置通过容器注入，Demo 与正式书库使用独立数据库。 */
export interface Container {
  db: Db;
  repos: Repos;
  appearance: AppearanceSettings;
  mode: 'device' | 'test' | 'demo';
  secrets: KeyStore;
  ai: AiGateway;
  clock: Clock;
  log: Logger;
  events: EventBus;
  close(): Promise<void>;
}

export interface ContainerOptions {
  aiConfiguration?: AiConfiguration;
  fetchImpl?: FetchLike;
}

/** 设备与测试共用的组装步骤，只通过传入的驱动访问数据库。 */
export async function createContainer(
  db: Db,
  over: Partial<Container> = {},
  options: ContainerOptions = {},
): Promise<Container> {
  const clock = over.clock ?? systemClock;
  const log = over.log ?? createLogger({ clock });
  const secrets =
    over.secrets ?? createMemoryKeyStore({ onSecret: log.registerSecret });
  try {
    await migrate(db);
  } catch (error) {
    log.error('数据库初始化失败');
    await db.close();
    throw error;
  }
  const repos = over.repos ?? createRepos(db, () => clock.now().toISOString());
  let appearance: AppearanceSettings;
  try {
    appearance =
      over.appearance ?? (await createAppearanceSettings(repos.settings, db));
  } catch (error) {
    log.error('读取外观设置失败');
    await db.close();
    throw error;
  }
  const configuration =
    options.aiConfiguration ?? createSqliteAiConfiguration(repos);
  async function resolve(assignment: ModelAssignment | undefined) {
    if (!assignment) {
      throw new AiError(
        'bad_request',
        '请先在「我的 → AI 服务」分配讲解模型和整理模型',
      );
    }
    const providers = await configuration.providers();
    const config = normaliseConfig(
      { ...assignment, effort: assignment.effort ?? 'low', search: false },
      providers,
    );
    const service = resolvedService(providers, config);
    if (!service) {
      throw new AiError('not_found', '找不到已启用的 AI 模型，请检查服务设置');
    }
    const key = await secrets.get('ai.key.' + assignment.providerId);
    if (!key) {
      throw new AiError('auth', '请先在「我的 → AI 服务」填写 API Key');
    }
    log.registerSecret(key);
    return { service, key, cacheKey: await configuration.cacheKey() };
  }
  const ai =
    over.ai ??
    createAiGateway({
      resolve: async (purpose: AiPurpose) =>
        resolve(await configuration.assignment(purpose)),
      resolveProvider: (providerId, model) => resolve({ providerId, model }),
      recordUsage: record => configuration.recordUsage(record),
      fetchImpl: options.fetchImpl,
      now: () => clock.now(),
    });
  log.info('基础服务已就绪');
  let closing: Promise<void> | undefined;
  const container: Container = {
    db,
    repos,
    appearance,
    mode: over.mode ?? 'device',
    clock,
    log,
    secrets,
    ai,
    events: over.events ?? createEventBus(),
    close:
      over.close ??
      (() => {
        closing ??= (async () => {
          await getParseQueue(container).dispose();
          await disposeRefinements(container);
          await disposeContainerSessions(container);
          await disposeReaderRuntime(container);
          disposeMathRuntime(container);
          await appearance.flush();
          await log.flush();
          await db.close();
        })();
        return closing;
      }),
  };
  return container;
}

export async function createDeviceContainer(
  options: ContainerOptions = {},
): Promise<Container> {
  const [
    { openDeviceDb },
    { createKeychainStore },
    { createDeviceLogFileStore },
  ] = await Promise.all([
    import('@data/drivers/opSqlite'),
    import('@services/secrets'),
    import('@platform/logFiles'),
  ]);
  const log = createLogger({
    files: createDeviceLogFileStore(),
    clock: systemClock,
  });
  const container = await createContainer(
    openDeviceDb(),
    {
      log,
      secrets: createKeychainStore({ onSecret: log.registerSecret }),
    },
    options,
  );
  try {
    const [{ configureDeviceImports }, { configureDeviceStorage }] =
      await Promise.all([import('./importDevice'), import('./storageDevice')]);
    configureDeviceImports(container);
    configureDeviceStorage(container);
    return container;
  } catch (error) {
    await container.close();
    throw error;
  }
}
