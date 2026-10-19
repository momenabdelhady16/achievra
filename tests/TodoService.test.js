/**
 * Isolated TodoService tests using a fake TodoRepository.
 * No browser, DOM, LocalStorage, or network.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createCalendarDate } from '../js/utils/dateUtils.js';
import { countCharacters } from '../js/utils/textUtils.js';
import { createTaskModel } from '../js/models/taskModel.js';
import {
  TodoRepository,
  DomainValidationError,
  StorageError,
  StorageCorruptionError,
} from '../js/repositories/TodoRepository.js';
import { TodoService } from '../js/services/TodoService.js';

const SERVICE_SOURCE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../js/services/TodoService.js'
);

class FakeTodoRepository extends TodoRepository {
  /**
   * @param {readonly object[]} [initialTodos]
   */
  constructor(initialTodos = []) {
    super();
    this.records = initialTodos.map((todo) => cloneTodo(todo));
    this.nextNumericId = 1;
    this.calls = [];
    this.throwOnWrite = null;
    this.throwOnGetAll = null;
    this.throwOnDeleteMany = null;
    this.updateErrorById = new Map();
  }

  _track(method, args) {
    this.calls.push({ method, args });
  }

  writeCount() {
    return this.calls.filter((call) =>
      ['create', 'update', 'merge', 'deleteMany'].includes(call.method)
    ).length;
  }

  _maybeThrowWrite() {
    if (this.throwOnWrite) {
      throw this.throwOnWrite;
    }
  }

  async getAll() {
    this._track('getAll', []);
    if (this.throwOnGetAll) {
      throw this.throwOnGetAll;
    }
    return this.records.map((todo) => cloneTodo(todo));
  }

  async create(todoData) {
    this._track('create', [todoData]);
    this._maybeThrowWrite();
    const id = `todo-${this.nextNumericId}`;
    this.nextNumericId += 1;
    const created = cloneTodo({
      id,
      title: todoData.title,
      description: todoData.description === undefined ? '' : todoData.description,
      dueDates: todoData.dueDates === undefined ? [] : todoData.dueDates,
      completed: todoData.completed === undefined ? false : todoData.completed,
      completedAt: todoData.completedAt === undefined ? null : todoData.completedAt,
    });
    this.records.push(created);
    return cloneTodo(created);
  }

  async update(id, changes) {
    this._track('update', [id, changes]);
    if (this.updateErrorById.has(id)) {
      throw this.updateErrorById.get(id);
    }
    this._maybeThrowWrite();
    const index = this.records.findIndex((todo) => todo.id === id);
    if (index === -1) {
      throw new DomainValidationError('id', `Task with id "${id}" does not exist.`);
    }
    const existing = this.records[index];
    const updated = cloneTodo({
      id: existing.id,
      title: changes.title !== undefined ? changes.title : existing.title,
      description:
        changes.description !== undefined ? changes.description : existing.description,
      dueDates: changes.dueDates !== undefined ? changes.dueDates : existing.dueDates,
      completed: changes.completed !== undefined ? changes.completed : existing.completed,
      completedAt:
        changes.completedAt !== undefined ? changes.completedAt : existing.completedAt,
    });
    this.records[index] = updated;
    return cloneTodo(updated);
  }

  async merge(sourceId, targetId, targetChanges) {
    this._track('merge', [sourceId, targetId, targetChanges]);
    this._maybeThrowWrite();
    const sourceIndex = this.records.findIndex((todo) => todo.id === sourceId);
    const targetIndex = this.records.findIndex((todo) => todo.id === targetId);
    if (sourceIndex === -1) {
      throw new DomainValidationError('sourceId', 'Source task does not exist.');
    }
    if (targetIndex === -1) {
      throw new DomainValidationError('targetId', 'Target task does not exist.');
    }
    const existingTarget = this.records[targetIndex];
    const updatedTarget = cloneTodo({
      id: existingTarget.id,
      title:
        targetChanges.title !== undefined ? targetChanges.title : existingTarget.title,
      description:
        targetChanges.description !== undefined
          ? targetChanges.description
          : existingTarget.description,
      dueDates:
        targetChanges.dueDates !== undefined
          ? targetChanges.dueDates
          : existingTarget.dueDates,
      completed:
        targetChanges.completed !== undefined
          ? targetChanges.completed
          : existingTarget.completed,
      completedAt:
        targetChanges.completedAt !== undefined
          ? targetChanges.completedAt
          : existingTarget.completedAt,
    });
    this.records = this.records
      .filter((todo) => todo.id !== sourceId)
      .map((todo) => (todo.id === targetId ? updatedTarget : todo));
    return cloneTodo(updatedTarget);
  }

  async deleteMany(ids) {
    this._track('deleteMany', [ids]);
    if (this.throwOnDeleteMany) {
      throw this.throwOnDeleteMany;
    }
    this._maybeThrowWrite();
    const deletedIds = [];
    const failures = [];
    for (const id of ids) {
      if (typeof id !== 'string' || id.trim().length === 0) {
        failures.push({ id: String(id), message: 'Task ID must be a non-empty string.' });
        continue;
      }
      const exists = this.records.some((todo) => todo.id === id);
      if (!exists) {
        failures.push({ id, message: `Task with id "${id}" was not found.` });
        continue;
      }
      deletedIds.push(id);
    }
    const deletedSet = new Set(deletedIds);
    this.records = this.records.filter((todo) => !deletedSet.has(todo.id));
    return { deletedIds, failures };
  }

  async resetStorage() {
    this._track('resetStorage', []);
    this.records = [];
  }
}

