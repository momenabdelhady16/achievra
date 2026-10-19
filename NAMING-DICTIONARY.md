# Achievra Naming Dictionary

This document is the shared naming reference for implementation agents. Reuse these identifiers when adding code. Do not create a second name for an existing concept, silently rename an implemented public API, or use a specification alias as a new parallel field. If a conflict below affects an interface or stored data, stop and report it before changing that interface.

## 1. Naming rules

| Kind | Convention | Example |
|---|---|---|
| JavaScript files | Existing lower camel case; preserve established file paths | `taskModel.js`, `dateUtils.js` |
| JavaScript functions and variables | `lowerCamelCase` | `createTaskModel`, `todayDate` |
| Classes and error classes | `PascalCase` | `TodoService`, `StorageError` |
| Constants | `UPPER_SNAKE_CASE` | `TITLE_MAX_LENGTH` |
| Object properties / data fields | `lowerCamelCase` | `completedAt` |
| HTML IDs | Use the exact registered ID in section 8; new IDs use `lowerCamelCase` | `pendingList`, `taskTitleInput`; registered exception: `sidebar-navigation` |
| CSS | Existing BEM: `.block__element--modifier` | `.task-item__title`, `.task-item--completed` |
| DOM event action values | Short kebab-case verbs | `remove-date`, `undo-delete` |

Use `Todo` for the persisted domain record and for specification-level service/repository types. The current Phase 2 implementation uses “Task” in helper names such as `createTaskModel`; retain those existing names when extending Phase 2 exports. Do not create a competing `Task` persisted schema.

## 2. Canonical data names

The task record is named `Todo` in the specification. Its due-date array is named **`dueDates`** across the model, validation inputs/results, sorting utilities, repository/service contracts, and persistence. The brand name element class is **`.brand__name`**. This dictionary is the sole naming authority: all code and specifications must use these exact names, and no alternative spelling may be introduced.

- Use `dueDates` as the only task property and input/result property for the date array. Never expose or persist a parallel `dates` field.
- Keep established function identifiers listed in this dictionary, including `findPastDueDates` and `validateAndDeduplicateDueDates`; their list parameter is named `dueDates` and their behavior concerns the Todo `dueDates` property.
- Do not add another alias such as `dueDateList` or `taskDates`.
- The entity module path is `js/models/taskModel.js`; `Todo` is the record name, not a competing filename or class implementation. Extend/reuse this module; do not create a second entity module.
- Utility filenames are `textUtils.js`, `dateUtils.js`, `duplicateUtils.js`, and `sortUtils.js`. Do not create grouped aliases such as `validation.js` or `helpers.js`.

## 3. Files and their responsibilities

### Existing files (preserve these paths)

| Path | Responsibility / names owned here |
|---|---|
| `index.html` | Semantic page structure, form controls, task list containers, templates, accessible labels and ARIA relationships. Stable DOM IDs and `data-action` values are listed in sections 8–9. |
| `favicon.svg` | Brand mark used in the browser tab and brand logo elements. |
| `NAMING-DICTIONARY.md` | Authoritative implementation naming reference. |
| `00-index.md` | Index and navigation for the project specification files. |
| `01-architecture-and-structure.md` | Architecture, layer boundaries, directory structure and data flow. |
| `02-data-model-and-repository.md` | Todo record, storage envelope, migration, repository contract and error types. |
| `03-business-rules-and-workflows.md` | Validation, duplicate, merge, completion, sorting and deletion rules. |
| `04-design-system-and-tokens.md` | CSS tokens, typography, spacing, responsive breakpoints and visual naming. |
| `05-ui-components-and-accessibility.md` | UI components, drawer, task cards and accessibility requirements. |
| `06-implementation-and-acceptance-criteria.md` | API contracts and implementation acceptance criteria. |
| `todo-app-spec.md` | Consolidated project specification; must use the same canonical names as this dictionary and the numbered specifications. |
| `README.md` | Project overview, setup and launch instructions. |
| `css/style.css` | CSS entry point; imports/organizes the base, component, and page styles. |
| `css/base/vars.css` | Shared design tokens: colors, typography, transitions, sidebar width, completed-card height. |
| `css/base/typography.css` | Global text styles and heading/body typography. |
| `css/base/reset.css` | Reset and baseline element styles. |
| `css/components/buttons.css` | Button base styles and button modifiers (`.btn`, `.btn--primary`, `.btn--secondary`, `.btn--danger`). |
| `css/components/alerts.css` | Visible application alerts and the explicit corrupt-storage recovery dialog. |
| `css/components/cards.css` | Task card, task date, and card-state styles. |
| `css/components/forms.css` | Task form, fields, counters, date chips, help and validation-error styles. |
| `css/components/bulk-bar.css` | Selected-task bulk action bar. |
| `css/components/undo-banner.css` | Undo-one / Undo-all controls and banner. |
| `css/components/empty-state.css` | Empty Pending and Completed list states. |
| `css/page/page.css` | Page shell, responsive layout, sidebar/drawer, overlay, headers, sections and page-level placement. |
| `js/index.js` | Phase 2 public barrel. Re-export stable constants, task-model helpers, and pure utility functions from here. |
| `js/constants.js` | Immutable validation, date, group, and sorting constants. |
| `js/models/taskModel.js` | Phase 2 task-draft/model creation and task-input/completion-timestamp validation. |
| `js/utils/textUtils.js` | Text normalization, grapheme counting, title/description validation and comparable text. |
| `js/utils/dateUtils.js` | Calendar-date validation, construction, comparison, distance, past-date detection and deduplication. |
| `js/utils/duplicateUtils.js` | Case-insensitive normalized title/description equality and repeated sentence/segment detection. |
| `js/utils/sortUtils.js` | Pending/completed sorting, representative due-date selection and partitioning. |
| `js/repositories/TodoRepository.js` | Storage-independent asynchronous contract and exported repository error classes. |
| `js/repositories/LocalStorageTodoRepository.js` | LocalStorage adapter: read, validate, migrate, serialize, write, generate IDs, and return saved record copies. |
| `js/repositories/TodoOperationLogRepository.js` | Independent asynchronous contract for reading, appending, and updating operation journal entries. |
| `js/repositories/LocalStorageTodoOperationLogRepository.js` | Validates and persists the separate operation journal envelope under `achievra_todo_operation_log`. |
| `js/services/TodoService.js` | Domain workflows, validation orchestration, duplicate/merge decisions, completion, deletion commit and list sorting. Depends on `TodoRepository`. |
| `js/services/TodoOperationLogService.js` | Creates full write-ahead task snapshots and metadata, and records persistence, UI-check, undo, and recovery outcomes through `TodoOperationLogRepository`. |
| `js/views/TodoView.js` | DOM binding/rendering, localized task-node updates, form state and feedback, selection, accessibility, mobile drawer, alerts and undo controls. No persistence access. |
| `js/app.js` | Composition root: inject repository into service, bind application events, coordinate confirmations, batch actions and independent undo timers, then update only saved/affected task cards. |
| `tests/TodoService.test.js` | Isolated Stage 4 TodoService tests using a fake `TodoRepository`. |
| `package.json` | `"type": "module"` and the dependency-free `npm test` script for project test files. |

