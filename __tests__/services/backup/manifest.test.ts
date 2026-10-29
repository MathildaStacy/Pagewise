import { sanitizeSetting, validateManifest } from '@services/backup';
const manifest = {
  format: 'pagewise-backup',
  version: 1,
  schemaVersion: 1,
  appVersion: '0.0.1',
  createdAt: '2026-10-29T00:00:00Z',
  books: [
    {
      id: 'book',
      title: 'Book',
      sha256: 'hash',
      format: 'pdf',
      originalIncluded: false,
    },
  ],
};
it('validates manifest versions and rejects ambiguous or unsafe book paths', () => {
  expect(validateManifest(manifest, 1)).toEqual(manifest);
  for (const value of [
    null,
    {},
    { ...manifest, schemaVersion: 2 },
    { ...manifest, version: 2 },
    { ...manifest, createdAt: 'bad' },
    { ...manifest, books: [manifest.books[0], manifest.books[0]] },
    { ...manifest, books: [{ ...manifest.books[0], id: '../outside' }] },
    {
      ...manifest,
      books: [{ ...manifest.books[0], imageFiles: ['images/../outside'] }],
    },
    {
      ...manifest,
      books: [{ ...manifest.books[0], imageFiles: ['/absolute/file'] }],
    },
  ])
    expect(() => validateManifest(value, 1)).toThrow();
});
it('removes secret settings and nested credential fields while preserving preferences', () => {
  expect(sanitizeSetting('ai.key.x', '"secret"')).toBeNull();
  expect(sanitizeSetting('mineru.token', '"secret"')).toBeNull();
  expect(sanitizeSetting('data', 'invalid')).toBeNull();
  expect(
    sanitizeSetting('unknown', JSON.stringify('Bearer private-value')),
  ).toBeNull();
  expect(
    JSON.parse(
      sanitizeSetting(
        'prefs',
        JSON.stringify({
          keyTail: '1234',
          tokenTail: '9876',
          apiKey: 'secret',
          extra: 'go slowly',
          list: [{ password: 'secret', name: 'ok' }],
        }),
      )!,
    ),
  ).toEqual({
    keyTail: '',
    tokenTail: '',
    extra: 'go slowly',
    list: [{ name: 'ok' }],
  });
});
