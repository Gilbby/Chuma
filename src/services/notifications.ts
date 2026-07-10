import { api } from "./apiClient";
import type { Notice } from "@/src/types";

function mapNotice(raw: any): Notice {
  return {
    ...raw,
    id: String(raw._id),
    penaltyId: raw.penaltyId != null ? String(raw.penaltyId) : undefined,
    transactionId: raw.transactionId != null ? String(raw.transactionId) : undefined,
  };
}

/**
 * An invite the user can still act on. Notifications written before
 * "invite_accepted" existed have type "invite" even when they are really the
 * inviter's own "X accepted" confirmation — those carry no `invitedBy`, so they
 * are excluded here rather than rendered with dead Accept/Decline buttons.
 */
export function isActionableInvite(n: Notice): boolean {
  return n.type === "invite" && !n.read && !!n.invitedBy && !!n.groupId;
}

export async function getNotifications(): Promise<Notice[]> {
  const res = await api<{ notifications: any[] }>("/notifications");
  return (res.notifications ?? []).map(mapNotice);
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api("/notifications/read-all", { method: "PATCH" });
}