### Specification-defined modules for later layers

Use these exact names when those layers are added, while reusing existing Phase 2 modules above:

| Specification name | Responsibility |
|---|---|
| `js/repositories/TodoRepository.js` / `TodoRepository` | Already implemented; keep this contract and the exported error classes. |
| `js/repositories/LocalStorageTodoRepository.js` / `LocalStorageTodoRepository` | Already implemented; later layers must depend on `TodoRepository`, not this adapter. |
| `js/services/TodoService.js` / `TodoService` | Already implemented; later layers reuse this public service API. |
| `js/views/TodoView.js` / `TodoView` | DOM rendering and localized element updates, form state, selection, ARIA state, drawer, undo controls, timed status notifications and persistent choice notifications. No storage access. |
| `js/app.js` | Composition root/controller: instantiate adapter/service/view, bind events, coordinate state and undo timers. |
| `Todo` | Domain record name used by repository and service contracts; its current model helpers live in `js/models/taskModel.js`. |
| `textUtils.js`, `dateUtils.js`, `duplicateUtils.js`, `sortUtils.js` | Focused utility modules; use these paths rather than adding `validation.js` or `helpers.js`. |

## 3.1 Implementation phase map

Keep implementation prompts and handoffs in this order. Completed stages are included to preserve context; later agents must not redo them or invent alternate identifiers.

| Stage | Scope | Canonical names |
|---|---|---|
| 1 — HTML/CSS foundation (complete) | Semantic page, responsive layout, accessible form/list shells, CSS tokens and component styles. | `index.html`, `css/**`, `.brand__name`, registered HTML IDs and BEM classes. |
| 2 — Domain model and pure utilities (complete) | Constants, immutable task model helpers, text/date/duplicate/sort functions. | `js/constants.js`, `js/models/taskModel.js`, `js/utils/{textUtils,dateUtils,duplicateUtils,sortUtils}.js`, `dueDates`. |
| 3 — Repository and persistence (complete) | Storage-independent repository contract and LocalStorage adapter, versioned persistence, ID creation, migration, typed errors. | `TodoRepository`, `LocalStorageTodoRepository`, `getAll`, `create`, `update`, `merge`, `deleteMany`, `resetStorage`, `dueDates`. |
| 4 — Domain service (complete) | Business workflows, validation orchestration, duplicate/merge outcomes, list ordering and batch operations over the repository contract. | `TodoService`, `TodoOperationResult`, `TodoInput`, `TodoUpdate`, `TodoDecisions`. |
| 5 — View layer (complete) | DOM binding/rendering, localized task-node mutations, form feedback, selection, accessibility, drawer and undo controls. | `TodoView`, the registered HTML IDs, CSS classes and `data-action` values. |
| 6 — Application composition and integration (implemented; browser acceptance pending) | Instantiate/inject repository, service and view; wire UI actions, confirmations, independent deletion timers and successful persistence to granular DOM updates. | `js/app.js`, `repository`, `todoService`, `todoView`, `selectedTodoIds`, `pendingDeleteTimers`. |
| 7 — Write-ahead operation journal and recovery (implemented; browser acceptance pending) | Append a detailed log entry before task writes; record delete intent before its grace period; recover incomplete writes on startup; every five seconds compare journaled IDs updated in the last seven seconds with storage and DOM. | `TodoOperationLogRepository`, `LocalStorageTodoOperationLogRepository`, `TodoOperationLogService`, `recordBeforePersist`, `recordPendingDelete`, `recoverIncompleteOperations`, `checkRecentOperationLog`. |

Each stage implements only its listed layer and its named files. A later stage reuses earlier public identifiers exactly; it does not reimplement or rename them. If an implementation handoff exposes a mismatch with this dictionary, correct the implementation to the dictionary before building the next stage.

## 4. Domain record and storage vocabulary

