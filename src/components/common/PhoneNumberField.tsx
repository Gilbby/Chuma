import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { CountryPicker } from "@/src/components/common/CountryPicker";
import { ContactPickButton } from "@/src/components/common/ContactPickButton";
import {
  parsePhoneInput,
  parseContactNumber,
  toE164,
  PHONE_INPUT_MAX_LENGTH,
  type PhoneValue,
} from "@/src/utils/phone";

interface Props {
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  /** Red border, plus the message under the field unless showErrorText is false. */
  error?: string;
  showErrorText?: boolean;
  /** Reports a picked contact's name with its E.164 number (e.g. to label an invite). */
  onContactPicked?: (e164: string, name: string | null) => void;
  /** Called when a picked contact's number has a country code we don't offer. */
  onContactError?: (message: string) => void;
  autoFocus?: boolean;
  /** Outer wrapper (row + hint), e.g. { flex: 1 } beside a Send button. */
  style?: StyleProp<ViewStyle>;
  /** The bordered row. */
  rowStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  testID?: string;
  contactsLabel?: string;
}

/**
 * Phone input with a country flag/dial-code picker (Zambia by default - same
 * picker as the login screen) and a contacts button. Pasting "+254…" switches
 * the flag to Kenya; pasting "+260…"/"0…" for Zambia keeps the 9 digits.
 */
export function PhoneNumberField({
  value,
  onChange,
  error,
  showErrorText = true,
  onContactPicked,
  onContactError,
  autoFocus,
  style,
  rowStyle,
  inputStyle,
  testID,
  contactsLabel,
}: Props) {
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  // Name of the contact last picked - shown while the field still holds its number.
  const [picked, setPicked] = useState<{ e164: string; name: string } | null>(null);

  const isZambia = value.country.code === "ZM";
  const pickedName = picked && picked.e164 === toE164(value) ? picked.name : null;

  return (
    <View style={style}>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
          rowStyle,
        ]}
      >
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={8}
          style={styles.prefix}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${value.country.name} ${value.country.dial}. Change country`}
          testID={testID ? `${testID}-country` : undefined}
        >
          <Text style={styles.flag}>{value.country.flag}</Text>
          <Text style={[styles.dial, { color: colors.textMain }]}>{value.country.dial}</Text>
          <ChevronDown size={14} color={colors.textMuted} />
        </Pressable>
        <TextInput
          style={[styles.input, { color: colors.textMain }, inputStyle]}
          value={value.national}
          onChangeText={(t) => onChange(parsePhoneInput(t, value.country))}
          placeholder={isZambia ? "97X XXX XXX" : "Phone number"}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={PHONE_INPUT_MAX_LENGTH}
          autoFocus={autoFocus}
          testID={testID}
        />
        <ContactPickButton
          accessibilityLabel={contactsLabel}
          testID={testID ? `${testID}-contacts` : undefined}
          onPicked={({ phoneNumber, name }) => {
            const next = parseContactNumber(phoneNumber, value.country);
            if (!next) {
              onContactError?.(`${phoneNumber} - that country isn't supported yet`);
              return;
            }
            const e164 = toE164(next);
            setPicked(name ? { e164, name } : null);
            onChange(next);
            onContactPicked?.(e164, name ?? null);
          }}
        />
      </View>

      {error && showErrorText ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{error}</Text>
      ) : !error && pickedName ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{pickedName}</Text>
      ) : null}

      <CountryPicker
        visible={pickerOpen}
        selectedCode={value.country.code}
        onSelect={(c) => onChange({ country: c, national: value.national })}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  prefix: { flexDirection: "row", alignItems: "center", gap: 4 },
  flag: { fontSize: 18 },
  dial: { fontSize: 15, fontWeight: "600" },
  input: { flex: 1, fontSize: 15, fontWeight: "500", padding: 0, minWidth: 32 },
  hint: { fontSize: 12, marginTop: 6, fontWeight: "500" },
});
