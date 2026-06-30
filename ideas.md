# RefacturaRO — Design Brainstorm

## Three Stylistic Approaches

### Approach A — "Corporate Precision"

Clean, corporate SaaS with blue/white, data-dense tables, minimal decoration.
**Probability:** 0.05

### Approach B — "Slate Command Center" ✅ CHOSEN

Dark-accented sidebar, slate-900 nav, white content area. Feels like a professional accounting tool — serious, trustworthy, fast.
**Probability:** 0.08

### Approach C — "Minimal Fintech"

Ultra-minimal, lots of whitespace, monochrome with a single electric accent.
**Probability:** 0.03

---

## Chosen Approach: "Slate Command Center"

### Design Movement

Enterprise SaaS / B2B Fintech — inspired by tools like Stripe Dashboard, Linear, and Notion. Precise, data-first, with subtle depth.

### Core Principles

1. **Data density with clarity** — tables and lists are the hero, not decorative elements
2. **Sidebar-driven navigation** — persistent left sidebar, collapsible on mobile
3. **Micro-interactions everywhere** — hover states, transitions, loading skeletons
4. **Trust through consistency** — every component follows the same radius/shadow/color rules

### Color Philosophy

- Primary: Blue-600 (#2563EB) — action, trust, authority
- Background: Slate-50 (light) / Slate-900 (dark)
- Cards: White / Slate-800
- Accent: Emerald for success, Rose for errors, Amber for warnings
- The blue is the only "loud" color — everything else is neutral

### Layout Paradigm

- Fixed left sidebar (240px) with icon + label nav items
- Main content area with `p-4 md:p-8 max-w-7xl`
- Top header bar with breadcrumb + actions
- Asymmetric: sidebar anchors left, content breathes right

### Signature Elements

1. **Pill badges** for invoice status (Drafted / Sent / Paid / Overdue)
2. **Rounded-full inputs and buttons** as specified in UI rules
3. **Subtle gradient header** in the sidebar (slate-900 to slate-800)

### Interaction Philosophy

- Every click gives immediate feedback (loading spinner, disabled state)
- Tables have row hover highlight
- Modals slide in with scale(0.95) → scale(1) + opacity

### Animation

- Sidebar items: 150ms ease-out on hover
- Page transitions: 200ms fade
- Modals: 250ms scale + opacity
- Toasts: slide in from top-right, 300ms

### Typography System

- Font: Inter (Google Fonts) — the standard for SaaS tools
- Page titles: text-xl font-bold (as per spec)
- Labels: text-xs font-bold uppercase tracking-wider text-slate-500
- Table text: text-sm
- Numbers: font-mono for currency values

### Brand Essence

**RefacturaRO** — platforma de re-facturare pentru firme românești care cumpără și revând. Rapidă, precisă, conectată.
Adjectives: **Profesional, Eficient, De încredere**

### Brand Voice

Headlines: direct, fără fluff — "Re-facturează în 3 click-uri"
CTAs: acționale — "Importă factură", "Generează re-factură", "Trimite clientului"
Ban: "Bun venit pe platforma noastră", "Începeți astăzi"

### Wordmark & Logo

Simbol: un document cu o săgeată circulară (re-facturare) în albastru pe fond transparent.
Logotype: "Refactura" bold + ".ro" în blue-600

### Signature Brand Color

Blue-600 (#2563EB) — albastrul acțiunii și al încrederii
