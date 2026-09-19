import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { storage } from "@/src/utils/storage";

const ENABLED_KEY = "chuma.biometric.enabled";

/**
 * Whether this phone can actually do biometrics *right now*: the sensor exists
 * and the user has enrolled a fingerprint/face. Hardware without an enrolment
 * can't authenticate, so both checks matter - otherwise we'd offer a switch
 * that always fails. Web has no sensor, so it is always false and the PIN
 * stands alone.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

/** "Fingerprint" / "Face ID" / "Biometric" - for labels, so the copy matches the phone. */
export async function biometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
      return Platform.OS === "ios" ? "Face ID" : "face unlock";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
      return "fingerprint";
  } catch {
    // fall through to the generic label
  }
  return "biometric";
}

/** Run the system prompt. Returns false on cancel, lockout or any failure. */
export async function promptBiometric(reason = "Confirm it's you"): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // The PIN is the fallback everywhere in Chuma, so we keep the system
      // passcode sheet out of it and let the user drop back to ours.
      disableDeviceFallback: true,
      cancelLabel: "Use PIN",
    });
    return res.success;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  // Enrolment can be removed in phone settings after we stored the preference,
  // so availability is re-checked rather than trusted from disk.
  const stored = await storage.getItem<boolean>(ENABLED_KEY, false);
  if (!stored) return false;
  return isBiometricAvailable();
}

export async function setBiometricEnabled(enabled: boolean): Promise<boolean> {
  return storage.setItem(ENABLED_KEY, enabled);
}

const BALANCE_HIDDEN_KEY = "chuma.balance.hidden";

/**
 * Balance visibility survives restarts: left showing, it comes back showing -
 * hiding it is a deliberate act, so it is the hidden state we remember.
 */
export async function isBalanceHidden(): Promise<boolean> {
  return (await storage.getItem<boolean>(BALANCE_HIDDEN_KEY, false)) ?? false;
}

export async function setBalanceHidden(hidden: boolean): Promise<boolean> {
  return storage.setItem(BALANCE_HIDDEN_KEY, hidden);
}

const NUDGE_DISMISSED_KEY = "chuma.biometric.nudgeDismissed";

/** Has the user permanently dismissed the "turn on biometrics" home card? */
export async function isBiometricNudgeDismissed(): Promise<boolean> {
  return (await storage.getItem<boolean>(NUDGE_DISMISSED_KEY, false)) ?? false;
}

export async function setBiometricNudgeDismissed(
  dismissed: boolean
): Promise<boolean> {
  return storage.setItem(NUDGE_DISMISSED_KEY, dismissed);
}

/**
 * Wipe device-local auth/display preferences. These are stored per-device, not
 * per-account, so they MUST be cleared on logout and account deletion -
 * otherwise the next person to sign up on this phone inherits the previous
 * account's biometric-enabled flag (and would get a fingerprint prompt they
 * never set up), its hidden-balance state, or a dismissed enable-biometrics card.
 */
export async function clearLocalAuthPrefs(): Promise<void> {
  await storage.removeItem(ENABLED_KEY);
  await storage.removeItem(BALANCE_HIDDEN_KEY);
  await storage.removeItem(NUDGE_DISMISSED_KEY);
}
