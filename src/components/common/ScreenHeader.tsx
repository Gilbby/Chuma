import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

interface Props {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
  testID?: string;
}

export const ScreenHeader: React.FC<Props> = ({
  title,
  subtitle,
  rightAction,
  onBack,
  hideBack,
  testID,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/(tabs)")));
  return (
    <View testID={testID} style={styles.wrap}>
      {!hideBack ? (
        <Pressable
          testID="screen-header-back"
          onPress={goBack}
          style={({ pressed }) => [
            styles.back,
            {
              backgroundColor: colors.surfaceSecondary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <ChevronLeft size={22} color={colors.textMain} strokeWidth={2.4} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={[styles.title, { color: colors.textMain }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ minWidth: 40, alignItems: "flex-end" }}>{rightAction}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingBottom: 16,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  subtitle: { fontSize: 12, marginTop: 2 },
});
