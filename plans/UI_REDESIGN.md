# UI Redesign — "Neural Collective" Theme

## Goal

Restyle every page and component in the TerpSpark app to match the visual language shown in the reference screenshots. **Do not change any logic, routing, or data flow.** This is a pure visual/styling task.

The three reference images share a consistent design language:
- Near-black dark backgrounds with very thin borders
- Bold crimson-red primary accent (`#C41E3A`)
- Barlow Condensed (Black/ExtraBold) for display headings
- Inter (existing) for body text
- Near-zero border radius — everything is square or nearly square
- Technical ALL_CAPS labels with letter-spacing for metadata/tags
- Square status badges (not pill/rounded-full)
- Square avatar chips (not circular)
- Dashed borders on secondary CTA buttons

---

## Design Tokens

### 1. CSS Custom Properties — `app/globals.css`

Update the color token system. The app stays dark (dark mode default). Keep existing neutral-950 background. Add:

```css
/* Brand red accent */
--brand-red: #C41E3A;
--brand-red-hover: #A31730;

/* Focus ring changes from amber to red */
/* (Applied via Tailwind class changes; no CSS var needed) */
```

Update `--radius` from `0.625rem` to `0.1875rem` (≈3 px). This makes all shadcn-derived rounded calculations very small/square.

In `:root`:
```css
--radius: 0.1875rem;
```

The `.dark` block color values should remain identical to current (background neutrals are already correct).

### 2. Font Loading — `app/layout.tsx`

Import **Barlow Condensed** alongside Inter from Google Fonts:

```ts
import { Inter, Barlow_Condensed } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-display",
});
```

Add `--font-display` CSS variable in `globals.css` under `@theme inline`:

```css
--font-display: var(--font-display);
```

Apply both variables to `<html>`:
```tsx
className={`dark ${inter.variable} ${barlowCondensed.variable} h-full bg-neutral-950 text-neutral-100 antialiased`}
```

Add Tailwind utility class in globals.css so `font-display` works:
```css
/* Already handled by @theme inline --font-display: var(--font-display) */
```

The `font-display` Tailwind class will automatically be available via the CSS variable.

---

## Universal Tailwind Class Replacements

Apply across **every file listed below** unless the file-specific section says otherwise.

| Old class | New class | Notes |
|---|---|---|
| `rounded-xl` | `rounded` | |
| `rounded-2xl` | `rounded` | |
| `rounded-lg` | `rounded-sm` | |
| `rounded-full` | `rounded` | **Except** the stance meter bar track (keep `rounded-full` there for the progress fill look) |
| `rounded-md` | `rounded-sm` | |
| `bg-amber-500` | `bg-red-700` | Only on CTA/primary action buttons (not on Visionary stance color) |
| `hover:bg-amber-400` | `hover:bg-red-600` | Only on CTA/primary action buttons |
| `bg-amber-400` | `bg-red-600` | |
| `focus-visible:ring-amber-400` | `focus-visible:ring-red-600` | Everywhere |
| `text-amber-400` | `text-red-500` | On hover states, NOT on Visionary stance label |
| `border-amber-500/45` | `border-red-700/60` | On the pause/continue buttons |
| `bg-amber-950/35` | `bg-red-950/40` | On the pause/continue buttons |
| `hover:bg-amber-950/55` | `hover:bg-red-950/60` | On the pause/continue buttons |
| `text-amber-100` | `text-red-100` | On the pause/continue buttons |
| `text-neutral-950` (on amber buttons) | `text-white` | Since we go dark red, white text is better |

> **Exception — Visionary stance color:** In `StanceMeter.tsx`, `MessageBubble.tsx`, and anywhere the Visionary agent is specifically colored amber, **keep amber**. The amber color represents the Visionary's identity and should not become red.

---

## File-by-File Changes

### `app/layout.tsx`

1. Import `Barlow_Condensed` from `next/font/google` with weights `["700", "900"]` and variable `"--font-display"`.
2. Apply `barlowCondensed.variable` alongside `inter.variable` on the `<html>` element.

