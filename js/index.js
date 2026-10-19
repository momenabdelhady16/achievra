/**
 * Achievra — Phase 2 Public Barrel Exports
 *
 * Re-exports all Phase 2 constants, task model helpers, and pure utility functions.
 */

export {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  REPEATED_SENTENCE_THRESHOLD,
  MIN_REPEATED_SENTENCES_FOR_FLAG,
  CALENDAR_DATE_FORMAT,
  CALENDAR_DATE_PATTERN,
  TASK_MODEL_FIELDS,
  TEXT_VALIDATION_REASONS,
  DATE_VALIDATION_REASONS,
  DATE_RELATION,
  TASK_GROUPS,
  REPRESENTATIVE_DATE_STATUS,
} from './constants.js';

export {
  isValidCompletionTimestamp,
  validateTaskInput,
  createTaskDraft,
  createTaskModel,
} from './models/taskModel.js';

export {
  splitGraphemes,
  countCharacters,
  normalizeText,
  normalizeTitle,
  normalizeDescription,
  toComparableText,
  validateTitle,
  validateDescription,
} from './utils/textUtils.js';

export {
  isLeapYear,
  getDaysInMonth,
  validateCalendarDate,
  isValidCalendarDate,
  createCalendarDate,
  compareCalendarDates,
  getCalendarDayNumber,
  getCalendarDayDistance,
  getDueDateRelationToToday,
  findPastDueDates,
  validateAndDeduplicateDueDates,
} from './utils/dateUtils.js';

export {
  areTitlesEqual,
  areDescriptionsEqual,
  parseDescriptionSentenceSegments,
  findRepeatedDescriptionSentences,
} from './utils/duplicateUtils.js';

export {
  compareNormalizedTitles,
  resolvePendingTaskRepresentativeDate,
  comparePendingTasks,
  sortPendingTasks,
  toComparableCompletionTime,
  compareCompletedTasks,
  sortCompletedTasks,
  partitionTasksByCompletion,
  sortTasksByExplicitGroup,
} from './utils/sortUtils.js';