| Name | Role / rule |
|---|---|
| `Todo` | One task domain record and one UI card, even when it has multiple dates. |
| `id` | Repository-generated immutable identifier. Never accepted as user input or changed by update. |
| `title` | Required normalized task title; 1–32 user-perceived grapheme clusters. |
| `description` | Optional normalized text; empty string means no description; maximum 256 grapheme clusters. |
| `dueDates` | The only task model/input/result/repository/persistence property for unique `YYYY-MM-DD` due dates; `[]` means undated. Multiple dates remain one Todo/card. |
| `completed` | Boolean task status. The user explicitly chose Boolean; do not replace it with a status string/enum. |
| `completedAt` | UTC ISO-8601 completion instant, or `null` while pending/for legacy completion without known time. Internal metadata; not user-editable. |
| `todoData` | Repository `create` input: task data without an ID; repository generates the ID. |
| `input` | New-task form/domain input, containing `title`, `description`, and `dueDates`. |
| `changes` | Allowed fields to update an existing pending Todo. Must not include or alter `id`. |
| `sourceId` | ID of the task whose content is absorbed during a merge. |
| `targetId` | ID of the existing task retained by a merge. |
| `targetChanges` | Fully computed resulting fields for the retained target; merge persists target and removes source atomically. |
| `ids` | List of Todo IDs for batch operations. |
| `deletedIds` | IDs successfully deleted by a batch operation. |
| `failures` | Per-record failures; each entry includes `id` and user-displayable `message` (service failures also identify `kind`). |
| `todos` | Array property inside the versioned LocalStorage envelope. |
| `schemaVersion` | Envelope version; current specified version is `2`. |
| `todos_app_data` | Default LocalStorage key. |
| `achievra_todo_operation_log` | Separate versioned LocalStorage key for write-ahead operation entries; never mix it into the Todo envelope. |
| `operationId` | Unique journal-entry identifier, distinct from the repository-generated `taskId`. |
| `operationType` | `create`, `update`, `merge`, `complete`, `delete`, or `recovery`. |
| `taskId`, `relatedTaskIds` | Primary affected Todo ID and every related Todo ID in a multi-record operation. |
| `before`, `after` | Full Todo snapshots before and intended after the operation; include immutable ID, title, description, `dueDates`, `completed`, and `completedAt`. |
| `status` | Operation outcome/lifecycle: `prepared`, `delete-pending`, `commit-requested`, `committed`, `failed`, `undone`, `needs-user-input`, `duplicate`, or `confirmation-required`. |
| `metadata.outcome` | Explicit `{ completed, resultStatus }` summary of whether the attempted task operation finished successfully. |
| `titleCharacterCount`, `descriptionCharacterCount` | Grapheme counts captured for each logged task snapshot using the project text utility. |
| `metadata` | Validation, descriptive task summaries, changed fields, persistence result/errors, UI comparison, delete timing and recovery history. |
| `rawContent` | Original unreadable/corrupt storage content retained on `StorageCorruptionError` for diagnosis/recovery. |
| `originalError` | Underlying platform error retained by `StorageError` when available. |

Storage envelope shape: `{ schemaVersion: 2, todos: Todo[] }`. The v1 field `date` is migration input only: `null` maps to `dueDates: []`; valid date maps to `dueDates: [date]`. Do not use legacy `date` in new records.

## 5. Repository contract names

| Method / parameter | Contract role and result |
|---|---|
| `getAll()` | Asynchronously returns copies of all `Todo` records. |
| `create(todoData)` | Creates a record, generates its `id`, persists it, and returns the saved `Todo`. |
| `update(id, changes)` | Updates allowed fields of an existing record and returns the persisted `Todo`; ID is immutable. |
| `merge(sourceId, targetId, targetChanges)` | Atomically saves the merged target and removes source; returns the saved target. Failure must not partially change either record. |
| `deleteMany(ids)` | Batch delete; returns `{ deletedIds, failures }` and may partially succeed. |
| `restoreTodoSnapshot(todoSnapshot, options)` | Idempotently replay a fully validated snapshot during operation-journal recovery, retaining the existing task ID. |
| `beforePersist` | Optional repository hook invoked with complete before/after snapshots after validation/ID generation and before writing the Todo envelope; it must persist journal intent before returning. |
| `resetStorage()` | Optional explicitly user-triggered recovery operation only; never automatic. |
| `storageKey` | Adapter's LocalStorage key; defaults to `todos_app_data`. |
| `SCHEMA_VERSION` | Adapter schema version constant/property; value `2` per acceptance specification. |
| `DomainValidationError`, `StorageError`, `StorageCorruptionError` | Exported from `TodoRepository.js` for shared storage/service error handling; corruption error extends storage error. |

All repository methods are asynchronous and return copies, not mutable internal references. The service depends on the `TodoRepository` contract, not the LocalStorage implementation.

### Operation journal contract

| Identifier | Responsibility |
|---|---|
| `TodoOperationLogRepository` | Independent async contract for operation journal persistence. |
| `getAll()` | Return validated detached journal-entry copies. |
| `append(entry)` | Persist a unique complete write-ahead operation entry. |
| `update(operationId, changes)` | Update a journal entry's lifecycle/outcome without deleting it. |
| `TodoOperationLogService` | Build complete task snapshots and metadata and manage journal state transitions. |
| `recordBeforePersist({ operationType, beforeTodos, afterTodos, metadata })` | Record operation intent and task snapshots before the task repository writes. |
| `recordPendingDelete(todo, deleteRequestedAt)` | Record the task snapshot and five-second delete grace request before muting the card. |
| `recordValidationFailure({ operationType, input, taskId, error })` | Record validation-rejected attempts and their proposed data/counts, even though no task write occurs. |
| `recordPrePersistFailure({ operationType, input, taskId, error })` | Record a storage or other operation failure that occurs before the repository's write-ahead callback, including available proposed data and failure classification. |
| `recordNonPersistedOutcome({ operationType, status, input, existingTodo, reason, message })` | Record duplicate and confirmation-required outcomes without pretending that a task write occurred. |
| `markCommitRequested(operationId)`, `markCommitted(operationId, savedTodos)`, `markFailed(operationId, error)`, `markUndone(operationId)` | Record explicit persistence/delete lifecycle outcomes. |
| `restartPendingDelete(operationId)` | Record startup recovery and start a new five-second delete grace period. |
| `markNeedsUserInput(operationId, message)`, `markUiState(operationId, state)` | Preserve incomplete recovery context and latest DOM comparison outcome. |
| `getUnresolved()`, `getRecent(sinceMs)` | Read operations requiring startup recovery or the bounded recent consistency check. |

## 6. Service methods, results, and errors

