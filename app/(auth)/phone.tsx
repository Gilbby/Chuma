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
import { useRouter } from "expo-router";
import { Input } from "@/src/components/ui/Input";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { Phone } from "lucide-react-native";

export default function PhoneLogin() {
  const { colors } = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState("977234567");
  const [loading, setLoading] = useState(false);

  const onContinue = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/otp");
    }, 700);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="phone-screen">
      <ScreenHeader title="" hideBack={false} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.textMain }]}>Welcome to Chuma</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Enter your phone number to continue. We&apos;ll send you a 6-digit code.
          </Text>

          <View style={{ height: 40 }} />

          <Input
            label="Phone number"
            placeholder="977 234 567"
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
});
