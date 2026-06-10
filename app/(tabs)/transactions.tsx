import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { TransactionRow } from "@/src/components/common/TransactionRow";
import { transactions } from "@/src/data/mock";
import { TxnItem } from "@/src/types";
import { Search, SlidersHorizontal } from "lucide-react-native";

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
  const [filter, setFilter] = useState<TxnItem["type"] | "all">("all");
  const [dateRange, setDateRange] = useState<"all" | "week" | "month" | "3months">("all");
  const [filterOpen, setFilterOpen] = useState(false);
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
  }, [filter, dateRange, query]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="transactions-screen"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textMain }]}>Transactions</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          All your contributions, loans and share-outs
        </Text>
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
