import React, { useState } from "react";
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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { createGroup } from "@/src/services/groups";
import { getCurrentUser } from "@/src/utils/currentUser";
import { formatZMW } from "@/src/utils/currency";
import { Check, Camera, X, CreditCard } from "lucide-react-native";
import Slider from "@react-native-community/slider";
import type { GroupType, GroupConstitution } from "@/src/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

const STEP_TITLES = [
  "Group basics",
  "Contribution setup",
  "Loan rules",
  "Governance",
  "Review & confirm",
  "Payment",
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
const PAYMENT_METHODS = ["MTN MoMo", "Airtel Money", "Zamtel Kwacha", "Bank Transfer"];

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

  const [lateContribPenaltyType, setLateContribPenaltyType] = useState<"flat" | "percent">("percent");
  const [lateContribFlatAmount, setLateContribFlatAmount] = useState("20");
  const [lateRepayPenaltyType, setLateRepayPenaltyType] = useState<"flat" | "percent">("percent");
  const [lateRepayFlatAmount, setLateRepayFlatAmount] = useState("100");

  // Step 4 — Governance
  const [treasurerPhone, setTreasurerPhone] = useState("");
  const [secretaryPhone, setSecretaryPhone] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState<GroupConstitution["approvalThreshold"]>("majority");
  const [permissions, setPermissions] = useState<Permissions>({
    loanApprovals: true,
    withdrawals: true,
    ruleChanges: true,
    memberRemovals: true,
    shareOutApprovals: true,
  });

  // Post-creation invite state (used on invite screen after success)
  const [phoneInput, setPhoneInput] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [aliasResult, setAliasResult] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [showInvite, setShowInvite] = useState(false);

  // Step 5 — Review
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 6 — Payment
  const [payMethod, setPayMethod] = useState("Airtel Money");
  const [paying, setPaying] = useState(false);

  // new group id after creation
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


  const isValidZambianPhone = (s: string) => /^\d{9}$/.test(s.replace(/\s/g, ""));

  const handlePhoneInput = (text: string, setter: (v: string) => void) =>
    setter(text.replace(/\D/g, "").slice(0, 9));

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
      if (treasurerPhone.trim() && !isValidZambianPhone(treasurerPhone.trim())) e.treasurerPhone = "Enter a valid Zambian phone number";
      if (secretaryPhone.trim() && !isValidZambianPhone(secretaryPhone.trim())) e.secretaryPhone = "Enter a valid Zambian phone number";
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

  const handlePayAndCreate = async () => {
    if (paying) return;
    setPaying(true);
    try {
      const cycleMonths = parseMonths(cycleDuration);
      const d = new Date();
      d.setMonth(d.getMonth() + cycleMonths);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const shareOutDate = `${yyyy}-${mm}-${dd}`;

      const constitution: GroupConstitution = {
        penaltyRules: {
          lateContribution: {
            enabled: lateContribEnabled,
            penaltyType: lateContribPenaltyType,
            penaltyRate: lateContribPenaltyType === "percent" ? toNum(lateContributionPenaltyRate) || 1 : undefined,
            penaltyAmount: lateContribPenaltyType === "flat" ? toNum(lateContribFlatAmount) || 20 : undefined,
          },
          missingMeeting: { enabled: false, amount: 0 },
          lateRepayment: {
            enabled: lateRepayEnabled,
            penaltyType: lateRepayPenaltyType,
            penaltyRate: lateRepayPenaltyType === "percent" ? toNum(lateRepaymentPenaltyRate) || 1 : undefined,
            penaltyAmount: lateRepayPenaltyType === "flat" ? toNum(lateRepayFlatAmount) || 100 : undefined,
          },
        },
        gracePeriodDays: parseInt(gracePeriod) || 0,
        loanMultiplier: parseInt(loanMultiplier) || 2,
        loanInterestRate: toNum(loanInterest) || 5,
        loanRepaymentMonths: parseMonths(loanRepayment),
        internalLendingEnabled: internalLending,
        approvalThreshold,
      };

      const user = await getCurrentUser<{ phone?: string }>();

      const payload = {
        name: groupName.trim(),
        description: groupDesc.trim(),
        groupType,
        avatar: groupAvatar || undefined,
        contributionAmount: toNum(contribAmount),
        contributionFrequency: contribFreq,
        shareOutDate,
        loanInterestRate: toNum(loanInterest) || 5,
        loanMaxMultiplier: parseInt(loanMultiplier) || 2,
        constitution,
        treasurerPhone: treasurerPhone ? `+260${treasurerPhone}` : undefined,
        secretaryPhone: secretaryPhone ? `+260${secretaryPhone}` : undefined,
        payerPhone: user?.phone,
      };

      const res = await createGroup(payload);
      const newId = String(res.group._id);
      setNewGroupId(newId);
      setStep(7);
    } catch (e: any) {
      Alert.alert("Could not create group", e?.message || "Please try again.");
    } finally {
      setPaying(false);
    }
  };

  // ─── Post-creation invite screen ────────────────────────────────────────────

  if (showInvite) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="create-group-invite-screen">
        <ScreenHeader title="Invite members" onBack={() => setShowInvite(false)} />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
                Invite people to {groupName} by phone number. They'll get an SMS and see the invite in their app.
              </Text>

              {/* TODO: send real invites to created group via backend */}
              <FL text="Invite by phone" colors={colors} />
              <View style={styles.inputActionRow}>
                <TextInput
                  style={[styles.inputField, { flex: 1, color: colors.textMain, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="+260 97X XXX XXX"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  testID="invite-phone-input"
                />
                <Pressable
                  onPress={addPhoneInvite}
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  testID="invite-phone-send"
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
                  testID="invite-alias-input"
                />
                <Pressable
                  onPress={() => { if (aliasInput.trim()) setAliasResult(aliasInput.trim()); }}
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  testID="invite-alias-search"
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
                label="Done — go to dashboard"
                onPress={() => router.replace(`/group/${newGroupId}`)}
                testID="invite-done-btn"
              />
              <View style={{ height: 10 }} />
              <Button
                label="Skip for now"
                variant="ghost"
                onPress={() => router.replace(`/group/${newGroupId}`)}
                testID="invite-skip-btn"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    );
  }

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
              <RRow label="Registration fee" value={`K100.00 paid · ${payMethod}`} colors={colors} last />
            </Card>
          </View>

          <View style={{ flex: 1 }} />
          <View style={{ width: "100%", paddingHorizontal: 24 }}>
            <Button
              label="Invite members"
              onPress={() => setShowInvite(true)}
              testID="create-group-invite-btn"
            />
            <View style={{ height: 10 }} />
            <Button
              label="Go to group dashboard"
              variant="ghost"
              onPress={() => router.replace(`/group/${newGroupId}`)}
              testID="create-group-open-btn"
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
                    <View style={[styles.chipsRow, { marginTop: 10, marginBottom: 12 }]}>
                      {(["Flat fee", "% per day"] as const).map((opt) => {
                        const t = opt === "Flat fee" ? "flat" : "percent";
                        const active = lateContribPenaltyType === t;
                        return (
                          <Pressable
                            key={opt}
                            onPress={() => setLateContribPenaltyType(t)}
                            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                          >
                            <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{opt}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {lateContribPenaltyType === "flat" ? (
                      <>
                        <FL text="Penalty amount" colors={colors} />
                        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
                          <TextInput
                            style={[styles.inlineInput, { color: colors.textMain, flex: 1, textAlign: "left" }]}
                            value={lateContribFlatAmount}
                            onChangeText={(t) => setLateContribFlatAmount(t.replace(/[^0-9]/g, "").slice(0, 5))}
                            keyboardType="numeric"
                            testID="create-group-late-contrib-flat"
                          />
                        </View>
                        <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 6 }]}>
                          Members will be charged a fixed K{lateContribFlatAmount} per violation
                        </Text>
                      </>
                    ) : (
                      <>
                        <FL text={`Penalty rate: ${lateContributionPenaltyRate}% per day`} colors={colors} />
                        <Slider
                          minimumValue={0.5}
                          maximumValue={30}
                          step={0.5}
                          value={parseFloat(lateContributionPenaltyRate) || 1}
                          onValueChange={(v) => setLateContributionPenaltyRate(v.toFixed(1))}
                          minimumTrackTintColor={colors.primary}
                          maximumTrackTintColor={colors.border}
                          thumbTintColor={colors.primary}
                          style={{ marginVertical: 8 }}
                        />
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>0.5%</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>30% max</Text>
                        </View>
                        {toNum(contribAmount) > 0 && (
                          <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 6 }]}>
                            e.g. {formatZMW(toNum(contribAmount))} × {lateContributionPenaltyRate}% × 7 days = {formatZMW(toNum(contribAmount) * (toNum(lateContributionPenaltyRate) / 100) * 7)}
                          </Text>
                        )}
                      </>
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
                        <View style={[styles.chipsRow, { marginTop: 10, marginBottom: 12 }]}>
                          {(["Flat fee", "% per day"] as const).map((opt) => {
                            const t = opt === "Flat fee" ? "flat" : "percent";
                            const active = lateRepayPenaltyType === t;
                            return (
                              <Pressable
                                key={opt}
                                onPress={() => setLateRepayPenaltyType(t)}
                                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                              >
                                <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{opt}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        {lateRepayPenaltyType === "flat" ? (
                          <>
                            <FL text="Penalty amount" colors={colors} />
                            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                              <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
                              <TextInput
                                style={[styles.inlineInput, { color: colors.textMain, flex: 1, textAlign: "left" }]}
                                value={lateRepayFlatAmount}
                                onChangeText={(t) => setLateRepayFlatAmount(t.replace(/[^0-9]/g, "").slice(0, 5))}
                                keyboardType="numeric"
                                testID="create-group-late-repay-flat"
                              />
                            </View>
                            <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 6 }]}>
                              Members will be charged a fixed K{lateRepayFlatAmount} per violation
                            </Text>
                          </>
                        ) : (
                          <>
                            <FL text={`Penalty rate: ${lateRepaymentPenaltyRate}% per day`} colors={colors} />
                            <Slider
                              minimumValue={0.5}
                              maximumValue={30}
                              step={0.5}
                              value={parseFloat(lateRepaymentPenaltyRate) || 1}
                              onValueChange={(v) => setLateRepaymentPenaltyRate(v.toFixed(1))}
                              minimumTrackTintColor={colors.primary}
                              maximumTrackTintColor={colors.border}
                              thumbTintColor={colors.primary}
                              style={{ marginVertical: 8 }}
                            />
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <Text style={{ color: colors.textMuted, fontSize: 11 }}>0.5%</Text>
                              <Text style={{ color: colors.textMuted, fontSize: 11 }}>30% max</Text>
                            </View>
                            {toNum(contribAmount) > 0 && (
                              <Text style={[styles.fieldHint, { color: colors.textMuted, marginTop: 6 }]}>
                                e.g. {formatZMW(toNum(contribAmount) * (parseInt(loanMultiplier) || 2))} × {lateRepaymentPenaltyRate}% × 7 days = {formatZMW(toNum(contribAmount) * (parseInt(loanMultiplier) || 2) * (toNum(lateRepaymentPenaltyRate) / 100) * 7)}
                              </Text>
                            )}
                          </>
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
                <View style={[styles.infoNote, { backgroundColor: colors.primarySoft, marginBottom: 20 }]}>
                  <Text style={{ color: colors.primary, fontSize: 13, lineHeight: 20 }}>
                    You will be automatically assigned as Chairperson as the group founder.
                  </Text>
                </View>

                <FL text="Treasurer (optional)" colors={colors} />
                <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: errors.treasurerPhone ? colors.danger : colors.border }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: "600" }}>+260</Text>
                  <TextInput
                    style={[styles.inlineInput, { color: colors.textMain, flex: 1 }]}
                    value={treasurerPhone}
                    onChangeText={(t) => { handlePhoneInput(t, setTreasurerPhone); clearErr("treasurerPhone"); }}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={9}
                    testID="create-group-treasurer"
                  />
                </View>
                {errors.treasurerPhone ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.treasurerPhone}</Text> : null}

                <FL text="Secretary (optional)" colors={colors} style={{ marginTop: 20 }} />
                <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: errors.secretaryPhone ? colors.danger : colors.border }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: "600" }}>+260</Text>
                  <TextInput
                    style={[styles.inlineInput, { color: colors.textMain, flex: 1 }]}
                    value={secretaryPhone}
                    onChangeText={(t) => { handlePhoneInput(t, setSecretaryPhone); clearErr("secretaryPhone"); }}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={9}
                    testID="create-group-secretary"
                  />
                </View>
                {errors.secretaryPhone ? <Text style={[styles.errText, { color: colors.danger }]}>{errors.secretaryPhone}</Text> : null}

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

            {/* ─── STEP 5 — Review & Confirm ──────────────────────────────────── */}
            {step === 5 && (
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
                  <RRow label="Late penalty" value={lateContribEnabled ? lateContribPenaltyType === "flat" ? `K${lateContribFlatAmount} flat fee` : `${lateContributionPenaltyRate}% per day (max 30%)` : "None"} colors={colors} last />
                </RC>

                <RC title="Loans" onEdit={() => goToStep(3)} colors={colors} style={{ marginTop: 14 }}>
                  <RRow label="Internal lending" value={internalLending ? "Enabled" : "Disabled"} colors={colors} last={!internalLending} />
                  {internalLending && (
                    <>
                      <RRow label="Multiplier" value={`${loanMultiplier}× savings`} colors={colors} />
                      <RRow label="Interest" value={`${loanInterest}% / month`} colors={colors} />
                      <RRow label="Repayment" value={loanRepayment} colors={colors} />
                      <RRow label="Grace period" value={`${gracePeriod} days`} colors={colors} />
                      <RRow label="Late penalty" value={lateRepayEnabled ? lateRepayPenaltyType === "flat" ? `K${lateRepayFlatAmount} flat fee` : `${lateRepaymentPenaltyRate}% per day (max 30%)` : "None"} colors={colors} last />
                    </>
                  )}
                </RC>

                <RC title="Governance" onEdit={() => goToStep(4)} colors={colors} style={{ marginTop: 14 }}>
                  <RRow label="Chairperson" value="You (group founder)" colors={colors} />
                  <RRow label="Treasurer" value={treasurerPhone ? `+260 ${treasurerPhone}` : "Not assigned"} colors={colors} />
                  <RRow label="Secretary" value={secretaryPhone ? `+260 ${secretaryPhone}` : "Not assigned"} colors={colors} />
                  <RRow label="Threshold" value={thresholdLabel} colors={colors} />
                  <RRow label="Permissions" value={`${activePermCount} active`} colors={colors} last />
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
                  label="Continue to payment"
                  disabled={!termsAccepted}
                  onPress={() => goToStep(6)}
                  testID="create-group-step5-continue"
                />
              </>
            )}

            {/* ─── STEP 6 — Payment ───────────────────────────────────────── */}
            {step === 6 && (
              <>
                {/* Fee summary */}
                <Card padding={18} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <CreditCard size={18} color={colors.primary} />
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 }}>
                      REGISTRATION FEE
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600" }}>Group registration</Text>
                    <Text style={{ color: colors.textMain, fontSize: 22, fontWeight: "700" }}>K100.00</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>
                    One-time fee charged to you as Chairperson
                  </Text>
                </Card>

                {/* Coverage info */}
                <Card padding={16} style={{ marginBottom: 20 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 }}>
                    WHAT THIS COVERS
                  </Text>
                  {[
                    "Group wallet setup and verification",
                    "Member onboarding for up to 50 members",
                    "SMS invite delivery for all pending invites",
                    "Chuma platform access for 12 months",
                  ].map((item, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: i < 3 ? 10 : 0, gap: 10 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1, backgroundColor: colors.primarySoft }}>
                        <Check size={12} color={colors.primary} strokeWidth={3} />
                      </View>
                      <Text style={{ color: colors.textMain, fontSize: 13, flex: 1, lineHeight: 20 }}>{item}</Text>
                    </View>
                  ))}
                </Card>

                {/* Payment method */}
                <FL text="Payment method" colors={colors} />
                <View style={styles.chipsRow}>
                  {PAYMENT_METHODS.map((m) => {
                    const active = payMethod === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setPayMethod(m)}
                        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                        testID={`pay-method-${m.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>{m}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 14, lineHeight: 18, marginBottom: 24 }}>
                  You will receive a payment prompt on your phone. Confirm the K100.00 payment to activate the group.
                </Text>

                <Button
                  label={paying ? "Processing…" : "Pay K100 & Create Group"}
                  disabled={paying}
                  onPress={handlePayAndCreate}
                  testID="create-group-pay-btn"
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
