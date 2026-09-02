/**
 * Helpers for invitations that have been sent but not answered.
 *
 * A pending invite lives on the group's own member row, so it survives its
 * notification being read or cleared and keeps showing up everywhere until it
 * is accepted, declined or withdrawn. Nothing here dismisses one.
 */
import { Group, Member } from "@/src/types";

/** Last 9 digits — compares +260971234567, 0971234567 and 971234567 as equal. */
export function phoneKey(phone?: string): string {
  return String(phone ?? "").replace(/\D/g, "").slice(-9);
}

/** Relative age of an invite — "today", "3 days ago". Keeps a row honest about
 *  how long someone has been sitting on an unanswered invitation. */
export function invitedAgo(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

/** The name is only a placeholder until they sign up — the API stores the phone
 *  as the name for an invitee with no account yet, so fall back to the number. */
export function inviteDisplayName(member: Pick<Member, "name" | "phone">): string {
  return member.name && phoneKey(member.name) !== phoneKey(member.phone)
    ? member.name
    : member.phone;
}

/** Everyone invited to this group who hasn't accepted yet. */
export function pendingInvites(group?: Pick<Group, "members"> | null): Member[] {
  return ((group?.members ?? []) as Member[]).filter((m) => m.status === "pending");
}
