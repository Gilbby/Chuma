import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { groups } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { Check, Camera, X } from "lucide-react-native";
import type { Group, GroupType, GroupConstitution } from "@/src/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

const STEP_TITLES = [
  "Group basics",
  "Contribution setup",
  "Loan rules",
  "Governance",
  "Invite members",
  "Review & confirm",
];

const GROUP_TYPES: { label: string; value: GroupType }[] = [
  { label: "Savings Group", value: "savings-group" },
  { label: "Cooperative", value: "cooperative" },
  { label: "Women's Group", value: "womens-group" },
  { label: "Church Group", value: "church-group" },
  { label: "Investment Group", value: "investment-group" },
];

const CONTRIB_FREQS = ["Weekly", "Bi-weekly", "Monthly"];
const CYCLE_DURATIONS = ["3 months", "6 months", "12 months"];
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LOAN_MULTIPLIERS = [
  { label: "1×", value: "1" },
  { label: "2×", value: "2" },
  { label: "3×", value: "3" },
  { label: "5×", value: "5" },
];
const LOAN_REPAYMENTS = ["1 month", "3 months", "6 months", "12 months"];

const APPROVAL_THRESHOLDS: { label: string; value: GroupConstitution["approvalThreshold"] }[] = [
  { label: "2 of 3 admins", value: "2-of-3" },
  { label: "Majority", value: "majority" },
  { label: "All admins", value: "all" },
];

const PERMISSION_ITEMS: { key: keyof Permissions; label: string }[] = [
  { key: "loanApprovals", label: "Loan approvals" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "ruleChanges", label: "Rule changes" },
  { key: "memberRemovals", label: "Member removals" },
  { key: "shareOutApprovals", label: "Share-out approvals" },
];

interface Permissions {
  loanApprovals: boolean;
  withdrawals: boolean;
  ruleChanges: boolean;
  memberRemovals: boolean;
  shareOutApprovals: boolean;
}

