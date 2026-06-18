import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  Galva,
  InAppMessageAutoShow,
  identify,
  sdkVersion,
  track,
  useGalvaUser,
} from '@galva/react-native';

// Phase 1 smoke screen, React-first style (plan §4): <Galva> configures the
// SDK, <InAppMessageAutoShow> renders any served message, and useGalvaUser
// reads identity reactively — no useEffect(configure)/messages()/show() wiring.
// Use a real publishable key to test end-to-end against the dev environment.
const API_KEY = 'gv_pub_example';

function Screen() {
  const { userId, isAnonymous, loading } = useGalvaUser();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    track('ExampleAppLaunched');
    identify('example_user_1');
    sdkVersion().then(setVersion);
  }, []);

  return (
    <View style={styles.container}>
      <Text>Native core version: {version ?? '…'}</Text>
      <Text>Identified user: {loading ? '…' : (userId ?? '(anonymous)')}</Text>
      <Text>Anonymous: {isAnonymous === null ? '…' : String(isAnonymous)}</Text>
    </View>
  );
}

export default function App() {
  return (
    <Galva apiKey={API_KEY} environment="development" logLevel="debug">
      <Screen />
      <InAppMessageAutoShow />
    </Galva>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
