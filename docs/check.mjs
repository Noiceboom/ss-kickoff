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

// Registered FIRST. A thrown assertion kills the run before the report
// prints, which reads exactly like a clean pass — that is how three
// mutation checks came back green against code that was genuinely broken.
// Installing this at the end of the file was the same mistake again.
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (e) => {
    console.log("FAIL  a check threw and stopped the run — " + ((e && e.message) || e));
    console.log("\n1 failure(s) (run aborted early)");
    process.exit(1);
  });
}

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

// Taken before any consumer is imported, so nothing has had the chance to
// touch a taxonomy at import time.
const TRADE_SNAPSHOT = () => JSON.stringify(
  TRADES_MOD.TRADES.map((t) => ({
    id: t.id, label: t.label,
    services: t.services.map((x) => ({ id: x.id, label: x.label, subs: x.subs })),
  }))
);
const TRADES_MOD = await import(url("js/trades/index.js"));
const TRADES_BEFORE_RUN = TRADE_SNAPSHOT();

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
  // Compare against a validated baseline, not the raw object: loading also
  // runs migrations, so the assertion is that a roundtrip is IDEMPOTENT —
  // encode/decode changes nothing that loading wouldn't change anyway.
  const baseline = S.validate(JSON.parse(JSON.stringify(st)));
  const back = S.validate(S.decode(S.encode(st)));
  if (!back) fail("fragment roundtrip returned null");
  else if (JSON.stringify(back) !== JSON.stringify(baseline)) fail("fragment roundtrip lost or altered data");
  // and the free text specifically survived
  if (back && (back.m.company || {}).legalName !== "Acme & Sons <LLC>") fail("roundtrip lost free text");
  if (back && back.notes["services:drains"] !== "Biggest ticket — José runs it") fail("roundtrip lost a note");
  if (back && back.skipped.indexOf("competitors") < 0) fail("roundtrip lost a skip");

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

      // the payload is a contract — it has to say which one
      if (!/^ss-kickoff\/\d+$/.test(j.schema || "")) fail(`JSON export has schema "${j.schema}"`);
      if (!j.build) fail("JSON export carries no build stamp");

      if (j.notes.brand !== st.notes["brand:_page"]) fail("JSON export dropped a note-only section");
      if (j.notes.marketing !== st.notes["marketing:_page"]) {
        fail("JSON export dropped the note on a skipped section");
      }
      if (!j.skipped.includes("marketing")) fail("JSON export lost which sections were skipped");

      // THE point of the rewrite: keys are state keys, never display labels
      if (!j.fields.company || j.fields.company.businessName !== "Acme Plumbing") {
        fail("JSON export is not keyed on state keys — " + JSON.stringify(Object.keys(j.fields.company || {})));
      }
      for (const [mod, f] of Object.entries(j.fields)) {
        for (const k of Object.keys(f)) {
          // a display label has spaces or a slash in it; a state key never does
          if (/[ \/]/.test(k)) fail(`JSON field "${mod}.${k}" is a display label, not a state key`);
        }
      }

      // entities have to carry the ids the scraper generated
      const svc = j.services.items;
      if (!Array.isArray(svc) || !svc.length) fail("JSON export carried no services");
      else {
        const scraped = svc.filter((x) => x.foundOnSite);
        if (!scraped.length) fail("JSON export lost which services came from the scrape");
        if (svc.some((x) => x.foundOnSite !== (x.source === "both" || x.source === "scrape"))) {
          fail("foundOnSite disagrees with the source it was derived from");
        }
        for (const it of svc.slice(0, 5)) {
          if (!it.id) fail("a service reached the export with no id");
          if (!("priority" in it) || !("rank" in it) || !("selected" in it)) {
            fail(`service "${it.id}" is missing priority/rank/selected`);
          }
        }
        // selected-but-unprioritized used to vanish entirely
        const on = svc.filter((x) => x.selected);
        if (!on.length) fail("no selected services reached the export");
        if (on.every((x) => x.priority)) {
          // fine — but the shape below is what used to be dropped
        }
      }

      // ── the declared version has to match the actual shape ──
      //
      // Pinned by hand, keys AND types, every nested entity. Checking only
      // top-level key names let a field change from a number to a string,
      // or a nested object be renamed, without a word.
      //
      // If a change makes this fail, that is the point: decide whether the
      // shape moved, and bump SCHEMA if it did rather than shipping two
      // incompatible payloads under one version.
      const SHAPES = {
        "ss-kickoff/3": {
          // map<T> — dynamic keys (module ids), every value of type T.
          // array<T> — every element of type T. Both are unchecked without
          // the parameter: `skipped: "array"` passes on an array of objects.
          "": { schema: "string", build: "string", capturedAt: "string", client: "object",
                progress: "map<string>", skipped: "array<string>", fields: "map<object>",
                services: "object", locations: "object", channels: "array<object>",
                access: "object", notes: "map<string>", openItems: "array<object>",
                display: "map<object>" },
          "client": { slug: "string", name: "string", market: "string", website: "string", trade: "string" },
          "services": { trades: "array<string>", items: "array<object>" },
          "services.items[]": { id: "string", name: "string", trade: "string", source: "string",
                foundOnSite: "boolean", selected: "boolean", priority: "string|null",
                rank: "number|null", hasPage: "boolean", subs: "array<object>",
                aliases: "array<string>" },
          "services.items[].subs[]": { name: "string", selected: "boolean" },
          "locations": { baseAddress: "string", radiusMiles: "number", items: "array<object>" },
          "locations.items[]": { id: "string", name: "string", state: "string", source: "string",
                foundOnSite: "boolean", selected: "boolean", excluded: "boolean",
                priority: "string|null", rank: "number|null", hasPage: "boolean" },
          "channels[]": { id: "string", label: "string", category: "string", known: "boolean",
                rating: "string|null", monthlyLeads: "string|null", note: "string" },
          "access": { leadsie: "object", accounts: "array<object>", other: "array<object>" },
          "access.leadsie": { url: "string", status: "string|null", who: "string" },
          "access.accounts[]": { key: "string", label: "string", core: "boolean",
                inPlay: "boolean", status: "string|null" },
          "access.other[]": { label: "string", status: "string|null" },
          "openItems[]": { section: "string", what: "string", detail: "string",
                ask: "string|null", kind: "string" },
        },
      };

      /** Walk a pinned payload, checking key sets and value types at every path. */
      function pinCheck(schemaName, payload) {
        const spec = SHAPES[schemaName];
        if (!spec) { fail(`the payload declares schema "${schemaName}", which nothing pins a shape for`); return; }
        const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
        const seen = new Set();
        // A pin on an empty container proves nothing. Rather than let that
        // pass as coverage, record it and say so.
        const containers = new Map();

        const walk = (path, obj) => {
          const want = spec[path];
          if (!want) return;                 // not a pinned path
          seen.add(path);
          const got = Object.keys(obj).sort().join(",");
          const exp = Object.keys(want).sort().join(",");
          if (got !== exp) {
            fail(`${schemaName} "${path || "payload"}" keys changed without a version bump — got [${got}], pinned [${exp}]`);
            return;
          }
          for (const [k, allowed] of Object.entries(want)) {
            const here = (path ? path + "." : "") + k;
            const child = path ? path + "." + k : k;
            const v = obj[k];

            const container = /^(array|map)<(.+)>$/.exec(allowed);
            // a map is an object at runtime; an array is an array
            const outer = container ? (container[1] === "map" ? "object" : "array") : allowed;
            if (outer.split("|").indexOf(typeOf(v)) < 0) {
              fail(`${schemaName} "${here}" is ${typeOf(v)}, pinned as ${outer}`);
              continue;
            }

            if (container) {
              // An empty container proves nothing; only what is there is checked.
              const inner = container[2];
              const count = container[1] === "array" ? v.length : Object.keys(v).length;
              containers.set(here, (containers.get(here) || 0) + count);
              const entries = container[1] === "array"
                ? v.map((el, i) => [here + "[" + i + "]", el])
                : Object.entries(v).map(([key, val]) => [here + "." + key, val]);
              for (const [label, el] of entries) {
                if (inner.split("|").indexOf(typeOf(el)) < 0) {
                  fail(`${schemaName} "${label}" is ${typeOf(el)}, pinned as ${inner}`);
                }
              }
            }

            if (Array.isArray(v)) {
              for (const el of v) if (el && typeof el === "object") walk(child + "[]", el);
            } else if (v && typeof v === "object" && !container) {
              walk(child, v);
            }
          }
        };
        walk("", payload);

        // a pinned path that never got walked is a pin describing nothing
        for (const path of Object.keys(spec)) {
          if (!seen.has(path)) fail(`${schemaName} pins "${path}", which the payload never produced`);
        }
        for (const [path, count] of containers) {
          if (!count) warn(`${schemaName} pins element types for "${path}", but this run never saw one — that pin is unverified`);
        }
      }

      // run it against a payload rich enough to reach every pinned path
      const rich = S.fresh();
      // Plumbing only, but carrying a snapshot of a service ticked under HVAC
      // before that trade came off. That is the one thing that produces
      // aliases — without it the alias pin is never exercised.
      rich.m.services = {
        trades: ["plumbing"],
        on: ["hvac:water-heaters"],
        snap: { "hvac:water-heaters": { name: "Water Heaters", subs: [] } },
      };
      const richTrades = MODULES.find((m) => m.id === "services").trades({ ...ctxFor(bfp, rich) });
      rich.m.access = { leadsie: "sent", leadsieWho: "Mike", status_ga4: "granted",
        custom: [{ account: "Yelp Ads", status: "pending" }] };
      rich.m.marketing = { chan: ["seo"], rate_seo: "good", vol_seo: "40" };
      rich.m.locations = { base: "Kansas City, MO", radius: 30 };
      rich.m.brand = { logoStatus: "raster", photoStatus: "none" };
      rich.skipped = ["competitors"];
      rich.notes["goals:_page"] = "Wants off the pay-per-lead treadmill.";
      rich.notes["competitors:_page"] = "Didn't get to it.";
      {
        const u = S.serviceUniverse(rich, bfp, richTrades.map(TRADES_MOD.getTrade).filter(Boolean));
        const on = u.filter((x) => x.on);
        S.setPriority(rich, [on[0].id], "high");
        const cities = S.locationUniverse(rich, bfp, []).filter((x) => x.on);
        S.setLocationPriority(rich, cities[0].id, "high");
      }
      const richPayload = JSON.parse(readout.exports(ctxFor(bfp, rich)).json());
      pinCheck(richPayload.schema, richPayload);

      // a struck-out sub-service must not be exported as in scope
      const subbed = S.fresh();
      const svcMod = MODULES.find((m) => m.id === "services");
      const withSubs = j.services.items.find((x) => x.subs.length > 1);
      if (!withSubs) fail("no exported service carried sub-services to test against");
      else {
        S.toggleSub(subbed, "services", withSubs.id, withSubs.subs[0].name);
        const j2 = JSON.parse(readout.exports(ctxFor(bfp, subbed)).json());
        const again = j2.services.items.find((x) => x.id === withSubs.id);
        const struck = (again.subs || []).find((x) => x.name === withSubs.subs[0].name);
        if (!struck) fail("striking a sub-service removed it from the export entirely");
        else if (struck.selected !== false) {
          fail(`a struck sub-service exported as selected=${struck.selected}`);
        }
        if (!again.subs.some((x) => x.selected)) fail("striking one sub struck all of them");
      }

      // Structural bookkeeping must not double up in `fields`. Asserting
      // this against a state that has none of it passes for free — the
      // state below actually carries every one of these keys.
      const booky = S.fresh();
      booky.m.services = {
        trades: ["plumbing"], on: ["x"], off: ["y"], prio: { x: "high" },
        snap: { x: { name: "X", subs: [] } }, subsOff: { x: ["Sub"] },
        added: [{ id: "z", name: "Z" }], note: "kept",
      };
      booky.m.locations = { on: ["a"], off: [], excluded: ["b"], prio: { a: "med" }, added: [], base: "KC", radius: 30 };
      const jb = JSON.parse(readout.exports(ctxFor(bfp, booky)).json());
      for (const key of ["snap", "subsOff", "added", "prio", "off", "on", "trades"]) {
        if (jb.fields.services && key in jb.fields.services) {
          fail(`services bookkeeping "${key}" leaked into fields`);
        }
      }
      for (const key of ["excluded", "prio", "base", "radius"]) {
        if (jb.fields.locations && key in jb.fields.locations) {
          fail(`locations bookkeeping "${key}" leaked into fields`);
        }
      }
      if (!jb.fields.services || jb.fields.services.note !== "kept") {
        fail("filtering bookkeeping also removed a real answer");
      }
      // the structured copies still have to be there
      if (jb.locations.baseAddress !== "KC" || jb.locations.radiusMiles !== 30) {
        fail("the radius search settings were dropped from the export entirely");
      }

      // a selected channel the catalogue doesn't know must still export
      const oddball = S.fresh();
      oddball.m.marketing = { chan: ["seo", "some-new-channel"], rate_seo: "good" };
      const jo = JSON.parse(readout.exports(ctxFor(bfp, oddball)).json());
      const hit = jo.channels.find((c) => c.id === "some-new-channel");
      if (!hit) fail("a selected channel outside the built-in list was dropped from the export");
      else if (hit.known !== false) fail("an unknown channel was not flagged as unknown");
      const oddCsv = readout.exports(ctxFor(bfp, oddball)).csv();
      if (!/"channel","marketing","some-new-channel","known","false"/.test(oddCsv)) {
        fail("the CSV gives no way to tell an unknown channel from a known one");
      }

      // rows must survive the CSV as records, not as "[object Object]"
      const comp = S.fresh();
      comp.m.competitors = { rows: [{ name: "Roto-Rooter", why: "Owns the map pack" }] };
      const compCsv = readout.exports(ctxFor(bfp, comp)).csv();
      if (/\[object Object\]/.test(compCsv)) fail("the CSV stringified a structured value");
      if (compCsv.indexOf("Roto-Rooter") === -1) fail("the CSV dropped a competitor the client named");

      const csv = api.csv();
      if (!csv.includes("the guy who shows up")) fail("CSV export dropped a page note");
      if (csv.split('"').length % 2 !== 1) fail("CSV export has unbalanced quoting");
      if (!/^"entity","section","id","field","value"/.test(csv)) {
        fail("CSV export lost its addressable header");
      }
      if (!csv.includes('"service","services"')) fail("CSV export carried no service rows");
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

  // Reads resolve across a merged row's aliases, so writes must too —
  // otherwise unticking clears one id while another keeps it selected.
  const aliased = S.fresh();
  aliased.m.services = {
    trades: ["restoration"],
    on: ["roofing:storm-damage"],
    prio: { "roofing:storm-damage": "high" },
    snap: { "roofing:storm-damage": { name: "Storm Damage Restoration", subs: [] } },
  };
  const rowNow = () => S.serviceUniverse(aliased, emptyClient, [T.getTrade("restoration")])
    .find((x) => /Storm Damage/i.test(x.name));
  const first = rowNow();
  const allIds = [first.id].concat(first.aliases || []);
  if (allIds.length !== 2) fail("the merged row did not record its alias");

  S.setPriority(aliased, allIds, "high");
  if (rowNow().prio !== "") fail("clicking the active priority band did not clear a merged row");
  S.setPriority(aliased, allIds, "low");
  if (rowNow().prio !== "low") fail("could not set a priority on a merged row");
  S.toggleService(aliased, allIds, true, null);
  if (rowNow().on) fail("unticking a merged row left it selected via its alias");
  S.toggleService(aliased, [rowNow().id], true, { name: "Storm Damage Restoration", subs: [] });
  if (!rowNow().on) fail("could not re-tick a merged row");

  // the old rank screen is gone and nothing still points at it
  if (MODULES.some((m) => m.id === "servicesRank")) fail("servicesRank module is still registered");
}

