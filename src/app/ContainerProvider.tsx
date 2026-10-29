import { createContext, useContext, type PropsWithChildren } from 'react';
import type { Container } from './container';

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({
  value,
  children,
}: PropsWithChildren<{ value: Container }>) {
  return (
    <ContainerContext.Provider value={value}>
      {children}
    </ContainerContext.Provider>
  );
}

/** 页面容器 / VM 使用；展示层不能直接读取组合根。 */
export function useContainer(): Container {
  const value = useContext(ContainerContext);
  if (!value) {
    throw new Error('请在 ContainerProvider 内使用 ViewModel');
  }
  return value;
}
