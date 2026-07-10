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
    memberCount: members.filter((m: any) => m.status === "active").length,
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

export async function acceptInvite(
  groupId: string
): Promise<{ alreadyMember: boolean }> {
  const res = await api<{ alreadyMember?: boolean }>(`/groups/${groupId}/accept`, {
    method: "POST",
  });
  return { alreadyMember: !!res?.alreadyMember };
}

export async function createGroup(payload: any): Promise<{ group: any; transaction?: any }> {
  return api("/groups", { method: "POST", body: payload });
}

export async function payGroupFee(groupId: string, payerPhone?: string): Promise<any> {
  return api(`/groups/${groupId}/fee/pay`, {
    method: "POST",
    body: payerPhone ? { payerPhone } : {},
  });
}

export async function inviteMember(
  groupId: string,
  phone: string,
  role: string = "Member"
): Promise<{ message: string }> {
  return api(`/groups/${groupId}/invite`, { method: "POST", body: { phone, role } });
}
