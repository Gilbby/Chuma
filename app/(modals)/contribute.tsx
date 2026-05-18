import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/shared/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { groups, formatZMW } from "@/src/data/mock";
import { Check, ChevronDown, Receipt } from "lucide-react-native";

type Step = "entry" | "confirm" | "success";

const TYPES = ["Cycle contribution", "Top-up", "Penalty payment"];

export default function Contribute() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<Step>("entry");
  const [amount, setAmount] = useState("500");
  const [selectedGroup, setSelectedGroup] = useState(groups[0]);
  const [type, setType] = useState(TYPES[0]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const num = parseFloat(amount.replace(/,/g, "")) || 0;
  const fee = num > 0 ? Math.max(1, Math.round(num * 0.005)) : 0;
  const error =
    num <= 0 ? "Enter a valid amount" : num < selectedGroup.contributionAmount && type === "Cycle contribution" ? `Minimum K ${selectedGroup.contributionAmount} for this cycle` : "";

  if (step === "success") {
    return <SuccessScreen amount={num} group={selectedGroup.name} colors={colors} router={router} />;
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="contribute-screen"
    >
      <ScreenHeader
        title={step === "entry" ? "Make contribution" : "Confirm contribution"}
        onBack={step === "confirm" ? () => setStep("entry") : undefined}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          {step === "entry" ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Amount</Text>
              <View
                style={[
                  styles.amountWrap,
                  { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
                ]}
              >
                <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
                <Text style={[styles.amountText, { color: colors.textMain }]} testID="contribute-amount-display">
                  {amount || "0"}
                </Text>
              </View>
              {error ? (
                <Text style={[styles.errText, { color: colors.danger }]}>{error}</Text>
              ) : (
                <Text style={[styles.helper, { color: colors.textMuted }]}>
                  Suggested: {formatZMW(selectedGroup.contributionAmount)}
                </Text>
              )}

              {/* Quick amount chips */}
              <View style={styles.chips}>
                {[200, 500, 1000, 2000, 5000].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setAmount(String(v))}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    testID={`contribute-quick-${v}`}
                  >
                    <Text style={{ color: colors.textMain, fontWeight: "600" }}>
                      K {v.toLocaleString()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Group picker */}
              <Picker
                label="Group"
                value={selectedGroup.name}
                onPress={() => setShowGroupPicker((s) => !s)}
                colors={colors}
                testID="contribute-group-picker"
              />
              {showGroupPicker && (
                <Card padding={4} style={{ marginTop: 8 }}>
                  {groups.map((g) => (
                    <Pressable
                      key={g.id}
                      onPress={() => {
                        setSelectedGroup(g);
                        setShowGroupPicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                      ]}
                    >
                      <Text style={{ color: colors.textMain, fontWeight: "500" }}>{g.name}</Text>
                      {g.id === selectedGroup.id && <Check size={18} color={colors.primary} />}
                    </Pressable>
                  ))}
                </Card>
              )}

              {/* Type picker */}
              <View style={{ height: 14 }} />
              <Picker
                label="Contribution type"
                value={type}
                onPress={() => setShowTypePicker((s) => !s)}
                colors={colors}
              />
              {showTypePicker && (
                <Card padding={4} style={{ marginTop: 8 }}>
                  {TYPES.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => {
                        setType(t);
                        setShowTypePicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                      ]}
                    >
                      <Text style={{ color: colors.textMain, fontWeight: "500" }}>{t}</Text>
                      {t === type && <Check size={18} color={colors.primary} />}
                    </Pressable>
                  ))}
                </Card>
              )}

              {/* Cycle progress */}
              <View style={{ marginTop: 20 }}>
                <Card padding={16}>
                  <View style={styles.rowBetween}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.4 }}>
                      THIS CYCLE
                    </Text>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 13 }}>
                      {Math.round(selectedGroup.cycleProgress * 100)}%
                    </Text>
                  </View>
                  <View style={{ marginTop: 10 }}>
                    <ProgressBar progress={selectedGroup.cycleProgress} />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                    {formatZMW(selectedGroup.totalSavings)} saved of cycle goal
                  </Text>
                </Card>
              </View>

              <View style={{ flex: 1, minHeight: 24 }} />
              <Button
                label="Review"
                disabled={!!error || num <= 0}
                onPress={() => setStep("confirm")}
                testID="contribute-review-btn"
              />
            </>
          ) : (
            <>
              <Card padding={20}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Total</Text>
                <Text style={[styles.confirmAmount, { color: colors.textMain }]}>
                  {formatZMW(num + fee)}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <ConfirmRow label="Contribution" value={formatZMW(num)} colors={colors} />
                <ConfirmRow label="Transaction fee" value={formatZMW(fee)} colors={colors} />
                <ConfirmRow label="Group" value={selectedGroup.name} colors={colors} />
                <ConfirmRow label="Type" value={type} colors={colors} />
                <ConfirmRow
                  label="Cycle"
                  value={`#${Math.round(selectedGroup.cycleProgress * 12)} of 12`}
                  colors={colors}
                />
                <ConfirmRow label="From" value="Mobile money · MTN" colors={colors} last />
              </Card>

              <View style={{ flex: 1, minHeight: 24 }} />
              <Button
                label="Confirm & pay"
                onPress={() => {
                  setTimeout(() => setStep("success"), 600);
                }}
                testID="contribute-confirm-btn"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Picker = ({
  label,
  value,
  onPress,
  colors,
  testID,
}: {
  label: string;
  value: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  testID?: string;
}) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    style={({ pressed }) => [
      styles.picker,
      {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
      },
    ]}
  >
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
        {value}
      </Text>
    </View>
    <ChevronDown size={20} color={colors.textMuted} />
  </Pressable>
);

