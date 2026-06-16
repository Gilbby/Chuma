import type { Group, Penalty, Loan } from "@/src/types";

export function computePenaltyAmount(
  rule: {
    penaltyType?: "flat" | "percent";
    penaltyRate?: number;
    penaltyAmount?: number;
    amount?: number;
  },
  baseAmount: number,
  daysLate: number
): number {
  if (!rule) return 0;
  if (rule.penaltyType === "flat" && rule.penaltyAmount) {
    return rule.penaltyAmount;
  }
  if (rule.amount && !rule.penaltyType) {
    return rule.amount;
  }
  if (rule.penaltyType === "percent" && rule.penaltyRate) {
    const raw = baseAmount * (rule.penaltyRate / 100) * Math.max(daysLate, 1);
    const cap = baseAmount * 0.3;
    return Math.round(Math.min(raw, cap));
  }
  return 0;
}

function makePenalty(
  fields: Omit<Penalty, "id" | "status" | "createdAt">
): Penalty {
  return {
    ...fields,
    id: `pen-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function detectViolations(
  group: Group,
  options?: {
    overdueMemberIds?: string[];
    missedMeetingMemberIds?: string[];
    lateRepaymentLoans?: Loan[];
    daysLate?: number;
  }
): Penalty[] {
  if (!group.constitution) return [];

  const { penaltyRules, penaltyFundsDestination } = group.constitution;
  const dest: Penalty["fundsDestination"] = penaltyFundsDestination ?? "group-pool";
  const daysLate = options?.daysLate ?? 1;
  const penalties: Penalty[] = [];

  // Late contribution
  const lcRule = penaltyRules.lateContribution;
  if (lcRule.enabled && options?.overdueMemberIds?.length) {
    for (const memberId of options.overdueMemberIds) {
      const member = group.members.find((m) => m.id === memberId);
      if (!member) continue;
      const amount = computePenaltyAmount(lcRule, group.contributionAmount, daysLate);
      if (amount > 0) {
        penalties.push(
          makePenalty({
            groupId: group.id,
            groupName: group.name,
            memberId: member.id,
            memberName: member.name,
            violationType: "lateContribution",
            reason: "Late contribution",
            amount,
            fundsDestination: dest,
          })
        );
      }
    }
  }

  // Missing meeting
  const mmRule = penaltyRules.missingMeeting;
  if (mmRule.enabled && options?.missedMeetingMemberIds?.length) {
    for (const memberId of options.missedMeetingMemberIds) {
      const member = group.members.find((m) => m.id === memberId);
      if (!member) continue;
      const amount = computePenaltyAmount(mmRule, 0, daysLate);
      if (amount > 0) {
        penalties.push(
          makePenalty({
            groupId: group.id,
            groupName: group.name,
            memberId: member.id,
            memberName: member.name,
            violationType: "missingMeeting",
            reason: "Missing meeting",
            amount,
            fundsDestination: dest,
          })
        );
      }
    }
  }

  // Late repayment
  const lrRule = penaltyRules.lateRepayment;
  if (lrRule.enabled && options?.lateRepaymentLoans?.length) {
    for (const loan of options.lateRepaymentLoans) {
      const member = group.members.find((m) => m.id === loan.memberId);
      if (!member) continue;
      const amount = computePenaltyAmount(lrRule, loan.outstanding, daysLate);
      if (amount > 0) {
        penalties.push(
          makePenalty({
            groupId: group.id,
            groupName: group.name,
            memberId: member.id,
            memberName: member.name,
            violationType: "lateRepayment",
            reason: "Late loan repayment",
            amount,
            fundsDestination: dest,
          })
        );
      }
    }
  }

  return penalties;
}

export function isPastGracePeriod(dueDate: string, gracePeriodDays: number): boolean {
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  const now = new Date();
  const graceMs = gracePeriodDays * 24 * 60 * 60 * 1000;
  return now.getTime() > due.getTime() + graceMs;
}
