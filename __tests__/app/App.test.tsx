import { View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import App from '../../src/App';
import { createTestContainer } from '@app/testing';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

it('bootstraps the foundation and renders the component gallery', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <App bootstrap={createTestContainer} />,
    );
  });

  expect(
    renderer!.root
      .findAllByType(View)
      .some(view => view.props.accessibilityLabel === 'Pagewise'),
  ).toBe(true);

  expect(
    renderer!.root.findAll(node => node.props.accessibilityLabel === '组件对照')
      .length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(async () => renderer!.unmount());
});
