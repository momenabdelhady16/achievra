# 04 — Design System & Tokens Specification

## 1. CSS Custom Properties (`:root`)

All design tokens are standardized using CSS variables. Units are in `rem` (calculated against base `16px`), with pixel media queries as per web best practices.

```css
:root {
  /* ── Color Palette: Primary ── */
  --clr-primary:         #087ff5;
  --clr-primary-hover:   #006fe0;
  --clr-primary-shadow:  rgba(8, 127, 245, 0.2);
  --clr-primary-light:   #eaf5ff;
  --clr-primary-lighter: #edf6ff;
  --clr-primary-glow:    rgba(7, 133, 255, 0.21);
  --clr-primary-ring:    rgba(8, 127, 245, 0.07);

  /* ── Color Palette: Typography ── */
  --clr-text-heading:    #13213c;
  --clr-text-body:       #17233b;
  --clr-text-input:      #22314c;
  --clr-text-secondary:  #67748b;
  --clr-text-muted:      #8490a4;
  --clr-text-faint:      #98a4b9;
  --clr-text-completed:  #94a0b1;

  /* ── Color Palette: Borders ── */
  --clr-border-light:    #e8eef7;
  --clr-border-default:  #e5ebf3;
  --clr-border-input:    #dce5f0;
  --clr-border-form:     #dfeaf7;
  --clr-border-hover:    #cfddeb;
  --clr-border-empty:    #d9e3ef;

  /* ── Color Palette: Backgrounds ── */
  --clr-bg-page:         #f7faff;
  --clr-bg-card:         #ffffff;
  --clr-bg-hover:        #f5f8fc;
  --clr-bg-badge:        #eef2f7;
  --clr-bg-completed:    #fbfcfe;
  --clr-bg-empty:        #fbfdff;
  --clr-bg-note:         #f2f8ff;

  /* ── Color Palette: Status & Feedback ── */
  --clr-danger:          #e5484d;
  --clr-danger-bg:       #fff0f0;
  --clr-danger-border:   #ffc7c7;
  --clr-warning:         #b45309;       /* Accessible dark yellow for text */
  --clr-warning-bg:      #fefce8;       /* Overdue background highlight */
  --clr-warning-border:  #fde047;       /* Overdue border */
  --clr-overlay:         rgba(16, 33, 60, 0.4);

  /* ── Typography Families ── */
  --ff-body:    "DM Sans", system-ui, -apple-system, sans-serif;
  --ff-heading: "Manrope", system-ui, -apple-system, sans-serif;

  /* ── Transitions & Animation Durations ── */
  --transition-fast:     0.18s ease;
  --transition-drawer:   0.25s ease;
  --transition-mutate:   0.30s ease;
}
```

---

## 2. Typography Hierarchy

| Selector / Role | Font Family | Size (rem) | Weight | Letter Spacing | Line Height |
|---|---|---|---|---|---|
| `h1` (Page Title) | `--ff-heading` | `clamp(2rem, 4vw, 2.625rem)` | 800 | `-0.106rem` | 1.15 |
| `.brand__name` | `--ff-heading` | `1.25rem` (20px) | 800 | `-0.031rem` | 1.2 |
| `.task-form__heading` | `--ff-heading` | `1.1875rem` (19px) | 700 | Normal | 1.25 |
| `.task-section__heading` | `--ff-heading` | `0.9375rem` (15px) | 700 | Normal | 1.3 |
| `.task-item__title` | `--ff-body` | `0.875rem` (14px) | 600 | Normal | 1.4 |
| `.btn--primary` | `--ff-body` | `0.875rem` (14px) | 700 | Normal | 1.0 |
| Form Input / Select | `--ff-body` | `0.875rem` (14px) | 400 | Normal | 1.4 |
| Form Labels | `--ff-body` | `0.75rem` (12px) | 700 | Normal | 1.2 |
| Character Counters | `--ff-body` | `0.6875rem` (11px) | 400 | Normal | 1.0 |
| `.task-item__description` | `--ff-body` | `0.8125rem` (13px) | 400 | Normal | 1.4 |
| Task date/meta | `--ff-body` | `0.6875rem` (11px) | 400 | Normal | 1.4 |
| `.nav-label` | `--ff-body` | `0.625rem` (10px) | 700 | `0.094rem` | 1.0 |
| Section Counter Badge | `--ff-body` | `0.625rem` (10px) | 700 | Normal | 1.0 |

