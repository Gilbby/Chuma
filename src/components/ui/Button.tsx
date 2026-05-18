import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { radius } from "@/src/theme/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "lg" | "md" | "sm";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}

export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  disabled,
  loading,
  fullWidth = true,
  icon,
  iconRight,
  testID,
  style,
}) => {
  const { colors } = useTheme();

  const sizeMap: Record<Size, { h: number; fs: number; px: number }> = {
    lg: { h: 56, fs: 16, px: 20 },
    md: { h: 48, fs: 15, px: 16 },
    sm: { h: 38, fs: 13, px: 12 },
  };
  const s = sizeMap[size];

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.textInverse },
    secondary: { bg: colors.surfaceSecondary, fg: colors.textMain },
    ghost: { bg: "transparent", fg: colors.primary },
    danger: { bg: colors.danger, fg: "#fff" },
    outline: { bg: "transparent", fg: colors.primary, border: colors.primary },
  };
  const p = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: p.bg,
          borderColor: p.border ?? "transparent",
          borderWidth: p.border ? 1.5 : 0,
          height: s.h,
          paddingHorizontal: s.px,
          width: fullWidth ? "100%" : undefined,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <Text style={[styles.label, { color: p.fg, fontSize: s.fs } as TextStyle]}>{label}</Text>
          {iconRight ? <View style={{ marginLeft: 8 }}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontWeight: "600", letterSpacing: 0.2 },
});
