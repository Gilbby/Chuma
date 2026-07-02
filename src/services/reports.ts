// Reporting/analytics data. Backed by the API; swap freely
// when a richer reports backend is available — no UI changes.

import { api } from "./apiClient";

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
