/**
 * Achievra — Stage 6 application composition root.
 *
 * This module wires the repository, domain service, and DOM view. Domain rules
 * stay in TodoService; the view never persists data. Every successful mutation
 * is reflected through a localized card update.
 */

import { LocalStorageTodoRepository } from './repositories/LocalStorageTodoRepository.js';
import { LocalStorageTodoOperationLogRepository } from './repositories/LocalStorageTodoOperationLogRepository.js';
import { OperationLogCorruptionError } from './repositories/TodoOperationLogRepository.js';
import {
  DomainValidationError,
  StorageCorruptionError,
  StorageError,
} from './repositories/TodoRepository.js';
import { TodoService } from './services/TodoService.js';
import { TodoOperationLogService } from './services/TodoOperationLogService.js';
import { TodoView } from './views/TodoView.js';

const DELETE_GRACE_PERIOD_MS = 5000;
const UNDO_COUNTDOWN_INTERVAL_MS = 1000;
const DUPLICATE_HIGHLIGHT_DURATION_MS = 2500;
const OPERATION_LOG_CHECK_INTERVAL_MS = 5000;
const OPERATION_LOG_RECENT_WINDOW_MS = 7000;
const NOTIFICATION_CHOICE_LABELS = Object.freeze({
  'past-date': Object.freeze({ confirm: 'Add as Completed', cancel: 'Cancel' }),
  merge: Object.freeze({ confirm: 'Merge Tasks', cancel: 'Cancel' }),
  'repeated-text': Object.freeze({ confirm: 'Append Anyway', cancel: 'Cancel' }),
});

const repository = new LocalStorageTodoRepository();
const operationLogRepository = new LocalStorageTodoOperationLogRepository();
const todoOperationLog = new TodoOperationLogService(operationLogRepository);
const todoService = new TodoService(repository, todoOperationLog);
const todoView = new TodoView();
const todosById = new Map();
const pendingDeleteTimers = new Map();
const duplicateHighlightTimers = new Map();
let hasLoadedTaskLists = false;
let isCheckingOperationLog = false;
let hasReportedBackgroundCorruption = false;
let recoveredDeleteOperations = [];

function showError(error) {
  const message = error?.message || 'The operation could not be completed.';

  if (error instanceof OperationLogCorruptionError) {
    todoView.showStorageAlert(
      `${message} The operation journal was preserved and was not changed.`,
      'error'
    );
    return;
  }

  if (error instanceof StorageCorruptionError) {
    todoView.showCorruptionDialog(async () => {
      await repository.resetStorage();
      const { pendingTodos, completedTodos } = await todoService.getTaskLists();
      todosById.clear();
      for (const todo of [...pendingTodos, ...completedTodos]) updateTodoIndex(todo);
      todoView.renderInitialLists(pendingTodos, completedTodos);
      hasLoadedTaskLists = true;
    });
    return;
  }

  if (error instanceof DomainValidationError && !todoView.elements.taskFormCard.hidden) {
    todoView.setFormErrors({ [error.field || 'form']: message });
    return;
  }

  todoView.showStorageAlert(message, 'error');
}

function todoStateMatches(firstTodo, secondTodo) {
  return Boolean(firstTodo && secondTodo) &&
    firstTodo.id === secondTodo.id &&
    firstTodo.title === secondTodo.title &&
    firstTodo.description === secondTodo.description &&
    firstTodo.completed === secondTodo.completed &&
    firstTodo.completedAt === secondTodo.completedAt &&
    firstTodo.dueDates.length === secondTodo.dueDates.length &&
    firstTodo.dueDates.every((date, index) => date === secondTodo.dueDates[index]);
}

function operationSnapshotsMatch(expectedTodos, actualTodos) {
  return expectedTodos.every((expected) =>
    todoStateMatches(actualTodos.find((todo) => todo.id === expected.id), expected));
}

function selectedTodoIds() {
  return todoView.getSelectedTodoIds();
}

function updateTodoIndex(todo) {
  if (todo && typeof todo.id === 'string' && todo.id.length > 0) {
    todosById.set(todo.id, todo);
  }
}

function removeTodoFromIndex(id) {
  todosById.delete(id);
}

