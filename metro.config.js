const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest(context, moduleName, platform) {
      // htmlparser2's ESM entry exports a namespace unsupported by the RN preset.
      if (moduleName === 'htmlparser2') {
        return { type: 'sourceFile', filePath: require.resolve('htmlparser2') };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
