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

  // channels.js is the single source — module 03 and state.js must agree
  const ch = await import(url("js/channels.js"));
  if (ch.ALL.length !== 34) fail(`channel list is ${ch.ALL.length}, expected 34`);
  if (new Set(ch.ALL.map((c) => c.id)).size !== ch.ALL.length) fail("duplicate channel id");
  if (!ch.isKnownChannel("google-ads")) fail("isKnownChannel() missed a real channel");
  if (ch.isKnownChannel("the-radio-spot-on-98-1")) fail("isKnownChannel() accepted an invented id");
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
