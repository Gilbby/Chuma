// Reporting/analytics data. Backed by the API; swap freely
// when a richer reports backend is available — no UI changes.

import { api } from "./apiClient";

export interface GroupReport {
  groupId: string;
  groupName: string;
  repaymentRate: number;
  defaults: number;
  defaultRate: number; // % of disbursed loans in default, 1 decimal
  loansIssuedThisQuarter: number; // ZMW disbursed this calendar quarter
  // On-time cycle-contribution rate per active member; rate is null until a
  // member has at least one completed contribution window
  memberConsistency: { userId: string; name: string; contributions: number; rate: number | null }[];
  savingsGrowth: number;
  totalSavings: number;
  loanCirculation: number;
  memberRetention: number | null;
  savingsTrend: { label: string; value: number }[];
}

// Computed analytics for one group.
export async function getGroupReport(groupId: string): Promise<GroupReport> {
  return api<GroupReport>(`/reports/${encodeURIComponent(groupId)}`);
}

// Per-group savings trend over the last `months` periods.
export async function getSavingsTrend(
  groupId: string,
  months = 6
): Promise<{ label: string; value: number }[]> {
  const res = await api<{ trend: { label: string; value: number }[] }>(
    `/groups/${encodeURIComponent(groupId)}/savings-trend?months=${months}`
  );
  return res.trend ?? [];
}
