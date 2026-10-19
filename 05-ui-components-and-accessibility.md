# 05 — UI Components & Accessibility Specification

## 1. Structural HTML5 Blueprint

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Achievra — To-Do List</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=Manrope:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="app-shell">

  <!-- ========== Mobile Navbar (Visible <= 768px) ========== -->
  <header class="navbar" role="banner">
    <div class="navbar__brand">
      <div class="navbar__logo" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    </div>
    <button
      class="navbar__toggler icon-button"
      type="button"
      aria-label="Open navigation menu"
      aria-expanded="false"
      aria-controls="sidebar-navigation">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </header>

  <!-- ========== Sidebar Navigation (Persistent on Desktop, Modal Drawer on Mobile) ========== -->
  <aside
    class="sidebar"
    id="sidebar-navigation"
    aria-label="Task views navigation">
    
    <div class="sidebar__brand">
      <div class="sidebar__logo" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <span class="brand__name" id="sidebarDialogTitle">Achievra</span>
    </div>

    <nav class="sidebar__nav">
      <p class="nav-label">TASKS</p>
      <button class="sidebar__tab sidebar__tab--active" type="button" aria-current="page">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
        <span>All Tasks</span>
        <b class="sidebar__badge" id="totalTasksBadge">0</b>
      </button>

      <!-- Categories are future scope; do not render placeholder controls in the MVP. -->
    </nav>

    <div class="sidebar__note">
      <span class="sidebar__note-label">PRO TIP</span>
      <p class="sidebar__note-text">Select multiple tasks using checkboxes to complete or delete them simultaneously.</p>
    </div>
  </aside>

  <!-- Dark Backdrop Overlay for Mobile Drawer -->
  <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>

  <!-- ========== Main Content Landmark ========== -->
  <main class="main-content" id="mainContent">
    
    <!-- Page Header -->
    <header class="main-header">
      <div class="main-header__titles">
        <p class="eyebrow">OVERVIEW</p>
        <h1 class="main-header__title">All Tasks</h1>
        <p class="main-header__subtitle" id="pendingSummaryText">Manage and track your active tasks</p>
      </div>
      <button class="primary-button main-header__add-btn" id="openAddModalBtn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>+ Add Task</span>
      </button>
    </header>

    <!-- Task Creation Form Card (Hidden by default, toggles on + Add Task) -->
    <section class="task-form-card" id="taskFormCard" hidden aria-labelledby="formTitle">
      <div class="form-top">
        <h2 id="formTitle">Create New Task</h2>
        <button class="close-button" id="closeFormBtn" type="button" aria-label="Close task form">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          <span>Close</span>
        </button>
      </div>

      <form id="taskForm" novalidate>
        <input type="hidden" id="editTaskId" value="">

        <!-- Title Field -->
        <div class="form-group">
          <div class="form-group__header">
            <label for="taskTitleInput">Task Title <span aria-hidden="true">*</span></label>
            <span class="char-counter" id="titleCounter" aria-live="polite" aria-atomic="true">0 / 32</span>
          </div>
          <input
            type="text"
            id="taskTitleInput"
            name="title"
            required
            placeholder="e.g., Finalize project report"
            aria-describedby="titleError">
          <p class="field-error" id="titleError" role="alert" hidden></p>
        </div>

        <!-- Description Field -->
        <div class="form-group">
          <div class="form-group__header">
            <label for="taskDescInput">Description <span class="label-optional">(optional)</span></label>
            <span class="char-counter" id="descCounter" aria-live="polite" aria-atomic="true">0 / 256</span>
          </div>
          <textarea
            id="taskDescInput"
            name="description"
            rows="3"
            placeholder="Provide context, links, or notes..."
            aria-describedby="descError"></textarea>
          <p class="field-error" id="descError" role="alert" hidden></p>
        </div>

        <!-- Due Date Field -->
        <div class="form-group">
          <label for="taskDateInput">Due Date <span class="label-optional">(optional)</span></label>
          <input
            type="date"
            id="taskDateInput"
            name="date"
            aria-describedby="dateError">
          <p class="field-error" id="dateError" role="alert" hidden></p>
          <!-- The form must support adding multiple distinct dates to one task and removing an individual date. -->
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button class="primary-button" type="submit" id="saveTaskBtn">Save Task</button>
          <button class="secondary-button" type="button" id="cancelFormBtn">Cancel</button>
        </div>
      </form>
    </section>

    <!-- Live notification and per-task Undo stack container -->
    <div class="undo-stack" id="undoStack" aria-live="polite" aria-atomic="true"></div>

    <!-- ========== Pending Section ========== -->
    <section class="task-section task-section--pending" aria-labelledby="pendingHeading">
      <div class="section-title">
        <h2 id="pendingHeading">To Do</h2>
        <span class="section-badge" id="pendingCountBadge">0</span>
      </div>
      <ul class="task-list" id="pendingList" aria-live="polite">
        <!-- Empty state rendered dynamically -->
      </ul>
    </section>

    <!-- ========== Completed Section ========== -->
    <section class="task-section completed-section" aria-labelledby="completedHeading">
      <div class="section-title">
        <h2 id="completedHeading">Completed</h2>
        <span class="section-badge" id="completedCountBadge">0</span>
      </div>
      <!-- Internal scrollbar applies when items > 4 -->
      <div class="completed-scroll-container">
        <ul class="task-list task-list--scrollable" id="completedList" aria-live="polite">
          <!-- Rendered dynamically -->
        </ul>
      </div>
    </section>

  </main>

  <!-- ========== Floating Bulk Action Bar ========== -->
  <aside class="bulk-bar" id="bulkBar" hidden aria-label="Bulk actions">
    <span class="bulk-bar__count" id="bulkCount">0 tasks selected</span>
    <div class="bulk-bar__actions">
      <button class="bulk-bar__btn" id="bulkCompleteBtn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Mark Complete</span>
      </button>
      <button class="bulk-bar__btn bulk-bar__btn--delete" id="bulkDeleteBtn" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Delete</span>
      </button>
    </div>
  </aside>

