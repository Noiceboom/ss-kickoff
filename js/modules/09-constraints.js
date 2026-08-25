// ============================================================
// 09 — Constraints & non-negotiables
// ============================================================
//
// The one screen that reads other modules. It recaps what was switched
// off in 05 and 07 — strictly read-only, no writes, no calls into those
// modules — so "we don't sell that" and "we won't drive there" get said
// out loud in the same breath as the rules we can't break. Both of
// those screens are skippable, so every branch below has to survive
// them being untouched or skipped outright.

import { esc, sectionHead, skipRow, field, chipGroup, statusFor, filled } from "../ui.js";
import { isSkipped, slot } from "../state.js";

const ID = "constraints";

// Keys that count toward "done". The recap above them isn't ours to fill in.
const CORE = ["seasonal", "capacity", "compliance", "refuse", "neverSay"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const NOTE = 'style="font-size:14px;color:var(--muted);margin-top:8px;line-height:1.45"';

/**
 * Read-only lookup of the names behind a list module's `off` ids.
 * Falls back to the raw id, so an id that no longer resolves against a
 * re-scraped client JSON still shows up instead of quietly vanishing.
 */
function droppedNames(ctx, modId, clientItems) {
  const s = ctx.state.m[modId] || {};
  const off = Array.isArray(s.off) ? s.off : [];
  if (!off.length) return [];
  const byId = new Map();
  for (const it of clientItems || []) byId.set(it.id, it.name);
  for (const it of Array.isArray(s.added) ? s.added : []) byId.set(it.id, it.name);
  return off.map((id) => byId.get(id) || id);
}

/** One recap strip. Never renders an empty box — it says why it's empty. */
function recap(label, names, skipped, skipLine, emptyLine) {
  const body = skipped
    ? "<div " + NOTE + ">" + esc(skipLine) + "</div>"
    : names.length
      ? '<div class="chips" style="margin-top:11px">' +
          names.map((n) => '<span class="chip strike">' + esc(n) + "</span>").join("") +
        "</div>"
      : "<div " + NOTE + ">" + esc(emptyLine) + "</div>";
  return '<div style="margin-top:22px"><div class="mlabel">' + esc(label) + "</div>" + body + "</div>";
}

export default {
  id: ID,
  nav: "Constraints",
  title: "What sinks this if we get it wrong?",
  lede: "The things nobody mentions until they're already a problem. When more leads is the last thing they want, what they physically can't absorb, and the words that get a claim thrown out.",
  skippable: true,
  notePrompt:
    "Anything they'd be genuinely upset about if we got it wrong.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    const svcOff = droppedNames(ctx, "services", ctx.client.services);
    const locOff = droppedNames(ctx, "locations", ctx.client.locations);

    return (
      sectionHead("09", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Already off the table</div>' +
        "<div " + NOTE + ">" +
          "Straight back from screens 05 and 07. Read it out now &mdash; this is the cheapest moment " +
          "anyone will ever have to say &ldquo;wait, no, we do that.&rdquo;" +
        "</div>" +
        recap(
          "Services you told us you don't sell",
          svcOff,
          isSkipped(ctx.state, "services"),
          "Screen 05 was skipped, so nothing is ruled out. We'll build against the full scraped service list until someone says otherwise.",
          "Nothing turned off — every service on their list is in play."
        ) +
        recap(
          "Areas you won't drive",
          locOff,
          isSkipped(ctx.state, "locations"),
          "Screen 07 was skipped, so every city on their site is being treated as live. Worth a second pass before we write a single city page.",
          "Nothing turned off — every city on their site is fair game."
        ) +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Seasonality</div>' +
        chipGroup(ID, "blackout", "Months they're already swamped", s.blackout, MONTHS, {
          multi: true,
          help: "Months where more leads is a problem, not a win. We throttle spend into these instead of burning it.",
        }) +
        '<div class="fields one" style="margin-top:18px">' +
          field(ID, "seasonal", "What actually happens in those months?", v("seasonal"), {
            type: "longtext", rows: 3,
            placeholder: "First hard freeze through February we're booked three days out. Techs are on 12s and we're turning work away.",
            help: "Tells us whether to pull budget or just switch which service we're pushing.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Capacity</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "capacity", "How many jobs a day can they absorb?", v("capacity"), {
            placeholder: "About 14 calls across 6 trucks",
            help: "The real ceiling, not the good-day number.",
          }) +
          field(ID, "capacityNote", "What breaks first when it spikes?", v("capacityNote"), {
            placeholder: "The phone. One CSR and she's booked solid by 9am.",
            help: "Usually intake, not trucks. If it's the phone, spend won't fix it.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Rules they&rsquo;re bound by</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "compliance", "Compliance, franchise or brand rules", v("compliance"), {
            type: "longtext", rows: 3,
            placeholder: "Franchise ad fund owns the brand terms. All creative goes through corporate. State board requires the license number on every ad.",
            help: "Franchise ad-fund territory rules, approved copy decks, trademark terms they can't bid on, licensing language a state board demands. Retrofitting this after launch is expensive.",
          }) +
          field(ID, "refuse", "Jobs they flat out won't take", v("refuse"), {
            type: "longtext", rows: 3,
            placeholder: "Mobile homes, anything routed through a home warranty company, and second opinions on someone else's install.",
            help: "These become negative keywords and disqualifying language on the form.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Language</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "neverSay", "Phrases we must never use", v("neverSay"), {
            type: "longtext", rows: 3,
            placeholder: "Never “cheap.” Never “free estimate” — diagnostic is $89. Never name a competitor.",
            help: "Exact strings, not themes. Anything that gets a call misqualified, a claim challenged, or a lawyer involved.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    const svcOff = droppedNames(ctx, "services", ctx.client.services);
    const locOff = droppedNames(ctx, "locations", ctx.client.locations);

    // The drops belong in this readout even when nothing was typed here,
    // so the constraints block reads on its own without flipping back to 05/07.
    const typed = CORE.concat(["blackout", "capacityNote"]).some((k) => filled(s[k]));
    if (!typed && !svcOff.length && !locOff.length) return null;

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    put("Won't sell", svcOff.join(", "));
    put("Won't drive to", locOff.join(", "));
    put("Swamped months", Array.isArray(s.blackout) ? s.blackout.join(", ") : s.blackout);
    put("Seasonality", s.seasonal);
    put("Capacity ceiling", s.capacity);
    put("Breaks first", s.capacityNote);
    put("Compliance / franchise rules", s.compliance);
    put("Jobs they refuse", s.refuse);
    put("Never say", s.neverSay);

    const open = [];
    if (!filled(s.compliance)) {
      open.push({
        what: "Compliance / franchise rules",
        detail: "Blank. Confirm whether they're a franchise, part of a buying group, or tied to a brand's advertising rules before any copy or bidding goes live.",
      });
    }

    return { rows, open };
  },
};
