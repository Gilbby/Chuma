import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "chuma.auth.token";

export async function getToken(): Promise<string | null> {
  return storage.secureGet(TOKEN_KEY, null);
}

export async function setToken(token: string): Promise<boolean> {
  return storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<boolean> {
  return storage.secureRemove(TOKEN_KEY);
}
