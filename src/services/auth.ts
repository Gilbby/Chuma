import { api } from "./apiClient";
import { setToken, clearToken } from "@/src/utils/authToken";
import { setCurrentUser, clearCurrentUser } from "@/src/utils/currentUser";
import { clearPendingOnboarding } from "@/src/utils/onboarding";

export async function requestOtp(
  phone: string,
  mode: "signup" | "signin",
): Promise<{ devCode?: string }> {
  return api("/auth/request-otp", { method: "POST", body: { phone, mode }, auth: false });
}

export async function verifyOtp(
  phone: string,
  code: string,
  mode: "signup" | "signin",
): Promise<{ token: string; user: any; next: string }> {
  const res = await api<{ token: string; user: any; next: string }>(
    "/auth/verify-otp",
    { method: "POST", body: { phone, code, mode }, auth: false },
  );
  if (res.token) await setToken(res.token);
  if (res.user) await setCurrentUser(res.user);
  return res;
}

export async function setPin(pin: string) {
  return api("/auth/pin", { method: "POST", body: { pin } });
}

/**
 * Check the app PIN without changing it. Throws an ApiError whose `code` is
 * "no_pin" when the account never set one, "bad_pin" when it is wrong, and
 * "pin_locked" after too many wrong tries.
 */
export async function verifyPin(pin: string): Promise<boolean> {
  const res = await api<{ valid: boolean }>("/auth/verify-pin", {
    method: "POST",
    body: { pin },
  });
  return !!res?.valid;
}

export async function getMe() {
  const res = await api("/auth/me");
  if (res?.user) await setCurrentUser(res.user);
  return res;
}

export async function updateProfile(payload: {
  name?: string;
  avatar?: string;
  preferredPayment?: { method?: string; accountName?: string; accountNumber?: string };
}): Promise<any> {
  const res = await api<{ user: any }>("/auth/profile", { method: "PATCH", body: payload });
  if (res?.user) await setCurrentUser(res.user); // keep cached user fresh
  return res.user;
}

export async function logout() {
  await clearToken();
  await clearCurrentUser();
  await clearPendingOnboarding();
}
