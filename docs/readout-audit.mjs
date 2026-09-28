// Consumer audit: a fully filled kickoff, every sentinel traced into every output.
const ROOT = new URL("../", import.meta.url).pathname;
const S = await import(ROOT + "js/state.js");
const REG = await import(ROOT + "js/modules/index.js");
const T = await import(ROOT + "js/trades/index.js");
const TR = await import(ROOT + "js/transcript.js");
const fs = await import("node:fs");
const client = JSON.parse(fs.readFileSync(ROOT + "clients/bfp-kc.json", "utf8"));
let MODE = "kickoff";
let reg = REG.KICKOFF;
const ctxFor = (st) => ({ state: st, client, transient: {}, slug: "bfp-kc", mismatch: [], modules: reg, num: "01", mode: MODE });

// ── discovery of keys, as in audit.mjs ──
function harvest(html, id) {
  const o = { text: new Set(), num: new Set(), chips: new Map(), toggles: new Set(), rows: new Map(), scales: new Set() };
  for (const m of html.matchAll(/data-slnum="([a-z]+)\|([A-Za-z0-9_]+)"/g)) if (m[1] === id) o.num.add(m[2]);
  for (const m of html.matchAll(/data-f="([a-z]+)\|([A-Za-z0-9_-]+)"/g)) if (m[1] === id && !o.num.has(m[2])) o.text.add(m[2]);
  for (const m of html.matchAll(/data-scale-field="([a-z]+)\|([A-Za-z0-9_]+)"/g)) if (m[1] === id) o.scales.add(m[2]);
  for (const m of html.matchAll(/data-(?:chip|status)="([a-z]+)\|([A-Za-z0-9_-]+)\|([^"]*)"([^>]*)/g)) {
    if (m[1] !== id) continue;
    if (!o.chips.has(m[2])) o.chips.set(m[2], { vals: new Set(), multi: /data-multi="1"/.test(m[4]) });
    o.chips.get(m[2]).vals.add(m[3]);
  }
  for (const m of html.matchAll(/data-toggle="([a-z]+)\|([A-Za-z0-9_]+)"/g)) if (m[1] === id) o.toggles.add(m[2]);
  for (const m of html.matchAll(/data-row="([a-z]+)\|([A-Za-z0-9_]+)\|(\d+)\|([A-Za-z0-9_]+)"/g)) {
    if (m[1] !== id) continue; if (!o.rows.has(m[2])) o.rows.set(m[2], new Set()); o.rows.get(m[2]).add(m[4]);
  }
  for (const m of html.matchAll(/data-addrow="([a-z]+)\|([A-Za-z0-9_]+)"/g)) if (m[1] === id && !o.rows.has(m[2])) o.rows.set(m[2], new Set());
  return o;
}
const merge = (a, b) => {
  for (const k of ["text", "num", "toggles", "scales"]) for (const x of b[k]) a[k].add(x);
  for (const [k, v] of b.chips) { if (!a.chips.has(k)) a.chips.set(k, { vals: new Set(), multi: v.multi }); for (const x of v.vals) a.chips.get(k).vals.add(x); }
  for (const [k, v] of b.rows) { if (!a.rows.has(k)) a.rows.set(k, new Set()); for (const x of v) a.rows.get(k).add(x); }
};
const render = (mod, st) => { try { return mod.render(ctxFor(st)); } catch (e) { return ""; } };
function discover(mod) {
  const all = harvest(render(mod, S.fresh(MODE)), mod.id); const best = {};
  for (let r = 0; r < 3; r++) {
    const base = S.fresh(MODE); base.m[mod.id] = {};
    for (const [k] of all.rows) base.m[mod.id][k] = [{}];
    for (const t of all.toggles) base.m[mod.id][t] = true;
    merge(all, harvest(render(mod, base), mod.id));
    for (const [k, c] of [...all.chips]) {
      let top = -1;
      for (const v of c.vals) {
        if (v === "") continue;
        const st = JSON.parse(JSON.stringify(base)); st.m[mod.id][k] = c.multi ? [v] : v;
        const h = harvest(render(mod, st), mod.id);
        const n = h.text.size + h.num.size + h.chips.size + h.toggles.size + h.rows.size;
        if (n > top) { top = n; best[k] = v; } merge(all, h);
      }
    }
  }
  return { all, best };
}


/**
 * Fill every screen in a document with a traceable answer and follow each
 * one into every output the readout produces.
 *
 * Presence is checked for typed answers; a CHOICE is checked by changing
 * it and seeing the output change, so the readout's wording never has to
 * match the chip's.
 *
 * @returns {{ count, gaps: string[], leaks: string[] }}
 */
