import {
  readFile,
  copyFile,
  mkdir,
  readdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createEpubParser, resolveEpubPath, type EpubIo } from '@services/epub';
const fixture = path.resolve(__dirname, '../../../fixtures/epub-synthetic');
let temp: string;
beforeEach(async () => {
  temp = await mkdtemp(path.join(os.tmpdir(), 'pagewise-epub-'));
});
afterEach(async () => {
  await rm(temp, { recursive: true, force: true });
});
async function copyTree(source: string, dest: string) {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name),
      to = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else await copyFile(from, to);
  }
}
function io(version = 'epub3'): EpubIo {
  return {
    unzip: jest.fn(async (_source, dest) =>
      copyTree(path.join(fixture, version), dest),
    ),
    readText: jest.fn(file => readFile(file, 'utf8')),
    mkdir: jest.fn(async dir => {
      await mkdir(dir, { recursive: true });
    }),
    copyFile: jest.fn(copyFile),
  };
}
it('reads EPUB 3 OPF metadata, nav hierarchy, percent-encoded anchors and cover without extracting twice', async () => {
  const files = io(),
    parser = createEpubParser(files),
    info = await parser.inspect('synthetic.epub', temp);
  expect(info).toMatchObject({
    title: 'A Synthetic Companion',
    author: '甲、乙',
    language: 'zh',
    identifier: 'urn:pagewise:synthetic3',
    opfPath: 'OEBPS/package.opf',
  });
  expect(info.coverPath).toBe(path.join(temp, 'epub/OEBPS/images/figure.svg'));
  expect(info.spine.map(item => item.idref)).toEqual(['a', 'b']);
  expect(info.toc[0]).toMatchObject({
    title: 'Part I Basics',
    path: null,
    children: [
      {
        title: '1.1 Introduction',
        path: 'OEBPS/text/a.xhtml',
        anchor: 'intro',
      },
      { title: '1.2 Details', anchor: 'details' },
    ],
  });
  expect(info.toc[1].anchor).toBe('原理');
  await parser.parse('synthetic.epub', temp, 'book');
  expect(files.unzip).toHaveBeenCalledTimes(1);
});
it('converts spine XHTML to sequential location-based blocks with bold, lists, code, images, captions, tables and math', async () => {
  const files = io(),
    parser = createEpubParser(files),
    book = await parser.parse('synthetic.epub', temp, 'book'),
    blocks = book.blocks;
  expect(blocks.map(block => block.seq)).toEqual(
    Array.from({ length: blocks.length }, (_, i) => i + 1),
  );
  expect(
    blocks.every(
      block =>
        block.page === null &&
        block.x0 === null &&
        block.loc &&
        block.book_id === 'book',
    ),
  ).toBe(true);
  expect(blocks.find(block => block.text?.includes('bold'))?.text).toBe(
    'A **bold** idea & an example.',
  );
  expect(
    blocks.filter(block => block.type === 'list').map(block => block.text),
  ).toEqual([
    '- First **step**\n  - Nested item\n- Second step',
    '1. Ordered one\n2. Ordered two',
  ]);
  expect(blocks.find(block => block.type === 'code')?.text).toBe(
    'const value = 2;\n  return value;',
  );
  expect(blocks.find(block => block.type === 'caption')?.text).toContain(
    'synthetic square',
  );
  const table = blocks.find(block => block.type === 'table')!;
  expect(table.text).toBe('Symbol\tMeaning\nx\tinput');
  expect(table.html).toContain('<table id="table">');
  expect(
    blocks.filter(block => block.type === 'equation').map(block => block.latex),
  ).toEqual(['x^2 + y^2', 'E=mc^2']);
  expect(blocks.some(block => block.text?.includes('$a+b$'))).toBe(true);
  expect(blocks.filter(block => block.type === 'image')).toHaveLength(3);
  expect(files.copyFile).toHaveBeenCalledTimes(1);
  expect(
    blocks
      .filter(block => block.type === 'image')
      .every(
        block => block.image_path === path.join(temp, 'images/image1.svg'),
      ),
  ).toBe(true);
  expect(blocks.some(block => block.text === 'Before')).toBe(true);
  expect(blocks.some(block => block.text === 'after.')).toBe(true);
  expect(JSON.stringify(blocks)).not.toContain('ignored()');
});
it('builds bookmark sections from nav anchor ranges, keeps short TOC sections and splits long sections safely', async () => {
  const book = await createEpubParser(io()).parse('book.epub', temp, 'book'),
    intro = book.sections.find(section => section.id === '1.1')!,
    details = book.sections.find(section => section.id === '1.2')!,
    chapter = book.sections.find(section => section.id === 'ch2')!;
  expect(intro.parent_id).toBe('u1');
  expect(intro.is_leaf).toBe(true);
  expect(details).toMatchObject({
    source: 'bookmark',
    is_leaf: true,
    merged_into: null,
  });
  expect(intro.block_to).toBe(details.block_from! - 1);
  expect(
    book.blocks.find(block => block.seq === details.block_from)?.text,
  ).toBe('1.2 Details');

  expect(chapter.parts).toBeGreaterThan(1);
  expect(
    book.blocks
      .filter(block => block.section_id === details.id)
      .every(block => block.loc?.startsWith('1.2 Details ·')),
  ).toBe(true);
  expect(book.warnings).toEqual([]);
});
it('uses EPUB 2 NCX and preserves spine order, nested links, non-linear text and MathML fallback', async () => {
  const files = io('epub2'),
    parser = createEpubParser(files),
    info = await parser.inspect('two.epub', temp),
    book = await parser.parse('two.epub', temp, 'epub2');
  expect(info).toMatchObject({
    title: 'Synthetic EPUB 2',
    author: 'Pagewise',
    coverPath: path.join(temp, 'epub/cover.svg'),
  });
  expect(info.toc[0]).toMatchObject({
    title: 'Chapter 1 First',
    children: [{ title: '1.1 Child', anchor: 'child' }],
  });
  expect(book.sections.map(section => section.id)).toEqual([
    'ch1',
    '1.1',
    'ch2',
  ]);
  expect(book.blocks.find(block => block.type === 'equation')?.latex).toBe(
    'x+1',
  );
  expect(book.blocks.at(-1)?.text).toContain('non-linear');
});
it('falls back to spine files when no TOC exists and reports missing images and anchor locations', async () => {
  const files = io('epub2'),
    parser = createEpubParser(files);
  await parser.inspect('two.epub', temp);
  const opf = path.join(temp, 'epub/content.opf'),
    original = await readFile(opf, 'utf8');
  await writeFile(
    opf,
    original
      .replace(
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '',
      )
      .replace(' toc="ncx"', ''),
  );
  const one = path.join(temp, 'epub/chapters/one.xhtml');
  await writeFile(
    one,
    (
      await readFile(one, 'utf8')
    ).replace(
      '</body>',
      '<p><img src="missing.png" alt="missing"/></p></body>',
    ),
  );
  const fresh = createEpubParser({ ...files, unzip: jest.fn(async () => {}) }),
    book = await fresh.parse('two.epub', temp, 'fallback');
  expect(book.sections.map(section => section.title)).toEqual([
    'First',
    'Second',
  ]);
  expect(book.warnings).toContainEqual({
    code: 'missing_image',
    path: 'missing.png',
  });
  expect(book.blocks.find(block => block.type === 'image')).toMatchObject({
    image_path: null,
    text: 'missing',
  });
});
it('reports missing nav anchors but keeps their source file readable and avoids external nav links', async () => {
  const files = io(),
    parser = createEpubParser(files);
  await parser.inspect('book.epub', temp);
  const nav = path.join(temp, 'epub/OEBPS/nav.xhtml');
  await writeFile(
    nav,
    (await readFile(nav, 'utf8'))
      .replace('#details', '#missing')
      .replace(
        '</ol></nav>',
        '<li><a href="https://example.com">External</a></li></ol></nav>',
      ),
  );
  const book = await createEpubParser({
    ...files,
    unzip: jest.fn(async () => {}),
  }).parse('book.epub', temp, 'book');
  expect(book.warnings).toContainEqual({
    code: 'missing_toc_anchor',
    path: 'OEBPS/text/a.xhtml#missing',
  });
  expect(book.sections.some(section => section.title === 'External')).toBe(
    false,
  );
});
it('normalizes relative paths and rejects paths outside the extracted archive', () => {
  expect(
    resolveEpubPath('OEBPS/text/one.xhtml', '../images/a%20b.svg#id%20x'),
  ).toEqual({ path: 'OEBPS/images/a b.svg', anchor: 'id x' });
  expect(resolveEpubPath('one.xhtml', '#here')).toEqual({
    path: 'one.xhtml',
    anchor: 'here',
  });
  expect(resolveEpubPath('OPS/one.xhtml', './two.xhtml?ignored=1')).toEqual({
    path: 'OPS/two.xhtml',
    anchor: null,
  });
  for (const value of [
    '../../outside',
    '/absolute',
    'https://example.com/a',
    '%2fabsolute',
    'bad%ZZ',
    'bad%5cpath',
  ])
    expect(() => resolveEpubPath('one.xhtml', value)).toThrow();
});
it('exposes clear errors for missing containers, metadata and empty body content', async () => {
  const files = io(),
    bad = {
      ...files,
      unzip: jest.fn(async () => {}),
      readText: jest.fn(async () => {
        throw new Error('missing');
      }),
    };
  await expect(
    createEpubParser(bad).inspect('book.epub', temp),
  ).rejects.toMatchObject({ code: 'invalid_archive' });
  const parser = createEpubParser(files);
  await parser.inspect('book.epub', temp);
  await writeFile(
    path.join(temp, 'epub/OEBPS/package.opf'),
    '<package><metadata/></package>',
  );
  await expect(
    createEpubParser({ ...files, unzip: jest.fn(async () => {}) }).inspect(
      'book.epub',
      temp,
    ),
  ).rejects.toMatchObject({ code: 'invalid_metadata' });
  await files.unzip('book.epub', path.join(temp, 'epub'));
  for (const name of ['a', 'b'])
    await writeFile(
      path.join(temp, `epub/OEBPS/text/${name}.xhtml`),
      '<html><body/></html>',
    );
  await expect(
    createEpubParser({ ...files, unzip: jest.fn(async () => {}) }).parse(
      'book.epub',
      temp,
      'empty',
    ),
  ).rejects.toMatchObject({ code: 'unreadable_spine' });
});
it('does not retain failed inspections, allowing the same archive to retry after IO recovery', async () => {
  const files = io();
  let failed = false;
  const unzip = jest.fn(async (source: string, dest: string) => {
    if (!failed) {
      failed = true;
      throw new Error('disk');
    }
    await files.unzip(source, dest);
  });
  const parser = createEpubParser({ ...files, unzip });
  await expect(parser.inspect('book.epub', temp)).rejects.toThrow('disk');
  expect((await parser.inspect('book.epub', temp)).title).toBe(
    'A Synthetic Companion',
  );
  expect(unzip).toHaveBeenCalledTimes(2);
});

