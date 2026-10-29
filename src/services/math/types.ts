/** Dimensions are MathJax ex units; presentation converts to dp using the current type size. */
export interface MathRender {
  svg: string;
  width: number;
  height: number;
  baseline: number;
}
export interface MathRenderer {
  render(tex: string, display: boolean): Promise<MathRender>;
}
/** Storage is injected by app/math.ts; this service does not depend on the data layer. */
export interface MathCacheStore {
  get(key: string): Promise<MathRender | null>;
  put(key: string, value: MathRender): Promise<void>;
  touch(key: string): Promise<void>;
  prune(maxRows: number): Promise<void>;
}
export interface MathBridge extends MathRenderer {
  attach(send: (payload: string) => void): () => void;
  receive(payload: string): void;
  fail(): void;
  close(): void;
}
