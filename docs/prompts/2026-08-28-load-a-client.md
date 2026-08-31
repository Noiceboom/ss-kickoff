# Load a client into the kickoff doc

You are working in `~/GitHub/ss-kickoff`, the Service Scalers kickoff
document. It is live at https://noiceboom.github.io/ss-kickoff/ and in
daily use.

Sam has client information — services, service areas, and whatever else is
already known — and wants it in the document **before** the kickoff call, so
the call is confirming and filling gaps rather than typing from scratch.

---

## Read this before you fork anything

Sam's instinct was "make a copy, don't touch the master". The safety he
wants is real. The copy is not the way to get it, and you should say so
before doing it.

**Every client already has their own isolated document.** The URL carries a
slug: `?c=acme-hvac` loads `clients/acme-hvac.json`, and nothing about that
file changes what any other client sees. Adding one is additive — no
existing document, session or share link is touched. That is the mechanism
this whole thing was built around; there are already two client files
sitting in `clients/` doing exactly this.

A fork, by contrast, costs him every fix from here on. Several shipped in
the last week alone, some of them silent-data-loss bugs. A forked copy
keeps all of those bugs for ever and nobody notices, because it still
loads.

So: **default to adding a client file.** Only fork if Sam, having been told
the above, still wants one — and if he does, follow the last section.

---

## Orient first

| File | Why |
|---|---|
| `clients/bfp-kc.json` | A real, complete client file. Copy its shape |
| `clients/template.json` | The fallback for a client with no scrape yet |
| `js/app.js` → `sanitizeClient()` | The only fields a client file may carry. Anything else is silently dropped |
| `js/state.js` → `serviceUniverse()`, `locationUniverse()` | How a client file becomes ticked boxes on screen |
| `js/import.js` | How known ANSWERS get loaded, which a client file cannot do |
| `docs/specs/2026-08-25-master-kickoff-design.md` | Why the rules below exist |

Run `node docs/check.mjs` before you touch anything, so you know what green
looks like.

---

## The two routes, and what each one carries

**A client file carries WHO THEY ARE AND WHAT THEY SELL.** Nothing else —
`sanitizeClient()` drops anything not on this list:

```json
{
  "slug": "acme-hvac",
  "client": { "name": "Acme HVAC", "market": "Tulsa",
              "website": "https://acmehvac.com", "trade": "HVAC" },
  "source": { "scrapedAt": "2026-08-28", "from": "Services menu + areas-we-serve footer",
              "method": "manual" },
  "services":  [ { "id": "ac-repair", "name": "AC Repair",
                   "subs": ["AC Repair", "Emergency AC"], "hasPage": true, "verify": null } ],
  "locations": [ { "id": "broken-arrow", "name": "Broken Arrow", "state": "OK",
                   "hasPage": false, "verify": null } ]
}
```

Everything in `services` and `locations` arrives **pre-ticked**, which is
the point — and also why a wrong entry is worse than a missing one. A
service they do not offer, ticked by default, gets confirmed by a client
who is being agreeable and ends up in the build.

**Known ANSWERS need a payload instead.** Revenue, contacts, budgets,
channel ratings, notes — none of that fits a client file. Build an
`ss-kickoff/5` payload and load it through the import on the intro screen
("load a sales call"). A hand-written one works; it has been tested. Read
`SCHEMA` and `buildPayload()` in `js/export.js` for the exact shape, and
`js/import.js` for what gets read back. The parts that matter:

- `fields.<moduleId>.<stateKey>` — keyed on STATE keys, never on the words
  on screen. `revNow`, not "Revenue per month, now".
- `services.items[]` and `locations.items[]` — the resolved lists, with
  `selected`, `priority` and `rank`.
- `channels[]` rebuilds into `marketing`, not into a module called
  channels. Every other block shares its name with the module it targets;
  that one does not, and it is the block carrying the most content.
- Anything in `STRUCTURAL` (js/export.js) is deliberately absent from
  `fields` and must come from its own block.

Use the client file for services and cities. Use a payload only if Sam has
answers worth pre-loading; do not invent one to look thorough.

---

## This repository is public

`github.com/Noiceboom/ss-kickoff` is public, and GitHub Pages serves
everything in it. `clients/bfp-kc.json` answers a plain `curl` with a 200
today. Anything you commit is world-readable, immediately, with no login.

