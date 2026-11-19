import React from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useTheme } from "@/src/theme/ThemeContext";

/** Height of the pill itself (8pt grid). */
export const TAB_BAR_HEIGHT = 64;
/** Gap between the pill and the bottom safe-area edge. */
const BAR_GAP = 12;
/** How far above the pill the background fade starts. */
const FADE_HEIGHT = 32;

const layout = LinearTransition.springify().damping(18).stiffness(180);

/**
 * Vertical space the floating bar covers, measured from the bottom of the
 * screen. Tab screens add this to their scroll content's bottom padding so the
 * last item can scroll clear of the bar.
 */
export function useTabBarSpace(extra = 24) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, BAR_GAP) + extra;
}

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = mode === "dark";

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, BAR_GAP) }]}
    >
      {/* Fade the page into the background behind the bar, so scrolling
          content (cards are the same colour as the bar in light mode, and
          close to it in dark) never butts straight up against the pill. */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background}00`, `${colors.background}E6`, colors.background]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.bar,
          dark
            ? {
                // Elevated surface + a faint light edge: shadows are invisible
                // on a near-black page, so lift the bar with tone instead.
                backgroundColor: colors.surfaceSecondary,
                borderColor: "rgba(255, 255, 255, 0.10)",
                borderWidth: 1,
                shadowOpacity: 0.6,
              }
            : {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowOpacity: 0.12,
              },
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const color = focused ? colors.onBrand : colors.textMuted;

          const onPress = () => {
            const event = emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              navigateToTab(route.key);
            }
          };

          const onLongPress = () => {
            emitter.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Animated.View
              key={route.key}
              layout={layout}
              style={[styles.slot, focused && styles.slotActive]}
            >
              <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                testID={options.tabBarButtonTestID}
                style={styles.press}
                hitSlop={4}
              >
                <Animated.View
                  layout={layout}
                  style={[
                    styles.item,
                    focused && [styles.itemActive, { backgroundColor: colors.brand }],
                  ]}
                >
                  {options.tabBarIcon?.({ focused, color, size: 22 })}
                  {focused ? (
                    <Animated.Text
                      entering={FadeIn.duration(180)}
                      numberOfLines={1}
                      style={[styles.label, { color }]}
                    >
                      {label}
                    </Animated.Text>
                  ) : null}
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: FADE_HEIGHT,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  bar: {
    width: "100%",
    maxWidth: 480,
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
  slot: {
    flex: 1,
    height: "100%",
  },
  // The active tab gets more room so icon + label ("Transactions" is the
  // longest) fit on a 360dp-wide phone without squeezing the other tabs.
  slotActive: { flex: 2.4 },
  press: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    height: 48,
    minWidth: 48,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  itemActive: {
    paddingHorizontal: 12,
    gap: 6,
  },
  label: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
