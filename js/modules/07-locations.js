// ============================================================
// 07 — Cities: coverage, priority, exclusions and build order
// ============================================================
//
// One screen, same shape as Services. A radius search off their base city
// pulls in everything within N miles so the list isn't limited to whatever
// their site happened to name, then each city takes a High / Medium / Low
// priority and the build order assembles itself underneath.
//
// "Do not market here" is a first-class state, not an absence. An unticked
// city is one we're not building a page for yet; an excluded city is one
// the ad budget must actively avoid, and that has to reach the readout as
// a list someone can paste into a negative geo-target.

import { sectionHead, skipRow, field, esc, ICON } from "../ui.js";
import {
  isSkipped, locState, locationUniverse, onLocations, excludedLocations,
  locationsByPriority, locationOrder, radiusCandidates, getNote,
} from "../state.js";
import { noteBlock } from "../listgrid.js";

const ID = "locations";

const BUCKETS = [
  { key: "high", label: "High", note: "Page one" },
  { key: "med", label: "Medium", note: "Next wave" },
  { key: "low", label: "Low", note: "Eventually" },
];

const RADII = [15, 25, 40, 60];

/** Radius results live in transient — they're derived, never saved. */
function nearby(ctx) {
  return (ctx.transient[ID] || {}).nearby || [];
}

function baseLabel(ctx) {
  const t = ctx.transient[ID] || {};
  return t.base ? t.base.name + ", " + t.base.state : locState(ctx.state).base;
}

/* ── coverage ─────────────────────────────────────────── */

function coverageCard(ctx) {
  const v = locState(ctx.state);
  const t = ctx.transient[ID] || {};
  const found = nearby(ctx);
  const chosen = new Set(onLocations(ctx.state, ctx.client, found).map((x) => x.id));
  const barred = new Set(excludedLocations(ctx.state, ctx.client, found).map((x) => x.id));
  // Anything already on the list — however it got there — is not a candidate
  const untouched = radiusCandidates(ctx.state, ctx.client, found)
    .filter((p) => !chosen.has(p.id) && !barred.has(p.id));

  const radii = RADII.map((r) =>
    '<button class="chip' + (v.radius === r ? " on" : "") + '" data-radius="' + r + '">' + r + " mi</button>"
  ).join("");

  const results = !t.base
    ? ""
    : '<div class="derived" style="margin-top:20px">' +
        (found.length
          ? "<strong>" + found.length + "</strong> places within " + v.radius + " miles of " +
            esc(baseLabel(ctx)) + ". " + untouched.length + " not yet decided."
          : "Nothing found — check the city name.") +
      "</div>" +
      (untouched.length
        ? '<div class="radiuslist">' +
            untouched.slice(0, 60).map((p) =>
              '<div class="radrow">' +
                '<span class="radname">' + esc(p.name) + '<span class="radst">' + esc(p.state) + "</span></span>" +
                '<span class="radmeta">' + p.miles + " mi" + (p.pop ? " · " + p.pop.toLocaleString() : "") + "</span>" +
                '<button class="btn ghost xs" data-addplace="' + esc(p.id) + '">Add</button>' +
                '<button class="btn ghost xs" data-barplace="' + esc(p.id) + '">Never</button>' +
              "</div>"
            ).join("") +
            (untouched.length > 60 ? '<div class="pickempty">…and ' + (untouched.length - 60) + " more. Narrow the radius or add in bulk.</div>" : "") +
          "</div>" +
          '<div class="newrow" style="margin-top:14px">' +
            '<button class="btn ghost sm" data-addall="all">Add all ' + untouched.length + "</button>" +
            '<button class="btn ghost sm" data-addall="15">Add the 15 biggest</button>' +
            '<button class="btn ghost sm" data-addall="near">Add the 10 closest</button>' +
          "</div>"
        : "");

  return (
    '<div class="card">' +
      '<div class="mlabel">Coverage</div>' +
      '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
        "Start from the shop, then pull in everything they'd actually drive to. Their site's list is usually shorter than the truth." +
      "</div>" +
      '<div class="fields two" style="margin-top:18px">' +
        field(ID, "base", "Base city", v.base, {
          placeholder: "1420 Baltimore Ave, Kansas City, MO 64108",
          help: "Where the trucks leave from. A city or a full address — paste the one off their invoice.",
        }) +
      "</div>" +
      (t.matches && t.matches.length
        ? '<div class="radiuslist" style="margin-top:12px">' +
            t.matches.map((m) =>
              '<button class="radrow radpick" data-pickbase="' + esc(m.id) + '">' +
                '<span class="radname">' + esc(m.name) + '<span class="radst">' + esc(m.state) + "</span></span>" +
                '<span class="radmeta">' + (m.pop ? m.pop.toLocaleString() + " people" : "") + "</span>" +
              "</button>"
            ).join("") +
          "</div>"
        : "") +
      '<div style="margin-top:20px"><div class="mlabel" style="margin-bottom:10px">Radius</div>' +
        '<div class="chips">' + radii + "</div></div>" +
      results +
    "</div>"
  );
}

