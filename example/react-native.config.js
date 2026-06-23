const path = require('path');
const pkg = require('../package.json');

// Point React Native autolinking at the local Galva package one level up,
// rather than a node_modules entry. The library is the workspace *root*, which
// npm can't resolve as a sibling dependency, so we register it explicitly here
// (the standard create-react-native-library approach). Autolinking then finds
// Galva.podspec for iOS pods.
module.exports = {
  dependencies: {
    [pkg.name]: {
      root: path.join(__dirname, '..'),
    },
  },
};
