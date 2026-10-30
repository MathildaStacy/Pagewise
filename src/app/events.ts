export interface AppEvents {
  'source.refined': { bookId: string; sectionId: string };
  'cards.changed': { bookId?: string };
  'stuck.changed': { bookId: string; sectionId?: string };
  'section.status': {
    bookId: string;
    sectionId: string;
    status: 'new' | 'learning' | 'done';
  };
  'book.parse': {
    bookId: string;
    status: 'importing' | 'parsing' | 'paused' | 'ready' | 'failed';
  };
}

export interface EventBus {
  subscribe<K extends keyof AppEvents>(
    event: K,
    listener: (payload: AppEvents[K]) => void,
  ): () => void;
  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void;
}

export function createEventBus(): EventBus {
  const listeners = new Map<keyof AppEvents, Set<(payload: never) => void>>();
  return {
    subscribe(event, listener) {
      let subscribers = listeners.get(event);
      if (!subscribers) {
        subscribers = new Set();
        listeners.set(event, subscribers);
      }
      const callback = listener as (payload: never) => void;
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          listeners.delete(event);
        }
      };
    },
    emit(event, payload) {
      // 先取快照，订阅者在回调中退订不会改变这一轮的分发顺序。
      for (const listener of [...(listeners.get(event) ?? [])]) {
        listener(payload as never);
      }
    },
  };
}
