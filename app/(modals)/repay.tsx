import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import { ErrorState } from "@/src/components/common";
import { useTheme } from "@/src/theme/ThemeContext";
import { getLoans, repayLoan } from "@/src/services/loans";
import { Loan } from "@/src/types";
import { formatZMW } from "@/src/utils/currency";
import { Check } from "lucide-react-native";

export default function Repay() {
  const { colors } = useTheme();
  const router = useRouter();
  const { loanId } = useLocalSearchParams<{ loanId?: string }>();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [mode, setMode] = useState<"installment" | "full" | "custom">("installment");
  const [custom, setCustom] = useState("500");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const all = await getLoans({ mine: true });
      const repayable = all.filter((l) => l.status === "active" && l.outstanding > 0);
      setLoans(repayable);
      const preselected = loanId ? repayable.find((l) => l.id === loanId) : undefined;
      setSelected(preselected ?? repayable[0] ?? null);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    load();
  }, [load]);

  const amount = selected
    ? mode === "installment"
      ? selected.installmentAmount
      : mode === "full"
        ? selected.outstanding
        : parseFloat(custom) || 0
    : 0;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="repay-screen">
        <ScreenHeader title="Repay loan" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="repay-screen">
        <ScreenHeader title="Repay loan" />
        <ErrorState onRetry={load} />
      </SafeAreaView>
    );
  }

  if (!selected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="repay-screen">
        <ScreenHeader title="Repay loan" />
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <Card padding={20}>
            <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
              No active loans to repay
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              You don&apos;t have any outstanding loans right now.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        edges={["top"]}
        testID="repay-success"
      >
        <View style={styles.successWrap}>
          <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
            <Check size={56} color="#fff" strokeWidth={3} />
          </View>
          <Text style={{ color: colors.textMain, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 }}>
            Payment received
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
              paddingHorizontal: 40,
            }}
          >
            {formatZMW(amount)} applied to your loan with {selected.groupName}.
          </Text>
          <View style={{ flex: 1 }} />
          <View style={{ width: "100%", paddingHorizontal: 24 }}>
            <Button label="Done" onPress={() => router.replace("/(tabs)")} testID="repay-done-btn" />
            <View style={{ height: 10 }} />
            <Button
              label="View & share receipt"
              variant="outline"
              onPress={() =>
                router.replace({
                  pathname: "/receipt",
                  params: {
                    amount: String(amount),
                    type: "repayment",
                    group: selected.groupName,
                    date: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
                    note: `Installment payment`,
                    status: "completed",
                    direction: "out",
                    txnId: `CHM-RP-${Date.now().toString().slice(-6)}`,
                  },
                })
              }
              testID="repay-receipt-btn"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="repay-screen"
    >
      <ScreenHeader title="Repay loan" subtitle={`${loans.length} active loans`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Loan selector */}
        <Text style={[styles.label, { color: colors.textMuted }]}>YOUR ACTIVE LOANS</Text>
        {loans.map((l) => {
          const active = selected.id === l.id;
          const progress = (l.principal - l.outstanding) / l.principal;
          return (
            <Pressable
              key={l.id}
              onPress={() => setSelected(l)}
              testID={`repay-loan-${l.id}`}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginBottom: 12 }]}
            >
              <Card
                padding={16}
                style={{
                  borderColor: active ? colors.primary : colors.border,
                  borderWidth: active ? 2 : 1,
                }}
              >
                <View style={styles.rowBetween}>
                  <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 15 }}>
                    {l.groupName}
                  </Text>
                  <StatusBadge label="Active" variant="primary" />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  {l.installmentsPaid}/{l.totalInstallments} installments · Due {l.nextDueDate}
                </Text>

                <View style={styles.amountsRow}>
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Outstanding</Text>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 18 }}>
                      {formatZMW(l.outstanding)}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>Installment</Text>
                    <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 16 }}>
                      {formatZMW(l.installmentAmount)}
                    </Text>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <ProgressBar progress={progress} />
                </View>
              </Card>
            </Pressable>
          );
        })}

        {/* Repay mode */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>REPAY</Text>
        <Card padding={6}>
          <ModeRow
            label="Pay installment"
            sub={formatZMW(selected.installmentAmount)}
            active={mode === "installment"}
            onPress={() => setMode("installment")}
            colors={colors}
            testID="repay-mode-installment"
          />
          <ModeRow
            label="Pay full balance"
            sub={formatZMW(selected.outstanding)}
            active={mode === "full"}
            onPress={() => setMode("full")}
            colors={colors}
            testID="repay-mode-full"
          />
          <ModeRow
            label="Partial payment"
            sub={`Custom amount: K ${custom}`}
            active={mode === "custom"}
            onPress={() => setMode("custom")}
            colors={colors}
            testID="repay-mode-custom"
          />
        </Card>

        {/* Installment history */}
        <Text style={[styles.label, { color: colors.textMuted, marginTop: 24 }]}>
          INSTALLMENT HISTORY
        </Text>
        <Card padding={0}>
          {selected.history.map((h, i) => (
            <View
              key={i}
              style={[
                styles.historyRow,
                i < selected.history.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMain, fontWeight: "600", fontSize: 14 }}>
                  {h.type === "disbursement" ? "Loan disbursed" : "Repayment"}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{h.date}</Text>
              </View>
              <Text
                style={{
                  color: h.type === "disbursement" ? colors.success : colors.textMain,
                  fontWeight: "700",
                }}
              >
                {h.type === "disbursement" ? "+" : "−"} {formatZMW(h.amount)}
              </Text>
            </View>
          ))}
        </Card>

        <View style={{ height: 24 }} />

        {payError ? (
          <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 12, fontWeight: "500" }}>
            {payError}
          </Text>
        ) : null}

        <Button
          label={`Pay ${formatZMW(amount)}`}
          disabled={amount <= 0 || amount > selected.outstanding || submitting}
          loading={submitting}
          onPress={async () => {
            if (!selected) return;
            setSubmitting(true);
            setPayError("");
            try {
              await repayLoan({ loanId: selected.id, amount });
              setSuccess(true);
            } catch (e: any) {
              setPayError(e?.message || "Payment failed. Please try again.");
            } finally {
              setSubmitting(false);
            }
          }}
          testID="repay-pay-btn"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const ModeRow = ({
  label,
  sub,
  active,
  onPress,
  colors,
  testID,
}: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  testID?: string;
}) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    style={({ pressed }) => [
      styles.modeRow,
      {
        backgroundColor: active ? colors.primarySoft : "transparent",
        opacity: pressed ? 0.85 : 1,
      },
    ]}
  >
    <View
      style={[
        styles.radio,
        {
          borderColor: active ? colors.primary : colors.borderStrong,
          backgroundColor: active ? colors.primary : "transparent",
        },
      ]}
    >
      {active && <View style={styles.radioDot} />}
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ color: colors.textMain, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{sub}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amountsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginVertical: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  successWrap: { flex: 1, alignItems: "center", paddingTop: 60, paddingBottom: 20 },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
});
