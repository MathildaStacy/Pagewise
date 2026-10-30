import ReactTestRenderer, { act } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { ContainerProvider } from '@app/ContainerProvider';
import { createTestDemoContainer } from '@app/testing';
import type { Container } from '@app/container';
import { applyRefinement, generateRefinement } from '@app/usecases/refinement';
import { useRefinementVM } from '@features/study/useRefinementVM';
import { presentRefinementContent } from '@features/study/presenters';
import type { RefinementState, StudyIntents } from '@features/study/types';
import { RefinementSheet } from '@ui/screens/RefinementSheet';
import { Button, MathView, Sheet, SkinProvider } from '@ui/kit';
import type { SkinId } from '@ui/kit/skin';

let c: Container, tree: ReactTestRenderer.ReactTestRenderer | undefined;
const section = '3.5.2';
beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(false);
});
beforeEach(async () => {
  c = await createTestDemoContainer();
  await c.db.run(
    "UPDATE block SET text='wrapped' || char(10) || 'text' WHERE book_id='aima' AND section_id=? AND type='text'",
    [section],
  );
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
  await c.close();
});
async function mount() {
  let vm!: ReturnType<typeof useRefinementVM>;
  function Probe() {
    vm = useRefinementVM('aima', section);
    return null;
  }
  await act(async () => {
    tree = ReactTestRenderer.create(
      <ContainerProvider value={c}>
        <Probe />
      </ContainerProvider>,
    );
  });
  return () => vm;
}

it('opens, generates, selects, adopts and undoes a saved refinement through the VM', async () => {
  const vm = await mount();
  await act(async () => vm().open());
  expect(vm().state).toMatchObject({
    status: 'idle',
    activity: null,
    mode: 'structure',
  });
  await act(async () => vm().action('start'));
  expect(vm().state).toMatchObject({ status: 'ready', busy: false });
  const seq = vm().state!.edits[0].seq;
  await act(async () => vm().toggle(seq));
  expect(vm().state!.edits[0].selected).toBe(false);
  await act(async () => vm().toggle(seq));
  await act(async () => vm().action('apply'));
  expect(vm().state!.status).toBe('applied');
  await act(async () => vm().action('undo'));
  expect(vm().state!.status).toBe('undone');
});

it('retains rejected suggestions across a source inspection round trip and resets selection for a new run', async () => {
  const vm = await mount();
  await act(async () => vm().open());
  await act(async () => vm().action('start'));
  const seq = vm().state!.edits[0].seq;
  await act(async () => vm().toggle(seq));
  expect(vm().state!.edits[0].selected).toBe(false);
  await act(async () => vm().action('close'));
  await act(async () => vm().open());
  expect(vm().state!.edits[0]).toMatchObject({ seq, selected: false });
  await act(async () => vm().action('start'));
  expect(vm().state!.edits[0]).toMatchObject({ seq, selected: true });
});

it('shows saved resume configuration and lets the user regenerate with another model', async () => {
  const ctl = new AbortController();
  ctl.abort();
  const run = await generateRefinement(c, 'aima', section, {
    mode: 'structure',
    signal: ctl.signal,
  });
  await c.repos.settings.set('ai.assign', {
    tidy: { providerId: 'demo-openai', model: 'gpt-5-mini' },
  });
  const vm = await mount();
  await act(async () => vm().open());
  expect(vm().state!.aiOptions.config?.model).toBe(run.config?.model);
  expect(vm().state!.canResume).toBe(true);
  await act(async () =>
    vm().setOptions({ providerId: 'demo-openai', model: 'gpt-5-mini' }),
  );
  expect(vm().state!.canResume).toBe(false);
});

it('offers undo for the currently applied run while reviewing a newer draft', async () => {
  const first = await generateRefinement(c, 'aima', section, {
    mode: 'structure',
  });
  await applyRefinement(
    c,
    first.id,
    first.document.edits.map(e => e.seq),
  );
  const draft = await generateRefinement(c, 'aima', section, {
    mode: 'structure',
  });
  const vm = await mount();
  await act(async () => vm().open());
  expect(vm().state!.hasPreviousApplied).toBe(true);
  await act(async () => vm().action('undo'));
  expect(vm().state).toMatchObject({
    status: 'ready',
    hasPreviousApplied: false,
  });
  expect((await c.repos.refinements.get(draft.id))?.status).toBe('ready');
});

