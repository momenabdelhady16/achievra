/**
 * Achievra — Stage 3 LocalStorage Repository Adapter (`js/repositories/LocalStorageTodoRepository.js`)
 *
 * Concrete LocalStorage implementation of `TodoRepository`.
 * Responsibilities:
 * - Read, validate, and migrate the versioned LocalStorage envelope (`{ schemaVersion: 2, todos: Todo[] }`).
 * - Migrate valid version 1 envelopes (`date` -> `dueDates`, `completedAt: null`) to version 2,
 *   preserving record order and writing only after full validation.
 * - Generate opaque task IDs via `crypto.randomUUID()` during `create(todoData)`.
 * - Persist every mutation via a single `localStorage.setItem` write of the complete envelope.
 * - Translate validation, storage access/quota, and corruption issues into
 *   `DomainValidationError`, `StorageError`, and `StorageCorruptionError`.
 */

import { TASK_MODEL_FIELDS } from '../constants.js';
import {
  createTaskModel,
  validateTaskInput,
  isValidCompletionTimestamp,
} from '../models/taskModel.js';
import {
  TodoRepository,
  DomainValidationError,
  StorageError,
  StorageCorruptionError,
} from './TodoRepository.js';

const ALLOWED_MUTATION_FIELDS = Object.freeze(
  TASK_MODEL_FIELDS.filter((field) => field !== 'id')
);

const ALLOWED_V1_RECORD_FIELDS = Object.freeze([
  'id',
  'title',
  'description',
  'date',
  'completed',
]);

const ALLOWED_ENVELOPE_FIELDS = Object.freeze(['schemaVersion', 'todos']);

/**
 * Checks whether a value is a non-null plain object (and not an array).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Creates a detached, deeply frozen copy of a validated Todo record.
 *
 * @param {Readonly<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   dueDates: readonly string[],
 *   completed: boolean,
 *   completedAt: string | null
 * }>} todo
 * @returns {Readonly<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   dueDates: ReadonlyArray<string>,
 *   completed: boolean,
 *   completedAt: string | null
 * }>}
 */
function cloneTodoRecord(todo) {
  return createTaskModel({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDates: [...todo.dueDates],
    completed: todo.completed,
    completedAt: todo.completedAt,
  });
}

export class LocalStorageTodoRepository extends TodoRepository {
  /**
   * @param {string} [storageKey='todos_app_data']
   */
  constructor(storageKey = 'todos_app_data') {
    super();
    if (typeof storageKey !== 'string' || storageKey.trim().length === 0) {
      throw new DomainValidationError(
        'storageKey',
        'storageKey must be a non-empty string.'
      );
    }
    this.storageKey = storageKey;
    this.SCHEMA_VERSION = 2;
  }

  /**
   * Resolves the platform `localStorage` object, raising `StorageError` if unavailable
   * or blocked by browser privacy/security settings.
   *
   * @param {string[]} [requiredMethods=['getItem', 'setItem']]
   * @returns {Storage}
   */
  _getStorage(requiredMethods = ['getItem', 'setItem']) {
    try {
      const storage = globalThis.localStorage;
      if (!storage || requiredMethods.some((method) => typeof storage[method] !== 'function')) {
        throw new Error('localStorage API is not available in this environment.');
      }
      return storage;
    } catch (err) {
      if (err instanceof StorageError) {
        throw err;
      }
      throw new StorageError('Unable to access LocalStorage.', err);
    }
  }

  /**
   * Generates a unique identifier for a newly created Todo using `crypto.randomUUID()`.
   *
   * @param {readonly object[]} existingTodos
   * @returns {string}
   */
  _generateId(existingTodos) {
    if (
      typeof globalThis.crypto === 'undefined' ||
      typeof globalThis.crypto.randomUUID !== 'function'
    ) {
      throw new StorageError(
        'crypto.randomUUID() is unavailable in this environment.'
      );
    }

    const existingIds = new Set(existingTodos.map((todo) => todo.id));
    let candidateId = globalThis.crypto.randomUUID();
    while (existingIds.has(candidateId)) {
      candidateId = globalThis.crypto.randomUUID();
    }
    return candidateId;
  }

