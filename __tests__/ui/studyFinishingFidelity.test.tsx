import Renderer, {
  act,
  type ReactTestRenderer,
  type ReactTestInstance,
} from 'react-test-renderer';
import { Animated, StyleSheet, Text } from 'react-native';
import { Composer, SkinProvider } from '@ui/kit';
import { SectionDoneView } from '@ui/screens/SectionDoneView';
import { sectionDoneSamples } from '@features/study/samples';
import type { SectionDoneIntents } from '@features/study/types';

const no = () => {};
let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  jest.restoreAllMocks();
});
const text = (node: ReactTestInstance) => [node.props.children].flat().join('');
const composer = {
  value: '',
  onChange: no,
  placeholder: '不懂就问…',
  onSend: no,
  sendDisabled: true,
  micAvailable: false,
};
it.each(['paper', 'glass'] as const)(
  'renders the %s quote label and excerpt independently and clears the quote',
  async skin => {
    const onClear = jest.fn();
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <Composer
            {...composer}
            quote={{
              label: '旧格式兼容标签',
              page: 'p.103',
              excerpt: 'f(n) 是总代价的估计。',
              onClear,
            }}
          />
        </SkinProvider>,
      );
    });
    const nodes = renderer.root.findAllByType(Text);
    const label = nodes.find(
      node => text(node) === (skin === 'glass' ? '引用 p.103' : '引用'),
    )!;
    const excerpt = nodes.find(
      node =>
        text(node) ===
        (skin === 'glass'
          ? 'f(n) 是总代价的估计。'
          : 'p.103 · f(n) 是总代价的估计。'),
    )!;
    expect(label).toBeDefined();
    expect(excerpt.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(excerpt.props.style)).toMatchObject({ flex: 1 });
    if (skin === 'glass') {
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({
        color: '#007AFF',
        fontWeight: '600',
        flexShrink: 0,
      });
      expect(StyleSheet.flatten(excerpt.props.style)).toMatchObject({
        fontSize: 13,
        fontFamily: 'serif',
        minWidth: 0,
      });
    }
    const clear = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === '取消引用' &&
        typeof node.props.onPress === 'function',
    )[0];
    await act(async () => clear.props.onPress());
    expect(onClear).toHaveBeenCalledTimes(1);
  },
);
it.each(['paper', 'glass'] as const)(
  'retains label-only quote compatibility in %s',
  async skin => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skin} scheme="light" reduceMotion>
          <Composer
            {...composer}
            quote={{ label: '引用 p.5 · 兼容旧调用', onClear: no }}
          />
        </SkinProvider>,
      );
    });
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === '引用 p.5 · 兼容旧调用'),
    ).toBe(true);
  },
);
const doneIntents: SectionDoneIntents = {
  back: no,
  setSummary: no,
  toggleStuck: no,
  toggleCard: no,
  openEditCard: no,
  setEditFront: no,
  setEditBack: no,
  closeEditCard: no,
  saveEditCard: no,
  editCard: no,
  retry: no,
  save: no,
};
it.each(['light', 'dark'] as const)(
  'matches the Apple completion hero geometry and shadow in %s',
  async scheme => {
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId="glass" scheme={scheme} reduceMotion>
          <SectionDoneView
            state={sectionDoneSamples.loading}
            intents={doneIntents}
          />
        </SkinProvider>,
      );
    });
    const complete = renderer.root.findByProps({
      testID: 'section-done-complete',
    });
    expect(StyleSheet.flatten(complete.props.style)).toMatchObject({
      width: 64,
      height: 64,
      marginBottom: 12,
      boxShadow: `0 10px 24px ${scheme === 'light' ? '#34C759' : '#30D158'}66`,
    });
    const title = renderer.root
      .findAllByType(Text)
      .find(
        node => node.props.children === sectionDoneSamples.loading.hero.title,
      )!;
    const stats = renderer.root
      .findAllByType(Text)
      .find(
        node => node.props.children === sectionDoneSamples.loading.hero.stats,
      )!;
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({
      letterSpacing: -0.24,
      marginBottom: 4,
    });
    expect(StyleSheet.flatten(stats.props.style).marginTop).toBe(0);
  },
);
it.each([false, true])(
  'uses the Apple completion pop only when reduceMotion is %s',
  async reduceMotion => {
    const timing = jest
      .spyOn(Animated, 'timing')
      .mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      }));
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId="glass" scheme="light" reduceMotion={reduceMotion}>
          <SectionDoneView
            state={sectionDoneSamples.loading}
            intents={doneIntents}
          />
        </SkinProvider>,
      );
    });
    const pop = timing.mock.calls.filter(
      ([, config]) => config.duration === 500,
    );
    expect(pop).toHaveLength(reduceMotion ? 0 : 1);
    const complete = renderer.root.findByProps({
      testID: 'section-done-complete',
    });
    const style = StyleSheet.flatten(complete.props.style);
    expect(style.opacity.__getValue()).toBe(reduceMotion ? 1 : 0);
    expect(style.transform[0].scale.__getValue()).toBe(reduceMotion ? 1 : 0.9);
  },
);
