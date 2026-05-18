import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";

interface Props {
  progress: number; // 0-1
  height?: number;
  showLabel?: boolean;
  color?: string;
  bg?: string;
}

export const ProgressBar: React.FC<Props> = ({ progress, height = 8, showLabel, color, bg }) => {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View>
      <View style={[styles.track, { backgroundColor: bg ?? colors.surfaceSecondary, height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct * 100}%`,
              backgroundColor: color ?? colors.primary,
              height,
            },
          ]}
        />
      </View>
      {showLabel ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {Math.round(pct * 100)}%
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  track: { borderRadius: 999, overflow: "hidden" },
  fill: { borderRadius: 999 },
  label: { fontSize: 11, marginTop: 6, fontWeight: "600" },
});
