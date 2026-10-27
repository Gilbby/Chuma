// Detects Zambian mobile money network from a phone number.
// Prefixes: MTN 076/096, Airtel 077/097, Zamtel 075/095.
export type MoMoNetwork = "MTN MoMo" | "Airtel Money" | "Zamtel Kwacha" | "Unknown";

/** Every network we take payments from, in the order they are offered, with
 *  its brand colour. */
export const MOMO_NETWORKS: { network: Exclude<MoMoNetwork, "Unknown">; color: string }[] = [
  { network: "MTN MoMo", color: "#FFCC00" },
  { network: "Airtel Money", color: "#ED1C24" },
  { network: "Zamtel Kwacha", color: "#009639" },
];

const colorOf = (network: MoMoNetwork) =>
  MOMO_NETWORKS.find((n) => n.network === network)?.color ?? "#9CA3AF";

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

  const network: MoMoNetwork =
    prefix === "76" || prefix === "96"
      ? "MTN MoMo"
      : prefix === "77" || prefix === "97"
        ? "Airtel Money"
        : prefix === "75" || prefix === "95"
          ? "Zamtel Kwacha"
          : "Unknown";
  return { network, color: colorOf(network) };
}
