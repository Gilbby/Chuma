import { approvals as mockApprovals } from "@/src/data/mock";
import { Approval } from "@/src/types";

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

export async function getApprovals(): Promise<Approval[]> {
  return mockApprovals;
}

export async function voteOnApproval(
  id: string,
  action: "approve" | "reject",
): Promise<{ success: boolean }> {
  void id;
  void action;
  return { success: true };
}
