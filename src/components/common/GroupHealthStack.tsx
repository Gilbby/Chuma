import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { LineChart } from "@/src/components/charts/Charts";
import { TrendingUp } from "lucide-react-native";
import { savingsTrend } from "@/src/data/mock";
import { getLoans } from "@/src/services/loans";
import type { Group, Loan } from "@/src/types";
import {
  getSavingsGrowth,
  getRepaymentRate,
  getDefaults,
  getHealthScore,
} from "@/src/services/groupStats";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = 285;
const SWIPE_THRESHOLD = 120;

interface Props {
  groups: Group[];
  onCardPress: (groupId: string) => void;
}

const STACK_CONFIGS = [
  { scale: 1, translateY: 0, opacity: 1 },
  { scale: 0.95, translateY: 12, opacity: 0.9 },
  { scale: 0.9, translateY: 24, opacity: 0.8 },
];

export function GroupHealthStack({ groups, onCardPress }: Props) {
  const { colors } = useTheme();
  const [topIndex, setTopIndex] = useState(0);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    getLoans().then(setLoans).catch(() => setLoans([]));
  }, []);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isFlinging = useSharedValue(false);

  function advance() {
    setTopIndex((prev) => (prev + 1) % groups.length);
    translateX.value = 0;
    translateY.value = 0;
    isFlinging.value = false;
  }

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (isFlinging.value) return;
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (isFlinging.value) return;
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        isFlinging.value = true;
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withTiming(
          direction * SCREEN_WIDTH * 1.5,
          { duration: 300 },
          () => { runOnJS(advance)(); }
        );
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 180 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 180 });
      }
    });

  const topAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-CARD_WIDTH / 2, 0, CARD_WIDTH / 2],
      [-8, 0, 8],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Render back cards + top card (back first so top is highest z-order)
  const visibleCount = Math.min(3, groups.length);
  const slots = Array.from({ length: visibleCount }, (_, pos) => {
    const groupIndex = (topIndex + pos) % groups.length;
    return { pos, group: groups[groupIndex] };
  });

  return (
    <View style={{ marginTop: 8, paddingHorizontal: 20 }}>
      <View style={{ height: CARD_HEIGHT }}>
        {slots.slice().reverse().map(({ pos, group }) => {
          const cfg = STACK_CONFIGS[pos];
          const isTop = pos === 0;

          const staticStyle = {
            position: "absolute" as const,
            width: CARD_WIDTH,
            opacity: cfg.opacity,
            transform: [{ scale: cfg.scale }, { translateY: cfg.translateY }],
          };

          if (isTop) {
            return (
              <GestureDetector key={group.id} gesture={panGesture}>
                <Animated.View style={[staticStyle, topAnimatedStyle]}>
                  <HealthCardContent
                    group={group}
                    colors={colors}
                    loans={loans}
                    onPress={() => onCardPress(group.id)}
                  />
                </Animated.View>
              </GestureDetector>
            );
          }

          return (
            <Animated.View key={group.id} style={staticStyle}>
              <HealthCardContent
                group={group}
                colors={colors}
                loans={loans}
                onPress={() => {}}
              />
            </Animated.View>
          );
        })}
      </View>

      {/* Dots */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 6 }}>
        {groups.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === topIndex ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === topIndex ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>

      {groups.length > 1 && (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 11,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          Swipe to see other groups
        </Text>
      )}
    </View>
  );
}

function HealthCardContent({
  group,
  colors,
  loans,
  onPress,
}: {
  group: Group;
  colors: ReturnType<typeof useTheme>["colors"];
  loans: Loan[];
  onPress: () => void;
}) {
  const growth = getSavingsGrowth(group);
  const repayment = getRepaymentRate(group, loans);
  const defaults = getDefaults(group, loans);
  const score = getHealthScore(group, loans);

  const growthColor = growth >= 0 ? colors.success : colors.danger;
  const repaymentColor =
    repayment >= 80 ? colors.success : repayment >= 50 ? colors.warning : colors.danger;
  const defaultsColor = defaults === 0 ? colors.success : colors.danger;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      testID={`health-card-${group.id}`}
    >
      <Card padding={18}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1.3,
                color: colors.textMuted,
              }}
            >
              GROUP HEALTH
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                marginTop: 4,
                letterSpacing: -0.2,
                color: colors.textMain,
              }}
            >
              {group.name}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              gap: 4,
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
            }}
          >
            <TrendingUp size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: "700", marginLeft: 4, color: colors.primary }}>
              {score}
            </Text>
          </View>
        </View>

        <View style={{ marginVertical: 14 }}>
          <LineChart data={savingsTrend} width={CARD_WIDTH - 36} height={110} />
        </View>

        <View style={{ flexDirection: "row" }}>
          <HealthStat
            label="Savings ↑"
            value={`${growth >= 0 ? "+" : ""}${growth}%`}
            color={growthColor}
            muted={colors.textMuted}
          />
          <HealthStat
            label="Repayment"
            value={`${repayment}%`}
            color={repaymentColor}
            muted={colors.textMuted}
          />
          <HealthStat
            label="Defaults"
            value={`${defaults}`}
            color={defaultsColor}
            muted={colors.textMuted}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function HealthStat({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: muted, fontWeight: "600", letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 16, color, fontWeight: "700", marginTop: 4 }}>{value}</Text>
    </View>
  );
}
