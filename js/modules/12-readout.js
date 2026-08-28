// ============================================================
// 12 — Readout & exports
// ============================================================
//
// Consumes every other module's summary(). Three views over one
// captured state, plus the export API app.js calls for copy/download.

import { esc, ICON, sectionHeadFor, filled } from "../ui.js";
import { isSkipped, getPageNote, statusWithNote, slot } from "../state.js";
import { buildPayload, buildCsv as machineCsv } from "../export.js";
import { BUILD } from "../build.js";
import { sayer, DISCOVERY } from "../modes.js";

const ID = "readout";

const TABS = {
  kickoff: [
    { key: "recap", label: "Client document" },
    { key: "brief", label: "Internal brief" },
    { key: "raw", label: "Raw data" },
  ],
  // Named for what it costs to open, not for what it contains. On a
  // shared screen the tab strip is the thing being read while the mouse
  // is moving, and "Internal brief" does not stop a hand mid-click.
  discovery: [
    { key: "recap", label: "Your document" },
    { key: "brief", label: "Internal \u2014 don\u2019t open on the call" },
    { key: "raw", label: "Raw data" },
  ],
};

const tabsFor = (mode) => TABS[mode] || TABS.kickoff;

/* ── copy ─────────────────────────────────────────────── */

export const COPY = {
  lede: {
    kickoff: "Three views over the same call. Send the recap same-day, hand the brief to whoever picks up the work, and keep the raw export for the OS.",
    discovery: "Three views over the same call. The first is what you get, the second is mine, and the third is the one that carries everything across if we work together.",
  },
  recapWarn: {
    kickoff: "This is exactly what the client gets.",
    discovery: "This is exactly what the prospect gets.",
  },
  recapWarnBody: {
    kickoff: "Print or save as PDF from the button below and it prints this page and nothing else &mdash; whichever tab you happen to be on. Your call notes are not in here.",
    discovery: "Print or save as PDF from the button below and it prints this page and nothing else &mdash; whichever tab you happen to be on. Your notes, and everything on the internal tab, are not in here.",
  },
  coverLede: {
    kickoff: "Everything we agreed on the kickoff call &mdash; the services and areas we&rsquo;re building around, in the order you told us they matter, and the handful of things we need back from you before the first page goes up.",
    discovery: "Everything you told us on our call, written down so you can check we heard it right &mdash; where the business is now, where you want it to get to, and the services and areas that matter most.",
  },
  asksLabel: {
    kickoff: "What we need from you",
    discovery: "What we still need to know",
  },
  asksLede: {
    kickoff: "Short list. Each one unblocks something we can&rsquo;t start without.",
    discovery: "Short list. Each one changes what we&rsquo;d put in front of you next.",
  },
  asksNone: {
    kickoff: "Nothing &mdash; you gave us everything on the call. We&rsquo;ll take it from here.",
    discovery: "Nothing &mdash; you covered everything. We have what we need to put something together.",
  },
  docTitle: { kickoff: "Kickoff", discovery: "Discovery call" },
};

/* ── gather ───────────────────────────────────────────── */

/* ── what stops this being priced ─────────────────────── */
//
// Sam's call, and the reason there is no score anywhere in this file:
// a number like "6/10" invites you to trust it over the conversation, and
// it is the single worst thing to have on screen when you tab wrong.
//
// This is the other half of that decision — not a judgement about the
// prospect, just the list of things still missing before anyone can put a
// price on the work. Derived from empty fields, so it empties itself as
// the call goes on.
//
// Internal tab only. It never reaches the client document and never
// reaches print.
const UNKNOWNS = [
  { mod: "goals", key: "budget", what: "No budget figure",
    why: "Nothing to size a proposal against — build-to-a-cap and build-to-a-return are different documents" },
  { mod: "goals", key: "avgTicket", what: "No average ticket",
    why: "Without it there is no way to say what a lead is worth to them" },
  { mod: "goals", key: "closeRate", what: "No close rate",
    why: "Leads-to-revenue is guesswork until this is a number" },
  { mod: "goals", key: "revTarget", what: "No target revenue",
    why: "No gap to size the work against" },
  { mod: "goals", key: "capacity", what: "Capacity unknown",
    why: "Selling volume into a business that cannot service it is a churn story" },
  { mod: "whynow", key: "liveBy", what: "No timeline",
    why: "No date to work back from, and no idea whether this is live or a nurture" },
  { mod: "whynow", key: "whoDecides", what: "Decision-makers unknown",
    why: "A proposal can land in front of someone who has heard none of this" },
  { mod: "marketing", key: "contractEnd", what: "Incumbent contract end unknown",
    why: "Cannot say when we could actually start", when: (st) => filled(slot(st, "marketing").agency) },
];

