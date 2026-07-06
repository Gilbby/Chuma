// Didit.me identity verification (KYC).
//
// The Didit API key is SERVER-SIDE only. The app never talks to Didit
// directly: our backend (chuma-api) creates the verification session, holds the
// webhook, and exposes the decision. The client just opens the hosted flow and
// polls our backend for the result. See docs/didit-kyc.md for the backend
// contract these functions expect.

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api } from "./apiClient";

export type KycStatus =
  | "not_started"
  | "pending" // session created, waiting for the user to finish
  | "in_review" // Didit is processing / manual review
  | "approved"
  | "declined"
  | "expired"
  | "abandoned";

export interface KycVerifiedIdentity {
  firstName: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd
  documentNumber?: string; // NRC / passport number
  documentType?: string;
}

export interface KycSession {
  sessionId: string;
  url: string; // Didit hosted verification URL
}

export interface KycStatusResult {
  status: KycStatus;
  verified?: KycVerifiedIdentity;
}

// Deep link the Didit hosted flow returns to when the user finishes. Uses the
// app scheme from app.json ("frontend") → frontend://kyc-callback.
export const KYC_RETURN_URL = Linking.createURL("kyc-callback");

// Ask our backend to create a Didit session. The backend configures the
// workflow + webhook and returns the hosted verification URL.
export async function startKycSession(): Promise<KycSession> {
  return api<KycSession>("/auth/kyc/session", {
    method: "POST",
    body: { returnUrl: KYC_RETURN_URL },
  });
}

// Read the current decision for a session from our backend (which gets it from
// Didit's webhook / decision endpoint). Safe to poll.
export async function getKycStatus(sessionId: string): Promise<KycStatusResult> {
  return api<KycStatusResult>(
    `/auth/kyc/status?sessionId=${encodeURIComponent(sessionId)}`
  );
}

// Open Didit's hosted verification page in an in-app browser and resolve once
// the user returns to the app (via KYC_RETURN_URL) or dismisses the browser.
export async function openKycFlow(url: string): Promise<"returned" | "dismissed"> {
  const res = await WebBrowser.openAuthSessionAsync(url, KYC_RETURN_URL);
  return res.type === "success" ? "returned" : "dismissed";
}

// "First name only" is what the app uses as a member's display name.
export function firstNameFrom(v: KycVerifiedIdentity): string {
  if (v.firstName?.trim()) return v.firstName.trim();
  const full = (v.fullName ?? "").trim();
  return full ? full.split(/\s+/)[0] : "";
}
