// Detects Zambian mobile money network from a phone number.
// Prefixes: MTN 076/096, Airtel 077/097, Zamtel 075/095.
export type MoMoNetwork = "MTN MoMo" | "Airtel Money" | "Zamtel Kwacha" | "Unknown";

export function detectNetwork(phone: string): {
  network: MoMoNetwork;
  color: string;
} {
  const digits = phone.replace(/\D/g, "");
  // Normalise to 9-digit subscriber number, strip leading 260 or 0
  const core = digits.startsWith("260")
    ? digits.slice(3)
    : digits.replace(/^0/, "");
  const prefix = core.slice(0, 2);

  if (prefix === "76" || prefix === "96") return { network: "MTN MoMo", color: "#FFCC00" };
  if (prefix === "77" || prefix === "97") return { network: "Airtel Money", color: "#ED1C24" };
  if (prefix === "75" || prefix === "95") return { network: "Zamtel Kwacha", color: "#009639" };
  return { network: "Unknown", color: "#9CA3AF" };
}
