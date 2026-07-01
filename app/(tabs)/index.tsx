import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import {
  Bell,
  PiggyBank,
  HandCoins,
  RefreshCw,
  CheckSquare,
  Gift,
} from "lucide-react-native";
import { Card } from "@/src/components/ui/Card";
import { Skeleton, SkeletonGroup } from "@/src/components/ui";
import { ErrorState, GroupHealthStack } from "@/src/components/common";
import { TransactionRow } from "@/src/components/common/TransactionRow";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import {
  currentUser,
  transactions,
  approvals,
} from "@/src/data/mock";
import { getGroups } from "@/src/services/groups";
import { getLoans } from "@/src/services/loans";
import { getPenalties } from "@/src/services/penalties";
import { getNotifications } from "@/src/services/notifications";
import { getCurrentUser } from "@/src/utils/currentUser";
import { Group, Loan, Penalty, Notice } from "@/src/types";
import { computeShareOut, estimateGroupProfit, getMyShare } from "@/src/services/shareOut";
import { formatZMW } from "@/src/utils/currency";
import { useRole } from "@/src/contexts/RoleContext";

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPayoutDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Home() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const { role } = useRole();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [myUserId, setMyUserId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const user = await getCurrentUser<{ _id: string }>();
      setMyUserId(user?._id ? String(user._id) : "");
      const [g, l, p, n] = await Promise.all([
        getGroups(),
        getLoans({ mine: true }),
        getPenalties({ mine: true }),
        getNotifications(),
      ]);
      setGroups(g);
      setLoans(l);
      setPenalties(p);
      setNotifications(n);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const handleRetry = () => {
    load();
  };

  const myTotalSavings = groups.reduce((sum, g) => {
    const me = (g.members ?? []).find((m: any) => String(m.userId) === myUserId);
    return sum + (me?.savings ?? 0);
  }, 0);
  const groupPoolTotal = groups.reduce((a, g) => a + g.totalSavings, 0);

  const myLoans = loans.filter((l) => String(l.memberId) === myUserId && l.status === "active");
  const myActiveLoans = myLoans.reduce((sum, l) => sum + l.outstanding, 0);
  const myLoanCount = myLoans.length;
  const nextRepaymentLoan = myLoans
    .slice()
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0];
  const upcomingRepayment = nextRepaymentLoan?.installmentAmount ?? 0;
  const upcomingRepaymentDate = nextRepaymentLoan?.nextDueDate
    ? formatDueDate(nextRepaymentLoan.nextDueDate)
    : "—";

  const upcomingContribution = groups
    .filter((g) => g.nextContributionDate)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.nextContributionDate!).getTime() -
        new Date(b.nextContributionDate!).getTime()
    )[0];

  const dueDateObj = upcomingContribution?.nextContributionDate
    ? new Date(upcomingContribution.nextContributionDate)
    : null;

  const daysUntilDue =
    dueDateObj && !isNaN(dueDateObj.getTime())
      ? Math.ceil(
          (dueDateObj.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null;

  const payoutsByGroup = groups
    .filter((g) => g.shareOutDate)
    .map((g) => {
      const penaltyIncome = penalties
        .filter(
          (p) =>
            p.groupId === g.id &&
            p.status === "paid" &&
            p.fundsDestination === "group-pool"
        )
        .reduce((s, p) => s + p.amount, 0);

      const cycleMonths = g.constitution?.loanRepaymentMonths ?? 12;
      const profit = estimateGroupProfit(
        g.loanCirculation ?? 0,
        g.loanInterestRate ?? 0,
        cycleMonths,
        penaltyIncome
      );

      const result = computeShareOut(
        (g.members ?? []).map((m: any) => ({
          id: String(m.userId ?? m.id),
          name: m.name,
          contribution: m.savings,
        })),
        profit
      );

      const myId = myUserId;
      const myShare = getMyShare(result.members, myId);

      return {
        groupId: g.id,
        groupName: g.name,
        date: g.shareOutDate,
        myShare,
      };
    });

  const nextPayout = payoutsByGroup
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const unread = notifications.filter((n) => !n.read).length;

  const quickActions = [
    { label: "Save", icon: PiggyBank, route: "/contribute" },
    { label: "Loan", icon: HandCoins, route: "/loan" },
    { label: "Repay", icon: RefreshCw, route: "/repay" },
    { label: "Approve", icon: CheckSquare, route: "/approvals", badge: pendingApprovals },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="home-screen"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.user}
            onPress={() => router.push("/(tabs)/profile")}
            testID="home-profile-btn"
          >
            <Image
              source={{ uri: currentUser.avatar }}
              style={styles.avatar}
            />
            <View>
              <Text style={[styles.greeting, { color: colors.textMuted }]}>Hi,</Text>
              <Text style={[styles.name, { color: colors.textMain }]}>Gilbert</Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.bell, { backgroundColor: colors.surfaceSecondary }]}
            onPress={() => router.push("/notifications")}
            testID="home-bell-btn"
          >
            <Bell size={20} color={colors.textMain} />
            {unread > 0 && (
              <View style={[styles.bellDot, { backgroundColor: colors.danger }]} />
            )}
          </Pressable>
        </View>

        {/* Role info pill */}
        <View style={styles.metaRow}>
          <StatusBadge label={role} variant="primary" testID="home-role-badge" />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            · {groups.length} groups · {pendingApprovals} approvals
          </Text>
        </View>

        {loading ? (
          <>
            <Skeleton height={150} borderRadius={24} style={{ marginHorizontal: 20, marginBottom: 20 }} />
            <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20 }}>
              <Skeleton width={130} height={90} borderRadius={16} />
              <Skeleton width={130} height={90} borderRadius={16} />
              <Skeleton width={130} height={90} borderRadius={16} />
            </View>
            <View style={{ marginHorizontal: 20, marginTop: 20 }}>
              <SkeletonGroup count={3} height={64} />
            </View>
          </>
        ) : error ? (
          <ErrorState onRetry={handleRetry} />
        ) : (
          <>
            {/* Hero Balance Card */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.primary },
          ]}
        >
          <View style={styles.heroBgCircle1} />
          <View style={styles.heroBgCircle2} />
          <Text style={styles.heroLabel}>Total balance</Text>
          <Text style={styles.heroAmount}>
            {formatZMW(myTotalSavings)}
          </Text>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroSubLabel}>Active groups</Text>
              <Text style={styles.heroSubValue}>
                {groups.length} {groups.length === 1 ? "group" : "groups"}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {quickActions.map((a, i) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={i}
                onPress={() => router.push(a.route as never)}
                style={({ pressed }) => [styles.quickItem, { opacity: pressed ? 0.7 : 1 }]}
                testID={`home-quick-${a.label.toLowerCase()}`}
              >
                <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon size={22} color={colors.primary} strokeWidth={2.2} />
                  {a.badge ? (
                    <View style={[styles.quickBadge, { backgroundColor: colors.danger }]}>
                      <Text style={styles.quickBadgeText}>{a.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.quickLabel, { color: colors.textMain }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Financial overview cards */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Overview</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.overviewRow}
        >
          <OverviewCard
            label="Contribution due"
            value={upcomingContribution ? formatZMW(upcomingContribution.nextContributionAmount!) : "—"}
            sub={
              daysUntilDue === null
                ? "Nothing due"
                : daysUntilDue <= 0
                ? "Due today"
                : daysUntilDue === 1
                ? "Due tomorrow"
                : `In ${daysUntilDue} days`
            }
            tint={colors.warning}
            mode={mode}
            testID="home-contribution-due"
          />
          <OverviewCard
            label="Active loans"
            value={myLoanCount > 0 ? formatZMW(myActiveLoans) : formatZMW(0)}
            sub={myLoanCount > 0 ? `${myLoanCount} ${myLoanCount === 1 ? "loan" : "loans"}` : "No active loans"}
            tint={colors.warning}
            mode={mode}
          />
          <OverviewCard
            label="Next repayment"
            value={myLoanCount > 0 ? formatZMW(upcomingRepayment) : "—"}
            sub={myLoanCount > 0 ? upcomingRepaymentDate : "Nothing due"}
            tint={colors.info}
            mode={mode}
          />
          <OverviewCard
            label="Group savings"
            value={formatZMW(groupPoolTotal, { compact: true })}
            sub={`${groups.length} groups`}
            tint={colors.success}
            mode={mode}
          />
        </ScrollView>

        {/* Group Health Stack */}
        <GroupHealthStack
          groups={groups}
          onCardPress={(id) => router.push(`/group/${id}`)}
        />

        {/* Recent Activity */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Recent activity</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/transactions")}
            testID="home-view-all-txn"
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>View all</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Card padding={8}>
            {transactions.slice(0, 4).map((t, i) => (
              <View key={t.id}>
                <View style={{ paddingHorizontal: 10 }}>
                  <TransactionRow
                    txn={t}
                    testID={`home-txn-${i}`}
                    onPress={() => router.push({ pathname: "/receipt", params: { id: t.id } })}
                  />
                </View>
                {i < 3 && (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </Card>
        </View>

        {/* Next payout card */}
        {nextPayout && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <Pressable
              onPress={() => router.push(`/share-out?groupId=${nextPayout.groupId}` as never)}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              testID="home-next-payout"
            >
              <Card padding={16} style={{ backgroundColor: colors.primarySoft }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 1.3,
                    color: colors.textMuted,
                    marginBottom: 12,
                  }}
                >
                  NEXT PAYOUT
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: colors.primary + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Gift size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "800",
                        color: colors.textMain,
                        letterSpacing: -0.5,
                      }}
                    >
                      {formatZMW(nextPayout.myShare)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Your share · {nextPayout.groupName}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.primary + "18",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                      {formatPayoutDate(nextPayout.date)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </View>
        )}

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const OverviewCard = ({
  label,
  value,
  sub,
  tint,
  mode,
  testID,
}: {
  label: string;
  value: string;
  sub: string;
  tint: string;
  mode: "light" | "dark";
  testID?: string;
}) => {
  const surface = mode === "light" ? "#FFFFFF" : "#0C1410";
  const border = mode === "light" ? "#E5E7EB" : "#1E3328";
  return (
    <View
      style={[
        styles.overviewCard,
        { backgroundColor: surface, borderColor: border },
      ]}
      testID={testID}
    >
      <View style={[styles.overviewDot, { backgroundColor: tint }]} />
      <Text style={[styles.overviewLabel, { color: "#6B7280" }]}>{label}</Text>
      <Text style={[styles.overviewValue, { color: mode === "light" ? "#064E3B" : "#F9FAF9" }]}>
        {value}
      </Text>
      <Text style={[styles.overviewSub, { color: "#9CA3AF" }]}>{sub}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  user: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  greeting: { fontSize: 12, fontWeight: "500" },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginTop: -2 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  metaText: { fontSize: 12, marginLeft: 8 },
  heroCard: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 24,
    overflow: "hidden",
  },
  heroBgCircle1: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
    right: -50,
    top: -80,
  },
  heroBgCircle2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)",
    right: 30,
    top: 30,
  },
  heroLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "500", letterSpacing: 0.3 },
  heroAmount: { color: "#fff", fontSize: 34, fontWeight: "700", marginTop: 4, letterSpacing: -0.6 },
  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  heroDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: 18,
  },
  heroSubLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500", letterSpacing: 0.3 },
  heroSubValue: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 20,
    justifyContent: "space-between",
  },
  quickItem: { alignItems: "center", flex: 1 },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  quickBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  quickLabel: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 24,
  },
  linkText: { fontSize: 13, fontWeight: "600" },
  overviewRow: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  overviewCard: {
    width: 160,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  overviewDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 10 },
  overviewLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  overviewValue: { fontSize: 20, fontWeight: "700", marginTop: 6, letterSpacing: -0.3 },
  overviewSub: { fontSize: 11, marginTop: 4 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  overline: { fontSize: 10, fontWeight: "700", letterSpacing: 1.3 },
  healthTitle: { fontSize: 17, fontWeight: "700", marginTop: 4, letterSpacing: -0.2 },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 4,
  },
  scoreText: { fontSize: 13, fontWeight: "700", marginLeft: 4 },
  healthMetrics: { flexDirection: "row", marginTop: 6 },
  separator: { height: 1, marginHorizontal: 16 },
});
