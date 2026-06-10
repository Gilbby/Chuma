import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { Fingerprint } from "lucide-react-native";

export default function Biometric() {
  const { colors } = useTheme();
  const router = useRouter();

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
          Use your fingerprint or Face ID to sign in and confirm transactions without typing your
          PIN every time.
        </Text>

        <View style={{ flex: 1 }} />

        <Button
          label="Enable biometric"
          onPress={() => router.replace("/(tabs)")}
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
});