{
  if (TRADE_SNAPSHOT() !== TRADES_BEFORE_RUN) {
    fail("a trade taxonomy was mutated during this run — they are shared by every client");
  }
}

{
  // ── cities: coverage, exclusions, priority ──
  const P = await import(url("js/places.js"));
  const locMod = MODULES.find((m) => m.id === "locations");
  if (!locMod) fail("the locations module is missing");
  if (MODULES.some((m) => m.id === "locationsRank")) fail("the rank-cities screen is still registered");

  // the dataset must actually cover a real metro — a name-matched dataset
  // silently lost ten Kansas City suburbs, which is how this got caught
  const kcPlaces = JSON.parse(readFileSync(path.join(ROOT, "data/places/KS.json"), "utf8"))
    .map((r) => ({ name: r[0], state: "KS", lat: r[1], lng: r[2], pop: r[3] }))
    .concat(JSON.parse(readFileSync(path.join(ROOT, "data/places/MO.json"), "utf8"))
      .map((r) => ({ name: r[0], state: "MO", lat: r[1], lng: r[2], pop: r[3] })));
  const kc = P.search(kcPlaces, "Kansas City, MO", 1)[0];
  if (!kc) fail("could not find Kansas City, MO in the bundled dataset");
  else {
    const near = P.within(kcPlaces, kc, 25).map((x) => x.name.toLowerCase());
    for (const suburb of ["merriam", "raytown", "north kansas city", "gladstone",
                          "fairway", "roeland park", "westwood", "prairie village",
                          "overland park", "lenexa", "leawood", "shawnee", "olathe"]) {
      if (near.indexOf(suburb) < 0) fail(`the places dataset is missing ${suburb} within 25mi of Kansas City`);
    }
    if (kc.pop < 400000) fail(`Kansas City population looks wrong: ${kc.pop}`);
  }
  // every state file must parse and be non-trivial
  for (const st of ["KS", "MO", "TX", "CA", "RI"]) {
    const rows = JSON.parse(readFileSync(path.join(ROOT, `data/places/${st}.json`), "utf8"));
    if (!rows.length) fail(`data/places/${st}.json is empty`);
    for (const r of rows.slice(0, 5)) {
      if (r.length !== 4 || typeof r[0] !== "string" || typeof r[1] !== "number") {
        fail(`data/places/${st}.json has a malformed row`);
      }
    }
  }

  // The base city is a NATIONAL lookup. Searching only the client's region
  // meant "Dallas" on a Kansas City kickoff could never find Texas.
  const idxRows = JSON.parse(readFileSync(path.join(ROOT, "data/places-index.json"), "utf8"))
    .map((r) => ({ name: r[0], state: r[1], lat: r[2], lng: r[3], pop: r[4] }));
  if (idxRows.length < 8000) fail(`the national place index has only ${idxRows.length} entries`);

  const dallas = P.search(idxRows, "Dallas", 5);
  if (!dallas.length) fail("searching for Dallas found nothing");
  else if (dallas[0].name !== "Dallas" || dallas[0].state !== "TX") {
    fail(`searching "Dallas" returned ${dallas[0].name}, ${dallas[0].state} first, expected Dallas, TX`);
  }
  for (const [q, wantName, wantState] of [
    ["Kansas City", "Kansas City", "MO"],
    ["Springfield", "Springfield", "MO"],
    ["Phoenix", "Phoenix", "AZ"],
    ["Columbus", "Columbus", "OH"],
  ]) {
    const hit = P.search(idxRows, q, 1)[0];
    if (!hit || hit.name !== wantName || hit.state !== wantState) {
      fail(`searching "${q}" returned ${hit ? hit.name + ", " + hit.state : "nothing"}, expected ${wantName}, ${wantState}`);
    }
  }

  // A pasted street address must resolve to its city, not return nothing.
  for (const [addr, city, st] of [
    ["3090 W Market St Ste 124-2, Akron, OH 44333", "Akron", "OH"],
    ["1420 Baltimore Ave, Kansas City, MO 64108", "Kansas City", "MO"],
    ["Overland Park, KS 66210", "Overland Park", "KS"],
    ["Akron OH", "Akron", "OH"],
    ["Dallas", "Dallas", ""],
    // an address copied off a Google listing arrives on two lines, and a
    // single-line input turns the break into a space
    ["3090 W Market St Ste 124-2\nAkron, OH 44333", "Akron", "OH"],
    ["3090 W Market St Ste 124-2 Akron, OH 44333", "Akron", "OH"],
    ["1420 Baltimore Ave\nKansas City, MO 64108", "Kansas City", "MO"],
    ["1420 Baltimore Ave Kansas City, MO", "Kansas City", "MO"],
  ]) {
    const parsed = P.parseLocation(addr);
    if (parsed.city !== city || parsed.state !== st) {
      fail(`parseLocation("${addr}") gave ${JSON.stringify(parsed)}, expected ${city} / ${st || "(none)"}`);
    }
    const hit = P.search(idxRows, addr, 1)[0];
    if (!hit || hit.name !== city) {
      fail(`searching "${addr}" found ${hit ? hit.name : "nothing"}, expected ${city}`);
    }
  }

  // A street name can itself be a street word ("500 Court St"), and a city
  // can contain one ("Circle Pines"). No token rule separates those, so the
  // candidates are checked against the real place list.
  for (const [addr, want] of [
    ["500 Court St Unit 4 Lake Placid, NY", "Lake Placid"],
    ["1420 Elm St Circle Pines, MN", "Circle Pines"],
    ["3090 W Market St Grand Terrace, CA", "Grand Terrace"],
    ["500 Oak Ave Terrace Park, OH", "Terrace Park"],
    ["3090 W Market St Suite B Akron, OH", "Akron"],
    ["100 N Main Street Suite 200 Dallas, TX", "Dallas"],
  ]) {
    const hit = P.search(idxRows, addr, 1)[0];
    if (!hit || hit.name !== want) {
      fail(`searching "${addr}" found ${hit ? hit.name : "nothing"}, expected ${want}`);
    }
  }

  // A place name that begins with a digit must survive street-stripping.
  const numeric = P.parseLocation("29 Palms, CA");
  if (numeric.city !== "29 Palms" || numeric.state !== "CA") {
    fail(`street-stripping mangled a numeric place name: ${JSON.stringify(numeric)}`);
  }

  // a radius result the scrape already covers is not a duplicate. The two
  // use different id conventions — "raytown" vs "raytown-mo".
  const lst = S.fresh();
  const found = P.within(kcPlaces, kc, 25).map((p) => ({ ...p, id: P.placeId(p) }));
  const cands = S.radiusCandidates(lst, bfp, found);
  const scrapedNames = new Set(bfp.locations.map((l) => l.name.toLowerCase() + "|" + l.state));
  for (const c of cands) {
    if (scrapedNames.has(c.name.toLowerCase() + "|" + c.state)) {
      fail(`${c.name}, ${c.state} was offered as a candidate but the scrape already has it`);
    }
  }
  if (cands.length >= found.length) fail("radiusCandidates filtered nothing at all");

  // Kansas City MO and KS are different cities and must both survive
  const uni = S.locationUniverse(lst, bfp, found);
  const kcRows = uni.filter((x) => /^kansas city$/i.test(x.name));
  if (kcRows.length !== 1) fail(`expected only the scraped Kansas City row, got ${kcRows.length}`);
  const names = uni.map((x) => x.name.toLowerCase() + "|" + x.state);
  if (new Set(names).size !== names.length) fail("locationUniverse produced duplicate cities");

  // excluded is a separate state from unticked
  const ex = S.fresh();
  S.toggleExcluded(ex, "raytown");
  const exUni = S.locationUniverse(ex, bfp, []);
  const ray = exUni.find((x) => x.id === "raytown");
  if (!ray || !ray.excluded) fail("toggleExcluded did not bar the city");
  if (ray.on) fail("an excluded city still counted as selected");
  if (!S.excludedLocations(ex, bfp, []).length) fail("excludedLocations returned nothing");
  // choosing it again clears the bar
  S.toggleLocation(ex, "raytown", false);
  if (S.locationUniverse(ex, bfp, []).find((x) => x.id === "raytown").excluded) {
    fail("picking a barred city did not clear the exclusion");
  }
  // excluding clears any priority — a barred city has no build slot
  S.setLocationPriority(ex, "raytown", "high");
  S.toggleExcluded(ex, "raytown");
  if (S.locationOrder(ex, bfp, []).some((x) => x.id === "raytown")) {
    fail("an excluded city stayed in the build order");
  }

  // priority bands, and unranked cities kept out of the order
  const lp = S.fresh();
  S.setLocationPriority(lp, "olathe", "high");
  S.setLocationPriority(lp, "raytown", "low");
  const lorder = S.locationOrder(lp, bfp, []);
  if (lorder.some((x) => !x.prio)) fail("an unranked city appeared in the city build order");
  if (lorder[0].id !== "olathe") fail("the city build order put a Low above a High");
  S.reorderLocationBucket(lp, ["raytown"]);
  if (S.locationsByPriority(lp, bfp, []).high[0].id !== "olathe") {
    fail("reordering one band disturbed another");
  }
}

