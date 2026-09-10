/**
 * Auto-saved draft of the create-group wizard.
 *
 * The wizard is six steps long and collects a constitution's worth of detail,
 * so losing it to a backgrounded app that Android later killed means starting
 * the whole thing again. Every edit is written here (debounced, plus an
 * immediate flush when the app goes to the background) and restored the next
 * time the wizard opens.
 *
 * Only ONE draft is kept: a founder builds one group at a time, and a list of
 * half-finished groups on the overview would be worse than the problem. It is
 * cleared the moment the group is actually created, on logout, and whenever the
 * founder discards it from the Groups tab.
 *
 * Nothing here is sensitive enough for SecureStore (a group name, amounts, and
 * the officers' phone numbers), but it IS tied to the account that typed it:
 * the draft carries its author's id and a draft belonging to someone else on a
 * shared phone is ignored and dropped.
 */

import { storage } from "@/src/utils/storage";
import type { GroupConstitution, GroupType, LoanRepaymentTier } from "@/src/types";

const DRAFT_KEY = "chuma.draft.create-group";

// Bump when a field changes shape. An older draft is discarded rather than
// half-restored — a wizard hydrated with fields it no longer understands is
// worse than a blank one.
const DRAFT_VERSION = 2;

export interface DraftProjectRow {
  key: string;
  name: string;
  target: string;
  deadline: string;
}

export interface DraftPermissions {
  loanApprovals: boolean;
  withdrawals: boolean;
  ruleChanges: boolean;
  memberRemovals: boolean;
  shareOutApprovals: boolean;
}

/** Everything the wizard would lose if the app died — mirrors its state. */
export interface CreateGroupDraftForm {
  groupName: string;
  groupType: GroupType | "";
  groupDesc: string;
  groupAvatar: string | null;

  contribFreq: string;
  contribAmount: string;
  cycleDuration: string;
  deadlineDay: string;
  deadlineDow: string;
  lateContribEnabled: boolean;
  lateContributionPenaltyRate: string;
  lateContribPenaltyType: "flat" | "percent";
  lateContribFlatAmount: string;

  projects: DraftProjectRow[];

  internalLending: boolean;
  loanMultiplier: string;
  loanInterest: string;
  repaymentTiers: LoanRepaymentTier[];
  loanFreeWindow: number;
  gracePeriod: string;
  lateRepayEnabled: boolean;
  lateRepaymentPenaltyRate: string;
  lateRepayPenaltyType: "flat" | "percent";
  lateRepayFlatAmount: string;

  treasurerPhone: string;
  secretaryPhone: string;
  approvalThreshold: GroupConstitution["approvalThreshold"];
  permissions: DraftPermissions;

  termsAccepted: boolean;
}

export interface CreateGroupDraft {
  version: number;
  /** _id of the user who was filling it in. */
  userId: string;
  /** ISO timestamp of the last edit. */
  savedAt: string;
  /** Wizard step they were on (1–6). */
  step: number;
  /** Steps in their flow — savings-only types skip loan rules, so this varies. */
  totalSteps: number;
  /** Step number as the wizard labels it, e.g. "Step 3 of 5". */
  displayStep: number;
  form: CreateGroupDraftForm;
}

/** Save the draft, overwriting any previous one. Never throws. */
export async function saveGroupDraft(draft: CreateGroupDraft): Promise<boolean> {
  return storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/**
 * The saved draft, or null when there is none, it belongs to another account,
 * or it predates the current shape. In the last two cases it is also deleted,
 * so a stale draft can't sit there forever being skipped.
 */
export async function loadGroupDraft(userId?: string | null): Promise<CreateGroupDraft | null> {
  const raw = await storage.getItem(DRAFT_KEY, null);
  if (!raw) return null;
  let draft: CreateGroupDraft | null = null;
  try {
    draft = JSON.parse(raw as unknown as string) as CreateGroupDraft;
  } catch {
    await clearGroupDraft();
    return null;
  }
  if (!draft || typeof draft !== "object" || !draft.form) {
    await clearGroupDraft();
    return null;
  }
  if (draft.version !== DRAFT_VERSION) {
    await clearGroupDraft();
    return null;
  }
  // Someone else's unfinished group — leave their account out of this one and
  // drop it: this device is now signed in as a different person.
  if (userId && draft.userId && draft.userId !== userId) {
    await clearGroupDraft();
    return null;
  }
  return draft;
}

export async function clearGroupDraft(): Promise<boolean> {
  return storage.removeItem(DRAFT_KEY);
}

/** Build a draft record around a form snapshot. */
export function makeGroupDraft(args: {
  userId: string;
  step: number;
  totalSteps: number;
  displayStep: number;
  form: CreateGroupDraftForm;
}): CreateGroupDraft {
  return {
    version: DRAFT_VERSION,
    userId: args.userId,
    savedAt: new Date().toISOString(),
    step: args.step,
    totalSteps: args.totalSteps,
    displayStep: args.displayStep,
    form: args.form,
  };
}

/** What the founder called it, or a stand-in while step 1 is still blank. */
export function draftTitle(draft: CreateGroupDraft): string {
  return draft.form.groupName.trim() || "Untitled group";
}

/** "just now" / "12 minutes ago" / "3 hours ago" / "2 days ago". */
export function savedAgo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "a minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
