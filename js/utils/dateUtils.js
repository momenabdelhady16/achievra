/**
 * Achievra — Phase 2 Pure Calendar Date Rules and Utilities
 *
 * Rules:
 * - Due dates are calendar dates in exact YYYY-MM-DD format with no time component.
 * - "Today" is determined by year, month, and day only; timezone differences
 *   in the time of day must never change which calendar date is considered "today."
 * - Do not use timestamps as due dates.
 * - Do not invent date formatting for display.
 */

import {
  CALENDAR_DATE_PATTERN,
  DATE_VALIDATION_REASONS,
  DATE_RELATION,
} from '../constants.js';

const DAYS_IN_MONTH_COMMON = Object.freeze([
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
]);

/**
 * Determines whether a proleptic Gregorian year is a leap year using pure integer math.
 *
 * @param {number} year
 * @returns {boolean}
 */
export function isLeapYear(year) {
  if (!Number.isInteger(year) || year < 1) {
    return false;
  }
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum number of days in a given (year, month) where month is 1–12.
 *
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0;
  }
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH_COMMON[month - 1];
}

/**
 * Validates that a value is a real calendar date in exact YYYY-MM-DD format
 * without using Date objects or timezone conversions.
 *
 * @param {unknown} value
 * @returns {Readonly<{
 *   valid: boolean,
 *   reason: string | null,
 *   value: string | null,
 *   parts: Readonly<{ year: number, month: number, day: number }> | null
 * }>}
 */
export function validateCalendarDate(value) {
  if (typeof value !== 'string') {
    return Object.freeze({
      valid: false,
      reason: DATE_VALIDATION_REASONS.INVALID_TYPE,
      value: null,
      parts: null,
    });
  }

  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return Object.freeze({
      valid: false,
      reason: DATE_VALIDATION_REASONS.INVALID_FORMAT,
      value,
      parts: null,
    });
  }

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const maxDays = getDaysInMonth(year, month);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > maxDays) {
    return Object.freeze({
      valid: false,
      reason: DATE_VALIDATION_REASONS.INVALID_CALENDAR_DATE,
      value,
      parts: null,
    });
  }

  return Object.freeze({
    valid: true,
    reason: null,
    value,
    parts: Object.freeze({ year, month, day }),
  });
}

/**
 * Boolean convenience check for whether a value is a valid YYYY-MM-DD calendar date.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCalendarDate(value) {
  return validateCalendarDate(value).valid;
}

/**
 * Builds a canonical YYYY-MM-DD calendar date string from year, month, and day integers
 * (e.g., to represent "today" from year, month, and day without timezone conversion).
 *
 * @param {number} year
 * @param {number} month - 1-based month (1–12)
 * @param {number} day - 1-based day of month (1–31)
 * @returns {string}
 */
export function createCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new RangeError('Year, month, and day must be integers.');
  }
  if (year < 1 || year > 9999) {
    throw new RangeError('Year must be between 1 and 9999.');
  }
  const maxDays = getDaysInMonth(year, month);
  if (maxDays === 0 || day < 1 || day > maxDays) {
    throw new RangeError(`Invalid calendar date parts: ${year}-${month}-${day}.`);
  }
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compares two valid YYYY-MM-DD calendar dates without relying on local timezone conversion.
 * Returns -1 if dateA is before dateB, 0 if equal, and 1 if dateA is after dateB.
 *
 * @param {string} dateA
 * @param {string} dateB
 * @returns {-1 | 0 | 1}
 */
export function compareCalendarDates(dateA, dateB) {
  const validationA = validateCalendarDate(dateA);
  if (!validationA.valid) {
    throw new RangeError(`Invalid first calendar date: ${String(dateA)} (${validationA.reason})`);
  }
  const validationB = validateCalendarDate(dateB);
  if (!validationB.valid) {
    throw new RangeError(`Invalid second calendar date: ${String(dateB)} (${validationB.reason})`);
  }

  if (dateA < dateB) {
    return -1;
  }
  if (dateA > dateB) {
    return 1;
  }
  return 0;
}

