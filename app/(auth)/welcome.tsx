import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { PiggyBank, HandCoins, ShieldCheck, Vote } from "lucide-react-native";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: PiggyBank,
    title: "Save together,\ngrow together",
    sub: "Pool weekly or monthly contributions with people you trust.",
  },
  {
    icon: HandCoins,
    title: "Borrow from\nyour community",
    sub: "Request loans backed by your savings group with fair, transparent rates.",
  },
  {
    icon: ShieldCheck,
    title: "Every transaction,\nin the open",
    sub: "Real-time receipts, member-by-member ledgers and audit-ready reports.",
  },
  {
    icon: Vote,
    title: "Governance by\nthe whole group",
    sub: "Vote on loans, rules and share-outs — no single chairperson decides alone.",
  },
];

export default function Welcome() {
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="welcome-screen"
    >
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Image
            source={require("@/assets/images/logo-mark.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.brand, { color: colors.textMain }]}>Chuma</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => {
          const Icon = s.icon;
          return (
            <View key={i} style={[styles.slide, { width }]}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                ]}
              >
                <Icon size={44} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={[styles.title, { color: colors.textMain }]}>{s.title}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>{s.sub}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === page ? colors.primary : colors.border,
                width: i === page ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.cta}>
        <Button
          label="Create account"
          testID="welcome-signup-btn"
          onPress={() => router.push("/phone?mode=signup")}
        />
        <View style={{ height: 12 }} />
        <Button
          label="I already have an account"
          variant="ghost"
          testID="welcome-login-btn"
          onPress={() => router.push("/phone?mode=signin")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logoImg: { width: 30, height: 30 },
  brand: { fontSize: 20, fontWeight: "700", marginLeft: 10, letterSpacing: -0.3 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
    borderWidth: 1.5,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.6,
    textAlign: "center",
    lineHeight: 36,
  },
  sub: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  cta: { paddingHorizontal: 24, paddingBottom: 24 },
});
