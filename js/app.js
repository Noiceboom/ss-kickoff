// ============================================================
// app.js — boot, client load, routing, and ALL event delegation
// ============================================================

import * as S from "./state.js";
import { esc, ICON, pageNote } from "./ui.js";
import * as rank from "./rank.js";
import MODULES from "./modules/index.js";

/* ── constants ────────────────────────────────────────── */

// Bump on every deploy. Shown in the header so a stale browser cache is
// visible at a glance instead of looking like the change never shipped.
export const BUILD = "b5";

const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const FRAGMENT_LIMIT = 6000;      // practical URL ceiling before we refuse to share
const SAVE_DEBOUNCE = 400;
const MAX_STR = 4000;             // per-string cap when validating a decoded fragment

// Never enough on its own — the constrained inputs in module 11 are the
// real control — but it catches a secret typed into the wrong box.
const SECRET_RE = /(pass(word|wd|phrase)|api[_-]?key|apikey|secret|auth[_-]?token|bearer\s|\bpin\b|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY)/i;

/* ── runtime ──────────────────────────────────────────── */

const R = {
  client: null,
  state: null,
  slug: "template",
  transient: {},        // never persisted, never encoded
  saveTimer: null,
  warnedSecret: 0,
  mismatch: [],
};

const byId = new Map(MODULES.map((m) => [m.id, m]));

function moduleAt(id) { return byId.get(id) || MODULES[0]; }
function indexOf(id) { const i = MODULES.findIndex((m) => m.id === id); return i < 0 ? 0 : i; }

function ctx() {
  return {
    state: R.state,
    client: R.client,
    transient: R.transient,
    slug: R.slug,
    mismatch: R.mismatch,
    modules: MODULES,
  };
}

/* ── client load ──────────────────────────────────────── */

function slugFromUrl() {
  const raw = new URLSearchParams(location.search).get("c") || "";
  return SLUG_RE.test(raw) ? raw : "template";
}

function emptyClient(slug) {
  return {
    slug: slug,
    client: { name: "", market: "", website: "", trade: "" },
    source: { scrapedAt: "", from: "", method: "manual" },
    services: [],
    locations: [],
  };
}

/** Accept only the closed schema. Anything else is dropped, not trusted. */
function sanitizeClient(raw, slug) {
  const out = emptyClient(slug);
  if (!raw || typeof raw !== "object") return out;
  const c = raw.client || {};
  out.slug = typeof raw.slug === "string" ? raw.slug.slice(0, 40) : slug;
  out.client = {
    name: str(c.name), market: str(c.market), website: str(c.website), trade: str(c.trade),
  };
  const s = raw.source || {};
  out.source = { scrapedAt: str(s.scrapedAt), from: str(s.from), method: str(s.method) };
  out.services = arr(raw.services).map((x) => ({
    id: str(x && x.id), name: str(x && x.name),
    subs: arr(x && x.subs).map(str).filter(Boolean),
    hasPage: !!(x && x.hasPage),
    verify: x && x.verify ? str(x.verify) : null,
  })).filter((x) => x.id && x.name);
  out.locations = arr(raw.locations).map((x) => ({
    id: str(x && x.id), name: str(x && x.name), state: str(x && x.state),
    hasPage: !!(x && x.hasPage),
    verify: x && x.verify ? str(x.verify) : null,
  })).filter((x) => x.id && x.name);
  return out;
}

function str(v) { return typeof v === "string" ? v.slice(0, MAX_STR) : ""; }
function arr(v) { return Array.isArray(v) ? v : []; }

async function loadClient(slug) {
  try {
    const res = await fetch("clients/" + slug + ".json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    return sanitizeClient(await res.json(), slug);
  } catch (e) {
    if (slug !== "template") {
      try {
        const res = await fetch("clients/template.json", { cache: "no-store" });
        if (res.ok) return sanitizeClient(await res.json(), "template");
      } catch (e2) { /* fall through */ }
    }
    return emptyClient(slug);
  }
}

/* ── stale-JSON reconciliation ────────────────────────── */
//
// Ids in saved state that no longer exist in the client JSON are
// PRESERVED, never pruned — loading an older JSON must not destroy data.

function findMismatch() {
  const out = [];
  [["services", R.client.services], ["locations", R.client.locations]].forEach(([key, items]) => {
    const known = new Set(items.map((x) => x.id));
    const slot = R.state.m[key];
    if (!slot) return;
    (slot.added || []).forEach((a) => known.add(a.id));
    (slot.off || []).forEach((id) => { if (!known.has(id)) out.push(key + " · " + id); });
    Object.keys(slot.subsOff || {}).forEach((id) => { if (!known.has(id)) out.push(key + " · " + id); });
  });
  return out;
}

/* ── list plumbing shared with rank.js ────────────────── */

function itemsFor(key) {
  return key === "services" ? R.client.services : R.client.locations;
}

/* ── save ─────────────────────────────────────────────── */

function markSaved() {
  const el = document.getElementById("saved");
  if (!el) return;
  el.textContent = "Saved";
  el.classList.add("on");
  clearTimeout(markSaved._t);
  markSaved._t = setTimeout(() => el.classList.remove("on"), 1400);
}

function queueSave() {
  clearTimeout(R.saveTimer);
  R.saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE);
}

