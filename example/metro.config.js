const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Resolve the local Galva package (the workspace root, one level up) so the
// example bundles the live library. `exports` subpath conditions are honored by
// Metro on RN 0.79+.
const root = path.resolve(__dirname, '..');

/** @type {import('@react-native/metro-config').MetroConfig} */
const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      '@galva/react-native': root,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
