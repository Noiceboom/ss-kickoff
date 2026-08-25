// ============================================================
// state.js — the single state object, autosave, and URL codec
// ============================================================
//
// State stores ONLY diffs against the client JSON. Client content
// (scraped services, locations, flags) is never copied in, which keeps
// share links short and lets a re-scrape land without invalidating an
// in-progress kickoff.

import { resolveChannel, isKnownChannel, CHANNEL_KEY_PREFIXES } from "./channels.js";

export const VERSION = 2;

/** Fresh, empty state. Every module's slot starts as {}. */
export function fresh() {
  return {
    v: VERSION,
    step: "intro",
    m: {},            // per-module free-form state, keyed by module id
    order: {},        // { services: [id…], locations: [id…] }
    skipped: [],      // module ids marked "didn't cover"
    notes: {},        // "services:drains" -> "…"
  };
}

/* ── module slots ─────────────────────────────────────── */

const EMPTY = Object.freeze({});

/**
 * Read a module's state slot WITHOUT creating it. Safe to call from
 * render(), which must stay pure — creating an empty branch here would
 * make an untouched session look in-progress.
 */
export function slot(state, id) {
  return state.m[id] || EMPTY;
}

/** Get a module's slot, creating it. Write paths only. */
export function ensure(state, id) {
  if (!state.m[id]) state.m[id] = {};
  return state.m[id];
}

export function getField(state, id, key, fallback = "") {
  const s = state.m[id];
  return s && s[key] !== undefined ? s[key] : fallback;
}

export function setField(state, id, key, value) {
  if (value === "" || value === null || value === undefined) {
    if (!state.m[id]) return;              // nothing to clear
    delete state.m[id][key];
    if (!Object.keys(state.m[id]).length) delete state.m[id];
    return;
  }
  const s = ensure(state, id);
  s[key] = value;
}

/* ── repeatable rows ──────────────────────────────────── */

export function getRows(state, id, key) {
  const v = getField(state, id, key, null);
  return Array.isArray(v) ? v : [];
}

export function setRows(state, id, key, rows) {
  const clean = rows.filter((r) => Object.values(r).some((v) => String(v || "").trim()));
  if (clean.length) ensure(state, id)[key] = clean;
  else if (state.m[id]) delete state.m[id][key];
}

/* ── skip ─────────────────────────────────────────────── */

export function isSkipped(state, id) {
  return state.skipped.indexOf(id) > -1;
}

export function toggleSkip(state, id) {
  const i = state.skipped.indexOf(id);
  if (i > -1) state.skipped.splice(i, 1);
  else state.skipped.push(id);
  return isSkipped(state, id);
}

/* ── list modules (services / locations) ──────────────── */
//
// Shape of state.m.services / state.m.locations:
//   { off: [id…], subsOff: { id: [subName…] }, added: [{id,name,…}] }

/** Read-only, normalised view of a list module's state. Creates nothing. */
export function listView(state, id) {
  const s = state.m[id] || EMPTY;
  return {
    off: Array.isArray(s.off) ? s.off : [],
    subsOff: s.subsOff && typeof s.subsOff === "object" ? s.subsOff : EMPTY,
    added: Array.isArray(s.added) ? s.added : [],
  };
}

/** Writable, normalised list state. Write paths only. */
export function listState(state, id) {
  const s = ensure(state, id);
  if (!Array.isArray(s.off)) s.off = [];
  if (!s.subsOff || typeof s.subsOff !== "object") s.subsOff = {};
  if (!Array.isArray(s.added)) s.added = [];
  return s;
}

/**
 * Merge client JSON items with anything added on the call, and apply
 * the on/off diff. Returns items in saved order, with unknown-to-order
 * items appended so a re-scrape that adds services never drops them.
 */
