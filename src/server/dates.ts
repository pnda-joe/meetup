import type { CalendarMonth } from "../shared/types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayInTimezone(timezone: string, now = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now);
}

export function addMonths(year: number, monthIndex: number, offset: number): { year: number; monthIndex: number } {
  const date = new Date(Date.UTC(year, monthIndex + offset, 1));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

export function getRollingMonths(timezone: string, now = new Date()): Omit<CalendarMonth, "days">[] {
  const today = todayInTimezone(timezone, now);
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;

  return [0, 1, 2].map((offset) => {
    const target = addMonths(year, monthIndex, offset);
    const label = new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(Date.UTC(target.year, target.monthIndex, 1)));

    return {
      label,
      year: target.year,
      month: target.monthIndex + 1
    };
  });
}

export function getMonthGrid(year: number, month: number): string[] {
  const monthIndex = month - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = first.getUTCDay();
  const start = new Date(first.getTime() - firstWeekday * DAY_MS);
  const dates: string[] = [];

  for (let index = 0; index < 42; index += 1) {
    dates.push(formatDate(new Date(start.getTime() + index * DAY_MS)));
  }

  return dates;
}
