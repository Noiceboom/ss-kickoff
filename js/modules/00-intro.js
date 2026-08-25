// ============================================================
// 00 — Intro & agenda
// ============================================================

import { esc } from "../ui.js";

const ID = "intro";

export default {
  id: ID,
  nav: "Intro",
  title: "Before we build anything, we agree on the order.",
  lede: "",
  skippable: false,

  render(ctx) {
    const { client, modules } = ctx;
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
          '<div class="mlabel">What we pulled off their site</div>' +
          '<div class="kpis" style="margin-top:14px">' +
            kpi(svc, "Services in the menu", "var(--orange)") +
            kpi(svc + subs, "Incl. sub-services", "var(--orange)") +
            kpi(loc, "Cities listed", "var(--orange)") +
            kpi(pages, "Cities with a real page", pages ? "var(--ok)" : "var(--faint)") +
          "</div>" +
          (loc
            ? '<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line);font-size:15px;color:var(--green-text)">' +
              (loc - pages) + " of their " + loc + " cities are listed with no page behind them. " +
              "That's the gap we're ordering today &mdash; <strong style=\"color:var(--char)\">which city gets a real page first, " +
              "and which service it leads with.</strong></div>"
            : "") +
        "</div>"
      : '<div class="card"><div class="mlabel">No site data loaded</div>' +
        '<p class="lede" style="margin-top:10px">Open this with <code>?c=client-slug</code> once the client file exists, ' +
        "or add services and cities by hand on screens 05 and 07. Everything else works either way.</p></div>";

    return (
      '<div class="hero"><div>' +
        '<div class="eyebrow">Kickoff call &middot; working session</div>' +
        "<h1>Before we build anything,<br><span class=\"volt\">we agree on the order.</span></h1>" +
        '<p class="lede">We\'re running ' + who + " through the whole kickoff: who they are, where they want to get to, " +
        "who they're up against, then the services and cities in the order we build them. " +
        "Nothing here is required &mdash; skip anything that doesn't come up and it lands in the readout as an open item.</p>" +
      '</div><img class="sam" src="assets/mini-sam.svg" alt=""></div>' +
      scraped +
      '<div class="card"><div class="mlabel">What we\'ll cover</div>' +
        '<ol class="olist" style="margin-top:14px">' + agenda + "</ol></div>" +
      '<div class="warn">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        "<div><strong>Never type a password or API key into this doc.</strong><br>" +
        "The access screen tracks who owns an account and whether access has been granted &mdash; " +
        "nothing else. Everything typed here stays in this browser and in the share link.</div>" +
      "</div>"
    );
  },

  status() { return "done"; },
  summary() { return null; },
};

function kpi(v, label, color) {
  return '<div class="kpi"><div class="v" style="color:' + color + '">' + v + "</div>" +
    '<div class="l">' + esc(label) + "</div></div>";
}
