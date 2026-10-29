import { createElement } from 'react';
import { AccessibilityInfo, TextInput } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestInstance,
} from 'react-test-renderer';
import { SkinProvider } from '../../src/ui/kit/SkinProvider';
import type { ComponentMap, KitProps } from '../../src/ui/kit/contracts';
import * as Kit from '../../src/ui/kit/proxy';
import { makeComponentSamples } from './helpers/props';

const components: ComponentMap = Kit;
const variants = [
  ['paper', 'light'],
  ['paper', 'dark'],
  ['glass', 'light'],
  ['glass', 'dark'],
] as const;
const names = Object.keys(makeComponentSamples()) as (keyof KitProps)[];
const rendered = new Set<ReactTestRenderer.ReactTestRenderer>();

beforeAll(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(false);
});
afterEach(async () => {
  await act(async () => {
    for (const renderer of rendered) renderer.unmount();
  });
  rendered.clear();
});
afterAll(() => jest.restoreAllMocks());

async function mount(
  children: React.ReactNode,
  skinId: 'paper' | 'glass' = 'paper',
  scheme: 'light' | 'dark' = 'light',
) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SkinProvider skinId={skinId} scheme={scheme} reduceMotion>
        {children}
      </SkinProvider>,
    );
  });
  rendered.add(renderer);
  return renderer;
}
function sample<K extends keyof KitProps>(name: K, props: KitProps[K]) {
  const Component = components[name];
  return createElement(Component, props);
}
function action(root: ReactTestInstance, label: string | RegExp) {
  const nodes = root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      typeof node.props.accessibilityLabel === 'string' &&
      (typeof label === 'string'
        ? node.props.accessibilityLabel === label
        : label.test(node.props.accessibilityLabel)),
  );
  if (!nodes.length) throw new Error(`没有找到操作：${String(label)}`);
  return nodes[0];
}

it('样本清单覆盖全部58个组件代理', () => {
  expect(names).toHaveLength(58);
  for (const name of names) expect(typeof Kit[name]).toBe('function');
});

for (const [skin, scheme] of variants) {
  describe(`${skin} / ${scheme}`, () => {
    it.each(names)('%s 在相同 props 下渲染并暴露可访问语义', async name => {
      const props = makeComponentSamples();
      const renderer = await mount(sample(name, props[name]), skin, scheme);
      const semantics = renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          typeof node.props.accessibilityRole === 'string' &&
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityState !== undefined,
      );
      expect(semantics.length).toBeGreaterThan(0);
      expect(
        semantics.some(node => node.props.accessibilityLabel.length > 0),
      ).toBe(true);
    });
  });
}

for (const skin of ['paper', 'glass'] as const) {
  describe(`${skin} 交互契约`, () => {
    it('Button 转发禁用状态与动作', async () => {
      const props = makeComponentSamples().Button;
      const renderer = await mount(<Kit.Button {...props} disabled />, skin);
      expect(action(renderer.root, '保存').props.disabled).toBe(true);
      expect(
        action(renderer.root, '保存').props.accessibilityState.disabled,
      ).toBe(true);
      expect(props.onPress).not.toHaveBeenCalled();
      await act(async () =>
        renderer.update(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <Kit.Button {...props} />
          </SkinProvider>,
        ),
      );
      await act(async () => action(renderer.root, '保存').props.onPress());
      expect(props.onPress).toHaveBeenCalledTimes(1);
    });
    it('Composer 转发输入、发送和停止', async () => {
      const props = makeComponentSamples().Composer;
      const renderer = await mount(<Kit.Composer {...props} />, skin);
      const input = renderer.root
        .findAllByType(TextInput)
        .find(node => node.props.placeholder === '不懂就问')!;
      await act(async () => input.props.onChangeText('换个说法'));
      expect(props.onChange).toHaveBeenCalledWith('换个说法');
      await act(async () => action(renderer.root, '发送').props.onPress());
      expect(props.onSend).toHaveBeenCalledTimes(1);
      const onStop = jest.fn();
      await act(async () =>
        renderer.update(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <Kit.Composer {...props} busy onStop={onStop} />
          </SkinProvider>,
        ),
      );
      await act(async () => action(renderer.root, '停止').props.onPress());
      expect(onStop).toHaveBeenCalledTimes(1);
    });
    it('Quiz 锁定所有选项，未锁定时把索引回传', async () => {
      const props = makeComponentSamples().QuizCard;
      const renderer = await mount(<Kit.QuizCard {...props} />, skin);
      await act(async () => action(renderer.root, /^B：/).props.onPress());
      expect(props.onPick).toHaveBeenCalledWith(1);
      await act(async () =>
        renderer.update(
          <SkinProvider skinId={skin} scheme="light" reduceMotion>
            <Kit.QuizCard {...props} locked />
          </SkinProvider>,
        ),
      );
      for (const label of [/^A：/, /^B：/, /^C：/]) {
        expect(action(renderer.root, label).props.disabled).toBe(true);
        expect(
          action(renderer.root, label).props.accessibilityState.disabled,
        ).toBe(true);
      }
    });
    it('步骤条保留路线图入口并回传步骤索引', async () => {
      const props = makeComponentSamples().StepProgress;
      const renderer = await mount(<Kit.StepProgress {...props} />, skin);
      await act(async () =>
        action(renderer.root, /查看路线图/).props.onPress(),
      );
      expect(props.onPressBar).toHaveBeenCalledTimes(1);
      await act(async () => action(renderer.root, /先讲直觉/).props.onPress());
      expect(props.onPressStep).toHaveBeenCalledWith(0);
      expect(props.onPressBar).toHaveBeenCalledTimes(1);
    });
    it('开关与勾选行只转发新值/意图', async () => {
      const samples = makeComponentSamples();
      const renderer = await mount(
        <>
          <Kit.Switch {...samples.Switch} />
          <Kit.CheckRow {...samples.CheckRow} />
        </>,
        skin,
      );
      const toggle = renderer.root.findAll(
        node =>
          node.props.accessibilityRole === 'switch' &&
          typeof node.props.onPress === 'function',
      )[0];
      await act(async () => toggle.props.onPress());
      expect(samples.Switch.onChange).toHaveBeenCalledWith(false);
      await act(async () =>
        action(renderer.root, '保存本节摘要').props.onPress(),
      );
      expect(samples.CheckRow.onToggle).toHaveBeenCalledTimes(1);
    });
    it('SelectionMenu 选择key与关闭行为独立转发', async () => {
      const props = makeComponentSamples().SelectionMenu;
      const renderer = await mount(<Kit.SelectionMenu {...props} />, skin);
      await act(async () => action(renderer.root, '高亮').props.onPress());
      expect(props.onSelect).toHaveBeenCalledWith('highlight');
      await act(async () =>
        action(renderer.root, '关闭选择菜单').props.onPress(),
      );
      expect(props.onDismiss).toHaveBeenCalledTimes(1);
    });
  });
}

it('Note wraps adjacent text expressions and numbers in one native Text', async () => {
  const renderer = await mount(
    <Kit.Note tone="neutral">
      {'核对结果'}
      {'\n演示内容'}
      {3}
    </Kit.Note>,
  );
  const note = renderer.root.findAll(
    node => node.props.accessibilityLabel === '核对结果\n演示内容3',
  )[0];
  expect(note).toBeDefined();
  expect(JSON.stringify(renderer.toJSON())).toContain('核对结果\\n演示内容3');
});
