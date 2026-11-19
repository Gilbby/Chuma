import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { radius } from "@/src/theme/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padding?: number;
  testID?: string;
  elevated?: boolean;
}

export const Card: React.FC<Props> = ({ children, style, padding = 16, testID, elevated }) => {
  const { colors, mode } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding,
          // No border in either theme - it reads as a glowing outline, worst
          // on stacked cards like Group Health. Dark mode separates cards by
          // surface tone; light mode (white on near-white) by a soft shadow.
          // Callers can still opt into a border (e.g. a selected state).
          boxShadow:
            mode === "dark" ? undefined : elevated ? CARD_SHADOW_ELEVATED : CARD_SHADOW,
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
};

// Tinted with the primary text colour so shadows read warm, not grey.
const CARD_SHADOW = "0px 4px 16px rgba(18, 61, 48, 0.06), 0px 1px 3px rgba(18, 61, 48, 0.05)";
const CARD_SHADOW_ELEVATED =
  "0px 8px 24px rgba(18, 61, 48, 0.10), 0px 2px 6px rgba(18, 61, 48, 0.06)";

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 0,
  },
});