it('stops and reopens in-flight work without leaving the panel permanently busy', async () => {
  let started!: () => void;
  const waiting = new Promise<void>(resolve => {
    started = resolve;
  });
  jest.spyOn(c.ai, 'complete').mockImplementation(
    (_purpose, _req, opts) =>
      new Promise((_resolve, reject) => {
        opts!.signal!.addEventListener(
          'abort',
          () => reject(new Error('stopped')),
          { once: true },
        );
        started();
      }),
  );
  const vm = await mount();
  await act(async () => vm().open());
  await act(async () => {
    vm().action('start');
    await waiting;
  });
  expect(vm().state!.activity).toBe('generate');
  await act(async () => {
    vm().action('close');
    vm().open();
  });
  expect(vm().state).toMatchObject({ status: 'paused', busy: false });
  await act(async () => vm().setMode('vision'));
  expect(vm().state).toMatchObject({
    mode: 'vision',
    canVision: false,
    canResume: false,
  });
});

const state = (): RefinementState => ({
  busy: false,
  activity: null,
  scope: '1.1 本节',
  mode: 'structure',
  canVision: false,
  canResume: false,
  hasPreviousApplied: false,
  aiOptions: {
    config: null,
    models: [],
    selected: '',
    efforts: [],
    search: { ok: false, reason: '' },
  },
  status: 'ready',
  completed: 1,
  total: 1,
  edits: [
    {
      seq: 1,
      location: '第 1 页',
      before: { kind: 'text', text: '原\n文' },
      after: { kind: 'text', text: '原文' },
      reason: '修复换行',
      selected: true,
    },
  ],
  issues: [{ seq: 2, location: '第 2 页', reason: '公式需原页核对' }],
});
it('presents equation and table comparisons as readable content rather than source syntax', async () => {
  const before = {
    type: 'table' as const,
    text: '',
    latex: null,
    html: '<table><tr><td>Item</td><td>Count</td></tr><tr><td>Example</td><td>l</td></tr></table>',
  };
  const table = presentRefinementContent(before);
  expect(table).toEqual({
    kind: 'table',
    rows: [
      ['Item', 'Count'],
      ['Example', 'l'],
    ],
  });
  const equation = presentRefinementContent({
    type: 'equation',
    text: '',
    latex: 'x=O',
    html: null,
  });
  const rich = state();
  rich.edits = [
    {
      ...rich.edits[0],
      before: table,
      after: presentRefinementContent({
        ...before,
        html: before.html.replace('>l<', '>1<'),
      }),
    },
    {
      ...rich.edits[0],
      seq: 2,
      before: equation,
      after: { kind: 'equation', tex: 'x=0' },
    },
  ];
  await act(async () => {
    tree = ReactTestRenderer.create(
      <SkinProvider skinId="paper" scheme="dark" fontScale={1.3} reduceMotion>
        <RefinementSheet state={rich} intents={{} as StudyIntents} />
      </SkinProvider>,
    );
  });
  expect(tree!.root.findAllByType(MathView).map(v => v.props.tex)).toEqual([
    'x=O',
    'x=0',
  ]);
  expect(JSON.stringify(tree!.toJSON())).not.toContain('<table>');
  expect(JSON.stringify(tree!.toJSON())).toContain('Example');
});
it.each(['paper', 'meta', 'win11', 'google', 'glass'] as SkinId[])(
  'keeps adoption, issue location and saving state usable in %s light/dark themes',
  async skinId => {
    const locate = jest.fn(),
      action = jest.fn();
    const intents = {
      refinementLocate: locate,
      refinementAction: action,
    } as unknown as StudyIntents;
    for (const scheme of ['light', 'dark'] as const) {
      await act(async () => {
        tree = ReactTestRenderer.create(
          <SkinProvider
            skinId={skinId}
            scheme={scheme}
            fontScale={1.3}
            reduceMotion
          >
            <RefinementSheet state={state()} intents={intents} />
          </SkinProvider>,
        );
      });
      const adopt = tree!.root
        .findByType(Sheet)
        .props.actions.find(
          (b: { label: string }) => b.label === '采纳 1 处修改',
        );
      expect(adopt).toBeDefined();
      await act(async () => adopt!.onPress());
      const view = tree!.root
        .findAllByType(Button)
        .find(b => b.props.children === '查看原文');
      await act(async () => view!.props.onPress());
      expect(locate).toHaveBeenCalledWith(2);
      const saving = { ...state(), busy: true, activity: 'save' as const };
      await act(async () =>
        tree!.update(
          <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
            <RefinementSheet state={saving} intents={intents} />
          </SkinProvider>,
        ),
      );
      expect(tree!.root.findByType(Sheet).props.actions[0]).toMatchObject({
        label: '正在保存…',
        disabled: true,
      });
      await act(async () => tree!.unmount());
      tree = undefined;
    }
  },
);
