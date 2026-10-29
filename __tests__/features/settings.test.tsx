import { Share, TextInput } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { createTestContainer, createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { useContainer } from '@app/ContainerProvider';
import { useAppNav } from '@features/nav';
import {
  useMeVM,
  useMineruVM,
  useAIVM,
  useAIEditVM,
  usePrefsVM,
  useStorageVM,
  useAboutVM,
} from '@features/settings/useSettingsVM';
import { tokenExpiry, formatBytes } from '@features/settings/presenters';
import {
  patchMineru,
  patchPrefs,
  readPrefs,
  readServiceEditor,
  readProviders,
  readAssignments,
  saveService,
  deleteService,
  assignModel,
} from '@app/usecases/settings';
import { SkinProvider, CheckRow } from '@ui/kit';
import { MeView } from '@ui/screens/MeView';
import { MeMineruView } from '@ui/screens/MeMineruView';
import { MeAIView } from '@ui/screens/MeAIView';
import { MeAIEditView } from '@ui/screens/MeAIEditView';
import { MePrefsView } from '@ui/screens/MePrefsView';
import { MeStorageView } from '@ui/screens/MeStorageView';
import { AboutView } from '@ui/screens/AboutView';
import {
  meSamples,
  mineruSamples,
  aiSamples,
  aiEditSamples,
  prefsSamples,
  storageSamples,
  aboutSamples,
} from '@features/settings/samples';
import * as storageUsecases from '@app/usecases/storage';
import { ImportInputError, reparseBook } from '@app/usecases/importBooks';
import { version } from '../../package.json';

jest.mock('@app/ContainerProvider', () => ({ useContainer: jest.fn() }));
jest.mock('@features/nav', () => ({ useAppNav: jest.fn() }));
jest.mock('@app/usecases/importBooks', () => ({
  ...jest.requireActual('@app/usecases/importBooks'),
  reparseBook: jest.fn(),
}));
let c: Container;
let renderers: Renderer.ReactTestRenderer[] = [];
const nav = {
  open: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  enterDemo: jest.fn(),
  exitDemo: jest.fn(),
};
beforeEach(async () => {
  c = await createTestContainer();
  jest.mocked(useContainer).mockReturnValue(c);
  jest.mocked(useAppNav).mockReturnValue(nav);
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    renderers.forEach(r => r.unmount());
  });
  renderers = [];
  await c.close();
  jest.restoreAllMocks();
});
async function mountVM<T>(hook: () => T) {
  let vm!: T;
  function Probe() {
    vm = hook();
    return null;
  }
  await act(async () => {
    renderers.push(Renderer.create(<Probe />));
  });
  return () => vm;
}

it.each([
  ['2026-11-03', 'Token 5 天后过期', true, false],
  ['2026-10-29', 'Token 今天到期', true, false],
  ['2026-10-28', 'Token 已过期', true, true],
  ['2026-12-01', 'Token 33 天后过期', false, false],
  [undefined, '未填写有效期', false, false],
])(
  'presents token expiry %s without timezone drift',
  (date, label, warn, expired) => {
    expect(tokenExpiry(date, '2026-10-29')).toEqual({ label, warn, expired });
  },
);

it('shows the Me summaries and routes each setting from the current library', async () => {
  const today = c.clock.today();
  await patchMineru(c, { tokenExpiresOn: today }, 'fixture-mineru-1234');
  const vm = await mountVM(useMeVM);
  expect(vm().state.groups[0][0]).toMatchObject({
    tone: 'stuck',
    subtitle: expect.stringContaining('Token 今天到期'),
  });
  expect(vm().state.groups[0][1].subtitle).toContain('还没有配置讲解模型');
  vm().intents.open('MePrefs');
  expect(nav.open).toHaveBeenCalledWith({ name: 'MePrefs' });
});

it('keeps Me appearance and version summaries current without refreshing the page', async () => {
  await patchPrefs(c, { bilingual: false });
  const vm = await mountVM(useMeVM);
  const row = (key: string) =>
    vm()
      .state.groups.flat()
      .find(item => item.key === key)!;
  expect(row('MeAppearance').subtitle).toBe('纸感 · 跟随系统 · 正文中');
  expect(row('About').subtitle).toBe(`版本 ${version} · GPL-3.0`);
  expect(row('MePrefs').subtitle).toContain('只用中文术语');
  await act(async () => {
    await c.appearance.update({
      skin: 'glass',
      scheme: 'dark',
      readingSize: 'l',
    });
  });
  expect(row('MeAppearance').subtitle).toBe('苹果风 · 深色 · 正文大');
  await act(async () => {
    await c.appearance.update({ scheme: 'light', readingSize: 's' });
  });
  expect(row('MeAppearance').subtitle).toBe('苹果风 · 浅色 · 正文小');
  expect(row('About').subtitle).toBe(`版本 ${version} · GPL-3.0`);
});

