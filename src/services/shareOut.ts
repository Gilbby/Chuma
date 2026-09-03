// Share-out math. Profit is distributed proportionally to
// each member's contribution. All intermediate math uses
// full precision; rounding happens once at the end using
// the largest-remainder method so rounded payouts sum to
// the exact pool. When a backend is connected, feed real
// contributions and profit to the same functions.

import { api } from "./apiClient";

export interface ShareOutMember {
  id: string;
  name: string;
  contribution: number;
  profitShare: number;  // final rounded whole-kwacha profit
  share: number;        // contribution + profitShare
  growthPct: number;    // profitShare / contribution * 100
}

export interface ShareOutResult {
  members: ShareOutMember[];
  totalSavings: number;
  profit: number;            // rounded whole-kwacha profit
  totalToDistribute: number; // totalSavings + profit
}

export function computeShareOut(
  members: { id: string; name: string; contribution: number }[],
  totalProfit: number
): ShareOutResult {
  const totalSavings = members.reduce(
    (s, m) => s + m.contribution, 0
  );
  const roundedProfit = Math.round(totalProfit);

  if (totalSavings <= 0 || roundedProfit <= 0) {
    return {
      members: members.map((m) => ({
        ...m, profitShare: 0, share: m.contribution,
        growthPct: 0,
      })),
      totalSavings,
      profit: Math.max(roundedProfit, 0),
      totalToDistribute: totalSavings + Math.max(roundedProfit, 0),
    };
  }

  // 1. Exact (unrounded) profit share per member
  const exact = members.map((m) => {
    const exactProfit = (m.contribution / totalSavings) *
      roundedProfit;
    return {
      ...m,
      exactProfit,
      floor: Math.floor(exactProfit),
      frac: exactProfit - Math.floor(exactProfit),
    };
  });

  // 2. Distribute leftover kwacha by largest remainder
  const sumFloors = exact.reduce((s, e) => s + e.floor, 0);
  const remainder = roundedProfit - sumFloors;

  const byFrac = [...exact].sort((a, b) => b.frac - a.frac);
  const bonusIds = new Set<string>();
  for (let i = 0; i < remainder && i < byFrac.length; i++) {
    bonusIds.add(byFrac[i].id);
  }

  // 3. Final per-member values
  const result: ShareOutMember[] = exact.map((e) => {
    const profitShare = e.floor + (bonusIds.has(e.id) ? 1 : 0);
    const share = e.contribution + profitShare;
    const growthPct = e.contribution > 0
      ? Number(((profitShare / e.contribution) * 100).toFixed(1))
      : 0;
    return {
      id: e.id, name: e.name, contribution: e.contribution,
      profitShare, share, growthPct,
    };
  });

  // 4. Guarantee reconciliation
  const distributedProfit = result.reduce(
    (s, m) => s + m.profitShare, 0
  );
  // distributedProfit now equals roundedProfit exactly

  return {
    members: result,
    totalSavings,
    profit: distributedProfit,
    totalToDistribute: totalSavings + distributedProfit,
  };
}

export function estimateGroupProfit(
  loanCirculation: number,
  loanInterestRate: number,  // % per month
  cycleMonths: number,
  penaltyIncome: number = 0
): number {
  const interest = loanCirculation *
    (loanInterestRate / 100) * cycleMonths;
  return Math.round(interest + penaltyIncome);
}

export function getMyShare(
  members: ShareOutMember[], myId: string
): number {
  return members.find((m) => m.id === myId)?.share ?? 0;
}

/**
 * Put a distribution to the group's admins, choosing how it will pay.
 *
 * The method is part of what they vote on: "manual" commits the group to
 * paying every member itself and confirming each one, mobile money is one vote
 * and then pawaPay does the rest. While the hold is on the server corrects any
 * request to manual and says so in `mobileMoneyHold`.
 */
export async function proposeShareOut(
  groupId: string,
  payoutMethod: "manual" | "mobile-money" = "manual"
): Promise<{ approval: any; method: "manual" | "mobile-money"; mobileMoneyHold: boolean }> {
  return api(`/shareout/${groupId}/propose`, {
    method: "POST",
    body: { method: payoutMethod },
  });
}

/**
 * One member's row in a distribution: what they are owed and whether they
 * actually have it yet.
 *
 * `awaitsConfirmation` is the one that drives the UI. A pawaPay payout answers
 * for itself when the provider settles it; a payment the group made outside the
 * app only settles when an admin says they made it.
 */
export interface ShareOutPayout {
  transactionId: string;
  memberId: string | null;
  memberName: string;
  owed: number;
  amount: number;          // what they receive, after their own loan is netted
  appliedToLoan: number;
  status: "pending" | "completed" | "failed";
  paymentMethod: string | null;
  awaitsConfirmation: boolean; // waiting on an admin to say they paid, not on a provider
  viaMobileMoney: boolean;
  confirmedByName: string | null;
  confirmedAt: string | null;
  receiptId: string;
  date: string;
}

export interface ShareOutPayouts {
  shareOutId: string | null;
  payouts: ShareOutPayout[];
  /** How the last run paid. null before a group has ever distributed. */
  method: "manual" | "mobile-money" | null;
  /** pawaPay disbursement is down — the next run has to be paid manually. */
  mobileMoneyHold: boolean;
  totals: {
    count: number;
    paid: number;
    pending: number;
    failed: number;
    outstanding: number;
  } | null;
}

/** The group's most recent distribution, member by member. Empty before one runs. */
export async function getShareOutPayouts(groupId: string): Promise<ShareOutPayouts> {
  return api(`/shareout/${groupId}/payouts`);
}