interface Invite {
  id: string;
  contact: string;
  status: "Pending" | "Accepted";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const inviteCode = useRef(Math.random().toString(36).slice(2, 8).toUpperCase());

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 — Group Basics
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType | "">("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);

  // Step 2 — Contribution Setup
  const [contribFreq, setContribFreq] = useState("Monthly");
  const [contribAmount, setContribAmount] = useState("");
  const [cycleDuration, setCycleDuration] = useState("6 months");
  const [deadlineDay, setDeadlineDay] = useState("1");
  const [deadlineDow, setDeadlineDow] = useState("Mon");
  const [lateContribEnabled, setLateContribEnabled] = useState(false);
  const [lateContributionPenaltyRate, setLateContributionPenaltyRate] = useState("1");

  // Step 3 — Loan Rules
  const [internalLending, setInternalLending] = useState(true);
  const [loanMultiplier, setLoanMultiplier] = useState("2");
  const [loanInterest, setLoanInterest] = useState("5");
  const [loanRepayment, setLoanRepayment] = useState("6 months");
  const [gracePeriod, setGracePeriod] = useState("0");
  const [lateRepayEnabled, setLateRepayEnabled] = useState(false);
  const [lateRepaymentPenaltyRate, setLateRepaymentPenaltyRate] = useState("1");

  // Step 4 — Governance
  const [chairperson, setChairperson] = useState("");
  const [treasurer, setTreasurer] = useState("");
  const [secretary, setSecretary] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState<GroupConstitution["approvalThreshold"]>("majority");
  const [permissions, setPermissions] = useState<Permissions>({
    loanApprovals: true,
    withdrawals: true,
    ruleChanges: true,
    memberRemovals: true,
    shareOutApprovals: true,
  });

  // Step 5 — Invites
  const [phoneInput, setPhoneInput] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [aliasResult, setAliasResult] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  // Step 6 — Review
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 7 — new group id after creation
  const [newGroupId, setNewGroupId] = useState("");

  //  Helpers 

  const toNum = (s: string) => parseFloat(s) || 0;
  const parseMonths = (s: string) => parseInt(s.split(" ")[0]) || 6;

  const handleNumericInput = (text: string, setter: (v: string) => void) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] !== undefined && parts[1].length > 2) return;
    setter(cleaned);
  };

  const handleIntInput = (text: string, setter: (v: string) => void, max?: number) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (max !== undefined && cleaned !== "" && parseInt(cleaned) > max) return;
    setter(cleaned);
  };

  const handlePenaltyRateInput = (text: string, setter: (v: string) => void) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] !== undefined && parts[1].length > 2) return;
    const val = parseFloat(cleaned);
    setter(!isNaN(val) && val > 30 ? "30" : cleaned);
  };

  const clearErr = (key: string) =>
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!groupName.trim()) e.groupName = "Group name is required";
      if (!groupType) e.groupType = "Select a group type";
    }
    if (step === 2) {
      if (toNum(contribAmount) <= 0) e.contribAmount = "Enter a valid contribution amount";
      if (contribFreq === "Monthly") {
        const d = parseInt(deadlineDay) || 0;
        if (d < 1 || d > 28) e.deadlineDay = "Enter a day between 1 and 28";
      }
    }
    if (step === 4) {
      if (!chairperson.trim()) e.chairperson = "Chairperson name or phone is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setGroupAvatar(result.assets[0].uri);
  };

  const handleCopyLink = async () => {
    try { await Clipboard.setStringAsync(`CHUMA-${inviteCode.current}`); } catch {}
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const addPhoneInvite = () => {
    if (!phoneInput.trim()) return;
    setInvites((prev) => [...prev, { id: `${Date.now()}`, contact: phoneInput.trim(), status: "Pending" }]);
    setPhoneInput("");
  };

  const addAliasInvite = () => {
    if (!aliasResult) return;
    setInvites((prev) => [...prev, { id: `${Date.now()}`, contact: aliasResult, status: "Pending" }]);
    setAliasInput("");
    setAliasResult(null);
  };

  const removeInvite = (id: string) => setInvites((prev) => prev.filter((i) => i.id !== id));

  const goToStep = (n: number) => { setStep(n); setErrors({}); };

  const handleNext = () => {
    if (!validate()) return;
    setStep((s) => s + 1);
    setErrors({});
  };

  const handleCreate = () => {
    const cycleMonths = parseMonths(cycleDuration);
    const d = new Date();
    d.setMonth(d.getMonth() + cycleMonths);
    const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const shareOutDate = `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    const newId = `g${Date.now()}`;
    const newGroup: Group = {
      id: newId,
      name: groupName.trim(),
      description: groupDesc.trim(),
      groupType: groupType as GroupType,
      totalSavings: 0,
      walletBalance: 0,
      loanCirculation: 0,
      memberCount: invites.length,
      cycleProgress: 0,
      shareOutDate,
      contributionAmount: toNum(contribAmount),
      contributionFrequency: contribFreq,
      loanInterestRate: toNum(loanInterest) || 5,
      loanMaxMultiplier: parseInt(loanMultiplier) || 2,
      members: [],
      yourRole: "Chairperson",
      constitution: {
        penaltyRules: {
          lateContribution: { enabled: lateContribEnabled, penaltyRate: toNum(lateContributionPenaltyRate) || 1 },
          missingMeeting: { enabled: false, amount: 0 },
          lateRepayment: { enabled: lateRepayEnabled, penaltyRate: toNum(lateRepaymentPenaltyRate) || 1 },
        },
        gracePeriodDays: parseInt(gracePeriod) || 0,
        loanMultiplier: parseInt(loanMultiplier) || 2,
        loanInterestRate: toNum(loanInterest) || 5,
        loanRepaymentMonths: parseMonths(loanRepayment),
        internalLendingEnabled: internalLending,
        approvalThreshold,
      },
    };
    groups.push(newGroup);
    setNewGroupId(newId);
    setStep(7);
  };

  // ─── Step 7 — Success ───────────────────────────────────────────────────────

  if (step === 7) {
    const typeLabel = GROUP_TYPES.find((t) => t.value === groupType)?.label ?? "";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="create-group-success">
        <View style={styles.successWrap}>
          <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
            <Check size={56} color="#fff" strokeWidth={3} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textMain }]}>Group created</Text>
          <Text style={[styles.successSub, { color: colors.textMuted }]}>{groupName}</Text>

          <View style={{ width: "100%", paddingHorizontal: 24, marginTop: 28 }}>
            <Card padding={18}>
              <RRow label="Name" value={groupName} colors={colors} />
              <RRow label="Type" value={typeLabel} colors={colors} />
              <RRow label="Cycle" value={cycleDuration} colors={colors} />
              <RRow label="Members invited" value={String(invites.length)} colors={colors} last />
            </Card>
          </View>

          <View style={{ flex: 1 }} />
          <View style={{ width: "100%", paddingHorizontal: 24 }}>
            <Button
              label="Open group dashboard"
              onPress={() => router.replace(`/group/${newGroupId}`)}
              testID="create-group-open-btn"
            />
            <View style={{ height: 10 }} />
            <Button
              label="Invite more members"
              variant="ghost"
              onPress={() => router.replace(`/group/${newGroupId}`)}
              testID="create-group-invite-btn"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Derived display values ──────────────────────────────────────────────────

  const groupTypeLabel = GROUP_TYPES.find((t) => t.value === groupType)?.label ?? "";
  const thresholdLabel = APPROVAL_THRESHOLDS.find((t) => t.value === approvalThreshold)?.label ?? "";
  const activePermCount = Object.values(permissions).filter(Boolean).length;

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="create-group-screen">
      <ScreenHeader
        title={STEP_TITLES[step - 1]}
        onBack={step > 1 ? () => goToStep(step - 1) : undefined}
      />

      {/* Step progress bar */}
      <View style={styles.progressWrap}>
        <Text style={[styles.stepLabel, { color: colors.textMuted }]}>Step {step} of {TOTAL_STEPS}</Text>
        <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
          <View style={{ flex: step, height: 4, backgroundColor: colors.primary, borderRadius: 99 }} />
          <View style={{ flex: TOTAL_STEPS - step }} />
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ─── STEP 1 — Group Basics ──────────────────────────────────────── */}
            {step === 1 && (
              <>
                <FL text="Group name" colors={colors} />
                <TextInput
                  style={[styles.inputField, { color: colors.textMain, backgroundColor: colors.surface, borderColor: errors.groupName ? colors.danger : colors.border }]}
                  value={groupName}
                  onChangeText={(t) => { setGroupName(t); clearErr("groupName"); }}
                  placeholder="e.g. Lusaka Market Sisters"
                  placeholderTextColor={colors.textMuted}
                  testID="create-group-name-input"
                />
                {errors.groupName ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.groupName}</Text> : null}

                <FL text="Group type" colors={colors} style={{ marginTop: 20 }} />
                <View style={styles.chipsRow}>
                  {GROUP_TYPES.map((t) => {
                    const active = groupType === t.value;
                    return (
                      <Pressable
                        key={t.value}
                        onPress={() => { setGroupType(t.value); clearErr("groupType"); }}
                        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                        testID={`group-type-${t.value}`}
                      >
                        <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.groupType ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.groupType}</Text> : null}

                <FL text="Description (optional)" colors={colors} style={{ marginTop: 20 }} />
                <TextInput
                  style={[styles.inputField, styles.textArea, { color: colors.textMain, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={groupDesc}
                  onChangeText={setGroupDesc}
                  placeholder="What is this group for?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  testID="create-group-desc-input"
                />

                <FL text="Group avatar (optional)" colors={colors} style={{ marginTop: 20 }} />
                <Pressable onPress={pickImage} style={styles.avatarWrap} testID="create-group-avatar-btn">
                  {groupAvatar ? (
                    <Image source={{ uri: groupAvatar }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                      <Camera size={26} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 12, marginTop: 6, fontWeight: "600" }}>Choose photo</Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            {/* ─── STEP 2 — Contribution Setup ────────────────────────────────── */}
            {step === 2 && (
              <>
                <FL text="Contribution frequency" colors={colors} />
                <View style={styles.chipsRow}>
                  {CONTRIB_FREQS.map((f) => {
                    const active = contribFreq === f;
                    return (
                      <Pressable
                        key={f}
                        onPress={() => setContribFreq(f)}
                        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                        testID={`contrib-freq-${f}`}
                      >
                        <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{f}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <FL text="Contribution amount" colors={colors} style={{ marginTop: 20 }} />
                <View style={[styles.amountWrap, { backgroundColor: colors.surface, borderColor: errors.contribAmount ? colors.danger : colors.border }]}>
                  <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.textMain }]}
                    value={contribAmount}
                    onChangeText={(t) => { handleNumericInput(t, setContribAmount); clearErr("contribAmount"); }}
                    keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    testID="create-group-contrib-amount"
                  />
                </View>
                {errors.contribAmount ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.contribAmount}</Text> : null}

                <FL text="Savings cycle duration" colors={colors} style={{ marginTop: 20 }} />
                <View style={styles.chipsRow}>
                  {CYCLE_DURATIONS.map((d) => {
                    const active = cycleDuration === d;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setCycleDuration(d)}
                        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                      >
                        <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{d}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <FL
                  text={contribFreq === "Monthly" ? "Day of month deadline" : "Day of week deadline"}
                  colors={colors}
                  style={{ marginTop: 20 }}
                />
                {contribFreq === "Monthly" ? (
                  <>
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: errors.deadlineDay ? colors.danger : colors.border }]}>
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>Day</Text>
                      <TextInput
                        style={[styles.inlineInput, { color: colors.textMain }]}
                        value={deadlineDay}
                        onChangeText={(t) => { handleIntInput(t, setDeadlineDay, 28); clearErr("deadlineDay"); }}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        testID="create-group-deadline-day"
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>of each month</Text>
                    </View>
                    {errors.deadlineDay ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.deadlineDay}</Text> : null}
                  </>
                ) : (
                  <View style={styles.chipsRow}>
                    {DAYS_OF_WEEK.map((d) => {
                      const active = deadlineDow === d;
                      return (
                        <Pressable
                          key={d}
                          onPress={() => setDeadlineDow(d)}
                          style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                        >
                          <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{d}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <TR label="Late contribution penalty" value={lateContribEnabled} onToggle={setLateContribEnabled} colors={colors} style={{ marginTop: 20 }} />
                {lateContribEnabled && (
                  <>
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 }]}>
                      <TextInput
                        style={[styles.inlineInput, { color: colors.textMain, flex: 1, textAlign: "left" }]}
                        value={lateContributionPenaltyRate}
                        onChangeText={(t) => handlePenaltyRateInput(t, setLateContributionPenaltyRate)}
                        keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                        placeholder="0.0"
                        placeholderTextColor={colors.textMuted}
                        testID="create-group-late-contrib-rate"
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: "600" }}>%</Text>
                    </View>
                    {toNum(lateContributionPenaltyRate) >= 30 && (
                      <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 6 }]}>
                        Maximum is 30% of contribution amount per day
                      </Text>
                    )}
                    {toNum(contribAmount) > 0 && toNum(lateContributionPenaltyRate) > 0 && (
                      <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 4 }]}>
                        e.g. {formatZMW(toNum(contribAmount))} × {lateContributionPenaltyRate}% × 7 days late = {formatZMW(toNum(contribAmount) * (toNum(lateContributionPenaltyRate) / 100) * 7)}
                      </Text>
                    )}
                  </>
                )}
              </>
            )}

            {/* ─── STEP 3 — Loan Rules ────────────────────────────────────────── */}
            {step === 3 && (
              <>
                <TR label="Enable internal lending" value={internalLending} onToggle={setInternalLending} colors={colors} />

                {internalLending && (
                  <>
                    <FL
                      text={`Loan multiplier — up to ${loanMultiplier}× member savings`}
                      colors={colors}
                      style={{ marginTop: 20 }}
                    />
                    <View style={styles.chipsRow}>
                      {LOAN_MULTIPLIERS.map((m) => {
                        const active = loanMultiplier === m.value;
                        return (
                          <Pressable
                            key={m.value}
                            onPress={() => setLoanMultiplier(m.value)}
                            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                            testID={`loan-multiplier-${m.value}`}
                          >
                            <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{m.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <FL text="Interest rate (% per month)" colors={colors} style={{ marginTop: 20 }} />
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.inlineInput, { color: colors.textMain, flex: 1, textAlign: "left" }]}
                        value={loanInterest}
                        onChangeText={(t) => handleNumericInput(t, setLoanInterest)}
                        keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                        placeholder="5"
                        placeholderTextColor={colors.textMuted}
                        testID="create-group-loan-interest"
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: "600" }}>%</Text>
                    </View>

                    <FL text="Repayment duration" colors={colors} style={{ marginTop: 20 }} />
                    <View style={styles.chipsRow}>
                      {LOAN_REPAYMENTS.map((r) => {
                        const active = loanRepayment === r;
                        return (
                          <Pressable
                            key={r}
                            onPress={() => setLoanRepayment(r)}
                            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                            testID={`loan-repay-${r}`}
                          >
                            <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{r}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <FL text="Grace period — days before repayment begins" colors={colors} style={{ marginTop: 20 }} />
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.inlineInput, { color: colors.textMain, flex: 1, textAlign: "left" }]}
                        value={gracePeriod}
                        onChangeText={(t) => handleIntInput(t, setGracePeriod, 14)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        testID="create-group-grace-period"
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>days</Text>
                    </View>

                    <TR label="Late repayment penalty" value={lateRepayEnabled} onToggle={setLateRepayEnabled} colors={colors} style={{ marginTop: 20 }} />
                    {lateRepayEnabled && (
                      <>
                        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 10 }]}>
                          <TextInput
                            style={[styles.inlineInput, { color: colors.textMain, flex: 1, textAlign: "left" }]}
                            value={lateRepaymentPenaltyRate}
                            onChangeText={(t) => handlePenaltyRateInput(t, setLateRepaymentPenaltyRate)}
                            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                            placeholder="0.0"
                            placeholderTextColor={colors.textMuted}
                            testID="create-group-late-repay-rate"
                          />
                          <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: "600" }}>%</Text>
                        </View>
                        {toNum(lateRepaymentPenaltyRate) >= 30 && (
                          <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 6 }]}>
                            Maximum is 30% of contribution amount per day
                          </Text>
                        )}
                        {toNum(contribAmount) > 0 && toNum(lateRepaymentPenaltyRate) > 0 && (
                          <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 4 }]}>
                            e.g. {formatZMW(toNum(contribAmount) * (parseInt(loanMultiplier) || 2))} × {lateRepaymentPenaltyRate}% × 7 days late = {formatZMW(toNum(contribAmount) * (parseInt(loanMultiplier) || 2) * (toNum(lateRepaymentPenaltyRate) / 100) * 7)}
                          </Text>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ─── STEP 4 — Governance ────────────────────────────────────────── */}
            {step === 4 && (
              <>
                <FL text="Chairperson" colors={colors} />
                <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                  Usually the group founder — defaults to you
                </Text>
                <TextInput
                  style={[styles.inputField, { marginTop: 8, color: colors.textMain, backgroundColor: colors.surface, borderColor: errors.chairperson ? colors.danger : colors.border }]}
                  value={chairperson}
                  onChangeText={(t) => { setChairperson(t); clearErr("chairperson"); }}
                  placeholder="Name or phone number"
                  placeholderTextColor={colors.textMuted}
                  testID="create-group-chairperson"
                />
                {errors.chairperson ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.chairperson}</Text> : null}

                <FL text="Treasurer (optional)" colors={colors} style={{ marginTop: 20 }} />
                <TextInput
                  style={[styles.inputField, { color: colors.textMain, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={treasurer}
                  onChangeText={setTreasurer}
                  placeholder="Name or phone number"
                  placeholderTextColor={colors.textMuted}
                  testID="create-group-treasurer"
                />

                <FL text="Secretary (optional)" colors={colors} style={{ marginTop: 20 }} />
                <TextInput
                  style={[styles.inputField, { color: colors.textMain, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={secretary}
                  onChangeText={setSecretary}
                  placeholder="Name or phone number"
                  placeholderTextColor={colors.textMuted}
                  testID="create-group-secretary"
                />

                <FL text="Approval threshold" colors={colors} style={{ marginTop: 20 }} />
                <View style={styles.chipsRow}>
                  {APPROVAL_THRESHOLDS.map((t) => {
                    const active = approvalThreshold === t.value;
                    return (
                      <Pressable
                        key={t.value}
                        onPress={() => setApprovalThreshold(t.value)}
                        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                        testID={`approval-threshold-${t.value}`}
                      >
                        <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <FL text="Governance permissions" colors={colors} style={{ marginTop: 20 }} />
                <Card padding={4} style={{ marginTop: 4 }}>
                  {PERMISSION_ITEMS.map((p, i) => (
                    <Pressable
                      key={p.key}
                      onPress={() => setPermissions((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
                      style={[
                        styles.optionRow,
                        i < PERMISSION_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                      testID={`permission-${p.key}`}
                    >
                      <Text style={{ color: colors.textMain, fontWeight: "500", flex: 1 }}>{p.label}</Text>
                      <View style={[styles.checkbox, { borderColor: permissions[p.key] ? colors.primary : colors.borderStrong, backgroundColor: permissions[p.key] ? colors.primary : "transparent" }]}>
                        {permissions[p.key] && <Check size={12} color="#fff" strokeWidth={3} />}
                      </View>
                    </Pressable>
                  ))}
                </Card>
              </>
            )}

            {/* ─── STEP 5 — Invite Members ────────────────────────────────────── */}
            {step === 5 && (
              <>
                <FL text="Invite by phone" colors={colors} />
                <View style={styles.inputActionRow}>
                  <TextInput
                    style={[styles.inputField, { flex: 1, color: colors.textMain, backgroundColor: colors.surface, borderColor: colors.border }]}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    placeholder="+260 97X XXX XXX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    testID="create-group-phone-input"
                  />
                  <Pressable
                    onPress={addPhoneInvite}
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    testID="create-group-phone-send"
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Send</Text>
                  </Pressable>
                </View>

                <FL text="Invite by username" colors={colors} style={{ marginTop: 16 }} />
                <View style={styles.inputActionRow}>
                  <TextInput
                    style={[styles.inputField, { flex: 1, color: colors.textMain, backgroundColor: colors.surface, borderColor: colors.border }]}
                    value={aliasInput}
                    onChangeText={(t) => { setAliasInput(t); setAliasResult(null); }}
                    placeholder="@username"
                    placeholderTextColor={colors.textMuted}
                    testID="create-group-alias-input"
                  />
                  <Pressable
                    onPress={() => { if (aliasInput.trim()) setAliasResult(aliasInput.trim()); }}
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    testID="create-group-alias-search"
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Search</Text>
                  </Pressable>
                </View>
                {aliasResult && (
                  <Card padding={12} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={[styles.aliasAvatar, { backgroundColor: colors.primarySoft }]}>
                        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>
                          {aliasResult.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textMain, fontWeight: "600", flex: 1, marginLeft: 10 }}>{aliasResult}</Text>
                      <Pressable onPress={addAliasInvite} style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Add</Text>
                      </Pressable>
                    </View>
                  </Card>
                )}

                <Pressable onPress={handleCopyLink} style={{ marginTop: 20 }} testID="create-group-copy-link">
                  <Card padding={14}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View>
                        <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>Share invite link</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          CHUMA-{inviteCode.current}
                        </Text>
                      </View>
                      <Text style={{ color: linkCopied ? colors.success : colors.primary, fontWeight: "700", fontSize: 13 }}>
                        {linkCopied ? "Copied!" : "Copy"}
                      </Text>
                    </View>
                  </Card>
                </Pressable>

                {invites.length > 0 && (
                  <>
                    <FL text="Pending invitations" colors={colors} style={{ marginTop: 20 }} />
                    <Card padding={4}>
                      {invites.map((inv, i) => (
                        <View
                          key={inv.id}
                          style={[
                            styles.optionRow,
                            i < invites.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          ]}
                        >
                          <Text style={{ color: colors.textMain, fontWeight: "500", flex: 1 }}>{inv.contact}</Text>
                          <View style={[styles.statusPill, { backgroundColor: colors.primarySoft }]}>
                            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{inv.status}</Text>
                          </View>
                          <Pressable onPress={() => removeInvite(inv.id)} style={{ marginLeft: 10 }} testID={`remove-invite-${inv.id}`}>
                            <X size={16} color={colors.textMuted} />
                          </Pressable>
                        </View>
                      ))}
                    </Card>
                  </>
                )}

                <View style={[styles.infoNote, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ color: colors.primary, fontSize: 13, lineHeight: 20 }}>
                    Members will receive an SMS invite to join Chuma and this group.
                  </Text>
                </View>

                <View style={{ flex: 1, minHeight: 24 }} />
                <Button
                  label="Continue"
                  onPress={() => goToStep(6)}
                  testID="create-group-step5-continue"
                />
                <View style={{ height: 10 }} />
                <Button
                  label="Skip for now"
                  variant="ghost"
                  onPress={() => goToStep(6)}
                  testID="create-group-step5-skip"
                />
              </>
            )}

            {/* ─── STEP 6 — Review & Confirm ──────────────────────────────────── */}
            {step === 6 && (
              <>
                <RC title="Group" onEdit={() => goToStep(1)} colors={colors}>
                  <RRow label="Name" value={groupName} colors={colors} />
                  <RRow label="Type" value={groupTypeLabel} colors={colors} />
                  {groupDesc ? <RRow label="Description" value={groupDesc} colors={colors} /> : null}
                  <RRow label="Avatar" value={groupAvatar ? "Photo selected" : "None"} colors={colors} last />
                </RC>

                <RC title="Contributions" onEdit={() => goToStep(2)} colors={colors} style={{ marginTop: 14 }}>
                  <RRow label="Frequency" value={contribFreq} colors={colors} />
                  <RRow label="Amount" value={`K ${contribAmount || "0"}`} colors={colors} />
                  <RRow label="Cycle" value={cycleDuration} colors={colors} />
                  <RRow
                    label="Deadline"
                    value={contribFreq === "Monthly" ? `Day ${deadlineDay} of each month` : deadlineDow}
                    colors={colors}
                  />
                  <RRow label="Late penalty" value={lateContribEnabled ? `${lateContributionPenaltyRate}% per day (max 30%)` : "None"} colors={colors} last />
                </RC>

                <RC title="Loans" onEdit={() => goToStep(3)} colors={colors} style={{ marginTop: 14 }}>
                  <RRow label="Internal lending" value={internalLending ? "Enabled" : "Disabled"} colors={colors} last={!internalLending} />
                  {internalLending && (
                    <>
                      <RRow label="Multiplier" value={`${loanMultiplier}× savings`} colors={colors} />
                      <RRow label="Interest" value={`${loanInterest}% / month`} colors={colors} />
                      <RRow label="Repayment" value={loanRepayment} colors={colors} />
                      <RRow label="Grace period" value={`${gracePeriod} days`} colors={colors} />
                      <RRow label="Late penalty" value={lateRepayEnabled ? `${lateRepaymentPenaltyRate}% per day (max 30%)` : "None"} colors={colors} last />
                    </>
                  )}
                </RC>

                <RC title="Governance" onEdit={() => goToStep(4)} colors={colors} style={{ marginTop: 14 }}>
                  <RRow label="Chairperson" value={chairperson || "—"} colors={colors} />
                  <RRow label="Treasurer" value={treasurer || "—"} colors={colors} />
                  <RRow label="Secretary" value={secretary || "—"} colors={colors} />
                  <RRow label="Threshold" value={thresholdLabel} colors={colors} />
                  <RRow label="Permissions" value={`${activePermCount} active`} colors={colors} last />
                </RC>

                <RC title="Members" onEdit={() => goToStep(5)} colors={colors} style={{ marginTop: 14 }}>
                  <RRow label="Pending invites" value={String(invites.length)} colors={colors} last />
                </RC>

                <Pressable
                  onPress={() => setTermsAccepted((v) => !v)}
                  style={[styles.termsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  testID="create-group-terms"
                >
                  <View style={[styles.checkbox, { borderColor: termsAccepted ? colors.primary : colors.borderStrong, backgroundColor: termsAccepted ? colors.primary : "transparent" }]}>
                    {termsAccepted && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={{ color: colors.textMain, fontSize: 13, lineHeight: 20, flex: 1, marginLeft: 12 }}>
                    I accept the Chuma platform terms and group creation policy.
                  </Text>
                </Pressable>

                <View style={{ flex: 1, minHeight: 24 }} />
                <Button
                  label="Create Group"
                  disabled={!termsAccepted}
                  onPress={handleCreate}
                  testID="create-group-submit-btn"
                />
              </>
            )}

            {/* Continue button for steps 1–4 */}
            {step >= 1 && step <= 4 && (
              <>
                <View style={{ flex: 1, minHeight: 24 }} />
                <Button
                  label="Continue"
                  onPress={handleNext}
                  testID={`create-group-step${step}-continue`}
                />
              </>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

// ─── Local sub-components ─────────────────────────────────────────────────────

/** Field label — uppercase overline style */
const FL = ({
  text,
  colors,
  style,
}: {
  text: string;
  colors: ReturnType<typeof useTheme>["colors"];
  style?: object;
}) => (
  <Text style={[{ fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: colors.textMuted, marginBottom: 8 }, style]}>
    {text.toUpperCase()}
  </Text>
);

/** Toggle row */
const TR = ({
  label,
  value,
  onToggle,
  colors,
  style,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  colors: ReturnType<typeof useTheme>["colors"];
  style?: object;
}) => (
  <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.surface }, style]}>
    <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 15, flex: 1 }}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor="#fff"
    />
  </View>
);

/** Review card wrapper with section title + Edit button */
const RC = ({
  title,
  onEdit,
  colors,
  children,
  style,
}: {
  title: string;
  onEdit: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  children: React.ReactNode;
  style?: object;
}) => (
  <Card padding={16} style={style}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>
        {title.toUpperCase()}
      </Text>
      <Pressable onPress={onEdit} hitSlop={8}>
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Edit</Text>
      </Pressable>
    </View>
    {children}
  </Card>
);

/** Review row — label/value pair */
const RRow = ({
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
  <View style={[{ paddingVertical: 9, flexDirection: "row", justifyContent: "space-between" }, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.textMain, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right", marginLeft: 16 }} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 28 },
  progressWrap: { paddingHorizontal: 20, paddingBottom: 14 },
  stepLabel: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  progressBg: {
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
    flexDirection: "row",
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "500",
  },
  textArea: { minHeight: 84, paddingTop: 14 },
  fieldHint: { fontSize: 12, marginBottom: 2 },
  errText: { fontSize: 12, marginTop: 6, fontWeight: "500" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 10,
  },
  currency: { fontSize: 24, fontWeight: "700" },
  amountInput: { flex: 1, fontSize: 36, fontWeight: "700", letterSpacing: -0.8, padding: 0 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  inlineInput: { fontSize: 15, fontWeight: "500", padding: 0, minWidth: 32 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  inputActionRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  aliasAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  infoNote: { marginTop: 20, padding: 14, borderRadius: 14 },
  avatarWrap: { alignSelf: "flex-start" },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
  },
  successWrap: { flex: 1, alignItems: "center", paddingTop: 60, paddingBottom: 24 },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  successSub: { fontSize: 15, marginTop: 6 },
});