function unknowns(ctx) {
  const out = [];
  for (const u of UNKNOWNS) {
    if (u.when && !u.when(ctx.state)) continue;
    if (filled(slot(ctx.state, u.mod)[u.key])) continue;
    out.push(u);
  }
  return out;
}

function unknownsBlock(ctx) {
  const list = unknowns(ctx);
  const svc = (ctx.state.m.services || {}).prio;
  const loc = (ctx.state.m.locations || {}).prio;
  const extra = [];
  if (!svc || !Object.keys(svc).length) {
    extra.push({ what: "No service is prioritised", why: "Nothing to lead the first month with" });
  }
  if (!loc || !Object.keys(loc).length) {
    extra.push({ what: "No city is prioritised", why: "Nothing to lead the first month with" });
  }
  const all = list.concat(extra);

  if (!all.length) {
    return '<div class="card"><div class="mlabel">Before this can be priced</div>' +
      '<div style="margin-top:10px;font-size:15px;color:var(--ok)">Nothing missing. You can price this.</div></div>';
  }
  return (
    '<div class="card"><div class="mlabel">Before this can be priced (' + all.length + ")</div>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
        "What is still unanswered. Not a score, and not a judgement &mdash; just what is missing." +
      "</div>" +
      '<div style="margin-top:12px">' + all.map((u) =>
        '<div class="open"><span class="w">' + esc(u.what) + "</span>" +
        '<span class="badge b-st">Unknown</span>' +
        '<span class="d">' + esc(u.why) + "</span></div>"
      ).join("") + "</div>" +
    "</div>"
  );
}

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

/* ── the client document ──────────────────────────────── */
//
// Everything the client told us, laid out as something worth keeping.
// This is the artifact that gets sent after the call, so two rules:
//
//   1. Page notes never appear here. They are Sam's own shorthand from
//      the call — "last agency burned them" is true, useful, and not
//      something to mail to the client.
//
//   2. Open items only appear if they carry an `ask` — the client-facing
//      wording. The bare `detail` is written for whoever picks up the
//      work ("the copywriter is guessing", "this is what reporting
//      arguments are made of") and reads as an insult in a deliverable.

/** Bound copy resolver — this file calls it from free functions, not methods. */
function t(ctx, key) { return sayer(COPY, ctx.mode)(key); }

/**
 * A prospect usually has no clients/<slug>.json, so `client.name` is
 * empty and the only name we have is the one they typed on the call.
 * The cover of the document they get should not say "Discovery call".
 */
function nameFrom(ctx) {
  return String((ctx.state.m.company || {}).businessName || "").trim();
}

function cover(ctx) {
  const c = ctx.client.client || {};
  const when = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    '<div class="dark cover">' +
      '<div class="covertop">' +
        '<span class="mlabel">Service Scalers</span>' +
        '<span class="mlabel">' + esc(when) + "</span>" +
      "</div>" +
      "<h1>" + esc(c.name || nameFrom(ctx) || t(ctx, "docTitle")) + "</h1>" +
      (c.market ? '<div class="covermkt">' + esc(c.market) + "</div>" : "") +
      '<div class="coverline"></div>' +
      '<p class="coverlede">' + t(ctx, "coverLede") + "</p>" +
      (c.website ? '<div class="coverweb">' + esc(c.website) + "</div>" : "") +
    "</div>"
  );
}

