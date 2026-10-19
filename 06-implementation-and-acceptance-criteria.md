# 06 — Implementation Guide & Acceptance Criteria

## 1. Class & Method Signatures

### 1.1 `taskModel.js`
```javascript
class Todo {
  /**
   * @param {Object} params
   * @param {string} params.id Repository-generated ID for a persisted entity
   * @param {string} params.title
   * @param {string} [params.description=""]
   * @param {string[]} [params.dueDates=[]]
   * @param {boolean} [params.completed=false]
   * @param {string|null} [params.completedAt=null]
   */
  constructor({ id, title, description = '', dueDates = [], completed = false, completedAt = null }) {
    // The repository supplies the persisted ID; the entity does not generate one.
    this.id = id;
    this.title = title;
    this.description = description;
    this.dueDates = [...dueDates];
    this.completed = Boolean(completed);
    this.completedAt = completedAt;
  }
}
```

---

### 1.2 `LocalStorageTodoRepository.js`
```javascript
class LocalStorageTodoRepository extends TodoRepository {
  /**
   * @param {string} [storageKey="todos_app_data"]
   */
  constructor(storageKey = 'todos_app_data') {
    super();
    this.storageKey = storageKey;
    this.SCHEMA_VERSION = 2;
  }

  async getAll() // -> Promise<Todo[]>
  async create(todoData) // -> Promise<Todo>; repository generates id and returns saved task
  async update(id, changes) // -> Promise<Todo>
  async merge(sourceId, targetId, targetChanges) // -> Promise<Todo>; atomically update target and remove source
  async deleteMany(ids) // -> Promise<{ deletedIds: string[], failures: Array<{ id: string, message: string }> }>
  async resetStorage() // -> Promise<void>; called only after explicit user action
}
```

---

### 1.3 `TodoService.js`
```javascript
class TodoService {
  /**
   * @param {TodoRepository} repository
   */
  constructor(repository) {
    this.repository = repository;
  }

  // Retrieval & Sorting
  async getTaskLists() // -> Promise<{ pendingTodos: Todo[], completedTodos: Todo[] }>; loads repository once and sorts each section
  async getPendingTodos() // -> Promise<Todo[]> (representative date farthest to nearest; undated last; ties alphabetical)
  async getCompletedTodos() // -> Promise<Todo[]> (completion time earliest first; ties alphabetical)

  // Validation & Normalization
  validateTaskInput({ title, description, dueDates }) // -> { valid: boolean, errors: Record<string, string> }
  
  // Creation & Merge Workflows
  async createTodo(input, decisions = {}) // -> Promise<TodoOperationResult>
  async confirmMerge(existingId, newDescription, dueDates, decisions = {}) // -> Promise<Todo>; appends description and unique date(s) after checks
  
  // Updates & Completion
  async updatePendingTodo(id, changes, decisions = {}) // -> Promise<TodoOperationResult>; only title, description, dueDates; id immutable
  async completeTodos(ids) // -> Promise<{ completed: Todo[], failures: Array<{ id: string, kind: 'validation'|'storage', message: string }> }>
  
  // Deletion
  async commitDelete(ids) // -> Promise<{ deletedIds: string[], failures: Array<{ id: string, kind: 'validation'|'storage', message: string }> }>
}
```

### Service result contracts
`createTodo(input, decisions)` and `updatePendingTodo(id, changes, decisions)` are asynchronous and return a discriminated result, rather than making the UI infer what happened:

```typescript
type TodoOperationResult =
  | { status: "created"; todo: Todo }
  | { status: "updated"; todo: Todo }
  | { status: "merged"; todo: Todo } // target Todo after atomic merge
  | { status: "duplicate"; existingTodo: Todo; message: string }
  | { status: "confirmation-required"; reason: "past-date" | "merge" | "repeated-text";
      existingTodo?: Todo; proposedInput: TodoInput; repeatedFragments?: string[]; message: string };

type TodoInput = { title: string; description?: string; dueDates?: string[] }; // omitted description -> ""; omitted dueDates -> []
type TodoUpdate = { title?: string; description?: string; dueDates?: string[] };
type TodoDecisions = { addPastDatesAsCompleted?: boolean; confirmMerge?: boolean; confirmRepeatedText?: boolean };
```

