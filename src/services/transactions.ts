import { transactions as mockTransactions } from "@/src/data/mock";
import { TxnItem } from "@/src/types";
import { api } from "./apiClient";

export async function getTransactions(): Promise<TxnItem[]> {
  return mockTransactions;
}

export async function submitContribution(payload: {
  groupId: string;
  amount: number;
  contributionType: "cycle" | "topup";
  paymentMethod: string;
  payerPhone?: string;
}): Promise<{ transaction: any }> {
  return api("/contributions", { method: "POST", body: payload });
}