it('saves MinerU credentials only in KeyStore and reloads model, confirmation and expiry', async () => {
  const vm = await mountVM(useMineruVM);
  await act(async () => {
    vm().intents.setToken('fixture-mineru-1234');
    vm().intents.setExpiresOn('2027-01-26');
  });
  await act(async () => vm().intents.saveToken());
  expect(await c.secrets.get('mineru.token')).toBe('fixture-mineru-1234');
  expect(vm().state.token).toBe('');
  expect(vm().state.tokenLabel).toContain('1234');
  await act(async () => {
    vm().intents.setModel('pipeline');
    vm().intents.setConfirmUpload(false);
  });
  const reopened = await mountVM(useMineruVM);
  expect(reopened().state).toMatchObject({
    model: 'pipeline',
    confirmUpload: false,
    expiresOn: '2027-01-26',
  });
  expect(JSON.stringify(await c.db.all('SELECT * FROM setting'))).not.toContain(
    'fixture-mineru',
  );
  await expect(
    patchMineru(c, { tokenExpiresOn: '2026-99-99' }),
  ).rejects.toThrow('有效期');
  await expect(patchMineru(c, {}, 'key with spaces')).rejects.toThrow('空格');
});

it('preserves concurrent preference changes and reopens with saved toggles and text', async () => {
  const vm = await mountVM(usePrefsVM);
  await act(async () => {
    vm().intents.set('intuitionFirst', false);
    vm().intents.set('length', '长');
    vm().intents.set('extra', '多用 Python 类比');
  });
  expect(await readPrefs(c)).toMatchObject({
    intuitionFirst: false,
    length: '长',
    extra: '多用 Python 类比',
  });
  const reopened = await mountVM(usePrefsVM);
  expect(reopened().state.prefs).toMatchObject({
    intuitionFirst: false,
    length: '长',
    extra: '多用 Python 类比',
  });
  await patchPrefs(c, { bilingual: false });
  expect((await readPrefs(c)).intuitionFirst).toBe(false);
  vm().intents.back();
  expect(nav.back).toHaveBeenCalled();
});

