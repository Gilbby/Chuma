import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Card } from "@/src/components/ui/Card";
import { SkeletonGroup } from "@/src/components/ui";
import { ScreenHeader, ErrorState, ExportSheet } from "@/src/components/common";
import { LineChart, BarChart } from "@/src/components/charts/Charts";
import { useTheme } from "@/src/theme/ThemeContext";
import { getGroups } from "@/src/services/groups";
import { getLoans } from "@/src/services/loans";
import { getTransactions } from "@/src/services/transactions";
import { getSavingsTrend, getGroupReport, GroupReport } from "@/src/services/reports";
import { getRepaymentRate, getSavingsGrowth } from "@/src/services/groupStats";
import { formatZMW } from "@/src/utils/currency";
import { Group, Loan, TxnItem } from "@/src/types";
import { exportTransactionsPdf, exportTransactionsCsv } from "@/src/utils/exports";
import { TrendingUp, TrendingDown, Users, Banknote, Download } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function Reports() {
  const { colors } = useTheme();
  const chartW = width - 40 - 32;
  const [exportOpen, setExportOpen] = useState(false);
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<TxnItem[]>([]);
  const [trendData, setTrendData] = useState<{ label: string; value: number }[]>([]);
  const [report, setReport] = useState<GroupReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [g, l, t] = await Promise.all([getGroups(), getLoans(), getTransactions()]);
      setGroups(g);
      setLoans(l);
      setTransactions(t);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = transactions;

  const primaryGroup = groupId
    ? groups.find((g) => g.id === groupId) ?? groups[0]
    : groups[0];

  useEffect(() => {
    if (!primaryGroup?.id) {
      setTrendData([]);
      setReport(null);
      return;
    }
    getSavingsTrend(primaryGroup.id)
      .then(setTrendData)
      .catch(() => setTrendData([]));
    getGroupReport(primaryGroup.id)
      .then(setReport)
      .catch(() => setReport(null));
  }, [primaryGroup?.id]);

  const repaymentByGroup = groups.map((g) => ({
    name: g.name,
    value: getRepaymentRate(g, loans),
  }));

  const avgRepayment = Math.round(
    repaymentByGroup.reduce((s, r) => s + r.value, 0) /
    (repaymentByGroup.length || 1)
  );

  const savingsGrowthPct = getSavingsGrowth(primaryGroup);

  const avgRetention = groups.length
    ? Math.round(
        groups.reduce((s, g) => s + (g.memberRetention ?? 0), 0) / groups.length
      )
    : 0;

  // Real on-time consistency % computed by the backend from contribution
  // history; rate is null until a member has a completed contribution window
  const topMembers = [...(report?.memberConsistency ?? [])]
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.contributions - a.contributions)
    .slice(0, 5);

  // Disbursements binned into the trailing 4 calendar quarters (oldest → current)
  const loanAnalytics = (() => {
    const now = new Date();
    const curQ = Math.floor(now.getMonth() / 3); // 0-3
    const curY = now.getFullYear();
    return Array.from({ length: 4 }, (_, idx) => {
      const i = 3 - idx; // quarters back from current: 3,2,1,0
      let q = curQ - i;
      let y = curY;
      while (q < 0) {
        q += 4;
        y -= 1;
      }
      const start = new Date(y, q * 3, 1);
      const end = new Date(y, q * 3 + 3, 1); // exclusive upper bound
      const total = loans.reduce((sum, loan) => {
        return (
          sum +
          loan.history.reduce((s, h) => {
            if (h.type !== "disbursement") return s;
            const d = new Date(h.date);
            return d >= start && d < end ? s + h.amount : s;
          }, 0)
        );
      }, 0);
      return { label: `Q${q + 1}`, value: Math.round(total / 1000) };
    });
  })();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="reports-screen">
        <ScreenHeader title="Reports" subtitle="Group performance analytics" />
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <SkeletonGroup count={4} height={120} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="reports-screen">
        <ScreenHeader title="Reports" subtitle="Group performance analytics" />
        <ErrorState onRetry={load} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="reports-screen"
    >
      <ScreenHeader
        title="Reports"
        subtitle="Group performance analytics"
        rightAction={
          <Pressable
            onPress={() => setExportOpen(true)}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
            testID="reports-export-btn"
          >
            <Download size={18} color={colors.primary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <KpiCard
            icon={<TrendingUp size={18} color={colors.success} />}
            label="Savings growth"
            value={`${savingsGrowthPct >= 0 ? "+" : ""}${savingsGrowthPct}%`}
            sub="vs last month"
            colors={colors}
          />
          <View style={{ width: 12 }} />
          <KpiCard
            icon={<Banknote size={18} color={colors.primary} />}
            label="Loans issued"
            value={formatZMW(report?.loansIssuedThisQuarter ?? 0, { compact: true })}
            sub="this quarter"
            colors={colors}
          />
        </View>
        <View style={[styles.kpiRow, { marginTop: 12 }]}>
          <KpiCard
            icon={<TrendingDown size={18} color={colors.danger} />}
            label="Default rate"
            value={`${report?.defaultRate ?? 0}%`}
            sub="≤ 5% target"
            colors={colors}
          />
          <View style={{ width: 12 }} />
          {/* Retention per group; backend will compute from real join/leave events */}
          <KpiCard
            icon={<Users size={18} color={colors.info} />}
            label="Member retention"
            value={`${avgRetention}%`}
            sub="last 12 months"
            colors={colors}
          />
        </View>

        {/* Savings trend chart */}
        <Card padding={20} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: colors.textMain }]}>Savings trend</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>
            {`Monthly savings · ${primaryGroup?.name ?? ""} (K'000)`}
          </Text>
          <View style={{ marginTop: 14 }}>
            <LineChart data={trendData} width={chartW} height={170} />
          </View>
        </Card>

        {/* Loan analytics */}
        <Card padding={20} style={{ marginTop: 14 }}>
          <Text style={[styles.cardTitle, { color: colors.textMain }]}>Loans issued</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>By quarter (K thousands)</Text>
          <View style={{ marginTop: 14 }}>
            <BarChart data={loanAnalytics} width={chartW} height={170} />
          </View>
        </Card>

        {/* Repayment rate by group */}
        <Card padding={20} style={{ marginTop: 14 }}>
          <Text style={[styles.cardTitle, { color: colors.textMain }]}>Repayment rate</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>
            {`By group (% on-time) · avg ${avgRepayment}%`}
          </Text>
          <View style={{ marginTop: 18 }}>
            {repaymentByGroup.map((r, i) => (
              <View key={i} style={{ marginBottom: 14 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.textMain, fontWeight: "600" }}>{r.name}</Text>
                  <Text style={{ color: colors.textMain, fontWeight: "700" }}>{r.value}%</Text>
                </View>
                <View style={{ marginTop: 6, height: 8, borderRadius: 999, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>
                  <View
                    style={{
                      height: 8,
                      width: `${r.value}%`,
                      backgroundColor:
                        r.value > 90 ? colors.success : r.value > 80 ? colors.warning : colors.danger,
                      borderRadius: 999,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Consistency table */}
        <Card padding={20} style={{ marginTop: 14, marginBottom: 24 }}>
          <Text style={[styles.cardTitle, { color: colors.textMain }]}>Contribution consistency</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>Top performing members</Text>
          <View style={{ marginTop: 14 }}>
            {topMembers.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                No contribution history yet
              </Text>
            ) : (
              topMembers.map((p, i) => (
                <View key={p.userId} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted, fontWeight: "700", width: 24 }}>#{i + 1}</Text>
                  <Text style={{ color: colors.textMain, fontWeight: "600", flex: 1 }}>{p.name}</Text>
                  <Text style={{ color: p.rate == null ? colors.textMuted : colors.success, fontWeight: "700" }}>
                    {p.rate == null ? "—" : `${p.rate}%`}
                  </Text>
                </View>
              ))
            )}
          </View>
        </Card>
      </ScrollView>
      <ExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export transactions"
        subtitle="Download your transaction history as a file"
        onPdf={() => exportTransactionsPdf(data)}
        onCsv={() => exportTransactionsCsv(data)}
      />
    </SafeAreaView>
  );
}

const KpiCard = ({
  icon,
  label,
  value,
  sub,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <Card padding={16} style={{ flex: 1 }}>
    <View style={[styles.kpiIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 10, letterSpacing: 0.3 }}>
      {label.toUpperCase()}
    </Text>
    <Text style={{ color: colors.textMain, fontSize: 22, fontWeight: "700", marginTop: 4, letterSpacing: -0.4 }}>
      {value}
    </Text>
    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{sub}</Text>
  </Card>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  kpiRow: { flexDirection: "row" },
  kpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  cardSub: { fontSize: 12, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
});
