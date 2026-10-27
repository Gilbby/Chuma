import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { ErrorState } from "@/src/components/common/ErrorState";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { getGroupById } from "@/src/services/groups";
import {
  DESTINATION_LABELS,
  declareDelivery,
  findPile,
  getGroupFunds,
  handlesCash,
} from "@/src/services/funds";
import { DeliveryDestination, Group, GroupFunds } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { Check, Info } from "lucide-react-native";
import { useAsyncEffect } from "@/src/hooks/useAsyncEffect";

const DESTINATIONS: DeliveryDestination[] = ["bank", "mobile-money", "project"];

/** The route param for the General giving pile, which has no project id. */
const GENERAL = "general";
/** The route param for paying out everything in hand at once. */
const ALL = "all";

// The cash handler says where cash they were holding went: deposited to the
// church bank account, deposited to the church mobile money, or paid out for a
// project. Opened from a pile's row on Approvals > Payouts, so the pile is
// fixed and the amount can never be more than that pile's cash on hand - or
// from "Payout all", which pays out every pile in full at once. Bank and mobile
// money are final - the app records no spending out of either - so this is the
// only place money is ever paid out.
export default function DeclareDelivery() {
  const { colors } = useTheme();
  const router = useRouter();
  const { groupId, source } = useLocalSearchParams<{ groupId?: string; source?: string }>();
  const allMode = source === ALL;
  const sourceProjectId = !source || source === GENERAL || allMode ? null : source;

  const [group, setGroup] = useState<Group | null>(null);
  const [funds, setFunds] = useState<GroupFunds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [destination, setDestination] = useState<DeliveryDestination | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [payee, setPayee] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Set once the API has accepted the declaration: what was declared, and the
  // pile as it stands afterwards.
  const [done, setDone] = useState<{ amount: number; left: number } | null>(null);

  // The payee and reference fields sit at the bottom of the form, right where
  // the keyboard opens. Once the keyboard has pushed the form up, scroll so the
  // field being typed into sits just above it.
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const revealBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError(false);
    try {
      const [g, f] = await Promise.all([getGroupById(groupId), getGroupFunds(groupId)]);
      setGroup(g ?? null);
      setFunds(f);
      // Start on "all of it": cash is usually banked or spent in one go.
      const pile = findPile(f, sourceProjectId);
      if (!allMode && pile && pile.cashOnHand > 0) setAmount(String(pile.cashOnHand));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [groupId, sourceProjectId, allMode]);

  useAsyncEffect(load);

  // "All" takes every pile still holding cash, each in full.
  const heldPiles = (funds?.piles ?? []).filter((p) => p.cashOnHand > 0);
  const pile = allMode ? null : findPile(funds, sourceProjectId);
  const held = allMode ? funds?.cashOnHand ?? 0 : pile?.cashOnHand ?? 0;
  const fromGeneral = !allMode && sourceProjectId === null;

  // A project's own cash can only be paid out for that project. General giving
  // was given toward nothing in particular, so it can pay for any open project.
  // Paying out all of it at once goes to the bank or mobile money only: money
  // is spent on a project from that project's own row.
  const payableProjects = (group?.projects ?? []).filter((p) => p.status !== "archived");
  const destinations = allMode ? DESTINATIONS.filter((d) => d !== "project") : DESTINATIONS;
  const target = fromGeneral
    ? payableProjects.find((p) => p.id === targetProjectId) ?? null
    : payableProjects.find((p) => p.id === sourceProjectId) ?? null;
  const pileName = allMode ? "all" : pile?.name ?? "this";

  const num = allMode ? held : parseFloat(amount.replace(/,/g, "")) || 0;
  const isProject = destination === "project";
  const errors = {
    destination: !destination ? "Choose a payout method" : "",
    amount:
      num <= 0
        ? "Enter the amount"
        : num > held
          ? `You are holding ${formatZMW(held)} of ${pileName} cash`
          : "",
    payee: isProject && payee.trim().length < 2 ? "Say who was paid" : "",
    // The reference is optional: the payout is on the group statement either
    // way, saying where the money went.
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (submitAttempted ? errors[k] : "");

  const onAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    if (parts[1] !== undefined && parts[1].length > 2) return;
    setAmount(cleaned);
  };

  const onSubmit = async () => {
    setSubmitAttempted(true);
    if (invalid || !groupId || !destination) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await declareDelivery(groupId, {
        sourceProjectId,
        ...(allMode ? { all: true } : {}),
        destination,
        targetProjectId: isProject ? target?.id ?? null : undefined,
        amount: num,
        reference: reference.trim() || undefined,
        payee: isProject ? payee.trim() : undefined,
      });
      setFunds(res.funds);
      setDone({
        amount: res.amount || num,
        left: allMode
          ? res.funds.cashOnHand
          : findPile(res.funds, sourceProjectId)?.cashOnHand ?? 0,
      });
    } catch (e: any) {
      setSubmitError(e?.message || "Could not record the payout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (body: React.ReactNode, title = allMode ? "Payout all" : "Declare payout") => (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="declare-delivery-screen"
    >
      <ScreenHeader title={title} />
      {body}
    </SafeAreaView>
  );

  if (loading) {
    return shell(
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error || !group) return shell(<ErrorState onRetry={load} />);

  if (!handlesCash(group)) {
    return shell(
      <View style={styles.content}>
        <Card padding={20}>
          <Text style={{ color: colors.textMain, fontWeight: "700" }}>
            The treasurer declares this
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6 }}>
            Whoever holds {group.name}&apos;s cash says where it went: the treasurer, or the
            chairperson when the group has no treasurer.
          </Text>
        </Card>
      </View>
    );
  }

  if (done) {
    const where = isProject
      ? target
        ? `paid out for ${target.name}`
        : "paid out"
      : destination === "bank"
        ? "deposited to the church bank account"
        : "deposited to the church mobile money";
    return shell(
      <View style={[styles.content, { flex: 1, alignItems: "center", paddingTop: 48 }]}>
        <View style={[styles.doneCircle, { backgroundColor: colors.primary }]}>
          <Check size={48} color="#fff" strokeWidth={3} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.textMain }]}>Payout recorded</Text>
        <Text style={[styles.doneSub, { color: colors.textMuted }]}>
          {allMode
            ? `All ${formatZMW(done.amount)} of the cash you were holding ${where}.`
            : `${formatZMW(done.amount)} of ${pile?.name ?? "the"} cash ${where}.`}
        </Text>
        <Card padding={16} style={{ width: "100%", marginTop: 28 }}>
          <View style={styles.rowBetween}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {allMode ? "Cash" : pile?.name} still to pay out
            </Text>
            <Text style={{ color: colors.textMain, fontWeight: "800", fontSize: 15 }}>
              {formatZMW(done.left)}
            </Text>
          </View>
        </Card>
        <View style={{ flex: 1 }} />
        <View style={{ width: "100%" }}>
          <Button label="Done" onPress={() => router.back()} testID="declare-delivery-done-btn" />
        </View>
      </View>,
      "Payout recorded"
    );
  }

  if ((!allMode && !pile) || held <= 0) {
    return shell(
      <View style={styles.content}>
        <Card padding={20}>
          <Text style={{ color: colors.textMain, fontWeight: "700" }}>Nothing left to pay out</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6 }}>
            All the {allMode ? "cash" : pile?.name ?? "cash"} you confirmed has already been
            banked or paid out.
          </Text>
        </Card>
      </View>
    );
  }

  return shell(
    // "padding" on Android too: with edge-to-edge (Expo SDK 58) the window no
    // longer resizes for the keyboard, so the form has to make room itself.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Card padding={18}>
          <Text style={[styles.label, { color: colors.textMuted, marginBottom: 4 }]}>
            {allMode ? "ALL" : (pile?.name ?? "").toUpperCase()} CASH YOU&apos;RE HOLDING
          </Text>
          <Text style={{ color: colors.textMain, fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }}>
            {formatZMW(held)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{group.name}</Text>
          {allMode &&
            heldPiles.map((p) => (
              <View key={p.projectId ?? GENERAL} style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{p.name}</Text>
                <Text style={{ color: colors.textMain, fontSize: 13, fontWeight: "600" }}>
                  {formatZMW(p.cashOnHand)}
                </Text>
              </View>
            ))}
        </Card>

        <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>
          Payout method
        </Text>
        <View style={[styles.note, { backgroundColor: colors.surfaceSecondary }]}>
          <Info size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>
            The app does not track money once it is in the account
          </Text>
        </View>
        <Card padding={4} testID="delivery-destination">
          {destinations.map((d) => (
            <RadioRow
              key={d}
              label={
                d === "project" && fromGeneral
                  ? "Paid out"
                  : d === "project" && target
                    ? `Paid out for ${target.name}`
                    : DESTINATION_LABELS[d]
              }
              sub={
                d === "project"
                  ? fromGeneral
                    ? "Materials, a contractor, a bill"
                    : "Spent on the project: materials, a contractor, a bill"
                  : undefined
              }
              active={destination === d}
              onPress={() => setDestination(d)}
              colors={colors}
              testID={`delivery-destination-${d}`}
            />
          ))}
        </Card>
        {show("destination") ? (
          <Text style={[styles.errText, { color: colors.danger }]}>{show("destination")}</Text>
        ) : null}

        {/* General giving can pay for any project - or for none, so picking
            one is optional, and tapping the chosen project again clears it. A
            project's own cash only pays for itself, so there is nothing to
            pick. */}
        {isProject && fromGeneral && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: 22 }]}>
              Paid for (optional)
            </Text>
            {payableProjects.length > 0 && (
              <Card padding={4} testID="delivery-target">
                {payableProjects.map((p) => (
                  <RadioRow
                    key={p.id}
                    label={p.name}
                    sub={`${formatZMW(p.collected)} raised`}
                    active={targetProjectId === p.id}
                    onPress={() => setTargetProjectId((cur) => (cur === p.id ? null : p.id))}
                    colors={colors}
                    testID={`delivery-target-${p.id}`}
                  />
                ))}
              </Card>
            )}
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {target
                ? "Counts as spent on the project. It was not given toward it, so it does not add to what the project has raised."
                : "Leave this empty if it was not for a project."}
            </Text>
          </>
        )}

        <Text style={[styles.label, { color: colors.textMuted, marginTop: 22 }]}>Amount</Text>
        {allMode ? (
          <View
            style={[styles.amountWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            testID="delivery-amount-all-fixed"
          >
            <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
            <Text style={[styles.amountInput, { color: colors.textMain }]}>
              {formatZMW(held).replace(/^K\s?/, "")}
            </Text>
          </View>
        ) : (
        <View
          style={[
            styles.amountWrap,
            {
              backgroundColor: colors.surface,
              borderColor: show("amount") ? colors.danger : colors.border,
            },
          ]}
        >
          <Text style={[styles.currency, { color: colors.primary }]}>K</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.textMain }]}
            value={amount}
            onChangeText={onAmountChange}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            editable={!submitting}
            testID="delivery-amount-input"
          />
          {num !== held && (
            <Pressable
              onPress={() => setAmount(String(held))}
              hitSlop={8}
              style={[styles.allChip, { backgroundColor: colors.primarySoft }]}
              testID="delivery-amount-all"
            >
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>All</Text>
            </Pressable>
          )}
        </View>
        )}
        <Text style={[styles.errText, { color: show("amount") ? colors.danger : colors.textMuted, fontWeight: show("amount") ? "500" : "400" }]}>
          {allMode
            ? "Everything you are holding. To pay out part of it, use a project's own Payout."
            : show("amount") ||
              (num > 0 && num < held
                ? `${formatZMW(held - num)} stays with you to pay out later`
                : `Up to ${formatZMW(held)}`)}
        </Text>

        {isProject && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: 22 }]}>Paid to</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.textMain,
                  backgroundColor: colors.surface,
                  borderColor: show("payee") ? colors.danger : colors.border,
                },
              ]}
              value={payee}
              onChangeText={(t) => setPayee(t.slice(0, 80))}
              onFocus={revealBottom}
              placeholder="e.g. Zambezi Hardware, cement"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
              testID="delivery-payee-input"
            />
            {show("payee") ? (
              <Text style={[styles.errText, { color: colors.danger }]}>{show("payee")}</Text>
            ) : null}
          </>
        )}

        {destination && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: 22 }]}>
              {isProject ? "Receipt number (optional)" : "Reference (optional)"}
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
              value={reference}
              onChangeText={(t) => setReference(t.slice(0, 60))}
              onFocus={revealBottom}
              placeholder={
                isProject
                  ? "Receipt or invoice number"
                  : destination === "bank"
                    ? "Deposit slip number"
                    : "Mobile money transaction ID"
              }
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              editable={!submitting}
              testID="delivery-reference-input"
            />
          </>
        )}

        {submitError ? (
          <Text style={[styles.errText, { color: colors.danger, marginTop: 16 }]}>{submitError}</Text>
        ) : null}

        <View style={{ flex: 1, minHeight: 24 }} />
        <Button
          label="Confirm payout"
          loading={submitting}
          disabled={submitting}
          onPress={onSubmit}
          testID="delivery-confirm-btn"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const RadioRow = ({
  label,
  sub,
  active,
  onPress,
  colors,
  testID,
}: {
  label: string;
  sub?: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  testID?: string;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityState={{ selected: active }}
    testID={testID}
    style={({ pressed }) => [
      styles.radioRow,
      { backgroundColor: active ? colors.primarySoft : "transparent", opacity: pressed ? 0.85 : 1 },
    ]}
  >
    <View
      style={[
        styles.radio,
        {
          borderColor: active ? colors.primary : colors.borderStrong,
          backgroundColor: active ? colors.primary : "transparent",
        },
      ]}
    >
      {active && <View style={styles.radioDot} />}
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>{label}</Text>
      {sub ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 20 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  errText: { fontSize: 12, marginTop: 8, fontWeight: "500" },
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
  amountInput: { flex: 1, fontSize: 34, fontWeight: "700", letterSpacing: -1, padding: 0 },
  allChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  radioRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginVertical: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  doneCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  doneTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  doneSub: { fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 20, lineHeight: 20 },
});
