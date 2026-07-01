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
    lateContribution: { enabled: boolean; penaltyType: "flat" | "percent"; penaltyRate?: number; penaltyAmount?: number };
    missingMeeting: { enabled: boolean; amount: number };
    lateRepayment: { enabled: boolean; penaltyType: "flat" | "percent"; penaltyRate?: number; penaltyAmount?: number };
  };
  gracePeriodDays: number;
  loanMultiplier: number;
  loanInterestRate: number;
  loanRepaymentMonths: number;
  internalLendingEnabled: boolean;
  approvalThreshold: "2-of-3" | "majority" | "all";
  penaltyFundsDestination?: "group-pool" | "emergency-fund" | "welfare-account";
}

export interface GroupGovernance {
  chairperson: "self" | string;
  treasurerPhone: string | null;
  secretaryPhone: string | null;
  approvalThreshold: GroupConstitution["approvalThreshold"];
  permissions: Record<string, boolean>;
}

export interface FeeStatus {
  status: "paid" | "grace" | "locked";
  daysIntoGrace: number;
  daysLeft: number;
  monthsOwed: number;
  amountOwed: number;
  locked: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  groupType?: GroupType;
  constitution?: GroupConstitution;
  governance?: GroupGovernance;
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
  healthScore?: number;
  savingsGrowth?: number;
  repaymentRate?: number;
  defaults?: number;
  nextContributionDate?: string;
  nextContributionAmount?: number;
  memberRetention?: number;
  registrationFee?: number;
  registrationPaid?: boolean;
  registrationPaidAt?: string;
  registrationMethod?: string;
  monthlyFee?: number;
  feeDueDay?: number;
  feePaidThrough?: string;
  feeStatus?: FeeStatus;
  createdAt?: string;
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
  memberId: string;
  memberName: string;
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
  type: "loan" | "withdrawal" | "rule-change" | "admin-action" | "share-out";
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

export interface Penalty {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;
  memberName: string;
  violationType: "lateContribution" | "missingMeeting" | "lateRepayment";
  reason: string;
  amount: number;
  fundsDestination: "group-pool" | "emergency-fund" | "welfare-account";
  status: "pending" | "paid";
  createdAt: string;
  dueContext?: string;
}

export interface Notice {
  id: string;
  type: "loan" | "contribution" | "governance" | "security" | "repayment" | "invite" | "penalty";
  title: string;
  body: string;
  date: string;
  read: boolean;
  groupId?: string;
  groupName?: string;
  invitedBy?: string;
  penaltyAmount?: number;
  penaltyReason?: string;
}
