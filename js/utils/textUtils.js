/**
 * Achievra — Phase 2 Pure Text Normalization, Grapheme Counting, and Validation Utilities
 *
 * Rules:
 * - Trim leading and trailing whitespace.
 * - Collapse every run of internal whitespace to a single ordinary space (' ').
 * - Preserve punctuation and original display casing during normalization.
 * - Perform case-insensitive comparisons only after normalization.
 * - Count user-perceived characters (grapheme clusters), including joined emoji sequences.
 * - Never silently truncate text; report when normalized text exceeds its limit.
 */

import {
  TITLE_MIN_LENGTH,
  TITLE_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TEXT_VALIDATION_REASONS,
} from '../constants.js';

const GRAPHEME_SEGMENTER =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('en', { granularity: 'grapheme' })
    : null;

/**
 * Splits a string into an array of user-perceived characters (grapheme clusters).
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitGraphemes(text) {
  if (typeof text !== 'string') {
    throw new TypeError('splitGraphemes expects a string argument.');
  }
  if (text.length === 0) {
    return [];
  }
  if (GRAPHEME_SEGMENTER !== null) {
    return Array.from(GRAPHEME_SEGMENTER.segment(text), (entry) => entry.segment);
  }
  throw new Error('Accurate grapheme counting requires Intl.Segmenter in this browser.');
}

/**
 * Counts user-perceived characters (grapheme clusters) in a string.
 * Joined emoji sequences (such as ZWJ sequences and skin-tone modifiers)
 * count as 1 character.
 *
 * @param {string} text
 * @returns {number}
 */
export function countCharacters(text) {
  return splitGraphemes(text).length;
}

/**
 * Normalizes a text string by trimming leading/trailing whitespace and
 * collapsing every internal run of whitespace characters to one space (' ').
 * Does not alter case, add/remove punctuation, or truncate.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('normalizeText expects a string argument.');
  }
  return text.trim().replace(/\s+/gu, ' ');
}

/**
 * Normalizes a task title for display and storage.
 *
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  return normalizeText(title);
}

/**
 * Normalizes a task description for display and storage.
 *
 * @param {string} description
 * @returns {string}
 */
export function normalizeDescription(description) {
  return normalizeText(description);
}

/**
 * Produces a canonical case-insensitive comparable representation of text
 * by normalizing whitespace first and converting to lowercase.
 *
 * @param {string} text
 * @returns {string}
 */
export function toComparableText(text) {
  return normalizeText(text).toLowerCase();
}

/**
 * Validates a task title without truncating it.
 * After normalization, a valid title must contain 1–32 counted grapheme characters.
 * A blank title is invalid.
 *
 * @param {unknown} rawTitle
 * @returns {Readonly<{
 *   valid: boolean,
 *   reason: string | null,
 *   normalizedValue: string | null,
 *   characterCount: number,
 *   minLength: number,
 *   maxLength: number
 * }>}
 */
export function validateTitle(rawTitle) {
  if (typeof rawTitle !== 'string') {
    return Object.freeze({
      valid: false,
      reason: TEXT_VALIDATION_REASONS.INVALID_TYPE,
      normalizedValue: null,
      characterCount: 0,
      minLength: TITLE_MIN_LENGTH,
      maxLength: TITLE_MAX_LENGTH,
    });
  }

  const normalizedValue = normalizeTitle(rawTitle);
  const characterCount = countCharacters(normalizedValue);

  if (characterCount < TITLE_MIN_LENGTH) {
    return Object.freeze({
      valid: false,
      reason: TEXT_VALIDATION_REASONS.BLANK_TITLE,
      normalizedValue,
      characterCount,
      minLength: TITLE_MIN_LENGTH,
      maxLength: TITLE_MAX_LENGTH,
    });
  }

  if (characterCount > TITLE_MAX_LENGTH) {
    return Object.freeze({
      valid: false,
      reason: TEXT_VALIDATION_REASONS.TOO_LONG,
      normalizedValue,
      characterCount,
      minLength: TITLE_MIN_LENGTH,
      maxLength: TITLE_MAX_LENGTH,
    });
  }

  return Object.freeze({
    valid: true,
    reason: null,
    normalizedValue,
    characterCount,
    minLength: TITLE_MIN_LENGTH,
    maxLength: TITLE_MAX_LENGTH,
  });
}

/**
 * Validates a task description without truncating it.
 * After normalization, a valid description may be empty (0 characters)
 * up to 256 counted grapheme characters.
 *
 * @param {unknown} rawDescription
 * @returns {Readonly<{
 *   valid: boolean,
 *   reason: string | null,
 *   normalizedValue: string | null,
 *   characterCount: number,
 *   minLength: number,
 *   maxLength: number
 * }>}
 */
export function validateDescription(rawDescription) {
  if (typeof rawDescription !== 'string') {
    return Object.freeze({
      valid: false,
      reason: TEXT_VALIDATION_REASONS.INVALID_TYPE,
      normalizedValue: null,
      characterCount: 0,
      minLength: DESCRIPTION_MIN_LENGTH,
      maxLength: DESCRIPTION_MAX_LENGTH,
    });
  }

  const normalizedValue = normalizeDescription(rawDescription);
  const characterCount = countCharacters(normalizedValue);

  if (characterCount > DESCRIPTION_MAX_LENGTH) {
    return Object.freeze({
      valid: false,
      reason: TEXT_VALIDATION_REASONS.TOO_LONG,
      normalizedValue,
      characterCount,
      minLength: DESCRIPTION_MIN_LENGTH,
      maxLength: DESCRIPTION_MAX_LENGTH,
    });
  }

  return Object.freeze({
    valid: true,
    reason: null,
    normalizedValue,
    characterCount,
    minLength: DESCRIPTION_MIN_LENGTH,
    maxLength: DESCRIPTION_MAX_LENGTH,
  });
}
