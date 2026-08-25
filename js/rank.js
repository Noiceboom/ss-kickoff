// ============================================================
// rank.js — drag-to-rank engine
// ============================================================
//
// Used by the locations rank screen and by the services priority buckets,
// which store their order differently — so the caller owns the reorder
// through ctx.reorder() and this file only handles the gesture.
//
// Three input paths, because dragging on a screen-share is unreliable:
//   1. pointer drag on the handle
//   2. ↑ / ↓ buttons
//   3. arrow keys on a focused handle
//
// Order mutation for the locations list lives in state.applyOrder, which
// preserves the slots of OFF items: toggling an item off and back on must
// not teleport it to the end of the ranking.

import { esc, ICON } from "./ui.js";
import { onList, applyOrder } from "./state.js";

/* ── render ───────────────────────────────────────────── */

function tierHead(label, cls, note) {
  return (
    '<div class="tier"><span class="lab ' + cls + '">' + esc(label) + "</span>" +
    '<span class="r"></span><span class="c">' + esc(note) + "</span></div>"
  );
}

/**
 * @param key        "services" | "locations"
 * @param items      output of state.onList()
 * @param describe   (item) => string — the grey subline
 * @param tier1Label short label for the top band
 */
export function renderList(key, items, describe, tier1Label) {
  const n = items.length;
  if (!n) {
    return (
      '<div class="card" style="text-align:center;color:var(--muted)">' +
      "Nothing turned on yet &mdash; go back a step and check a few boxes." +
      "</div>"
    );
  }

  let h = "";
  for (let i = 0; i < n; i++) {
    if (i === 0) h += tierHead("Tier 1 · " + tier1Label, "t1", "Positions 1–5");
    if (i === 5) h += tierHead("Tier 2 · Next up", "t2", "Positions 6–10");
    if (i === 10) h += tierHead("Tier 3 · Later", "t3", "Everything else");
    h += row(key, items[i], i, n, describe);
  }
  return h;
}

function row(key, it, i, n, describe) {
  const color = i < 5 ? "var(--orange)" : i < 10 ? "var(--char)" : "var(--faint)";
  const id = esc(key) + "|" + esc(it.id);
  return (
    '<div class="row" data-row-id="' + id + '">' +
      '<button class="grip" data-grip="' + id + '" tabindex="0" aria-label="Reorder ' + esc(it.name) + '">' + ICON.grip + "</button>" +
      '<div class="pos" style="color:' + color + '">' + (i + 1) + "</div>" +
      '<div class="rname"><div class="n">' + esc(it.name) + "</div>" +
        '<div class="s">' + esc(describe(it)) + "</div></div>" +
      '<div class="arrows">' +
        '<button class="arrow" data-mv="' + id + '|-1"' + (i === 0 ? " disabled" : "") + ' aria-label="Move up">' + ICON.up + "</button>" +
        '<button class="arrow" data-mv="' + id + '|1"' + (i === n - 1 ? " disabled" : "") + ' aria-label="Move down">' + ICON.down + "</button>" +
      "</div>" +
      '<button class="btn ghost sm" data-top="' + id + '">Top</button>' +
    "</div>"
  );
}

/* ── mutation ─────────────────────────────────────────── */

function ids(state, key, clientItems) {
  return onList(state, key, clientItems).map(function (x) { return x.id; });
}

export function move(state, key, clientItems, itemId, delta) {
  const list = ids(state, key, clientItems);
  const i = list.indexOf(itemId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return false;
  list.splice(j, 0, list.splice(i, 1)[0]);
  applyOrder(state, key, clientItems, list);
  return true;
}

export function toTop(state, key, clientItems, itemId) {
  const list = ids(state, key, clientItems);
  const i = list.indexOf(itemId);
  if (i < 1) return false;
  list.unshift(list.splice(i, 1)[0]);
  applyOrder(state, key, clientItems, list);
  return true;
}

/** Move `itemId` to the slot currently held by `targetId`. */
export function moveTo(state, key, clientItems, itemId, targetId) {
  const list = ids(state, key, clientItems);
  const from = list.indexOf(itemId);
  const to = list.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return false;
  list.splice(to, 0, list.splice(from, 1)[0]);
  applyOrder(state, key, clientItems, list);
  return true;
}

/* ── pointer drag ─────────────────────────────────────── */
//
// Live-swap: the dragged row gets pointer-events:none so
// elementFromPoint reports the row beneath it. On each crossing we
// reorder and re-render, then re-acquire the (new) node.

let drag = null;

export function startDrag(ev, gripEl, ctx) {
  const raw = gripEl.getAttribute("data-grip") || "";
  const bar = raw.indexOf("|");
  if (bar < 0) return;

  const key = raw.slice(0, bar);
  const id = raw.slice(bar + 1);
  const rowEl = document.querySelector('[data-row-id="' + cssEscape(raw) + '"]');
  if (!rowEl) return;

  drag = { key: key, id: id, ctx: ctx };
  rowEl.classList.add("drag");
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);
  ev.preventDefault();
}

function onMove(ev) {
  if (!drag) return;
  const y = ev.clientY;

  // auto-scroll near the viewport edges
  if (y < 90) window.scrollBy(0, -14);
  else if (y > window.innerHeight - 70) window.scrollBy(0, 14);

  const under = document.elementFromPoint(ev.clientX, y);
  const target = under && under.closest ? under.closest("[data-row-id]") : null;
  if (!target) return;

  const raw = target.getAttribute("data-row-id") || "";
  const bar = raw.indexOf("|");
  if (bar < 0) return;
  if (raw.slice(0, bar) !== drag.key) return;

  const targetId = raw.slice(bar + 1);
  if (targetId === drag.id) return;

  // The ctx owns the reorder so this engine works for both the locations
  // list and the services priority buckets, which store order differently.
  if (!drag.ctx.reorder(drag.key, drag.id, targetId)) return;

  drag.ctx.rerender();
  const again = document.querySelector('[data-row-id="' + cssEscape(drag.key + "|" + drag.id) + '"]');
  if (again) again.classList.add("drag");
}

function endDrag() {
  if (!drag) return;
  const el = document.querySelector('[data-row-id="' + cssEscape(drag.key + "|" + drag.id) + '"]');
  if (el) {
    el.classList.remove("drag");
    el.classList.add("hot");
    setTimeout(function () { el.classList.remove("hot"); }, 600);
  }
  const ctx = drag.ctx;
  drag = null;
  document.body.style.userSelect = "";
  document.removeEventListener("pointermove", onMove);
  document.removeEventListener("pointerup", endDrag);
  document.removeEventListener("pointercancel", endDrag);
  if (ctx && ctx.commit) ctx.commit();
}

export function isDragging() { return !!drag; }

/** Minimal CSS.escape shim — ids are [a-z0-9-] plus our "|" separator. */
function cssEscape(s) {
  if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
  return String(s).replace(/["\\]/g, "\\$&");
}
