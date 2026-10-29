import Renderer, { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { PageOrig, SkinProvider } from '@ui/kit';
let renderer: Renderer.ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const base = { uri: 'file:///page.png', width: 600, height: 800 };
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
            { ref: 1, x0: 0, y0: 0, x1: 1, y1: 1, state: 'current' },
            { ref: 2, x0: 1, y0: 0, x1: 0, y1: 1, state: 'done' },
          ]}
        />
      </SkinProvider>,
    );
  });
  expect(
    renderer.root.findAllByProps({ testID: 'pdf-block-1' })[0].props
      .accessibilityState,
  ).toEqual({ disabled: true, selected: true });
  expect(renderer.root.findAllByProps({ testID: 'pdf-block-2' })).toHaveLength(
    0,
  );
});
