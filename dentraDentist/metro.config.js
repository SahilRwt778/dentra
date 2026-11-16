const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('path');
const config = {
  watchFolders: [path.resolve(__dirname, '../packages')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Resolve workspace packages directly when npm's symlink is missing from Metro's file map.
    extraNodeModules: {
      '@dentra/video': path.resolve(__dirname, '../packages/dentra-video'),
      '@dentra/call-core': path.resolve(__dirname, '../packages/dentra-call-core'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
