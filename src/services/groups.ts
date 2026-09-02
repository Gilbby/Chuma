import { api } from "./apiClient";
import { getCurrentUser } from "@/src/utils/currentUser";
import { Group } from "@/src/types";

function mapGroup(raw: any, currentUserId?: string): Group {
  // Member subdocs come back with _id only (lean/toObject). A "removed" row is
  // history, not a person in the group: it is kept OUT of `members` so no screen
  // counts them, and kept ON the group as `formerMembers` so what they saved and
  // contributed is never erased by their removal.
  const rows = (raw.members ?? []).map((m: any) => ({
    ...m,
    id: String(m._id ?? m.id ?? ""),
  }));
  const members = rows.filter((m: any) => m.status !== "removed");
  const formerMembers = rows.filter((m: any) => m.status === "removed");
  const mine = currentUserId
    ? members.find(
        (m: any) => String(m.userId) === String(currentUserId) && m.status === "active"
      )
    : undefined;
  return {
    ...raw,
    id: String(raw._id),
    members,
    formerMembers,
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

/** Re-send the SMS/notification for an invite that hasn't been accepted yet. */
export async function resendInvite(
  groupId: string,
  memberId: string
): Promise<{ message: string; lastInviteSentAt?: string }> {
  return api(`/groups/${groupId}/invite/${memberId}/resend`, { method: "POST" });
}

/** Withdraw a pending invite (only works while it is still pending). */
export async function cancelInvite(
  groupId: string,
  memberId: string
): Promise<{ message: string }> {
  return api(`/groups/${groupId}/invite/${memberId}`, { method: "DELETE" });
}

/**
 * Propose removing a member. Nobody is removed by this call: it opens a
 * member-removal approval for the group's OTHER admins to vote on (the member
 * being removed never votes on it), and their savings are refunded to their
 * mobile wallet when it carries.
 */
export async function requestMemberRemoval(
  groupId: string,
  memberId: string,
  reason?: string
): Promise<{
  message: string;
  requiredApprovals: number;
  eligibleVoters: number;
  refund: number;
}> {
  return api(`/groups/${groupId}/members/${memberId}/remove`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export interface GroupInvite {
  /** The pending member row's id inside the group. */
  memberId: string;
  groupId: string;
  groupName: string;
  groupType?: string;
  role: string;
  invitedBy?: string | null;
  invitedAt?: string | null;
  memberCount: number;
  contributionAmount?: number;
  contributionFrequency?: string;
}

/**
 * Invitations waiting on this user, read from the groups themselves rather than
 * from notifications. An invite therefore survives its notification being read
 * or cleared — it leaves this list only once accepted or declined.
 */
export async function getMyInvites(): Promise<GroupInvite[]> {
  const res = await api<{ invites: GroupInvite[] }>("/groups/invites");
  return res.invites ?? [];
}

/** Reject an invitation. Drops the pending member row server-side. */
export async function declineInvite(
  groupId: string
): Promise<{ alreadyHandled: boolean }> {
  const res = await api<{ alreadyHandled?: boolean }>(`/groups/${groupId}/decline`, {
    method: "POST",
  });
  return { alreadyHandled: !!res?.alreadyHandled };
}
