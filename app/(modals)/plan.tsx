// Chuma Plan - the one Google Play subscription. Subscribed founders can create
// and run as many groups as they like; there's nothing to choose between.
//
// Google Play policy: on Android this is the ONLY way to pay for groups, and
// the screen must not mention any other way or price. The price comes from
// Play (already localised), never from our own constants.

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
import { Check, Lock, Clock, BadgeCheck } from "lucide-react-native";
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
  kwachaPrice,
  UNLIMITED_GROUPS,
  type PlanSummary,
  type PlanOption,
} from "@/src/services/billing";
import { getUsdToZmw, type FxRate } from "@/src/services/fxRate";

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function groupsLine(n: number): string {
  if (n >= UNLIMITED_GROUPS) return "Create and run unlimited groups";
  return n === 1 ? "Run 1 group" : `Run up to ${n} groups`;
}

/**
 * RevenueCat usually knows about a purchase within a second or two, but the
 * API asks RevenueCat directly, so give it a few tries before giving up.
 */
async function syncUntilActive(): Promise<PlanSummary> {
  let last: PlanSummary | null = null;
  for (let i = 0; i < 5; i++) {
    try {
      last = await syncPlan();
      if (last.plan.active) return last;
    } catch {
      // Not confirmed yet - try again.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (last) return last;
  throw new Error(
    "We couldn't confirm your subscription yet. Open this screen again in a minute, or tap Restore purchases."
  );
}

export default function PlanScreen() {
  // groupId: opened from a group that's waiting for a subscription.
  // next=create-group: opened from the Groups "+" - subscribe, then go on to
  // create the group.
  const { groupId, next } = useLocalSearchParams<{ groupId?: string; next?: string }>();
  const forNewGroup = next === "create-group";
  const { colors } = useTheme();
  const router = useRouter();

  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [offer, setOffer] = useState<PlanOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  // Today's USD->ZMW rate for the kwacha estimate. Never blocks the screen:
  // no rate just means no "about K…" line.
  const [fx, setFx] = useState<FxRate | null>(null);

  // Came here from a group waiting for a subscription: once it's open, go to it.
  const finishIfGroupOpen = useCallback(
    (s: PlanSummary): boolean => {
      if (!groupId) return false;
      const g = s.groups.find((x) => x.id === groupId);
      if (g && g.status === "active" && g.coveredByPlan) {
        Alert.alert("Group opened", `${g.name} is ready to use.`, [
          { text: "Open group", onPress: () => router.replace(`/group/${groupId}`) },
        ]);
        return true;
      }
      return false;
    },
    [groupId, router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    getUsdToZmw().then(setFx).catch(() => setFx(null));
    try {
      // Re-check with RevenueCat on every open (not just our copy): a webhook
      // can arrive late, and this also re-applies cover to the groups.
      let s: PlanSummary;
      try {
        s = await syncPlan();
      } catch {
        s = await getPlanSummary();
      }
      setSummary(s);
      if (s.enabled && PLAY_BILLING_AVAILABLE) {
        // The server offers exactly one plan; take whatever it names.
        const opts = await getPlanOptions(s.tiers);
        setOffer(opts[0] ?? null);
      }
      finishIfGroupOpen(s);
    } catch (e: any) {
      setLoadError(e?.message || "Couldn't load your subscription. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [finishIfGroupOpen]);

  useAsyncEffect(load);

  const rate = fx?.rate ?? summary?.usdToZmwRate ?? null;
  const plan = summary?.plan;
  const active = !!plan?.active;
  const target = groupId ? summary?.groups.find((g) => g.id === groupId) ?? null : null;

  const onSubscribe = async () => {
    if (!offer || busy || active) return;
    setBusy("buy");
    try {
      const outcome = await buyPlan(offer, { basePlanId: null, groupLimit: 0 });
      if (outcome === "cancelled") return;
      const s = await syncUntilActive();
      setSummary(s);
      if (forNewGroup && s.plan.active) {
        Alert.alert("You're subscribed", "Your Chuma Plan is active. Let's set up your group.", [
          { text: "Create group", onPress: () => router.replace("/(modals)/create-group") },
        ]);
        return;
      }
      if (!finishIfGroupOpen(s)) {
        Alert.alert(
          s.plan.active ? "You're subscribed" : "Payment received",
          s.plan.active
            ? "Your Chuma Plan is active. You can create and run as many groups as you like."
            : "Google Play is still confirming your subscription. It will show here shortly."
        );
      }
    } catch (e: any) {
      Alert.alert("Subscription not completed", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy("restore");
    try {
      await restorePlan();
      const s = await syncPlan();
      setSummary(s);
      if (!finishIfGroupOpen(s)) {
        Alert.alert(
          s.plan.active ? "Subscription restored" : "No subscription found",
          s.plan.active
            ? "Your Chuma Plan is active on this account."
            : "There's no Chuma Plan subscription on the Google account signed in to Play on this phone."
        );
      }
    } catch (e: any) {
      Alert.alert("Couldn't restore", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
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
  if (loadError) return message("Couldn't load your subscription", loadError, true);
  if (!summary?.enabled) return message("No subscription needed", "Your groups are free to use right now.");
  if (!PLAY_BILLING_AVAILABLE)
    return message("Not available here", "The Chuma Plan can't be bought or changed on this device.");
  if (!offer && !active)
    return message(
      "Subscription unavailable",
      "The Chuma Plan couldn't be loaded from Google Play. Try again in a moment.",
      true
    );

  // ─── Main ──────────────────────────────────────────────────────────────────

  const groupLimit = offer?.groupLimit ?? plan?.groupLimit ?? UNLIMITED_GROUPS;
  // Headline price in kwacha at today's rate; Play's USD price (the real
  // charge) sits right under it. No rate -> show Play's price as before.
  const kwacha = offer ? kwachaPrice(offer, rate) : null;
  const headline = kwacha ?? offer?.priceString ?? "";
  const benefits = [groupsLine(groupLimit), "Members, contributions and records", "Reports and statements"];

  // Why they're here, in one line, when they came from somewhere specific.
  const reason = active
    ? null
    : target
      ? `Subscribe to open ${target.name}.`
      : forNewGroup
        ? "Subscribe to create your group."
        : null;

  return shell(
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      {active ? (
        // ── Subscribed ──
        <Card padding={20}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <BadgeCheck size={24} color={colors.primary} />
            <Text style={[styles.title, { color: colors.textMain }]}>Your Chuma Plan is active</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 6 }}>
            {plan?.willRenew
              ? `Renews ${shortDate(plan.expiresAt)}`
              : `Ends ${shortDate(plan?.expiresAt)}. It won't renew.`}
          </Text>
          <View style={{ marginTop: 14 }}>
            {benefits.map((b) => (
              <View key={b} style={styles.benefit}>
                <Check size={16} color={colors.primary} />
                <Text style={{ color: colors.textBody, fontSize: 14, marginLeft: 8, flex: 1 }}>{b}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        // ── Not subscribed ──
        <Card padding={20}>
          {reason && (
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", marginBottom: 10 }}>{reason}</Text>
          )}
          <Text style={[styles.overline, { color: colors.textMuted }]}>CHUMA PLAN</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 6 }}>
            <Text style={[styles.price, { color: colors.textMain }]}>{headline}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 4, marginBottom: 5 }}>/month</Text>
          </View>
          {kwacha && (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {offer?.priceString} charged by Google Play
            </Text>
          )}
          <View style={{ marginTop: 14 }}>
            {benefits.map((b) => (
              <View key={b} style={styles.benefit}>
                <Check size={16} color={colors.primary} />
                <Text style={{ color: colors.textBody, fontSize: 14, marginLeft: 8, flex: 1 }}>{b}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 18 }}>
            <Button
              label={`Subscribe · ${headline}/month`}
              onPress={onSubscribe}
              loading={busy === "buy"}
              disabled={busy !== null}
              testID="plan-subscribe-btn"
            />
          </View>
        </Card>
      )}

      {/* The groups this person founded and whether they're open. */}
      {summary.groups.length > 0 && (
        <Card padding={16} style={{ marginTop: 16 }}>
          <Text style={[styles.overline, { color: colors.textMuted, marginBottom: 4 }]}>YOUR GROUPS</Text>
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
                  {g.coveredByPlan ? "Open" : free ? `Free until ${shortDate(g.freeUntil)}` : "Needs subscription"}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      <Text style={[styles.fine, { color: colors.textMuted }]}>
        {kwacha
          ? "Billed monthly through Google Play, in US dollars. The kwacha amount is an estimate. Your bank's rate may differ."
          : "Billed monthly through Google Play."}{" "}
        Cancel anytime in Google Play.
      </Text>
      {fx && kwacha && (
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
        {active && (
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
  title: { fontSize: 18, fontWeight: "800", flex: 1 },
  price: { fontSize: 34, fontWeight: "800", letterSpacing: -0.5 },
  benefit: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  groupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  fine: { fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: "center", paddingHorizontal: 4 },
  links: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 20, flexWrap: "wrap" },
  link: { paddingVertical: 10, minHeight: 44, justifyContent: "center" },
});
