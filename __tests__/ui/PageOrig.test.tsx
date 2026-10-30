import Renderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { PageOrig, SkinProvider } from '@ui/kit';
let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const base = { uri: 'file:///page.png', width: 600, height: 800 };
const page = () =>
  renderer.root.findAllByProps({ accessibilityLabel: '原版书页' })[0];
async function measurePage(width = 300, height = 400) {
  await act(async () =>
    page().props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width, height } },
    }),
  );
}
it.each(['paper', 'glass'] as const)(
  'shows simultaneous marks and accessible pins in %s',
  async skinId => {
    const onBlock = jest.fn(),
      onPin = jest.fn();
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId={skinId} scheme="dark" reduceMotion>
          <PageOrig
            {...base}
            blocks={[
              {
                ref: 1,
                x0: 0.1,
                y0: 0.2,
                x1: 0.9,
                y1: 0.3,
                marks: ['heard', 'highlight', 'selected'],
                pin: true,
                pinLabel: '为什么这样',
                label: '原文段落',
              },
              {
                ref: 2,
                x0: 0.1,
                y0: 0.4,
                x1: 0.9,
                y1: 0.5,
                marks: ['now', 'flash'],
              },
              { ref: 3, x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.2, selectable: false },
            ]}
            onBlock={onBlock}
            onPin={onPin}
          />
        </SkinProvider>,
        {
          createNodeMock: () => ({
            measureInWindow: (
              callback: (x: number, y: number, w: number, h: number) => void,
            ) => callback(10, 20, 300, 400),
          }),
        },
      );
    });
    await measurePage();
    const first = renderer.root.findAllByProps({ testID: 'pdf-block-1' })[0];
    renderer.root.findAllByProps({
      accessibilityLabel: '原版书页',
    })[0].instance.measureInWindow = (
      callback: (x: number, y: number, w: number, h: number) => void,
    ) => callback(10, 20, 300, 400);
    expect(first.props.accessibilityState).toMatchObject({
      selected: true,
      disabled: false,
    });
    expect(StyleSheet.flatten(first.props.style).borderLeftWidth).toBe(2);
    expect(
      renderer.root.findAllByProps({ testID: 'pdf-fill-1' }),
    ).not.toHaveLength(0);
    const current = renderer.root.findAllByProps({ testID: 'pdf-block-2' })[0];
    expect(StyleSheet.flatten(current.props.style).borderLeftWidth).toBe(3);
    expect(
      renderer.root.findAllByProps({ testID: 'pdf-block-3' })[0].props.disabled,
    ).toBe(true);
    await act(async () =>
      renderer.root.findAllByProps({ testID: 'pdf-pin-1' })[0].props.onPress(),
    );
    expect(onPin).toHaveBeenCalledWith(1);
    await act(async () => first.props.onPress());
    expect(onBlock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ x: 40, y: 100, w: 240 }),
    );
    expect(onBlock.mock.calls[0][1].h).toBeCloseTo(40);
  },
);
it('keeps the legacy single state API and rejects degenerate geometry', async () => {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="paper" scheme="light" reduceMotion>
        <PageOrig
          {...base}
          blocks={[
            { ref: 1, x0: 0, y0: 0, x1: 1, y1: 1, state: 'current', pin: true },
            { ref: 2, x0: 1, y0: 0, x1: 0, y1: 1, state: 'done', pin: true },
          ]}
        />
      </SkinProvider>,
    );
  });
  await measurePage();
  expect(
    renderer.root.findAllByProps({ testID: 'pdf-block-1' })[0].props
      .accessibilityState,
  ).toEqual({ disabled: true, selected: true });
  expect(renderer.root.findAllByProps({ testID: 'pdf-block-2' })).toHaveLength(
    0,
  );
  expect(renderer.root.findAllByProps({ testID: 'pdf-pin-2' })).toHaveLength(0);
  expect(
    renderer.root.findAllByProps({ testID: 'pdf-pin-1' })[0].props.disabled,
  ).toBe(true);
});

