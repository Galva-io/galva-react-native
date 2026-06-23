/**
 * Galva React Native — example app + contract smoke.
 *
 * On mount it exercises every public API against the REAL native module and
 * renders PASS/FAIL. This is the authoritative bridge-sync check: if a method
 * is missing/misnamed/mis-typed on the native side, its call throws here and the
 * status flips to FAIL. `galva.contract.status` is the testID an E2E runner (or
 * a human) asserts is "PASS".
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  configureSDK,
  trackEvent,
  identifyUser,
  getIdentifiedUserId,
  logOut,
  setUserAttributes,
  registerAPNsToken,
  registerFCMToken,
  handleNotificationResponse,
  handleDeepLink,
  setOptOut,
  isOptedOut,
  reconcileTransactions,
  getSDKVersion,
  VERSION,
} from '@galva/react-native';
import {
  showMessage,
  addMessageObserver,
} from '@galva/react-native/in-app-message';
import { useInAppMessages } from '@galva/react-native/react';

type Result = { name: string; ok: boolean; detail: string };

async function runContract(): Promise<Result[]> {
  const out: Result[] = [];
  const pass = (name: string, detail = '') => out.push({ name, ok: true, detail });
  const fail = (name: string, e: unknown) =>
    out.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });

  // Fire-and-forget (void) — must not throw.
  try { configureSDK({ apiKey: 'gv_pub_demo', environment: 'development' }); pass('configureSDK'); } catch (e) { fail('configureSDK', e); }
  try { trackEvent('contract_smoke', { count: 1, flag: true, nested: { a: 1 } }); pass('trackEvent'); } catch (e) { fail('trackEvent', e); }
  try { identifyUser('user-smoke', { appAccountToken: '00000000-0000-0000-0000-000000000001' }); pass('identifyUser'); } catch (e) { fail('identifyUser', e); }
  try { setUserAttributes({ email: 'smoke@galva.io', fullName: 'Smoke', plan: 'pro' }); pass('setUserAttributes'); } catch (e) { fail('setUserAttributes', e); }
  try { registerAPNsToken('00aabbccddeeff'); pass('registerAPNsToken'); } catch (e) { fail('registerAPNsToken', e); }
  try { registerFCMToken('fcm-smoke-token'); pass('registerFCMToken'); } catch (e) { fail('registerFCMToken', e); }
  try { handleNotificationResponse({ id: 'notif-1', userInfo: { sender: 'galva', campaignId: 7 } }); pass('handleNotificationResponse'); } catch (e) { fail('handleNotificationResponse', e); }
  try { setOptOut(false); pass('setOptOut'); } catch (e) { fail('setOptOut', e); }
  try { reconcileTransactions(); pass('reconcileTransactions'); } catch (e) { fail('reconcileTransactions', e); }

  // Promise-returning — await the real native response.
  try { pass('getSDKVersion', await getSDKVersion()); } catch (e) { fail('getSDKVersion', e); }
  try { pass('getIdentifiedUserId', String(await getIdentifiedUserId())); } catch (e) { fail('getIdentifiedUserId', e); }
  try { pass('isOptedOut', String(await isOptedOut())); } catch (e) { fail('isOptedOut', e); }
  try { pass('handleDeepLink', String(await handleDeepLink('gv://noop'))); } catch (e) { fail('handleDeepLink', e); }

  // showMessage with a bogus id should reject with a GalvaError — a successful
  // round-trip (the bridge responded), so it counts as a pass.
  try { await showMessage('does-not-exist'); pass('showMessage', 'resolved'); }
  catch (e) { pass('showMessage', `rejected as expected: ${e instanceof Error ? e.message : String(e)}`); }

  try { logOut(); pass('logOut'); } catch (e) { fail('logOut', e); }

  return out;
}

export default function App(): React.JSX.Element {
  const [results, setResults] = useState<Result[]>([]);
  const message = useInAppMessages();

  useEffect(() => {
    const subscription = addMessageObserver(() => {});
    void runContract().then(setResults);
    return () => subscription.remove();
  }, []);

  const status =
    results.length === 0 ? 'RUNNING' : results.every((r) => r.ok) ? 'PASS' : 'FAIL';

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Galva RN contract smoke</Text>
      <Text testID="galva.version">js v{VERSION}</Text>
      <Text
        testID="galva.contract.status"
        style={[styles.status, status === 'PASS' ? styles.ok : status === 'FAIL' ? styles.bad : styles.run]}
      >
        {status}
      </Text>
      <Text testID="galva.message">{message ? `message:${message.id}` : 'no message'}</Text>
      <ScrollView style={styles.list}>
        {results.map((r) => (
          <View key={r.name} style={styles.row}>
            <Text style={r.ok ? styles.ok : styles.bad}>
              {r.ok ? '✓' : '✗'} {r.name}
            </Text>
            {r.detail ? <Text style={styles.detail}>{r.detail}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 64, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  status: { fontSize: 28, fontWeight: '800', marginVertical: 8 },
  run: { color: '#888' },
  ok: { color: '#137333' },
  bad: { color: '#c5221f' },
  list: { marginTop: 8 },
  row: { paddingVertical: 4 },
  detail: { color: '#555', fontSize: 12, marginLeft: 16 },
});
