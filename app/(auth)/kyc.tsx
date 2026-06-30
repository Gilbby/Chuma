import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { Button } from "@/src/components/ui/Button";
import { ScreenHeader } from "@/src/components/common/ScreenHeader";
import { useTheme } from "@/src/theme/ThemeContext";
import { storage } from "@/src/utils/storage";
import { submitKyc } from "@/src/services/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NRC_RE = /^\d{6}\/\d{2}\/\d{1}$/;

function formatNrc(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}/${digits.slice(6)}`;
  return `${digits.slice(0, 6)}/${digits.slice(6, 8)}/${digits.slice(8)}`;
}

function formatDob(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDob(dob: string): Date | null {
  const parts = dob.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy || yyyy < 1900 || yyyy > 9999) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function isAtLeast18(dob: Date): boolean {
  const now = new Date();
  const eighteenth = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
  return now >= eighteenth;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Kyc() {
  const { colors } = useTheme();
  const router = useRouter();

  const [nrc, setNrc] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [nrcPhoto, setNrcPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const handleNrcChange = (text: string) => {
    setNrc(formatNrc(text));
    setErrors((p) => { const n = { ...p }; delete n.nrc; return n; });
  };

  const handleDobChange = (text: string) => {
    setDob(formatDob(text));
    setErrors((p) => { const n = { ...p }; delete n.dob; return n; });
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.8,
    });
    if (!result.canceled) setNrcPhoto(result.assets[0].uri);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!NRC_RE.test(nrc)) e.nrc = "Enter a valid NRC number e.g. 123456/78/1";
    if (!fullName.trim()) e.fullName = "Enter your full name";
    const dobDate = parseDob(dob);
    if (!dobDate) {
      e.dob = "Enter a valid date of birth";
    } else if (!isAtLeast18(dobDate)) {
      e.dob = "You must be 18 or older to use Chuma";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveDraft = () =>
    storage.setItem("kyc_draft", {
      nrc,
      fullName: fullName.trim(),
      dob,
      nrcPhotoUri: nrcPhoto ?? null,
      complete: true,
    });

  const handleContinue = async () => {
    if (!validate()) return;
    setLoading(true);
    setApiError("");
    try {
      const dobDate = parseDob(dob)!;
      const dateOfBirth = `${dobDate.getFullYear()}-${String(dobDate.getMonth() + 1).padStart(2, "0")}-${String(dobDate.getDate()).padStart(2, "0")}`;
      await submitKyc({
        nrcNumber: nrc,
        fullName: fullName.trim(),
        dateOfBirth,
        photoUrl: nrcPhoto ?? undefined,
      });
      await saveDraft();
      router.replace("/pin");
    } catch (e: any) {
      setApiError(e.message || "KYC submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await storage.setItem("kyc_draft", {
      nrc: "",
      fullName: "",
      dob: "",
      nrcPhotoUri: null,
      complete: false,
    });
    router.push("/pin");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} testID="kyc-screen">
      <ScreenHeader title="" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: colors.textMain }]}>Verify your identity</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              We're required by law to verify your identity before you can send or receive money.
            </Text>

            {/* NRC Number */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NRC NUMBER</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.textMain,
                  backgroundColor: colors.surface,
                  borderColor: errors.nrc ? colors.danger : colors.border,
                },
              ]}
              value={nrc}
              onChangeText={handleNrcChange}
              placeholder="000000/00/0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              testID="kyc-nrc-input"
            />
            {errors.nrc ? (
              <Text style={[styles.errText, { color: colors.danger }]}>{errors.nrc}</Text>
            ) : null}

            {/* Full legal name */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 20 }]}>
              FULL NAME AS ON NRC
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.textMain,
                  backgroundColor: colors.surface,
                  borderColor: errors.fullName ? colors.danger : colors.border,
                },
              ]}
              value={fullName}
              onChangeText={(t) => {
                setFullName(t);
                setErrors((p) => { const n = { ...p }; delete n.fullName; return n; });
              }}
              placeholder="e.g. Chisomo Banda"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              testID="kyc-name-input"
            />
            {errors.fullName ? (
              <Text style={[styles.errText, { color: colors.danger }]}>{errors.fullName}</Text>
            ) : null}

            {/* Date of birth */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 20 }]}>
              DATE OF BIRTH
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.textMain,
                  backgroundColor: colors.surface,
                  borderColor: errors.dob ? colors.danger : colors.border,
                },
              ]}
              value={dob}
              onChangeText={handleDobChange}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              testID="kyc-dob-input"
            />
            {errors.dob ? (
              <Text style={[styles.errText, { color: colors.danger }]}>{errors.dob}</Text>
            ) : null}

            {/* NRC photo upload */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 20 }]}>
              NRC PHOTO (OPTIONAL)
            </Text>
            <Pressable
              onPress={pickPhoto}
              style={[
                styles.uploadArea,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              testID="kyc-photo-btn"
            >
              {nrcPhoto ? (
                <Image source={{ uri: nrcPhoto }} style={styles.photoThumb} />
              ) : (
                <>
                  <View style={[styles.cameraCircle, { backgroundColor: colors.primarySoft }]}>
                    <Camera size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.uploadText, { color: colors.textMuted }]}>
                    Tap to upload front of NRC
                  </Text>
                </>
              )}
            </Pressable>
            <Text style={[styles.photoHint, { color: colors.textMuted }]}>
              Photo verification speeds up your KYC approval
            </Text>

            <View style={{ flex: 1, minHeight: 32 }} />

            {apiError ? (
              <Text style={[styles.errText, { color: colors.danger, textAlign: "center", marginBottom: 8 }]}>
                {apiError}
              </Text>
            ) : null}
            <Button
              label="Continue"
              onPress={handleContinue}
              loading={loading}
              testID="kyc-continue-btn"
            />
            <View style={{ height: 10 }} />
            <Button
              label="I'll do this later"
              variant="ghost"
              onPress={handleSkip}
              testID="kyc-skip-btn"
            />

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              Your information is encrypted and never shared without your consent.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  sub: { fontSize: 15, marginTop: 8, lineHeight: 22, marginBottom: 28 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "500",
  },
  errText: { fontSize: 12, marginTop: 6, fontWeight: "500" },
  uploadArea: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    gap: 10,
  },
  cameraCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: { fontSize: 13, fontWeight: "500" },
  photoThumb: { width: "100%", height: "100%", resizeMode: "cover" },
  photoHint: { fontSize: 12, marginTop: 8 },
  disclaimer: { fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 18 },
});
