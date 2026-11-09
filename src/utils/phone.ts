import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  nationalLengthBounds,
  type Country,
} from "@/src/constants/countries";

/**
 * Phone parsing for our country-picker phone fields. A field holds a Country
 * (flag + dial code, Zambia by default) and the national digits after it.
 *
 * Pasting a full number does the right thing:
 *   "+260976484233" / "0976484233" / "+260 0976484233"  -> 🇿🇲 976484233
 *   "+254712345678" / "00254712345678"                  -> 🇰🇪 712345678
 */

export interface PhoneValue {
  country: Country;
  /** National digits, no trunk 0 - e.g. "976484233". */
  national: string;
}

/** An empty field - Zambia selected, no number. */
export const EMPTY_PHONE: PhoneValue = { country: DEFAULT_COUNTRY, national: "" };

/** Room for a full pasted international number with spaces, so the OS
 *  doesn't truncate the paste before onChangeText sees it. */
export const PHONE_INPUT_MAX_LENGTH = 20;

// Longest dial code first, so "+260" (Zambia) wins over "+20" (Egypt).
const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

function matchDialCode(digits: string): PhoneValue | null {
  for (const c of BY_DIAL_LENGTH) {
    const code = c.dial.slice(1);
    if (digits.startsWith(code)) return { country: c, national: digits.slice(code.length) };
  }
  return null;
}

/** Drop the trunk 0 (and, for Zambia, a "260" typed without "+"), cap the length. */
function cleanNational(country: Country, digits: string): string {
  let d = digits.replace(/^0+/, "");
  if (country.code === "ZM" && d.startsWith("260")) d = d.slice(3).replace(/^0+/, "");
  return d.slice(0, nationalLengthBounds(country).max);
}

/** International digits if `raw` carries an explicit country code ("+…" or "00…"), else null. */
function internationalDigits(raw: string): string | null {
  const s = raw.trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return null;
}

/**
 * Keystroke/paste handler. A pasted number with a known country code switches
 * the flag to that country; anything else is read as a national number for the
 * currently selected country. (Zambian mobiles start with 7/9, so stripping a
 * leading 0 or 260 while typing never eats part of a real number.)
 */
export function parsePhoneInput(text: string, country: Country): PhoneValue {
  const intl = internationalDigits(String(text ?? ""));
  if (intl) {
    const m = matchDialCode(intl);
    if (m) return { country: m.country, national: cleanNational(m.country, m.national) };
  }
  return { country, national: cleanNational(country, String(text ?? "").replace(/\D/g, "")) };
}

/**
 * A number as stored in the phone's contacts. "+…"/"00…" numbers take their
 * own country; local numbers ("0976…") are read in the field's current
 * country. Returns null for a country code we don't offer.
 */
export function parseContactNumber(raw: string, country: Country): PhoneValue | null {
  const intl = internationalDigits(String(raw ?? ""));
  if (intl) {
    const m = matchDialCode(intl);
    return m ? { country: m.country, national: cleanNational(m.country, m.national) } : null;
  }
  return parsePhoneInput(raw, country);
}

export function isValidPhone({ country, national }: PhoneValue): boolean {
  const { min, max } = nationalLengthBounds(country);
  return /^\d+$/.test(national) && national.length >= min && national.length <= max;
}

/** Message for a number of the wrong length, worded for the selected country. */
export function phoneLengthError({ country }: PhoneValue): string {
  const { min, max } = nationalLengthBounds(country);
  return min === max
    ? `Enter the ${min}-digit number after ${country.dial}`
    : `Enter a valid ${country.name} number after ${country.dial}`;
}

/** E.164, e.g. "+260976484233" - what the API stores. */
export function toE164({ country, national }: PhoneValue): string {
  return country.dial + national;
}