async function recoverIncompleteOperations() {
  recoveredDeleteOperations = [];
  let entries;
  try {
    entries = await todoOperationLog.getUnresolved();
  } catch (error) {
    showError(error);
    return;
  }

  for (const entry of entries) {
    try {
      const lists = await todoService.getTaskLists();
      const allTodos = [...lists.pendingTodos, ...lists.completedTodos];
      const beforeTodos = entry.before ?? [];
      const afterTodos = entry.after ?? [];
      const beforeStateMatches = beforeTodos.length > 0
        ? operationSnapshotsMatch(beforeTodos, allTodos)
        : (entry.relatedTaskIds ?? []).every((id) => !allTodos.some((todo) => todo.id === id));
      const removedIds = beforeTodos.map((todo) => todo.id)
        .filter((id) => !afterTodos.some((todo) => todo.id === id));
      const removedStateMatches = removedIds.every((id) => !allTodos.some((todo) => todo.id === id));
      const afterStateMatches = operationSnapshotsMatch(afterTodos, allTodos) && removedStateMatches;

      if (entry.operationType === 'delete') {
        const todoId = beforeTodos[0]?.id ?? entry.taskId;
        if (!allTodos.some((todo) => todo.id === todoId)) {
          await todoOperationLog.markCommitted(entry.operationId, []);
        } else if (
          entry.status === 'delete-pending' ||
          entry.status === 'commit-requested' ||
          (entry.status === 'prepared' && entry.metadata.delete?.gracePeriodMs === DELETE_GRACE_PERIOD_MS)
        ) {
          recoveredDeleteOperations.push({ id: todoId, operationId: entry.operationId });
        } else {
          await todoOperationLog.markNeedsUserInput(
            entry.operationId,
            'The delete entry is not in a resumable grace-period state. The saved task was kept.'
          );
          todoView.showStorageAlert(
            'A saved deletion could not be safely resumed. The task is still saved and available.',
            'error'
          );
        }
        continue;
      }

      if (afterStateMatches) {
        await todoOperationLog.markCommitted(entry.operationId, afterTodos);
        continue;
      }

      if (beforeStateMatches) {
        await todoOperationLog.noteRecoveryAttempt(entry.operationId, 'replay-started');
        if (entry.operationType === 'merge' && beforeTodos.length >= 2 && afterTodos[0]) {
          const sourceTodo = beforeTodos.find((todo) => todo.id !== afterTodos[0].id) ?? beforeTodos[0];
          await todoService.recoverMerge(sourceTodo.id, afterTodos[0].id, afterTodos[0]);
        } else if (afterTodos[0]) {
          await todoService.restoreTodoSnapshot(afterTodos[0]);
        } else {
          throw new Error('The interrupted operation does not contain enough task data to recover.');
        }
        await todoOperationLog.markCommitted(entry.operationId, afterTodos);
        continue;
      }

      const availableTodo = afterTodos[0] ?? beforeTodos[0] ?? entry.proposed;
      await todoOperationLog.markNeedsUserInput(
        entry.operationId,
        'Stored task state differs from both journal snapshots; user review is required.'
      );
      if (availableTodo) {
        todoView.openRecoveryForm(availableTodo);
        void todoView.showChoiceNotification(
          'An interrupted task change could not be safely resumed. The available task details are in the form; review them and save when ready.',
          { confirmLabel: 'Review Form', cancelLabel: 'Later' }
        ).then((review) => {
          if (review) todoView.elements.taskTitleInput.focus();
        });
      } else {
        todoView.showStorageAlert('An interrupted task change has incomplete data. No task data was changed; enter the missing task details again.', 'error');
      }
    } catch (error) {
      if (error instanceof OperationLogCorruptionError || error instanceof StorageCorruptionError) {
        showError(error);
        continue;
      }
      if (error instanceof StorageError) {
        try { await todoOperationLog.markFailed(entry.operationId, error); } catch { /* Keep the prepared recovery entry. */ }
        showError(error);
        continue;
      }
      try {
        await todoOperationLog.markNeedsUserInput(
          entry.operationId,
          `Recovery could not be completed: ${error?.message ?? String(error)}`
        );
      } catch { /* Preserve the original journal entry for manual recovery. */ }
      const availableTodo = entry.after?.[0] ?? entry.before?.[0] ?? entry.proposed;
      if (availableTodo) {
        todoView.openRecoveryForm(availableTodo);
        void todoView.showChoiceNotification(
          'A saved task operation was interrupted and could not be resumed automatically. Review the prefilled task and save it when ready.',
          { confirmLabel: 'Review Form', cancelLabel: 'Later' }
        ).then((review) => {
          if (review) todoView.elements.taskTitleInput.focus();
        });
      } else {
        showError(error);
      }
    }
  }
}

