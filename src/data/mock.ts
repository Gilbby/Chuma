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

export interface Group {
  id: string;
  name: string;
  description: string;
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

export const currentUser = {
  id: "u-gilbert",
  name: "Gilbert",
  phone: "+260 977 234 567",
  avatar:
    "https://images.unsplash.com/photo-1588178454780-441fa5b99fa5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwzfHxhZnJpY2FuJTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3QlMjBzbWlsaW5nfGVufDB8fHx8MTc3OTA1NTI4M3ww&ixlib=rb-4.1.0&q=85",
  memberRole: "Chairperson" as Role,
};

const namesPool = [
  "Chisomo Banda", "Natasha Phiri", "John Mwale", "Mwansa Tembo", "Thandiwe Zulu",
  "Bwalya Chanda", "Mulenga Kapya", "Tafadzwa Lungu", "Chipo Mvula", "Kabwe Mwanza",
  "Nasilele Sakala", "Mutale Chileshe", "Lubinda Bwalya", "Mwila Daka", "Choolwe Hamoonga",
  "Inonge Liswaniso", "Mubita Sikota", "Namakau Kabwe", "Chibwe Musonda", "Kafula Mubita",
  "Mwape Banda", "Sibeso Mwiya", "Likando Imbula", "Mukuka Zimba", "Chola Chembe",
  "Misozi Phiri", "Yotam Sichone", "Ruth Nyirenda", "Peter Mumba", "Esther Kalunga",
  "Patrick Tembo", "Beatrice Mwila", "Joseph Chama", "Catherine Bwalya", "Daniel Lungu",
  "Mercy Phiri", "Samuel Mukwita", "Grace Nkandu", "Brian Chitalu", "Faith Mwale",
  "George Kapinga", "Linda Sata", "Henry Musonda", "Joyce Mubanga", "Kennedy Daka",
  "Maureen Zulu", "Christopher Nsofu", "Tendai Banda", "Anna Mwiinde",
];

function makeMembers(role0: Role, count = 50): Member[] {
  const roles: Role[] = ["Chairperson", "Treasurer", "Secretary", ...Array(count - 3).fill("Member" as Role)];
  return Array.from({ length: count }).map((_, i) => {
    const name = namesPool[i % namesPool.length];
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2);
    return {
      id: `m-${i}`,
      name,
      role: i === 0 ? role0 : roles[i] ?? ("Member" as Role),
      phone: `+260 9${77 + (i % 3)} ${100 + i} ${200 + i}`,
      savings: 2500 + ((i * 173) % 12000),
      contributions: 8 + (i % 12),
      loanActive: i % 4 === 0 ? 1500 + ((i * 53) % 4000) : 0,
      avatar: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ initials } as any),
    };
  });
}

export const groups: Group[] = [
  {
    id: "g1",
    name: "Lusaka Market Sisters",
    description: "Weekly contribution circle for market traders in Soweto Market.",
    totalSavings: 248500,
    walletBalance: 42300,
    loanCirculation: 156000,
    memberCount: 50,
    cycleProgress: 0.68,
    shareOutDate: "Dec 20, 2026",
    contributionAmount: 500,
    contributionFrequency: "Weekly",
    loanInterestRate: 5,
    loanMaxMultiplier: 3,
    members: makeMembers("Chairperson", 50),
    yourRole: "Chairperson",
  },
  {
    id: "g2",
    name: "Kabwata Youth Savers",
    description: "Monthly savings group for young professionals.",
    totalSavings: 134200,
    walletBalance: 18900,
    loanCirculation: 89400,
    memberCount: 32,
    cycleProgress: 0.42,
    shareOutDate: "Mar 15, 2027",
    contributionAmount: 800,
    contributionFrequency: "Monthly",
    loanInterestRate: 4,
    loanMaxMultiplier: 2.5,
    members: makeMembers("Treasurer", 32),
    yourRole: "Treasurer",
  },
  {
    id: "g3",
    name: "Chongwe Farmers Chuma",
    description: "Seasonal savings for farming inputs and tools.",
    totalSavings: 89400,
    walletBalance: 9120,
    loanCirculation: 54200,
    memberCount: 24,
    cycleProgress: 0.85,
    shareOutDate: "Oct 30, 2026",
    contributionAmount: 1200,
    contributionFrequency: "Bi-weekly",
    loanInterestRate: 3.5,
    loanMaxMultiplier: 2,
    members: makeMembers("Member", 24),
    yourRole: "Member",
  },
];

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

