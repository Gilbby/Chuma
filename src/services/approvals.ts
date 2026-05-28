import { approvals as mockApprovals } from "@/src/data/mock";
import { Approval } from "@/src/types";

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
