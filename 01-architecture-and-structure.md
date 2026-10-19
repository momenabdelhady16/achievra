# 01 — Architecture & Scope Specification

## 1. Project Overview & Scope

A client-side To-Do application built with **semantic HTML5, CSS3, and Vanilla JavaScript (ES6+)**. 
Persistence uses browser `localStorage` wrapped behind an asynchronous Repository interface so it can be swapped for a REST API, GraphQL, or database without modifying the domain rules or UI rendering layers.

### In Scope (Version 1 - MVP)
- Create, view, complete, edit, and delete tasks.
- Task attributes: immutable repository-generated ID, Title (max 32 graphemes), Description (max 256 graphemes), zero or more due dates (`YYYY-MM-DD`), Status (`completed`: Boolean), and completion timestamp metadata.
- Edit pending tasks (inline editing of title, description, and date).
- Multi-selection for bulk actions (bulk complete, bulk delete).
- Asynchronous Repository pattern with Schema Versioning (`schemaVersion: 2`), migrating version 1 date fields without losing tasks.
- Duplicate detection & description merge rules (with sentence repetition checking).
- One task record/card may contain multiple due dates; matching titles with new dates follow the merge rules in module 03.
- 5-second deletion grace period with independent Undo controls per task and an Undo All control while multiple deletions are pending.
- Two task display sections: **Pending** (grows vertically) and **Completed** (shows up to 4 collapsed items with internal scrollbar, expandable cards).
- Full responsive design: Desktop sidebar (>768px) and accessible off-canvas drawer (≤768px) with top navbar.
- Comprehensive validation, character counters, local storage error/corruption handling, keyboard navigation, and ARIA semantics.
- All interface copy in **English**.

### Out of Scope (Future Versions)
- Categories and tags (future feature; no placeholder controls in MVP).
- Search and filtering bars.
- Backend databases, user accounts, and authentication.
- Drag-and-drop manual ordering.
- Trash/recycle bin (future: deleted tasks may be retained there; in the MVP deletion is permanent after the 5s undo window).
- Search no-results behavior (future: decide its message when search is introduced; no search exists in the MVP).

---

## 2. Architectural Design & SOLID Principles

```
                  ┌────────────────────────┐
                  │       User Action      │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │         app.js         │  (Composition Root / Controller)
                  └───┬────────────────┬───┘
                      │                │
       calls service  │                │ calls view
                      ▼                ▼
         ┌──────────────────┐    ┌──────────────────┐
         │  TodoService.js  │    │   TodoView.js    │
         └────────┬─────────┘    └──────────────────┘
                  │
      delegates   │ (depends on abstraction)
                  ▼
         ┌──────────────────┐
         │  TodoRepository  │ (Interface / Contract)
         └────────▲─────────┘
                  │ implements
         ┌────────┴─────────────────┐
         │ LocalStorageRepository.js│
         └────────┬─────────────────┘
                  │ reads/writes
                  ▼
         ┌──────────────────┐
         │   localStorage   │
         └──────────────────┘
```

### Module Responsibilities & SOLID Application

1. **Single Responsibility Principle (SRP):**
   - `taskModel.js`: Pure data structure and entity-level invariants.
   - `TodoRepository.js`: Contract interface specifying only required storage methods (`getAll`, `create`, `update`, atomic `merge`, `deleteMany`).
   - `LocalStorageTodoRepository.js`: Exclusively handles serialization, deserialization, envelope validation, and `localStorage` I/O.
   - `TodoService.js`: Implements domain logic, validation orchestration, duplicate handling, merge decisions, and sorting. Does not know storage details or touch DOM.
   - `TodoView.js`: DOM manipulation, rendering, event bubbling/binding, accessibility attributes, CSS transitions, and the task snapshots paired with currently rendered cards. `app.js` reads a task needed for an action through `getTodoById()` instead of keeping a second task map. The repository remains the persisted-data authority; the view cache is only for coordinating the current DOM. Never accesses storage.
   - `app.js`: Composition root and application event coordinator. Instantiates dependencies, injects the Todo repository and operation-log service, binds UI events, coordinates undo timers, resumes unresolved journal entries at startup, and checks only journaled task IDs changed within the last seven seconds every five seconds. It must not keep a parallel copy of the Todo records; task snapshots needed for a UI action come from `TodoView.getTodoById()`.
   - `TodoOperationLogService.js`: Records full write-ahead task snapshots and descriptive metadata through its own repository contract; it does not access the DOM or the Todo storage key.
   - `LocalStorageTodoOperationLogRepository.js`: Persists and validates the separate operation journal key. It never edits the Todo envelope.
   - `textUtils.js`, `dateUtils.js`, `duplicateUtils.js`, and `sortUtils.js`: Focused pure utility functions for text, dates, duplicate comparison, and sorting. ID generation belongs to the repository adapter, not a utility or the entity.

