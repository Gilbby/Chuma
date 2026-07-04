import { TxnItem } from "@/src/types";
import { api } from "./apiClient";

function mapTxn(raw: any): TxnItem {
  const signed = Number(raw.amount ?? 0);
  return {
    ...raw,
    id: String(raw._id),
    amount: Math.abs(signed),
    direction: signed >= 0 ? "in" : "out",
  };
}

export async function getTransactions(opts?: {
  groupId?: string;
  type?: string;
  range?: "all" | "week" | "month" | "3months";
}): Promise<TxnItem[]> {
  const params = new URLSearchParams();
  if (opts?.groupId) params.set("groupId", opts.groupId);
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  if (opts?.range && opts.range !== "all") params.set("range", opts.range);
  const qs = params.toString();
  const res = await api<{ transactions: any[] }>(`/transactions${qs ? `?${qs}` : ""}`);
  return (res.transactions ?? []).map(mapTxn);
}

export async function getGroupTransactions(
  groupId: string,
  opts?: { type?: string; range?: "all" | "week" | "month" | "3months" }
): Promise<TxnItem[]> {
  const params = new URLSearchParams();
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  if (opts?.range && opts.range !== "all") params.set("range", opts.range);
  const qs = params.toString();
  const res = await api<{ transactions: any[] }>(
    `/groups/${groupId}/transactions${qs ? `?${qs}` : ""}`
  );
  return (res.transactions ?? []).map(mapTxn);
}

export async function submitContribution(payload: {
  groupId: string;
  amount: number;
  contributionType: "cycle" | "topup";
  paymentMethod: string;
  payerPhone?: string;
}): Promise<{ transaction: any; message?: string }> {
  return api("/contributions", { method: "POST", body: payload });
}

/**
 * Treasurer/chairperson acknowledges (or declines) physical receipt of a
 * Cash contribution. Confirming credits the member's savings.
 */
export async function confirmCashContribution(
  transactionId: string,
  received: boolean
): Promise<{ transaction: any }> {
  return api(`/contributions/${transactionId}/confirm-cash`, {
    method: "POST",
    body: { received },
  });
}

/**
 * Treasurer/chairperson re-sends a FAILED loan-disbursement or share-out
 * payout. Returns the fresh pending transaction.
 */
export async function retryPayout(
  transactionId: string
): Promise<{ transaction: any }> {
  return api(`/transactions/${transactionId}/retry-payout`, { method: "POST" });
}