/* ── city tiles ───────────────────────────────────────── */

function tile(ctx, it) {
  const note = getNote(ctx.state, ID, it.id);
  const openMap = ctx.transient.notes || {};
  const badges =
    (it.hasPage ? '<span class="badge b-page">Has a page</span>' : "") +
    (it.verify ? '<span class="badge b-ver">Verify</span>' : "") +
    (it.miles != null ? '<span class="badge b-st">' + it.miles + " mi</span>" : "") +
    (it.pop ? '<span class="badge b-st">' + it.pop.toLocaleString() + "</span>" : "");

  const detail = it.on
    ? '<div class="tiledetail">' +
        '<div class="seg">' +
          BUCKETS.map((b) =>
            '<button class="segbtn ' + b.key + (it.prio === b.key ? " on" : "") + '" ' +
            'data-locprio="' + esc(it.id) + "|" + b.key + '">' + esc(b.label) + "</button>"
          ).join("") +
        "</div>" +
        noteBlock(ID + ":" + it.id, note, "Drive time, ticket size, techs covering it…", openMap) +
        '<button class="barbtn" data-barplace="' + esc(it.id) + '">&#8856; Never market here</button>' +
      "</div>"
    : "";

  return (
    '<div class="tile' + (it.on ? " on" : "") + '" data-filter-item data-card="' + esc(ID) + "|" + esc(it.id) + '" ' +
      'data-filter-text="' + esc(it.name + " " + it.state) + '">' +
      '<button class="tilebtn" data-loc="' + esc(it.id) + "|" + (it.source === "radius" ? "1" : "0") + '">' +
        '<span class="box">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" ' +
          'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        "</span>" +
        '<span class="nm">' + esc(it.name) +
          (it.state ? '<span class="radst">' + esc(it.state) + "</span>" : "") +
          (badges ? '<span class="tilebadges">' + badges + "</span>" : "") +
        "</span>" +
      "</button>" + detail +
    "</div>"
  );
}