  /**
   * Validates a single persisted version 2 Todo record from storage.
   * Rejects missing required properties, duplicate dueDates, non-persisted null IDs,
   * or any model invariant violation with `StorageCorruptionError`.
   *
   * @param {unknown} rawRecord
   * @param {number} index
   * @param {string | null} rawContent
   * @returns {ReturnType<typeof createTaskModel>}
   */
  _validateStoredV2Record(rawRecord, index, rawContent) {
    if (!isPlainObject(rawRecord)) {
      throw new StorageCorruptionError(
        `Stored Todo at index ${index} is not an object.`,
        rawContent
      );
    }

    for (const requiredKey of TASK_MODEL_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(rawRecord, requiredKey)) {
        throw new StorageCorruptionError(
          `Stored Todo at index ${index} is missing required field "${requiredKey}".`,
          rawContent
        );
      }
    }

    for (const key of Object.keys(rawRecord)) {
      if (!TASK_MODEL_FIELDS.includes(key)) {
        throw new StorageCorruptionError(
          `Stored Todo at index ${index} contains unknown field "${key}".`,
          rawContent
        );
      }
    }

    if (typeof rawRecord.id !== 'string' || rawRecord.id.trim().length === 0) {
      throw new StorageCorruptionError(
        `Stored Todo at index ${index} has an invalid or empty id.`,
        rawContent
      );
    }

    if (!Array.isArray(rawRecord.dueDates)) {
      throw new StorageCorruptionError(
        `Stored Todo at index ${index} has a non-array dueDates field.`,
        rawContent
      );
    }

    if (new Set(rawRecord.dueDates).size !== rawRecord.dueDates.length) {
      throw new StorageCorruptionError(
        `Stored Todo at index ${index} contains duplicate entries in dueDates.`,
        rawContent
      );
    }

