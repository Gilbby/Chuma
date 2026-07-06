import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { Avatar } from "@/src/components/ui/Avatar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { computeShareOut, estimateGroupProfit, getMyShare, proposeShareOut } from "@/src/services/shareOut";
import { getApprovals, getRequiredApprovals, voteOnApproval } from "@/src/services/approvals";
import { getGroups } from "@/src/services/groups";
import { getPenalties } from "@/src/services/penalties";
import { getCurrentUser } from "@/src/utils/currentUser";
import { Group, Penalty, Approval } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { usePricingPreview, PayoutPreview } from "@/src/hooks/usePricingPreview";
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

  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const activeGroupId = groupId ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [myUserId, setMyUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [shareOutApproval, setShareOutApproval] = useState<Approval | null>(null);
  const [voting, setVoting] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [justApproved, setJustApproved] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, p, user, approvalsForGroup] = await Promise.all([
        getGroups(),
        getPenalties({ groupId: activeGroupId }),
        getCurrentUser<{ _id: string }>(),
        getApprovals({ groupId: activeGroupId }),
      ]);
      setGroups(g);
      setPenalties(p);
      setMyUserId(user?._id ? String(user._id) : "");
      setShareOutApproval(approvalsForGroup.find((a) => a.type === "share-out") ?? null);
    } finally {
      setLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => {
    load();
  }, [load]);

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
    : 0;

  const members = group
    ? (group.members ?? []).map((m: any) => ({
        id: String(m.userId ?? m.id), name: m.name, contribution: m.savings,
      }))
    : [];

  const result = computeShareOut(members, computedProfit);

  const myId = myUserId;
  const myShare = getMyShare(result.members, myId);

  // What the CURRENT member will actually receive after fees, computed by the
  // server (never on the client). Debounced; only runs once we know their share.
  const {
    data: payout,
    loading: payoutLoading,
    error: payoutError,
  } = usePricingPreview<PayoutPreview>("payout", myShare, { enabled: myShare > 0 });

  function formatShareOutDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const displayDate = group?.shareOutDate
    ? formatShareOutDate(group.shareOutDate)
    : "";
  const displayName = group?.name ?? "";

  const shareOutISO = group?.shareOutDate ?? "";
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

  const votesFor = shareOutApproval?.votesFor ?? 0;
  const required = shareOutApproval?.totalVoters ?? requiredApprovals;
  const approved = shareOutApproval?.status === "approved" || justApproved;

  const handleApprove = async () => {
    setVoting(true);
    setApprovalError("");
    try {
      let approval = shareOutApproval;
      let approvalId = approval?.id;

      if (!approvalId) {
        // no pending approval yet — propose one, then re-fetch to get its id
        try {
          await proposeShareOut(activeGroupId);
        } catch (e: any) {
          // "Share-out already pending" is fine — it means one exists; fall through to re-fetch
          if (!String(e?.message || "").toLowerCase().includes("already pending")) throw e;
        }
        const list = await getApprovals({ groupId: activeGroupId });
        approval = list.find((a) => a.type === "share-out") ?? null;
        setShareOutApproval(approval);
        approvalId = approval?.id;
      }
      if (!approvalId) throw new Error("Could not create share-out approval.");

      const priorVotesFor = approval?.votesFor ?? 0;
      const priorRequired = approval?.totalVoters ?? requiredApprovals;

      await voteOnApproval(approvalId, "approve");
      setHasVoted(true);

      // re-fetch to reflect new vote count / possible approval+execution
      const refreshed = await getApprovals({ groupId: activeGroupId });
      const updated = refreshed.find((a) => a.type === "share-out") ?? null;

      if (updated) {
        setShareOutApproval(updated);
      } else if (priorVotesFor + 1 >= priorRequired) {
        // Backend GET /approvals returns pending only — a missing result right
        // after our deciding vote means it was approved and executed.
        setJustApproved(true);
        setShareOutApproval(
          approval ? { ...approval, votesFor: priorVotesFor + 1, status: "approved" } : approval
        );
      } else {
        setShareOutApproval(null);
      }
    } catch (e: any) {
      setApprovalError(e?.message || "Could not record approval. Please try again.");
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="shareout-screen">
        <ScreenHeader title="Share-out" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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

        {/* What the current member actually receives after fees */}
        {myShare > 0 && (
          <Card padding={18} style={{ marginTop: 16 }} testID="shareout-net-receive">
            {payoutLoading && !payout ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Calculating what you&apos;ll receive…
                </Text>
              </View>
            ) : payoutError ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }} testID="shareout-net-error">
                Couldn&apos;t load your payout breakdown. Try again shortly.
              </Text>
            ) : payout?.tooSmall ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }} testID="shareout-net-toosmall">
                This amount is too small to pay out after fees.
              </Text>
            ) : payout ? (
              <>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 0.3 }}>
                  YOU&apos;LL RECEIVE
                </Text>
                <Text style={{ color: colors.textMain, fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginTop: 4 }}>
                  {formatZMW(payout.netReceived)}
                </Text>
                <View style={[styles.netDivider, { backgroundColor: colors.border }]} />
                <NetRow label="Owed" value={formatZMW(payout.owed)} colors={colors} />
                <NetRow label="Transaction fee" value={formatZMW(payout.transactionFee)} colors={colors} />
                <NetRow label="Platform fee" value={formatZMW(payout.platformFee)} colors={colors} />
                <NetRow label="You receive" value={formatZMW(payout.netReceived)} colors={colors} last />
              </>
            ) : null}
          </Card>
        )}

        {/* Allocations */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>MEMBER ALLOCATIONS</Text>
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
                {`${votesFor} of ${required} approvals`}
              </Text>
            </View>
          </Card>
        ) : canApprove ? (
          <>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>
              {`${votesFor} of ${required} required approvals`}
            </Text>
            <ProgressBar progress={required > 0 ? votesFor / required : 0} />
            <View style={{ height: 12 }} />
            {approvalError ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }} testID="shareout-approve-error">
                {approvalError}
              </Text>
            ) : null}
            <Button
              label={voting ? "Recording…" : hasVoted ? "Approval recorded" : "Approve distribution plan"}
              disabled={voting || hasVoted}
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

const NetRow = ({
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
      { paddingVertical: 10, flexDirection: "row", justifyContent: "space-between" },
      !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
    ]}
  >
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
    <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "600" }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  netDivider: { height: 1, marginVertical: 12 },
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