`createTodo(input, decisions = {})` returns `Promise<TodoOperationResult>`; it normalizes and validates the input, resolves duplicate/merge rules, and calls the repository only when the necessary confirmation is present. `updatePendingTodo(id, changes, decisions = {})` returns the same result shape, rejects updates to Completed tasks and ID changes, and invokes atomic repository merge when an edit is absorbed into an existing task. Validation and storage failures reject with their distinct typed errors. `confirmMerge(existingId, newDescription, dueDates)` returns `Promise<Todo>` only after merge confirmation, repetition checks, and the combined-description limit succeed. Batch completion/deletion return successful IDs/records plus per-item `{id, kind, message}` failures; the caller displays the message next to or clearly associated with the affected task.

---

### 1.4 `TodoView.js`
```javascript
class TodoView {
  constructor() {
    this.bindDOMElements();
  }

  // Initial & Section Renders
  renderInitialLists(pendingTodos, completedTodos)
  updateBadgeCounts(pendingCount, completedCount)

  // Granular DOM Mutations (No Full List Rebuilds)
  addTodoElement(todo, position = 'sorted')
  updateTodoElement(todo)
  moveTodoElement(id, targetSection) // 'pending' | 'completed'
  removeTodoElement(id)
  getRenderedTodoIds()
  isTodoElementInSection(id, isCompleted)
  isTodoElementConsistent(todo)
  removeDuplicateTodoElements(id)
  
  // Visual States
  setTaskSelected(id, isSelected)
  setTaskPendingDeletion(id, isPending)
  toggleTaskCardExpansion(id)
  
  // Forms & Modal Drawers
  openTaskForm(prefillData = null)
  closeTaskForm()
  setFormErrors(errors)
  clearFormErrors()
  openMobileDrawer()
  closeMobileDrawer()
  
  // Alerts & Per-task Undo Controls
  renderTaskUndoControl(id, secondsRemaining, onUndoClick)
  renderUndoAllControl(activeIds, onUndoAllClick)
  removeTaskUndoControl(id)
  showStorageAlert(message, type = 'error')
  showChoiceNotification(message, { confirmLabel, cancelLabel }) // -> Promise<boolean>; remains until chosen
  showCorruptionDialog(onResetConfirm)
}
```

---

### 1.5 `app.js` (Composition Root)
Coordinates event listeners:
- Form submit & real-time character counters.
- Task card clicks: Checkbox selection, card body expansion, Edit button, Copy button, Delete button.
- Bulk action clicks: Bulk Complete and Bulk Delete.
- Undo manager: Dispatches an independent 5s timer per task, provides adjacent Undo and a bottom Undo All while multiple timers remain active, then calls `todoService.commitDelete([id])`; the service delegates deletion to the repository contract.
- Mobile drawer toggler, backdrop overlay, and Escape key listeners.
- Five-second task-list reconciliation, matching cross-tab storage events, and visibility-restoration checks.

The composition root constructs `LocalStorageTodoRepository`, injects it into `TodoService`, and constructs `TodoView`. It loads both task sections through `todoService.getTaskLists()` and calls `todoView.renderInitialLists()` only for initial loading. After a successful create, update, merge, completion, or deletion, it updates/adds/removes only the affected task card(s). Every five seconds while visible, it compares storage and DOM state only for task IDs referenced by committed journal entries updated in the preceding seven seconds; matching cross-tab storage events and visibility restoration trigger the same bounded check sooner. It restores a saved card from storage when its DOM card is missing or inconsistent, and removes a stored record only when a committed delete or merge snapshot explicitly records that ID as removed. It does not reset open form drafts and remains silent on transient read failures. A failed user validation or storage operation leaves form values and task cards unchanged and displays the corresponding message. A `StorageCorruptionError` opens the explicit recovery dialog; `repository.resetStorage()` is called only after the user activates “Reset & Start Fresh”.