it('parses service forms, retains keys on edit and removes deleted model assignments', async () => {
  const editor = await readServiceEditor(c);
  expect(await saveService(c, editor.form)).toMatchObject({
    ok: false,
    errors: {
      name: expect.any(String),
      model: expect.any(String),
      key: expect.any(String),
    },
  });
  const result = await saveService(c, {
    ...editor.form,
    name: '测试服务',
    protocol: 'chat',
    baseUrl: 'https://api.example.com/v1',
    key: 'fixture-ai-5678',
    model: 'test-model, tidy-model',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('fixture form invalid');
  const id = result.providerId;
  expect(await c.secrets.get('ai.key.' + id)).toBe('fixture-ai-5678');
  expect((await readProviders(c))[0].models).toHaveLength(2);
  expect(await readAssignments(c)).toMatchObject({
    teach: { providerId: id, model: 'test-model' },
    tidy: { providerId: id, model: 'test-model' },
  });
  await assignModel(c, 'tidy', id, 'tidy-model');
  const form = (await readServiceEditor(c, id)).form;
  expect(form.key).toBe('');
  await saveService(c, { ...form, model: 'replacement-model' }, id);
  expect(await c.secrets.get('ai.key.' + id)).toBe('fixture-ai-5678');
  expect(await readAssignments(c)).toMatchObject({
    teach: { model: 'replacement-model' },
    tidy: { model: 'replacement-model' },
  });
  expect(JSON.stringify(await c.db.all('SELECT * FROM setting'))).not.toContain(
    'fixture-ai',
  );
  await deleteService(c, id);
  expect(await c.secrets.get('ai.key.' + id)).toBeNull();
  expect(await readProviders(c)).toEqual([]);
  expect(await readAssignments(c)).toEqual({});
});

it('AI editor validates, saves and returns to the AI list; list routes and changes assignments', async () => {
  const vm = await mountVM(() => useAIEditVM());
  await act(async () => {
    vm().intents.save();
  });
  expect(vm().state.errors.name).toBeDefined();
  await act(async () => {
    vm().intents.field('name', '本机测试');
    vm().intents.field('baseUrl', 'https://api.example.com/v1');
    vm().intents.field('protocol', 'chat');
    vm().intents.field('model', 'test-model');
    vm().intents.field('key', 'fixture-private-8888');
  });
  await act(async () => vm().intents.save());
  expect(nav.back).toHaveBeenCalled();
  const list = await mountVM(useAIVM);
  expect(list().state.providers[0].name).toBe('本机测试');
  expect(list().state.month).toBe('本月合计 0 tokens');
  list().intents.edit(list().state.providers[0].id);
  expect(nav.open).toHaveBeenLastCalledWith({
    name: 'MeAIEdit',
    providerId: list().state.providers[0].id,
  });
  await act(async () =>
    list().intents.assign('tidy', list().state.options[0].key),
  );
  expect(list().state.tidy).toBe(list().state.options[0].key);
});

it('starts a cleared book reparse only after its explicit confirmation', async () => {
  jest.spyOn(storageUsecases, 'loadStorage').mockResolvedValue([
    {
      id: 'aima',
      title: 'AIMA',
      sizeBytes: 100,
      parsedBytes: 0,
      available: true,
      needsReparse: true,
    },
  ]);
  const clear = jest
    .spyOn(storageUsecases, 'clearParseCache')
    .mockResolvedValue();
  const vm = await mountVM(useStorageVM);
  await act(async () => vm().intents.clean('aima'));
  await act(async () => vm().intents.confirmClean());
  expect(clear).toHaveBeenCalledWith(c, 'aima');
  expect(reparseBook).not.toHaveBeenCalled();
  expect(vm().state.books[0].needsReparse).toBe(true);
  await act(async () => vm().intents.reparse('aima'));
  expect(vm().state.confirmReparse).toBe('aima');
  expect(reparseBook).not.toHaveBeenCalled();
  await act(async () => vm().intents.confirmReparse());
  expect(reparseBook).toHaveBeenCalledWith(c, 'aima');
  expect(nav.open).toHaveBeenCalledWith({
    name: 'ParseProgress',
    bookId: 'aima',
  });
});
it('shows the original-file recovery instruction when a reparse has no source', async () => {
  jest
    .mocked(reparseBook)
    .mockRejectedValueOnce(
      new ImportInputError('原文件不在本机，请先重新选择同一本 PDF 或 EPUB'),
    );
  const vm = await mountVM(useStorageVM);
  await act(async () => vm().intents.reparse('aima'));
  await act(async () => vm().intents.confirmReparse());
  expect(vm().state.error).toContain('原文件不在本机');
  expect(nav.open).not.toHaveBeenCalled();
});
it('storage reads real book sizes and About switches demo mode and exports redacted logs', async () => {
  await c.close();
  c = await createTestDemoContainer();
  jest.mocked(useContainer).mockReturnValue(c);
  const vm = await mountVM(useStorageVM);
  expect(vm().state.books).toHaveLength(3);
  expect(vm().state.books[0].meta).toContain('原文件');
  await act(async () => vm().intents.clean('aima'));
  expect(vm().state.confirmClean).toBe('aima');
  await act(async () => vm().intents.closeOverlay());
  expect(vm().state.confirmClean).toBeNull();
  await act(async () => vm().intents.setIncludeOriginals(true));
  expect(vm().state.includeOriginals).toBe(true);
  const about = await mountVM(useAboutVM);
  about().intents.demo();
  expect(nav.exitDemo).toHaveBeenCalled();
  about().intents.gallery();
  expect(nav.open).toHaveBeenCalledWith({ name: 'SkinGallery' });
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
  c.log.info('export log fixture');
  await act(async () => about().intents.exportLogs());
  expect(share).toHaveBeenCalledWith({
    message: expect.stringContaining('export log fixture'),
  });
  expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
});

it('renders all seven settings pages in both skins and schemes', async () => {
  const me = await mountVM(useMeVM),
    mineru = await mountVM(useMineruVM),
    ai = await mountVM(useAIVM),
    edit = await mountVM(() => useAIEditVM()),
    prefs = await mountVM(usePrefsVM),
    storage = await mountVM(useStorageVM),
    about = await mountVM(useAboutVM);
  for (const skinId of ['paper', 'glass'] as const)
    for (const scheme of ['light', 'dark'] as const) {
      await act(async () => {
        const r = Renderer.create(
          <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
            <MeView state={meSamples.normal} intents={me().intents} />
            <MeMineruView
              state={mineruSamples.normal}
              intents={mineru().intents}
            />
            <MeAIView state={aiSamples.normal} intents={ai().intents} />
            <MeAIEditView
              state={aiEditSamples.normal}
              intents={edit().intents}
            />
            <MePrefsView state={prefsSamples.long} intents={prefs().intents} />
            <MeStorageView
              state={storageSamples.normal}
              intents={storage().intents}
            />
            <AboutView state={aboutSamples.normal} intents={about().intents} />
          </SkinProvider>,
        );
        renderers.push(r);
      });
      expect(JSON.stringify(renderers.at(-1)!.toJSON())).toContain('Pagewise');
    }
});

it('reads models, selects one and tests the unsaved editor before saving', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 200,
    text: async () =>
      JSON.stringify({ data: [{ id: 'first-model' }, { id: 'second-model' }] }),
  } as Response);
  const vm = await mountVM(() => useAIEditVM());
  await act(async () => {
    vm().intents.field('name', '真实服务');
    vm().intents.field('baseUrl', 'https://api.example.test/v1');
    vm().intents.field('protocol', 'chat');
    vm().intents.field('key', 'fixture-vm-key-8765');
  });
  await act(async () => vm().intents.readModels());
  expect(vm().state.models).toEqual([
    { id: 'first-model', label: 'first-model', selected: false },
    { id: 'second-model', label: 'second-model', selected: false },
  ]);
  expect(vm().state.notice).toContain('已读取 2 个模型');
  expect(await readProviders(c)).toEqual([]);
  await act(async () => vm().intents.toggleModel('second-model'));
  expect(vm().state.form.model).toBe('second-model');
  fetchMock.mockResolvedValue({
    status: 200,
    text: async () =>
      JSON.stringify({
        model: 'second-model',
        choices: [{ message: { role: 'assistant', content: '连接成功' } }],
        usage: { prompt_tokens: 12, completion_tokens: 2 },
      }),
  } as Response);
  await act(async () => vm().intents.testConnection());
  expect(vm().state.notice).toContain('连接正常 · second-model');
  expect(await readProviders(c)).toEqual([]);
  expect(await c.db.all('SELECT * FROM ai_usage')).toEqual([
    expect.objectContaining({ purpose: 'test', model: 'second-model' }),
  ]);
  await act(async () => vm().intents.save());
  const provider = (await readProviders(c))[0];
  expect(provider.models).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'first-model', enabled: false }),
      expect.objectContaining({ id: 'second-model', enabled: true }),
    ]),
  );
  expect(await c.secrets.get('ai.key.' + provider.id)).toBe(
    'fixture-vm-key-8765',
  );
  expect(nav.back).toHaveBeenCalled();
});

