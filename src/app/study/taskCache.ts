import { stableStringify } from '@core/text';
import { normaliseConfig } from '@services/ai/models';
import type { ConversationConfig } from '@services/ai/types';
import type { Container } from '../container';
import { asJson } from './types';
import {
  buildTaskContext,
  TASK_PROMPT_VERSION,
  type StudyTask,
} from './prompts';

/** Resolve without API keys, so an offline local result needs no credentials. */
export async function taskCacheContext(
  c: Container,
  purpose: 'teach' | 'tidy',
  requested?: ConversationConfig,
) {
  const [providers, assignment] = await Promise.all([
    c.aiConfiguration.providers(),
    requested
      ? Promise.resolve(undefined)
      : c.aiConfiguration.assignment(purpose),
  ]);
  const selected =
    requested ??
    (assignment
      ? { ...assignment, effort: assignment.effort ?? 'low', search: false }
      : undefined);
  const config = selected ? normaliseConfig(selected, providers) : undefined;
  const provider = providers.find(p => p.id === config?.providerId);
  return {
    config,
    persistent: !config?.search && (!!config || c.mode === 'demo'),
    identity: {
      mode: c.mode,
      purpose,
      config: config ?? null,
      provider: provider
        ? {
            id: provider.id,
            kind: provider.kind,
            protocol: provider.protocol,
            baseUrl: provider.baseUrl,
          }
        : null,
    },
  };
}

export type TaskCacheContext = Awaited<ReturnType<typeof taskCacheContext>>;

export function taskResultKey(
  context: TaskCacheContext,
  task: StudyTask,
  input: unknown,
): string {
  return stableStringify(
    asJson({
      version: TASK_PROMPT_VERSION,
      connection: context.identity,
      request: buildTaskContext(task, input),
    }),
  );
}

interface Subscriber {
  resolve(value: string): void;
  reject(error: unknown): void;
  onText?: (text: string, fromCache?: boolean) => void;
  detach(): void;
}
interface Flight {
  controller: AbortController;
  subscribers: Set<Subscriber>;
  text?: string;
}
interface CachedAnswer {
  scope: string;
  key: string;
  refresh?: boolean;
  signal?: AbortSignal;
  onText?: (text: string, fromCache?: boolean) => void;
  read(): Promise<string | null>;
  write(content: string): Promise<void>;
  generate(
    signal: AbortSignal,
    onText: (text: string) => void,
  ): Promise<string>;
}

/** Coalesce equal work, while keeping cancellation and progress per caller. */
export class TaskResultCache {
  private flights = new Map<string, Flight>();
  private latest = new Map<string, Flight>();
  private work = new Set<Promise<void>>();

  async dispose(): Promise<void> {
    for (const flight of this.flights.values()) flight.controller.abort();
    await Promise.allSettled([...this.work]);
  }

  run(request: CachedAnswer): Promise<string> {
    if (request.signal?.aborted) return Promise.reject(new Error('已停止'));
    const id = JSON.stringify([request.scope, request.key, !!request.refresh]);
    let flight = this.flights.get(id);
    if (!flight) {
      flight = { controller: new AbortController(), subscribers: new Set() };
      this.flights.set(id, flight);
      this.latest.set(request.scope, flight);
      const active = flight;
      // Subscribe before lookup or generation starts, including synchronous fakes.
      const work = Promise.resolve().then(async () => {
        const check = () => {
          if (active.controller.signal.aborted) throw new Error('已停止');
        };
        const publish = (text: string, fromCache = false) => {
          if (active.controller.signal.aborted) return;
          active.text = text;
          for (const listener of active.subscribers) {
            if (fromCache) listener.onText?.(text, true);
            else listener.onText?.(text);
          }
        };
        try {
          check();
          const cached = request.refresh ? null : await request.read();
          check();
          let content = cached;
          if (content === null) {
            content = await request.generate(active.controller.signal, publish);
            check();
            if (this.latest.get(request.scope) === active)
              await request.write(content);
          }
          check();
          publish(content, cached !== null);
          for (const listener of active.subscribers) listener.resolve(content);
        } catch (error) {
          for (const listener of active.subscribers) listener.reject(error);
        } finally {
          for (const listener of active.subscribers) listener.detach();
          active.subscribers.clear();
          if (this.flights.get(id) === active) this.flights.delete(id);
          if (this.latest.get(request.scope) === active)
            this.latest.delete(request.scope);
        }
      });
      this.work.add(work);
      work.finally(() => this.work.delete(work));
    }
    const active = flight;
    return new Promise((resolve, reject) => {
      const abort = () => {
        active.subscribers.delete(listener);
        listener.detach();
        reject(new Error('已停止'));
        if (!active.subscribers.size) {
          active.controller.abort();
          if (this.flights.get(id) === active) this.flights.delete(id);
        }
      };
      const listener: Subscriber = {
        resolve,
        reject,
        onText: request.onText,
        detach: () => request.signal?.removeEventListener('abort', abort),
      };
      active.subscribers.add(listener);
      request.signal?.addEventListener('abort', abort, { once: true });
      if (active.text !== undefined) request.onText?.(active.text);
    });
  }
}
