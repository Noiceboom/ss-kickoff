# Service Scalers — Master Kickoff Doc

**Status:** approved 2026-08-25 · revised post-review
**Supersedes:** the hardcoded one-off at `Noiceboom/bf-plumbing-kickoff`

## Problem

Every Service Scalers kickoff covers the same ground and none of it is captured the
same way twice. The Benjamin Franklin Plumbing one-off proved the format — confirm the
scraped service and city lists, rank them live, walk away with a build order. This
generalises that into the doc every kickoff runs through.

Most of what a kickoff captures is **found out on the call**. This is not a form the
client fills in beforehand. It is a document typed into live while someone is talking.
Every decision below follows from that.

## Non-goals

- Not wired to Service Scalers OS in this build. The OS integration is the *contract*, not the plumbing.
- No website scraper here. The OS will own scraping; this consumes its output.
- **No credential capture, ever.** See "Security".
- No boilerplate `site.ts` code emission — out of scope by Sam.

## Architecture

Static site, no build step, no backend. One URL per client:

```
noiceboom.github.io/ss-kickoff/?c=bfp-kc
```

```
.nojekyll               REQUIRED — Pages/Jekyll otherwise strips some paths
index.html              shell — header, nav, mount point, CSP
css/kickoff.css         design-guide tokens + shared components
js/state.js             state object, autosave, URL-fragment codec, validation
js/ui.js                shared render helpers + the field kit
js/rank.js              drag-to-rank engine (shared by modules 06 and 08)
js/app.js               boot, client load, routing, ALL event delegation
js/modules/index.js     the registry — sequence lives here and nowhere else
js/modules/00-intro.js … 12-readout.js
clients/template.json   the contract (NOT underscore-prefixed — see above)
clients/bfp-kc.json     worked reference + test fixture
```

ES modules served directly. `fetch()` of the client JSON means **this requires a served
origin** — it will not run from `file://`. Locally: `python3 -m http.server 8791`.

---

## Module contract

```js
export default {
  id:      "goals",                    // stable key into state.m — NEVER renamed
  nav:     "Goals",                    // pill label
  title:   "Where are you trying to get to?",
  lede:    "…",
  skippable: true,
  render(ctx)  → HTML string,
  summary(ctx) → { rows?, list?, table?, open? } | null,
  status(ctx)  → "empty" | "partial" | "done"
}
```

`ctx` is `{ state, client, transient }`.

### Rules

1. **`render` is pure.** Same ctx in, same HTML out. No side effects, no DOM access.
2. **A module never attaches listeners and never mutates state directly.** All
   interaction flows through the closed field-kit protocol below, handled in `app.js`.
3. **Modules may read any part of `state`.** A module never *calls* another module.
   (06/08 read `m.services.off`; 09 cross-references 05/07; 12 reads everything.)
4. **Modules never return `"skipped"`.** `app.js` resolves `state.skipped` before
   calling `status()`.
5. **Every interpolation of state or client data goes through `ui.esc()`.** The field
   kit escapes by default. This is load-bearing — see Security.

### `summary()` shapes

Module 12 needs more than label/value pairs, so a summary may return any of:

```js
{
  rows:  [[label, value], …],          // definition list
  list:  { title, items: [{ n, name, meta }] },   // ranked list w/ tier bands
  table: { head: [col…], body: [[cell…], …] },    // becomes CSV rows verbatim
  open:  [{ what, detail }]            // open items — surfaced in all three tabs
}
```

### Field-kit protocol (closed set)

`app.js` handles exactly these attributes. No module invents new ones.

| Attribute | Payload | Effect | Re-renders? |
|---|---|---|---|
| `data-f` | `mod\|key` | write input value to `m[mod][key]` | **no** |
| `data-row` | `mod\|key\|idx\|col` | write to `m[mod][key][idx][col]` | **no** |
| `data-note` | `mod\|itemId` | write to `notes["mod:itemId"]` | **no** |
| `data-chip` | `mod\|key\|value` (+ `data-multi`) | set / toggle in `m[mod][key]` | yes |
| `data-toggle` | `mod\|key` | flip boolean `m[mod][key]` | yes |
| `data-status` | `mod\|key\|value` | set `m[mod][key]` | yes |
| `data-addrow` / `data-delrow` | `mod\|key[\|idx]` | push / splice a row | yes |
| `data-item` / `data-sub` | list on/off toggles | services & locations grids | yes |
| `data-mv` / `data-top` / `data-grip` | rank actions | see `rank.js` | yes |
| `data-skip` | `mod` | toggle `state.skipped` | yes |
| `data-go` | module id | navigate | yes |
| `data-tab` | `mod\|name` | set `transient[mod].tab` | yes |

### Re-render policy — the caret rule

> **`input` events write to state and autosave ONLY. They never re-render.**

Re-render happens on discrete actions (the "yes" column above). On re-render, `app.js`
restores `document.activeElement` by its `data-*` key and its selection range.

Rationale: replacing `innerHTML` under a focused textarea drops the caret mid-sentence
while the client is mid-answer. This is the single most likely live-call failure.

### Transient UI state

