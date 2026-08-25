// ============================================================
// 12 — Readout & exports
// ============================================================
//
// Consumes every other module's summary(). Three views over one
// captured state, plus the export API app.js calls for copy/download.

import { esc, ICON, sectionHead } from "../ui.js";
import { isSkipped, getPageNote, statusWithNote } from "../state.js";

const ID = "readout";
const TABS = [
  { key: "recap", label: "Client recap" },
  { key: "brief", label: "Internal brief" },
  { key: "raw", label: "Raw data" },
];

/* ── gather ───────────────────────────────────────────── */

/** Walk the registry once, collecting each module's summary and status. */
function collect(ctx) {
  const out = [];
  for (const m of ctx.modules) {
    if (m.id === ID) continue;
    const skipped = !!(m.skippable && isSkipped(ctx.state, m.id));
    let sum = null;
    let status = "empty";
    try {
      sum = skipped ? null : (m.summary ? m.summary(ctx) : null);
      status = skipped
        ? "skipped"
        : statusWithNote(ctx.state, m.id, m.status ? m.status(ctx) : "empty");
    } catch (e) {
      if (window.console) console.error("[summary:" + m.id + "]", e);
    }
    out.push({ mod: m, sum, status, skipped, note: getPageNote(ctx.state, m.id).trim() });
  }
  return out;
}

/** Open items from every source, in the order they'd need chasing. */
function openItems(ctx, parts) {
  const out = [];
  for (const p of parts) {
    if (p.skipped) {
      out.push({ what: p.mod.nav, detail: "Didn't cover this on the call", kind: "skipped" });
      continue;
    }
    if (p.sum && Array.isArray(p.sum.open)) {
      for (const o of p.sum.open) out.push({ ...o, kind: "gap", from: p.mod.nav });
    }
    if (!p.sum && p.status === "empty" && p.mod.skippable) {
      out.push({ what: p.mod.nav, detail: "Nothing captured", kind: "empty" });
    }
  }
  return out;
}

/* ── shared renderers ─────────────────────────────────── */

function dl(rows) {
  if (!rows || !rows.length) return "";
  return '<dl class="dl">' + rows.map(([k, v]) =>
    "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>"
  ).join("") + "</dl>";
}

function rankedList(list, limit) {
  if (!list || !list.items || !list.items.length) return "";
  const items = limit ? list.items.slice(0, limit) : list.items;
  return '<ol class="olist">' + items.map((it) =>
    '<li><span class="k">' + it.n + '</span><span class="v">' + esc(it.name) + "</span>" +
    (it.meta ? '<span class="badge b-st x">' + esc(it.meta.split(" · ")[0]) + "</span>" : "") +
    "</li>"
  ).join("") + "</ol>";
}

function table(t) {
  if (!t || !t.body || !t.body.length) return "";
  return '<div style="overflow-x:auto;margin-top:14px"><table style="width:100%;border-collapse:collapse;font-size:14px">' +
    "<thead><tr>" + t.head.map((h) =>
      '<th style="text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid var(--char);' +
      'font-family:\'OSCondensed\',sans-serif;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;' +
      'white-space:nowrap">' + esc(h) + "</th>"
    ).join("") + "</tr></thead><tbody>" +
    t.body.map((r) => "<tr>" + r.map((c) =>
      '<td style="padding:9px 12px 9px 0;border-bottom:1px solid var(--line);vertical-align:top">' + esc(c) + "</td>"
    ).join("") + "</tr>").join("") +
    "</tbody></table></div>";
}

function openBlock(items, heading) {
  if (!items.length) {
    return '<div class="card"><div class="mlabel">' + esc(heading) + "</div>" +
      '<div style="margin-top:10px;font-size:15px;color:var(--ok)">Nothing outstanding. Clean sheet.</div></div>';
  }
  return '<div class="card"><div class="mlabel">' + esc(heading) + " (" + items.length + ")</div>" +
    '<div style="margin-top:12px">' + items.map((o) =>
      '<div class="open"><span class="w">' + esc(o.what) + "</span>" +
      '<span class="badge ' + (o.kind === "skipped" ? "b-ver" : o.kind === "empty" ? "b-st" : "b-risk") + '">' +
      (o.kind === "skipped" ? "Skipped" : o.kind === "empty" ? "Blank" : "Gap") + "</span>" +
      '<span class="d">' + esc(o.detail) + "</span></div>"
    ).join("") + "</div></div>";
}

