/**
 * Achievra — Phase 2 Task Model & Validation
 *
 * Task Model Properties:
 * - id: string | null — generated internally by the repository for persisted records;
 *   users cannot set or edit it. Unsaved task drafts carry `id: null`.
 * - title: string — required; 1–32 counted grapheme characters after normalization.
 * - description: string — optional (empty string allowed); 0–256 counted grapheme
 *   characters after normalization.
 * - dueDates: ReadonlyArray<string> — array of unique calendar dates in YYYY-MM-DD format.
 * - completed: boolean — whether the task is completed.
 * - completedAt: string | null — UTC ISO-8601 completion instant, or null when pending
 *   to order completed tasks by completion time (earliest first).
 *
 * Design rationale for `completedAt`:
 *   Only a single nullable field (`completedAt`) is added to support completion-time
 *   ordering of completed tasks. While `completed` is `false`, `completedAt` is `null`.
 *   When a task is marked completed, `completedAt` stores an ISO-8601 UTC timestamp
 *   string. Migrated legacy completed records may retain `null` because their original
 *   completion time is unknown. Unlike `dueDates` (which are strictly calendar dates without
 *   time), two tasks completed on the same calendar day require timestamp resolution
 *   to be ordered earliest-first. A single `completedAt` field is storage-agnostic
 *   across both JSON/localStorage and relational/document databases.
 */

import { TASK_MODEL_FIELDS } from '../constants.js';
import { validateTitle, validateDescription } from '../utils/textUtils.js';
import { validateCalendarDate, validateAndDeduplicateDueDates } from '../utils/dateUtils.js';

/**
 * Validates whether a completion timestamp is an ISO-8601 UTC date-time string.
 *
 * @param {unknown} completedAt
 * @returns {boolean}
 */
