import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";

interface Props {
  name: string;
  uri?: string;
  size?: number;
  bg?: string;
}

export const Avatar: React.FC<Props> = ({ name, uri, size = 44, bg }) => {
  const { colors } = useTheme();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg ?? colors.primarySoft,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.text, { color: colors.primary, fontSize: size * 0.36 }]}>
          {initials}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  text: { fontWeight: "700" },
});
