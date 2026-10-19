/** Pure task grouping and sorting helpers. */

import { REPRESENTATIVE_DATE_STATUS, TASK_GROUPS } from '../constants.js';
import { toComparableText } from './textUtils.js';
import {
  compareCalendarDates,
  getCalendarDayDistance,
  validateCalendarDate,
} from './dateUtils.js';
import { isValidCompletionTimestamp } from '../models/taskModel.js';

export function compareNormalizedTitles(titleA, titleB) {
  const a = toComparableText(titleA);
  const b = toComparableText(titleB);
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Finds the due date or dates with the minimum absolute calendar-day distance
 * from today. An exact distance tie across different dates remains explicit;
 * this helper does not invent which tied date represents the task.
 */
export function resolvePendingTaskRepresentativeDate(task, todayDate) {
  if (!task || typeof task !== 'object' || task.completed !== false) {
    throw new TypeError('Expected a pending task with completed === false.');
  }
  if (!validateCalendarDate(todayDate).valid) {
    throw new RangeError(`Invalid todayDate: ${String(todayDate)}`);
  }
  const dueDates = Array.isArray(task.dueDates) ? task.dueDates : [];
  if (dueDates.length === 0) {
    return Object.freeze({
      status: REPRESENTATIVE_DATE_STATUS.NO_DUE_DATES,
      representativeDate: null,
      representativeDates: Object.freeze([]),
      distanceInDays: null,
    });
  }

  const distances = dueDates.map((date) => {
    if (!validateCalendarDate(date).valid) throw new RangeError(`Invalid task date: ${String(date)}`);
    return { date, distance: getCalendarDayDistance(date, todayDate) };
  });
  const minimumDistance = Math.min(...distances.map(({ distance }) => distance));
  const nearestDates = distances
    .filter(({ distance }) => distance === minimumDistance)
    .map(({ date }) => date)
    .sort(compareCalendarDates);

  if (nearestDates.length > 1 && nearestDates[0] !== nearestDates.at(-1)) {
    return Object.freeze({
      status: REPRESENTATIVE_DATE_STATUS.EQUIDISTANT_NEAREST_DATES,
      representativeDate: null,
      representativeDates: Object.freeze(nearestDates),
      distanceInDays: minimumDistance,
    });
  }
  return Object.freeze({
    status: REPRESENTATIVE_DATE_STATUS.REPRESENTATIVE_DATE,
    representativeDate: nearestDates[0],
    representativeDates: Object.freeze(nearestDates),
    distanceInDays: minimumDistance,
  });
}

export function comparePendingTasks(taskA, taskB, todayDate) {
  if (taskA?.completed !== false || taskB?.completed !== false) {
    throw new TypeError('comparePendingTasks requires two pending tasks.');
  }
  const resolutionA = resolvePendingTaskRepresentativeDate(taskA, todayDate);
  const resolutionB = resolvePendingTaskRepresentativeDate(taskB, todayDate);
  const dateA = resolutionA.representativeDate;
  const dateB = resolutionB.representativeDate;
  const hasDatesA = resolutionA.status !== REPRESENTATIVE_DATE_STATUS.NO_DUE_DATES;
  const hasDatesB = resolutionB.status !== REPRESENTATIVE_DATE_STATUS.NO_DUE_DATES;

  if (!hasDatesA && hasDatesB) return 1;
  if (hasDatesA && !hasDatesB) return -1;

  // Tasks with no due dates remain at the end in their existing relative order.
  if (!hasDatesA && !hasDatesB) return 0;

  // Greater distance from today comes first. The specification defines an
  // alphabetical tie-break only when the representative dates are the same.
  if (resolutionA.distanceInDays !== resolutionB.distanceInDays) {
    return resolutionB.distanceInDays - resolutionA.distanceInDays;
  }
  if (dateA !== null && dateA === dateB) {
    return compareNormalizedTitles(taskA.title, taskB.title);
  }

  // Different dates can be equally far from today. No additional tie rule is
  // specified, so keep their input order (Array#sort is stable).
  return 0;
}

/** Returns a sorted, detached copy of all pending tasks. */
export function sortPendingTasks(pendingTasks, todayDate) {
  if (!Array.isArray(pendingTasks)) throw new TypeError('sortPendingTasks expects an array.');
  for (const task of pendingTasks) {
    if (task?.completed !== false) throw new TypeError('All tasks must be pending.');
    resolvePendingTaskRepresentativeDate(task, todayDate);
  }
  return Object.freeze(
    [...pendingTasks].sort((taskA, taskB) =>
      comparePendingTasks(taskA, taskB, todayDate)
    )
  );
}

export function toComparableCompletionTime(completedAt) {
  if (completedAt === null || completedAt === undefined) return null;
  if (!isValidCompletionTimestamp(completedAt)) throw new RangeError('Invalid completedAt UTC ISO timestamp.');
  return Date.parse(completedAt);
}

export function compareCompletedTasks(taskA, taskB) {
  if (taskA?.completed !== true || taskB?.completed !== true) {
    throw new TypeError('compareCompletedTasks requires two completed tasks.');
  }
  const timeA = toComparableCompletionTime(taskA.completedAt);
  const timeB = toComparableCompletionTime(taskB.completedAt);
  // Legacy completed tasks have no recoverable completion time. Keep them
  // ahead of timestamped tasks and stable relative to their stored order.
  if (timeA === null && timeB !== null) return -1;
  if (timeA !== null && timeB === null) return 1;
  if (timeA === null && timeB === null) return 0;
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  return compareNormalizedTitles(taskA.title, taskB.title);
}

export function sortCompletedTasks(completedTasks) {
  if (!Array.isArray(completedTasks)) throw new TypeError('sortCompletedTasks expects an array.');
  for (const task of completedTasks) {
    if (task?.completed !== true) throw new TypeError('All tasks must be completed.');
  }
  return Object.freeze([...completedTasks].sort(compareCompletedTasks));
}

export function partitionTasksByCompletion(tasks) {
  if (!Array.isArray(tasks)) throw new TypeError('partitionTasksByCompletion expects an array.');
  const pending = [];
  const completed = [];
  for (const task of tasks) {
    if (task?.completed === true) completed.push(task);
    else if (task?.completed === false) pending.push(task);
    else throw new TypeError('Each task must have a Boolean completed field.');
  }
  return Object.freeze({
    [TASK_GROUPS.PENDING]: Object.freeze(pending),
    [TASK_GROUPS.COMPLETED]: Object.freeze(completed),
  });
}

export function sortTasksByExplicitGroup(tasks, todayDate) {
  const { pending, completed } = partitionTasksByCompletion(tasks);
  return Object.freeze({
    [TASK_GROUPS.PENDING]: sortPendingTasks(pending, todayDate),
    [TASK_GROUPS.COMPLETED]: sortCompletedTasks(completed),
  });
}
