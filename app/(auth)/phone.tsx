import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Input } from "@/src/components/ui/Input";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { Phone } from "lucide-react-native";
import { requestOtp } from "@/src/services/auth";

export default function PhoneLogin() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode: rawMode } = useLocalSearchParams<{ mode: "signup" | "signin" }>();
  const mode = rawMode ?? "signup";
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onContinue = async () => {
    const fullPhone = "+260" + phone.replace(/\D/g, "");
    setLoading(true);
    setError("");
    try {
      const res = await requestOtp(fullPhone, mode);
      if (res.devCode) console.log("DEV OTP:", res.devCode);
      router.push(`/otp?phone=${encodeURIComponent(fullPhone)}&mode=${mode}`);
    } catch (e: any) {
      setError(e.message || "Could not send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signin" ? "Welcome back" : "Create your account";
  const subtitle =
    mode === "signin"
      ? "Enter your phone number to sign in to your account."
      : "Enter your phone number. We'll send a 6-digit verification code.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="phone-screen">
      <ScreenHeader title="" hideBack={false} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.textMain }]}>{title}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>{subtitle}</Text>

          <View style={{ height: 40 }} />

          <Input
            label="Phone number"
            placeholder="XXX XXX XXX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            prefix={
              <View style={styles.prefix}>
                <Phone size={16} color={colors.primary} />
                <Text style={[styles.prefixText, { color: colors.textMain }]}>+260</Text>
              </View>
            }
            testID="phone-input"
          />

          <View style={{ flex: 1 }} />

          <Button
            label="Continue"
            onPress={onContinue}
            loading={loading}
            disabled={phone.replace(/\D/g, "").length < 9}
            testID="phone-continue-btn"
          />
          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : null}
          <Text style={[styles.legal, { color: colors.textMuted }]}>
            By continuing you agree to Chuma&apos;s Terms & Privacy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  sub: { fontSize: 15, marginTop: 8, lineHeight: 22 },
  prefix: { flexDirection: "row", alignItems: "center", gap: 6 },
  prefixText: { fontSize: 16, fontWeight: "600", marginLeft: 6 },
  legal: { fontSize: 11, textAlign: "center", marginTop: 14 },
  errorText: { fontSize: 13, textAlign: "center", marginTop: 10, fontWeight: "500" },
});
