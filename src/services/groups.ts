import { api } from "./apiClient";
import { getCurrentUser } from "@/src/utils/currentUser";
import { Group, GroupProject, JoinRequest } from "@/src/types";
import { phoneKey } from "@/src/utils/invites";
import { GROUP_FEES_ENABLED } from "@/src/constants";

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

  // A former member can be invited back, and the API adds a fresh row rather
  // than reviving the old one - so someone who has rejoined has BOTH a removed
  // row and a live one. They are in the group now, so their old row is dropped
  // from `formerMembers`: nobody should read as active and departed at once.
  const backInTheGroup = new Set(
    members.flatMap((m: any) =>
      [m.userId ? String(m.userId) : "", phoneKey(m.phone)].filter(Boolean)
    )
  );
  const formerMembers = rows.filter(
    (m: any) =>
      m.status === "removed" &&
      !backInTheGroup.has(String(m.userId ?? "")) &&
      !backInTheGroup.has(phoneKey(m.phone))
  );
  const mine = currentUserId
    ? members.find(
        (m: any) => String(m.userId) === String(currentUserId) && m.status === "active"
      )
    : undefined;
  // Projects come back as subdocs with _id, like members. Empty for every type
  // that is not a project fund, so screens can read it without a null check.
  const projects: GroupProject[] = (raw.projects ?? []).map((p: any) => ({
    ...p,
    id: String(p._id ?? p.id ?? ""),
    targetAmount: p.targetAmount ?? null,
    deadline: p.deadline ?? null,
    collected: p.collected ?? 0,
    status: p.status ?? "active",
  }));

  const joinRequests: JoinRequest[] = (raw.joinRequests ?? []).map((r: any) => ({
    ...r,
    id: String(r._id ?? r.id ?? ""),
    userId: String(r.userId ?? ""),
  }));

  return {
    ...raw,
    id: String(raw._id),
    members,
    projects,
    formerMembers,
    joinRequests,
    memberCount: members.filter((m: any) => m.status === "active").length,
    yourRole: mine?.role ?? "Member",
    yourSavings: mine?.savings ?? 0,
    yourContributions: mine?.contributions ?? 0,
    // keep shareOutDate / nextContributionDate as ISO strings - Hermes date math
    // needs ISO; components format for display. Do NOT reformat here.
  };
}

/**
 * The caller's groups.
 *
 * Groups still waiting on their registration fee are left out by default: the
 * API refuses every action inside one (423), so offering it in a contribute /
 * loan / report picker only leads to an error. Pass `includePending` on screens
 * whose job is to show the founder that the payment is still outstanding - the
 * Groups tab.
 */
export async function getGroups(
  {
    includePending = false,
    includeClosed = false,
  }: { includePending?: boolean; includeClosed?: boolean } = {}
): Promise<Group[]> {
  const user = await getCurrentUser<{ _id: string }>();
  const res = await api<{ groups: any[] }>(
    includeClosed ? "/groups?includeClosed=true" : "/groups"
  );
  return (res.groups ?? [])
    // With fees off, nothing is "pending-payment" in any meaningful sense, so
    // never hide a group for it (covers legacy groups from before the change).
    .filter((g) => includePending || !GROUP_FEES_ENABLED || g.status !== "pending-payment")
    .map((g) => mapGroup(g, user?._id));
}

/**
 * Delete a group. Nothing is erased: the API closes the group, and every
 * transaction, receipt, penalty and statement line under it is kept and stays
 * readable - a member can still pull a statement for a group that ended a year
 * ago. What goes is the group itself: it leaves everyone's list and nothing new
 * can be written into it.
 *
 * Whether it happens now depends on who else is there. `deleted: true` means it
 * is done - there was no other admin to ask. `deleted: false` means it is a
 * proposal the group's other admins vote on, exactly like a member removal.
 *
 * The API refuses while the group still holds savings or has open loans (400):
 * closing over either would strand real money.
 */
