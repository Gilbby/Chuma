import { currentUser } from "@/src/data/mock";

export async function loginWithPhone(phone: string): Promise<{ success: boolean }> {
  void phone;
  return { success: true };
}

export async function verifyOtp(
  phone: string,
  otp: string,
): Promise<{ token: string; userId: string }> {
  void phone;
  void otp;
  return { token: "mock-token", userId: currentUser.id };
}

export async function logout(): Promise<void> {
  // no-op for mock
}
