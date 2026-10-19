/**
 * Storage contract for the write-ahead Todo operation journal.
 * Adapters persist immutable log-entry copies separately from Todo records.
 */

import { StorageCorruptionError } from './TodoRepository.js';

export class OperationLogCorruptionError extends StorageCorruptionError {
  constructor(message, rawContent = null) {
    super(message, rawContent);
    this.name = 'OperationLogCorruptionError';
  }
}

export class TodoOperationLogRepository {
  async getAll() {
    throw new Error('TodoOperationLogRepository.getAll() must be implemented.');
  }

  async append(entry) {
    void entry;
    throw new Error('TodoOperationLogRepository.append() must be implemented.');
  }

  async update(operationId, changes) {
    void operationId;
    void changes;
    throw new Error('TodoOperationLogRepository.update() must be implemented.');
  }
}

export default TodoOperationLogRepository;
