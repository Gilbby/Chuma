import React from "react";
import { Pressable, Alert } from "react-native";
import { BookUser } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { isContactPickerAvailable, pickPhoneNumber, type PickedPhone } from "@/modules/contact-picker";

interface Props {
  /** The number exactly as stored in the contact, plus its name. */
  onPicked: (picked: PickedPhone) => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Contacts icon for a phone field. Opens the OS contact picker, which returns
 * only the one number tapped - Chuma never holds a contacts permission
 * (Google Play "Manage Contacts" policy). Renders nothing where the native
 * module isn't present (web, Expo Go), leaving the field type-only.
 */
export const ContactPickButton: React.FC<Props> = ({ onPicked, accessibilityLabel, testID }) => {
  const { colors } = useTheme();
  if (!isContactPickerAvailable) return null;

  const open = async () => {
    try {
      const picked = await pickPhoneNumber();
      if (picked) onPicked(picked);
    } catch (e: any) {
      Alert.alert("Couldn't open contacts", e?.message || "Please type the number instead.");
    }
  };

  return (
    <Pressable
      onPress={open}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? "Choose from contacts"}
      testID={testID}
    >
      <BookUser size={20} color={colors.primary} />
    </Pressable>
  );
};
