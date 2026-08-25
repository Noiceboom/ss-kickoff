// ============================================================
// check.mjs — headless contract check for every module
// ============================================================
//
//   node docs/check.mjs
//
// node --check is NOT a gate for ES modules — it exits 0 on files with
// real syntax errors. This actually imports each module and renders it
// against both a populated and an empty client, then asserts the
// contract: pure render, escaped output, no state mutation, and a
// summary shaped the readout can consume.

import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const url = (p) => pathToFileURL(path.join(ROOT, p)).href;

// Minimal DOM/browser surface the modules may touch at import time.
globalThis.window = { console };
globalThis.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
};
globalThis.location = { hash: "", search: "", pathname: "/", origin: "http://x" };

const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const warn = (m) => warns.push(m);

/* ── load ─────────────────────────────────────────────── */

const S = await import(url("js/state.js"));
const MODULES = (await import(url("js/modules/index.js"))).default;

// Fingerprint the trade taxonomies before anything renders. They are
// module-level constants shared by every client, so if any code path in
// this file writes to one, the comparison at the end catches it — a
// locally-scoped check would silently snapshot an already-polluted array.
const TRADES_BEFORE = JSON.stringify(
  (await import(url("js/trades/index.js"))).TRADES.map((t) => ({
    id: t.id, services: t.services.map((x) => ({ id: x.id, label: x.label, subs: x.subs })),
  }))
);

const bfp = JSON.parse(readFileSync(path.join(ROOT, "clients/bfp-kc.json"), "utf8"));
const tpl = JSON.parse(readFileSync(path.join(ROOT, "clients/template.json"), "utf8"));

/* ── registry sanity ──────────────────────────────────── */

const files = readdirSync(path.join(ROOT, "js/modules"))
  .filter((f) => /^\d\d-/.test(f)).sort();
if (files.length !== MODULES.length) {
  fail(`registry lists ${MODULES.length} modules but ${files.length} module files exist`);
}

const ids = new Set();
for (const m of MODULES) {
  if (!m || typeof m !== "object") { fail("registry contains a non-module"); continue; }
  for (const k of ["id", "nav", "title"]) {
    if (typeof m[k] !== "string" || !m[k]) fail(`${m.id || "?"}: missing ${k}`);
  }
  if (typeof m.render !== "function") fail(`${m.id}: render is not a function`);
  if (typeof m.status !== "function") fail(`${m.id}: status is not a function`);
  if (ids.has(m.id)) fail(`duplicate module id "${m.id}"`);
  ids.add(m.id);
}

/* ── render against both clients ──────────────────────── */

function ctxFor(client, state) {
  return { state, client, transient: {}, slug: client.slug, mismatch: [], modules: MODULES };
}

// A hostile payload in every free-text position — nothing may reach the
// output un-escaped.
const XSS = '"><img src=x onerror=alert(1)>';

for (const [label, client] of [["bfp-kc", bfp], ["template", tpl]]) {
  for (const m of MODULES) {
    const state = S.fresh();
    const before = JSON.stringify(state);
    let html;

    try {
      html = m.render(ctxFor(client, state));
    } catch (e) {
      fail(`${m.id} [${label}]: render threw — ${e.message}`);
      continue;
    }

    if (typeof html !== "string") { fail(`${m.id} [${label}]: render returned ${typeof html}`); continue; }
    if (!html.trim()) fail(`${m.id} [${label}]: render returned empty string`);

    // render must be pure — a module that writes to state corrupts autosave
    if (JSON.stringify(state) !== before) {
      warn(`${m.id} [${label}]: render mutated state (slot() creates an empty branch — check it is only that)`);
    }

    // status must be a legal value and never "skipped"
    let st;
    try { st = m.status(ctxFor(client, state)); }
    catch (e) { fail(`${m.id} [${label}]: status threw — ${e.message}`); }
    if (st === "skipped") fail(`${m.id}: status() returned "skipped" — app.js owns that`);
    if (st && !["empty", "partial", "done"].includes(st)) fail(`${m.id}: bad status "${st}"`);

    // summary must be null or the documented shape
    if (m.summary) {
      let sum;
      try { sum = m.summary(ctxFor(client, state)); }
      catch (e) { fail(`${m.id} [${label}]: summary threw — ${e.message}`); }
      if (sum != null) {
        if (sum.rows && !Array.isArray(sum.rows)) fail(`${m.id}: summary.rows is not an array`);
        if (sum.rows) for (const r of sum.rows) {
          if (!Array.isArray(r) || r.length !== 2) fail(`${m.id}: summary.rows entry is not [label, value]`);
        }
        if (sum.table && (!Array.isArray(sum.table.head) || !Array.isArray(sum.table.body))) {
          fail(`${m.id}: summary.table must be {head:[], body:[[]]}`);
        }
        if (sum.open) for (const o of sum.open) {
          if (!o || typeof o.what !== "string") fail(`${m.id}: summary.open entry needs a string "what"`);
        }
      }
    }
  }
}

/* ── XSS: hostile state must not produce live markup ──── */

