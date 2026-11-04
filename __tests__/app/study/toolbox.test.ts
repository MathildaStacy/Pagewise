import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { executeReadTool } from '@app/study/toolExec';
import { evaluateArithmetic } from '@core/arithmetic';
import { TOOL_DEFS } from '@services/ai/tools';

let c: Container;
beforeEach(async () => {
  c = await createTestDemoContainer();
});
afterEach(async () => {
  await c.close();
});

describe('get_blocks', () => {
  it('reads full source blocks by ref, reports missing refs and allows only what it read', async () => {
    const blocks = (await c.repos.blocks.bySection('aima', '3.4.2')).slice(
      0,
      2,
    );
    const read = await executeReadTool(c, 'aima', 'get_blocks', {
      ids: [...blocks.map(b => `b${b.seq}`), 'b999999'],
    });
    expect(read.allowedRefs).toEqual(blocks.map(b => b.seq));
    expect(read.output).toContain('{"missing":["b999999"]}');
    for (const block of blocks) {
      expect(read.output).toContain(`b${block.seq}`);
      if (block.text) expect(read.output).toContain(block.text.slice(0, 20));
    }
    expect(read.label).toBe('读取原文 · 2 段');
    expect(read.section).toBeUndefined();
  });

  it('reads the same projected text the reader shows', async () => {
    const [block] = await c.repos.blocks.bySection('aima', '3.5.2');
    const projected = await c.repos.blocks.reading.get('aima', block.seq);
    const [batched] = await c.repos.blocks.reading.byRefs('aima', [block.seq]);
    expect(batched).toEqual(projected);
  });

  it.each([
    [[]],
    [Array.from({ length: 13 }, (_, i) => `b${i + 1}`)],
    [['3.5.2']],
    [[42]],
  ])('rejects ids %j', async ids => {
    await expect(
      executeReadTool(c, 'aima', 'get_blocks', { ids }),
    ).rejects.toThrow();
  });
});

describe('get_outline', () => {
  it('lists a chapter and all its descendants with exact ids, and never grants citations', async () => {
    const sections = await c.repos.sections.tree('aima');
    const outline = await executeReadTool(c, 'aima', 'get_outline', {
      parent_id: '第3章',
    });
    const data = JSON.parse(outline.output) as {
      citable: boolean;
      sections: { id: string; parent_id: string | null; parts: number }[];
      next_offset: number | null;
    };
    expect(data.citable).toBe(false);
    expect(outline.allowedRefs).toEqual([]);
    const ids = data.sections.map(s => s.id);
    expect(ids[0]).toBe('ch3');
    expect(ids).toContain('3.5.2');
    expect(ids.every(id => id === 'ch3' || /^3\./.test(id))).toBe(true);
    expect(ids).toHaveLength(
      Math.min(
        50,
        sections.filter(s => s.id === 'ch3' || s.id.startsWith('3.')).length,
      ),
    );
    expect(outline.label).toContain('ch3');
  });

  it('pages the whole book fifty sections at a time', async () => {
    const total = (await c.repos.sections.tree('aima')).length;
    const first = JSON.parse(
      (await executeReadTool(c, 'aima', 'get_outline', {})).output,
    );
    expect(first.sections).toHaveLength(Math.min(50, total));
    expect(first.next_offset).toBe(total > 50 ? 50 : null);
    if (total > 50) {
      const second = JSON.parse(
        (await executeReadTool(c, 'aima', 'get_outline', { offset: 50 }))
          .output,
      );
      expect(second.sections[0].id).not.toBe(first.sections[0].id);
    }
  });

  it('reports an unknown chapter instead of listing the whole book', async () => {
    const outline = await executeReadTool(c, 'aima', 'get_outline', {
      parent_id: '99.9',
    });
    expect(JSON.parse(outline.output)).toEqual({ error: '章节不存在' });
  });
});

describe('calculate', () => {
  it('returns each value, the ascending order and every tie at the minimum and maximum', async () => {
    const result = await executeReadTool(c, 'aima', 'calculate', {
      expressions: [
        { label: 'A', expression: '1 + 50' },
        { label: 'B', expression: '10 + 99' },
        { label: 'C', expression: '(100 + 2) / 2' },
        { label: 'D', expression: '109' },
        { label: 'E', expression: 'Math.max(1,2)' },
      ],
    });
    const data = JSON.parse(result.output);
    expect(data).toMatchObject({
      citable: false,
      source_kind: 'calculation',
      ascending: ['A', 'C', 'B', 'D'],
      minimum: { value: 51, labels: ['A', 'C'] },
      maximum: { value: 109, labels: ['B', 'D'] },
    });
    expect(data.results[4]).toMatchObject({
      label: 'E',
      error: expect.any(String),
    });
    expect(result.allowedRefs).toEqual([]);
    expect(result.label).toBe('核对计算 · 5 个式子');
  });

  it('rejects malformed requests as a whole', async () => {
    for (const expressions of [
      [],
      Array.from({ length: 13 }, () => ({ label: 'x', expression: '1' })),
      [{ label: 'x' }],
      'not a list',
    ])
      await expect(
        executeReadTool(c, 'aima', 'calculate', { expressions }),
      ).rejects.toThrow();
  });
});

describe('evaluateArithmetic', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['-2^2', -4],
    ['2^3^2', 512],
    ['2^-1', 0.5],
    ['1.5e3 / .5', 3000],
    ['- -3', 3],
  ])('%s = %d', (expression, value) => {
    expect(evaluateArithmetic(expression)).toBe(value);
  });

  it.each([
    '',
    '1 / 0',
    '(1 + 2',
    '1 +',
    '2 3',
    'x + 1',
    'alert(1)',
    '10^400',
    '1'.repeat(201),
  ])('rejects %j', expression => {
    expect(() => evaluateArithmetic(expression)).toThrow();
  });
});

it('offers the three read tools to the teaching model', () => {
  const names = TOOL_DEFS.map(tool => tool.name);
  expect(names).toEqual(
    expect.arrayContaining(['get_blocks', 'get_outline', 'calculate']),
  );
});