| Name | Responsibility / important names |
|---|---|
| `getTaskLists()` | Load once and return `{ pendingTodos, completedTodos }`, each sorted by its own rule. |
| `getPendingTodos()` | Return pending tasks ordered by representative due-date distance (farther first, nearer later, undated last); same representative date uses alphabetical title order. |
| `getCompletedTodos()` | Return completed tasks by completion time, earliest first; equal timestamps alphabetical; legacy null timestamps preserve their legacy ordering before timestamped records. |
| `validateTaskInput({ title, description, dueDates })` | Validation contract for task input. |
| `createTodo(input, decisions = {})` | Validate and create; may return a duplicate/confirmation result rather than persist immediately. |
| `confirmMerge(existingId, newDescription, dueDates, decisions = {})` | Confirm and persist merge into the existing Pending target; append new description below old with one newline and add unique dates. Returns the saved `Todo`, or a `confirmation-required` `TodoOperationResult` when repeated-text confirmation is still missing. |
| `updatePendingTodo(id, changes, decisions = {})` | Update pending task only; if edited title collides, apply create/merge rules and retain the agreed merge target. |
| `completeTodos(ids)` | Complete selected pending records and return successes and per-record failures. |
| `commitDelete(ids)` | Commit deletion after the per-item five-second undo window; return successes/failures. |
| `TodoOperationResult` | Service result type/status vocabulary for create/update workflows. |
| `status` | `TodoOperationResult` outcome: `created`, `updated`, `merged`, `duplicate`, or `confirmation-required`. |
| `reason` | Confirmation reason: `past-date`, `merge`, or `repeated-text`. |
| `existingTodo` | Existing record involved in a duplicate/merge decision. |
| `proposedInput` | Normalized proposed record awaiting user decision. |
| `repeatedFragments` | Description sentence/segment fragments detected as repeated. |
| `message` | Clear user-displayable explanation of an outcome or failure. |
| `TodoInput` | New/edit form data; only editable content, never repository-generated `id`. |
| `TodoUpdate` | Allowed changed fields for an existing pending Todo. |
| `TodoDecisions` | Explicit user decisions; properties below. |
| `addPastDatesAsCompleted` | User confirmation to add a task with past date(s) as completed. |
| `confirmMerge` | User confirmation to merge matching task data. |
| `confirmRepeatedText` | User confirmation to retain repeated description fragments. |
| `DomainValidationError` | Validation/business-rule failure; carries `field` and actionable `message`. |
| `StorageError` | Storage access/quota/read/write failure; carries `message` and optional `originalError`. |
| `StorageCorruptionError` | Corrupt/unsupported stored data; extends `StorageError`, carries optional `rawContent`. |
| `field` | Field name associated with a validation error, such as `title`, `description`, or `dueDates`. |
| `kind` | Batch/service failure category: `validation` or `storage`. |

### `TodoView` method names from the acceptance specification

| Method | Role |
|---|---|
| `bindDOMElements()` | Cache references to the stable HTML IDs. |
| `renderInitialLists(pendingTodos, completedTodos)` | Initial rendering after service load. |
| `updateBadgeCounts(pendingCount, completedCount)` | Update list/sidebar counts. |
| `addTodoElement(todo, position = 'sorted')` | Add one new card at its sorted position. |
| `updateTodoElement(todo)` | Update the changed card only. |
| `moveTodoElement(id, targetSection, updatedTodo = null)` | Move a card between `pending` and `completed` using the saved Todo returned by the service. |
| `removeTodoElement(id)` | Remove one card after a successful deletion commit. |
| `animateTodoRemoval(id)` | Apply the 0.3-second exit transition and then remove one persisted card; honors reduced-motion preferences. |
| `setTaskSelected(id, isSelected)` | Set a task's checkbox/selected presentation. |
| `setTaskPendingDeletion(id, isPending)` | Mute/unmute a task during its undo window. |
| `toggleTaskCardExpansion(id)` | Expand/collapse a completed card and update its accessible state. |
| `openTaskForm(prefillData = null)`, `closeTaskForm()` | Open/close create/edit/copy form. |
| `getTaskFormData()` | Return `{ title, description, dueDates }` from the visible form without including the edit ID. |
| `getEditingTodoId()` | Return the ID stored in `editTaskId`, or `null` when creating/copying. |
| `addDateToForm(date)`, `removeSelectedDate(date)` | Add or remove one distinct date in the form's `dueDates` collection. |
| `getSelectedTodoIds()` | Return selected task IDs for the application composition root. |
| `getRenderedTodoIds()` | Return task IDs found in the currently attached Pending and Completed card nodes. |
| `isTodoElementInSection(id, isCompleted)` | Check that one indexed card is attached to the section matching its saved completion state. |
| `isTodoElementConsistent(todo)` | Compare a saved Todo's title, description, status, and due dates with the indexed card's current DOM content. |
| `removeDuplicateTodoElements(id)` | Remove stray duplicate DOM cards while retaining the view's indexed card. |
| `highlightTodoElement(id)`, `clearTodoHighlight(id)` | Temporarily highlight an existing task after a duplicate result without conflating it with checkbox selection. |
| `setFormErrors(errors)`, `clearFormErrors()` | Display or clear field/form validation errors without clearing user input. |
| `openMobileDrawer()`, `closeMobileDrawer()` | Open/close accessible modal sidebar and restore focus on close. |
| `renderTaskUndoControl(id, secondsRemaining, onUndoClick)` | Render one task's individual Undo control. |
| `renderUndoAllControl(activeIds, onUndoAllClick)` | Render Undo All for deletions whose timers have not expired. |
| `removeTaskUndoControl(id)` | Remove one task's Undo control when its timer resolves/cancels. |
| `showStorageAlert(message, type = 'error')` | Explain a storage failure to the user. |
| `showChoiceNotification(message, { confirmLabel, cancelLabel })` | Show the decision message and its two explicit buttons in the notification region; resolve only after a button is chosen, with no timeout. |
| `#renderNextChoiceNotification()` | Render queued decision notifications one at a time so a pending choice remains until its button is activated. |
| `showCorruptionDialog(onResetConfirm)` | Explain corrupt storage and expose explicit reset confirmation. |

