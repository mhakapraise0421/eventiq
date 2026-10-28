// Zimbabwe is fixed at UTC+2 with no daylight saving, so civil dates use plain UTC arithmetic.

const HARARE = "Africa/Harare";
const DAY_MS = 24 * 60 * 60_000;

const monthFmt = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: HARARE,
});

export function harareDayKey(iso: string | Date) {
  return dayKeyFmt.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function todayKey() {
  return harareDayKey(new Date());
}

export function currentMonthKey() {
  return todayKey().slice(0, 7);
}

export function normalizeMonth(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return value;
}

export interface CalendarDay {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

export interface CalendarMonth {
  key: string;
  label: string;
  startISO: string;
  endISO: string;
  prevKey: string;
  nextKey: string;
  days: CalendarDay[];
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthMeta(monthKey: string): CalendarMonth {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const first = Date.UTC(year, month - 1, 1);
  const offset = (new Date(first).getUTCDay() + 6) % 7; // Monday-first grid
  const gridStart = first - offset * DAY_MS;
  const today = todayKey();

  const days: CalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart + index * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    days.push({
      key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year,
      isToday: key === today,
    });
  }

  const nextKey = shiftMonth(year, month, 1);

  return {
    key: monthKey,
    label: monthFmt.format(new Date(first)),
    startISO: `${monthKey}-01T00:00:00+02:00`,
    endISO: `${nextKey}-01T00:00:00+02:00`,
    prevKey: shiftMonth(year, month, -1),
    nextKey,
    days,
  };
}

export function itemSpansDay(startsAt: string, endsAt: string | null, dayKey: string) {
  const start = harareDayKey(startsAt);
  const end = harareDayKey(endsAt && endsAt > startsAt ? endsAt : startsAt);
  return start <= dayKey && dayKey <= end;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthFromParam(value: string | null | undefined) {
  return normalizeMonth(value) || currentMonthKey();
}
