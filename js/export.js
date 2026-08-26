// ============================================================
// export.js — the machine-readable payload
// ============================================================
//
// This is a CONTRACT, not a dump. Something on the OS side parses it and
// files the answers away, so two rules hold:
//
//   1. Keys are STATE keys, never on-screen labels. A field called
//      "Phrases we must never use" this morning is called "Never says"
//      this afternoon; `neverSay` has never changed and never will.
//
//   2. Every service, city, channel and account carries its stable id.
//      The scraper generates those ids; matching on display name instead
//      would break the moment a taxonomy label is reworded.
//
// `display` at the bottom carries the human-readable summary the readout
// already builds, so nothing that was on screen is lost. Read `fields`
// and the entity arrays for anything you intend to act on; read
// `display` only to show a person what was said.

import * as S from "./state.js";
import { ALL as CHANNELS } from "./channels.js";
import { getTrade } from "./trades/index.js";
import { activeTrades } from "./modules/05-services.js";
import { CORE_ACCOUNTS, EXTRA_ACCOUNTS, LEADSIE_URL } from "./modules/11-access.js";

// Bump this whenever the SHAPE changes — a renamed field, a changed type,
// an entity that gains or loses a key. Adding a value to an existing enum
// is not a shape change; turning `subs` from a list of names into a list
// of {name, selected} is, and shipping that under an unchanged version
// left a b32 file and a b33 file both claiming "ss-kickoff/1" while
// parsing differently. docs/check.mjs pins the shape to the version.
//
//   /1  b32  first machine-readable payload
//   /2  b33  subs became [{name, selected}]; channels gained `known`;
//            services/locations bookkeeping left `fields`
export const SCHEMA = "ss-kickoff/2";

/**
 * Bookkeeping keys that are represented properly elsewhere in the payload.
 * Leaving them in `fields` would hand the OS two copies of the same answer
 * — one structured, one a raw selection array — and no way to know which
 * of the two is authoritative.
 */
const STRUCTURAL = {
  services: { exact: ["trades", "on", "off", "prio", "meta", "snap", "subsOff", "added"], prefix: [] },
  locations: { exact: ["on", "off", "excluded", "prio", "added", "base", "radius"], prefix: [] },
  marketing: { exact: ["chan"], prefix: ["rate_", "vol_", "note_"] },
  access: { exact: ["extra", "custom"], prefix: ["status_"] },
};

function plainFields(moduleId, slot) {
  const rules = STRUCTURAL[moduleId];
  const out = {};
  for (const key of Object.keys(slot || {})) {
    if (rules) {
      if (rules.exact.indexOf(key) > -1) continue;
      if (rules.prefix.some((p) => key.indexOf(p) === 0)) continue;
    }
    const v = slot[key];
    if (v === "" || v === null || v === undefined) continue;
    out[key] = v;
  }
  return out;
}

/** Position in the agreed build order, or null when nobody ranked it. */
function ranker(ordered) {
  const at = new Map(ordered.map((x, i) => [x.id, i + 1]));
  return (id) => (at.has(id) ? at.get(id) : null);
}

function servicesBlock(ctx) {
  const trades = activeTrades(ctx);
  const objs = trades.map(getTrade).filter(Boolean);
  const universe = S.serviceUniverse(ctx.state, ctx.client, objs);
  const rank = ranker(S.serviceOrder(ctx.state, ctx.client, objs));

  return {
    trades: trades,
    items: universe.map((it) => ({
      id: it.id,
      name: it.name,
      trade: it.tradeId || "",
      // "both"  — on their site AND in the trade taxonomy
      // "scrape" — on their site, nothing in the taxonomy matched it
      // "trade"  — taxonomy only, we offered it and someone ticked it
      // "added"  — typed on the call
      source: it.source,
      foundOnSite: it.source === "both" || it.source === "scrape",
      selected: !!it.on,
      priority: it.prio || null,     // "high" | "med" | "low" | null
      rank: rank(it.id),
      hasPage: !!it.hasPage,
      // Subs carry their own on/off — the grid lets you strike one out.
      // Flattening to names told the OS to build pages for sub-services
      // the client had explicitly said they don't do.
      subs: (it.subs || []).map((sub) =>
        typeof sub === "string" ? { name: sub, selected: true } : { name: sub.name, selected: sub.on !== false }
      ),
      aliases: it.aliases || [],
    })),
  };
}

