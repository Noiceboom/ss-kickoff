// ============================================================
// 05 — Services: industry, selection, priority and build order
// ============================================================
//
// One screen does the whole job. Pick the trade, and the industry's full
// service list appears with whatever the scrape found already ticked —
// so this is a confirm-and-add exercise, not a blank page. Each selected
// service takes a High / Medium / Low priority, and the build order at
// the foot of the page assembles itself from those buckets, draggable
// within each one.
//
// The old separate "rank services" screen is gone: on a call, flipping
// between two screens to say "that one's important" was a step nobody
// needed.

import { sectionHead, skipRow, field, esc, ICON } from "../ui.js";
import {
  isSkipped, slot, svcState, serviceUniverse, onServices,
  servicesByPriority, serviceOrder, getNote,
} from "../state.js";
import { TRADES, getTrade, resolveTrade } from "../trades/index.js";
import { noteBlock } from "../listgrid.js";

const ID = "services";

const BUCKETS = [
  { key: "high", label: "High", note: "Build these first" },
  { key: "med", label: "Medium", note: "Next wave" },
  { key: "low", label: "Low", note: "Eventually" },
];

/** The trade in play: explicitly chosen, else inferred from the scrape. */
export function activeTrade(ctx) {
  const chosen = svcState(ctx.state).trade;
  if (chosen) return chosen;
  return resolveTrade((ctx.client.client || {}).trade) || "";
}

function tradeServices(ctx) {
  const t = getTrade(activeTrade(ctx));
  return t ? t.services : [];
}

/* ── industry ─────────────────────────────────────────── */

function industryCard(ctx) {
  const active = activeTrade(ctx);
  const inferred = !svcState(ctx.state).trade && active;
  const chips = TRADES.map((t) =>
    '<button class="chip' + (t.id === active ? " on" : "") + '" data-chip="' + ID + "|trade|" + esc(t.id) + '" ' +
    'data-multi="0">' + esc(t.label) + "</button>"
  ).join("");

  return (
    '<div class="card">' +
      '<div class="mlabel">Industry</div>' +
      '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
        "Picking the trade loads its full service list. Anything already on their site comes through ticked." +
      "</div>" +
      '<div class="chips" style="margin-top:18px">' + chips + "</div>" +
      (inferred
        ? '<div style="margin-top:14px;font-size:13.5px;color:var(--muted)">' +
          "Set from the sales handoff. Tap another to change it." +
          "</div>"
        : "") +
    "</div>"
  );
}

/* ── service tiles ────────────────────────────────────── */

function tile(ctx, it) {
  const note = getNote(ctx.state, ID, it.id);
  const openMap = ctx.transient.notes || {};
  const badges =
    (it.source === "added" ? '<span class="badge b-ver">Added on call</span>' : "") +
    (it.source === "both" || it.source === "scrape" ? '<span class="badge b-page">On their site</span>' : "") +
    (it.subs.length ? '<span class="badge b-sub">' + it.subs.filter((s) => s.on).length + " / " + it.subs.length + "</span>" : "");

  const detail = it.on
    ? '<div class="tiledetail">' +
        '<div class="seg">' +
          BUCKETS.map((b) =>
            '<button class="segbtn ' + b.key + (it.prio === b.key ? " on" : "") + '" ' +
            'data-chip="' + ID + "|prio_" + esc(it.id) + "|" + b.key + '" data-multi="0">' +
            esc(b.label) + "</button>"
          ).join("") +
        "</div>" +
        (it.subs.length
          ? '<div class="subs" style="border-top:none;padding-top:10px;margin-top:10px">' +
            it.subs.map((s) =>
              '<button class="chip sm' + (s.on ? " on" : " strike") + '" data-sub="' +
              ID + "|" + esc(it.id) + "|" + esc(s.name) + '">' + esc(s.name) + "</button>"
            ).join("") + "</div>"
          : "") +
        noteBlock(ID + ":" + it.id, note, "Margin, who runs it, anything to flag…", openMap) +
      "</div>"
    : "";

  return (
    '<div class="tile' + (it.on ? " on" : "") + '" data-filter-item data-card="' + ID + "|" + esc(it.id) + '" ' +
      'data-filter-text="' + esc(it.name + " " + it.subs.map((s) => s.name).join(" ")) + '">' +
      '<button class="tilebtn" data-svc="' + esc(it.id) + "|" + (it.source === "trade" ? "1" : "0") + '">' +
        '<span class="box">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" ' +
          'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        "</span>" +
        '<span class="nm">' + esc(it.name) +
          (badges ? '<span class="tilebadges">' + badges + "</span>" : "") +
        "</span>" +
      "</button>" + detail +
    "</div>"
  );
}

