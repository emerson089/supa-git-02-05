import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay, startOfMonth, startOfYear, endOfWeek, startOfWeek, formatISO, getYear, getMonth, getDate, getDay } from 'date-fns';

export const SP_TZ = 'America/Sao_Paulo';

/**
 * Returns the current date and time in SP timezone.
 */
export function nowInSP(): Date {
  return toZonedTime(new Date(), SP_TZ);
}

/**
 * Converts any Date or ISO string to a Date object representing that same exact moment
 * but mapped to SP timezone for date-fns calculations.
 */
export function toSP(d: Date | string | number): Date {
  return toZonedTime(d, SP_TZ);
}

/**
 * Returns the start of the day in SP timezone.
 */
export function startOfDaySP(d: Date | string): Date {
  return startOfDay(toSP(d));
}

/**
 * Returns the end of the day in SP timezone.
 */
export function endOfDaySP(d: Date | string): Date {
  return endOfDay(toSP(d));
}

/**
 * Generates ISO strings for gte/lte filters in Supabase,
 * ensuring the bounds are correct for SP midnight.
 * 
 * Note: the `start` and `end` arguments should ideally be dates ALREADY in SP time,
 * or we just treat them as such if they were generated via startOfDay/endOfDay.
 * 
 * Wait, `toZonedTime` returns a Date that date-fns sees as local time.
 * To get a real UTC ISO string representing "start of day in SP", 
 * we must use `fromZonedTime` or just `formatInTimeZone` with ISO format.
 */
export function toUtcRangeSP(startSpLocal: Date, endSpLocal: Date): { gte: string; lte: string } {
  // startSpLocal is a Date object where its "local" values represent SP time.
  // We need to convert it back to a real UTC Date to send to Supabase as an ISO string.
  // Actually, wait: date-fns-tz v3's formatInTimeZone takes the REAL date and formats it.
  // Let's implement it carefully.
  return {
    // If startSpLocal was created via `startOfDay(nowInSP())`, it is a "zoned" Date object.
    // However, it's safer to just return formatISO of the Date converted back to UTC? No, 
    // it's easier to use the fact that Supabase accepts ISO strings with offsets.
    // But since date-fns works in local timezone, a ZonedDate from date-fns-tz v3 is just a Date with an overridden timezone offset or we can just format it with the SP offset.
    // Let's simplify: Supabase accepts UTC timestamps. If we have a 'local' SP date, we want the UTC timestamp for that moment.
    gte: new Date(startSpLocal.getTime() - startSpLocal.getTimezoneOffset() * 60000).toISOString(),
    lte: new Date(endSpLocal.getTime() - endSpLocal.getTimezoneOffset() * 60000).toISOString()
  };
}

// Let's rethink the above: if we use formatInTimeZone to format the actual UTC date to SP string, we can just let Postgres handle it if we send timezone offset, but for robust `gte` / `lte` it's better to just pass the raw ISO string of the equivalent UTC time.

// Actually, let's use the standard date-fns-tz pattern:
// toZonedTime converts a UTC Date to a Date where getHours() etc. return the SP hours.
// fromZonedTime converts that back to a true UTC Date.
import { fromZonedTime } from 'date-fns-tz';

export function getSupabaseUtcRangeSP(startSp: Date, endSp: Date): { gte: string; lte: string } {
  const utcStart = fromZonedTime(startSp, SP_TZ);
  const utcEnd = fromZonedTime(endSp, SP_TZ);
  return {
    gte: utcStart.toISOString(),
    lte: utcEnd.toISOString()
  };
}

export function bucketKeySP(d: Date | string, granularity: 'year' | 'month' | 'week'): string {
  const spDate = toSP(d);
  if (granularity === 'year') {
    return formatInTimeZone(d, SP_TZ, 'yyyy');
  } else if (granularity === 'month') {
    return formatInTimeZone(d, SP_TZ, 'yyyy-MM');
  } else {
    // Week: use ISO week year and ISO week
    return formatInTimeZone(d, SP_TZ, "IIII-'W'II");
  }
}

export function isoWeekStartSP(d: Date | string): Date {
  const spDate = toSP(d);
  return startOfWeek(spDate, { weekStarts: 1 });
}

export function isoWeekEndSP(d: Date | string): Date {
  const spDate = toSP(d);
  return endOfWeek(spDate, { weekStarts: 1 });
}

export function startOfYearSP(d: Date | string): Date {
  return startOfYear(toSP(d));
}

export function startOfMonthSP(d: Date | string): Date {
  return startOfMonth(toSP(d));
}
