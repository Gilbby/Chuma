import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { notifications as initial } from "@/src/data/mock";
import { Notice } from "@/src/types";
import {
  Banknote,
  PiggyBank,
  Scale,
  ShieldAlert,
  RefreshCw,
  Check,
  Users,
} from "lucide-react-native";

const ICONS = {
  loan: Banknote,
  contribution: PiggyBank,
  governance: Scale,
  security: ShieldAlert,
  repayment: RefreshCw,
  invite: Users,
};

const TINTS: Record<Notice["type"], "primary" | "info" | "success" | "warning" | "danger"> = {
  loan: "success",
  contribution: "primary",
  governance: "info",
  security: "warning",
  repayment: "info",
  invite: "primary",
};

export default function Notifications() {
  const { colors } = useTheme();
  const [items, setItems] = useState(initial);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const activeItems = items.filter((n) => !dismissed.includes(n.id));

  const grouped = useMemo(() => {
    const today: Notice[] = [];
    const earlier: Notice[] = [];
    activeItems.forEach((n) => {
      if (n.date.toLowerCase().includes("today")) today.push(n);
      else earlier.push(n);
    });
    return { today, earlier };
  }, [activeItems]);

  const markAllRead = () => setItems((p) => p.map((n) => ({ ...n, read: true })));

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="notifications-screen"
    >
      <ScreenHeader
        title="Notifications"
        rightAction={
          <Pressable onPress={markAllRead} testID="notifications-read-all">
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              Mark all read
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {grouped.today.length > 0 && (
          <>
            <Text style={[styles.group, { color: colors.textMuted }]}>TODAY</Text>
            {grouped.today.map((n) => (
              <NotifCard
                key={n.id}
                n={n}
                colors={colors}
                onAccept={() => {
                  setDismissed((d) => [...d, n.id]);
                  Alert.alert("Joined", `You joined ${n.groupName}`);
                }}
                onDecline={() => setDismissed((d) => [...d, n.id])}
              />
            ))}
          </>
        )}
        {grouped.earlier.length > 0 && (
          <>
            <Text style={[styles.group, { color: colors.textMuted, marginTop: 18 }]}>EARLIER</Text>
            {grouped.earlier.map((n) => (
              <NotifCard
                key={n.id}
                n={n}
                colors={colors}
                onAccept={() => {
                  setDismissed((d) => [...d, n.id]);
                  Alert.alert("Joined", `You joined ${n.groupName}`);
                }}
                onDecline={() => setDismissed((d) => [...d, n.id])}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const NotifCard = ({
  n,
  colors,
  onAccept,
  onDecline,
}: {
  n: Notice;
  colors: ReturnType<typeof useTheme>["colors"];
  onAccept?: () => void;
  onDecline?: () => void;
}) => {
  const Icon = ICONS[n.type] ?? Banknote;
  const tint = TINTS[n.type];
  const tintColor =
    tint === "primary"
      ? colors.primary
      : tint === "success"
        ? colors.success
        : tint === "info"
          ? colors.info
          : tint === "warning"
            ? colors.warning
            : colors.danger;
  return (
    <Card padding={14} style={{ marginBottom: 10, opacity: n.read ? 0.7 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Icon size={18} color={tintColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.rowBetween}>
            <Text
              style={{
                color: colors.textMain,
                fontWeight: n.read ? "600" : "700",
                fontSize: 14,
                flex: 1,
                marginRight: 8,
              }}
            >
              {n.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{n.date}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            {n.body}
          </Text>
          {!n.read && (
            <View
              style={[
                styles.unreadDot,
                { backgroundColor: colors.primary },
              ]}
            />
          )}
          {n.type === "invite" && !n.read && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Button
                label="Decline"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={onDecline}
                testID={`notif-decline-${n.id}`}
              />
              <Button
                label="Accept"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={onAccept}
                testID={`notif-accept-${n.id}`}
              />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  group: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  unreadDot: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
