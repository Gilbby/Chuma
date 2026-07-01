import { storage } from "@/src/utils/storage";

const USER_KEY = "chuma.auth.user";

export async function setCurrentUser(user: any): Promise<boolean> {
  return storage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getCurrentUser<T = any>(): Promise<T | null> {
  const raw = await storage.getItem(USER_KEY, null); // returns string | null
  if (!raw) return null;
  try {
    return JSON.parse(raw as string) as T;
  } catch {
    return null;
  }
}

export async function clearCurrentUser(): Promise<boolean> {
  return storage.removeItem(USER_KEY);
}