it('keeps the editor values after auth failure and shows a useful redacted error', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 401,
    text: async () =>
      JSON.stringify({ error: { message: 'invalid fixture-vm-secret-1234' } }),
  } as Response);
  const vm = await mountVM(() => useAIEditVM());
  await act(async () => {
    vm().intents.field('name', '测试');
    vm().intents.field('model', 'test-model');
    vm().intents.field('key', 'fixture-vm-secret-1234');
  });
  await act(async () => vm().intents.testConnection());
  expect(vm().state.error).toContain('Key 无效或已过期');
  expect(vm().state.error).not.toContain('fixture-vm-secret');
  expect(vm().state.form.model).toBe('test-model');
  expect(vm().state.busy).toBeUndefined();
  expect(await readProviders(c)).toEqual([]);
});

it('aborts model lookup when editing and ignores the previous response', async () => {
  let finish!: (value: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => {
    started();
    return new Promise<Response>(resolve => {
      finish = resolve;
    });
  });
  const vm = await mountVM(() => useAIEditVM());
  await act(async () => {
    vm().intents.field('name', '测试');
    vm().intents.field('key', 'fixture-stale-key-1234');
  });
  await act(async () => {
    vm().intents.readModels();
    await ready;
  });
  expect(vm().state.busy).toBe('models');
  const signal = fetchMock.mock.calls[0][1]?.signal;
  await act(async () =>
    vm().intents.field('baseUrl', 'https://another.example.test'),
  );
  expect(signal?.aborted).toBe(true);
  await act(async () =>
    finish({
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 'stale-model' }] }),
    } as Response),
  );
  expect(vm().state.models).toEqual([]);
  expect(vm().state.notice).toBeUndefined();
  expect(vm().state.error).toBeUndefined();
  expect(vm().state.form.baseUrl).toBe('https://another.example.test');
});

