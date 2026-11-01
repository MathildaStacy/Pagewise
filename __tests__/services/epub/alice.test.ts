import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createEpubParser } from '@services/epub';
import { pageLabel } from '@core/ids';
import { learningLeaves } from '@core/learningScope';
const execute = promisify(execFile);
it('parses the public Gutenberg Alice EPUB with the real ZIP, OPF, nav, XHTML and image files', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'pagewise-alice-'));
  try {
    const parser = createEpubParser({
      unzip: async (source, dest) => {
        await mkdir(dest, { recursive: true });
        await execute('/usr/bin/unzip', ['-q', '-o', source, '-d', dest]);
      },
      readText: file => readFile(file, 'utf8'),
      mkdir: async dir => {
        await mkdir(dir, { recursive: true });
      },
      copyFile,
    });
    const source = path.resolve(__dirname, '../../../fixtures/epub/alice.epub'),
      info = await parser.inspect(source, folder),
      result = await parser.parse(source, folder, 'alice');
    expect(info.title.toLowerCase()).toContain('alice');
    expect(info.author).toContain('Carroll');
    expect(info.spine.length).toBeGreaterThan(10);
    expect(result.blocks.length).toBeGreaterThan(100);
    expect(
      result.sections.filter(section => /chapter/i.test(section.title)).length,
    ).toBeGreaterThanOrEqual(12);
    expect(
      result.blocks.every(
        block => block.page === null && block.loc && block.section_id,
      ),
    ).toBe(true);
    expect(
      result.blocks.filter(block => block.type === 'image').length,
    ).toBeGreaterThan(0);
    for (const image of result.blocks.filter(
      block => block.type === 'image' && block.image_path,
    )) {
      expect((await stat(image.image_path!)).size).toBeGreaterThan(0);
    }
    expect(
      result.sections.every(section => section.source === 'bookmark'),
    ).toBe(true);
    expect(result.parts.length).toBeGreaterThan(10);
    const route = learningLeaves(result.sections, {}, info.title);
    expect(route).toHaveLength(12);
    expect(route[0].title).toContain('CHAPTER I.');
    expect(route[11].title).toContain('CHAPTER XII.');
    expect(route.every(section => /^CHAPTER /u.test(section.title))).toBe(true);
    const license = result.sections.find(section =>
      /GUTENBERG.*LICENSE/u.test(section.title),
    )!;
    expect(license).toBeDefined();
    expect(
      learningLeaves(result.sections, { [license.id]: 'include' }, info.title),
    ).toHaveLength(13);
    expect(
      pageLabel({ format: 'epub', page_offset: 0 }, null, result.blocks[0].loc),
    ).toContain(' · ');
    expect(result.warnings).toEqual([]);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}, 20000);
