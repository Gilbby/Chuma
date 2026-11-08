// Chuma Plan - pick how many groups your Google Play subscription covers.
//
// Google Play policy: on Android this is the ONLY way to pay for groups, and
// the screen must not mention any other way or price. Prices come from Play
// (already localised), never from our own constants.

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Lock, Clock } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { useAsyncEffect } from "@/src/hooks/useAsyncEffect";
import {
  PLAY_BILLING_AVAILABLE,
  getPlanSummary,
  getPlanOptions,
  syncPlan,
  buyPlan,
  restorePlan,
  getManageUrl,
  approxKwacha,
  preferGroup,
  type PlanSummary,
  type PlanOption,
} from "@/src/services/billing";
import { getUsdToZmw, type FxRate } from "@/src/services/fxRate";

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function tierLabel(n: number): string {
  return n === 1 ? "1 group" : `Up to ${n} groups`;
}

/**
 * RevenueCat usually knows about a purchase within a second or two, but the
 * API asks RevenueCat directly, so give it a few tries before saying it failed.
 */
async function syncUntil(check: (s: PlanSummary) => boolean): Promise<PlanSummary> {
  let last: PlanSummary | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      last = await syncPlan();
      if (check(last)) return last;
    } catch {
      // Not confirmed yet - try again.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (last) return last;
  throw new Error("We couldn't confirm your plan yet. Pull down on Groups in a minute, or tap Restore purchases.");
}

