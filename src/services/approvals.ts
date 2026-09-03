import { Approval } from "@/src/types";
import { api } from "./apiClient";

// Number of admin approvals required for a sensitive action,
// based on the group's approval threshold and admin count.
export function getRequiredApprovals(
  threshold: "2-of-3" | "majority" | "all",
  adminCount: number
): number {
  const admins = Math.max(adminCount, 1);
  switch (threshold) {
    case "2-of-3":
      return Math.min(2, admins);
    case "all":
      return admins;
    case "majority":
    default:
      return Math.floor(admins / 2) + 1;
  }
}

function mapApproval(raw: any): Approval {
  const votes = raw.votes ?? [];
  const votesFor = votes.filter((v: any) => v.decision === "approve").length;
  const votesAgainst = votes.filter((v: any) => v.decision === "reject").length;
  return {
    ...raw,
    id: String(raw._id),
    votesFor,
    votesAgainst,
    totalVoters: raw.requiredApprovals ?? 0,
    timestamp: raw.createdAt ?? raw.date ?? "",
    status: raw.status,
    votes: votes.map((v: any) => ({
      adminName: v.adminName || "An admin",
      decision: v.decision,
      at: v.at ?? "",
    })),
    // A resolved approval last changed when it was decided or carried out.
    resolvedAt: raw.status && raw.status !== "pending" ? raw.updatedAt ?? "" : undefined,
  };
}

/**
 * "pending" is the work queue (the default — most screens want only that);
 * "resolved" is the history (approved, rejected, executed); "all" is both.
 */
export type ApprovalScope = "pending" | "resolved" | "all";

export async function getApprovals(opts?: {
  groupId?: string;
  status?: ApprovalScope;
  limit?: number;
}): Promise<Approval[]> {
  const params = new URLSearchParams();
  if (opts?.groupId) params.set("groupId", opts.groupId);
  if (opts?.status && opts.status !== "pending") params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await api<{ approvals: any[] }>(`/approvals${qs ? `?${qs}` : ""}`);
  return (res.approvals ?? []).map(mapApproval);
}

/**
 * Re-run an approved action that could not complete when the vote carried —
 * a refund the group wallet couldn't cover yet, say. The votes stand.
 */
export async function runApproval(
  id: string
): Promise<{ approval: any; executed: any }> {
  return api(`/approvals/${id}/execute`, { method: "POST" });
}

export async function voteOnApproval(
  id: string,
  action: "approve" | "reject",
): Promise<{ approval: any; progress: { approves: number; required: number }; executed: any }> {
  return api(`/approvals/${id}/vote`, { method: "POST", body: { decision: action } });
}
