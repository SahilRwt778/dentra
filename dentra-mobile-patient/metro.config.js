const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { createHash } = require('node:crypto');
const readPublicEnvironment = require('./public-environment.cjs');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaults = getDefaultConfig(__dirname);
const path = require('path');
const config = {
  // Public values embedded by Babel are part of every transform's cache identity.
  cacheVersion: createHash('sha256')
    .update(JSON.stringify(readPublicEnvironment()))
    .digest('hex'),
  watchFolders: [path.resolve(__dirname, '../packages')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Resolve workspace packages directly when npm's symlink is missing from Metro's file map.
    extraNodeModules: {
      '@dentra/video': path.resolve(__dirname, '../packages/dentra-video'),
      '@dentra/call-core': path.resolve(__dirname, '../packages/dentra-call-core'),
    },
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
