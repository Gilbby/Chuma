import { useEffect, useState } from "react";
import { api } from "@/src/services/apiClient";

// Server-computed fee breakdown for a payout (share-out or loan disbursement).
// The client NEVER computes these — it only displays what /pricing/preview
// returns. When fees would exceed the amount, the server responds { tooSmall }.
export type PayoutPreview =
  | {
      owed: number;
      platformFee: number;
      transactionFee: number;
      totalFees: number;
      netReceived: number;
      tooSmall?: false;
    }
  | { tooSmall: true; reason?: string };

export type ContributionPreview = {
  base: number;
  platformFee: number;
  depositAmount: number;
  feesCovered: number;
};

/**
 * Debounced POST /pricing/preview. Fires on amount changes (default 400ms
 * debounce) so we don't send a request per keystroke, and never throws into
 * render — failures surface as `error`, keeping the screen alive.
 */
export function usePricingPreview<T = PayoutPreview>(
  kind: "contribution" | "payout",
  amount: number,
  opts: { debounceMs?: number; enabled?: boolean } = {}
): { data: T | null; loading: boolean; error: string | null } {
  const { debounceMs = 400, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !(amount > 0)) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await api<T>("/pricing/preview", {
          method: "POST",
          body: { kind, amount },
        });
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Couldn't load fees. Please try again.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, amount, enabled, debounceMs]);

  return { data, loading, error };
}
