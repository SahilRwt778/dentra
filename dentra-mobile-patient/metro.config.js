const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaults = getDefaultConfig(__dirname);
const path = require('path');
const config = {
  watchFolders: [path.resolve(__dirname, '../packages')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    sourceExts: [...defaults.resolver.sourceExts, 'mjs'],
    // Lucide exposes a CJS entry as well as .mjs. Resolve that entry
    // explicitly so Metro and native builds use the same package file.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'lucide-react-native') {
        return { type: 'sourceFile', filePath: require.resolve(moduleName) };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaults, config);