Past-date, merge, and repeated-text confirmations are presented by the composition root as in-app choice notifications and sent back to the service as `TodoDecisions`. Choice notifications contain the decision message and buttons, have no timeout, and stay visible until the user selects an option. Declined confirmations leave the form and saved task list unchanged. A duplicate result preserves form values, explains the duplicate, and temporarily highlights its existing task card. Ordinary status notifications stay visible for five seconds and show a blue progress bar filling during that interval.

---

## 2. Acceptance Criteria Checklist

### Category 1: Persistence & Storage
- [ ] On first launch with empty `localStorage`, the app loads without errors and renders "No tasks" empty state.
- [ ] Storing data persists across page refresh, browser restarts, and full computer shutdown/restart, assuming the same browser profile and site data remain available.
- [ ] Invalid persisted records are rejected without automatic overwrite. A clearly explained **"Reset & Start Fresh"** action clears data only after the user presses it.
- [ ] Valid version 1 records migrate to version 2 (`date` to `dueDates`) without losing task data; old completed records without timestamps appear before timestamped completions and retain their stored order among themselves.

### Category 2: Validation & Character Counters
- [ ] Title whitespace is trimmed; consecutive internal spaces collapse into a single space.
- [ ] Each grapheme cluster counts as one character in both the counter and validator, including joined emoji and Arabic/English text.
- [ ] Title length strictly capped at 32 characters; description capped at 256 characters.
- [ ] Live character counters (`12 / 32` and `120 / 256`) update dynamically on input.
- [ ] Validation errors highlight inputs with red outline and display accessible text without clearing entered input.

### Category 3: Due Dates & Overdue Handling
- [ ] Entering a past date on task creation shows an in-app choice notification with buttons asking: *"Would you like to add this task as Completed?"* It remains until the user chooses and has no timeout.
- [ ] If user accepts, task is saved with `completed: true`. If declined, form remains open.
- [ ] When the user confirms a past-date add, create it as a separate Completed task even if a Pending task has the same title; do not merge it into or reject it because of that Pending task.
- [ ] Pending tasks with any past date are highlighted yellow (`.task-item--overdue`) and each past date has a visible “Past” indicator.
- [ ] Attempting to edit a pending task's date to a past date is rejected with a validation error.
- [ ] A single due date can be removed from a Pending multi-date task without removing its other dates; removing its final date stores an empty date array. Completed tasks remain immutable.

### Category 4: Duplicate & Merge Logic
- [ ] Matching an existing Pending task's title with an empty or identical description is rejected as a duplicate.
- [ ] A matching title and description with a new due date adds that date to the same task/card.
- [ ] A matching title with a different description shows an in-app choice notification asking whether to merge; it remains until the user chooses. Confirmation appends description on a new line and adds any unique date(s).
- [ ] Creating a task with an identical title and a different description shows a persistent in-app merge choice notification.
- [ ] Only when more than two verbatim description fragments match, show a repetition warning; fragments are separated by comma or period, and punctuation is excluded.
- [ ] Merging appends the new description on a new line and enforces the 256-character combined limit.
- [ ] A merge uses one structural newline between two non-empty descriptions (counted toward the 256-character limit); if the old description is empty, the new description has no leading newline.
- [ ] Editing a task into a title conflict applies the same merge checks; on confirmation the source record is absorbed into the target without a keep/delete prompt.
- [ ] If persisting an edit-merge fails, neither source nor target is partially changed in storage or DOM.
- [ ] A task with multiple dates displays as one card; pending order uses its closest-to-today date, then sorts farthest-to-nearest; undated tasks are last and equal dates are alphabetical.
- [ ] Completed tasks sort earliest completion first, independently of due date; equal completion times are alphabetical.