export function mergedList(state, id, clientItems) {
  const s = listView(state, id);
  const base = (clientItems || []).map((it) => ({ ...it, custom: false }));
  const added = s.added.map((it) => ({ subs: [], hasPage: false, verify: null, ...it, custom: true }));
  const all = base.concat(added);

  const byId = new Map(all.map((it) => [it.id, it]));
  const order = state.order[id] || [];
  const out = [];
  const seen = new Set();

  for (const oid of order) {
    const it = byId.get(oid);
    if (it && !seen.has(oid)) { seen.add(oid); out.push(it); }
  }
  for (const it of all) {
    if (!seen.has(it.id)) { seen.add(it.id); out.push(it); }
  }

  return out.map((it) => ({
    ...it,
    on: s.off.indexOf(it.id) < 0,
    subs: (it.subs || []).map((name) => ({
      name,
      on: (s.subsOff[it.id] || []).indexOf(name) < 0,
    })),
  }));
}

export function onList(state, id, clientItems) {
  return mergedList(state, id, clientItems).filter((x) => x.on);
}

export function toggleItem(state, id, itemId) {
  const s = listState(state, id);
  const i = s.off.indexOf(itemId);
  if (i > -1) s.off.splice(i, 1);
  else s.off.push(itemId);
}

export function setAll(state, id, clientItems, on) {
  const s = listState(state, id);
  s.off = on ? [] : mergedList(state, id, clientItems).map((x) => x.id);
}

export function toggleSub(state, id, itemId, subName) {
  const s = listState(state, id);
  if (!s.subsOff[itemId]) s.subsOff[itemId] = [];
  const arr = s.subsOff[itemId];
  const i = arr.indexOf(subName);
  if (i > -1) arr.splice(i, 1);
  else arr.push(subName);
  if (!arr.length) delete s.subsOff[itemId];
}

export function addItem(state, id, item) {
  const s = listState(state, id);
  s.added.push(item);
  if (!state.order[id]) state.order[id] = [];
  state.order[id].push(item.id);
}

/**
 * Rewrite the stored order so the ON items follow `ids`, while OFF items
 * hold their existing slots. Without this, toggling an item off and back
 * on would teleport it to the end of the ranking.
 */
export function applyOrder(state, id, clientItems, ids) {
  const full = mergedList(state, id, clientItems);
  const queue = ids.slice();
  const out = [];
  for (const it of full) out.push(it.on ? queue.shift() : it.id);
  while (queue.length) out.push(queue.shift());
  state.order[id] = out.filter(Boolean);
}

export function resetOrder(state, id, clientItems) {
  const s = listState(state, id);
  state.order[id] = (clientItems || []).map((x) => x.id).concat(s.added.map((x) => x.id));
}

/* ── services: taxonomy + scrape, priority buckets ────── */
//
// The universe is the selected trade's taxonomy merged with whatever the
// scrape found and anything added on the call. Selection is deliberately
// two-sided rather than a single list, so render() stays pure and no
// initialisation step is needed:
//
//   scraped service   → ON unless it appears in `off`
//   taxonomy-only     → OFF unless it appears in `on`
//
// That means opening a kickoff pre-ticks exactly what's on their site,
// with the rest of the industry list sitting unticked below it.

export const PRIORITIES = ["high", "med", "low"];

export function svcState(state) {
  const s = state.m.services || EMPTY;
  return {
    trades: Array.isArray(s.trades) ? s.trades : (typeof s.trade === "string" && s.trade ? [s.trade] : []),
    off: Array.isArray(s.off) ? s.off : [],
    on: Array.isArray(s.on) ? s.on : [],
    prio: s.prio && typeof s.prio === "object" ? s.prio : EMPTY,
    snap: s.snap && typeof s.snap === "object" ? s.snap : EMPTY,
    subsOff: s.subsOff && typeof s.subsOff === "object" ? s.subsOff : EMPTY,
    added: Array.isArray(s.added) ? s.added : [],
  };
}

/**
 * Every service available for this kickoff, in a stable order:
 * taxonomy first, then scraped services the taxonomy doesn't know about,
 * then anything typed in on the call.
 */
