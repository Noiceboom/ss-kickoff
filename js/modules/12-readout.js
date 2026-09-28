// ============================================================
// 12 — Readout & exports
// ============================================================
//
// Consumes every other module's summary(). Three views over one
// captured state, plus the export API app.js calls for copy/download.

import { esc, ICON, sectionHeadFor, filled } from "../ui.js";
import { isSkipped, getPageNote, statusWithNote, slot } from "../state.js";
import { buildPayload } from "../export.js";
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

/** Discovery's "before this can be priced" list, as data. */
function unknownList(ctx) {
  if (ctx.mode !== DISCOVERY) return [];
  const list = unknowns(ctx);
  const svc = (ctx.state.m.services || {}).prio;
  const loc = (ctx.state.m.locations || {}).prio;
  if (!svc || !Object.keys(svc).length) {
    list.push({ what: "No service is prioritised", why: "Nothing to lead the first month with" });
  }
  if (!loc || !Object.keys(loc).length) {
    list.push({ what: "No city is prioritised", why: "Nothing to lead the first month with" });
  }
  return list;
}

function unknownsBlock(ctx) {
  const all = unknownList(ctx);

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
  t = trimTable(t);
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

  // Everything they said they do, not just what got a priority. The order
  // lists are build order and deliberately omit anything unranked — a rank
  // beside a decision nobody made reads as agreed — so without this a
  // service they told us about and we never ordered appeared nowhere in the
  // document they receive.
  const scope = (key) => {
    const u = ((parts.find((p) => p.mod.id === key) || {}).sum || {}).unranked;
    return u && u.items && u.items.length
      ? '<div style="margin-top:18px"><div class="mlabel" style="color:var(--muted)">Also in scope — order to be agreed</div>' +
        '<div style="margin-top:8px;font-size:15px;line-height:1.6">' + esc(u.items.join(" · ")) + "</div></div>"
      : "";
  };
  const orderCard = (key, list, label) => {
    const tail = scope(key);
    if (!list && !tail) return "";
    return '<div class="card"><div class="mlabel">' + label + "</div>" + (list ? rankedList(list) : "") + tail + "</div>";
  };
  const svcCard = orderCard("services", r.services, "Full service order");
  const locCard = orderCard("locations", r.locations, "Full city order");
  const orders = svcCard || locCard ? '<div class="sumcols">' + svcCard + locCard + "</div>" : "";

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

/* ── the one walk every internal output renders from ────── */
//
// The internal brief on screen, the brief as text and the Markdown file
// used to be written separately, each walking the screens its own way —
// and each dropped something different. The text version lost table
// headers; only the screen version had discovery's "before this can be
// priced" list; nothing rendered a note typed against a single service.
// They all read this now, in this order, so what one shows the others
// show.
//
// Nothing here is filtered for the client. The client document and the
// recap are built separately, from rows and tables only — `internal`,
// `itemNotes` and page notes are what they never touch.

function model(ctx, parts) {
  const c = ctx.client.client || {};
  const sections = [];
  for (const p of parts) {
    const sum = p.sum || {};
    const internal = sum.internal || {};
    const ranked = isRanked(p.mod.id);
    const sec = {
      id: p.mod.id,
      nav: p.mod.nav,
      skipped: p.skipped,
      rows: Array.isArray(sum.rows) ? sum.rows : [],
      // A ranked screen's own table only restates its list; its internal
      // table is the full picture — every selected item, ranked or not,
      // with its sub-services and notes.
      table: ranked ? (internal.table || null) : (sum.table || null),
      internalRows: ranked ? [] : (Array.isArray(internal.rows) ? internal.rows : []),
      internalTable: ranked ? null : (internal.table || null),
      itemNotes: Array.isArray(internal.notes) ? internal.notes : [],
      note: p.note || "",
    };
    const empty = !sec.rows.length && !sec.table && !sec.internalRows.length &&
      !sec.internalTable && !sec.itemNotes.length && !sec.note;
    if (empty && !sec.skipped) continue;
    sections.push(sec);
  }
  return {
    title: c.name || "Kickoff",
    market: c.market || "",
    website: c.website || "",
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    discovery: ctx.mode === DISCOVERY,
    ranks: ranksFor(parts),
    unranked: {
      services: ((parts.find((p) => p.mod.id === "services") || {}).sum || {}).unranked || null,
      locations: ((parts.find((p) => p.mod.id === "locations") || {}).sum || {}).unranked || null,
    },
    open: openItems(ctx, parts),
    unknowns: unknownList(ctx),
    sections,
  };
}

/* ── tab: internal brief ──────────────────────────────── */

function briefView(ctx, parts) {
  const M = model(ctx, parts);

  const priorities =
    (M.ranks.services || M.ranks.locations)
      ? '<div class="card"><div class="mlabel">Build order</div><div class="sumcols" style="margin-top:8px">' +
          (M.ranks.services ? "<div><h3>Services</h3>" + rankedList(M.ranks.services) + "</div>" : "") +
          (M.ranks.locations ? "<div><h3>Cities</h3>" + rankedList(M.ranks.locations) + "</div>" : "") +
        "</div></div>"
      : "";

  const detail = M.sections.filter((x) => !x.skipped).map((x) =>
    '<div class="card"><div class="mlabel">' + esc(x.nav) + "</div>" +
      dl(x.rows) + table(x.table) +
      (x.internalRows.length || x.internalTable
        ? '<div class="mlabel" style="margin-top:22px;color:var(--muted)">Internal</div>' +
          dl(x.internalRows) + table(x.internalTable)
        : "") +
      (x.itemNotes.length
        ? '<div class="mlabel" style="margin-top:22px;color:var(--muted)">Notes against items</div>' +
          dl(x.itemNotes)
        : "") +
    "</div>"
  ).join("");

  // In discovery this tab is the one thing on the machine that must not
  // be read by the person on the other end of the call, so it says so at
  // the top of itself rather than relying on the tab label alone.
  const guard = M.discovery
    ? '<div class="warn">' + ICON.lock +
        "<div><strong>Don&rsquo;t open this while you&rsquo;re sharing your screen.</strong><br>" +
        "Your own notes, the gaps in what they told you, and what is still missing before this " +
        "can be priced. None of it is in the document they get, and none of it prints." +
        "</div></div>"
    : "";

  return guard + openBlock(M.open, "Open items") +
    (M.discovery ? unknownsBlock(ctx) : "") +
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



/**
 * Render the model into lines. One function, two formatters — plain text
 * and Markdown — so the two can never disagree about what is in them.
 */
const FMT = {
  text: {
    title: (t) => [t.toUpperCase()],
    h: (t) => ["", t.toUpperCase()],
    sub: (t) => ["  " + t],
    kv: (k, v) => ["  " + k + ": " + v],
    item: (t) => ["  - " + t],
    ask: (t) => ["      Ask the client: " + t],
    num: (n, t) => ["  " + n + ". " + t],
    from: (src, t) => ["  - [" + src + "] " + t],
    para: (t) => String(t).split("\n").map((l) => "    " + l),
    table: (head, body) => {
      // Headers included. The old text brief printed each row joined with
      // pipes and no header, so a column of "high" or "yes" meant nothing.
      const w = head.map((h, i) => Math.max(String(h).length, ...body.map((r) => String(r[i] == null ? "" : r[i]).length)));
      const line = (r) => "  " + r.map((c, i) => String(c == null ? "" : c).padEnd(Math.min(w[i], 48))).join("  ").trimEnd();
      return [line(head), "  " + w.map((n) => "-".repeat(Math.min(n, 48))).join("  ")].concat(body.map(line));
    },
  },
  md: {
    title: (t) => ["# " + t],
    h: (t) => ["", "## " + t],
    sub: (t) => ["", "**" + t + "**"],
    ask: (t) => ["  - *Ask the client:* " + mdEsc(t)],
    num: (n, t) => [n + ". " + mdEsc(t)],
    from: (src, t) => ["- **" + mdEsc(src) + "** — " + mdEsc(t)],
    kv: (k, v) => ["- **" + mdEsc(k) + ":** " + mdEsc(v)],
    item: (t) => ["- " + mdEsc(t)],
    para: (t) => [""].concat(String(t).split("\n").map((l) => "> " + mdEsc(l))),
    table: (head, body) => [""]
      .concat(["| " + head.map(mdCell).join(" | ") + " |", "|" + head.map(() => " --- ").join("|") + "|"])
      .concat(body.map((r) => "| " + head.map((_, i) => mdCell(r[i])).join(" | ") + " |")),
  },
};
function mdEsc(v) {
  // Only what changes Markdown's meaning mid-line. Escaping brackets and
  // underscores everywhere made the raw file — which is how most people
  // will read or paste it — full of backslashes.
  return String(v == null ? "" : v).replace(/([\\`*<>])/g, "\\$1").replace(/\[([^\]]*)\]\(/g, "\\[$1\\](");
}
function mdCell(v) { return mdEsc(v).replace(/\|/g, "\\|").replace(/\n/g, " "); }

/** Drop columns that are empty in every row. */
function trimTable(t) {
  if (!t || !t.body || !t.body.length) return t;
  const keep = t.head.map((_, i) => t.body.some((r) => String(r[i] == null ? "" : r[i]).trim() !== ""));
  if (keep.every(Boolean)) return t;
  return { head: t.head.filter((_, i) => keep[i]), body: t.body.map((r) => r.filter((_, i) => keep[i])) };
}

function renderInternal(M, f) {
  let L = [];
  const add = (xs) => { L = L.concat(xs); };

  add(f.title(M.title + (M.market ? " — " + M.market : "")));
  add(f.kv(M.discovery ? "Document" : "Document", M.discovery ? "Discovery call — internal" : "Kickoff — internal brief"));
  add(f.kv("Date", M.date));
  if (M.website) add(f.kv("Website", M.website));

  if (M.open.length) {
    add(f.h("Open items"));
    for (const o of M.open) {
      add(o.from ? f.from(o.from, o.what + " — " + o.detail) : f.item(o.what + " — " + o.detail));
      if (o.ask) add(f.ask(o.ask));
    }
  }
  if (M.unknowns.length) {
    add(f.h("Before this can be priced"));
    for (const u of M.unknowns) add(f.item(u.what + " — " + u.why));
  }

  const noted = M.sections.filter((x) => x.note);
  if (noted.length) {
    add(f.h("Notes from the call"));
    for (const x of noted) { add(f.sub(x.nav + (x.skipped ? " (didn't cover)" : ""))); add(f.para(x.note)); }
  }

  for (const [key, label] of [["services", "Services in build order"], ["locations", "Cities in build order"]]) {
    const list = M.ranks[key];
    if (list && list.items.length) {
      add(f.h(label));
      for (const i of list.items) add(f.num(i.n, i.name + (i.meta ? " (" + i.meta + ")" : "")));
    }
  }

  for (const x of M.sections) {
    if (x.skipped) { add(f.h(x.nav)); add(f.item("Didn't cover this on the call")); continue; }
    add(f.h(x.nav));
    for (const [k, v] of x.rows) add(f.kv(k, v));
    const tb = trimTable(x.table);
    if (tb && tb.body.length) add(f.table(tb.head, tb.body));
    if (x.internalRows.length || (x.internalTable && x.internalTable.body.length)) {
      add(f.sub("Internal"));
      for (const [k, v] of x.internalRows) add(f.kv(k, v));
      const it = trimTable(x.internalTable);
      if (it && it.body.length) add(f.table(it.head, it.body));
    }
    if (x.itemNotes.length) {
      add(f.sub("Notes against items"));
      for (const [k, v] of x.itemNotes) add(f.kv(k, v));
    }
  }
  return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

function buildMarkdown(ctx, parts) { return renderInternal(model(ctx, parts), FMT.md); }

function buildText(ctx, parts, mode) {
  if (mode === "brief") return renderInternal(model(ctx, parts), FMT.text);
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
        '<button class="btn ghost" data-action="md">Download Markdown</button>' +
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
      // The complete internal readout — everything on every screen, notes
      // and all. Replaces the CSV, which carried the same facts in a shape
      // nobody could read and nothing downstream was built to parse.
      md: () => buildMarkdown(ctx, parts),
    };
  },
};