### Category 5: Selection, Bulk Actions & Graceful Deletion
- [ ] Checkboxes handle task selection only, distinct from completion.
- [ ] Floating bulk bar appears when ≥1 task is selected.
- [ ] Bulk complete persists changes; any failed tasks remain pending with an error notification.
- [ ] Ordinary status notifications show in the in-app notification region for five seconds with a blue progress bar that fills during that interval, then disappear.
- [ ] Confirmation notifications show their message with explicit action buttons, have no timer or countdown, and remain until the user chooses an action.
- [ ] No decision flow uses browser `alert`, `confirm`, or `prompt` dialogs.
- [ ] Each task being deleted is muted for its own 5-second timer and has an adjacent Undo control.
- [ ] When multiple deletions are active, a bottom Undo All restores all still-pending deletions; independent per-task Undo remains available.
- [ ] Clicking Undo restores rows and aborts deletion.
- [ ] Reloading during the 5-second grace period leaves the Todo stored, loads it into the correct section, and starts a fresh five-second Undo period. A deletion explicitly recorded as failed is not retried automatically; the Todo remains visible and available.
- [ ] After 5 seconds, storage deletion commits and DOM nodes exit with a `0.3s` transition.

### Category 6: Completed Section & Card Expansion
- [ ] Completed tasks cannot be directly edited.
- [ ] Copying a Completed card prefills title/description and defaults the editable date to today; original task remains unchanged.
- [ ] Completed section displays up to 4 collapsed tasks; 5+ tasks scroll internally.
- [ ] Clicking a Completed task card body toggles expansion. Non-large descriptions use a fixed two-thirds-of-maximum expanded height; descriptions that need more use the maximum height, sufficient for the complete 256-character description. Empty descriptions display “No description” in a suitably smaller expanded height. Exact dimensions and threshold are determined during implementation without changing this behavior.
- [ ] A Pending task with multiple dates allows removing one date without deleting the task or its other dates; a Completed task exposes no direct date editing/removal.
- [ ] Action availability follows the agreed matrix: one Pending (Delete/Edit/Mark Complete); multiple Pending (Delete/Mark Complete); one Completed (Delete/Copy); multiple Completed (Delete only); mixed selection is prevented.

### Category 7: Layout & Accessibility
- [ ] On desktop (>768px): 16.5rem fixed sidebar, no top navbar.
- [ ] On tablet/mobile (≤768px): Top navbar visible; sidebar becomes a modal drawer opening from left.
- [ ] Opening mobile drawer traps keyboard focus, closes on Escape or backdrop click, and returns focus to toggler.
- [ ] Every interactive control is reachable and operable using Tab/Shift+Tab and its native keyboard activation; keyboard focus is visibly indicated.
- [ ] While open, the mobile drawer is a modal dialog named by its visible heading, and content behind it is inert; closing restores background interaction and returns focus to the toggler.
- [ ] Completed description expansion can be opened and closed by keyboard and exposes its expanded/collapsed state to assistive technology.
- [ ] All inputs have associated labels; all icon buttons have accessible names.
- [ ] All interface icons are SVGs, decorative SVGs are hidden from assistive technology, and each actionable icon has a descriptive visible text label; no emoji is used as an interface icon.
- [ ] `prefers-reduced-motion` removes animations and transitions.
- [ ] No `innerHTML` used with raw user text; all text rendered via `textContent` or DOM creation.

### Category 8: Background Task-List Consistency
- [ ] While the document is visible, the checker examines only affected Todo IDs from committed journal entries updated in the previous seven seconds, every five seconds; it does not compare or rewrite unrelated tasks.
- [ ] A matching cross-tab `storage` event and return to a visible tab trigger reconciliation without waiting for the next interval.
- [ ] Reconciliation compares task IDs and persisted fields, not counts alone, so equal-count mismatches are detected.
- [ ] For each journaled Todo ID, a missing or duplicate card, changed displayed fields, or incorrect section is repaired through localized DOM updates; unchanged cards and lists are not rebuilt. Stored Todos are removed only when a committed delete or merge snapshot explicitly says that ID no longer exists.
- [ ] Reconciliation does not clear or replace an open form draft and preserves selection, expansion, and focus for a card being updated where possible.
- [ ] Routine synchronization is silent. A transient read failure leaves the current UI intact and is retried on a later reconciliation; corrupt data uses the existing recovery dialog at most once per failure streak.