function locationsBlock(ctx) {
  const near = (ctx.transient.locations || {}).nearby || [];
  const universe = S.locationUniverse(ctx.state, ctx.client, near);
  const rank = ranker(S.locationOrder(ctx.state, ctx.client, near));
  const v = S.locState(ctx.state);

  return {
    baseAddress: v.base || "",
    radiusMiles: v.radius,
    items: universe.map((it) => ({
      id: it.id,
      name: it.name,
      state: it.state || "",
      source: it.source,             // "scrape" | "added" | "radius"
      foundOnSite: it.source === "scrape",
      selected: !!it.on,
      excluded: !!it.excluded,       // "do not market here"
      priority: it.prio || null,
      rank: rank(it.id),
      hasPage: !!it.hasPage,
    })),
  };
}

function channelsBlock(ctx) {
  const s = ctx.state.m.marketing || {};
  const used = Array.isArray(s.chan) ? s.chan : [];
  // Driven by what is SELECTED, not by what the built-in list happens to
  // contain. Filtering the catalogue instead would silently drop any id
  // the catalogue no longer knows about. (Channels typed in free text
  // live in fields.marketing.otherChan — they have no id to carry.)
  const known = new Map(CHANNELS.map((c) => [c.id, c]));
  return used.map((id) => {
    const c = known.get(id) || { id: id, label: id, cat: "" };
    return {
      id: c.id,
      label: c.label,
      category: c.cat,
      known: known.has(id),
      rating: s["rate_" + c.id] || null,
      monthlyLeads: s["vol_" + c.id] || null,
      note: s["note_" + c.id] || "",
    };
  });
}

function accessBlock(ctx) {
  const s = ctx.state.m.access || {};
  const inPlay = Array.isArray(s.extra) ? s.extra : [];
  const row = (a, core) => ({
    key: a.key,
    label: a.label,
    core: core,
    inPlay: core || inPlay.indexOf(a.key) > -1,
    status: s["status_" + a.key] || null,
  });

  return {
    leadsie: {
      url: LEADSIE_URL,
      status: s.leadsie || null,
      who: s.leadsieWho || "",
    },
    accounts: CORE_ACCOUNTS.map((a) => row(a, true))
      .concat(EXTRA_ACCOUNTS.map((a) => row(a, false)).filter((r) => r.inPlay)),
    other: (Array.isArray(s.custom) ? s.custom : [])
      .filter((r) => r && (r.account || r.status))
      .map((r) => ({ label: r.account || "", status: r.status || null })),
  };
}

/**
 * @param parts the readout's collected per-module summaries
 * @param build the app build stamp, so a payload can be traced to the
 *   version of the document that produced it
 */
export function buildPayload(ctx, parts, build) {
  const c = ctx.client.client || {};

  const fields = {};
  const notes = {};
  const progress = {};
  const skipped = [];

  for (const p of parts) {
    const id = p.mod.id;
    if (id === "readout") continue;
    progress[id] = p.skipped ? "skipped" : p.status;
    if (p.skipped) skipped.push(id);
    if (p.note) notes[id] = p.note;
    const f = plainFields(id, ctx.state.m[id]);
    if (Object.keys(f).length) fields[id] = f;
  }

  const display = {};
  for (const p of parts) {
    if (!p.sum) continue;
    const d = {};
    if (p.sum.rows && p.sum.rows.length) d.fields = Object.fromEntries(p.sum.rows);
    if (p.sum.table) d.table = { columns: p.sum.table.head, rows: p.sum.table.body };
    if (Object.keys(d).length) display[p.mod.id] = d;
  }

  return {
    schema: SCHEMA,
    build: build || "",
    capturedAt: new Date().toISOString(),
    client: {
      slug: ctx.client.slug || "",
      name: c.name || "",
      market: c.market || "",
      website: c.website || "",
      trade: c.trade || "",
    },
    progress: progress,
    skipped: skipped,
    fields: fields,
    services: servicesBlock(ctx),
    locations: locationsBlock(ctx),
    channels: channelsBlock(ctx),
    access: accessBlock(ctx),
    notes: notes,
    openItems: (ctx.openItems || []).map((o) => ({
      section: o.from || "",
      what: o.what,
      detail: o.detail,
      kind: o.kind,
    })),
    display: display,
  };
}

/* ── CSV ──────────────────────────────────────────────── */

function cell(v) {
  return '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
}

/**
 * Flatten one field into rows.
 *
 * Some screens store rows, not strings — the competitors list is an array
 * of {name, why} objects. String()ing that gives "[object Object]", which
 * silently destroys everything the client said on the call. Each record
 * gets its own addressable rows instead.
 */