function citiesCard(ctx) {
  const all = locationUniverse(ctx.state, ctx.client, nearby(ctx)).filter((x) => !x.excluded);
  const on = all.filter((x) => x.on).length;
  const query = (ctx.transient[ID] || {}).filter || "";

  if (!all.length) {
    return (
      '<div class="card" style="text-align:center;color:var(--muted)">' +
      "No cities yet. Run a radius search above, or add them by hand." +
      "</div>"
    );
  }

  const groups = new Map();
  for (const it of all) {
    const g = it.state || "Other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  const body = [...groups.entries()].map(([g, items]) => {
    const n = items.filter((x) => x.on).length;
    return '<div class="pickcat" data-filter-cat>' + esc(g) +
      '<span style="color:var(--faint);margin-left:8px">' + n + " / " + items.length + "</span></div>" +
      '<div class="pickgrid">' + items.map((it) => tile(ctx, it)).join("") + "</div>";
  }).join("");

  return (
    '<div class="card">' +
      '<div class="pickhead">' +
        "<div><h3>Cities</h3><p>Untick anywhere they won't drive. Everything ticked needs a priority.</p></div>" +
        '<div class="pickcount"><span class="v' + (on ? "" : " zero") + '">' + on + "</span>" +
          '<span class="l">of ' + all.length + "</span></div>" +
      "</div>" +
      '<div class="pickfilter">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input data-filter="' + ID + '|city" autocomplete="off" value="' + esc(query) + '" ' +
          'placeholder="Filter ' + all.length + ' cities&hellip;">' +
      "</div>" + body +
      '<div class="pickother">' +
        '<div class="mlabel">Somewhere we missed</div>' +
        '<div class="newrow">' +
          '<input class="tin" data-newitem="' + ID + '" placeholder="Add a city and hit Enter…">' +
          '<button class="btn" data-additem="' + ID + '">Add city</button>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

/* ── exclusions ───────────────────────────────────────── */

function excludedCard(ctx) {
  const barred = excludedLocations(ctx.state, ctx.client, nearby(ctx));
  return (
    '<div class="card excluded">' +
      '<div class="pickhead">' +
        "<div><h3>&#8856; Do not market here</h3>" +
          "<p>Excluded from ad targeting and never built as a page. Not the same as unticked &mdash; " +
          "these are the ones that quietly burn budget.</p></div>" +
        '<div class="pickcount"><span class="v' + (barred.length ? "" : " zero") + '">' + barred.length + "</span>" +
          '<span class="l">barred</span></div>' +
      "</div>" +
      (barred.length
        ? '<div class="excl" style="margin-top:16px">' + barred.map((b) =>
            '<button class="chip sm strike" data-barplace="' + esc(b.id) + '" title="Put it back">' +
            esc(b.name) + (b.state ? " " + esc(b.state) : "") + " &times;</button>"
          ).join("") + "</div>"
        : '<div class="pickempty">Nothing barred yet. Use &ldquo;Never market here&rdquo; on a city, ' +
          "or the Never button in the radius list.</div>") +
    "</div>"
  );
}

/* ── build order ──────────────────────────────────────── */

function orderCard(ctx) {
  const b = locationsByPriority(ctx.state, ctx.client, nearby(ctx));
  const total = b.high.length + b.med.length + b.low.length + b[""].length;
  if (!total) return "";

  let n = 0;
  const row = (it) =>
    '<div class="row" data-row-id="locprio-' + esc(it.prio || "none") + "|" + esc(it.id) + '">' +
      '<button class="grip" data-grip="locprio-' + esc(it.prio || "none") + "|" + esc(it.id) +
        '" tabindex="0" aria-label="Reorder ' + esc(it.name) + '">' + ICON.grip + "</button>" +
      '<div class="pos">' + (++n) + "</div>" +
      '<div class="rname"><div class="n">' + esc(it.name) + "</div>" +
        '<div class="s">' + esc([it.state, it.miles != null ? it.miles + " mi" : "",
          it.hasPage ? "has a page" : "needs a page"].filter(Boolean).join(" · ")) + "</div></div>" +
    "</div>";

  const band = (cfg, items) => items.length
    ? '<div class="tier"><span class="lab t-' + cfg.key + '">' + esc(cfg.label) + "</span>" +
      '<span class="r"></span><span class="c">' + esc(cfg.note) + " · " + items.length + "</span></div>" +
      items.map(row).join("")
    : "";

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
        "Which city gets a real page first. Drag within a band to settle the order." +
      "</div>" +
      '<div style="margin-top:22px">' + BUCKETS.map((c) => band(c, b[c.key])).join("") + unset + "</div>" +
    "</div>"
  );
}

/* ── module ───────────────────────────────────────────── */

