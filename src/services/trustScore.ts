// Trust score (0–100) reflects member reliability. Computed
// from contribution consistency, loan standing, and
// penalties. The current model uses available member data as
// a proxy; when the backend tracks full on-time history,
// feed it here — the score scale and bands stay the same.

import type { Member } from "@/src/types";

export function getTrustScore(
  member: Pick<Member, "contributions" | "loanActive">,
  penaltyCount: number = 0
): number {
  // Base score
  let score = 70;

  // Contribution consistency: more contributions = more
  // proven reliability (cap the bonus at +25)
  score += Math.min(member.contributions * 2, 25);

  // Having an active loan slightly lowers score (more risk
  // exposure) but not heavily
  if (member.loanActive && member.loanActive > 0) {
    score -= 5;
  }

  // Each penalty reduces the score
  score -= penaltyCount * 6;

  // Clamp 0–100
  return Math.max(0, Math.min(Math.round(score), 100));
}

export function getTrustBand(score: number): {
  label: string;
  band: "excellent" | "good" | "fair" | "low";
} {
  if (score >= 80) return { label: "Excellent", band: "excellent" };
  if (score >= 60) return { label: "Good", band: "good" };
  if (score >= 40) return { label: "Fair", band: "fair" };
  return { label: "Needs improvement", band: "low" };
}
