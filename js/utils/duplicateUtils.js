/**
 * Achievra — Phase 2 Pure Duplicate-Comparison Utilities
 *
 * Rules:
 * - Compare normalized titles and descriptions case-insensitively.
 * - Compare repeated description fragments verbatim after whitespace normalization.
 * - Do NOT implement duplicate workflows, show prompts, merge tasks, or decide persistence.
 * - Identify repeated description sentences according to:
 *   1. A sentence begins with a comma or period and ends with a comma or period.
 *      Punctuation at those boundaries marks the sentence boundary and is not guaranteed
 *      to be included in the sentence text.
 *   2. Treat a sentence/segment as repeated when more than two (> 2, i.e. >= 3)
 *      sentences/segments are textually repeated across the two descriptions.
 *   3. Normalize whitespace and compare fragment text verbatim.
 *   4. Return the repeated segments/counts in a structured form.
 */

import {
  REPEATED_SENTENCE_THRESHOLD,
  MIN_REPEATED_SENTENCES_FOR_FLAG,
} from '../constants.js';
import { normalizeText, toComparableText } from './textUtils.js';

/**
 * Compares two task titles case-insensitively after whitespace normalization.
 *
 * @param {string} titleA
 * @param {string} titleB
 * @returns {boolean}
 */
export function areTitlesEqual(titleA, titleB) {
  if (typeof titleA !== 'string' || typeof titleB !== 'string') {
    throw new TypeError('areTitlesEqual expects two string arguments.');
  }
  return toComparableText(titleA) === toComparableText(titleB);
}

/**
 * Compares two task descriptions case-insensitively after whitespace normalization.
 *
 * @param {string} descriptionA
 * @param {string} descriptionB
 * @returns {boolean}
 */
export function areDescriptionsEqual(descriptionA, descriptionB) {
  if (typeof descriptionA !== 'string' || typeof descriptionB !== 'string') {
    throw new TypeError('areDescriptionsEqual expects two string arguments.');
  }
  return toComparableText(descriptionA) === toComparableText(descriptionB);
}

/**
 * Isolated helper for parsing description text into normalized sentence segments.
 *
 * Documented Interpretation of the Sentence Punctuation Rule:
 *   The specification states:
 *     "A sentence begins with a comma or period and ends with a comma or period.
 *      Punctuation at those boundaries marks the sentence boundary and is not
 *      guaranteed to be included in the sentence text."
 *
 *   Interpretation Details:
 *   1. Boundary Delimiters: Commas (`,`) and periods (`.`) serve as sentence/segment
 *      boundary delimiters, and boundary punctuation is stripped from the resulting
 *      segment text.
 *   2. Commas and periods delimit fragments; punctuation is excluded. The beginning and
 *      end of the description bound its first and last fragments.
 *   3. Empty segments (such as consecutive `..` or `, ,`) are discarded after whitespace
 *      normalization.
 *
 * @param {string} description
 * @returns {ReadonlyArray<Readonly<{
 *   index: number,
 *   displaySegment: string,
 *   comparableSegment: string
 * }>>}
 */
export function parseDescriptionSentenceSegments(description) {
  if (typeof description !== 'string') {
    throw new TypeError('parseDescriptionSentenceSegments expects a string description.');
  }

  const rawCandidates = description.split(/[,.]+/u);

  const segments = [];
  for (const raw of rawCandidates) {
    const displaySegment = normalizeText(raw);
    if (displaySegment.length > 0) {
      segments.push(
        Object.freeze({
          index: segments.length,
          displaySegment,
          // Repeated fragments use verbatim comparison after whitespace normalization.
          comparableSegment: displaySegment,
        })
      );
    }
  }

  return Object.freeze(segments);
}

/**
 * Identifies repeated description sentences/segments across two descriptions.
 *
 * Rule:
 * - Normalizes whitespace and compares repeated fragments verbatim.
 * - Treats sentences/segments as repeated when MORE THAN TWO (> 2, i.e., >= 3)
 *   sentences/segments are textually repeated across the two descriptions.
 * - Returns both distinct shared segment counts and total matched pair counts
 *   in a structured, immutable result.
 *
 * @param {string} descriptionA
 * @param {string} descriptionB
 * @returns {Readonly<{
 *   exceedsRepeatedThreshold: boolean,
 *   threshold: number,
 *   minRepeatedForFlag: number,
 *   repeatedSegmentCount: number,
 *   totalMatchedPairCount: number,
 *   repeatedSegments: ReadonlyArray<Readonly<{
 *     comparableSegment: string,
 *     displaySegment: string,
 *     countInFirst: number,
 *     countInSecond: number,
 *     matchedCount: number,
 *     totalCountAcrossBoth: number
 *   }>>,
 *   segmentsInFirst: ReadonlyArray<Readonly<{ index: number, displaySegment: string, comparableSegment: string }>>,
 *   segmentsInSecond: ReadonlyArray<Readonly<{ index: number, displaySegment: string, comparableSegment: string }>>
 * }>}
 */
export function findRepeatedDescriptionSentences(descriptionA, descriptionB) {
  if (typeof descriptionA !== 'string' || typeof descriptionB !== 'string') {
    throw new TypeError('findRepeatedDescriptionSentences expects two string descriptions.');
  }

  const segmentsInFirst = parseDescriptionSentenceSegments(descriptionA);
  const segmentsInSecond = parseDescriptionSentenceSegments(descriptionB);

  const mapFirst = new Map();
  for (const seg of segmentsInFirst) {
    const existing = mapFirst.get(seg.comparableSegment);
    if (existing) {
      existing.count += 1;
    } else {
      mapFirst.set(seg.comparableSegment, {
        displaySegment: seg.displaySegment,
        count: 1,
      });
    }
  }

  const mapSecond = new Map();
  for (const seg of segmentsInSecond) {
    const existing = mapSecond.get(seg.comparableSegment);
    if (existing) {
      existing.count += 1;
    } else {
      mapSecond.set(seg.comparableSegment, {
        displaySegment: seg.displaySegment,
        count: 1,
      });
    }
  }

  const repeatedSegments = [];
  let totalMatchedPairCount = 0;

  for (const [comparableSegment, infoFirst] of mapFirst.entries()) {
    const infoSecond = mapSecond.get(comparableSegment);
    if (infoSecond) {
      const matchedCount = Math.min(infoFirst.count, infoSecond.count);
      totalMatchedPairCount += matchedCount;
      repeatedSegments.push(
        Object.freeze({
          comparableSegment,
          displaySegment: infoFirst.displaySegment,
          countInFirst: infoFirst.count,
          countInSecond: infoSecond.count,
          matchedCount,
          totalCountAcrossBoth: infoFirst.count + infoSecond.count,
        })
      );
    }
  }

  const repeatedSegmentCount = repeatedSegments.length;
  const exceedsRepeatedThreshold = totalMatchedPairCount > REPEATED_SENTENCE_THRESHOLD;

  return Object.freeze({
    exceedsRepeatedThreshold,
    threshold: REPEATED_SENTENCE_THRESHOLD,
    minRepeatedForFlag: MIN_REPEATED_SENTENCES_FOR_FLAG,
    repeatedSegmentCount,
    totalMatchedPairCount,
    repeatedSegments: Object.freeze(repeatedSegments),
    segmentsInFirst,
    segmentsInSecond,
  });
}
