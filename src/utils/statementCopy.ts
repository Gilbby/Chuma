// What a statement CALLS things, per group type.
//
// A savings group and a church group hold a member's money for opposite
// reasons: one keeps a stake that comes back at share-out, the other takes a
// gift that funds a project and is never repaid. The figures the API returns
// are the same either way — it is the words around them that have to change,
// or a church member reads "closing savings balance" as money they are owed.
//
// The screen, the PDF and the CSV all read from here so the copy a member sees
// and the copy they hand to someone else cannot drift apart. Adding a group
// type means adding a flavour below, not hunting for strings in three files.
//
// Shape does NOT vary by flavour, and it does not vary by medium either. Every
// statement is the totals card then the activity, on screen and in the export
// alike — a phone statement is read standing up, and the printed copy has to be
// recognisable as the same document. The per-line detail (reference, method,
// running balance) lives on the receipt behind a tap, which is the one thing
// paper cannot do.

import { GroupType, isProjectFundType } from "@/src/types";
import type { StatementScope, StatementTxnType } from "@/src/services/statement";

export type StatementFlavour = "savings" | "project-fund";

export interface StatementCopy {
  /** Cover label on the PDF and the first line of the CSV. */
  docLabel: string;
  /** Big figure at the top of the screen; the screen upper-cases it. */
  balanceLabel: string;
  summaryTitle: string;
  openingLabel: string;
  /** Money in — a contribution, or a gift. */
  inLabel: string;
  /** Money out. `null` where the type never pays anything back, which drops
   *  the row rather than showing a permanent zero. */
  outLabel: string | null;
  closingLabel: string;
  /** Heading over the movement list. */
  activityTitle: string;
  /**
   * What to call a movement, where the API's own wording is written for a
   * savings group. Only the types that actually read wrong need an entry;
   * everything else falls through to the description the API sent.
   */
  activityLabels: Partial<Record<StatementTxnType, string>>;
  /** Sits under the figures on screen; the PDF uses `footnotePdf`. */
  footnote: string;
  footnotePdf: string;
  /** Stem of the exported file name. */
  fileStem: string;
}

const COPY: Record<StatementFlavour, StatementCopy> = {
  savings: {
    docLabel: "Savings statement",
    balanceLabel: "Closing savings balance",
    summaryTitle: "Savings summary",
    openingLabel: "Opening balance",
    inLabel: "Contributions",
    outLabel: "Share-out paid",
    closingLabel: "Closing balance",
    activityTitle: "All activity",
    // The API already words these for a savings group.
    activityLabels: {},
    footnote:
      "Your savings balance counts contributions and share-outs only. Loans, repayments, penalties and fees are real money and show in your activity, but they do not change your stake. Tap any line for its receipt.",
    footnotePdf:
      "This is an official Chuma statement. The balance shown is your savings stake in the group: contributions and share-outs only. Loans, repayments, penalties and fees are real money and are listed under activity, but they do not change your stake.",
    fileStem: "Chuma-Statement",
  },
  "project-fund": {
    docLabel: "Giving statement",
    balanceLabel: "Total given",
    summaryTitle: "Giving summary",
    openingLabel: "Given before this period",
    inLabel: "Given this period",
    // A project fund never shares out, so there is no counterpart to giving.
    outLabel: null,
    closingLabel: "Total given",
    activityTitle: "Activity",
    activityLabels: {
      // "Cycle contribution" is a savings group's word for it, and a member
      // reading a lump payment does not need to be told which internal type
      // produced it. A combined payment is not all giving, so it is not called
      // giving.
      contribution: "Giving",
      combined: "Payment",
    },
    footnote:
      "This total is what you have given, not a balance you can draw on, because a project fund is never shared out. Fees and penalties show in your activity, but they do not count as giving. Tap any line for its receipt.",
    footnotePdf:
      "This is an official Chuma statement. The total shown is what this member has given toward the group's projects. A project fund is not repaid and is never shared out, so nothing here is a claim on the group. Fees are real money and are listed under activity, but they do not count as giving.",
    fileStem: "Chuma-Giving-Statement",
  },
};