TodoView's local helper identifiers are also reserved for their stated view roles: `REQUIRED_DOM_IDS` (required static element IDs), `FIELD_ERRORS` (form field-to-error mapping), `COMPLETED_EXPANDED_MAX_HEIGHT` and `COMPLETED_EXPANDED_COMPACT_HEIGHT` (24rem maximum and two-thirds compact completed-card expansion modes), `localTodayDate` (local calendar date), `setText` (safe text assignment), `cloneTemplate` (clone trusted static markup), `dateLabel` (date-only display), `#createTodoElement` (build one card), `#renderTaskDates` (render date chips/indicators), `#insertTodo` and `#insertExistingTodoElement` (insert one Todo at its sorted location), `#renderSelectedDateChips` (render form date values), `#updateCharacterCounters` (grapheme counters), `#updateBadgeCountsFromDOM` (derive visible list counts), `#getSelectedTodos` and `#syncSelectionActions` (selection state/action matrix), `#animateTodoEntry` (animate one newly added card unless reduced motion is requested), `#getDrawerFocusableElements` and `#setDrawerBackgroundInert` (modal drawer focus/background behavior), and `#handleOverlayClick` (close the drawer from its backdrop). These are private view helpers, not additional service or persistence APIs.

`TodoService` serializes duplicate-sensitive mutations through its private `#enqueueMutation` queue and private `#createTodo`, `#confirmMerge`, and `#updatePendingTodo` implementations. Public mutation methods retain their documented signatures and return asynchronous results.
`TodoService.#persistMutation(operationType, persist)` is the single mutation wrapper that writes journal intent before the repository commit and records its outcome; `TodoService.#recordUnjournaledFailure(operationType, input, error, taskId)` records failures that happen before that journal callback.

### `js/app.js` coordination vocabulary

| Identifier | Role |
|---|---|
| `repository` | The injected `LocalStorageTodoRepository` adapter instance. Only used by the composition root for explicit recovery reset; regular reads/writes go through `todoService`. |
| `operationLogRepository` | Independent operation-journal adapter instance; exposes its configured `storageKey` for cross-tab storage events. |
| `todoService` | The domain service instance receiving `repository`. |
| `todoView` | The DOM view instance receiving the page `Document`. |
| `todosById` | Composition-root lookup map synchronized after successful service operations; used to resolve task IDs to current records for actions and messages. |
| `pendingDeleteTimers` | Map of task ID to that task's independent five-second timeout, countdown interval, and deadline. |
| `duplicateHighlightTimers` | Map of task ID to the timer that clears its temporary duplicate-result highlight. |
| `DELETE_GRACE_PERIOD_MS` | Per-task deletion grace duration, `5000`. |
| `UNDO_COUNTDOWN_INTERVAL_MS` | UI countdown refresh interval, `1000`. |
| `DUPLICATE_HIGHLIGHT_DURATION_MS` | Duration of the temporary duplicate-result card highlight, `2500`. |
| `OPERATION_LOG_CHECK_INTERVAL_MS` | Operation-journal checker interval, `5000` milliseconds. |
| `OPERATION_LOG_RECENT_WINDOW_MS` | Recent-journal query window, `7000` milliseconds. |
| `NOTIFICATION_CHOICE_LABELS` | User-visible button labels keyed by confirmation `reason`. |
| `hasLoadedTaskLists` | Track whether the initial task lists have loaded. |
| `isCheckingOperationLog` | Prevent overlapping journal checks. |
| `recoveredDeleteOperations` | Delete journal entries awaiting restart of their individual five-second timer after initial load. |
| `hasReportedBackgroundCorruption` | Avoid repeating the task-storage corruption message during background operation. |
| `selectedTodoIds()` | Read current checkbox selection from `todoView`. |
| `updateTodoIndex(todo)`, `removeTodoFromIndex(id)` | Synchronize the composition-root `todosById` lookup map after successful persisted changes. |
| `loadTaskLists()` | Recover unresolved journal entries, read sorted task sections, sync the lookup map, perform the one allowed initial full render, and restart timers only for `delete-pending` or `commit-requested` delete entries. |
| `recoverIncompleteOperations()` | Compare eligible unresolved operation before/after snapshots with persisted task data; replay a complete valid interrupted operation or ask the user to review available fields. Explicitly failed deletes are kept in the journal but not automatically retried. |
| `checkRecentOperationLog()` | Every five seconds inspect only committed entries updated in the prior seven seconds; compare journal state against storage and DOM by affected task ID, repair that ID, and remove stored data only for an explicitly committed delete or merge-source removal. |
| `isCommittedRemoval` | Guard that permits reconciliation to remove stored data only for a committed delete or a committed merge snapshot that omits the affected source ID. |
| `bindApplicationEvents()` | Connect form, date, sidebar, card action, and bulk-action events to application handlers. |
| `handleTaskFormSubmit(event)` | Submit create/edit data, retain entered values on duplicate/cancel/failure, and render only successful service results. |
| `resolveOperation(input, editingTodoId)` | Re-call create/update service operations with only the user's explicitly confirmed decisions. |
| `applySuccessfulOperation(result, editingTodoId, closeTaskForm)` | Update/add the saved task card, remove an absorbed source card after merge, and close the form only for a successful form save. |
| `showError(error)` | Route typed validation, storage and corruption errors to field feedback, an alert or the explicit recovery dialog. |
| `highlightDuplicate(todo)` | Highlight an existing duplicate task temporarily and manage its clearing timer. |
| `beginPendingDeletion(id, existingOperationId, isRecovered)` | Journal the delete intent before muting, then start the independent five-second timer; recovery restarts a fresh timer. |
| `clearDeleteTimer(id)` | Clear one task's timeout and countdown interval and remove its active undo state. |
| `refreshUndoAllControl()` | Re-render Undo All using only IDs with active timers. |
| `restorePendingDeletion(id)` | Cancel one active timer and restore its task card. |
| `undoAllPendingDeletions(ids)` | Cancel only the supplied IDs that still have active timers. |
| `commitExpiredDeletion(id)` | Call `todoService.commitDelete([id])` after that task's own grace period and animate card removal only when deletion succeeds. |
| `removeDueDateFromTodo(id, date)` | Persist removal of one due date and update only that task card after success. |
| `completeSelectedTodos()` | Complete the currently selected pending IDs, render successful records, and report per-record failures. |
| `deleteSelectedTodos()` | Start an independent deletion window for each selected task. |
| `handleTaskAction(event)` | Route delegated task/date/undo actions by their registered `data-action`. |

