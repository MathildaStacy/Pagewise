import { useState, type ReactNode } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { SvgXml } from 'react-native-svg';
import {
  Composer,
  Icon,
  IconButton,
  ModeSwitch,
  SkinProvider,
  StepProgress,
  TabBar,
  type SkinId,
} from '@ui/kit';
import { skins } from '@ui/skins';
import { parseColor } from '@ui/kit/color';
import { StudyView } from '@ui/screens/StudyView';
import { studySamples } from '@features/study/samples';
import type { StudyIntents } from '@features/study/types';
import { makeComponentSamples } from './helpers/props';

const mounted = new Set<Renderer.ReactTestRenderer>();
beforeEach(() => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({
    width: 360,
    height: 800,
    scale: 3,
    fontScale: 1,
  });
});
afterEach(async () => {
  await act(async () => {
    for (const renderer of mounted) renderer.unmount();
  });
  mounted.clear();
  jest.restoreAllMocks();
});

async function mount(
  children: ReactNode,
  skin: SkinId,
  scheme: 'light' | 'dark' = 'light',
) {
  let renderer!: Renderer.ReactTestRenderer;
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
        {children}
      </SkinProvider>,
    );
  });
  mounted.add(renderer);
  return renderer;
}

function action(root: ReactTestInstance, label: string) {
  return root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label,
  )[0];
}
function circle(root: ReactTestInstance, size = 20) {
  return root.findAllByType(View).find(node => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.width === size && style.height === size;
  })!;
}

it.each(
  (['meta', 'google', 'win11'] as const).flatMap(skin =>
    (['android', 'ios'] as const).flatMap(platform =>
      [1, 2].map(fontScale => ({ skin, platform, fontScale })),
    ),
  ),
)(
  '$skin/$platform keeps a single-line placeholder and complete edited drafts at system font scale $fontScale',
  async ({ skin, platform, fontScale }) => {
    jest.replaceProperty(Platform, 'OS', platform);
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 360,
      height: 800,
      scale: 3,
      fontScale,
    });
    const placeholder = '问点什么，或说「讲慢一点」';
    const draft =
      '请结合这一节的原文，解释 A* 和 Dijkstra 的关系，以及启发函数在两种算法中的作用。';
    const changed = jest.fn(),
      sent = jest.fn();
    function DraftComposer() {
      const [value, setValue] = useState('');
      return (
        <Composer
          value={value}
          placeholder={placeholder}
          onChange={text => {
            changed(text);
            setValue(text);
          }}
          onSend={() => sent(value)}
          sendDisabled={!value.trim()}
          micAvailable={false}
        />
      );
    }
    const renderer = await mount(<DraftComposer />, skin);
    const input = () => renderer.root.findByType(TextInput);
    const placeholders = () =>
      renderer.root
        .findAllByType(Text)
        .filter(node => node.props.testID === 'composer-placeholder');
    expect(input().props).toMatchObject({
      placeholder: platform === 'android' ? '' : placeholder,
      accessibilityLabel: placeholder,
      numberOfLines: 1,
    });
    expect(input().props.multiline).not.toBe(true);
    expect(input().props.allowFontScaling).not.toBe(false);
    if (platform === 'android') {
      const hint = placeholders()[0];
      expect(hint.props).toMatchObject({
        children: placeholder,
        accessible: false,
        numberOfLines: 1,
        ellipsizeMode: 'tail',
      });
      expect(hint.props.allowFontScaling).not.toBe(false);
      const inputStyle = StyleSheet.flatten(input().props.style);
      expect(StyleSheet.flatten(hint.props.style)).toMatchObject({
        fontSize: inputStyle.fontSize,
        lineHeight: inputStyle.lineHeight,
        fontFamily: inputStyle.fontFamily,
        color: skins[skin].tokens.light.color.ink2,
      });
      expect(hint.parent!.props).toMatchObject({
        pointerEvents: 'none',
        accessible: false,
        importantForAccessibility: 'no-hide-descendants',
      });
      expect(StyleSheet.flatten(hint.parent!.props.style)).toMatchObject({
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: inputStyle.paddingHorizontal,
        justifyContent: 'center',
      });
    } else expect(placeholders()).toHaveLength(0);
    expect(action(renderer.root, '发送').props.disabled).toBe(true);
    await act(async () => input().props.onChangeText(draft));
    expect(changed).toHaveBeenLastCalledWith(draft);
    expect(input().props.value).toBe(draft);
    expect(input().props.numberOfLines).toBe(1);
    expect(placeholders()).toHaveLength(0);
    const edited = draft + '请再补充一个例子。';
    await act(async () => input().props.onChangeText(edited));
    expect(input().props.value).toBe(edited);
    expect(action(renderer.root, '发送').props.disabled).toBe(false);
    await act(async () => action(renderer.root, '发送').props.onPress());
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent).toHaveBeenCalledWith(edited);
    await act(async () => input().props.onChangeText(''));
    expect(placeholders()).toHaveLength(platform === 'android' ? 1 : 0);
  },
);

