// All stats are derived from Group + Loan data. When a backend is connected,
// pass real groups and loans to these same functions — no UI changes required.

import type { Group, Loan } from "@/src/types";

export function getSavingsGrowth(group: Group): number {
  const t = (group as Group & { trend?: { value: number }[] }).trend;
  if (!t || t.length < 2) return 0;
  const latest = t[t.length - 1].value;
  const prev = t[t.length - 2].value;
  if (prev === 0) return 0;
  return Math.round(((latest - prev) / prev) * 100);
}

export function getRepaymentRate(group: Group, loans: Loan[]): number {
  const groupLoans = loans.filter((l) => l.groupId === group.id);
  if (groupLoans.length === 0) return 100;
  const totalPrincipal = groupLoans.reduce((s, l) => s + l.principal, 0);
  const totalOutstanding = groupLoans.reduce((s, l) => s + l.outstanding, 0);
  if (totalPrincipal === 0) return 100;
  const repaid = totalPrincipal - totalOutstanding;
  return Math.round((repaid / totalPrincipal) * 100);
}

export function getDefaults(group: Group, loans: Loan[]): number {
  const now = new Date();
  return loans.filter((l) => {
    if (l.groupId !== group.id) return false;
    if (l.status !== "active") return false;
    if (l.outstanding <= 0) return false;
    const due = new Date(l.nextDueDate);
    if (isNaN(due.getTime())) return false;
    return due.getTime() < now.getTime();
  }).length;
}

export function getHealthScore(group: Group, loans: Loan[]): number {
  const repayment = getRepaymentRate(group, loans);
  const growth = Math.max(0, Math.min(getSavingsGrowth(group) * 2, 100));
  const defaults = getDefaults(group, loans);
  const defaultPenalty = Math.min(defaults * 8, 40);
  const score = Math.round(repayment * 0.6 + growth * 0.4 - defaultPenalty);
  return Math.max(0, Math.min(score, 100));
}
