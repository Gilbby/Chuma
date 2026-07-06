import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { Notice, Group } from "@/src/types";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/src/services/notifications";
import { confirmCashContribution, retryPayout } from "@/src/services/transactions";
import { getGroups, acceptInvite } from "@/src/services/groups";
import { getGraceInfo, getAmountOwed, getMonthsOwed } from "@/src/services/groupFees";
import { useRole } from "@/src/hooks/useRole";
import { formatZMW } from "@/src/utils/currency";
import {
  Banknote,
  PiggyBank,
  Scale,
  ShieldAlert,
  RefreshCw,
  Check,
  Users,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react-native";

const ICONS = {
  loan: Banknote,
  contribution: PiggyBank,
  governance: Scale,
  security: ShieldAlert,
  repayment: RefreshCw,
  invite: Users,
  penalty: AlertTriangle,
  kyc: ShieldCheck,
};

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  if (dateStr.toLowerCase().includes("today")) return true; // keeps fee-notice "Today"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const TINTS: Record<Notice["type"], "primary" | "info" | "success" | "warning" | "danger"> = {
  loan: "success",
  contribution: "primary",
  governance: "info",
  security: "warning",
  repayment: "info",
  invite: "primary",
  penalty: "warning",
  kyc: "warning",
};

export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<Notice[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { role } = useRole();
  const isAdmin = role === "Chairperson" || role === "Treasurer";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, g] = await Promise.all([getNotifications(), getGroups()]);
      setItems(n);
      setGroups(g);
    } catch (e) {
      // leave lists empty on error; screen still renders
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // In-app grace reminder derived from live fee status. The
  // backend will additionally PUSH this daily (day 1–5
  // countdown) to chairperson + treasurer via SMS/push — see
  // Phase 8 AfricasTalking. This in-app version shows the
  // current state whenever the user opens notifications.
  const feeNotices: Notice[] = [];
  const feeUrgency: Record<string, number> = {};
  if (isAdmin) {
    groups.forEach((g) => {
      const grace = getGraceInfo(g);
      if (grace.status !== "grace") return;
      const left = grace.daysLeft;
      feeUrgency[g.id] = left;
      feeNotices.push({
        id: `n-fee-${g.id}`,
        type: "security",
        title: "Group fee overdue",
        body: `${g.name}: monthly fee unpaid. Day ${grace.daysIntoGrace} of 5 — ${left} day${left === 1 ? "" : "s"} left before the group is locked. Pay ${formatZMW(getAmountOwed(g))} to keep it active.`,
        date: "Today",
        read: false,
        groupId: g.id,
        groupName: g.name,
      });
    });
  }

  const activeItems = [
    ...feeNotices.filter((n) => !dismissed.includes(n.id)),
    ...items.filter((n) => !dismissed.includes(n.id)),
  ];

  const grouped = useMemo(() => {
    const today: Notice[] = [];
    const earlier: Notice[] = [];
    activeItems.forEach((n) => {
      if (isToday(n.date)) today.push(n);
      else earlier.push(n);
    });
    return { today, earlier };
  }, [activeItems]);

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setItems((p) => p.map((n) => ({ ...n, read: true })));
  };

  const handleAcceptInvite = async (n: Notice) => {
    try {
      if (n.groupId) await acceptInvite(n.groupId);
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      setDismissed((d) => [...d, n.id]);
      Alert.alert("Joined", `You joined ${n.groupName}.`);
    } catch (e: any) {
      Alert.alert("Could not join", e?.message || "Please try again.");
    }
  };

  const handleDeclineInvite = async (n: Notice) => {
    try { await markNotificationRead(n.id); } catch {}
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setDismissed((d) => [...d, n.id]);
  };

  const handleCashReceipt = async (n: Notice, received: boolean) => {
    try {
      if (n.transactionId) await confirmCashContribution(n.transactionId, received);
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      Alert.alert(
        received ? "Cash confirmed" : "Marked not received",
        received
          ? "The member's savings have been updated."
          : "The contribution was declined and no savings were credited."
      );
    } catch (e: any) {
      Alert.alert("Could not update", e?.message || "Please try again.");
    }
  };

  const handleRetryPayout = async (n: Notice) => {
    try {
      if (n.transactionId) await retryPayout(n.transactionId);
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      Alert.alert(
        "Payout re-sent",
        "A new payout has been initiated. The member will be notified once it lands in their wallet."
      );
    } catch (e: any) {
      Alert.alert("Retry failed", e?.message || "Please try again.");
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="notifications-screen"
    >
      <ScreenHeader
        title="Notifications"
        rightAction={
          <Pressable onPress={markAllRead} testID="notifications-read-all">
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              Mark all read
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {grouped.today.length > 0 && (
          <>
            <Text style={[styles.group, { color: colors.textMuted }]}>TODAY</Text>
            {grouped.today.map((n) => (
              <NotifCard
                key={n.id}
                n={n}
                colors={colors}
                onPress={() => setItems((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i))}
                onAccept={() => handleAcceptInvite(n)}
                onDecline={() => handleDeclineInvite(n)}
                onCashConfirm={() => handleCashReceipt(n, true)}
                onCashDecline={() => handleCashReceipt(n, false)}
                onRetryPayout={() => handleRetryPayout(n)}
                onPayPenalty={n.penaltyId ? () => {
                  setItems((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i));
                  router.push({ pathname: "/penalty-pay", params: {
                    penaltyId: String(n.penaltyId),
                    amount: String(n.penaltyAmount),
                    reason: String(n.penaltyReason),
                    groupName: n.groupName ?? "",
                  }});
                } : undefined}
                onPayFee={n.id.startsWith("n-fee-") ? () => router.push(`/group-fee?groupId=${n.groupId}`) : undefined}
                tintOverride={n.id.startsWith("n-fee-") ? (feeUrgency[n.groupId!] >= 3 ? colors.warning : colors.danger) : undefined}
              />
            ))}
          </>
        )}
        {grouped.earlier.length > 0 && (
          <>
            <Text style={[styles.group, { color: colors.textMuted, marginTop: 18 }]}>EARLIER</Text>
            {grouped.earlier.map((n) => (
              <NotifCard
                key={n.id}
                n={n}
                colors={colors}
                onPress={() => setItems((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i))}
                onAccept={() => handleAcceptInvite(n)}
                onDecline={() => handleDeclineInvite(n)}
                onCashConfirm={() => handleCashReceipt(n, true)}
                onCashDecline={() => handleCashReceipt(n, false)}
                onRetryPayout={() => handleRetryPayout(n)}
                onPayPenalty={n.penaltyId ? () => {
                  setItems((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i));
                  router.push({ pathname: "/penalty-pay", params: {
                    penaltyId: String(n.penaltyId),
                    amount: String(n.penaltyAmount),
                    reason: String(n.penaltyReason),
                    groupName: n.groupName ?? "",
                  }});
                } : undefined}
                onPayFee={n.id.startsWith("n-fee-") ? () => router.push(`/group-fee?groupId=${n.groupId}`) : undefined}
                tintOverride={n.id.startsWith("n-fee-") ? (feeUrgency[n.groupId!] >= 3 ? colors.warning : colors.danger) : undefined}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const NotifCard = ({
  n,
  colors,
  onPress,
  onAccept,
  onDecline,
  onPayPenalty,
  onPayFee,
  onCashConfirm,
  onCashDecline,
  onRetryPayout,
  tintOverride,
}: {
  n: Notice;
  colors: ReturnType<typeof useTheme>["colors"];
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onPayPenalty?: () => void;
  onPayFee?: () => void;
  onCashConfirm?: () => void;
  onCashDecline?: () => void;
  onRetryPayout?: () => void;
  tintOverride?: string;
}) => {
  const router = useRouter();
  const Icon = ICONS[n.type] ?? Banknote;
  // Treasurer/chairperson action card: acknowledge physical cash receipt
  const isCashReceipt =
    n.type === "contribution" && !!n.transactionId && n.title.includes("confirm receipt");
  // Admin action card: a loan-disbursement / share-out payout failed at the
  // provider — only admin copies carry a transactionId to act on.
  const isFailedPayout =
    !!n.transactionId &&
    /^(Loan disbursement|Share-out payout) failed$/.test(n.title) &&
    n.body.includes("please retry");
  const tint = TINTS[n.type];
  const tintColor = tintOverride ?? (
    tint === "primary"
      ? colors.primary
      : tint === "success"
        ? colors.success
        : tint === "info"
          ? colors.info
          : tint === "warning"
            ? colors.warning
            : colors.danger
  );
  return (
    <Pressable onPress={onPress}>
  <Card padding={14} style={{ marginBottom: 10, opacity: n.read ? 0.7 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon size={18} color={tintColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.rowBetween}>
            <Text
              style={{
                color: colors.textMain,
                fontWeight: n.read ? "600" : "700",
                fontSize: 14,
                flex: 1,
                marginRight: 8,
              }}
            >
              {n.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{n.date}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            {n.body}
          </Text>
          {!n.read && (
            <View
              style={[
                styles.unreadDot,
                { backgroundColor: colors.primary },
              ]}
            />
          )}
          {n.type === "invite" && !n.read && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button
                label="Decline"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={onDecline}
                testID={`notif-decline-${n.id}`}
              />
              <Button
                label="Accept"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={onAccept}
                testID={`notif-accept-${n.id}`}
              />
            </View>
          )}
          {isCashReceipt && !n.read && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button
                label="Not received"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={onCashDecline}
                testID={`cash-decline-${n.id}`}
              />
              <Button
                label="Confirm receipt"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={onCashConfirm}
                testID={`cash-confirm-${n.id}`}
              />
            </View>
          )}
          {isFailedPayout && !n.read && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button
                label="Retry payout"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={onRetryPayout}
                testID={`retry-payout-${n.id}`}
              />
            </View>
          )}
          {n.type === "kyc" && !n.read && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button
                label="Verify now"
                size="sm"
                fullWidth={false}
                onPress={() => router.push("/kyc?return=tabs" as never)}
                testID={`kyc-verify-${n.id}`}
              />
            </View>
          )}
          {n.type === "penalty" && !n.read && n.penaltyId && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button
                label={`Pay K${n.penaltyAmount?.toFixed(2)}`}
                size="sm"
                fullWidth={false}
                onPress={onPayPenalty}
                testID={`penalty-pay-${n.id}`}
              />
            </View>
          )}
          {n.id.startsWith("n-fee-") && !n.read && (
            <View style={{ marginTop: 12 }}>
              <Button
                label="Pay now"
                size="sm"
                fullWidth={false}
                onPress={onPayFee}
                testID={`fee-pay-${n.groupId}`}
              />
            </View>
          )}
        </View>
      </View>
    </Card>
  </Pressable>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  group: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unreadDot: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
