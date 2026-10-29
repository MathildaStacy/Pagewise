const { jest } = require('@jest/globals');

jest.mock('react-native/Libraries/Utilities/DevSettings', () => ({
  __esModule: true,
  default: { addMenuItem: jest.fn(), reload: jest.fn() },
}));

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
  const BottomSheet = React.forwardRef(
    (
      {
        children,
        handleComponent: Header,
        footerComponent: Footer,
        ...props
      },
      ref,
    ) => {
      React.useImperativeHandle(ref, () => ({
        close: jest.fn(),
        snapToIndex: jest.fn(),
        expand: jest.fn(),
      }));
      return React.createElement(
        View,
        props,
        Header
          ? React.createElement(Header, {
              animatedIndex: { value: 0 },
              animatedPosition: { value: 0 },
            })
          : null,
        children,
        Footer
          ? React.createElement(Footer, {
              animatedFooterPosition: { value: 0 },
            })
          : null,
      );
    },
  );
  BottomSheet.displayName = 'MockBottomSheet';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: View,
    BottomSheetScrollView: ScrollView,
    BottomSheetBackdrop: View,
    BottomSheetFooter: View,
    useBottomSheetInternal: () => null,
  };
});

jest.mock('react-native-reanimated', () => ({
  ReduceMotion: { Always: 'always', System: 'system', Never: 'never' },
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const postMessage = jest.fn();
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ postMessage, reload: jest.fn() }));
    return React.createElement(View, props);
  });
  WebView.displayName = 'MockWebView';
  return {
    __esModule: true,
    default: WebView,
    WebView,
    __postMessage: postMessage,
  };
});