/**
 * Taxonomy-only services carry a trade-scoped id.
 *
 * 26 service ids appear in more than one trade and 16 of those mean
 * different things — "commercial" is in 15 taxonomies, "new-construction"
 * in 12. With bare ids, ticking Commercial Plumbing would silently tick
 * Commercial HVAC the moment the trade changed, and hand it the same
 * priority. Scoping only the taxonomy-only ones keeps scraped services
 * client-level, where they belong, since those are real things this
 * client sells regardless of which list is on screen.
 */
export function scopedId(trade, id) { return trade + ":" + id; }

/**
 * @param trades array of trade objects {id, label, services} — plenty of
 *   companies run two trades (plumbing and HVAC, plumbing and restoration),
 *   so the list is the union of everything they do.
 */
export function serviceUniverse(state, client, trades) {
  const v = svcState(state);
  const seen = new Set();
  const out = [];

  const push = (it, source, trade) => {
    if (!it || !it.id || seen.has(it.id)) return;
    seen.add(it.id);
    out.push({
      id: it.id,
      name: it.label || it.name || it.id,
      subs: Array.isArray(it.subs) ? it.subs : [],
      source: source,
      tradeId: trade ? trade.id : "",
      tradeLabel: trade ? trade.label : "",
      hasPage: !!it.hasPage,
      verify: it.verify || null,
    });
  };

  const scraped = new Map((client.services || []).map((x) => [x.id, x]));
  // Two trades often name the same service identically — both plumbing and
  // HVAC list Water Heaters. That's one service, not two tiles. Where the
  // label differs it genuinely is two ("Commercial Plumbing" vs
  // "Commercial HVAC"), so the label is part of the key.
  const seenService = new Set();
  // A scraped page can only stand in for ONE taxonomy row. Their existing
  // "Commercial" page is the plumbing one; if they also do HVAC, Commercial
  // HVAC is a page they don't have yet and still needs offering.
  const claimed = new Set();

  for (const trade of trades || []) {
    for (const t of trade.services || []) {
      const key = t.id + "|" + t.label;
      if (seenService.has(key)) continue;
      seenService.add(key);

      const hit = scraped.get(t.id);
      if (hit && !claimed.has(t.id)) {
        claimed.add(t.id);
        // Union the sub lists. Taking the taxonomy's alone would silently
        // drop a sub-service the client actually has a page for just
        // because the industry list doesn't happen to name it.
        const subs = (t.subs || []).slice();
        for (const sub of hit.subs || []) if (subs.indexOf(sub) < 0) subs.push(sub);
        push({ ...t, subs: subs, hasPage: hit.hasPage, verify: hit.verify }, "both", trade);
        continue;
      }
      push({ ...t, id: scopedId(trade.id, t.id) }, "trade", trade);
    }
  }
  for (const c of client.services || []) push(c, "scrape", null);
  for (const a of v.added) push(a, "added", null);

  // A taxonomy service ticked under one trade would otherwise disappear
  // the moment the trade changed, taking its priority and note with it.
  // The snapshot taken at tick-time keeps it in the list.
  for (const id of v.on) {
    if (!seen.has(id) && v.snap[id]) push({ id: id, ...v.snap[id] }, "trade");
  }

  return out.map((it) => ({
    ...it,
    on: it.source === "trade" ? v.on.indexOf(it.id) > -1 : v.off.indexOf(it.id) < 0,
    prio: v.prio[it.id] || "",
    subs: it.subs.map((name) => ({
      name,
      on: (v.subsOff[it.id] || []).indexOf(name) < 0,
    })),
  }));
}

export function onServices(state, client, trades) {
  return serviceUniverse(state, client, trades).filter((x) => x.on);
}

/** Selected services grouped H → M → L, ordered within each bucket. */
export function servicesByPriority(state, client, trades) {
  const list = onServices(state, client, trades);
  const order = state.order.services || [];
  const rank = (id) => { const i = order.indexOf(id); return i < 0 ? Infinity : i; };
  const buckets = { high: [], med: [], low: [], "": [] };
  for (const it of list) (buckets[it.prio] || buckets[""]).push(it);
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => rank(a.id) - rank(b.id));
  }
  return buckets;
}