`transient` is a plain object, keyed by module id, holding things like which note boxes
are expanded and which readout tab is active. **Never persisted, never encoded into the
fragment.** Without it, an open note collapses on every unrelated re-render.

---

## State

Autosaved to `localStorage` under `ss-kickoff:<clientSlug>` so two kickoffs never collide.

```js
{
  v: 2,
  step: "goals",             // MODULE ID, not an index — reordering the registry
                             // must not send old links to the wrong screen
  m: {                       // per-module state, keyed by module id
    company:   { legalName: "…", phone: "…" },
    services:  { off: ["bathtubs"], subsOff: { drains: ["Hydrojetting"] }, added: [] },
  },
  order:   { services: [id…], locations: [id…] },
  skipped: ["competitors"],
  notes:   { "services:drains": "…" }   // grammar: <moduleId>:<itemId>
}
```

**What state stores:** diffs against the *scraped lists* (services/locations on-off,
sub-service drops, order, per-item notes) plus **all typed content** for modules 01–04
and 09–11, which have nothing to diff against. Share links are therefore not
guaranteed short — see the size guard below.

### Order preservation (the rule that matters)

`applyOrder` rewrites the stored order so ON items follow the new sequence **while OFF
items hold their existing slots**. Without it, toggling an item off in module 05 and
back on drops it at an arbitrary position in 06, and Sam re-ranks by hand on the call.

Reconcile rules:
- ids in `state.order` absent from the client JSON are **ignored, never deleted**
- client items missing from `order` append in client order
- newly scraped items default to **ON** (deny-list semantics)

### Stale client JSON

State stamps `source.scrapedAt` on first write. On load, `app.js` diffs saved ids
against the current client JSON and shows a banner naming any that no longer resolve.
**Unresolved ids are preserved, never pruned** — loading an older JSON must not destroy
data.

### Load precedence and the overwrite trap

Fragment beats localStorage. But: if a fragment is present **and** localStorage holds a
non-empty session for that slug, `app.js` must **prompt before replacing** — otherwise
opening a teammate's link silently destroys Sam's in-progress kickoff 400ms later, with
no undo.

A `v` mismatch **refuses and warns**. It never silently discards.

### Autosave

Debounced 400ms, and **flushed** on navigation, `visibilitychange`, and `beforeunload`,
so the last thing typed before clicking the next pill is never lost.

---

## Client JSON contract

The durable artefact — what the OS emits once it creates a client and scrapes their site.

```jsonc
{
  "slug": "bfp-kc",
  "client": { "name": "…", "market": "…", "website": "…", "trade": "…" },
  "source": { "scrapedAt": "2026-08-25", "from": "…", "method": "manual" },
  "services":  [ { "id": "drains", "name": "Drains", "subs": ["Drain Cleaning"],
                   "hasPage": true, "verify": null } ],
  "locations": [ { "id": "roeland-park", "name": "Roland Park", "state": "KS",
                   "hasPage": false, "verify": "Likely Roeland Park — confirm" } ]
}
```

`verify`: any non-null string renders a gold VERIFY badge with that string as the
explanation, and becomes an open item in the readout.
`hasPage: true`: an existing page — a rewrite, not a build.
`id`: **stable forever.** Renaming one orphans notes, drops and order.

**The schema is CLOSED.** Only the keys above. No PII — no phone, email, address or
contact names — because this file is committed to a public repo. Everything in it must
already be public on the client's own website.

Loading: `?c=<slug>` where slug matches `/^[a-z0-9-]{1,40}$/`. Anything else — including
`../` traversal attempts — falls back to `clients/template.json`. The slug is
interpolated into both a fetch path and the storage key, so this validation is required,
not cosmetic.

---

## Modules

| # | id | Screen | Captures |
|---|---|---|---|
| 00 | `intro` | Intro & agenda | Nothing. Client, market, scraped counts, what's coming. |
| 01 | `company` | Company & contact | Legal name, DBA, tagline, description, website, phone, email, address, hours, emergency line, license #, year founded, service radius |
| 02 | `goals` | Goals & targets | Current vs target revenue/mo and leads/mo, budget, avg ticket, close rate, capacity ceiling, what winning looks like in 90 days |
| 03 | `marketing` | Current marketing & spend | Incumbent agency, contract end, channel rows (channel / spend / who runs it / working), what worked, what burned them |
| 04 | `competitors` | Competitors | Rows: name, domain, why they win, threat level |
| 05 | `services` | Services — confirm | Grid over `client.services`, sub-service chips, add-your-own, per-item notes |
| 06 | `servicesRank` | Services — rank | Drag-rank of confirmed services, tiers at 1–5 / 6–10 / 11+ |
| 07 | `locations` | Locations — confirm | Same grid, grouped by state, VERIFY and HAS A PAGE badges |
| 08 | `locationsRank` | Locations — rank | Drag-rank of confirmed locations |
| 09 | `constraints` | Constraints & non-negotiables | Seasonal blackouts, capacity limits, compliance/franchise rules, never-say phrases. **Cross-references** what was unchecked in 05 and 07. |
| 10 | `brand` | Brand, voice & proof | Logo status, colors, photo status, review count/rating, awards, guarantees, financing, warranty, USP rows, say-this / never-say |
| 11 | `access` | Access & credentials | **Status tracker only.** Fixed rows + add-your-own. Per row: owner, status, how-to-request (constrained select). |
| 12 | `readout` | Readout & exports | Client recap / Internal brief / Raw. Copy, print, JSON + CSV. |

