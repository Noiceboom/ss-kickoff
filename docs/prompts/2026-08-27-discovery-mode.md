# Build a sales-discovery mode into the kickoff doc

You are working in `~/GitHub/ss-kickoff`, a static, no-build, no-backend
kickoff document that runs on GitHub Pages. It already works and is in
daily use. Your job is to add a **second mode** to it: a discovery
document for the first sales call with a prospect.

Do not start writing code until you have read the files listed under
*Orient first* and asked the questions at the end.

---

## What this is for

The first call with a prospect is an information download. Sam is trying to
learn enough about the business to build an offer that lands on the **next**
call. The kickoff doc already asks most of the right questions — service
area, goals, current marketing, services, competitors — and asks them well.
Discovery needs those, minus everything that only makes sense after someone
has signed, plus the handful of things a sales conversation needs and a
kickoff doesn't.

---

## Four decisions already made — do not reopen them

1. **Same repo, second mode.** Not a fork. A second module registry
   selected by URL (e.g. `?mode=discovery`). The field kit, state engine,
   city dataset, trade taxonomy, export machinery and check harness are all
   shared. A bug fixed once is fixed for both.
2. **It is screen-shared with the prospect, live.** This is the defining
   design constraint. See its own section below.
3. **Two deliverables:** a PDF of everything discussed, sent to the
   prospect after the call, and a JSON payload Sam loads into the Service
   Scalers OS by hand.
4. **That JSON pre-fills the kickoff doc** when the prospect signs, so the
   kickoff manager confirms and fills gaps instead of re-asking.

---

## Orient first — read these, in this order

| File | Why |
|---|---|
| `docs/specs/2026-08-25-master-kickoff-design.md` | The design rules and why they exist |
| `js/modules/index.js` | The registry. Sequence lives here and nowhere else |
| `js/ui.js` | The field kit. The **only** sanctioned way to render an input |
| `js/state.js` | State, migrations, service/location universes, URL codec |
| `js/export.js` | The versioned OS payload contract |
| `js/modules/12-readout.js` | The client document and the export API |
| `docs/check.mjs` | The contract harness. Run it constantly |
| `js/modules/05-services.js`, `js/modules/07-locations.js` | The two hardest screens; read before touching either |

Run `node docs/check.mjs` before you change anything, so you know what
green looks like.

---

## Non-negotiable constraints

These are inherited from the existing code. Breaking any of them produces
bugs that do not throw and are invisible until a live call.

1. **`render(ctx)` is pure.** Same ctx in, same HTML out. No side effects,
   no DOM access, no listeners, no writes to state.
2. **Use only the closed `data-*` protocol** (`data-f`, `data-chip`,
   `data-status`, `data-toggle`, `data-row`, `data-addrow`, `data-go`,
   `data-tab`, `data-copy`, …). Modules never attach their own handlers.
   An input rendered any other way silently stops autosaving.
3. **The caret rule.** `input` events write to state and queue a save
   **only** — they must never re-render. Discrete clicks re-render.
   Violate this and every keystroke loses the caret mid-sentence, live, in
   front of a prospect.
4. **Module `id` values and state keys are persisted** in saved state, in
   share links and in the export contract. Renaming one orphans data. If
   you must, write a stamped migration.
5. **Every string reaching HTML goes through `esc()`.**
6. **No credentials anywhere, in any field, ever.**
7. **`node docs/check.mjs` must pass, and must cover the new registry too.**
   Today it walks one module list; make it walk both.

---

## Keep, drop, add

**Keep — and keep the same module ids and state keys.** This is what makes
the handoff work; matching keys is not a nicety, it is the mechanism.

- `goals` — revenue, leads, average ticket, close rate, now vs target. This
  is how an offer gets sized.
- `marketing` — the channel pick grid, incumbent agency, what worked and
  what burned them.
- `services` — industry selector, service list, priority.
- `locations` — service area, radius search, do-not-market cities.
- `competitors` — who they lose to.

**Drop.** Everything that only exists because someone has signed:

- point of contact, billing contact, call-tracking decisions
- account access, the Leadsie link
- brand, logo and tone
- "what we need from you" action lists

**Add.** What a sales conversation needs that a kickoff doesn't. Ask Sam
for the exact questions — do not invent the list — but expect roughly:

- what prompted them to take this call
- what is actually broken right now
- who else is involved in the decision, and on what timeline
- what a win would look like to them
- capacity: what happens if the phone rings twice as much

---

## The defining constraint: the prospect is watching

The screen is shared. Everything on it is being read by the person you are
trying to sell to. This changes more than it first appears.

- **No capture screen may show anything you would not want the prospect
  reading.** No deal-size arithmetic, no qualification scoring, no
  fit/red-flag signals, no internal opinions.
- **Every help string must be safe to read aloud.** The kickoff's help text
  is written for Sam — *"Ask directly. Every owner has one, and finding it
  in a live ad is expensive."* is fine on a kickoff call with a signed
  client and is not fine in front of a prospect. Do not copy help text
  across without rewriting it. This is the single easiest thing to get
  wrong here.
- **The offer thinking is the point of the exercise and cannot be on
  screen.** Put it on one clearly-marked internal tab in the readout that
  Sam simply does not open while sharing, and make certain the PDF never
  emits it. The kickoff already solves exactly this problem — the client
  document renders on every tab into a hidden `.printdoc`, and print emits
  that and nothing else. Reuse the pattern; there is a check enforcing it.