function cloneTodo(todo) {
  return Object.freeze({
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDates: Object.freeze([...(todo.dueDates ?? [])]),
    completed: todo.completed,
    completedAt: todo.completedAt,
  });
}

function pendingTodo(overrides) {
  return createTaskModel({
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? '',
    dueDates: overrides.dueDates ?? [],
    completed: false,
    completedAt: null,
  });
}

function completedTodo(overrides) {
  return createTaskModel({
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? '',
    dueDates: overrides.dueDates ?? [],
    completed: true,
    completedAt: overrides.completedAt === undefined ? null : overrides.completedAt,
  });
}

const OriginalDate = Date;
let frozenMillis = null;

function installFrozenLocalDate(year, month, day) {
  const localNoon = new OriginalDate(year, month - 1, day, 12, 0, 0, 0);
  frozenMillis = localNoon.getTime();

  function FrozenDate(...args) {
    if (args.length === 0) {
      return new OriginalDate(frozenMillis);
    }
    return new OriginalDate(...args);
  }

  FrozenDate.now = () => frozenMillis;
  FrozenDate.parse = OriginalDate.parse;
  FrozenDate.UTC = OriginalDate.UTC;
  FrozenDate.prototype = OriginalDate.prototype;
  globalThis.Date = FrozenDate;
}

function restoreDate() {
  globalThis.Date = OriginalDate;
  frozenMillis = null;
}

function currentUtcIsoTimestamp() {
  return new Date().toISOString();
}

function localToday() {
  const now = new Date();
  return createCalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function shiftLocalDate(dateValue, dayDelta) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const shifted = new OriginalDate(year, month - 1, day + dayDelta);
  return createCalendarDate(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    shifted.getDate()
  );
}

