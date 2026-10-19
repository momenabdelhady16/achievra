import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LocalStorageTodoRepository } from '../js/repositories/LocalStorageTodoRepository.js';
import { LocalStorageTodoOperationLogRepository } from '../js/repositories/LocalStorageTodoOperationLogRepository.js';
import { OperationLogCorruptionError } from '../js/repositories/TodoOperationLogRepository.js';
import { TodoService } from '../js/services/TodoService.js';
import { TodoOperationLogService } from '../js/services/TodoOperationLogService.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.beforeWrite = null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.beforeWrite?.(key, value);
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const originalLocalStorage = globalThis.localStorage;
let memoryStorage;

function installStorage() {
  memoryStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  });
  return memoryStorage;
}

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

describe('Todo operation journal', () => {
  it('writes the generated task ID and complete metadata before the task envelope', async () => {
    const storage = installStorage();
    const taskRepository = new LocalStorageTodoRepository();
    const logRepository = new LocalStorageTodoOperationLogRepository();
    const operationLog = new TodoOperationLogService(logRepository);
    const service = new TodoService(taskRepository, operationLog);
    let taskWriteObserved = false;

    storage.beforeWrite = (key) => {
      if (key !== taskRepository.storageKey) return;
      const loggedEntries = JSON.parse(storage.getItem(logRepository.storageKey)).entries;
      assert.equal(loggedEntries.length, 1);
      assert.equal(loggedEntries[0].status, 'prepared');
      assert.ok(loggedEntries[0].taskId);
      assert.equal(loggedEntries[0].after[0].id, loggedEntries[0].taskId);
      taskWriteObserved = true;
    };

    const result = await service.createTodo({
      title: 'Plan release',
      description: 'Prepare notes',
      dueDates: ['2027-01-15'],
    });

    assert.equal(result.status, 'created');
    assert.equal(taskWriteObserved, true);
    const [entry] = await operationLog.getAll();
    assert.equal(entry.status, 'committed');
    assert.equal(entry.metadata.outcome.completed, true);
    assert.equal(entry.metadata.snapshots.persisted[0].descriptionCharacterCount, 13);
    assert.equal(entry.metadata.snapshots.persisted[0].descriptionRemainingCharacterCount, 243);
    assert.deepEqual(entry.metadata.changesByTaskId[result.todo.id], ['record']);
  });

  it('loads saved tasks through a fresh repository instance after a simulated page reload', async () => {
    installStorage();
    const firstRepository = new LocalStorageTodoRepository();
    const firstLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const firstService = new TodoService(firstRepository, firstLog);
    const created = await firstService.createTodo({
      title: 'Survive reload', description: 'Persistent notes', dueDates: [],
    });

    const reloadedLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const reloadedService = new TodoService(new LocalStorageTodoRepository(), reloadedLog);
    const reloadedLists = await reloadedService.getTaskLists();

    assert.equal(reloadedLists.pendingTodos.length, 1);
    assert.equal(reloadedLists.pendingTodos[0].id, created.todo.id);
    assert.equal(reloadedLists.pendingTodos[0].description, 'Persistent notes');
  });

  it('records storage failures before the repository hook with proposed fields and no invented ID', async () => {
    const storage = installStorage();
    const logRepository = new LocalStorageTodoOperationLogRepository();
    const operationLog = new TodoOperationLogService(logRepository);
    const taskRepository = new LocalStorageTodoRepository();
    const service = new TodoService(taskRepository, operationLog);
    storage.getItem = (key) => {
      if (key === taskRepository.storageKey) throw new Error('Task storage unavailable');
      return storage.values.has(key) ? storage.values.get(key) : null;
    };

    await assert.rejects(
      service.createTodo({ title: 'Keep draft', description: 'Draft text', dueDates: [] }),
      /Failed to read key/,
    );

    const [entry] = await operationLog.getAll();
    assert.equal(entry.status, 'failed');
    assert.equal(entry.taskId, null);
    assert.equal(entry.proposed.title, 'Keep draft');
    assert.equal(entry.proposed.description, 'Draft text');
    assert.equal(entry.proposed.descriptionCharacterCount, 10);
    assert.equal(entry.metadata.validation.passed, null);
    assert.equal(entry.metadata.persistence.failureKind, 'storage');
    assert.deepEqual(await operationLog.getUnresolved(), [entry]);
  });

  it('logs duplicate and confirmation-required results as completed non-persistence outcomes', async () => {
    installStorage();
    const taskRepository = new LocalStorageTodoRepository();
    const initial = await taskRepository.create({ title: 'Read', description: 'Book', dueDates: [] });
    const operationLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const service = new TodoService(taskRepository, operationLog);

    const duplicate = await service.createTodo({ title: 'Read', description: '', dueDates: [] });
    const confirmation = await service.createTodo({ title: 'Read', description: 'Another note', dueDates: [] });

    assert.equal(duplicate.status, 'duplicate');
    assert.equal(confirmation.status, 'confirmation-required');
    const entries = await operationLog.getAll();
    assert.deepEqual(entries.map((entry) => entry.status), ['duplicate', 'confirmation-required']);
    assert.ok(entries.every((entry) => entry.taskId === initial.id));
    assert.ok(entries.every((entry) => entry.metadata.outcome.completed === false));
    assert.deepEqual(await operationLog.getUnresolved(), []);
  });

  it('journals updates and completion with before/after snapshots and changed fields', async () => {
    installStorage();
    const taskRepository = new LocalStorageTodoRepository();
    const saved = await taskRepository.create({ title: 'Draft', description: '', dueDates: [] });
    const operationLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const service = new TodoService(taskRepository, operationLog);

    const update = await service.updatePendingTodo(saved.id, { title: 'Revised' });
    const completion = await service.completeTodos([saved.id]);
    const entries = await operationLog.getAll();

    assert.equal(update.status, 'updated');
    assert.equal(completion.completed[0].completed, true);
    assert.deepEqual(entries.map((entry) => entry.operationType), ['update', 'complete']);
    assert.ok(entries.every((entry) => entry.status === 'committed'));
    assert.deepEqual(entries[0].metadata.changesByTaskId[saved.id], ['title']);
    assert.equal(entries[0].before[0].title, 'Draft');
    assert.equal(entries[0].after[0].title, 'Revised');
    assert.equal(entries[1].after[0].completed, true);
    assert.equal(entries[1].metadata.outcome.completed, true);
  });

  it('journals an atomic merge with both source records and the saved target', async () => {
    installStorage();
    const taskRepository = new LocalStorageTodoRepository();
    const source = await taskRepository.create({ title: 'Old title', description: 'Old notes', dueDates: [] });
    const target = await taskRepository.create({ title: 'Target', description: '', dueDates: [] });
    const operationLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const service = new TodoService(taskRepository, operationLog);

    const result = await service.updatePendingTodo(source.id, { title: 'Target', description: 'New notes' }, {
      confirmMerge: true,
    });
    const [entry] = await operationLog.getAll();
    const remaining = await taskRepository.getAll();

    assert.equal(result.status, 'merged');
    assert.deepEqual(entry.relatedTaskIds.sort(), [source.id, target.id].sort());
    assert.equal(entry.operationType, 'merge');
    assert.equal(entry.status, 'committed');
    assert.equal(entry.before.length, 2);
    assert.equal(entry.after.length, 1);
    assert.equal(entry.after[0].id, target.id);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].description, 'New notes');
  });

  it('retains the prepared snapshots and failure details when task persistence fails', async () => {
    const storage = installStorage();
    const taskRepository = new LocalStorageTodoRepository();
    const operationLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const service = new TodoService(taskRepository, operationLog);
    storage.beforeWrite = (key) => {
      if (key === taskRepository.storageKey) throw new Error('Quota exceeded');
    };

    await assert.rejects(
      service.createTodo({ title: 'Retain me', description: 'Keep this draft', dueDates: [] }),
      /Failed to write key/,
    );
    const [entry] = await operationLog.getAll();
    assert.equal(entry.status, 'failed');
    assert.equal(entry.metadata.persistence.failureKind, 'storage');
    assert.match(entry.metadata.persistence.errorMessage, /Failed to write key/);
    assert.equal(entry.after[0].title, 'Retain me');
    assert.ok(entry.taskId);
    assert.deepEqual(await taskRepository.getAll(), []);
  });

  it('does not write task data when the write-ahead callback fails', async () => {
    const storage = installStorage();
    const repository = new LocalStorageTodoRepository();
    await assert.rejects(
      repository.create({ title: 'No write', description: '', dueDates: [] }, {
        beforePersist: async () => { throw new Error('Journal rejected intent'); },
      }),
      /Journal rejected intent/,
    );
    assert.equal(storage.getItem(repository.storageKey), null);
  });

  it('persists per-task delete grace, undo, restart, and commit metadata', async () => {
    installStorage();
    const operationLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const todo = {
      id: 'task-1', title: 'Delete me', description: 'Details', dueDates: [],
      completed: false, completedAt: null,
    };
    const operationId = await operationLog.recordPendingDelete(todo);
    let [entry] = await operationLog.getAll();
    assert.equal(entry.status, 'delete-pending');
    assert.equal(entry.metadata.delete.gracePeriodMs, 5000);
    assert.equal(entry.before[0].id, todo.id);

    await operationLog.markUndone(operationId);
    [entry] = await operationLog.getAll();
    assert.equal(entry.status, 'undone');
    assert.equal(entry.metadata.delete.undoRequestedAt.length > 0, true);

    await operationLog.restartPendingDelete(operationId);
    await operationLog.markCommitRequested(operationId);
    await operationLog.markCommitted(operationId, []);
    [entry] = await operationLog.getAll();
    assert.equal(entry.status, 'committed');
    assert.equal(entry.metadata.outcome.completed, true);
    assert.equal(entry.after.length, 0);
  });

  it('resumes a pending delete after reload but does not retry a failed delete', async () => {
    installStorage();
    const repository = new LocalStorageTodoRepository();
    const todo = await repository.create({ title: 'Keep after failed delete', dueDates: [] });
    const operationLog = new TodoOperationLogService(new LocalStorageTodoOperationLogRepository());
    const pendingOperationId = await operationLog.recordPendingDelete(todo);

    assert.equal((await operationLog.getUnresolved()).some((entry) => entry.operationId === pendingOperationId), true);

    await operationLog.markCommitRequested(pendingOperationId);
    await operationLog.markFailed(pendingOperationId, new Error('Storage write failed'));

    assert.deepEqual(await operationLog.getUnresolved(), []);
    assert.equal((await repository.getAll()).some((savedTodo) => savedTodo.id === todo.id), true);
    assert.equal((await operationLog.getAll())[0].status, 'failed');
  });

  it('rejects a malformed journal instead of overwriting it', async () => {
    const storage = installStorage();
    const repository = new LocalStorageTodoOperationLogRepository();
    storage.setItem(repository.storageKey, '{broken');
    await assert.rejects(repository.getAll(), OperationLogCorruptionError);
    assert.equal(storage.getItem(repository.storageKey), '{broken');
  });
});