2. **Open / Closed Principle (OCP):**
   - The application can swap storage mechanisms (e.g., from `LocalStorageTodoRepository` to `FetchApiTodoRepository`) by supplying a new repository implementing the contract without changing a single line in `TodoService` or `TodoView`.

3. **Liskov Substitution Principle (LSP):**
   - Every repository implementation must conform to the asynchronous Promise-based signature, error taxonomy, and return types.

4. **Interface Segregation Principle (ISP):**
   - `TodoRepository` contains current Todo persistence operations and a narrowly scoped snapshot recovery method. `TodoOperationLogRepository` separately contains journal `getAll`, `append`, and `update`; the two contracts are not combined.

5. **Dependency Inversion Principle (DIP):**
   - `TodoService` depends on the Todo repository and operation-log service abstractions, not their concrete LocalStorage adapters. Dependencies are passed via constructor injection.

6. **Write-ahead recovery and background consistency:**
   - A validated mutation's complete intended task snapshot and metadata are appended to the operation journal after the repository has assigned the task ID and before the Todo envelope is written.
   - A delete intent is journaled before the task is muted and its five-second undo timer starts. On reload, an unresolved `delete-pending` or `commit-requested` delete resumes with a fresh five-second grace period while the Todo remains stored. A delete explicitly recorded as `failed` is not retried automatically; the Todo remains available.
   - On startup, unresolved create/update/complete/merge operations are compared with their before/after snapshots. If the before state still exists, the complete valid operation is replayed. If the after state already exists, it is marked committed. If neither state matches or the journal data cannot be used safely, available task fields are placed in the form and the user is asked to review them.
   - While visible, the checker runs every five seconds and examines only journal entries updated within the previous seven seconds. For each affected task ID it compares the journal's expected state with persisted data and the corresponding DOM card, updating only affected task records/cards.
   - Cross-tab Todo or journal storage events and returning to a visible tab trigger the same journal checker immediately. No background full-list comparison runs; the checker acts only on IDs present in recent journal entries and never resets an open form draft. Transient read failures are retried; damaged journal data is never silently cleared.

---

## 3. Directory & File Structure

```
todo-app/
├── index.html                           # Semantic HTML5 entry point
├── css/
│   ├── style.css                        # CSS entry point
│   ├── base/
│   │   ├── vars.css
│   │   ├── typography.css
│   │   └── reset.css
│   ├── components/
│   │   ├── buttons.css
│   │   ├── bulk-bar.css
│   │   ├── cards.css
│   │   ├── empty-state.css
│   │   ├── forms.css
│   │   └── undo-banner.css
│   └── page/
│       └── page.css
├── js/
│   ├── app.js                           # Composition root & event wiring
│   ├── index.js                         # Public barrel for Phase 2 exports
│   ├── constants.js                     # Shared domain constants
│   ├── models/
│   │   └── taskModel.js                 # Todo model helpers and invariants
│   ├── repositories/
│   │   ├── TodoRepository.js            # Abstract interface / JSDoc contract
│   │   ├── LocalStorageTodoRepository.js # Concrete localStorage adapter
│   │   ├── TodoOperationLogRepository.js # Independent journal contract
│   │   └── LocalStorageTodoOperationLogRepository.js # Journal adapter
│   ├── services/
│   │   ├── TodoService.js               # Business rules, validation & duplicate handling
│   │   └── TodoOperationLogService.js   # Journal metadata and recovery state
│   ├── views/
│   │   └── TodoView.js                  # View layer, localized DOM mutations, ARIA handling
│   └── utils/
│       ├── textUtils.js                 # Text normalization, grapheme counts, validation
│       ├── dateUtils.js                 # Calendar date validation and comparison
│       ├── duplicateUtils.js            # Duplicate text comparison
│       └── sortUtils.js                 # Pending/completed ordering
└── README.md
```