it.each([
  ['meta', 'root', false, true],
  ['meta', 'push', false, true],
  ['google', 'root', true, false],
  ['google', 'push', true, false],
  ['win11', 'root', false, true],
  ['win11', 'push', true, false],
] as const)(
  '%s/%s keeps its Android ripple placement and icon action',
  async (skin, variant, borderless, foreground) => {
    for (const scheme of ['light', 'dark'] as const) {
      const onPress = jest.fn();
      const renderer = await mount(
        <IconButton
          icon={variant === 'root' ? 'search' : 'more'}
          label="顶栏操作"
          variant={variant}
          onPress={onPress}
        />,
        skin,
        scheme,
      );
      const button = action(renderer.root, '顶栏操作');
      expect(button.props.android_ripple).toEqual({
        color: skins[skin].tokens[scheme].color.pressed,
        borderless,
        foreground,
      });
      if (skin === 'meta') {
        expect(
          StyleSheet.flatten(button.props.style({ pressed: false })),
        ).toMatchObject({
          borderRadius: 20,
          backgroundColor: skins.meta.tokens[scheme].color.surfaceAlt,
        });
      }
      await act(async () => button.props.onPress());
      expect(onPress).toHaveBeenCalledTimes(1);
    }
  },
);

it.each([
  ['win11', 'light', '#FFFFFF'],
  ['win11', 'dark', '#2B0A06'],
  ['google', 'dark', '#601410'],
  ['meta', 'dark', '#FFFFFF'],
] as const)(
  '%s/%s keeps its prototype review badge ink',
  async (skin, scheme, color) => {
    const select = jest.fn();
    const renderer = await mount(
      <TabBar
        items={[{ key: 'review', label: '复习', icon: 'cards', badge: 3 }]}
        active="review"
        onSelect={select}
      />,
      skin,
      scheme,
    );
    const badge = renderer.root
      .findAllByType(Text)
      .find(node => node.props.children === 3)!;
    expect(parseColor(StyleSheet.flatten(badge.props.style).color)).toEqual(
      parseColor(color),
    );
    await act(async () => action(renderer.root, '复习').props.onPress());
    expect(select).toHaveBeenCalledWith('review');
  },
);

