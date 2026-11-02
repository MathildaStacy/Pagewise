import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { MathProvider, SkinProvider, TableView, type SkinId } from '@ui/kit';
import { tableRows } from '@features/study/presenters';
import { parse } from '@core/markup';

const rows = tableRows(
  '<table><tr><td>交易</td><td>今天</td><td>$T_1$</td><td>$T_2$</td></tr><tr><td>PV<sub>float</sub></td><td>$D(T_2)$</td><td>0</td><td>1 &amp; 2</td></tr></table>',
  '',
);
it('retains table math and script semantics while decoding cell text', () => {
  expect(rows).toEqual([
    ['交易', '今天', '$T_1$', '$T_2$'],
    ['PV<sub>float</sub>', '$D(T_2)$', '0', '1 & 2'],
  ]);
});
it.each(
  (['paper', 'glass', 'meta', 'google', 'win11'] as SkinId[]).flatMap(skin =>
    (['light', 'dark'] as const).map(scheme => [skin, scheme] as const),
  ),
)(
  '%s/%s renders formula cells and retains the final column',
  async (skin, scheme) => {
    const service = {
      render: jest.fn().mockResolvedValue({
        svg: '<svg><path fill="currentColor"/></svg>',
        width: 4,
        height: 2,
        baseline: 1.5,
      }),
    };
    let tree!: Renderer.ReactTestRenderer;
    try {
      await act(async () => {
        tree = Renderer.create(
          <MathProvider renderer={service}>
            <SkinProvider skinId={skin} scheme={scheme} reduceMotion>
              <TableView rows={rows.map(row => row.map(cell => parse(cell)))} />
            </SkinProvider>
          </MathProvider>,
        );
      });
      expect(service.render).toHaveBeenCalledWith('T_1', false);
      expect(service.render).toHaveBeenCalledWith('T_2', false);
      expect(service.render).toHaveBeenCalledWith('{}_{\\text{float}}', false);
      expect(tree.root.findAllByType(SvgXml)).toHaveLength(4);
      expect(
        tree.root.findAllByType(Text).some(n => n.props.children === '1 & 2'),
      ).toBe(true);
      expect(
        tree.root
          .findAllByType(Text)
          .some(
            n =>
              typeof n.props.children === 'string' &&
              /\$T_|<sub>/.test(n.props.children),
          ),
      ).toBe(false);
    } finally {
      if (tree) await act(async () => tree.unmount());
    }
  },
);