for (const m of MODULES) {
  const state = S.fresh();
  // poison every module slot with hostile strings, rows and arrays
  state.m[m.id] = {
    legalName: XSS, name: XSS, note: XSS, colors: XSS, owner_gbp: XSS,
    channels: [{ channel: XSS, spend: XSS, who: XSS, working: XSS }],
    competitors: [{ name: XSS, domain: XSS, why: XSS, threat: XSS }],
    usps: [{ claim: XSS, proof: XSS }],
    rows: [{ a: XSS }],
  };
  state.notes["services:drains"] = XSS;
  state.notes["locations:kansas-city"] = XSS;

  const poisoned = JSON.parse(JSON.stringify(bfp));
  poisoned.client.name = XSS;
  poisoned.services[0].name = XSS;
  poisoned.services[0].verify = XSS;
  poisoned.locations[0].name = XSS;
  poisoned.locations[0].verify = XSS;

  let html = "";
  try { html = m.render(ctxFor(poisoned, state)); }
  catch (e) { fail(`${m.id}: render threw on hostile input — ${e.message}`); continue; }

  if (/<img\s+src=x\s+onerror/i.test(html)) {
    fail(`${m.id}: UNESCAPED hostile input reached the output — XSS`);
  }
}

/* ── state model ──────────────────────────────────────── */

{
  const st = S.fresh();
  // toggling an item off then on must not move it in the ranking
  S.applyOrder(st, "services", bfp.services, bfp.services.map((s) => s.id));
  const target = bfp.services[7].id;
  S.toggleItem(st, "services", target);              // off
  const afterOff = S.onList(st, "services", bfp.services).map((x) => x.id);
  S.toggleItem(st, "services", target);              // back on
  const afterOn = S.onList(st, "services", bfp.services).map((x) => x.id);
  if (afterOn.indexOf(target) !== 7) {
    fail(`order slot not preserved: "${target}" returned at ${afterOn.indexOf(target)}, expected 7`);
  }
  if (afterOff.length !== afterOn.length - 1) fail("toggleItem did not change the ON count");
}

{
  // ids absent from the client JSON must be preserved, never pruned
  const st = S.fresh();
  S.toggleItem(st, "services", "a-service-that-no-longer-exists");
  const merged = S.mergedList(st, "services", bfp.services);
  if (merged.some((x) => x.id === "a-service-that-no-longer-exists")) {
    fail("mergedList resurrected an unknown id as a real item");
  }
  if (!st.m.services.off.includes("a-service-that-no-longer-exists")) {
    fail("unknown id was pruned from state — data loss on a re-scrape");
  }
}

{
  // fragment roundtrip, including free text from the form modules
  const st = S.fresh();
  st.step = "goals";
  st.m.company = { legalName: "Acme & Sons <LLC>", phone: "(816) 555-0142" };
  st.m.goals = { targetRevenue: "250000" };
  st.skipped = ["competitors"];
  st.notes["services:drains"] = "Biggest ticket — José runs it";
  const back = S.validate(S.decode(S.encode(st)));
  if (!back) fail("fragment roundtrip returned null");
  else if (JSON.stringify(back) !== JSON.stringify(st)) fail("fragment roundtrip lost or altered data");

  // a version mismatch must be refused, not half-applied
  const bad = JSON.parse(JSON.stringify(st));
  bad.v = 999;
  if (S.validate(bad) !== null) fail("validate accepted an unknown state version");
  if (S.validate({ hacked: true }) !== null) fail("validate accepted a non-state object");
}

{
  // slot() is read-only and returns a FROZEN object — every write path
  // must go through ensure(). This is the bug class that silently ate a
  // whole module's rows in the browser.
  const st = S.fresh();
  const readonly = S.slot(st, "marketing");
  if (!Object.isFrozen(readonly)) fail("slot() on a missing branch should return a frozen object");
  if (st.m.marketing) fail("slot() created a branch — render() would no longer be pure");

  try {
    S.ensure(st, "marketing").channels = [{ channel: "Google Ads" }];
  } catch (e) {
    fail("ensure() could not be written to: " + e.message);
  }
  if (!st.m.marketing || !st.m.marketing.channels) fail("ensure() did not persist a write");

  // getRows/setRows roundtrip, including the empty-row prune
  S.setRows(st, "competitors", "list", [{ name: "Roto-Rooter" }, { name: "" }]);
  const got = S.getRows(st, "competitors", "list");
  if (got.length !== 1) fail(`setRows should drop all-blank rows, kept ${got.length}`);
  S.setRows(st, "competitors", "list", [{ name: "" }]);
  if (S.getRows(st, "competitors", "list").length) fail("setRows did not clear an all-blank set");

  // clearing a field must not leave an empty branch behind
  S.setField(st, "goals", "revNow", "4200000");
  S.setField(st, "goals", "revNow", "");
  if (st.m.goals) fail("clearing the last field left an empty module branch");
}

