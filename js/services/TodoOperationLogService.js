/**
 * Write-ahead operation journal facade. It records task snapshots and measurable
 * metadata before repositories persist mutations, then records their outcomes.
 */

import { countCharacters } from '../utils/textUtils.js';

const FINAL_STATUSES = new Set([
  'committed', 'undone', 'needs-user-input', 'duplicate', 'confirmation-required',
]);

function copyTodo(todo) {
  if (!todo) return null;
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDates: [...todo.dueDates],
    completed: todo.completed,
    completedAt: todo.completedAt,
  };
}

function describeTodo(todo) {
  if (!todo) return null;
  return {
    id: todo.id,
    title: todo.title,
    titleCharacterCount: countCharacters(todo.title),
    titleMaximumCharacterCount: 32,
    titleRemainingCharacterCount: Math.max(0, 32 - countCharacters(todo.title)),
    descriptionCharacterCount: countCharacters(todo.description),
    descriptionMaximumCharacterCount: 256,
    descriptionRemainingCharacterCount: Math.max(0, 256 - countCharacters(todo.description)),
    descriptionIsEmpty: todo.description.length === 0,
    dueDateCount: todo.dueDates.length,
    dueDates: [...todo.dueDates],
    completed: todo.completed,
    completedAt: todo.completedAt,
    lifecycle: todo.completed ? 'completed' : 'pending',
  };
}

