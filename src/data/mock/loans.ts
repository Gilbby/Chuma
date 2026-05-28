import type { Loan } from "@/src/types";

export const loans: Loan[] = [
  {
    id: "l1",
    groupId: "g2",
    groupName: "Kabwata Youth Savers",
    principal: 5000,
    outstanding: 3750,
    interestRate: 4,
    durationMonths: 6,
    installmentAmount: 1250,
    nextDueDate: "Mar 04, 2026",
    installmentsPaid: 1,
    totalInstallments: 4,
    status: "active",
    history: [
      { date: "Feb 18, 2026", amount: 1250, type: "repayment" },
      { date: "Jan 04, 2026", amount: 5000, type: "disbursement" },
    ],
  },
  {
    id: "l2",
    groupId: "g1",
    groupName: "Lusaka Market Sisters",
    principal: 3500,
    outstanding: 1167,
    interestRate: 5,
    durationMonths: 3,
    installmentAmount: 1167,
    nextDueDate: "Mar 15, 2026",
    installmentsPaid: 2,
    totalInstallments: 3,
    status: "active",
    history: [
      { date: "Feb 15, 2026", amount: 1167, type: "repayment" },
      { date: "Jan 30, 2026", amount: 1167, type: "repayment" },
      { date: "Jan 15, 2026", amount: 3500, type: "disbursement" },
    ],
  },
];
