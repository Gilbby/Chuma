import React from "react";
import { View, Text, Modal, Pressable } from "react-native";
import { useTheme } from "@/src/theme/ThemeContext";
import { Card } from "@/src/components/ui/Card";
import { Button } from "@/src/components/ui/Button";
import { Download, FileText, FileSpreadsheet } from "lucide-react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  pdfHint?: string;
  csvHint?: string;
  onPdf: () => void;
  onCsv: () => void;
}

/**
 * Bottom sheet offering the two export formats. Shared by the Transactions
 * tab, Reports and Statement so every export entry point looks the same.
 */
export const ExportSheet: React.FC<Props> = ({
  visible,
  onClose,
  title = "Export",
  subtitle = "Download this as a file",
  pdfHint = "Formatted document, ready to print or share",
  csvHint = "Spreadsheet format, opens in Excel or Sheets",
  onPdf,
  onCsv,
}) => {
  const { colors } = useTheme();
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 24,
        }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: "center",
            marginBottom: 20,
          }}
        />
        <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 20 }}>{subtitle}</Text>
        <Card padding={0}>
          <Pressable
            onPress={run(onPdf)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
            testID="export-pdf-btn"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.danger + "15",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={20} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                Export as PDF
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{pdfHint}</Text>
            </View>
            <Download size={18} color={colors.textMuted} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Pressable
            onPress={run(onCsv)}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
            testID="export-csv-btn"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.success + "15",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileSpreadsheet size={20} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMain, fontWeight: "700", fontSize: 14 }}>
                Export as CSV
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{csvHint}</Text>
            </View>
            <Download size={18} color={colors.textMuted} />
          </Pressable>
        </Card>
        <Button label="Cancel" variant="ghost" fullWidth style={{ marginTop: 16 }} onPress={onClose} />
      </View>
    </Modal>
  );
};
