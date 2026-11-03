import { parseBookTable } from '@app/readingTable';

it('keeps headers above the right values when the source combines rows and columns', () => {
  const table = parseBookTable(
    '',
    '<table><tr><th rowspan="2">Model</th><th colspan="2">Scores</th></tr><tr><th>Train</th><th>Test</th></tr><tr><td>A</td><td>0.9</td><td>0.8</td></tr></table>',
  )!;
  expect(table).toMatchObject({ rows: 3, columns: 3 });
  expect(table.cells.find(cell => cell.text === 'Model')).toMatchObject({
    row: 0,
    col: 0,
    rowSpan: 2,
  });
  expect(table.cells.find(cell => cell.text === 'Scores')).toMatchObject({
    row: 0,
    col: 1,
    colSpan: 2,
  });
  expect(table.cells.find(cell => cell.text === 'Train')).toMatchObject({
    row: 1,
    col: 1,
  });
  expect(table.cells.find(cell => cell.text === 'Test')).toMatchObject({
    row: 1,
    col: 2,
  });
  expect(table.cells.find(cell => cell.text === '0.8')).toMatchObject({
    row: 2,
    col: 2,
  });
});

it('preserves scripts, math, emphasis and decoded entities without executing source HTML', () => {
  const table = parseBookTable(
    '',
    '<table><tr><td><b>x<sub>i</sub></b> &amp; $y^2$<br>second</td></tr></table>',
  )!;
  expect(table.cells[0].text).toBe('**x<sub>i</sub>** & $y^2$\nsecond');
  expect(parseBookTable('| A | B |\n|---|---|\n| 1 | 2 |')).toMatchObject({
    rows: 2,
    columns: 2,
  });
});