function flushSave() {
  clearTimeout(R.saveTimer);
  R.saveTimer = null;
  if (S.save(R.state, R.slug)) markSaved();
  // Typing never re-renders the screen, which would otherwise leave the
  // progress dots stale until you navigated. The pill strip is its own
  // container, so refreshing it here can't disturb a focused field.
  if (document.getElementById("pills")) renderPills();
}

window.addEventListener("beforeunload", flushSave);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSave(); });

/* ── render ───────────────────────────────────────────── */

const DEFAULT_PROMPT = "Anything they said on this screen worth keeping.";

/** The readout is a view over everything else — it gets no note box. */
function takesNote(m) { return m.id !== "readout"; }

function noteFor(m) {
  return pageNote(m.id, m.nav, S.getPageNote(R.state, m.id), m.notePrompt || DEFAULT_PROMPT);
}

function statusOf(m) {
  if (m.skippable && S.isSkipped(R.state, m.id)) return "skipped";
  let st = "empty";
  try { st = m.status ? m.status(ctx()) : "empty"; } catch (e) { st = "empty"; }
  return S.statusWithNote(R.state, m.id, st);
}

function renderPills() {
  const cur = R.state.step;
  const el = document.getElementById("pills");
  el.innerHTML = MODULES.map((m, i) => {
    const st = statusOf(m);
    return '<button class="pill' + (m.id === cur ? " on" : "") + '" data-st="' + st +
      '" data-go="' + esc(m.id) + '"><b>' + (i < 10 ? "0" : "") + i + "</b>" +
      esc(m.nav) + '<span class="dot"></span></button>';
  }).join("");

  const done = MODULES.filter((m) => { const s = statusOf(m); return s === "done" || s === "skipped"; }).length;
  const pct = Math.round((done / (MODULES.length - 1)) * 100);
  document.getElementById("pfill").style.width = Math.min(100, pct) + "%";
  document.getElementById("ppct").textContent = Math.min(100, pct) + "%";

  const active = el.querySelector(".pill.on");
  if (active && active.scrollIntoView) {
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function renderHeader() {
  const c = R.client.client;
  const name = c.name || "New kickoff";
  const sub = ([c.market, R.client.slug].filter(Boolean).join(" · ") || "no client loaded") +
    " · " + BUILD;
  document.getElementById("clientName").textContent = name;
  document.getElementById("clientSub").textContent = sub;
}

/** Capture focus so a re-render doesn't drop the caret. */
function captureFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const keyAttr = ["data-f", "data-row", "data-note"].find((a) => el.hasAttribute && el.hasAttribute(a));
  if (!keyAttr) return null;
  return {
    attr: keyAttr,
    val: el.getAttribute(keyAttr),
    start: el.selectionStart,
    end: el.selectionEnd,
  };
}

function restoreFocus(f) {
  if (!f) return;
  const el = document.querySelector("[" + f.attr + '="' + f.val.replace(/["\\]/g, "\\$&") + '"]');
  if (!el) return;
  el.focus();
  try { if (f.start != null) el.setSelectionRange(f.start, f.end); } catch (e) { /* non-text input */ }
}

function render() {
  const f = captureFocus();
  const m = moduleAt(R.state.step);
  const i = indexOf(m.id);
  const skipped = !!(m.skippable && S.isSkipped(R.state, m.id));
  const mount = document.getElementById("mount");

  let body = "";
  try {
    body = m.render(ctx()) || "";
  } catch (e) {
    body = '<div class="card"><h3>This screen failed to render</h3><p class="lede">' +
      esc(String(e && e.message ? e.message : e)) + "</p></div>";
    if (window.console) console.error("[module:" + m.id + "]", e);
  }

  mount.className = "section" + (skipped ? " skipped" : "");
  mount.innerHTML =
    banner() +
    '<div class="body">' + body + "</div>" +
    (takesNote(m) ? noteFor(m) : "") +
    navFor(i);

  renderPills();
  renderHeader();
  restoreFocus(f);
}

function banner() {
  if (!R.mismatch.length) return "";
  return (
    '<div class="warn">' + ICON.warn + "<div><strong>Client data changed since this session was saved</strong><br>" +
    "These saved references no longer match the client file, so they may not show up: " +
    esc(R.mismatch.slice(0, 8).join(", ")) +
    (R.mismatch.length > 8 ? " and " + (R.mismatch.length - 8) + " more" : "") +
    ". Nothing was deleted.</div></div>"
  );
}

function navFor(i) {
  const prev = i > 0 ? MODULES[i - 1] : null;
  const next = i < MODULES.length - 1 ? MODULES[i + 1] : null;
  let h = '<div class="navrow">';
  if (prev) h += '<button class="btn ghost" data-go="' + esc(prev.id) + '">Back</button>';
  if (next) h += '<button class="btn" data-go="' + esc(next.id) + '">' + esc(next.nav) + " " + ICON.next + "</button>";
  return h + "</div>";
}

function goto(id) {
  if (!byId.has(id)) return;
  flushSave();
  R.state.step = id;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  queueSave();
}

/* ── toast ────────────────────────────────────────────── */

let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2400);
}
window.ssToast = toast;

/* ── input events — write only, NEVER re-render ───────── */

/**
 * Blocks anything that looks like a credential, every time. The throttle
 * only limits how often we toast — it must never stop the block, or the
 * guard would disarm itself after the first catch.
 */
function guardSecret(value) {
  if (!SECRET_RE.test(String(value))) return false;
  const now = Date.now();
  if (now - R.warnedSecret > 3000) {
    R.warnedSecret = now;
    toast("Not here — this doc never stores credentials");
  }
  return true;
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el || !el.getAttribute) return;

  const f = el.getAttribute("data-f");
  if (f) {
    const [mod, key] = f.split("|");
    if (guardSecret(el.value)) { el.value = ""; S.setField(R.state, mod, key, ""); return; }
    S.setField(R.state, mod, key, el.value);
    queueSave();
    return;
  }

  const rowAttr = el.getAttribute("data-row");
  if (rowAttr) {
    const [mod, key, idx, col] = rowAttr.split("|");
    const blocked = guardSecret(el.value);
    if (blocked) el.value = "";
    const rows = S.getRows(R.state, mod, key).slice();
    const i = Number(idx);
    while (rows.length <= i) rows.push({});
    rows[i] = { ...rows[i], [col]: blocked ? "" : el.value };
    S.ensure(R.state, mod)[key] = rows;
    queueSave();
    return;
  }

  const note = el.getAttribute("data-note");
  if (note) {
    if (guardSecret(el.value)) { el.value = ""; return; }
    const bar = note.indexOf(":");
    S.setNote(R.state, note.slice(0, bar), note.slice(bar + 1), el.value);
    // Toggle the "captured" styling in place. A class change on an
    // ancestor is safe mid-typing; re-rendering the screen would not be.
    const box = el.closest(".pagenote");
    if (box) box.classList.toggle("has", !!el.value.trim());
    queueSave();
  }
});