---

## 3. Dimensions, Spacing, and Radius Scale

### 3.1 Border Radius Tokens
| Element | rem Value | Pixel Equivalent |
|---|---|---|
| Form Modal / Card container | `1rem` | 16px |
| Task rows (`.task-item`) | `0.8125rem` | 13px |
| Sidebar tip card | `0.8125rem` | 13px |
| Primary action buttons | `0.6875rem` | 11px |
| Brand logo icon / Badges | `0.625rem` | 10px |
| Form inputs & Textareas | `0.5625rem` | 9px |
| Icon-only buttons | `0.5625rem` | 9px |
| Selection Checkbox | `0.4375rem` | 7px |

### 3.2 Spacing Constants
- `0.25rem` (4px): Micro gaps between nav items.
- `0.4375rem` (7px): Spacing between form label and input control.
- `0.5625rem` (9px): Vertical gap in `.task-list`.
- `0.75rem` (12px): Standard button horizontal padding.
- `0.875rem` (14px): Grid gap in form layouts.
- `0.9375rem` (15px): Task row inner padding.
- `1.25rem` (20px): Sidebar horizontal padding.
- `1.5rem` (24px): Form card inner padding.
- `2.625rem` (42px): Margin below primary page header.
- `4.5rem` (72px): Main content top padding (desktop).

---

## 4. Responsive Breakpoints

| Breakpoint Name | Media Query | Layout Changes |
|---|---|---|
| **Desktop** | `> 768px` | Sidebar pinned left (`16.5rem`). Navbar hidden. Content max-width `57.5rem` (920px). |
| **Tablet** | `≤ 768px` | Sidebar converted to off-canvas modal drawer. Top navbar rendered. Content centered, max-width `42.5rem` (680px). |
| **Mobile** | `≤ 576px` | Content width `calc(100% - 2rem)`. Form inputs switch from 2-column to 1-column. Task row actions always visible with descriptive labels. Add Task keeps a visible text label with its icon. |
| **Small Mobile** | `≤ 378px` | Tighter padding (`calc(100% - 1.5rem)`). Task action buttons stack vertically. |

---

## 5. BEM Class Taxonomy

All CSS class names follow the strict BEM standard:

```css
/* App Shell */
.app-shell {}

/* Top Navbar (Mobile only) */
.navbar {}
.navbar__brand {}
.navbar__logo {}
.navbar__name {}
.navbar__toggler {}

/* Sidebar Drawer */
.sidebar {}
.sidebar--open {}
.sidebar__brand {}
.sidebar__nav {}
.sidebar__tab {}
.sidebar__tab--active {}
.sidebar__badge {}
.sidebar__note {}
.sidebar-overlay {}
.sidebar-overlay--visible {}

/* Main Content Area */
.main-content {}
.main-header {}
.main-header__title {}
.main-header__add-btn {}

/* Task Creation / Edit Form */
.task-form {}
.task-form--hidden {}
.task-form__header {}
.task-form__title {}
.task-form__close-btn {}
.task-form__group {}
.task-form__label {}
.task-form__counter {}
.task-form__input {}
.task-form__input--error {}
.task-form__error-message {}
.task-form__submit-btn {}

/* Task Section & List */
.task-section {}
.task-section--pending {}
.task-section--completed {}
.task-section__header {}
.task-section__heading {}
.task-section__count {}
.task-list {}

/* Task Card Component */
.task-item {}
.task-item--completed {}
.task-item--overdue {}
.task-item--selected {}
.task-item--pending-deletion {}
.task-item--expanded {}
.task-item__checkbox {}
.task-item__content {}
.task-item__title {}
.task-item__description {}
.task-item__meta {}
.task-item__date {}
.task-item__actions {}
.task-item__btn-edit {}
.task-item__btn-copy {}
.task-item__btn-delete {}

/* Undo Banner */
.undo-banner {}
.undo-banner__text {}
.undo-banner__btn {}

/* Bulk Action Bar */
.bulk-bar {}
.bulk-bar__count {}
.bulk-bar__btn-complete {}
.bulk-bar__btn-delete {}
```

---

## 6. Accessibility & Reduced Motion

```css
/* Focus ring standard */
:focus-visible {
  outline: 2px solid var(--clr-primary);
  outline-offset: 2px;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
