/**
 * Achievra — Stage 3 Repository Contract & Error Taxonomy (`js/repositories/TodoRepository.js`)
 *
 * Storage-independent asynchronous repository contract and shared error classes.
 * This module must not reference LocalStorage, JSON serialization, the DOM, or UI state.
 */

/**
 * Domain/model validation or business-rule error raised when task fields,
 * record shapes, immutable-ID constraints, or method arguments are invalid.
 */
export class DomainValidationError extends Error {
  /**
   * @param {string} field - Associated field or argument name (e.g., 'title', 'description', 'dueDates', 'id')
   * @param {string} message - Actionable validation error message
   */
  constructor(field, message) {
    super(message);
    this.name = 'DomainValidationError';
    this.field = field;
  }
}

/**
 * Persistence error raised when storage access is denied, quota is exceeded,
 * or a read/write/serialization operation fails.
 */
export class StorageError extends Error {
  /**
   * @param {string} message - User-displayable or diagnostic storage failure message
   * @param {unknown} [originalError=null] - Underlying platform error when available
   */
  constructor(message, originalError = null) {
    super(message);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

/**
 * Corruption error raised when stored data contains malformed JSON, an invalid envelope,
 * invalid Todo records, or an unsupported schemaVersion.
 */
export class StorageCorruptionError extends StorageError {
  /**
   * @param {string} message - Diagnostic explanation of the corruption
   * @param {string | null} [rawContent=null] - Original raw stored string when available
   */
  constructor(message, rawContent = null) {
    super(message, null);
    this.name = 'StorageCorruptionError';
    this.rawContent = rawContent;
  }
}

/**
 * Abstract asynchronous repository contract for Todo persistence.
 * Concrete adapters (such as LocalStorageTodoRepository or a future database adapter)
 * must implement these methods and return detached copies rather than mutable internal references.
 */
export class TodoRepository {
  /**
   * Asynchronously returns validated copies of all persisted Todo records.
   *
   * @returns {Promise<Array<Readonly<{
   *   id: string,
   *   title: string,
   *   description: string,
   *   dueDates: ReadonlyArray<string>,
   *   completed: boolean,
   *   completedAt: string | null
   * }>>>}
   */
  async getAll() {
    throw new Error('TodoRepository.getAll() must be implemented by a concrete repository adapter.');
  }

  /**
   * Creates a new Todo record, generates its unique `id`, persists it,
   * and returns a copy of the saved Todo.
   *
   * @param {Readonly<{
   *   title: string,
   *   description?: string,
   *   dueDates?: readonly string[],
   *   completed?: boolean,
   *   completedAt?: string | null
   * }>} todoData - Task data without an `id`
   * @returns {Promise<Readonly<{
   *   id: string,
   *   title: string,
   *   description: string,
   *   dueDates: ReadonlyArray<string>,
   *   completed: boolean,
   *   completedAt: string | null
   * }>>}
   */
  async create(todoData, options = {}) {
    void todoData;
    void options;
    throw new Error('TodoRepository.create() must be implemented by a concrete repository adapter.');
  }

  /**
   * Updates allowed fields of an existing Todo record identified by `id`
   * and returns a copy of the persisted Todo. `id` is immutable.
   *
   * @param {string} id - Immutable repository-generated task identifier
   * @param {Readonly<{
   *   title?: string,
   *   description?: string,
   *   dueDates?: readonly string[],
   *   completed?: boolean,
   *   completedAt?: string | null
   * }>} changes - Allowed fields to update on the existing record
   * @returns {Promise<Readonly<{
   *   id: string,
   *   title: string,
   *   description: string,
   *   dueDates: ReadonlyArray<string>,
   *   completed: boolean,
   *   completedAt: string | null
   * }>>}
   */
  async update(id, changes, options = {}) {
    void id;
    void changes;
    void options;
    throw new Error('TodoRepository.update() must be implemented by a concrete repository adapter.');
  }

  /**
   * Atomically updates the retained target Todo record and removes the absorbed
   * source Todo record, returning a copy of the saved target Todo.
   * On failure, neither record is partially modified.
   *
   * @param {string} sourceId - ID of the task absorbed and removed during the merge
   * @param {string} targetId - ID of the existing task retained by the merge
   * @param {Readonly<{
   *   title?: string,
   *   description?: string,
   *   dueDates?: readonly string[],
   *   completed?: boolean,
   *   completedAt?: string | null
   * }>} targetChanges - Resulting fields for the retained target task
   * @returns {Promise<Readonly<{
   *   id: string,
   *   title: string,
   *   description: string,
   *   dueDates: ReadonlyArray<string>,
   *   completed: boolean,
   *   completedAt: string | null
   * }>>}
   */
  async merge(sourceId, targetId, targetChanges, options = {}) {
    void sourceId;
    void targetId;
    void targetChanges;
    void options;
    throw new Error('TodoRepository.merge() must be implemented by a concrete repository adapter.');
  }

  /**
   * Deletes multiple Todo records by ID. May partially succeed when some IDs
   * are invalid or missing; returns both deleted IDs and per-ID failure details.
   *
   * @param {readonly string[]} ids - List of Todo IDs to delete
   * @returns {Promise<{
   *   deletedIds: string[],
   *   failures: Array<{ id: string, message: string }>
   * }>}
   */
  async deleteMany(ids, options = {}) {
    void ids;
    void options;
    throw new Error('TodoRepository.deleteMany() must be implemented by a concrete repository adapter.');
  }

  /**
   * Idempotently restore one already-validated task snapshot during operation-log recovery.
   * This is an internal recovery path; normal creates still generate their IDs in create().
   * @param {Readonly<object>} todoSnapshot
   * @returns {Promise<Readonly<object>>}
   */
  async restoreTodoSnapshot(todoSnapshot, options = {}) {
    void todoSnapshot;
    void options;
    throw new Error('TodoRepository.restoreTodoSnapshot() must be implemented by a concrete repository adapter.');
  }

  /**
   * Optional explicit user-triggered recovery operation that removes only
   * the adapter's underlying storage data. Never called automatically.
   *
   * @returns {Promise<void>}
   */
  async resetStorage() {
    throw new Error('TodoRepository.resetStorage() must be implemented by a concrete repository adapter.');
  }
}

export default TodoRepository;