function putValue(put, mod, key, v) {
  if (v === null || v === undefined || v === "") return;

  if (Array.isArray(v)) {
    const structured = v.some((x) => x && typeof x === "object");
    if (!structured) { put("field", mod, "", key, v.join("; ")); return; }
    v.forEach((row, i) => {
      if (!row || typeof row !== "object") { put("row", mod, key + "[" + i + "]", key, row); return; }
      for (const [col, val] of Object.entries(row)) {
        if (val === null || val === undefined || val === "") continue;
        put("row", mod, key + "[" + i + "]", col, Array.isArray(val) ? val.join("; ") : val);
      }
    });
    return;
  }

  if (typeof v === "object") {
    for (const [col, val] of Object.entries(v)) {
      if (val === null || val === undefined || val === "") continue;
      put("field", mod, key, col, Array.isArray(val) ? val.join("; ") : val);
    }
    return;
  }

  put("field", mod, "", key, v);
}

/**
 * Long format — one fact per row — because a single CSV has to carry
 * services, cities, channels, accounts and loose fields at once, and
 * those have nothing like the same columns. `entity` and `id` make every
 * row addressable without the importer having to guess from position.
 */
export function buildCsv(payload) {
  const lines = [["entity", "section", "id", "field", "value"].map(cell).join(",")];
  const put = (e, sec, id, field, value) => {
    if (value === "" || value === null || value === undefined) return;
    lines.push([e, sec, id, field, value].map(cell).join(","));
  };

  put("meta", "", "", "schema", payload.schema);
  put("meta", "", "", "build", payload.build);
  put("meta", "", "", "capturedAt", payload.capturedAt);
  for (const [k, v] of Object.entries(payload.client)) put("client", "", payload.client.slug, k, v);

  for (const [mod, f] of Object.entries(payload.fields)) {
    for (const [k, v] of Object.entries(f)) putValue(put, mod, k, v);
  }

  for (const t of payload.services.trades) put("trade", "services", t, "active", "true");
  for (const it of payload.services.items) {
    if (!it.selected && !it.priority) continue;
    put("service", "services", it.id, "name", it.name);
    put("service", "services", it.id, "trade", it.trade);
    put("service", "services", it.id, "selected", String(it.selected));
    put("service", "services", it.id, "priority", it.priority);
    put("service", "services", it.id, "rank", it.rank);
    put("service", "services", it.id, "source", it.source);
    put("service", "services", it.id, "foundOnSite", String(it.foundOnSite));
    put("service", "services", it.id, "subs", it.subs.filter((x) => x.selected).map((x) => x.name).join("; "));
    put("service", "services", it.id, "subsDropped",
      it.subs.filter((x) => !x.selected).map((x) => x.name).join("; "));
  }

  put("field", "locations", "", "baseAddress", payload.locations.baseAddress);
  put("field", "locations", "", "radiusMiles", payload.locations.radiusMiles);
  for (const it of payload.locations.items) {
    if (!it.selected && !it.excluded) continue;
    put("city", "locations", it.id, "name", it.name);
    put("city", "locations", it.id, "state", it.state);
    put("city", "locations", it.id, "selected", String(it.selected));
    put("city", "locations", it.id, "excluded", String(it.excluded));
    put("city", "locations", it.id, "priority", it.priority);
    put("city", "locations", it.id, "rank", it.rank);
    put("city", "locations", it.id, "source", it.source);
    put("city", "locations", it.id, "foundOnSite", String(it.foundOnSite));
  }

  for (const ch of payload.channels) {
    put("channel", "marketing", ch.id, "label", ch.label);
    // a channel the built-in list doesn't know — the JSON says so, and a
    // CSV consumer has no other way to tell
    put("channel", "marketing", ch.id, "known", String(ch.known));
    put("channel", "marketing", ch.id, "rating", ch.rating);
    put("channel", "marketing", ch.id, "monthlyLeads", ch.monthlyLeads);
    put("channel", "marketing", ch.id, "note", ch.note);
  }

  put("field", "access", "", "leadsieStatus", payload.access.leadsie.status);
  put("field", "access", "", "leadsieWho", payload.access.leadsie.who);
  for (const a of payload.access.accounts) {
    put("account", "access", a.key, "label", a.label);
    put("account", "access", a.key, "status", a.status);
    put("account", "access", a.key, "core", String(a.core));
  }
  for (const a of payload.access.other) put("account", "access", "", a.label, a.status);

  for (const [mod, note] of Object.entries(payload.notes)) put("note", mod, "", "note", note);
  for (const [mod, st] of Object.entries(payload.progress)) put("progress", mod, "", "status", st);
  for (const o of payload.openItems) put("openItem", o.section, "", o.what, o.detail);

  return lines.join("\r\n");
}
