import { useEffect, useState } from 'react';
import { useContainer } from '@app/ContainerProvider';
import { loadReview } from '@app/usecases/review';

export function useReviewBadge(): number {
  const container = useContainer();
  const [due, setDue] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      loadReview(container)
        .then(data => {
          if (active) setDue(data.stats.due);
        })
        .catch(() => {});
    refresh();
    const unsubscribe = container.events.subscribe('cards.changed', () => {
      refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [container]);
  return due;
}