{
  // The readout's export builders — the JSON one broke on a screen that
  // carried a page note but no summary(), a shape nothing else produces.
  const readout = MODULES.find((m) => m.id === "readout");
  if (!readout || typeof readout.exports !== "function") {
    fail("readout module is missing its exports() API");
  } else {
    const st = S.fresh();
    st.m.company = { businessName: "Acme Plumbing", contactName: "Mike" };
    st.skipped = ["marketing"];
    // note-only screens, both live and skipped
    st.notes["brand:_page"] = 'Calls himself "the guy who shows up"';
    st.notes["marketing:_page"] = "Didn't cover — old agency still owns the ad account";
    st.notes["intro:_page"] = "Found us through a podcast";
    st.notes["services:drains"] = "Highest ticket work";

    const api = readout.exports(ctxFor(bfp, st));
    for (const name of ["recap", "brief", "json", "csv"]) {
      if (typeof api[name] !== "function") { fail(`exports().${name} missing`); continue; }
      let out;
      try { out = api[name](); }
      catch (e) { fail(`exports().${name}() threw — ${e.message}`); continue; }
      if (typeof out !== "string" || !out.trim()) fail(`exports().${name}() returned nothing`);
    }

    // Everything below re-invokes the builders, so it must not be able to
    // crash the run — a thrown export has to surface as a FAIL line, not
    // kill the process before the report prints.
    try {
      // page notes belong in the internal brief and the exports, never the
      // client-facing recap
      const recap = api.recap();
      const brief = api.brief();
      for (const secret of ["the guy who shows up", "old agency still owns"]) {
        if (recap.includes(secret)) fail(`client recap leaked an internal note: "${secret}"`);
        if (!brief.includes(secret)) fail(`internal brief is missing a note: "${secret}"`);
      }

      const j = JSON.parse(api.json());
      if (!j.sections.brand || j.sections.brand.note !== st.notes["brand:_page"]) {
        fail("JSON export dropped a note-only section");
      }
      if (!j.sections.marketing || !j.sections.marketing.skipped || !j.sections.marketing.note) {
        fail("JSON export dropped the note on a skipped section");
      }

      const csv = api.csv();
      if (!csv.includes("the guy who shows up")) fail("CSV export dropped a page note");
      if (csv.split('"').length % 2 !== 1) fail("CSV export has unbalanced quoting");
    } catch (e) {
      fail(`export assertions threw — ${e.message}`);
    }
  }
}

{
  // hasWork() gates whether a share link may replace a local session.
  // A notes-only session is the one that must never be silently destroyed.
  if (S.hasWork(S.fresh())) fail("hasWork() called a blank session 'work'");
  if (S.hasWork(null)) fail("hasWork(null) should be false");

  const notesOnly = S.fresh();
  notesOnly.notes["competitors:_page"] = "Roto-Rooter came up three times";
  if (!S.hasWork(notesOnly)) fail("hasWork() missed a notes-only session — a share link would erase it");

  const skipOnly = S.fresh();
  skipOnly.skipped = ["marketing"];
  if (!S.hasWork(skipOnly)) fail("hasWork() missed a skip-only session");

  const orderOnly = S.fresh();
  orderOnly.order.services = ["drains", "toilets"];
  if (!S.hasWork(orderOnly)) fail("hasWork() missed a reorder-only session");

  const fieldOnly = S.fresh();
  fieldOnly.m.company = { contactName: "Mike" };
  if (!S.hasWork(fieldOnly)) fail("hasWork() missed a field-only session");
}

{
  // statusWithNote is the single source of the note bump — app.js and the
  // readout both call it, and they must not disagree about a noted screen.
  const st = S.fresh();
  st.notes["brand:_page"] = "Calls himself the guy who shows up";
  if (S.statusWithNote(st, "brand", "empty") !== "partial") {
    fail("statusWithNote() did not lift a noted screen off 'empty'");
  }
  if (S.statusWithNote(st, "brand", "done") !== "done") {
    fail("statusWithNote() downgraded a completed screen");
  }
  if (S.statusWithNote(st, "goals", "empty") !== "empty") {
    fail("statusWithNote() promoted a screen with no note");
  }

  // and the readout must agree — a noted screen is not "Nothing captured"
  const readout = MODULES.find((m) => m.id === "readout");
  const json = JSON.parse(readout.exports(ctxFor(bfp, st)).json());
  const blanked = (json.openItems || []).find(
    (o) => o.kind === "empty" && o.what === "Brand & proof");
  if (blanked) fail("readout reported a noted screen as blank — status rule drifted");
}

{
  // A lone figure must say which end of the span it is, or the brief reads
  // a target as today's revenue.
  const goals = MODULES.find((m) => m.id === "goals");
  const only = (key, val) => {
    const st = S.fresh();
    st.m.goals = { [key]: val };
    const sum = goals.summary(ctxFor(bfp, st));
    const row = (sum.rows || []).find((r) => r[0] === "Revenue / mo");
    return row ? row[1] : "";
  };
  if (!/today/i.test(only("revNow", "180000"))) fail("a revenue-only summary does not say it is today's figure");
  if (!/target/i.test(only("revTarget", "300000"))) fail("a target-only summary does not say it is the target");

  const both = S.fresh();
  both.m.goals = { revNow: "180000", revTarget: "300000" };
  const spanRow = (goals.summary(ctxFor(bfp, both)).rows || []).find((r) => r[0] === "Revenue / mo");
  if (!spanRow || spanRow[1].indexOf("→") < 0) fail("a full span lost its arrow");

  // derive() must stop producing a line once its inputs are incomplete —
  // app.js clears the node, but only for keys derive() omits.
  const full = S.fresh();
  full.m.goals = { revNow: "180000", revTarget: "300000", avgTicket: "1400", closeRate: "35" };
  if (!goals.derive(ctxFor(bfp, full))["goals:gap"]) fail("derive() produced no gap line from complete inputs");

  const partial = S.fresh();
  partial.m.goals = { revNow: "180000" };
  if ("goals:gap" in goals.derive(ctxFor(bfp, partial))) {
    fail("derive() still emits a gap line with no target — the stale line would never clear");
  }
  if (Object.keys(goals.derive(ctxFor(bfp, S.fresh()))).length) {
    fail("derive() emitted lines from an empty state");
  }

  // slider values must survive as plain numbers, whatever was typed
  const u = await import(url("js/ui.js"));
  for (const [typed, want] of [["$180,000", 180000], ["180000", 180000], ["1,400", 1400]]) {
    const parsed = Number(String(typed).replace(/[^0-9.\-]/g, ""));
    if (parsed !== want) fail(`typed slider value "${typed}" parses to ${parsed}, expected ${want}`);
  }
  if (u.formatSlider(u.snapNice(1437, "money"), "money") !== "$1,400") {
    fail("slider snap/format round-trip changed shape");
  }
}

