const { jest } = require('@jest/globals');

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return { GestureHandlerRootView: View };
});
jest.mock('@react-native-community/blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, ScrollView } = require('react-native');
  const BottomSheet = React.forwardRef(({ children, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({
      close: jest.fn(),
      snapToIndex: jest.fn(),
      expand: jest.fn(),
    }));
    return React.createElement(View, props, children);
  });
  BottomSheet.displayName = 'MockBottomSheet';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: View,
    BottomSheetScrollView: ScrollView,
    BottomSheetBackdrop: View,
  };
});

jest.mock('react-native-reanimated', () => ({
  ReduceMotion: { Always: 'always', System: 'system', Never: 'never' },
}));
