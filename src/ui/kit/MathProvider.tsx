import { createContext, useContext, type PropsWithChildren } from 'react';
/** Structural port: the kit knows neither the rendering service nor its storage. */
export interface FormulaRender {
  svg: string;
  width: number;
  height: number;
  baseline: number;
}
export interface FormulaRenderer {
  render(tex: string, display: boolean): Promise<FormulaRender>;
}
const MathContext = createContext<FormulaRenderer | null>(null);
export function MathProvider({
  renderer,
  children,
}: PropsWithChildren<{ renderer: FormulaRenderer }>) {
  return (
    <MathContext.Provider value={renderer}>{children}</MathContext.Provider>
  );
}
export function useMathRenderer(): FormulaRenderer | null {
  return useContext(MathContext);
}