async function loadTaskLists() {
  try {
    await recoverIncompleteOperations();
    const { pendingTodos, completedTodos } = await todoService.getTaskLists();
    todosById.clear();
    for (const todo of [...pendingTodos, ...completedTodos]) updateTodoIndex(todo);
    todoView.renderInitialLists(pendingTodos, completedTodos);
    hasLoadedTaskLists = true;
    hasReportedBackgroundCorruption = false;
    const pendingDeletes = recoveredDeleteOperations;
    recoveredDeleteOperations = [];
    for (const operation of pendingDeletes) {
      await beginPendingDeletion(operation.id, operation.operationId, true);
    }
  } catch (error) {
    showError(error);
  }
}

async function checkRecentOperationLog() {
  if (!hasLoadedTaskLists || isCheckingOperationLog || todoView.document.visibilityState === 'hidden') return;
  isCheckingOperationLog = true;
  try {
    const recentEntries = await todoOperationLog.getRecent(OPERATION_LOG_RECENT_WINDOW_MS);
    hasReportedBackgroundCorruption = false;
    const committedEntries = recentEntries
      .filter((entry) => entry.status === 'committed')
      .sort((first, second) => Date.parse(first.updatedAt) - Date.parse(second.updatedAt));
    const latestByTaskId = new Map();
    for (const entry of committedEntries) {
      for (const id of entry.relatedTaskIds ?? []) latestByTaskId.set(id, entry);
    }
    if (latestByTaskId.size === 0) return;

    const lists = await todoService.getTaskLists();
    const storedById = new Map([...lists.pendingTodos, ...lists.completedTodos].map((todo) => [todo.id, todo]));
    for (const [id, entry] of latestByTaskId) {
      const expected = (entry.after ?? []).find((todo) => todo.id === id) ?? null;
      const before = (entry.before ?? []).find((todo) => todo.id === id) ?? null;
      if (!expected && !before) continue;

      if (expected) {
        let actual = storedById.get(id);
        if (!todoStateMatches(actual, expected)) {
          actual = await todoService.restoreTodoSnapshot(expected);
          storedById.set(id, actual);
        }
        if (!todoView.isTodoElementConsistent(actual) ||
            !todoView.isTodoElementInSection(id, actual.completed)) {
          todoView.updateTodoElement(actual);
          updateTodoIndex(actual);
          await todoOperationLog.markUiState(entry.operationId, 'repaired-from-journal');
        } else {
          await todoOperationLog.markUiState(entry.operationId, 'matched-journal');
        }
        // Keep the rendered representation unique for this persisted ID.
        todoView.removeDuplicateTodoElements(id);
      } else {
        // Absence is authoritative only for a committed delete or an absorbed
        // source record in an atomic merge. A missing snapshot in any other
        // journal operation must never erase a stored Todo.
        const isCommittedRemoval = entry.operationType === 'delete' ||
          (entry.operationType === 'merge' && before &&
            !(entry.after ?? []).some((todo) => todo.id === id));
        if (!isCommittedRemoval) continue;
        if (storedById.has(id)) {
          const result = await todoService.commitDelete([id]);
          if (!result.deletedIds.includes(id)) continue;
          storedById.delete(id);
        }
        if (todoView.getRenderedTodoIds().includes(id)) todoView.removeTodoElement(id);
        removeTodoFromIndex(id);
        await todoOperationLog.markUiState(entry.operationId, 'deletion-matched-journal');
      }
    }
  } catch (error) {
    if ((error instanceof OperationLogCorruptionError || error instanceof StorageCorruptionError) &&
        !hasReportedBackgroundCorruption) {
      hasReportedBackgroundCorruption = true;
      showError(error);
    }
    // Transient log/storage failures are retried by the next five-second check.
  } finally {
    isCheckingOperationLog = false;
  }
}

