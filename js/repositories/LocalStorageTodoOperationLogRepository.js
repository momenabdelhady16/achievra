/** LocalStorage adapter for the durable write-ahead Todo operation journal. */

import { StorageError } from './TodoRepository.js';
import { OperationLogCorruptionError, TodoOperationLogRepository } from './TodoOperationLogRepository.js';

const DEFAULT_STORAGE_KEY = 'achievra_todo_operation_log';
const SCHEMA_VERSION = 1;
const OPERATION_TYPES = new Set(['create', 'update', 'merge', 'complete', 'delete', 'recovery']);
const OPERATION_STATUSES = new Set([
  'prepared', 'delete-pending', 'commit-requested', 'committed', 'failed', 'undone', 'needs-user-input',
  'duplicate', 'confirmation-required',
]);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isValidTodoSnapshot(todo) {
  return isPlainObject(todo) && typeof todo.id === 'string' && todo.id.trim() !== '' &&
    typeof todo.title === 'string' && typeof todo.description === 'string' &&
    Array.isArray(todo.dueDates) && todo.dueDates.every((date) => typeof date === 'string') &&
    typeof todo.completed === 'boolean' &&
    (todo.completedAt === null || typeof todo.completedAt === 'string');
}

function isValidEntry(entry) {
  return isPlainObject(entry) &&
    typeof entry.operationId === 'string' && entry.operationId.trim() !== '' &&
    OPERATION_TYPES.has(entry.operationType) && OPERATION_STATUSES.has(entry.status) &&
    (typeof entry.taskId === 'string' || entry.taskId === null) &&
    Array.isArray(entry.relatedTaskIds) && entry.relatedTaskIds.every((id) => typeof id === 'string') &&
    typeof entry.requestedAt === 'string' && Number.isFinite(Date.parse(entry.requestedAt)) &&
    typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt)) &&
    Array.isArray(entry.before) && entry.before.every(isValidTodoSnapshot) &&
    Array.isArray(entry.after) && entry.after.every(isValidTodoSnapshot) &&
    (entry.proposed === undefined || isPlainObject(entry.proposed)) &&
    isPlainObject(entry.metadata) &&
    (typeof entry.metadata.validation?.passed === 'boolean' || entry.metadata.validation?.passed === null) &&
    isPlainObject(entry.metadata.snapshots) &&
    Array.isArray(entry.metadata.snapshots.before) && Array.isArray(entry.metadata.snapshots.after) &&
    isPlainObject(entry.metadata.changesByTaskId) &&
    isPlainObject(entry.metadata.persistence) && typeof entry.metadata.persistence.state === 'string' &&
    isPlainObject(entry.metadata.ui) && typeof entry.metadata.ui.state === 'string' &&
    isPlainObject(entry.metadata.recovery) && typeof entry.metadata.recovery.required === 'boolean' &&
    Number.isInteger(entry.metadata.recovery.attemptCount);
}

export class LocalStorageTodoOperationLogRepository extends TodoOperationLogRepository {
  constructor(storageKey = DEFAULT_STORAGE_KEY) {
    super();
    if (typeof storageKey !== 'string' || storageKey.trim() === '') {
      throw new TypeError('Operation log storageKey must be a non-empty string.');
    }
    this.storageKey = storageKey;
  }

  _storage(methods = ['getItem', 'setItem']) {
    try {
      const storage = globalThis.localStorage;
      if (!storage || methods.some((method) => typeof storage[method] !== 'function')) {
        throw new Error('localStorage API is unavailable.');
      }
      return storage;
    } catch (error) {
      throw new StorageError('Unable to access the operation log in LocalStorage.', error);
    }
  }

  _read() {
    const storage = this._storage(['getItem']);
    let raw;
    try {
      raw = storage.getItem(this.storageKey);
    } catch (error) {
      throw new StorageError('Unable to read the operation log.', error);
    }
    if (raw === null) return [];
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new OperationLogCorruptionError('The saved operation log contains malformed JSON.', raw);
    }
    if (!isPlainObject(parsed) || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
      throw new OperationLogCorruptionError('The saved operation log has an unsupported or invalid structure.', raw);
    }
    const ids = new Set();
    for (const entry of parsed.entries) {
      if (!isValidEntry(entry) || ids.has(entry.operationId)) {
        throw new OperationLogCorruptionError('The saved operation log contains an invalid or duplicate entry.', raw);
      }
      ids.add(entry.operationId);
    }
    return parsed.entries.map(clone);
  }

  _write(entries) {
    const storage = this._storage(['setItem']);
    let serialized;
    try {
      serialized = JSON.stringify({ schemaVersion: SCHEMA_VERSION, entries });
    } catch (error) {
      throw new StorageError('Failed to serialize the operation log.', error);
    }
    try {
      storage.setItem(this.storageKey, serialized);
    } catch (error) {
      throw new StorageError('Failed to write the operation log to LocalStorage.', error);
    }
  }

  async getAll() {
    return this._read();
  }

  async append(entry) {
    if (!isPlainObject(entry) || typeof entry.operationId !== 'string' || entry.operationId.trim() === '') {
      throw new TypeError('Operation log entry must have a non-empty operationId.');
    }
    const entries = this._read();
    if (entries.some((candidate) => candidate.operationId === entry.operationId)) {
      throw new OperationLogCorruptionError(`Operation id "${entry.operationId}" is already recorded.`);
    }
    entries.push(clone(entry));
    this._write(entries);
    return clone(entry);
  }

  async update(operationId, changes) {
    const entries = this._read();
    const index = entries.findIndex((entry) => entry.operationId === operationId);
    if (index < 0) throw new OperationLogCorruptionError(`Operation "${operationId}" is missing from its journal.`);
    entries[index] = { ...entries[index], ...clone(changes) };
    this._write(entries);
    return clone(entries[index]);
  }
}

export default LocalStorageTodoOperationLogRepository;