Empty states are required: modules 06 and 08 must render sensibly with zero confirmed
items, and 09 must handle 05 and 07 both being skipped.

### Open items

Feed all three readout tabs: skipped sections, unresolved `verify` flags on *confirmed*
locations, access rows not `granted`, and any module still `empty`.

---

## Live-call affordances

- Nothing required. No validation gates, no blocked "next".
- `⊘ Didn't cover` on every skippable section. Skipped ≠ blank — it becomes an open item.
- Autosave every keystroke (debounced, flushed on nav).
- One shared field kit so all 13 screens tab identically.
- Drag-rank has three input paths — pointer drag, ↑/↓ buttons, arrow keys on a focused
  handle — because dragging on a screen-share is unreliable.

---

## Security

The repo is public and the state is rehydrated from an attacker-controllable URL fragment.

### Committed vs typed

| Committed to the repo | Browser + share link only |
|---|---|
| Scraped services & locations | Revenue, targets, budgets |
| Client name, market, site URL | Competitor notes, constraints |
| `hasPage` / `verify` flags | Access tracker status |

### XSS — the real hole

Every module returns an HTML string built by concatenation, populated from client JSON
**and from a base64 payload in the URL**. A crafted link containing `<img src=x
onerror=…>` in a company name would execute in this origin and could read
`localStorage` — i.e. **every other client's kickoff, including all the financials**.

Required:
- `ui.esc()` on every interpolation; the field kit escapes by default
- the decoded fragment is **schema-validated before use**: unknown keys dropped, string
  lengths capped, wrong types rejected — not half-applied
- a CSP `<meta>` on `index.html`: `default-src 'self'`, fonts explicitly allowed, **no
  `connect-src`**. This is the enforceable boundary; a grep is not. No third-party
  scripts, ever — one analytics snippet would exfiltrate the entire state.

### Share links are confidential

The fragment is not sent to a server, and Slack's unfurler cannot see it. But the full
URL is stored in Slack's message archive: searchable workspace-wide, subject to
retention and compliance export, and synced into browser history.

> **"No credentials" does not mean "not confidential."** The link carries revenue,
> targets, budgets, competitor notes and access status. Internal DMs only — never a
> client-facing or company-wide channel. For anything durable, use the JSON export.

The page states this next to the Copy Link button.

### No credentials, enforced not requested

A banner is advisory; on a live call a client reads a password aloud and it goes in the
nearest box. Therefore:

- module 11's inputs are **constrained** — owner (text), status (enum), how-to-request
  (select from a fixed list). No free-text field invites a secret.
- an input guard pattern-matches `password|api[_-]?key|token|secret|sk-|Bearer|AKIA`
  and high-entropy strings, warns, and refuses to persist.

### Other

- **Fragment size guard.** A fully-typed kickoff can exceed the practical URL ceiling.
  Above the limit, Copy Link degrades to "too large to share — use the JSON export"
  rather than silently producing a truncated link.
- **Clear this kickoff** control, since localStorage otherwise accumulates every
  client's financials on the laptop indefinitely.
- **Standing check on `clients/*.json`**, not on "built source" (there is no build):
  grep for phone/email/address/key patterns before commit.

---

## Verification

Browser-tested before push.

**Correctness**
1. All 13 modules render against `bfp-kc.json` **and** `template.json` (empty client).
2. Drag-rank reorders via all three input paths; order survives toggling an item off and on.
3. Empty states: 06/08 with zero confirmed items; 09 with 05 and 07 both skipped.
4. Autosave survives reload; per-client keys don't collide; pending save flushes on nav.
5. Readout tabs populate; JSON and CSV download and parse.
6. Every `state.m` key resolves to a registered module.

**The typing test** — catches the most likely live-call failure
7. Type continuously into a longtext for 5s: caret never moves, no keystrokes dropped,
   an open note stays open, the active readout tab stays active.
8. Tab order walks every field on every screen in visual order.

**Roundtrip**
9. Share link reproduces order, drops, notes, skips, custom additions **and all free
   text from modules 01–04, 09–11** in a cleared browser.
10. A fully-populated state produces a link under the size limit, or degrades cleanly.
11. Fragment + existing localStorage session prompts before overwriting.
12. Stale client JSON (renamed id) shows the mismatch banner; nothing is pruned.

**Security**
13. Hostile fragment (`<img src=x onerror=alert(1)>` in every string field) executes nothing.
14. `?c=../../etc/passwd` and `?c=<script>` fall back to the template.
15. CSP present; no third-party script loads.
16. `clients/*.json` contains no phone, email, address or contact name.

**Layout**
17. No console errors. No horizontal overflow at 1280 / 768 / 375.
