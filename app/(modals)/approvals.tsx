import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { SkeletonGroup } from "@/src/components/ui";
import { ErrorState } from "@/src/components/common";
import { useTheme } from "@/src/theme/ThemeContext";
import { getApprovals, voteOnApproval, runApproval } from "@/src/services/approvals";
import { getCurrentUser } from "@/src/utils/currentUser";
import { getGroups } from "@/src/services/groups";
import { getGroupFunds, handlesCash } from "@/src/services/funds";
import { Approval, CashDelivery, Group, GroupFunds } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { formatDate } from "@/src/utils/date";
import { useRole } from "@/src/contexts/RoleContext";
import { Banknote, Wallet, Scale, ShieldCheck, Check, X, Info, Sparkles, UserMinus, Trash2, HandCoins, Coins, Landmark, Smartphone, Hammer, ChevronRight, ChevronDown, ChevronLeft } from "lucide-react-native";
import { useAsyncEffect } from "@/src/hooks/useAsyncEffect";

const TYPE_ICONS: Record<Approval["type"], typeof Banknote> = {
  loan: Banknote,
  withdrawal: Wallet,
  "rule-change": Scale,
  "admin-action": ShieldCheck,
  "member-removal": UserMinus,
  "group-deletion": Trash2,
  "share-out": Sparkles,
  "chilimba-payout": Coins,
  "cash-receipt": HandCoins,
};

// How each status reads once the vote is over: "approved" means decided but
// not yet carried out, "executed" means the action actually ran.
const STATUS_LABEL: Record<Approval["status"], string> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  executed: "completed",
};

const STATUS_VARIANT: Record<
  Approval["status"],
  "success" | "danger" | "warning" | "info"
> = {
  pending: "warning",
  approved: "info",
  rejected: "danger",
  executed: "success",
};

type Filter = "pending" | "deliveries" | "history";

/** A church group whose cash the viewer keeps, and where that cash is. `funds`
 *  is null when it could not be loaded - the group still gets a card. */
type Holding = { group: Group; funds: GroupFunds | null };