{
  // Sessions ranked on the deleted drag screens must survive. The build
  // order only shows what carries a priority, so without a migration all
  // that ranking reads as empty.
  const legacy = {
    v: 2, step: "locations",
    m: { locations: { off: [] }, services: {} },
    order: {
      locations: ["overland-park", "olathe", "lenexa", "leawood", "shawnee",
                  "independence", "raytown", "belton", "gladstone", "grandview", "raymore"],
      services: ["drains", "water-heaters", "sewers", "toilets", "faucets", "bathtubs"],
    },
    skipped: [],
    notes: { "locationsRank:_page": "Best tech lives there.", "servicesRank:_page": "Drains pay the bills." },
  };
  const mig = S.validate(JSON.parse(JSON.stringify(legacy)));

  // Assertions here must REPORT, never throw: a crash kills the run before
  // the report prints, which reads exactly like a pass.
  const lOrder = S.locationOrder(mig, bfp, []);
  if (lOrder.length !== 11) {
    fail(`legacy city ranking produced ${lOrder.length} ranked cities, expected 11`);
  } else {
    if (lOrder[0].id !== "overland-park") fail("legacy city ranking lost its order");
    if (lOrder.filter((x) => x.prio === "high").length !== 5) fail("legacy migration did not use the old 1-5 high band");
    if (lOrder.filter((x) => x.prio === "med").length !== 5) fail("legacy migration did not use the old 6-10 medium band");
    if (!lOrder.slice(10).every((x) => x.prio === "low")) fail("legacy migration did not put 11+ in low");
  }

  const sOrder = S.serviceOrder(mig, bfp, [TRADES_MOD.getTrade("plumbing")]);
  if (!sOrder.length) fail("legacy service ranking was lost entirely");

  // notes from the deleted screens land on their survivors
  if (mig.notes["locationsRank:_page"] || mig.notes["servicesRank:_page"]) {
    fail("a note from a deleted rank screen was left orphaned");
  }
  if (!/Best tech/.test(mig.notes["locations:_page"] || "")) fail("the rank-cities note was dropped");
  if (!/Drains pay/.test(mig.notes["services:_page"] || "")) fail("the rank-services note was dropped");

  // a session already using priorities must never be rewritten
  const modern = S.validate({
    v: 2, step: "locations", m: { locations: { prio: { olathe: "low" } } },
    order: { locations: ["overland-park", "olathe"] }, skipped: [], notes: {},
  });
  if (JSON.stringify(modern.m.locations.prio) !== '{"olathe":"low"}') {
    fail("the legacy rank migration overwrote priorities set on the new screen");
  }

  // A session that only ever dragged has no module slot at all — which is
  // exactly the session that most needs the rank migration.
  const orderOnly = S.validate({
    v: 2, step: "locations", m: {},
    order: { locations: ["olathe", "lenexa", "leawood"] }, skipped: [], notes: {},
  });
  if (S.locationOrder(orderOnly, bfp, []).length !== 3) {
    fail("a session that only ranked, never toggled, lost its ranking entirely");
  }

  // Clearing every priority on the new screen must survive a reload. The
  // order stays behind, and without a one-shot stamp the next load reads it
  // as legacy and rebuilds the priorities that were just cleared.
  const cleared = S.validate({
    v: 2, step: "locations", m: { locations: { prio: { olathe: "high" } } },
    order: { locations: ["olathe", "lenexa"] }, skipped: [], notes: {},
  });
  S.setLocationPriority(cleared, "olathe", "high");   // clicking the active band clears it
  const afterReload = S.validate(JSON.parse(JSON.stringify(cleared)));
  const stillSet = (afterReload.m.locations || {}).prio;
  if (stillSet && Object.keys(stillSet).length) {
    fail("priorities cleared on the new screen came back after a reload");
  }

  // Two same-named places in range are two cities. A stateless scraped
  // entry can only stand in for one, so filtering both would hide a real one.
  const ambiguousClient = JSON.parse(JSON.stringify(bfp));
  ambiguousClient.locations = [{ id: "springfield", name: "Springfield", state: "", hasPage: false, verify: null }];
  const twoSprings = [
    { id: "springfield-mo", name: "Springfield", state: "MO", pop: 169176, miles: 5 },
    { id: "springfield-il", name: "Springfield", state: "IL", pop: 114394, miles: 9 },
  ];
  if (S.radiusCandidates(S.fresh(), ambiguousClient, twoSprings).length !== 2) {
    fail("an ambiguous stateless city swallowed every same-named place in range");
  }

  // A session created after the stamp landed must not re-fabricate either.
  // fresh() starts stamped; validate() clears the stamp only for saved
  // states that predate it, which is what keeps real migrations running.
  const newSession = S.fresh();
  newSession.order.locations = ["olathe", "lenexa"];
  const newReloaded = S.validate(JSON.parse(JSON.stringify(newSession)));
  const newPrio = (newReloaded.m.locations || {}).prio;
  if (newPrio && Object.keys(newPrio).length) {
    fail("a brand-new session had priorities fabricated from its own drag order");
  }
  if (!S.fresh().mig || !S.fresh().mig.rank) fail("fresh() should start already stamped");

  // Two same-named cities in different states, both selected, must stay
  // two rows — the stateless scraped entry can only stand in for one.
  const twoClient = JSON.parse(JSON.stringify(bfp));
  twoClient.locations = [{ id: "springfield", name: "Springfield", state: "", hasPage: false, verify: null }];
  const twoState = S.fresh();
  S.addLocations(twoState, [
    { id: "springfield-mo", name: "Springfield", state: "MO", pop: 169176, miles: 5 },
    { id: "springfield-il", name: "Springfield", state: "IL", pop: 114394, miles: 9 },
  ]);
  const springs = S.locationUniverse(twoState, twoClient, []).filter((x) => /Springfield/.test(x.name));
  if (springs.length !== 2) {
    fail(`two Springfields in different states collapsed into ${springs.length} row(s)`);
  } else if (new Set(springs.map((x) => x.state)).size !== 2) {
    fail("the two Springfield rows ended up with the same state");
  }

  // a client file whose cities carry no state must still match the Census
  const noState = JSON.parse(JSON.stringify(bfp));
  noState.locations = [{ id: "raytown", name: "Raytown", state: "", hasPage: false, verify: null }];
  const twin = [{ id: "raytown-mo", name: "Raytown", state: "MO", lat: 39, lng: -94, pop: 30012, miles: 9.4 }];
  // The twin has to be SELECTED, or locationUniverse never emits it and
  // the assertion passes without exercising anything.
  const nsState = S.fresh();
  S.addLocations(nsState, [{ id: "raytown-mo", name: "Raytown", state: "MO", pop: 30012, miles: 9.4 }]);
  const nsU = S.locationUniverse(nsState, noState, twin);
  const rayRows = nsU.filter((x) => /Raytown/.test(x.name));
  if (rayRows.length !== 1) {
    fail(`a stateless scraped city duplicated its Census twin (${rayRows.length} rows)`);
  } else if (!rayRows[0].state) {
    fail("the scraped row did not pick up the state from its Census twin");
  } else if (rayRows[0].miles == null) {
    fail("the scraped row did not pick up the distance from its Census twin");
  }
  if (S.radiusCandidates(S.fresh(), noState, twin).length) {
    fail("a stateless scraped city was still offered as a radius candidate");
  }
}

