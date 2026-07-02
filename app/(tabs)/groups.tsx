import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { SkeletonGroup } from "@/src/components/ui";
import { ErrorState } from "@/src/components/common";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { getGroups, acceptInvite } from "@/src/services/groups";
import { getNotifications, markNotificationRead } from "@/src/services/notifications";
import { Group, Notice } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { Users, Plus, ChevronRight } from "lucide-react-native";

export default function Groups() {
  const { colors } = useTheme();
  const router = useRouter();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [g, notifs] = await Promise.all([getGroups(), getNotifications()]);
      setGroups(g);
      setInvites(notifs.filter((n) => n.type === "invite" && !n.read));
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const pendingInvites = invites.filter((n) => !dismissed.includes(n.id));
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
          onPress={() => router.push("/(modals)/create-group")}
          testID="groups-add-btn"
        >
          <Plus size={20} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ marginHorizontal: 20, marginTop: 12 }}>
          <SkeletonGroup count={4} height={120} />
        </View>
      ) : error ? (
        <ErrorState onRetry={handleRetry} />
      ) : (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {pendingInvites.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              PENDING INVITATIONS
            </Text>
            {pendingInvites.map((inv) => (
              <Card key={inv.id} padding={14} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.inviteIcon, { backgroundColor: colors.primarySoft }]}>
                    <Users size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                      {inv.groupName}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Invited by {inv.invitedBy}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button
                      label="Decline"
                      variant="outline"
                      size="sm"
                      fullWidth={false}
                      onPress={async () => {
                        try {
                          await markNotificationRead(inv.id);
                        } catch {}
                        setDismissed((d) => [...d, inv.id]);
                      }}
                      testID={`invite-decline-${inv.id}`}
                    />
                    <Button
                      label="Accept"
                      variant="primary"
                      size="sm"
                      fullWidth={false}
                      onPress={async () => {
                        try {
                          if (inv.groupId) await acceptInvite(inv.groupId);
                          await markNotificationRead(inv.id);
                          setDismissed((d) => [...d, inv.id]);
                          await load();
                        } catch (e) {
                          Alert.alert("Could not join", "Please try again.");
                        }
                      }}
                      testID={`invite-accept-${inv.id}`}
                    />
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
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

      </ScrollView>
      )}
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
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  inviteIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
