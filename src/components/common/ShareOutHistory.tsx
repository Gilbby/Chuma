/**
 * Every share-out the group has ever run, newest first.
 *
 * This is where a finished distribution lives. The share-out screen only ever
 * shows the run in progress, so once a cycle closes the record of what it paid
 * has to be somewhere permanent — and "what did we each get last year" is a
 * question a savings group asks constantly, of the whole group, not just the
 * treasurer. Every member sees every row.
 *
 * A run opens to its member-by-member detail in place. Nobody wants a second
 * screen to answer "and how much did Grace get".
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Card } from "@/src/components/ui/Card";
import { Avatar } from "@/src/components/ui/Avatar";
import { useTheme } from "@/src/theme/ThemeContext";
import { getShareOutHistory, ShareOutRun, ShareOutPayout } from "@/src/services/shareOut";
import { formatZMW } from "@/src/utils/currency";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  HandCoins,
  Smartphone,
  Clock,
  AlertTriangle,
  Check,
} from "lucide-react-native";

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

/** What happened to one member's money, in the past tense. */
function PayoutOutcome({
  p,
  colors,
}: {
  p: ShareOutPayout;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const line = (Icon: any, color: string, text: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
      <Icon size={11} color={color} strokeWidth={2.5} />
      <Text style={{ color, fontSize: 11, fontWeight: "600", marginLeft: 4 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );

  if (p.status === "failed") return line(AlertTriangle, colors.danger, "Payout failed");
  if (p.status === "pending") return line(Clock, colors.warning, "Not paid yet");
  // Their whole share went to their own loan, so there was never anything to
  // hand over — say that rather than claiming we paid them nothing.
  if (p.amount <= 0 && p.appliedToLoan > 0)
    return line(Check, colors.textMuted, "Cleared against their loan");
  return line(
    Check,
    colors.success,
    [p.paymentMethod || (p.viaMobileMoney ? "Mobile wallet" : "Paid"), p.confirmedByName]
      .filter(Boolean)
      .join(" · ")
  );
}

export function ShareOutHistory({ groupId }: { groupId?: string }) {
  const { colors } = useTheme();
  const [runs, setRuns] = useState<ShareOutRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState("");

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
        Past distributions, member by member
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
            const open = openId === run.shareOutId;
            const MethodIcon = run.method === "manual" ? HandCoins : Smartphone;
            return (
              <View
                key={run.shareOutId}
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}
              >
                <Pressable
                  onPress={() => setOpenId(open ? "" : run.shareOutId)}
                  testID={`shareout-history-run-${run.shareOutId}`}
                  style={({ pressed }) => [styles.runRow, { opacity: pressed ? 0.7 : 1 }]}
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
                  {open ? (
                    <ChevronDown size={18} color={colors.textMuted} />
                  ) : (
                    <ChevronRight size={18} color={colors.textMuted} />
                  )}
                </Pressable>

                {open ? (
                  <View
                    style={{ paddingBottom: 14 }}
                    testID={`shareout-history-detail-${run.shareOutId}`}
                  >
                    <View style={[styles.summary, { backgroundColor: colors.surfaceSecondary }]}>
                      <SummaryCell
                        label="Distributed"
                        value={formatZMW(run.totalPaid, { compact: true })}
                        colors={colors}
                      />
                      <SummaryCell
                        label="Owed"
                        value={formatZMW(run.totalOwed, { compact: true })}
                        colors={colors}
                      />
                      {/* Loans netted out of shares never left the group, so the
                          two totals above only reconcile once this is shown. */}
                      <SummaryCell
                        label="To loans"
                        value={formatZMW(run.totalAppliedToLoans, { compact: true })}
                        colors={colors}
                        last
                      />
                    </View>

                    {run.payouts.map((p) => (
                      <View key={p.transactionId} style={styles.memberRow}>
                        <Avatar name={p.memberName} size={32} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            style={{ color: colors.textMain, fontWeight: "600", fontSize: 13 }}
                          >
                            {p.memberName}
                          </Text>
                          <PayoutOutcome p={p} colors={colors} />
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={{ color: colors.textMain, fontWeight: "700", fontSize: 13 }}
                          >
                            {formatZMW(p.amount)}
                          </Text>
                          {p.appliedToLoan > 0 ? (
                            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                              {`${formatZMW(p.appliedToLoan, { compact: true })} to loan`}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const SummaryCell = ({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
  last?: boolean;
}) => (
  <View style={[{ flex: 1 }, !last && { borderRightWidth: 1, borderRightColor: colors.border }]}>
    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: "600", letterSpacing: 0.3 }}>
      {label.toUpperCase()}
    </Text>
    <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "700", marginTop: 2 }}>
      {value}
    </Text>
  </View>
);

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
  summary: {
    flexDirection: "row",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 6,
  },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
});
