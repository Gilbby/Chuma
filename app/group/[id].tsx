import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Avatar } from "@/src/components/ui/Avatar";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { Button } from "@/src/components/ui/Button";
import { groups, approvals, transactions } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { Member } from "@/src/types";
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
  Coins,
} from "lucide-react-native";

type TabKey = "members" | "contributions" | "loans" | "approvals" | "reports" | "governance";

export default function GroupDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("members");

  const group = useMemo(() => groups.find((g) => g.id === id) ?? groups[0], [id]);
  const groupApprovals = approvals.filter((a) => a.groupId === group.id);
  const groupTxn = transactions.filter((t) => t.groupId === group.id);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="group-details-screen"
    >
      <ScreenHeader title={group.name} subtitle={`${group.memberCount} members`} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
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
            <View style={styles.row}>
              <RuleRow
                icon={<Coins size={18} color={colors.primary} />}
                label="Contribution"
                value={`${formatZMW(group.contributionAmount)} · ${group.contributionFrequency}`}
                colors={colors}
              />
            </View>
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
                <View key={m.id}>
                  <MemberRow member={m} colors={colors} />
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
            <Card padding={16}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                ACTIVE LOANS IN GROUP
              </Text>
              <View style={{ marginTop: 8 }}>
                <LoanLine name="Chisomo Banda" amount={4500} balance={2250} colors={colors} />
                <LoanLine name="Mwansa Tembo" amount={3200} balance={1067} colors={colors} />
                <LoanLine name="Thandiwe Zulu" amount={5800} balance={4350} colors={colors} />
              </View>
            </Card>
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
    </SafeAreaView>
  );
}

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
