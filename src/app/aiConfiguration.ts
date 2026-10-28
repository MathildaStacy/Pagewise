import type { AiPurpose, GatewayUsageRecord } from '@services/ai/gateway';
import type { AiProvider, Effort } from '@services/ai/types';

export interface ModelAssignment {
  providerId: string;
  model: string;
  effort?: Effort;
}

/** 由应用层连接设置仓库和用量仓库，AI 服务本身不访问数据库。 */
export interface AiConfiguration {
  providers(): Promise<AiProvider[]>;
  assignment(purpose: AiPurpose): Promise<ModelAssignment | undefined>;
  cacheKey(): Promise<string>;
  recordUsage(record: GatewayUsageRecord): Promise<void>;
}

export interface MemoryAiConfiguration extends AiConfiguration {
  setProviders(providers: AiProvider[]): void;
  assign(purpose: AiPurpose, assignment: ModelAssignment): void;
  usage(): GatewayUsageRecord[];
}

/** TODO(Q-10): T1 尚无 setting / ai_usage 表，T3 用 SQLite 仓库替换设备默认适配器。 */
export function createMemoryAiConfiguration(
  initial: {
    providers?: AiProvider[];
    assignments?: Partial<Record<AiPurpose, ModelAssignment>>;
    cacheKey?: string;
  } = {},
): MemoryAiConfiguration {
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  let providers = copy(initial.providers ?? []);
  const assignments = copy(initial.assignments ?? {});
  const records: GatewayUsageRecord[] = [];
  const cacheKey =
    initial.cacheKey ?? 'pagewise-' + Math.random().toString(36).slice(2);
  return {
    providers: async () => copy(providers),
    assignment: async purpose =>
      copy(assignments[purpose] ?? null) ?? undefined,
    cacheKey: async () => cacheKey,
    async recordUsage(record) {
      records.push(copy(record));
    },
    setProviders(value) {
      providers = copy(value);
    },
    assign(purpose, value) {
      assignments[purpose] = copy(value);
    },
    usage: () => copy(records),
  };
}
