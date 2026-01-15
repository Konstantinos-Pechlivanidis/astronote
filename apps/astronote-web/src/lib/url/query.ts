import type { ReadonlyURLSearchParams } from 'next/navigation';

export function getIntParam(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function setQueryParams(
  current: ReadonlyURLSearchParams,
  updates: Record<string, string | number | null | undefined>,
) {
  const next = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || v === '') next.delete(k);
    else next.set(k, String(v));
  }
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}