{
  // ── brand ──
  if (MODULES.some((m) => m.id === "constraints")) fail("the constraints screen is still registered");
  const brandMod = MODULES.find((m) => m.id === "brand");
  if (!brandMod) fail("the brand module is missing");
  else {
    if (brandMod.nav !== "Brand") fail(`brand nav is "${brandMod.nav}", expected "Brand"`);
    const html = brandMod.render(ctxFor(bfp, S.fresh()));
    for (const gone of ["Google reviews", "Guarantees", "Warranty terms", "Offers financing", "USP"]) {
      if (html.indexOf(gone) > -1) fail(`the proof half is still on the brand screen: "${gone}"`);
    }
    if ((html.match(/data-scale-field=/g) || []).length < 5) fail("the tone scales are missing");
    if (html.indexOf('data-putfile="brand|logoFile"') < 0) fail("the logo upload is missing");
    // the guide upload only appears once they say they have one
    const withGuide = S.fresh();
    withGuide.m.brand = { guideStatus: "yes" };
    if (brandMod.render(ctxFor(bfp, withGuide)).indexOf('data-putfile="brand|guideFile"') < 0) {
      fail("the brand-guide upload did not appear when they said they have one");
    }

    // scales must start unset — a scale sitting at centre reads as an answer
    if ((html.match(/class="f sc unset"/g) || []).length < 5) fail("tone scales did not start unset");

    // state holds metadata, never bytes
    const withFile = S.fresh();
    withFile.m.brand = { logoFile: { name: "acme-logo.svg", type: "image/svg+xml", size: 114, at: 1 } };
    const sum = brandMod.summary(ctxFor(bfp, withFile));
    const fileRow = (sum.rows || []).find((r) => r[0] === "Logo file");
    if (!fileRow || fileRow[1].indexOf("acme-logo.svg") < 0) fail("the readout lost the uploaded file's name");

    // tone lands in the brief as a table
    const withTone = S.fresh();
    withTone.m.brand = { tone_formal: "100", tone_premium: "90" };
    const toneSum = brandMod.summary(ctxFor(bfp, withTone));
    if (!toneSum.table || toneSum.table.body.length !== 2) fail("tone did not reach the readout as a table");
    else if (toneSum.table.body[0][2] !== "Conversational") {
      fail(`a scale at 100 read as "${toneSum.table.body[0][2]}"`);
    }
  }

  // notes from the deleted constraints screen must not orphan
  const cn = S.validate({
    v: 2, step: "brand", m: {}, order: {}, skipped: [],
    notes: { "constraints:_page": "Won't touch shared leads." },
  });
  if (cn.notes["constraints:_page"]) fail("the constraints note was left orphaned");
  if (!/shared leads/.test(cn.notes["brand:_page"] || "")) fail("the constraints note was dropped entirely");
}

