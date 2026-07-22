export type Role = "Chairperson" | "Treasurer" | "Secretary" | "Member";

export interface Member {
  id: string;
  userId?: string;
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

// A repayment tier caps how long a loan may run based on its size. Loans are
// matched to the first tier whose `maxAmount` covers the amount; the top tier
// uses `maxAmount: null` to catch everything above the last band. This lets a
// K200 loan be repaid quickly while a K5,000 loan gets a longer term.
export interface LoanRepaymentTier {
  maxAmount: number | null; // inclusive upper bound of the band; null = no cap (top tier)
  maxMonths: number; // longest repayment term allowed for loans in this band
}

export interface GroupConstitution {
  penaltyRules: {
    lateContribution: { enabled: boolean; penaltyType: "flat" | "percent"; penaltyRate?: number; penaltyAmount?: number };
    missingMeeting: { enabled: boolean; amount: number };
    lateRepayment: { enabled: boolean; penaltyType: "flat" | "percent"; penaltyRate?: number; penaltyAmount?: number };
  };
  gracePeriodDays: number;
  loanMultiplier: number;
  loanInterestRate: number;
  loanRepaymentMonths: number; // legacy single cap — kept as a fallback
  loanRepaymentTiers?: LoanRepaymentTier[];
  // No new loans may be issued within this many months of share-out, so every
  // loan is due before the cycle closes. VSLA norm is 1–2 months.
  loanFreeWindowMonths?: number;
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
  type: "contribution" | "loan" | "repayment" | "share-out" | "withdrawal" | "penalty" | "fee";
  amount: number;
  status: "completed" | "pending" | "failed";
  groupId: string;
  groupName: string;
  memberId?: string;
  date: string;
  note?: string;
  direction: "in" | "out";
  networkFee?: number; // member's own MMO fee on money-in (display-only, stored on the txn)
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
  type:
    | "loan"
    | "withdrawal"
    | "rule-change"
    | "admin-action"
    | "member-removal"
    | "group-deletion"
    | "share-out";
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
  violationType: "lateContribution" | "missingMeeting" | "lateRepayment" | "other";
  reason: string;
  amount: number;
  fundsDestination: "group-pool" | "emergency-fund" | "welfare-account";
  status: "pending" | "paid";
  createdAt: string;
  dueContext?: string;
}

export interface Notice {
  id: string;
  /** "invite" is actionable; "invite_accepted" is the inviter's confirmation. */
  type:
    | "loan"
    | "contribution"
    | "governance"
    | "security"
    | "repayment"
    | "invite"
    | "invite_accepted"
    | "penalty"
    | "kyc";
  title: string;
  body: string;
  date: string;
  read: boolean;
  groupId?: string;
  groupName?: string;
  invitedBy?: string;
  penaltyAmount?: number;
  penaltyReason?: string;
  penaltyId?: string;
  transactionId?: string;
}
