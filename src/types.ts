/* ------------------------------------------------------------------ */
/*  Shared type helpers for Google Ads API responses                    */
/* ------------------------------------------------------------------ */

/** Generic row type for GAQL query results */
export type AdsRow = Record<string, Record<string, unknown> | unknown>;

/** Cast helper for query results */
export function asRows(results: unknown): AdsRow[] {
  return results as AdsRow[];
}

/** Safe field access */
export function field(row: AdsRow, path: string): Record<string, unknown> {
  return (row[path] as Record<string, unknown>) ?? {};
}
