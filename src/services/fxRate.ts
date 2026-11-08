// Live USD -> ZMW rate for the "about K…" estimate under Play's plan prices.
//
// Google Play bills Zambia in US dollars (it has no ZMW), so the app shows
// Play's real price and, next to it, a kwacha estimate at today's rate. The
// rate comes from ExchangeRate-API's free open endpoint (no key, updated
// daily; its terms ask for attribution, shown on the plan screen). Nothing
// about the user is sent - it's a plain GET for the USD rate table.
//
// Cached on the phone for 12 hours so the plan screen doesn't refetch on every
// visit. If the lookup fails and there's no cached rate, callers get null and
// show no estimate - never a made-up or stale-beyond-a-day number.

import { storage } from "@/src/utils/storage";

const URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "chuma.fx.usdZmw";
const FRESH_MS = 12 * 60 * 60 * 1000;
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // past this, a cached rate isn't shown

export interface FxRate {
  rate: number; // kwacha per 1 USD
  updatedAt: string; // ISO time the provider last updated it
  fetchedAt: number;
}

async function readCache(): Promise<FxRate | null> {
  try {
    const raw = await storage.getItem<string>(CACHE_KEY, "");
    return raw ? (JSON.parse(raw) as FxRate) : null;
  } catch {
    return null;
  }
}

export async function getUsdToZmw(): Promise<FxRate | null> {
  const cached = await readCache();
  if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(URL, { signal: ctrl.signal });
    clearTimeout(timer);
    const json = await res.json();
    const rate = Number(json?.rates?.ZMW);
    if (json?.result !== "success" || !(rate > 0)) throw new Error("no ZMW rate");
    const fresh: FxRate = {
      rate,
      updatedAt: json.time_last_update_unix
        ? new Date(json.time_last_update_unix * 1000).toISOString()
        : new Date().toISOString(),
      fetchedAt: Date.now(),
    };
    await storage.setItem(CACHE_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    // Offline or provider down: an older cached rate is still fine for a
    // labelled estimate, up to two days old.
    if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached;
    return null;
  }
}