---

### `app/globals.css`

1. Add `--font-display: var(--font-display);` in the `@theme inline` block.
2. Change `--radius: 0.625rem` → `--radius: 0.1875rem` in `:root`.
3. Add these utility classes at the bottom (before the `@media prefers-reduced-motion` block):

```css
/* Brand red variable for use in arbitrary values */
:root {
  --brand-red: #C41E3A;
}
```

---

### `app/page.tsx` (Landing page)

Complete visual restyle. Apply the following changes:

1. **Brand wordmark** ("TerpSpark" `<h1>`):
   - Add `font-display` class (Barlow Condensed)
   - Change to uppercase: `tracking-widest uppercase`
   - Remove `text-6xl font-bold` → use `text-7xl font-black` (Barlow Condensed Black)
   - Keep `text-neutral-100`

2. **Tagline `<p>`**: No font change needed, keep `text-neutral-400`. Reduce text size to `text-base`.

3. **CTA button ("Get started")**:
   - Apply universal amber→red swap (see table above)
   - Change `rounded-xl` → `rounded-sm`
   - Add `uppercase tracking-widest` and `text-xs font-bold` style
   - Keep `px-8 py-3`

4. **Feature grid container**: Remove `rounded-xl` → remove entirely (no radius). Change `gap-px` stays, `border-neutral-800 bg-neutral-800` stays but change overflow to not clip rounded corners since there are none.

5. **Feature grid cells** (Propose/Challenge/Converge labels): 
   - Change `text-amber-500` → `text-red-500`
   - Change cell label from sentence case to `uppercase tracking-wide`
   - Keep `text-xs`, keep `text-neutral-400` for description

6. **"No setup required"** sub-note: keep as-is, just update focus ring per table.

---

### `app/login/page.tsx`

1. **Page layout**: The current centered card on a dark bg is fine. Change the card from `rounded-2xl` → `rounded` (or `rounded-sm`).

2. **"TerpSpark" brand link at top**:
   - Add `font-display uppercase tracking-widest`
   - Change `hover:text-amber-400` → `hover:text-red-500`
   - Size: keep `text-3xl font-bold` or increase to `text-4xl font-black`

3. **"Sign in to your account" subtext**: keep as-is.

4. **Form card** (`bg-neutral-900 border-neutral-800`): Change `rounded-2xl` → `rounded-sm`.

5. **Labels** ("Email", "Password"):
   - Add `uppercase tracking-widest text-[10px]` to make them look like the reference ALL_CAPS labels
   - Keep `text-neutral-300`

6. **Inputs**:
   - Change `rounded-lg` → `rounded-sm`
   - Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`
   - Keep rest as-is

7. **Submit button** ("Sign in"):
   - Apply amber→red swap (see table)
   - Add `uppercase tracking-widest text-xs font-bold`
   - Change `rounded-lg` → `rounded-sm`

8. **Footer note about Firebase/MongoDB**: keep as-is.

---

### `app/dashboard/page.tsx`

#### Header

1. **"TerpSpark" brand** (`<span>`): Add `font-display uppercase tracking-widest text-base`.
2. **Sign out button**: Change `rounded-lg` → `rounded-sm`, change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.

#### Page heading area

1. **"Your sessions" `<h1>`**: Add `font-display uppercase tracking-wide` class, `text-3xl` or `text-2xl font-black`.
2. **"New idea" button** (`+ New idea`):
   - Apply amber→red swap
   - Change `rounded-xl` → `rounded-sm`
   - Add `uppercase tracking-widest text-xs font-bold`

#### `StateBadge` component (inline in dashboard)

Replace `rounded-full` → `rounded-sm` on all badge `<span>` elements. This makes them square-cornered status chips matching the reference.

Specific badge color adjustments:
- **Resolved** (was `bg-emerald-950/60 border-emerald-700/50 text-emerald-400`): keep green, change `rounded-full` → `rounded-sm`.
- **In progress** (was blue): keep blue, change `rounded-full` → `rounded-sm`.
- **Awaiting feedback** (was amber): change to `bg-yellow-950/60 border-yellow-600/50 text-yellow-400`, change `rounded-full` → `rounded-sm`.
- **Ended** (was neutral): keep, change `rounded-full` → `rounded-sm`.

#### `SessionCard` component (inline in dashboard)

1. Change `rounded-xl` → `rounded-sm`.
2. Change `hover:border-neutral-700 hover:bg-neutral-800/70` stays.
3. Topic text: keep `text-neutral-100 text-sm font-semibold`.
4. Remove button: change `rounded` → `rounded-sm`, `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.
5. "Top ideas" label (`text-neutral-500 uppercase tracking-wide`): already correct style, keep.

