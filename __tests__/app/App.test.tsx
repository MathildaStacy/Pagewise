import { View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import App from '../../src/App';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

it('mounts the empty Pagewise application', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(
    renderer!.root
      .findAllByType(View)
      .some(view => view.props.accessibilityLabel === 'Pagewise'),
  ).toBe(true);

  await ReactTestRenderer.act(async () => renderer!.unmount());
});