// selects fire change, not input
document.addEventListener("change", (e) => {
  const el = e.target;
  if (!el || el.tagName !== "SELECT") return;
  if (el.getAttribute("data-f") || el.getAttribute("data-row")) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

/* ── click events — discrete actions, these DO re-render ─ */

document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  let el;

  if ((el = t.closest("[data-go]"))) { goto(el.getAttribute("data-go")); return; }

  if ((el = t.closest("[data-skip]"))) {
    S.toggleSkip(R.state, el.getAttribute("data-skip"));
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-chip]"))) {
    const [mod, key, val] = el.getAttribute("data-chip").split("|");
    const multi = el.getAttribute("data-multi") === "1";
    if (multi) {
      const cur = S.getField(R.state, mod, key, []);
      const list = Array.isArray(cur) ? cur.slice() : [];
      const i = list.indexOf(val);
      if (i > -1) list.splice(i, 1); else list.push(val);
      S.setField(R.state, mod, key, list.length ? list : "");
    } else {
      S.setField(R.state, mod, key, S.getField(R.state, mod, key) === val ? "" : val);
    }
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-toggle]"))) {
    const [mod, key] = el.getAttribute("data-toggle").split("|");
    S.setField(R.state, mod, key, S.getField(R.state, mod, key, false) ? "" : true);
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-status]"))) {
    const [mod, key, val] = el.getAttribute("data-status").split("|");
    S.setField(R.state, mod, key, S.getField(R.state, mod, key) === val ? "" : val);
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-addrow]"))) {
    const [mod, key] = el.getAttribute("data-addrow").split("|");
    const rows = S.getRows(R.state, mod, key).slice();
    rows.push({});
    S.ensure(R.state, mod)[key] = rows;
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-delrow]"))) {
    const [mod, key, idx] = el.getAttribute("data-delrow").split("|");
    const rows = S.getRows(R.state, mod, key).slice();
    rows.splice(Number(idx), 1);
    if (rows.length) S.ensure(R.state, mod)[key] = rows;
    else if (R.state.m[mod]) delete R.state.m[mod][key];
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-tab]"))) {
    const [mod, name] = el.getAttribute("data-tab").split("|");
    if (!R.transient[mod]) R.transient[mod] = {};
    R.transient[mod].tab = name;
    render(); return;
  }

  // ── list grids ──
  if ((el = t.closest("[data-item]"))) {
    const [key, id] = el.getAttribute("data-item").split("|");
    S.toggleItem(R.state, key, id);
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-sub]"))) {
    const raw = el.getAttribute("data-sub");
    const p1 = raw.indexOf("|"); const p2 = raw.indexOf("|", p1 + 1);
    S.toggleSub(R.state, raw.slice(0, p1), raw.slice(p1 + 1, p2), raw.slice(p2 + 1));
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-all]"))) {
    const [key, on] = el.getAttribute("data-all").split("|");
    S.setAll(R.state, key, itemsFor(key), on === "1");
    render(); queueSave(); toast(on === "1" ? "All on" : "All off"); return;
  }

  if ((el = t.closest("[data-only]"))) {
    const [key, st] = el.getAttribute("data-only").split("|");
    const list = S.listState(R.state, key);
    list.off = S.mergedList(R.state, key, itemsFor(key))
      .filter((x) => x.state !== st).map((x) => x.id);
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-additem]"))) {
    addItem(el.getAttribute("data-additem"));
    return;
  }

  if ((el = t.closest("[data-noteopen]"))) {
    const k = el.getAttribute("data-noteopen");
    if (!R.transient.notes) R.transient.notes = {};
    R.transient.notes[k] = !R.transient.notes[k];
    render();
    const ta = document.querySelector('[data-note="' + k.replace(/["\\]/g, "\\$&") + '"]');
    if (ta && !ta.hidden) ta.focus();
    return;
  }

  // ── rank ──
  if ((el = t.closest("[data-mv]"))) {
    const [key, id, d] = el.getAttribute("data-mv").split("|");
    rank.move(R.state, key, itemsFor(key), id, Number(d));
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-top]"))) {
    const [key, id] = el.getAttribute("data-top").split("|");
    rank.toTop(R.state, key, itemsFor(key), id);
    render(); queueSave(); return;
  }

  if ((el = t.closest("[data-reset]"))) {
    const key = el.getAttribute("data-reset");
    S.resetOrder(R.state, key, itemsFor(key));
    render(); queueSave(); toast("Order reset"); return;
  }

  // ── exports ──
  if ((el = t.closest("[data-action]"))) { doAction(el.getAttribute("data-action")); return; }
});

