import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/shared/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { Delete } from "lucide-react-native";

const LEN = 4;

export default function Pin() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");

  const onKey = (k: string) => {
    setError("");
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= LEN) return;
    const next = pin + k;
    setPin(next);
    if (next.length === LEN) {
      setTimeout(() => {
        if (step === "create") {
          setFirst(next);
          setPin("");
          setStep("confirm");
        } else {
          if (next === first) {
            router.push("/biometric");
          } else {
            setError("PINs don't match. Try again.");
            setPin("");
            setStep("create");
            setFirst("");
          }
        }
      }, 150);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="pin-screen">
      <ScreenHeader title="" />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textMain }]}>
          {step === "create" ? "Create your PIN" : "Confirm your PIN"}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          {step === "create"
            ? "Use 4 digits you'll remember. You'll need it to confirm transactions."
            : "Enter the same PIN again to confirm."}
        </Text>

        <View style={styles.dots}>
          {Array.from({ length: LEN }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < pin.length ? colors.primary : "transparent",
                  borderColor: i < pin.length ? colors.primary : colors.borderStrong,
                },
              ]}
            />
          ))}
        </View>
        {error ? (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        ) : (
          <View style={{ height: 18 }} />
        )}

        <View style={{ flex: 1 }} />

        <View style={styles.keypad}>
          {keys.map((k, i) => (
            <Pressable
              key={i}
              testID={k ? `pin-key-${k}` : `pin-key-empty-${i}`}
              onPress={() => k && onKey(k)}
              disabled={!k}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor:
                    k && pressed
                      ? colors.surfaceSecondary
                      : k
                        ? "transparent"
                        : "transparent",
                },
              ]}
            >
              {k === "del" ? (
                <Delete size={22} color={colors.textMain} />
              ) : (
                <Text style={[styles.keyText, { color: colors.textMain }]}>{k}</Text>
              )}
            </Pressable>
          ))}
        </View>

        <Button
          label="Skip for now"
          variant="ghost"
          onPress={() => router.push("/biometric")}
          testID="pin-skip-btn"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  sub: { fontSize: 15, marginTop: 8, lineHeight: 22 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 36,
    gap: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  error: { textAlign: "center", marginTop: 12, fontSize: 13, fontWeight: "500" },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  key: {
    width: "32%",
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  keyText: { fontSize: 28, fontWeight: "600" },
});