The composition root wires form submission and counters, task selection and card actions, bulk actions, drawer controls, and deletion timers. Each task has its own five-second timer; Undo All addresses only IDs whose timers are still active. Ordinary reads/writes and deletion commits go through `todoService`; only explicit, user-triggered recovery calls `repository.resetStorage()`.

## 7. Existing Phase 2 exported API

Preserve these exact names and their current file ownership when agents add logic. Use `js/index.js` as the public barrel rather than inventing aliases.

### Constants in `js/constants.js`

| Identifier | Role |
|---|---|
| `TITLE_MIN_LENGTH`, `TITLE_MAX_LENGTH` | Title grapheme limits (`1`, `32`). |
| `DESCRIPTION_MIN_LENGTH`, `DESCRIPTION_MAX_LENGTH` | Description grapheme limits (`0`, `256`). |
| `REPEATED_SENTENCE_THRESHOLD`, `MIN_REPEATED_SENTENCES_FOR_FLAG` | Repeated-description threshold definitions. |
| `CALENDAR_DATE_FORMAT`, `CALENDAR_DATE_PATTERN` | Date-only format label and shape pattern. |
| `TASK_MODEL_FIELDS` | Allowed task-model property names; must include `dueDates` and must not include `dates`. |
| `TEXT_VALIDATION_REASONS` | Structured text-validation reason values. |
| `DATE_VALIDATION_REASONS` | Structured date-validation reason values. |
| `DATE_RELATION` | `BEFORE`, `EQUAL`, `AFTER` date relation values. |
| `TASK_GROUPS` | `PENDING` and `COMPLETED` task group values. |
| `REPRESENTATIVE_DATE_STATUS` | States describing pending representative-date resolution. |

### Model exports in `js/models/taskModel.js`

| Identifier | Role |
|---|---|
| `isValidCompletionTimestamp(completedAt)` | Validate UTC ISO completion timestamp. |
| `validateTaskInput(input)` | Validate/normalize title, description and `dueDates`; return per-field results and normalized input. |
| `dueDatesResult` | Structured validation result for the `dueDates` input field. |
| `uniqueDates` | Validated, de-duplicated date values inside `dueDatesResult`; not a Todo property. |
| `createTaskDraft(input)` | Create immutable unpersisted task with `id: null`, `completed: false`, `completedAt: null`. |
| `createTaskModel(record)` | Validate and create immutable task model; rejects unknown fields and invalid record state. |

### Text exports in `js/utils/textUtils.js`

| Identifier | Role |
|---|---|
| `splitGraphemes(text)` | Split user-perceived Unicode grapheme clusters. |
| `countCharacters(text)` | Count grapheme clusters, not UTF-16 code units. |
| `normalizeText(text)` | Trim edges and collapse internal whitespace runs. |
| `normalizeTitle(title)`, `normalizeDescription(description)` | Field-specific normalized text. |
| `toComparableText(text)` | Normalize and case-fold text for duplicate comparisons. |
| `validateTitle(rawTitle)`, `validateDescription(rawDescription)` | Validate normalized text against required/length rules. |

### Date exports in `js/utils/dateUtils.js`

| Identifier | Role |
|---|---|
| `isLeapYear(year)` | Gregorian leap-year check. |
| `getDaysInMonth(year, month)` | Calendar month length. |
| `validateCalendarDate(value)`, `isValidCalendarDate(value)` | Validate date shape and actual calendar date. |
| `createCalendarDate(year, month, day)` | Construct date-only value without time-zone shifting. |
| `compareCalendarDates(dateA, dateB)` | Compare date-only values. |
| `getDueDateRelationToToday(dueDate, todayDate)` | Classify date as before/equal/after today. |
| `findPastDueDates(dueDates, todayDate)` | Find past dates from a task's dueDates array. |
| `getCalendarDayNumber(value)`, `getCalendarDayDistance(dateA, dateB)` | Convert/compare calendar days and compute distance. |
| `validateAndDeduplicateDueDates(dueDates)` | Validate dueDates list and remove duplicate date values. |

### Duplicate exports in `js/utils/duplicateUtils.js`

| Identifier | Role |
|---|---|
| `areTitlesEqual(titleA, titleB)` | Compare normalized titles case-insensitively. |
| `areDescriptionsEqual(descriptionA, descriptionB)` | Compare normalized descriptions case-insensitively. |
| `parseDescriptionSentenceSegments(description)` | Split description into comparable sentence/segment units. |
| `findRepeatedDescriptionSentences(descriptionA, descriptionB)` | Return repeated description segments across two descriptions. |

### Sorting exports in `js/utils/sortUtils.js`

| Identifier | Role |
|---|---|
| `compareNormalizedTitles(titleA, titleB)` | Case-insensitive normalized alphabetical comparison. |
| `resolvePendingTaskRepresentativeDate(task, todayDate)` | Resolve the closest-to-today date used to position a pending task. |
| `comparePendingTasks(taskA, taskB, todayDate)` | Compare pending tasks by specification ordering and title tie-break. |
| `sortPendingTasks(pendingTasks, todayDate)` | Return sorted pending-task copy. |
| `toComparableCompletionTime(completedAt)` | Convert completion timestamp into comparable ordering value; preserve legacy-null behavior. |
| `compareCompletedTasks(taskA, taskB)` | Compare completion time then normalized title, respecting legacy order rule. |
| `sortCompletedTasks(completedTasks)` | Return sorted completed-task copy. |
| `partitionTasksByCompletion(tasks)` | Split tasks into pending and completed arrays using Boolean `completed`. |
| `sortTasksByExplicitGroup(tasks, todayDate)` | Sort each explicit group by its group rule. |