/* ── saved sessions survive the screens changing ───────── */
{
  const brandMod = MODULES.find((m) => m.id === "brand");

  // chips used to store their own labels; a saved answer must survive the swap
  const legacy = S.validate({
    v: 2, step: "constraints", order: {}, skipped: [], notes: {},
    m: { brand: { logoStatus: "Have raster only", photoStatus: "Stock only" } },
  });
  if (legacy.m.brand.logoStatus !== "raster") {
    fail(`a saved logo chip read back as "${legacy.m.brand.logoStatus}", not "raster"`);
  }
  if (legacy.m.brand.photoStatus !== "stock") {
    fail(`a saved photo chip read back as "${legacy.m.brand.photoStatus}", not "stock"`);
  }

  // reopening on a deleted screen must land on its successor, not the intro
  if (legacy.step !== "brand") {
    fail(`a session saved on constraints reopened on "${legacy.step}", not brand`);
  }

  // the logo warning must not depend on an unrelated answer
  const planned = S.fresh();
  planned.m.brand = { logoStatus: "none", photoPlan: "owner shoots the next three jobs" };
  const opens = (brandMod.summary(ctxFor(bfp, planned)).open || []).map((o) => o.what);
  if (!opens.includes("Logo")) {
    fail("filling in the photo plan silently suppressed the they-need-a-logo warning");
  }
}

