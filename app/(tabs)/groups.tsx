import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { groups } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { Users, Plus, ChevronRight } from "lucide-react-native";

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="groups-screen"
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textMain }]}>My Groups</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {groups.length} active chuma groups
          </Text>
        </View>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          testID="groups-add-btn"
        >
          <Plus size={20} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {groups.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => router.push(`/group/${g.id}`)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            testID={`group-card-${g.id}`}
          >
            <Card padding={18} style={{ marginBottom: 14 }}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={[
                        styles.groupIcon,
                        { backgroundColor: colors.primarySoft },
                      ]}
                    >
                      <Users size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.groupName, { color: colors.textMain }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text
                        style={[styles.groupSub, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {g.contributionFrequency} · {formatZMW(g.contributionAmount)}
                      </Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </View>

              <View style={styles.stats}>
                <Stat label="Pool" value={formatZMW(g.totalSavings, { compact: true })} muted={colors.textMuted} main={colors.textMain} />
                <Stat label="Members" value={String(g.memberCount)} muted={colors.textMuted} main={colors.textMain} />
                <Stat label="Loans out" value={formatZMW(g.loanCirculation, { compact: true })} muted={colors.textMuted} main={colors.textMain} />
              </View>

              <View style={{ marginTop: 14 }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.cycleLabel, { color: colors.textMuted }]}>
                    Cycle progress
                  </Text>
                  <Text style={[styles.cycleValue, { color: colors.textMain }]}>
                    {Math.round(g.cycleProgress * 100)}%
                  </Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <ProgressBar progress={g.cycleProgress} />
                </View>
              </View>

              <View style={{ flexDirection: "row", marginTop: 14 }}>
                <StatusBadge label={g.yourRole} variant="primary" />
                <View style={{ width: 8 }} />
                <StatusBadge label={`Share-out · ${g.shareOutDate}`} variant="neutral" />
              </View>
            </Card>
          </Pressable>
        ))}

        <Pressable
          onPress={() => router.push("/(tabs)/groups")}
          style={({ pressed }) => [
            styles.discover,
            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Plus size={18} color={colors.primary} />
          <Text style={[styles.discoverText, { color: colors.primary }]}>
            Create or join a new group
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const Stat = ({
  label,
  value,
  main,
  muted,
}: {
  label: string;
  value: string;
  main: string;
  muted: string;
}) => (
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 11, color: muted, fontWeight: "600", letterSpacing: 0.3 }}>
      {label}
    </Text>
    <Text style={{ fontSize: 15, fontWeight: "700", marginTop: 4, color: main }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  sub: { fontSize: 13, marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupName: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  groupSub: { fontSize: 12, marginTop: 2 },
  stats: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "transparent",
  },
  cycleLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  cycleValue: { fontSize: 13, fontWeight: "700" },
  discover: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    gap: 8,
  },
  discoverText: { fontSize: 14, fontWeight: "600", marginLeft: 8 },
});
