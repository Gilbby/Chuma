import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
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
} from "lucide-react-native";
import { currentUser, groups } from "@/src/data/mock";
import { Role } from "@/src/types";
import { useRole } from "@/src/contexts/RoleContext";

export default function Profile() {
  const { colors, mode, toggle } = useTheme();
  const router = useRouter();
  const { role, setRole, description } = useRole();
  const [bio, setBio] = React.useState(true);
  const [notif, setNotif] = React.useState(true);

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
            <View style={styles.profileRow}>
              <Image source={{ uri: currentUser.avatar }} style={styles.avatar} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.name, { color: colors.textMain }]}>{currentUser.name}</Text>
                <Text style={[styles.phone, { color: colors.textMuted }]}>{currentUser.phone}</Text>
                <View style={{ marginTop: 8, flexDirection: "row" }}>
                  <StatusBadge label={role} variant="primary" testID="profile-role-badge" />
                </View>
              </View>
            </View>

            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              <Stat label="Groups" value={String(groups.length)} muted={colors.textMuted} main={colors.textMain} />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <Stat label="Member since" value="Jan 2024" muted={colors.textMuted} main={colors.textMain} />
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <Stat label="Trust score" value="92" muted={colors.textMuted} main={colors.textMain} />
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

        <Section title="Activity" colors={colors}>
          <Row
            icon={<Users size={20} color={colors.primary} />}
            label="My groups"
            colors={colors}
            onPress={() => router.push("/(tabs)/groups")}
          />
          <Row
            icon={<HelpCircle size={20} color={colors.primary} />}
            label="Help & support"
            colors={colors}
          />
        </Section>

        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Pressable
            style={[
              styles.logoutBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => router.replace("/welcome")}
            testID="profile-logout-btn"
          >
            <LogOut size={18} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>Chuma v1.0 · Built with care</Text>
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
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={{ fontSize: 18, fontWeight: "700", color: main }}>{value}</Text>
    <Text style={{ fontSize: 11, color: muted, marginTop: 2, fontWeight: "500" }}>{label}</Text>
  </View>
);

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
});
