import React from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { LineChart, BarChart } from "@/src/components/charts/Charts";
import { useTheme } from "@/src/theme/ThemeContext";
import { savingsTrend, repaymentRate, groups } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { TrendingUp, TrendingDown, Users, Banknote } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function Reports() {
  const { colors } = useTheme();
  const chartW = width - 40 - 32; // padding outside + card padding

  const loanAnalytics = [
    { label: "Q1", value: 32 },
    { label: "Q2", value: 41 },
    { label: "Q3", value: 38 },
    { label: "Q4", value: 56 },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="reports-screen"
    >
      <ScreenHeader title="Reports" subtitle="Group performance analytics" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <KpiCard
            icon={<TrendingUp size={18} color={colors.success} />}
            label="Savings growth"
            value="+18.4%"
            sub="vs last quarter"
            colors={colors}
          />
          <View style={{ width: 12 }} />
          <KpiCard
            icon={<Banknote size={18} color={colors.primary} />}
            label="Loans issued"
            value={formatZMW(56000, { compact: true })}
            sub="this quarter"
            colors={colors}
          />
        </View>
        <View style={[styles.kpiRow, { marginTop: 12 }]}>
          <KpiCard
            icon={<TrendingDown size={18} color={colors.danger} />}
            label="Default rate"
            value="1.2%"
            sub="≤ 5% target"
            colors={colors}
          />
          <View style={{ width: 12 }} />
          <KpiCard
            icon={<Users size={18} color={colors.info} />}
            label="Member retention"
            value="96%"
            sub="last 12 months"
            colors={colors}
          />
        </View>

        {/* Savings trend chart */}
        <Card padding={20} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: colors.textMain }]}>Savings trend</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>
            Monthly group savings (K thousands)
          </Text>
          <View style={{ marginTop: 14 }}>
            <LineChart data={savingsTrend} width={chartW} height={170} />
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
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>By group (% on-time)</Text>
          <View style={{ marginTop: 18 }}>
            {repaymentRate.map((r, i) => (
              <View key={i} style={{ marginBottom: 14 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.textMain, fontWeight: "600" }}>
                    {groups[i]?.name ?? r.label}
                  </Text>
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
            {[
              { name: "Gilbert (you)", rate: 100 },
              { name: "Chisomo Banda", rate: 98 },
              { name: "Natasha Phiri", rate: 96 },
              { name: "John Mwale", rate: 91 },
              { name: "Mwansa Tembo", rate: 86 },
            ].map((p, i) => (
              <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontWeight: "700", width: 24 }}>#{i + 1}</Text>
                <Text style={{ color: colors.textMain, fontWeight: "600", flex: 1 }}>{p.name}</Text>
                <Text style={{ color: colors.success, fontWeight: "700" }}>{p.rate}%</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
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
