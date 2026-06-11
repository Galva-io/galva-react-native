import React, {useEffect, useState} from 'react';
import {SafeAreaView, Text} from 'react-native';
import {
  configure,
  identify,
  identifiedUserId,
  isAnonymous,
  sdkVersion,
  track,
  messages,
} from '@galva/react-native';

const App = () => {
  const [version, setVersion] = useState('…');
  const [userId, setUserId] = useState('…');
  const [anonymous, setAnonymous] = useState('…');

  useEffect(() => {
    configure({apiKey: 'gv_pub_example', environment: 'development'});
    track('OldArchSmoke');
    identify('oldarch_user_1');
    sdkVersion().then(v => setVersion(String(v)));
    identifiedUserId().then(u => setUserId(String(u)));
    isAnonymous().then(a => setAnonymous(String(a)));
    const unsubscribe = messages(() => {});
    return unsubscribe;
  }, []);

  return (
    <SafeAreaView
      style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>RN 0.70 / Old Architecture</Text>
      <Text>sdkVersion: {version}</Text>
      <Text>identifiedUserId: {userId}</Text>
      <Text>isAnonymous: {anonymous}</Text>
    </SafeAreaView>
  );
};

export default App;