export default function PlanScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [options, setOptions] = useState<PlanOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"buy" | "restore" | "move" | null>(null);
  // Today's USD->ZMW rate for the kwacha estimate. Loaded alongside the plans
  // and never blocks them: no rate just means no "about K…" line.
  const [fx, setFx] = useState<FxRate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    getUsdToZmw().then(setFx).catch(() => setFx(null));
    try {
      const s = await getPlanSummary();
      setSummary(s);
      if (s.enabled && PLAY_BILLING_AVAILABLE) {
        const opts = await getPlanOptions(s.tiers);
        setOptions(opts);
        // Preselect: the current plan if it already fits, else the smallest
        // tier that covers every group they run.
        const fits = opts.find((o) => o.groupLimit >= Math.max(1, s.groupsFounded));
        const current = opts.find((o) => o.basePlanId === s.plan.basePlanId && s.plan.active);
        setSelected(
          (current && current.groupLimit >= s.groupsFounded ? current : fits ?? opts[opts.length - 1])
            ?.basePlanId ?? null
        );
      }
    } catch (e: any) {
      setLoadError(e?.message || "Couldn't load plans. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useAsyncEffect(load);

  // Came here from a group waiting on a plan: once it's covered, go open it.
  const finishIfGroupOpen = (s: PlanSummary): boolean => {
    if (!groupId) return false;
    const g = s.groups.find((x) => x.id === groupId);
    if (g && g.status === "active" && g.coveredByPlan) {
      Alert.alert("Group opened", `${g.name} is ready to use.`, [
        { text: "Open group", onPress: () => router.replace(`/group/${groupId}`) },
      ]);
      return true;
    }
    return false;
  };

  const option = options.find((o) => o.basePlanId === selected) ?? null;
  // Live rate first; the API's optional fixed rate (BILLING_USD_ZMW_RATE) only
  // if the live lookup failed.
  const rate = fx?.rate ?? summary?.usdToZmwRate ?? null;
  const plan = summary?.plan;
  const isCurrent = !!(option && plan?.active && plan.basePlanId === option.basePlanId);
  const isUpgrade = !!(option && plan?.active && option.groupLimit > plan.groupLimit);
  const isDowngrade = !!(option && plan?.active && option.groupLimit < plan.groupLimit);

  // Opened from a specific group that the plan doesn't cover (yet).
  const target = groupId ? summary?.groups.find((g) => g.id === groupId) ?? null : null;
  const targetUncovered = !!(target && !target.coveredByPlan);
  const coveredGroups = summary?.groups.filter((g) => g.coveredByPlan) ?? [];
  // The groups list comes back in cover order, so the last covered one is the
  // one that would give up its place.
  const bumped = coveredGroups.length ? coveredGroups[coveredGroups.length - 1] : null;

  /**
   * The plan was bought or restored from this group's screen: that's the group
   * they meant it for, so make sure it's the one covered.
   */
  const coverTarget = async (s: PlanSummary): Promise<PlanSummary> => {
    if (!groupId || !s.plan.active) return s;
    const g = s.groups.find((x) => x.id === groupId);
    if (!g || g.coveredByPlan) return s;
    const next = await preferGroup(groupId);
    setSummary(next);
    return next;
  };

  const onBuy = async () => {
    if (!option || !summary || busy) return;
    setBusy("buy");
    try {
      const outcome = await buyPlan(option, {
        basePlanId: summary.plan.active ? summary.plan.basePlanId : null,
        groupLimit: summary.plan.active ? summary.plan.groupLimit : 0,
      });
      if (outcome === "cancelled") return;
      // A downgrade only takes effect at renewal, so don't wait for it to show.
      let s = await syncUntil((x) =>
        isDowngrade ? true : x.plan.active && x.plan.groupLimit >= option.groupLimit
      );
      setSummary(s);
      if (!isDowngrade) s = await coverTarget(s);
      if (!finishIfGroupOpen(s)) {
        Alert.alert(
          isDowngrade ? "Plan change scheduled" : "Plan updated",
          isDowngrade
            ? `You'll move to ${tierLabel(option.groupLimit).toLowerCase()} at your next renewal.`
            : `Your plan now covers ${tierLabel(option.groupLimit).toLowerCase()}.`
        );
      }
    } catch (e: any) {
      Alert.alert("Purchase not completed", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy("restore");
    try {
      await restorePlan();
      let s = await syncPlan();
      setSummary(s);
      s = await coverTarget(s);
      if (!finishIfGroupOpen(s)) {
        Alert.alert(
          s.plan.active ? "Plan restored" : "No plan found",
          s.plan.active
            ? `Your plan covers ${tierLabel(s.plan.groupLimit).toLowerCase()}.`
            : "There's no Chuma Plan on the Google account signed in to Play on this phone."
        );
      }
    } catch (e: any) {
      Alert.alert("Couldn't restore", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onMove = () => {
    if (!target || busy) return;
    const doMove = async () => {
      setBusy("move");
      try {
        const s = await preferGroup(target.id);
        setSummary(s);
        if (!finishIfGroupOpen(s)) Alert.alert("Plan moved", `${target.name} is now covered.`);
      } catch (e: any) {
        Alert.alert("Couldn't move your plan", e?.message || "Please try again.");
      } finally {
        setBusy(null);
      }
    };
    if (!bumped) return void doMove();
    Alert.alert(
      `Move your plan to ${target.name}?`,
      `${bumped.name} will no longer be covered. It stays open for a few days, then locks until you upgrade or move your plan back.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Move plan", style: "destructive", onPress: doMove },
      ]
    );
  };

  const onManage = async () => {
    Linking.openURL(await getManageUrl());
  };

  // ─── States ────────────────────────────────────────────────────────────────

  const shell = (body: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="plan-screen">
      <ScreenHeader title="Chuma Plan" />
      {body}
    </SafeAreaView>
  );

  const message = (title: string, text: string, retry?: boolean) =>
    shell(
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ color: colors.textMain, fontSize: 17, fontWeight: "700", textAlign: "center" }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 }}>
          {text}
        </Text>
        <View style={{ marginTop: 24, width: "100%" }}>
          {retry ? (
            <Button label="Try again" onPress={load} testID="plan-retry-btn" />
          ) : (
            <Button label="Go back" variant="ghost" onPress={() => router.back()} testID="plan-back-btn" />
          )}
        </View>
      </View>
    );

  if (loading)
    return shell(
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  if (loadError) return message("Couldn't load plans", loadError, true);
  if (!summary?.enabled)
    return message("No plan needed", "Your groups are free to use right now.");
  if (!PLAY_BILLING_AVAILABLE)
    return message("Not available here", "Your Chuma Plan can't be changed on this device.");
  if (!options.length)
    return message("Plans unavailable", "Plans couldn't be loaded from Google Play. Try again in a moment.", true);

  // ─── Main ──────────────────────────────────────────────────────────────────

  const buyLabel = !option
    ? "Choose a plan"
    : isCurrent
      ? "Your current plan"
      : isUpgrade
        ? `Upgrade to ${tierLabel(option.groupLimit).toLowerCase()}`
        : isDowngrade
          ? "Switch at next renewal"
          : `Subscribe · ${option.priceString}/month`;

  return shell(
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      {/* Came from a group the plan doesn't cover: say why, offer both fixes. */}
      {targetUncovered && target && (
        <Card padding={16} style={{ marginBottom: 16, borderColor: colors.warning, borderWidth: 1 }}>
          <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "700" }}>
            {target.name} isn&apos;t covered yet
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {plan?.active
              ? `Your plan covers ${tierLabel(plan.groupLimit).toLowerCase()}${
                  coveredGroups.length ? `, used by ${coveredGroups.map((g) => g.name).join(", ")}` : ""
                }. Upgrade to cover ${target.name} too, or move your plan to it.`
              : `Choose a plan below. It will cover ${target.name} first.`}
          </Text>
          {plan?.active && (
            <View style={{ marginTop: 12 }}>
              <Button
                label={`Move my plan to ${target.name}`}
                variant="outline"
                size="md"
                onPress={onMove}
                loading={busy === "move"}
                disabled={busy !== null}
                testID="plan-move-btn"
              />
            </View>
          )}
        </Card>
      )}

      {/* Where they stand */}
      <Card padding={18}>
        <Text style={[styles.overline, { color: colors.textMuted }]}>YOUR PLAN</Text>
        <Text style={[styles.planName, { color: colors.textMain }]}>
          {plan?.active ? tierLabel(plan.groupLimit) : "No plan yet"}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
          {plan?.active
            ? plan.willRenew
              ? `Renews ${shortDate(plan.expiresAt)}`
              : `Ends ${shortDate(plan.expiresAt)}. It won't renew.`
            : "A plan keeps the groups you founded open."}
        </Text>

        {summary.groups.length > 0 && (
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
            {summary.groups.map((g) => {
              const free = !g.coveredByPlan && g.freeUntil && new Date(g.freeUntil) > new Date();
              const tone = g.coveredByPlan ? colors.primary : free ? colors.warning : colors.danger;
              const Icon = g.coveredByPlan ? Check : free ? Clock : Lock;
              return (
                <View key={g.id} style={styles.groupRow} testID={`plan-group-${g.id}`}>
                  <Text style={{ color: colors.textBody, fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Icon size={14} color={tone} />
                  <Text style={{ color: tone, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
                    {g.coveredByPlan ? "Covered" : free ? `Free until ${shortDate(g.freeUntil)}` : "Needs a plan"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Tiers */}
      <Text style={[styles.overline, { color: colors.textMuted, marginTop: 24, marginBottom: 10 }]}>
        CHOOSE HOW MANY GROUPS
      </Text>
      {options.map((o) => {
        const on = o.basePlanId === selected;
        const current = plan?.active && plan.basePlanId === o.basePlanId;
        const tooSmall = o.groupLimit < summary.groupsFounded;
        return (
          <Pressable
            key={o.basePlanId}
            onPress={() => setSelected(o.basePlanId)}
            testID={`plan-option-${o.basePlanId}`}
            style={[
              styles.option,
              {
                backgroundColor: colors.surface,
                borderColor: on ? colors.primary : colors.border,
                borderWidth: on ? 2 : 1,
              },
            ]}
          >
            <View style={[styles.radio, { borderColor: on ? colors.primary : colors.borderStrong }]}>
              {on && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMain, fontSize: 16, fontWeight: "700" }}>{tierLabel(o.groupLimit)}</Text>
              {(current || tooSmall) && (
                <Text style={{ color: current ? colors.primary : colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {current ? "Current plan" : `You run ${summary.groupsFounded}, so your newest groups would lock`}
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: colors.textMain, fontSize: 16, fontWeight: "800" }}>
                {o.priceString}
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "400" }}>/mo</Text>
              </Text>
              {approxKwacha(o, rate) && (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {approxKwacha(o, rate)}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}

      <View style={{ marginTop: 16 }}>
        <Button
          label={buyLabel}
          onPress={onBuy}
          disabled={!option || isCurrent || busy !== null}
          loading={busy === "buy"}
          testID="plan-buy-btn"
        />
      </View>

      <Text style={[styles.fine, { color: colors.textMuted }]}>
        Billed monthly through Google Play
        {options.some((o) => approxKwacha(o, rate))
          ? ", in US dollars. Kwacha amounts are estimates. Your bank's rate may differ"
          : ""}
        . Cancel anytime in Google Play. Your plan covers the groups you
        founded, starting with any you moved it to, then oldest first. Upgrades start now, and unused time on your current plan counts toward the new
        one. Switching to a smaller plan starts at your next renewal.
      </Text>

      {fx && options.some((o) => approxKwacha(o, rate)) && (
        <Text style={[styles.fine, { color: colors.textMuted, marginTop: 6 }]}>
          1 USD ≈ K{fx.rate.toFixed(2)} · rate by ExchangeRate-API, updated {shortDate(fx.updatedAt)}
        </Text>
      )}

      <View style={styles.links}>
        <Pressable onPress={onRestore} disabled={busy !== null} testID="plan-restore-btn" style={styles.link}>
          {busy === "restore" ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Restore purchases</Text>
          )}
        </Pressable>
        {plan?.active && (
          <Pressable onPress={onManage} testID="plan-manage-btn" style={styles.link}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Manage in Google Play</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  overline: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  planName: { fontSize: 24, fontWeight: "800", marginTop: 6, letterSpacing: -0.3 },
  groupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  fine: { fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: "center", paddingHorizontal: 4 },
  links: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 20, flexWrap: "wrap" },
  link: { paddingVertical: 10, minHeight: 44, justifyContent: "center" },
});
