import { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  configure,
  identifiedUserId,
  identify,
  isAnonymous,
  logout,
  messages,
  sdkVersion,
  show,
  track,
} from '@galva/react-native';

// Phase 1 smoke screen: configures the SDK on mount, exercises the identity
// round-trip, and renders any in-app message the backend serves. Use a real
// publishable key to test end-to-end against the development environment.
const API_KEY = 'gv_pub_example';

export default function App() {
  const [version, setVersion] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState<boolean | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  useEffect(() => {
    configure({
      apiKey: API_KEY,
      environment: 'development',
      logLevel: 'debug',
    });
    track('ExampleAppLaunched');

    identify('example_user_1');
    identifiedUserId().then(setUserId);
    isAnonymous().then(setAnonymous);
    sdkVersion().then(setVersion);

    const unsubscribe = messages((message) => {
      setLastMessageId(message.id);
      show(message.id);
    });
    return () => {
      unsubscribe();
      logout();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text>Native core version: {version ?? '…'}</Text>
      <Text>Identified user: {userId ?? '…'}</Text>
      <Text>Anonymous: {anonymous === null ? '…' : String(anonymous)}</Text>
      <Text>Last in-app message: {lastMessageId ?? '(none yet)'}</Text>
    </View>
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
