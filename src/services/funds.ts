import { api } from "./apiClient";
import {
  CashDelivery,
  DeliveryDestination,
  FundPile,
  GivingChannel,
  Group,
  GroupFunds,
  isProjectFundType,
} from "@/src/types";
import { GENERAL_GIVING_LABEL } from "@/src/constants";

/**
 * Church cash flow - where a project-fund group's money is, and the cash
 * handler's declarations of where held cash went. See the "Church cash flow"
 * types for the model.
 */

/** Who keeps a church group's cash: the Treasurer, and the Chairperson only
 *  when the group has no active Treasurer. Mirrors who a "cash-receipt"
 *  approval is addressed to (its confirmerRole), so the person confirming the
 *  cash arrived is the same person who later says where it went. */
export function handlesCash(group: Group): boolean {
  if (!isProjectFundType(group.groupType)) return false;
  if (group.yourRole === "Treasurer") return true;
  if (group.yourRole !== "Chairperson") return false;
  return !(group.members ?? []).some(
    (m) => m.status === "active" && m.role === "Treasurer"
  );
}

// "Cash" is what the member records for any payment made outside the app -
// notes to the treasurer, or a deposit into the church's own bank or mobile
// money - so it does not claim to know which.
export const CHANNEL_LABELS: Record<GivingChannel, string> = {
  cash: "Cash",
  bank: "Church bank account",
  "mobile-money": "Church mobile money",
};

export const DESTINATION_LABELS: Record<DeliveryDestination, string> = {
  bank: "Deposited to the church bank account",
  "mobile-money": "Deposited to the church mobile money",
  project: "Paid out for a project",
};

const n = (v: unknown) => Number(v) || 0;

function mapPile(raw: any): FundPile {
  const projectId = raw.projectId ? String(raw.projectId) : null;
  return {
    projectId,
    name: raw.name || (projectId ? "Project" : GENERAL_GIVING_LABEL),
    raised: n(raw.raised),
    cashOnHand: n(raw.cashOnHand),
    banked: n(raw.banked),
    mobileMoney: n(raw.mobileMoney),
    paidOut: n(raw.paidOut),
    paidFromGeneral: projectId ? n(raw.paidFromGeneral) : 0,
  };
}

function mapDelivery(raw: any): CashDelivery {
  return {
    ...raw,
    id: String(raw._id ?? raw.id ?? ""),
    groupId: String(raw.groupId ?? ""),
    sourceProjectId: raw.sourceProjectId ? String(raw.sourceProjectId) : null,
    sourceName: raw.sourceName || GENERAL_GIVING_LABEL,
    targetProjectId: raw.targetProjectId ? String(raw.targetProjectId) : null,
    amount: n(raw.amount),
    date: raw.date ?? raw.createdAt ?? "",
  };
}

function mapFunds(raw: any, groupId: string): GroupFunds {
  const piles = (raw?.piles ?? []).map(mapPile);
  // Totals are the piles added up rather than trusted separately, so the card
  // and the rows under it can never disagree.
  const sum = (k: keyof FundPile) => piles.reduce((s: number, p: FundPile) => s + n(p[k]), 0);
  return {
    groupId,
    piles,
    cashOnHand: sum("cashOnHand"),
    banked: sum("banked"),
    mobileMoney: sum("mobileMoney"),
    paidOut: sum("paidOut"),
    deliveries: (raw?.deliveries ?? []).map(mapDelivery),
  };
}

export async function getGroupFunds(groupId: string): Promise<GroupFunds> {
  const res = await api<{ funds: any }>(`/groups/${groupId}/funds`);
  return mapFunds(res.funds, groupId);
}

/** The pile a delivery or a row is about; null = General giving. */
export function findPile(funds: GroupFunds | null, projectId: string | null) {
  return funds?.piles.find((p) => p.projectId === projectId) ?? null;
}

export type DeclareDeliveryPayload = {
  /** The pile the cash comes out of; null = General giving. Ignored with
   *  `all`. */
  sourceProjectId: string | null;
  /** Pay out every kwacha in hand at once, to the bank or mobile money only:
   *  one deposit, split across the piles by the API. */
  all?: boolean;
  destination: DeliveryDestination;
  /** destination "project": what it was paid out for. Must be the source
   *  project itself unless the source is General giving - where it is
   *  optional, and leaving it out pays out for no project in particular. */
  targetProjectId?: string | null;
  /** Up to the source pile's cash on hand. */
  amount: number;
  reference?: string;
  payee?: string;
};

/** Cash handler only. The API checks the amount against the source pile's
 *  cash on hand and refuses a project target the source cannot pay for. */
export async function declareDelivery(
  groupId: string,
  payload: DeclareDeliveryPayload
): Promise<{ deliveries: CashDelivery[]; amount: number; funds: GroupFunds }> {
  const res = await api<{ delivery: any; deliveries?: any[]; amount?: number; funds: any }>(
    `/groups/${groupId}/deliveries`,
    { method: "POST", body: payload }
  );
  const deliveries = (res.deliveries ?? [res.delivery]).filter(Boolean).map(mapDelivery);
  return {
    deliveries,
    amount: Number(res.amount) || deliveries.reduce((sum, d) => sum + d.amount, 0),
    funds: mapFunds(res.funds, groupId),
  };
}
