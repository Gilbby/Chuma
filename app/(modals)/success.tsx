import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { Check } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

export default function Success() {
  const { colors } = useTheme();
  const router = useRouter();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 130 });
    opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="success-screen">
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.circle,
            { backgroundColor: colors.primary, borderColor: colors.primaryAccent },
            aStyle,
          ]}
        >
          <Check size={64} color="#fff" strokeWidth={3} />
        </Animated.View>

        <Text style={[styles.title, { color: colors.textMain }]}>You&apos;re all set, Gilbert</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Your Chuma account is ready. Start saving, lend within your community and watch your
          group&apos;s wealth grow.
        </Text>

        <View style={{ flex: 1 }} />

        <Button
          label="Enter Chuma"
          onPress={() => router.replace("/(tabs)")}
          testID="success-enter-btn"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 24, alignItems: "center", paddingTop: 60 },
  circle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    marginBottom: 36,
  },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4, textAlign: "center" },
  sub: {
    fontSize: 15,
    marginTop: 12,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
