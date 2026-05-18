import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { radius } from "@/src/theme/theme";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

interface Props {
  label: string;
  variant?: Variant;
  testID?: string;
}

export const StatusBadge: React.FC<Props> = ({ label, variant = "neutral", testID }) => {
  const { colors, mode } = useTheme();
  const map: Record<Variant, { bg: string; fg: string }> = {
    success: { bg: mode === "light" ? "#D1FAE5" : "#0D3D2C", fg: colors.success },
    warning: { bg: mode === "light" ? "#FEF3C7" : "#3D2F0E", fg: colors.warning },
    danger: { bg: mode === "light" ? "#FEE2E2" : "#3F1414", fg: colors.danger },
    info: { bg: mode === "light" ? "#DBEAFE" : "#102B43", fg: colors.info },
    neutral: { bg: colors.surfaceSecondary, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
  };
  const p = map[variant];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: p.bg }]}>
      <Text style={[styles.text, { color: p.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});