/** Only the items written for the client to read. */
function asksFrom(ctx, parts) {
  return openItems(ctx, parts).filter((o) => o.ask);
}

function askBlock(ctx, items) {
  if (!items.length) {
    return '<div class="card"><div class="mlabel">' + t(ctx, "asksLabel") + "</div>" +
      '<div style="margin-top:10px;font-size:16px;color:var(--ok)">' + t(ctx, "asksNone") + "</div></div>";
  }
  return (
    '<div class="card asks"><div class="mlabel">' + t(ctx, "asksLabel") + "</div>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
        t(ctx, "asksLede") +
      "</div>" +
      '<ol class="asklist">' + items.map((o) =>
        "<li><span class=\"w\">" + esc(o.what) + "</span>" +
        '<span class="a">' + esc(o.ask) + "</span></li>"
      ).join("") + "</ol>" +
    "</div>"
  );
}

/** Every section the client actually answered, in the order we asked. */
function sectionsBlock(parts) {
  return parts
    .filter((p) => !p.skipped && p.sum && ((p.sum.rows && p.sum.rows.length) || (p.sum.table && p.sum.table.body.length)))
    .map((p) =>
      '<div class="card docsec"><div class="mlabel">' + esc(p.mod.nav) + "</div>" +
      dl(p.sum.rows) + (isRanked(p.mod.id) ? "" : table(p.sum.table)) + "</div>"
    ).join("");
}

/**
 * Only the quotes that were ticked. A transcript quote is verbatim, and
 * verbatim is exactly what you would not want printed unread — this is
 * the half of the rule that lives on the printing side of it.
 */
function quotesBlock(ctx) {
  const s = ctx.state.m.transcript || {};
  const ex = s.extract;
  const ok = Array.isArray(s.approved) ? s.approved : [];
  if (!ex || !Array.isArray(ex.quotes) || !ok.length) return "";
  const picked = ex.quotes.filter((q) => ok.indexOf(q.id) > -1);
  if (!picked.length) return "";
  return (
    '<div class="dark"><div class="mlabel">In your words</div>' +
      picked.map((q) =>
        '<div style="margin-top:22px"><div style="font-size:21px;line-height:1.45">&ldquo;' +
        esc(q.text) + '&rdquo;</div>' +
        (q.speaker ? '<div class="mlabel" style="margin-top:8px">' + esc(q.speaker) + "</div>" : "") +
        "</div>"
      ).join("") +
    "</div>"
  );
}

function clientDoc(ctx, parts) {
  const r = ranksFor(parts);

  const five =
    '<div class="dark">' +
      '<div class="mlabel">Month one</div>' +
      '<h2 style="margin-top:8px">First <span class="volt" style="font-size:44px;line-height:.7;display:inline-block">five and five</span></h2>' +
      '<div class="sumcols" style="margin-top:26px">' +
        '<div><div class="mlabel">Lead services</div>' +
          (rankedList(r.services, 5) || '<div style="margin-top:12px;color:#8d9490">Not ranked yet</div>') + "</div>" +
        '<div><div class="mlabel">Lead cities</div>' +
          (rankedList(r.locations, 5) || '<div style="margin-top:12px;color:#8d9490">Not ranked yet</div>') + "</div>" +
      "</div>" +
    "</div>";

  const orders =
    (r.services || r.locations)
      ? '<div class="sumcols">' +
          (r.services ? '<div class="card"><div class="mlabel">Full service order</div>' + rankedList(r.services) + "</div>" : "") +
          (r.locations ? '<div class="card"><div class="mlabel">Full city order</div>' + rankedList(r.locations) + "</div>" : "") +
        "</div>"
      : "";

  return (
    cover(ctx) +
    five +
    orders +
    quotesBlock(ctx) +
    '<div class="docrule"><span>Everything you told us</span></div>' +
    sectionsBlock(parts) +
    askBlock(ctx, asksFrom(ctx, parts))
  );
}

/* ── tab: client document (on screen) ─────────────────── */

