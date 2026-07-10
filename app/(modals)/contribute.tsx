import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { getGroups } from "@/src/services/groups";
import { submitContribution } from "@/src/services/transactions";
import { getPenalties, payPenalties } from "@/src/services/penalties";
import { api } from "@/src/services/apiClient";
import { getCurrentUser } from "@/src/utils/currentUser";
import { detectNetwork } from "@/src/services/mobileMoney";
import { Group, Penalty } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { Check, ChevronDown, Receipt, AlertTriangle, Lock, Clock, Plus } from "lucide-react-native";

type Step = "entry" | "confirm" | "success";

const GROUP_SAVING_TYPE = {
  label: "Group saving",
  description: "Regular required savings for the active group cycle.",
};

const TOPUP_TYPE = {
  label: "Top-up",
  description: "Optional extra savings added above the required cycle amount.",
};

const PENALTIES_TYPE = {
  label: "Penalties",
  description: "Clear outstanding penalties issued by this group.",
};

const TYPES = [GROUP_SAVING_TYPE, TOPUP_TYPE, PENALTIES_TYPE];

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
  // Prefilled with the group's cycle amount once groups load (see `load`), so
  // there is nothing to suggest — the field already holds it.
  const [amount, setAmount] = useState(lockedAmount ? lockedAmount : "");
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [type, setType] = useState(
    isPenalty
      ? { label: "Penalty payment", description: "Penalty issued by the group." }
      : TYPES[0]
  );
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  // Unpaid penalties the member owes in the SELECTED group, and the subset they
  // have ticked to pay now. The amount field is the sum of the ticked ones.
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [penaltiesLoading, setPenaltiesLoading] = useState(false);
  const [selectedPenaltyIds, setSelectedPenaltyIds] = useState<string[]>([]);
  const [payerPhone, setPayerPhone] = useState("");
  const [payCash, setPayCash] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [serverTxn, setServerTxn] = useState<any>(null);
  // Server-computed fee breakdown for the confirm screen — the single source of
  // truth. Fetched from POST /pricing/preview; the client never computes fees.
  const [pricing, setPricing] = useState<{
    base: number;
    platformFee: number;
    depositAmount: number;
    feesCovered: number;
  } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const receiptId = useRef(
    `CHM-${Math.floor(Math.random() * 90000) + 10000}`
  );

  const load = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const [fetchedGroups, user] = await Promise.all([
        getGroups(),
        getCurrentUser<{ phone?: string }>(),
      ]);
      setGroups(fetchedGroups);
      const group = fetchedGroups.find((g) => g.id === groupId) ?? fetchedGroups[0] ?? null;
      setSelectedGroup(group);
      // Prefill the cycle amount. A penalty carries its own locked amount, which
      // must never be overwritten.
      if (!lockedAmount && group?.contributionAmount) {
        setAmount(String(group.contributionAmount));
      }
      setPayerPhone(user?.phone ?? "");
    } finally {
      setGroupsLoading(false);
    }
  }, [groupId, lockedAmount]);

  useEffect(() => {
    load();
  }, [load]);

  const isPenaltiesMode = type.label === PENALTIES_TYPE.label;

  // Pending penalties for the selected group only — a member can owe penalties
  // in several groups, but one payment settles one group's.
  useEffect(() => {
    const gid = selectedGroup?.id;
    if (!gid) return;
    let cancelled = false;
    setPenaltiesLoading(true);
    getPenalties({ mine: true, groupId: gid })
      .then((all) => {
        if (cancelled) return;
        setPenalties(all.filter((p) => p.status === "pending"));
      })
      .catch(() => {
        if (!cancelled) setPenalties([]);
      })
      .finally(() => {
        if (!cancelled) setPenaltiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGroup?.id]);

  const penaltyTotal = penalties
    .filter((p) => selectedPenaltyIds.includes(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  // In penalties mode the amount is DERIVED from the ticked penalties — the
  // field is read-only, so this is the only thing that may write it.
  useEffect(() => {
    if (isPenaltiesMode) setAmount(penaltyTotal > 0 ? String(penaltyTotal) : "");
  }, [isPenaltiesMode, penaltyTotal]);

  const togglePenalty = (id: string) =>
    setSelectedPenaltyIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );

  const detectedNetwork = detectNetwork(payerPhone).network;
  const paymentMethodLabel = payCash ? "Cash" : detectedNetwork;
  // "Unknown" is not a payment method the server accepts — never submit it.
  const networkUnknown = !payCash && detectedNetwork === "Unknown";

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] !== undefined && parts[1].length > 2) return;
    setAmount(cleaned);
    if (submitAttempted && parseFloat(cleaned) > 0) setSubmitAttempted(false);
    if (pricingError) setPricingError(null);
  };

  const num = parseFloat(amount.replace(/,/g, "")) || 0;
  const minError =
    !!selectedGroup && num > 0 && num < selectedGroup.contributionAmount && type.label === GROUP_SAVING_TYPE.label
      ? `Minimum K ${selectedGroup.contributionAmount} for this cycle`
      : "";
  const emptyError = isPenaltiesMode
    ? "Select at least one penalty to pay"
    : "Enter a valid amount";
  const displayError = (submitAttempted && num <= 0 ? emptyError : "") || minError;

  // Review → Confirm: fetch the REAL server-computed breakdown first, and only
  // advance once it returns. Cash is priced identically by the backend (it
  // records the same platformFee + grossed-up depositAmount), so no cash guard.
  const goToConfirm = async () => {
    if (num <= 0) {
      setSubmitAttempted(true);
      return;
    }
    // A penalty is collected at face value — no contribution gross-up applies,
    // so there is no /pricing/preview to fetch.
    if (isPenaltiesMode) {
      setPricing(null);
      setStep("confirm");
      return;
    }
    setPricingLoading(true);
    setPricingError(null);
    try {
      const res = await api<{
        base: number;
        platformFee: number;
        depositAmount: number;
        feesCovered: number;
      }>("/pricing/preview", {
        method: "POST",
        body: { kind: "contribution", amount: num },
      });
      setPricing(res);
      setStep("confirm");
    } catch (e: any) {
      setPricingError(e?.message || "Couldn't load fees. Please try again.");
    } finally {
      setPricingLoading(false);
    }
  };

  if (groupsLoading || !selectedGroup) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <ScreenHeader title="Make Payment" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === "success") {
    return (
      <SuccessScreen
        amount={num}
        group={selectedGroup.name}
        colors={colors}
        router={router}
        receiptId={serverTxn?.receiptId ?? receiptId.current}
        status={serverTxn?.status ?? "completed"}
        isCash={payCash}
        typeLabel={type.label}
      />
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="contribute-screen"
    >
      <ScreenHeader
        title={step === "entry" ? "Make Payment" : "Confirm payment"}
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
                  { backgroundColor: isPenalty || isPenaltiesMode ? colors.surfaceSecondary : colors.surface, borderColor: displayError ? colors.danger : colors.border },
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
                  // Penalties mode: the total is the sum of the ticked penalties.
                  editable={!isPenalty && !isPenaltiesMode}
                  testID={isPenalty ? "contribute-amount-locked" : "contribute-amount-input"}
                />
                {isPenaltiesMode && <Lock size={16} color={colors.textMuted} />}
              </View>
              {displayError ? (
                <Text style={[styles.errText, { color: colors.danger }]}>{displayError}</Text>
              ) : null}

              {/* Penalty breakdown — tick each penalty to add it to the total */}
              {isPenaltiesMode && (
                <View style={{ marginTop: 20 }} testID="contribute-penalty-list">
                  <Text style={[styles.label, { color: colors.textMuted }]}>
                    Outstanding penalties
                  </Text>
                  {penaltiesLoading ? (
                    <Card padding={16}>
                      <ActivityIndicator color={colors.primary} />
                    </Card>
                  ) : penalties.length === 0 ? (
                    <Card padding={16}>
                      <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
                        No outstanding penalties in {selectedGroup.name}.
                      </Text>
                    </Card>
                  ) : (
                    <Card padding={4}>
                      {penalties.map((p, i) => {
                        const picked = selectedPenaltyIds.includes(p.id);
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => togglePenalty(p.id)}
                            style={({ pressed }) => [
                              styles.penaltyRow,
                              { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                            ]}
                            testID={`contribute-penalty-${p.id}`}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: picked }}
                          >
                            <View
                              style={[
                                styles.penaltyToggle,
                                {
                                  backgroundColor: picked ? colors.primary : "transparent",
                                  borderColor: picked ? colors.primary : colors.border,
                                },
                              ]}
                            >
                              {picked ? (
                                <Check size={16} color="#fff" strokeWidth={3} />
                              ) : (
                                <Plus size={16} color={colors.textMuted} strokeWidth={2.5} />
                              )}
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>
                                {p.reason}
                              </Text>
                              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                                {new Date(p.createdAt).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </Text>
                            </View>
                            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                              {formatZMW(p.amount)}
                            </Text>
                          </Pressable>
                        );
                      })}
                      {selectedPenaltyIds.length > 0 && (
                        <View style={[styles.penaltyTotal, { borderTopColor: colors.border }]}>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                            {selectedPenaltyIds.length} selected
                          </Text>
                          <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                            {formatZMW(penaltyTotal)}
                          </Text>
                        </View>
                      )}
                    </Card>
                  )}
                </View>
              )}


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
                        // Penalties belong to a group — a switch invalidates them.
                        setSelectedPenaltyIds([]);
                        // Each group has its own cycle amount — follow the switch,
                        // except for a locked penalty, or penalties mode where the
                        // amount is derived from the ticked penalties.
                        if (!lockedAmount && !isPenaltiesMode && g.contributionAmount) {
                          setAmount(String(g.contributionAmount));
                        }
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
                      PAYMENT TYPE
                    </Text>
                    <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
                      {type.label}
                    </Text>
                  </View>
                  <Lock size={14} color={colors.textMuted} />
                </View>
              ) : (
              <Picker
                label="Payment type"
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
                        setSubmitAttempted(false);
                        // Penalties are mobile-money only; the cash toggle is
                        // hidden, so it must not stay on from a previous type.
                        if (t.label === PENALTIES_TYPE.label) setPayCash(false);
                        // Leaving penalties mode hands the field back to the
                        // member, prefilled with the cycle amount again.
                        if (t.label !== PENALTIES_TYPE.label) {
                          setSelectedPenaltyIds([]);
                          setAmount(
                            selectedGroup?.contributionAmount
                              ? String(selectedGroup.contributionAmount)
                              : ""
                          );
                        }
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

              {/* Payment method (auto-detected) */}
              <View
                style={[styles.picker, { backgroundColor: colors.surfaceSecondary, borderColor: networkUnknown ? colors.danger : colors.border }]}
                testID="contribute-payment-detected"
              >
                <View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
                    FROM
                  </Text>
                  <Text style={{ color: networkUnknown ? colors.danger : colors.textMain, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
                    {payCash ? "Cash" : detectedNetwork}
                  </Text>
                </View>
                <Lock size={14} color={colors.textMuted} />
              </View>
              {networkUnknown && (
                <Text style={[styles.errText, { color: colors.danger }]}>
                  We couldn't detect a mobile money network from your phone number. Update your
                  profile number to an MTN, Airtel or Zamtel line, or pay with cash.
                </Text>
              )}

              {/* Penalties are collected by mobile money only — the penalty
                  endpoint has no admin-recorded cash path. */}
              {!isPenaltiesMode && (
                <View style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600" }}>Pay with cash</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Recorded by an admin, no mobile money charge
                    </Text>
                  </View>
                  <Switch
                    value={payCash}
                    onValueChange={setPayCash}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    testID="contribute-cash-toggle"
                  />
                </View>
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
              {pricingError ? (
                <Text style={[styles.errText, { color: colors.danger, marginBottom: 10 }]}>
                  {pricingError}
                </Text>
              ) : null}
              <Button
                label="Review"
                loading={pricingLoading}
                disabled={
                  !!minError ||
                  networkUnknown ||
                  pricingLoading ||
                  (isPenaltiesMode && selectedPenaltyIds.length === 0)
                }
                onPress={goToConfirm}
                testID="contribute-review-btn"
              />
            </>
          ) : (
            <>
              <Card padding={20}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Total</Text>
                <Text style={[styles.confirmAmount, { color: colors.textMain }]}>
                  {formatZMW(pricing?.depositAmount ?? num)}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                {isPenaltiesMode ? (
                  penalties
                    .filter((p) => selectedPenaltyIds.includes(p.id))
                    .map((p) => (
                      <ConfirmRow key={p.id} label={p.reason} value={formatZMW(p.amount)} colors={colors} />
                    ))
                ) : (
                  <>
                    <ConfirmRow label="Contribution" value={formatZMW(pricing?.base ?? num)} colors={colors} />
                    <ConfirmRow
                      label="Transaction fees"
                      value={formatZMW((pricing?.feesCovered ?? 0) + (pricing?.platformFee ?? 0))}
                      colors={colors}
                    />
                  </>
                )}
                <ConfirmRow label="Group" value={selectedGroup.name} colors={colors} />
                <ConfirmRow label="Type" value={type.label} colors={colors} />
                <ConfirmRow
                  label="Cycle"
                  value={`#${Math.round(selectedGroup.cycleProgress * 12)} of 12`}
                  colors={colors}
                />
                <ConfirmRow label="From" value={paymentMethodLabel} colors={colors} last />
              </Card>

              {submitError ? (
                <Text style={[styles.errText, { color: colors.danger, marginTop: 12 }]}>{submitError}</Text>
              ) : null}

              <View style={{ flex: 1, minHeight: 24 }} />
              <Button
                label="Confirm & pay"
                loading={submitting}
                disabled={submitting}
                onPress={async () => {
                  if (isPenalty) return; // handled on penalties screen
                  if (networkUnknown) {
                    setSubmitError(
                      "No mobile money network detected for your number — update your profile or pay with cash."
                    );
                    return;
                  }
                  setSubmitting(true);
                  setSubmitError("");
                  try {
                    if (isPenaltiesMode) {
                      // One deposit clears every ticked penalty — settlement marks
                      // each paid and routes it per the group's constitution.
                      const res = await payPenalties(selectedPenaltyIds, payerPhone);
                      setServerTxn(res.transaction);
                    } else {
                      const res = await submitContribution({
                        groupId: selectedGroup.id,
                        amount: num,
                        // API contract — the wire values stay "topup"/"cycle"
                        // regardless of what the labels are called on screen.
                        contributionType: type.label === TOPUP_TYPE.label ? "topup" : "cycle",
                        paymentMethod: paymentMethodLabel,
                        payerPhone,
                      });
                      setServerTxn(res.transaction);
                    }
                    setStep("success");
                  } catch (e: any) {
                    setSubmitError(e?.message || "Payment failed. Please try again.");
                  } finally {
                    setSubmitting(false);
                  }
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
  status,
  isCash,
  typeLabel,
}: {
  amount: number;
  group: string;
  colors: ReturnType<typeof useTheme>["colors"];
  router: ReturnType<typeof useRouter>;
  receiptId: string;
  status: "completed" | "pending" | string;
  isCash: boolean;
  typeLabel: string;
}) => {
  const pending = status === "pending";
  // Penalties clear a debt; they never credit the member's savings.
  const isPenalties = typeLabel === PENALTIES_TYPE.label;
  const title = !pending
    ? isPenalties
      ? "Penalties paid"
      : "Payment received"
    : isCash
      ? "Awaiting treasurer confirmation"
      : "Payment processing";
  const message = !pending
    ? isPenalties
      ? `Your penalty payment of ${formatZMW(amount)} to ${group} has been recorded.`
      : `Your payment of ${formatZMW(amount)} to ${group} has been recorded and your savings updated.`
    : isCash
      ? `Your ${formatZMW(amount)} cash contribution to ${group} has been recorded. Your savings will update once the treasurer confirms receiving the cash.`
      : `Approve the ${formatZMW(amount)} payment on your phone. Your savings in ${group} will update as soon as the payment is confirmed — usually within seconds.`;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="contribute-success"
    >
      <View style={styles.successWrap}>
        <View style={[styles.successCircle, { backgroundColor: pending ? colors.warning : colors.primary }]}>
          {pending ? (
            <Clock size={56} color="#fff" strokeWidth={2.5} />
          ) : (
            <Check size={56} color="#fff" strokeWidth={3} />
          )}
        </View>
        <Text style={{ color: colors.textMain, fontSize: 24, fontWeight: "700", letterSpacing: -0.4, textAlign: "center", paddingHorizontal: 24 }}>
          {title}
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
          {message}
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
              <Text style={{ color: pending ? colors.warning : colors.primary, fontWeight: "700", fontSize: 13 }}>
                {pending ? "Pending" : "Saved"}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Contribution amount</Text>
            <Text style={{ color: colors.textMain, fontSize: 20, fontWeight: "700", marginTop: 4 }}>
              {formatZMW(amount)}
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
                  note: typeLabel,
                  status,
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
};

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
  penaltyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  penaltyToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  penaltyTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    marginHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
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
