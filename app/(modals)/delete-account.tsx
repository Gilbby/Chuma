import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { useTheme } from "@/src/theme/ThemeContext";
import { deleteAccount, DeleteBlocker } from "@/src/services/auth";
import { AlertTriangle, Trash2 } from "lucide-react-native";

const CONFIRM_WORD = "DELETE";

export default function DeleteAccount() {
  const { colors } = useTheme();
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<DeleteBlocker[] | null>(null);

  const canDelete = confirm.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const onDelete = async () => {
    setBusy(true);
    setBlockers(null);
    try {
      await deleteAccount();
      // Session is cleared inside deleteAccount(); land on the entry screen.
      Alert.alert(
        "Account deleted",
        "Your account and personal data have been removed.",
      );
      router.replace("/welcome");
    } catch (e: any) {
      if (e?.code === "has_obligations" && Array.isArray(e?.data?.blockers)) {
        setBlockers(e.data.blockers as DeleteBlocker[]);
      } else {
        Alert.alert(
          "Couldn't delete account",
          e?.message || "Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="delete-account-screen"
    >
      <ScreenHeader title="Delete account" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
          <Trash2 size={26} color={colors.danger} />
        </View>

        <Text style={[styles.title, { color: colors.textMain }]}>
          Permanently delete your account
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          This can&apos;t be undone. We will remove your profile, phone number,
          identity verification details and payment information from Chuma.
        </Text>

        <Card padding={16} style={{ marginTop: 20 }}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>WHAT HAPPENS</Text>
          {[
            "Your profile and login are removed - you'll be signed out on this device.",
            "Your identity (KYC) and payment details are deleted.",
            "Group records keep only your name for the group's own history and audit; they no longer link back to you.",
          ].map((line) => (
            <View key={line} style={styles.bullet}>
              <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
              <Text style={{ color: colors.textMain, fontSize: 14, flex: 1, lineHeight: 20 }}>
                {line}
              </Text>
            </View>
          ))}
        </Card>

        {blockers && blockers.length > 0 && (
          <Card padding={16} style={{ marginTop: 16, borderColor: colors.danger, borderWidth: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={18} color={colors.danger} />
              <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14, flex: 1 }}>
                Settle these first
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
              Your account still has money or responsibilities tied to it. Sort
              these out, then come back to delete.
            </Text>
            {blockers.map((b, i) => (
              <View key={`${b.type}-${i}`} style={styles.bullet}>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                <Text style={{ color: colors.textMain, fontSize: 14, flex: 1, lineHeight: 20 }}>
                  {b.message}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Text style={[styles.cardLabel, { color: colors.textMuted, marginTop: 24 }]}>
          TYPE &quot;{CONFIRM_WORD}&quot; TO CONFIRM
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.textMain,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          value={confirm}
          onChangeText={setConfirm}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          testID="delete-account-confirm-input"
        />

        <View style={{ height: 24 }} />
        <Button
          label="Delete my account"
          variant="danger"
          onPress={onDelete}
          disabled={!canDelete}
          loading={busy}
          icon={<Trash2 size={18} color="#fff" />}
          testID="delete-account-submit-btn"
        />
        <View style={{ height: 12 }} />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          disabled={busy}
          testID="delete-account-cancel-btn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: "700", marginTop: 16, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
