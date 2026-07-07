// Loan eligibility and interest math. Driven by the user's
// savings in a group and that group's loan rules. When a
// backend is connected, pass real member savings and group
// rules to the same functions — no UI changes.

import { Loan, LoanRepaymentTier } from "@/src/types";
import { api } from "./apiClient";

// Default size-based repayment tiers (ZMW). Small loans recycle back into the
// fund quickly; larger loans get room to repay. Groups can override the term of
// each band; the amount bands themselves are fixed.
// Sensible default repayment tiers for a group whose cycle runs `cycleMonths`.
// The largest loans get up to ~half the cycle so repaid cash can be lent out
// again before share-out; smaller loans ladder down from there. Every term is
// clamped to at least 1 month.
export function defaultTiersForCycle(cycleMonths: number): LoanRepaymentTier[] {
  const top = Math.max(1, Math.round(cycleMonths / 2));
  const term = (frac: number) => Math.max(1, Math.min(top, Math.round(top * frac)));
  return [
    { maxAmount: 500, maxMonths: 1 },
    { maxAmount: 2000, maxMonths: term(1 / 3) },
    { maxAmount: 5000, maxMonths: term(2 / 3) },
    { maxAmount: null, maxMonths: top },
  ];
}

// Fallback defaults (6-month cycle) for anywhere a cycle length isn't known.
export const DEFAULT_LOAN_REPAYMENT_TIERS: LoanRepaymentTier[] =
  defaultTiersForCycle(6);

// Longest term (in months) a loan of `amount` may take under these tiers.
export function maxTermForAmount(
  amount: number,
  tiers?: LoanRepaymentTier[]
): number {
  const list = tiers && tiers.length ? tiers : DEFAULT_LOAN_REPAYMENT_TIERS;
  const sorted = [...list].sort((a, b) => {
    if (a.maxAmount === null) return 1;
    if (b.maxAmount === null) return -1;
    return a.maxAmount - b.maxAmount;
  });
  for (const t of sorted) {
    if (t.maxAmount === null || amount <= t.maxAmount) return t.maxMonths;
  }
  return sorted[sorted.length - 1]?.maxMonths ?? 6;
}

export const DEFAULT_LOAN_FREE_WINDOW_MONTHS = 1;

// Whole months from now until a date (floored, never negative). A loan may only
// run this many months if it must be fully repaid by then.
export function monthsUntil(date: string | Date | undefined, from: Date = new Date()): number {
  if (!date) return Infinity; // no share-out set → cycle not constrained
  const target = new Date(date).getTime();
  const days = (target - from.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(days / 30));
}

// Everything the loan screen needs to constrain a request for a given amount:
// the effective max term (smaller of size tier and time left to share-out) and
// whether lending is closed because we're inside the loan-free window.
export function loanTermInfo(
  amount: number,
  opts: {
    tiers?: LoanRepaymentTier[];
    shareOutDate?: string | Date;
    loanFreeWindowMonths?: number;
    now?: Date;
  } = {}
): { tierCap: number; monthsToShareOut: number; maxTerm: number; lendingClosed: boolean; windowMonths: number } {
  const tierCap = maxTermForAmount(amount, opts.tiers);
  const monthsToShareOut = monthsUntil(opts.shareOutDate, opts.now);
  const windowMonths = opts.loanFreeWindowMonths ?? DEFAULT_LOAN_FREE_WINDOW_MONTHS;
  const lendingClosed = monthsToShareOut < windowMonths;
  // Term can never outlast the cycle; at least 1 month when lending is open.
  const maxTerm = Math.max(1, Math.min(tierCap, monthsToShareOut));
  return { tierCap, monthsToShareOut, maxTerm, lendingClosed, windowMonths };
}

// Human label for a tier's amount band, given the band below it.
export function tierBandLabel(
  tier: LoanRepaymentTier,
  prevMax: number | null,
  formatAmount: (n: number) => string
): string {
  if (tier.maxAmount === null) return `Above ${formatAmount(prevMax ?? 0)}`;
  if (prevMax === null) return `Up to ${formatAmount(tier.maxAmount)}`;
  return `${formatAmount(prevMax + 1)} – ${formatAmount(tier.maxAmount)}`;
}

// Max a member can borrow = their savings × group multiplier
export function getMaxLoan(
  memberSavings: number,
  loanMultiplier: number
): number {
  return Math.round(memberSavings * (loanMultiplier || 1));
}

// Simple interest over the loan term
export function getLoanInterest(
  principal: number,
  monthlyRatePct: number,
  months: number
): number {
  return Math.round(principal * (monthlyRatePct / 100) * months);
}

// Full breakdown for a requested loan
export function getLoanBreakdown(
  principal: number,
  monthlyRatePct: number,
  months: number
): {
  principal: number;
  interest: number;
  totalRepay: number;
  monthlyInstallment: number;
} {
  const interest = getLoanInterest(principal, monthlyRatePct, months);
  const totalRepay = principal + interest;
  const monthlyInstallment = months > 0 ? Math.round(totalRepay / months) : 0;
  return { principal, interest, totalRepay, monthlyInstallment };
}

// Eligibility check
export function checkEligibility(
  principal: number,
  maxLoan: number
): { eligible: boolean; reason?: string } {
  if (principal <= 0)
    return { eligible: false, reason: "Enter a loan amount" };
  if (principal > maxLoan)
    return { eligible: false, reason: `Exceeds your limit of ${maxLoan}` };
  return { eligible: true };
}

function mapLoan(raw: any): Loan {
  return {
    ...raw,
    id: String(raw._id),
    nextDueDate: raw.nextDueDate,
    history: raw.history ?? [],
  };
}

export async function getLoans(opts?: {
  mine?: boolean;
  groupId?: string;
}): Promise<Loan[]> {
  const params = new URLSearchParams();
  if (opts?.mine) params.set("mine", "true");
  if (opts?.groupId) params.set("groupId", opts.groupId);
  const qs = params.toString();
  const res = await api<{ loans: any[] }>(`/loans${qs ? `?${qs}` : ""}`);
  return (res.loans ?? []).map(mapLoan);
}

export async function getLoanEligibility(groupId: string): Promise<{
  savings: number;
  maxLoan: number;
  multiplier: number;
  interestRate: number;
}> {
  return api(`/loans/eligibility?groupId=${encodeURIComponent(groupId)}`);
}

export async function requestLoan(payload: {
  groupId: string;
  amount: number;
  durationMonths: number;
  reason?: string;
}): Promise<{ loan: any; approval: any; breakdown: any }> {
  return api("/loans", { method: "POST", body: payload });
}

export async function repayLoan(payload: {
  loanId: string;
  amount: number;
  payerPhone?: string;
}): Promise<{ loan?: any; transaction?: any }> {
  const { loanId, amount, payerPhone } = payload;
  return api(`/loans/${loanId}/repay`, {
    method: "POST",
    body: payerPhone ? { amount, payerPhone } : { amount },
  });
}