- That internal tab is where the value is. It should answer: what to pitch,
  which services and cities to lead with, what their own numbers imply
  about what this is worth, the phrases they used that should show up in
  the proposal, and what is still unknown before it can be priced.

---

## The handoff — the hardest part, plan it before you build it

The discovery payload has to load into the kickoff doc and arrive as
answered state. Build the importer as its own module with its own checks.

Known traps, all of them real:

- **`fields.<module>` is keyed on state keys and maps back directly — but
  it is not the whole module.** Anything the payload represents as a
  structured block is *deliberately excluded* from `fields` by the
  `STRUCTURAL` denylist in `js/export.js`, so replaying `fields` alone
  silently drops it. Check that list before assuming a module round-trips.
- **Marketing is the trap here, and it is the one that will bite you.**
  `fields.marketing` contains only the loose text answers — for a fully
  filled-in screen it can be as little as `{"agency":"Lead Ninjas"}`. Every
  channel selection, rating, monthly lead volume and per-channel note lives
  **only** in the top-level `channels` array, reconstructed from `chan`,
  `rate_<id>`, `vol_<id>` and `note_<id>`. An importer that replays
  `fields.marketing` and stops will lose the entire "what's running today"
  picture — which is one of the most valuable things the call produces.
  Rehydrate `channels` back into those keys explicitly, and write a check
  that a rated channel survives the round trip.
- **`services`, `locations`, `channels` and `access` are all resolved
  entity lists, not raw state.** Rehydrating means reconstructing
  `on` / `off` / `prio` / `added` / `snap` correctly. Read
  `serviceUniverse()` and `locationUniverse()` in `js/state.js` first.
- **Taxonomy-only services carry trade-scoped ids** (`hvac:water-heaters`);
  scraped ones do not (`water-heaters`). Get this wrong and a selection
  lands on the wrong row or vanishes. `scopedId()` and
  `reconcileServiceScoping()` exist for this.
- **A prospect usually has no `clients/<slug>.json`.** There is no scrape
  yet. Anything they name that the taxonomy does not know must survive as
  an `added` item with a **stable id** — regenerating ids from names later
  orphans every note and priority attached to them.
- **With no client file, `loadClient()` falls back to
  `clients/template.json`, and that file has a `slug` of its own.** Until
  `b37` that identity won its way into everything downstream: the header,
  the download filename and `client.slug` in the export. Every prospect
  produced a payload stamped `"slug": "template"`, so a folder of discovery
  JSONs was mutually indistinguishable and an import had nothing to key on.
  Fixed in `js/app.js` and pinned by a check — do not undo it, and do not
  assume anything else that borrows the template keeps its own identity
  until you have looked.
- **`client.name` is empty for a prospect with no file**, while the name
  they actually gave you is in `fields.company.businessName`. Decide which
  wins on import and be consistent; the export currently carries both.
- **The localStorage key is `ss-kickoff:<slug>` and does not know about
  modes.** Two modes on one slug will silently overwrite each other.
  Namespace it, and write a migration for anything already saved.
- **`state.step` holds a module id.** A discovery step id means nothing to
  the kickoff registry. `REPLACED_BY` in `js/state.js` shows the pattern.
- **`mig` stamps are shared** across both modes. A migration that means one
  thing in discovery and another in kickoff will corrupt one of them.

Mutation-test the importer specifically: a service selected in discovery
with priority High must arrive in the kickoff selected, High, **asserted by
id, not by display name**.

---

## How to work

Implement → `node docs/check.mjs` → **mutation-test every fix** (revert it,
confirm the check fails) → browser-verify on a served origin → commit with a
message that says why → confirm live by polling the served build stamp.

- ES modules and `fetch()` need a real origin. `python3 -m http.server` on
  a fresh port; a stale module cache will otherwise serve you old code and
  waste an hour.
- **A check that still passes when you break the thing it tests is worse
  than no check.** Before believing a mutation result, confirm the mutation
  actually applied — a failed string match reads exactly like a passing
  test. This has happened repeatedly here.
- A check derived from the same source as the thing it checks cannot detect
  a deletion. Pin the things that must exist, by name.
- Never claim something is verified because the element exists. Verify it
  does the thing.

## Traps this codebase has already sprung

Do not rediscover these:

- `node --check` exits 0 on ES modules with real syntax errors. It is not a
  gate. `docs/check.mjs` is.
- Sharing an array reference from a module constant into state mutates the
  constant for every client until reload.
- An unstamped migration re-runs on every load and fights the user — they
  switch something off, it comes back.
- `window.confirm` auto-cancels in automated browsers. The
  fragment-vs-local-session prompt will silently discard your seeded test
  state.
- Autosave flushes on unload, so seeding `localStorage` and then navigating
  gets clobbered by the outgoing page. Drive the UI instead.
- The CSP blocks `blob:` images unless `img-src` allows it. A preview that
  "renders" may be a broken image.
- CSS specificity: `.f input[type=text]` beats `.pre input`, which once ate
  the first two characters of every currency field.

---

## Ask Sam before you build

1. **The exact questions** for the new discovery-only screens — what
   prompted the call, what's broken, decision process, timeline, what a win
   looks like. He has strong opinions and the wording matters; do not
   invent them.
2. **Does he want a fit or qualification signal at all?** If yes it is
   internal-only and never on a shared screen — confirm that is what he
   means before building it.
3. **What the offer tab should actually contain.** It is the reason this
   exists. Ask what he wants in front of him when he sits down to price it.

Do not ask about repo layout, screen-sharing, the deliverables or the
handoff. Those are settled above.
