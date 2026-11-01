import { cleanBookAuthor, cleanBookTitle } from '@core/bookMetadata';

it('removes a repeated download suffix without changing ordinary book titles', () => {
  expect(
    cleanBookTitle(
      '打开黑箱.pdf -- 打开黑箱.pdf -- 0123456789abcdef -- Archive',
    ),
  ).toBe('打开黑箱');
  expect(cleanBookTitle('Data -- A Practical Guide')).toBe(
    'Data -- A Practical Guide',
  );
  expect(cleanBookTitle('打开黑箱_pdf -- 打开黑箱_pdf -- archive')).toBe(
    '打开黑箱',
  );
  expect(cleanBookTitle('Machine Learning (2nd edition)')).toBe(
    'Machine Learning (2nd edition)',
  );
  expect(cleanBookAuthor('Unknown')).toBe('');
  expect(cleanBookAuthor('Anonymous')).toBe('Anonymous');
  expect(cleanBookAuthor(null)).toBe('');
});
