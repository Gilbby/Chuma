import type { Role } from "@/src/types";

export const currentUser = {
  id: "u-gilbert",
  name: "Gilbert",
  phone: "+260 977 234 567",
  joinedDate: "2024-01-15",
  avatar:
    "https://images.unsplash.com/photo-1588178454780-441fa5b99fa5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwzfHxhZnJpY2FuJTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3QlMjBzbWlsaW5nfGVufDB8fHx8MTc3OTA1NTI4M3ww&ixlib=rb-4.1.0&q=85",
  memberRole: "Chairperson" as Role,
};

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
