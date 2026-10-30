import { createTestContainer } from '@app/testing';
import {
  loadAiOptions,
  presentAiOptions,
  normalizeAiOptions,
} from '@app/usecases/aiOptions';
import type { AiProvider } from '@services/ai/types';

const provider: AiProvider = {
  id: 'p',
  kind: 'deepseek',
  name: 'DeepSeek',
  protocol: 'chat',
  baseUrl: 'https://api.deepseek.com/v1',
  auth: 'bearer',
  cache: 'auto',
  keyTail: '',
  models: [
    { id: 'deepseek-chat', enabled: true, price: null },
    { id: 'deepseek-reasoner', enabled: true, price: null },
    { id: 'hidden-model', enabled: false, price: null },
    { id: 'text-embedding-3-small', enabled: true, price: null },
  ],
};

it('limits options to enabled chat models and the chosen model’s actual reasoning/search support', () => {
  const config = {
    providerId: 'p',
    model: 'deepseek-reasoner',
    effort: 'max' as const,
    search: true,
  };
  const state = presentAiOptions([provider], config);
  expect(state.models.map(model => model.model)).toEqual([
    'deepseek-chat',
    'deepseek-reasoner',
  ]);
  expect(state.efforts).toEqual([{ key: 'on', label: '开启' }]);
  expect(state.config).toMatchObject({ effort: 'on', search: false });
  expect(state.search.ok).toBe(false);
  expect(
    presentAiOptions([provider], { ...config, model: 'deepseek-chat' }).efforts,
  ).toEqual([]);
  expect(
    normalizeAiOptions({ ...config, model: 'deepseek-chat' }, [provider]),
  ).toMatchObject({ effort: 'off', search: false });
  expect(
    presentAiOptions([provider], { ...config, model: 'hidden-model' }).config,
  ).toBeNull();
});

it('reads defaults without changing global assignments when a conversation chooses different options', async () => {
  const c = await createTestContainer();
  try {
    await c.repos.settings.set('ai.providers', [provider]);
    const assignment = { teach: { providerId: 'p', model: 'deepseek-chat' } };
    await c.repos.settings.set('ai.assign', assignment);
    expect((await loadAiOptions(c, 'teach')).config).toMatchObject({
      model: 'deepseek-chat',
      effort: 'off',
      search: false,
    });
    normalizeAiOptions(
      {
        providerId: 'p',
        model: 'deepseek-reasoner',
        effort: 'on',
        search: false,
      },
      [provider],
    );
    expect(await c.repos.settings.get('ai.assign', {})).toEqual(assignment);
  } finally {
    await c.close();
  }
});
