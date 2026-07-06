import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ShieldCheck, ScanFace, IdCard, Clock, AlertTriangle } from "lucide-react-native";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { storage } from "@/src/utils/storage";
import { updateProfile } from "@/src/services/auth";
import { setCurrentUser, getCurrentUser } from "@/src/utils/currentUser";
import {
  startKycSession,
  getKycStatus,
  openKycFlow,
  firstNameFrom,
  KycStatus,
  KycStatusResult,
  KycVerifiedIdentity,
} from "@/src/services/kyc";

type Phase = "idle" | "starting" | "verifying" | "checking" | "review";

const TERMINAL: KycStatus[] = ["approved", "declined", "expired", "abandoned"];

export default function Kyc() {
  const { colors } = useTheme();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");

  const busy = phase === "starting" || phase === "verifying" || phase === "checking";

  // Poll our backend for the Didit decision. We keep checking briefly because
  // the webhook may land a moment after the user returns to the app.
  const pollStatus = async (sessionId: string): Promise<KycStatusResult> => {
    let last: KycStatusResult = { status: "pending" };
    for (let i = 0; i < 8; i++) {
      try {
        last = await getKycStatus(sessionId);
        if (TERMINAL.includes(last.status) || last.status === "in_review") return last;
      } catch {
        // A transient network error shouldn't abort the flow — try again.
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    return last;
  };

  const applyApproved = async (v: KycVerifiedIdentity) => {
    const firstName = firstNameFrom(v);
    if (firstName) {
      try {
        // Persist the verified first name as the user's display name.
        await updateProfile({ name: firstName });
      } catch {
        // Backend also sets the name from the Didit decision; cache locally as
        // a fallback so the app still shows their verified first name.
        const current = (await getCurrentUser<any>()) ?? {};
        await setCurrentUser({ ...current, name: firstName });
      }
    }
    await storage.setItem("kyc_draft", {
      firstName,
      fullName: v.fullName ?? firstName,
      documentNumber: v.documentNumber ?? "",
      dateOfBirth: v.dateOfBirth ?? "",
      complete: true,
    });
    router.replace("/pin");
  };

  const startVerification = async () => {
    setError("");
    setPhase("starting");
    try {
      const session = await startKycSession();
      setPhase("verifying");
      // Whether they return via the deep link or just close the browser, we
      // still check the decision — the webhook may already have landed.
      await openKycFlow(session.url);
      setPhase("checking");
      const result = await pollStatus(session.sessionId);

      if (result.status === "approved" && result.verified) {
        await applyApproved(result.verified);
        return;
      }
      if (result.status === "declined") {
        setPhase("idle");
        setError("We couldn't verify your identity. Please try again with a clear photo of your document.");
        return;
      }
      if (result.status === "expired" || result.status === "abandoned") {
        setPhase("idle");
        setError("Your verification session ended before it finished. Please start again.");
        return;
      }
      // pending / in_review — submitted but not yet decided.
      setPhase("review");
    } catch (e: any) {
      setPhase("idle");
      setError(e?.message || "Couldn't start verification. Please try again.");
    }
  };

  const handleSkip = async () => {
    await storage.setItem("kyc_draft", { complete: false });
    router.push("/pin");
  };

  // ── Review state: submitted, awaiting Didit's decision ──────────────────────
  if (phase === "review") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="kyc-screen">
        <ScreenHeader title="" />
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: colors.warning + "22" }]}>
            <Clock size={34} color={colors.warning} />
          </View>
          <Text style={[styles.title, { color: colors.textMain }]}>Verification in review</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Your details were submitted. This usually takes a few minutes — we&apos;ll update your
            profile automatically once it&apos;s approved.
          </Text>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={handleSkip} testID="kyc-continue-btn" />
          <View style={{ height: 10 }} />
          <Button
            label="Check again"
            variant="ghost"
            onPress={startVerification}
            testID="kyc-recheck-btn"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Default: start the Didit verification ───────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="kyc-screen">
      <ScreenHeader title="" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
          <ShieldCheck size={34} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textMain }]}>Verify your identity</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          We&apos;re required by law to verify your identity before you can send or receive money.
          You&apos;ll do this securely with our partner Didit.
        </Text>

        <View style={{ marginTop: 28, gap: 16 }}>
          <Step
            icon={<IdCard size={20} color={colors.primary} />}
            title="Scan your NRC or passport"
            body="Take a photo of your government ID."
            colors={colors}
          />
          <Step
            icon={<ScanFace size={20} color={colors.primary} />}
            title="Take a quick selfie"
            body="A liveness check confirms it's really you."
            colors={colors}
          />
          <Step
            icon={<ShieldCheck size={20} color={colors.primary} />}
            title="Get verified"
            body="Your verified name is added to your Chuma profile."
            colors={colors}
          />
        </View>

        <View style={{ flex: 1, minHeight: 28 }} />

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {phase === "checking" ? "Confirming your verification…" : "Opening secure verification…"}
            </Text>
          </View>
        ) : error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.danger + "15" }]}>
            <AlertTriangle size={16} color={colors.danger} />
            <Text style={[styles.errText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={error ? "Try again" : "Verify with Didit"}
          onPress={startVerification}
          loading={busy}
          disabled={busy}
          testID="kyc-verify-btn"
        />
        <View style={{ height: 10 }} />
        <Button
          label="I'll do this later"
          variant="ghost"
          onPress={handleSkip}
          disabled={busy}
          testID="kyc-skip-btn"
        />

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Your information is encrypted and processed by Didit. It is never shared without your consent.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Step = ({
  icon,
  title,
  body,
  colors,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) => (
  <View style={styles.step}>
    <View style={[styles.stepIcon, { backgroundColor: colors.primarySoft }]}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.textMain, fontSize: 15, fontWeight: "600" }}>{title}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{body}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  sub: { fontSize: 15, marginTop: 8, lineHeight: 22 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  errText: { flex: 1, fontSize: 13, fontWeight: "500" },
  disclaimer: { fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 18 },
});