export default {
  id: ID,
  nav: "Cities",
  title: "Where do they actually go?",
  lede: "Start from the shop and pull in everywhere they'd drive. Rank what matters, and bar the places that would only ever waste budget.",
  skippable: true,
  notePrompt:
    "What they said about specific areas — drive times, neighbourhoods, where the good work is.",

  render(ctx) {
    return (
      sectionHead(ctx.num, this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +
      coverageCard(ctx) +
      citiesCard(ctx) +
      excludedCard(ctx) +
      orderCard(ctx)
    );
  },

  bucketIds(ctx, bucketKey) {
    const b = locationsByPriority(ctx.state, ctx.client, nearby(ctx));
    return (b[bucketKey === "none" ? "" : bucketKey] || []).map((x) => x.id);
  },

  status(ctx) {
    const on = onLocations(ctx.state, ctx.client, nearby(ctx));
    if (!on.length) return "empty";
    return on.every((x) => x.prio) ? "done" : "partial";
  },

  summary(ctx) {
    const found = nearby(ctx);
    const all = locationUniverse(ctx.state, ctx.client, found);
    if (!all.length) return null;

    const ordered = locationOrder(ctx.state, ctx.client, found);
    const b = locationsByPriority(ctx.state, ctx.client, found);
    const barred = all.filter((x) => x.excluded);
    const selected = all.filter((x) => x.on);
    const dropped = all.filter((x) => !x.on && !x.excluded);
    const v = locState(ctx.state);

    const rows = [];
    if (v.base) rows.push(["Base city", v.base + " · " + v.radius + " mile radius"]);
    rows.push(["Cities selected", selected.length + " of " + all.length]);
    if (b.high.length) rows.push(["High priority", b.high.map((x) => x.name).join(", ")]);
    if (b.med.length) rows.push(["Medium priority", b.med.map((x) => x.name).join(", ")]);
    if (b.low.length) rows.push(["Low priority", b.low.map((x) => x.name).join(", ")]);
    if (dropped.length) rows.push(["Not now", dropped.map((x) => x.name).join(", ")]);
    if (barred.length) rows.push(["DO NOT MARKET", barred.map((x) => x.name + (x.state ? ", " + x.state : "")).join(", ")]);

    const open = [];
    const unresolved = selected.filter((x) => x.verify);
    for (const x of unresolved) {
      open.push({ what: x.name, detail: x.verify, ask: "Confirm whether you actually cover " + x.name + "." });
    }
    if (b[""].length) {
      open.push({
        what: "Cities with no priority",
        detail: b[""].length + " selected but unranked: " + b[""].slice(0, 6).map((x) => x.name).join(", ") +
          (b[""].length > 6 ? "…" : ""),
      });
    }
    if (!b.high.length && ordered.length) {
      open.push({ what: "No city marked High", detail: "Nobody said which page goes up first" });
    }
    if (barred.length) {
      open.push({
        what: "Negative geo-targets",
        detail: barred.length + " excluded city" + (barred.length > 1 ? "ies" : "") +
          " — add these as negatives before any campaign goes live",
      });
    }

    return {
      rows,
      open,
      list: {
        title: "Cities in build order",
        items: ordered.map((it, i) => ({
          n: i + 1,
          name: it.name + (it.state ? ", " + it.state : ""),
          meta: (it.prio ? it.prio.toUpperCase() : "unranked") +
            (it.hasPage ? " · has a page" : " · needs a page"),
        })),
      },
      table: {
        head: ["type", "rank", "name", "state", "priority", "miles", "population", "status"],
        body: ordered.map((it, i) => [
          "city", String(i + 1), it.name, it.state, it.prio || "unranked",
          it.miles == null ? "" : String(it.miles), it.pop ? String(it.pop) : "",
          it.hasPage ? "has page" : "needs page",
        ]).concat(barred.map((it) => [
          "city", "", it.name, it.state, "EXCLUDED",
          it.miles == null ? "" : String(it.miles), it.pop ? String(it.pop) : "", "do not market",
        ])),
      },
    };
  },
};
