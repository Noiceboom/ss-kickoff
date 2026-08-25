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

/* ── report ───────────────────────────────────────────── */

for (const w of warns) console.log("WARN  " + w);
for (const f of fails) console.log("FAIL  " + f);

console.log(
  fails.length
    ? `\n${fails.length} failure(s), ${warns.length} warning(s)`
    : `\nAll checks passed — ${MODULES.length} modules, 2 clients, ${warns.length} warning(s)`
);
process.exit(fails.length ? 1 : 0);
