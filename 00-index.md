# To-Do Application — Specification Index

This suite documents the agreed MVP and future scope. The original project brief remains in [todo-app-spec.md](todo-app-spec.md); the numbered modules contain the current detailed requirements. Explicit rules in modules 01–06 take precedence over any older conflicting example.

## Modules

1. [Architecture & Scope](01-architecture-and-structure.md): responsibilities, dependency flow, MVP and future features.
2. [Data Model & Repository](02-data-model-and-repository.md): entity fields, multi-date data, persistence contract, migration and errors.
3. [Business Rules & Workflows](03-business-rules-and-workflows.md): validation, duplicates, merges, dates, sorting, selection and deletion.
4. [Design System & Tokens](04-design-system-and-tokens.md): visual tokens, responsive layout and motion.
5. [UI Components & Accessibility](05-ui-components-and-accessibility.md): semantic markup, keyboard behavior and local DOM updates.
6. [Implementation & Acceptance Criteria](06-implementation-and-acceptance-criteria.md): contracts and observable acceptance checks.

## Agreed MVP at a glance

- Product name: **Achievra**. `favicon.svg` is the approved logo. On tablet/mobile, the closed navbar shows only the logo at the left; opening the drawer hides that outside logo and shows the logo beside “Achievra” inside the drawer.
- English interface; semantic HTML; native selection checkboxes; SVG icons with visible descriptive labels.
- LocalStorage initially, accessed only through an asynchronous, storage-agnostic repository contract. The repository creates identifiers and returns the saved task.
- `completed` is Boolean. Task fields include immutable `id`, required title (1–32 characters), optional description (0–256 characters), zero or more unique `YYYY-MM-DD` due dates, and completion metadata needed for ordering.
- Text is trimmed and internal whitespace runs collapse to one space. Each user-perceived character, including a joined emoji, counts as one.
- No raw user input is rendered through `innerHTML`. Static JavaScript-authored markup may use it only if it cannot contain or be affected by raw user input.
- Add/update/delete must persist successfully before the corresponding DOM change. Update only the changed task node; add/remove only affected nodes for create/delete. A failure preserves entered data and reports its reason.
- Pending tasks sort by their representative nearest due date, farthest first, with undated tasks last; equal dates sort alphabetically. Completed tasks sort by completion time, earliest first, with alphabetical tie-break.
- Each deletion has its own five-second undo and adjacent control; when multiple deletions are pending, a bottom Undo All restores all still-reversible deletions. If the page reloads during that grace window, the saved task remains in storage and the app resumes a fresh five-second undo window after loading it.
- Pending tasks with any past due date are highlighted yellow, and each past date is explicitly marked as past. Completed cards have two expansion sizes based on whether the full description fits; exact dimensions are deferred to implementation.
- Categories, search, filters, and a trash/recycle bin are future features, not placeholder controls in the MVP. Permanent deletion occurs after the five-second undo window.
- When search is introduced, define its no-results message then; the MVP has no search behavior or “no task found” result.