describe('TodoService', () => {
  beforeEach(() => {
    installFrozenLocalDate(2026, 6, 15);
  });

  afterEach(() => {
    restoreDate();
  });

  describe('source isolation', () => {
    it('does not access the DOM, LocalStorage, prompts, or the concrete adapter', () => {
      const source = readFileSync(SERVICE_SOURCE_PATH, 'utf8');
      assert.equal(source.includes('localStorage'), false);
      assert.equal(source.includes('LocalStorageTodoRepository'), false);
      assert.equal(/\bdocument\b/.test(source), false);
      assert.equal(/\binnerHTML\b/.test(source), false);
      assert.equal(/\bprompt\s*\(/.test(source), false);
      assert.equal(/\bsetTimeout\b/.test(source), false);
      assert.equal(/\bsetInterval\b/.test(source), false);
    });
  });

  describe('loading and sorting', () => {
    it('reads the repository once, partitions, sorts both sections, and keeps tied nearest dates', async () => {
      const today = localToday();
      const yesterday = shiftLocalDate(today, -1);
      const tomorrow = shiftLocalDate(today, 1);
      const farPast = shiftLocalDate(today, -120);
      const farFuture = shiftLocalDate(today, 160);

      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-undated-1',
          title: 'Undated Zebra',
          dueDates: [],
        }),
        pendingTodo({
          id: 'p-near-a',
          title: 'Near A',
          dueDates: [yesterday],
        }),
        pendingTodo({
          id: 'p-same-beta',
          title: 'Beta',
          dueDates: [farFuture],
        }),
        pendingTodo({
          id: 'p-same-alpha',
          title: 'Alpha',
          dueDates: [farFuture],
        }),
        pendingTodo({
          id: 'p-far',
          title: 'Far',
          dueDates: [farPast],
        }),
        pendingTodo({
          id: 'p-undated-2',
          title: 'Undated Yak',
          dueDates: [],
        }),
        pendingTodo({
          id: 'p-near-b',
          title: 'Near B',
          dueDates: [tomorrow],
        }),
        pendingTodo({
          id: 'p-tied-nearest',
          title: 'Tied nearest',
          dueDates: [yesterday, tomorrow],
        }),
        completedTodo({
          id: 'c-legacy-a',
          title: 'Legacy A',
          completedAt: null,
        }),
        completedTodo({
          id: 'c-late',
          title: 'Late',
          completedAt: '2026-06-15T04:00:00.000Z',
        }),
        completedTodo({
          id: 'c-legacy-b',
          title: 'Legacy B',
          completedAt: null,
        }),
        completedTodo({
          id: 'c-early',
          title: 'Early',
          completedAt: '2026-06-15T01:00:00.000Z',
        }),
        completedTodo({
          id: 'c-tie-b',
          title: 'Tie B',
          completedAt: '2026-06-15T02:00:00.000Z',
        }),
        completedTodo({
          id: 'c-tie-a',
          title: 'Tie A',
          completedAt: '2026-06-15T02:00:00.000Z',
        }),
      ]);

      const service = new TodoService(repository);
      const lists = await service.getTaskLists();

      assert.equal(
        repository.calls.filter((call) => call.method === 'getAll').length,
        1
      );
      assert.deepEqual(
        lists.pendingTodos.map((todo) => todo.id),
        [
          'p-same-alpha',
          'p-same-beta',
          'p-far',
          'p-near-a',
          'p-near-b',
          'p-tied-nearest',
          'p-undated-1',
          'p-undated-2',
        ]
      );
      assert.deepEqual(
        lists.completedTodos.map((todo) => todo.id),
        ['c-legacy-a', 'c-legacy-b', 'c-early', 'c-tie-a', 'c-tie-b', 'c-late']
      );

      const pending = await service.getPendingTodos();
      const completed = await service.getCompletedTodos();
      assert.deepEqual(
        pending.map((todo) => todo.id),
        lists.pendingTodos.map((todo) => todo.id)
      );
      assert.deepEqual(
        completed.map((todo) => todo.id),
        lists.completedTodos.map((todo) => todo.id)
      );
      assert.equal(pending.some((todo) => todo.id === 'p-tied-nearest'), true);
    });
  });

  describe('validateTaskInput', () => {
    it('normalizes title and description and reports grapheme and date errors', () => {
      const service = new TodoService(new FakeTodoRepository());
      const valid = service.validateTaskInput({
        title: '  Buy   milk  ',
        description: '  Two   bottles ',
        dueDates: ['2026-06-20'],
      });
      assert.equal(valid.valid, true);
      assert.deepEqual(valid.errors, {});

      const blank = service.validateTaskInput({ title: '   ' });
      assert.equal(blank.valid, false);
      assert.equal(typeof blank.errors.title, 'string');

      const longTitle = service.validateTaskInput({ title: 'a'.repeat(33) });
      assert.equal(longTitle.valid, false);
      assert.equal(typeof longTitle.errors.title, 'string');

      const emojiTitle = service.validateTaskInput({ title: '👍'.repeat(32) });
      assert.equal(emojiTitle.valid, true);

      const longDescription = service.validateTaskInput({
        title: 'Ok',
        description: 'b'.repeat(257),
      });
      assert.equal(longDescription.valid, false);
      assert.equal(typeof longDescription.errors.description, 'string');

      const badDate = service.validateTaskInput({
        title: 'Ok',
        dueDates: ['2026-13-40'],
      });
      assert.equal(badDate.valid, false);
      assert.equal(typeof badDate.errors.dueDates, 'string');

      const malformed = service.validateTaskInput({
        title: 'Ok',
        dueDates: ['June 15'],
      });
      assert.equal(malformed.valid, false);
      assert.equal(typeof malformed.errors.dueDates, 'string');
    });
  });

  describe('createTodo', () => {
    it('creates a new pending Todo when the title is unused', async () => {
      const repository = new FakeTodoRepository();
      const service = new TodoService(repository);
      const result = await service.createTodo({
        title: '  Plan   launch  ',
        description: '  Write   notes ',
        dueDates: ['2026-07-01'],
      });
      assert.equal(result.status, 'created');
      assert.equal(result.todo.title, 'Plan launch');
      assert.equal(result.todo.description, 'Write notes');
      assert.equal(result.todo.completed, false);
      assert.equal(result.todo.completedAt, null);
      assert.equal(typeof result.todo.id, 'string');
      assert.equal(repository.writeCount(), 1);
    });

    it('does not treat a matching Completed title as a duplicate', async () => {
      const repository = new FakeTodoRepository([
        completedTodo({
          id: 'done-1',
          title: 'Shared title',
          description: 'Old',
          completedAt: '2026-06-15T01:00:00.000Z',
        }),
      ]);
      const service = new TodoService(repository);
      const result = await service.createTodo({
        title: 'Shared title',
        description: 'New work',
      });
      assert.equal(result.status, 'created');
      assert.equal(result.todo.completed, false);
      assert.notEqual(result.todo.id, 'done-1');
    });

    it('returns duplicate for an empty proposed description against a Pending title', async () => {
      const existing = pendingTodo({
        id: 'p-1',
        title: 'Report',
        description: 'Details',
        dueDates: ['2026-07-01'],
      });
      const repository = new FakeTodoRepository([existing]);
      const service = new TodoService(repository);
      const result = await service.createTodo({
        title: 'report',
        description: '   ',
        dueDates: ['2026-08-01'],
      });
      assert.equal(result.status, 'duplicate');
      assert.equal(result.existingTodo.id, 'p-1');
      assert.equal(repository.writeCount(), 0);
    });

    it('returns duplicate for an exact Pending match, including both undated', async () => {
      const existing = pendingTodo({
        id: 'p-1',
        title: 'Report',
        description: 'Details',
        dueDates: [],
      });
      const repository = new FakeTodoRepository([existing]);
      const service = new TodoService(repository);
      const result = await service.createTodo({
        title: 'REPORT',
        description: 'details',
      });
      assert.equal(result.status, 'duplicate');
      assert.equal(repository.writeCount(), 0);
    });

    it('appends only new unique dates when title and description match', async () => {
      const existing = pendingTodo({
        id: 'p-1',
        title: 'Report',
        description: 'Details',
        dueDates: ['2026-07-01'],
      });
      const repository = new FakeTodoRepository([existing]);
      const service = new TodoService(repository);
      const result = await service.createTodo({
        title: 'Report',
        description: 'Details',
        dueDates: ['2026-07-01', '2026-08-01'],
      });
      assert.equal(result.status, 'merged');
      assert.equal(result.todo.id, 'p-1');
      assert.deepEqual(result.todo.dueDates, ['2026-07-01', '2026-08-01']);
      assert.equal(repository.calls.some((call) => call.method === 'create'), false);
      assert.equal(repository.calls.some((call) => call.method === 'update'), true);
    });

    it('asks for merge confirmation when descriptions differ', async () => {
      const existing = pendingTodo({
        id: 'p-1',
        title: 'Report',
        description: 'First notes',
      });
      const repository = new FakeTodoRepository([existing]);
      const service = new TodoService(repository);
      const result = await service.createTodo({
        title: 'Report',
        description: 'Second notes',
        dueDates: ['2026-07-01'],
      });
      assert.equal(result.status, 'confirmation-required');
      assert.equal(result.reason, 'merge');
      assert.equal(result.existingTodo.id, 'p-1');
      assert.equal(result.proposedInput.description, 'Second notes');
      assert.equal(repository.writeCount(), 0);
    });

    it('merges with a newline only when the old description is non-empty', async () => {
      const withDescription = pendingTodo({
        id: 'p-1',
        title: 'Report',
        description: 'Old notes',
      });
      const repository = new FakeTodoRepository([withDescription]);
      const service = new TodoService(repository);
      const merged = await service.createTodo(
        { title: 'Report', description: 'New notes', dueDates: ['2026-07-01'] },
        { confirmMerge: true }
      );
      assert.equal(merged.status, 'merged');
      assert.equal(merged.todo.description, 'Old notes\nNew notes');

      const emptyOld = new FakeTodoRepository([
        pendingTodo({ id: 'p-2', title: 'Other', description: '' }),
      ]);
      const emptyMerge = await new TodoService(emptyOld).createTodo(
        { title: 'Other', description: 'Only new' },
        { confirmMerge: true }
      );
      assert.equal(emptyMerge.status, 'merged');
      assert.equal(emptyMerge.todo.description, 'Only new');
      assert.equal(emptyMerge.todo.description.startsWith('\n'), false);
    });

    it('unions dates during a confirmed description merge', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-1',
          title: 'Report',
          description: 'Old notes',
          dueDates: ['2026-07-01'],
        }),
      ]);
      const result = await new TodoService(repository).createTodo(
        {
          title: 'Report',
          description: 'New notes',
          dueDates: ['2026-07-01', '2026-08-01'],
        },
        { confirmMerge: true }
      );
      assert.deepEqual(result.todo.dueDates, ['2026-07-01', '2026-08-01']);
    });

    it('asks for repeated-text confirmation and can persist after it', async () => {
      const existing = pendingTodo({
        id: 'p-1',
        title: 'Report',
        description: 'Alpha, bravo, charlie, delta',
      });
      const repository = new FakeTodoRepository([existing]);
      const service = new TodoService(repository);
      const warning = await service.createTodo(
        {
          title: 'Report',
          description: 'Alpha, bravo, charlie, echo',
        },
        { confirmMerge: true }
      );
      assert.equal(warning.status, 'confirmation-required');
      assert.equal(warning.reason, 'repeated-text');
      assert.deepEqual(warning.repeatedFragments, ['Alpha', 'bravo', 'charlie']);
      assert.equal(repository.writeCount(), 0);

      const saved = await service.createTodo(
        {
          title: 'Report',
          description: 'Alpha, bravo, charlie, echo',
        },
        { confirmMerge: true, confirmRepeatedText: true }
      );
      assert.equal(saved.status, 'merged');
      assert.equal(
        saved.todo.description,
        'Alpha, bravo, charlie, delta\nAlpha, bravo, charlie, echo'
      );
    });

    it('rejects a combined description that exceeds 256 graphemes', async () => {
      const oldDescription = 'a'.repeat(200);
      const newDescription = 'b'.repeat(56);
      const repository = new FakeTodoRepository([
        pendingTodo({ id: 'p-1', title: 'Report', description: oldDescription }),
      ]);
      const service = new TodoService(repository);
      await assert.rejects(
        () =>
          service.createTodo(
            { title: 'Report', description: newDescription },
            { confirmMerge: true }
          ),
        (error) => {
          assert.equal(error instanceof DomainValidationError, true);
          assert.equal(error.field, 'description');
          return true;
        }
      );
      assert.equal(
        countCharacters(`${oldDescription}\n${newDescription}`),
        257
      );
      assert.equal(repository.writeCount(), 0);
    });

    it('requires past-date confirmation and then creates a separate Completed Todo', async () => {
      const today = localToday();
      const yesterday = shiftLocalDate(today, -1);
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-1',
          title: 'Past work',
          description: 'Pending copy',
        }),
      ]);
      const service = new TodoService(repository);
      const prompt = await service.createTodo({
        title: 'Past work',
        description: 'Pending copy',
        dueDates: [yesterday],
      });
      assert.equal(prompt.status, 'confirmation-required');
      assert.equal(prompt.reason, 'past-date');
      assert.equal(repository.writeCount(), 0);
      assert.equal(repository.calls.length, 0);

      const created = await service.createTodo(
        {
          title: 'Past work',
          description: 'Pending copy',
          dueDates: [yesterday],
        },
        { addPastDatesAsCompleted: true }
      );
      assert.equal(created.status, 'created');
      assert.equal(created.todo.completed, true);
      assert.equal(created.todo.completedAt, currentUtcIsoTimestamp());
      assert.notEqual(created.todo.id, 'p-1');
      assert.equal(repository.records.length, 2);
    });

    it('does not treat today as a past date', async () => {
      const repository = new FakeTodoRepository();
      const result = await new TodoService(repository).createTodo({
        title: 'Today task',
        dueDates: [localToday()],
      });
      assert.equal(result.status, 'created');
      assert.equal(result.todo.completed, false);
    });

    it('rejects invalid input without writing', async () => {
      const repository = new FakeTodoRepository();
      const service = new TodoService(repository);
      await assert.rejects(
        () => service.createTodo({ title: '' }),
        (error) => error instanceof DomainValidationError && error.field === 'title'
      );
      await assert.rejects(
        () => service.createTodo({ title: 'Ok', dueDates: ['not-a-date'] }),
        (error) => error instanceof DomainValidationError && error.field === 'dueDates'
      );
      await assert.rejects(
        () => service.createTodo({ title: 'Ok', id: 'user-supplied' }),
        (error) => error instanceof DomainValidationError && error.field === 'id'
      );
      assert.equal(repository.writeCount(), 0);
    });

    it('propagates storage failures from create', async () => {
      const repository = new FakeTodoRepository();
      repository.throwOnWrite = new StorageError('quota exceeded');
      const service = new TodoService(repository);
      await assert.rejects(
        () => service.createTodo({ title: 'Save me' }),
        (error) => error instanceof StorageError && error.message === 'quota exceeded'
      );
    });
  });

  describe('confirmMerge', () => {
    it('updates the existing Pending Todo and returns the saved record', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-1',
          title: 'Report',
          description: 'Old notes',
          dueDates: ['2026-07-01'],
        }),
      ]);
      const service = new TodoService(repository);
      const saved = await service.confirmMerge('p-1', 'New notes', ['2026-08-01']);
      assert.equal(saved.id, 'p-1');
      assert.equal(saved.description, 'Old notes\nNew notes');
      assert.deepEqual(saved.dueDates, ['2026-07-01', '2026-08-01']);
      assert.equal(saved.status, undefined);
    });

    it('returns repeated-text confirmation instead of persisting', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-1',
          title: 'Report',
          description: 'Alpha, bravo, charlie, delta',
        }),
      ]);
      const service = new TodoService(repository);
      const result = await service.confirmMerge(
        'p-1',
        'Alpha, bravo, charlie, echo'
      );
      assert.equal(result.status, 'confirmation-required');
      assert.equal(result.reason, 'repeated-text');
      assert.equal(repository.writeCount(), 0);
    });

    it('rejects a missing or completed target', async () => {
      const repository = new FakeTodoRepository([
        completedTodo({
          id: 'c-1',
          title: 'Done',
          completedAt: '2026-06-15T01:00:00.000Z',
        }),
      ]);
      const service = new TodoService(repository);
      await assert.rejects(
        () => service.confirmMerge('missing', 'Notes'),
        (error) =>
          error instanceof DomainValidationError && error.field === 'existingId'
      );
      await assert.rejects(
        () => service.confirmMerge('c-1', 'Notes'),
        (error) =>
          error instanceof DomainValidationError && error.field === 'existingId'
      );
    });
  });

  describe('updatePendingTodo', () => {
    it('updates only a Pending Todo and keeps immutable ids', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-1',
          title: 'Old title',
          description: 'Old',
          dueDates: ['2026-07-01'],
        }),
      ]);
      const service = new TodoService(repository);
      const result = await service.updatePendingTodo('p-1', {
        title: '  New   title ',
        description: 'Updated',
      });
      assert.equal(result.status, 'updated');
      assert.equal(result.todo.id, 'p-1');
      assert.equal(result.todo.title, 'New title');
      assert.equal(result.todo.description, 'Updated');
      assert.deepEqual(result.todo.dueDates, ['2026-07-01']);
    });

    it('rejects invalid ids, empty changes, id mutation, and completed edits', async () => {
      const repository = new FakeTodoRepository([
        completedTodo({
          id: 'c-1',
          title: 'Done',
          completedAt: '2026-06-15T01:00:00.000Z',
        }),
        pendingTodo({ id: 'p-1', title: 'Open' }),
      ]);
      const service = new TodoService(repository);
      await assert.rejects(
        () => service.updatePendingTodo('', { title: 'X' }),
        (error) => error instanceof DomainValidationError && error.field === 'id'
      );
      await assert.rejects(
        () => service.updatePendingTodo('p-1', {}),
        (error) => error instanceof DomainValidationError && error.field === 'changes'
      );
      await assert.rejects(
        () => service.updatePendingTodo('p-1', { id: 'hacked', title: 'X' }),
        (error) => error instanceof DomainValidationError && error.field === 'id'
      );
      await assert.rejects(
        () => service.updatePendingTodo('missing', { title: 'X' }),
        (error) => error instanceof DomainValidationError && error.field === 'id'
      );
      await assert.rejects(
        () => service.updatePendingTodo('c-1', { title: 'Nope' }),
        (error) => error instanceof DomainValidationError && error.field === 'id'
      );
      await assert.rejects(
        () => service.updatePendingTodo('p-1', { completed: true }),
        (error) =>
          error instanceof DomainValidationError && error.field === 'completed'
      );
      assert.equal(repository.writeCount(), 0);
    });

    it('retains an existing past date and rejects a newly added past date', async () => {
      const today = localToday();
      const yesterday = shiftLocalDate(today, -1);
      const lastWeek = shiftLocalDate(today, -7);
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'p-1',
          title: 'Dated',
          dueDates: [yesterday],
        }),
      ]);
      const service = new TodoService(repository);
      const retained = await service.updatePendingTodo('p-1', {
        title: 'Dated still',
        dueDates: [yesterday],
      });
      assert.equal(retained.status, 'updated');
      assert.deepEqual(retained.todo.dueDates, [yesterday]);

      await assert.rejects(
        () => service.updatePendingTodo('p-1', { dueDates: [yesterday, lastWeek] }),
        (error) =>
          error instanceof DomainValidationError && error.field === 'dueDates'
      );
      assert.equal(repository.writeCount(), 1);
    });

    it('absorbs a title conflict into the target via atomic merge', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'source',
          title: 'Source',
          description: 'From source',
          dueDates: ['2026-08-01'],
        }),
        pendingTodo({
          id: 'target',
          title: 'Target',
          description: 'From target',
          dueDates: ['2026-07-01'],
        }),
      ]);
      const service = new TodoService(repository);
      const waiting = await service.updatePendingTodo('source', {
        title: 'Target',
        description: 'From source',
      });
      assert.equal(waiting.status, 'confirmation-required');
      assert.equal(waiting.reason, 'merge');
      assert.equal(repository.writeCount(), 0);

      const merged = await service.updatePendingTodo(
        'source',
        { title: 'Target', description: 'From source' },
        { confirmMerge: true }
      );
      assert.equal(merged.status, 'merged');
      assert.equal(merged.todo.id, 'target');
      assert.equal(merged.todo.description, 'From target\nFrom source');
      assert.deepEqual(merged.todo.dueDates, ['2026-07-01', '2026-08-01']);
      assert.equal(repository.records.some((todo) => todo.id === 'source'), false);
      assert.equal(repository.calls.some((call) => call.method === 'merge'), true);
      assert.equal(
        repository.calls.some((call) => call.method === 'deleteMany'),
        false
      );
    });

    it('returns duplicate and does not persist when the edited title is an empty-description conflict', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({ id: 'source', title: 'Source', description: 'Keep me' }),
        pendingTodo({ id: 'target', title: 'Target', description: 'Existing' }),
      ]);
      const service = new TodoService(repository);
      const result = await service.updatePendingTodo('source', {
        title: 'Target',
        description: '',
      });
      assert.equal(result.status, 'duplicate');
      assert.equal(result.existingTodo.id, 'target');
      assert.equal(repository.writeCount(), 0);
      assert.equal(repository.records.some((todo) => todo.id === 'source'), true);
    });

    it('returns duplicate without absorbing the source when an edit becomes an exact target duplicate', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({
          id: 'source',
          title: 'Source',
          description: 'Same details',
          dueDates: ['2026-08-01'],
        }),
        pendingTodo({
          id: 'target',
          title: 'Target',
          description: 'Same details',
          dueDates: ['2026-08-01'],
        }),
      ]);
      const service = new TodoService(repository);

      const result = await service.updatePendingTodo('source', {
        title: 'Target',
        description: 'Same details',
        dueDates: ['2026-08-01'],
      });

      assert.equal(result.status, 'duplicate');
      assert.equal(result.existingTodo.id, 'target');
      assert.equal(repository.writeCount(), 0);
      assert.equal(repository.records.some((todo) => todo.id === 'source'), true);
      assert.equal(repository.records.some((todo) => todo.id === 'target'), true);
    });
  });

  describe('completeTodos and commitDelete', () => {
    it('completes pending Todos with a UTC timestamp and reports partial failures', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({ id: 'p-1', title: 'One' }),
        pendingTodo({ id: 'p-2', title: 'Two' }),
        completedTodo({
          id: 'c-1',
          title: 'Already done',
          completedAt: '2026-06-15T01:00:00.000Z',
        }),
      ]);
      repository.updateErrorById.set('p-2', new StorageError('write failed'));
      const service = new TodoService(repository);
      const result = await service.completeTodos(['p-1', 'p-2', 'c-1', 'missing', '']);

      assert.equal(result.completed.length, 1);
      assert.equal(result.completed[0].id, 'p-1');
      assert.equal(result.completed[0].completed, true);
      assert.equal(result.completed[0].completedAt, currentUtcIsoTimestamp());
      assert.deepEqual(
        result.failures.map((failure) => ({ id: failure.id, kind: failure.kind })),
        [
          { id: 'p-2', kind: 'storage' },
          { id: 'c-1', kind: 'validation' },
          { id: 'missing', kind: 'validation' },
          { id: '', kind: 'validation' },
        ]
      );
    });

    it('classifies corruption errors as storage failures during completion', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({ id: 'p-1', title: 'One' }),
      ]);
      repository.updateErrorById.set(
        'p-1',
        new StorageCorruptionError('bad envelope')
      );
      const result = await new TodoService(repository).completeTodos(['p-1']);
      assert.deepEqual(result.completed, []);
      assert.equal(result.failures[0].kind, 'storage');
    });

    it('commits deletions and maps invalid ids as validation failures', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({ id: 'p-1', title: 'Keep' }),
        pendingTodo({ id: 'p-2', title: 'Drop' }),
      ]);
      const result = await new TodoService(repository).commitDelete([
        'p-2',
        'missing',
        '',
      ]);
      assert.deepEqual(result.deletedIds, ['p-2']);
      assert.equal(result.failures.length, 2);
      assert.equal(result.failures.every((failure) => failure.kind === 'validation'), true);
      assert.equal(repository.records.some((todo) => todo.id === 'p-2'), false);
    });

    it('returns storage failures for every requested id when deleteMany throws', async () => {
      const repository = new FakeTodoRepository([
        pendingTodo({ id: 'p-1', title: 'One' }),
        pendingTodo({ id: 'p-2', title: 'Two' }),
      ]);
      repository.throwOnDeleteMany = new StorageError('unavailable');
      const result = await new TodoService(repository).commitDelete(['p-1', 'p-2']);
      assert.deepEqual(result.deletedIds, []);
      assert.equal(result.failures.length, 2);
      assert.equal(result.failures.every((failure) => failure.kind === 'storage'), true);
      assert.equal(repository.records.length, 2);
    });
  });
});
