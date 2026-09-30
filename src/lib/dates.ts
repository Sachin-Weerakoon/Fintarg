import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/** Month key used for grouping and for the personal spending plan: "2026-09". */
export type MonthKey = string;

export function toMonthKey(date: Date): MonthKey {
  return format(date, "yyyy-MM");
}

export function monthKeyFromString(key: MonthKey): Date {
  const parsed = parseISO(`${key}-01`);
  return isValid(parsed) ? parsed : new Date();
}

export function addMonthKey(key: MonthKey, delta: number): MonthKey {
  return toMonthKey(addMonths(monthKeyFromString(key), delta));
}

export function monthRange(key: MonthKey): { start: Date; end: Date } {
  const base = monthKeyFromString(key);
  return { start: startOfMonth(base), end: endOfMonth(base) };
}

export function daysInMonth(key: MonthKey): number {
  return endOfMonth(monthKeyFromString(key)).getDate();
}

export function currentMonthKey(): MonthKey {
  return toMonthKey(new Date());
}

export function isCurrentMonth(date: Date, key: MonthKey = currentMonthKey()): boolean {
  return isSameMonth(date, monthKeyFromString(key));
}

/** `yyyy-MM-dd` in local time, for `<input type="date">` values. */
export function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function fromDateInputValue(value: string): Date | null {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

/** `yyyy-MM-dd` for today - the default value of every date field. */
export function todayInput(): string {
  return toDateInputValue(new Date());
}

export function formatDate(date: Date, pattern = "d MMM yyyy"): string {
  return isValid(date) ? format(date, pattern) : "-";
}

export function formatMonthLabel(key: MonthKey): string {
  return format(monthKeyFromString(key), "MMMM yyyy");
}

export function formatMonthShort(key: MonthKey): string {
  return format(monthKeyFromString(key), "MMM yyyy");
}

export function weekRange(date: Date): { start: Date; end: Date } {
  return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
}

export function daysBetween(from: Date, to: Date): number {
  return differenceInCalendarDays(to, from);
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  return differenceInCalendarDays(startOfDay(date), startOfDay(from));
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Human relative day, used by reminder chips: "today", "in 3 days", "5 days ago". */
export function relativeDayLabel(date: Date, from: Date = new Date()): string {
  const diff = daysUntil(date, from);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

export {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
};
