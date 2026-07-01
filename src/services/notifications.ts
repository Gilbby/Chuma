import { api } from "./apiClient";
import type { Notice } from "@/src/types";

function mapNotice(raw: any): Notice {
  return {
    ...raw,
    id: String(raw._id),
  };
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
