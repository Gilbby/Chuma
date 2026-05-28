import type { Role, Member, Group } from "@/src/types";

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