/**
 * Flat build order: every High, then Medium, then Low.
 *
 * Unprioritized services are NOT included. Appending them would print a
 * rank next to a decision nobody made — "#7" reads as agreed, not as
 * "we never got to it". They surface as an open item instead.
 */
export function serviceOrder(state, client, trades) {
  const b = servicesByPriority(state, client, trades);
  return b.high.concat(b.med, b.low);
}

/**
 * @param meta {name, subs} — snapshotted for taxonomy-only services so a
 *   later change of trade can't make a ticked service vanish.
 */
export function toggleService(state, id, isTradeOnly, meta) {
  const s = ensure(state, "services");
  if (!Array.isArray(s.off)) s.off = [];
  if (!Array.isArray(s.on)) s.on = [];
  const list = isTradeOnly ? s.on : s.off;
  const i = list.indexOf(id);

  if (i > -1) {
    list.splice(i, 1);
    if (isTradeOnly && s.snap) {
      delete s.snap[id];
      if (!Object.keys(s.snap).length) delete s.snap;
    }
  } else {
    list.push(id);
    if (isTradeOnly && meta && meta.name) {
      if (!s.snap || typeof s.snap !== "object") s.snap = {};
      s.snap[id] = { name: meta.name, subs: Array.isArray(meta.subs) ? meta.subs : [] };
    }
  }
}

export function setPriority(state, id, value) {
  const s = ensure(state, "services");
  if (!s.prio || typeof s.prio !== "object") s.prio = {};
  if (s.prio[id] === value || !value) delete s.prio[id];
  else s.prio[id] = value;
  if (!Object.keys(s.prio).length) delete s.prio;
}

/** Reorder within one priority bucket, leaving the other buckets alone. */
export function reorderBucket(state, bucketIds) {
  const order = (state.order.services || []).filter((id) => bucketIds.indexOf(id) < 0);
  state.order.services = order.concat(bucketIds);
}

/* ── notes ────────────────────────────────────────────── */

// Reserved item id for a screen's own note, so page notes ride the same
// map (and the same autosave / fragment plumbing) as per-item notes.
export const PAGE = "_page";

export function noteKey(id, itemId) { return id + ":" + itemId; }

export function getPageNote(state, moduleId) { return getNote(state, moduleId, PAGE); }
export function setPageNote(state, moduleId, value) { setNote(state, moduleId, PAGE, value); }
export function hasPageNote(state, moduleId) { return !!getPageNote(state, moduleId).trim(); }

/**
 * A note is captured content even when no field was filled, so an
 * otherwise-blank screen carrying one is not "empty".
 *
 * Lives here rather than in app.js because the readout resolves status
 * independently — two copies of this rule drift, and the readout would
 * start reporting a noted screen as "Nothing captured".
 */
export function statusWithNote(state, moduleId, status) {
  return status === "empty" && hasPageNote(state, moduleId) ? "partial" : status;
}

/**
 * Does this saved session hold anything worth protecting? Used before a
 * share link replaces local state. Notes count: a session where the only
 * thing captured was quotes from the call is exactly the one you must not
 * silently destroy.
 */
export function hasWork(state) {
  if (!state) return false;
  return !!(
    Object.keys(state.m || {}).length ||
    (state.skipped || []).length ||
    Object.keys(state.notes || {}).length ||
    Object.keys(state.order || {}).length
  );
}
export function getNote(state, id, itemId) { return state.notes[noteKey(id, itemId)] || ""; }
export function setNote(state, id, itemId, value) {
  const k = noteKey(id, itemId);
  if (String(value || "").trim()) state.notes[k] = value;
  else delete state.notes[k];
}

/* ── persistence ──────────────────────────────────────── */

const KEY_PREFIX = "ss-kickoff:";

