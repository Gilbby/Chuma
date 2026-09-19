export const APP_NAME = "SavaGroup";
export const CURRENCY_CODE = "ZMW";
export const CURRENCY_SYMBOL = "K";
export const MAX_ADMINS = 5;
export const MIN_APPROVAL_THRESHOLD = 0.6;

/**
 * The mobile money hold.
 *
 * pawaPay disbursement is not live yet, so every flow that moves MEMBER money
 * runs on cash: savings, loan repayments, loan disbursement, penalties,
 * share-outs and exit refunds. An admin confirms the cash and the money is
 * credited then, not before.
 *
 * Group fees (creating a group, the monthly fee) still go through mobile money
 * - that is the app being paid, not members paying each other.
 *
 * The API enforces this independently (MOBILE_MONEY_HOLD there); this flag is
 * what the screens read to lock the choice and say why. Lift both together.
 */
export const MOBILE_MONEY_ON_HOLD = true;

/** One line, used wherever a payment screen has to explain the lock. */
export const MOBILE_MONEY_HOLD_NOTE =
  "Mobile money is paused for now. Payments are cash, confirmed by an admin.";

/**
 * Group fee master switch (client mirror of the API's GROUP_FEES_ENABLED).
 * OFF for the non-financial tracker build: group creation is free and instant,
 * no fee screen, and groups are never locked for an unpaid fee. Flip to true
 * (with the API flag) for the organization-account build to restore fees.
 */
export const GROUP_FEES_ENABLED = false;

/**
 * KYC master switch (client mirror of the API's KYC_ENABLED). OFF for the
 * non-financial tracker build: no identity verification anywhere - founding a
 * group needs no KYC and the verify screen is unreachable. Flip to true (with
 * the API flag) for the organization-account build to restore verification.
 */
export const KYC_ENABLED = false;

/**
 * Legal / support links surfaced in the app and required by the app stores
 * (privacy policy is mandatory; terms and a data-deletion page are expected for
 * a fintech app). Point these at the real hosted pages before submitting -
 * placeholders here are wired into the Profile screen and the store listing.
 */
export const LEGAL_URLS = {
  privacy: "https://chuma-api.onrender.com/privacy",
  terms: "https://chuma-api.onrender.com/terms",
  dataDeletion: "https://chuma-api.onrender.com/delete-account",
};

/** Monitored support inbox shown in Help and required in the store listings. */
export const SUPPORT_EMAIL = "contact@bristalite.com";