function servicesCard(ctx) {
  const trade = getTrade(activeTrade(ctx));
  const all = serviceUniverse(ctx.state, ctx.client, tradeServices(ctx));
  const on = all.filter((x) => x.on).length;
  const query = (ctx.transient[ID] || {}).filter || "";

  if (!all.length) {
    return (
      '<div class="card" style="text-align:center;color:var(--muted)">' +
      "Pick an industry above to load its service list, or add services by hand once you have." +
      "</div>"
    );
  }

  return (
    '<div class="card">' +
      '<div class="pickhead">' +
        "<div><h3>" + esc(trade ? trade.label + " services" : "Services") + "</h3>" +
          "<p>Untick anything they don't actually do. Everything ticked needs a priority.</p></div>" +
        '<div class="pickcount"><span class="v' + (on ? "" : " zero") + '">' + on + "</span>" +
          '<span class="l">of ' + all.length + "</span></div>" +
      "</div>" +
      '<div class="pickfilter">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input data-filter="' + ID + '|svc" autocomplete="off" value="' + esc(query) + '" ' +
          'placeholder="Filter ' + all.length + ' services&hellip;">' +
      "</div>" +
      '<div class="pickgrid" style="margin-top:18px">' + all.map((it) => tile(ctx, it)).join("") + "</div>" +
      '<div class="pickother">' +
        '<div class="mlabel">Something we missed</div>' +
        '<div class="newrow">' +
          '<input class="tin" data-newitem="' + ID + '" placeholder="Add a service and hit Enter…">' +
          '<button class="btn" data-additem="' + ID + '">Add service</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

/* ── build order ──────────────────────────────────────── */

function orderRow(it, n) {
  return (
    '<div class="row" data-row-id="prio-' + esc(it.prio || "none") + "|" + esc(it.id) + '">' +
      '<button class="grip" data-grip="prio-' + esc(it.prio || "none") + "|" + esc(it.id) +
        '" tabindex="0" aria-label="Reorder ' + esc(it.name) + '">' + ICON.grip + "</button>" +
      '<div class="pos">' + n + "</div>" +
      '<div class="rname"><div class="n">' + esc(it.name) + "</div>" +
        '<div class="s">' + esc(it.subs.filter((s) => s.on).map((s) => s.name).join(" · ") || "Single page") + "</div></div>" +
    "</div>"
  );
}

function orderCard(ctx) {
  const b = servicesByPriority(ctx.state, ctx.client, tradeServices(ctx));
  const total = b.high.length + b.med.length + b.low.length + b[""].length;
  if (!total) return "";

  let n = 0;
  const bucket = (cfg, items) => {
    if (!items.length) return "";
    const head =
      '<div class="tier"><span class="lab t-' + cfg.key + '">' + esc(cfg.label) + "</span>" +
      '<span class="r"></span><span class="c">' + esc(cfg.note) + " · " + items.length + "</span></div>";
    return head + items.map((it) => orderRow(it, ++n)).join("");
  };

  const unset = b[""].length
    ? '<div class="tier"><span class="lab t3">No priority yet</span><span class="r"></span>' +
      '<span class="c">' + b[""].length + " waiting</span></div>" +
      '<div class="excl">' + b[""].map((it) =>
        '<span class="chip sm" style="background:var(--body);color:var(--muted);border-color:var(--line);cursor:default">' +
        esc(it.name) + "</span>").join("") + "</div>"
    : "";

  return (
    '<div class="card">' +
      '<div class="mlabel">Build order</div>' +
      '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
        "Assembled from the priorities above. Drag within a band to settle what gets built first." +
      "</div>" +
      '<div style="margin-top:22px">' +
        BUCKETS.map((cfg) => bucket(cfg, b[cfg.key])).join("") + unset +
      "</div>" +
    "</div>"
  );
}

/* ── module ───────────────────────────────────────────── */

export default {
  id: ID,
  nav: "Services",
  title: "Is this everything you sell?",
  lede: "Pick the trade, confirm what they actually do, then say how much each one matters. The build order at the bottom writes itself.",
  skippable: true,
  notePrompt:
    "What they said about specific jobs — margins, which crew does what, work they'd rather not take.",

  render(ctx) {
    return (
      sectionHead("05", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +
      industryCard(ctx) +
      servicesCard(ctx) +
      orderCard(ctx)
    );
  },

  /**
   * The ids currently in one priority bucket, in display order. app.js
   * uses this to reorder within a band without needing to know how the
   * buckets are assembled.
   */
  /** Name and subs for one service, so app.js can snapshot it on tick. */
  serviceMeta(ctx, id) {
    const hit = serviceUniverse(ctx.state, ctx.client, tradeServices(ctx)).find((x) => x.id === id);
    return hit ? { name: hit.name, subs: hit.subs.map((s) => s.name) } : null;
  },

  bucketIds(ctx, bucketKey) {
    const b = servicesByPriority(ctx.state, ctx.client, tradeServices(ctx));
    const key = bucketKey === "none" ? "" : bucketKey;
    return (b[key] || []).map((x) => x.id);
  },

  status(ctx) {
    const v = svcState(ctx.state);
    if (!activeTrade(ctx)) return "empty";
    const on = onServices(ctx.state, ctx.client, tradeServices(ctx));
    if (!on.length) return "partial";
    return on.every((x) => x.prio) ? "done" : "partial";
  },

  summary(ctx) {
    const trade = getTrade(activeTrade(ctx));
    const all = serviceUniverse(ctx.state, ctx.client, tradeServices(ctx));
    if (!all.length) return null;

    const ordered = serviceOrder(ctx.state, ctx.client, tradeServices(ctx));
    const b = servicesByPriority(ctx.state, ctx.client, tradeServices(ctx));
    const off = all.filter((x) => !x.on && x.source !== "trade");

    const rows = [];
    if (trade) rows.push(["Industry", trade.label]);
    const selected = all.filter((x) => x.on);
    rows.push(["Services selected", selected.length + " of " + all.length]);
    if (b.high.length) rows.push(["High priority", b.high.map((x) => x.name).join(", ")]);
    if (b.med.length) rows.push(["Medium priority", b.med.map((x) => x.name).join(", ")]);
    if (b.low.length) rows.push(["Low priority", b.low.map((x) => x.name).join(", ")]);
    if (off.length) rows.push(["Dropped", off.map((x) => x.name).join(", ")]);

    const droppedSubs = ordered
      .filter((x) => x.subs.some((s) => !s.on))
      .map((x) => x.name + " — " + x.subs.filter((s) => !s.on).map((s) => s.name).join(", "));
    if (droppedSubs.length) rows.push(["Sub-services dropped", droppedSubs.join(" · ")]);

    const open = [];
    if (!trade) open.push({ what: "Industry", detail: "No trade picked — the service list is whatever the scrape found" });
    if (b[""].length) {
      open.push({
        what: "Services with no priority",
        detail: b[""].length + " selected but unranked: " + b[""].slice(0, 6).map((x) => x.name).join(", ") +
          (b[""].length > 6 ? "…" : ""),
      });
    }
    if (!b.high.length && ordered.length) {
      open.push({ what: "Nothing marked High", detail: "Nobody said what gets built first" });
    }

    return {
      rows,
      open,
      list: {
        title: "Services in build order",
        items: ordered.map((it, i) => ({
          n: i + 1,
          name: it.name,
          meta: (it.prio ? it.prio.toUpperCase() : "unranked") +
            (it.subs.filter((s) => s.on).length ? " · " + it.subs.filter((s) => s.on).length + " subs" : ""),
        })),
      },
      table: {
        head: ["type", "rank", "name", "priority", "subs kept"],
        body: ordered.map((it, i) => [
          "service", String(i + 1), it.name, it.prio || "unranked",
          it.subs.filter((s) => s.on).map((s) => s.name).join("; "),
        ]),
      },
    };
  },
};