/**
 * The same statement, worded for the whole group instead of one member.
 *
 * An officer pulling the group's book is reading the pool, not a stake, so
 * every label that says "you" has to stop saying it: "Contributions" becomes
 * "Contributions received", "Total given" becomes "Total raised". Only the
 * words move — the figures, the shape and the order stay the member
 * statement's, deliberately, so a treasurer reconciling the group and a
 * member checking their own line are reading the same document.
 *
 * Only the labels that actually read wrong are overridden; everything else
 * falls through to the member copy above.
 */
const GROUP_OVERRIDES: Record<StatementFlavour, Partial<StatementCopy>> = {
  savings: {
    docLabel: "Group savings statement",
    balanceLabel: "Group savings balance",
    summaryTitle: "Group savings summary",
    openingLabel: "Opening group balance",
    inLabel: "Contributions received",
    outLabel: "Share-outs paid",
    closingLabel: "Closing group balance",
    activityTitle: "All group activity",
    footnote:
      "This is the group's pooled savings: contributions in and share-outs out, across every member. Loans, repayments, penalties and fees are real money and show in the activity, but they do not change the pool. Tap any line for its receipt.",
    footnotePdf:
      "This is an official Chuma group statement. The balance shown is the group's pooled savings across every member: contributions and share-outs only. Loans, repayments, penalties and fees are real money and are listed under activity, but they do not change the pool.",
    fileStem: "Chuma-Group-Statement",
  },
  "project-fund": {
    docLabel: "Group giving statement",
    balanceLabel: "Total raised",
    summaryTitle: "Group giving summary",
    openingLabel: "Raised before this period",
    inLabel: "Given this period",
    closingLabel: "Total raised",
    activityTitle: "All group activity",
    footnote:
      "This is what the group has raised toward its projects, across every member. A project fund is never shared out, so nothing here is owed back. Fees and penalties show in the activity but do not count as giving. Tap any line for its receipt.",
    footnotePdf:
      "This is an official Chuma group statement. The total shown is what the group has raised toward its projects, across every member. A project fund is not repaid and is never shared out, so nothing here is a claim on the group. Fees are real money and are listed under activity, but they do not count as giving.",
    fileStem: "Chuma-Group-Giving-Statement",
  },
};

export const statementCopy = (
  flavour: StatementFlavour,
  scope: StatementScope = "member"
): StatementCopy =>
  scope === "group"
    ? { ...COPY[flavour], ...GROUP_OVERRIDES[flavour] }
    : COPY[flavour];

/**
 * What one movement is called on this kind of statement.
 *
 * The project it paid into wins whenever the API supplies one: a church member
 * gave to a named thing, and "Church building" is the only label that answers
 * the question they opened the statement to ask. Below that sits the per-type
 * wording, and below that the description the API sent — which is already the
 * right one for a savings group.
 *
 * Screen and exports both go through here, so the line a member taps and the
 * line they hand to someone else carry the same name.
 */
export const movementLabel = (
  copy: StatementCopy,
  movement: {
    type: StatementTxnType;
    description: string;
    projectLabel?: string | null;
  }
): string =>
  movement.projectLabel ??
  copy.activityLabels[movement.type] ??
  movement.description;

/**
 * Which wording a statement should use.
 *
 * A statement scoped to one group follows that group's type. Scoped to "All
 * groups" it can only use the giving wording when EVERY group gives toward
 * projects — mixing a church group in with a savings group leaves the savings
 * wording, which is the one that still describes a share-out correctly.
 */
export function statementFlavourFor(
  groupTypes: (GroupType | undefined)[]
): StatementFlavour {
  return groupTypes.length > 0 && groupTypes.every((t) => isProjectFundType(t))
    ? "project-fund"
    : "savings";
}