#### Empty state

1. Change `rounded-2xl` → `rounded-sm` on the dashed border container. The dashed border is already `border-dashed` which is on-theme — keep it.
2. "Start a new idea" button: apply amber→red swap, change `rounded-lg` → `rounded-sm`, add `uppercase tracking-widest text-xs font-bold`.

---

### `app/dashboard/new/page.tsx`

This wraps `TopicForm`. No major layout changes needed — the inner form is restyled via `TopicForm.tsx`. Just:
1. The page heading ("New idea"): Add `font-display uppercase tracking-wide font-black`.
2. Any "Back" link: change `text-amber-400` if present → `text-red-500`.

---

### `components/TopicForm.tsx`

1. **Labels** ("Topic", "UMD Context", "How many ideas…"):
   - Add `uppercase tracking-widest text-[10px]`
   - Change `text-neutral-300` keeps.

2. **Inputs** (textarea, number input):
   - Change `rounded-lg` → `rounded-sm`
   - Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`
   - Keep border and background styles.

3. **Submit button** ("Start debating" / "Starting debate…"):
   - Apply amber→red swap
   - Change `rounded-lg` → `rounded-sm`
   - Add `uppercase tracking-widest text-xs font-bold`

4. **Error text**: Change `text-red-400` → keep (already red).

---

### `components/MessageBubble.tsx`

1. **Avatar chips**: Change `rounded-full` → `rounded` (slightly square). This visually matches the reference where agent chips are square.
   - Visionary: **keep** `bg-amber-500/20 text-amber-500 border-amber-500/40`.
   - Critic: keep `bg-slate-500/20 text-slate-400 border-slate-400/40`.
   - User: keep `bg-neutral-700 text-neutral-200 border-neutral-600`.

2. **Agent name label** (e.g. "Visionary", "Critic", "You"):
   - Already has `uppercase tracking-wide` — keep.
   - Already `text-neutral-400 text-xs` — keep.

3. No other changes (content area, markdown prose, etc. stay identical).

---

### `components/ChatView.tsx`

1. **"New messages ↓" button**:
   - Change `rounded-full` → `rounded-sm`
   - Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`
   - Change `border-neutral-700 bg-neutral-900` stays.

---

### `components/InterjectBox.tsx`

1. **Textarea**:
   - Change `rounded-lg` → `rounded-sm`
   - Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`

2. **Send button**:
   - Change `rounded-lg` → `rounded-sm`
   - Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`
   - The send button is currently muted (`bg-neutral-800`). Change to use a subtle red-tinted style: `bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700` — no color change needed here, the muted style is fine for a secondary action. Just fix radius and focus ring.

3. **Helper text** ("Interject anytime…"): keep as-is.

---

### `components/StanceMeter.tsx`

1. **Bar track** (`bg-neutral-800 rounded-full border-neutral-700`): Change track `rounded-full` → `rounded-sm` but keep fill `rounded-full` for the progress fill (inner fill div). Actually, change both track and fill to `rounded-sm` for a completely square aesthetic.
2. **"Low"/"High" labels**: keep as-is.
3. **Hint text**: keep as-is.
4. **Visionary label** (`text-amber-500`): **keep amber** — do not change.
5. **Critic label** (`text-slate-400`): keep.