export function auditReadout(mode) {
  MODE = mode; reg = mode === "discovery" ? REG.DISCOVERY : REG.KICKOFF;

  const st = S.fresh(MODE);
  const sentinels = [];
  const choices = [];      // [module, key, alternative value]                  // [module, what, needle, kind]  kind: field|note|item
  let seq = 0;
  const tag = (p) => "Zq" + p + (++seq) + "x";
  
  for (const mod of reg) {
    if (["readout", "intro", "services", "locations", "transcript"].includes(mod.id)) continue;
    const { all, best } = discover(mod);
    const m = st.m[mod.id] = {};
    for (const k of all.text) { const v = tag("t"); m[k] = v; sentinels.push([mod.id, k, v, "field"]); }
    for (const k of all.num) { const v = String(90000 + (++seq) * 131); m[k] = v; sentinels.push([mod.id, k, v, "number"]); }
    for (const k of all.scales) m[k] = "83";
    for (const k of all.toggles) m[k] = true;
    for (const [k, c] of all.chips) {
      if (/^prio_/.test(k)) continue;
      m[k] = c.multi ? [...c.vals].filter(Boolean) : (best[k] || [...c.vals].find(Boolean));
    }
    for (const [k, c] of all.chips) {
      if (/^prio_/.test(k) || c.multi) continue;
      // Differential, so the readout's wording never has to match the
      // chip's: this is flipped later and every output must change.
      const other = [...c.vals].find((v) => v && v !== m[k]);
      if (other) choices.push([mod.id, k, other]);
    }
    for (const [k, cols] of all.rows) {
      const row = {}; for (const c of cols) { row[c] = tag("r"); sentinels.push([mod.id, k + "." + c, row[c], "field"]); }
      m[k] = [row];
    }
    // a page note on every screen
    const note = tag("n"); st.notes[mod.id + ":_page"] = note; sentinels.push([mod.id, "page note", note, "note"]);
  }
  
  // services — through the real API
  {
    const trades = ["plumbing"]; st.m.services = { trades };
    const objs = trades.map(T.getTrade).filter(Boolean);
    const on = S.serviceUniverse(st, client, objs).filter((x) => x.on);
    S.setPriority(st, [on[0].id], "high"); S.setPriority(st, [on[1].id], "med"); S.setPriority(st, [on[2].id], "low");
    const withSubs = on.find((x) => x.subs.length > 1);
    if (withSubs) S.toggleSub(st, "services", withSubs.id, withSubs.subs[0].name);
    const addName = tag("svc"); S.addItem(st, "services", { id: "custom-" + seq, name: addName, subs: [] });
    sentinels.push(["services", "added service", addName, "item"]);
    sentinels.push(["services", "high-priority service", on[0].name, "item"]);
    // The LAST unranked service, so capping the list anywhere drops it.
  const unrankedSvc = S.serviceUniverse(st, client, objs).filter((x) => x.on && !x.prio);
  sentinels.push(["services", "last unprioritised service", unrankedSvc[unrankedSvc.length - 1].name, "item"]);
    if (withSubs) sentinels.push(["services", "dropped sub-service", withSubs.subs[0].name, "item"]);
    const sn = tag("sn"); st.notes["services:" + on[0].id] = sn; sentinels.push(["services", "note on a service", sn, "note"]);
    const pn = tag("n"); st.notes["services:_page"] = pn; sentinels.push(["services", "page note", pn, "note"]);
  }
  // locations — through the real API
  {
    const all = S.locationUniverse(st, client, []).filter((x) => x.on);
    st.m.locations = st.m.locations || {}; st.m.locations.base = "Zqbase9x Overland Park, KS"; st.m.locations.radius = 35;
    sentinels.push(["locations", "base address", "Zqbase9x", "field"]);
    S.setLocationPriority(st, all[0].id, "high"); S.setLocationPriority(st, all[1].id, "med");
    S.toggleExcluded(st, all[4].id, all[4]);
    sentinels.push(["locations", "high-priority city", all[0].name, "item"]);
    sentinels.push(["locations", "do-not-market city", all[4].name, "item"]);
    const unrankedLoc = S.locationUniverse(st, client, []).filter((x) => x.on && !x.prio);
  sentinels.push(["locations", "last unprioritised city", unrankedLoc[unrankedLoc.length - 1].name, "item"]);
    const ln = tag("ln"); st.notes["locations:" + all[0].id] = ln; sentinels.push(["locations", "note on a city", ln, "note"]);
    const pn = tag("n"); st.notes["locations:_page"] = pn; sentinels.push(["locations", "page note", pn, "note"]);
  }
  // the recording
  {
    const q1 = tag("qa"), q2 = tag("qu"), un = tag("un"), ms = tag("ms");
    st.m.transcript = {
      recSummary: TR.readTranscript({ title: "Zqcall1x", duration: 40, sentences: [{ speaker_name: "Mike", text: "a b", start_time: 0, end_time: 9 }] }),
      extract: TR.readExtract({ schema: "ss-extract/1",
        quotes: [{ speaker: "Mike", at: "0:05", text: q1 }, { speaker: "Mike", at: "0:09", text: q2 }],
        services: [ms], unclear: [un] }, new Set(reg.map((m) => m.id))),
      approved: ["q0"], applied: [],
    };
    sentinels.push(["transcript", "approved quote", q1, "quote-ok"]);
    sentinels.push(["transcript", "unapproved quote", q2, "quote-no"]);
    sentinels.push(["transcript", "unanswered question", un, "internal"]);
    sentinels.push(["transcript", "service mentioned", ms, "internal"]);
    sentinels.push(["transcript", "call title", "Zqcall1x", "field"]);
  }
  
  // ── every consumer ──
  const readout = reg.find((m) => m.id === "readout");
  const api = readout.exports(ctxFor(st));
  const html = (tab) => readout.render({ ...ctxFor(st), transient: { readout: { tab } } });
  const txt = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  const briefHtml = html("brief");
  const printdoc = briefHtml.slice(briefHtml.indexOf('<div class="printdoc">'));
  const screenBrief = briefHtml.slice(0, briefHtml.indexOf('<div class="printdoc">'));
  const outs = {
    "internal brief (screen)": txt(screenBrief),
    "client PDF": txt(printdoc),
    "brief as text": api.brief(),
    "Markdown": api.md(),
    "JSON payload": api.json(),
  };
  const has = (hay, needle, kind) => kind === "number"
    ? hay.replace(/,/g, "").indexOf(needle) > -1
    : hay.indexOf(needle) > -1;
  
  // policy: the client PDF must NOT carry notes or unapproved quotes; everything else everywhere
  // What the client must NOT read: Sam's notes (page and item), quotes
  // nobody approved, and the internal to-do list the recording produced.
  const INTERNAL_ONLY = new Set(["note", "quote-no", "internal"]);
  const expectIn = (kind, out) => {
    if (out === "client PDF") return INTERNAL_ONLY.has(kind) ? false : true;
    if (kind === "choice" && out === "JSON payload") return "either";   // payload stores the code, not the label
    return true;
  };
  const gaps = {}; const leaks = [];
  for (const [mod, what, needle, kind] of sentinels) {
    for (const [out, hay] of Object.entries(outs)) {
      const want = expectIn(kind, out), got = has(hay, needle, kind);
      if (want === true && !got) (gaps[out] = gaps[out] || []).push(`${mod}: ${what}`);
      if (want === false && got) leaks.push(`${out} carries ${mod}: ${what}`);
    }
  }
  
  const gapList = [];
  for (const [o, g] of Object.entries(gaps)) for (const x of g) gapList.push(o + " is missing " + x);

  // choices: flip each one; every internal output must notice
  for (const [mod, key, alt] of choices) {
    const st2 = JSON.parse(JSON.stringify(st)); st2.m[mod][key] = alt;
    const api2 = readout.exports(ctxFor(st2));
    for (const [label, a, b] of [["brief as text", api.brief(), api2.brief()], ["Markdown", api.md(), api2.md()]]) {
      if (a === b) gapList.push(`${label} does not change when ${mod}.${key} changes — that choice never reaches it`);
    }
  }
  // The payload is read by a machine, and `display` is explicitly the copy
  // for showing a person. A note that only survives there has not reached
  // the OS — it has to be on the item itself.
  const pay = JSON.parse(api.json());
  for (const [mod, what, needle] of sentinels.filter((x) => x[1] === "note on a service" || x[1] === "note on a city")) {
    const items = mod === "services" ? pay.services.items : pay.locations.items;
    if (!items.some((it) => it.note === needle)) {
      gapList.push(`JSON payload carries the ${what} only in \`display\`, not on the item the OS reads`);
    }
  }
  return { count: sentinels.length + choices.length, gaps: gapList, leaks };
}

// Run by hand for the full table:  node docs/readout-audit.mjs
if (import.meta.url === "file://" + process.argv[1]) {
  for (const mode of ["kickoff", "discovery"]) {
    const r = auditReadout(mode);
    console.log(`${mode}: ${r.count} answers traced — ${r.gaps.length} gap(s), ${r.leaks.length} leak(s)`);
    for (const g of r.gaps) console.log("  gap   " + g);
    for (const l of r.leaks) console.log("  LEAK  " + l);
  }
}
