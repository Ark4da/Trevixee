const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDayParts(dayKey: string): { y: number; mo: number; d: number } | null {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  return { y, mo, d };
}

export function toLocalDayKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Day-key in the user's timezone, independent of the process's local TZ.
// offsetMinutes uses the JS Date#getTimezoneOffset() convention:
//   minutes WEST of UTC (e.g. EST = +300, MSK = -180).
export function toOffsetDayKey(
  value: Date | string,
  offsetMinutes: number
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  const shifted = new Date(d.getTime() - offset * 60_000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

export function parseDayKey(dayKey: string): Date | null {
  const parts = parseDayParts(dayKey);
  if (!parts) return null;
  const { y, mo, d } = parts;
  const date = new Date(y, mo - 1, d);
  return date;
}

export function startOfLocalDay(dayKey: string): Date | null {
  const d = parseDayKey(dayKey);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfLocalDay(dayKey: string): Date | null {
  const d = parseDayKey(dayKey);
  if (!d) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfOffsetDay(dayKey: string, offsetMinutes: number): Date | null {
  const parts = parseDayParts(dayKey);
  if (!parts) return null;
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  return new Date(Date.UTC(parts.y, parts.mo - 1, parts.d, 0, 0, 0, 0) + offset * 60_000);
}

export function endOfOffsetDay(dayKey: string, offsetMinutes: number): Date | null {
  const parts = parseDayParts(dayKey);
  if (!parts) return null;
  const offset = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  return new Date(Date.UTC(parts.y, parts.mo - 1, parts.d, 23, 59, 59, 999) + offset * 60_000);
}

export function startOfUtcDay(dayKey: string): Date | null {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

export function endOfUtcDay(dayKey: string): Date | null {
  const m = DAY_KEY_RE.exec(dayKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
}

export function toDateTimeLocalInputValue(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${toLocalDayKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function parseClientDateTime(
  value: unknown,
  clientTimezoneOffsetMinutes?: number
): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  // Explicit timezone in payload (ISO with Z or ±hh:mm) - trust native parser.
  const hasExplicitTimezone = /(?:Z|[+\-]\d{2}:\d{2})$/.test(raw);
  if (hasExplicitTimezone) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // datetime-local format without timezone (YYYY-MM-DDTHH:mm[:ss[.sss]])
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] ? Number(m[6]) : 0;
    const ms = m[7] ? Number(m[7].padEnd(3, "0")) : 0;
    const offset =
      typeof clientTimezoneOffsetMinutes === "number" &&
      Number.isFinite(clientTimezoneOffsetMinutes)
        ? clientTimezoneOffsetMinutes
        : undefined;

    if (offset !== undefined) {
      const utcTs =
        Date.UTC(y, mo - 1, d, hh, mm, ss, ms) +
        offset * 60_000;
      return new Date(utcTs);
    }
  }

  // Fallback to server-local parsing for legacy payloads.
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}
