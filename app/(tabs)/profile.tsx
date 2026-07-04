import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Switch, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import {
  Moon,
  Sun,
  KeyRound,
  Fingerprint,
  Bell,
  ShieldCheck,
  HelpCircle,
  LogOut,
  ChevronRight,
  Users,
  AlertTriangle,
  Pencil,
  Info,
  TrendingUp,
  TrendingDown,
} from "lucide-react-native";
import { getGroups } from "@/src/services/groups";
import { getPenalties } from "@/src/services/penalties";
import { logout } from "@/src/services/auth";
import { getCurrentUser } from "@/src/utils/currentUser";
import { Role, Group, Penalty } from "@/src/types";
import { getTrustScore, getTrustBand } from "@/src/services/trustScore";
import { useRole } from "@/src/contexts/RoleContext";

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const router = useRouter();
  const { role, setRole, description } = useRole();
  const [bio, setBio] = React.useState(true);
  const [notif, setNotif] = React.useState(true);
  const [trustOpen, setTrustOpen] = useState(false);

  const [me, setMe] = useState<any>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [myUserId, setMyUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser<any>();
      setMe(user);
      setMyUserId(user?._id ? String(user._id) : "");
      const [g, p] = await Promise.all([getGroups(), getPenalties({ mine: true })]);
      setGroups(g);
      setPenalties(p);
    } catch {
      // leave defaults; screen still renders
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const myContributions = groups.reduce((sum, g) => {
    const meMember = (g.members ?? []).find((m: any) => String(m.userId) === myUserId);
    return sum + (meMember?.contributions ?? 0);
  }, 0);
  const myActiveLoan = groups.reduce((sum, g) => {
    const meMember = (g.members ?? []).find((m: any) => String(m.userId) === myUserId);
    return sum + (meMember?.loanActive ?? 0);
  }, 0);
  const myPenaltyCount = penalties.filter((p) => p.status === "pending").length;

  const trustScore = getTrustScore(
    { contributions: myContributions, loanActive: myActiveLoan },
    myPenaltyCount
  );
  const trustBand = getTrustBand(trustScore);

  const bandColor = {
    excellent: colors.success,
    good: colors.primary,
    fair: colors.warning,
    low: colors.danger,
  }[trustBand.band];

  const memberSince = (() => {
    const d = new Date(me?.joinedDate ?? "");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  })();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="profile-screen">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textMain }]}>Profile</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="profile-screen"
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textMain }]}>Profile</Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Card padding={18}>
            <View style={{ position: "relative" }}>
              <View style={styles.profileRow}>
                <Image source={{ uri: me?.avatar }} style={styles.avatar} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.name, { color: colors.textMain }]}>{me?.name ?? "—"}</Text>
                  <Text style={[styles.phone, { color: colors.textMuted }]}>{me?.phone ?? "—"}</Text>
                  <View style={{ marginTop: 8, flexDirection: "row" }}>
                    <StatusBadge label={role} variant="primary" testID="profile-role-badge" />
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => router.push("/edit-profile")}
                testID="profile-edit-btn"
                style={{ position: "absolute", top: 0, right: 0 }}
              >
                <Pencil size={18} color={colors.primary} />
              </Pressable>
            </View>

            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              <Stat label="Groups" value={String(groups.length)} muted={colors.textMuted} main={colors.textMain} />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <Stat label="Member since" value={memberSince} muted={colors.textMuted} main={colors.textMain} />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <Stat
                label="Trust score"
                value={String(trustScore)}
                muted={colors.textMuted}
                main={colors.textMain}
                onPress={() => setTrustOpen(true)}
                icon={<Info size={12} color={colors.textMuted} />}
              />
            </View>
          </Card>
        </View>

        <Section title="Security" colors={colors}>
          <Row
            icon={<KeyRound size={20} color={colors.primary} />}
            label="Change PIN"
            colors={colors}
            onPress={() => router.push("/pin")}
            testID="profile-pin-row"
          />
          <Row
            icon={<Fingerprint size={20} color={colors.primary} />}
            label="Biometric login"
            colors={colors}
            right={
              <Switch
                value={bio}
                onValueChange={setBio}
                trackColor={{ false: colors.border, true: colors.primaryAccent }}
                thumbColor="#fff"
                testID="profile-biometric-switch"
              />
            }
          />
          <Row
            icon={<ShieldCheck size={20} color={colors.primary} />}
            label="Privacy & security"
            colors={colors}
          />
        </Section>

        <Section title="Preferences" colors={colors}>
          <Row
            icon={
              mode === "light" ? (
                <Moon size={20} color={colors.primary} />
              ) : (
                <Sun size={20} color={colors.primary} />
              )
            }
            label={mode === "light" ? "Dark mode" : "Light mode"}
            colors={colors}
            right={
              <Switch
                value={mode === "dark"}
                onValueChange={toggle}
                trackColor={{ false: colors.border, true: colors.primaryAccent }}
                thumbColor="#fff"
                testID="profile-darkmode-switch"
              />
            }
          />
          <Row
            icon={<Bell size={20} color={colors.primary} />}
            label="Notifications"
            colors={colors}
            right={
              <Switch
                value={notif}
                onValueChange={setNotif}
                trackColor={{ false: colors.border, true: colors.primaryAccent }}
                thumbColor="#fff"
                testID="profile-notif-switch"
              />
            }
          />
        </Section>

        {__DEV__ && (
          <Section title="Demo role" colors={colors}>
            <View style={{ padding: 14 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
                {description}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["Chairperson", "Treasurer", "Secretary", "Member"] as Role[]).map((r) => {
                  const active = r === role;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      testID={`profile-role-${r.toLowerCase()}`}
                      style={[
                        {
                          paddingHorizontal: 14,
                          height: 36,
                          borderRadius: 999,
                          borderWidth: 1,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 6,
                          marginBottom: 6,
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? "#fff" : colors.textMain, fontWeight: "600", fontSize: 13 }}>
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Section>
        )}

        <Section title="Activity" colors={colors}>
          <Row
            icon={<Users size={20} color={colors.primary} />}
            label="My groups"
            colors={colors}
            onPress={() => router.push("/(tabs)/groups")}
          />
          <Row
            icon={<AlertTriangle size={20} color={colors.primary} />}
            label="Penalties"
            colors={colors}
            onPress={() => router.push("/penalties")}
            testID="profile-penalties-row"
            right={
              myPenaltyCount > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <StatusBadge label={String(myPenaltyCount)} variant="warning" testID="profile-penalties-badge" />
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              ) : undefined
            }
          />
          <Row
            icon={<HelpCircle size={20} color={colors.primary} />}
            label="Help & support"
            colors={colors}
            onPress={() => router.push("/help")}
            testID="profile-help-row"
          />
        </Section>

        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Pressable
            style={[
              styles.logoutBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={async () => {
              await logout(); // clear stored token + user before leaving
              router.replace("/welcome");
            }}
            testID="profile-logout-btn"
          >
            <LogOut size={18} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>Chuma v1.0 · Built with care</Text>
      </ScrollView>

      <Modal
        visible={trustOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTrustOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setTrustOpen(false)} />
          <View style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "85%",
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 20 }} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Score display */}
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 48, fontWeight: "800", color: bandColor }}>{trustScore}</Text>
                <Text style={{ color: bandColor, fontWeight: "700", fontSize: 15 }}>{trustBand.label}</Text>
                <View style={{ width: "100%", marginTop: 12 }}>
                  <ProgressBar progress={trustScore / 100} />
                </View>
              </View>

              {/* What it means */}
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textMain, marginTop: 24, marginBottom: 8 }}>
                What is a trust score?
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 21 }}>
                Your trust score reflects how reliable you are as a village banking member. It is based on your history of contributing on time and repaying loans. A higher score builds confidence with your group and can improve your borrowing power.
              </Text>

              {/* What raises it */}
              <Text style={[styles.sheetLabel, { color: colors.textMuted, marginTop: 20 }]}>
                WHAT RAISES YOUR SCORE
              </Text>
              {[
                "Contributing on time every cycle",
                "Repaying loans on or before the due date",
                "Staying active in your groups",
              ].map((text) => (
                <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <TrendingUp size={18} color={colors.success} />
                  <Text style={{ color: colors.textMain, fontSize: 14, flex: 1 }}>{text}</Text>
                </View>
              ))}

              {/* What lowers it */}
              <Text style={[styles.sheetLabel, { color: colors.textMuted, marginTop: 20 }]}>
                WHAT LOWERS YOUR SCORE
              </Text>
              {[
                "Missing or paying contributions late",
                "Late or missed loan repayments",
                "Incurring penalties from your group",
              ].map((text) => (
                <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <TrendingDown size={18} color={colors.danger} />
                  <Text style={{ color: colors.textMain, fontSize: 14, flex: 1 }}>{text}</Text>
                </View>
              ))}

              {/* Score bands */}
              <Text style={[styles.sheetLabel, { color: colors.textMuted, marginTop: 20 }]}>
                SCORE BANDS
              </Text>
              <Card padding={14}>
                {[
                  { dot: colors.success, range: "80–100", label: "Excellent" },
                  { dot: colors.primary, range: "60–79", label: "Good" },
                  { dot: colors.warning, range: "40–59", label: "Fair" },
                  { dot: colors.danger, range: "Below 40", label: "Needs improvement" },
                ].map((band, i, arr) => (
                  <View
                    key={band.range}
                    style={[
                      { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
                      i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: band.dot }} />
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14, minWidth: 76 }}>{band.range}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>{band.label}</Text>
                  </View>
                ))}
              </Card>

              <Button
                label="Got it"
                onPress={() => setTrustOpen(false)}
                testID="trust-score-close-btn"
                style={{ marginTop: 24 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const Stat = ({
  label,
  value,
  main,
  muted,
  onPress,
  icon,
}: {
  label: string;
  value: string;
  main: string;
  muted: string;
  onPress?: () => void;
  icon?: React.ReactNode;
}) => {
  const inner = (
    <>
      <Text style={{ fontSize: 18, fontWeight: "700", color: main }}>{value}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2, gap: 3 }}>
        <Text style={{ fontSize: 11, color: muted, fontWeight: "500" }}>{label}</Text>
        {icon}
      </View>
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={{ alignItems: "center", flex: 1 }}>
      {inner}
    </Pressable>
  ) : (
    <View style={{ alignItems: "center", flex: 1 }}>{inner}</View>
  );
};

const Section = ({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={{ marginTop: 24 }}>
    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
    <View style={{ paddingHorizontal: 20 }}>
      <Card padding={0}>{children}</Card>
    </View>
  </View>
);

const Row = ({
  icon,
  label,
  right,
  onPress,
  colors,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  testID?: string;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    testID={testID}
  >
    <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <Text style={[styles.rowLabel, { color: colors.textMain }]}>{label}</Text>
    <View style={{ marginLeft: "auto" }}>
      {right ?? <ChevronRight size={18} color={colors.textMuted} />}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  name: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  phone: { fontSize: 13, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  statDivider: { width: 1, height: 30, alignSelf: "center" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  logoutBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  logoutText: { fontSize: 15, fontWeight: "700", marginLeft: 8 },
  version: { fontSize: 11, textAlign: "center", marginTop: 24 },
  sheetLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 10 },
});