/**
 * Notes are Sam's own shorthand from the call — they belong in the
 * internal brief and the exports, never in the client-facing recap.
 */
function notesFrom(parts) {
  return parts.filter(function (p) { return p.note; });
}

function notesBlock(parts) {
  const noted = notesFrom(parts);
  if (!noted.length) return "";
  return (
    '<div class="card"><div class="mlabel">Notes from the call (' + noted.length + ")</div>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
        "Your own shorthand, kept out of the client recap." +
      "</div>" +
      noted.map(function (p) {
        return '<div style="margin-top:20px;padding-left:14px;border-left:3px solid var(--gold)">' +
          '<div class="mlabel" style="color:var(--muted)">' + esc(p.mod.nav) +
            (p.skipped ? " &middot; didn&rsquo;t cover" : "") + "</div>" +
          '<div style="margin-top:6px;font-size:15px;line-height:1.6;white-space:pre-wrap">' +
            esc(p.note) + "</div>" +
        "</div>";
      }).join("") +
    "</div>"
  );
}

/**
 * Modules that carry their own ranked list. Services builds its order from
 * priority buckets on its own screen; locations still has a rank screen.
 */
const RANKED = { services: "services", locations: "locations" };

function ranksFor(parts) {
  const pick = (id) => {
    const p = parts.find((x) => x.mod.id === id);
    return p && p.sum && p.sum.list ? p.sum.list : null;
  };
  return { services: pick(RANKED.services), locations: pick(RANKED.locations) };
}

/** True when this module's list is already printed in the build-order block. */
function isRanked(id) {
  return id === RANKED.services || id === RANKED.locations;
}

/* ── tab: client recap ────────────────────────────────── */

function recapView(ctx, parts) {
  const r = ranksFor(parts);
  const open = openItems(ctx, parts).filter((o) => o.kind !== "empty");
  const name = ctx.client.client.name || "this kickoff";

  const five =
    '<div class="dark">' +
      '<div class="mlabel">Month one</div>' +
      '<h2 style="margin-top:8px">First <span class="volt" style="font-size:44px;line-height:.7;display:inline-block">five and five</span></h2>' +
      '<div class="sumcols" style="margin-top:26px">' +
        '<div><div class="mlabel">Lead services</div>' +
          (rankedList(r.services, 5) || '<div style="margin-top:12px;color:#8d9490">Not ranked</div>') + "</div>" +
        '<div><div class="mlabel">Lead cities</div>' +
          (rankedList(r.locations, 5) || '<div style="margin-top:12px;color:#8d9490">Not ranked</div>') + "</div>" +
      "</div>" +
    "</div>";

  const orders =
    '<div class="sumcols">' +
      (r.services ? '<div class="card"><div class="mlabel">Full service order</div>' + rankedList(r.services) + "</div>" : "") +
      (r.locations ? '<div class="card"><div class="mlabel">Full city order</div>' + rankedList(r.locations) + "</div>" : "") +
    "</div>";

  return (
    '<div class="card"><div class="mlabel">Recap for ' + esc(name) + "</div>" +
      '<p class="lede" style="margin-top:10px">Here\'s what we agreed on the call, and what we need back from you ' +
      "before the first page goes up.</p></div>" +
    five + orders +
    openBlock(open, "What we need from you")
  );
}

/* ── tab: internal brief ──────────────────────────────── */

function briefView(ctx, parts) {
  const r = ranksFor(parts);
  const open = openItems(ctx, parts);

  const detail = parts
    .filter((p) => p.sum && (p.sum.rows || p.sum.table))
    .map((p) =>
      '<div class="card"><div class="mlabel">' + esc(p.mod.nav) + "</div>" +
      dl(p.sum.rows) + (isRanked(p.mod.id) ? "" : table(p.sum.table)) + "</div>"
    ).join("");

  const priorities =
    (r.services || r.locations)
      ? '<div class="card"><div class="mlabel">Build order</div><div class="sumcols" style="margin-top:8px">' +
          (r.services ? "<div><h3>Services</h3>" + rankedList(r.services) + "</div>" : "") +
          (r.locations ? "<div><h3>Cities</h3>" + rankedList(r.locations) + "</div>" : "") +
        "</div></div>"
      : "";

  return openBlock(open, "Open items") + notesBlock(parts) + priorities + detail;
}