function refreshUndoAllControl() {
  todoView.renderUndoAllControl(
    [...pendingDeleteTimers.keys()],
    undoAllPendingDeletions
  );
}

function clearDeleteTimer(id) {
  const timerState = pendingDeleteTimers.get(id);
  if (!timerState) return false;
  globalThis.clearTimeout(timerState.timeoutId);
  globalThis.clearInterval(timerState.intervalId);
  pendingDeleteTimers.delete(id);
  return true;
}

function armDeleteTimer(id, timerState) {
  timerState.intervalId = globalThis.setInterval(() => {
    const remaining = Math.max(0, Math.ceil((timerState.deadline - Date.now()) / 1000));
    todoView.renderTaskUndoControl(id, remaining, restorePendingDeletion);
  }, UNDO_COUNTDOWN_INTERVAL_MS);
  timerState.timeoutId = globalThis.setTimeout(() => {
    void commitExpiredDeletion(id);
  }, Math.max(0, timerState.deadline - Date.now()));
}

async function restorePendingDeletion(id, showFeedback = true) {
  const timerState = pendingDeleteTimers.get(id);
  if (!timerState) return false;
  globalThis.clearTimeout(timerState.timeoutId);
  globalThis.clearInterval(timerState.intervalId);
  if (timerState.operationId) {
    try {
      await todoOperationLog.markUndone(timerState.operationId);
    } catch (error) {
      showError(error);
      timerState.deadline = Date.now() + DELETE_GRACE_PERIOD_MS;
      armDeleteTimer(id, timerState);
      return false;
    }
  }
  pendingDeleteTimers.delete(id);
  todoView.removeTaskUndoControl(id);
  refreshUndoAllControl();
  const todo = todosById.get(id);
  if (showFeedback && todo) todoView.showStorageAlert(`Deletion canceled. “${todo.title}” is still saved.`, 'info');
  return true;
}

async function undoAllPendingDeletions(ids = [...pendingDeleteTimers.keys()]) {
  const restoredResults = await Promise.all(ids.map((id) => restorePendingDeletion(id, false)));
  const restoredCount = restoredResults.filter(Boolean).length;
  refreshUndoAllControl();
  if (restoredCount > 0) {
    todoView.showStorageAlert(
      `${restoredCount} ${restoredCount === 1 ? 'deletion was' : 'deletions were'} canceled. The tasks are still saved.`,
      'info'
    );
  }
}

async function commitExpiredDeletion(id) {
  const timerState = pendingDeleteTimers.get(id);
  if (!timerState) return;
  globalThis.clearInterval(timerState.intervalId);
  pendingDeleteTimers.delete(id);
  refreshUndoAllControl();

  try {
    const result = await todoService.commitDelete(
      [id],
      { [id]: timerState.operationId }
    );
    if (result.deletedIds.includes(id)) {
      await todoView.animateTodoRemoval(id);
      removeTodoFromIndex(id);
      todoView.showStorageAlert('Task deleted.', 'success');
    }
    const failure = result.failures.find((item) => item.id === id);
    if (failure) {
      todoView.removeTaskUndoControl(id);
      const todo = todosById.get(id);
      const title = todo ? `“${todo.title}”: ` : '';
      todoView.showStorageAlert(`${title}${failure.message}`, 'error');
    }
  } catch (error) {
    todoView.removeTaskUndoControl(id);
    showError(error);
  } finally {
    refreshUndoAllControl();
  }
}

async function beginPendingDeletion(id, existingOperationId = null, isRecovered = false) {
  if (!todosById.has(id) || pendingDeleteTimers.has(id)) return;
  let operationId = existingOperationId;
  if (!operationId) {
    try {
      operationId = await todoOperationLog.recordPendingDelete(todosById.get(id));
    } catch (error) {
      showError(error);
      return;
    }
  }
  if (isRecovered && existingOperationId) {
    try { await todoOperationLog.restartPendingDelete(existingOperationId); } catch (error) {
      showError(error);
      return;
    }
  }
  todoView.setTaskSelected(id, false);
  todoView.setTaskPendingDeletion(id, true);
  const deadline = Date.now() + DELETE_GRACE_PERIOD_MS;
  const timerState = { deadline, timeoutId: null, intervalId: null, operationId };
  pendingDeleteTimers.set(id, timerState);
  armDeleteTimer(id, timerState);
  todoView.renderTaskUndoControl(id, 5, restorePendingDeletion);
  refreshUndoAllControl();
}

