import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { SkeletonGroup } from "@/src/components/ui";
import { ErrorState } from "@/src/components/common";
import { TransactionRow } from "@/src/components/common/TransactionRow";
import { getTransactions } from "@/src/services/transactions";
import { TxnItem } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { Search, SlidersHorizontal, Download, FileText, FileSpreadsheet } from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const DATE_RANGES: { key: "all" | "week" | "month" | "3months"; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "3months", label: "Last 3 months" },
];

function isInRange(dateStr: string, range: "all" | "week" | "month" | "3months"): boolean {
  if (range === "all") return true;
  const now = new Date();
  const txDate = new Date(dateStr);
  if (isNaN(txDate.getTime())) return true;
  const diffMs = now.getTime() - txDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (range === "week") return diffDays <= 7;
  if (range === "month") return diffDays <= 30;
  if (range === "3months") return diffDays <= 90;
  return true;
}

const FILTERS: { key: TxnItem["type"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "contribution", label: "Contributions" },
  { key: "loan", label: "Loans" },
  { key: "repayment", label: "Repayments" },
  { key: "share-out", label: "Share-outs" },
  { key: "withdrawal", label: "Withdrawals" },
];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [transactions, setTransactions] = useState<TxnItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setTransactions(await getTransactions());
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

  const [filter, setFilter] = useState<TxnItem["type"] | "all">("all");
  const [dateRange, setDateRange] = useState<"all" | "week" | "month" | "3months">("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = filter === "all" || t.type === filter;
      const matchDate = isInRange(t.date, dateRange);
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        t.groupName.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.note ?? "").toLowerCase().includes(q);
      return matchType && matchDate && matchQ;
    });
  }, [transactions, filter, dateRange, query]);

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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="transactions-screen"
    >
      <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <View>
          <Text style={[styles.title, { color: colors.textMain }]}>Transactions</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            All your contributions, loans and share-outs
          </Text>
        </View>
        <Pressable
          onPress={() => setExportOpen(true)}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
          testID="transactions-export-btn"
        >
          <Download size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Search size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search transactions..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: colors.textMain }]}
            testID="transactions-search"
          />
        </View>
        <Pressable
          style={[styles.filterBtn, { backgroundColor: filterOpen || dateRange !== "all" ? colors.primary : colors.surfaceSecondary }]}
          onPress={() => setFilterOpen((o) => !o)}
          testID="transactions-filter-btn"
        >
          <SlidersHorizontal size={18} color={filterOpen || dateRange !== "all" ? "#fff" : colors.textMain} />
          {dateRange !== "all" && !filterOpen && (
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          )}
        </Pressable>
      </View>

      {filterOpen && (
        <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.filterPanelLabel, { color: colors.textMuted }]}>DATE RANGE</Text>
          <View style={styles.filterChipsWrap}>
            {DATE_RANGES.map((item) => {
              const active = item.key === dateRange;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setDateRange(item.key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  testID={`txn-date-${item.key}`}
                >
                  <Text style={[styles.chipText, { color: active ? "#fff" : colors.textMain }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {(dateRange !== "all" || filter !== "all") && (
            <Pressable
              onPress={() => { setDateRange("all"); setFilter("all"); setFilterOpen(false); }}
              testID="txn-clear-filters"
            >
              <Text style={[styles.clearBtn, { color: colors.danger }]}>Clear filters</Text>
            </Pressable>
          )}
        </View>
      )}

      <View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = item.key === filter;
            return (
              <Pressable
                onPress={() => setFilter(item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                testID={`txn-filter-${item.key}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#fff" : colors.textMain },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={{ marginHorizontal: 20, marginTop: 12 }}>
          <SkeletonGroup count={6} height={72} />
        </View>
      ) : error ? (
        <ErrorState onRetry={handleRetry} />
      ) : (
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.textMain }]}>No transactions</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Try adjusting your filters or search term.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card padding={0} style={{ paddingHorizontal: 14 }}>
            <TransactionRow
              txn={item}
              testID={`txn-row-${index}`}
              onPress={() => router.push({ pathname: "/receipt", params: { id: item.id } })}
            />
          </Card>
        )}
      />
      )}
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  sub: { fontSize: 13, marginTop: 4 },
  searchWrap: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14 },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    top: 10,
    right: 10,
  },
  filterPanel: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPanelLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  filterChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  clearBtn: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 6 },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: "center" },
});
