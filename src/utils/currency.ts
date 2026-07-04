export const CURRENCY_CODE = "ZMW";
export const CURRENCY_SYMBOL = "K";

export function formatZMW(n: number, opts?: { compact?: boolean }) {
  // Guard against undefined/null/NaN so a missing amount can never crash the
  // render tree — a currency formatter should degrade to zero, not throw.
  if (typeof n !== "number" || !Number.isFinite(n)) n = 0;
  if (opts?.compact && n >= 1000) {
    if (n >= 1000000) return `${CURRENCY_SYMBOL} ${(n / 1000000).toFixed(1)}M`;
    return `${CURRENCY_SYMBOL} ${(n / 1000).toFixed(1)}K`;
  }
  return `${CURRENCY_SYMBOL} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
