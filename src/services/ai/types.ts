/**
 * AI 助手（M4）的数据结构：服务配置、存下来的消息、界面附加数据（工具标签、操作卡、记忆变更、用量）。
 * 请求怎么拼见 AI_ASSISTANT.md §1、§7。
 */
// 来源：AShareSim/src/ai/types.ts，GPL-3.0-only；已适配 Pagewise。

/** Anthropic Messages / OpenAI Responses / OpenAI Chat Completions。 */
export type Protocol = 'anthropic' | 'openai' | 'chat';

export const PROTOCOL_NAME: Record<Protocol, string> = {
  anthropic: 'Anthropic Messages',
  openai: 'OpenAI Responses',
  chat: 'OpenAI Chat Completions',
};

/** 思考选项按模型真实档位限制，并随对话保存。off 由协议适配为关闭或不发送。 */
export type Effort =
  | 'off'
  | 'on'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export type ProviderKind =
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'dashscope'
  | 'moonshot'
  | 'zhipu'
  | 'openrouter'
  | 'custom';

export interface ModelCapabilities {
  chat: boolean;
  tools: boolean | null;
  /** null 未知，[] 不支持；没有 off 的列表表示不能关闭思考。 */
  thinking: Effort[] | null;
  search: boolean | null;
  vision: boolean | null;
  audio: boolean | null;
  video: boolean | null;
  context: number | null;
  thinkingStyle:
    | 'adaptive'
    | 'budget'
    | 'reasoning'
    | 'toggle'
    | 'fixed'
    | 'none';
  known: boolean;
}

export interface ModelEntry {
  id: string;
  name?: string;
  enabled: boolean;
  /** 从模型列表自动读取的能力；用户标注 overrides 的优先级更高。 */
  detected?: Partial<ModelCapabilities>;
  overrides?: Partial<ModelCapabilities>;
  price: Price | null;
}

export interface AiProvider {
  id: string;
  kind: ProviderKind;
  name: string;
  protocol: Protocol;
  baseUrl: string;
  auth: 'x-api-key' | 'bearer';
  cache: 'auto' | 'off';
  keyTail: string;
  models: ModelEntry[];
  fetchedAt?: string;
}

export interface ConversationConfig {
  providerId: string;
  model: string;
  effort: Effort;
  search: boolean;
}

/** 美元 / 百万 tokens，存成千分之一美元的整数（3 美元 = 3000）。 */
export interface Price {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export interface AiService {
  id: string;
  name: string;
  protocol: Protocol;
  /** 例如 https://api.anthropic.com；可以带 /v1，也可以是中转服务的地址。 */
  baseUrl: string;
  model: string;
  effort: Effort;
  /** 缓存参数（cache_control / prompt_cache_key）：服务不认时自动改成 off（§6.4）。 */
  cache: 'auto' | 'off';
  /** Anthropic 协议的鉴权头：官方是 x-api-key，不少中转服务要 Authorization: Bearer。 */
  auth: 'x-api-key' | 'bearer';
  price: Price | null;
  /** Key 的末 4 位，界面显示「已保存，末 4 位 xxxx」；Key 本身存在 Android Keystore。 */
  keyTail: string;
  /** 供应商 + 会话选项解析后的运行时视图，不单独保存 Key 或配置。 */
  providerKind?: ProviderKind;
  capabilities?: ModelCapabilities;
  search?: boolean;
}

// ---------- 消息 ----------

/** 协议无关的消息内容。args / output 是字符串，原样发送，保证每次发送的字节相同（缓存）。 */
export type Part =
  | { t: 'text'; text: string }
  | { t: 'call'; id: string; name: string; args: string }
  | { t: 'result'; id: string; name: string; output: string };

export type Role = 'user' | 'assistant' | 'tool';

/** 模型返回的原始内容：Anthropic 是 content 块，OpenAI 是 output 项（含推理）。 */
export interface RawOutput {
  protocol: Protocol;
  model: string;
  items: unknown[];
  providerId?: string;
  search?: SearchTrace;
}

export interface Usage {
  /** 没走缓存的输入（不含缓存读写）。 */
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  /** 服务有没有报告缓存数据（没有时界面写「该服务没有报告缓存数据」，不估算）。 */
  cacheReported: boolean;
  searchRequests?: number;
}

export interface SearchSource {
  url: string;
  title: string;
  snippet?: string;
}

export interface Citation {
  /** 正文中插入引用的位置；不改变发给模型的原文。 */
  end: number;
  source: number;
}

export interface SearchTrace {
  queries: string[];
  sources: SearchSource[];
  citations: Citation[];
  calls?: number;
}

export interface ModelProgress {
  thinking?: string;
  search?: SearchTrace;
}

/** 页面可用的消息元数据；不含业务动作或持久化依赖。 */
export interface MessageUi {
  question?: string;
  usage?: Usage;
  service?: string;
  price?: Price | null;
  error?: string;
  notice?: string;
  config?: ConversationConfig;
  thinking?: string;
  search?: SearchTrace;
}

export interface StoredMessage {
  id: number;
  threadId: number;
  role: Role;
  parts: Part[];
  raw: RawOutput | null;
  ui: MessageUi | null;
  compacted: boolean;
  createdAt: string;
}
