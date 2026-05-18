import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { radius } from "@/src/theme/theme";

interface Props extends TextInputProps {
  label?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<Props> = ({
  label,
  prefix,
  suffix,
  error,
  containerStyle,
  style,
  ...rest
}) => {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          },
        ]}
      >
        {prefix ? <View style={{ marginRight: 8 }}>{prefix}</View> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: colors.textMain }, style]}
          {...rest}
        />
        {suffix ? <View style={{ marginLeft: 8 }}>{suffix}</View> : null}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "500", marginBottom: 8, letterSpacing: 0.2 },
  inputWrap: {
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  input: { flex: 1, fontSize: 16, fontWeight: "500" },
  errorText: { fontSize: 12, marginTop: 6 },
});
