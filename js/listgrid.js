// ============================================================
// listgrid.js — the confirm-grid shared by modules 05 and 07
// ============================================================
//
// Both screens are the same object: a checkbox card per scraped item,
// optional sub-service chips, badges, a per-item note, and an
// add-your-own field. Only the badges and the grouping differ.

import { esc, ICON } from "./ui.js";
import { mergedList, getNote } from "./state.js";

/** Collapsed note field. Expanded when it has content or was opened. */
export function noteBlock(key, value, placeholder, openMap) {
  const has = !!String(value || "").trim();
  const open = has || !!(openMap && openMap[key]);
  return (
    '<button class="notebtn' + (has ? " has" : "") + '" data-noteopen="' + esc(key) + '">' +
      (has ? "&#9679; Note added" : "+ Add note") +
    "</button>" +
    '<textarea class="note" data-note="' + esc(key) + '" placeholder="' + esc(placeholder) + '"' +
      (open ? "" : " hidden") + ">" + esc(value) + "</textarea>"
  );
}

function card(key, it, note, placeholder, openMap, badgesFor) {
  const noteKey = key + ":" + it.id;

  const subs = it.subs.length
    ? '<div class="subs">' + it.subs.map((s) =>
        '<button class="chip sm' + (s.on ? " on" : " strike") + '" data-sub="' +
        esc(key) + "|" + esc(it.id) + "|" + esc(s.name) + '">' + esc(s.name) + "</button>"
      ).join("") + "</div>"
    : "";

  return (
    '<div class="item' + (it.on ? "" : " off") + '" data-card="' + esc(key) + "|" + esc(it.id) + '">' +
      '<div class="itop">' +
        '<button class="check' + (it.on ? " on" : "") + '" data-item="' + esc(key) + "|" + esc(it.id) +
          '" aria-label="Toggle ' + esc(it.name) + '">' + ICON.check + "</button>" +
        '<div class="iname">' +
          '<div class="n" data-item="' + esc(key) + "|" + esc(it.id) + '">' + esc(it.name) + "</div>" +
          '<div class="m">' + badgesFor(it) + "</div>" +
          (it.verify
            ? '<div style="font-size:13px;color:var(--warn);margin-top:7px;line-height:1.45">' + esc(it.verify) + "</div>"
            : "") +
        "</div>" +
      "</div>" + subs +
      noteBlock(noteKey, note, placeholder, openMap) +
    "</div>"
  );
}

/**
 * @param opts.key          "services" | "locations"
 * @param opts.badgesFor    (item) => HTML string
 * @param opts.notePlaceholder
 * @param opts.groupBy      optional (item) => group label
 * @param opts.groupOrder   optional array ordering the group labels
 */
export function renderGrid(ctx, opts) {
  const { state, client, transient } = ctx;
  const key = opts.key;
  const items = mergedList(state, key, key === "services" ? client.services : client.locations);
  const openMap = transient.notes || {};

  const one = (it) =>
    card(key, it, getNote(state, key, it.id), opts.notePlaceholder, openMap, opts.badgesFor);

  if (!items.length) {
    return (
      '<div class="card" style="text-align:center;color:var(--muted)">' +
      "Nothing loaded for this client yet. Add entries below, or open with " +
      "<code>?c=client-slug</code> once the client file exists." +
      "</div>"
    );
  }

  if (!opts.groupBy) return '<div class="grid">' + items.map(one).join("") + "</div>";

  const groups = new Map();
  for (const it of items) {
    const g = opts.groupBy(it) || "Other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }

  const order = (opts.groupOrder || []).filter((g) => groups.has(g));
  for (const g of groups.keys()) if (order.indexOf(g) < 0) order.push(g);

  return order.map((g) => {
    const arr = groups.get(g);
    const on = arr.filter((x) => x.on).length;
    return (
      '<div class="gtitle"><span class="t">' + esc(g) + '</span><span class="r"></span>' +
      '<span class="mono" style="font-size:10px;color:var(--faint)">' + on + " / " + arr.length + " ON</span></div>" +
      '<div class="grid">' + arr.map(one).join("") + "</div>"
    );
  }).join("");
}

/** Toolbar: live count plus select/clear, and any extra buttons. */
export function toolbar(ctx, key, noun, extra) {
  const items = mergedList(ctx.state, key, key === "services" ? ctx.client.services : ctx.client.locations);
  const on = items.filter((x) => x.on).length;
  return (
    '<div class="tools">' +
      '<div class="count"><i>' + on + "</i> of " + items.length + " " + esc(noun) + " on</div>" +
      '<button class="btn ghost sm" data-all="' + esc(key) + '|1">Select all</button>' +
      '<button class="btn ghost sm" data-all="' + esc(key) + '|0">Clear all</button>' +
      (extra || "") +
    "</div>"
  );
}

export function addBox(key, heading, help, placeholder, buttonLabel) {
  return (
    '<div class="card" style="margin-top:22px">' +
      "<h3>" + esc(heading) + "</h3>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:4px">' + esc(help) + "</div>" +
      '<div class="newrow">' +
        '<input class="tin" data-newitem="' + esc(key) + '" placeholder="' + esc(placeholder) + '">' +
        '<button class="btn" data-additem="' + esc(key) + '">' + esc(buttonLabel) + "</button>" +
      "</div>" +
    "</div>"
  );
}

/** Shared status(): touched at all → done, otherwise partial. */
export function gridStatus(state, key) {
  const s = state.m[key];
  if (!s) return "empty";
  const touched = (s.off || []).length || Object.keys(s.subsOff || {}).length || (s.added || []).length;
  return touched ? "done" : "partial";
}

/** Shared summary rows for both grids. */
export function gridSummary(ctx, key, noun) {
  const items = mergedList(ctx.state, key, key === "services" ? ctx.client.services : ctx.client.locations);
  if (!items.length) return null;
  const on = items.filter((x) => x.on);
  const off = items.filter((x) => !x.on);
  const rows = [["Confirmed", on.length + " of " + items.length + " " + noun]];
  if (off.length) rows.push(["Dropped", off.map((x) => x.name).join(", ")]);
  const droppedSubs = on
    .filter((x) => x.subs.some((s) => !s.on))
    .map((x) => x.name + " — " + x.subs.filter((s) => !s.on).map((s) => s.name).join(", "));
  if (droppedSubs.length) rows.push(["Sub-services dropped", droppedSubs.join(" · ")]);
  const noted = items.filter((x) => getNote(ctx.state, key, x.id));
  if (noted.length) rows.push(["Notes on", noted.map((x) => x.name).join(", ")]);
  return { rows };
}
