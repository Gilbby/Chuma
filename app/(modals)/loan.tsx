import React, { useState, useEffect, useCallback } from "react";
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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { getGroups } from "@/src/services/groups";
import {
  getLoanBreakdown,
  checkEligibility,
  getLoanEligibility,
  requestLoan,
} from "@/src/services/loans";
import { getRequiredApprovals } from "@/src/services/approvals";
import { usePricingPreview, PayoutPreview } from "@/src/hooks/usePricingPreview";
import { formatZMW } from "@/src/utils/currency";
import { Group } from "@/src/types";
import { Check, ChevronDown, Clock, Info } from "lucide-react-native";

type Step = "request" | "breakdown" | "confirm" | "success";

const DURATIONS = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 9, label: "9 months" },
  { months: 12, label: "12 months" },
];

export default function Loan() {
  const { colors } = useTheme();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();

  const [step, setStep] = useState<Step>("request");
  const [amount, setAmount] = useState("5000");
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [grp, setGrp] = useState<Group | null>(null);
  const [showGroup, setShowGroup] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [reason, setReason] = useState("");
  const [elig, setElig] = useState<{
    savings: number;
    maxLoan: number;
    multiplier: number;
    interestRate: number;
  } | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [eligLoading, setEligLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const g = await getGroups();
      setGroups(g);
      setGrp((groupId ? g.find((x) => x.id === groupId) ?? g[0] : g[0]) ?? null);
    } finally {
      setGroupsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (!grp?.id) return;
    setEligLoading(true);
    getLoanEligibility(grp.id)
      .then(setElig)
      .catch(() => setElig(null))
      .finally(() => setEligLoading(false));
  }, [grp?.id]);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] !== undefined && parts[1].length > 2) return;
    setAmount(cleaned);
    if (submitAttempted && parseFloat(cleaned) > 0) setSubmitAttempted(false);
  };

  const num = parseFloat(amount) || 0;

  // Disclosure only: what the member would actually receive after fees if the
  // loan is approved. Server computes the fees; the client never does. Debounced
  // so typing an amount doesn't fire a request per keystroke.
  const {
    data: loanPayout,
    loading: loanPayoutLoading,
    error: loanPayoutError,
  } = usePricingPreview<PayoutPreview>("payout", num, { enabled: num > 0 });

  if (groupsLoading || eligLoading || !grp) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="loan-screen">
        <ScreenHeader title="Request loan" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const mySavings = elig?.savings ?? 0;
  const maxLoan = elig?.maxLoan ?? 0;
  const adminCount = (grp.members ?? []).filter((m) =>
    ["Chairperson", "Treasurer", "Secretary"].includes(m.role)
  ).length;
  const threshold = grp.constitution?.approvalThreshold ?? "majority";
  const requiredApprovals = getRequiredApprovals(threshold, adminCount);

  const breakdown = getLoanBreakdown(num, grp.loanInterestRate, duration.months);
  const eligibility = checkEligibility(num, maxLoan);
  const eligible = eligibility.eligible;
  const savingsLoanRatio = num > 0 ? mySavings / num : 0;

  if (step === "success") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
        testID="loan-success"
      >
        <View style={styles.successWrap}>
          <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
            <Check size={56} color="#fff" strokeWidth={3} />
          </View>
          <Text style={{ color: colors.textMain, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 }}>
            Loan submitted
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
            Your request is now pending group approval. We&apos;ll notify you when members vote.
          </Text>
          <View style={{ width: "100%", paddingHorizontal: 24, marginTop: 28 }}>
            <Card padding={18}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Requested</Text>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>{formatZMW(num)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Status</Text>
                <StatusBadge label="Pending approval" variant="warning" />
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Admin approvals required</Text>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                  {adminCount === 0
                    ? "Pending admin setup"
                    : `${requiredApprovals} of ${adminCount} admins`}
                </Text>
              </View>
            </Card>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ width: "100%", paddingHorizontal: 24 }}>
            <Button label="View approval status" onPress={() => router.replace("/approvals")} />
            <View style={{ height: 10 }} />
            <Button label="Done" variant="ghost" onPress={() => router.replace("/(tabs)")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="loan-screen"
    >
      <ScreenHeader
        title={
          step === "request"
            ? "Request loan"
            : step === "breakdown"
              ? "Loan breakdown"
              : "Confirm request"
        }
        onBack={
          step === "breakdown"
            ? () => setStep("request")
            : step === "confirm"
              ? () => setStep("breakdown")
              : undefined
        }
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          {step === "request" && (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Loan amount</Text>
              <View
                style={[
                  styles.amountWrap,
                  {
                    backgroundColor: colors.surface,
                    borderColor:
                      (!eligible && num > 0) || (submitAttempted && num <= 0)
                        ? colors.danger
                        : colors.border,
                  },
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
                  testID="loan-amount-input"
                />
              </View>
              {submitAttempted && num <= 0 && (
                <Text style={[styles.errText, { color: colors.danger }]}>Enter a valid amount</Text>
              )}
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                {`You can borrow up to ${formatZMW(maxLoan)} (${grp.loanMaxMultiplier}× your ${formatZMW(mySavings)} savings)`}
              </Text>
              {num > maxLoan && (
                <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, fontWeight: "500" }}>
                  {eligibility.reason}
                </Text>
              )}

              <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>
                PURPOSE (OPTIONAL)
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. School fees, Medical emergency, Business stock"
                placeholderTextColor={colors.textMuted}
                multiline={true}
                numberOfLines={3}
                maxLength={200}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  color: colors.textMain,
                  fontSize: 15,
                  lineHeight: 22,
                  minHeight: 90,
                  textAlignVertical: "top",
                }}
                testID="loan-reason-input"
              />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, textAlign: "right" }}>
                {reason.length}/200
              </Text>

              <View style={styles.chips}>
                {[2000, 5000, 10000, 15000].map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setAmount(String(v))}
                    style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.textMain, fontWeight: "600" }}>K {v.toLocaleString()}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Eligibility */}
              <Card padding={16} style={{ marginTop: 18 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>
                    ELIGIBILITY
                  </Text>
                  <StatusBadge
                    label={eligible ? "Eligible" : "Over limit"}
                    variant={eligible ? "success" : "danger"}
                  />
                </View>
                <Text style={{ color: colors.textMain, fontSize: 14, marginTop: 10 }}>
                  You can borrow up to{" "}
                  <Text style={{ fontWeight: "700" }}>{formatZMW(maxLoan, { compact: true })}</Text> ({grp.loanMaxMultiplier}× your savings of {formatZMW(mySavings)}).
                </Text>
                <View style={{ marginTop: 12 }}>
                  <ProgressBar progress={Math.min(1, num / maxLoan)} />
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                    Savings-to-loan ratio: {savingsLoanRatio.toFixed(2)}x
                  </Text>
                </View>
              </Card>

              {/* What you'll actually receive after fees (disclosure only) */}
              {num > 0 && (
                <Card padding={16} style={{ marginTop: 14 }} testID="loan-net-receive">
                  {loanPayoutLoading && !loanPayout ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                        Calculating what you&apos;ll receive…
                      </Text>
                    </View>
                  ) : loanPayoutError ? (
                    <Text style={{ color: colors.textMuted, fontSize: 13 }} testID="loan-net-error">
                      Couldn&apos;t load the disbursement breakdown. Try again shortly.
                    </Text>
                  ) : loanPayout?.tooSmall ? (
                    <Text style={{ color: colors.textMuted, fontSize: 13 }} testID="loan-net-toosmall">
                      This amount is too small to borrow after fees.
                    </Text>
                  ) : loanPayout ? (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        <Info size={16} color={colors.primary} style={{ marginTop: 2 }} />
                        <Text style={{ flex: 1, color: colors.textMain, fontSize: 14, marginLeft: 8, lineHeight: 20 }}>
                          If approved, you&apos;ll receive{" "}
                          <Text style={{ fontWeight: "700" }}>{formatZMW(loanPayout.netReceived)}</Text> after fees.
                        </Text>
                      </View>
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      <Row label="Requested" value={formatZMW(loanPayout.owed)} colors={colors} />
                      <Row label="Transaction fee" value={formatZMW(loanPayout.transactionFee)} colors={colors} />
                      <Row label="Platform fee" value={formatZMW(loanPayout.platformFee)} colors={colors} />
                      <Row label="You receive" value={formatZMW(loanPayout.netReceived)} colors={colors} last />
                    </>
                  ) : null}
                </Card>
              )}

              {/* Duration */}
              <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>
                Repayment duration
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {DURATIONS.map((d) => {
                  const active = duration.months === d.months;
                  return (
                    <Pressable
                      key={d.months}
                      onPress={() => setDuration(d)}
                      style={[
                        styles.durChip,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      testID={`loan-duration-${d.months}`}
                    >
                      <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600" }}>
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Group */}
              <Pressable
                onPress={() => setShowGroup((s) => !s)}
                style={[
                  styles.picker,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                testID="loan-group-picker"
              >
                <View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>
                    BORROW FROM
                  </Text>
                  <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
                    {grp.name}
                  </Text>
                </View>
                <ChevronDown size={20} color={colors.textMuted} />
              </Pressable>
              {showGroup && (
                <Card padding={4} style={{ marginTop: 8 }}>
                  {groups.map((g) => (
                    <Pressable
                      key={g.id}
                      onPress={() => {
                        setGrp(g);
                        setShowGroup(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                      ]}
                    >
                      <Text style={{ color: colors.textMain, fontWeight: "500" }}>{g.name}</Text>
                      {g.id === grp.id && <Check size={18} color={colors.primary} />}
                    </Pressable>
                  ))}
                </Card>
              )}

              <View style={{ flex: 1, minHeight: 24 }} />
              <Button
                label="See breakdown"
                disabled={num > 0 && !eligible}
                onPress={() => {
                  if (num <= 0) { setSubmitAttempted(true); return; }
                  setStep("breakdown");
                }}
                testID="loan-breakdown-btn"
              />
            </>
          )}

          {step === "breakdown" && (
            <>
              <Card padding={20}>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600" }}>
                  You&apos;ll repay
                </Text>
                <Text style={{ color: colors.textMain, fontSize: 36, fontWeight: "700", letterSpacing: -0.6, marginTop: 4 }}>
                  {formatZMW(breakdown.totalRepay)}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Row label="Principal" value={formatZMW(num)} colors={colors} />
                <Row label={`Interest (${grp.loanInterestRate}%/mo)`} value={formatZMW(breakdown.interest)} colors={colors} />
                <Row label="Duration" value={duration.label} colors={colors} />
                <Row
                  label="Monthly installment"
                  value={formatZMW(breakdown.monthlyInstallment)}
                  colors={colors}
                  highlight
                />
                <Row label="Group" value={grp.name} colors={colors} last />
              </Card>

              <View style={{ marginTop: 14, flexDirection: "row", alignItems: "flex-start" }}>
                <Info size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, color: colors.textMuted, fontSize: 12, marginLeft: 8, lineHeight: 18 }}>
                  Repayments are due monthly. Missed installments may trigger penalties as per group rules.
                </Text>
              </View>

              <View style={{ flex: 1, minHeight: 24 }} />
              <Button label="Continue" onPress={() => setStep("confirm")} testID="loan-continue-btn" />
            </>
          )}

          {step === "confirm" && (
            <>
              <Card padding={20}>
                <View style={[styles.warnBox, { backgroundColor: colors.primarySoft }]}>
                  <Clock size={20} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: "600", marginLeft: 10, flex: 1 }}>
                    Requires group approval
                  </Text>
                </View>
                <Text style={{ color: colors.textMain, marginTop: 14, lineHeight: 22 }}>
                  Your loan request will be sent to the {grp.name} approval committee. A minimum of 60% of voting members must approve.
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Row label="Amount" value={formatZMW(num)} colors={colors} />
                <Row label="Duration" value={duration.label} colors={colors} />
                <Row label="Group" value={grp.name} colors={colors} last={reason.trim() === ""} />
                {reason.trim() !== "" && (
                  <Row label="Purpose" value={reason.trim()} colors={colors} last />
                )}
              </Card>

              {submitError ? (
                <Text style={[styles.errText, { color: colors.danger, marginTop: 12 }]}>{submitError}</Text>
              ) : null}

              <View style={{ flex: 1, minHeight: 24 }} />
              <Button
                label="Submit for approval"
                loading={submitting}
                disabled={submitting}
                onPress={async () => {
                  setSubmitting(true);
                  setSubmitError("");
                  try {
                    await requestLoan({
                      groupId: grp.id,
                      amount: num,
                      durationMonths: duration.months,
                      reason: reason.trim() || undefined,
                    });
                    setStep("success");
                  } catch (e: any) {
                    setSubmitError(e?.message || "Could not submit request. Please try again.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                testID="loan-submit-btn"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const Row = ({
  label,
  value,
  colors,
  last,
  highlight,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
  last?: boolean;
  highlight?: boolean;
}) => (
  <View
    style={[
      { paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" },
      !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
    ]}
  >
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
    <Text
      style={{
        color: highlight ? colors.primary : colors.textMain,
        fontSize: 14,
        fontWeight: "700",
      }}
    >
      {value}
    </Text>
  </View>
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
  durChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
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
  divider: { height: 1, marginVertical: 14 },
  warnBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
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
