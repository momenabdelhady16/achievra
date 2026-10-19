/**
 * Achievra — Phase 2 Constants
 *
 * Pure, immutable domain constants for the task model, text validation,
 * calendar date validation/comparison, duplicate sentence detection,
 * and task sorting.
 */

export const TITLE_MIN_LENGTH = 1;
export const TITLE_MAX_LENGTH = 32;

export const DESCRIPTION_MIN_LENGTH = 0;
export const DESCRIPTION_MAX_LENGTH = 256;

/**
 * A sentence/segment is treated as repeated when MORE THAN TWO (> 2)
 * sentences/segments are textually repeated across two descriptions
 * (i.e., at least 3 repeated sentences/segments).
 */
export const REPEATED_SENTENCE_THRESHOLD = 2;
export const MIN_REPEATED_SENTENCES_FOR_FLAG = 3;

/**
 * Exact calendar date format (YYYY-MM-DD) with no time component.
 */
export const CALENDAR_DATE_FORMAT = 'YYYY-MM-DD';
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Allowed property names on a Task model object in Phase 2.
 */
export const TASK_MODEL_FIELDS = Object.freeze([
  'id',
  'title',
  'description',
  'dueDates',
  'completed',
  'completedAt',
]);

/**
 * Structured validation failure reasons for title and description validation.
 */
export const TEXT_VALIDATION_REASONS = Object.freeze({
  INVALID_TYPE: 'INVALID_TYPE',
  BLANK_TITLE: 'BLANK_TITLE',
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
});

/**
 * Structured validation failure reasons for calendar date validation.
 */
export const DATE_VALIDATION_REASONS = Object.freeze({
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_CALENDAR_DATE: 'INVALID_CALENDAR_DATE',
  DUPLICATE_DATE: 'DUPLICATE_DATE',
});

/**
 * Relative ordering of a due date compared to a supplied "today" calendar date.
 */
export const DATE_RELATION = Object.freeze({
  BEFORE: 'before',
  EQUAL: 'equal',
  AFTER: 'after',
});

/**
 * Explicit task completion groups used by sorting utilities.
 */
export const TASK_GROUPS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
});

/**
 * Explicit representative-date resolution states for pending tasks.
 */
export const REPRESENTATIVE_DATE_STATUS = Object.freeze({
  UPCOMING_OR_TODAY: 'upcoming_or_today',
  NO_DUE_DATES: 'no_due_dates',
  PAST_ONLY_UNRESOLVED: 'past_only_unresolved',
  CALLER_RESOLVED_PAST_ONLY: 'caller_resolved_past_only',
  REPRESENTATIVE_DATE: 'representative_date',
  EQUIDISTANT_NEAREST_DATES: 'equidistant_nearest_dates',
});