### Script Loading Order in `index.html`
Scripts are loaded in dependency order without a bundler:
1. `js/constants.js`
2. `js/utils/textUtils.js`
3. `js/utils/dateUtils.js`
4. `js/utils/duplicateUtils.js`
5. `js/utils/sortUtils.js`
6. `js/models/taskModel.js`
7. `js/repositories/TodoRepository.js`
8. `js/repositories/LocalStorageTodoRepository.js`
9. `js/repositories/TodoOperationLogRepository.js`
10. `js/repositories/LocalStorageTodoOperationLogRepository.js`
11. `js/services/TodoOperationLogService.js`
12. `js/services/TodoService.js`
13. `js/views/TodoView.js`
14. `js/app.js`

---

## 4. End-to-End Data Flow

1. **Initialization:**
   - `app.js` runs on `DOMContentLoaded`.
   - Instantiates `LocalStorageTodoRepository`, `TodoOperationLogService` with its independent adapter, `TodoService(repo, operationLog)`, and `TodoView()`.
   - Recovers unresolved journal entries before loading lists, then calls `TodoService.getTaskLists()`, which reads stored tasks and returns them split and sorted by section.
   - `LocalStorageTodoRepository` reads and validates envelope `{ schemaVersion: 2, todos: [...] }`; migrates valid v1 records (`date` to `dueDates`).
   - `TodoView.renderInitialLists(pendingTodos, completedTodos)` populates Pending & Completed sections.
2. **Task Creation:**
   - User inputs form data (Title, optional Description, optional Due Date).
   - Form submission intercepted by `app.js`.
   - `TodoService.createTodo(input)` normalizes text, validates constraints, and checks duplicates.
   - If valid, `repository.create(todoData)` reads and validates storage, generates the ID, validates the complete Todo, awaits the journal write-ahead callback, then writes to `localStorage` and returns the saved task.
   - Upon Promise resolution, `TodoView.addTodoElement(savedTodo)` inserts the DOM node with a `0.3s` entrance transition. A merge updates only the existing task element.
3. **Task Completion:**
   - User selects task(s) via checkbox and clicks "Mark Complete".
   - `TodoService.completeTodos(ids)` updates status and commits via `repository.update()`.
   - `TodoView.moveTodoElement(id, 'completed')` transitions the node without full list re-render.
4. **Task Deletion:**
   - User selects task(s) and clicks "Delete".
   - Immediate UI feedback: rows muted (`.task-item--pending-deletion`), each task gets an adjacent Undo control and independent 5s timer; multiple pending deletions also show Undo All.
   - If Undo clicked: row unmuted, timer cleared, storage untouched.
   - If timer expires: `repository.deleteMany(ids)` commits deletion, DOM node removed with `0.3s` exit transition.
5. **Recent journal consistency check:**
   - Every five seconds while visible, `app.js` reads only operation entries updated within the preceding seven seconds and resolves their affected IDs against the journal snapshots, storage, and rendered cards.
   - It repairs only those journaled records and cards; it does not scan the complete task list or change unrelated selection, expansion, focus, or form drafts.
   - A matching cross-tab `storage` event or tab visibility restoration runs the same bounded journal check sooner. Transient read failures are retried silently; damaged journal data is never cleared automatically.
