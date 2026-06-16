import React, { useEffect } from "react";
import { View, ViewStyle, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/src/theme/ThemeContext";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const { colors } = useTheme();
  const containerWidth = useSharedValue(400);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const animStyle = useAnimatedStyle(() => {
    const shimmerW = containerWidth.value * 0.6;
    const translateX = -shimmerW + (containerWidth.value + shimmerW * 2) * progress.value;
    return {
      transform: [{ translateX }],
      width: shimmerW,
    };
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    containerWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        {
          backgroundColor: colors.surfaceSecondary,
          overflow: "hidden",
          height,
          borderRadius,
          width,
        } as ViewStyle,
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            backgroundColor: colors.background,
            opacity: 0.4,
          },
          animStyle,
        ]}
      />
    </View>
  );
};

interface SkeletonGroupProps {
  count?: number;
  gap?: number;
  height?: number;
}

export const SkeletonGroup: React.FC<SkeletonGroupProps> = ({
  count = 3,
  gap = 12,
  height = 64,
}) => (
  <View style={{ gap }}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} height={height} borderRadius={16} />
    ))}
  </View>
);
