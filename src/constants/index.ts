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
 * — that is the app being paid, not members paying each other.
 *
 * The API enforces this independently (MOBILE_MONEY_HOLD there); this flag is
 * what the screens read to lock the choice and say why. Lift both together.
 */
export const MOBILE_MONEY_ON_HOLD = true;

/** One line, used wherever a payment screen has to explain the lock. */
export const MOBILE_MONEY_HOLD_NOTE =
  "Mobile money is paused for now. Payments are cash, confirmed by an admin.";
