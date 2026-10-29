import { createContext, useContext, type PropsWithChildren } from 'react';

export type TabName = 'Shelf' | 'Review' | 'Notes' | 'Me';
export type AppRoute =
  | { name: 'Tabs'; tab?: TabName }
  | { name: 'BookMap' | 'ParseProgress' | 'NotesBook'; bookId: string }
  | {
      name: 'Study';
      bookId: string;
      mode?: 'read' | 'listen';
      sectionId?: string;
      blockRef?: string;
      question?: string;
      stuckId?: number;
    }
  | { name: 'Reader'; bookId: string; sectionId?: string; blockRef?: string }
  | { name: 'NoteDetail'; bookId: string; sectionId: string }
  | { name: 'ImportSettings'; draftId: string }
  | { name: 'SectionDone'; bookId: string; sectionId: string; draftId: string }
  | { name: 'MeAIEdit'; providerId?: string }
  | {
      name:
        | 'ReviewSession'
        | 'MeMineru'
        | 'MeAI'
        | 'MePrefs'
        | 'MeAppearance'
        | 'MeStorage'
        | 'About'
        | 'SkinGallery';
    };

export interface AppNav {
  open(route: AppRoute): void;
  replace(route: AppRoute): void;
  back(): void;
  enterDemo(): void;
  exitDemo(): void;
}
const NavigationContext = createContext<AppNav | null>(null);
export function AppNavProvider({
  value,
  children,
}: PropsWithChildren<{ value: AppNav }>) {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}
export function useAppNav(): AppNav {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('请在 AppNavProvider 内使用导航');
  return value;
}