    try {
      return createTaskModel(rawRecord);
    } catch (err) {
      throw new StorageCorruptionError(
        `Stored Todo at index ${index} failed model validation: ${err.message}`,
        rawContent
      );
    }
  }

  /**
   * Validates a complete version 2 envelope object `{ schemaVersion: 2, todos: Todo[] }`.
   *
   * @param {unknown} envelope
   * @param {string | null} rawContent
   * @returns {Array<ReturnType<typeof createTaskModel>>}
   */
  _validateV2Envelope(envelope, rawContent) {
    if (!isPlainObject(envelope)) {
      throw new StorageCorruptionError(
        'Stored envelope must be a JSON object.',
        rawContent
      );
    }

    for (const key of Object.keys(envelope)) {
      if (!ALLOWED_ENVELOPE_FIELDS.includes(key)) {
        throw new StorageCorruptionError(
          `Stored envelope contains unexpected property "${key}".`,
          rawContent
        );
      }
    }

    if (envelope.schemaVersion !== this.SCHEMA_VERSION) {
      throw new StorageCorruptionError(
        `Expected schemaVersion ${this.SCHEMA_VERSION}, received ${String(envelope.schemaVersion)}.`,
        rawContent
      );
    }

    if (!Array.isArray(envelope.todos)) {
      throw new StorageCorruptionError(
        'Stored envelope "todos" property must be an array.',
        rawContent
      );
    }

    const seenIds = new Set();
    const validatedTodos = [];

    for (let i = 0; i < envelope.todos.length; i += 1) {
      const validated = this._validateStoredV2Record(
        envelope.todos[i],
        i,
        rawContent
      );
      if (seenIds.has(validated.id)) {
        throw new StorageCorruptionError(
          `Duplicate task id "${validated.id}" found in stored envelope.`,
          rawContent
        );
      }
      seenIds.add(validated.id);
      validatedTodos.push(validated);
    }

    return validatedTodos;
  }

  /**
   * Migrates a version 1 envelope (`{ schemaVersion: 1, todos: [...] }`) to version 2.
   * Validates the complete migrated version 2 envelope before persisting it.
   *
   * @param {Record<string, unknown>} v1Envelope
   * @param {string} rawContent
   * @returns {Array<ReturnType<typeof createTaskModel>>}
   */
  _migrateV1Envelope(v1Envelope, rawContent) {
    for (const key of Object.keys(v1Envelope)) {
      if (!ALLOWED_ENVELOPE_FIELDS.includes(key)) {
        throw new StorageCorruptionError(
          `Version 1 envelope contains unexpected property "${key}".`,
          rawContent
        );
      }
    }

    if (!Array.isArray(v1Envelope.todos)) {
      throw new StorageCorruptionError(
        'Version 1 envelope "todos" property must be an array.',
        rawContent
      );
    }

    const migratedRawTodos = [];

    for (let i = 0; i < v1Envelope.todos.length; i += 1) {
      const v1Record = v1Envelope.todos[i];
      if (!isPlainObject(v1Record)) {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} is not an object.`,
          rawContent
        );
      }

      for (const key of Object.keys(v1Record)) {
        if (!ALLOWED_V1_RECORD_FIELDS.includes(key)) {
          throw new StorageCorruptionError(
            `Version 1 Todo at index ${i} contains unsupported property "${key}".`,
            rawContent
          );
        }
      }

      if (typeof v1Record.id !== 'string' || v1Record.id.trim().length === 0) {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} has an invalid or missing id.`,
          rawContent
        );
      }

      if (typeof v1Record.title !== 'string') {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} has a missing or non-string title.`,
          rawContent
        );
      }

      const description =
        v1Record.description === undefined ? '' : v1Record.description;
      if (typeof description !== 'string') {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} has a non-string description.`,
          rawContent
        );
      }

      if (typeof v1Record.completed !== 'boolean') {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} has a non-boolean completed status.`,
          rawContent
        );
      }

      if (!Object.prototype.hasOwnProperty.call(v1Record, 'date')) {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} is missing the legacy "date" field.`,
          rawContent
        );
      }

      let dueDates;
      if (v1Record.date === null) {
        dueDates = [];
      } else if (typeof v1Record.date === 'string') {
        dueDates = [v1Record.date];
      } else {
        throw new StorageCorruptionError(
          `Version 1 Todo at index ${i} has an invalid "date" value.`,
          rawContent
        );
      }

      migratedRawTodos.push({
        id: v1Record.id,
        title: v1Record.title,
        description,
        dueDates,
        completed: v1Record.completed,
        completedAt: null,
      });
    }

    const migratedEnvelope = {
      schemaVersion: this.SCHEMA_VERSION,
      todos: migratedRawTodos,
    };

    // Validate the complete migrated v2 envelope before writing anything to LocalStorage.
    const validatedTodos = this._validateV2Envelope(migratedEnvelope, rawContent);

    // Persist the migrated v2 envelope via a single setItem write.
    this._writeEnvelope(validatedTodos);

    return validatedTodos;
  }

  /**
   * Reads, parses, validates, and (if version 1) migrates the stored envelope.
   * Returns an empty array when the storage key is absent on first run.
   *
   * @returns {Array<ReturnType<typeof createTaskModel>>}
   */
  _readValidatedTodos() {
    const storage = this._getStorage(['getItem']);

    let rawContent;
    try {
      rawContent = storage.getItem(this.storageKey);
    } catch (err) {
      throw new StorageError(
        `Failed to read key "${this.storageKey}" from LocalStorage.`,
        err
      );
    }

    if (rawContent === null) {
      return [];
    }

    if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
      throw new StorageCorruptionError(
        'Stored data is empty or not a valid JSON string.',
        rawContent
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new StorageCorruptionError(
        'Stored data contains malformed JSON.',
        rawContent
      );
    }

    if (!isPlainObject(parsed)) {
      throw new StorageCorruptionError(
        'Stored envelope must be a JSON object.',
        rawContent
      );
    }

    if (parsed.schemaVersion === 1) {
      return this._migrateV1Envelope(parsed, rawContent);
    }

    if (parsed.schemaVersion === this.SCHEMA_VERSION) {
      return this._validateV2Envelope(parsed, rawContent);
    }

    throw new StorageCorruptionError(
      `Unsupported schemaVersion: ${String(parsed.schemaVersion)}.`,
      rawContent
    );
  }

  /**
   * Serializes and writes the complete version 2 envelope in one `localStorage.setItem` call.
   *
   * @param {readonly object[]} todos
   */
  _writeEnvelope(todos) {
    const storage = this._getStorage(['setItem']);

    const envelope = {
      schemaVersion: this.SCHEMA_VERSION,
      todos: todos.map((todo) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        dueDates: [...todo.dueDates],
        completed: todo.completed,
        completedAt: todo.completedAt,
      })),
    };

    let serialized;
    try {
      serialized = JSON.stringify(envelope);
    } catch (err) {
      throw new StorageError('Failed to serialize Todo storage envelope.', err);
    }

    try {
      storage.setItem(this.storageKey, serialized);
    } catch (err) {
      throw new StorageError(
        `Failed to write key "${this.storageKey}" to LocalStorage.`,
        err
      );
    }
  }

  /**
   * Validates a candidate Todo record's domain fields (`title`, `description`, `dueDates`,
   * `completed`, `completedAt`) and constructs an immutable `Todo` via `createTaskModel`.
   * Throws `DomainValidationError` with the specific offending `field` name on failure.
   *
   * @param {Readonly<{
   *   id: string,
   *   title: unknown,
   *   description?: unknown,
   *   dueDates?: unknown,
   *   completed?: unknown,
   *   completedAt?: unknown
   * }>} candidate
   * @returns {ReturnType<typeof createTaskModel>}
   */
  _validateAndBuildDomainRecord(candidate) {
    const inputValidation = validateTaskInput({
      title: candidate.title,
      description:
        candidate.description === undefined ? '' : candidate.description,
      dueDates: candidate.dueDates === undefined ? [] : candidate.dueDates,
    });

    if (!inputValidation.titleResult.valid) {
      throw new DomainValidationError(
        'title',
        `Invalid task title (${inputValidation.titleResult.reason}).`
      );
    }

    if (!inputValidation.descriptionResult.valid) {
      throw new DomainValidationError(
        'description',
        `Invalid task description (${inputValidation.descriptionResult.reason}).`
      );
    }

    if (!inputValidation.dueDatesResult.valid) {
      throw new DomainValidationError(
        'dueDates',
        `Invalid task dueDates (${inputValidation.dueDatesResult.reason}).`
      );
    }

    const completed =
      candidate.completed === undefined ? false : candidate.completed;
    if (typeof completed !== 'boolean') {
      throw new DomainValidationError(
        'completed',
        'Task completed status must be a boolean.'
      );
    }

    const completedAt =
      candidate.completedAt === undefined ? null : candidate.completedAt;

    if (!completed && completedAt !== null) {
      throw new DomainValidationError(
        'completedAt',
        'completedAt must be null when completed is false.'
      );
    }

    if (
      completed &&
      completedAt !== null &&
      !isValidCompletionTimestamp(completedAt)
    ) {
      throw new DomainValidationError(
        'completedAt',
        'completedAt must be a valid UTC ISO-8601 timestamp string or null when completed is true.'
      );
    }

    try {
      return createTaskModel({
        id: candidate.id,
        title: inputValidation.normalizedInput.title,
        description: inputValidation.normalizedInput.description,
        dueDates: inputValidation.normalizedInput.dueDates,
        completed,
        completedAt:
          typeof completedAt === 'string' ? completedAt.trim() : null,
      });
    } catch (err) {
      throw new DomainValidationError('todoData', err.message);
    }
  }

  /**
   * Validates that an input/changes object is a plain object, does not attempt to set/modify `id`,
   * and contains only allowed Todo domain fields.
   *
   * @param {unknown} payload
   * @param {string} argumentName
   * @param {boolean} requireAtLeastOneField
   */
  _validateMutationPayloadShape(payload, argumentName, requireAtLeastOneField) {
    if (!isPlainObject(payload)) {
      throw new DomainValidationError(
        argumentName,
        `${argumentName} must be a non-null plain object.`
      );
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'id')) {
      throw new DomainValidationError(
        'id',
        'Task id is generated by the repository and cannot be set or modified.'
      );
    }

    const keys = Object.keys(payload);
    if (requireAtLeastOneField && keys.length === 0) {
      throw new DomainValidationError(
        argumentName,
        `${argumentName} must specify at least one field to update.`
      );
    }

    for (const key of keys) {
      if (!ALLOWED_MUTATION_FIELDS.includes(key)) {
        throw new DomainValidationError(
          key,
          `Unknown or disallowed task field "${key}".`
        );
      }
    }
  }

  /**
   * Asynchronously returns validated copies of all persisted Todo records.
   *
   * @returns {Promise<Array<ReturnType<typeof createTaskModel>>>}
   */
  async getAll() {
    const todos = this._readValidatedTodos();
    return todos.map(cloneTodoRecord);
  }

  /**
   * Creates a new Todo record, generates its `id` via `crypto.randomUUID()`,
   * persists the complete envelope, and returns a copy of the saved Todo.
   *
   * @param {Readonly<{
   *   title: string,
   *   description?: string,
   *   dueDates?: readonly string[],
   *   completed?: boolean,
   *   completedAt?: string | null
   * }>} todoData
   * @returns {Promise<ReturnType<typeof createTaskModel>>}
   */
  async create(todoData, { beforePersist } = {}) {
    this._validateMutationPayloadShape(todoData, 'todoData', false);

    const currentTodos = this._readValidatedTodos();
    const id = this._generateId(currentTodos);

    const newTodo = this._validateAndBuildDomainRecord({
      id,
      title: todoData.title,
      description: todoData.description,
      dueDates: todoData.dueDates,
      completed: todoData.completed,
      completedAt: todoData.completedAt,
    });

    const nextTodos = [...currentTodos, newTodo];
    if (typeof beforePersist === 'function') {
      await beforePersist({ operationType: 'create', beforeTodos: [], afterTodos: [newTodo] });
    }
    this._writeEnvelope(nextTodos);

    return cloneTodoRecord(newTodo);
  }

  /** Restore an exact validated snapshot by its existing repository-generated ID. */
  async restoreTodoSnapshot(todoSnapshot, { beforePersist, operationType = 'recovery' } = {}) {
    if (!isPlainObject(todoSnapshot) || typeof todoSnapshot.id !== 'string' || todoSnapshot.id.trim() === '') {
      throw new DomainValidationError('todoSnapshot', 'Recovery snapshot must contain a task ID.');
    }
    const currentTodos = this._readValidatedTodos();
    const restoredTodo = this._validateAndBuildDomainRecord(todoSnapshot);
    const existingIndex = currentTodos.findIndex((todo) => todo.id === restoredTodo.id);
    const existingTodo = existingIndex >= 0 ? currentTodos[existingIndex] : null;
    if (existingTodo && JSON.stringify(existingTodo) === JSON.stringify(restoredTodo)) {
      return cloneTodoRecord(existingTodo);
    }
    const nextTodos = [...currentTodos];
    if (existingIndex >= 0) nextTodos[existingIndex] = restoredTodo;
    else nextTodos.push(restoredTodo);
    if (typeof beforePersist === 'function') {
      await beforePersist({
        operationType,
        beforeTodos: existingTodo ? [existingTodo] : [],
        afterTodos: [restoredTodo],
        metadata: { recoveryOfTodoId: restoredTodo.id },
      });
    }
    this._writeEnvelope(nextTodos);
    return cloneTodoRecord(restoredTodo);
  }

  /**
   * Updates allowed fields of an existing Todo record and returns a copy of the persisted Todo.
   *
   * @param {string} id
   * @param {Readonly<{
   *   title?: string,
   *   description?: string,
   *   dueDates?: readonly string[],
   *   completed?: boolean,
   *   completedAt?: string | null
   * }>} changes
   * @returns {Promise<ReturnType<typeof createTaskModel>>}
   */
  async update(id, changes, { beforePersist, operationType = 'update', metadata = {} } = {}) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new DomainValidationError(
        'id',
        'Task id must be a non-empty string.'
      );
    }

    this._validateMutationPayloadShape(changes, 'changes', true);

    const currentTodos = this._readValidatedTodos();
    const targetIndex = currentTodos.findIndex((todo) => todo.id === id);

    if (targetIndex === -1) {
      throw new DomainValidationError(
        'id',
        `Task with id "${id}" does not exist.`
      );
    }

    const existing = currentTodos[targetIndex];
    const nextCompleted =
      changes.completed !== undefined ? changes.completed : existing.completed;
    const nextCompletedAt =
      changes.completedAt !== undefined
        ? changes.completedAt
        : nextCompleted === false
          ? null
          : existing.completedAt;

    const updatedTodo = this._validateAndBuildDomainRecord({
      id: existing.id,
      title: changes.title !== undefined ? changes.title : existing.title,
      description:
        changes.description !== undefined
          ? changes.description
          : existing.description,
      dueDates:
        changes.dueDates !== undefined ? changes.dueDates : existing.dueDates,
      completed: nextCompleted,
      completedAt: nextCompletedAt,
    });

    const nextTodos = [...currentTodos];
    nextTodos[targetIndex] = updatedTodo;

    if (typeof beforePersist === 'function') {
      await beforePersist({ operationType, beforeTodos: [existing], afterTodos: [updatedTodo], metadata });
    }
    this._writeEnvelope(nextTodos);

    return cloneTodoRecord(updatedTodo);
  }

  /**
   * Atomically updates the retained target Todo and removes the absorbed source Todo
   * in a single complete-envelope write, returning a copy of the saved target Todo.
   *
   * @param {string} sourceId
   * @param {string} targetId
   * @param {Readonly<{
   *   title?: string,
   *   description?: string,
   *   dueDates?: readonly string[],
   *   completed?: boolean,
   *   completedAt?: string | null
   * }>} targetChanges
   * @returns {Promise<ReturnType<typeof createTaskModel>>}
   */
  async merge(sourceId, targetId, targetChanges, { beforePersist, operationType = 'merge', metadata = {} } = {}) {
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0) {
      throw new DomainValidationError(
        'sourceId',
        'sourceId must be a non-empty string.'
      );
    }

    if (typeof targetId !== 'string' || targetId.trim().length === 0) {
      throw new DomainValidationError(
        'targetId',
        'targetId must be a non-empty string.'
      );
    }

    if (sourceId === targetId) {
      throw new DomainValidationError(
        'targetId',
        'sourceId and targetId must refer to distinct tasks.'
      );
    }

    this._validateMutationPayloadShape(targetChanges, 'targetChanges', true);

    const currentTodos = this._readValidatedTodos();
    const sourceIndex = currentTodos.findIndex((todo) => todo.id === sourceId);
    if (sourceIndex === -1) {
      throw new DomainValidationError(
        'sourceId',
        `Source task with id "${sourceId}" does not exist.`
      );
    }

    const targetIndex = currentTodos.findIndex((todo) => todo.id === targetId);
    if (targetIndex === -1) {
      throw new DomainValidationError(
        'targetId',
        `Target task with id "${targetId}" does not exist.`
      );
    }

    const existingTarget = currentTodos[targetIndex];
    const nextCompleted =
      targetChanges.completed !== undefined
        ? targetChanges.completed
        : existingTarget.completed;
    const nextCompletedAt =
      targetChanges.completedAt !== undefined
        ? targetChanges.completedAt
        : nextCompleted === false
          ? null
          : existingTarget.completedAt;

    const updatedTarget = this._validateAndBuildDomainRecord({
      id: existingTarget.id,
      title:
        targetChanges.title !== undefined
          ? targetChanges.title
          : existingTarget.title,
      description:
        targetChanges.description !== undefined
          ? targetChanges.description
          : existingTarget.description,
      dueDates:
        targetChanges.dueDates !== undefined
          ? targetChanges.dueDates
          : existingTarget.dueDates,
      completed: nextCompleted,
      completedAt: nextCompletedAt,
    });

    const nextTodos = [];
    for (const todo of currentTodos) {
      if (todo.id === sourceId) {
        continue;
      }
      if (todo.id === targetId) {
        nextTodos.push(updatedTarget);
      } else {
        nextTodos.push(todo);
      }
    }

    if (typeof beforePersist === 'function') {
      await beforePersist({
          operationType,
        beforeTodos: [currentTodos[sourceIndex], existingTarget],
        afterTodos: [updatedTarget],
        metadata: { ...metadata, sourceTodoId: sourceId, targetTodoId: targetId },
      });
    }
    this._writeEnvelope(nextTodos);

    return cloneTodoRecord(updatedTarget);
  }

  /**
   * Batch deletes Todo records by ID. May partially succeed if some IDs are invalid or not found.
   * Persists all valid deletions in a single complete-envelope write.
   *
   * @param {readonly string[]} ids
   * @returns {Promise<{
   *   deletedIds: string[],
   *   failures: Array<{ id: string, message: string }>
   * }>}
   */
  async deleteMany(ids, { beforePersist, operationIdByTaskId = {} } = {}) {
    if (!Array.isArray(ids)) {
      throw new DomainValidationError(
        'ids',
        'ids must be an array of task IDs.'
      );
    }

    const currentTodos = this._readValidatedTodos();
    const existingById = new Map(currentTodos.map((todo) => [todo.id, todo]));

    const deletedIds = [];
    const deletedSet = new Set();
    const failures = [];

    for (const rawId of ids) {
      if (typeof rawId !== 'string' || rawId.trim().length === 0) {
        failures.push({
          id: String(rawId),
          message: 'Task ID must be a non-empty string.',
        });
        continue;
      }

      if (deletedSet.has(rawId)) {
        continue;
      }

      if (!existingById.has(rawId)) {
        failures.push({
          id: rawId,
          message: `Task with id "${rawId}" was not found.`,
        });
        continue;
      }

      deletedSet.add(rawId);
      deletedIds.push(rawId);
    }

    if (deletedIds.length > 0) {
      if (typeof beforePersist === 'function') {
        const deletedTodos = deletedIds.map((id) => existingById.get(id));
        await beforePersist({
          operationType: 'delete',
          beforeTodos: deletedTodos,
          afterTodos: [],
          operationIdByTaskId,
        });
      }
      const nextTodos = currentTodos.filter((todo) => !deletedSet.has(todo.id));
      this._writeEnvelope(nextTodos);
    }

    return {
      deletedIds,
      failures,
    };
  }

  /**
   * Explicit user-triggered recovery operation that removes only this adapter's `storageKey`.
   * Never calls `localStorage.clear()` and never runs automatically.
   *
   * @returns {Promise<void>}
   */
  async resetStorage() {
    const storage = this._getStorage(['removeItem']);
    try {
      storage.removeItem(this.storageKey);
    } catch (err) {
      throw new StorageError(
        `Failed to remove key "${this.storageKey}" from LocalStorage.`,
        err
      );
    }
  }
}

export default LocalStorageTodoRepository;
