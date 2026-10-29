import { resolveBookImageUri, resolveStudyBlockImage } from '@app/bookImages';
import type { Block } from '@core/types';
import type { Container } from '@app/container';

it('resolves portable PDF and EPUB image paths to the current book directory', () => {
  expect(resolveBookImageUri('images/p103_1.jpg', '/docs/books/book-1')).toBe(
    'file:///docs/books/book-1/images/p103_1.jpg',
  );
  expect(resolveBookImageUri('./images/图 1.svg', '/docs/books/book-1')).toBe(
    'file:///docs/books/book-1/images/图 1.svg',
  );
  expect(resolveBookImageUri('/cache/preview.png', '/docs/books/book-1')).toBe(
    'file:///cache/preview.png',
  );
  for (const uri of [
    'https://example.com/image.png',
    'data:image/png;base64,AA==',
    'file:///cache/a.png',
    'content://images/1',
  ])
    expect(resolveBookImageUri(uri, '/docs/books/book-1')).toBe(uri);
});

it('preserves stored blocks and demo images while resolving absolute local images', () => {
  const c = { mode: 'demo' } as Container;
  const image = { image_path: '/cache/image.png' } as Block;
  expect(resolveStudyBlockImage(c, 'book-1', image).image_path).toBe(
    'file:///cache/image.png',
  );
  expect(image.image_path).toBe('/cache/image.png');
  const demo = { image_path: 'demo/image.svg' } as Block;
  expect(resolveStudyBlockImage(c, 'book-1', demo)).toBe(demo);
  const noImage = { image_path: null } as Block;
  expect(resolveStudyBlockImage(c, 'book-1', noImage)).toBe(noImage);
});