/* ── drag + keyboard reordering ───────────────────────── */

document.addEventListener("pointerdown", (e) => {
  const g = e.target.closest ? e.target.closest("[data-grip]") : null;
  if (!g) return;
  rank.startDrag(e, g, {
    state: R.state,
    itemsFor: itemsFor,
    rerender: render,
    commit: () => { render(); queueSave(); },
  });
});

document.addEventListener("keydown", (e) => {
  const a = document.activeElement;
  const g = a && a.closest ? a.closest("[data-grip]") : null;
  if (g && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const [key, id] = g.getAttribute("data-grip").split("|");
    rank.move(R.state, key, itemsFor(key), id, e.key === "ArrowUp" ? -1 : 1);
    render(); queueSave();
    const again = document.querySelector('[data-grip="' + key + "|" + id + '"]');
    if (again) again.focus();
    return;
  }
  // Checked BEFORE the add-item Enter below: otherwise Cmd+Enter while
  // focused in "add a service" adds an item instead of jumping to the note,
  // and the modifier is silently ignored in exactly one field.
  //
  // Cmd/Ctrl+Enter — jump to this screen's note from anywhere on the page.
  // The services and cities grids are long; hunting for the box mid-sentence
  // is exactly when a quote gets lost.
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    const box = document.querySelector('[data-note$=":_page"]');
    if (!box) return;
    e.preventDefault();
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
    return;
  }

  if (e.key === "Enter" && a && a.getAttribute && a.getAttribute("data-newitem")) {
    e.preventDefault();
    addItem(a.getAttribute("data-newitem"));
  }
});

