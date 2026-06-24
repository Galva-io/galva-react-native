import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { configureSDK, getSDKVersion, handleDeepLink } from '@galva/react-native';

// E2E fixture app. Proves the SDK initializes under Expo, the native module is
// reachable (getSDKVersion), and a Galva `gv…` deep link routed by the OS (via
// the scheme the config plugin registered) reaches JS and is claimed.
//
// The L2 smoke (scripts/test-expo-runtime.sh) reads the `[GALVA_E2E] …` console
// markers from the device log and the on-screen status to assert the outcome.
export default function App() {
  const [version, setVersion] = useState('?');
  const [deepLink, setDeepLink] = useState('waiting');

  useEffect(() => {
    configureSDK({ apiKey: 'gv_pub_e2e' });

    getSDKVersion()
      .then((v) => {
        setVersion(v);
        console.log(`[GALVA_E2E] sdk_version ${v}`);
      })
      .catch(() => setVersion('error'));

    const onURL = (url: string | null): void => {
      if (!url) return;
      console.log(`[GALVA_E2E] url_received ${url}`);
      handleDeepLink(url)
        .then((claimed) => {
          console.log(`[GALVA_E2E] deeplink_claimed=${claimed} ${url}`);
          setDeepLink(`claimed=${claimed}: ${url}`);
        })
        .catch(() => setDeepLink(`received: ${url}`));
    };

    Linking.getInitialURL()
      .then(onURL)
      .catch(() => undefined);
    const sub = Linking.addEventListener('url', ({ url }) => onURL(url));
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.container}>
      <Text testID="galva.expo.version">galva v{version}</Text>
      <Text testID="galva.expo.deeplink">{deepLink}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
});
