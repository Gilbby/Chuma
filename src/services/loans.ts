// Loan eligibility and interest math. Driven by the user's
// savings in a group and that group's loan rules. When a
// backend is connected, pass real member savings and group
// rules to the same functions — no UI changes.

import { loans as mockLoans } from "@/src/data/mock";
import { Loan } from "@/src/types";

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

export async function getLoans(): Promise<Loan[]> {
  return mockLoans;
}

export async function requestLoan(payload: {
  groupId: string;
  amount: number;
  purpose?: string;
}): Promise<{ success: boolean }> {
  void payload;
  return { success: true };
}

export async function repayLoan(payload: {
  loanId: string;
  amount: number;
}): Promise<{ success: boolean }> {
  void payload;
  return { success: true };
}
