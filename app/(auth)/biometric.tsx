import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { Fingerprint } from "lucide-react-native";
import {
  isBiometricAvailable,
  biometricLabel,
  promptBiometric,
  setBiometricEnabled,
} from "@/src/utils/biometrics";

export default function Biometric() {
  const { colors } = useTheme();
  const router = useRouter();
  // null = still checking the sensor; false = this phone can't, so we never
  // show the offer at all and the PIN stays the only way in.
  const [available, setAvailable] = useState<boolean | null>(null);
  const [label, setLabel] = useState("biometric");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await isBiometricAvailable();
      if (!alive) return;
      if (!ok) {
        // No sensor, or nothing enrolled: skip the step entirely rather than
        // offering a switch that could only fail.
        router.replace("/(tabs)");
        return;
      }
      setLabel(await biometricLabel());
      setAvailable(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEnable = async () => {
    setBusy(true);
    setError("");
    // Prove the enrolled finger/face belongs to whoever is holding the phone
    // before we trust it as a sign-in method.
    const ok = await promptBiometric("Enable biometric sign-in");
    if (ok) {
      await setBiometricEnabled(true);
      router.replace("/(tabs)");
      return;
    }
    setError(`Couldn't confirm your ${label}. You can still use your PIN.`);
    setBusy(false);
  };

  if (available === null) {
    return (
      <SafeAreaView
        style={[styles.checking, { backgroundColor: colors.background }]}
        testID="biometric-screen"
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="biometric-screen">
      <ScreenHeader title="" />
      <View style={styles.content}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <Fingerprint size={64} color={colors.primary} strokeWidth={1.6} />
        </View>

        <Text style={[styles.title, { color: colors.textMain }]}>Faster, safer sign-in</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Use your {label} to sign in and confirm transactions without typing your PIN every time.
        </Text>

        {error ? (
          <Text style={[styles.error, { color: colors.danger }]} testID="biometric-error">
            {error}
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />

        <Button
          label="Enable biometric"
          onPress={onEnable}
          loading={busy}
          testID="biometric-enable-btn"
        />
        <View style={{ height: 12 }} />
        <Button
          label="Maybe later"
          variant="ghost"
          onPress={() => router.replace("/(tabs)")}
          testID="biometric-skip-btn"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  checking: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 20,
    alignItems: "center",
  },
  iconWrap: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginTop: 24,
    marginBottom: 36,
  },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },
  sub: {
    fontSize: 15,
    marginTop: 12,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  error: { fontSize: 13, marginTop: 16, textAlign: "center", fontWeight: "500" },
});