## 8. Current HTML IDs and their roles

IDs are stable JavaScript/view hooks. Reuse them; do not create a second ID for the same control. A `Template` ID identifies a reusable `<template>` element.

| ID | Role |
|---|---|
| `sidebarToggler` | Mobile sidebar open/close trigger. |
| `sidebar-navigation` | Sidebar navigation/dialog surface; ARIA control target. |
| `sidebarDialogTitle` | Accessible name for the mobile drawer. |
| `totalTasksBadge` | Overall task count badge. |
| `sidebarOverlay` | Backdrop that closes the open mobile drawer. |
| `mainContent` | Main page content region. |
| `pendingSummaryText` | Short pending-task summary text. |
| `openAddModalBtn` | Opens the task form. |
| `notificationRegion` | In-app notification stack for timed status messages and persistent decision choices. |
| `statusRegion` | Accessible live status announcements. |
| `taskFormCard` | Visible task form panel. |
| `formTitle` | Form heading; create/edit context. |
| `closeFormBtn` | Closes task form. |
| `taskForm` | Task create/edit form. |
| `editTaskId` | Hidden edit-context ID; not user-editable task data. |
| `formError` | Form-level error message. |
| `titleCounter`, `taskTitleInput`, `titleHelp`, `titleError` | Title field, live count, help and validation error. |
| `descCounter`, `taskDescInput`, `descHelp`, `descError` | Description field, live count, help and validation error. |
| `taskDateInput`, `addDateBtn`, `dateHelp`, `dateError` | Date picker, add-date control, help and validation error. |
| `selectedDatesLabel`, `selectedDatesList`, `selectedDatesEmpty` | Selected date list and its empty-state text. |
| `saveTaskBtn`, `cancelFormBtn` | Save and cancel form actions. |
| `pendingHeading`, `pendingCountBadge`, `pendingEmpty`, `pendingList` | Pending section heading, count, empty state and list. |
| `undoAllBanner`, `undoAllText`, `undoAllBtn` | Undo-all banner, explanation and action. |
| `completedHeading`, `completedCountBadge`, `completedEmpty`, `completedScroll`, `completedList` | Completed section heading/count, empty state, scroll viewport and list. |
| `bulkBar`, `bulkCount`, `bulkCompleteBtn`, `bulkDeleteBtn` | Bulk selection bar, selected count, complete action and delete action. |
| `pendingTaskTemplate` | Template for pending task card. |
| `completedTaskTemplate` | Template for completed task card. |
| `dateChipTemplate` | Template for a selected date chip in the form. |
| `undoButtonTemplate` | Template for an individual task undo control. |
| `completed-description-ID` | Template placeholder ID; when cloned, replace `ID` with a unique task-safe value and keep its label relationship valid. |

## 9. CSS component names and state modifiers

CSS uses the existing BEM block as the component name. Add a new class only when it represents a distinct component, element, or state.

| Block / class family | Role |
|---|---|
| `.app-shell` | Overall application frame. |
| `.navbar`, `.navbar__brand`, `.navbar__logo`, `.navbar__toggler` | Mobile top bar, logo and drawer trigger. The closed mobile bar shows the logo only. |
| `.sidebar`, `.sidebar--open`, `.sidebar__brand`, `.sidebar__logo`, `.brand__name`, `.sidebar__nav`, `.sidebar__tab`, `.sidebar__tab--active`, `.sidebar__badge`, `.sidebar__note`, `.sidebar__note-text`, `.nav-label` | Sidebar and its open/active states, brand, navigation labels and contents. |
| `.sidebar-overlay`, `.sidebar-overlay--visible` | Drawer backdrop and visible state. |
| `.main-content`, `.main-header`, `.main-header__titles`, `.main-header__title`, `.main-header__subtitle`, `.main-header__add-btn` | Main area and page header. |
| `.task-form`, `.task-form--hidden`, `.task-form__*`, `.task-form__input--error`, `.task-form__date-chip`, `.task-form__date-remove` | Form panel and its hidden state, header, labels, counters, inputs, errors, date row/chips, and actions. |
| `.task-section`, `.task-section--pending`, `.task-section--completed`, `.task-section__*` | Pending/Completed section and heading/count elements. |
| `.task-list` | Container for task cards. |
| `.completed-scroll-container` | Completed section internal scroll viewport (up to four collapsed cards visible). |
| `.task-item`, `.task-item--completed`, `.task-item--overdue`, `.task-item--selected`, `.task-item--pending-deletion`, `.task-item--expanded`, `.task-item--duplicate-match`, `.task-item--entering`, `.task-item--exiting` | Task card and its defined visual states; duplicate-match is a temporary highlight distinct from checkbox selection, and entering/exiting control 0.3-second list transitions. |
| `.task-item__checkbox`, `.task-item__content`, `.task-item__title-row`, `.task-item__title`, `.task-item__description`, `.task-item__meta`, `.task-item__dates`, `.task-item__date`, `.task-item__date--past`, `.task-item__past`, `.task-item__date-remove`, `.task-item__actions`, `.task-item__btn`, `.task-item__btn-edit`, `.task-item__btn-copy`, `.task-item__btn-delete`, `.task-item__btn-undo`, `.task-item__toggle` | Task card sub-elements and actions. |
| `.undo-banner`, `.undo-banner__text`, `.undo-banner__btn` | Shared undo banner and controls. |
| `.bulk-bar`, `.bulk-bar__count`, `.bulk-bar__actions`, `.bulk-bar__btn-complete`, `.bulk-bar__btn-delete` | Bulk action bar. |
| `.empty-state`, `.empty-state__title`, `.empty-state__text` | Empty-list message. |
| `.app-alert`, `.app-alert__message`, `.app-alert--error`, `.app-alert--success`, `.app-alert--info` | Visible application feedback for storage/domain outcomes. Ordinary status alerts auto-dismiss after five seconds and show a blue progress bar. |
| `.app-alert--choice`, `.app-alert__actions`, `.app-alert__progress`, `.app-alert__progress-fill` | A choice alert includes its decision buttons and stays visible without a timer until a button is activated; the progress track/fill are used only for timed status alerts. |
| `.notification-region` | In-app stack that contains status and choice notifications. |
| `.storage-dialog`, `.storage-dialog__actions` | Accessible corrupt-storage explanation and explicit reset/cancel actions. |
| `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--danger` | Shared button base and visual variants. |
| `.icon` | SVG icon sizing/alignment hook. |
| `.visually-hidden` | Visually hidden text that remains available to assistive technology. |