function changedFields(beforeTodos, afterTodos) {
  const beforeById = new Map(beforeTodos.map((todo) => [todo.id, todo]));
  const afterById = new Map(afterTodos.map((todo) => [todo.id, todo]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const changes = {};
  for (const id of ids) {
    const before = beforeById.get(id) ?? null;
    const after = afterById.get(id) ?? null;
    const fields = ['title', 'description', 'dueDates', 'completed', 'completedAt'];
    const different = before === null || after === null
      ? ['record']
      : fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
    if (different.length > 0) changes[id] = different;
  }
  return changes;
}

function createOperationId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `operation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class TodoOperationLogService {
  constructor(repository) {
    if (!repository || typeof repository.append !== 'function' ||
        typeof repository.update !== 'function' || typeof repository.getAll !== 'function') {
      throw new TypeError('TodoOperationLogService requires a TodoOperationLogRepository.');
    }
    this.repository = repository;
  }

  async recordBeforePersist({ operationType, beforeTodos = [], afterTodos = [], source = 'user', metadata = {} }) {
    const requestedAt = new Date().toISOString();
    const before = beforeTodos.map(copyTodo);
    const after = afterTodos.map(copyTodo);
    const allTasks = [...before, ...after];
    const operationId = createOperationId();
    const entry = {
      operationId,
      operationType,
      status: 'prepared',
      taskId: after[0]?.id ?? before[0]?.id ?? null,
      relatedTaskIds: [...new Set(allTasks.map((todo) => todo.id))],
      requestedAt,
      updatedAt: requestedAt,
      before,
      after,
      metadata: {
        source,
        validation: { passed: true, checkedAt: requestedAt },
        snapshots: {
          before: before.map(describeTodo),
          after: after.map(describeTodo),
        },
        changesByTaskId: changedFields(before, after),
        persistence: {
          state: 'prepared',
          intentRecordedAt: requestedAt,
          writeStartedAt: null,
          committedAt: null,
          failureAt: null,
          failureKind: null,
          errorName: null,
          errorField: null,
          errorMessage: null,
        },
        ui: { state: 'not-checked', checkedAt: null },
        outcome: { completed: false, resultStatus: 'prepared' },
        recovery: {
          required: true,
          attemptCount: 0,
          lastAttemptAt: null,
          lastOutcome: null,
          userActionRequired: false,
        },
        ...metadata,
      },
    };
    await this.repository.append(entry);
    return operationId;
  }

  async recordValidationFailure({ operationType, input = {}, taskId = null, error, source = 'user' }) {
    const requestedAt = new Date().toISOString();
    const title = typeof input.title === 'string' ? input.title : null;
    const description = typeof input.description === 'string' ? input.description : '';
    const dueDates = Array.isArray(input.dueDates) ? [...input.dueDates] : [];
    const operationId = createOperationId();
    const message = error?.message ?? String(error);
    await this.repository.append({
      operationId,
      operationType,
      status: 'failed',
      taskId: typeof taskId === 'string' ? taskId : null,
      relatedTaskIds: typeof taskId === 'string' ? [taskId] : [],
      requestedAt,
      updatedAt: requestedAt,
      before: [],
      after: [],
      proposed: {
        id: typeof taskId === 'string' ? taskId : null,
        title,
        titleCharacterCount: title === null ? null : countCharacters(title),
        titleMaximumCharacterCount: 32,
        titleRemainingCharacterCount: title === null ? null : Math.max(0, 32 - countCharacters(title)),
        description,
        descriptionCharacterCount: countCharacters(description),
        descriptionMaximumCharacterCount: 256,
        descriptionRemainingCharacterCount: Math.max(0, 256 - countCharacters(description)),
        descriptionIsEmpty: description.length === 0,
        dueDateCount: dueDates.length,
        dueDates,
      },
      metadata: {
        source,
        validation: {
          passed: false,
          checkedAt: requestedAt,
          failedField: error?.field ?? null,
          errorName: error?.name ?? 'Error',
          errorMessage: message,
        },
        snapshots: { before: [], after: [], persisted: [] },
        changesByTaskId: {},
        persistence: {
          state: 'not-started',
          intentRecordedAt: null,
          writeStartedAt: null,
          committedAt: null,
          failureAt: requestedAt,
          failureKind: 'validation',
          errorName: error?.name ?? 'Error',
          errorField: error?.field ?? null,
          errorMessage: message,
        },
        ui: { state: 'not-checked', checkedAt: null },
        outcome: { completed: false, resultStatus: 'failed' },
        recovery: {
          required: false,
          attemptCount: 0,
          lastAttemptAt: null,
          lastOutcome: 'validation-rejected-before-persistence',
          userActionRequired: false,
        },
        failure: { kind: 'validation', field: error?.field ?? null, message },
      },
    });
    return operationId;
  }

  async recordPrePersistFailure({ operationType, input = {}, taskId = null, error, source = 'user' }) {
    const requestedAt = new Date().toISOString();
    const title = typeof input?.title === 'string' ? input.title : null;
    const description = typeof input?.description === 'string' ? input.description : '';
    const dueDates = Array.isArray(input?.dueDates) ? [...input.dueDates] : [];
    const operationId = createOperationId();
    const message = error?.message ?? String(error);
    const normalizedTaskId = typeof taskId === 'string' ? taskId : null;
    await this.repository.append({
      operationId,
      operationType,
      status: 'failed',
      taskId: normalizedTaskId,
      relatedTaskIds: normalizedTaskId ? [normalizedTaskId] : [],
      requestedAt,
      updatedAt: requestedAt,
      before: [],
      after: [],
      proposed: {
        id: normalizedTaskId,
        title,
        titleCharacterCount: title === null ? null : countCharacters(title),
        titleMaximumCharacterCount: 32,
        titleRemainingCharacterCount: title === null ? null : Math.max(0, 32 - countCharacters(title)),
        description,
        descriptionCharacterCount: countCharacters(description),
        descriptionMaximumCharacterCount: 256,
        descriptionRemainingCharacterCount: Math.max(0, 256 - countCharacters(description)),
        descriptionIsEmpty: description.length === 0,
        dueDateCount: dueDates.length,
        dueDates,
      },
      metadata: {
        source,
        validation: {
          passed: error?.name === 'DomainValidationError' ? false : null,
          checkedAt: requestedAt,
          failedField: error?.field ?? null,
          errorName: error?.name ?? 'Error',
          errorMessage: message,
        },
        snapshots: { before: [], after: [], persisted: [] },
        changesByTaskId: {},
        persistence: {
          state: 'not-started',
          intentRecordedAt: null,
          writeStartedAt: null,
          committedAt: null,
          failureAt: requestedAt,
          failureKind: error?.name === 'DomainValidationError' ? 'validation' :
            error?.name?.includes('Storage') || error?.name?.includes('Corruption') ? 'storage' : 'unknown',
          errorName: error?.name ?? 'Error',
          errorField: error?.field ?? null,
          errorMessage: message,
        },
        ui: { state: 'not-checked', checkedAt: null },
        outcome: { completed: false, resultStatus: 'failed' },
        recovery: {
          required: error?.name !== 'DomainValidationError',
          attemptCount: 0,
          lastAttemptAt: null,
          lastOutcome: 'failed-before-task-write',
          userActionRequired: error?.name !== 'DomainValidationError',
        },
        failure: { kind: error?.name === 'DomainValidationError' ? 'validation' : 'storage-or-operation', field: error?.field ?? null, message },
      },
    });
    return operationId;
  }

  async recordNonPersistedOutcome({ operationType, status, input = {}, existingTodo = null, reason = null, message = '' }) {
    const requestedAt = new Date().toISOString();
    const operationId = createOperationId();
    const title = typeof input?.title === 'string' ? input.title : null;
    const description = typeof input?.description === 'string' ? input.description : '';
    const dueDates = Array.isArray(input?.dueDates) ? [...input.dueDates] : [];
    const snapshot = existingTodo ? copyTodo(existingTodo) : null;
    const taskId = snapshot?.id ?? null;
    await this.repository.append({
      operationId,
      operationType,
      status,
      taskId,
      relatedTaskIds: taskId ? [taskId] : [],
      requestedAt,
      updatedAt: requestedAt,
      before: snapshot ? [snapshot] : [],
      after: snapshot ? [snapshot] : [],
      proposed: {
        id: taskId,
        title,
        titleCharacterCount: title === null ? null : countCharacters(title),
        titleMaximumCharacterCount: 32,
        titleRemainingCharacterCount: title === null ? null : Math.max(0, 32 - countCharacters(title)),
        description,
        descriptionCharacterCount: countCharacters(description),
        descriptionMaximumCharacterCount: 256,
        descriptionRemainingCharacterCount: Math.max(0, 256 - countCharacters(description)),
        descriptionIsEmpty: description.length === 0,
        dueDateCount: dueDates.length,
        dueDates,
      },
      metadata: {
        source: 'user',
        validation: { passed: true, checkedAt: requestedAt, failedField: null, errorName: null, errorMessage: null },
        snapshots: {
          before: snapshot ? [describeTodo(snapshot)] : [],
          after: snapshot ? [describeTodo(snapshot)] : [],
          persisted: [],
        },
        changesByTaskId: {},
        persistence: {
          state: 'not-started', intentRecordedAt: null, writeStartedAt: null,
          committedAt: null, failureAt: null, failureKind: null,
          errorName: null, errorField: null, errorMessage: null,
        },
        ui: { state: 'not-checked', checkedAt: null },
        recovery: {
          required: false, attemptCount: 0, lastAttemptAt: null,
          lastOutcome: status, userActionRequired: status === 'confirmation-required',
        },
        outcome: { resultStatus: status, reason, message, completed: false },
      },
    });
    return operationId;
  }

  async recordPendingDelete(todo, deleteRequestedAt = new Date().toISOString()) {
    const operationId = await this.recordBeforePersist({
      operationType: 'delete',
      beforeTodos: [todo],
      afterTodos: [],
      metadata: {
        delete: {
          requestedAt: deleteRequestedAt,
          gracePeriodMs: 5000,
          commitRequestedAt: null,
          undoRequestedAt: null,
        },
      },
    });
    await this.repository.update(operationId, {
      status: 'delete-pending',
      updatedAt: deleteRequestedAt,
      deleteDeadlineAt: new Date(Date.parse(deleteRequestedAt) + 5000).toISOString(),
    });
    return operationId;
  }

  async markCommitRequested(operationId, committedAt = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      status: 'commit-requested',
      updatedAt: committedAt,
      metadata: {
        ...entry.metadata,
        outcome: { completed: false, resultStatus: 'commit-requested' },
        delete: { ...entry.metadata.delete, commitRequestedAt: committedAt },
        persistence: { ...entry.metadata.persistence, state: 'prepared', intentRecordedAt: committedAt },
      },
    });
  }

  async markUndone(operationId, undoneAt = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      status: 'undone',
      updatedAt: undoneAt,
      metadata: {
        ...entry.metadata,
        outcome: { completed: false, resultStatus: 'undone' },
        delete: { ...entry.metadata.delete, undoRequestedAt: undoneAt },
        persistence: { ...entry.metadata.persistence, state: 'not-committed' },
        recovery: { ...entry.metadata.recovery, required: false, lastOutcome: 'undo-recorded' },
      },
    });
  }

  async restartPendingDelete(operationId, startedAt = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      status: 'delete-pending',
      updatedAt: startedAt,
      deleteDeadlineAt: new Date(Date.parse(startedAt) + 5000).toISOString(),
      metadata: {
        ...entry.metadata,
        delete: { ...entry.metadata.delete, gracePeriodMs: 5000, commitRequestedAt: null },
        recovery: {
          ...entry.metadata.recovery,
          required: true,
          attemptCount: entry.metadata.recovery.attemptCount + 1,
          lastAttemptAt: startedAt,
          lastOutcome: 'delete-grace-period-restarted',
        },
      },
    });
  }

  async markCommitted(operationId, savedTodos = [], committedAt = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      status: 'committed',
      updatedAt: committedAt,
      after: savedTodos.map(copyTodo),
      metadata: {
        ...entry.metadata,
        outcome: { completed: true, resultStatus: 'committed' },
        snapshots: {
          ...entry.metadata.snapshots,
          persisted: savedTodos.map(describeTodo),
        },
        persistence: {
          ...entry.metadata.persistence,
          state: 'committed',
          committedAt,
          failureAt: null,
          failureKind: null,
          errorName: null,
          errorField: null,
          errorMessage: null,
        },
        recovery: { ...entry.metadata.recovery, required: false, lastOutcome: 'committed' },
      },
    });
  }

  async markFailed(operationId, error, failedAt = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      status: 'failed',
      updatedAt: failedAt,
      metadata: {
        ...entry.metadata,
        outcome: { completed: false, resultStatus: 'failed' },
        persistence: {
          ...entry.metadata.persistence,
          state: 'failed',
          failureAt: failedAt,
          failureKind: error?.name === 'DomainValidationError'
            ? 'validation'
            : error?.name === 'StorageError' || error?.name === 'StorageCorruptionError' || error?.name === 'OperationLogCorruptionError'
              ? 'storage'
              : 'unknown',
          errorName: error?.name ?? 'Error',
          errorField: error?.field ?? null,
          errorMessage: error?.message ?? String(error),
        },
        recovery: { ...entry.metadata.recovery, required: true, lastOutcome: 'persistence-failed' },
      },
    });
  }

  async markNeedsUserInput(operationId, message, at = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      status: 'needs-user-input',
      updatedAt: at,
      metadata: {
        ...entry.metadata,
        outcome: { completed: false, resultStatus: 'needs-user-input' },
        recovery: {
          ...entry.metadata.recovery,
          required: false,
          userActionRequired: true,
          lastAttemptAt: at,
          lastOutcome: message,
        },
      },
    });
  }

  async noteRecoveryAttempt(operationId, outcome = 'started', at = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      updatedAt: at,
      metadata: {
        ...entry.metadata,
        recovery: {
          ...entry.metadata.recovery,
          required: true,
          attemptCount: entry.metadata.recovery.attemptCount + 1,
          lastAttemptAt: at,
          lastOutcome: outcome,
        },
      },
    });
  }

  async markUiState(operationId, state, checkedAt = new Date().toISOString()) {
    const entries = await this.repository.getAll();
    const entry = entries.find((candidate) => candidate.operationId === operationId);
    if (!entry) return null;
    return this.repository.update(operationId, {
      metadata: { ...entry.metadata, ui: { state, checkedAt } },
    });
  }

  getAll() {
    return this.repository.getAll();
  }

  async getUnresolved() {
    const entries = await this.repository.getAll();
    return entries.filter((entry) => !FINAL_STATUSES.has(entry.status) &&
      !(entry.status === 'failed' && (
        entry.metadata.persistence.failureKind === 'validation' ||
        entry.operationType === 'delete'
      )));
  }

  async getRecent(sinceMs) {
    const cutoff = Date.now() - sinceMs;
    const entries = await this.repository.getAll();
    return entries.filter((entry) => Date.parse(entry.updatedAt) >= cutoff);
  }
}

export default TodoOperationLogService;
