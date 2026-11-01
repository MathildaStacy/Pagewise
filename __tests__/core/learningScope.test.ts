import type { Section } from '@core/types';
import {
  learningLeaves,
  learningSelection,
  sectionRole,
} from '@core/learningScope';
import { structureIssues } from '@core/map/structureChecks';

const section = (id: string, patch: Partial<Section> = {}): Section => ({
  book_id: 'book',
  id,
  parent_id: null,
  level: 1,
  ord: 0,
  no: null,
  title: id,
  is_leaf: true,
  block_from: 1,
  block_to: 2,
  page_from: 1,
  page_to: 1,
  chars: 1000,
  parts: 1,
  status: 'new',
  summary: null,
  guide: null,
  source: 'auto',
  flag: null,
  flag_detail: null,
  merged_into: null,
  ...patch,
});

it('separates references and optional material without excluding substantive introductions or exercises', () => {
  const titles = [
    'Contents',
    'Index',
    'Bibliography',
    '参考文献',
    'Preface',
    'Appendix A',
    'Introduction',
    'Exercises',
    'Index structures',
  ];
  const all = titles.map((title, ord) => section(title, { ord }));
  expect(learningLeaves(all).map(s => s.title)).toEqual([
    'Introduction',
    'Exercises',
    'Index structures',
  ]);
  expect(sectionRole(section('Principles', { chars: 50 }), 'Principles')).toBe(
    'reference',
  );
  expect(
    sectionRole(
      section('1', { title: 'Principles', parent_id: 'ch1', chars: 50 }),
      'Principles',
    ),
  ).toBe('body');
});

it('inherits scope through nested sections and allows a specific leaf to override it', () => {
  const all = [
    section('refs', { title: 'Bibliography', is_leaf: false }),
    section('group', { parent_id: 'refs', is_leaf: false }),
    section('entry', { parent_id: 'group' }),
    section('body'),
  ];
  expect(learningLeaves(all).map(s => s.id)).toEqual(['body']);
  expect(learningLeaves(all, { refs: 'include' }).map(s => s.id)).toEqual([
    'entry',
    'body',
  ]);
  expect(
    learningLeaves(all, { refs: 'include', entry: 'exclude' }).map(s => s.id),
  ).toEqual(['body']);
  expect(learningSelection(all).get('entry')?.role).toBe('reference');
});

it('uses a cover bookmark when the imported filename differs from the real title, and recognizes publisher front matter', () => {
  const all = [
    section('cover', { title: 'Cover', block_from: null, chars: 0 }),
    section('title', {
      title: 'Machine Learning for Trading',
      chars: 221,
      ord: 1,
    }),
    section('copyright', { title: 'Copyrightpage', is_leaf: false, ord: 2 }),
    section('rights', { parent_id: 'copyright', ord: 3 }),
    section('authors', { title: 'Contributors', is_leaf: false, ord: 4 }),
    section('author', { parent_id: 'authors', ord: 5 }),
    section('ch1', {
      title: 'The Process Is Your Edge',
      no: '1',
      ord: 6,
      page_from: 42,
      page_to: 43,
    }),
  ];
  expect(learningLeaves(all, {}, 'ML-Trading').map(s => s.id)).toEqual(['ch1']);
  expect(
    learningLeaves(all, { title: 'include' }, 'ML-Trading').map(s => s.id),
  ).toEqual(['title', 'ch1']);
});

it('skips title-page and preface groups before chapter 1 while keeping the same topic inside the book', () => {
  const all = [
    section('title', { title: 'Artificial Intelligence', chars: 414 }),
    section('front', {
      title: 'Artificial Intelligence',
      is_leaf: false,
      ord: 1,
    }),
    section('preface', { title: 'Preface', parent_id: 'front', ord: 2 }),
    section('edition', {
      title: 'New to this edition',
      parent_id: 'front',
      ord: 3,
    }),
    section('ch1', { title: 'Introduction', no: '1', ord: 4 }),
    section('topic', { title: 'Artificial Intelligence', ord: 5 }),
  ];
  const title = 'Artificial Intelligence A Modern Approach';
  expect(learningLeaves(all, {}, title).map(s => s.id)).toEqual([
    'ch1',
    'topic',
  ]);
  expect(
    learningLeaves(all, { edition: 'include' }, title).map(s => s.id),
  ).toEqual(['edition', 'ch1', 'topic']);
  expect(
    learningLeaves(
      all.filter(s => s.id !== 'ch1'),
      {},
      title,
    ).map(s => s.id),
  ).toEqual(['title', 'edition', 'topic']);
});

it('flags a missing first numbered subsection at its preceding introduction without fabricating a title', () => {
  const all = [
    section('intro', { title: '本节导读', parent_id: '20.3', ord: 1 }),
    section('20.3.2', { no: '20.3.2', parent_id: '20.3', ord: 2 }),
    section('20.3.3', { no: '20.3.3', parent_id: '20.3', ord: 3 }),
  ];
  expect(structureIssues(all)).toEqual([
    {
      id: 'gap:20.3.2',
      message: '20.3.1 可能缺失，请对照相邻原文',
      sectionId: 'intro',
    },
  ]);
  expect(all).toHaveLength(3);
});

it('reports duplicate numbering as an original-source ambiguity and leaves normal sequences alone', () => {
  const all = [
    section('a', { no: '26.1' }),
    section('b', { no: '26.2', ord: 1 }),
    section('c', { no: '26.2', ord: 2 }),
  ];
  expect(structureIssues(all).map(issue => issue.message)).toEqual([
    '26.2 编号重复，请核对原书是否也重复',
  ]);
  expect(structureIssues(all.slice(0, 2))).toEqual([]);
});
