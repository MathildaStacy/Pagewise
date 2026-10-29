module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          '@core': './src/core',
          '@data': './src/data',
          '@services': './src/services',
          '@platform': './src/platform',
          '@app': './src/app',
          '@features': './src/features',
          '@ui': './src/ui',
        },
        extensions: [
          '.android.ts',
          '.android.tsx',
          '.ts',
          '.tsx',
          '.js',
          '.json',
        ],
      },
    ],
    'react-native-worklets/plugin',
  ],
};
