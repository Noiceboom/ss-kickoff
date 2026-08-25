// ============================================================
// state.js — the single state object, autosave, and URL codec
// ============================================================
//
// State stores ONLY diffs against the client JSON. Client content
// (scraped services, locations, flags) is never copied in, which keeps
// share links short and lets a re-scrape land without invalidating an
// in-progress kickoff.

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

/* ── notes ────────────────────────────────────────────── */

export function noteKey(id, itemId) { return id + ":" + itemId; }
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

function migrate(state) {
  for (const [mod, from, to] of RENAMES) {
    const m = state.m[mod];
    if (!m || m[from] === undefined) continue;
    if (m[to] === undefined || m[to] === "") m[to] = m[from];
    delete m[from];
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
