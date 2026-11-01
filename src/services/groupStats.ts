// All stats are derived from Group + Loan data. When a backend is connected,
// pass real groups and loans to these same functions - no UI changes required.

import type { Group, Loan } from "@/src/types";

export function getSavingsGrowth(group: Group | undefined): number {
  // Callers resolve the group from a list that is empty on first render, so
  // undefined is a normal state here, not a bug to crash on.
  const t = (group as (Group & { trend?: { value: number }[] }) | undefined)?.trend;
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

// ── Church (project-fund) groups ────────────────────────────────────────────
// A church group never lends, so repayment/defaults mean nothing. These stand
// in their place: how far the open projects are toward their goals, and how
// much of the group has actually given.

/** Combined progress of the open projects that have a goal: Σ collected / Σ
 *  target, as a percentage (can exceed 100 if more was raised than targeted). */
export function getGoalProgress(group: Group): number {
  const active = (group.projects ?? []).filter(
    (p) => p.status === "active" && (p.targetAmount ?? 0) > 0
  );
  const target = active.reduce((s, p) => s + (p.targetAmount ?? 0), 0);
  if (target === 0) return 0;
  const collected = active.reduce((s, p) => s + (p.collected ?? 0), 0);
  return Math.round((collected / target) * 100);
}

/** How many active members have given anything, out of all active members. */
export function getGivers(group: Group): { gave: number; total: number } {
  const active = (group.members ?? []).filter((m: any) => m.status === "active");
  const gave = active.filter((m: any) => (m.savings ?? 0) > 0).length;
  return { gave, total: active.length };
}

/** A church group's health: goal progress weighted with how much of the group
 *  is giving. No lending, so no repayment/default terms. */
export function getChurchHealthScore(group: Group): number {
  const goal = Math.min(getGoalProgress(group), 100);
  const { gave, total } = getGivers(group);
  const participation = total ? Math.round((gave / total) * 100) : 0;
  return Math.max(0, Math.min(Math.round(goal * 0.6 + participation * 0.4), 100));
}
