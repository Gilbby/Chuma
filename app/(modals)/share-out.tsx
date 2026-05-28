import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { Avatar } from "@/src/components/ui/Avatar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { useTheme } from "@/src/theme/ThemeContext";
import { shareOut } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { useRole } from "@/src/contexts/RoleContext";
import { Sparkles, Check, Calendar, TrendingUp, Lock } from "lucide-react-native";

const timeline = [
  { date: "Sep 12, 2026", title: "Final cycle contributions due", done: true },
  { date: "Sep 30, 2026", title: "Outstanding loans recovered", done: true },
  { date: "Oct 10, 2026", title: "Group audit & report", done: false },
  { date: "Oct 25, 2026", title: "Share-out approval vote", done: false },
  { date: "Oct 30, 2026", title: "Distribution to members", done: false },
];

export default function ShareOutScreen() {
  const { colors } = useTheme();
  const { role, can } = useRole();
  const canApprove = can("approve.shareout");
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="shareout-screen"
    >
      <ScreenHeader title="Share-out" subtitle={shareOut.groupName} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <Card
          padding={22}
          style={{ backgroundColor: colors.primary, borderColor: colors.primary }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Sparkles size={20} color="#fff" />
            <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", marginLeft: 8 }}>
              ANNUAL SHARE-OUT
            </Text>
          </View>
          <Text style={{ color: "#fff", fontSize: 32, fontWeight: "700", marginTop: 12, letterSpacing: -0.5 }}>
            {formatZMW(shareOut.totalToDistribute)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
            Distribution on {shareOut.date}
          </Text>
          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatLabel}>Savings</Text>
              <Text style={styles.heroStatVal}>{formatZMW(shareOut.totalSavings, { compact: true })}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroStatLabel}>Profit</Text>
              <Text style={styles.heroStatVal}>{formatZMW(shareOut.profit, { compact: true })}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroStatLabel}>Your share</Text>
              <Text style={styles.heroStatVal}>{formatZMW(shareOut.yourShare, { compact: true })}</Text>
            </View>
          </View>
        </Card>

        {/* Allocations */}
        <Text style={[styles.label, { color: colors.textMuted }]}>MEMBER ALLOCATIONS</Text>
        <Card padding={0}>
          {shareOut.members.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.allocRow,
                i < shareOut.members.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Avatar name={m.name} size={36} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>
                  {m.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  Contributed {formatZMW(m.contribution, { compact: true })}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.textMain, fontWeight: "700" }}>
                  {formatZMW(m.share)}
                </Text>
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600", marginTop: 2 }}>
                  +{(((m.share - m.contribution) / m.contribution) * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Timeline */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>
          DISTRIBUTION TIMELINE
        </Text>
        <Card padding={0}>
          {timeline.map((t, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    {
                      backgroundColor: t.done ? colors.primary : colors.surface,
                      borderColor: t.done ? colors.primary : colors.borderStrong,
                    },
                  ]}
                >
                  {t.done ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
                </View>
                {i < timeline.length - 1 && (
                  <View style={[styles.timelineBar, { backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={{ flex: 1, paddingBottom: 18 }}>
                <Text
                  style={{
                    color: t.done ? colors.textMain : colors.textBody,
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {t.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{t.date}</Text>
              </View>
            </View>
          ))}
        </Card>

        <View style={{ height: 24 }} />
        {canApprove ? (
          <Button label="Approve distribution plan" testID="shareout-approve-btn" />
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceSecondary,
              padding: 16,
              borderRadius: 16,
              gap: 12,
            }}
            testID="shareout-locked"
          >
            <Lock size={18} color={colors.textMuted} />
            <Text style={{ flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Only the Chairperson can approve the distribution plan. Your current role is{" "}
              <Text style={{ fontWeight: "700", color: colors.textMain }}>{role}</Text>.
            </Text>
          </View>
        )}
        <View style={{ height: 10 }} />
        <Button label="View detailed report" variant="outline" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginVertical: 12 },
  heroStats: { flexDirection: "row", marginTop: 18 },
  heroStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500", letterSpacing: 0.3 },
  heroStatVal: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 },
  heroDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 14 },
  allocRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  timelineRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16 },
  timelineLeft: { alignItems: "center", marginRight: 12 },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineBar: { width: 2, flex: 1, marginTop: 2 },
});