</div>

</body>
</html>
```

---

## 2. Component Specifications

### 2.1 Mobile Drawer Accessibility Pattern
- **ARIA attributes on mobile**:
- The brand name is **Achievra**. On tablet/mobile, the closed top navbar shows only the logo on the left; it does not show the brand name. When the drawer opens, hide the outside logo and show the logo inside the drawer beside the visible **Achievra** name.
- While the mobile drawer is open, expose it with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="sidebarDialogTitle"`; this ID refers to the visible “Achievra” name inside the drawer. Remove dialog/modal attributes when closed. Do not point `aria-labelledby` to the drawer container itself merely because it has an ID.
  - Toggler button: `aria-expanded="true/false"`, `aria-controls="sidebar-navigation"`.
- **Keyboard Focus Management**:
  1. Opening drawer traps keyboard focus within the drawer elements.
  2. Pressing `Escape` or clicking the dark backdrop closes the drawer.
  3. Closing returns active focus to `.navbar__toggler`.
  4. Background elements receive `aria-hidden="true"` or `inert` attribute while drawer is open.

---

### 2.2 Task Card Markup (`.task-item`)

#### A. Pending Task Node
- Pending cards use automatic height based on their content, with compact vertical padding; do not force a uniform height.
- Task descriptions render at `13px` (`0.8125rem`) with natural wrapping. Date and metadata text remains `11px` (`0.6875rem`).
```html
<li class="task-item" data-id="uuid-123" id="task-uuid-123">
  <!-- Native Selection Checkbox -->
  <input
    type="checkbox"
    class="task-item__checkbox"
    aria-label="Select task: Buy groceries"
    data-action="select">

  <!-- Clickable Content Box -->
  <div class="task-item__content">
    <h3 class="task-item__title">Buy groceries</h3>
    <div class="task-item__meta">
      <span class="mini-date">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>2026-10-25</span>
      </span>
      <span class="task-item__desc-preview">Milk, sourdough bread, eggs...</span>
    </div>
  </div>

  <!-- Row Action Buttons (SVG Icons + Text labels beneath/screen-reader) -->
  <div class="task-item__actions">
    <button class="action-btn" type="button" data-action="edit" aria-label="Edit task">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span class="action-btn__label">Edit</span>
    </button>
    <button class="action-btn action-btn--delete" type="button" data-action="delete" aria-label="Delete task">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      <span class="action-btn__label">Delete</span>
    </button>
  </div>
</li>
```

#### B. Completed Task Card & Two-Tier Expansion
- **Collapsed State**:
  - Uniform fixed row height (`5.0625rem` / 81px).
  - Title displayed with line-through (`text-decoration: line-through; color: var(--clr-text-completed);`).
  - Description clamped to 1 line (`text-overflow: ellipsis; white-space: nowrap;`).
