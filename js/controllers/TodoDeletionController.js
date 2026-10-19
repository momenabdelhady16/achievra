/**
 * Coordinates the current Todo delete grace period, journal state and undo UI.
 * It receives its dependencies from the application composition root and does
 * not create repository or view implementations itself.
 */

const DELETE_GRACE_PERIOD_MS = 5000;
const UNDO_COUNTDOWN_INTERVAL_MS = 1000;

export class TodoDeletionController {
  constructor({ todoService, todoOperationLog, todoView, onError }) {
    if (!todoService || !todoOperationLog || !todoView || typeof onError !== 'function') {
      throw new TypeError('TodoDeletionController requires service, operation log, view, and error handler dependencies.');
    }
    this.todoService = todoService;
    this.todoOperationLog = todoOperationLog;
    this.todoView = todoView;
    this.onError = onError;
    this.pendingDeleteTimers = new Map();
  }

  isPending(id) {
    return this.pendingDeleteTimers.has(id);
  }

  async beginPendingDeletion(id, existingOperationId = null, isRecovered = false) {
    const todo = this.todoView.getTodoById(id);
    if (!todo || this.isPending(id)) return;

    let operationId = existingOperationId;
    if (!operationId) {
      try {
        operationId = await this.todoOperationLog.recordPendingDelete(todo);
      } catch (error) {
        this.onError(error);
        return;
      }
    }

    if (isRecovered && existingOperationId) {
      try {
        await this.todoOperationLog.restartPendingDelete(existingOperationId);
      } catch (error) {
        this.onError(error);
        return;
      }
    }

    this.todoView.setTaskSelected(id, false);
    this.todoView.setTaskPendingDeletion(id, true);
    const timerState = {
      deadline: Date.now() + DELETE_GRACE_PERIOD_MS,
      timeoutId: null,
      intervalId: null,
      operationId,
    };
    this.pendingDeleteTimers.set(id, timerState);
    this.#armDeleteTimer(id, timerState);
    this.todoView.renderTaskUndoControl(id, 5, (taskId) => this.restorePendingDeletion(taskId));
    this.#refreshUndoAllControl();
  }

  async restorePendingDeletion(id, showFeedback = true) {
    const timerState = this.pendingDeleteTimers.get(id);
    if (!timerState) return false;
    globalThis.clearTimeout(timerState.timeoutId);
    globalThis.clearInterval(timerState.intervalId);

    if (timerState.operationId) {
      try {
        await this.todoOperationLog.markUndone(timerState.operationId);
      } catch (error) {
        this.onError(error);
        timerState.deadline = Date.now() + DELETE_GRACE_PERIOD_MS;
        this.#armDeleteTimer(id, timerState);
        return false;
      }
    }

    this.pendingDeleteTimers.delete(id);
    this.todoView.removeTaskUndoControl(id);
    this.#refreshUndoAllControl();
    const todo = this.todoView.getTodoById(id);
    if (showFeedback && todo) {
      this.todoView.showStorageAlert(`Deletion canceled. “${todo.title}” is still saved.`, 'info');
    }
    return true;
  }

  async undoAllPendingDeletions(ids = [...this.pendingDeleteTimers.keys()]) {
    const restoredResults = await Promise.all(
      ids.map((id) => this.restorePendingDeletion(id, false))
    );
    const restoredCount = restoredResults.filter(Boolean).length;
    this.#refreshUndoAllControl();
    if (restoredCount > 0) {
      this.todoView.showStorageAlert(
        `${restoredCount} ${restoredCount === 1 ? 'deletion was' : 'deletions were'} canceled. The tasks are still saved.`,
        'info'
      );
    }
  }

  async commitExpiredDeletion(id) {
    const timerState = this.pendingDeleteTimers.get(id);
    if (!timerState) return;
    globalThis.clearInterval(timerState.intervalId);
    this.pendingDeleteTimers.delete(id);
    this.#refreshUndoAllControl();

    try {
      const result = await this.todoService.commitDelete([id], { [id]: timerState.operationId });
      if (result.deletedIds.includes(id)) {
        await this.todoView.animateTodoRemoval(id);
        this.todoView.showStorageAlert('Task deleted.', 'success');
      }
      const failure = result.failures.find((item) => item.id === id);
      if (failure) {
        this.todoView.removeTaskUndoControl(id);
        const todo = this.todoView.getTodoById(id);
        const title = todo ? `“${todo.title}”: ` : '';
        this.todoView.showStorageAlert(`${title}${failure.message}`, 'error');
      }
    } catch (error) {
      this.todoView.removeTaskUndoControl(id);
      this.onError(error);
    } finally {
      this.#refreshUndoAllControl();
    }
  }

  #armDeleteTimer(id, timerState) {
    timerState.intervalId = globalThis.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerState.deadline - Date.now()) / 1000));
      this.todoView.renderTaskUndoControl(
        id,
        remaining,
        (taskId) => this.restorePendingDeletion(taskId)
      );
    }, UNDO_COUNTDOWN_INTERVAL_MS);
    timerState.timeoutId = globalThis.setTimeout(
      () => void this.commitExpiredDeletion(id),
      Math.max(0, timerState.deadline - Date.now())
    );
  }

  #refreshUndoAllControl() {
    this.todoView.renderUndoAllControl(
      [...this.pendingDeleteTimers.keys()],
      (ids) => this.undoAllPendingDeletions(ids)
    );
  }
}