function highlightDuplicate(todo) {
  const id = todo?.id;
  if (!id) return;
  const existingTimer = duplicateHighlightTimers.get(id);
  if (existingTimer) globalThis.clearTimeout(existingTimer);
  todoView.highlightTodoElement(id);
  const timerId = globalThis.setTimeout(() => {
    todoView.clearTodoHighlight(id);
    duplicateHighlightTimers.delete(id);
  }, DUPLICATE_HIGHLIGHT_DURATION_MS);
  duplicateHighlightTimers.set(id, timerId);
}

function confirmInNotification(message, reason) {
  const labels = NOTIFICATION_CHOICE_LABELS[reason] ?? { confirm: 'Continue', cancel: 'Cancel' };
  return todoView.showChoiceNotification(message, {
    confirmLabel: labels.confirm,
    cancelLabel: labels.cancel,
  });
}

async function resolveOperation(input, editingTodoId) {
  const decisions = {};
  let result = editingTodoId
    ? await todoService.updatePendingTodo(editingTodoId, input, decisions)
    : await todoService.createTodo(input, decisions);

  while (result.status === 'confirmation-required') {
    let promptMessage = result.message;
    if (result.reason === 'repeated-text' && result.repeatedFragments?.length) {
      promptMessage += `\n\nRepeated text: ${result.repeatedFragments.join(' · ')}`;
    }
    if (!(await confirmInNotification(promptMessage, result.reason))) return null;

    if (result.reason === 'past-date') decisions.addPastDatesAsCompleted = true;
    if (result.reason === 'merge') decisions.confirmMerge = true;
    if (result.reason === 'repeated-text') decisions.confirmRepeatedText = true;

    result = editingTodoId
      ? await todoService.updatePendingTodo(editingTodoId, input, decisions)
      : await todoService.createTodo(input, decisions);
  }
  return result;
}

function applySuccessfulOperation(result, editingTodoId, closeTaskForm = true) {
  const savedTodo = result.todo;
  if (!savedTodo) return;

  // Persistence has succeeded at this point. Close the form before touching
  // the card DOM so a rendering issue cannot leave a completed save looking pending.
  if (closeTaskForm) todoView.closeTaskForm();

  if (result.status === 'merged' && editingTodoId && editingTodoId !== savedTodo.id) {
    todoView.removeTodoElement(editingTodoId);
    removeTodoFromIndex(editingTodoId);
  }
  if (result.status === 'created') todoView.addTodoElement(savedTodo);
  else todoView.updateTodoElement(savedTodo);
  updateTodoIndex(savedTodo);
  const message = result.status === 'merged'
    ? 'Task details were merged and saved.'
    : result.status === 'updated'
      ? 'Task changes saved.'
      : savedTodo.completed
        ? 'Task added to Completed.'
        : 'Task added.';
  todoView.showStorageAlert(message, 'success');
}

async function handleTaskFormSubmit(event) {
  event.preventDefault();
  todoView.clearFormErrors();
  const input = todoView.getTaskFormData();
  const editingTodoId = todoView.getEditingTodoId();

  try {
    const result = await resolveOperation(input, editingTodoId);
    if (!result) return;
    if (result.status === 'duplicate') {
      highlightDuplicate(result.existingTodo);
      todoView.showStorageAlert(result.message, 'info');
      return;
    }
    applySuccessfulOperation(result, editingTodoId);
  } catch (error) {
    showError(error);
  }
}

