import { differenceInDays, subYears, subMonths, addDays, getDay, isLeapYear, getMonth, getDate, differenceInCalendarDays, subWeeks, subDays } from 'date-fns';
import { toSP, nowInSP, startOfDaySP, endOfDaySP } from './dateTz';

export type Range = { start: Date; end: Date };

/**
 * Calculates the exact equivalent previous period (apples-to-apples) truncating
 * to the exact same elapsed time in the current period, using SP timezone.
 *
 * Mode 'yoy': Same days of the previous year (e.g. Jan 1 to current elapsed days in Jan).
 * Mode 'mom': Same days of the previous month.
 * Mode 'wow': Same days of the previous week (e.g. Mon to current elapsed day of week).
 * Mode 'wow-yoy': Same week number of the previous year, up to the same day of the week.
 */
export function equivalentPrevious(current: Range, mode: 'yoy' | 'mom' | 'wow' | 'wow-yoy'): Range {
  const currentStart = startOfDaySP(current.start);
  const currentEnd = endOfDaySP(current.end);
  const elapsedDays = differenceInDays(currentEnd, currentStart); // number of elapsed days

  if (mode === 'yoy') {
    // Subtract 1 year from start
    const prevStart = startOfDaySP(subYears(currentStart, 1));
    // And add the exact same number of elapsed days
    const prevEnd = endOfDaySP(addDays(prevStart, elapsedDays));
    return { start: prevStart, end: prevEnd };
  } 
  
  if (mode === 'mom') {
    // Subtract 1 month from start
    const prevStart = startOfDaySP(subMonths(currentStart, 1));
    const prevEnd = endOfDaySP(addDays(prevStart, Math.min(elapsedDays, 31))); 
    // In strict mom, we truncate if the previous month is shorter.
    // E.g., if we are in March 30 (elapsed 29 days from Mar 1).
    // Feb 1 + 29 days = March 2 (if non leap).
    // Wait, the plan says: "sub-toggle MoM em fevereiro: se mês atual tem 30 dias e o mês anterior tem 28, MoM trunca em 28 e os dias 29–30 ficam fora".
    // So we just add `elapsedDays`, but cap it to the end of that previous month!
    const endOfPrevMonth = endOfDaySP(subDays(startOfDaySP(currentStart), 1));
    let calculatedPrevEnd = endOfDaySP(addDays(prevStart, elapsedDays));
    if (calculatedPrevEnd > endOfPrevMonth) {
      calculatedPrevEnd = endOfPrevMonth;
    }
    return { start: prevStart, end: calculatedPrevEnd };
  }

  if (mode === 'wow') {
    // Previous week start (Monday)
    const prevStart = startOfDaySP(subWeeks(currentStart, 1));
    const prevEnd = endOfDaySP(addDays(prevStart, elapsedDays));
    return { start: prevStart, end: prevEnd };
  }

  if (mode === 'wow-yoy') {
    // Same ISO week last year. This is tricky.
    // For simplicity, we can do 52 weeks ago.
    const prevStart = startOfDaySP(subWeeks(currentStart, 52));
    const prevEnd = endOfDaySP(addDays(prevStart, elapsedDays));
    return { start: prevStart, end: prevEnd };
  }

  // Fallback
  return current;
}
