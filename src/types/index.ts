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
  // "pending" = invited but hasn't accepted yet. They are NOT part of the group
  // until they accept - don't count them, don't show them as members.
  status?: "pending" | "active" | "removed";
  invitedByName?: string;
  invitedAt?: string;
  lastInviteSentAt?: string;
  // Chilimba (rotating savings) only: this member's 1-based slot in the payout
  // order (null until the order is drawn), and whether they have taken the pool
  // yet - the round they took it and when. See isChilimbaType.
  payoutPosition?: number | null;
  payoutReceived?: boolean;
  payoutRound?: number;
  payoutReceivedAt?: string;
  // Frozen at removal. A former member's row is kept as the group's record of
  // them - savings goes to 0 when the refund lands, these do not.
  exitedAt?: string;
  exitSavings?: number;
  exitRefund?: number;
  exitLoanCleared?: number;
}

export type GroupType =
  | "savings-group"
  | "cooperative"
  | "womens-group"
  | "church-group"
  | "investment-group"
  // Rotating savings (ROSCA): everyone contributes a fixed amount each round and
  // one member takes the whole pool, rotating until all have. See isChilimbaType.
  | "chilimba";

/**
 * Types that collect toward NAMED PROJECTS instead of running a contribution
 * cycle. A church group takes whatever members choose to give, whenever they
 * give it, and spends it on the project it was given for - so it has no fixed
 * amount, no frequency, no deadline, no late penalty, no loans and no
 * share-out. What it has instead is `Group.projects`.
 * Mirrors PROJECT_FUND_TYPES in the API's logic.service.js.
 */
export const PROJECT_FUND_TYPES: GroupType[] = ["church-group"];

export const isProjectFundType = (t?: GroupType | "" | null): boolean =>
  !!t && PROJECT_FUND_TYPES.includes(t);

/**
 * Rotating-savings types (chilimba / ROSCA). Members contribute a fixed amount
 * each round on a schedule and the whole pool goes to ONE member that round,
 * rotating in a random order drawn at the start until everyone has received
 * once. So a chilimba keeps a contribution cycle and its late-contribution
 * penalties, but has no internal lending and no end-of-cycle share-out - the
 * pool empties every round instead. Mirrors CHILIMBA_TYPES in the API's
 * logic.service.js. Rotation state lives on `Group.chilimba` and the member
 * `payoutPosition`/`payoutReceived` fields.
 */
export const CHILIMBA_TYPES: GroupType[] = ["chilimba"];

export const isChilimbaType = (t?: GroupType | "" | null): boolean =>
  !!t && CHILIMBA_TYPES.includes(t);

/** Rotation state for a chilimba group - mirrors `group.chilimba` in the API. */
export interface ChilimbaState {
  orderDrawn: boolean;
  orderDrawnAt?: string | null;
  currentRound: number; // 0 before the draw; > totalRounds once complete
  totalRounds?: number;
}

/** A thing the group is raising money for - "Church building", "Mission trip". */
export interface GroupProject {
  id: string;
  name: string;
  targetAmount: number | null; // null = no goal set
  deadline?: string | null; // ISO date; null = collect for as long as it takes
  collected: number;
  status: "active" | "completed" | "archived";
  createdAt?: string;
}

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
  loanRepaymentMonths: number; // legacy single cap - kept as a fallback
  loanRepaymentTiers?: LoanRepaymentTier[];
  // No new loans may be issued within this many months of share-out, so every
  // loan is due before the cycle closes. VSLA norm is 1-2 months.
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
  // "pending-payment" is a brand-new group whose registration fee has not
  // settled yet - not overdue, just not started. `locked` is true for it too.
  status: "paid" | "grace" | "locked" | "pending-payment";
  daysIntoGrace: number;
  daysLeft: number;
  monthsOwed: number;
  amountOwed: number;
  locked: boolean;
}

/** Someone who found a group through search and asked to join. Not a member
 *  and not invited - an admin approving it is what makes them a member. */
export interface JoinRequest {
  id: string;
  userId: string;
  name?: string;
  phone?: string;
  requestedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  /** "pending-payment" means the registration fee has not landed: the group
   *  exists but nothing inside it can be opened or used yet. */
  status?: "pending-payment" | "active" | "closed" | "deletion-pending";
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
  /** What the signed-in member has put into this group, and how many times.
   *  Read off their own member row by the service layer, so it is 0 for
   *  anyone who is not a member of the group. */
  yourSavings?: number;
  yourContributions?: number;
  /** Savings projects. Only project-fund types (church) have any - see
   *  isProjectFundType. Always set by the service layer; optional so older
   *  shapes still type. */
  projects?: GroupProject[];
  /** Rotation state. Only chilimba types have any - see isChilimbaType. */
  chilimba?: ChilimbaState;
  /** Removed members, kept as history. Never counted as members of the group.
   *  Always set by the service layer; optional so older shapes still type. */
  formerMembers?: Member[];
  /** Asks to join from people who found the group through search. Shown to
   *  admins only. Always set by the service layer. */
  joinRequests?: JoinRequest[];
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
  type: "contribution" | "loan" | "repayment" | "share-out" | "chilimba-payout" | "withdrawal" | "penalty" | "fee";
  amount: number;
  status: "completed" | "pending" | "failed";
  groupId: string;
  groupName: string;
  memberId?: string;
  date: string;
  note?: string;
  direction: "in" | "out";
  networkFee?: number; // member's own MMO fee on money-in (display-only, stored on the txn)
  /** Project-fund groups (church): the project this money was given toward.
   *  Absent on untagged giving, which reads as "General giving". */
  projectId?: string;
  projectName?: string;
  /** Project-fund groups: how the member says the money reached the church. */
  channel?: GivingChannel;
}

