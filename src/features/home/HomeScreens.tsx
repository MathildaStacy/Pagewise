import { useAppNav } from '@features/nav';
import { useEffect } from 'react';
import { useContainer } from '@app/ContainerProvider';
import { useSkin } from '@ui/kit';
import { TodayView } from '@ui/screens/TodayView';
import { AskShelfView } from '@ui/screens/AskShelfView';
import { LearningStatsView } from '@ui/screens/LearningStatsView';
import { WelcomeView } from '@ui/screens/WelcomeView';
import { useAskVM, useHomeVM, useWelcomeVM } from './useHomeVM';
export function TodayScreen() {
  return <TodayView {...useHomeVM()} />;
}
export function AskShelfScreen() {
  return <AskShelfView {...useAskVM()} />;
}
export function LearningStatsScreen() {
  const { state, intents } = useHomeVM();
  const nav = useAppNav();
  return <LearningStatsView state={state} intents={intents} back={nav.back} />;
}
export function WelcomeScreen() {
  return <WelcomeView {...useWelcomeVM()} />;
}
export function Win11SetupGate({ ready }: { ready: boolean }) {
  const c = useContainer(),
    nav = useAppNav(),
    { skin } = useSkin();
  useEffect(() => {
    if (!ready || skin.id !== 'win11' || c.mode === 'demo') return;
    let mounted = true;
    Promise.all([
      c.repos.settings.get('welcome.completed', false),
      c.repos.books.list(),
    ])
      .then(([completed, books]) => {
        if (mounted && !completed && !books.length)
          nav.open({ name: 'Welcome' });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [c, nav, ready, skin.id]);
  return null;
}