async function removeDueDateFromTodo(id, date) {
  const todo = todosById.get(id);
  if (!todo || todo.completed || !todo.dueDates.includes(date)) return;
  try {
    const changes = { dueDates: todo.dueDates.filter((dueDate) => dueDate !== date) };
    const decisions = {};
    let result = await todoService.updatePendingTodo(id, changes, decisions);
    while (result.status === 'confirmation-required') {
      let promptMessage = result.message;
      if (result.reason === 'repeated-text' && result.repeatedFragments?.length) {
        promptMessage += `\n\nRepeated text: ${result.repeatedFragments.join(' · ')}`;
      }
      if (!(await confirmInNotification(promptMessage, result.reason))) return;
      if (result.reason === 'merge') decisions.confirmMerge = true;
      if (result.reason === 'repeated-text') decisions.confirmRepeatedText = true;
      result = await todoService.updatePendingTodo(id, changes, decisions);
    }
    if (result.status === 'updated') {
      updateTodoIndex(result.todo);
      todoView.updateTodoElement(result.todo);
    } else if (result.status === 'merged') {
      applySuccessfulOperation(result, id, false);
    } else if (result.status === 'duplicate') {
      highlightDuplicate(result.existingTodo);
      todoView.showStorageAlert(result.message, 'info');
    }
  } catch (error) {
    showError(error);
  }
}

async function completeSelectedTodos() {
  const ids = selectedTodoIds();
  if (ids.length === 0) return;
  try {
    const { completed, failures } = await todoService.completeTodos(ids);
    for (const todo of completed) {
      updateTodoIndex(todo);
      todoView.moveTodoElement(todo.id, 'completed', todo);
    }
    if (failures.length > 0) {
      const details = failures.map((failure) => {
        const todo = todosById.get(failure.id);
        return `${todo?.title ?? failure.id}: ${failure.message}`;
      });
      todoView.showStorageAlert(`Some tasks could not be completed. ${details.join(' ')}`, 'error');
    } else if (completed.length > 0) {
      todoView.showStorageAlert(`${completed.length} ${completed.length === 1 ? 'task was' : 'tasks were'} marked completed.`, 'success');
    }
  } catch (error) {
    showError(error);
  }
}

function deleteSelectedTodos() {
  const ids = selectedTodoIds();
  for (const id of ids) void beginPendingDeletion(id);
}

function handleTaskAction(event) {
  const actionElement = event.target.closest('[data-action]');
  if (!actionElement) return;
  const action = actionElement.dataset.action;
  const taskCard = actionElement.closest('.task-item');
  const id = taskCard?.dataset.id;
  const todo = id ? todosById.get(id) : null;
  const selected = id ? todoView.getSelectedTodoIds().includes(id) : false;

  if (action === 'remove-selected-date') {
    event.preventDefault();
    todoView.removeSelectedDate(actionElement.dataset.date);
    return;
  }
  if (action === 'remove-date') {
    event.preventDefault();
    if (id) void removeDueDateFromTodo(id, actionElement.dataset.date);
    return;
  }
  if (!id || !todo || pendingDeleteTimers.has(id)) return;
  if (action === 'edit' && selected && !todo.completed) {
    todoView.openTaskForm(todo);
  } else if (action === 'copy' && selected && todo.completed) {
    todoView.openTaskForm(todo);
  } else if (action === 'delete' && selected) {
    void beginPendingDeletion(id);
  } else if (action === 'undo-delete') {
    restorePendingDeletion(id);
  }
}

function bindApplicationEvents() {
  const document = todoView.document;
  const windowObject = document.defaultView;
  document.getElementById('taskForm').addEventListener('submit', (event) => {
    void handleTaskFormSubmit(event);
  });
  document.getElementById('openAddModalBtn').addEventListener('click', () => todoView.openTaskForm());
  document.getElementById('closeFormBtn').addEventListener('click', () => todoView.closeTaskForm());
  document.getElementById('cancelFormBtn').addEventListener('click', () => todoView.closeTaskForm());
  document.getElementById('addDateBtn').addEventListener('click', () => {
    todoView.addDateToForm();
  });
  document.getElementById('sidebarToggler').addEventListener('click', () => todoView.openMobileDrawer());
  document.getElementById('bulkCompleteBtn').addEventListener('click', () => {
    void completeSelectedTodos();
  });
  document.getElementById('bulkDeleteBtn').addEventListener('click', deleteSelectedTodos);
  document.addEventListener('click', handleTaskAction);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkRecentOperationLog();
    }
  });
  windowObject?.addEventListener('storage', (event) => {
    if (event.key === null || event.key === repository.storageKey || event.key === operationLogRepository.storageKey) {
      void checkRecentOperationLog();
    }
  });
}

bindApplicationEvents();
void loadTaskLists();
globalThis.setInterval(() => void checkRecentOperationLog(), OPERATION_LOG_CHECK_INTERVAL_MS);
