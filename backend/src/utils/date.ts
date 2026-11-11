import { DateTime } from 'luxon';
import { env } from '../config/env.js';

export const BUSINESS_TIMEZONE = env.TIMEZONE || 'Asia/Kolkata';

export function nowInTimezone(): DateTime {
  return DateTime.now().setZone(BUSINESS_TIMEZONE);
}

export function parseDateStartInclusive(dateStr: string): Date {
  // Parses YYYY-MM-DD in business timezone and returns start of day UTC Date
  const dt = DateTime.fromISO(dateStr, { zone: BUSINESS_TIMEZONE });
  if (!dt.isValid) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return dt.startOf('day').toJSDate();
}

export function parseDateEndExclusive(dateStr: string): Date {
  // Returns next day start of day UTC Date (making end-exclusive filter exact)
  const dt = DateTime.fromISO(dateStr, { zone: BUSINESS_TIMEZONE });
  if (!dt.isValid) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return dt.plus({ days: 1 }).startOf('day').toJSDate();
}

export function formatInBusinessTz(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return DateTime.fromJSDate(date).setZone(BUSINESS_TIMEZONE).toFormat(format);
}

export function formatBusinessDate(date: Date): string {
  return DateTime.fromJSDate(date).setZone(BUSINESS_TIMEZONE).toFormat('yyyy-MM-dd');
}