{
  // Cut fields must not linger in saved sessions or share links.
  const stale = S.fresh();
  stale.m.goals = { revNow: "180000", cadence: "weekly", fireUs: "Three months of nothing", whoElse: "His wife" };
  const cleaned = S.validate(JSON.parse(JSON.stringify(stale)));
  for (const gone of ["cadence", "fireUs", "whoElse", "scoreboard"]) {
    if (cleaned.m.goals && cleaned.m.goals[gone] !== undefined) {
      fail(`removed field "${gone}" survived migration — it would ride every share link`);
    }
  }
  if (!cleaned.m.goals || cleaned.m.goals.revNow !== "180000") fail("migration dropped a live field");

  // a module left with nothing after pruning should not keep an empty branch
  const onlyStale = S.fresh();
  onlyStale.m.goals = { fireUs: "x" };
  if (S.validate(JSON.parse(JSON.stringify(onlyStale))).m.goals) {
    fail("pruning left an empty module branch behind");
  }
}

{
  // Legacy marketing rows must survive the move to the pick grid: known
  // channels become tiles, unknown ones keep their name in the free text,
  // and nothing appears in both places.
  const legacy = S.fresh();
  legacy.m.marketing = {
    agency: "Bright Local",
    channels: [
      { channel: "Google Ads", spend: "$4,000", who: "The agency", working: "Mixed" },
      { channel: "The radio spot on 98.1", spend: "$600", who: "Owner", working: "Working" },
    ],
  };
  const mig = S.validate(JSON.parse(JSON.stringify(legacy))).m.marketing;
  if (mig.channels !== undefined) fail("legacy channel rows survived migration");
  if (mig.agency !== "Bright Local") fail("migration dropped a sibling field");
  if (!Array.isArray(mig.chan) || mig.chan.indexOf("google-ads") < 0) {
    fail("a known legacy channel did not become a selected tile");
  }
  if (mig["rate_google-ads"] !== "mixed") fail("legacy verdict was not carried across");
  if (!/98\.1/.test(mig.otherChan || "")) fail("an unknown legacy channel was dropped entirely");
  if (/Google Ads/.test(mig.otherChan || "")) fail("a matched channel was duplicated into the free text");

  // Short labels from the old channel list must still resolve, or every
  // legacy LSA / GBP / Meta / Angi row silently becomes free text.
  const chx = await import(url("js/channels.js"));
  for (const [name, want] of [
    ["LSA", "local-services-ads-lsa"],
    ["GBP", "google-business-profile-maps"],
    ["Meta", "meta-facebook-instagram"],
    ["Angi", "angi-angi-leads"],
    ["Google Ads", "google-ads"],
    ["SEO", "seo"],
  ]) {
    if (chx.resolveChannel(name) !== want) {
      fail(`legacy channel "${name}" resolved to ${chx.resolveChannel(name)}, expected ${want}`);
    }
  }
  for (const name of ["Truck wraps", "Radio/TV", ""]) {
    if (chx.resolveChannel(name)) fail(`"${name}" should not resolve to a built-in channel`);
  }

  // a verdict on an unmatched channel has nowhere to live but the free text
  const withVerdict = S.fresh();
  withVerdict.m.marketing = { channels: [{ channel: "Truck wraps", spend: "$300", working: "Working" }] };
  const wv = S.validate(JSON.parse(JSON.stringify(withVerdict))).m.marketing;
  if (!/was working/i.test(wv.otherChan || "")) fail("migration dropped the verdict on a custom channel");

  // detail for a deselected channel is dropped on load, not carried forever
  const orphan = S.fresh();
  orphan.m.marketing = {
    chan: ["google-ads"], "note_google-ads": "keep", "rate_yelp": "waste", "note_yelp": "drop",
  };
  const op = S.validate(JSON.parse(JSON.stringify(orphan))).m.marketing;
  if (op["note_google-ads"] !== "keep") fail("pruning removed detail for a SELECTED channel");
  if (op["rate_yelp"] !== undefined || op["note_yelp"] !== undefined) {
    fail("detail for a deselected channel survived load — it would ride every share link");
  }

  // A migrated custom channel must stay ONE channel. The detail text
  // contains spend and owner, and a comma separator used to split it into
  // several fictional rows in the readout.
  const mk0 = MODULES.find((m) => m.id === "marketing");
  const oneRow = S.fresh();
  oneRow.m.marketing = { channels: [{ channel: "Truck wraps", spend: "$300", who: "Owner", working: "Working" }] };
  const migrated = S.validate(JSON.parse(JSON.stringify(oneRow)));
  const tbl = mk0.summary(ctxFor(bfp, migrated)).table;
  const custom = (tbl ? tbl.body : []).filter((r) => r[1] === "Other");
  if (custom.length !== 1) {
    fail(`a migrated custom channel became ${custom.length} rows in the readout, expected 1`);
  }
  if (custom[0] && !/^Truck wraps/.test(custom[0][0])) {
    fail(`migrated custom channel name is mangled: ${JSON.stringify(custom[0] && custom[0][0])}`);
  }

  // and a comma someone genuinely types stays part of the name
  const typed = S.fresh();
  typed.m.marketing = { otherChan: "Radio, mornings only\nTruck wraps" };
  const typedTbl = mk0.summary(ctxFor(bfp, typed)).table;
  const names = (typedTbl ? typedTbl.body : []).map((r) => r[0]);
  if (names.length !== 2 || names[0] !== "Radio, mornings only") {
    fail(`free-text channels split wrongly: ${JSON.stringify(names)}`);
  }

  // The placeholder has to demonstrate the format the box parses —
  // a comma-separated example teaches input that no longer splits.
  const mHtml = mk0.render(ctxFor(bfp, S.fresh()));
  const ph = /data-f="marketing\|otherChan"[^>]*placeholder="([^"]*)"/.exec(mHtml);
  if (!ph) fail("could not find the other-channels placeholder");
  else {
    if (ph[1].indexOf("\n") < 0) fail("other-channels placeholder does not show one per line");
    if (/,/.test(ph[1])) fail("other-channels placeholder still demonstrates comma separation");
  }

  // channels typed in the free-text box count as answering the question
  const mk = MODULES.find((m) => m.id === "marketing");
  const customOnly = S.fresh();
  customOnly.m.marketing = { otherChan: "Truck wraps", worked: "word of mouth", burned: "an agency" };
  if (mk.status(ctxFor(bfp, customOnly)) !== "done") {
    fail("a screen with only custom channels does not read as captured");
  }

  // channels.js is the single source — module 03 and state.js must agree
  const ch = await import(url("js/channels.js"));
  if (ch.ALL.length !== 34) fail(`channel list is ${ch.ALL.length}, expected 34`);
  if (new Set(ch.ALL.map((c) => c.id)).size !== ch.ALL.length) fail("duplicate channel id");
  if (!ch.isKnownChannel("google-ads")) fail("isKnownChannel() missed a real channel");
  if (ch.isKnownChannel("the-radio-spot-on-98-1")) fail("isKnownChannel() accepted an invented id");
}