export const approvals: Approval[] = [
  {
    id: "a1",
    type: "loan",
    title: "Loan request — Chisomo Banda",
    description: "Loan for restocking market inventory.",
    requestedBy: "Chisomo Banda",
    requestedById: "m-0",
    amount: 4500,
    groupId: "g1",
    groupName: "Lusaka Market Sisters",
    votesFor: 6,
    votesAgainst: 1,
    totalVoters: 10,
    timestamp: "2 hours ago",
    status: "pending",
  },
  {
    id: "a2",
    type: "withdrawal",
    title: "Emergency withdrawal — Natasha Phiri",
    description: "Medical emergency withdrawal request.",
    requestedBy: "Natasha Phiri",
    requestedById: "m-1",
    amount: 1800,
    groupId: "g2",
    groupName: "Kabwata Youth Savers",
    votesFor: 4,
    votesAgainst: 0,
    totalVoters: 7,
    timestamp: "5 hours ago",
    status: "pending",
  },
  {
    id: "a3",
    type: "rule-change",
    title: "Increase loan interest to 5%",
    description: "Proposal to adjust interest rate from 4% to 5% per month.",
    requestedBy: "John Mwale",
    requestedById: "m-2",
    groupId: "g2",
    groupName: "Kabwata Youth Savers",
    votesFor: 3,
    votesAgainst: 5,
    totalVoters: 12,
    timestamp: "1 day ago",
    status: "pending",
  },
  {
    id: "a4",
    type: "loan",
    title: "Loan request — Mwansa Tembo",
    description: "School fees for child secondary education.",
    requestedBy: "Mwansa Tembo",
    requestedById: "m-3",
    amount: 2200,
    groupId: "g1",
    groupName: "Lusaka Market Sisters",
    votesFor: 8,
    votesAgainst: 0,
    totalVoters: 10,
    timestamp: "1 day ago",
    status: "pending",
  },
];

export const notifications: Notice[] = [
  { id: "n1", type: "loan", title: "Loan approved", body: "Your loan of K 5,000 has been approved by Kabwata Youth Savers.", date: "Today, 14:32", read: false },
  { id: "n2", type: "contribution", title: "Contribution reminder", body: "Your weekly contribution of K 500 to Lusaka Market Sisters is due tomorrow.", date: "Today, 08:00", read: false },
  { id: "n3", type: "governance", title: "New proposal", body: "John Mwale proposed a rule change in Kabwata Youth Savers.", date: "Yesterday", read: false },
  { id: "n4", type: "repayment", title: "Repayment due in 3 days", body: "Installment of K 1,250 due on Mar 04, 2026.", date: "Yesterday", read: true },
  { id: "n5", type: "security", title: "New login detected", body: "Login from Samsung A52 in Lusaka.", date: "Feb 18, 2026", read: true },
  { id: "n6", type: "loan", title: "Repayment received", body: "Your repayment of K 1,250 has been recorded.", date: "Feb 18, 2026", read: true },
];

export const shareOut = {
  groupId: "g3",
  groupName: "Chongwe Farmers Chuma",
  totalSavings: 89400,
  profit: 14620,
  totalToDistribute: 104020,
  date: "Oct 30, 2026",
  yourShare: 4823,
  members: [
    { id: "m-0", name: "Chisomo Banda", contribution: 4800, share: 5586 },
    { id: "m-1", name: "Natasha Phiri", contribution: 3200, share: 3724 },
    { id: "m-2", name: "John Mwale", contribution: 4400, share: 5121 },
    { id: "m-gilbert", name: "Gilbert (you)", contribution: 4140, share: 4823 },
    { id: "m-3", name: "Mwansa Tembo", contribution: 2800, share: 3259 },
    { id: "m-4", name: "Thandiwe Zulu", contribution: 5200, share: 6054 },
  ],
};

// Charts mock series
export const savingsTrend = [
  { label: "Sep", value: 12 },
  { label: "Oct", value: 18 },
  { label: "Nov", value: 16 },
  { label: "Dec", value: 24 },
  { label: "Jan", value: 28 },
  { label: "Feb", value: 32 },
];

export const repaymentRate = [
  { label: "G1", value: 94 },
  { label: "G2", value: 87 },
  { label: "G3", value: 78 },
];

export function formatZMW(n: number, opts?: { compact?: boolean }) {
  if (opts?.compact && n >= 1000) {
    if (n >= 1000000) return `K ${(n / 1000000).toFixed(1)}M`;
    return `K ${(n / 1000).toFixed(1)}K`;
  }
  return `K ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