function recapView(ctx, parts) {
  return (
    '<div class="warn">' + ICON.doc +
      "<div><strong>" + t(ctx, "recapWarn") + "</strong> " + t(ctx, "recapWarnBody") + "</div></div>" +
    clientDoc(ctx, parts)
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

  // In discovery this tab is the one thing on the machine that must not
  // be read by the person on the other end of the call, so it says so at
  // the top of itself rather than relying on the tab label alone.
  const guard = ctx.mode === DISCOVERY
    ? '<div class="warn">' + ICON.lock +
        "<div><strong>Don&rsquo;t open this while you&rsquo;re sharing your screen.</strong><br>" +
        "Your own notes, the gaps in what they told you, and what is still missing before this " +
        "can be priced. None of it is in the document they get, and none of it prints." +
        "</div></div>"
    : "";

  return guard + openBlock(open, "Open items") +
    (ctx.mode === DISCOVERY ? unknownsBlock(ctx) : "") +
    notesBlock(parts) + priorities + detail;
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
      '<pre class="raw" style="margin-top:18px">' + esc(JSON.stringify(payload(ctx, parts), null, 2)) + "</pre>" +
    "</div>"
  );
}

/* ── export builders ──────────────────────────────────── */

/**
 * Open items are computed by the readout, not by export.js, so they ride
 * in on ctx rather than being recomputed from a second walk of the
 * modules — two walks is two chances to disagree.
 */
function payload(ctx, parts) {
  return buildPayload({ ...ctx, openItems: openItems(ctx, parts) }, parts, BUILD);
}

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
  lede: COPY.lede.kickoff,
  skippable: false,

  discovery: {
    title: "Here\u2019s what you told us",
    lede: COPY.lede.discovery,
  },

  render(ctx) {
    const parts = collect(ctx);
    const tab = (ctx.transient[ID] && ctx.transient[ID].tab) || "recap";

    const tabs = '<div class="tabs">' + tabsFor(ctx.mode).map((x) =>
      '<button class="chip' + (x.key === tab ? " on" : "") + '" data-tab="' + ID + "|" + x.key + '">' +
      esc(x.label) + "</button>"
    ).join("") + "</div>";

    const view =
      tab === "brief" ? briefView(ctx, parts) :
      tab === "raw" ? rawView(ctx, parts) :
      recapView(ctx, parts);

    const actions =
      '<div class="navrow" style="padding-bottom:40px">' +
        '<button class="btn" data-action="link">' + ICON.link + " Copy share link</button>" +
        '<button class="btn ghost" data-action="' + (tab === "brief" ? "brief" : "recap") + '">Copy ' +
          (tab === "brief" ? "brief" : "recap") + " as text</button>" +
        '<button class="btn ghost" data-action="json">Download JSON</button>' +
        '<button class="btn ghost" data-action="csv">Download CSV</button>' +
        '<button class="btn dark" data-action="print">' + ICON.doc + " Save " +
          (ctx.mode === DISCOVERY ? "the" : "client") + " PDF</button>" +
        '<button class="btn ghost" data-action="clear" style="margin-left:auto;color:var(--risk)">Clear this kickoff</button>' +
      "</div>";

    return (
      '<div class="screenonly">' +
        sectionHeadFor(this, ctx) + tabs + view + actions +
      "</div>" +
      // Rendered on every tab and hidden on screen. Print then emits the
      // client document no matter which tab is open — the old behaviour
      // printed whatever was showing, so printing from the internal brief
      // sent the client their own close rate and the notes from the call.
      '<div class="printdoc">' + clientDoc(ctx, parts) + "</div>"
    );
  },

  status() { return "done"; },
  summary() { return null; },

  /** Export API — called by app.js for copy and download actions. */
  exports(ctx) {
    const parts = collect(ctx);
    return {
      recap: () => buildText(ctx, parts, "recap"),
      brief: () => buildText(ctx, parts, "brief"),
      json: () => JSON.stringify(payload(ctx, parts), null, 2),
      csv: () => machineCsv(payload(ctx, parts)),
    };
  },
};
