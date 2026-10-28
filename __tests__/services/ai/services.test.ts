// 来源：AShareSim/__tests__/ai/misc.test.ts 服务表单测试，GPL-3.0-only。
import {
  emptyForm,
  parseServiceForm,
  formOf,
  emptyProvider,
  keyTailOf,
} from '../../../src/services/ai/services';
describe('服务表单', () => {
  test('新服务必须填 Key；编辑时可以不填', () => {
    const f = {
      ...emptyForm('anthropic'),
      name: '中转',
      model: 'claude-sonnet-5-5',
    };
    const r = parseServiceForm(f, false);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.key).toContain('API Key');
    expect(parseServiceForm(f, true).ok).toBe(true);
  });

  test('价格 4 项都填才算，存成千分之一美元', () => {
    const f = {
      ...emptyForm('openai'),
      name: 'o',
      model: 'gpt-5.6',
      key: 'sk-x',
      priceInput: '3',
      priceCacheRead: '0.3',
      priceCacheWrite: '',
      priceOutput: '15',
    };
    expect(parseServiceForm(f, false).ok).toBe(false);
    const r = parseServiceForm({ ...f, priceCacheWrite: '3.75' }, false);
    expect(r.ok && r.service.price).toEqual({
      input: 3000,
      cacheRead: 300,
      cacheWrite: 3750,
      output: 15000,
    });
    // OpenAI 协议一律用 Bearer
    expect(r.ok && r.service.auth).toBe('bearer');
  });

  test('Base URL 要以 http(s) 开头，模型名不能有空格', () => {
    const r = parseServiceForm(
      {
        ...emptyForm(),
        name: 'x',
        baseUrl: 'relay.com',
        model: 'a b',
        key: 'k',
      },
      false,
    );
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['baseUrl', 'model']);
  });
});

test('编辑表单不回填 Key，预设供应商不包含示例模型', () => {
  const p = emptyProvider('openai');
  expect(p.models).toEqual([]);
  expect(keyTailOf('example-key')).toBe('-key');
  const parsed = parseServiceForm(
    { ...emptyForm('openai'), name: '服务', model: 'model', key: 'sample' },
    false,
  );
  if (!parsed.ok) throw new Error('fixture invalid');
  expect(formOf({ ...parsed.service, id: 'p', keyTail: 'mple' }).key).toBe('');
});
