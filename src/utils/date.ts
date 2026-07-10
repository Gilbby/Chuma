/**
 * Date formatting for display. The API returns ISO strings and services keep
 * them that way (Hermes date math needs ISO) — format only at the render edge.
 */

/** "5 Oct 2026". Returns "" for a missing or unparseable value. */
export function formatDate(iso?: string | Date | null): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
