import { api } from "./apiClient";
import { setToken, clearToken } from "@/src/utils/authToken";

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
  return res;
}

export async function submitKyc(payload: {
  nrcNumber: string;
  fullName: string;
  dateOfBirth: string;
  photoUrl?: string;
}) {
  return api("/auth/kyc", { method: "POST", body: payload });
}

export async function setPin(pin: string) {
  return api("/auth/pin", { method: "POST", body: { pin } });
}

export async function getMe() {
  return api("/auth/me");
}

export async function logout() {
  await clearToken();
}
