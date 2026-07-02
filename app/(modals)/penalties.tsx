import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { ErrorState } from "@/src/components/common";
import { Card } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { SkeletonGroup } from "@/src/components/ui";
import { useTheme } from "@/src/theme/ThemeContext";
import { Penalty } from "@/src/types";
import { getPenalties } from "@/src/services/penalties";
import { formatZMW } from "@/src/utils/currency";

const VIOLATION_LABELS: Record<Penalty["violationType"], string> = {
  lateContribution: "Late contribution",
  missingMeeting: "Missing meeting",
  lateRepayment: "Late repayment",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface GroupSection {
  groupId: string;
  groupName: string;
  penalties: Penalty[];
}

export default function Penalties() {
  const { colors } = useTheme();
  const router = useRouter();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getPenalties({ mine: true });
      setPenalties(data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const sections = useMemo<GroupSection[]>(() => {
    const byGroup = new Map<string, GroupSection>();
    penalties.forEach((p) => {
      if (!byGroup.has(p.groupId)) {
        byGroup.set(p.groupId, { groupId: p.groupId, groupName: p.groupName, penalties: [] });
      }
      byGroup.get(p.groupId)!.penalties.push(p);
    });
    const result = Array.from(byGroup.values());
    result.forEach((section) => {
      section.penalties.sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    result.sort((a, b) => a.groupName.localeCompare(b.groupName));
    return result;
  }, [penalties]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="penalties-screen"
    >
      <ScreenHeader title="Penalties" subtitle="Outstanding and paid" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <SkeletonGroup count={4} height={84} />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : sections.length === 0 ? (
          <Card>
            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
              No penalties — nice work
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              You&apos;re all caught up across your groups.
            </Text>
          </Card>
        ) : (
          sections.map((section) => (
            <View key={section.groupId} style={{ marginBottom: 20 }}>
              <Text style={[styles.groupLabel, { color: colors.textMuted }]}>
                {section.groupName}
              </Text>
              {section.penalties.map((p) => (
                <PenaltyCard
                  key={p.id}
                  penalty={p}
                  colors={colors}
                  onPress={
                    p.status === "pending"
                      ? () =>
                          router.push({
                            pathname: "/penalty-pay",
                            params: {
                              penaltyId: p.id,
                              amount: String(p.amount),
                              reason: p.reason,
                              groupName: p.groupName,
                            },
                          })
                      : undefined
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const PenaltyCard = ({
  penalty,
  colors,
  onPress,
}: {
  penalty: Penalty;
  colors: ReturnType<typeof useTheme>["colors"];
  onPress?: () => void;
}) => {
  const isPending = penalty.status === "pending";
  const card = (
    <Card padding={14} style={{ marginBottom: 10, opacity: isPending ? 1 : 0.6 }}>
      <View style={styles.rowBetween}>
        <Text
          style={{ color: colors.textMain, fontWeight: "700", fontSize: 15, flex: 1, marginRight: 8 }}
          numberOfLines={1}
        >
          {penalty.reason}
        </Text>
        <StatusBadge
          label={isPending ? "Pending" : "Paid"}
          variant={isPending ? "warning" : "neutral"}
          testID={`penalty-status-${penalty.id}`}
        />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
        {VIOLATION_LABELS[penalty.violationType]}
      </Text>
      <View style={[styles.rowBetween, { marginTop: 12 }]}>
        <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16 }}>
          {formatZMW(penalty.amount)}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDate(penalty.createdAt)}</Text>
      </View>
    </Card>
  );

  if (!onPress) return card;

  return (
    <Pressable onPress={onPress} testID={`penalty-card-${penalty.id}`}>
      {card}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 4 },
  groupLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
