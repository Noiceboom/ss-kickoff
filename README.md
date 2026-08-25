# Service Scalers — Master Kickoff Doc

The document every client kickoff runs through. Confirm who they are, where they're
trying to get to, who they're up against, then rank their services and cities into a
build order — live, on the call.

**Live:** https://noiceboom.github.io/ss-kickoff/
**A client:** https://noiceboom.github.io/ss-kickoff/?c=bfp-kc

---

## Running a kickoff

1. Open the tool with the client's slug: `?c=acme-hvac`
2. Work through the screens while you talk. **Nothing is required** — hit
   `⊘ Didn't cover this` on anything you skip and it lands in the readout as an open
   item rather than reading as blank.
3. On the last screen, copy the client recap, copy the internal brief, and download
   the JSON.

Everything autosaves to this browser as you type, per client. Closing the tab is safe.

## Adding a client

Drop a file in `clients/<slug>.json` matching `clients/template.json`. Slugs must be
lowercase letters, numbers and hyphens.

```jsonc
{
  "slug": "acme-hvac",
  "client": { "name": "Acme HVAC", "market": "Austin", "website": "https://…", "trade": "HVAC" },
  "source": { "scrapedAt": "2026-08-25", "from": "site menu + footer", "method": "manual" },
  "services":  [ { "id": "ac-repair", "name": "AC Repair",
                   "subs": ["Emergency AC Repair"], "hasPage": true, "verify": null } ],
  "locations": [ { "id": "round-rock", "name": "Round Rock", "state": "TX",
                   "hasPage": false, "verify": "Confirm they cover this" } ]
}
```

- `verify` — any non-null string raises a gold VERIFY badge and becomes an open item.
- `hasPage` — an existing page. A rewrite, not a build.
- `id` — **stable forever.** Renaming one orphans that item's notes, drops and rank position.

The schema is closed and the repo is public: **no phone numbers, emails, addresses or
contact names in these files.** Everything committed must already be public on the
client's own website. Eventually Service Scalers OS generates this file automatically
when a client is created, including the site scrape.

## Two things to know

**The share link is confidential.** It carries revenue, targets, budgets and competitor
notes in the URL fragment. Fragments are never sent to a server, but the full link is
stored wherever you paste it — Slack keeps it searchable workspace-wide and in
compliance exports. Internal DMs only. For anything durable, use the JSON export.

**Never type a credential into this doc.** The access screen tracks who owns an account
and whether access was granted. Its inputs are deliberately constrained so there's no
box to put a password in.

## Development

```bash
python3 -m http.server 8792 --directory .
```

It needs a served origin — `fetch()` of the client JSON won't work from `file://`.

```
index.html              shell — header, nav, mount, CSP
css/kickoff.css         design-guide tokens + components
js/state.js             state, autosave, URL-fragment codec
js/ui.js                render helpers + the field kit
js/listgrid.js          the confirm grid shared by 05 and 07
js/rank.js              drag-to-rank engine shared by 06 and 08
js/app.js               boot, routing, ALL event delegation
js/modules/index.js     the registry — sequence lives here and nowhere else
js/modules/00-…-12-…    one file per screen
clients/*.json          client data
docs/specs/             the design spec
```

Adding or reordering a screen is a one-line change in `js/modules/index.js`. Module
`id` values are persisted in saved sessions and share links — don't rename them.

Full contract, state model and security boundary:
[`docs/specs/2026-08-25-master-kickoff-design.md`](docs/specs/2026-08-25-master-kickoff-design.md).

Branding follows the [Service Scalers design guide](https://noiceboom.github.io/service-scalers-design-guide/).

## Checking your work

```bash
node docs/check.mjs
```

Imports every module, renders each against both a populated and an empty client,
and asserts the contract: pure `render`, escaped output, legal `status`, a
readout-shaped `summary`, order-slot preservation, and the fragment roundtrip.
It also feeds a hostile payload through every field and fails if live markup
reaches the output.

`node --check` is **not** a gate for these files — it exits 0 on ES modules with
real syntax errors. Use `check.mjs`.
