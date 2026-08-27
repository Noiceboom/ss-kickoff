# Service Scalers — Discovery mode

**Status:** built b38–b41 · 2026-08-27
**Extends:** `2026-08-25-master-kickoff-design.md`, which still governs
everything not restated here.

## Problem

The kickoff doc asks most of the right questions and asks them well, but
it only runs after someone has signed. The first sales call covers the
same ground — service area, goals, current marketing, services,
competitors — and captures none of it, so the kickoff asks it all a
second time and the offer in between is built from memory.

Discovery is a second mode over the same document: the sales call, with a
payload that pre-fills the kickoff when the prospect signs.

## The defining constraint

**The screen is shared, live, with the person being sold to.**

Everything else follows from that. It is not a styling concern; it
changes what may be on screen at all.

## Architecture

One repo, one field kit, one state engine, two registries.

```
js/modes.js                 mode constants, `variant()`, `say()`/`sayer()`
js/modules/index.js         KICKOFF, DISCOVERY, ALL, registryFor(mode)
js/modules/06-whynow.js     the one discovery-only screen
js/import.js                payload → kickoff state
```

`?mode=discovery` selects the registry. `app.js` resolves it once at boot
via `useMode()` and every reference reads that binding, so there is one
switch rather than eleven.

**Shared screens are the same module objects in both lists, not copies.**
That identity is the handoff mechanism — `fields.goals` written on the
sales call is `fields.goals` read on the kickoff call — and `docs/check.mjs`
asserts it rather than trusting it.

### The registries

| | kickoff | discovery |
|---|---|---|
| intro, goals, marketing, competitors, services, locations, readout | ✓ | ✓ |
| company | full | **trimmed** — no contact, billing, tracking, address or hours |
| brand, access | ✓ | — only meaningful after a signature |
| whynow | — | ✓ |

`whynow` captures the three things a sales call needs and a kickoff
doesn't: what prompted the call, what is broken, and who decides by when.
Everything else on the original "add" list was already in `goals`
(`win90`, `capacity`, `capacityBlock`, `horizon`).

## The copy layer

The kickoff's help text is written **to Sam, about a client who is not in
the room**. On the sales call that person is the room.

Strings that differ live in a per-module `export const COPY` map with a
`{kickoff, discovery}` pair per key, resolved by `sayer(COPY, ctx.mode)`.
Module chrome — `nav`, `title`, `lede`, `notePrompt` — is overridden by a
`discovery: {}` block on the module and resolved by `variant()`.

Three enforcement layers, because each caught what the previous missed:

1. **`COPY` completeness.** A key without a `discovery` variant fails.
   Identical variants warn unless marked `same: true`.
2. **Pinned phrases**, by hand, verbatim, **two-sided**: each must still
   appear in a kickoff render (or the pin guarding it proves nothing) and
   must appear in no discovery render.
3. **The third-person sweep.** Every visible string — text, placeholders,
   *and the module chrome app.js draws outside `render()`* — is matched
   against `\b(they|their|them|…)\b`. Legitimate third person (competitors,
   the old agency's ad accounts) is allowlisted in full, and an allowlist
   entry nothing renders any more is itself a failure.

Layer 3 exists because layer 2 missed eleven live leaks, including a
module title and an intro line telling a prospect which of *their* cities
we were "ordering today". Sweeping module chrome exists because layer 3
then missed seven page-note prompts — `app.js` renders the note box
outside `.body`, so its prompt never appears in `render()` output.

## What may not be on screen

- No deal-size arithmetic, no qualification scoring, **no fit signal of
  any kind.** A "6/10" invites you to trust it over the conversation and
  is the worst thing to have showing when you tab wrong. A check fails if
  the internal tab renders anything score-shaped.
- The internal tab carries the call notes, the gaps, and **"Before this
  can be priced"** — a list derived from which fields are still empty, so
  it empties itself as the call goes on. It is labelled *"Internal —
  don't open on the call"* and carries a lock banner.
- Print reuses the kickoff's hidden `.printdoc`: the client document
  renders on every tab, print emits that and nothing else. Eight
  internal-only phrases are pinned out of the printed document from all
  three tabs, and pinned *present* on the internal tab.

## Storage and share links

`storageKey(slug, mode)`:

- kickoff → `ss-kickoff:<slug>` — **unchanged**, which is why there is no
  migration. Every session already saved on a laptop loads from the exact
  key it was written to.
- discovery → `ss-kickoff:discovery:<slug>` — a namespace nothing has
  written to.

A slug is `[a-z0-9-]{1,40}` and cannot contain a colon, so the two can
never collide. Asserted, not reasoned about.

State carries `mode`, so a discovery link opened without
`?mode=discovery` is **refused outright** and says so with a link to open
it correctly — the same rule `v` already follows. A state with no `mode`
predates all this and is a kickoff.

`mig` stamps are shared across both modes. The known set is pinned, so a
new stamp has to be checked against the other document before it is added.

## The handoff

`js/import.js`. Payload `ss-kickoff/4` (`mode` added).

The payload is a set of **resolved views, not raw state** — going
backwards means rebuilding the working, and no two blocks rebuild alike:

| Block | Rebuilds into | Notes |
|---|---|---|
| `services` | `m.services` | selection is two-sided: scraped rows carry OFF-ness in `off`, taxonomy rows carry ON-ness in `on`. A taxonomy tick needs its `snap` entry or it vanishes on the next trade change |
| `locations` | `m.locations` | radius rows import as **`added`**, not as bare `on` ids — a `radius` row exists only while a live search holds it in transient state |
| `channels` | **`m.marketing`** | the one block not named after its module. `fields.marketing` holds only loose text |
| `access` | `m.access` | all nulls out of discovery; kept for kickoff → kickoff |

`whynow` has no kickoff screen, so it rides in `state.handoff` (preserved
by `validate()`) and renders as a read-only *"From the sales call"* card
on the kickoff intro. Replaying it into `state.m` would park answers under
an id no registry resolves — invisible, and dropped from the next export.

Skips do not carry across. `fields.company.businessName` beats
`client.name`, which is empty for a prospect with no client file.

## Verification

Everything in the master doc, plus:

1. Both registries render against both clients; `check.mjs` walks both.
2. Copy: the three layers above, each mutation-tested.
3. Company: eighteen field keys pinned absent from discovery **and
   present on the kickoff**; open items suppressed in discovery.
4. Storage namespacing and the wrong-mode refusal.
5. The handoff, asserted **by id, never by display name** — including a
   trade-swap after import to prove `snap` survived, and a radius city
   imported with no search running.
6. Print boundary, both directions, from all three tabs.

Three defects surfaced only under mutation testing, each having passed a
green run first: `locations()` threw on any session with **no** exclusions;
and both the service- and city-order assertions were vacuous, the latter
passing by accident because the universe lists scraped cities before
radius ones. A check that still passes when you break the thing it tests
is worse than no check.

## Known gaps

- **The offer tab is deliberately unfinished.** The internal tab carries
  open items, notes, build order and the unknowns list. What Sam actually
  wants in front of him when he sits down to price — implied economics
  from their own numbers, the lead-with list, their verbatim phrases — is
  his call and has not been designed. That is the next piece of work.
