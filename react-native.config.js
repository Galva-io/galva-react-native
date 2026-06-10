// Explicit autolinking config so the legacy ReactPackage resolves the same way
// on every RN version we support (auto-detection of legacy packages has varied
// across releases). iOS resolves from the single *.podspec automatically.
module.exports = {
  dependency: {
    platforms: {
      android: {
        packageImportPath: 'import com.galva.reactnative.GalvaPackage;',
        packageInstance: 'new GalvaPackage()',
      },
    },
  },
};
