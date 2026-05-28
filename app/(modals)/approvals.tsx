import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { approvals as initial } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { useRole } from "@/src/contexts/RoleContext";
import { Banknote, Wallet, Scale, ShieldCheck, Check, X, Info } from "lucide-react-native";

const TYPE_ICONS = {
  loan: Banknote,
  withdrawal: Wallet,
  "rule-change": Scale,
  "admin-action": ShieldCheck,
};

export default function Approvals() {
  const { colors } = useTheme();
  const { role, can } = useRole();
  const canVote = can("vote");
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const data = items.filter((i) => (filter === "pending" ? i.status === "pending" : true));

  const vote = (id: string, action: "approve" | "reject") => {
    setItems((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const votesFor = action === "approve" ? a.votesFor + 1 : a.votesFor;
        const votesAgainst = action === "reject" ? a.votesAgainst + 1 : a.votesAgainst;
        const threshold = Math.ceil(a.totalVoters * 0.6);
        let status = a.status;
        if (votesFor >= threshold) status = "approved";
        else if (votesAgainst > a.totalVoters - threshold) status = "rejected";
        return { ...a, votesFor, votesAgainst, status };
      }),
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="approvals-screen"
    >
      <ScreenHeader
        title="Approval center"
        subtitle={`${items.filter((i) => i.status === "pending").length} pending`}
      />
      <View style={styles.filters}>
        {(["pending", "all"] as const).map((f) => {
          const active = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              testID={`approvals-filter-${f}`}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600" }}>
                {f === "pending" ? "Pending" : "All"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {data.length === 0 && (
          <Card padding={28} style={{ alignItems: "center" }}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Check size={28} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16, marginTop: 12 }}>
              All caught up
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" }}>
              No approvals waiting. We&apos;ll notify you when new requests come in.
            </Text>
          </Card>
        )}

        {data.map((a) => {
          const Icon = TYPE_ICONS[a.type];
          const progress = a.totalVoters === 0 ? 0 : a.votesFor / a.totalVoters;
          const isPending = a.status === "pending";
          const statusVariant =
            a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning";
          return (
            <Card key={a.id} padding={18} style={{ marginBottom: 12 }}>
              <View style={styles.cardHead}>
                <View style={[styles.typeIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                    {a.title}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {a.requestedBy} · {a.timestamp}
                  </Text>
                </View>
                <StatusBadge label={a.status} variant={statusVariant} />
              </View>

              <Text style={{ color: colors.textBody, fontSize: 13, marginTop: 10, lineHeight: 20 }}>
                {a.description}
              </Text>

              {a.amount ? (
                <View style={[styles.amountBox, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                    REQUESTED AMOUNT
                  </Text>
                  <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 20, marginTop: 2 }}>
                    {formatZMW(a.amount)}
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: 14 }}>
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>
                    {a.votesFor} APPROVED · {a.votesAgainst} REJECTED
                  </Text>
                  <Text style={{ color: colors.textMain, fontSize: 12, fontWeight: "700" }}>
                    {a.votesFor + a.votesAgainst}/{a.totalVoters}
                  </Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <ProgressBar progress={progress} />
                </View>
              </View>

              {a.type === "withdrawal" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 10,
                    backgroundColor: colors.surfaceSecondary,
                    padding: 10,
                    borderRadius: 10,
                    gap: 8,
                  }}
                >
                  <Info size={14} color={colors.warning} />
                  <Text style={{ flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16 }}>
                    Withdrawals require Treasurer co-signature in addition to member votes.
                    {role === "Treasurer" ? " You can co-sign this." : ""}
                  </Text>
                </View>
              ) : null}

              {isPending ? (
                <View style={styles.actions}>
                  <Button
                    label="Reject"
                    variant="outline"
                    onPress={() => vote(a.id, "reject")}
                    size="md"
                    fullWidth={false}
                    disabled={!canVote}
                    style={{ flex: 1, marginRight: 8 }}
                    icon={<X size={16} color={colors.primary} />}
                    testID={`approval-reject-${a.id}`}
                  />
                  <Button
                    label={role === "Chairperson" && a.votesFor + 1 >= Math.ceil(a.totalVoters * 0.6) ? "Final approve" : "Approve"}
                    onPress={() => vote(a.id, "approve")}
                    size="md"
                    fullWidth={false}
                    disabled={!canVote}
                    style={{ flex: 1, marginLeft: 8 }}
                    icon={<Check size={16} color="#fff" />}
                    testID={`approval-approve-${a.id}`}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 18,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  amountBox: { padding: 14, borderRadius: 14, marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actions: { flexDirection: "row", marginTop: 16 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