{
  // Trade taxonomies: every file must be usable as a service list.
  const T = await import(url("js/trades/index.js"));
  if (T.TRADES.length < 10) fail(`only ${T.TRADES.length} trades registered`);
  const tradeIds = new Set();
  for (const t of T.TRADES) {
    if (!t.id || !t.label) { fail("a trade is missing id or label"); continue; }
    if (tradeIds.has(t.id)) fail(`duplicate trade id "${t.id}"`);
    tradeIds.add(t.id);
    if (!Array.isArray(t.services) || t.services.length < 15) {
      fail(`${t.id} has ${t.services ? t.services.length : 0} services, expected 15+`);
    }
    const ids = (t.services || []).map((x) => x.id);
    if (new Set(ids).size !== ids.length) fail(`${t.id} has duplicate service ids`);
    for (const svc of t.services || []) {
      if (!svc.id || !svc.label) fail(`${t.id} has a service missing id or label`);
      if (!Array.isArray(svc.subs)) fail(`${t.id}/${svc.id} subs is not an array`);
      if (!/^[a-z0-9-]+$/.test(svc.id)) fail(`${t.id}/${svc.id} is not a clean slug`);
    }
  }
  if (T.resolveTrade("Plumbing") !== "plumbing") fail("resolveTrade missed an exact label");
  if (T.resolveTrade("heating & air") !== "hvac") fail("resolveTrade missed an alias");
  if (T.resolveTrade("not a trade")) fail("resolveTrade invented a match");

  // The scrape must pre-tick, and the taxonomy must not duplicate it.
  const st = S.fresh();
  st.m.services = { trades: ["plumbing"] };
  const plumbing = T.getTrade("plumbing").services;
  const universe = S.serviceUniverse(st, bfp, [T.getTrade("plumbing")]);
  const uIds = universe.map((x) => x.id);
  if (new Set(uIds).size !== uIds.length) fail("serviceUniverse produced duplicate ids");
  const ticked = universe.filter((x) => x.on);
  if (ticked.length !== bfp.services.length) {
    fail(`pre-ticked ${ticked.length}, expected the ${bfp.services.length} scraped services`);
  }
  if (universe.filter((x) => x.source === "trade").some((x) => x.on)) {
    fail("a taxonomy-only service was ticked by default");
  }

  // priority buckets and build order
  S.setPriority(st, "drains", "high");
  S.setPriority(st, "toilets", "low");
  S.setPriority(st, "sewers", "high");
  const buckets = S.servicesByPriority(st, bfp, [T.getTrade("plumbing")]);
  if (buckets.high.length !== 2 || buckets.low.length !== 1) fail("priority buckets did not fill correctly");
  const order = S.serviceOrder(st, bfp, [T.getTrade("plumbing")]).map((x) => x.id);
  if (order.indexOf("drains") > order.indexOf("toilets")) fail("build order put a Low above a High");

  // reordering inside a bucket must not disturb the others
  S.reorderBucket(st, ["sewers", "drains"]);
  const after = S.servicesByPriority(st, bfp, [T.getTrade("plumbing")]);
  if (after.high[0].id !== "sewers") fail("reorderBucket did not reorder within the band");
  if (after.low[0].id !== "toilets") fail("reorderBucket disturbed another band");

  // toggling: scraped services deny-list, taxonomy-only allow-list
  S.toggleService(st, "drains", false);
  if (S.onServices(st, bfp, [T.getTrade("plumbing")]).some((x) => x.id === "drains")) fail("could not untick a scraped service");
  const scopedBackflow = S.scopedId("plumbing", "backflow-testing");
  S.toggleService(st, scopedBackflow, true);
  if (!S.onServices(st, bfp, [T.getTrade("plumbing")]).some((x) => x.id === scopedBackflow)) {
    fail("could not tick a taxonomy-only service");
  }

  // A ticked taxonomy service must survive a change of trade — it carries
  // a priority and a note that would vanish with it.
  const svcMod = MODULES.find((m) => m.id === "services");
  const sw = S.fresh();
  sw.m.services = { trades: ["plumbing"] };
  const bfId = S.scopedId("plumbing", "backflow-testing");
  const meta = svcMod.serviceMeta(ctxFor(bfp, sw), bfId);
  if (!meta || !meta.name) fail("serviceMeta() returned nothing for a taxonomy service");
  S.toggleService(sw, bfId, true, meta);
  S.setPriority(sw, bfId, "high");
  sw.m.services.trades = ["hvac"];
  const survivor = S.onServices(sw, bfp, [T.getTrade("hvac")])
    .find((x) => x.id === bfId);
  if (!survivor) fail("a ticked taxonomy service vanished when the trade changed");
  else {
    if (survivor.name !== meta.name) fail("the surviving service lost its name");
    if (survivor.prio !== "high") fail("the surviving service lost its priority");
  }
  S.toggleService(sw, bfId, true, null);
  if (sw.m.services.snap) fail("unticking left the snapshot behind");

  // A sub-service the scrape found but the taxonomy doesn't name must not
  // be replaced by the taxonomy's list.
  const oddClient = JSON.parse(JSON.stringify(bfp));
  oddClient.services = [{ id: "drains", name: "Drains", subs: ["Drain Cleaning", "Grease Traps"], hasPage: true, verify: null }];
  const merged = S.serviceUniverse(S.fresh(), oddClient, [T.getTrade("plumbing")]).find((x) => x.id === "drains");
  const subNames = merged.subs.map((x) => x.name);
  if (subNames.indexOf("Grease Traps") < 0) fail("a scraped sub-service was dropped by the taxonomy merge");
  if (subNames.indexOf("Hydrojetting") < 0) fail("the taxonomy subs were lost in the merge");
  if (new Set(subNames).size !== subNames.length) fail("the sub merge produced duplicates");

  // Unprioritized services must not appear in the build order with a rank.
  const bo = S.fresh();
  bo.m.services = { trades: ["plumbing"] };
  S.setPriority(bo, "drains", "high");
  const built = S.serviceOrder(bo, bfp, [T.getTrade("plumbing")]);
  if (built.some((x) => !x.prio)) fail("an unranked service appeared in the build order");
  if (built.length !== 1) fail(`build order has ${built.length} entries, expected only the 1 prioritized`);
  const boSum = svcMod.summary(ctxFor(bfp, bo));
  const countRow = (boSum.rows || []).find((r) => r[0] === "Services selected");
  if (!countRow || countRow[1].indexOf("20 of") !== 0) {
    fail(`selected count reads "${countRow && countRow[1]}" — it must count selections, not priorities`);
  }

  // 16 service ids mean different things in different trades. Ticking one
  // must never tick its namesake in another trade.
  const clash = S.fresh();
  clash.m.services = { trades: ["plumbing"] };
  const commercialPlumbing = S.scopedId("plumbing", "commercial");
  S.toggleService(clash, commercialPlumbing, true, { name: "Commercial Plumbing", subs: [] });
  S.setPriority(clash, commercialPlumbing, "high");
  clash.m.services.trades = ["hvac"];
  const hvacList = S.onServices(clash, bfp, [T.getTrade("hvac")]);
  const commercialHvac = hvacList.find((x) => x.id === S.scopedId("hvac", "commercial"));
  if (commercialHvac) fail("ticking Commercial Plumbing also ticked Commercial HVAC");
  if (!hvacList.some((x) => x.id === commercialPlumbing)) {
    fail("the service ticked under the previous trade did not carry over");
  }

  // a sub dropped on a service with no priority must still reach the readout
  const subDrop = S.fresh();
  subDrop.m.services = { trades: ["plumbing"], subsOff: { drains: ["Hydrojetting"] } };
  const subSum = svcMod.summary(ctxFor(bfp, subDrop));
  const dropRow = (subSum.rows || []).find((r) => r[0] === "Sub-services dropped");
  if (!dropRow || dropRow[1].indexOf("Hydrojetting") < 0) {
    fail("a dropped sub vanished because its service had no priority");
  }

  // Two trades at once — the common plumbing+HVAC / plumbing+restoration shape.
  const multi = S.fresh();
  multi.m.services = { trades: ["plumbing", "hvac"] };
  const both = S.serviceUniverse(multi, bfp, [T.getTrade("plumbing"), T.getTrade("hvac")]);
  const labels = both.map((x) => x.name);
  if (new Set(labels).size !== labels.length) {
    fail("two trades produced duplicate service labels: " +
      labels.filter((n, i, a) => a.indexOf(n) !== i).join(", "));
  }
  if (both.filter((x) => x.on).length !== bfp.services.length) {
    fail("adding a second trade changed what the scrape pre-ticked");
  }
  // a scraped page stands in for ONE row; the other trade's namesake is
  // still a page they don't have
  if (!both.some((x) => x.name === "Commercial Plumbing" && x.on)) fail("scraped Commercial did not claim the plumbing row");
  if (!both.some((x) => x.name === "Commercial HVAC" && !x.on)) fail("Commercial HVAC was swallowed by the scraped Commercial page");
  // ...but an identical service in both trades is one row, not two
  if (labels.filter((n) => n === "Water Heaters").length !== 1) fail("Water Heaters appeared once per trade");
  if (!both.every((x) => x.tradeId || x.source === "scrape" || x.source === "added")) {
    fail("a taxonomy service arrived without a trade to group it under");
  }

  // Pre-scoping sessions: every key tied to a service id moves together.
  for (const [label, withTrade, fallback] of [["explicit", true, null], ["inferred", false, "plumbing"]]) {
    const old = {
      v: 2, step: "services",
      m: { services: {
        on: ["backflow-testing"],
        subsOff: { "backflow-testing": ["Annual Test"] },
        prio: { "backflow-testing": "high", drains: "med" },
        snap: { "backflow-testing": { name: "Backflow Testing", subs: [] } },
      } },
      order: {}, skipped: [],
      notes: { "services:backflow-testing": "Bob does these", "services:drains": "scraped note" },
    };
    if (withTrade) old.m.services.trade = "plumbing";
    const st2 = S.validate(JSON.parse(JSON.stringify(old)));
    S.reconcileServiceScoping(st2, fallback);
    const sm = st2.m.services;
    const want = "plumbing:backflow-testing";
    if (sm.on[0] !== want) fail(`${label} session: tick not re-keyed (${sm.on[0]})`);
    if (sm.prio[want] !== "high") fail(`${label} session: priority lost in the re-key`);
    if (!sm.subsOff[want]) fail(`${label} session: dropped subs lost in the re-key`);
    if (!sm.snap[want]) fail(`${label} session: snapshot lost in the re-key`);
    if (st2.notes["services:" + want] !== "Bob does these") fail(`${label} session: note lost in the re-key`);
    if (sm.prio.drains !== "med") fail(`${label} session: a scraped service was wrongly re-keyed`);
    if (st2.notes["services:drains"] !== "scraped note") fail(`${label} session: a scraped note was wrongly re-keyed`);
    if (sm.trade !== undefined) fail(`${label} session: the old single trade key survived`);
    // running it again must change nothing
    const before = JSON.stringify(st2);
    S.reconcileServiceScoping(st2, fallback);
    if (JSON.stringify(st2) !== before) fail(`${label} session: reconcile is not idempotent`);
  }

  // Adding a second trade must not drop the first when the first was
  // inferred from the handoff and never written to state.
  const svcMod2 = MODULES.find((m) => m.id === "services");
  const inferredOnly = S.fresh();
  const ctxInf = ctxFor(bfp, inferredOnly);
  const shown = svcMod2.trades(ctxInf);
  if (shown.length !== 1 || shown[0] !== "plumbing") {
    fail(`trade not inferred from the handoff: ${JSON.stringify(shown)}`);
  }
  // an explicitly empty list must stay empty, or the last trade can never
  // be removed
  inferredOnly.m.services = { trades: [] };
  if (svcMod2.trades(ctxFor(bfp, inferredOnly)).length !== 0) {
    fail("clearing every trade resurrected the inferred one");
  }

  // Which taxonomy row a scraped page stands in for must not depend on the
  // order the trades were clicked.
  for (const order of [["plumbing", "hvac"], ["hvac", "plumbing"]]) {
    const oc = S.fresh();
    oc.m.services = { trades: order };
    const u = S.serviceUniverse(oc, bfp, order.map(T.getTrade));
    const row = u.find((x) => x.id === "commercial");
    if (!row) fail(`picking ${order.join(" then ")} lost the scraped Commercial page`);
    else if (row.name !== "Commercial Plumbing") {
      fail(`picking ${order.join(" then ")} labelled their Commercial Plumbing page "${row.name}"`);
    }
    if (u.filter((x) => x.on).length !== bfp.services.length) {
      fail(`picking ${order.join(" then ")} changed what the scrape pre-ticked`);
    }
  }

  // Two trades naming the same service under different ids is still one row.
  const emptyClient = { slug: "x", client: {}, source: {}, services: [], locations: [] };
  const rr = S.fresh();
  rr.m.services = { trades: ["roofing", "restoration"] };
  const rrU = S.serviceUniverse(rr, emptyClient, [T.getTrade("roofing"), T.getTrade("restoration")]);
  const rrLabels = rrU.map((x) => x.name);
  const rrDupes = rrLabels.filter((n, i, a) => a.indexOf(n) !== i);
  if (rrDupes.length) fail("roofing + restoration produced duplicate labels: " + [...new Set(rrDupes)].join(", "));
  if (rrLabels.filter((n) => n === "Storm Damage Restoration").length !== 1) {
    fail("Storm Damage Restoration appeared once per trade despite being one service");
  }

  // Deduping two identically-named services must keep both sub lists.
  const stormRow = rrU.find((x) => /Storm Damage/i.test(x.name));
  const roofStorm = T.getTrade("roofing").services.find((x) => /Storm Damage/i.test(x.label));
  const restStorm = T.getTrade("restoration").services.find((x) => /Storm Damage/i.test(x.label));
  const stormSubs = stormRow ? stormRow.subs.map((x) => x.name) : [];
  for (const sub of (roofStorm.subs || []).concat(restStorm.subs || [])) {
    if (stormSubs.indexOf(sub) < 0) fail(`label dedupe dropped the sub-service "${sub}"`);
  }
  if (new Set(stormSubs).size !== stormSubs.length) fail("the sub merge produced duplicates");

  // A service ticked under a trade no longer showing must not reappear
  // beside its namesake in one that is.
  const ghost = S.fresh();
  ghost.m.services = {
    trades: ["restoration"],
    on: ["roofing:storm-damage"],
    snap: { "roofing:storm-damage": { name: "Storm Damage Restoration", subs: ["Hail Damage Repair"] } },
  };
  const ghostU = S.serviceUniverse(ghost, emptyClient, [T.getTrade("restoration")]);
  const ghostRows = ghostU.filter((x) => /Storm Damage/i.test(x.name));
  if (ghostRows.length !== 1) {
    fail(`a snapshotted service duplicated its namesake (${ghostRows.length} rows)`);
  } else if (!ghostRows[0].subs.some((x) => x.name === "Hail Damage Repair")) {
    fail("the snapshot's subs were dropped when it merged into the visible row");
  }

  // Whichever order the trades were picked, the scrape still matches.
  for (const order of [["plumbing", "hvac"], ["hvac", "plumbing"]]) {
    const oc2 = S.fresh();
    oc2.m.services = { trades: order };
    const u2 = S.serviceUniverse(oc2, bfp, order.map(T.getTrade));
    const dupes2 = [...new Set(u2.map((x) => x.name).filter((n, i, a) => a.indexOf(n) !== i))];
    if (dupes2.length) fail(`picking ${order.join(" then ")} duplicated: ${dupes2.join(", ")}`);
    if (u2.filter((x) => x.on).length !== bfp.services.length) {
      fail(`picking ${order.join(" then ")} left a scraped page unmatched`);
    }
  }

  // Merging a snapshot into a visible row must carry the tick and priority,
  // or the user's own selection silently disappears.
  const carried = S.fresh();
  carried.m.services = {
    trades: ["restoration"],
    on: ["roofing:storm-damage"],
    prio: { "roofing:storm-damage": "high" },
    subsOff: { "roofing:storm-damage": ["Hurricane Damage"] },
    snap: { "roofing:storm-damage": { name: "Storm Damage Restoration", subs: [] } },
  };
  const carriedRows = S.serviceUniverse(carried, emptyClient, [T.getTrade("restoration")])
    .filter((x) => /Storm Damage/i.test(x.name));
  if (carriedRows.length !== 1) fail("the merged snapshot did not collapse to one row");
  else {
    if (!carriedRows[0].on) fail("merging a snapshot unticked a service the user had selected");
    if (carriedRows[0].prio !== "high") fail("merging a snapshot lost the priority the user set");
    const hurricane = carriedRows[0].subs.find((x) => x.name === "Hurricane Damage");
    if (hurricane && hurricane.on) fail("merging a snapshot lost a dropped sub-service");
  }

  // the old rank screen is gone and nothing still points at it
  if (MODULES.some((m) => m.id === "servicesRank")) fail("servicesRank module is still registered");
}

{
  const after = JSON.stringify(
    (await import(url("js/trades/index.js"))).TRADES.map((t) => ({
      id: t.id, services: t.services.map((x) => ({ id: x.id, label: x.label, subs: x.subs })),
    }))
  );
  if (after !== TRADES_BEFORE) {
    fail("a trade taxonomy was mutated during this run — they are shared by every client");
  }
}

/* ── report ───────────────────────────────────────────── */

for (const w of warns) console.log("WARN  " + w);
for (const f of fails) console.log("FAIL  " + f);

console.log(
  fails.length
    ? `\n${fails.length} failure(s), ${warns.length} warning(s)`
    : `\nAll checks passed — ${MODULES.length} modules, 2 clients, ${warns.length} warning(s)`
);
process.exit(fails.length ? 1 : 0);