/**
 * Determines whether a valid due date is before, equal to, or after a supplied
 * "today" calendar date (YYYY-MM-DD).
 *
 * @param {string} dueDate
 * @param {string} todayDate
 * @returns {'before' | 'equal' | 'after'}
 */
export function getDueDateRelationToToday(dueDate, todayDate) {
  const cmp = compareCalendarDates(dueDate, todayDate);
  if (cmp < 0) {
    return DATE_RELATION.BEFORE;
  }
  if (cmp > 0) {
    return DATE_RELATION.AFTER;
  }
  return DATE_RELATION.EQUAL;
}

/**
 * Identifies all past due dates (strictly before todayDate) in a list of calendar dates.
 * Does not mutate the input array. Preserves encounter order of valid past dates.
 *
 * @param {readonly string[]} dueDates
 * @param {string} todayDate
 * @returns {string[]}
 */
export function findPastDueDates(dueDates, todayDate) {
  if (!Array.isArray(dueDates)) {
    throw new TypeError('findPastDueDates expects an array of due dates.');
  }
  const todayValidation = validateCalendarDate(todayDate);
  if (!todayValidation.valid) {
    throw new RangeError(`Invalid today calendar date: ${String(todayDate)} (${todayValidation.reason})`);
  }

  const pastDates = [];
  for (const dateValue of dueDates) {
    if (compareCalendarDates(dateValue, todayDate) < 0) {
      pastDates.push(dateValue);
    }
  }
  return pastDates;
}

/**
 * Returns a proleptic Gregorian ordinal for a valid YYYY-MM-DD date.
 * This is integer calendar arithmetic, not a timestamp or timezone conversion.
 * @param {string} value
 * @returns {number}
 */
export function getCalendarDayNumber(value) {
  const checked = validateCalendarDate(value);
  if (!checked.valid) {
    throw new RangeError(`Invalid calendar date: ${String(value)} (${checked.reason})`);
  }
  const { year, month, day } = checked.parts;
  const priorYear = year - 1;
  let ordinal = priorYear * 365 + Math.floor(priorYear / 4) - Math.floor(priorYear / 100) + Math.floor(priorYear / 400);
  for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
    ordinal += getDaysInMonth(year, currentMonth);
  }
  return ordinal + day - 1;
}

/**
 * Returns the absolute number of calendar days between two valid dates.
 * @param {string} dateA
 * @param {string} dateB
 * @returns {number}
 */
export function getCalendarDayDistance(dateA, dateB) {
  return Math.abs(getCalendarDayNumber(dateA) - getCalendarDayNumber(dateB));
}

/**
 * Validates calendar dates and returns them without duplicate values.
 *
 * @param {unknown} dueDates
 * @returns {Readonly<{
 *   valid: boolean,
 *   reason: string | null,
 *   uniqueDates: ReadonlyArray<string>,
 *   invalidEntries: ReadonlyArray<Readonly<{ index: number, value: unknown, reason: string }>>
 * }>}
 */
export function validateAndDeduplicateDueDates(dueDates) {
  if (!Array.isArray(dueDates)) {
    return Object.freeze({
      valid: false,
      reason: DATE_VALIDATION_REASONS.INVALID_TYPE,
      uniqueDates: Object.freeze([]),
      invalidEntries: Object.freeze([]),
    });
  }

  const seen = new Set();
  const uniqueDates = [];
  const invalidEntries = [];

  for (let i = 0; i < dueDates.length; i += 1) {
    const entry = dueDates[i];
    const check = validateCalendarDate(entry);
    if (!check.valid) {
      invalidEntries.push(
        Object.freeze({
          index: i,
          value: entry,
          reason: check.reason,
        })
      );
    } else if (!seen.has(entry)) {
      seen.add(entry);
      uniqueDates.push(entry);
    }
  }

  if (invalidEntries.length > 0) {
    return Object.freeze({
      valid: false,
      reason: invalidEntries[0].reason,
      uniqueDates: Object.freeze(uniqueDates),
      invalidEntries: Object.freeze(invalidEntries),
    });
  }

  return Object.freeze({
    valid: true,
    reason: null,
    uniqueDates: Object.freeze(uniqueDates),
    invalidEntries: Object.freeze([]),
  });
}
