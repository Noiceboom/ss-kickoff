// ============================================================
// 00 — Intro & agenda
// ============================================================

import { esc, ICON } from "../ui.js";
import { sayer, DISCOVERY } from "../modes.js";

const ID = "intro";

/* ── copy ─────────────────────────────────────────────── */
//
// The kickoff opens by telling a signed client what the session is for.
// The sales call opens in front of someone who has not decided anything
// yet, so it says what THIS call is and what they get out of it — and
// nothing at all about "the order we build them in", which presumes a
// build nobody has agreed to.

export const COPY = {
  eyebrow: {
    kickoff: "Kickoff call &middot; working session",
    discovery: "Discovery call &middot; working session",
  },
  headline: {
    kickoff: "Before we build anything,<br><span class=\"volt\">we agree on the order.</span>",
    discovery: "Before we pitch anything,<br><span class=\"volt\">we understand the business.</span>",
  },
  lede: {
    kickoff: "through the whole kickoff: who they are, where they want to get to, who they're up against, then the services and cities in the order we build them. Nothing here is required — skip anything that doesn't come up and it lands in the readout as an open item.",
    discovery: "through the whole picture: where the business is now, where you want it to get to, who you're up against, and which services and areas actually matter. Nothing here is required — anything we don't get to, we just don't get to.",
  },
  agendaLabel: { kickoff: "What we'll cover", discovery: "What we'll cover" , same: true },
  scrapedLabel: {
    kickoff: "What we pulled off their site",
    discovery: "What we pulled off your site",
  },
  // The kickoff's version names the gap as work already agreed — "the gap
  // we're ordering today". Nobody has agreed to anything on a sales call,
  // and saying so out loud in front of a prospect assumes the sale.
  gapLine: {
    kickoff: "of their %TOTAL% cities are listed with no page behind them. That's the gap we're ordering today &mdash; <strong style=\"color:var(--char)\">which city gets a real page first, and which service it leads with.</strong>",
    discovery: "of your %TOTAL% cities are listed with no page behind them &mdash; named on the site, with nothing for someone searching in that city to actually land on. <strong style=\"color:var(--char)\">That gap is most of what we&rsquo;d be talking about.</strong>",
  },
  closer: {
    kickoff: "Never type a password or API key into this doc.",
    discovery: "Never type a password or API key into this doc.",
    same: true,
  },
  closerBody: {
    kickoff: "The access screen tracks who owns an account and whether access has been granted &mdash; nothing else. Everything typed here stays in this browser and in the share link.",
    discovery: "There is nothing on this call that needs one, and no screen here asks for one. Everything typed stays in this browser.",
  },
};

export default {
  id: ID,
  nav: "Intro",
  title: "Before we build anything, we agree on the order.",
  lede: "",
  skippable: false,
  notePrompt:
    "How they found us, what they're worried about, anything they led with before we started.",

  discovery: {
    title: "Before we pitch anything, we understand the business.",
    notePrompt: "Anything from the first few minutes worth keeping.",
  },

  render(ctx) {
    const { client, modules } = ctx;
    const t = sayer(COPY, ctx.mode);
    const c = client.client;
    const svc = client.services.length;
    const subs = client.services.reduce((n, s) => n + (s.subs || []).length, 0);
    const loc = client.locations.length;
    const pages = client.locations.filter((l) => l.hasPage).length;

    const who = c.name
      ? esc(c.name) + (c.market ? " &mdash; " + esc(c.market) : "")
      : "this client";

    const agenda = modules.slice(1, -1).map((m, i) =>
      '<li><span class="k">' + (i + 1) + '</span><span class="v">' + esc(m.nav) + "</span></li>"
    ).join("");

    const scraped = svc || loc
      ? '<div class="card">' +
          '<div class="mlabel">' + t("scrapedLabel") + "</div>" +
          '<div class="kpis" style="margin-top:14px">' +
            kpi(svc, "Services in the menu", "var(--orange)") +
            kpi(svc + subs, "Incl. sub-services", "var(--orange)") +
            kpi(loc, "Cities listed", "var(--orange)") +
            kpi(pages, "Cities with a real page", pages ? "var(--ok)" : "var(--faint)") +
          "</div>" +
          (loc
            ? '<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line);font-size:15px;color:var(--green-text)">' +
              (loc - pages) + " " + t("gapLine").replace("%TOTAL%", String(loc)) + "</div>"
            : "") +
        "</div>"
      : '<div class="card"><div class="mlabel">No site data loaded</div>' +
        '<p class="lede" style="margin-top:10px">Open this with <code>?c=client-slug</code> once the client file exists, ' +
        "or add services and cities by hand on screens 05 and 07. Everything else works either way.</p></div>";

    return (
      '<div class="hero"><div>' +
        '<div class="eyebrow">' + t("eyebrow") + "</div>" +
        "<h1>" + t("headline") + "</h1>" +
        '<p class="lede">We\'re running ' + who + " " + t("lede") + "</p>" +
      '</div><img class="sam" src="assets/mini-sam.svg" alt=""></div>' +
      handoffCard(ctx) +
      scraped +
      '<div class="card"><div class="mlabel">' + t("agendaLabel") + "</div>" +
        '<ol class="olist" style="margin-top:14px">' + agenda + "</ol></div>" +
      importCard(ctx) +
      '<div class="warn">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        "<div><strong>" + t("closer") + "</strong><br>" + t("closerBody") + "</div>" +
      "</div>"
    );
  },

  status() { return "done"; },
  summary() { return null; },
};