it.each(['light', 'dark'] as const)(
  'Google/%s distinguishes pending, completed and current steps while preserving navigation',
  async scheme => {
    const props = makeComponentSamples().StepProgress;
    const renderer = await mount(<StepProgress {...props} />, 'google', scheme);
    const t = skins.google.tokens[scheme];
    const step = (index: number) =>
      action(renderer.root, `第 ${index + 1} 步 ${props.steps[index].title}`);
    const done = step(0),
      current = step(1),
      skipped = step(2),
      todo = step(3);

    expect(StyleSheet.flatten(todo.props.style)).toMatchObject({
      borderWidth: 1,
      backgroundColor: 'transparent',
    });
    expect(StyleSheet.flatten(circle(todo).props.style)).toMatchObject({
      borderWidth: 1.5,
      borderColor: t.color.ink2,
      backgroundColor: 'transparent',
    });
    expect(StyleSheet.flatten(done.props.style)).toMatchObject({
      borderWidth: 0,
      backgroundColor: t.color.surfaceAlt,
    });
    expect(StyleSheet.flatten(circle(done).props.style)).toMatchObject({
      borderWidth: 0,
      backgroundColor: 'transparent',
    });
    expect(done.findByType(Icon).props).toMatchObject({
      name: 'check',
      color: t.color.accent,
    });
    expect(StyleSheet.flatten(current.props.style)).toMatchObject({
      borderWidth: 0,
      backgroundColor: t.brand!.secondaryContainer,
    });
    expect(StyleSheet.flatten(circle(current).props.style)).toMatchObject({
      borderWidth: 0,
      backgroundColor: t.brand!.accentFill,
    });
    expect(
      StyleSheet.flatten(circle(current).findByType(Text).props.style).color,
    ).toBe(t.color.onAccent);
    expect(current.props.accessibilityState.selected).toBe(true);
    expect(todo.props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(circle(skipped).props.style).borderWidth).toBe(0);
    expect(skipped.findByType(Icon).props.name).toBe('skip');

    await act(async () => todo.props.onPress());
    expect(props.onPressStep).toHaveBeenCalledWith(3);
    await act(async () =>
      action(renderer.root, `${props.label}，查看路线图`).props.onPress(),
    );
    expect(props.onPressBar).toHaveBeenCalledTimes(1);
  },
);

it.each([1, 2])(
  'Google keeps step numbers and navigation available at system font scale %s',
  async fontScale => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 360,
      height: 800,
      scale: 3,
      fontScale,
    });
    const props = makeComponentSamples().StepProgress;
    const renderer = await mount(<StepProgress {...props} />, 'google');
    const pending = action(renderer.root, '第 4 步 检查理解');
    const numberCircle = circle(pending, 20 * fontScale);
    const number = numberCircle.findByType(Text);
    const chipStyle = StyleSheet.flatten(pending.props.style);
    expect(chipStyle.minHeight).toBe(32);
    expect(chipStyle.height).toBeUndefined();
    expect(StyleSheet.flatten(numberCircle.props.style)).toMatchObject({
      width: 20 * fontScale,
      height: 20 * fontScale,
      borderRadius: 10 * fontScale,
    });
    expect(
      StyleSheet.flatten(number.props.style).lineHeight * fontScale,
    ).toBeLessThan(StyleSheet.flatten(numberCircle.props.style).height);
    expect(number.props.allowFontScaling).not.toBe(false);
    const label = pending
      .findAllByType(Text)
      .find(node => node.props.children === '检查理解')!;
    expect(label.props.allowFontScaling).not.toBe(false);
    await act(async () => pending.props.onPress());
    expect(props.onPressStep).toHaveBeenCalledWith(3);
  },
);

const no = () => {};
const studyIntents: StudyIntents = {
  back: no,
  setMode: no,
  openMenu: no,
  menuSelect: no,
  quick: no,
  setText: no,
  send: no,
  stop: no,
  clearQuote: no,
  pressStep: no,
  openRoadmap: no,
  openContext: no,
  pressCite: no,
  pressFigure: no,
  pressTable: no,
  toggleFold: no,
  toggleHistory: no,
  answerQuiz: no,
  resolveProposal: no,
  resumeAction: no,
  retry: no,
  setView: no,
  toggleGuide: no,
  pressBlock: no,
  menuAction: no,
  reportAnchor: no,
  pressPin: no,
  finishReading: no,
  overlayAction: no,
  setNoteText: no,
  closeOverlay: no,
};

