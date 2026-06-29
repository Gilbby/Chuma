import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { groups } from "@/src/data/mock";
import { formatZMW } from "@/src/utils/currency";
import { getMonthsOwed, getAmountOwed, advancePaidThrough } from "@/src/services/groupFees";
import { Check, ChevronDown, CalendarClock } from "lucide-react-native";

const PAYMENT_METHODS = [
  { label: "MTN MoMo", description: "Pay via MTN Mobile Money wallet" },
  { label: "Airtel Money", description: "Pay via Airtel Money wallet" },
  { label: "Zamtel Kwacha", description: "Pay via Zamtel Kwacha wallet" },
  { label: "Bank Transfer", description: "Pay via direct bank transfer" },
];

export default function GroupFeeScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { colors } = useTheme();
  const router = useRouter();

  const group = groups.find((g) => g.id === groupId);

  const monthsOwed = group ? getMonthsOwed(group) : 0;
  const amountOwed = group ? getAmountOwed(group) : 0;
  const [payMethod, setPayMethod] = useState("Airtel Money");
  const [methodOpen, setMethodOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <ScreenHeader title="Pay group fee" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ color: colors.textMain, fontSize: 16, fontWeight: "700" }}>Group not found</Text>
          <View style={{ marginTop: 24 }}>
            <Button label="Go back" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (monthsOwed === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <ScreenHeader title="Pay group fee" subtitle={group.name} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Check size={36} color={colors.primary} strokeWidth={2.5} />
          </View>
          <Text style={{ color: colors.textMain, fontSize: 17, fontWeight: "700", textAlign: "center" }}>
            This group's fee is fully paid.
          </Text>
          <View style={{ marginTop: 24, width: "100%" }}>
            <Button label="Go back" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const owedMonths = Array.from({ length: monthsOwed }, (_, i) => {
    const d = new Date(group.feePaidThrough!);
    d.setMonth(d.getMonth() + i + 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  });

  // TODO: replace simulated payment with PawaPay charge when wired
  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      group.feePaidThrough = advancePaidThrough(group, monthsOwed);
      setPaying(false);
      Alert.alert(
        "Payment successful",
        `${group.name} has been reactivated.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    }, 1200);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="group-fee-screen"
    >
      <ScreenHeader title="Pay group fee" subtitle={group.name} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount due */}
        <Card padding={20}>
          <Text style={[styles.overline, { color: colors.textMuted }]}>AMOUNT DUE</Text>
          <Text style={[styles.amount, { color: colors.textMain }]}>{formatZMW(amountOwed)}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
            {monthsOwed} month{monthsOwed === 1 ? "" : "s"} × {formatZMW(group.monthlyFee ?? 100)}
          </Text>
        </Card>

        {/* Breakdown — only when more than one month is owed */}
        {monthsOwed > 1 && (
          <Card padding={16} style={{ marginTop: 14 }}>
            <Text style={[styles.overline, { color: colors.textMuted, marginBottom: 4 }]}>MONTHS OWED</Text>
            {owedMonths.map((month, idx) => (
              <View
                key={month}
                style={[
                  styles.monthRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: idx < owedMonths.length - 1 ? 1 : 0,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <CalendarClock size={16} color={colors.textMuted} />
                  <Text style={{ color: colors.textMain, fontSize: 14, fontWeight: "500" }}>{month}</Text>
                </View>
                <Text style={{ color: colors.textMain, fontWeight: "600" }}>
                  {formatZMW(group.monthlyFee ?? 100)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Payment method picker */}
        <Pressable
          onPress={() => setMethodOpen((s) => !s)}
          testID="group-fee-method-picker"
          style={({ pressed }) => [
            styles.picker,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
              PAY WITH
            </Text>
            <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600", marginTop: 4 }}>
              {payMethod}
            </Text>
          </View>
          <ChevronDown size={20} color={colors.textMuted} />
        </Pressable>
        {methodOpen && (
          <Card padding={4} style={{ marginTop: 8 }}>
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m.label}
                onPress={() => { setPayMethod(m.label); setMethodOpen(false); }}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: pressed ? colors.surfaceSecondary : "transparent" },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMain, fontWeight: "500" }}>{m.label}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.description}</Text>
                </View>
                {m.label === payMethod && <Check size={18} color={colors.primary} />}
              </Pressable>
            ))}
          </Card>
        )}

        <Text style={[styles.infoNote, { color: colors.textMuted }]}>
          Paying clears the outstanding balance and reactivates the group immediately for all members.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Button
          label={paying ? "Processing…" : `Pay ${formatZMW(amountOwed)}`}
          onPress={handlePay}
          disabled={paying}
          testID="group-fee-pay-btn"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  amount: {
    fontSize: 34,
    fontWeight: "800",
    marginTop: 6,
    letterSpacing: -0.5,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 18,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  infoNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
});