export default function Approvals() {
  const { colors } = useTheme();
  const router = useRouter();
  const { role, can } = useRole();
  const canVote = can("vote");
  // Home's "Cash to deliver" opens this screen straight on Deliveries.
  // A group's own Payouts link adds its groupId, opening straight on it.
  const { tab, groupId } = useLocalSearchParams<{ tab?: string; groupId?: string }>();
  const [items, setItems] = useState<Approval[]>([]);
  const [filter, setFilter] = useState<Filter>(tab === "deliveries" ? "deliveries" : "pending");
  // Which group's payouts are open, when the viewer keeps the cash for more
  // than one. Null shows the list of groups to choose from.
  const [payoutGroupId, setPayoutGroupId] = useState<string | null>(groupId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  // Needed to spot an approval about the viewer themselves - nobody votes on
  // their own removal, so the buttons must not be there to tap.
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser<{ _id: string }>().then((u) =>
      setMyUserId(u?._id ? String(u._id) : null)
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Both tabs come off one fetch, so the pending count stays right while
      // the reader is looking at history.
      const res = await getApprovals({ status: "all" });
      setItems(res);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useAsyncEffect(load);

  // A reload that keeps the list on screen: after a vote the reader should see
  // the card leave, not the whole list drop back to a skeleton.
  const reload = useCallback(async () => {
    try {
      setItems(await getApprovals({ status: "all" }));
    } catch {
      // The vote itself landed; the next refresh catches the list up.
    }
  }, []);

  // ── Deliveries ──────────────────────────────────────────────────────────────
  // Cash the viewer confirmed receiving and has not yet said where it went, in
  // every church group they keep the cash for. Reloaded on focus so the figures
  // are right after coming back from declaring a delivery.
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

  const loadDeliveries = useCallback(async () => {
    try {
      const mine = (await getGroups()).filter(handlesCash);
      const funds = await Promise.allSettled(mine.map((g) => getGroupFunds(g.id)));
      setHoldings(
        mine.map((group, i) => ({
          group,
          funds: funds[i].status === "fulfilled" ? funds[i].value : null,
        }))
      );
    } catch {
      setHoldings([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [loadDeliveries])
  );

  // Only someone who keeps a church group's cash has deliveries to declare.
  const showDeliveries = holdings.length > 0;
  const holdingTotal = holdings.reduce((sum, h) => sum + (h.funds?.cashOnHand ?? 0), 0);
  const activeFilter: Filter = filter === "deliveries" && !showDeliveries && !deliveriesLoading ? "pending" : filter;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([load(), loadDeliveries()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, loadDeliveries]);

  const pendingCount = items.filter((i) => i.status === "pending").length;
  // History is everything a vote has already settled - approved, rejected, or
  // carried out.
  const data = items.filter((i) =>
    activeFilter === "pending" ? i.status === "pending" : i.status !== "pending"
  );

  // An approved action whose execution was blocked at the time - a refund the
  // wallet couldn't cover yet. The votes stand; this just runs it again.
  const onRun = async (id: string) => {
    setRunning(id);
    try {
      await runApproval(id);
      await load();
    } catch (e: any) {
      Alert.alert("Could not complete", e?.message || "Please try again.");
    } finally {
      setRunning(null);
    }
  };

  const onVote = async (id: string, action: "approve" | "reject") => {
    setVoting(id);
    try {
      const res = await voteOnApproval(id, action);
      // Show the vote's outcome at once. A receipt is settled by the one
      // confirmation, so it leaves Pending the moment the API answers.
      const status = res?.approval?.status as Approval["status"] | undefined;
      if (status)
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      // Confirming cash puts it in the confirmer's hands, so the Deliveries
      // figures move with it.
      await Promise.all([reload(), loadDeliveries()]);
    } catch (e: any) {
      Alert.alert("Vote failed", e?.message || "Please try again.");
    } finally {
      setVoting(null);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="approvals-screen"
    >
      <ScreenHeader
        title="Approval center"
        subtitle={`${pendingCount} pending`}
      />
      {/* Scrolls sideways: with Deliveries there are three chips, which is
          wider than a small phone. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.filters}
      >
        {(showDeliveries
          ? (["pending", "deliveries", "history"] as const)
          : (["pending", "history"] as const)
        ).map((f) => {
          const active = activeFilter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              testID={`approvals-filter-${f}`}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600" }}>
                {f === "pending"
                  ? `Pending${pendingCount ? ` (${pendingCount})` : ""}`
                  : f === "deliveries"
                    ? `Payouts${holdingTotal > 0 ? ` · ${formatZMW(holdingTotal, { compact: true })}` : ""}`
                    : "History"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeFilter === "deliveries" ? (
          deliveriesLoading ? (
            <SkeletonGroup count={2} height={180} />
          ) : (
            <Deliveries
              holdings={holdings}
              total={holdingTotal}
              colors={colors}
              selectedGroupId={payoutGroupId}
              onSelectGroup={setPayoutGroupId}
              onRetry={loadDeliveries}
              onDeliver={(groupId, source) =>
                router.push({
                  pathname: "/declare-delivery",
                  params: { groupId, source: source ?? "general" },
                })
              }
            />
          )
        ) : loading ? (
          <SkeletonGroup count={3} height={160} />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : data.length === 0 ? (
          <Card padding={28} style={{ alignItems: "center" }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Check size={28} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16, marginTop: 12 }}>
              {activeFilter === "pending" ? "All caught up" : "No decisions yet"}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" }}>
              {activeFilter === "pending"
                ? "No approvals waiting. We'll notify you when new requests come in."
                : "Every request your group settles is kept here: who decided it, and when."}
            </Text>
          </Card>
        ) : (
          data.map((a) => {
          // Fallback guards against any future/unknown approval type crashing the list.
          const Icon = TYPE_ICONS[a.type] ?? ShieldCheck;
          const isOwnRemoval =
            a.type === "member-removal" &&
            !!myUserId &&
            String(a.targetUserId) === myUserId;
          // A receipt is not a group decision - one admin says whether the cash
          // reached them - so it drops the vote tally and asks the question in
          // the words of the thing: did you get the money?
          const isReceipt = a.type === "cash-receipt";
          const progress = a.totalVoters === 0 ? 0 : a.votesFor / a.totalVoters;
          const isPending = a.status === "pending";
          const statusVariant = STATUS_VARIANT[a.status] ?? "warning";
          return (
            <Card key={a.id} padding={18} style={{ marginBottom: 12 }}>
              <View style={styles.cardHead}>
                <View style={[styles.typeIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                    {a.title}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {a.requestedBy} · {formatDate(a.timestamp) || a.timestamp}
                  </Text>
                </View>
                <StatusBadge label={STATUS_LABEL[a.status] ?? a.status} variant={statusVariant} />
              </View>

              <Text style={{ color: colors.textBody, fontSize: 13, marginTop: 10, lineHeight: 20 }}>
                {a.description}
              </Text>

              {a.amount ? (
                <View style={[styles.amountBox, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                    {!isReceipt
                      ? "REQUESTED AMOUNT"
                      : a.channel === "bank"
                        ? "SENT TO THE CHURCH BANK ACCOUNT"
                        : a.channel === "mobile-money"
                          ? "SENT TO THE CHURCH MOBILE MONEY"
                          : "CASH HANDED OVER"}
                  </Text>
                  <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 20, marginTop: 2 }}>
                    {formatZMW(a.amount)}
                  </Text>
                  {isReceipt && a.projectName ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      Toward {a.projectName}
                    </Text>
                  ) : null}
                  {isReceipt && a.reference ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Reference {a.reference}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {isReceipt ? (
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 14, lineHeight: 16 }}>
                  {a.channel === "bank" || a.channel === "mobile-money"
                    ? `Check the church ${a.channel === "bank" ? "bank account" : "mobile money"} for this ${a.reference ? "reference" : "payment"} before confirming. Nothing is credited until you do.`
                    : a.confirmerRole === "Treasurer"
                    ? "The treasurer confirms this: they hold the group's cash. Nothing is credited until they do."
                    : a.confirmerRole === "Chairperson"
                      ? "This group has no treasurer, so the chairperson confirms it. Nothing is credited until they do."
                      : "One admin confirms this: whoever is holding the cash. Nothing is credited until they do."}
                </Text>
              ) : (
                <View style={{ marginTop: 14 }}>
                  <View style={styles.rowBetween}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                      {a.votesFor} APPROVED · {a.votesAgainst} REJECTED
                    </Text>
                    <Text style={{ color: colors.textMain, fontSize: 12, fontWeight: "700" }}>
                      {a.votesFor} of {a.totalVoters} approvals
                    </Text>
                  </View>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar progress={progress} />
                  </View>
                </View>
              )}

              {!isPending && a.votes && a.votes.length > 0 ? (
                <View style={[styles.trail, { borderTopColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                    DECISION TRAIL
                  </Text>
                  {a.votes.map((v, i) => (
                    <View key={`${a.id}-vote-${i}`} style={styles.trailRow}>
                      {v.decision === "approve" ? (
                        <Check size={13} color={colors.success} />
                      ) : (
                        <X size={13} color={colors.danger} />
                      )}
                      <Text
                        style={{ flex: 1, color: colors.textBody, fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {v.adminName}{" "}
                        {v.decision === "approve"
                          ? isReceipt
                            ? "confirmed the cash"
                            : "approved"
                          : isReceipt
                            ? "said it never arrived"
                            : "rejected"}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                        {formatDate(v.at)}
                      </Text>
                    </View>
                  ))}
                  {a.resolvedAt ? (
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>
                      {a.status === "executed"
                        ? "Carried out"
                        : a.status === "rejected"
                          ? "Rejected"
                          : "Approved"}{" "}
                      {formatDate(a.resolvedAt)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {a.type === "withdrawal" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 10,
                    backgroundColor: colors.surfaceSecondary,
                    padding: 10,
                    borderRadius: 10,
                    gap: 8,
                  }}
                >
                  <Info size={14} color={colors.warning} />
                  <Text style={{ flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
                    Withdrawals require Treasurer co-signature in addition to member votes.
                    {role === "Treasurer" ? " You can co-sign this." : ""}
                  </Text>
                </View>
              ) : null}

              {isPending && isOwnRemoval ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 10,
                    backgroundColor: colors.surfaceSecondary,
                    padding: 10,
                    borderRadius: 10,
                    gap: 8,
                  }}
                >
                  <Info size={14} color={colors.warning} />
                  <Text style={{ flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
                    This is about you. The group&apos;s other admins decide it. You
                    have no vote on your own removal.
                  </Text>
                </View>
              ) : null}

              {a.status === "approved" ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 8 }}>
                    Approved, but not carried out yet. Usually the group wallet
                    could not cover it at the time.
                  </Text>
                  <Button
                    label="Run again"
                    variant="outline"
                    size="md"
                    onPress={() => onRun(a.id)}
                    disabled={!canVote || running === a.id}
                    loading={running === a.id}
                    testID={`approval-run-${a.id}`}
                  />
                </View>
              ) : null}

              {isPending && !isOwnRemoval ? (
                <View style={styles.actions}>
                  <Button
                    label={isReceipt ? "Not received" : "Reject"}
                    variant="outline"
                    onPress={() => onVote(a.id, "reject")}
                    size="md"
                    fullWidth={false}
                    disabled={!canVote || voting === a.id}
                    loading={voting === a.id}
                    style={{ flex: 1, marginRight: 8 }}
                    icon={<X size={16} color={colors.primary} />}
                    testID={`approval-reject-${a.id}`}
                  />
                  <Button
                    label={isReceipt ? "Confirm received" : "Approve"}
                    onPress={() => onVote(a.id, "approve")}
                    size="md"
                    fullWidth={false}
                    disabled={!canVote || voting === a.id}
                    loading={voting === a.id}
                    style={{ flex: 1, marginLeft: 8 }}
                    icon={<Check size={16} color="#fff" />}
                    testID={`approval-approve-${a.id}`}
                  />
                </View>
              ) : null}
            </Card>
          );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const DELIVERY_ICONS = { bank: Landmark, "mobile-money": Smartphone, project: Hammer };

/** One line of the record of where held cash went. */
const deliveryLine = (d: CashDelivery) =>
  d.destination === "project"
    ? `${d.sourceName} paid out${d.targetName && d.targetName !== d.sourceName ? ` for ${d.targetName}` : ""}${d.payee ? ` · ${d.payee}` : ""}`
    : `${d.sourceName} ${d.destination === "bank" ? "banked" : "put on mobile money"}`;

// The Payouts tab. One church group: its payouts straight away. Two or more:
// a card per group to choose from, then that one group's payouts, with a way
// back to the list. A group's payouts are a summary card with everything held
// and the one button that pays it all out; the same cash by project, each row
// opening a payout of just that project's cash (for part amounts and project
// spending); and the last few payouts, so one just declared shows up here.
const Deliveries = ({
  holdings,
  colors,
  selectedGroupId,
  onSelectGroup,
  onRetry,
  onDeliver,
}: {
  holdings: Holding[];
  total: number;
  colors: ReturnType<typeof useTheme>["colors"];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onRetry: () => void;
  onDeliver: (groupId: string, source: string | null) => void;
}) => {
  // One recent payout open at a time: tapping a row shows everything it
  // recorded, tapping it again folds it back to one line.
  const [openId, setOpenId] = useState<string | null>(null);
  const several = holdings.length > 1;
  const shown = several ? holdings.filter((h) => h.group.id === selectedGroupId) : holdings;
  if (several && shown.length === 0)
    return <GroupPicker holdings={holdings} colors={colors} onSelect={onSelectGroup} />;
  return (
  <>
    {several && (
      <Pressable
        onPress={() => onSelectGroup(null)}
        hitSlop={8}
        style={({ pressed }) => [styles.backRow, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        testID="payouts-all-groups"
      >
        <ChevronLeft size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>All groups</Text>
      </Pressable>
    )}
    {shown.map(({ group, funds }, gi) => {
      const held = (funds?.piles ?? []).filter((p) => p.cashOnHand > 0);
      const recent = (funds?.deliveries ?? []).slice(0, 5);
      return (
        <View key={group.id} style={{ marginTop: gi === 0 ? 0 : 28 }} testID={`deliveries-group-${group.id}`}>
          {/* Summary: what is in hand, and the one way to pay all of it out. */}
          <Card padding={18}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 0, marginBottom: 0 }]}>
              CASH YOU&apos;RE HOLDING
            </Text>
            <Text style={[styles.heldAmount, { color: colors.textMain }]}>
              {funds ? formatZMW(funds.cashOnHand) : "-"}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{group.name}</Text>

            {!funds ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                  Couldn&apos;t load the cash you&apos;re holding for this group.
                </Text>
                <Pressable onPress={onRetry} hitSlop={8} style={{ marginTop: 8 }} testID={`deliveries-retry-${group.id}`}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Try again</Text>
                </Pressable>
              </View>
            ) : held.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 14, lineHeight: 19 }}>
                Nothing to pay out. Every kwacha you confirmed has been banked or paid out.
              </Text>
            ) : (
              <Button
                label="Pay out all"
                onPress={() => onDeliver(group.id, "all")}
                style={{ marginTop: 18 }}
                testID={`payout-all-${group.id}`}
              />
            )}
          </Card>

          {/* The same cash by project. A row pays out just that project's. */}
          {held.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BY PROJECT</Text>
              <Card padding={4}>
                {held.map((p, i) => (
                  <Pressable
                    key={p.projectId ?? "general"}
                    onPress={() => onDeliver(group.id, p.projectId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay out ${p.name}, ${formatZMW(p.cashOnHand)}`}
                    style={({ pressed }) => [
                      styles.pileRow,
                      {
                        borderTopColor: colors.border,
                        borderTopWidth: i === 0 ? 0 : 1,
                        backgroundColor: pressed ? colors.surfaceSecondary : "transparent",
                      },
                    ]}
                    testID={`deliver-${group.id}-${p.projectId ?? "general"}`}
                  >
                    <Text style={{ flex: 1, color: colors.textMain, fontWeight: "600", fontSize: 15 }}>
                      {p.name}
                    </Text>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginRight: 6 }}>
                      {formatZMW(p.cashOnHand)}
                    </Text>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </Card>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                Tap a project to pay out part of it
              </Text>
            </>
          )}

          {recent.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RECENT PAYOUTS</Text>
              <Card padding={4}>
                {recent.map((d, i) => {
                  const Icon = DELIVERY_ICONS[d.destination] ?? Wallet;
                  const open = openId === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setOpenId(open ? null : d.id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      style={({ pressed }) => [
                        styles.recentItem,
                        {
                          borderTopColor: colors.border,
                          borderTopWidth: i === 0 ? 0 : 1,
                          backgroundColor: pressed ? colors.surfaceSecondary : "transparent",
                        },
                      ]}
                      testID={`recent-payout-${d.id}`}
                    >
                      <View style={styles.recentRow}>
                        <View style={[styles.recentIcon, { backgroundColor: colors.primarySoft }]}>
                          <Icon size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                          <Text
                            style={{ color: colors.textMain, fontSize: 13, fontWeight: "600" }}
                            numberOfLines={open ? undefined : 1}
                          >
                            {deliveryLine(d)}
                          </Text>
                          {!open && (
                            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                              {[formatDate(d.date), d.reference].filter(Boolean).join(" · ")}
                            </Text>
                          )}
                        </View>
                        <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "700" }}>
                          {formatZMW(d.amount)}
                        </Text>
                        <ChevronDown
                          size={16}
                          color={colors.textMuted}
                          style={{ marginLeft: 6, transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                        />
                      </View>
                      {open && <PayoutDetails d={d} colors={colors} />}
                    </Pressable>
                  );
                })}
              </Card>
            </>
          )}
        </View>
      );
    })}
  </>
  );
};

/** The Payouts tab's first view for someone keeping several groups' cash:
 *  one card per group, with what they hold there. */
const GroupPicker = ({
  holdings,
  colors,
  onSelect,
}: {
  holdings: Holding[];
  colors: ReturnType<typeof useTheme>["colors"];
  onSelect: (groupId: string) => void;
}) => (
  <>
    <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 0 }]}>
      CHOOSE A GROUP
    </Text>
    {holdings.map(({ group, funds }) => {
      const held = funds?.cashOnHand ?? 0;
      const piles = (funds?.piles ?? []).filter((p) => p.cashOnHand > 0).map((p) => p.name);
      return (
        <Pressable
          key={group.id}
          onPress={() => onSelect(group.id)}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: 12 })}
          accessibilityRole="button"
          accessibilityLabel={`${group.name}, ${formatZMW(held)} to pay out`}
          testID={`payouts-group-${group.id}`}
        >
          <Card padding={18}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                  {!funds
                    ? "Couldn't load. Tap to try again"
                    : piles.length
                      ? piles.join(" · ")
                      : "Nothing to pay out"}
                </Text>
              </View>
              {funds ? (
                <Text
                  style={{
                    color: held > 0 ? colors.textMain : colors.textMuted,
                    fontWeight: "800",
                    fontSize: 17,
                  }}
                >
                  {formatZMW(held)}
                </Text>
              ) : null}
              <ChevronRight size={20} color={colors.textMuted} style={{ marginLeft: 8 }} />
            </View>
          </Card>
        </Pressable>
      );
    })}
  </>
);

/** Everything one payout recorded, shown when its row is opened. */
const PayoutDetails = ({
  d,
  colors,
}: {
  d: CashDelivery;
  colors: ReturnType<typeof useTheme>["colors"];
}) => {
  const method =
    d.destination === "bank"
      ? "Deposited to the church bank account"
      : d.destination === "mobile-money"
        ? "Deposited to the church mobile money"
        : d.targetName
          ? `Paid out for ${d.targetName}`
          : "Paid out (no project)";
  const when = d.date
    ? new Date(d.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const rows: [string, string][] = [
    ["Amount", formatZMW(d.amount)],
    ["From", d.sourceName],
    ["Payout method", method],
    ...(d.payee ? ([["Paid to", d.payee]] as [string, string][]) : []),
    ...(d.reference ? ([["Reference", d.reference]] as [string, string][]) : []),
    ...(d.recordedByName ? ([["Recorded by", d.recordedByName]] as [string, string][]) : []),
    ...(when ? ([["Date", when]] as [string, string][]) : []),
  ];
  return (
    <View style={[styles.detailBox, { backgroundColor: colors.surfaceSecondary }]}>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.detailRow}>
          <Text style={{ color: colors.textMuted, fontSize: 12, width: 104 }}>{k}</Text>
          <Text style={{ color: colors.textMain, fontSize: 12, fontWeight: "600", flex: 1 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  pileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 24, marginBottom: 8 },
  heldAmount: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 12, alignSelf: "flex-start" },
  recentItem: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  recentRow: { flexDirection: "row", alignItems: "center" },
  detailBox: { marginTop: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "flex-start" },
  recentIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 18,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  amountBox: { padding: 14, borderRadius: 14, marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actions: { flexDirection: "row", marginTop: 16 },
  trail: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  trailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
