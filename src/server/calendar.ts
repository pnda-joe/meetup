import type { CalendarResponse } from "../shared/types.js";
import { getMonthGrid, getRollingMonths, todayInTimezone } from "./dates.js";
import type { Db } from "./db.js";

type AvailabilityRow = {
  date: string;
  user_id: number;
  name: string;
};

export function buildCalendar(db: Db, currentUserId: number, timezone: string, now = new Date()): CalendarResponse {
  const participants = db
    .prepare("SELECT id, name, email FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE")
    .all() as { id: number; name: string; email: string }[];

  const months = getRollingMonths(timezone, now);
  const gridDates = months.flatMap((month) => getMonthGrid(month.year, month.month));
  const uniqueDates = Array.from(new Set(gridDates));
  const placeholders = uniqueDates.map(() => "?").join(",");
  const rows = placeholders
    ? (db
        .prepare(
          `SELECT availability.date, users.id AS user_id, users.name
           FROM availability
           JOIN users ON users.id = availability.user_id
           WHERE users.active = 1 AND availability.available = 1 AND availability.date IN (${placeholders})`
        )
        .all(...uniqueDates) as AvailabilityRow[])
    : [];

  const availabilityByDate = new Map<string, AvailabilityRow[]>();
  for (const row of rows) {
    const existing = availabilityByDate.get(row.date) ?? [];
    existing.push(row);
    availabilityByDate.set(row.date, existing);
  }

  const today = todayInTimezone(timezone, now);

  return {
    participants,
    months: months.map((month) => ({
      ...month,
      days: getMonthGrid(month.year, month.month).map((date) => {
        const available = availabilityByDate.get(date) ?? [];
        const availableUserIds = available.map((entry) => entry.user_id);

        return {
          date,
          isToday: date === today,
          isCurrentMonth: Number(date.slice(0, 4)) === month.year && Number(date.slice(5, 7)) === month.month,
          availableUserIds,
          availableNames: available.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
          availableCount: available.length,
          participantCount: participants.length,
          allAvailable: participants.length > 0 && available.length === participants.length,
          currentUserAvailable: availableUserIds.includes(currentUserId)
        };
      })
    }))
  };
}
