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
const { readTranscript, readExtract } = await import(url("js/transcript.js"));
const TRADES_BEFORE_RUN = TRADE_SNAPSHOT();

const S = await import(url("js/state.js"));
const REG = await import(url("js/modules/index.js"));
const MODULES = REG.KICKOFF;              // the original document
const DISCOVERY = REG.DISCOVERY;          // the sales call
const ALL_MODULES = REG.ALL;              // every module in either, once
const REGISTRIES = [["kickoff", MODULES], ["discovery", DISCOVERY]];
const MODES = await import(url("js/modes.js"));

const bfp = JSON.parse(readFileSync(path.join(ROOT, "clients/bfp-kc.json"), "utf8"));
const tpl = JSON.parse(readFileSync(path.join(ROOT, "clients/template.json"), "utf8"));

/* ── registry sanity ──────────────────────────────────── */

const files = readdirSync(path.join(ROOT, "js/modules"))
  .filter((f) => /^\d\d-/.test(f)).sort();
// Screens the sales call keeps a frozen copy of. Same id, same state keys,
// its own file — see js/modules/discovery/.
const forked = readdirSync(path.join(ROOT, "js/modules/discovery"))
  .filter((f) => /^\d\d-/.test(f)).sort();

/** module id -> its file, so a check can re-import one for its exports. */
const FILE_OF = {};
for (const m of ALL_MODULES) {
  const hit = files.find((f) => f.replace(/^\d\d-|\.js$/g, "") === m.id.toLowerCase());
  if (hit) FILE_OF[m.id] = hit;
}
// The union, not either registry on its own — a module file that only the
// sales call uses is still a module file, and a file in neither registry
// is dead weight nobody will notice.
if (files.length + forked.length !== ALL_MODULES.length) {
  fail(`the two registries list ${ALL_MODULES.length} distinct modules but ${files.length + forked.length} module files exist`);
}

for (const [mode, list] of REGISTRIES) {
  const ids = new Set();
  for (const m of list) {
    if (!m || typeof m !== "object") { fail(`${mode}: registry contains a non-module`); continue; }
    for (const k of ["id", "nav", "title"]) {
      if (typeof m[k] !== "string" || !m[k]) fail(`${mode}/${m.id || "?"}: missing ${k}`);
    }
    if (typeof m.render !== "function") fail(`${mode}/${m.id}: render is not a function`);
    if (typeof m.status !== "function") fail(`${mode}/${m.id}: status is not a function`);
    if (ids.has(m.id)) fail(`${mode}: duplicate module id "${m.id}"`);
    ids.add(m.id);
  }
}

