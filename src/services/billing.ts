// Chuma Plan - Google Play subscription through RevenueCat.
//
// A chairperson's plan covers the groups they founded: groups-1 / groups-3 /
// groups-5 (base plans of the "chuma_plan" subscription). The app only BUYS
// through Play; which groups are covered is decided by the API from
// RevenueCat's records (POST /billing/sync), never from what the app says.
//
// Android only. Google Play policy: on Android the plan must be bought with
// Play Billing, and the app must not mention other ways or prices to pay.

import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  STORE_REPLACEMENT_MODE,
  type PurchasesPackage,
} from "react-native-purchases";
import { api } from "./apiClient";
import { getCurrentUser } from "@/src/utils/currentUser";

export const PLAN_ENTITLEMENT = "group";
/** The API's "no limit" number of groups (shown as "Unlimited groups"). */
export const UNLIMITED_GROUPS = 9999;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

/** Can this device buy a plan? (Android build with a RevenueCat key.) */
export const PLAY_BILLING_AVAILABLE = Platform.OS === "android" && !!ANDROID_KEY;

export interface PlanSummary {
  /** false = billing off on the server (free tracker build): show no plan UI. */
  enabled: boolean;
  plan: {
    active: boolean;
    groupLimit: number;
    basePlanId: string | null;
    expiresAt: string | null;
    willRenew: boolean | null;
  };
  groupsFounded: number;
  groupsCovered: number;
  groups: {
    id: string;
    name: string;
    status: string;
    coveredByPlan: boolean;
    freeUntil: string | null;
    coveredUntil: string | null;
  }[];
  tiers: Record<string, number>;
  /** Kwacha per 1 USD for an "about K…" estimate; null = show none. */
  usdToZmwRate: number | null;
  maxGroupsFounded: number;
}

/** One purchasable tier, in the order shown (smallest first). */
export interface PlanOption {
  basePlanId: string; // "groups-3"
  groupLimit: number; // 3
  priceString: string; // "$4.99", as Play formats it for this user
  price: number; // 4.99
  currencyCode: string; // "USD" in Zambia (Play has no ZMW)
  pkg: PurchasesPackage;
}

let configuredFor: string | null = null;

/**
 * Start RevenueCat for the signed-in user. Purchases are attached to the
 * Chuma user id, which is how the API finds them. Safe to call repeatedly.
 */
async function ensureConfigured(): Promise<void> {
  if (!PLAY_BILLING_AVAILABLE) throw new Error("Plans can't be bought on this device.");
  const user = await getCurrentUser<{ _id?: string }>();
  const userId = user?._id ? String(user._id) : null;
  if (!userId) throw new Error("Sign in again to manage your plan.");

  if (configuredFor === null) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: ANDROID_KEY, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
}

/** Call on sign-out so the next account on this phone doesn't inherit the plan. */
export async function resetBilling(): Promise<void> {
  if (configuredFor === null) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous - nothing to undo.
  }
  configuredFor = null;
}

export function getPlanSummary(): Promise<PlanSummary> {
  return api<PlanSummary>("/billing/plan");
}

/** Ask the API to re-read the plan from RevenueCat and re-apply coverage. */
export function syncPlan(): Promise<PlanSummary> {
  return api<PlanSummary>("/billing/sync", { method: "POST" });
}

/**
 * Put the plan on this group first (the founder's pick). If the plan is full,
 * the group last in line loses cover and gets the normal grace period.
 */
export function preferGroup(groupId: string): Promise<PlanSummary> {
  return api<PlanSummary>("/billing/prefer", { method: "POST", body: { groupId } });
}

function basePlanOf(identifier: string | undefined | null): string | null {
  if (!identifier) return null;
  const parts = identifier.split(":");
  return parts.length > 1 ? parts[1] : null;
}

/** The three tiers with Play's localized prices, smallest first. */
export async function getPlanOptions(tiers: Record<string, number>): Promise<PlanOption[]> {
  await ensureConfigured();
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs
    .map((pkg) => {
      const basePlanId =
        basePlanOf(pkg.product.identifier) ??
        pkg.identifier.replace("groups_", "groups-");
      return {
        basePlanId,
        groupLimit: tiers[basePlanId] ?? 0,
        priceString: pkg.product.priceString,
        price: pkg.product.price,
        currencyCode: pkg.product.currencyCode,
        pkg,
      };
    })
    .filter((o) => o.groupLimit > 0)
    .sort((a, b) => a.groupLimit - b.groupLimit);
}

export type PurchaseOutcome = "purchased" | "cancelled";

/**
 * Buy a tier, or switch to it from the current one. Upgrades apply now, with
 * unused time on the old plan credited toward the new one (Play's default,
 * WITH_TIME_PRORATION - CHARGE_PRORATED_PRICE was refused by Play with a
 * generic "Something went wrong on our end" in testing). Downgrades wait for
 * the next renewal so nobody loses groups they've already paid for.
 */
export async function buyPlan(
  option: PlanOption,
  current: { basePlanId: string | null; groupLimit: number }
): Promise<PurchaseOutcome> {
  await ensureConfigured();
  const info = await Purchases.getCustomerInfo();
  const active = info.entitlements.active[PLAN_ENTITLEMENT];

  const changeInfo =
    active && current.basePlanId && current.basePlanId !== option.basePlanId
      ? {
          // Play wants the subscription id ("chuma_plan"), not the base plan.
          oldProductIdentifier: active.productIdentifier.split(":")[0],
          replacementMode:
            option.groupLimit > current.groupLimit
              ? STORE_REPLACEMENT_MODE.WITH_TIME_PRORATION
              : STORE_REPLACEMENT_MODE.DEFERRED,
        }
      : null;

  try {
    await Purchases.purchasePackage(option.pkg, null, changeInfo);
    return "purchased";
  } catch (e: any) {
    if (e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || e?.userCancelled)
      return "cancelled";
    throw new Error(e?.message || "The purchase didn't go through. Please try again.");
  }
}

/**
 * "about K79" under a USD price. Only an estimate: Google charges dollars and
 * the customer's bank converts at its own rate, so it's never shown alone.
 */
export function approxKwacha(option: PlanOption, rate: number | null): string | null {
  if (!rate || option.currencyCode !== "USD") return null;
  return `about K${Math.round(option.price * rate).toLocaleString("en-US")}`;
}

/**
 * The plan's price in kwacha at today's rate, e.g. "K61". The app shows this as
 * the headline price, always with the real USD charge right next to it -
 * Google bills dollars and the bank converts, so the kwacha figure is an
 * estimate. null when there's no rate (then show Play's own price).
 */
export function kwachaPrice(option: PlanOption, rate: number | null): string | null {
  if (!rate || option.currencyCode !== "USD") return null;
  return `K${Math.round(option.price * rate).toLocaleString("en-US")}`;
}

/** Re-attach a plan bought earlier on this Google account (new phone, reinstall). */
export async function restorePlan(): Promise<void> {
  await ensureConfigured();
  await Purchases.restorePurchases();
}

/** Google Play's own subscription page, to cancel or change the payment card. */
export async function getManageUrl(): Promise<string> {
  try {
    await ensureConfigured();
    const info = await Purchases.getCustomerInfo();
    if (info.managementURL) return info.managementURL;
  } catch {
    // Fall through to Play's generic page.
  }
  return "https://play.google.com/store/account/subscriptions?package=com.chuma.zm";
}
