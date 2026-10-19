/**
 * Achievra — Stage 5 DOM view (`js/views/TodoView.js`).
 *
 * Owns page rendering, form presentation, selection state, accessible drawer
 * behavior, and undo controls. It never persists data or decides domain rules.
 * All dynamic user-derived text is written with `textContent` or text-safe DOM
 * attributes; no user value is parsed as HTML.
 */

import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '../constants.js';
import { countCharacters } from '../utils/textUtils.js';
import { findPastDueDates } from '../utils/dateUtils.js';
import {
  compareCompletedTasks,
  comparePendingTasks,
} from '../utils/sortUtils.js';

const REQUIRED_DOM_IDS = Object.freeze([
  'sidebarToggler',
  'sidebar-navigation',
  'sidebarOverlay',
  'mainContent',
  'totalTasksBadge',
  'pendingSummaryText',
  'openAddModalBtn',
  'notificationRegion',
  'statusRegion',
  'taskFormCard',
  'formTitle',
  'closeFormBtn',
  'taskForm',
  'editTaskId',
  'formError',
  'taskTitleInput',
  'titleCounter',
  'titleError',
  'taskDescInput',
  'descCounter',
  'descError',
  'taskDateInput',
  'addDateBtn',
  'dateError',
  'selectedDatesList',
  'selectedDatesEmpty',
  'saveTaskBtn',
  'cancelFormBtn',
  'pendingCountBadge',
  'pendingEmpty',
  'pendingList',
  'undoAllBanner',
  'undoAllText',
  'undoAllBtn',
  'completedCountBadge',
  'completedEmpty',
  'completedScroll',
  'completedList',
  'bulkBar',
  'bulkCount',
  'bulkCompleteBtn',
  'bulkDeleteBtn',
  'pendingTaskTemplate',
  'completedTaskTemplate',
  'dateChipTemplate',
  'undoButtonTemplate',
]);

const FIELD_ERRORS = Object.freeze({
  title: Object.freeze({ inputId: 'taskTitleInput', errorId: 'titleError' }),
  description: Object.freeze({ inputId: 'taskDescInput', errorId: 'descError' }),
  dueDates: Object.freeze({ inputId: 'taskDateInput', errorId: 'dateError' }),
});

const COMPLETED_EXPANDED_MAX_HEIGHT = 24 * 16;
const COMPLETED_EXPANDED_COMPACT_HEIGHT = (COMPLETED_EXPANDED_MAX_HEIGHT * 2) / 3;

