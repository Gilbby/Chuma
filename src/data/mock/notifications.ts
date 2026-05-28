import type { Notice } from "@/src/types";

export const notifications: Notice[] = [
  { id: "n1", type: "loan", title: "Loan approved", body: "Your loan of K 5,000 has been approved by Kabwata Youth Savers.", date: "Today, 14:32", read: false },
  { id: "n2", type: "contribution", title: "Contribution reminder", body: "Your weekly contribution of K 500 to Lusaka Market Sisters is due tomorrow.", date: "Today, 08:00", read: false },
  { id: "n3", type: "governance", title: "New proposal", body: "John Mwale proposed a rule change in Kabwata Youth Savers.", date: "Yesterday", read: false },
  { id: "n4", type: "repayment", title: "Repayment due in 3 days", body: "Installment of K 1,250 due on Mar 04, 2026.", date: "Yesterday", read: true },
  { id: "n5", type: "security", title: "New login detected", body: "Login from Samsung A52 in Lusaka.", date: "Feb 18, 2026", read: true },
  { id: "n6", type: "loan", title: "Repayment received", body: "Your repayment of K 1,250 has been recorded.", date: "Feb 18, 2026", read: true },
];