it('keeps inline anchor targets on their emitted blocks and retains SVG image anchors', async () => {
  const files = io(),
    parser = createEpubParser(files);
  await parser.inspect('book.epub', temp);
  const nav = path.join(temp, 'epub/OEBPS/nav.xhtml');
  await writeFile(
    nav,
    '<html xmlns:epub="epub"><nav epub:type="toc"><ol><li><a href="text/a.xhtml#definition">Definition</a></li><li><a href="text/a.xhtml#figure">Figure</a></li><li><a href="text/b.xhtml#原理">Math</a></li></ol></nav></html>',
  );
  const result = await createEpubParser({
    ...files,
    unzip: jest.fn(async () => {}),
  }).parse('book.epub', temp, 'book');
  const definition = result.sections.find(
    section => section.title === 'Definition',
  )!;
  expect(
    result.blocks.find(block => block.seq === definition.block_from)?.text,
  ).toContain('definition anchor');
  const figure = result.sections.find(section => section.title === 'Figure')!;
  expect(
    result.blocks.find(block => block.seq === figure.block_from)?.type,
  ).toBe('image');
});
it('accepts deeply wrapped navigation lists and falls back from empty nav to NCX', async () => {
  const files = io('epub2'),
    parser = createEpubParser(files);
  await parser.inspect('book.epub', temp);
  const opf = path.join(temp, 'epub/content.opf');
  await writeFile(
    opf,
    (
      await readFile(opf, 'utf8')
    ).replace(
      '<manifest>',
      '<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ),
  );
  await writeFile(
    path.join(temp, 'epub/nav.xhtml'),
    '<html><nav><div><ol/></div></nav></html>',
  );
  const info = await createEpubParser({
    ...files,
    unzip: jest.fn(async () => {}),
  }).inspect('book.epub', temp);
  expect(info.toc[0].title).toBe('Chapter 1 First');
});
it('keeps readable spine content when every TOC link points at an unavailable file', async () => {
  const files = io('epub2'),
    parser = createEpubParser(files);
  await parser.inspect('book.epub', temp);
  await writeFile(
    path.join(temp, 'epub/toc.ncx'),
    '<ncx><navMap><navPoint><navLabel><text>Unavailable</text></navLabel><content src="missing.xhtml"/></navPoint></navMap></ncx>',
  );
  const result = await createEpubParser({
    ...files,
    unzip: jest.fn(async () => {}),
  }).parse('book.epub', temp, 'book');
  expect(result.sections.map(section => section.title)).toEqual([
    'First',
    'Second',
  ]);
  expect(result.blocks.every(block => block.section_id !== null)).toBe(true);
});
