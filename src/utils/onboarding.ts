import { storage } from "@/src/utils/storage";
import { getCurrentUser } from "@/src/utils/currentUser";

const STEP_KEY = "chuma.onboarding.step";

/**
 * Mirrors hasRealName() on the server (chuma-api src/middleware/auth.js):
 * signup creates a "New member" stub and invites store the phone number as a
 * placeholder, so neither counts as a name the user actually chose.
 */
export function hasRealName(name?: string | null): boolean {
  const trimmed = String(name || "").trim();
  if (trimmed.length < 2) return false;
  if (trimmed.toLowerCase() === "new member") return false;
  if (/^[-+0-9 ]+$/.test(trimmed)) return false;
  return true;
}

/** Remember the step onboarding stopped at, so a killed app resumes there. */
export async function setPendingOnboarding(route: string): Promise<boolean> {
  return storage.setItem(STEP_KEY, route);
}

export async function clearPendingOnboarding(): Promise<boolean> {
  return storage.removeItem(STEP_KEY);
}

/**
 * Where a restored session should land. A token on its own is not a finished
 * account: verify-otp issues one before the name and PIN steps, so someone who
 * closed the app mid-onboarding has to resume there instead of dropping into
 * the tabs as "New member".
 */
export async function resumeRoute(): Promise<string> {
  const pending = await storage.getItem<string | null>(STEP_KEY, null);
  if (pending) return pending;
  // No marker — an account created by a build that predates this, or storage
  // that lost it. The cached profile still says whether the name step ran.
  // Sent back to the tabs afterwards, never on to PIN setup: this user may
  // already have a PIN, and re-setting one outside the OTP window is refused
  // by the server, which would strand them on that screen.
  const user = await getCurrentUser<{ name?: string }>();
  if (user && !hasRealName(user.name)) return "/name?return=tabs";
  return "/(tabs)";
}
