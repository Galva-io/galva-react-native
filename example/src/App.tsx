import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  Galva,
  InAppMessageAutoShow,
  identifiedUserId,
  identify,
  isAnonymous,
  sdkVersion,
  track,
} from '@galva/react-native';

// Phase 1 smoke screen, React-first style (plan §4): <Galva> configures the
// SDK, <InAppMessageAutoShow> renders any served message — no
// useEffect(configure)/onMessage()/show() wiring. Identity getters are read
// once on mount. Use a real publishable key to test against the dev env.
const API_KEY = 'gv_pub_example';

function Screen() {
  const [version, setVersion] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState<boolean | null>(null);

  useEffect(() => {
    track('ExampleAppLaunched');
    identify('example_user_1');
    sdkVersion().then(setVersion);
    identifiedUserId().then(setUserId);
    isAnonymous().then(setAnonymous);
  }, []);

  return (
    <View style={styles.container}>
      <Text>Native core version: {version ?? '…'}</Text>
      <Text>Identified user: {userId ?? '(anonymous)'}</Text>
      <Text>Anonymous: {anonymous === null ? '…' : String(anonymous)}</Text>
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
