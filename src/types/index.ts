export type Role = "Chairperson" | "Treasurer" | "Secretary" | "Member";

export interface Member {
  id: string;
  name: string;
  role: Role;
  phone: string;
  avatar?: string;
  savings: number;
  contributions: number;
  loanActive?: number;
}

export type GroupType =
  | "savings-group"
  | "cooperative"
  | "womens-group"
  | "church-group"
  | "investment-group";

export interface GroupConstitution {
  penaltyRules: {
    lateContribution: { enabled: boolean; amount: number };
    missingMeeting: { enabled: boolean; amount: number };
    lateRepayment: { enabled: boolean; amount: number };
  };
  gracePeriodDays: number;
  loanMultiplier: number;
  loanInterestRate: number;
  loanRepaymentMonths: number;
  internalLendingEnabled: boolean;
  approvalThreshold: "2-of-3" | "majority" | "all";
}

export interface Group {
  id: string;
  name: string;
  description: string;
  groupType?: GroupType;
  constitution?: GroupConstitution;
  totalSavings: number;
  walletBalance: number;
  loanCirculation: number;
  memberCount: number;
  cycleProgress: number; // 0-1
  shareOutDate: string;
  contributionAmount: number;
  contributionFrequency: string;
  loanInterestRate: number; // % per month
  loanMaxMultiplier: number; // x of savings
  members: Member[];
  yourRole: Role;
}

export interface TxnItem {
  id: string;
  type: "contribution" | "loan" | "repayment" | "share-out" | "withdrawal";
  amount: number;
  status: "completed" | "pending" | "failed";
  groupId: string;
  groupName: string;
  date: string;
  note?: string;
  direction: "in" | "out";
}

export interface Loan {
  id: string;
  groupId: string;
  groupName: string;
  principal: number;
  outstanding: number;
  interestRate: number;
  durationMonths: number;
  installmentAmount: number;
  nextDueDate: string;
  installmentsPaid: number;
  totalInstallments: number;
  status: "active" | "pending" | "completed" | "rejected";
  history: { date: string; amount: number; type: "disbursement" | "repayment" }[];
}

export interface Approval {
  id: string;
  type: "loan" | "withdrawal" | "rule-change" | "admin-action";
  title: string;
  description: string;
  requestedBy: string;
  requestedById: string;
  amount?: number;
  groupId: string;
  groupName: string;
  votesFor: number;
  votesAgainst: number;
  totalVoters: number;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
}

export interface Notice {
  id: string;
  type: "loan" | "contribution" | "governance" | "security" | "repayment";
  title: string;
  body: string;
  date: string;
  read: boolean;
}
