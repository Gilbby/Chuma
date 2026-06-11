import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { groups } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { Check, ChevronDown, Receipt, AlertTriangle, Lock } from "lucide-react-native";

type Step = "entry" | "confirm" | "success";

const TYPES = [
  { label: "Cycle contribution", description: "Regular required savings contribution for the active group cycle." },
  { label: "Top-up", description: "Optional extra savings added above the required cycle contribution." },
];

const PAYMENT_METHODS = [
  { label: "MTN MoMo", description: "Pay via MTN Mobile Money wallet" },
  { label: "Airtel Money", description: "Pay via Airtel Money wallet" },
  { label: "Zamtel Kwacha", description: "Pay via Zamtel Kwacha wallet" },
  { label: "Bank Transfer", description: "Pay via direct bank transfer" },
  { label: "Cash", description: "Recorded by a group admin on your behalf" },
];

export default function Contribute() {
  const { colors } = useTheme();
  const router = useRouter();
  const { lockedType, lockedAmount, penaltyReason, groupId } = useLocalSearchParams<{
    lockedType?: string;
    lockedAmount?: string;
    penaltyReason?: string;
    groupId?: string;
  }>();
  const isPenalty = lockedType === "penalty";
  const [step, setStep] = useState<Step>("entry");
  const [amount, setAmount] = useState(lockedAmount ? lockedAmount : "500");
  const [selectedGroup, setSelectedGroup] = useState(
    groups.find((g) => g.id === groupId) ?? groups[0]
  );
  const [type, setType] = useState(
    isPenalty
      ? { label: "Penalty payment", description: "Penalty issued by the group." }
      : TYPES[0]
  );
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[1]);
  const [showPaymentPicker, setShowPaymentPicker] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const receiptId = useRef(
    `CHM-${Math.floor(Math.random() * 90000) + 10000}`
  );

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] !== undefined && parts[1].length > 2) return;
    setAmount(cleaned);
    if (submitAttempted && parseFloat(cleaned) > 0) setSubmitAttempted(false);
  };

  const num = parseFloat(amount.replace(/,/g, "")) || 0;
  const fee = num > 0 ? Math.max(1, Math.round(num * 0.005)) : 0;
  const minError =
    num > 0 && num < selectedGroup.contributionAmount && type.label === "Cycle contribution"
      ? `Minimum K ${selectedGroup.contributionAmount} for this cycle`
      : "";
  const displayError = (submitAttempted && num <= 0 ? "Enter a valid amount" : "") || minError;

  if (step === "success") {
    return <SuccessScreen amount={num} group={selectedGroup.name} colors={colors} router={router} receiptId={receiptId.current} />;
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          {step === "entry" ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Amount</Text>
              <View
                style={[
                  styles.amountWrap,
                  { backgroundColor: isPenalty ? colors.surfaceSecondary : colors.surface, borderColor: displayError ? colors.danger : colors.border },
                ]}
              >
                <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.textMain }]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  editable={!isPenalty}
                  testID={isPenalty ? "contribute-amount-locked" : "contribute-amount-input"}
                />
              </View>
              {displayError ? (
                <Text style={[styles.errText, { color: colors.danger }]}>{displayError}</Text>
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
              {isPenalty && (
                <View style={{ backgroundColor: colors.warning + "15", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "column" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 13 }}>
                      Penalty: {penaltyReason}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    This amount has been set by your group admin.
                  </Text>
                </View>
              )}
              {isPenalty ? (
                <View
                  style={[styles.picker, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  testID="contribute-type-locked"
                >
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
                      CONTRIBUTION TYPE
                    </Text>
                    <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
                      {type.label}
                    </Text>
                  </View>
                  <Lock size={14} color={colors.textMuted} />
                </View>
              ) : (
              <Picker
                label="Contribution type"
                value={type.label}
                onPress={() => setShowTypePicker((s) => !s)}
                colors={colors}
              />
              )}
              {!isPenalty && showTypePicker && (
                <Card padding={4} style={{ marginTop: 8 }}>
                  {TYPES.map((t) => (
                    <Pressable
                      key={t.label}
                      onPress={() => {
                        setType(t);
                        setShowTypePicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMain, fontWeight: "500" }}>{t.label}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.description}</Text>
                      </View>
                      {t.label === type.label && <Check size={18} color={colors.primary} />}
                    </Pressable>
                  ))}
                </Card>
              )}

              {/* Payment method picker */}
              <Picker
                label="Payment method"
                value={paymentMethod.label}
                onPress={() => setShowPaymentPicker((s) => !s)}
                colors={colors}
                testID="contribute-payment-picker"
              />
              {showPaymentPicker && (
                <Card padding={4} style={{ marginTop: 8 }}>
                  {PAYMENT_METHODS.map((m) => (
                    <Pressable
                      key={m.label}
                      onPress={() => {
                        setPaymentMethod(m);
                        setShowPaymentPicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textMain, fontWeight: "500" }}>{m.label}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.description}</Text>
                      </View>
                      {m.label === paymentMethod.label && <Check size={18} color={colors.primary} />}
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
                disabled={!!minError}
                onPress={() => {
                  if (num <= 0) { setSubmitAttempted(true); return; }
                  setStep("confirm");
                }}
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
                <ConfirmRow label="Type" value={type.label} colors={colors} />
                <ConfirmRow
                  label="Cycle"
                  value={`#${Math.round(selectedGroup.cycleProgress * 12)} of 12`}
                  colors={colors}
                />
                <ConfirmRow label="From" value={paymentMethod.label} colors={colors} last />
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
      </TouchableWithoutFeedback>
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
  receiptId,
}: {
  amount: number;
  group: string;
  colors: ReturnType<typeof useTheme>["colors"];
  router: ReturnType<typeof useRouter>;
  receiptId: string;
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
                Receipt {receiptId}
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
                txnId: receiptId,
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
  amountInput: { flex: 1, fontSize: 44, fontWeight: "700", letterSpacing: -1, padding: 0 },
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
