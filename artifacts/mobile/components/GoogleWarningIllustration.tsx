import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// A simplified drawing of Google's "unverified app" screen, so people recognize it and know the two taps.
// Same layout as the website's google-warning.svg. Fixed light colors on purpose: it depicts Google's page.

function Marker({ n }: { n: number }) {
  return (
    <View style={styles.marker}>
      <Text style={styles.markerText}>{n}</Text>
    </View>
  );
}

export function GoogleWarningIllustration() {
  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Illustration of Google's warning screen. Step 1: tap Advanced. Step 2: tap Go to spam-purge.com (unsafe)."
    >
      <Text style={styles.label}>ILLUSTRATION</Text>
      <Text style={styles.icon}>⚠</Text>
      <Text style={styles.title}>Google hasn't verified this app</Text>
      <Text style={styles.body}>
        The app is requesting access to sensitive info in your Google Account. Only continue if you know and trust the
        developer.
      </Text>
      <View style={styles.safety}>
        <Text style={styles.safetyText}>Back to safety</Text>
      </View>
      <View style={styles.stepRow}>
        <View style={styles.ring}>
          <Text style={styles.link}>Advanced</Text>
        </View>
        <Marker n={1} />
      </View>
      <View style={styles.rule} />
      <Text style={styles.body}>Continue only if you understand the risks and trust the developer.</Text>
      <View style={styles.stepRow}>
        <View style={styles.ring}>
          <Text style={styles.link}>Go to spam-purge.com (unsafe)</Text>
        </View>
        <Marker n={2} />
      </View>
    </View>
  );
}

const RED = '#D93025';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D0D5DC',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
  },
  label: { fontSize: 10, letterSpacing: 1, color: '#8A94A3' },
  icon: { fontSize: 22, color: '#F9AB00' },
  title: { fontSize: 17, fontWeight: '700', color: '#202124' },
  body: { fontSize: 13, lineHeight: 18, color: '#5F6368' },
  safety: { alignSelf: 'flex-start', backgroundColor: '#1A73E8', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16 },
  safetyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: { borderWidth: 2, borderColor: RED, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  link: { color: '#1A73E8', fontSize: 14 },
  marker: { width: 24, height: 24, borderRadius: 12, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  markerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  rule: { height: 1, backgroundColor: '#E1E5EA', marginVertical: 2 },
});
