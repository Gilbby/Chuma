import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { Avatar } from "@/src/components/ui/Avatar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { shareOut, groups, penalties, approvals as approvalsList, notifications } from "@/src/data/mock";
import { computeShareOut, estimateGroupProfit, getMyShare } from "@/src/services/shareOut";
import { getRequiredApprovals } from "@/src/services/approvals";
import { formatZMW } from "@/src/utils/currency";
import { useRole } from "@/src/contexts/RoleContext";
import { Sparkles, Check, Calendar, TrendingUp, Lock } from "lucide-react-native";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function ShareOutScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { role, can } = useRole();
  const canApprove = can("approve.shareout");

  // TODO: persist approval votes to backend via services/approvals when wired
  const [approvals, setApprovals] = useState(0);
  const [approved, setApproved] = useState(false);

  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const activeGroupId = groupId ?? shareOut.groupId;
  const group = groups.find((g) => g.id === activeGroupId);

  const penaltyIncome = penalties
    .filter(
      (p) =>
        p.groupId === activeGroupId &&
        p.status === "paid" &&
        p.fundsDestination === "group-pool"
    )
    .reduce((sum, p) => sum + p.amount, 0);

  const cycleMonths = group?.constitution?.loanRepaymentMonths ?? 12;

  const computedProfit = group
    ? estimateGroupProfit(
        group.loanCirculation ?? 0,
        group.loanInterestRate ?? 0,
        cycleMonths,
        penaltyIncome
      )
    : shareOut.profit;

  const members = group
    ? (group.members ?? []).map((m) => ({
        id: m.id, name: m.name, contribution: m.savings,
      }))
    : shareOut.members.map((m) => ({
        id: m.id, name: m.name, contribution: m.contribution,
      }));

  const result = computeShareOut(members, computedProfit);

  const myId = group?.members?.[0]?.id ?? "m-gilbert";

  function formatShareOutDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const displayDate = group?.shareOutDate
    ? formatShareOutDate(group.shareOutDate)
    : shareOut.date;
  const displayName = group?.name ?? shareOut.groupName;

  const shareOutISO = group?.shareOutDate ?? shareOut.date;
  const now = new Date();
  const stageDates = {
    finalContrib: addDays(shareOutISO, -48),
    loansRecovered: addDays(shareOutISO, -30),
    audit: addDays(shareOutISO, -20),
    approvalVote: addDays(shareOutISO, -5),
    distribution: shareOutISO,
  };
  const timeline = [
    { date: stageDates.finalContrib, title: "Final cycle contributions due" },
    { date: stageDates.loansRecovered, title: "Outstanding loans recovered" },
    { date: stageDates.audit, title: "Group audit & report" },
    { date: stageDates.approvalVote, title: "Share-out approval vote" },
    { date: stageDates.distribution, title: "Distribution to members" },
  ].map((stage) => ({
    ...stage,
    done: new Date(stage.date).getTime() < now.getTime(),
  }));

  const adminCount = (group?.members ?? []).filter((m) =>
    ["Chairperson", "Treasurer", "Secretary"].includes(m.role)
  ).length;
  const threshold = group?.constitution?.approvalThreshold ?? "majority";
  const requiredApprovals = getRequiredApprovals(threshold, adminCount);

  const handleApprove = () => {
    // Simulates multi-admin approval on one device: approve as
    // Chairperson, then switch role (Treasurer/Secretary) to
    // see the pending approval + notification. Real cross-device
    // push notifications require the backend.
    const next = approvals + 1;
    setApprovals(next);

    const approvalId = `shareout-${activeGroupId}`;

    if (next >= requiredApprovals) {
      setApproved(true);
      const existing = approvalsList.find((a) => a.id === approvalId);
      if (existing) {
        existing.status = "approved";
        existing.votesFor = next;
      }
      Alert.alert(
        "Distribution approved",
        "The share-out plan has been approved. Members will be paid on the distribution date."
      );
    } else {
      const exists = approvalsList.some((a) => a.id === approvalId);
      if (!exists) {
        approvalsList.unshift({
          id: approvalId,
          type: "share-out",
          title: `Share-out distribution — ${displayName}`,
          description: `Approve the end-of-cycle distribution of ${formatZMW(result.totalToDistribute)} to members.`,
          requestedBy: "Chairperson",
          requestedById: group?.members?.[0]?.id ?? "",
          amount: result.totalToDistribute,
          groupId: activeGroupId,
          groupName: displayName,
          votesFor: next,
          votesAgainst: 0,
          totalVoters: requiredApprovals,
          timestamp: "Just now",
          status: "pending",
        });

        notifications.unshift({
          id: `n-shareout-${activeGroupId}`,
          type: "governance",
          title: "Share-out approval needed",
          body: `${displayName} share-out plan needs your approval to proceed.`,
          date: "Just now",
          read: false,
          groupId: activeGroupId,
          groupName: displayName,
        });
      }
      Alert.alert(
        "Vote recorded",
        `Your approval is recorded. ${requiredApprovals - next} more admin approval(s) needed.`
      );
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="shareout-screen"
    >
      <ScreenHeader title="Share-out" subtitle={displayName} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <Card
          padding={22}
          style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Sparkles size={20} color="#fff" />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", marginLeft: 8 }}>
              ANNUAL SHARE-OUT
            </Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "700", marginTop: 12, letterSpacing: -0.5 }}>
            {formatZMW(result.totalToDistribute)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
            Distribution on {displayDate}
          </Text>
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatLabel}>Savings</Text>
              <Text style={styles.heroStatVal}>{formatZMW(result.totalSavings, { compact: true })}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroStatLabel}>Profit</Text>
              <Text style={styles.heroStatVal}>{formatZMW(result.profit, { compact: true })}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroStatLabel}>Your share</Text>
              <Text style={styles.heroStatVal}>{formatZMW(getMyShare(result.members, myId), { compact: true })}</Text>
            </View>
          </View>
        </Card>

        {/* Allocations */}
        <Text style={[styles.label, { color: colors.textMuted }]}>MEMBER ALLOCATIONS</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>
          {`Profit from loan interest${penaltyIncome > 0 ? " + penalty income" : ""} this cycle`}
        </Text>
        <Card padding={0}>
          {result.members.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.allocRow,
                i < result.members.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Avatar name={m.name} size={36} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>
                  {m.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  Contributed {formatZMW(m.contribution, { compact: true })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                  {formatZMW(m.share)}
                </Text>
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                  +{m.growthPct}%
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Timeline */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>
          DISTRIBUTION TIMELINE
        </Text>
        <Card padding={0}>
          {timeline.map((t, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: t.done ? colors.primary : colors.surface,
                      borderColor: t.done ? colors.primary : colors.borderStrong,
                    },
                  ]}
                >
                  {t.done ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                </View>
                {i < timeline.length - 1 && (
                  <View style={[styles.timelineBar, { backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={{ flex: 1, paddingBottom: 18 }}>
                <Text
                  style={{
                    color: t.done ? colors.textMain : colors.textBody,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {t.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{fmtDate(t.date)}</Text>
              </View>
            </View>
          ))}
        </Card>

        <View style={{ height: 24 }} />
        {approved ? (
          <Card
            padding={16}
            style={{ backgroundColor: colors.success + "15", flexDirection: "row", alignItems: "center", gap: 12 }}
            testID="shareout-approved"
          >
            <Check size={22} color={colors.success} strokeWidth={2.5} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.success, fontWeight: "700", fontSize: 15 }}>
                Distribution plan approved
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {`${approvals} of ${adminCount} admins approved`}
              </Text>
            </View>
          </Card>
        ) : canApprove ? (
          <>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>
              {`${approvals} of ${requiredApprovals} required approvals`}
            </Text>
            <ProgressBar progress={requiredApprovals > 0 ? approvals / requiredApprovals : 0} />
            <View style={{ height: 12 }} />
            <Button
              label={approvals > 0 ? "Approval recorded" : "Approve distribution plan"}
              disabled={approvals > 0}
              onPress={handleApprove}
              testID="shareout-approve-btn"
            />
          </>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceSecondary,
              padding: 16,
              borderRadius: 16,
              gap: 12,
            }}
            testID="shareout-locked"
          >
            <Lock size={18} color={colors.textMuted} />
            <Text style={{ flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Only group admins can approve the distribution plan. Your current role is{" "}
              <Text style={{ fontWeight: "700", color: colors.textMain }}>{role}</Text>.
            </Text>
          </View>
        )}
        <View style={{ height: 10 }} />
        <Button
          label="View detailed report"
          variant="outline"
          onPress={() => router.push(`/reports?groupId=${activeGroupId}` as never)}
          testID="shareout-report-btn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginVertical: 12 },
  heroStats: { flexDirection: "row", marginTop: 18 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500", letterSpacing: 0.3 },
  heroStatVal: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 },
  heroDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 14 },
  allocRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  timelineRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16 },
  timelineLeft: { alignItems: "center", marginRight: 12 },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineBar: { width: 2, flex: 1, marginTop: 2 },
});
