import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  configure,
  identify,
  identifiedUserId,
  isAnonymous,
  sdkVersion,
  track,
  messages,
} from '@galva/react-native';

export default function App() {
  const [version, setVersion] = useState('…');
  const [userId, setUserId] = useState('…');
  const [anonymous, setAnonymous] = useState('…');

  useEffect(() => {
    configure({ apiKey: 'gv_pub_example', environment: 'development' });
    track('ExpoNewArchSmoke');
    identify('expo_newarch_user');
    sdkVersion().then((v) => setVersion(String(v)));
    identifiedUserId().then((u) => setUserId(String(u)));
    isAnonymous().then((a) => setAnonymous(String(a)));
    const unsubscribe = messages(() => {});
    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <Text>Expo SDK 56 / New Architecture</Text>
      <Text>sdkVersion: {version}</Text>
      <Text>identifiedUserId: {userId}</Text>
      <Text>isAnonymous: {anonymous}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