it.each([
  ['interior', [0.1, 0.2, 0.9, 0.3], [230, 72], [238, 80]],
  ['tiny block', [0.49, 0.5, 0.5, 0.51], [110, 192], [118, 200]],
  ['top left', [0, 0, 0.02, 0.01], [0, 0], [0, 0]],
  ['top right', [0.98, 0, 1, 0.01], [252, 0], [268, 0]],
  ['bottom left', [0, 0.99, 0.02, 1], [0, 352], [0, 368]],
  ['bottom right', [0.98, 0.99, 1, 1], [252, 352], [268, 368]],
] as const)(
  'keeps a 48dp page-level pin target and a 32dp visible circle for %s',
  async (_name, [x0, y0, x1, y1], [left, top], [badgeLeft, badgeTop]) => {
    const onPin = jest.fn(),
      onBlock = jest.fn();
    await act(async () => {
      renderer = Renderer.create(
        <SkinProvider skinId="google" scheme="light" reduceMotion>
          <PageOrig
            {...base}
            blocks={[
              { ref: 7, x0, y0, x1, y1, pin: true, pinLabel: '为什么这样' },
            ]}
            onPin={onPin}
            onBlock={onBlock}
          />
        </SkinProvider>,
      );
    });
    await measurePage();
    const target = renderer.root.findAllByProps({ testID: 'pdf-pin-7' })[0];
    const badge = renderer.root.findAllByProps({
      testID: 'pdf-pin-badge-7',
    })[0];
    const targetStyle = StyleSheet.flatten(target.props.style);
    const badgeStyle = StyleSheet.flatten(badge.props.style);
    expect(target.parent!.props.accessibilityLabel).toBe('原版书页');
    expect(targetStyle).toMatchObject({
      position: 'absolute',
      left,
      top,
      width: 48,
      height: 48,
    });
    expect(targetStyle.backgroundColor).toBeUndefined();
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + 48).toBeLessThanOrEqual(300);
    expect(top + 48).toBeLessThanOrEqual(400);
    expect(badgeStyle).toMatchObject({
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: '#FFE7A3',
    });
    expect(left + badgeStyle.left).toBe(badgeLeft);
    expect(top + badgeStyle.top).toBe(badgeTop);
    const block = renderer.root.findAllByProps({ testID: 'pdf-block-7' })[0];
    const blockStyle = StyleSheet.flatten(block.parent!.props.style);
    expect(parseFloat(blockStyle.left)).toBeCloseTo(x0 * 100);
    expect(parseFloat(blockStyle.top)).toBeCloseTo(y0 * 100);
    expect(parseFloat(blockStyle.width)).toBeCloseTo((x1 - x0) * 100);
    expect(parseFloat(blockStyle.height)).toBeCloseTo((y1 - y0) * 100);
    expect(target.props.accessibilityLabel).toBe('为什么这样');
    await act(async () => target.props.onPress());
    expect(onPin).toHaveBeenCalledWith(7);
    expect(onBlock).not.toHaveBeenCalled();
  },
);

it('repositions the pin after the rendered page resizes while preserving PDF and block geometry', async () => {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="win11" scheme="dark" reduceMotion>
        <PageOrig
          {...base}
          blocks={[{ ref: 1, x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.3, pin: true }]}
          onPin={jest.fn()}
        />
      </SkinProvider>,
    );
  });
  await measurePage();
  const target = () => renderer.root.findAllByProps({ testID: 'pdf-pin-1' })[0];
  expect(StyleSheet.flatten(target().props.style)).toMatchObject({
    left: 230,
    top: 72,
    width: 48,
    height: 48,
  });
  await measurePage(450, 600);
  expect(StyleSheet.flatten(target().props.style)).toMatchObject({
    left: 365,
    top: 112,
    width: 48,
    height: 48,
  });
  expect(StyleSheet.flatten(page().props.style)).toMatchObject({
    width: '100%',
    aspectRatio: 0.75,
    overflow: 'hidden',
  });
  const badge = renderer.root.findAllByProps({ testID: 'pdf-pin-badge-1' })[0];
  expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,214,107,.13)',
  });
});

it('keeps the target inside a page that is itself smaller than 48dp', async () => {
  await act(async () => {
    renderer = Renderer.create(
      <SkinProvider skinId="google" scheme="light" reduceMotion>
        <PageOrig
          {...base}
          blocks={[{ ref: 1, x0: 0, y0: 0, x1: 1, y1: 1, pin: true }]}
          onPin={jest.fn()}
        />
      </SkinProvider>,
    );
  });
  await measurePage(40, 40);
  const target = renderer.root.findAllByProps({ testID: 'pdf-pin-1' })[0];
  expect(StyleSheet.flatten(target.props.style)).toMatchObject({
    left: 0,
    top: 0,
    width: 40,
    height: 40,
  });
});
