import type { TxnItem } from "@/src/types";

export const transactions: TxnItem[] = [
  { id: "t1", type: "contribution", amount: 500, status: "completed", groupId: "g1", groupName: "Lusaka Market Sisters", date: "Today, 09:14", direction: "out", note: "Weekly contribution" },
  { id: "t2", type: "loan", amount: 5000, status: "completed", groupId: "g2", groupName: "Kabwata Youth Savers", date: "Yesterday, 14:32", direction: "in", note: "Loan disbursement" },
  { id: "t3", type: "repayment", amount: 1250, status: "completed", groupId: "g2", groupName: "Kabwata Youth Savers", date: "Feb 18, 2026", direction: "out", note: "Installment #3" },
  { id: "t4", type: "contribution", amount: 800, status: "completed", groupId: "g2", groupName: "Kabwata Youth Savers", date: "Feb 15, 2026", direction: "out" },
  { id: "t5", type: "share-out", amount: 8420, status: "completed", groupId: "g3", groupName: "Chongwe Farmers Chuma", date: "Feb 10, 2026", direction: "in", note: "Annual share-out 2025" },
  { id: "t6", type: "contribution", amount: 1200, status: "pending", groupId: "g3", groupName: "Chongwe Farmers Chuma", date: "Feb 09, 2026", direction: "out" },
  { id: "t7", type: "repayment", amount: 1250, status: "completed", groupId: "g2", groupName: "Kabwata Youth Savers", date: "Feb 04, 2026", direction: "out" },
  { id: "t8", type: "contribution", amount: 500, status: "completed", groupId: "g1", groupName: "Lusaka Market Sisters", date: "Feb 02, 2026", direction: "out" },
  { id: "t9", type: "withdrawal", amount: 2000, status: "failed", groupId: "g1", groupName: "Lusaka Market Sisters", date: "Jan 28, 2026", direction: "in", note: "Insufficient quorum" },
  { id: "t10", type: "contribution", amount: 500, status: "completed", groupId: "g1", groupName: "Lusaka Market Sisters", date: "Jan 26, 2026", direction: "out" },
  { id: "t11", type: "loan", amount: 3500, status: "completed", groupId: "g1", groupName: "Lusaka Market Sisters", date: "Jan 15, 2026", direction: "in", note: "Loan disbursement" },
  { id: "t12", type: "contribution", amount: 800, status: "completed", groupId: "g2", groupName: "Kabwata Youth Savers", date: "Jan 12, 2026", direction: "out" },
];