/**
 * The way a sales call becomes a kickoff.
 *
 * Kickoff-only, and hidden once a handoff has landed — re-importing over
 * a kickoff already in progress would replace it wholesale, and the
 * button that does that should not be sitting there afterwards.
 */
function importCard(ctx) {
  if (ctx.mode === DISCOVERY || ctx.state.handoff) return "";
  return (
    '<div class="card">' +
      '<div class="mlabel">Came from a sales call?</div>' +
      '<p class="lede" style="margin-top:8px;font-size:15px">' +
        "Load the JSON from the discovery call and everything they already told us arrives " +
        "answered &mdash; goals, services, cities, what they&rsquo;re running now. You confirm and " +
        "fill the gaps instead of asking it all twice." +
      "</p>" +
      '<label class="updrop" style="margin-top:16px">' +
        '<input type="file" accept="application/json,.json" data-loadjson="1">' +
        '<span class="upcta">Choose the discovery JSON</span>' +
        '<span class="uphint">Replaces anything already captured in this kickoff.</span>' +
      "</label>" +
    "</div>"
  );
}

/** What the sales call captured that this document has no screen for. */
function handoffCard(ctx) {
  const h = ctx.state.handoff;
  if (!h) return "";
  const why = (h.fields && h.fields.whynow) || {};
  const rows = [
    ["What made them take the call", why.whyNow],
    ["What's not working", why.broken],
    ["Cost of standing still", why.costOfNothing],
    ["Who else decides", why.whoDecides],
    ["Process from here", why.process],
  ].filter((r) => String(r[1] || "").trim());
  const note = h.notes && h.notes.whynow;

  return (
    '<div class="card">' +
      '<div class="mlabel">' + ICON.doc + " From the sales call</div>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
        "Captured on " + esc(String(h.capturedAt || "").slice(0, 10) || "the discovery call") +
        ". Read it before you start &mdash; they have already said all of this once." +
      "</div>" +
      (rows.length
        ? '<dl class="dl" style="margin-top:16px">' + rows.map((r) =>
            "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") + "</dl>"
        : '<div style="margin-top:14px;font-size:15px;color:var(--muted)">Nothing was captured on the why-now screen.</div>') +
      (note
        ? '<div style="margin-top:20px;padding-left:14px;border-left:3px solid var(--gold)">' +
            '<div class="mlabel" style="color:var(--muted)">Notes from that call</div>' +
            '<div style="margin-top:6px;font-size:15px;line-height:1.6;white-space:pre-wrap">' +
              esc(note) + "</div></div>"
        : "") +
    "</div>"
  );
}

function kpi(v, label, color) {
  return '<div class="kpi"><div class="v" style="color:' + color + '">' + v + "</div>" +
    '<div class="l">' + esc(label) + "</div></div>";
}
