import { api } from "./apiClient";
import { getCurrentUser } from "@/src/utils/currentUser";
import { Group } from "@/src/types";

function mapGroup(raw: any, currentUserId?: string): Group {
  const members = raw.members ?? [];
  const mine = currentUserId
    ? members.find((m: any) => String(m.userId) === String(currentUserId))
    : undefined;
  return {
    ...raw,
    id: String(raw._id),
    memberCount: members.length,
    yourRole: mine?.role ?? "Member",
    // keep shareOutDate / nextContributionDate as ISO strings — Hermes date math
    // needs ISO; components format for display. Do NOT reformat here.
  };
}

export async function getGroups(): Promise<Group[]> {
  const user = await getCurrentUser<{ _id: string }>();
  const res = await api<{ groups: any[] }>("/groups");
  return (res.groups ?? []).map((g) => mapGroup(g, user?._id));
}

export async function getGroupById(id: string): Promise<Group | undefined> {
  const user = await getCurrentUser<{ _id: string }>();
  const res = await api<{ group: any }>(`/groups/${id}`);
  return res.group ? mapGroup(res.group, user?._id) : undefined;
}
