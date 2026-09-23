# UI/UX Design Template

Use when the requirement defines visual design, layout, a design system component, responsive behavior, or an interaction pattern focused on how the interface looks and feels rather than on functional behavior.

Unique to this template: the **Accessibility (WCAG 2.2 AA)** table with 14 non-negotiable rules, the design token conventions, and the image/mockup analysis workflow.

## Contents

- Template
- Image analysis workflow
- WCAG 2.2 AA checklist
- Responsive breakpoints
- Design token conventions

## Template

````markdown
# spec-[feature-name]

## Metadata

| Field | Value |
|---|---|
| **Feature** | [Human-readable feature name] |
| **Parent feature** | [spec-[parent].md, or "None" if top-level] |
| **Sub-features** | [Comma-separated spec-[child].md files, or "None"] |
| **Requirement refs** | [BR-NNN, UR-NNN, FR-NNN, NFR-NNN — the IDs this spec satisfies] |
| **Feature type** | UI/UX design |
| **Status** | Draft |

Status values: Draft, Review, Approved, Implemented.

## Description

[2-4 sentences: what the user sees, the visual purpose of this component or screen, and the design intent.]

## Visual hierarchy

| Level | Element | Purpose |
|---|---|---|
| **Primary** | [Headline, hero image, CTA button] | [Draws first attention] |
| **Secondary** | [Subheadings, supporting text, secondary actions] | [Provides context] |
| **Tertiary** | [Metadata, footnotes, navigation aids] | [Available but not prominent] |

## Component hierarchy

| Component | Type | Children | Props/Variants |
|---|---|---|---|
| [Component name] | [Layout / Interactive / Display / Form] | [Child components] | [sm/md/lg, primary/secondary, default/hover/disabled] |

## Layout specification

| Breakpoint | Layout | Key changes |
|---|---|---|
| **Mobile** (under 640px) | [Stack / single column] | [Hidden elements, reordered content, collapsed nav] |
| **Tablet** (640px to 1024px) | [2-column / sidebar collapse] | [Intermediate layout changes] |
| **Desktop** (over 1024px) | [Multi-column / full layout] | [Full layout description] |

