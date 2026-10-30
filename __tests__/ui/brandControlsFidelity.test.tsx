import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { SvgXml } from 'react-native-svg';
import {
  Icon,
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
afterEach(async () => {
  await act(async () => {
    for (const renderer of mounted) renderer.unmount();
  });
  mounted.clear();
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
function circle(root: ReactTestInstance) {
  return root.findAllByType(View).find(node => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.width === 20 && style.height === 20;
  })!;
}

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
      height: 30,
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
