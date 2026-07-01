import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { verifyOtp } from "@/src/services/auth";

const LEN = 6;

export default function Otp() {
  const { colors } = useTheme();
  const router = useRouter();
  const { mode: rawMode, phone: rawPhone } = useLocalSearchParams<{
    mode: "signup" | "signin";
    phone: string;
  }>();
  const mode = rawMode ?? "signup";
  const phone = rawPhone ?? "";
  const [code, setCode] = useState<string[]>(Array(LEN).fill(""));
  const refs = useRef<(TextInput | null)[]>([]);
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const onVerify = async (submitCode?: string) => {
    const codeStr = submitCode ?? code.join("");
    if (codeStr.length !== LEN) return;
    setLoading(true);
    setError("");
    try {
      const res = await verifyOtp(phone, codeStr, mode);
      router.replace(res.next === "tabs" ? "/(tabs)" : "/kyc");
    } catch (e: any) {
      setError("Incorrect or expired code");
      setCode(Array(LEN).fill(""));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const setAt = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = ch;
    setCode(next);
    if (ch && i < LEN - 1) refs.current[i + 1]?.focus();
    if (next.every((c) => c !== "")) {
      setTimeout(() => onVerify(next.join("")), 300);
    }
  };

  const onKey = (i: number, key: string) => {
    if (key === "Backspace" && !code[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const filled = code.every((c) => c !== "");

  const title = mode === "signin" ? "Enter your code" : "Verify your number";
  const subtitle = `We sent a ${mode === "signin" ? "sign-in" : "verification"} code to ${phone}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="otp-screen">
      <ScreenHeader title="" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textMain }]}>{title}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>{subtitle}</Text>

          <View style={styles.boxes}>
            {code.map((c, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  refs.current[i] = r;
                }}
                value={c}
                onChangeText={(v) => setAt(i, v)}
                onKeyPress={({ nativeEvent }) => onKey(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                editable={!loading}
                testID={`otp-input-${i}`}
                style={[
                  styles.box,
                  {
                    color: colors.textMain,
                    backgroundColor: colors.surface,
                    borderColor: c ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.resend}>
            {seconds > 0 ? (
              <Text style={[styles.resendText, { color: colors.textMuted }]}>
                Resend code in 0:{seconds.toString().padStart(2, "0")}
              </Text>
            ) : (
              <Pressable onPress={() => setSeconds(30)} testID="resend-otp-btn">
                <Text style={[styles.resendText, { color: colors.primary, fontWeight: "700" }]}>
                  Resend code
                </Text>
              </Pressable>
            )}
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          ) : null}

          <View style={{ flex: 1 }} />

          <Button
            label="Verify"
            disabled={!filled}
            loading={loading}
            onPress={onVerify}
            testID="otp-verify-btn"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  sub: { fontSize: 15, marginTop: 8, lineHeight: 22 },
  boxes: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  box: {
    width: 48,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  resend: { marginTop: 20, alignItems: "center" },
  resendText: { fontSize: 13 },
  errorText: { fontSize: 13, textAlign: "center", marginTop: 14, fontWeight: "500" },
});