## Design tokens

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | [#hexvalue] | [Primary actions, links] |
| `--color-surface` | [#hexvalue] | [Card backgrounds, panels] |
| `--color-error` | [#hexvalue] | [Error states, destructive actions] |
| `--spacing-[size]` | [rem value] | [Component padding, margins] |
| `--radius-[size]` | [rem value] | [Border radius for cards, buttons, inputs] |
| `--font-[role]` | [font-family, weight, size] | [Headings, body, labels, captions] |

## Interaction patterns

| Interaction | Trigger | Animation/Transition | Duration |
|---|---|---|---|
| [Hover state] | [Mouse enter] | [Background color change, shadow lift] | [150ms ease] |
| [Focus state] | [Tab or click] | [Focus ring, outline offset] | [0ms, immediate] |
| [Loading] | [Data fetch] | [Skeleton, shimmer, or spinner] | [Until data arrives] |
| [Transition] | [Route or state change] | [Fade, slide, scale] | [200-300ms ease-out] |

## States

| State | Visual treatment | Content shown |
|---|---|---|
| **Default** | [Normal appearance] | [Standard content] |
| **Loading** | [Skeleton placeholders or spinner] | [Placeholder shapes matching the final layout] |
| **Empty** | [Illustration plus CTA] | ["No items yet. Create your first [item]." with an action] |
| **Error** | [Error banner or inline message] | [What went wrong and how to fix it] |
| **Disabled** | [Reduced opacity, no pointer events] | [Same content, non-interactive] |

## Behavior

Visual behavior that a reviewer can verify is written as a Requirement with Scenarios. Use this for responsive changes, state transitions, and accessibility guarantees.

### Requirement: [Responsive collapse of the navigation]

The navigation SHALL collapse to [pattern] below the [breakpoint] breakpoint.

#### Scenario: Mobile viewport

- **GIVEN** the viewport width is below 640px
- **WHEN** the page renders
- **THEN** the navigation SHALL render as [hamburger menu]
- **AND** the page SHALL NOT scroll horizontally at a 320px viewport width

#### Scenario: Desktop viewport

- **GIVEN** the viewport width is at or above 1024px
- **WHEN** the page renders
- **THEN** the navigation SHALL render as [full horizontal nav] with [N] visible items

### Requirement: [Focus visibility]

Every focusable element SHALL show a visible focus indicator meeting a 3:1 contrast ratio against its background.

#### Scenario: Keyboard focus

- **GIVEN** the user navigates with the keyboard
- **WHEN** focus reaches [element]
- **THEN** the element SHALL render [2px solid outline with 2px offset]
- **AND** the indicator SHALL NOT be suppressed by `outline: none`

## Accessibility (WCAG 2.2 AA)

Non-negotiable. Every row applies to every UI/UX spec.

| # | Criterion | Requirement | Implementation |
|---|---|---|---|
| 1 | **Color contrast** | 4.5:1 for normal text, 3:1 for large text and UI components | [Verified with the specific color pairs] |
| 2 | **Keyboard operable** | 100% of functions reachable without a mouse | [Tab order follows visual reading order] |
| 3 | **Focus indicator** | Visible on every focusable element, never removed | [2px solid outline with offset, 3:1 contrast against background] |
| 4 | **Touch targets** | Minimum 24x24px with adequate spacing; 44px minimum height on mobile | [Per-component sizes] |
| 5 | **Labels** | Visible label associated with every form input | [`<label for>` or `aria-labelledby`] |
| 6 | **Alt text** | Descriptive for informative images, empty (`alt=""`) for decorative | [Specific alt text per image] |
| 7 | **Heading hierarchy** | Logical h1, h2, h3 with no skipped levels | [Document outline verified] |
| 8 | **Color-independent** | Information never conveyed by color alone | [Icons, text, or patterns supplement color] |
| 9 | **Reflow** | No horizontal scrolling at a 320px viewport width | [Verified at the mobile breakpoint] |
| 10 | **Error identification** | Errors identified in text with `aria-invalid`, not by color alone | [Messages adjacent to their fields] |
| 11 | **Live regions** | Dynamic status and error messages announced via `aria-live` | [Which region, politeness level] |
| 12 | **Semantic HTML** | `<button>`, `<a>`, `<nav>`, `<main>` instead of `<div>` substitutes | [Element per component] |
| 13 | **Language** | `lang` attribute set on the `<html>` element | [Value] |
| 14 | **Sticky elements** | Sticky headers and footers must not obscure the focused element | [Scroll padding or offset used] |

## Responsive behavior

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| [Navigation] | [Hamburger menu] | [Collapsed sidebar] | [Full horizontal nav] |
| [Content grid] | [1 column] | [2 columns] | [3-4 columns] |
| [Typography scale] | [Base 14px] | [Base 15px] | [Base 16px] |
| [Spacing scale] | [Compact, 0.75x] | [Standard, 1x] | [Comfortable, 1.25x] |

## Image/Mockup analysis

If mockups or screenshots were provided, record what was extracted from them:

| Source image | Extracted | Mapped to |
|---|---|---|
| [path/to/mockup.png] | [Palette, type scale, spacing rhythm, component boundaries] | [Which design tokens and layout rows above] |

Accessibility concerns visible in the mockup: [contrast, target size, missing labels, or "None found"].

## Traceability

| Requirement | Spec section | Verified by |
|---|---|---|
| [UR-NNN] | [Visual hierarchy / Layout specification] | [Visual review reference] |
| [NFR-NNN] | [Accessibility (WCAG 2.2 AA)] | [Accessibility audit reference] |
````

## Image analysis workflow

When mockups or screenshots are supplied:

1. **Read the image** with the Read tool (PNG, JPG, and other common formats are supported).
2. **Extract visual properties:** color values (approximate hex from inspection), typography (sizes, weights, hierarchy), spacing patterns (consistent gaps and padding), component boundaries and nesting.
3. **Map to design tokens.** Every extracted value lands in the design token table so developers do not invent their own.
4. **Flag accessibility issues** visible in the mockup: contrast, touch target size, missing labels, color-only signaling.
5. **Compare against requirements.** Confirm the mockup covers every requirement ID in the metadata block, and note any it contradicts.

## WCAG 2.2 AA checklist

The 14 rules in the template's Accessibility table are the checklist. Do not ship a UI/UX spec with an unfilled Implementation column; "to be decided" means the spec stays Draft.

## Responsive breakpoints

Standard breakpoints, customized per project:

| Name | Min width | Typical devices |
|---|---|---|
| `xs` | 0 | Small phones |
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets, portrait |
| `lg` | 1024px | Tablets landscape, small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large desktops |

## Design token conventions

- Use CSS custom properties (`--token-name`) or the project's design system format (Tailwind, Material, and so on).
- Token categories: color, spacing, typography, radius, shadow, motion.
- Naming: `--{category}-{role}-{variant}`, for example `--color-primary-500`, `--spacing-lg`, `--radius-md`.
- Document every token in the spec. An undocumented value is a value a developer will guess.
