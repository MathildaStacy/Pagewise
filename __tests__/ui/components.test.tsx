import { createElement } from 'react';
import {
  AccessibilityInfo,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestInstance,
} from 'react-test-renderer';
import Svg from 'react-native-svg';
import { SkinProvider } from '../../src/ui/kit/SkinProvider';
import type { ComponentMap, KitProps } from '../../src/ui/kit/contracts';
import * as Kit from '../../src/ui/kit/proxy';
import type { SkinId } from '@ui/kit';
import { makeComponentSamples } from './helpers/props';

const components: ComponentMap = Kit;
const variants = [
  ['paper', 'light'],
  ['paper', 'dark'],
  ['glass', 'light'],
  ['glass', 'dark'],
  ['meta', 'light'],
  ['meta', 'dark'],
  ['google', 'light'],
  ['google', 'dark'],
  ['win11', 'light'],
  ['win11', 'dark'],
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
  skinId: SkinId = 'paper',
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

it('样本清单覆盖全部59个组件代理', () => {
  expect(names).toHaveLength(59);
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

for (const skin of ['paper', 'glass', 'meta', 'google', 'win11'] as const) {
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
      const scroll = renderer.root.findByType(ScrollView);
      expect(scroll.props.horizontal).toBe(true);
      expect(
        StyleSheet.flatten(scroll.props.contentContainerStyle).flexWrap,
      ).toBe('nowrap');
    });
  });
}

it('图片按原始比例排版，切换图片后忽略过期加载事件', async () => {
  const renderer = await mount(
    <Kit.FigureView uri="file:///wide.png" caption="横图" />,
    'glass',
  );
  const imageStyle = () =>
    StyleSheet.flatten(renderer.root.findByType(Image).props.style);
  const oldLoad = renderer.root.findByType(Image).props.onLoad;
  await act(async () =>
    oldLoad({ nativeEvent: { source: { width: 800, height: 200 } } }),
  );
  expect(imageStyle().aspectRatio).toBe(4);
  expect(imageStyle().height).toBeUndefined();
  await act(async () =>
    renderer.update(
      <SkinProvider skinId="glass" scheme="light" reduceMotion>
        <Kit.FigureView uri="file:///tall.png" caption="竖图" />
      </SkinProvider>,
    ),
  );
  await act(async () =>
    renderer.root
      .findByType(Image)
      .props.onLoad({ nativeEvent: { source: { width: 200, height: 800 } } }),
  );
  await act(async () =>
    oldLoad({ nativeEvent: { source: { width: 800, height: 200 } } }),
  );
  expect(imageStyle().aspectRatio).toBe(0.25);
});

it.each(['sm', 'md', 'lg'] as const)(
  'Apple %s 封面光泽覆盖包含内边距的整面',
  async size => {
    const renderer = await mount(
      <Kit.Cover title="书名" color="#345" size={size} />,
      'glass',
    );
    const cover = renderer.root.findAll(
      node => node.props.accessibilityLabel === '书名，书封面',
    )[0];
    const bounds = StyleSheet.flatten(cover.props.style);
    const sheen = renderer.root.findByType(Svg);
    expect(sheen.props.width).toBe(bounds.width);
    expect(sheen.props.height).toBe(bounds.height);
    if (size === 'lg') expect(bounds).toMatchObject({ width: 62, height: 84 });
  },
);

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

for (const skin of ['paper', 'glass', 'meta', 'google', 'win11'] as const) {
  it(`${skin} 富文本段落可读且图片不拦截段落操作`, async () => {
    const onPress = jest.fn();
    const renderer = await mount(
      <Kit.BlockView
        current
        onPress={onPress}
        doc={[
          {
            t: 'p',
            c: [
              { t: 'text', v: '第一段' },
              { t: 'b', c: [{ t: 'text', v: '正文' }] },
            ],
          },
          {
            t: 'figure',
            ref: 7,
            verified: true,
            uri: 'file:///image.png',
            text: '图 7',
          },
        ]}
      />,
      skin,
    );
    const block = action(renderer.root, '当前段落，第一段正文，图 7');
    expect(
      renderer.root.findAll(
        node => node.props.accessibilityLabel === '图 7，查看大图',
      ),
    ).toHaveLength(0);
    await act(async () => block.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it(`${skin} 图片查看器回调只在提供时暴露`, async () => {
    const onFigure = jest.fn();
    const renderer = await mount(
      <Kit.RichView
        doc={[
          {
            t: 'figure',
            ref: 7,
            verified: true,
            uri: 'file:///image.png',
            text: '图 7',
          },
        ]}
        onFigure={onFigure}
      />,
      skin,
    );
    await act(async () =>
      action(renderer.root, '图 7，查看大图').props.onPress(),
    );
    expect(onFigure).toHaveBeenCalledWith(7);
  });
}
