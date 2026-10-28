import type { LogFileStore } from '@platform/logFiles';
import { systemClock, type Clock } from './clock';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
  at: string;
  level: LogLevel;
  message: string;
  fields?: Record<string, unknown>;
}

/** message 使用固定事件说明；fields 只传 ID、长度、状态等诊断信息，不传书籍/对话正文。 */
export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  registerSecret(value: string): void;
  entries(): LogEntry[];
  flush(): Promise<void>;
  export(): Promise<string>;
}

const MASK = '[REDACTED]';
const sensitiveField =
  /^(?:authorization|proxy-authorization|(?:x[_-]?)?(?:api[_-]?)?key|(?:access[_-]?)?token|secret|password)$/i;
const privateContent =
  /^(?:text|content|prompt|question|answer|sourceText|raw|body|request|response|history|messages|system|contextBlocks|parts)$/i;

/** 纯文本脱敏；已知秘密包括不带任何格式前缀的自定义 Key。 */
export function redact(
  text: string,
  knownSecrets: Iterable<string> = [],
): string {
  let result = text;
  const values = [...knownSecrets]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const value of values) {
    result = result.split(value).join(MASK);
  }
  return result
    .replace(/\bsk-[A-Za-z0-9_-]+/g, MASK)
    .replace(/\bmnr_[A-Za-z0-9_-]+/g, MASK)
    .replace(
      /\b(authorization["']?\s*[:=]\s*["']?)(?:(?:bearer|basic)\s+)?[^\r\n,"'}]+/gi,
      '$1' + MASK,
    )
    .replace(
      /\b((?:api[_-]?key|access[_-]?token|token|secret|password)["']?\s*[:=]\s*["']?)[^\s\r\n,"'}]+/gi,
      '$1' + MASK,
    );
}

export interface LoggerOptions {
  clock?: Clock;
  files?: LogFileStore;
  capacity?: number;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const clock = options.clock ?? systemClock;
  const capacity = options.capacity ?? 2000;
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error('日志容量需要是正整数');
  }
  const knownSecrets = new Set<string>();
  const buffer: LogEntry[] = [];
  let queue: Promise<void> = Promise.resolve();
  let lastPrunedDay = '';
  let fileWriteFailed = false;

  const clean = (
    value: unknown,
    key: string,
    seen: WeakSet<object>,
  ): unknown => {
    if (sensitiveField.test(key)) {
      return MASK;
    }
    if (privateContent.test(key)) {
      return '[内容已省略]';
    }
    if (typeof value === 'string') {
      return redact(value, knownSecrets);
    }
    if (value instanceof Error) {
      return {
        name: redact(value.name, knownSecrets),
        message: redact(value.message, knownSecrets),
      };
    }
    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return '[循环引用]';
      }
      seen.add(value);
      const result = Array.isArray(value)
        ? value.map(item => clean(item, '', seen))
        : Object.fromEntries(
            Object.entries(value).map(([name, item]) => [
              redact(name, knownSecrets),
              clean(item, name, seen),
            ]),
          );
      seen.delete(value);
      return result;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  };
  const remember = (entry: LogEntry) => {
    buffer.push(entry);
    if (buffer.length > capacity) {
      buffer.shift();
    }
  };
  const write = (
    level: LogLevel,
    message: string,
    fields?: Record<string, unknown>,
  ) => {
    const now = clock.now();
    const entry: LogEntry = {
      at: now.toISOString(),
      level,
      message: redact(message, knownSecrets),
      ...(fields
        ? {
            fields: clean(fields, '', new WeakSet()) as Record<string, unknown>,
          }
        : {}),
    };
    remember(entry);
    const files = options.files;
    if (files) {
      const day = entry.at.slice(0, 10);
      const oldestDay = new Date(now.getTime() - 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);

      queue = queue
        .then(async () => {
          if (lastPrunedDay !== day) {
            await files.prune(oldestDay);
            lastPrunedDay = day;
          }
          await files.append(day, redact(JSON.stringify(entry), knownSecrets));
        })
        .catch(() => {
          fileWriteFailed = true;
          // 文件系统错误本身可能带私有路径或凭据，日志只保留固定说明。
          remember({
            at: entry.at,
            level: 'warn',
            message: '日志文件写入失败，已保留内存日志',
          });
        });
    }
  };

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    registerSecret(value) {
      if (value) {
        knownSecrets.add(value);
      }
    },
    entries: () =>
      buffer.map(entry => ({
        ...entry,
        message: redact(entry.message, knownSecrets),
        ...(entry.fields
          ? {
              fields: clean(entry.fields, '', new WeakSet()) as Record<
                string,
                unknown
              >,
            }
          : {}),
      })),
    flush: () => queue,
    async export() {
      await queue;
      if (options.files && !fileWriteFailed) {
        try {
          return redact(await options.files.readAll(), knownSecrets);
        } catch {
          // 保留可导出的内存日志，避免导出失败时再次记录原始错误。
          remember({
            at: clock.now().toISOString(),
            level: 'warn',
            message: '日志文件读取失败，已导出内存日志',
          });
        }
      }
      return redact(
        buffer.map(entry => JSON.stringify(entry)).join('\n') +
          (buffer.length ? '\n' : ''),
        knownSecrets,
      );
    },
  };
}
