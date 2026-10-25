/**
 * Country dial codes for the phone-number entry screen.
 *
 * Zambia is the default and the only country the payment (pawaPay) and KYC
 * (Didit) stack supports today - see detectNetwork() in utils/currency/phone.
 * Other countries are offered so a member can sign up and be invited with an
 * international number; they just can't contribute or withdraw by mobile money
 * until that country is wired up on the backend.
 *
 * `flag` is an emoji. Samsung/iOS render these; some budget Android ROMs show
 * the two-letter code instead, which is why the dial code is always shown next
 * to it - the dial code, not the flag, is the part that matters.
 *
 * `min`/`max` are the national number length (digits after the dial code). When
 * unset, a generic 6-14 range is used - enough to stop obvious typos without
 * pretending to be a full libphonenumber validator.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, also the search/stable key. */
  code: string;
  name: string;
  /** E.164 dial code, with the leading "+". */
  dial: string;
  flag: string;
  /** National-number digit length bounds (after the dial code). */
  min?: number;
  max?: number;
}

export const COUNTRIES: Country[] = [
  { code: "ZM", name: "Zambia", dial: "+260", flag: "🇿🇲", min: 9, max: 9 },
  { code: "AO", name: "Angola", dial: "+244", flag: "🇦🇴" },
  { code: "BW", name: "Botswana", dial: "+267", flag: "🇧🇼" },
  { code: "BI", name: "Burundi", dial: "+257", flag: "🇧🇮" },
  { code: "CM", name: "Cameroon", dial: "+237", flag: "🇨🇲" },
  { code: "CD", name: "DR Congo", dial: "+243", flag: "🇨🇩" },
  { code: "CG", name: "Congo", dial: "+242", flag: "🇨🇬" },
  { code: "CI", name: "Côte d’Ivoire", dial: "+225", flag: "🇨🇮" },
  { code: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { code: "ET", name: "Ethiopia", dial: "+251", flag: "🇪🇹" },
  { code: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "LS", name: "Lesotho", dial: "+266", flag: "🇱🇸" },
  { code: "LR", name: "Liberia", dial: "+231", flag: "🇱🇷" },
  { code: "MW", name: "Malawi", dial: "+265", flag: "🇲🇼" },
  { code: "ML", name: "Mali", dial: "+223", flag: "🇲🇱" },
  { code: "MU", name: "Mauritius", dial: "+230", flag: "🇲🇺" },
  { code: "MZ", name: "Mozambique", dial: "+258", flag: "🇲🇿" },
  { code: "NA", name: "Namibia", dial: "+264", flag: "🇳🇦" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "RW", name: "Rwanda", dial: "+250", flag: "🇷🇼" },
  { code: "SN", name: "Senegal", dial: "+221", flag: "🇸🇳" },
  { code: "SL", name: "Sierra Leone", dial: "+232", flag: "🇸🇱" },
  { code: "SO", name: "Somalia", dial: "+252", flag: "🇸🇴" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "SS", name: "South Sudan", dial: "+211", flag: "🇸🇸" },
  { code: "SD", name: "Sudan", dial: "+249", flag: "🇸🇩" },
  { code: "SZ", name: "Eswatini", dial: "+268", flag: "🇸🇿" },
  { code: "TZ", name: "Tanzania", dial: "+255", flag: "🇹🇿" },
  { code: "TG", name: "Togo", dial: "+228", flag: "🇹🇬" },
  { code: "UG", name: "Uganda", dial: "+256", flag: "🇺🇬" },
  { code: "ZW", name: "Zimbabwe", dial: "+263", flag: "🇿🇼" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
];

/** Zambia - the default selection and the only fully-supported country today. */
export const DEFAULT_COUNTRY: Country =
  COUNTRIES.find((c) => c.code === "ZM") ?? COUNTRIES[0];

export function findCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** National-number length bounds for a country, with a generic fallback. */
export function nationalLengthBounds(c: Country): { min: number; max: number } {
  return { min: c.min ?? 6, max: c.max ?? 14 };
}
