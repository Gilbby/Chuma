import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X, Check } from "lucide-react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { COUNTRIES, type Country } from "@/src/constants/countries";

/**
 * Full-screen country picker for the phone-number entry. Searchable by name or
 * dial code, so the list length never gets in the way. The caller owns the
 * selected country; this just reports a new pick.
 */
export function CountryPicker({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCode?: string;
  onSelect: (country: Country) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const digits = q.replace(/[^0-9+]/g, "");
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (digits.length > 0 && c.dial.includes(digits))
    );
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]} testID="country-picker">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textMain }]}>Choose country</Text>
          <Pressable onPress={onClose} hitSlop={10} testID="country-picker-close">
            <X size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textMain }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search country or code"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            testID="country-picker-search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          data={results}
          keyExtractor={(c) => c.code}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>No countries match “{query}”.</Text>
          }
          renderItem={({ item }) => {
            const active = item.code === selectedCode;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={[styles.row, { borderBottomColor: colors.border }]}
                testID={`country-${item.code}`}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={[styles.name, { color: colors.textMain }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.dial, { color: colors.textMuted }]}>{item.dial}</Text>
                {active ? <Check size={18} color={colors.primary} /> : <View style={{ width: 18 }} />}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: "700" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  flag: { fontSize: 24 },
  name: { flex: 1, fontSize: 16, fontWeight: "500" },
  dial: { fontSize: 15, fontWeight: "600", marginRight: 6 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
