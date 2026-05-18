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
          shadowOpacity: elevated && mode === "light" ? 0.06 : 0,
        },
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 0,
  },
});
