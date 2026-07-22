import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { Button } from "@/src/components/ui/Button";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatZMW } from "@/src/utils/currency";
import {
  CheckCircle2,
  Download,
  Share2,
  Copy,
  PiggyBank,
  Banknote,
  RefreshCw,
  Gift,
  Wallet,
} from "lucide-react-native";

const TYPE_ICONS = {
  contribution: PiggyBank,
  loan: Banknote,
  repayment: RefreshCw,
  "share-out": Gift,
  withdrawal: Wallet,
};

interface ReceiptParams {
  id?: string;
  amount?: string;
  type?: string;
  group?: string;
  date?: string;
  note?: string;
  txnId?: string;
  status?: string;
  direction?: string;
  networkFee?: string;
}

export default function ReceiptScreen() {
  const { colors, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams() as ReceiptParams;

  // Build the receipt entirely from params — callers pass all needed data.
  const data = useMemo(() => {
    const txnId = params.txnId
      ? params.txnId
      : params.id
        ? `CHM-${params.id.toUpperCase()}-${(2026 + parseInt(params.id.replace(/\D/g, "") || "0", 10)) % 99999}`
        : `CHM-${Date.now().toString().slice(-8)}`;
    return {
      amount: parseFloat(params.amount ?? "0"),
      type: (params.type ?? "contribution") as keyof typeof TYPE_ICONS,
      groupName: params.group ?? "Lusaka Market Sisters",
      date: params.date ?? new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
      note: params.note ?? "",
      status: (params.status ?? "completed") as "completed" | "pending" | "failed",
      direction: (params.direction ?? "out") as "in" | "out",
      networkFee: parseFloat(params.networkFee ?? "0"), // member's own MMO fee (display-only)
      txnId,
    };
  }, [params]);

  const Icon = TYPE_ICONS[data.type as keyof typeof TYPE_ICONS] ?? PiggyBank;
  const typeLabel =
    data.type === "share-out"
      ? "Share-out"
      : data.type.charAt(0).toUpperCase() + data.type.slice(1);

  const buildHtml = () => {
    const isIn = data.direction === "in";
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 24px; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #064E3B; background: #fff; }
  .wrap { max-width: 520px; margin: 0 auto; }
  .header { background: #0A5C36; color: #fff; padding: 28px; border-radius: 20px 20px 0 0; }
  .brand { display:flex; align-items:center; gap:12px; margin-bottom: 18px; }
  .logo { width: 36px; height: 36px; border-radius: 11px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.45); display:inline-flex; align-items:center; justify-content:center; }
  .brand-name { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .label { font-size: 11px; font-weight: 600; letter-spacing: 1.4px; color: rgba(255,255,255,0.75); text-transform: uppercase; }
  .amount { font-size: 38px; font-weight: 800; letter-spacing: -1px; margin-top: 6px; }
  .body { background: #fff; border: 1px solid #E5E7EB; border-top: 0; padding: 26px 28px; border-radius: 0 0 20px 20px; }
  .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #F3F5F4; }
  .row:last-child { border-bottom: 0; }
  .row .k { color: #6B7280; font-size: 13px; }
  .row .v { color: #064E3B; font-weight: 600; font-size: 14px; max-width: 60%; text-align: right; }
  .status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .status.completed { background: #D1FAE5; color: #059669; }
  .status.pending { background: #FEF3C7; color: #B45309; }
  .status.failed { background: #FEE2E2; color: #DC2626; }
  .foot { margin-top: 22px; text-align: center; color: #9CA3AF; font-size: 11px; line-height: 18px; }
  .id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: #6B7280; letter-spacing: 0.5px; }
  .stamp { display:inline-block; margin-top: 10px; border: 2px solid #10B981; color: #10B981; padding: 6px 12px; border-radius: 6px; font-weight: 800; letter-spacing: 1.5px; transform: rotate(-6deg); font-size: 12px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="brand">
        <span class="logo"><img src="data:image/png;base64,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" style="width:24px;height:24px;" /></span>
        <span class="brand-name">Chuma</span>
      </div>
      <div class="label">${typeLabel} receipt</div>
      <div class="amount">${isIn ? "+" : "−"} ${formatZMW(data.amount)}</div>
    </div>
    <div class="body">
      <div class="row"><span class="k">Status</span><span class="v"><span class="status ${data.status}">${data.status}</span></span></div>
      <div class="row"><span class="k">Transaction ID</span><span class="v id">${data.txnId}</span></div>
      <div class="row"><span class="k">Type</span><span class="v">${typeLabel}</span></div>
      <div class="row"><span class="k">Group</span><span class="v">${data.groupName}</span></div>
      <div class="row"><span class="k">Date</span><span class="v">${data.date}</span></div>
      ${data.note ? `<div class="row"><span class="k">Note</span><span class="v">${data.note}</span></div>` : ""}
      ${data.networkFee > 0 ? `<div class="row"><span class="k">Your network fee</span><span class="v">${formatZMW(data.networkFee)}</span></div>` : ""}
      <div class="row"><span class="k">Member</span><span class="v">Gilbert · +260 977 234 567</span></div>
      ${data.status === "completed" ? '<div style="text-align:center;"><span class="stamp">PAID</span></div>' : ""}
      <div class="foot">
        This is an official Chuma receipt.<br />
        Community Chuma, Digitally.<br /><br />
        Verify at chuma.app · ${new Date().getFullYear()}
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const onShare = async () => {
    try {
      const html = buildHtml();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Chuma receipt · ${typeLabel}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Sharing unavailable", "Your device cannot share files right now.");
      }
    } catch (e) {
      Alert.alert("Couldn't generate receipt", "Please try again.");
    }
  };

  const onCopyId = () => {
    // simple feedback alert (avoid clipboard dependency)
    Alert.alert("Transaction ID", data.txnId);
  };

  const statusColor =
    data.status === "completed" ? colors.success : data.status === "pending" ? colors.warning : colors.danger;
  const statusBg =
    data.status === "completed"
      ? mode === "light" ? "#D1FAE5" : "#0D3D2C"
      : data.status === "pending"
        ? mode === "light" ? "#FEF3C7" : "#3D2F0E"
        : mode === "light" ? "#FEE2E2" : "#3F1414";

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
      testID="receipt-screen"
    >
      <ScreenHeader
        title="Receipt"
        subtitle={typeLabel}
        rightAction={
          <Pressable onPress={onShare} hitSlop={10} testID="receipt-header-share">
            <Share2 size={20} color={colors.primary} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Receipt card */}
        <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Top emerald band */}
          <View style={[styles.band, { backgroundColor: colors.primary }]}>
            <View style={styles.brand}>
              <View style={styles.logoSm}>
                <Image
                  source={require("@/assets/images/logo-mark.png")}
                  style={{ width: 24, height: 24 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>Chuma</Text>
            </View>
            <Text style={styles.bandLabel}>{typeLabel.toUpperCase()} RECEIPT</Text>
            <Text style={styles.bandAmount}>
              {data.direction === "in" ? "+" : "−"} {formatZMW(data.amount)}
            </Text>
            {data.status === "completed" ? (
              <View style={styles.stamp}>
                <CheckCircle2 size={14} color="#10B981" />
                <Text style={styles.stampText}>PAID</Text>
              </View>
            ) : null}
          </View>

          {/* Perforation */}
          <View style={styles.perforation}>
            <View style={[styles.notchL, { backgroundColor: colors.background }]} />
            <View style={styles.dottedRow}>
              {Array.from({ length: 30 }).map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: colors.borderStrong }]} />
              ))}
            </View>
            <View style={[styles.notchR, { backgroundColor: colors.background }]} />
          </View>

          {/* Details */}
          <View style={{ padding: 22 }}>
            <Row k="Status" colors={colors}>
              <View style={[styles.badge, { backgroundColor: statusBg }]}>
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                  {data.status.toUpperCase()}
                </Text>
              </View>
            </Row>
            <Row k="Transaction ID" colors={colors}>
              <Pressable onPress={onCopyId} style={{ flexDirection: "row", alignItems: "center" }} testID="receipt-copy-id">
                <Text style={[styles.mono, { color: colors.textMain }]}>{data.txnId}</Text>
                <Copy size={12} color={colors.textMuted} style={{ marginLeft: 6 }} />
              </Pressable>
            </Row>
            <Row k="Type" colors={colors}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Icon size={14} color={colors.primary} />
                <Text style={[styles.val, { color: colors.textMain, marginLeft: 6 }]}>{typeLabel}</Text>
              </View>
            </Row>
            <Row k="Group" colors={colors}>
              <Text style={[styles.val, { color: colors.textMain }]}>{data.groupName}</Text>
            </Row>
            <Row k="Date" colors={colors}>
              <Text style={[styles.val, { color: colors.textMain }]}>{data.date}</Text>
            </Row>
            {data.note ? (
              <Row k="Note" colors={colors}>
                <Text style={[styles.val, { color: colors.textMain }]}>{data.note}</Text>
              </Row>
            ) : null}
            {data.networkFee > 0 ? (
              <Row k="Your network fee" colors={colors}>
                <Text style={[styles.val, { color: colors.textMain }]}>{formatZMW(data.networkFee)}</Text>
              </Row>
            ) : null}
            <Row k="Member" colors={colors} last>
              <Text style={[styles.val, { color: colors.textMain }]}>Gilbert · +260 977 234 567</Text>
            </Row>
          </View>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
              This is an official Chuma receipt.{"\n"}
              Verify at chuma.app · Community Chuma, Digitally.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ marginTop: 20 }}>
          <Button
            label={Platform.OS === "web" ? "Open & print PDF" : "Share as PDF"}
            icon={<Download size={18} color="#fff" />}
            onPress={onShare}
            testID="receipt-share-btn"
          />
          <View style={{ height: 10 }} />
          <Button
            label="Done"
            variant="outline"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            testID="receipt-done-btn"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({
  k,
  children,
  colors,
  last,
}: {
  k: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
  last?: boolean;
}) => (
  <View
    style={[
      styles.row,
      !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
    ]}
  >
    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{k}</Text>
    <View style={{ maxWidth: "62%", alignItems: "flex-end" }}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  receipt: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  band: {
    padding: 24,
    paddingBottom: 28,
  },
  brand: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  logoSm: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandName: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  bandLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  bandAmount: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 6,
  },
  stamp: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: "#10B981",
    backgroundColor: "rgba(16,185,129,0.12)",
    borderRadius: 6,
    marginTop: 14,
    transform: [{ rotate: "-4deg" }],
    gap: 6,
  },
  stampText: {
    color: "#10B981",
    fontWeight: "800",
    letterSpacing: 1.6,
    fontSize: 11,
    marginLeft: 4,
  },
  perforation: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  notchL: {
    position: "absolute",
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  notchR: {
    position: "absolute",
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  dottedRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  dot: {
    width: 4,
    height: 1.5,
    borderRadius: 1,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  val: { fontSize: 14, fontWeight: "600" },
  mono: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  footer: { paddingHorizontal: 22, paddingVertical: 16, borderTopWidth: 1 },
});