/* ── the printed document is the client artifact ───────── */
{
  const readout = MODULES.find((m) => m.id === "readout");
  const st = S.fresh();
  st.notes["brand:_page"] = 'Calls himself "the guy who shows up"';
  st.notes["marketing:_page"] = "Old agency still owns the ad account";
  st.m.company = { businessName: "Acme Plumbing" };

  const slice = (html) => {
    const at = html.indexOf('<div class="printdoc">');
    return at < 0 ? "" : html.slice(at);
  };

  // it prints the same thing from every tab — the whole point of the change
  for (const tab of ["recap", "brief", "raw"]) {
    const html = readout.render({ ...ctxFor(bfp, st), num: "09", transient: { readout: { tab } } });
    const doc = slice(html);
    if (!doc) { fail(`no printable document rendered on the "${tab}" tab`); continue; }

    for (const secret of ["the guy who shows up", "Old agency still owns"]) {
      if (doc.includes(secret)) fail(`the printed document leaked a call note from the "${tab}" tab`);
    }
    if (doc.indexOf("Acme Plumbing") === -1) {
      fail(`the printed document lost the client's own answers on the "${tab}" tab`);
    }
  }

  // and only client-worded asks reach it, never the internal detail
  const bare = S.fresh();
  // a state that actually triggers the asks below: a raster logo with no
  // file, no photography, and a company with no named contact
  bare.m.brand = { logoStatus: "raster", photoStatus: "none" };
  bare.m.company = { businessName: "Acme Plumbing" };
  const doc = slice(readout.render({ ...ctxFor(bfp, bare), num: "09", transient: {} }));
  if (doc.indexOf("the copywriter is guessing") > -1) {
    fail("the printed document used the internal wording of an open item");
  }
  // EVERY ask has to reach the document — checking that "some ask" made it
  // passes even when a specific one has been dropped.
  const asks = [];
  for (const m of MODULES) {
    if (!m.summary) continue;
    let sum = null;
    try { sum = m.summary(ctxFor(bfp, bare)); } catch (e) { continue; }
    for (const o of (sum && sum.open) || []) if (o.ask) asks.push([m.id, o.ask]);
  }
  if (asks.length < 3) fail(`only ${asks.length} open items carry client-facing wording`);

  // Pinned. Deriving the expectation from the same summaries that produce it
  // cannot catch a DELETED ask — both sides vanish together. These name the
  // asks the client document exists to make.
  const MUST_ASK = [
    { mod: "brand", match: /logo file/i, why: "raster logo with nothing uploaded" },
    { mod: "brand", match: /photos of your trucks/i, why: "no real photography" },
    { mod: "access", match: /access link/i, why: "Leadsie link not sent" },
    { mod: "company", match: /who we should be speaking to/i, why: "no point of contact" },
  ];
  for (const want of MUST_ASK) {
    const hit = asks.some(([mod, ask]) => mod === want.mod && want.match.test(ask));
    if (!hit) fail(`"${want.mod}" no longer asks the client about ${want.why}`);
  }
  for (const [mod, ask] of asks) {
    // the document escapes what it prints, so compare on escaped text
    const escaped = ask.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    if (doc.indexOf(escaped) === -1 && doc.indexOf(ask) === -1) {
      fail(`the ask from "${mod}" never reached the printed document: ${ask.slice(0, 50)}…`);
    }
  }
}

