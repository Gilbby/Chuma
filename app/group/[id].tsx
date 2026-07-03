import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Linking,
  Alert,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { useRole } from "@/src/hooks/useRole";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Avatar } from "@/src/components/ui/Avatar";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Button } from "@/src/components/ui/Button";
import { SkeletonGroup } from "@/src/components/ui";
import { ErrorState } from "@/src/components/common";
import { getGroupById, inviteMember } from "@/src/services/groups";
import { getApprovals } from "@/src/services/approvals";
import { getGroupTransactions } from "@/src/services/transactions";
import { getLoans } from "@/src/services/loans";
import { formatZMW } from "@/src/utils/currency";
import { isGroupLocked, getMonthsOwed, getAmountOwed } from "@/src/services/groupFees";
import { Member, Group, Approval, TxnItem, Loan } from "@/src/types";
import * as Clipboard from "expo-clipboard";
import {
  Users,
  Calendar,
  TrendingUp,
  Wallet,
  ChevronRight,
  Crown,
  ClipboardCheck,
  FileBarChart,
  Scale,
  CircleDollarSign,
  Phone,
  AlertTriangle,
  UserMinus,
  UserPlus,
  Plus,
  Lock,
  ArrowLeft,
} from "lucide-react-native";

type TabKey = "members" | "contributions" | "loans" | "approvals" | "reports" | "governance";