function localTodayDate() {
  const today = new Date();
  const year = String(today.getFullYear()).padStart(4, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setText(element, value) {
  element.textContent = value == null ? '' : String(value);
}

function cloneTemplate(template) {
  const fragment = template.content.cloneNode(true);
  const element = fragment.firstElementChild;
  if (!element) throw new Error(`Template #${template.id} has no root element.`);
  return element;
}

function dateLabel(date) {
  return date;
}

export class TodoView {
  constructor({ document: documentObject = globalThis.document } = {}) {
    if (!documentObject || typeof documentObject.getElementById !== 'function') {
      throw new TypeError('TodoView requires a browser Document.');
    }
    this.document = documentObject;
    this.elements = {};
    this.todosById = new Map();
    this.elementsById = new Map();
    this.selectedDates = [];
    this.activeDrawerKeydownHandler = null;
    this.backgroundInertState = new Map();
    this.drawerReturnFocus = null;
    this.previousBodyOverflow = null;
    this.alertElement = null;
    this.alertTimeoutId = null;
    this.choiceNotificationElement = null;
    this.choiceNotificationQueue = [];
    this.nextDescriptionRegionId = 1;
    this.counterListenersBound = false;
    this.bindDOMElements();
  }

  /** Cache and validate all stable HTML IDs used by this view. */
  bindDOMElements() {
    const missingIds = [];
    for (const id of REQUIRED_DOM_IDS) {
      const element = this.document.getElementById(id);
      if (!element) missingIds.push(id);
      else this.elements[id] = element;
    }
    if (missingIds.length > 0) {
      throw new Error(`TodoView is missing required DOM element IDs: ${missingIds.join(', ')}.`);
    }

    this.elements.navbar = this.document.querySelector('.navbar');
    this.elements.statusRegion.tabIndex = -1;
    this.elements.taskFormCard.hidden = true;
    this.elements.undoAllBanner.hidden = true;
    this.elements.bulkBar.hidden = true;
    if (!this.counterListenersBound) {
      this.elements.taskTitleInput.addEventListener('input', () => this.#updateCharacterCounters());
      this.elements.taskDescInput.addEventListener('input', () => this.#updateCharacterCounters());
      this.counterListenersBound = true;
    }
    this.#updateCharacterCounters();
    return this.elements;
  }

  /** Render initial repository results. A full render is limited to this entry point. */
  renderInitialLists(pendingTodos, completedTodos) {
    if (!Array.isArray(pendingTodos) || !Array.isArray(completedTodos)) {
      throw new TypeError('renderInitialLists expects pending and completed Todo arrays.');
    }
    this.elements.pendingList.replaceChildren();
    this.elements.completedList.replaceChildren();
    this.todosById.clear();
    this.elementsById.clear();
    this.selectedDates = [];
    for (const todo of pendingTodos) {
      this.#insertTodo(todo, this.elements.pendingList, 'sorted');
    }
    for (const todo of completedTodos) {
      this.#insertTodo(todo, this.elements.completedList, 'sorted');
    }
    this.updateBadgeCounts(pendingTodos.length, completedTodos.length);
    this.#syncSelectionActions();
  }

  /** Return task IDs in the task-card nodes currently attached to both lists. */
  getRenderedTodoIds() {
    return [
      ...this.elements.pendingList.children,
      ...this.elements.completedList.children,
    ].map((element) => element.dataset.id)
      .filter(Boolean);
  }

  /** Return whether a task card is attached to its expected section. */
  isTodoElementInSection(id, isCompleted) {
    const expectedList = isCompleted ? this.elements.completedList : this.elements.pendingList;
    return this.elementsById.get(id)?.parentElement === expectedList;
  }

  /** Compare persisted display fields with the task card's current DOM content. */
  isTodoElementConsistent(todo) {
    const element = this.elementsById.get(todo.id);
    if (!element) return false;
    const title = element.querySelector('.task-item__title')?.textContent;
    const description = element.querySelector('.task-item__description')?.textContent;
    const renderedDates = [...element.querySelectorAll('.task-item__date time')]
      .map((time) => time.getAttribute('datetime'));
    return title === todo.title &&
      description === (todo.description || 'No description') &&
      element.classList.contains('task-item--completed') === todo.completed &&
      renderedDates.length === todo.dueDates.length &&
      renderedDates.every((date, index) => date === todo.dueDates[index]);
  }

  /** Remove duplicate DOM cards while keeping the view's indexed card intact. */
  removeDuplicateTodoElements(id) {
    const indexedElement = this.elementsById.get(id);
    let keptIndexedElement = false;
    for (const list of [this.elements.pendingList, this.elements.completedList]) {
      for (const element of [...list.children]) {
        if (element.dataset.id !== id) continue;
        if (element === indexedElement && !keptIndexedElement) {
          keptIndexedElement = true;
        } else {
          element.remove();
        }
      }
    }
    this.#updateBadgeCountsFromDOM();
  }

  /** Update section and sidebar totals without rebuilding either list. */
  updateBadgeCounts(pendingCount, completedCount) {
    const safePendingCount = Math.max(0, Number(pendingCount) || 0);
    const safeCompletedCount = Math.max(0, Number(completedCount) || 0);
    setText(this.elements.pendingCountBadge, safePendingCount);
    setText(this.elements.completedCountBadge, safeCompletedCount);
    setText(this.elements.totalTasksBadge, safePendingCount + safeCompletedCount);
    setText(
      this.elements.pendingSummaryText,
      `${safePendingCount} pending ${safePendingCount === 1 ? 'task' : 'tasks'}`
    );
    this.elements.pendingEmpty.hidden = safePendingCount !== 0;
    this.elements.completedEmpty.hidden = safeCompletedCount !== 0;
    this.elements.pendingList.hidden = safePendingCount === 0;
    this.elements.completedScroll.hidden = safeCompletedCount === 0;
  }

  /** Insert one saved Todo in its current sorted position. */
  addTodoElement(todo, position = 'sorted') {
    const list = todo.completed ? this.elements.completedList : this.elements.pendingList;
    const oldElement = this.elementsById.get(todo.id);
    if (oldElement) oldElement.remove();
    this.#insertTodo(todo, list, position);
    if (!oldElement) this.#animateTodoEntry(this.elementsById.get(todo.id));
    this.#updateBadgeCountsFromDOM();
    this.#syncSelectionActions();
    return this.elementsById.get(todo.id);
  }

  /** Replace only the changed Todo card; other task nodes remain untouched. */
  updateTodoElement(todo) {
    const previousElement = this.elementsById.get(todo.id);
    if (!previousElement) return this.addTodoElement(todo);
    const previousTodo = this.todosById.get(todo.id);
    const wasSelected = previousElement.querySelector('[data-action="select"]')?.checked === true &&
      previousTodo?.completed === todo.completed;
    const wasExpanded = previousElement.classList.contains('task-item--expanded');
    const wasPendingDeletion = previousElement.classList.contains('task-item--pending-deletion');
    const activeElement = this.document.activeElement;
    const focusedAction = activeElement && previousElement.contains(activeElement)
      ? activeElement.dataset.action
      : null;
    const nextList = todo.completed ? this.elements.completedList : this.elements.pendingList;
    const nextElement = this.#createTodoElement(todo);
    const nextCheckbox = nextElement.querySelector('[data-action="select"]');
    if (nextCheckbox && wasSelected) {
      nextCheckbox.checked = true;
      nextElement.classList.add('task-item--selected');
    }
    previousElement.replaceWith(nextElement);
    this.elementsById.set(todo.id, nextElement);
    this.todosById.set(todo.id, todo);
    if (previousElement.parentElement !== nextList) {
      previousElement.remove();
      this.#insertExistingTodoElement(nextElement, todo, nextList, 'sorted');
    } else if (nextList === this.elements.pendingList) {
      this.#insertExistingTodoElement(nextElement, todo, nextList, 'sorted');
    } else {
      this.#insertExistingTodoElement(nextElement, todo, nextList, 'sorted');
    }
    if (wasPendingDeletion) this.setTaskPendingDeletion(todo.id, true);
    if (todo.completed && wasExpanded) this.toggleTaskCardExpansion(todo.id);
    if (focusedAction) nextElement.querySelector(`[data-action="${focusedAction}"]`)?.focus();
    this.#updateBadgeCountsFromDOM();
    this.#syncSelectionActions();
    return nextElement;
  }

  /** Move one already-updated card to its Pending or Completed section. */
  moveTodoElement(id, targetSection, updatedTodo = null) {
    if (targetSection !== 'pending' && targetSection !== 'completed') {
      throw new TypeError('targetSection must be "pending" or "completed".');
    }
    const todo = updatedTodo ?? this.todosById.get(id);
    if (!todo) return null;
    if (todo.id !== id || todo.completed !== (targetSection === 'completed')) {
      throw new TypeError('moveTodoElement requires the saved Todo for the requested section.');
    }
    return this.updateTodoElement(todo);
  }

  /** Remove one persisted task node after a successful delete. */
  removeTodoElement(id) {
    const activeElement = this.document.activeElement;
    const focusedCard = [...this.elements.pendingList.children, ...this.elements.completedList.children]
      .find((element) => element.classList.contains('task-item') &&
        element.dataset.id === id && activeElement && element.contains(activeElement));
    if (focusedCard) {
      const parent = focusedCard.parentElement;
      const neighboringCheckbox = [...(parent?.children ?? [])]
        .filter((candidate) => candidate.classList.contains('task-item') && candidate.dataset.id !== id)
        .map((candidate) => candidate.querySelector('[data-action="select"]'))
        .find(Boolean) ??
        [...this.elements.pendingList.children, ...this.elements.completedList.children]
          .filter((candidate) => candidate.classList.contains('task-item') && candidate.dataset.id !== id)
          .map((candidate) => candidate.querySelector('[data-action="select"]'))
          .find(Boolean);
      if (neighboringCheckbox) neighboringCheckbox.focus();
      else this.elements.statusRegion.focus();
    }
    for (const list of [this.elements.pendingList, this.elements.completedList]) {
      for (const element of [...list.children]) {
        if (element.dataset.id === id) {
          element.remove();
        }
      }
    }
    this.elementsById.delete(id);
    this.todosById.delete(id);
    this.#updateBadgeCountsFromDOM();
    this.#syncSelectionActions();
  }

  /** Fade one persisted task card before removing its DOM node. */
  animateTodoRemoval(id) {
    const element = this.elementsById.get(id);
    if (!element) return Promise.resolve(false);

    const activeElement = this.document.activeElement;
    if (activeElement && element.contains(activeElement)) {
      const parent = element.parentElement;
      const neighboringCheckbox = [...(parent?.children ?? [])]
        .filter((candidate) => candidate !== element)
        .map((candidate) => candidate.querySelector('[data-action="select"]'))
        .find(Boolean);
      neighboringCheckbox?.focus();
    }

    element.classList.add('task-item--exiting');
    const windowObject = this.document.defaultView;
    const reducedMotion = windowObject?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 0 : 300;
    return new Promise((resolve) => {
      const remove = () => {
        this.removeTodoElement(id);
        resolve(true);
      };
      if (duration === 0) remove();
      else (windowObject?.setTimeout ?? globalThis.setTimeout)(remove, duration);
    });
  }

  #animateTodoEntry(element) {
    if (!element) return;
    const windowObject = this.document.defaultView;
    const reducedMotion = windowObject?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    element.classList.add('task-item--entering');
    const clearEnteringState = () => element.classList.remove('task-item--entering');
    if (typeof windowObject?.requestAnimationFrame === 'function') {
      windowObject.requestAnimationFrame(() => windowObject.requestAnimationFrame(clearEnteringState));
    } else {
      windowObject?.setTimeout(clearEnteringState, 0);
    }
  }

  /** Temporarily draw attention to an existing task after a duplicate result. */
  highlightTodoElement(id) {
    const element = this.elementsById.get(id);
    if (!element) return false;
    element.classList.add('task-item--duplicate-match');
    element.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    return true;
  }

  /** Clear the duplicate-result highlight without changing task selection. */
  clearTodoHighlight(id) {
    this.elementsById.get(id)?.classList.remove('task-item--duplicate-match');
  }

  /** Set checkbox selection while preventing mixed Pending/Completed groups. */
  setTaskSelected(id, isSelected) {
    const element = this.elementsById.get(id);
    if (!element) return false;
    const checkbox = element.querySelector('[data-action="select"]');
    if (!checkbox) return false;

    if (isSelected) {
      const selectedGroup = this.#getSelectedTodos().find((selectedTodo) => selectedTodo.id !== id)?.completed;
      const todo = this.todosById.get(id);
      if (selectedGroup !== undefined && selectedGroup !== todo.completed) {
        for (const selectedTodo of this.#getSelectedTodos()) {
          if (selectedTodo.completed !== todo.completed) {
            const selectedElement = this.elementsById.get(selectedTodo.id);
            const selectedCheckbox = selectedElement?.querySelector('[data-action="select"]');
            if (selectedCheckbox) selectedCheckbox.checked = false;
            selectedElement?.classList.remove('task-item--selected');
          }
        }
        setText(
          this.elements.statusRegion,
          'Selection changed. Pending and Completed tasks cannot be selected together.'
        );
      }
    }

    checkbox.checked = Boolean(isSelected);
    element.classList.toggle('task-item--selected', checkbox.checked);
    this.#syncSelectionActions();
    return true;
  }

  /** Mark or restore a card during its independent five-second delete window. */
  setTaskPendingDeletion(id, isPending) {
    const element = this.elementsById.get(id);
    if (!element) return false;
    const isPendingDeletion = Boolean(isPending);
    element.classList.toggle('task-item--pending-deletion', isPendingDeletion);
    const checkbox = element.querySelector('[data-action="select"]');
    if (checkbox) checkbox.disabled = isPendingDeletion;
    for (const control of element.querySelectorAll('button')) {
      if (control.dataset.action !== 'undo-delete') control.disabled = isPendingDeletion;
    }
    element.setAttribute('aria-label', isPendingDeletion
      ? `${this.todosById.get(id)?.title ?? 'Task'} is pending deletion. Undo is available.`
      : `${this.todosById.get(id)?.title ?? 'Task'}`);
    this.#syncSelectionActions();
    return true;
  }

  /** Expand or collapse a Completed card and size it to its chosen content mode. */
  toggleTaskCardExpansion(id) {
    const element = this.elementsById.get(id);
    const todo = this.todosById.get(id);
    if (!element || !todo?.completed || element.classList.contains('task-item--pending-deletion')) return false;
    const toggle = element.querySelector('[data-action="expand"]');
    const description = element.querySelector('.task-item__description');
    if (!toggle || !description) return false;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      toggle.setAttribute('aria-expanded', 'false');
      element.classList.remove('task-item--expanded');
      element.style.height = '';
      setText(toggle.querySelector('span'), 'Details');
      return false;
    }

    toggle.setAttribute('aria-expanded', 'true');
    element.classList.add('task-item--expanded');
    setText(toggle.querySelector('span'), 'Hide details');
    element.style.height = 'auto';
    const naturalHeight = element.scrollHeight;
    const compactHeight = COMPLETED_EXPANDED_COMPACT_HEIGHT;
    const maxHeight = COMPLETED_EXPANDED_MAX_HEIGHT;
    const useCompactHeight = todo.description.length === 0 || naturalHeight <= compactHeight;
    element.style.height = `${useCompactHeight ? compactHeight : Math.min(naturalHeight, maxHeight)}px`;
    return true;
  }

  /** Open create, edit, or copy form with detached values. */
  openTaskForm(prefillData = null) {
    this.clearFormErrors();
    this.elements.taskForm.reset();
    this.elements.editTaskId.value = '';
    this.selectedDates = [];
    const isEditing = Boolean(prefillData?.id && prefillData.completed !== true);
    const isCopying = Boolean(prefillData?.completed === true);

    if (prefillData) {
      this.elements.taskTitleInput.value = prefillData.title ?? '';
      this.elements.taskDescInput.value = prefillData.description ?? '';
      if (isEditing) this.elements.editTaskId.value = prefillData.id;
      if (Array.isArray(prefillData.dueDates) && !isCopying) {
        this.selectedDates = [...prefillData.dueDates];
      }
      if (isCopying) this.selectedDates = [localTodayDate()];
    }

    setText(
      this.elements.formTitle,
      isEditing ? 'Edit Task' : isCopying ? 'Copy Task' : 'Create New Task'
    );
    setText(this.elements.saveTaskBtn, isEditing ? 'Save Changes' : 'Save Task');
    this.elements.taskDateInput.value = '';
    this.#renderSelectedDateChips();
    this.#updateCharacterCounters();
    this.elements.taskFormCard.hidden = false;
    this.elements.taskTitleInput.focus();
    this.elements.taskFormCard.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  /** Prefill recovered user content without reusing an interrupted task ID. */
  openRecoveryForm(todoSnapshot = {}) {
    this.openTaskForm();
    this.elements.taskTitleInput.value = todoSnapshot.title ?? '';
    this.elements.taskDescInput.value = todoSnapshot.description ?? '';
    this.selectedDates = Array.isArray(todoSnapshot.dueDates) ? [...todoSnapshot.dueDates] : [];
    this.#renderSelectedDateChips();
    setText(this.elements.formTitle, 'Review Recovered Task');
    setText(this.elements.saveTaskBtn, 'Save Task');
    this.#updateCharacterCounters();
    this.elements.taskTitleInput.focus();
  }

  /** Hide the form and clear it after an explicit close/cancel action. */
  closeTaskForm() {
    this.elements.taskFormCard.hidden = true;
    this.elements.taskForm.reset();
    this.elements.editTaskId.value = '';
    this.elements.taskDateInput.value = '';
    this.selectedDates = [];
    this.#renderSelectedDateChips();
    this.clearFormErrors();
    this.#updateCharacterCounters();
    setText(this.elements.formTitle, 'Create New Task');
    setText(this.elements.saveTaskBtn, 'Save Task');
  }

  /** Return normalized-shape form values without treating the edit ID as input. */
  getTaskFormData() {
    const dueDates = [...this.selectedDates];
    const dateInput = this.elements.taskDateInput.value;
    if (dateInput && !dueDates.includes(dateInput)) dueDates.push(dateInput);
    return {
      title: this.elements.taskTitleInput.value,
      description: this.elements.taskDescInput.value,
      dueDates,
    };
  }

  /** Return the ID of the pending Todo currently being edited, or null. */
  getEditingTodoId() {
    return this.elements.editTaskId.value || null;
  }

  /** Add one date to the form collection; duplicate values are rejected visibly. */
  addDateToForm(date = this.elements.taskDateInput.value) {
    if (!date) return false;
    if (this.selectedDates.includes(date)) {
      this.setFormErrors({ dueDates: 'This due date is already in the list.' });
      return false;
    }
    this.selectedDates.push(date);
    this.elements.taskDateInput.value = '';
    this.clearFormErrors();
    this.#renderSelectedDateChips();
    return true;
  }

  /** Remove one date from the form collection. */
  removeSelectedDate(date) {
    const nextDates = this.selectedDates.filter((value) => value !== date);
    if (nextDates.length === this.selectedDates.length) return false;
    this.selectedDates = nextDates;
    this.#renderSelectedDateChips();
    return true;
  }

  /** Show accessible validation errors without clearing entered values. */
  setFormErrors(errors = {}) {
    this.clearFormErrors();
    if (!errors || typeof errors !== 'object') return;
    for (const [field, message] of Object.entries(errors)) {
      const fieldElements = FIELD_ERRORS[field];
      if (!fieldElements) {
        if (message) {
          setText(this.elements.formError, message);
          this.elements.formError.hidden = false;
        }
        continue;
      }
      const input = this.document.getElementById(fieldElements.inputId);
      const errorElement = this.document.getElementById(fieldElements.errorId);
      if (!input || !errorElement || !message) continue;
      setText(errorElement, message);
      errorElement.hidden = false;
      input.classList.add('task-form__input--error');
      input.setAttribute('aria-invalid', 'true');
      const describedBy = new Set((input.getAttribute('aria-describedby') ?? '').split(/\s+/u).filter(Boolean));
      describedBy.add(fieldElements.errorId);
      input.setAttribute('aria-describedby', [...describedBy].join(' '));
    }
  }

  /** Clear displayed errors and ARIA error state, preserving form values. */
  clearFormErrors() {
    for (const fieldElements of Object.values(FIELD_ERRORS)) {
      const input = this.document.getElementById(fieldElements.inputId);
      const errorElement = this.document.getElementById(fieldElements.errorId);
      if (input) {
        input.classList.remove('task-form__input--error');
        input.removeAttribute('aria-invalid');
        const remainingIds = (input.getAttribute('aria-describedby') ?? '')
          .split(/\s+/u)
          .filter((id) => id && id !== fieldElements.errorId);
        input.setAttribute('aria-describedby', remainingIds.join(' '));
      }
      if (errorElement) {
        errorElement.hidden = true;
        setText(errorElement, '');
      }
    }
    this.elements.formError.hidden = true;
    setText(this.elements.formError, '');
  }

  /** Open the mobile sidebar as a modal drawer with focus containment. */
  openMobileDrawer() {
    const sidebar = this.elements['sidebar-navigation'];
    const toggler = this.elements.sidebarToggler;
    const overlay = this.elements.sidebarOverlay;
    if (sidebar.classList.contains('sidebar--open')) return;

    this.drawerReturnFocus = this.document.activeElement === toggler
      ? toggler
      : toggler;
    sidebar.classList.add('sidebar--open');
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    sidebar.setAttribute('aria-labelledby', 'sidebarDialogTitle');
    sidebar.setAttribute('tabindex', '-1');
    toggler.setAttribute('aria-expanded', 'true');
    overlay.classList.add('sidebar-overlay--visible');
    overlay.setAttribute('aria-hidden', 'false');
    this.#setDrawerBackgroundInert(true);
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';

    this.activeDrawerKeydownHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeMobileDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = this.#getDrawerFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        sidebar.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (this.document.activeElement === first || !sidebar.contains(this.document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (this.document.activeElement === last || !sidebar.contains(this.document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    sidebar.addEventListener('keydown', this.activeDrawerKeydownHandler);
    overlay.addEventListener('click', this.#handleOverlayClick);
    (this.#getDrawerFocusableElements()[0] ?? sidebar).focus();
  }

  /** Close the mobile drawer and restore the opener's focus. */
  closeMobileDrawer() {
    const sidebar = this.elements['sidebar-navigation'];
    const overlay = this.elements.sidebarOverlay;
    const toggler = this.elements.sidebarToggler;
    if (!sidebar.classList.contains('sidebar--open')) return;
    sidebar.classList.remove('sidebar--open');
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
    sidebar.removeAttribute('aria-labelledby');
    sidebar.removeAttribute('tabindex');
    toggler.setAttribute('aria-expanded', 'false');
    overlay.classList.remove('sidebar-overlay--visible');
    overlay.setAttribute('aria-hidden', 'true');
    this.#setDrawerBackgroundInert(false);
    this.document.body.style.overflow = this.previousBodyOverflow ?? '';
    this.previousBodyOverflow = null;
    if (this.activeDrawerKeydownHandler) {
      sidebar.removeEventListener('keydown', this.activeDrawerKeydownHandler);
      this.activeDrawerKeydownHandler = null;
    }
    overlay.removeEventListener('click', this.#handleOverlayClick);
    (this.drawerReturnFocus ?? toggler).focus();
    this.drawerReturnFocus = null;
  }

  /** Add or refresh the adjacent Undo action for one task. */
  renderTaskUndoControl(id, secondsRemaining, onUndoClick) {
    const card = this.elementsById.get(id);
    const todo = this.todosById.get(id);
    if (!card || !todo) return null;
    let button = card.querySelector('[data-action="undo-delete"]');
    const isNewButton = !button;
    if (!button) {
      button = cloneTemplate(this.elements.undoButtonTemplate);
      card.querySelector('.task-item__actions')?.append(button);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        onUndoClick?.(id);
      });
    }
    button.setAttribute('aria-label', `Undo deletion of ${todo.title}`);
    setText(button.querySelector('span'), `Undo (${Math.max(0, Number(secondsRemaining) || 0)}s)`);
    if (isNewButton) {
      setText(this.elements.statusRegion, `${todo.title} is pending deletion. Use Undo to restore it.`);
    }
    return button;
  }

  /** Show Undo All only while multiple deletion timers are still active. */
  renderUndoAllControl(activeIds, onUndoAllClick) {
    const activeTodos = [...new Set(activeIds ?? [])]
      .map((id) => this.todosById.get(id))
      .filter(Boolean);
    const shouldShow = activeTodos.length > 1;
    this.elements.undoAllBanner.hidden = !shouldShow;
    if (!shouldShow) return null;
    setText(this.elements.undoAllText, `${activeTodos.length} tasks will be deleted.`);
    this.elements.undoAllBtn.setAttribute('aria-label', `Undo deletion of all ${activeTodos.length} pending tasks`);
    this.elements.undoAllBtn.onclick = (event) => {
      event.preventDefault();
      onUndoAllClick?.(activeTodos.map((todo) => todo.id));
    };
    setText(this.elements.statusRegion, `${activeTodos.length} tasks are pending deletion. Undo All is available.`);
    return this.elements.undoAllBanner;
  }

  /** Remove one card's Undo control after its timer is undone or resolved. */
  removeTaskUndoControl(id) {
    this.elementsById.get(id)?.querySelector('[data-action="undo-delete"]')?.remove();
    this.setTaskPendingDeletion(id, false);
    this.elements.undoAllBtn.onclick = null;
  }

  /** Present a timed in-app status alert with a five-second progress indicator. */
  showStorageAlert(message, type = 'error') {
    const safeType = ['error', 'success', 'info'].includes(type) ? type : 'error';
    if (this.alertTimeoutId !== null) globalThis.clearTimeout(this.alertTimeoutId);
    if (!this.alertElement) {
      const alert = this.document.createElement('div');
      alert.className = 'app-alert';
      alert.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
      const text = this.document.createElement('p');
      text.className = 'app-alert__message';
      const progress = this.document.createElement('div');
      progress.className = 'app-alert__progress';
      progress.setAttribute('aria-hidden', 'true');
      const progressFill = this.document.createElement('span');
      progressFill.className = 'app-alert__progress-fill';
      progress.append(progressFill);
      alert.append(text, progress);
      this.alertElement = alert;
    }
    this.alertElement.className = `app-alert app-alert--${safeType}`;
    this.alertElement.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
    this.alertElement.setAttribute('aria-live', safeType === 'error' ? 'assertive' : 'polite');
    this.alertElement.setAttribute('aria-atomic', 'true');
    setText(this.alertElement.querySelector('.app-alert__message'), message);
    if (!this.alertElement.isConnected) this.elements.notificationRegion.prepend(this.alertElement);
    const progressFill = this.alertElement.querySelector('.app-alert__progress-fill');
    progressFill.style.transition = 'none';
    progressFill.style.transform = 'scaleX(0)';
    // Start the transition after layout so each new alert visibly begins empty.
    void progressFill.offsetWidth;
    progressFill.style.transition = 'transform 5s linear';
    progressFill.style.transform = 'scaleX(1)';
    this.alertTimeoutId = globalThis.setTimeout(() => {
      this.alertElement?.remove();
      this.alertElement = null;
      this.alertTimeoutId = null;
    }, 5000);
    return this.alertElement;
  }

  /** Show a persistent in-app choice notification and resolve after a button is chosen. */
  showChoiceNotification(message, { confirmLabel = 'Continue', cancelLabel = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      this.choiceNotificationQueue.push({ message, confirmLabel, cancelLabel, resolve });
      this.#renderNextChoiceNotification();
    });
  }

  /** Render decisions in order so none disappear before the user chooses. */
  #renderNextChoiceNotification() {
    if (this.choiceNotificationElement || this.choiceNotificationQueue.length === 0) return;
    const { message, confirmLabel, cancelLabel, resolve } = this.choiceNotificationQueue.shift();
    const alert = this.document.createElement('section');
    alert.className = 'app-alert app-alert--choice';
    alert.setAttribute('role', 'group');
    alert.setAttribute('aria-label', 'Decision required');
    alert.setAttribute('aria-live', 'polite');
    alert.setAttribute('aria-atomic', 'true');
    const text = this.document.createElement('p');
    text.className = 'app-alert__message';
    setText(text, message);
    const actions = this.document.createElement('div');
    actions.className = 'app-alert__actions';
    const confirmButton = this.document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'btn btn--primary';
    setText(confirmButton, confirmLabel);
    const cancelButton = this.document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn--secondary';
    setText(cancelButton, cancelLabel);
    actions.append(confirmButton, cancelButton);
    alert.append(text, actions);
    this.elements.notificationRegion.prepend(alert);
    this.choiceNotificationElement = alert;

    const finish = (choice) => {
      alert.remove();
      if (this.choiceNotificationElement === alert) this.choiceNotificationElement = null;
      resolve(choice);
      this.#renderNextChoiceNotification();
    };
    confirmButton.addEventListener('click', () => finish(true), { once: true });
    cancelButton.addEventListener('click', () => finish(false), { once: true });
  }

  /** Show corruption details and require a separate explicit reset-button action. */
  showCorruptionDialog(onResetConfirm) {
    const existingDialog = this.document.querySelector('.storage-dialog');
    existingDialog?.remove();
    const dialog = this.document.createElement('dialog');
    dialog.className = 'storage-dialog';
    dialog.setAttribute('aria-label', 'Saved task data could not be read');
    const heading = this.document.createElement('h2');
    heading.textContent = 'Saved task data could not be read';
    const message = this.document.createElement('p');
    message.textContent = 'Your saved data appears to be damaged. It has not been changed. You can close this message and retry, or explicitly reset the saved data to start fresh.';
    const actions = this.document.createElement('div');
    actions.className = 'storage-dialog__actions';
    const closeButton = this.document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn--secondary';
    closeButton.textContent = 'Close';
    const resetButton = this.document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'btn btn--danger';
    resetButton.textContent = 'Reset & Start Fresh';
    resetButton.disabled = typeof onResetConfirm !== 'function';
    closeButton.addEventListener('click', () => dialog.close());
    resetButton.addEventListener('click', async () => {
      resetButton.disabled = true;
      try {
        await onResetConfirm?.();
        dialog.close();
      } catch (error) {
        resetButton.disabled = false;
        this.showStorageAlert(error?.message || 'The saved data could not be reset.', 'error');
      }
    });
    actions.append(closeButton, resetButton);
    dialog.append(heading, message, actions);
    this.document.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    return dialog;
  }

  /** Read-only selection snapshot used by the Stage 6 composition root. */
  getSelectedTodoIds() {
    return this.#getSelectedTodos().map((todo) => todo.id);
  }

  #handleOverlayClick = () => this.closeMobileDrawer();

  #createTodoElement(todo) {
    const template = todo.completed
      ? this.elements.completedTaskTemplate
      : this.elements.pendingTaskTemplate;
    const element = cloneTemplate(template);
    element.dataset.id = todo.id;
    element.setAttribute('aria-label', todo.title);
    const checkbox = element.querySelector('[data-action="select"]');
    checkbox.setAttribute('aria-label', `Select task: ${todo.title}`);
    checkbox.addEventListener('change', () => {
      this.setTaskSelected(todo.id, checkbox.checked);
    });

    setText(element.querySelector('.task-item__title'), todo.title);
    const description = element.querySelector('.task-item__description');
    setText(description, todo.description || 'No description');
    if (todo.completed) {
      const toggle = element.querySelector('[data-action="expand"]');
      const descriptionRegionId = `completed-description-${this.nextDescriptionRegionId++}`;
      description.id = descriptionRegionId;
      toggle.setAttribute('aria-controls', descriptionRegionId);
      toggle.setAttribute('aria-label', `Show details for ${todo.title}`);
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const expanded = this.toggleTaskCardExpansion(todo.id);
        toggle.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} details for ${todo.title}`);
      });
      const content = element.querySelector('.task-item__content');
      content.addEventListener('click', (event) => {
        if (element.classList.contains('task-item--pending-deletion')) return;
        if (event.target.closest('button, a, input, label')) return;
        const expanded = this.toggleTaskCardExpansion(todo.id);
        toggle.setAttribute('aria-label', `${expanded ? 'Hide' : 'Show'} details for ${todo.title}`);
      });
      const copyButton = element.querySelector('[data-action="copy"]');
      copyButton.setAttribute('aria-label', `Copy task with a new due date: ${todo.title}`);
    }

    const editButton = element.querySelector('[data-action="edit"]');
    if (editButton) editButton.setAttribute('aria-label', `Edit task: ${todo.title}`);
    const deleteButton = element.querySelector('[data-action="delete"]');
    if (deleteButton) deleteButton.setAttribute('aria-label', `Delete task: ${todo.title}`);
    this.#renderTaskDates(element, todo);
    if (todo.completed !== true && findPastDueDates(todo.dueDates, localTodayDate()).length > 0) {
      element.classList.add('task-item--overdue');
    } else {
      element.classList.remove('task-item--overdue');
    }
    return element;
  }

  #renderTaskDates(element, todo) {
    const dateList = element.querySelector('.task-item__dates');
    if (!dateList) return;
    dateList.replaceChildren();
    const pastDates = new Set(findPastDueDates(todo.dueDates, localTodayDate()));
    const dateTemplateItem = this.document.getElementById(todo.completed ? 'completedTaskTemplate' : 'pendingTaskTemplate')
      ?.content.querySelector('.task-item__date');
    if (!dateTemplateItem) return;
    for (const date of todo.dueDates) {
      const dateItem = dateTemplateItem.cloneNode(true);
      const time = dateItem.querySelector('time');
      time.dateTime = date;
      setText(time, dateLabel(date));
      const isPast = pastDates.has(date);
      dateItem.classList.toggle('task-item__date--past', isPast);
      const pastLabel = dateItem.querySelector('.task-item__past');
      if (pastLabel) {
        pastLabel.hidden = !isPast;
        setText(pastLabel, isPast ? 'Past' : '');
      }
      const removeButton = dateItem.querySelector('[data-action="remove-date"]');
      if (removeButton) {
        removeButton.dataset.date = date;
        removeButton.setAttribute('aria-label', `Remove date ${date} from ${todo.title}`);
      }
      dateList.append(dateItem);
    }
    dateList.hidden = todo.dueDates.length === 0;
  }

  #insertTodo(todo, list, position) {
    const element = this.#createTodoElement(todo);
    this.todosById.set(todo.id, todo);
    this.elementsById.set(todo.id, element);
    this.#insertExistingTodoElement(element, todo, list, position);
    return element;
  }

  #insertExistingTodoElement(element, todo, list, position) {
    if (position !== 'sorted') {
      list.append(element);
      return;
    }
    const todayDate = localTodayDate();
    const compare = todo.completed
      ? (otherTodo) => compareCompletedTasks(todo, otherTodo)
      : (otherTodo) => comparePendingTasks(todo, otherTodo, todayDate);
    const nextSibling = [...list.children].find((sibling) => {
      const siblingTodo = this.todosById.get(sibling.dataset.id);
      return siblingTodo && compare(siblingTodo) < 0;
    });
    list.insertBefore(element, nextSibling ?? null);
  }

  #renderSelectedDateChips() {
    const dateList = this.elements.selectedDatesList;
    dateList.replaceChildren();
    for (const date of this.selectedDates) {
      const chip = cloneTemplate(this.elements.dateChipTemplate);
      const time = chip.querySelector('time');
      time.dateTime = date;
      setText(time, dateLabel(date));
      const removeButton = chip.querySelector('button');
      removeButton.dataset.action = 'remove-selected-date';
      removeButton.dataset.date = date;
      removeButton.setAttribute('aria-label', `Remove date ${date}`);
      dateList.append(chip);
    }
    this.elements.selectedDatesEmpty.hidden = this.selectedDates.length !== 0;
    dateList.hidden = this.selectedDates.length === 0;
  }

  #updateCharacterCounters() {
    const titleLength = countCharacters(this.elements.taskTitleInput.value);
    const descriptionLength = countCharacters(this.elements.taskDescInput.value);
    setText(this.elements.titleCounter, `${titleLength} / ${TITLE_MAX_LENGTH}`);
    setText(this.elements.descCounter, `${descriptionLength} / ${DESCRIPTION_MAX_LENGTH}`);
  }

  #updateBadgeCountsFromDOM() {
    this.updateBadgeCounts(
      this.elements.pendingList.children.length,
      this.elements.completedList.children.length
    );
  }

  #getSelectedTodos() {
    const selectedTodos = [];
    for (const [id, element] of this.elementsById) {
      if (element.querySelector('[data-action="select"]')?.checked) {
        const todo = this.todosById.get(id);
        if (todo) selectedTodos.push(todo);
      }
    }
    return selectedTodos;
  }

  #syncSelectionActions() {
    const selectedTodos = this.#getSelectedTodos();
    const selectedCount = selectedTodos.length;
    this.elements.bulkBar.hidden = selectedCount === 0;
    setText(this.elements.bulkCount, `${selectedCount} ${selectedCount === 1 ? 'task' : 'tasks'} selected`);
    const allPending = selectedCount > 0 && selectedTodos.every((todo) => todo.completed === false);
    this.elements.bulkCompleteBtn.hidden = !allPending;
    for (const [id, element] of this.elementsById) {
      const todo = this.todosById.get(id);
      const editButton = element.querySelector('[data-action="edit"]');
      const copyButton = element.querySelector('[data-action="copy"]');
      const deleteButton = element.querySelector('[data-action="delete"]');
      const isSelected = selectedCount === 1 && selectedTodos[0]?.id === id;
      if (editButton) editButton.hidden = !isSelected || todo?.completed !== false;
      if (copyButton) copyButton.hidden = !isSelected || todo?.completed !== true;
      if (deleteButton) deleteButton.hidden = !isSelected;
    }
  }

  #getDrawerFocusableElements() {
    return [...this.elements['sidebar-navigation'].querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  #setDrawerBackgroundInert(isInert) {
    const candidates = [
      this.elements.navbar,
      this.elements.mainContent,
      this.elements.bulkBar,
    ].filter(Boolean);
    for (const element of candidates) {
      if (isInert) {
        this.backgroundInertState.set(element, {
          inert: element.inert,
          ariaHidden: element.getAttribute('aria-hidden'),
        });
        element.inert = true;
        element.setAttribute('aria-hidden', 'true');
      } else {
        const priorState = this.backgroundInertState.get(element);
        if (!priorState) continue;
        element.inert = priorState.inert;
        if (priorState.ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', priorState.ariaHidden);
        this.backgroundInertState.delete(element);
      }
    }
  }
}

export default TodoView;
