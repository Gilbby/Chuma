import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Dimensions, Modal, Alert, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { LineChart, BarChart } from "@/src/components/charts/Charts";
import { useTheme } from "@/src/theme/ThemeContext";
import { savingsTrend, groups, loans, transactions } from "@/src/data/mock";
import { getRepaymentRate, getSavingsGrowth } from "@/src/services/groupStats";
import { formatZMW } from "@/src/utils/currency";
import { TrendingUp, TrendingDown, Users, Banknote, Download, FileText, FileSpreadsheet } from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const { width } = Dimensions.get("window");

export default function Reports() {
  const { colors } = useTheme();
  const chartW = width - 40 - 32;
  const [exportOpen, setExportOpen] = useState(false);
  const data = transactions;

  const primaryGroup = groups[0];
  const trendData =
    (primaryGroup as typeof primaryGroup & { trend?: typeof savingsTrend })?.trend ??
    savingsTrend;

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

  // TODO: when backend tracks on-time contribution history,
  // replace the derived rate with the real consistency %
  const topMembers = [...(primaryGroup?.members ?? [])]
    .sort((a, b) => (b.contributions ?? 0) - (a.contributions ?? 0))
    .slice(0, 5)
    .map((m) => ({
      name: m.name,
      rate: Math.min(100, 70 + (m.contributions ?? 0)),
    }));

  async function handleExportPDF() {
    try {
      const rows = data.map((t) => `
        <tr>
          <td>${t.date}</td>
          <td style="text-transform:capitalize">${t.type}</td>
          <td>${t.groupName}</td>
          <td>${t.amount < 0 ? "-" : "+"}${formatZMW(Math.abs(t.amount))}</td>
          <td style="text-transform:capitalize">${t.status}</td>
        </tr>
      `).join("");
      const html = `
        <html><head><style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
          h1 { font-size: 22px; color: #1a5c38; margin-bottom: 4px; }
          p { font-size: 12px; color: #666; margin: 0 0 24px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #1a5c38; color: white; padding: 10px 12px; text-align: left; }
          td { padding: 9px 12px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .footer { margin-top: 24px; font-size: 11px; color: #999; }
        </style></head>
        <body>
          <h1>Chuma — Transaction Statement</h1>
          <p>Generated on ${new Date().toLocaleDateString("en-ZM", { day: "numeric", month: "long", year: "numeric" })} · ${data.length} transactions</p>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Group</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="footer">This is an auto-generated statement from the Chuma village banking app.</p>
        </body></html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Save or share your statement", UTI: "com.adobe.pdf" });
    } catch (e) {
      Alert.alert("Export failed", "Could not generate PDF. Please try again.");
    }
  }

  async function handleExportCSV() {
    try {
      const header = "Date,Type,Group,Amount,Status,Note\n";
      const rows = data.map((t) =>
        [t.date, t.type, `"${t.groupName}"`, t.amount, t.status, `"${t.note ?? ""}"`].join(",")
      ).join("\n");
      await Share.share({ title: "Chuma Transaction Export", message: header + rows });
    } catch (e) {
      Alert.alert("Export failed", "Could not export CSV. Please try again.");
    }
  }

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
          {/* TODO: backend — derive from disbursed loans this quarter */}
          <KpiCard
            icon={<Banknote size={18} color={colors.primary} />}
            label="Loans issued"
            value={formatZMW(56000, { compact: true })}
            sub="this quarter"
            colors={colors}
          />
        </View>
        <View style={[styles.kpiRow, { marginTop: 12 }]}>
          {/* TODO: backend — derive default rate from overdue loans */}
          <KpiCard
            icon={<TrendingDown size={18} color={colors.danger} />}
            label="Default rate"
            value="1.2%"
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

        {/* Loan analytics — TODO: backend, quarterly issuance isn't derivable from current mock */}
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
            {topMembers.map((p, i) => (
              <View key={i} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontWeight: "700", width: 24 }}>#{i + 1}</Text>
                <Text style={{ color: colors.textMain, fontWeight: "600", flex: 1 }}>{p.name}</Text>
                <Text style={{ color: colors.success, fontWeight: "700" }}>{p.rate}%</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
      <Modal
        visible={exportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setExportOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setExportOpen(false)} />
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
          <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>Export transactions</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 20 }}>Download your transaction history as a file</Text>
          <Card padding={0}>
            <Pressable
              onPress={handleExportPDF}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
              testID="export-pdf-btn"
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.danger + "15", alignItems: "center", justifyContent: "center" }}>
                <FileText size={20} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>Export as PDF</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Formatted statement, ready to print or share</Text>
              </View>
              <Download size={18} color={colors.textMuted} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Pressable
              onPress={handleExportCSV}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
              testID="export-csv-btn"
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.success + "15", alignItems: "center", justifyContent: "center" }}>
                <FileSpreadsheet size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>Export as CSV</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Spreadsheet format, opens in Excel or Sheets</Text>
              </View>
              <Download size={18} color={colors.textMuted} />
            </Pressable>
          </Card>
          <Button variant="ghost" fullWidth style={{ marginTop: 16 }} onPress={() => setExportOpen(false)}>Cancel</Button>
        </View>
      </Modal>
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
