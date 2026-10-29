import { createEventBus } from '@app/events';

test('event topics stay isolated and unsubscribe is idempotent', () => {
  const events = createEventBus();
  const cards = jest.fn();
  const stuck = jest.fn();
  const off = events.subscribe('cards.changed', cards);
  events.subscribe('stuck.changed', stuck);
  events.emit('cards.changed', { bookId: 'b1' });
  expect(cards).toHaveBeenCalledWith({ bookId: 'b1' });
  expect(stuck).not.toHaveBeenCalled();
  off();
  off();
  events.emit('cards.changed', {});
  expect(cards).toHaveBeenCalledTimes(1);
});

test('listeners may unsubscribe themselves during delivery', () => {
  const events = createEventBus();
  const seen: string[] = [];
  const off = events.subscribe('section.status', value => {
    seen.push(value.sectionId);
    off();
  });
  events.subscribe('section.status', value => seen.push(value.status));
  events.emit('section.status', {
    bookId: 'b1',
    sectionId: '3.5.2',
    status: 'done',
  });
  events.emit('section.status', {
    bookId: 'b1',
    sectionId: '3.5.3',
    status: 'learning',
  });
  expect(seen).toEqual(['3.5.2', 'done', 'learning']);
});

test('separate buses do not share subscriptions', () => {
  const callback = jest.fn();
  createEventBus().subscribe('book.parse', callback);
  createEventBus().emit('book.parse', { bookId: 'b', status: 'ready' });
  expect(callback).not.toHaveBeenCalled();
});
