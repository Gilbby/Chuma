import { transactions as mockTransactions } from "@/src/data/mock";
import { TxnItem } from "@/src/types";

export async function getTransactions(): Promise<TxnItem[]> {
  return mockTransactions;
}

export async function submitContribution(payload: {
  groupId: string;
  amount: number;
}): Promise<{ success: boolean }> {
  void payload;
  return { success: true };
}
