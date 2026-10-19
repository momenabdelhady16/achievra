# 03 — Business Rules & Workflows

## 1. Validation

- Title is required; reject empty or whitespace-only values after normalization. Description is optional and may be empty.
- Trim both ends and collapse every internal whitespace run to one space in title and description.
- Title limit is 32 grapheme clusters; description limit is 256 grapheme clusters. Every grapheme counts as one, including emoji.
- Due dates are optional and stored as a unique array of date-only `YYYY-MM-DD` values. A task may have multiple dates. Calendar comparisons use year/month/day only; do not apply timezone conversion or time-of-day.
- On create, a past date presents an in-app choice notification: “This due date has already passed. Would you like to add this task as Completed?” The notification includes explicit choice buttons, has no auto-dismiss timer, and remains visible until the user chooses. Confirm saves it as a new Completed task; cancel preserves all fields. This choice takes precedence over a matching Pending title: after confirmation, create a separate Completed task and do not merge it into or reject it because of that Pending task. Matching Completed tasks also do not block it. For a multi-date create, any past date requires this choice. An edit may remove one or more dates but cannot add/set a past date; if an existing date becomes past with time, it remains and is indicated visually.
- A pending task with at least one past date is highlighted yellow. Mark each past date with an explicit “Past” indicator so the reason is clear. It remains pending until the user completes it.

## 2. Duplicate detection and merging

Compare normalized titles case-insensitively against Pending tasks. A title matching a Completed task does not block a new task. Compare normalized descriptions case-insensitively for exact-duplicate checks. Dates are sets of calendar days.

### 2.1 Add workflow

For a matching Pending title:
1. If the proposed description is empty, reject as already existing; preserve form contents and highlight the matching card.
2. If title and description match an existing task and the proposed date is already among that task’s dates (including both being undated), reject as already existing; do not save or clear fields and highlight the matching card.
3. If title and description match but the proposed date is a new date, append that unique date to the existing task. If the task had no date and the new task has no date, this is the exact duplicate case above.
4. If descriptions differ, present an in-app choice notification asking whether to merge. It has no auto-dismiss timer and remains until the user chooses. On confirmation, place the normalized new description below the old description. Use exactly one newline when the old description is non-empty; if the old description is empty, store the new description without a leading newline. Add any new due date to the existing task’s date array. If the new date is already present, do not duplicate it.
5. Before confirming a merge, check whether more than two complete sentence fragments repeat verbatim between the two descriptions. Fragments are delimited by comma or period; delimiters mark boundaries and are not part of the fragment. Support comma and period punctuation in the text. If more than two fragments match, explain which text repeats in an in-app choice notification and ask whether to append anyway. It has no auto-dismiss timer and remains until the user chooses. The user may confirm even if repeated. This is a warning, not an automatic rejection.
6. Reject a merge that would exceed 256 grapheme clusters (including a structural newline when one is used); preserve the form and ask the user to edit the description.
7. On successful merge, update the existing task record/card; do not create a second card.

### 2.2 Editing into another task

Completed tasks cannot be edited. A Pending task may be edited. If its new normalized title conflicts with another Pending task, apply the same duplicate/merge checks while excluding the source record from comparison. When the user confirms merge, merge the edited source task’s resulting description and date(s) into the existing target task, subject to the 256-character limit. The target remains the single task; the source record is absorbed/removed as part of the same persisted operation. Do not ask whether to keep or delete the source separately. Save all affected records successfully before updating their DOM nodes.

If the new title is not a conflict, update only title, description, and date collection; never update `id`. An update that fails validation or storage keeps the form populated and leaves the current task DOM unchanged.

### 2.3 Sentence fragment comparison

A sentence fragment starts/ends at a comma or period boundary; punctuation marks themselves are excluded. Trim whitespace around fragments and compare verbatim text. Ignore empty fragments. Count the number of matching fragments; show the repetition confirmation only when the count is greater than two. This rule applies to descriptions that are about to be merged.

## 3. Completed tasks and copying

- `completed` is a Boolean. Completed tasks are immutable: no direct title, description, or due-date edits.
- A single selected Completed task offers Delete and Copy. Several selected Completed tasks offer Delete only.
- Copy leaves the original untouched and opens the entry form with title and description prefilled. The date defaults to today and remains editable; user may accept today or choose another date. The created record follows normal validation and duplicate rules.
- If a copied task is created for today/future, it is Pending. A past chosen date follows the “add as Completed” prompt.

## 4. Sorting

Pending and Completed are separate sections with independent rules:
- Pending task with due dates: compute its representative date as the due date closest to today (minimum absolute calendar-day distance). Sort representative dates farthest to nearest. Tasks without dates appear last. If two Pending tasks have the same representative date, sort titles alphabetically (case-insensitive).
- A task with multiple dates is one card and participates in Pending ordering by its representative date. Each date remains visible on that card.
- Completed tasks sort by completion time, earliest completed first, irrespective of due date. Tasks completed at the same moment sort alphabetically by normalized title. Legacy completed records without timestamps appear as a group before timestamped completions and retain their stored order within that group because their historical completion time is unavailable.

## 5. Selection and action availability

Selection uses native checkboxes and is separate from completion status. Do not allow a selection containing both Pending and Completed tasks. Action matrix:
- One Pending task: Delete, Edit, Mark Complete.
- Multiple Pending tasks: Delete, Mark Complete.
- One Completed task: Delete, Copy.
- Multiple Completed tasks: Delete only.
- Mixed Pending/Completed selection: cannot be formed; clear or prevent the incompatible selection with an accessible explanation.

## 6. Deletion grace period and undo

- Deletion is suggested immediately in the interface, but persisted data is not deleted until that task’s own five-second timer expires.
- Each affected task becomes muted for five seconds and gets an adjacent Undo button. Each task has an independent timer, so another deletion can begin before earlier timers expire.
- If multiple deletions are active, also show a bottom “Undo All” control. It restores every deletion whose timer has not expired. An individual Undo restores only its task and cancels only its timer.
- Reload during the five-second period does not cancel the user's deletion request: because persistence has not yet changed, the task remains stored and appears again in the normal list, then receives a fresh five-second Undo window. If the deletion had already failed, it is not retried automatically and the stored task remains available.
- When a timer expires, persist the deletion and then remove the affected node with a 0.3 second transition. A storage failure restores that task and displays a clear reason.
- For a batch, partial success is allowed; report each failed task/location and restore failed rows. Do not claim that a failed item was deleted.
- After expiry and successful persistence, deletion is permanent in this version. A future trash/recycle bin is out of scope.

## 7. Partial completion and feedback

Batch completion may partially succeed. Successfully persisted tasks move to Completed; failed tasks remain Pending. Display a clear reason and identify each failed task. Never move a node before its persistence succeeds. On validation/storage errors, distinguish the failure type, preserve form input, and keep the task in its current DOM position/state.