/* ── tab: raw ─────────────────────────────────────────── */

function rawView(ctx, parts) {
  return (
    '<div class="warn">' + ICON.lock +
      "<div><strong>Treat the share link as confidential</strong><br>" +
      "It carries revenue, targets, budgets and competitor notes in the URL. The fragment is never sent " +
      "to a server, but the full link is stored wherever you paste it &mdash; Slack keeps it searchable " +
      "workspace-wide and in compliance exports. Internal DMs only. For anything durable, use the JSON export." +
      "</div></div>" +
    '<div class="card"><div class="mlabel">Structured export</div>' +
      '<p style="margin:10px 0 0;font-size:15px;color:var(--green-text)">' +
      "Everything captured, ready for Airtable, Notion, or the OS.</p>" +
      '<pre class="raw" style="margin-top:18px">' + esc(JSON.stringify(buildJson(ctx, parts), null, 2)) + "</pre>" +
    "</div>"
  );
}

/* ── export builders ──────────────────────────────────── */

function buildJson(ctx, parts) {
  const out = {
    client: ctx.client.client,
    slug: ctx.client.slug,
    capturedAt: new Date().toISOString().slice(0, 10),
    sections: {},
    openItems: openItems(ctx, parts).map((o) => ({ what: o.what, detail: o.detail, kind: o.kind })),
  };
  for (const p of parts) {
    if (p.skipped) {
      out.sections[p.mod.id] = p.note ? { skipped: true, note: p.note } : { skipped: true };
      continue;
    }
    if (!p.sum && !p.note) continue;
    const s = {};
    if (p.note) s.note = p.note;
    // p.sum is null on a screen that carries only a note — guard every read.
    if (p.sum && p.sum.rows) s.fields = Object.fromEntries(p.sum.rows);
    if (p.sum && p.sum.list) s.ranked = p.sum.list.items.map((i) => ({ rank: i.n, name: i.name, detail: i.meta }));
    if (p.sum && p.sum.table) s.table = { columns: p.sum.table.head, rows: p.sum.table.body };
    out.sections[p.mod.id] = s;
  }
  return out;
}

function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }

function buildCsv(ctx, parts) {
  const lines = [["section", "field_or_col", "value", "extra"].map(csvCell).join(",")];
  const push = (a, b, c, d) => lines.push([a, b, c, d].map(csvCell).join(","));

  push("client", "name", ctx.client.client.name, ctx.client.client.market);

  for (const p of parts) {
    const sec = p.mod.nav;
    if (p.skipped) {
      push(sec, "_status", "skipped", "");
      if (p.note) push(sec, "note", p.note, "");
      continue;
    }
    if (p.note) push(sec, "note", p.note, "");
    if (!p.sum) continue;
    if (p.sum.rows) for (const [k, v] of p.sum.rows) push(sec, k, v, "");
    if (p.sum.list) for (const it of p.sum.list.items) push(sec, "rank " + it.n, it.name, it.meta || "");
    if (p.sum.table) {
      for (const row of p.sum.table.body) {
        push(sec, p.sum.table.head[0] + ": " + row[0], row.slice(1).join(" | "), "");
      }
    }
  }
  for (const o of openItems(ctx, parts)) push("Open items", o.what, o.detail, o.kind);
  return lines.join("\r\n");
}