export default function GroupDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("members");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePhone, setInvitePhone] = useState("+260 ");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  const { role } = useRole();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groupApprovals, setGroupApprovals] = useState<Approval[]>([]);
  const [groupTxn, setGroupTxn] = useState<TxnItem[]>([]);
  const [groupLoans, setGroupLoans] = useState<Loan[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const g = await getGroupById(id);
      if (g) {
        setGroup(g);
        const a = await getApprovals({ groupId: id });
        setGroupApprovals(a);
        try {
          const [txns, lns] = await Promise.all([
            getGroupTransactions(id),
            getLoans({ groupId: id }),
          ]);
          setGroupTxn(txns);
          setGroupLoans(lns);
        } catch {
          setGroupTxn([]);
          setGroupLoans([]);
        }
      } else {
        setError(true);
      }
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const cycleStatus = useMemo(() =>
    (group?.members ?? []).map((m, i) => {
      const seed = (i * 7) % 10;
      const status: "paid" | "overdue" | "pending" =
        seed < 6 ? "paid" : seed < 8 ? "overdue" : "pending";
      return { member: m, status };
    }),
    [group]
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ marginHorizontal: 20, marginTop: 12 }}>
          <SkeletonGroup count={5} height={80} />
        </View>
      </SafeAreaView>
    );
  }
  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <ErrorState onRetry={load} />
      </SafeAreaView>
    );
  }

  const locked = group.feeStatus?.locked ?? isGroupLocked(group);
  const monthsOwed = group.feeStatus?.monthsOwed ?? getMonthsOwed(group);
  const amountOwed = group.feeStatus?.amountOwed ?? getAmountOwed(group);
  const effectiveRole = role ?? group.yourRole;
  const canPayFee =
    effectiveRole === "Chairperson" ||
    effectiveRole === "Treasurer";

  const paidCount = cycleStatus.filter((c) => c.status === "paid").length;
  const overdueCount = cycleStatus.filter((c) => c.status === "overdue").length;
  const pendingCount = cycleStatus.filter((c) => c.status === "pending").length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="group-details-screen"
    >
      <ScreenHeader
        title={group.name}
        subtitle={`${group.memberCount} members`}
        rightAction={
          tab === "members" ? (
            <Pressable
              style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
              onPress={() => setInviteOpen((v) => !v)}
              testID="members-invite-btn"
            >
              <Plus size={18} color="#fff" strokeWidth={2.4} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Financial overview */}
        <View style={{ paddingHorizontal: 20 }}>
          <Card padding={20} style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
            <Text style={styles.heroLabel}>Total group savings</Text>
            <Text style={styles.heroAmount}>{formatZMW(group.totalSavings)}</Text>
            <View style={styles.heroRow}>
              <HeroStat label="Wallet" value={formatZMW(group.walletBalance, { compact: true })} />
              <View style={styles.divider} />
              <HeroStat label="Loans out" value={formatZMW(group.loanCirculation, { compact: true })} />
              <View style={styles.divider} />
              <HeroStat label="Members" value={String(group.memberCount)} />
            </View>
          </Card>
        </View>

        {/* Rules summary */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <Card padding={16}>
            <RuleRow
              icon={<CircleDollarSign size={18} color={colors.primary} />}
              label="Contribution"
              value={`${formatZMW(group.contributionAmount)} · ${group.contributionFrequency}`}
              colors={colors}
            />
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <RuleRow
              icon={<TrendingUp size={18} color={colors.primary} />}
              label="Loan interest"
              value={`${group.loanInterestRate}% / month · up to ${group.loanMaxMultiplier}x savings`}
              colors={colors}
            />
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
            <RuleRow
              icon={<Calendar size={18} color={colors.primary} />}
              label="Share-out"
              value={group.shareOutDate}
              colors={colors}
            />
          </Card>
        </View>

        {/* Cycle progress */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <Card padding={16}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                Contribution cycle
              </Text>
              <Text style={[styles.cardValue, { color: colors.textMain }]}>
                {Math.round(group.cycleProgress * 100)}% complete
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <ProgressBar progress={group.cycleProgress} />
            </View>
          </Card>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {(
            [
              { k: "members", label: "Members" },
              { k: "contributions", label: "Contributions" },
              { k: "loans", label: "Loans" },
              { k: "approvals", label: "Approvals" },
              { k: "reports", label: "Reports" },
              { k: "governance", label: "Governance" },
            ] as { k: TabKey; label: string }[]
          ).map((t) => {
            const active = tab === t.k;
            return (
              <Pressable
                key={t.k}
                onPress={() => setTab(t.k)}
                style={[
                  styles.tab,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  },
                ]}
                testID={`group-tab-${t.k}`}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? "#fff" : colors.textMain },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tab content */}
        {tab === "members" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Card padding={0}>
              {group.members.slice(0, 12).map((m, i) => (
                <View key={m.userId ?? m.id ?? m.phone ?? String(i)}>
                  <Pressable
                    onPress={() => { setSelectedMember(m); setSheetVisible(true); }}
                    testID={`member-row-${m.userId ?? m.id ?? m.phone}`}
                  >
                    <MemberRow member={m} colors={colors} />
                  </Pressable>
                  {i < 11 && <View style={[styles.sep, { backgroundColor: colors.border, marginHorizontal: 16 }]} />}
                </View>
              ))}
            </Card>
            <Text style={[styles.helperText, { color: colors.textMuted }]}>
              Showing 12 of {group.memberCount} members
            </Text>
          </View>
        )}

        {tab === "contributions" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Button
              label="Make a contribution"
              onPress={() => router.push("/contribute")}
              testID="group-contribute-btn"
            />
            <View style={{ height: 16 }} />

            {/* Cycle status summary */}
            <Card padding={16} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <StatusSummaryCol count={paidCount} label="Paid" color={colors.success} />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <StatusSummaryCol count={overdueCount} label="Overdue" color={colors.danger} />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <StatusSummaryCol count={pendingCount} label="Pending" color={colors.warning} />
              </View>
            </Card>

            {/* Member grid */}
            <Card padding={16} style={{ marginBottom: 12 }}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                CONTRIBUTION STATUS THIS CYCLE
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {cycleStatus.map(({ member, status }, i) => {
                  const bg =
                    status === "paid"
                      ? colors.success
                      : status === "overdue"
                      ? colors.danger
                      : colors.warning;
                  const initials = member.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase();
                  const firstName = member.name.split(" ")[0];
                  return (
                    <View
                      key={member.userId ?? member.id ?? member.phone ?? String(i)}
                      style={{ width: 48, alignItems: "center" }}
                      testID={`contrib-chip-${member.userId ?? member.id ?? member.phone ?? i}`}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: bg,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                          {initials}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: 10,
                          marginTop: 4,
                          textAlign: "center",
                        }}
                        numberOfLines={1}
                      >
                        {firstName}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {/* Legend */}
              <View style={{ flexDirection: "row", gap: 14, marginTop: 14 }}>
                <LegendDot color={colors.success} label="Paid" colors={colors} />
                <LegendDot color={colors.danger} label="Overdue" colors={colors} />
                <LegendDot color={colors.warning} label="Pending" colors={colors} />
              </View>
              {role !== "Member" && (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontStyle: "italic",
                    marginTop: 10,
                    lineHeight: 17,
                  }}
                >
                  Overdue members will be automatically flagged for a penalty at cycle end.
                </Text>
              )}
            </Card>

            <Card padding={16}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                THIS CYCLE
              </Text>
              {groupTxn
                .filter((t) => t.type === "contribution")
                .slice(0, 5)
                .map((t) => (
                  <View key={t.id} style={[styles.contribRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>
                        {t.note ?? "Contribution"}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{t.date}</Text>
                    </View>
                    <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                      {formatZMW(t.amount)}
                    </Text>
                  </View>
                ))}
            </Card>
          </View>
        )}

        {tab === "loans" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Button
              label="Request a loan"
              onPress={() => router.push("/loan")}
              testID="group-loan-btn"
            />
            <View style={{ height: 14 }} />
            {groupLoans.length === 0 ? (
              <Card padding={20}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>No active loans</Text>
                <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
                  No members currently have active loans in this group.
                </Text>
              </Card>
            ) : (
              <Card padding={16}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  ACTIVE LOANS IN GROUP
                </Text>
                <View style={{ marginTop: 8 }}>
                  {groupLoans.map((loan) => (
                    <LoanLine
                      key={loan.id}
                      name={loan.memberName}
                      amount={loan.principal}
                      balance={loan.outstanding}
                      colors={colors}
                    />
                  ))}
                </View>
              </Card>
            )}
          </View>
        )}

        {tab === "approvals" && (
          <View style={{ paddingHorizontal: 20 }}>
            {groupApprovals.length === 0 ? (
              <Card padding={20}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>No pending approvals</Text>
                <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 13 }}>
                  This group is all caught up.
                </Text>
              </Card>
            ) : (
              groupApprovals.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => router.push("/approvals")}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginBottom: 12 }]}
                  testID={`group-approval-${a.id}`}
                >
                  <Card padding={16}>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                      {a.title}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {a.description}
                    </Text>
                    <View style={{ marginTop: 12 }}>
                      <ProgressBar
                        progress={a.votesFor / a.totalVoters}
                        color={colors.primary}
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                        {a.votesFor}/{a.totalVoters} approved
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
            <Button
              label="Open approval center"
              variant="outline"
              onPress={() => router.push("/approvals")}
            />
          </View>
        )}

        {tab === "reports" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Pressable onPress={() => router.push("/reports")} testID="group-reports-btn">
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <FileBarChart size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        View detailed reports
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        Savings trends, loan analytics, repayment rates
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
            <View style={{ height: 12 }} />
            <Pressable onPress={() => router.push("/share-out")} testID="group-shareout-btn">
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <Wallet size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        Share-out forecast
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        See projected member allocations
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          </View>
        )}

        {tab === "governance" && (
          <View style={{ paddingHorizontal: 20 }}>
            <Pressable onPress={() => router.push("/governance")} testID="group-governance-btn">
              <Card padding={18}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>
                      <Scale size={20} color={colors.primary} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                        Group rules & voting
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        Manage thresholds, propose changes
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          </View>
        )}
      </ScrollView>
      </View>

      <Modal
        visible={sheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => setSheetVisible(false)}
          />
          <ScrollView
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "80%",
            }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />
            {selectedMember && (
              <>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Avatar name={selectedMember.name} size={52} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 18 }}>
                      {selectedMember.name}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <StatusBadge
                        label={selectedMember.role}
                        variant={
                          selectedMember.role === "Chairperson"
                            ? "primary"
                            : selectedMember.role === "Treasurer"
                              ? "warning"
                              : selectedMember.role === "Secretary"
                                ? "info"
                                : "neutral"
                        }
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                      {selectedMember.phone}
                    </Text>
                  </View>
                  <Pressable onPress={() => Linking.openURL(`tel:${selectedMember.phone}`)}>
                    <Phone size={20} color={colors.primary} />
                  </Pressable>
                </View>

                {/* Savings */}
                <Card padding={16} style={{ marginTop: 20 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                    SAVINGS IN THIS GROUP
                  </Text>
                  <View style={{ flexDirection: "row", marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Total saved</Text>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                        {formatZMW(selectedMember.savings)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Contributions</Text>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                        {selectedMember.contributions}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Active loan</Text>
                      <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, marginTop: 4 }}>
                        {selectedMember.loanActive ? formatZMW(selectedMember.loanActive) : "None"}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Loan progress */}
                {selectedMember.loanActive != null && selectedMember.loanActive > 0 && (
                  <Card padding={16} style={{ marginTop: 12 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                      ACTIVE LOAN
                    </Text>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16, marginTop: 8 }}>
                      {formatZMW(selectedMember.loanActive)}
                    </Text>
                    <View style={{ marginTop: 8 }}>
                      <ProgressBar
                        progress={1 - selectedMember.loanActive / (selectedMember.loanActive * 1.5)}
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                      {formatZMW(selectedMember.loanActive)} remaining
                    </Text>
                  </Card>
                )}

                {/* Recent activity */}
                <Card padding={16} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                    RECENT ACTIVITY
                  </Text>
                  {(() => {
                    const memberTxns = groupTxn.filter(
                      (t) => String(t.memberId) === String(selectedMember.userId ?? selectedMember.id)
                    );
                    const display = memberTxns.length > 0 ? memberTxns.slice(0, 3) : groupTxn.slice(0, 3);
                    if (display.length === 0) {
                      return (
                        <Text style={{ color: colors.textMuted, marginTop: 10, fontSize: 13 }}>
                          No recent activity
                        </Text>
                      );
                    }
                    return display.map((t) => (
                      <View
                        key={t.id}
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          paddingVertical: 8,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t.date}</Text>
                        <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 13 }}>
                          {formatZMW(t.amount)}
                        </Text>
                      </View>
                    ));
                  })()}
                </Card>

                {/* Admin actions */}
                {group.yourRole !== "Member" && (
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginTop: 20, marginBottom: 8 }}>
                      ADMIN ACTIONS
                    </Text>
                    <Card padding={14} style={{ marginBottom: 10, backgroundColor: colors.surface }}>
                      <Pressable
                        style={{ flexDirection: "row", alignItems: "center" }}
                        onPress={() =>
                          Alert.alert(
                            "Coming soon",
                            "Violation recording will be available when the penalty system is built."
                          )
                        }
                        testID="member-violation-btn"
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.warning + "20", alignItems: "center", justifyContent: "center" }}>
                          <AlertTriangle size={20} color={colors.warning} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                            Record violation
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                            Issue a manual penalty to this member
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.textMuted} />
                      </Pressable>
                    </Card>
                    <Card padding={14} style={{ backgroundColor: colors.surface }}>
                      <Pressable
                        style={{ flexDirection: "row", alignItems: "center" }}
                        onPress={() =>
                          Alert.alert(
                            "Remove member",
                            `Remove ${selectedMember?.name} from ${group.name}?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => setSheetVisible(false),
                              },
                            ]
                          )
                        }
                        testID="member-remove-btn"
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.danger + "20", alignItems: "center", justifyContent: "center" }}>
                          <UserMinus size={20} color={colors.danger} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 14 }}>
                            Remove from group
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                            This member will lose access to the group
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.danger} />
                      </Pressable>
                    </Card>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={inviteOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => { setInviteOpen(false); setInvitePhone("+260 "); setInviteError(""); }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
            onPress={() => { setInviteOpen(false); setInvitePhone("+260 "); setInviteError(""); }}
          />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 18, marginBottom: 4 }}>
              Invite a member
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 24, lineHeight: 18 }}>
              Enter their Zambian phone number and we'll send them an SMS invitation to join {group.name}.
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 }}>
              PHONE NUMBER
            </Text>
            <TextInput
              placeholder="9XX XXX XXX"
              keyboardType="phone-pad"
              value={invitePhone}
              onChangeText={(v) => { setInvitePhone(v); setInviteError(""); }}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: inviteError ? colors.danger : colors.border,
                padding: 14,
                color: colors.textMain,
                fontSize: 16,
                backgroundColor: colors.surface,
                marginBottom: 6,
              }}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {inviteError ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>
                {inviteError}
              </Text>
            ) : (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 20, lineHeight: 18 }}>
                The invited person will receive an SMS and see your invitation in their Chuma app.
              </Text>
            )}
            <View style={{ height: inviteError ? 20 : 0 }} />
            <Button
              label="Send invite"
              loading={inviting}
              disabled={inviting}
              onPress={async () => {
                const digits = invitePhone.replace(/\D/g, "");
                if (digits.length < 12) {
                  setInviteError("Enter a valid Zambian number");
                  return;
                }
                setInviting(true);
                setInviteError("");
                try {
                  // send the normalized phone with country code; backend also normalizes
                  await inviteMember(id, invitePhone.trim());
                  Alert.alert(
                    "Invite sent",
                    `${invitePhone.trim()} has been invited. They'll see the invitation after signing up with this number.`
                  );
                  setInvitePhone("+260 ");
                  setInviteOpen(false);
                  await load(); // refresh so the pending member shows in the members list
                } catch (e: any) {
                  setInviteError(e?.message || "Could not send invite. Please try again.");
                } finally {
                  setInviting(false);
                }
              }}
              testID="members-invite-send-btn"
            />
          </View>
        </View>
      </Modal>

      {locked && (
        <View style={StyleSheet.absoluteFillObject}>
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
            {/* Back icon — top left, respects status bar */}
            <Pressable
              onPress={() => router.back()}
              testID="group-locked-back-btn"
              style={{
                position: "absolute",
                top: insets.top + 12,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
            </Pressable>

            {/* Centered lock content */}
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: insets.bottom }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={32} color={colors.textMuted} />
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 16,
                }}
              >
                Group locked
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 14,
                  textAlign: "center",
                  marginTop: 8,
                  paddingHorizontal: 32,
                  lineHeight: 21,
                }}
              >
                {canPayFee
                  ? `This group is suspended because the monthly fee is unpaid. Pay ${formatZMW(amountOwed)} (${monthsOwed} month${monthsOwed === 1 ? "" : "s"}) to reactivate it.`
                  : "This group is suspended pending the monthly fee payment from the group admins. Please check back soon."}
              </Text>
              {canPayFee && (
                <View style={{ marginTop: 24 }}>
                  <Button
                    label={`Pay ${formatZMW(amountOwed)} now`}
                    onPress={() => router.push(`/group-fee?groupId=${group.id}`)}
                    testID="group-pay-fee-btn"
                  />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const StatusSummaryCol = ({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={{ color, fontSize: 24, fontWeight: "700" }}>{count}</Text>
    <Text style={{ color, fontSize: 12, fontWeight: "600", marginTop: 2 }}>{label}</Text>
  </View>
);

const LegendDot = ({
  color,
  label,
  colors,
}: {
  color: string;
  label: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
  </View>
);

const HeroStat = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500", letterSpacing: 0.3 }}>
      {label}
    </Text>
    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 }}>{value}</Text>
  </View>
);

const RuleRow = ({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={styles.ruleRow}>
    <View style={[styles.iconSm, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
        {label}
      </Text>
      <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "600", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  </View>
);

const MemberRow = ({
  member,
  colors,
}: {
  member: Member;
  colors: ReturnType<typeof useTheme>["colors"];
}) => {
  const roleVariant: "primary" | "warning" | "info" | "neutral" =
    member.role === "Chairperson"
      ? "primary"
      : member.role === "Treasurer"
        ? "warning"
        : member.role === "Secretary"
          ? "info"
          : "neutral";
  return (
    <View style={styles.memberRow}>
      <Avatar name={member.name} size={40} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {formatZMW(member.savings, { compact: true })} saved
        </Text>
      </View>
      <StatusBadge label={member.role} variant={roleVariant} />
    </View>
  );
};

const LoanLine = ({
  name,
  amount,
  balance,
  colors,
}: {
  name: string;
  amount: number;
  balance: number;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.textMain, fontWeight: "600" }}>{name}</Text>
      <Text style={{ color: colors.textMain, fontWeight: "700" }}>{formatZMW(balance)}</Text>
    </View>
    <View style={{ marginTop: 8 }}>
      <ProgressBar progress={1 - balance / amount} />
    </View>
    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
      {formatZMW(balance)} remaining of {formatZMW(amount)}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  heroLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "500", letterSpacing: 0.3 },
  heroAmount: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 4, letterSpacing: -0.5 },
  heroRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  divider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 14 },
  row: { flexDirection: "row" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ruleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  iconSm: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sep: { height: 1, marginVertical: 4 },
  cardLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  cardValue: { fontSize: 13, fontWeight: "700" },
  tabsRow: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 },
  contribRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  helperText: { fontSize: 11, textAlign: "center", marginTop: 12 },
});