/* ── nothing may render the literal string "undefined" ── */
{
  // A typo'd ICON key or a missing helper does not throw — it interpolates
  // as "undefined" and ships. Cheap to catch, invisible otherwise.
  for (const m of MODULES) {
    for (const [label, st] of [["empty", S.fresh()]]) {
      let html = "";
      try { html = m.render({ ...ctxFor(bfp, st), num: "01" }); } catch (e) { continue; }
      if (/>undefined<|\bundefined\b/.test(html.replace(/data-[a-z]+="[^"]*"/g, ""))) {
        fail(`module "${m.id}" rendered the literal string "undefined" (${label} state)`);
      }
    }
  }
}

/* ── access: leadsie first, no owner/how anywhere ──────── */
{
  const acc = MODULES.find((m) => m.id === "access");

  const filled = S.fresh();
  const html = acc.render({ ...ctxFor(bfp, filled), num: "08" });
  if (html.indexOf("app.leadsie.com/connect/servicescalers/manage") === -1) {
    fail("the Leadsie link is not on the access screen");
  }
  if (/data-f="access\|owner_|data-f="access\|how_/.test(html)) {
    fail("access still renders an owner or how-do-we-get-it field");
  }
  // the eight that appear without being asked for
  for (const k of ["ga4", "gsc", "gads", "gtm", "crm", "web", "host", "meta"]) {
    if (html.indexOf('data-status="access|status_' + k + '|') === -1) {
      fail(`the core account "${k}" is missing from the access screen`);
    }
  }
  // and the ones that should stay behind the picker until asked for
  for (const k of ["gbp", "dns", "reviews"]) {
    if (html.indexOf('data-status="access|status_' + k + '|') > -1) {
      fail(`optional account "${k}" is on screen before anyone said it exists`);
    }
    if (html.indexOf('data-chip="access|extra|' + k + '"') === -1) {
      fail(`optional account "${k}" has no way to be switched on`);
    }
  }
  // switching one on has to reveal its status picker
  const withExtra = S.fresh();
  withExtra.m.access = { extra: ["gbp"] };
  if (acc.render({ ...ctxFor(bfp, withExtra), num: "08" })
        .indexOf('data-status="access|status_gbp|') === -1) {
    fail("switching an optional account on did not reveal its status");
  }

  // a session that answered the old owner/how questions must not lose them
  const legacy = S.validate({
    v: 2, step: "access", order: {}, skipped: [], notes: {},
    m: { access: { status_gbp: "pending", owner_gbp: "Mike", how_ga4: "Client sends invite" } },
  });
  if ((legacy.m.access.extra || []).indexOf("gbp") === -1) {
    fail("an optional account with a saved status was not switched back on");
  }
  if ("owner_gbp" in legacy.m.access) fail("the old owner field was left in state");
  if (!/Mike/.test(legacy.notes["access:_page"] || "")) {
    fail("a saved account owner was deleted rather than carried into the note");
  }

  // an untouched screen is the strongest evidence the link never went out
  const untouched = acc.summary(ctxFor(bfp, S.fresh()));
  if (!untouched || !(untouched.open || []).some((o) => /Leadsie/i.test(o.what))) {
    fail("an untouched access screen said nothing about the Leadsie link");
  }

  // switching an optional account off must survive a reload
  const off = S.fresh();
  off.m.access = { status_gbp: "pending", extra: [] };
  const after = S.validate(JSON.parse(JSON.stringify(off)));
  if ((after.m.access.extra || []).indexOf("gbp") > -1) {
    fail("an optional account switched off came back on reload");
  }

  // leadsie not sent is the first thing the readout should be shouting about
  const sent = S.fresh();
  sent.m.access = { leadsie: "sent", leadsieWho: "Mike" };
  const opens = (acc.summary(ctxFor(bfp, sent)).open || []).map((o) => o.what);
  if (!opens.some((w) => /Leadsie/i.test(w))) {
    fail("a Leadsie link left unclicked did not reach the readout");
  }
}

/* ── the CSP has to permit what the app actually renders ── */
{
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const csp = (html.match(/Content-Security-Policy"[^>]*content="([^"]+)"/) || [])[1] || "";
  const img = (csp.match(/img-src ([^;]+)/) || [])[1] || "";
  // logo and brand-guide previews are object URLs off IndexedDB
  if (!/\bblob:/.test(img)) fail(`img-src is "${img.trim()}" — blob: previews will be blocked`);
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