That is fine for a client file: name, website, trade, the services and
cities off their own site. It is all already published by the client.
Check that assumption holds for this one before you commit — an unlaunched
site, a rebrand, or a market they have not announced is not yours to put
online.

**It is not fine for a payload.** Revenue, close rates, budgets, contact
names, phone numbers and email addresses are the client's confidential
business. Committing that to `clients/` publishes their financials at a
guessable URL.

So a payload never enters the repository:

- Write it somewhere outside the working tree — Sam's Desktop, or the
  scratchpad — and hand him the path.
- He loads it through the import on the intro screen. It goes into his
  browser, not into git.
- If you must stage it inside the tree to test, add the filename to
  `.gitignore` FIRST, and check `git status` shows it ignored before you
  commit anything at all.
- Never `git add -A` while such a file exists untracked.

Same rule for a transcript, a read-out, or anything else with a real
person's contact details in it.

## The rules that will bite you

1. **Ids are permanent.** They key notes, priorities and rank order. An id
   regenerated from a name later orphans everything attached to it. Lower
   case, hyphens, no trade prefix — `ac-repair`, not `hvac:ac-repair`. The
   trade-scoped form is for taxonomy services the client file does not
   name; `scopedId()` handles that on its own.
2. **`state` on a location is load-bearing.** Kansas City MO and Kansas
   City KS are different cities and the radius search dedupes on name plus
   state. Always set it.
3. **Ids must be unique within a file**, and `name` is what appears on
   screen.
4. **Never invent a service or a city.** If the site is ambiguous, include
   it with a `verify` string saying what is uncertain — "listed under
   Commercial but no page" — and it surfaces as something to confirm on the
   call instead of a silent wrong tick.
5. **`hasPage`** means they already have a page for it. Get it right or
   leave it `false`; it feeds what gets recommended.
6. **`trade`** should match a trade in `js/trades/index.js` so the right
   service taxonomy loads. Check `resolveTrade()`.
7. **Do not touch anything outside `clients/`.** No module edits, no CSS,
   no build bump. If you think a code change is needed, stop and say so.

---

## Verify before you claim it works

`docs/check.mjs` reads only `clients/bfp-kc.json` and `clients/template.json`.
**It will not check the file you just wrote.** Do not let a green run stand
in for having tested anything.

Verify it yourself:

1. `node docs/check.mjs` still passes — proves you broke nothing.
2. Load the file the way the app does and confirm what actually comes out:
   the service and location counts you expect, no duplicate ids, every
   location carrying a state, and the trade resolving.
3. Serve it (`python3 -m http.server` — ES modules and `fetch` need a real
   origin, `file://` will not work) and open `?c=<slug>`. Check the header
   shows the right client, the Services screen opens with the right boxes
   already ticked, and Cities likewise.
4. Count what is on screen against the source. A file that loads is not a
   file that is right.

Report what you actually saw — counts, not adjectives.

---

## If Sam still wants a standalone copy

Only after telling him what it costs.

1. New GitHub repo, e.g. `ss-kickoff-acme`. Copy the working tree, keep the
   history if you can (`git clone` then re-point the remote).
2. Enable Pages on `main`. Keep `.nojekyll` — without it, paths starting
   with an underscore 404 in production.
3. Nothing in the code assumes a repo name; asset paths resolve from
   `import.meta.url`, so `/discovery/` and the city data keep working.
4. **Change the storage keys, or the fork will eat the master's sessions.**
   Browser storage is scoped to an ORIGIN, not to a path, and every repo on
   this account is served from the same one — `noiceboom.github.io`. So
   `/ss-kickoff/` and `/ss-kickoff-acme/` share localStorage and IndexedDB
   exactly. Today both would write `ss-kickoff:acme` and read each other's
   work back, and each would think the other's autosave was its own.

   In the fork, before it is served to anyone:
   - `KEY_PREFIX` in `js/state.js` — currently `"ss-kickoff:"`
   - `DB_NAME` in `js/assets.js` — currently `"ss-kickoff-assets"`

   Give both a suffix naming the fork. Then open the master and the fork
   side by side on the same slug, type something different into each, and
   reload both: each must still show its own answer. Do not skip that —
   it is the failure this step exists to prevent, and it is invisible until
   somebody loses a call's worth of work.
5. Write down, in that repo's README, the build it was forked at and the
   fact that it no longer receives fixes. Someone will need to know why it
   behaves differently in six months.
6. Tell Sam the two URLs and which one is which. Two documents that look
   identical and behave differently is its own kind of bug.
