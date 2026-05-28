import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatZMW } from "@/src/utils/currency";
import { TxnItem } from "@/src/types";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Banknote,
  RefreshCw,
  Gift,
  Wallet,
} from "lucide-react-native";

interface Props {
  txn: TxnItem;
  onPress?: () => void;
  testID?: string;
}

const ICONS = {
  contribution: PiggyBank,
  loan: Banknote,
  repayment: RefreshCw,
  "share-out": Gift,
  withdrawal: Wallet,
};

export const TransactionRow: React.FC<Props> = ({ txn, onPress, testID }) => {
  const { colors, mode } = useTheme();
  const Icon = ICONS[txn.type];
  const isIn = txn.direction === "in";
  const amountColor = txn.status === "failed" ? colors.textMuted : isIn ? colors.success : colors.textMain;

  const statusVariant =
    txn.status === "completed" ? "success" : txn.status === "pending" ? "warning" : "danger";

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isIn ? (mode === "light" ? "#D1FAE5" : "#0D3D2C") : colors.surfaceSecondary,
          },
        ]}
      >
        <Icon size={20} color={isIn ? colors.success : colors.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.title, { color: colors.textMain }]} numberOfLines={1}>
          {txn.type === "share-out"
            ? "Share-out"
            : txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
          {txn.groupName} · {txn.date}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {isIn ? "+" : "−"} {formatZMW(txn.amount)}
        </Text>
        <View style={{ marginTop: 4 }}>
          <StatusBadge label={txn.status} variant={statusVariant} />
        </View>
      </View>
      <View style={{ marginLeft: 8 }}>
        {isIn ? (
          <ArrowDownLeft size={16} color={colors.textMuted} />
        ) : (
          <ArrowUpRight size={16} color={colors.textMuted} />
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700" },
});
