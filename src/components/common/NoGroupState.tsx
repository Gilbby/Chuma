import React from "react";
import { View, Text } from "react-native";
import { Users } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme/ThemeContext";
import { Button } from "@/src/components/ui/Button";

interface Props {
  /** What this particular screen needs a group for. */
  message: string;
  title?: string;
  testID?: string;
}

/**
 * Shown when a screen needs a group and the member has none yet. The CTA lands
 * on the Groups tab rather than create-group directly: the + button there
 * already gates founding a group behind KYC, and joining an invite is the more
 * common path for a new member anyway.
 */
export const NoGroupState: React.FC<Props> = ({
  message,
  title = "You're not in a group yet",
  testID,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Users size={26} color={colors.primary} />
      </View>
      <Text style={{ color: colors.textMain, fontSize: 16, fontWeight: "700", marginTop: 16 }}>
        {title}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 14,
          lineHeight: 21,
          textAlign: "center",
          marginTop: 6,
        }}
      >
        {message}
      </Text>
      <Button
        label="Go to my groups"
        variant="primary"
        onPress={() => router.replace("/(tabs)/groups")}
        style={{ marginTop: 20 }}
        testID="no-group-cta"
        fullWidth={false}
      />
    </View>
  );
};