export function storageKey(clientSlug) { return KEY_PREFIX + (clientSlug || "_template"); }

export function save(state, clientSlug) {
  try { localStorage.setItem(storageKey(clientSlug), JSON.stringify(state)); return true; }
  catch (e) { return false; }
}

export function clear(clientSlug) {
  try { localStorage.removeItem(storageKey(clientSlug)); } catch (e) { /* ignore */ }
}

/* ── URL fragment codec ───────────────────────────────── */
//
// Fragments are never sent to a server, so typed content stays
// client-side even though the page is hosted publicly.

export function encode(state) {
  const json = JSON.stringify(state);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decode(str) {
  let s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

/**
 * Field-key renames orphan saved values: the old key stays in state,
 * invisible, and the new field renders blank. Every rename gets an entry
 * here, applied on load so localStorage and share links both heal.
 */
const RENAMES = [
  ["company", "email", "leadEmail"],   // b3: "where leads land" split from contact email
];

/**
 * Fields cut from a screen. Their values would otherwise sit invisibly in
 * state forever, riding every share link and every export.
 */
const REMOVED = [
  ["goals", "cadence"],      // b8: reporting cadence dropped
  ["goals", "scoreboard"],   // b8
  ["goals", "whoElse"],      // b8
  ["goals", "fireUs"],       // b8
];

/**
 * b9 replaced the marketing "channels" rowGroup with a pick grid. Old rows
 * carried {channel, spend, who, working}; fold each one into the new
 * per-channel keys so nothing typed on an earlier call disappears. Rows
 * whose name isn't in the built-in list land in the free-text "other" box
 * rather than being dropped on the floor.
 */
function migrateChannels(m) {
  if (!m || !Array.isArray(m.channels)) return;
  const rows = m.channels;
  delete m.channels;

  const verdict = { Working: "good", Mixed: "mixed", "Not working": "waste" };
  const picked = Array.isArray(m.chan) ? m.chan.slice() : [];
  const leftovers = [];

  for (const row of rows) {
    const name = String((row && row.channel) || "").trim();
    if (!name) continue;
    const id = resolveChannel(name);
    // Separated with a middot, never a comma: this text can end up in the
    // free-text channel box, and a comma there would split one channel
    // into several bogus ones.
    const detail = [
      row.spend ? "spend " + row.spend : "",
      row.who ? "run by " + row.who : "",
    ].filter(Boolean).join(" · ");

    if (id) {
      if (picked.indexOf(id) < 0) picked.push(id);
      if (row.working && verdict[row.working] && !m["rate_" + id]) m["rate_" + id] = verdict[row.working];
      if (detail && !m["note_" + id]) m["note_" + id] = detail;
    } else {
      // No tile will ever render for this one, so keep the name and
      // everything they told us — including the verdict, which has nowhere
      // else to live once the row is gone.
      const bits = [detail, row.working ? "was " + String(row.working).toLowerCase() : ""]
        .filter(Boolean).join(" · ");
      leftovers.push(bits ? name + " — " + bits : name);
    }
  }

  if (picked.length) m.chan = picked;
  if (leftovers.length) {
    const prior = String(m.otherChan || "").trim();
    m.otherChan = (prior ? prior + "\n" : "") + leftovers.join("\n");
  }
}

/**
 * Rating, volume and note for a channel that is no longer selected. Kept
 * during the session so an accidental deselect doesn't destroy a note,
 * dropped on load so they don't accumulate in the fragment forever.
 */
function pruneChannelDetail(m) {
  if (!m) return;
  const picked = new Set(Array.isArray(m.chan) ? m.chan : []);
  for (const key of Object.keys(m)) {
    const prefix = CHANNEL_KEY_PREFIXES.find((p) => key.indexOf(p) === 0);
    if (!prefix) continue;
    const id = key.slice(prefix.length);
    if (!picked.has(id)) delete m[key];
  }
}

/**
 * b14 and earlier stored taxonomy-only ticks under a bare service id.
 * Re-key them to the trade they were ticked under, using the snapshot
 * taken at tick-time, so nothing carries into another trade by accident.
 */
function migrateServiceScoping(m) {
  if (!m) return;
  // b15 and earlier held a single trade; companies commonly run two.
  if (typeof m.trade === "string") {
    if (m.trade && !Array.isArray(m.trades)) m.trades = [m.trade];
    if (m.trade) m._wasTrade = m.trade;
    delete m.trade;
  }
}

/**
 * Re-key taxonomy ticks made before ids were scoped to their trade.
 *
 * Every key hanging off a service id has to move together — the tick, its
 * snapshot, its priority, its dropped sub-services and its note. Migrating
 * only some is worse than migrating none: the service comes back having
 * quietly lost what was said about it.
 *
 * `fallbackTrade` covers sessions where the trade was never picked
 * explicitly and came from the sales handoff, so state has nothing to
 * re-key against. Only app.js knows that, hence the separate call.
 */
export function reconcileServiceScoping(state, fallbackTrade) {
  const m = state.m.services;
  if (!m || !Array.isArray(m.on) || !m.on.length) return;

  const trade = m._wasTrade || (Array.isArray(m.trades) && m.trades[0]) || fallbackTrade;
  delete m._wasTrade;
  if (!trade) return;

  const bare = m.on.filter((id) => id.indexOf(":") < 0);
  if (!bare.length) return;

  const move = (obj, from, to) => {
    if (obj && obj[from] !== undefined && obj[to] === undefined) {
      obj[to] = obj[from];
      delete obj[from];
    }
  };

  for (const id of bare) {
    const scoped = trade + ":" + id;
    move(m.snap, id, scoped);
    move(m.prio, id, scoped);
    move(m.subsOff, id, scoped);
    move(state.notes, "services:" + id, "services:" + scoped);
  }
  m.on = m.on.map((id) => (id.indexOf(":") < 0 ? trade + ":" + id : id));
}

function migrate(state) {
  for (const [mod, from, to] of RENAMES) {
    const m = state.m[mod];
    if (!m || m[from] === undefined) continue;
    if (m[to] === undefined || m[to] === "") m[to] = m[from];
    delete m[from];
  }
  migrateServiceScoping(state.m.services);
  migrateChannels(state.m.marketing);
  pruneChannelDetail(state.m.marketing);
  for (const [mod, key] of REMOVED) {
    const m = state.m[mod];
    if (m && m[key] !== undefined) delete m[key];
  }
  for (const mod of Object.keys(state.m)) {
    if (!Object.keys(state.m[mod]).length) delete state.m[mod];
  }
  return state;
}

/**
 * Accept a decoded object only if it is shaped like our state and
 * carries a version we understand. Anything else is discarded rather
 * than half-applied.
 */
export function validate(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.v !== VERSION) return null;
  const s = fresh();
  if (typeof obj.step === "string" && obj.step.length < 64) s.step = obj.step;
  if (obj.m && typeof obj.m === "object") s.m = obj.m;
  if (obj.order && typeof obj.order === "object") s.order = obj.order;
  if (Array.isArray(obj.skipped)) s.skipped = obj.skipped;
  if (obj.notes && typeof obj.notes === "object") s.notes = obj.notes;
  return migrate(s);
}

/**
 * Load precedence: URL fragment (an explicitly shared session) beats
 * localStorage (this browser's own history).
 */
export function load(clientSlug) {
  const hash = (location.hash || "").replace(/^#s=/, "");
  if (hash && hash !== location.hash) {
    try {
      const s = validate(decode(hash));
      if (s) return { state: s, from: "link" };
    } catch (e) { /* fall through */ }
  }
  try {
    const raw = localStorage.getItem(storageKey(clientSlug));
    if (raw) {
      const s = validate(JSON.parse(raw));
      if (s) return { state: s, from: "storage" };
    }
  } catch (e) { /* fall through */ }
  return { state: fresh(), from: "new" };
}