it('marks Demo settings and connection results without making real requests', async () => {
  await c.close();
  c = await createTestDemoContainer();
  jest.mocked(useContainer).mockReturnValue(c);
  const fetchMock = jest.spyOn(global, 'fetch');
  const draft = (await readServiceEditor(c)).form;
  await saveService(c, {
    ...draft,
    name: 'Demo 示例服务',
    model: 'demo-model',
  });
  const providerId = (await readProviders(c))[0].id;
  const vm = await mountVM(() => useAIEditVM(providerId));
  await act(async () => vm().intents.readModels());
  expect(vm().state.notice).toContain('Demo 演示');
  await act(async () => vm().intents.testConnection());
  expect(vm().state.notice).toContain('未测试真实连接');
  const list = await mountVM(useAIVM);
  expect(list().state.demo).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not invent a cache hit rate when the service did not report cache usage', async () => {
  const vm = await mountVM(useAIVM);
  const usage = {
    book_id: null,
    provider_id: 'p',
    model: 'm',
    purpose: 'teach',
    input: 100,
    cache_read: 0,
    cache_write: 0,
    output: 10,
    cache_reported: false,
    at: c.clock.now().toISOString(),
  };
  await c.repos.usage.add(usage);
  await act(async () => vm().intents.refresh());
  expect(vm().state.usage[0].detail).toBe(
    '110 tokens · 该服务没有报告缓存数据',
  );
  await c.repos.usage.add({
    ...usage,
    input: 10,
    cache_read: 30,
    output: 0,
    cache_reported: true,
  });
  await act(async () => vm().intents.refresh());
  expect(vm().state.usage[0].detail).toContain('缓存命中 75%（仅已报告请求）');
});

it('connects the prototype select fields and side-by-side actions to real editor and assignment intents', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    status: 200,
    text: async () =>
      JSON.stringify({
        model: 'first-model',
        choices: [{ message: { role: 'assistant', content: '连接成功' } }],
        usage: { prompt_tokens: 3, completion_tokens: 1 },
      }),
  } as Response);
  function Editor() {
    const vm = useAIEditVM();
    return <MeAIEditView state={vm.state} intents={vm.intents} />;
  }
  let editor!: Renderer.ReactTestRenderer;
  await act(async () => {
    editor = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <Editor />
      </SkinProvider>,
    );
    renderers.push(editor);
  });
  const editorFields = () => editor.root.findAllByType(TextInput);
  const field = (label: string) =>
    editorFields().find(n => n.props.accessibilityLabel === label)!;
  const press = (r: Renderer.ReactTestRenderer, prefix: string) =>
    r.root
      .findAll(
        n =>
          n.props.accessibilityRole === 'button' &&
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(prefix) &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress();
  await act(async () => press(editor, '协议，'));
  await act(async () =>
    editor.root
      .findAllByType(CheckRow)
      .find(n => n.props.title === 'OpenAI Chat Completions')!
      .props.onToggle(),
  );
  await act(async () => {
    field('名称').props.onChangeText('UI 测试服务');
    field('Base URL').props.onChangeText('https://ui.example.test');
    field('API Key').props.onChangeText('fixture-ui-key-1357');
    field('模型（逗号分隔）').props.onChangeText('first-model, second-model');
  });
  await act(async () => press(editor, '测试连接'));
  expect(JSON.stringify(editor.toJSON())).toContain('连接正常');
  await act(async () => press(editor, '保存'));
  expect(nav.back).toHaveBeenCalled();
  function AIList() {
    const vm = useAIVM();
    return <MeAIView state={vm.state} intents={vm.intents} />;
  }
  let list!: Renderer.ReactTestRenderer;
  await act(async () => {
    list = Renderer.create(
      <SkinProvider skinId="glass" scheme="dark" reduceMotion>
        <AIList />
      </SkinProvider>,
    );
    renderers.push(list);
  });
  await act(async () => press(list, '整理模型（'));
  await act(async () =>
    list.root
      .findAllByType(CheckRow)
      .find(n => n.props.title === 'UI 测试服务 · second-model')!
      .props.onToggle(),
  );
  expect((await readAssignments(c)).tidy?.model).toBe('second-model');
});
