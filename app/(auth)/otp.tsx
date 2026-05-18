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
import { useRouter } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/shared/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";

const LEN = 6;

export default function Otp() {
  const { colors } = useTheme();
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(LEN).fill(""));
  const refs = useRef<(TextInput | null)[]>([]);
  const [seconds, setSeconds] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setAt = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[i] = ch;
    setCode(next);
    if (ch && i < LEN - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, key: string) => {
    if (key === "Backspace" && !code[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const filled = code.every((c) => c !== "");

  const onVerify = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/pin");
    }, 700);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="otp-screen">
      <ScreenHeader title="" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textMain }]}>Verify your number</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            We sent a 6-digit code to +260 977 234 567
          </Text>

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
});
