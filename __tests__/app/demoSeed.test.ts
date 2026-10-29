import { createTestContainer, createTestDemoContainer } from '@app/testing';
import {
  demoRefBySourceId,
  remapDemoCitations,
  seedDemo,
} from '@app/demo/seed';
import { prototypeSource } from '@app/demo/source';
import { createHash } from 'node:crypto';
import { demoFigureAssets } from '@app/demo/figures';
import { loadStudyReader } from '@app/usecases/studyReader';
import { resolveStudyBlockImage } from '@app/bookImages';
import { parse } from '@core/markup';
import { validateCitations } from '@core/citations';

it('seeds the complete prototype map, stable marked blocks, four lesson steps and learning records', async () => {
  const c = await createTestDemoContainer();
  try {
    expect((await c.repos.books.list()).map(b => b.id)).toEqual([
      'aima',
      'slm',
      'ddia',
    ]);
    const sections = await c.repos.sections.tree('aima');
    expect(sections.filter(s => s.parent_id === 'ch3')).toHaveLength(6);
    const leaves = sections.filter(s => s.level === 3);
    expect(leaves).toHaveLength(26);
    const blocks = await c.repos.blocks.bySection('aima', '3.5.2');
    expect(blocks).toHaveLength(12);
    for (const b of await c.repos.blocks.range('aima', 0, 200000)) {
      expect(b.seq).toBeGreaterThanOrEqual(b.page! * 1000);
      expect(b.seq).toBeLessThan((b.page! + 1) * 1000);
      expect(b.text).toMatch(/^\[示意内容\]/);
    }
    const plan = (await c.repos.plans.get('aima', '3.5.2', 0))!;
    expect(plan.steps).toHaveLength(4);
    expect(
      plan.steps.flatMap(step =>
        blocks
          .filter(b => b.seq >= step.block_from && b.seq <= step.block_to)
          .map(b => b.seq),
      ),
    ).toEqual(blocks.map(b => b.seq));
    expect((await c.repos.cards.stats(c.clock.today())).total).toBe(
      prototypeSource.CARDS.length,
    );
    expect(await c.repos.notes.stuck.list()).toHaveLength(
      prototypeSource.STUCK.length,
    );
    expect(await c.repos.notes.highlights.list('aima')).toHaveLength(
      Object.keys(prototypeSource.HIGHLIGHTS).length,
    );
    for (const [id, qa] of Object.entries(prototypeSource.QA)) {
      expect(await c.repos.notes.qa.list('aima', id)).toHaveLength(qa.length);
    }
    const orderedLeaves = await c.repos.sections.leaves('aima');
    const all = await c.repos.blocks.range('aima', 0, 200000);
    expect(
      orderedLeaves.flatMap(s =>
        all
          .filter(b => b.seq >= s.block_from! && b.seq <= s.block_to!)
          .map(b => b.seq),
      ),
    ).toEqual(all.map(b => b.seq));
    for (const pin of await c.repos.notes.pins.list('aima')) {
      expect(await c.repos.blocks.get('aima', pin.block_seq)).toBeDefined();
      expect(pin.message_ids).toHaveLength(2);
    }
    expect(remapDemoCitations('[[b1021]] {{fig:f318}} [[b:999999]]')).toBe(
      `[[b:${demoRefBySourceId.b1021}]] [[fig:${demoRefBySourceId.f318}]] [[b:999999]]`,
    );
    await seedDemo(c.db, c.clock);
    expect(await c.repos.books.list()).toHaveLength(3);
    expect((await c.repos.cards.stats()).total).toBe(
      prototypeSource.CARDS.length,
    );
  } finally {
    await c.close();
  }
});

it('refuses to seed an existing library and rolls back a partially written batch', async () => {
  const c = await createTestContainer();
  try {
    await c.db.run(
      "CREATE TRIGGER fail_demo BEFORE INSERT ON card BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;",
    );
    await expect(seedDemo(c.db, c.clock)).rejects.toThrow('fixture failure');
    expect(await c.repos.books.list()).toEqual([]);
    expect(await c.repos.sections.tree('aima')).toEqual([]);
    expect(await c.repos.settings.get('demo.seed.version', null)).toBeNull();
    await c.db.run('DROP TRIGGER fail_demo');
    await c.repos.books.insert({
      id: 'real',
      sha256: 'real',
      title: '真实书库',
      format: 'pdf',
      size_bytes: 1,
      cover_color: '#000000',
      status: 'ready',
      created_at: c.clock.now().toISOString(),
    });
    await expect(seedDemo(c.db, c.clock)).rejects.toThrow('已有正式书籍');
    expect(await c.repos.books.list()).toHaveLength(1);
  } finally {
    await c.close();
  }
});

it('supplies local native PNG figures from the exact prototype SVGs while preserving source captions and citation checks', async () => {
  const c = await createTestDemoContainer();
  try {
    for (const [figureId, sourceId, sectionId] of [
      ['f318', 'b6', '3.5.2'],
      ['f310', 'b0903', '3.4.2'],
    ] as const) {
      const asset = demoFigureAssets[figureId],
        svg = prototypeSource.FIGS[figureId].svg,
        reader = await loadStudyReader(c, 'aima', sectionId),
        figure = reader.blocks.find(
          block => block.seq === demoRefBySourceId[sourceId],
        )!;
      expect(figure.type).toBe('image');
      expect(figure.text).toMatch(/^\[示意内容\] 图/);
      expect(figure.image_path).toBe(asset.uri);
      expect(resolveStudyBlockImage(c, 'aima', figure)).toBe(figure);
      expect(asset.svgSha256).toBe(
        createHash('sha256').update(svg).digest('hex'),
      );
      const png = Buffer.from(
        asset.uri.slice('data:image/png;base64,'.length),
        'base64',
      );
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
        asset.width,
        asset.height,
      ]);
      expect(asset.width).toBe(960);
      const doc = parse(`[[fig:${figure.seq}]]`);
      const verified = validateCitations(doc, {
        allowedRefs: [figure.seq],
        blocks: reader.blocks,
      });
      expect(verified.doc[0]).toMatchObject({ t: 'figure', verified: true });
      expect(
        validateCitations(doc, { allowedRefs: [], blocks: reader.blocks })
          .invalidCitations,
      ).toBe(1);
    }
  } finally {
    await c.close();
  }
});
