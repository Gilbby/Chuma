// Chilimba (rotating savings / ROSCA) rotation. Thin wrappers over the API,
// which owns the rotation state - the order is a random draw locked at draw
// time, and each round the whole pool goes to one member until everyone has
// received once. See CHILIMBA_TYPES / isChilimbaType in src/types.

import { api } from "./apiClient";

/** One member's place in the payout order. */
export interface ChilimbaOrderEntry {
  userId: string;
  name: string;
  position: number; // 1-based slot in the rotation
  received: boolean; // have they taken the pool yet?
  round: number | null; // the round they received in
  receivedAt: string | null;
  isCurrent: boolean; // is it their turn this round?
}

/** The rotation state the Chilimba tab renders. Mirrors the API rotationView. */
export interface ChilimbaRotation {
  orderDrawn: boolean;
  orderDrawnAt: string | null;
  currentRound: number; // 0 before the draw; > totalRounds once complete
  totalRounds: number;
  complete: boolean;
  expectedPool: number; // contribution * members - the target pot
  collectedPool: number; // what has actually been collected this round
  currentRecipient: { userId: string; name: string } | null;
  order: ChilimbaOrderEntry[];
}

/** Read the rotation state for a chilimba group. */
export async function getChilimbaRotation(
  groupId: string
): Promise<ChilimbaRotation> {
  const res = await api<{ rotation: ChilimbaRotation }>(`/chilimba/${groupId}`);
  return res.rotation;
}

/**
 * Draw the payout order at random and lock it (chairperson only). From here the
 * chilimba is closed to new members. Returns the resulting rotation.
 */
export async function drawChilimbaOrder(
  groupId: string
): Promise<ChilimbaRotation> {
  const res = await api<{ rotation: ChilimbaRotation }>(
    `/chilimba/${groupId}/draw`,
    { method: "POST" }
  );
  return res.rotation;
}

/**
 * Propose handing this round's pool to the member whose turn it is (chairperson
 * only). Routed to the other admins as an approval; the payout is recorded and
 * the rotation advances once it carries.
 */
export async function proposeChilimbaPayout(
  groupId: string
): Promise<{ approval: any }> {
  return api(`/chilimba/${groupId}/propose-payout`, { method: "POST" });
}
