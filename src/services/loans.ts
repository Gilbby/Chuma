import { loans as mockLoans } from "@/src/data/mock";
import { Loan } from "@/src/types";

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
