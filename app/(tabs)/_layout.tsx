import React from "react";
import { Tabs } from "expo-router";
import { Home, Users, ArrowLeftRight, User } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { View, StyleSheet, Platform } from "react-native";

export default function TabsLayout() {
  const { colors, mode } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOpacity: mode === "light" ? 0.04 : 0,
              shadowOffset: { width: 0, height: -4 },
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeWrap : null}>
              <Home size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
          ),
          tabBarButtonTestID: "tab-home",
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeWrap : null}>
              <Users size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
          ),
          tabBarButtonTestID: "tab-groups",
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeWrap : null}>
              <ArrowLeftRight size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
          ),
          tabBarButtonTestID: "tab-transactions",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeWrap : null}>
              <User size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
          ),
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeWrap: { alignItems: "center", justifyContent: "center" },
});
