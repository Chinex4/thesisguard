# Responsive UI and landing page changes

This document records the September 2026 responsive UI pass for ThesisGuard.

## Scope

The pass covers:

- public landing page
- login, registration, forgot-password, and reset-password screens
- authenticated workspace shell and navigation
- student, supervisor, and administrator workspace content
- student dashboard copy and card layout

The base visual rules remain in `src/app/globals.css`. Responsive and layout-specific overrides are kept in `src/app/responsive.css` so future changes are easier to review and roll back.

## Dashboard

Dashboard copy was shortened without changing the data hierarchy. Metric labels are now compact, the student similarity prompt uses a single sentence, and repository/report cards use shorter descriptions. The information shown and the underlying queries are unchanged.

Responsive behavior:

- two-column metric cards on normal mobile widths
- one-column metric cards below 380 px
- similarity prompt becomes a vertical card on mobile
- dashboard quick links collapse to one column
- page actions become full-width touch targets on small screens

## Landing page

The landing page was simplified to focus on the core product flow rather than decorative marketing copy.

Changes include:

- shorter hero statement and supporting copy
- cleaner report preview based on the actual ThesisGuard interface
- reduced navigation on small screens while retaining Log in and Get started
- three concise workflow steps
- simplified repository and academic-review value cards
- responsive typography using `clamp()` rather than fixed desktop sizes
- no generated imagery or decorative stock imagery

The report preview is explicitly illustrative and should not be treated as a real similarity result.

## Authentication pages

Authentication screens now use the same form markup, validation, and server actions as before. Layout changes are presentation-only:

- desktop keeps the split introduction/form layout
- tablet and mobile collapse to a compact brand header plus form
- form controls use a minimum 46 px height and 16 px input text to avoid mobile browser zoom
- action buttons use at least 48 px height
- faculty/department fields collapse to one column
- forms fit 320 px-wide screens without page-level horizontal scrolling

## Workspace

The desktop sidebar remains unchanged in purpose. On smaller screens it becomes a drawer with an accessible menu button.

Mobile safeguards include:

- minimum 44 px icon/button touch targets
- constrained user-name width with ellipsis
- hidden nonessential workspace subtitle at phone sizes
- tighter page and panel padding
- stacked page headings/actions
- grid and flex children use `min-width: 0` to prevent content overflow
- filters collapse to one column
- comparison panels collapse to one column
- long content may wrap instead of widening the viewport

Tables remain inside `.table-wrap`. On narrow screens a wide table can scroll inside its own table container, but the page itself should not horizontally scroll.

## Breakpoints

The responsive layer uses three practical ranges:

- desktop: above 900 px
- tablet: 641–900 px
- mobile: 640 px and below
- compact phones: 380 px and below

Existing legacy breakpoints in `globals.css` remain in place; `responsive.css` loads afterward and provides the final layout behavior.

## Accessibility

The pass keeps the existing skip link and focus-visible treatment and adds or preserves:

- labelled primary/workspace navigation
- 44 px minimum touch targets for navigation and icon controls
- readable mobile input text
- reduced-motion support
- semantic headings and article sections
- no interaction that relies only on hover

## Regression checklist

Before release, test at 320, 375, 390, 768, 1024, and desktop widths.

Check:

1. `/` landing header, hero, report preview, workflow cards, and footer.
2. `/login`, `/register`, `/forgot-password`, and `/reset-password`.
3. `/dashboard`, `/theses`, `/theses/new`, `/scans`, `/repository`, and `/profile`.
4. Supervisor and admin dashboards if those roles are available.
5. Drawer opens, closes after navigation, and sign-out remains reachable.
6. No page-level horizontal scrollbar appears.
7. Tables scroll only inside their table container when necessary.
8. Forms remain usable with browser zoom at 200%.
9. Keyboard focus remains visible.
10. Upload, scan, report, authentication, and database behavior remain unchanged.

## Error handling

This UI pass does not change existing API or server-action error handling. Authentication and workspace errors continue to be surfaced by their existing Alert/error components. Responsive rules are CSS-only and do not suppress error messages or validation states.
