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
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = filter === "all" || t.type === filter;
      const q = query.trim().toLowerCase();
      const matchQ =
        !q ||
        t.groupName.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.note ?? "").toLowerCase().includes(q);
      return matchType && matchQ;
    });
  }, [filter, query]);

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
          style={[styles.filterBtn, { backgroundColor: colors.surfaceSecondary }]}
          testID="transactions-filter-btn"
        >
          <SlidersHorizontal size={18} color={colors.textMain} />
        </Pressable>
      </View>

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
        ItemSeparatorComponent={() => (
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.textMain }]}>No transactions</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Try a different filter or search term.
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
  sep: { height: 10, backgroundColor: "transparent" },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, marginTop: 6, textAlign: "center" },
});