const ConfirmRow = ({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
  last?: boolean;
}) => (
  <View
    style={[
      styles.confirmRow,
      !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
    ]}
  >
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "600" }}>{value}</Text>
  </View>
);

const SuccessScreen = ({
  amount,
  group,
  colors,
  router,
}: {
  amount: number;
  group: string;
  colors: ReturnType<typeof useTheme>["colors"];
  router: ReturnType<typeof useRouter>;
}) => (
  <SafeAreaView
    style={{ flex: 1, backgroundColor: colors.background }}
    edges={["top"]}
    testID="contribute-success"
  >
    <View style={styles.successWrap}>
      <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
        <Check size={56} color="#fff" strokeWidth={3} />
      </View>
      <Text style={{ color: colors.textMain, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 }}>
        Contribution received
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 14,
          marginTop: 8,
          textAlign: "center",
          paddingHorizontal: 40,
        }}
      >
        Your contribution of {formatZMW(amount)} to {group} has been recorded.
      </Text>

      <View style={{ width: "100%", paddingHorizontal: 24, marginTop: 28 }}>
        <Card padding={16}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Receipt size={18} color={colors.primary} />
              <Text style={{ color: colors.textMain, fontWeight: "600", marginLeft: 8 }}>
                Receipt CHM-{Math.floor(Math.random() * 90000) + 10000}
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Saved</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Updated savings balance</Text>
          <Text style={{ color: colors.textMain, fontSize: 20, fontWeight: "700", marginTop: 4 }}>
            {formatZMW(18450 + amount)}
          </Text>
        </Card>
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ width: "100%", paddingHorizontal: 24 }}>
        <Button
          label="View & share receipt"
          onPress={() =>
            router.replace({
              pathname: "/receipt",
              params: {
                amount: String(amount),
                type: "contribution",
                group,
                date: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
                note: "Cycle contribution",
                status: "completed",
                direction: "out",
                txnId: `CHM-${Math.floor(Math.random() * 90000) + 10000}`,
              },
            })
          }
          testID="contribute-receipt-btn"
        />
        <View style={{ height: 10 }} />
        <Button label="Done" variant="ghost" onPress={() => router.replace("/(tabs)")} testID="contribute-done-btn" />
      </View>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 20 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 24,
    gap: 12,
  },
  currency: { fontSize: 28, fontWeight: "700" },
  amountText: { fontSize: 44, fontWeight: "700", letterSpacing: -1 },
  helper: { fontSize: 12, marginTop: 8 },
  errText: { fontSize: 12, marginTop: 8, fontWeight: "500" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 18,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confirmLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  confirmAmount: { fontSize: 36, fontWeight: "700", letterSpacing: -0.6, marginTop: 4 },
  divider: { height: 1, marginVertical: 14 },
  confirmRow: { paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" },
  successWrap: { flex: 1, alignItems: "center", paddingTop: 60, paddingBottom: 20 },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
});
