import { router } from "expo-router";
import { API_BASE_URL } from "@/src/config/api";
import { getToken, clearToken } from "@/src/utils/authToken";
import { clearCurrentUser } from "@/src/utils/currentUser";

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: any;
  auth?: boolean;
};

export type ApiError = Error & { status?: number };

const REQUEST_TIMEOUT_MS = 15_000;

// Debounce the redirect so a burst of parallel 401s only navigates once
let handlingExpiredSession = false;

async function onSessionExpired() {
  if (handlingExpiredSession) return;
  handlingExpiredSession = true;
  try {
    await clearToken();
    await clearCurrentUser();
    router.replace("/welcome");
  } finally {
    setTimeout(() => {
      handlingExpiredSession = false;
    }, 2000);
  }
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw new Error("Network error. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  // Never assume JSON: a proxy/tunnel error page (HTML) would otherwise throw
  // a raw SyntaxError at the user instead of a readable message.
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) throw new Error("Unexpected server response. Try again.");
    }
  }

  if (!res.ok) {
    // Expired/invalid session: clear credentials and return to sign-in
    if (res.status === 401 && auth) {
      await onSessionExpired();
      throw new Error("Session expired. Please sign in again.");
    }
    const err = new Error(data?.error || `Request failed (${res.status})`) as ApiError;
    err.status = res.status;
    throw err;
  }

  return data as T;
}