/* ── the two documents are the documents they claim to be ── */
//
// Pinned BY NAME, deliberately. Deriving this list from the registry
// would make it agree with whatever the registry happens to say, which
// is not a test of anything. These are the decisions, written down: what
// is on the sales call, and what must never be.
{
  const disc = new Set(DISCOVERY.map((m) => m.id));
  const kick = new Set(MODULES.map((m) => m.id));

  for (const id of ["intro", "whynow", "company", "goals", "marketing",
                    "competitors", "services", "locations", "readout"]) {
    if (!disc.has(id)) fail(`discovery lost the "${id}" screen`);
  }
  // Nothing that only exists because someone has signed.
  for (const id of ["brand", "access"]) {
    if (disc.has(id)) fail(`"${id}" is on the sales call — it only makes sense after they sign`);
    if (!kick.has(id)) fail(`the kickoff lost the "${id}" screen`);
  }
  if (kick.has("whynow")) fail('"whynow" is in the kickoff registry — it is a discovery screen');

  // A screen in both documents may be the same object or a deliberate
  // fork. What matters is not whether the two render the same inputs —
  // fields can be gated behind another answer, so markup alone says
  // little — but whether an answer given on the sales call SURVIVES the
  // handoff. So this replays it: write a value into every key the sales
  // call renders, export, import, and look for it on the other side.
  const keysRendered = (mod, reg, mode) => {
    let html = "";
    try {
      html = mod.render({
        state: S.fresh(mode), client: bfp, transient: {}, slug: "bfp-kc",
        mismatch: [], modules: reg, num: "01", mode: mode,
      });
    } catch (e) { return null; }
    const out = new Set();
    for (const hit of html.matchAll(/data-(?:f|chip|status|toggle)="([a-z]+)\|([A-Za-z0-9_]+)/g)) {
      if (hit[1] === mod.id) out.add(hit[2]);
    }
    return out;
  };

  {
    const IMPORTER = await import(url("js/import.js"));
    const st = S.fresh("discovery");
    const written = [];
    for (const m of DISCOVERY) {
      if (m.id === "whynow" || m.id === "readout" || m.id === "transcript") continue;
      const twin = MODULES.find((k) => k.id === m.id);
      if (!twin || twin === m) continue;              // shared object cannot drift
      const keys = keysRendered(m, DISCOVERY, "discovery");
      if (!keys) { fail(`"${m.id}" could not be rendered on the sales call`); continue; }
      const slot = st.m[m.id] || (st.m[m.id] = {});
      for (const k of keys) {
        if (/^(off|on|prio|added|snap|subsOff|trades|extra|custom|chan)$/.test(k)) continue;
        slot[k] = "SURVIVES-" + m.id + "-" + k;
        written.push([m.id, k]);
      }
    }
    if (written.length < 8) fail(`only ${written.length} forked keys were exercised — the handoff test proves little`);

    const payload = JSON.parse(DISCOVERY.find((m) => m.id === "readout").exports({
      state: st, client: bfp, transient: {}, slug: "bfp-kc",
      mismatch: [], modules: DISCOVERY, num: "09", mode: "discovery",
    }).json());
    const after = IMPORTER.importPayload(payload).state;

    // The handoff stash is for screens the kickoff does not have — an
    // answer to a screen it DOES have belongs on that screen, where it can
    // be read and corrected. Accepting either would let the whole module
    // fall into the stash and still look like it arrived.
    const kickoffIds = new Set(MODULES.map((m) => m.id));
    const lost = [];
    for (const [mod, key] of written) {
      const here = (after.m[mod] || {})[key];
      if (here !== undefined) continue;
      if (!kickoffIds.has(mod)) {
        const stashed = ((after.handoff && after.handoff.fields && after.handoff.fields[mod]) || {})[key];
        if (stashed !== undefined) continue;
      }
      lost.push(mod + "." + key);
    }
    if (lost.length) {
      fail(`answers given on the sales call do not survive the handoff: ${lost.join(", ")}`);
    }
  }
}

/* ── render against both clients ──────────────────────── */

function ctxFor(client, state, mode) {
  const m = mode || "kickoff";
  return {
    state, client, transient: {}, slug: client.slug, mismatch: [],
    mode: m, modules: REG.registryFor(m),
  };
}

// A hostile payload in every free-text position — nothing may reach the
// output un-escaped.
const XSS = '"><img src=x onerror=alert(1)>';

for (const [label, client] of [["bfp-kc", bfp], ["template", tpl]]) {
 for (const [mode, list] of REGISTRIES) {
  for (const m of list) {
    const state = S.fresh(mode);
    const before = JSON.stringify(state);
    let html;

    try {
      html = m.render(ctxFor(client, state, mode));
    } catch (e) {
      fail(`${mode}/${m.id} [${label}]: render threw — ${e.message}`);
      continue;
    }

    if (typeof html !== "string") { fail(`${mode}/${m.id} [${label}]: render returned ${typeof html}`); continue; }
    if (!html.trim()) fail(`${mode}/${m.id} [${label}]: render returned empty string`);
    if (/\bundefined\b/.test(html.replace(/data-[a-z]+="[^"]*"/g, ""))) {
      fail(`${mode}/${m.id} [${label}]: rendered the literal string "undefined"`);
    }

    // render must be pure — a module that writes to state corrupts autosave
    if (JSON.stringify(state) !== before) {
      warn(`${mode}/${m.id} [${label}]: render mutated state (slot() creates an empty branch — check it is only that)`);
    }

    // status must be a legal value and never "skipped"
    let st;
    try { st = m.status(ctxFor(client, state, mode)); }
    catch (e) { fail(`${mode}/${m.id} [${label}]: status threw — ${e.message}`); }
    if (st === "skipped") fail(`${m.id}: status() returned "skipped" — app.js owns that`);
    if (st && !["empty", "partial", "done"].includes(st)) fail(`${m.id}: bad status "${st}"`);

    // summary must be null or the documented shape
    if (m.summary) {
      let sum;
      try { sum = m.summary(ctxFor(client, state, mode)); }
      catch (e) { fail(`${mode}/${m.id} [${label}]: summary threw — ${e.message}`); }
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
}

/* ── the prospect is reading the screen ────────────────── */
//
// The defining constraint of the discovery document, and the single
// easiest thing to get wrong: the kickoff's help text is written TO Sam,
// ABOUT the client. "If they don't know, that itself is a finding" is a
// useful note on a kickoff call with a signed client. On a shared screen
// in front of a prospect it is the quiet part out loud.
//
// Two pins, and they work in opposite directions:
//
//   1. Every phrase below must STILL APPEAR somewhere in a kickoff
//      render. Without this half, deleting a line of kickoff copy would
//      quietly turn its pin into a tautology — a check that passes
//      because it is checking nothing is worse than no check.
//
//   2. No phrase below may appear ANYWHERE in a discovery render, for
//      either client, on any screen.
//
// Pinned by hand, verbatim. Deriving them from the COPY maps would only
// prove the maps agree with themselves.

const UNSAFE_FOR_A_PROSPECT = [
  // 02 goals
  "that itself is a finding",
  "Make them pick",
  "what we can afford to pay for a lead",
  "An average month, not their best one",
  "in their head",
  "If they won't name a number",
  "build to a cap or build to a return",
  "the reporting never becomes a fight",
  "Real numbers, not the ones on the website",
  "a precise dodge",
  "then regrets in month two",
  "Today, with the crew they have",
  "this is what gives",
  "In their words. This line ends up in the recap",
  "Where they are today",
  "Where they want to be",
  "What they can actually absorb",
  "If they could only keep one",
  "could they take?",
  // 03 marketing
  "Including the freelancer nobody counts as an agency",
  "the history doesn't come with us",
  "This is the sentence that tells you how to keep them",
  // 04 competitors
  "Threat level is their read, not ours",
  // 01 company
  "whether they can approve spend without asking anyone",
];

{
  // The field kit escapes on the way out, so compare on decoded text.
  const unesc = (h) => String(h)
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "’").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  const renderAll = (mode) => {
    const out = [];
    for (const client of [bfp, tpl]) {
      for (const m of REG.registryFor(mode)) {
        for (const st of [S.fresh(mode), (() => {
          // a half-filled session, so conditional blocks render too
          const x = S.fresh(mode);
          x.m.goals = { revNow: "120000", closeRate: "40", capacity: "10" };
          x.m.company = { emergency: true, contactName: "Mike" };
          x.m.marketing = { agency: "Someone", chan: ["google-ads"] };
          x.m.whynow = { whyNow: "Phone is quiet" };
          return x;
        })()]) {
          try { out.push({ id: m.id, html: unesc(m.render(ctxFor(client, st, mode))) }); }
          catch (e) { fail(`${mode}/${m.id}: render threw while sweeping copy — ${e.message}`); }
        }
      }
    }
    return out;
  };

  const kickoffHtml = renderAll("kickoff").map((r) => r.html).join("\n");
  const discoveryRenders = renderAll("discovery");

  for (const phrase of UNSAFE_FOR_A_PROSPECT) {
    if (kickoffHtml.indexOf(phrase) < 0) {
      fail(`pinned phrase "${phrase}" no longer appears in any kickoff screen — ` +
           `the pin guarding it against the discovery document now proves nothing`);
    }
    for (const r of discoveryRenders) {
      if (r.html.indexOf(phrase) > -1) {
        fail(`discovery/${r.id} renders "${phrase}" — that is written about the prospect, ` +
             `to Sam, on a screen the prospect is reading`);
        break;
      }
    }
  }

  // Every COPY entry must carry BOTH variants. A half-filled map falls
  // back to the kickoff wording silently, which is the exact failure the
  // phrase list above can only catch for phrases somebody remembered.
  for (const m of REG.registryFor("discovery")) {
    const file = FILE_OF[m.id];
    if (!file) continue;
    const mod = await import(url("js/modules/" + file));
    if (!mod.COPY) continue;
    for (const [key, entry] of Object.entries(mod.COPY)) {
      if (typeof entry === "string") {
        fail(`${m.id}: COPY.${key} is a bare string — give it {kickoff, discovery} or move it out of COPY`);
        continue;
      }
      for (const mode of ["kickoff", "discovery"]) {
        if (typeof entry[mode] !== "string" || !entry[mode]) {
          fail(`${m.id}: COPY.${key} has no ${mode} wording`);
        }
      }
      if (entry.kickoff === entry.discovery) {
        // Legal, and sometimes right — but say so on purpose.
        if (!entry.same) {
          warn(`${m.id}: COPY.${key} is identical in both documents (add \`same: true\` if that is deliberate)`);
        }
      }
    }
  }
}

/* ── nothing on the sales call talks ABOUT the person reading it ── */
//
// The pinned-phrase list above only catches strings somebody thought to
// pin. This catches the ones nobody did.
//
// The tell is grammatical. Kickoff copy is written to Sam about a client
// who is not in the room, so it says "they". On the sales call the client
// IS the room. Every visible string is swept for third person, and every
// hit has to be either fixed or listed below as a deliberate exception.
//
// Written after eleven live leaks got past the phrase list: a module
// title ("Who are they, on paper?"), most of two screens' ledes, and an
// intro line telling a prospect which of THEIR cities we were "ordering
// today". A list of remembered phrases cannot find the ones nobody
// remembered.
{
  // Third person is correct when the subject genuinely is not the reader:
  // their competitors, their old agency's ad accounts. Each is listed in
  // full, so widening the sweep is a decision somebody makes on purpose
  // rather than a regex quietly getting looser.
  const ABOUT_SOMEBODY_ELSE = [
    // competitors — "they" is the competitor
    "We look every one of these up after the call",
    "What do they do that you can't or won't match?",
    "Both halves matter. Can't is something to work around",
    "Mostly the two big franchises on brand search",
    "Same-day everything, and they'll eat the trip charge",
    "They took two of our commercial accounts last year",
    "Why they win",
    "Owns the map pack in the north suburbs",
    // marketing — "they" is the ad accounts
    "If they're in someone else's account, the history stays there when you leave",
    // "them" is the cities, and the leads, not the person reading
    "cities are listed with no page behind them",
    "Leads come in but half of them are price shoppers",
  ];

  const unesc = (h) => String(h)
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "’").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  const THIRD_PERSON = /\b(they|their|theirs|them|they're|they've|they'd)\b/i;

  /**
   * Visible strings: the text between tags, plus the placeholders, which
   * a prospect reads exactly as readily as anything else on the screen.
   * Split per tag boundary rather than per word — "of their 34 cities" is
   * only a leak as a phrase.
   */
  const visible = (html) => {
    const out = [];
    for (const run of html.replace(/<[^>]*>/g, "\n").split("\n")) {
      const t = unesc(run).replace(/\s+/g, " ").trim();
      if (t) out.push(t);
    }
    for (const m of html.matchAll(/placeholder="([^"]*)"/g)) {
      const t = unesc(m[1]).replace(/\s+/g, " ").trim();
      if (t) out.push(t);
    }
    return out;
  };

  const states = () => {
    const bare = S.fresh("discovery");
    const busy = S.fresh("discovery");
    // enough filled in that conditional blocks render too
    busy.m.company = { businessName: "Acme", emergency: true };
    busy.m.goals = { revNow: "120000", capacity: "10" };
    busy.m.marketing = { agency: "Lead Ninjas", chan: ["google-ads"] };
    busy.m.competitors = { rows: [{ name: "Anchor", domain: "anchor.com", why: "map pack", threat: "real" }] };
    busy.m.whynow = { whyNow: "Phone went quiet" };
    busy.m.locations = { base: "Kansas City, MO", radius: 30 };
    return [bare, busy];
  };

  const sweep = [];
  for (const client of [bfp, tpl]) {
    for (const st of states()) {
      for (const m of REG.DISCOVERY) {
        let html;
        try { html = m.render({ ...ctxFor(client, st, "discovery"), num: "01" }); }
        catch (e) { fail(`discovery/${m.id}: render threw during the third-person sweep — ${e.message}`); continue; }
        // A module does NOT render all of its own copy. app.js draws the
        // nav pill, and it draws the page-note box OUTSIDE .body — so its
        // prompt never appears in render() output and this sweep was
        // blind to it. Seven prompts got through that way, including
        // "the pauses, the number they hesitated on, who they blamed"
        // sitting at the foot of every screen on a shared call.
        const chrome = ["nav", "title", "lede", "notePrompt"]
          .map((k) => MODES.variant(m, "discovery", k))
          .filter((x) => typeof x === "string" && x);
        sweep.push({ id: m.id, lines: visible(html).concat(chrome.map((c) => unesc(c))) });
      }
    }
  }

  const leaks = [];
  for (const r of sweep) {
    for (const line of r.lines) {
      if (!THIRD_PERSON.test(line)) continue;
      if (ABOUT_SOMEBODY_ELSE.some((ok) => line.indexOf(ok) > -1)) continue;
      const key = r.id + " :: " + line;
      if (leaks.indexOf(key) < 0) leaks.push(key);
    }
  }
  for (const l of leaks.slice(0, 20)) {
    fail(`discovery copy talks about the prospect in the third person — ${l}`);
  }
  if (leaks.length > 20) fail(`…and ${leaks.length - 20} more third-person strings on the sales call`);

  // The exceptions must still be reachable, or they are stale entries
  // quietly widening the sweep. Same two-sided rule as the phrase pins.
  const everything = sweep.flatMap((r) => r.lines).join("\n");
  for (const ok of ABOUT_SOMEBODY_ELSE) {
    if (everything.indexOf(ok) < 0) {
      fail(`"${ok}" is listed as a deliberate third-person exception, but nothing on the sales ` +
           `call renders it — remove it rather than leaving the sweep wider than it needs to be`);
    }
  }
}

/* ── the sales call asks nothing that needs a signature ── */
//
// Pinned by field key, not by counting cards. "The screen renders" is
// not the claim being made here; the claim is that six specific inputs
// are absent from it, and each one is named.
{
  const comp = REG.DISCOVERY.find((m) => m.id === "company");
  const disc = comp.render(ctxFor(bfp, S.fresh("discovery"), "discovery"));
  const kick = comp.render(ctxFor(bfp, S.fresh("kickoff"), "kickoff"));

  // Absent from the sales call…
  for (const key of ["contactName", "contactEmail", "contactPhone", "contactRole",
                     "billingName", "billingEmail", "billingPhone", "billingSame",
                     "phone", "trackingOk", "leadEmail", "bookingUrl",
                     "street", "city", "state", "zip", "hoursWeekday", "hoursWeekend"]) {
    if (disc.indexOf(`company|${key}`) > -1) {
      fail(`discovery/company still asks for "${key}" — that only exists after they sign`);
    }
    // …and still present on the kickoff, or the pin above proves nothing.
    if (kick.indexOf(`company|${key}`) < 0) {
      fail(`kickoff/company no longer asks for "${key}" — the discovery pin guarding it is now vacuous`);
    }
  }
  // What the sales call DOES keep. `radius` is deliberately absent from
  // both documents now — the Cities screen asks where they work, and a
  // second free-text answer to the same question in Company was one the
  // kickoff had nowhere to receive.
  for (const key of ["businessName", "website", "founded", "crews", "customerMix"]) {
    if (disc.indexOf(`company|${key}`) < 0) {
      fail(`discovery/company dropped "${key}" — it is worth knowing before anything is priced`);
    }
  }
  // An unasked question must not come back as an open item.
  const st = S.fresh("discovery");
  st.m.company = { businessName: "Acme" };
  const open = (comp.summary(ctxFor(bfp, st, "discovery")).open || []).map((o) => o.what);
  if (open.length) {
    fail(`discovery/company raised open items (${open.join(", ")}) for questions it never asked`);
  }
  const kst = S.fresh("kickoff");
  kst.m.company = { businessName: "Acme" };
  if (!(comp.summary(ctxFor(bfp, kst, "kickoff")).open || []).length) {
    fail("kickoff/company stopped raising open items — the discovery pin above is now vacuous");
  }
}

/* ── two documents, two localStorage namespaces ────────── */
//
// The trap this is here for: both modes are opened at `?c=bfp-kc`, and
// a single key would have the sales call and the kickoff call
// overwriting each other with no error and no undo.
{
  const k = S.storageKey("bfp-kc", "kickoff");
  const d = S.storageKey("bfp-kc", "discovery");
  if (k === d) fail("both documents share one localStorage key — one will silently eat the other");
  // The kickoff key must not move. Anything already saved on a laptop
  // lives at this exact string, and changing it is data loss with no
  // migration to catch it.
  if (k !== "ss-kickoff:bfp-kc") fail(`the kickoff storage key moved to "${k}" — every saved session on every laptop is now orphaned`);
  if (S.storageKey("bfp-kc") !== k) fail("storageKey() with no mode stopped meaning the kickoff");
  // A slug can never contain a colon, so these can never collide — but
  // assert it rather than reasoning about it.
  if (S.storageKey("discovery", "kickoff") === S.storageKey("x", "discovery")) {
    fail("a client slugged \"discovery\" collides with the discovery namespace");
  }
}

/* ── a link from the other document is refused, not half-read ── */
{
  const d = S.fresh("discovery");
  d.m.whynow = { whyNow: "Phone went quiet", broken: "No inbound" };
  d.m.goals = { revNow: "120000" };
  d.step = "whynow";

  if (S.validate(JSON.parse(JSON.stringify(d)), "kickoff") !== null) {
    fail("a discovery state validated as a kickoff — half its answers would land nowhere");
  }
  if (S.validate(JSON.parse(JSON.stringify(d)), "discovery") === null) {
    fail("a discovery state was refused by its own document");
  }
  // A state written before the second document existed carries no mode
  // and is a kickoff. It must still load.
  const legacy = S.fresh();
  delete legacy.mode;
  if (S.validate(legacy, "kickoff") === null) {
    fail("a saved state from before discovery existed no longer validates — every laptop loses its sessions");
  }
  if (S.validate(legacy, "discovery") !== null) {
    fail("a mode-less legacy state was accepted as discovery");
  }
  // Round-trips through the share fragment carrying its mode.
  const back = S.decode(S.encode(d));
  if (back.mode !== "discovery") fail("the share fragment does not carry which document it came from");
}

/* ── the handoff: a sales call replayed as a kickoff ───── */
//
// The one the prompt says will go wrong, so it is asserted BY ID at every
// step. Nothing here matches on a display name: a taxonomy label gets
// reworded roughly once a quarter and every name-based assertion passes
// happily while the data lands on the wrong row.
{
  const IMP = await import(url("js/import.js"));
  const readout = MODULES.find((m) => m.id === "readout");
  const svcMod = MODULES.find((m) => m.id === "services");

  // Build a discovery session the way a real call would: a trade picked,
  // a taxonomy-only service ticked High, a scraped service switched OFF,
  // a service typed in on the call, cities excluded and ranked, channels
  // rated, and free text on three screens.
  const d = S.fresh("discovery");
  d.m.company = { businessName: "Acme Plumbing & Drain", founded: "2011", crews: "6" };
  d.m.whynow = { whyNow: "Phone went quiet in March", broken: "Only price shoppers", liveBy: "30" };
  d.m.goals = { revNow: "120000", revTarget: "300000", avgTicket: "4300", closeRate: "30" };
  d.m.marketing = { agency: "Lead Ninjas", chan: ["google-ads"],
                    "rate_google-ads": "waste", "vol_google-ads": "40",
                    "note_google-ads": "Never saw a report" };
  d.notes["services:_page"] = "Wants water heaters led with";
  d.notes["whynow:_page"] = "Sounded genuinely done with the last lot";

  const trade = "plumbing";
  d.m.services = { trades: [trade] };
  const dctx = () => ctxFor(bfp, d, "discovery");

  // A taxonomy-only service: scoped id, ticked, High.
  const universe0 = S.serviceUniverse(d, bfp, [(await import(url("js/trades/index.js"))).getTrade(trade)].filter(Boolean));
  const taxOnly = universe0.find((x) => x.source === "trade");
  const scraped = universe0.find((x) => x.source === "both" || x.source === "scrape");
  if (!taxOnly || !scraped) {
    fail("could not build a discovery fixture — no taxonomy-only and scraped service found");
  } else {
    if (taxOnly.id.indexOf(":") < 0) {
      fail(`fixture assumption broken: taxonomy-only "${taxOnly.id}" is not trade-scoped`);
    }
    S.toggleService(d, taxOnly.id, true, { name: taxOnly.name, subs: taxOnly.subs.map((s2) => s2.name) });
    S.setPriority(d, taxOnly.id, "high");
    S.toggleService(d, scraped.id, false);          // switched OFF on the call
    S.addItem(d, "services", { id: "svc-typed-1", name: "Trenchless Sewer Repair", subs: ["Pipe bursting"] });
    S.setPriority(d, "svc-typed-1", "high");
    // A second one, typed in and then switched back off — "they mentioned
    // it, then said they don't really do it". Its OFF-ness is carried by
    // `off`, exactly as a scraped service's is, and nothing else records it.
    S.addItem(d, "services", { id: "svc-typed-2", name: "Septic Pumping", subs: [] });
    S.toggleService(d, "svc-typed-2", false);
    // BOTH high, so the bucket alone cannot decide which leads — only
    // state.order can. Ranking across two priority bands would pass with
    // the order thrown away entirely.
    d.order.services = ["svc-typed-1", taxOnly.id];

    // Cities: one scraped kept and ranked, one scraped excluded.
    const keep = bfp.locations[0].id;
    const drop = bfp.locations[1].id;
    S.setLocationPriority(d, keep, "high");
    S.setLocationPriority(d, bfp.locations[2].id, "med");
    S.toggleExcluded(d, drop, { name: bfp.locations[1].name });
    S.setField(d, "locations", "base", "Kansas City, MO");
    S.setField(d, "locations", "radius", 30);

    // A city that only exists because a radius search found it. This is
    // the trap: `source: "radius"` rows live in the universe ONLY while a
    // search is holding them in TRANSIENT state. Import one as a bare `on`
    // id and it selects nothing, silently, because the row is not there.
    // Bonner Springs is deliberately NOT in the client file — a radius city
    // that the scrape already knows about would dedupe into the scraped row
    // and prove nothing about radius handling.
    const nearby = [{ id: "bonner-springs-ks", name: "Bonner Springs", state: "KS", miles: 19, pop: 7800 }];
    S.toggleLocation(d, "bonner-springs-ks", true);
    S.setLocationPriority(d, "bonner-springs-ks", "high");
    // And one typed in on the call.
    S.addLocations(d, [{ id: "loc-typed-1", name: "Parkville", state: "MO" }]);
    // The radius city ranked FIRST, ahead of a scraped one. Both are high,
    // and the universe lists scraped cities before radius ones — so ranking
    // them the other way round is the only thing that can produce this
    // order, and throwing the order away cannot reproduce it by accident.
    d.order.locations = ["bonner-springs-ks", keep];

    const dctxN = () => ({ ...ctxFor(bfp, d, "discovery"), transient: { locations: { nearby: nearby } } });
    const payload = JSON.parse(readout.exports(dctxN()).json());
    if (!payload.locations.items.some((x) => x.id === "bonner-springs-ks" && x.source === "radius")) {
      fail("fixture assumption broken: no radius-sourced city reached the payload");
    }

    if (payload.mode !== "discovery") fail(`the discovery export is stamped mode "${payload.mode}"`);

    const { state: k, warnings } = IMP.importPayload(payload);
    if (warnings.length) warn(`importer warned: ${warnings.join(" | ")}`);

    /* — the assertion the prompt asks for, by id — */
    const kTrades = Array.isArray(k.m.services.trades) ? k.m.services.trades : [];
    if (kTrades.indexOf(trade) < 0) fail(`the trade "${trade}" did not survive the handoff`);

    const kUni = S.serviceUniverse(k, bfp, [(await import(url("js/trades/index.js"))).getTrade(trade)].filter(Boolean));
    const byId = new Map(kUni.map((x) => [x.id, x]));

    const arrivedTax = byId.get(taxOnly.id);
    if (!arrivedTax) {
      fail(`taxonomy service ${taxOnly.id} is not in the kickoff universe at all after the handoff`);
    } else {
      if (!arrivedTax.on) fail(`${taxOnly.id} arrived in the kickoff UNSELECTED — it was ticked on the sales call`);
      if (arrivedTax.prio !== "high") fail(`${taxOnly.id} arrived with priority "${arrivedTax.prio}", not high`);
    }
    // The snapshot is what keeps it alive through a trade change. Assert
    // it survives that, not merely that the id is in `on`.
    const noTrade = JSON.parse(JSON.stringify(k));
    noTrade.m.services.trades = ["hvac"];
    const afterSwap = S.serviceUniverse(noTrade, bfp, [(await import(url("js/trades/index.js"))).getTrade("hvac")].filter(Boolean));
    const stillThere = afterSwap.find((x) => x.id === taxOnly.id || (x.aliases || []).indexOf(taxOnly.id) > -1);
    if (!stillThere) fail(`${taxOnly.id} vanished when the trade changed — its snap entry did not survive the handoff`);

    const arrivedScraped = byId.get(scraped.id);
    if (!arrivedScraped) fail(`scraped service ${scraped.id} is missing from the kickoff universe`);
    else if (arrivedScraped.on) {
      fail(`${scraped.id} arrived SELECTED — it was switched off on the sales call, and \`off\` is what carries that`);
    }

    const typed = byId.get("svc-typed-1");
    if (!typed) fail("a service typed on the sales call did not survive the handoff");
    else {
      if (!typed.on) fail("the typed-in service arrived unselected");
      if (typed.prio !== "high") fail(`the typed-in service arrived with priority "${typed.prio}"`);
      if (typed.source !== "added") fail(`the typed-in service arrived as source "${typed.source}", not added`);
      if (typed.name !== "Trenchless Sewer Repair") fail("the typed-in service lost its name");
    }
    const typedOff = byId.get("svc-typed-2");
    if (!typedOff) fail("a service typed on the call and then switched off vanished entirely — " +
                        "it must survive as a row that is off, not disappear");
    else if (typedOff.on) fail("svc-typed-2 arrived SELECTED — it was switched off on the sales call");
    // Its id must be the SAME id, not one regenerated from the name —
    // every note and priority in the payload hangs off the original.
    if ((k.m.services.added || []).some((x) => x.id !== "svc-typed-1" && x.name === "Trenchless Sewer Repair")) {
      fail("the typed-in service was re-ided on import — its notes and priority are orphaned");
    }

    /* — build order, by id — */
    const kOrder = S.serviceOrder(k, bfp, [(await import(url("js/trades/index.js"))).getTrade(trade)].filter(Boolean))
      .map((x) => x.id);
    if (kOrder[0] !== "svc-typed-1" || kOrder[1] !== taxOnly.id) {
      fail(`the kickoff build order is [${kOrder.slice(0, 2).join(", ")}], not ` +
           `[svc-typed-1, ${taxOnly.id}] — two services share the high band, so this is rank, not bucketing`);
    }

    /* — cities — */
    const kLoc = S.locationUniverse(k, bfp, []);
    const locById = new Map(kLoc.map((x) => [x.id, x]));
    if (!locById.get(keep) || !locById.get(keep).on) fail(`city ${keep} did not arrive selected`);
    if (locById.get(keep) && locById.get(keep).prio !== "high") fail(`city ${keep} lost its priority`);
    if (!locById.get(drop) || !locById.get(drop).excluded) {
      fail(`city ${drop} did not arrive excluded — "do not market here" was lost`);
    }
    // Imported with NO radius search running — exactly the state the
    // kickoff opens in before suggestBase() has finished, and the moment a
    // bare `on` id would resolve to nothing.
    const radiusCity = locById.get("bonner-springs-ks");
    if (!radiusCity) {
      fail("a city found by radius search on the sales call is not in the kickoff universe at all — " +
           "it was imported as a bare `on` id, which resolves to nothing without a live search");
    } else {
      if (!radiusCity.on) fail("the radius city arrived unselected");
      if (radiusCity.prio !== "high") fail("the radius city lost its priority");
      if (radiusCity.name !== "Bonner Springs") fail("the radius city lost its name");
    }
    if (!locById.get("loc-typed-1") || !locById.get("loc-typed-1").on) {
      fail("a city typed in on the sales call did not arrive selected");
    }
    if (locById.get(bfp.locations[2].id) && locById.get(bfp.locations[2].id).prio !== "med") {
      fail("a medium-priority city did not keep its priority through the handoff");
    }
    const kLocOrder = S.locationOrder(k, bfp, []).map((x) => x.id);
    if (kLocOrder[0] !== "bonner-springs-ks" || kLocOrder[1] !== keep) {
      fail(`the city build order is [${kLocOrder.slice(0, 2).join(", ")}], not ` +
           `[bonner-springs-ks, ${keep}] — both are high, so this is rank, not bucketing`);
    }
    if (S.locState(k).base !== "Kansas City, MO") fail("baseAddress did not rebuild into `base`");
    if (S.locState(k).radius !== 30) fail("radiusMiles did not rebuild into `radius`");

    /* — marketing: the block that is not named after its module — */
    const mk = k.m.marketing || {};
    if (!Array.isArray(mk.chan) || mk.chan.indexOf("google-ads") < 0) {
      fail("channel selections did not rebuild into marketing.chan — the whole `what's running today` picture is gone");
    }
    if (mk["rate_google-ads"] !== "waste") fail("a channel RATING did not survive the handoff");
    if (mk["vol_google-ads"] !== "40") fail("a channel lead VOLUME did not survive the handoff");
    if (mk["note_google-ads"] !== "Never saw a report") fail("a per-channel NOTE did not survive the handoff");
    if (mk.agency !== "Lead Ninjas") fail("fields.marketing did not replay alongside the channels block");

    /* — plain fields and notes — */
    if ((k.m.goals || {}).revTarget !== "300000") fail("fields.goals did not replay");
    if ((k.m.company || {}).businessName !== "Acme Plumbing & Drain") fail("fields.company did not replay");
    if (k.notes["services:_page"] !== "Wants water heaters led with") fail("a page note did not replay");

    /* — the screen the kickoff does not have — */
    if (k.m.whynow) {
      fail("`whynow` was replayed into state.m, where no kickoff module resolves it — " +
           "invisible on screen and dropped from the next export");
    }
    if (!k.handoff || k.handoff.from !== "discovery") fail("the imported state does not record where it came from");
    if (!k.handoff.fields.whynow || k.handoff.fields.whynow.whyNow !== "Phone went quiet in March") {
      fail("the `why now` answers did not survive into handoff");
    }
    if (k.handoff.notes.whynow !== "Sounded genuinely done with the last lot") {
      fail("the `why now` page note did not survive into handoff");
    }
    if (k.handoff.name !== "Acme Plumbing & Drain") {
      fail(`handoff.name is "${k.handoff.name}" — the name they typed must beat an empty client.name`);
    }

    /* — things that must NOT carry across — */
    if (k.step !== MODULES[0].id) fail(`the imported state opens on "${k.step}" instead of the first kickoff screen`);
    if (k.mode !== "kickoff") fail("the imported state is not stamped as a kickoff");
    if (S.validate(JSON.parse(JSON.stringify(k)), "kickoff") === null) {
      fail("the imported state does not survive validate() — it cannot be saved or shared");
    }
    if (!S.validate(JSON.parse(JSON.stringify(k)), "kickoff").handoff) {
      fail("validate() strips `handoff` — every sales-call answer is lost on the first reload");
    }

    // Migration stamps are shared across both documents. A new stamp that
    // means one thing in discovery and another in the kickoff corrupts one
    // of them, so the known set is pinned.
    const stamps = Object.keys(S.fresh().mig).sort().join(",");
    // `billing` is safe in both: the contact block only renders once
    // they've signed, so the sales call never writes billingSame at all.
    if (stamps !== "access,billing,rank") {
      fail(`migration stamps are now "${stamps}" — both documents share this namespace, so a new ` +
           `stamp must be checked against the other before it is added`);
    }
  }

  // Garbage in is refused, not half-applied.
  for (const junk of [null, 42, "hello", [], {}, { schema: "something-else/1" }]) {
    let threw = false;
    try { IMP.importPayload(junk); } catch (e) { threw = true; }
    if (!threw) fail(`importPayload accepted ${JSON.stringify(junk)} as a payload`);
  }
  // A kickoff payload is a legal thing to import; it just says so.
  {
    const kst = S.fresh("kickoff");
    kst.m.goals = { revNow: "90000" };
    const kp = JSON.parse(readout.exports(ctxFor(bfp, kst)).json());
    const r = IMP.importPayload(kp);
    if (!r.warnings.some((w) => /kickoff, not a sales call/.test(w))) {
      fail("importing a kickoff payload did not warn that it came from the wrong document");
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
        "ss-kickoff/5": {
          // map<T> — dynamic keys (module ids), every value of type T.
          // array<T> — every element of type T. Both are unchecked without
          // the parameter: `skipped: "array"` passes on an array of objects.
          "": { schema: "string", mode: "string", build: "string", capturedAt: "string", client: "object",
                progress: "map<string>", skipped: "array<string>", fields: "map<object>",
                services: "object", locations: "object", channels: "array<object>",
                access: "object", notes: "map<string>", recording: "object|null",
                openItems: "array<object>",
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
          "recording": { file: "object|null", call: "object|null", readout: "object|null",
                quotes: "array<object>", applied: "array<string>", unused: "array<object>",
                mentionedServices: "array<string>", mentionedCities: "array<string>",
                unclear: "array<string>" },
          "recording.file": { name: "string", size: "number" },
          "recording.call": { title: "string", date: "string", durationMin: "number",
                turns: "number", speakers: "array<object>", talkShare: "array<object>",
                lastAt: "string" },
          "recording.call.speakers[]": { name: "string", turns: "number" },
          "recording.call.talkShare[]": { name: "string", pct: "number" },
          "recording.readout": { title: "string", date: "string", durationMin: "number",
                participants: "array<string>" },
          "recording.quotes[]": { speaker: "string", at: "string", text: "string",
                module: "string", approved: "boolean" },
          "recording.unused[]": { module: "string", key: "string", value: "string" },
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
      {
        // Long enough to cross the talk-share threshold, so that pin is
        // exercised rather than warned about.
        const line = (who, n) => ({ speaker_name: who, text: new Array(n).fill("word").join(" "),
          start_time: 0, end_time: 600 });
        rich.m.transcript = {
          rec: { name: "call.json", type: "application/json", size: 128000, at: 1 },
          recSummary: readTranscript({ title: "Discovery", date: "2026-08-27", duration: 41,
            sentences: [line("Mike Reyes", 180), line("Sam Preston", 90)] }),
          extract: readExtract({
            schema: "ss-extract/1",
            call: { title: "Discovery", date: "2026-08-27", durationMin: 42, participants: ["Sam Preston"] },
            // Two proposals: one applied, one not, so "applied" and
            // "unused" are both non-empty and their element pins are
            // actually exercised rather than warned about.
            fields: { goals: { revNow: "120000", revTarget: "400000" } },
            quotes: [{ speaker: "Mike Reyes", at: "0:05", text: "Angi is killing us.", module: "marketing" }],
            services: ["Drains"], cities: ["Olathe, KS"], unclear: ["no close rate"],
          }, new Set(MODULES.map((m) => m.id))),
          approved: ["q0"],
          applied: ["goals.revNow"],
        };
      }
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

/* ── the kickoff changes, screen by screen ─────────────── */
{
  const keysOf = (mod, reg, mode, state) => {
    let html = "";
    try {
      html = mod.render({
        state: state || S.fresh(mode), client: bfp, transient: {}, slug: "bfp-kc",
        mismatch: [], modules: reg, num: "01", mode: mode,
      });
    } catch (e) { return { keys: new Set(), html: "" }; }
    const keys = new Set();
    for (const hit of html.matchAll(/data-(?:f|chip|status|toggle|addrow)="([a-z]+)\|([A-Za-z0-9_]+)/g)) {
      if (hit[1] === mod.id) keys.add(hit[2]);
    }
    return { keys, html };
  };
  const kick = (id, state) => keysOf(MODULES.find((m) => m.id === id), MODULES, "kickoff", state);

  // Company —
  const co = kick("company");
  for (const gone of ["trackingOk", "leadEmail", "bookingUrl", "radius"]) {
    if (co.keys.has(gone)) fail(`kickoff/company still asks "${gone}" — it moved off this screen`);
  }
  for (const kept of ["businessName", "phone", "street", "city", "state", "zip", "crews", "customerMix"]) {
    if (!co.keys.has(kept)) fail(`kickoff/company lost "${kept}"`);
  }
  if (!co.keys.has("people")) fail("kickoff/company has no way to add more people");
  // NAP is one answer, not two cards — an address that disagrees with the
  // phone number's listing is the whole problem this screen exists to catch.
  {
    const labels = [...co.html.matchAll(/class="mlabel">([^<]+)</g)].map((m) => m[1]);
    if (labels.filter((l) => /address/i.test(l)).length > 1) {
      fail("company splits name, address and phone across more than one card");
    }
  }
  // billing defaults to "same as", so the second contact block stays shut
  if (/data-f="company\|billingEmail"/.test(co.html)) {
    fail("the billing block is open by default — \"same as point of contact\" should be on");
  }
  {
    const said = S.fresh();
    said.m.company = { billingSame: "no" };
    if (!/data-f="company\|billingEmail"/.test(kick("company", said).html)) {
      fail("saying billing is NOT the same does not open the billing block");
    }
  }
  // after-hours cover only asked once there are after hours
  if (co.keys.has("afterHoursWho")) fail("after-hours cover is asked before they say they run a line");
  {
    const em = S.fresh();
    em.m.company = { emergency: true };
    const h = kick("company", em);
    if (!h.keys.has("afterHoursWho")) fail("no human-or-AI question on the after-hours line");
    if (!/AI answering/.test(h.html)) fail("the after-hours options do not include AI");
  }

  // Goals —
  const go = kick("goals");
  if (go.keys.has("horizon")) fail('kickoff/goals still asks "By when?"');
  for (const k of ["revNow", "revTarget", "leadsNow", "leadsTarget",
                   "speedToLead", "apptRate", "closeRate", "reviewRate", "budget", "adSpend"]) {
    if (!go.keys.has(k)) fail(`kickoff/goals is missing "${k}"`);
  }
  // now and goal must sit together, not three cards apart
  const order = ["revNow", "revTarget", "leadsNow", "leadsTarget"].map((k) => go.html.indexOf('goals|' + k));
  if (order.some((n) => n < 0) || order[1] < order[0] || order[2] < order[1] || order[3] < order[2]) {
    fail("goals does not pair each number with its target, in order");
  }
  {
    const g = S.fresh();
    g.m.goals = { adSpend: "12000", leadsTarget: "500", avgTicket: "900", closeRate: "40" };
    const d = MODULES.find((m) => m.id === "goals").derive(ctxFor(bfp, g));
    if (!d["goals:cpl"]) fail("ad spend and a leads goal produce no cost per lead");
    else if (d["goals:cpl"].indexOf("$24") === -1) {
      fail(`cost per lead came out as "${d["goals:cpl"].replace(/<[^>]+>/g, "")}"`);
    }
  }

  // Marketing — the agency follow-ups stay shut until there is an agency
  const mk = kick("marketing");
  for (const k of ["contractEnd", "notice", "ownsAccounts"]) {
    if (mk.keys.has(k)) fail(`kickoff/marketing asks "${k}" before an agency is named`);
  }
  if (!mk.keys.has("runBy")) fail("marketing has no control to open the incumbent section");
  {
    // The gate must be a CLICK. Typing writes state without re-rendering,
    // so a section gated on a text field never appears — verified in a
    // browser before this check existed.
    const typed = S.fresh();
    typed.m.marketing = { agency: "Lead Ninjas" };
    const a = S.fresh();
    a.m.marketing = { runBy: "agency" };
    const opened = kick("marketing", a).keys;
    for (const k of ["agency", "contractEnd", "notice", "ownsAccounts"]) {
      if (!opened.has(k)) fail(`choosing "an agency" does not reveal "${k}"`);
    }
    if (!/data-chip="marketing\|runBy\|/.test(mk.html)) {
      fail("the incumbent section is not gated on something clickable");
    }
    // A name inherited from the sales call keeps it open…
    if (!kick("marketing", typed).keys.has("contractEnd")) {
      fail("an agency name carried over from the sales call does not open the follow-ups");
    }
    // …but saying in-house closes it, even with that name present.
    const inhouse = S.fresh();
    inhouse.m.marketing = { runBy: "inhouse", agency: "Lead Ninjas" };
    if (kick("marketing", inhouse).keys.has("contractEnd")) {
      fail("choosing all in-house leaves the incumbent follow-ups on screen");
    }

    // Hiding them is not enough — a contract date left in state still
    // reaches the export, describing an agency they said does not exist.
    const mkMod = MODULES.find((m) => m.id === "marketing");
    const wipes = (mkMod.clears || {}).runBy || {};
    for (const k of ["agency", "contractEnd", "notice", "ownsAccounts"]) {
      if ((wipes.inhouse || []).indexOf(k) < 0) {
        fail(`choosing all in-house does not clear "${k}", so it still reaches the export`);
      }
    }
    const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    if (!/owner\.clears && owner\.clears\[key\]/.test(src)) {
      fail("app.js never applies a module's declared `clears`");
    }
  }

  // Competitors — roster and notes, nothing else
  const cp = kick("competitors");
  for (const gone of ["losesTo", "cantMatch", "takeShare"]) {
    if (cp.keys.has(gone)) fail(`kickoff/competitors still asks "${gone}"`);
  }
  if (!cp.keys.has("rows")) fail("kickoff/competitors lost its roster");
  {
    // A screen has to be completable from what it still asks. CORE listing
    // fields the screen no longer renders left a filled roster stuck on
    // "partial" for ever.
    const filledCp = S.fresh();
    filledCp.m.competitors = { rows: [{ name: "Roto-Rooter", why: "Owns the map pack" }] };
    const cpMod = MODULES.find((m) => m.id === "competitors");
    const st = cpMod.status(ctxFor(bfp, filledCp));
    if (st !== "done") fail(`competitors reads "${st}" with a roster filled in — it can never complete`);

    // …and a row nobody typed in is not a competitor. statusFor sees a
    // non-empty array and calls it answered, so pressing Add once used to
    // complete the screen.
    for (const rows of [[{}], [{ name: "   " }], [{}, {}]]) {
      const blank = S.fresh();
      blank.m.competitors = { rows };
      const got = cpMod.status(ctxFor(bfp, blank));
      if (got === "done") fail(`competitors reads "done" with ${rows.length} empty row(s)`);
    }
  }

  // A migration must not invent an answer. Absent already means "same as
  // the point of contact", so stamping a value onto every legacy session
  // would ship a billing answer nobody gave — in both documents.
  {
    const legacy = (m) => S.validate({
      v: 2, mode: "kickoff", step: "company", order: {}, skipped: [], notes: {}, m: { company: m },
    });
    const untouched = legacy({ businessName: "Acme" }).m.company;
    if ("billingSame" in untouched) {
      fail(`the billing migration invented "${untouched.billingSame}" on a session that never answered it`);
    }
    if (legacy({ businessName: "Acme", billingEmail: "ap@acme.com" }).m.company.billingSame !== "no") {
      fail("a legacy session with a billing contact lost it to the new default");
    }
    if (legacy({ businessName: "Acme", billingSame: true }).m.company.billingSame !== "yes") {
      fail("a legacy ticked billing toggle did not carry across");
    }
  }

  // Everything asked has to reach the readout, or it exists on screen and
  // nowhere the work is actually read from.
  {
    const g = S.fresh();
    g.m.goals = { revNow: "120000", speedToLead: "15", apptRate: "45",
                  closeRate: "40", reviewRate: "12", budget: "18000", adSpend: "12000" };
    const labels = ((MODULES.find((m) => m.id === "goals").summary(ctxFor(bfp, g)) || {}).rows || [])
      .map((r) => r[0]).join(" | ");
    for (const want of ["Response time", "Appointment booking rate", "Review rate", "Ad spend"]) {
      if (labels.indexOf(want) === -1) fail(`goals asks for ${want} and the readout never shows it`);
    }
    if (labels.indexOf("Close rate") > -1) {
      fail('the readout still calls it "Close rate" while the screen says "Sales booking rate"');
    }

    const c = S.fresh();
    c.m.company = { businessName: "Acme", people: [{ name: "Dana Whitfield", role: "Office manager", email: "d@acme.com" }] };
    const co = JSON.stringify(MODULES.find((m) => m.id === "company").summary(ctxFor(bfp, c)) || {});
    if (co.indexOf("Dana Whitfield") === -1) fail("the extra contacts never reach the readout");
    if (co.indexOf("Office manager") === -1) fail("an extra contact reaches the readout with no role");
  }

  // The two new screens are kickoff-only
  const discIds = new Set(DISCOVERY.map((m) => m.id));
  for (const id of ["conversions", "profiles"]) {
    if (!MODULES.some((m) => m.id === id)) fail(`the kickoff has no "${id}" screen`);
    if (discIds.has(id)) fail(`"${id}" is on the sales call — it is post-sale detail`);
  }
  const cv = kick("conversions");
  for (const k of ["phoneSetup", "formTo", "counts", "doesNotCount", "numbers"]) {
    if (!cv.keys.has(k)) fail(`conversions is missing "${k}"`);
  }
  const pr = kick("profiles");
  for (const k of ["gbp", "facebook", "instagram", "other"]) {
    if (!pr.keys.has(k)) fail(`profiles is missing "${k}"`);
  }
}

/* ── the recording contributes, it does not travel ─────── */
{
  const readout = MODULES.find((m) => m.id === "readout");
  const st = S.fresh();
  st.m.transcript = {
    rec: { name: "call.json", type: "application/json", size: 900000, at: 1 },
    recSummary: readTranscript({ title: "T", duration: 30,
      sentences: [{ speaker_name: "Mike", text: "one two three", start_time: 0, end_time: 9 }] }),
    extract: readExtract({
      schema: "ss-extract/1",
      fields: { goals: { revNow: "120000" } },
      // TWO quotes. With none approved the block returns early, so a
      // mutation that prints every quote would never be caught — the
      // filter is only observable when some are in and some are out.
      quotes: [
        { speaker: "Mike", at: "0:05", text: "Angi is killing us.", module: "marketing" },
        { speaker: "Mike", at: "0:09", text: "We nearly went under in March.", module: "goals" },
      ],
    }, new Set(MODULES.map((m) => m.id))),
    approved: [],
    applied: [],
  };

  const j = JSON.parse(readout.exports(ctxFor(bfp, st)).json());

  // The extract is lifted into `recording`. Leaving it in `fields` too
  // ships every quote and proposal twice and gives the OS two sources of
  // truth for the same answer.
  const leaked = Object.keys(j.fields.transcript || {});
  if (leaked.length) {
    fail(`the recording's bookkeeping leaked into fields.transcript: ${leaked.join(", ")}`);
  }
  if (!j.recording || !j.recording.quotes.length) fail("the recording block carried no quotes");

  // and the transcript itself must never be in the payload
  const flat = JSON.stringify(j);
  if (flat.indexOf("one two three") > -1) fail("the transcript text reached the payload");
  if (j.recording.file && j.recording.file.size !== 900000) fail("the recording file size was lost");

  // an unapproved quote must not reach the printed document
  const doc = (() => {
    const html = readout.render({ ...ctxFor(bfp, st), num: "09", transient: {} });
    const at = html.indexOf('<div class="printdoc">');
    return at < 0 ? "" : html.slice(at);
  })();
  if (doc.indexOf("Angi is killing us") > -1) {
    fail("an unapproved quote reached the client document");
  }
  // one in, one out — the case that makes the filter observable
  st.m.transcript.approved = ["q0"];
  const doc2 = (() => {
    const html = readout.render({ ...ctxFor(bfp, st), num: "09", transient: {} });
    const at = html.indexOf('<div class="printdoc">');
    return at < 0 ? "" : html.slice(at);
  })();
  if (doc2.indexOf("Angi is killing us") === -1) {
    fail("an approved quote never reached the client document");
  }
  if (doc2.indexOf("nearly went under") > -1) {
    fail("an unapproved quote printed alongside an approved one");
  }
}

/* ── the extraction prompt has to name real targets ────── */
{
  const tr = MODULES.find((m) => m.id === "transcript");
  for (const [label, reg] of REGISTRIES) {
    const html = tr.render({
      state: S.fresh(label), client: bfp, transient: {}, slug: "bfp-kc",
      mismatch: [], modules: reg, num: "08", mode: label,
    });
    const hit = html.match(/data-copy="([^"]*)"/);
    if (!hit) { fail(`the ${label} recording screen has no prompt to copy`); continue; }
    const prompt = hit[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");

    const tail = prompt.slice(prompt.indexOf("Screens and keys available:"));
    if (tail.trim() === "Screens and keys available:") {
      fail(`the ${label} prompt names no field keys at all — an extraction against it maps to nothing`);
      continue;
    }
    // the keys it names have to be keys that exist
    for (const [mod, key] of [["goals", "revNow"], ["goals", "closeRate"], ["marketing", "agency"]]) {
      if (!new RegExp("\\b" + mod + "\\b[^\\n]*\\b" + key + "\\b").test(tail)) {
        fail(`the ${label} prompt does not name ${mod}.${key}, which that screen renders`);
      }
    }
    // and must NOT name per-item keys it cannot know ids for
    if (/prio_|rate_|status_/.test(tail)) {
      fail(`the ${label} prompt names a generated per-item key — an extraction would guess at ids`);
    }
    if (/\bservices —|\blocations —/.test(tail)) {
      fail(`the ${label} prompt lists a per-item screen as if it had fixed keys`);
    }
  }
}

/* ── a replaced read-out must not inherit approvals ────── */
{
  // Quote ids are positional. Carrying "q0 is approved" onto a different
  // read-out prints a sentence nobody ever read, in the client's document.
  const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const fn = (src.match(/async function parseTranscriptFile[\s\S]*?\n\}/) || [""])[0];
  if (!fn) fail("parseTranscriptFile is gone");
  else {
    const tail = fn.slice(fn.indexOf("readExtract"));
    if (!/approved:\s*""/.test(tail)) fail("uploading a new read-out does not clear the old approvals");
    if (!/applied:\s*""/.test(tail)) fail("uploading a new read-out does not clear the old applications");
  }

  // One key per file. The card renders `extractFile`, so that is where the
  // metadata goes and what Remove clears — while the parsed read-out lives
  // at `extract`. Removing a file must take what reading it produced with
  // it, or the card offers a download of bytes that are gone and ticked
  // quotes outlive the file they came from.
  const mod = readFileSync(new URL("../js/modules/08-transcript.js", import.meta.url), "utf8");
  if (!/upload\(ID, "extractFile", /.test(mod)) {
    fail("the read-out upload does not render the key its metadata is stored under");
  }
  const drop = (src.match(/const FILE_LEAVES_BEHIND[\s\S]*?\n\};/) || [""])[0];
  if (!drop) fail("removing a transcript file leaves what it produced behind");
  else {
    for (const k of ["extract", "approved", "applied"]) {
      if (drop.indexOf('"' + k + '"') === -1) {
        fail(`removing the read-out does not clear "${k}"`);
      }
    }
    if (drop.indexOf('"recSummary"') === -1) fail("removing the recording does not clear its summary");
  }
  if (!/for \(const also of FILE_LEAVES_BEHIND/.test(src)) {
    fail("dropFile never consults FILE_LEAVES_BEHIND");
  }
}

/* ── the recording survives the handoff, minus the file ── */
{
  const st = S.fresh("discovery");
  st.m.transcript = {
    rec: { name: "call.json", type: "application/json", size: 900000, at: 1 },
    recSummary: readTranscript({ title: "Discovery", duration: 41,
      sentences: [{ speaker_name: "Mike", text: "a b c", start_time: 0, end_time: 9 }] }),
    extract: readExtract({
      schema: "ss-extract/1",
      quotes: [{ speaker: "Mike", at: "0:05", text: "KEEP ME." },
               { speaker: "Mike", at: "0:09", text: "DROP ME." }],
      fields: { goals: { revNow: "120000" } },
      unclear: ["no close rate"],
    }, new Set(MODULES.map((m) => m.id))),
    approved: ["q0"],
    applied: ["goals.revNow"],
  };
  const readout = MODULES.find((m) => m.id === "readout");
  const payload = JSON.parse(readout.exports({
    state: st, client: bfp, transient: {}, slug: "bfp-kc",
    mismatch: [], modules: DISCOVERY, num: "09", mode: "discovery",
  }).json());

  const t = (await import(url("js/import.js"))).importPayload(payload).state.m.transcript;
  if (!t) { fail("the recording was lost entirely in the handoff"); }
  else {
    if ((t.extract.quotes || []).length !== 2) fail("quotes were lost in the handoff");
    const prints = (t.extract.quotes || []).filter((q) => (t.approved || []).indexOf(q.id) > -1);
    if (prints.length !== 1 || prints[0].text.indexOf("KEEP") < 0) {
      fail(`the handoff carried the wrong approvals: ${JSON.stringify(prints.map((q) => q.text))}`);
    }
    // the bytes stayed on the other machine; do not claim otherwise
    if (t.rec) fail("the handoff claims a transcript file that did not travel with it");
    if (!t.recSummary) fail("the call summary was lost in the handoff");
    if ((t.applied || []).length) fail("the handoff carried applications from a document that never applied them");
  }
}

/* ── an IndexedDB miss has to read as a miss ───────────── */
{
  // Not reachable headlessly — node has no IndexedDB — so this pins the
  // predicate rather than the behaviour. Verified in a browser: with the
  // loose test, get() for an absent key returned the IDBRequest itself,
  // which is truthy, so every caller read a miss as a hit. That made the
  // b47 rename fallback dead code and objectUrl() fail on a file that was
  // sitting right there under its old name.
  const src = readFileSync(new URL("../js/assets.js", import.meta.url), "utf8");
  const raw = (src.match(/function tx\([\s\S]*?\n\}/) || [""])[0];
  // Comments in here quote the wrong predicate to explain why it was
  // wrong, so match the code only.
  const tx = raw.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  if (!raw) fail("assets.js has no tx() to check");
  else {
    if (/out\.result !== undefined/.test(tx)) {
      fail("tx() treats an absent record as present — a get() miss resolves to the IDBRequest");
    }
    if (!/"result" in out/.test(tx)) {
      fail("tx() does not distinguish a request's result from the request itself");
    }
  }
}

/* ── a renamed file key must stay readable ─────────────── */
{
  // b44 and b45 stored the read-out's bytes under "extract"; b46 renamed
  // the card's key to "extractFile". Without a read-side fallback the card
  // shows an attached file and Download reports it isn't on this machine —
  // wrong, and unfixable from the screen.
  const src = readFileSync(new URL("../js/assets.js", import.meta.url), "utf8");
  const map = (src.match(/const RENAMED_FROM = \{[^}]*\}/) || [""])[0];
  if (!map) fail("assets.js has no record of the keys it has renamed");
  else if (map.indexOf("extractFile") === -1 || map.indexOf('"extract"') === -1) {
    fail("the extract -> extractFile rename is not recorded, so older read-outs are unreachable");
  }
  const get = (src.match(/export async function get\([\s\S]*?\n\}/) || [""])[0];
  if (!/RENAMED_FROM\[name\]/.test(get)) fail("get() does not fall back to a renamed key");
  const rm = (src.match(/export async function remove\([\s\S]*?\n\}/) || [""])[0];
  if (!/RENAMED_FROM\[name\]/.test(rm)) {
    fail("remove() ignores the renamed key, so a deleted file comes back");
  }
}

/* ── the handoff keeps what the kickoff can use ────────── */
{
  const IMPORTER = await import(url("js/import.js"));
  const kickoffIds = new Set(MODULES.map((m) => m.id));
  const payloadFrom = (ex) => {
    const st = S.fresh("discovery");
    st.m.transcript = { extract: readExtract(ex, new Set(DISCOVERY.map((m) => m.id))), approved: [], applied: [] };
    return JSON.parse(DISCOVERY.find((m) => m.id === "readout").exports({
      state: st, client: bfp, transient: {}, slug: "bfp-kc",
      mismatch: [], modules: DISCOVERY, num: "09", mode: "discovery",
    }).json());
  };

  // A proposal for a screen only the sales call has must not survive as a
  // Use button that writes to a module id nothing resolves.
  const onlyThere = DISCOVERY.find((m) => !kickoffIds.has(m.id));
  if (!onlyThere) fail("fixture assumption broken: the two documents share every screen");
  else {
    const res = IMPORTER.importPayload(payloadFrom({
      schema: "ss-extract/1",
      fields: { [onlyThere.id]: { anything: "x" }, goals: { revNow: "120000" } },
    }));
    const props = ((res.state.m.transcript || {}).extract || {}).proposals || [];
    if (props.some((p) => !kickoffIds.has(p.mod))) {
      fail(`the handoff kept a proposal for "${onlyThere.id}", a screen this document doesn't have`);
    }
    if (!props.some((p) => p.mod === "goals")) fail("the handoff dropped a proposal it could have used");
    if (!res.warnings.some((w) => w.indexOf(onlyThere.id) > -1)) {
      fail("a dropped proposal was not reported");
    }
  }

  // Mentions and unanswered questions are the whole point of the next call.
  const only = IMPORTER.importPayload(payloadFrom({
    schema: "ss-extract/1", services: ["Drain cleaning"], cities: ["Olathe, KS"],
    unclear: ["Never gave a close rate"],
  }));
  const t = only.state.m.transcript;
  if (!t) fail("a recording carrying only mentions and unanswered questions was dropped");
  else {
    if (!(t.extract.mentionedServices || []).length) fail("mentioned services were lost in the handoff");
    if (!(t.extract.unclear || []).length) fail("unanswered questions were lost in the handoff");
  }
}

/* ── the recording reaches the CSV ─────────────────────── */
{
  const st = S.fresh();
  st.m.transcript = {
    extract: readExtract({
      schema: "ss-extract/1",
      quotes: [{ speaker: "Mike", at: "0:05", text: "Angi is killing us." }],
      unclear: ["no close rate"],
    }, new Set(MODULES.map((m) => m.id))),
    approved: ["q0"], applied: [],
  };
  const csv = MODULES.find((m) => m.id === "readout").exports(ctxFor(bfp, st)).csv();
  if (csv.indexOf("Angi is killing us") === -1) fail("the CSV dropped the recording's quotes");
  if (!/"quote","transcript"/.test(csv)) fail("the CSV has no addressable quote rows");
  if (csv.indexOf("no close rate") === -1) fail("the CSV dropped what the call left unanswered");
}

/* ── the two transcript readers refuse what they can't read ── */
{
  // Asserting only "it threw" passes on a raw TypeError from a missing
  // guard, which is the same outcome with none of the explanation. The
  // message has to say what was wrong with the file.
  const rejects = (fn, input, what, wants) => {
    let msg = null;
    try { fn(input); } catch (e) { msg = String((e && e.message) || e); }
    if (msg === null) { fail(`${what} accepted something it cannot read`); return; }
    if (wants && !wants.test(msg)) {
      fail(`${what} rejected the file with an unhelpful message: "${msg.slice(0, 70)}"`);
    }
  };
  rejects(readTranscript, {}, "readTranscript", /transcript turns|isn't JSON/i);
  rejects(readTranscript, { sentences: [] }, "readTranscript", /transcript turns/i);
  rejects(readTranscript, null, "readTranscript", /isn't JSON/i);
  rejects((x) => readExtract(x, new Set()), {}, "readExtract", /call read-out/i);
  rejects((x) => readExtract(x, new Set()), { schema: "something-else/1" }, "readExtract", /call read-out/i);
  rejects((x) => readExtract(x, new Set()), [], "readExtract", /call read-out/i);

  // and a read-out naming a screen this document lacks is reported, not dropped in silence
  const r = readExtract({ schema: "ss-extract/1", fields: { nosuch: { a: "b" } } }, new Set(["goals"]));
  if (!r.warnings.length) fail("a read-out for an unknown screen was accepted silently");
  if (r.proposals.length) fail("a proposal for an unknown screen was kept");
}

/* ── /discovery/ is a real page, not a redirect ─────────── */
{
  const entry = readFileSync(new URL("../discovery/index.html", import.meta.url), "utf8");

  // It has to say which document it is in how it loads the app, because
  // the whole point is that the address bar stays /discovery/ with no
  // ?mode= on it.
  if (!/src="\.\.\/js\/app\.js\?mode=discovery"/.test(entry)) {
    fail("discovery/index.html does not declare mode=discovery on its app entry");
  }
  // and its own assets live one directory up
  for (const ref of ['href="../css/kickoff.css"', 'src="../assets/']) {
    if (entry.indexOf(ref) === -1) fail(`discovery/index.html is missing ${ref} — it will 404 from one level down`);
  }
  if (/(href|src)="(css|js|assets)\//.test(entry)) {
    fail("discovery/index.html has a page-relative asset path — it resolves under /discovery/ and 404s");
  }
  if (entry.indexOf("<title>Service Scalers — Discovery</title>") === -1) {
    fail("the discovery entry does not title itself as discovery — the tab is on the shared screen too");
  }

  // Every data fetch must be anchored at the repo root. A page-relative
  // one resolves under /discovery/, 404s, and fails QUIETLY: the client
  // falls back to the template and the radius search returns nothing.
  for (const file of ["js/app.js", "js/places.js"]) {
    const src = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    for (const m of src.matchAll(/fetch\(\s*("(?:clients|data)\/[^"]*")/g)) {
      fail(`${file} fetches ${m[1]} relative to the page — it 404s from /discovery/`);
    }
    if (!/const ROOT = new URL\("\.\.\/", import\.meta\.url\)/.test(src)) {
      fail(`${file} has no ROOT anchor, so its data paths depend on where the page lives`);
    }
  }
}

/* ── the wrong-document escape hatch must leave the page ── */
{
  // Each document has its own page now, and /discovery/ declares its mode
  // in how it loads the app — so a link built from location.pathname points
  // back at the page you are already on, reloads as the same document, and
  // shows the same banner. A dead end that reads as a broken link.
  const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const fn = (src.match(/function docUrl\(mode\) \{[\s\S]*?\n\}/) || [""])[0];
  if (!fn) fail("docUrl() is gone — cross-document links have no single place to be built");
  else {
    if (/location\.pathname/.test(fn)) {
      fail("docUrl() builds from location.pathname, so it points back at the current document");
    }
    if (!/ROOT/.test(fn)) fail("docUrl() is not anchored at ROOT");
    if (!/discovery\//.test(fn)) fail("docUrl() does not know where the discovery document lives");
    if (!/location\.hash/.test(fn)) fail("docUrl() drops the fragment — the link would carry no data");
    if (!/R\.slug/.test(fn)) fail("docUrl() drops the client slug");
  }
  const banner = (src.match(/function wrongModeBanner\(\)[\s\S]*?\n\}/) || [""])[0];
  if (banner && /location\.pathname/.test(banner)) {
    fail("wrongModeBanner still builds a URL from location.pathname");
  }
}

/* ── a client with no scrape keeps its own identity ────── */
{
  // loadClient() falls back to clients/template.json for anyone without a
  // scrape — which is every prospect. sanitizeClient prefers the file's own
  // slug, so the template's identity used to overwrite theirs.
  const src = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const fallback = (src.match(/clients\/template\.json[\s\S]{0,600}?\n\s{6}\} catch \(e2\)/) || [""])[0];
  if (!fallback) fail("could not find the template fallback in app.js to check it");
  else {
    if (/sanitizeClient\(await res\.json\(\), "template"\)/.test(fallback)) {
      fail("the template fallback hardcodes slug \"template\" — every unscraped client exports as template");
    }
    if (!/c\.slug = slug/.test(fallback)) {
      fail("the template fallback does not restore the requested slug over the template's own");
    }
  }

  // and the payload must carry whatever slug it was given
  const tpl = JSON.parse(readFileSync(new URL("../clients/template.json", import.meta.url), "utf8"));
  const asLoaded = { ...tpl, slug: "acme-hvac" };
  const readout = MODULES.find((m) => m.id === "readout");
  const j = JSON.parse(readout.exports({
    state: S.fresh(), client: asLoaded, transient: {}, slug: "acme-hvac",
    mismatch: [], modules: MODULES, num: "09",
  }).json());
  if (j.client.slug !== "acme-hvac") {
    fail(`a prospect exported with slug "${j.client.slug}" instead of its own`);
  }
}

/* ── the sales call's PDF is not the sales call's thinking ── */
//
// The kickoff already solves this: the client document renders into a
// hidden .printdoc on every tab, and print emits that and nothing else.
// The discovery document reuses the pattern, so the same guarantee has to
// hold — and it has more to lose. The internal tab carries the gaps in
// what a prospect said and what is still missing before anyone can price
// the work. That reaching a prospect is worse than any bug in this repo.
{
  const readout = REG.DISCOVERY.find((m) => m.id === "readout");
  const st = S.fresh("discovery");
  st.m.company = { businessName: "Acme Plumbing" };
  st.m.goals = { revNow: "120000" };                  // leaves most UNKNOWNS unmet
  st.m.marketing = { agency: "Lead Ninjas" };         // arms the contract-end unknown
  st.notes["whynow:_page"] = "Sounded desperate, honestly";
  st.notes["goals:_page"] = "Made the target up on the spot";

  const slice = (html) => {
    const at = html.indexOf('<div class="printdoc">');
    return at < 0 ? "" : html.slice(at);
  };

  // Phrases that exist ONLY on the internal tab, pinned by hand.
  const INTERNAL_ONLY = [
    "Before this can be priced",
    "No budget figure",
    "Capacity unknown",
    "Incumbent contract end unknown",
    "Decision-makers unknown",
    "Sounded desperate, honestly",
    "Made the target up on the spot",
    "Don&rsquo;t open this while you&rsquo;re sharing your screen",
  ];

  let sawInternal = false;
  for (const tab of ["recap", "brief", "raw"]) {
    const html = readout.render({
      ...ctxFor(bfp, st, "discovery"), num: "08", transient: { readout: { tab } },
    });
    const doc = slice(html);
    if (!doc) { fail(`discovery: no printable document rendered on the "${tab}" tab`); continue; }
    if (doc.indexOf("Acme Plumbing") < 0) {
      fail(`discovery: the printed document lost the prospect's own answers on the "${tab}" tab`);
    }
    for (const secret of INTERNAL_ONLY) {
      if (doc.indexOf(secret) > -1) {
        fail(`discovery: "${secret}" reached the PRINTED document from the "${tab}" tab — ` +
             `that is the prospect reading your notes on them`);
      }
    }
    // …and it must actually be on the internal tab, or the pins above are
    // guarding a string nothing produces.
    if (tab === "brief") {
      sawInternal = true;
      for (const secret of INTERNAL_ONLY) {
        if (html.indexOf(secret) < 0) {
          fail(`discovery: "${secret}" is pinned out of the printed document but nothing renders ` +
               `it on the internal tab — the pin proves nothing`);
        }
      }
    }
  }
  if (!sawInternal) fail("discovery: the internal tab never rendered, so nothing above was tested");

  // The unknowns list empties itself as the call goes on, rather than
  // being a fixed lecture. Fill everything it asks for and it says so.
  const done = S.fresh("discovery");
  done.m.goals = { budget: "8000", avgTicket: "4300", closeRate: "30", revTarget: "300000", capacity: "10" };
  done.m.whynow = { liveBy: "30", whoDecides: "Just me" };
  done.m.services = { prio: { "x": "high" } };
  done.m.locations = { prio: { "y": "high" } };
  const full = readout.render({
    ...ctxFor(bfp, done, "discovery"), num: "08", transient: { readout: { tab: "brief" } },
  });
  if (full.indexOf("Nothing missing. You can price this.") < 0) {
    fail("the unknowns list still reports gaps once every field it names is filled");
  }
  // No scoring, anywhere. Sam's call, and worth pinning so it stays made.
  if (/\b(fit\s*score|qualification score|score:\s*\d|\d\s*\/\s*10)\b/i.test(full)) {
    fail("the internal tab renders something that reads as a score — there is deliberately no fit scoring here");
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
    : `\nAll checks passed — ${MODULES.length} kickoff + ${DISCOVERY.length} discovery screens ` +
      `(${ALL_MODULES.length} modules), 2 clients, ${warns.length} warning(s)`
);
process.exit(fails.length ? 1 : 0);
