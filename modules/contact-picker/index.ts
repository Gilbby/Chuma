import { requireOptionalNativeModule } from "expo";

export type PickedPhone = {
  /** The number exactly as stored in the contact, e.g. "+260 97 123 4567" or "0971234567". */
  phoneNumber: string;
  name: string | null;
};

type ContactPickerNative = {
  pickPhoneNumber(): Promise<PickedPhone | null>;
};

// Optional: null on web and in Expo Go (no native code), so callers can hide the button.
const native = requireOptionalNativeModule<ContactPickerNative>("ContactPicker");

/** True when the system contact picker can be shown on this build/platform. */
export const isContactPickerAvailable = native != null;

/**
 * Opens the OS contact picker filtered to phone numbers.
 * Resolves with the chosen number, or null if the user cancelled.
 * Uses no contacts permission on either platform.
 */
export async function pickPhoneNumber(): Promise<PickedPhone | null> {
  if (!native) return null;
  return native.pickPhoneNumber();
}
