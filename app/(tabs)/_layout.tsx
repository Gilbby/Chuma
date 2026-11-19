import React, { useEffect } from "react";
import { Tabs } from "expo-router";
import { Home, Users, ArrowLeftRight, User } from "lucide-react-native";
import { useRole } from "@/src/contexts/RoleContext";
import {
  FloatingTabBar,
  TabBlurProvider,
  TabBlurTarget,
} from "@/src/components/navigation/FloatingTabBar";

export default function TabsLayout() {
  const { refresh } = useRole();

  // The provider mounts above the auth stack, so it derived the role before
  // sign-in. Entering the tabs is the first moment a token exists - re-derive.
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    // The provider + per-screen targets let the floating bar blur the focused
    // screen behind it (required for the glass effect on Android).
    <TabBlurProvider>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenLayout={({ route, children }) => (
          <TabBlurTarget routeKey={route.key}>{children}</TabBlurTarget>
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Home size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            ),
            tabBarButtonTestID: "tab-home",
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: "Groups",
            tabBarIcon: ({ color, focused }) => (
              <Users size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            ),
            tabBarButtonTestID: "tab-groups",
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Transactions",
            tabBarIcon: ({ color, focused }) => (
              <ArrowLeftRight size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            ),
            tabBarButtonTestID: "tab-transactions",
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <User size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            ),
            tabBarButtonTestID: "tab-profile",
          }}
        />
      </Tabs>
    </TabBlurProvider>
  );
}