/* ── add custom service / location ────────────────────── */

function addItem(key) {
  const inp = document.querySelector('[data-newitem="' + key + '"]');
  if (!inp) return;
  const name = (inp.value || "").trim();
  if (!name) { inp.focus(); return; }

  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  const id = base + "-" + Math.random().toString(36).slice(2, 6);
  const item = key === "locations"
    ? { id, name, state: "", hasPage: false, verify: null, subs: [] }
    : { id, name, subs: [], hasPage: false, verify: null };

  S.addItem(R.state, key, item);
  inp.value = "";
  render();
  queueSave();
  toast('Added "' + name + '"');
  const card = document.querySelector('[data-card="' + key + "|" + id + '"]');
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ── exports ──────────────────────────────────────────── */

function fragment() { return "#s=" + S.encode(R.state); }

function copy(text, msg) {
  const done = () => toast(msg);
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); }
    catch (err) { toast("Copy failed — select it manually"); }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, fallback);
  } else fallback();
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function baseName() {
  return (R.client.slug || "kickoff") + "-kickoff";
}

function doAction(name) {
  const m = moduleAt("readout");
  const api = m && m.exports ? m.exports(ctx()) : null;

  if (name === "link") {
    flushSave();
    const frag = fragment();
    if (frag.length > FRAGMENT_LIMIT) {
      toast("Too large to share — use the JSON export");
      return;
    }
    try { history.replaceState(null, "", frag); } catch (e) { /* ignore */ }
    copy(location.origin + location.pathname + location.search + frag, "Link copied — treat it as confidential");
    return;
  }
  if (name === "recap" && api) { copy(api.recap(), "Client recap copied"); return; }
  if (name === "brief" && api) { copy(api.brief(), "Internal brief copied"); return; }
  if (name === "json" && api) { download(baseName() + ".json", api.json(), "application/json"); toast("JSON downloaded"); return; }
  if (name === "csv" && api) { download(baseName() + ".csv", "\ufeff" + api.csv(), "text/csv;charset=utf-8"); toast("CSV downloaded"); return; }
  if (name === "print") { window.print(); return; }
  if (name === "clear") {
    if (!window.confirm("Clear this kickoff from this browser? The share link still works if you saved it.")) return;
    S.clear(R.slug);
    R.state = S.fresh();
    R.state.step = MODULES[0].id;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    render();
    toast("Cleared");
  }
}

/* ── boot ─────────────────────────────────────────────── */

async function boot() {
  R.slug = slugFromUrl();
  R.client = await loadClient(R.slug);

  const loaded = S.load(R.slug);

  // A fragment must never silently overwrite an in-progress local session.
  if (loaded.from === "link") {
    let local = null;
    try {
      const raw = localStorage.getItem(S.storageKey(R.slug));
      if (raw) local = S.validate(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    if (S.hasWork(local)) {
      const ok = window.confirm(
        "This link contains a saved session for " + R.slug + ", and you already have " +
        "an in-progress kickoff for this client in this browser.\n\n" +
        "OK — open the link (your local copy is replaced)\n" +
        "Cancel — keep what you have"
      );
      R.state = ok ? loaded.state : local;
    } else {
      R.state = loaded.state;
    }
  } else {
    R.state = loaded.state;
  }

  if (!byId.has(R.state.step)) R.state.step = MODULES[0].id;
  R.mismatch = findMismatch();

  render();
  document.getElementById("boot").remove();
}

boot().catch((e) => {
  if (window.console) console.error(e);
  const b = document.getElementById("boot");
  if (b) b.textContent = "Failed to start: " + (e && e.message ? e.message : e);
});