- **Expanded State (Activated by clicking the card body, not checkbox)**:
  - Toggles `.task-item--expanded`.
  - Content container displays the full description (up to 256 grapheme clusters) with natural line wrapping.
  - **Two Height Modes**:
    1. If the description fits the smaller expanded mode, expand to two-thirds of the maximum height.
    2. If it needs more room, expand to the maximum height, sufficient to show the entire description.
    3. If the description is empty, display `"No description"` and use the appropriately smaller height.
  - TodoView measures the expanded card content: content that fits within `16rem` uses the compact mode; longer content uses the maximum mode of `24rem`. Empty descriptions use the compact mode.
- **Copy Action Button**:
  - Rendered inside `.task-item__actions` on Completed cards:
    ```html
    <button class="action-btn" type="button" data-action="copy" aria-label="Copy task with a new due date">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span class="action-btn__label">Copy</span>
    </button>
    ```

---

### 2.3 Completed Section Scrolling Rule
- Pending tasks grow downward into the main page flow without an inner scrollbar.
- The `.completed-scroll-container` has a CSS constraint:
  ```css
  .completed-scroll-container {
    /* Accommodates up to 4 collapsed task items + gaps */
    max-height: 22.5rem; 
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 0.25rem;
  }
  ```
- If 4 or fewer items: Container wraps naturally without scrollbar.
- If 5+ items: Native scrollbar appears inside the Completed section only.

---

### 2.3 In-App Notifications and Choices
All user-facing notifications are rendered inside the application; do not use browser `alert`, `confirm`, or `prompt` dialogs. Ordinary status notifications (success, information, and errors) remain visible for five seconds and show a blue progress bar that fills over those five seconds. They then dismiss automatically.

Notifications that require a decision include the message and explicit action buttons in the same notification. They have no timeout or progress countdown and remain visible until the user activates one of the choice buttons. A choice notification must not disappear merely because five seconds elapsed. Declining or accepting performs the behavior specified by the corresponding business workflow.

Use a polite live region for ordinary status updates and an assertive announcement only when the message represents an urgent error. Choice notifications must expose their message and buttons to keyboard and assistive-technology users; keep focus usable and do not move it unexpectedly. Each button needs a clear visible label and an accessible name. The five-second task deletion Undo controls are separate from notification dismissal and retain their own independent timers.

### 2.4 Per-Task Undo and Undo All
Each task marked for deletion receives an adjacent Undo control. Its icon, if present, is an SVG accompanied by a visible descriptive text label. If more than one deletion is active, a bottom Undo All control restores all tasks whose individual five-second timers have not expired. Each task retains its independent timer and Undo action.

Example task-level control:
```html
<button class="undo-button" type="button" data-action="undo-delete" aria-label="Undo deletion of Buy groceries">
  <svg aria-hidden="true" viewBox="0 0 24 24"><!-- undo icon --></svg>
  <span>Undo</span>
</button>
```

Announce deletion state and remaining time through a polite live region. Do not use emoji as interface icons. Build user-derived text with DOM APIs/textContent; no raw user input may be passed to `innerHTML`.

### 2.5 Multiple due dates on one task card
- Render one card for one task, even when it has several dates.
- Show each date on the card. If a date is in the past, label that date “Past”; if any date is past while Pending, apply the yellow overdue treatment to the card.
- For Pending tasks, provide a date-specific removal control so one date can be removed without deleting the other dates or the task. Completed tasks remain immutable and expose no date-removal control.
- When copying a Completed task, prefill title and description and set the editable date field to today.
- The entry/edit form must render the task's date collection and allow adding a date and removing an individual date. The single `input type="date"` above is an input control for one date at a time, not a restriction to one date per task.
- Enforce title and description limits using the agreed grapheme counter/validator; do not rely on HTML `maxlength`, which counts differently for some Unicode sequences.

### 2.6 Selection and actions
- Use the native checkbox in its normal semantic position; do not disguise task selection as a custom checkbox role.
- Do not allow mixed Pending/Completed selection. A single Pending selection exposes Delete, Edit, and Mark Complete; multiple Pending selections expose Delete and Mark Complete. A single Completed selection exposes Delete and Copy; multiple Completed selections expose Delete only.
- A task card update changes only that card's DOM node. Creating or deleting a task changes only the affected node(s); do not rebuild the entire task list for a single-item operation.
- Completed-card expansion must be keyboard operable and expose its state with a native button or equivalent accessible control (`aria-expanded` and a relationship to the description region); pressing Enter or Space performs the same action as clicking.
