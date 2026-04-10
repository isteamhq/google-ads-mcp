/* ------------------------------------------------------------------ */
/*  Micros helpers (Google Ads uses 1 USD = 1,000,000 micros)          */
/* ------------------------------------------------------------------ */

export function toMicros(dollars: number): number {
  return Math.round(dollars * 1_000_000);
}

export function fromMicros(micros: number | Long | null | undefined): number {
  if (micros == null) return 0;
  const n = typeof micros === "number" ? micros : Number(micros);
  return n / 1_000_000;
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

export function formatCurrency(micros: number | Long | null | undefined): string {
  return `$${fromMicros(micros).toFixed(2)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "0.00%";
  return `${(value * 100).toFixed(2)}%`;
}

export function formatNumber(value: number | Long | null | undefined): string {
  if (value == null) return "0";
  return Number(value).toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/*  Safe value extraction                                              */
/* ------------------------------------------------------------------ */

type Long = { low: number; high: number; unsigned: boolean };

export function toNumber(value: number | Long | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export function toStr(value: string | null | undefined): string {
  return value ?? "";
}

/* ------------------------------------------------------------------ */
/*  Result formatting                                                  */
/* ------------------------------------------------------------------ */

export function jsonResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function successResult(message: string): string {
  return JSON.stringify({ success: true, message });
}

export function errorResult(error: unknown): string {
  if (error instanceof Error) {
    const gadsError = error as Error & { errors?: Array<{ message?: string; error_code?: unknown }> };
    if (gadsError.errors?.length) {
      const details = gadsError.errors.map((e) => e.message ?? JSON.stringify(e.error_code)).join("; ");
      return JSON.stringify({ success: false, error: details });
    }
    return JSON.stringify({ success: false, error: error.message });
  }
  try {
    return JSON.stringify({ success: false, error: JSON.stringify(error) });
  } catch {
    return JSON.stringify({ success: false, error: String(error) });
  }
}
