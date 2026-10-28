import {
  buildRequest,
  type ParsedResponse,
  type RequestInput,
} from './protocol';
import { AiError, callModel, type FetchLike } from './http';
import type { AiService, ModelProgress, Usage } from './types';

export type AiPurpose = 'teach' | 'tidy';
export type GatewayRequest = Omit<
  RequestInput,
  'service' | 'cacheKey' | 'cache' | 'effort'
> & { bookId?: string };

export interface ResolvedConnection {
  service: AiService;
  key: string;
  cacheKey: string;
}

export interface GatewayUsageRecord {
  purpose: AiPurpose | 'test';
  providerId: string;
  model: string;
  usage: Usage;
  at: string;
  bookId?: string;
}

export interface ConnectionResult {
  ok: true;
  model: string;
  latencyMs: number;
  usage: Usage;
}

export interface StreamHandlers {
  signal: AbortSignal;
  onText(full: string): void;
  onProgress?(progress: ModelProgress): void;
}

export interface AiGateway {
  stream(
    purpose: AiPurpose,
    req: GatewayRequest,
    handlers: StreamHandlers,
  ): Promise<ParsedResponse>;
  complete(
    purpose: AiPurpose,
    req: GatewayRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<ParsedResponse>;
  test(providerId: string, model: string): Promise<ConnectionResult>;
}

type MaybePromise<T> = T | Promise<T>;
export interface GatewayDependencies {
  resolve(purpose: AiPurpose): MaybePromise<ResolvedConnection>;
  resolveProvider(
    providerId: string,
    model: string,
  ): MaybePromise<ResolvedConnection>;
  /** 只写用量及 ID，不传密钥、请求或回答正文。 */
  recordUsage(record: GatewayUsageRecord): MaybePromise<void>;
  fetchImpl?: FetchLike;
  now?(): Date;
}

/** 服务配置和记录写入通过组合根注入，网关不读取数据库或应用店铺。 */
export function createAiGateway(deps: GatewayDependencies): AiGateway {
  const unsupported = new Map<string, Set<'cache' | 'effort'>>();
  const now = deps.now ?? (() => new Date());

  async function execute(
    connection: ResolvedConnection,
    purpose: GatewayUsageRecord['purpose'],
    req: GatewayRequest,
    opts: Partial<StreamHandlers> = {},
  ) {
    if (opts.signal?.aborted) {
      throw new AiError('cancelled', '已停止');
    }
    if (!connection.key) {
      throw new AiError('auth', '请先在「我的 → AI 服务」填写 API Key');
    }
    const service = connection.service;
    const identity = JSON.stringify([
      service.id,
      service.baseUrl,
      service.protocol,
      service.model,
    ]);
    const disabled = unsupported.get(identity) ?? new Set<'cache' | 'effort'>();
    unsupported.set(identity, disabled);
    let published = false;
    for (;;) {
      const noEffort = disabled.has('effort');
      const input: RequestInput = {
        ...req,
        service: noEffort
          ? {
              ...service,
              capabilities: service.capabilities
                ? {
                    ...service.capabilities,
                    thinking: [],
                    thinkingStyle: 'none',
                  }
                : undefined,
            }
          : service,
        cacheKey: connection.cacheKey,
        cache: service.cache !== 'off' && !disabled.has('cache'),
        effort: noEffort ? 'off' : service.effort,
      };
      let result: Awaited<ReturnType<typeof callModel>>;
      try {
        result = await callModel(
          input.service as AiService,
          connection.key,
          buildRequest(input),
          {
            signal: opts.signal,
            fetchImpl: deps.fetchImpl,
            onText: opts.onText
              ? text => {
                  if (text) published = true;
                  opts.onText!(text);
                }
              : undefined,
            onProgress: opts.onProgress
              ? progress => {
                  published = true;
                  opts.onProgress!(progress);
                }
              : undefined,
          },
        );
      } catch (error) {
        if (
          error instanceof AiError &&
          error.compat &&
          !published &&
          !disabled.has(error.compat) &&
          !opts.signal?.aborted &&
          (error.compat !== 'cache' || input.cache)
        ) {
          disabled.add(error.compat);
          continue;
        }
        throw error;
      }
      await deps.recordUsage({
        purpose,
        providerId: service.id,
        model: service.model,
        usage: { ...result.parsed.usage },
        at: now().toISOString(),
        ...(req.bookId ? { bookId: req.bookId } : {}),
      });
      return result;
    }
  }

  return {
    async stream(purpose, req, handlers) {
      const connection = await deps.resolve(purpose);
      return (
        await execute(connection, purpose, { ...req, stream: true }, handlers)
      ).parsed;
    },
    async complete(purpose, req, opts = {}) {
      const connection = await deps.resolve(purpose);
      return (
        await execute(connection, purpose, { ...req, stream: false }, opts)
      ).parsed;
    },
    async test(providerId, model) {
      const connection = await deps.resolveProvider(providerId, model);
      const result = await execute(connection, 'test', {
        system: '连接测试。请只回复「连接成功」。',
        contextBlocks: [],
        tools: [],
        noTools: true,
        history: [
          {
            id: 0,
            threadId: 0,
            role: 'user',
            parts: [{ t: 'text', text: '连接测试' }],
            raw: null,
            ui: null,
            compacted: false,
            createdAt: now().toISOString(),
          },
        ],
      });
      return {
        ok: true,
        model: result.parsed.model ?? connection.service.model,
        latencyMs: result.latencyMs,
        usage: result.parsed.usage,
      };
    },
  };
}
