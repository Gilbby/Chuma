// Group monthly fee logic. Computes lock status, months
// owed, amount owed, and grace-period countdown from a
// group's fee fields. When a backend is connected, the same
// functions work against real payment records.

import { Group } from "@/src/types";

export const GRACE_PERIOD_DAYS = 5;

export function getMonthsOwed(group: Group): number {
  if (!group.feePaidThrough || !group.monthlyFee) return 0;
  const paidThrough = new Date(group.feePaidThrough);
  const now = new Date();
  if (isNaN(paidThrough.getTime())) return 0;
  if (now <= paidThrough) return 0;
  // Count whole months elapsed since paidThrough
  let months =
    (now.getFullYear() - paidThrough.getFullYear()) * 12 +
    (now.getMonth() - paidThrough.getMonth());
  // If we're past the due day in the current month, that
  // month is also owed
  if (now.getDate() >= paidThrough.getDate()) months += 1;
  return Math.max(0, months);
}

export function getAmountOwed(group: Group): number {
  return getMonthsOwed(group) * (group.monthlyFee ?? 0);
}

/** A brand-new group whose registration fee has not settled yet. */
export function isAwaitingFirstPayment(group: Group): boolean {
  return group.status === "pending-payment";
}

export function getGraceInfo(group: Group): {
  status: "paid" | "grace" | "locked" | "pending-payment";
  daysIntoGrace: number;
  daysLeft: number;
} {
  // Not a lapsed fee — a group that has not started. Reported separately so
  // screens can say "waiting for payment" instead of "your fee is overdue".
  if (isAwaitingFirstPayment(group)) {
    return { status: "pending-payment", daysIntoGrace: 0, daysLeft: 0 };
  }
  if (!group.feePaidThrough || !group.monthlyFee) {
    return { status: "paid", daysIntoGrace: 0, daysLeft: GRACE_PERIOD_DAYS };
  }
  const paidThrough = new Date(group.feePaidThrough);
  const now = new Date();
  if (isNaN(paidThrough.getTime()) || now <= paidThrough) {
    return { status: "paid", daysIntoGrace: 0, daysLeft: GRACE_PERIOD_DAYS };
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysOverdue = Math.floor(
    (now.getTime() - paidThrough.getTime()) / msPerDay
  );
  if (daysOverdue <= GRACE_PERIOD_DAYS) {
    return {
      status: "grace",
      daysIntoGrace: daysOverdue,
      daysLeft: GRACE_PERIOD_DAYS - daysOverdue,
    };
  }
  return { status: "locked", daysIntoGrace: GRACE_PERIOD_DAYS, daysLeft: 0 };
}

// Locked covers both reasons a group cannot be used: the fee lapsed past its
// grace window, or it never started because the first fee has not settled.
export function isGroupLocked(group: Group): boolean {
  const { status } = getGraceInfo(group);
  return status === "locked" || status === "pending-payment";
}

export function advancePaidThrough(group: Group, monthsPaid: number): string {
  const base = group.feePaidThrough
    ? new Date(group.feePaidThrough)
    : new Date();
  base.setMonth(base.getMonth() + monthsPaid);
  return base.toISOString().split("T")[0];
}