function buildText(ctx, parts, mode) {
  const L = [];
  const c = ctx.client.client;
  const r = ranksFor(parts);

  L.push((c.name || "KICKOFF").toUpperCase() + (c.market ? " — " + c.market.toUpperCase() : ""));
  L.push(mode === "recap" ? "Kickoff recap" : "Internal kickoff brief");
  L.push(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
  L.push("");

  if (r.services) {
    L.push("SERVICES IN PRIORITY ORDER");
    r.services.items.forEach((i) => L.push("  " + i.n + ". " + i.name + (i.meta ? "  [" + i.meta + "]" : "")));
    L.push("");
  }
  if (r.locations) {
    L.push("CITIES IN PRIORITY ORDER");
    r.locations.items.forEach((i) => L.push("  " + i.n + ". " + i.name + (i.meta ? "  [" + i.meta + "]" : "")));
    L.push("");
  }

  if (mode === "brief") {
    const noted = notesFrom(parts);
    if (noted.length) {
      L.push("NOTES FROM THE CALL");
      noted.forEach(function (p) {
        L.push("  " + p.mod.nav.toUpperCase() + (p.skipped ? " (didn't cover)" : ""));
        p.note.split("\n").forEach(function (line) { L.push("    " + line); });
      });
      L.push("");
    }
    for (const p of parts) {
      if (p.skipped || !p.sum || (!p.sum.rows && !p.sum.table)) continue;
      L.push(p.mod.nav.toUpperCase());
      if (p.sum.rows) for (const [k, v] of p.sum.rows) L.push("  " + k + ": " + v);
      // its table is the ranked list, already printed above
      if (p.sum.table && !isRanked(p.mod.id)) {
        for (const row of p.sum.table.body) L.push("  - " + row.filter(Boolean).join(" | "));
      }
      L.push("");
    }
  }

  const open = openItems(ctx, parts).filter((o) => mode === "brief" || o.kind !== "empty");
  if (open.length) {
    L.push(mode === "recap" ? "WHAT WE NEED FROM YOU" : "OPEN ITEMS");
    open.forEach((o) => L.push("  - " + o.what + ": " + o.detail));
    L.push("");
  }

  if (r.services && r.services.items.length) {
    L.push("MONTH ONE: " + r.services.items.slice(0, 5).map((i) => i.name).join(" / "));
  }
  if (r.locations && r.locations.items.length) {
    L.push("FIRST PAGES: " + r.locations.items.slice(0, 5).map((i) => i.name).join(" / "));
  }
  return L.join("\n");
}

/* ── module ───────────────────────────────────────────── */

export default {
  id: ID,
  nav: "Readout",
  title: "Here's what we agreed",
  lede: "Three views over the same call. Send the recap same-day, hand the brief to whoever picks up the work, and keep the raw export for the OS.",
  skippable: false,

  render(ctx) {
    const parts = collect(ctx);
    const tab = (ctx.transient[ID] && ctx.transient[ID].tab) || "recap";

    const tabs = '<div class="tabs">' + TABS.map((t) =>
      '<button class="chip' + (t.key === tab ? " on" : "") + '" data-tab="' + ID + "|" + t.key + '">' +
      esc(t.label) + "</button>"
    ).join("") + "</div>";

    const view =
      tab === "brief" ? briefView(ctx, parts) :
      tab === "raw" ? rawView(ctx, parts) :
      recapView(ctx, parts);

    const actions =
      '<div class="navrow" style="padding-bottom:40px">' +
        '<button class="btn" data-action="link">' + ICON.link + " Copy share link</button>" +
        '<button class="btn dark" data-action="' + (tab === "brief" ? "brief" : "recap") + '">Copy ' +
          (tab === "brief" ? "brief" : "recap") + " as text</button>" +
        '<button class="btn ghost" data-action="json">Download JSON</button>' +
        '<button class="btn ghost" data-action="csv">Download CSV</button>' +
        '<button class="btn ghost" data-action="print">Print</button>' +
        '<button class="btn ghost" data-action="clear" style="margin-left:auto;color:var(--risk)">Clear this kickoff</button>' +
      "</div>";

    return sectionHead(ctx.num, this.title, this.lede) + tabs + view + actions;
  },

  status() { return "done"; },
  summary() { return null; },

  /** Export API — called by app.js for copy and download actions. */
  exports(ctx) {
    const parts = collect(ctx);
    return {
      recap: () => buildText(ctx, parts, "recap"),
      brief: () => buildText(ctx, parts, "brief"),
      json: () => JSON.stringify(buildJson(ctx, parts), null, 2),
      csv: () => buildCsv(ctx, parts),
    };
  },
};
