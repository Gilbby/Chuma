import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { updateProfile } from "@/src/services/auth";
import { ShieldCheck } from "lucide-react-native";

// The member tier of identity: a name they choose, not a verified document.
// Chairpersons who found a group go through Didit instead, and their verified
// name replaces this one permanently (see app/(auth)/kyc.tsx).
export default function Name() {
  const { colors } = useTheme();
  const router = useRouter();
  // Onboarding continues to PIN setup; launched from a money action
  // (return=tabs) we go back to what they were doing.
  const { return: returnTo } = useLocalSearchParams<{ return?: string }>();
  const afterName = returnTo === "tabs" ? "/(tabs)" : "/pin";

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const trimmed = name.trim();
  // Mirrors hasRealName() on the server (middleware/auth.js) so the user sees
  // the problem before a round trip, not a 400 afterwards.
  const valid = trimmed.length >= 2 && !/^[-+0-9 ]+$/.test(trimmed);

  const onSubmit = async () => {
    if (!valid || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError("");
    try {
      await updateProfile({ name: trimmed });
      router.replace(afterName);
    } catch (e: any) {
      setError(e?.message || "Could not save your name. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="name-screen"
    >
      <ScreenHeader title="" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.textMain }]}>
              What&apos;s your name?
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              This is how your group sees you on contributions, loans and
              share-outs.
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.danger : colors.border,
                  color: colors.textMain,
                },
              ]}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (error) setError("");
              }}
              placeholder="e.g. Yande Christabel"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              autoFocus
              testID="name-input"
            />
            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : (
              <View style={{ height: 18 }} />
            )}

            <View
              style={[
                styles.note,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary + "33",
                },
              ]}
            >
              <ShieldCheck size={18} color={colors.primary} />
              <Text style={[styles.noteText, { color: colors.textMuted }]}>
                Use your real name, the one on your NRC and your mobile money
                account. Your group uses it to recognise your payments, and
                payouts are sent to the number registered in that name.
              </Text>
            </View>

            <View style={{ flex: 1 }} />

            <Button
              label="Continue"
              onPress={onSubmit}
              disabled={!valid}
              loading={loading}
              testID="name-continue-btn"
            />
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.4 },
  sub: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 28 },
  input: {
    height: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  error: { fontSize: 12, marginTop: 6, minHeight: 18 },
  note: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
