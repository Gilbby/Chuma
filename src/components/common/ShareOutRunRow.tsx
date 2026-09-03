/**
 * One past share-out as a summary line: what it paid, to how many, and when.
 *
 * Shared by the short list on the reports tab and the full list screen so the
 * two never drift — a member who taps a run from either place has already read
 * the same row, and lands on the same breakdown.
 */
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { ShareOutRun } from "@/src/services/shareOut";
import { formatZMW } from "@/src/utils/currency";
import { ChevronRight, Sparkles, HandCoins, Smartphone } from "lucide-react-native";

export function formatRunDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ShareOutRunRow({
  run,
  groupId,
  divider,
}: {
  run: ShareOutRun;
  groupId?: string;
  divider?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const MethodIcon = run.method === "manual" ? HandCoins : Smartphone;

  return (
    <Pressable
      onPress={() =>
        router.push(
          `/share-out-run?groupId=${groupId ?? ""}&shareOutId=${run.shareOutId}` as never
        )
      }
      testID={`shareout-history-run-${run.shareOutId}`}
      style={({ pressed }) => [
        styles.runRow,
        divider ? { borderTopWidth: 1, borderTopColor: colors.border } : null,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.runIcon, { backgroundColor: colors.primarySoft }]}>
        <Sparkles size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
          {formatZMW(run.totalPaid)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
          <MethodIcon size={11} color={colors.textMuted} strokeWidth={2.2} />
          <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 4 }}>
            {`${run.memberCount} member${run.memberCount === 1 ? "" : "s"} · ${
              run.closed
                ? formatRunDate(run.completedAt) || formatRunDate(run.startedAt)
                : `${run.totals.paid} of ${run.totals.count} paid — in progress`
            }`}
          </Text>
        </View>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  runRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  runIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