---

### `components/PendingMessageQueue.tsx`

1. **Edit button hover**: Change `hover:text-amber-400` → `hover:text-red-500`.
2. **Cancel button hover** (`hover:text-red-400`): already red — keep.
3. **Hover backgrounds** (`hover:bg-neutral-800`): keep.
4. **Focus rings**: Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.

---

### `components/SessionChatTitle.tsx`

1. **Input field**: Change `rounded` → `rounded-sm`, `border-neutral-600` → keep, `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.
2. **Pencil icon hover**: Change `hover:text-amber-400` → `hover:text-red-500`.
3. **Pencil button hover bg**: `hover:bg-neutral-800` → keep.
4. **Focus ring**: Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.

---

### `components/CandidatePanel.tsx`

1. Container: Change `rounded-xl` → `rounded-sm`. Change border `border-amber-500/30` → `border-red-700/30`.
2. List item cards: Change `rounded-lg` → `rounded-sm`.

---

### `components/JudgePanel.tsx`

1. The side panel (`rounded` not applicable — it's a fixed full-height aside, no radius needed).
2. List items: Change `rounded-lg` → `rounded-sm`.
3. Status badges inside (`rounded px-2 py-0.5`): Change `rounded` → `rounded-sm`.
4. Close button: Change `rounded-md` → `rounded-sm`, change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.
5. "Judge notes" heading: Change `text-emerald-400` → keep (green is thematically appropriate for "converged/judge").

---

### `components/EndButton.tsx`

1. Change `rounded-lg` → `rounded-sm`.
2. Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`.
3. Keep `hover:bg-red-500/20 hover:text-red-400` — already red on hover.

---

### `app/session/[id]/page.tsx`

#### Header

1. **"TerpSpark" brand span**:
   - Add `font-display uppercase tracking-widest`
   - Keep `text-neutral-100 text-sm font-semibold`

2. **Context badge** (the UMD context pill):
   - Change `rounded-full` → `rounded-sm`
   - Keep `bg-neutral-800 text-neutral-300`

3. **"Show judge's thoughts" / "Hide judge's thoughts" button**:
   - Change `rounded-lg` → `rounded-sm`
   - Change `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`

4. **`EndButton`**: styled via its own component (see above).

#### Sidebar (aside) — Pause/Resume button

Change from amber styling to red:
- `border-amber-500/45` → `border-red-700/60`
- `bg-amber-950/35` → `bg-red-950/40`
- `hover:bg-amber-950/55` → `hover:bg-red-950/60`
- `text-amber-100` → `text-red-100`
- `rounded-lg` → `rounded-sm`
- `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`

#### "Session ended" block

1. Container: Change `rounded-xl` → `rounded-sm`.
2. **"Continue session" button**:
   - Change `rounded-lg` → `rounded-sm`
   - Change from amber style (`border-amber-500/45 bg-amber-950/35 text-amber-100`) → red style (`border-red-700/60 bg-red-950/40 text-red-100 hover:bg-red-950/60`)
   - `focus-visible:ring-amber-400` → `focus-visible:ring-red-600`

---

## What NOT to Change

- All logic, hooks, reducers, API calls, routing, SSE handling — untouched.
- Visionary amber coloring in `StanceMeter.tsx` and `MessageBubble.tsx` — amber stays for the Visionary agent identity.
- The `prose prose-invert` markdown rendering in `MessageBubble` — untouched.
- The animation (`terpspark-bubble-in`) — untouched.
- `ContextSelect.tsx` — not listed above, skip (minor internal component, leave as-is).
- All `lib/` and `hooks/` files — untouched.
- `tailwind.config.*` — not needed since fonts are loaded via CSS variables.

---

## Verification

After implementation, run `npx next build` in the project directory to confirm no TypeScript errors were introduced. Since this is a class-name-only change, no type errors are expected.
