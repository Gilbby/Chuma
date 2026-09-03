/**
 * Every share-out the group has ever run, newest first.
 *
 * This is where a finished distribution lives. The share-out screen only ever
 * shows the run in progress, so once a cycle closes the record of what it paid
 * has to be somewhere permanent — and "what did we each get last year" is a
 * question a savings group asks constantly, of the whole group, not just the
 * treasurer. Every member sees every row.
 *
 * A run opens its own screen rather than unfolding here. Unfolding reads well
 * for a group of six and collapses at thirty: the members bury every other run,
 * there is nowhere to search, and getting back to the list means scrolling past
 * everyone. Summary rows only — the payouts are fetched a run at a time.
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/src/components/ui/Card";
import { useTheme } from "@/src/theme/ThemeContext";
import { getShareOutHistory, ShareOutRun } from "@/src/services/shareOut";
import { formatZMW } from "@/src/utils/currency";
import { ChevronRight, Sparkles, HandCoins, Smartphone } from "lucide-react-native";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ShareOutHistory({ groupId }: { groupId?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [runs, setRuns] = useState<ShareOutRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!groupId) {
      setRuns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRuns(await getShareOutHistory(groupId));
    } catch {
      // A group that has never distributed is not an error, and neither is a
      // reports screen that cannot reach this one endpoint. Show nothing.
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card padding={20} style={{ marginTop: 14 }} testID="shareout-history">
      <Text style={[styles.cardTitle, { color: colors.textMain }]}>Share-out history</Text>
      <Text style={[styles.cardSub, { color: colors.textMuted }]}>
        Past distributions — open one to see who got what
      </Text>

      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : runs.length === 0 ? (
        <Text
          style={{ color: colors.textMuted, fontSize: 13, marginTop: 14 }}
          testID="shareout-history-empty"
        >
          This group hasn&apos;t run a share-out yet. When a cycle closes, the full
          breakdown appears here.
        </Text>
      ) : (
        <View style={{ marginTop: 8 }}>
          {runs.map((run, i) => {
            const MethodIcon = run.method === "manual" ? HandCoins : Smartphone;
            return (
              <Pressable
                key={run.shareOutId}
                onPress={() =>
                  router.push(
                    `/share-out-run?groupId=${groupId}&shareOutId=${run.shareOutId}` as never
                  )
                }
                testID={`shareout-history-run-${run.shareOutId}`}
                style={({ pressed }) => [
                  styles.runRow,
                  i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null,
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
                          ? fmtDate(run.completedAt) || fmtDate(run.startedAt)
                          : `${run.totals.paid} of ${run.totals.count} paid — in progress`
                      }`}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  cardSub: { fontSize: 12, marginTop: 4 },
  runRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  runIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
