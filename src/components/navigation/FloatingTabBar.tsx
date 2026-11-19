import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { BlurView, BlurTargetView } from "expo-blur";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Plus } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeContext";

/** Height of the pill itself (8pt grid). */
export const TAB_BAR_HEIGHT = 64;
/** Gap between the pill and the bottom safe-area edge. */
const BAR_GAP = 12;

/**
 * Frosted-glass look: a real blur of the page behind the bar, with a tinted
 * layer on top so the page's colours come through softened rather than sharp.
 * Raise `intensity` for a heavier frost, raise the tint alpha for a more solid
 * bar.
 */
const GLASS = {
  intensity: 60,
  tint: {
    light: "rgba(255, 255, 255, 0.55)",
    dark: "rgba(28, 41, 35, 0.55)", // surfaceSecondary #1C2923
  },
  rim: {
    light: "rgba(18, 61, 48, 0.14)",
    dark: "rgba(255, 255, 255, 0.14)",
  },
  // `boxShadow` (not shadow*/elevation): its outset shadow is drawn only
  // OUTSIDE the pill, so it lifts the bar off the page without darkening the
  // see-through glass. A wide soft layer for float + a tight one for the edge.
  shadow: {
    light: "0px 10px 30px rgba(18, 61, 48, 0.16), 0px 2px 8px rgba(18, 61, 48, 0.10)",
    dark: "0px 10px 30px rgba(0, 0, 0, 0.55), 0px 2px 8px rgba(0, 0, 0, 0.35)",
  },
};

const layout = LinearTransition.springify().damping(18).stiffness(180);

/**
 * Vertical space the floating bar covers, measured from the bottom of the
 * screen. Tab screens add this to their scroll content's bottom padding so the
 * last item can scroll clear of the bar.
 */
export function useTabBarSpace(extra = 16) {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, BAR_GAP) + extra;
}

/* ------------------------------------------------------------------------ */
/* Blur targets                                                              */
/*                                                                           */
/* On Android expo-blur can only blur content inside a <BlurTargetView>, and  */
/* the BlurView must not sit inside that target. The tab bar is a sibling of  */
/* the screens, so each screen is wrapped in its own target (via the tab      */
/* navigator's `screenLayout`) and registers it here; the bar blurs whichever */
/* screen is focused. On iOS and web the target is a plain View and the blur  */
/* works on whatever is behind it.                                           */
/* ------------------------------------------------------------------------ */

type ViewRef = ComponentRef<typeof View>;
type TargetRef = RefObject<ViewRef | null>;
type Registry = {
  targets: Record<string, TargetRef>;
  register: (routeKey: string, ref: TargetRef | null) => void;
};

const BlurTargetsContext = createContext<Registry | null>(null);

export function TabBlurProvider({ children }: { children: React.ReactNode }) {
  const [targets, setTargets] = useState<Record<string, TargetRef>>({});
  const register = useCallback((routeKey: string, ref: TargetRef | null) => {
    setTargets((prev) => {
      if (ref ? prev[routeKey] === ref : !(routeKey in prev)) return prev;
      const next = { ...prev };
      if (ref) next[routeKey] = ref;
      else delete next[routeKey];
      return next;
    });
  }, []);
  const value = useMemo(() => ({ targets, register }), [targets, register]);
  return <BlurTargetsContext.Provider value={value}>{children}</BlurTargetsContext.Provider>;
}

/** Wraps one tab screen so the floating bar can blur it. */
export function TabBlurTarget({
  routeKey,
  children,
}: {
  routeKey: string;
  children: React.ReactNode;
}) {
  const ref = useRef<ViewRef>(null);
  const register = useContext(BlurTargetsContext)?.register;
  useEffect(() => {
    register?.(routeKey, ref);
    return () => register?.(routeKey, null);
  }, [register, routeKey]);
  return (
    <BlurTargetView ref={ref} style={styles.target} collapsable={false}>
      {children}
    </BlurTargetView>
  );
}

/* ------------------------------------------------------------------------ */

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = mode === "dark";
  const blurTarget = useContext(BlurTargetsContext)?.targets[state.routes[state.index].key];
  const router = useRouter();

  // "+" right after Home, styled exactly like an inactive tab icon. It isn't a
  // tab (it opens the contribute modal), so it never shows active.
  const plusBefore = 1; // index of the tab the "+" sits in front of
  const plusItem = (
    <Animated.View layout={layout} style={styles.slot}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
          router.push("/contribute");
        }}
        accessibilityRole="button"
        accessibilityLabel="Make a contribution"
        testID="tab-contribute"
        style={({ pressed }) => [styles.press, { opacity: pressed ? 0.6 : 1 }]}
        hitSlop={4}
      >
        <View style={styles.item}>
          <Plus size={22} color={colors.textMuted} strokeWidth={2} />
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, BAR_GAP) }]}
    >
      <View style={[styles.shell, { boxShadow: dark ? GLASS.shadow.dark : GLASS.shadow.light }]}>
        <View
          style={[styles.bar, { borderColor: dark ? GLASS.rim.dark : GLASS.rim.light }]}
        >
          {/* Native needs a registered target before it can blur (Android
              otherwise warns and falls back); the tint alone covers that first
              frame. */}
          {blurTarget || Platform.OS !== "android" ? (
            <BlurView
              blurTarget={blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={GLASS.intensity}
              tint={dark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, styles.rounded]}
              pointerEvents="none"
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.rounded,
              { backgroundColor: dark ? GLASS.tint.dark : GLASS.tint.light },
            ]}
          />

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
              <React.Fragment key={route.key}>
              {index === plusBefore ? plusItem : null}
              <Animated.View
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
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  target: { flex: 1 },
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  // Carries the shadow. Kept separate from `bar` because the bar clips its
  // blur layers with overflow: hidden.
  shell: {
    width: "100%",
    maxWidth: 480,
    borderRadius: TAB_BAR_HEIGHT / 2,
  },
  bar: {
    width: "100%",
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    // Clip the blur and tint layers to the pill shape.
    overflow: "hidden",
  },
  rounded: { borderRadius: TAB_BAR_HEIGHT / 2 },
  slot: {
    flex: 1,
    height: "100%",
  },
  // The active tab gets more room so icon + label ("Transactions" is the
  // longest) fit alongside four icon-only slots (incl. the "+").
  slotActive: { flex: 2.8 },
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