### CSS custom properties in `css/base/vars.css`

Preserve these token names; use them instead of repeating literal design values when the token applies.

| Token family / names | Role |
|---|---|
| `--clr-primary`, `--clr-primary-hover`, `--clr-primary-shadow`, `--clr-primary-light`, `--clr-primary-lighter`, `--clr-primary-glow`, `--clr-primary-ring` | Primary brand color and hover/focus/background effects. |
| `--clr-text-heading`, `--clr-text-body`, `--clr-text-input`, `--clr-text-secondary`, `--clr-text-muted`, `--clr-text-faint`, `--clr-text-completed` | Text hierarchy. |
| `--clr-border-light`, `--clr-border-default`, `--clr-border-input`, `--clr-border-form`, `--clr-border-hover`, `--clr-border-empty` | Border hierarchy and states. |
| `--clr-bg-page`, `--clr-bg-card`, `--clr-bg-hover`, `--clr-bg-badge`, `--clr-bg-completed`, `--clr-bg-empty`, `--clr-bg-note` | Surface/background colors. |
| `--clr-danger`, `--clr-danger-bg`, `--clr-danger-border` | Error/destructive states. |
| `--clr-warning`, `--clr-warning-bg`, `--clr-warning-border` | Past-date warning/highlight states. |
| `--clr-overlay` | Dark translucent drawer backdrop. |
| `--ff-body`, `--ff-heading` | Body and heading font stacks. |
| `--transition-fast`, `--transition-drawer`, `--transition-mutate` | Standard, drawer, and 0.30-second item mutation transitions. |
| `--sidebar-width` | Desktop sidebar width. |
| `--completed-card-height` | Collapsed completed-card height. |

## 10. DOM action and accessibility vocabulary

| Name / value | Role |
|---|---|
| `data-id` | Associates a rendered task card/undo control with its immutable Todo ID. |
| `data-action="select"` | Native checkbox selection of the task. |
| `data-action="remove-date"` | Remove only the selected due date from a multi-date pending task. |
| `data-action="remove-selected-date"` | Remove one date from the form's selected `dueDates` before submission. |
| `data-date` | Date-only value associated with one task-date or form-date removal control. |
| `data-action="edit"` | Open pending-task edit flow. |
| `data-action="delete"` | Start this task's independent five-second deletion/undo flow. |
| `data-action="expand"` | Toggle completed card description expansion. |
| `data-action="copy"` | Start a new task form prefilled from a completed task; date defaults to today and remains editable. |
| `data-action="undo-delete"` | Undo deletion for the associated task. |
| `aria-expanded` | Open/closed state of drawer or expandable task card. |
| `aria-controls` | Identifies the controlled sidebar or expandable content region. |
| `aria-labelledby` | Names dialog/region from its visible heading. |
| `aria-modal` | Identifies the open mobile drawer as modal. |
| `role="status"` / live region | Announces success, failure and status changes accessibly. |
| native checkbox | Task selection control; retain native keyboard and checked-state semantics. |

Use semantic HTML and associated `<label>` elements. Icon-only controls still need an accessible name and the specification requires a descriptive visible label for actionable icons. Decorative SVGs are hidden from assistive technology. Never insert raw user text using `innerHTML`; create elements and assign `textContent`.

## 11. Business and UI vocabulary

| Name / phrase | Meaning |
|---|---|
| `Pending` | Tasks where `completed === false`; this list grows vertically without its own internal scrollbar. |
| `Completed` | Tasks where `completed === true`; internally scrolls with up to four collapsed cards shown. |
| `No tasks` | Initial empty state when storage has no records. |
| `No description` | Placeholder shown when `description === ""`. |
| `representative date` | For a pending task with dates, its date closest to today by absolute calendar-day distance; used for list ordering. |
| `past date` | A due date earlier than today's year/month/day; it has no time-zone/time-of-day component. |
| `merge` | Keep one existing target task, append nonempty new description on a new line, add unique dates, remove source atomically. |
| `source` / `target` | Source is absorbed/removed; target is the retained existing record/card and ID. |
| `repeated fragment` | Repeated description segment detected under the agreed punctuation/segment rule; ask for confirmation as specified before retaining repeats. |
| `pending deletion` | Muted task waiting its own five-second timer; each task has its own Undo control; Undo All covers all still-pending deletions. Storage is unchanged until commit. |
| `partial success` | Batch operation can succeed for some records; report each failure and its task/location. |
| `storage failure` | Distinct from validation failure; preserve form data and do not optimistically alter DOM. |
| `corrupt storage` | Reject invalid/unsupported persisted data without silently deleting or overwriting it; offer recovery only by explicit user action. |

## 12. Agent handoff rule

Before adding a name, search this dictionary and the existing source for the concept. Reuse the listed identifier. If a required name is missing, choose a name that follows section 1, add it to this dictionary in the same change, and use it consistently. If a specification name conflicts with an existing implementation name, follow section 2 and report the mapping in the handoff summary.
