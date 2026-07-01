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
  };
}

export async function getApprovals(opts?: { groupId?: string }): Promise<Approval[]> {
  const qs = opts?.groupId ? `?groupId=${encodeURIComponent(opts.groupId)}` : "";
  const res = await api<{ approvals: any[] }>(`/approvals${qs}`);
  return (res.approvals ?? []).map(mapApproval);
}

export async function voteOnApproval(
  id: string,
  action: "approve" | "reject",
): Promise<{ approval: any; progress: { approves: number; required: number }; executed: any }> {
  return api(`/approvals/${id}/vote`, { method: "POST", body: { decision: action } });
}