export async function requestGroupDeletion(
  groupId: string,
  reason?: string
): Promise<{
  message: string;
  deleted: boolean;
  requiredApprovals: number;
  eligibleVoters: number;
}> {
  const res = await api<{
    message: string;
    deleted?: boolean;
    requiredApprovals?: number;
    eligibleVoters?: number;
  }>(`/groups/${groupId}/delete-request`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
  return {
    message: res.message,
    deleted: !!res.deleted,
    requiredApprovals: res.requiredApprovals ?? 0,
    eligibleVoters: res.eligibleVoters ?? 0,
  };
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

/**
 * Add a savings project to a project-fund group (church). Chairperson only -
 * the API refuses anyone else, and refuses group types that do not use
 * projects at all.
 */
export async function addGroupProject(
  groupId: string,
  project: { name: string; targetAmount?: number | null; deadline?: string | null }
): Promise<GroupProject> {
  const res = await api<{ project: any }>(`/groups/${groupId}/projects`, {
    method: "POST",
    body: {
      name: project.name,
      targetAmount: project.targetAmount ?? null,
      deadline: project.deadline ?? null,
    },
  });
  return {
    ...res.project,
    id: String(res.project._id ?? res.project.id ?? ""),
    targetAmount: res.project.targetAmount ?? null,
    deadline: res.project.deadline ?? null,
    collected: res.project.collected ?? 0,
    status: res.project.status ?? "active",
  };
}

/**
 * Edit a savings project on a project-fund group (church). Chairperson only.
 * Only the fields passed are changed; pass `null` for targetAmount / deadline
 * to clear a goal or a deadline back to "not set".
 */
export async function updateGroupProject(
  groupId: string,
  projectId: string,
  patch: { name?: string; targetAmount?: number | null; deadline?: string | null }
): Promise<GroupProject> {
  const res = await api<{ project: any }>(`/groups/${groupId}/projects/${projectId}`, {
    method: "PATCH",
    body: patch,
  });
  return {
    ...res.project,
    id: String(res.project._id ?? res.project.id ?? ""),
    targetAmount: res.project.targetAmount ?? null,
    deadline: res.project.deadline ?? null,
    collected: res.project.collected ?? 0,
    status: res.project.status ?? "active",
  };
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
 * or cleared - it leaves this list only once accepted or declined.
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

/** How the signed-in user stands with a group found through search. */
export type GroupRelation = "member" | "invited" | "requested" | "none";

/** A group as search shows it to someone who may not be in it: enough to
 *  decide whether to ask, never its balances or member list. */
export interface GroupSearchResult {
  id: string;
  name: string;
  groupType?: string;
  memberCount: number;
  contributionAmount?: number;
  contributionFrequency?: string | null;
  chairpersonName?: string | null;
  relation: GroupRelation;
  /** A chilimba whose payout order is drawn takes nobody new. */
  closedToNewMembers: boolean;
}

/** Search every active group by name. Under 2 characters returns nothing. */
export async function searchGroups(query: string): Promise<GroupSearchResult[]> {
  const res = await api<{ groups: GroupSearchResult[] }>(
    `/groups/search?q=${encodeURIComponent(query)}`
  );
  return res.groups ?? [];
}

/**
 * Ask to join a group found through search. The group's admins are notified
 * and any one of them can approve it. Throws with code "already_invited" (409)
 * when the user already holds an invite - accepting that is all it takes.
 */
export async function requestToJoin(
  groupId: string
): Promise<{ alreadyMember: boolean; alreadyRequested: boolean }> {
  const res = await api<{ alreadyMember?: boolean; alreadyRequested?: boolean }>(
    `/groups/${groupId}/join-request`,
    { method: "POST" }
  );
  return { alreadyMember: !!res?.alreadyMember, alreadyRequested: !!res?.alreadyRequested };
}

/** Withdraw the user's own request to join. */
export async function cancelJoinRequest(groupId: string): Promise<void> {
  await api(`/groups/${groupId}/join-request`, { method: "DELETE" });
}

/** Admin: let a requester in. They become an active member straight away. */
export async function approveJoinRequest(
  groupId: string,
  requestId: string
): Promise<{ alreadyMember: boolean }> {
  const res = await api<{ alreadyMember?: boolean }>(
    `/groups/${groupId}/join-requests/${requestId}/approve`,
    { method: "POST" }
  );
  return { alreadyMember: !!res?.alreadyMember };
}

/** Admin: turn a request down. The requester is told and may ask again. */
export async function declineJoinRequest(groupId: string, requestId: string): Promise<void> {
  await api(`/groups/${groupId}/join-requests/${requestId}/decline`, { method: "POST" });
}