it.each(['light', 'dark'] as const)(
  'Win11/%s uses the original headphones and exposes context only while listening',
  async scheme => {
    const openContext = jest.fn(),
      setMode = jest.fn();
    const intents = { ...studyIntents, openContext, setMode };
    const state = {
      ...studySamples.normal,
      listen: { ...studySamples.normal.listen, thread: [], quickActions: [] },
    };
    const tree = (mode: 'listen' | 'read') => (
      <SkinProvider skinId="win11" scheme={scheme} reduceMotion>
        <StudyView state={{ ...state, mode }} intents={intents} />
      </SkinProvider>
    );
    let renderer!: Renderer.ReactTestRenderer;
    await act(async () => {
      renderer = Renderer.create(tree('listen'));
    });
    mounted.add(renderer);
    const mode = renderer.root.findByType(ModeSwitch);
    const headphones = mode
      .findAllByType(Icon)
      .find(icon => icon.props.name === 'listen')!;
    expect(headphones).toBeDefined();
    expect(headphones.findByType(SvgXml).props.xml).toContain(
      '<path d="M4 13v-1a8 8 0 0116 0v1"/>',
    );
    const context = action(renderer.root, 'AI 看到的内容');
    const t = skins.win11.tokens[scheme];
    expect(
      StyleSheet.flatten(
        typeof context.props.style === 'function'
          ? context.props.style({ pressed: false })
          : context.props.style,
      ),
    ).toMatchObject({
      minHeight: 30,
      borderRadius: 999,
      backgroundColor: t.brand!.cardLo,
      borderColor: t.brand!.stroke,
    });
    expect(
      StyleSheet.flatten(context.findAllByType(Text)[0].props.style).color,
    ).toBe(t.color.ink2);
    expect(
      context.findAllByType(View).some(node => {
        const style = StyleSheet.flatten(node.props.style);
        return (
          style?.width === 8 &&
          style.height === 8 &&
          style.backgroundColor === t.color.ok
        );
      }),
    ).toBe(true);
    await act(async () => context.props.onPress());
    expect(openContext).toHaveBeenCalledTimes(1);
    await act(async () => action(mode, '读书').props.onPress());
    expect(setMode).toHaveBeenCalledWith('read');
    await act(async () => renderer.update(tree('read')));
    expect(action(renderer.root, 'AI 看到的内容')).toBeUndefined();
    expect(renderer.root.findByType(ModeSwitch)).toBeDefined();
  },
);

it('Win11 lets the context capsule wrap and grow at 360dp with system font scale 2', async () => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({
    width: 360,
    height: 800,
    scale: 3,
    fontScale: 2,
  });
  const openContext = jest.fn(),
    setMode = jest.fn();
  const renderer = await mount(
    <StudyView
      state={{
        ...studySamples.normal,
        listen: { ...studySamples.normal.listen, thread: [], quickActions: [] },
      }}
      intents={{ ...studyIntents, openContext, setMode }}
    />,
    'win11',
  );
  const mode = renderer.root.findByType(ModeSwitch);
  const selector = mode.parent!;
  expect(StyleSheet.flatten(selector.props.style)).toMatchObject({
    flexDirection: 'row',
    flexWrap: 'wrap',
  });
  const context = action(renderer.root, 'AI 看到的内容');
  const contextStyle = StyleSheet.flatten(
    context.props.style({ pressed: false }),
  );
  expect(contextStyle.minHeight).toBe(30);
  expect(contextStyle.height).toBeUndefined();
  expect(context.findAllByType(Text)[0].props.allowFontScaling).not.toBe(false);
  await act(async () => context.props.onPress());
  expect(openContext).toHaveBeenCalledTimes(1);
  await act(async () => action(mode, '读书').props.onPress());
  expect(setMode).toHaveBeenCalledWith('read');
});
