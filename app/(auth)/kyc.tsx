import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ShieldCheck, ScanFace, IdCard, Clock, AlertTriangle } from "lucide-react-native";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { storage } from "@/src/utils/storage";
import { updateProfile } from "@/src/services/auth";
import { setCurrentUser, getCurrentUser } from "@/src/utils/currentUser";
import { clearPendingOnboarding } from "@/src/utils/onboarding";
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
  // Where to go once verification finishes. From the Create-group tap
  // (return=create-group) we continue into the wizard they were reaching for;
  // every other entry point is from inside the app, so we return them to it.
  // There is no onboarding fallback: KYC is never part of signing up, so this
  // screen is only ever reached by someone who already finished setup.
  const { return: returnTo } = useLocalSearchParams<{ return?: string }>();
  const fromCreateGroup = returnTo === "create-group";
  const afterKyc = fromCreateGroup ? "/(modals)/create-group" : "/(tabs)";
  // Skipping must never drop them into a screen that needs verification —
  // a skipped create-group goes back to the Groups list instead.
  const skipTo = fromCreateGroup ? "/(tabs)/groups" : afterKyc;
  // KYC is never a hard gate now: it can always be postponed.
  const canSkip = true;
  const skipLabel = fromCreateGroup ? "Not now" : "I'll do this later";

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

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
    // Reflect verified status in the cached user so the home KYC nudge clears.
    const current = (await getCurrentUser<any>()) ?? {};
    await setCurrentUser({
      ...current,
      name: firstName || current.name,
      kyc: { ...(current.kyc ?? {}), status: "verified" },
    });
    await storage.setItem("kyc_draft", {
      firstName,
      fullName: v.fullName ?? firstName,
      documentNumber: v.documentNumber ?? "",
      dateOfBirth: v.dateOfBirth ?? "",
      complete: true,
    });
    await clearPendingOnboarding();
    router.replace(afterKyc);
  };

  const startVerification = async () => {
    setError("");
    setPhase("starting");
    try {
      const session = await startKycSession();
      setSessionId(session.sessionId);
      setPhase("verifying");
      // Whether they return via the deep link or just close the browser, we
      // still check the decision — the webhook may already have landed.
      await openKycFlow(session.url);
      setPhase("checking");
      const result = await pollStatus(session.sessionId);
      await handleResult(result);
    } catch (e: any) {
      setPhase("idle");
      setError(e?.message || "Couldn't start verification. Please try again.");
    }
  };

  // Route the KYC decision. Only `approved` leaves this screen (→ applyApproved
  // → afterKyc). Every other outcome holds the user here, but verification is a
  // soft gate: the skip button below lets them continue unverified (handleSkip).
  const handleResult = async (result: KycStatusResult) => {
    if (result.status === "approved" && result.verified) {
      await applyApproved(result.verified);
      return;
    }
    if (result.status === "expired" || result.status === "abandoned") {
      setPhase("idle");
      setError("Your verification session ended before it finished. Please start again.");
      return;
    }
    // declined / pending / in_review — submitted but not yet approved. We hold on
    // the review screen rather than dead-ending: Zambian NRCs the automated engine
    // can't read are approved manually, so a "declined" here becomes a review hold
    // that clears once we approve the account. Genuine bad captures can re-submit
    // from the review screen ("Try a different photo").
    setPhase("review");
  };

  // Re-poll the existing session (used from the review screen) without
  // reopening the Didit flow. Advances to the app only if now approved.
  const recheck = async () => {
    if (!sessionId) {
      setPhase("idle");
      return;
    }
    setPhase("checking");
    try {
      const result = await pollStatus(sessionId);
      await handleResult(result);
    } catch {
      setPhase("review");
    }
  };

  // KYC is a soft nudge, not a hard gate: the user may continue into the app
  // without verifying now. A standing reminder stays in their inbox (and a home
  // banner) until they complete it.
  const handleSkip = async () => {
    // Legacy onboarding could route here straight from OTP; either way this
    // screen is now behind them, so the resume marker goes with it.
    await clearPendingOnboarding();
    await storage.setItem("kyc_draft", { complete: false });
    // Reached from the Groups + button (or from create-group's own guard), this
    // screen sits on top of the tabs stack, so popping lands exactly back on
    // Groups. replace() would mount a second tabs instance inside the stack
    // instead of unwinding to the one already there.
    if (fromCreateGroup && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(skipTo);
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
            Your details were submitted and are being reviewed. Some IDs need a quick manual check,
            so this can take a little while.{" "}
            {fromCreateGroup ? "You can't create a group until you're approved. " : ""}
            Tap Check status to see if you are.
          </Text>
          <View style={{ flex: 1 }} />
          <Button
            label="Check status"
            onPress={recheck}
            loading={busy}
            disabled={busy}
            testID="kyc-recheck-btn"
          />
          <View style={{ height: 10 }} />
          <Button
            label="Try a different photo"
            variant="ghost"
            onPress={startVerification}
            disabled={busy}
            testID="kyc-resubmit-btn"
          />
          {canSkip && (
            <>
              <View style={{ height: 10 }} />
              <Button
                label={skipLabel}
                variant="ghost"
                onPress={handleSkip}
                disabled={busy}
                testID="kyc-continue-btn"
              />
            </>
          )}
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
          Only verified members can create a group. It&apos;s a one-time check, handled securely by
          our verification partner, and it takes about two minutes.
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
            body="Once approved, you can create and manage your own group."
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
          label={error ? "Try again" : "Start verification"}
          onPress={startVerification}
          loading={busy}
          disabled={busy}
          testID="kyc-verify-btn"
        />
        {canSkip && (
          <>
            <View style={{ height: 10 }} />
            <Button
              label={skipLabel}
              variant="ghost"
              onPress={handleSkip}
              disabled={busy}
              testID="kyc-skip-btn"
            />
          </>
        )}

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Your information is encrypted and processed by our verification partner. It is never shared
          without your consent.
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