// ─── Church cash flow ────────────────────────────────────────────────────────
// Mobile money is off in the app, so a church group's money moves outside it
// and the app keeps the record. A member says how they paid; the cash handler
// confirms it arrived (an approval of type "cash-receipt"); cash then sits with
// the cash handler until they declare where they delivered it. Bank and mobile
// money are final: the app never records money leaving either, so only cash
// that is still being held can be spent on a project.

/** How a member's giving reached the church. Only "cash" passes through the
 *  cash handler's hands - the other two land in the church account directly. */
export type GivingChannel = "cash" | "bank" | "mobile-money";

/** Where the cash handler delivered cash they were holding. "other" is a
 *  free-text destination they describe (destinationNote). "mobile-money" is
 *  kept for older records but is no longer offered. */
export type DeliveryDestination = "bank" | "mobile-money" | "project" | "other";

/**
 * The money given toward one project - or, with `projectId: null`, the money
 * given toward nothing in particular ("General giving") - and where every
 * kwacha of it is now. raised = cashOnHand + banked + mobileMoney + paidOut.
 */
export interface FundPile {
  projectId: string | null;
  name: string;
  raised: number;
  /** Confirmed cash the cash handler still holds: still to be delivered. */
  cashOnHand: number;
  banked: number;
  mobileMoney: number;
  /** Cash moved to some other place the handler described (destination
   *  "other"). Held like banked/mobileMoney, not spent. */
  other: number;
  /** Cash from THIS pile paid out for a project. General giving's can have
   *  gone toward any project; a project's own only toward itself. */
  paidOut: number;
  /** General giving cash paid out toward this project. Spent on it, never
   *  raised for it. Always 0 on the General giving pile. */
  paidFromGeneral: number;
}

/** A declaration that held cash went somewhere. */
export interface CashDelivery {
  id: string;
  groupId: string;
  /** The pile the cash came from; null = General giving. */
  sourceProjectId: string | null;
  sourceName: string;
  destination: DeliveryDestination;
  /** destination "project" only: the project it was paid out for. Null when
   *  General giving was paid out for no project in particular. */
  targetProjectId?: string | null;
  targetName?: string;
  amount: number;
  /** Deposit slip, transaction ID or receipt number. */
  reference?: string;
  /** destination "other" only: free text saying where the cash went. */
  destinationNote?: string;
  /** destination "project" only: who was paid. */
  payee?: string;
  recordedByName?: string;
  date: string;
}

/** Where a project-fund group's money sits, pile by pile, plus the totals. */
export interface GroupFunds {
  groupId: string;
  piles: FundPile[];
  cashOnHand: number;
  banked: number;
  mobileMoney: number;
  other: number;
  paidOut: number;
  /** Newest first. */
  deliveries: CashDelivery[];
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

/** One admin's decision on an approval - the row of its history trail. */
export interface ApprovalVote {
  /** Who voted. Absent on older votes recorded before the id was stored. */
  adminId?: string;
  adminName: string;
  decision: "approve" | "reject";
  at: string;
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
    | "share-out"
    // A chilimba round payout: admins approve handing the whole pool to the
    // member whose turn it is this round. See isChilimbaType.
    | "chilimba-payout"
    // An admin acknowledging that cash physically reached them. Needs one
    // admin, not a quorum - see the API's cashReceipt service.
    | "cash-receipt";
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
  /** share-out only: how this run pays. Voters are approving the method too -
   *  "manual" means the group pays each member itself (notes, the treasurer's
   *  own mobile money, a bank transfer) and confirms each one in the app. */
  payoutMethod?: "manual" | "mobile-money";
  timestamp: string;
  // "executed" = approved AND its action has run (a refund paid, a share-out
  // distributed). An approved-but-not-executed action can be run again.
  status: "pending" | "approved" | "rejected" | "executed";
  /** cash-receipt only: whose duty this receipt is. The treasurer, who keeps
   *  the cash box - and the chairperson only when the group has no treasurer.
   *  Any admin may still confirm it; this is who it was addressed to. Absent on
   *  receipts raised before the role was recorded. */
  confirmerRole?: "Treasurer" | "Chairperson";
  /** cash-receipt on a project-fund group: how the member says they paid, the
   *  reference they gave for a bank / mobile-money transfer, and the project
   *  the money was given toward (absent = General giving). */
  channel?: GivingChannel;
  reference?: string;
  projectName?: string;
  /** Who a member-removal is about - they never vote on their own removal. */
  targetUserId?: string;
  targetName?: string;
  /** Who decided, and when - shown on resolved approvals in the history. */
  votes?: ApprovalVote[];
  /** When it stopped being pending. Absent while still pending. */
  resolvedAt?: string;
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
    | "join_request"
    | "penalty"
    | "kyc"
    | "biometric";
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