export function isValidCompletionTimestamp(completedAt) {
  if (typeof completedAt !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/u.exec(completedAt);
  if (!match || !validateCalendarDate(match[1]).valid) return false;
  const [, , hourText, minuteText, secondText] = match;
  if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return false;
  return Number.isFinite(Date.parse(completedAt));
}

/**
 * Validates user-supplied task input fields (`title`, `description`, `dueDates`).
 * Note: `id` is intentionally ignored/rejected from user edits because IDs are
 * generated exclusively by the repository.
 *
 * @param {Readonly<{
 *   title?: unknown,
 *   description?: unknown,
 *   dueDates?: unknown
 * }>} input
 * @returns {Readonly<{
 *   valid: boolean,
 *   titleResult: ReturnType<typeof validateTitle>,
 *   descriptionResult: ReturnType<typeof validateDescription>,
 *   dueDatesResult: ReturnType<typeof validateAndDeduplicateDueDates>,
 *   normalizedInput: Readonly<{
 *     title: string,
 *     description: string,
 *     dueDates: ReadonlyArray<string>
 *   }> | null
 * }>}
 */
export function validateTaskInput(input = {}) {
  if (input === null || typeof input !== 'object') {
    const titleResult = validateTitle(undefined);
    const descriptionResult = validateDescription(undefined);
    const dueDatesResult = validateAndDeduplicateDueDates([]);
    return Object.freeze({
      valid: false,
      titleResult,
      descriptionResult,
      dueDatesResult,
      normalizedInput: null,
    });
  }

  const titleResult = validateTitle(input.title);
  const descriptionResult = validateDescription(
    input.description === undefined ? '' : input.description
  );
  const dueDatesResult = validateAndDeduplicateDueDates(
    input.dueDates === undefined ? [] : input.dueDates
  );

  const valid = titleResult.valid && descriptionResult.valid && dueDatesResult.valid;

  const normalizedInput = valid
    ? Object.freeze({
        title: titleResult.normalizedValue,
        description: descriptionResult.normalizedValue,
        dueDates: dueDatesResult.uniqueDates,
      })
    : null;

  return Object.freeze({
    valid,
    titleResult,
    descriptionResult,
    dueDatesResult,
    normalizedInput,
  });
}

/**
 * Creates an immutable, unpersisted Task draft object from user input.
 * Does NOT generate an ID (`id` is always `null` until assigned by the repository).
 * Throws or returns structured validation errors if the input is invalid.
 *
 * @param {Readonly<{
 *   title: string,
 *   description?: string,
 *   dueDates?: readonly string[]
 * }>} input
 * @returns {Readonly<{
 *   valid: boolean,
 *   task: Readonly<{
 *     id: null,
 *     title: string,
 *     description: string,
 *     dueDates: ReadonlyArray<string>,
 *     completed: boolean,
 *     completedAt: null
 *   }> | null,
 *   validation: ReturnType<typeof validateTaskInput>
 * }>}
 */
export function createTaskDraft(input = {}) {
  const validation = validateTaskInput(input);
  if (!validation.valid) {
    return Object.freeze({
      valid: false,
      task: null,
      validation,
    });
  }

  const task = Object.freeze({
    id: null,
    title: validation.normalizedInput.title,
    description: validation.normalizedInput.description,
    dueDates: validation.normalizedInput.dueDates,
    completed: false,
    completedAt: null,
  });

  return Object.freeze({
    valid: true,
    task,
    validation,
  });
}

/**
 * Constructs an immutable Task model record from repository/service data,
 * enforcing all model invariants and restricted property set (`TASK_MODEL_FIELDS`).
 * Does NOT generate an ID; `id` must be `null` (unpersisted) or a non-empty string
 * supplied by the repository.
 *
 * @param {Readonly<{
 *   id?: string | null,
 *   title: string,
 *   description?: string,
 *   dueDates?: readonly string[],
 *   completed?: boolean,
 *   completedAt?: string | null
 * }>} record
 * @returns {Readonly<{
 *   id: string | null,
 *   title: string,
 *   description: string,
 *   dueDates: ReadonlyArray<string>,
 *   completed: boolean,
 *   completedAt: string | null
 * }>}
 */
export function createTaskModel(record = {}) {
  if (record === null || typeof record !== 'object') {
    throw new TypeError('createTaskModel expects a task record object.');
  }
  const unknownFields = Object.keys(record).filter((key) => !TASK_MODEL_FIELDS.includes(key));
  if (unknownFields.length > 0) {
    throw new TypeError(`Unknown task model field(s): ${unknownFields.join(', ')}.`);
  }

  const id = record.id === undefined ? null : record.id;
  if (id !== null && (typeof id !== 'string' || id.trim().length === 0)) {
    throw new TypeError('Task id must be null (before persistence) or a non-empty string assigned by the repository.');
  }

  const validation = validateTaskInput({
    title: record.title,
    description: record.description === undefined ? '' : record.description,
    dueDates: record.dueDates === undefined ? [] : record.dueDates,
  });

  if (!validation.valid) {
    const reasons = [
      !validation.titleResult.valid ? `title: ${validation.titleResult.reason}` : null,
      !validation.descriptionResult.valid ? `description: ${validation.descriptionResult.reason}` : null,
      !validation.dueDatesResult.valid ? `dueDates: ${validation.dueDatesResult.reason}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    throw new RangeError(`Invalid task model fields (${reasons}).`);
  }

  const completed = record.completed === undefined ? false : record.completed;
  if (typeof completed !== 'boolean') {
    throw new TypeError('Task completed must be a Boolean.');
  }
  let completedAt = null;

  if (completed) {
    if (record.completedAt !== undefined && record.completedAt !== null) {
      if (!isValidCompletionTimestamp(record.completedAt)) {
        throw new RangeError('completedAt must be a valid ISO-8601 UTC timestamp when provided for a completed task.');
      }
      completedAt = record.completedAt;
    }
  } else if (record.completedAt !== undefined && record.completedAt !== null) {
    throw new RangeError('completedAt must be null when completed is false.');
  }

  const task = {
    id,
    title: validation.normalizedInput.title,
    description: validation.normalizedInput.description,
    dueDates: validation.normalizedInput.dueDates,
    completed,
    completedAt,
  };

  return Object.freeze(task);
}
