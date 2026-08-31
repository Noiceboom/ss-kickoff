// ============================================================
// FROZEN FOR THE SALES CALL — do not evolve this file
// ============================================================
//
// A snapshot of this screen as it stood when the kickoff version began to
// diverge. The two documents deliberately keep the same module `id` and
// the same STATE KEYS, so everything answered here still carries across
// the discovery -> kickoff handoff; only the screen differs.
//
// If a change belongs in both documents, make it in both files. If that
// starts happening often, that is the signal to merge them back.

// ============================================================
// 03 — Current marketing & spend
// ============================================================
//
// The channel list is a pick grid rather than rows you add one at a time:
// a home-services owner recognises what they've run far faster than they
// recall it, and the long tail of pay-per-lead marketplaces is exactly the
// stuff that gets forgotten and then turns up on a bank statement later.
//
// Everything rides the existing field-kit protocol — data-chip for the
// selection and the rating, data-f for volume and notes — so the picker
// needed no new event plumbing beyond the filter box.

import { sectionHeadFor, skipRow, field, statusFor, filled, esc } from "../../ui.js";
import { isSkipped, slot } from "../../state.js";
import { sayer } from "../../modes.js";
import { CATEGORIES, RATINGS, ALL, BY_ID } from "../../channels.js";

const ID = "marketing";

/* ── copy ─────────────────────────────────────────────── */
//
// The incumbent-agency block is the sharpest on this screen. Everything
// in it is a question Sam needs answered — who has it now, who owns the
// accounts, what burned them — and the kickoff help says out loud WHY he
// wants to know. On a shared screen that turns a reasonable question into
// a visibly tactical one, so the discovery column asks the same thing and
// keeps the reasoning to itself.

export const COPY = {
  lede: {
    kickoff: "Everything the phone currently rings from, who runs it, and what it's actually worth. The stuff that burned them matters as much as the stuff that worked.",
    discovery: "Everything the phone rings from today, who runs it, and what it's actually worth. What hasn't worked matters as much as what has.",
  },
  agency: {
    kickoff: "Including the freelancer nobody counts as an agency.",
    discovery: "Anyone doing the work — a full agency, a freelancer, your nephew.",
  },
  ownsAccounts: {
    kickoff: "If the agency owns them, the history doesn't come with us. Worth knowing on day one.",
    discovery: "If they're in someone else's account, the history stays there when you leave. Worth checking.",
  },
  learnedLabel: {
    kickoff: "What they&rsquo;ve learned the hard way",
    discovery: "What you&rsquo;ve learned the hard way",
  },
  workedField: { kickoff: "What has actually worked?", discovery: "What has actually worked?", same: true },
  burnedField: { kickoff: "What burned them?", discovery: "What has burned you?" },
  burned: {
    kickoff: "This is the sentence that tells you how to keep them.",
    discovery: "Be blunt. Knowing what not to repeat is worth more than knowing what to try.",
  },
  wontTouchField: {
    kickoff: "Anything they refuse to touch?",
    discovery: "Anything you won't do again?",
  },
  pickerLabel: {
    kickoff: "Lead channels they&rsquo;ve tried",
    discovery: "Lead channels you&rsquo;ve tried",
  },
  pickerLede: {
    kickoff: "Tap what they&rsquo;ve run.",
    discovery: "Tap what you&rsquo;ve run.",
  },
};

const CORE = ["chanAny", "worked", "burned"];

/** Per-channel keys, kept flat so they ride the field kit unchanged. */
const rateKey = (id) => "rate_" + id;
const volKey = (id) => "vol_" + id;
const noteKey = (id) => "note_" + id;

function selected(s) {
  return Array.isArray(s.chan) ? s.chan : [];
}

/**
 * Channels added on the call that aren't in the built-in list.
 *
 * One per LINE, never comma-separated: plenty of real answers contain a
 * comma ("Radio, mornings only"), and splitting on them turns a single
 * channel into several fictional ones in the readout.
 */
function customChannels(s) {
  return String(s.otherChan || "")
    .split("\n").map((x) => x.trim()).filter(Boolean);
}

/* ── rendering ────────────────────────────────────────── */

function tile(s, ch, on) {
  const detail = on
    ? '<div class="tiledetail">' +
        '<div class="seg">' +
          RATINGS.map((r) =>
            '<button class="segbtn ' + r.value + (s[rateKey(ch.id)] === r.value ? " on" : "") +
            '" data-chip="' + ID + "|" + esc(rateKey(ch.id)) + "|" + r.value +
            '" data-multi="0">' + esc(r.label) + "</button>"
          ).join("") +
        "</div>" +
        '<div class="tilerow"><label>Leads / mo</label>' +
          '<input data-f="' + ID + "|" + esc(volKey(ch.id)) + '" inputmode="numeric" ' +
            'value="' + esc(s[volKey(ch.id)] || "") + '" placeholder="—"></div>' +
        '<textarea class="tilenote" data-f="' + ID + "|" + esc(noteKey(ch.id)) + '" ' +
          'placeholder="What happened with it?">' + esc(s[noteKey(ch.id)] || "") + "</textarea>" +
      "</div>"
    : "";

  return (
    '<div class="tile' + (on ? " on" : "") + '" data-filter-item ' +
      'data-filter-text="' + esc(ch.label + " " + ch.cat) + '">' +
      '<button class="tilebtn" data-chip="' + ID + "|chan|" + esc(ch.id) + '" data-multi="1">' +
        '<span class="box">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" ' +
          'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        "</span>" +
        '<span class="nm">' + esc(ch.label) + "</span>" +
      "</button>" + detail +
    "</div>"
  );
}

function picker(s, query, mode) {
  const on = new Set(selected(s));
  const count = on.size;

  const body = CATEGORIES.map((cat) => {
    const tiles = ALL.filter((c) => c.cat === cat.name).map((c) => tile(s, c, on.has(c.id))).join("");
    return '<div class="pickcat" data-filter-cat>' + esc(cat.name) + "</div>" +
      '<div class="pickgrid">' + tiles + "</div>";
  }).join("");

  return (
    '<div class="pickhead">' +
      "<div><h3>" + sayer(COPY, mode)("pickerLabel") + "</h3>" +
        "<p>" + sayer(COPY, mode)("pickerLede") + " Then rate it &mdash; good, mixed, or a waste &mdash; " +
        "and log what it actually brings in.</p></div>" +
      '<div class="pickcount"><span class="v' + (count ? "" : " zero") + '">' + count + "</span>" +
        '<span class="l">tried</span></div>' +
    "</div>" +
    '<div class="pickfilter">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
      '<input data-filter="' + ID + '|chan" autocomplete="off" value="' + esc(query) + '" ' +
        'placeholder="Filter ' + ALL.length + ' channels&hellip;">' +
    "</div>" +
    body
  );
}

/* ── module ───────────────────────────────────────────── */

export default {
  id: ID,
  nav: "Marketing now",
  title: "What's running today?",
  lede: COPY.lede.kickoff,
  skippable: true,
  notePrompt:
    "What they said about the last agency, what they've already tried, where the money went.",

  discovery: {
    lede: COPY.lede.discovery,
    notePrompt: "Anything about the current setup worth keeping.",
  },

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");
    const t = sayer(COPY, ctx.mode);

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Who has it now</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "agency", "Incumbent agency", v("agency"), {
            placeholder: "Nobody — it's all in-house",
            help: t("agency"),
          }) +
          field(ID, "contractEnd", "Contract ends", v("contractEnd"), {
            placeholder: "March, month-to-month, no idea",
          }) +
          field(ID, "notice", "Notice period", v("notice"), {
            placeholder: "30 days",
          }) +
          field(ID, "ownsAccounts", "Who owns the ad accounts?", v("ownsAccounts"), {
            placeholder: "Agency does",
            help: t("ownsAccounts"),
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' + picker(s, (ctx.transient[ID] || {}).filter || "", ctx.mode) +
        '<div class="pickother">' +
          '<div class="mlabel">Something we missed</div>' +
          '<div class="fields one" style="margin-top:12px">' +
            field(ID, "otherChan", "Other channels", v("otherChan"), {
              type: "longtext", rows: 3,
              // Shows the shape it actually parses. A comma-separated
              // example here would teach the one format this box no
              // longer splits on.
              placeholder: "Direct mail\nTruck wraps\nRadio spot on 98.1",
              help: "One per line — commas stay part of the name. Anything not in the list above.",
            }) +
          "</div>" +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">' + t("learnedLabel") + "</div>" +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "worked", t("workedField"), v("worked"), {
            type: "longtext",
            placeholder: "Word of mouth and the van. Everything else has been a coin flip.",
          }) +
          field(ID, "burned", t("burnedField"), v("burned"), {
            type: "longtext",
            placeholder: "Paid an agency $4k a month for a year and never saw a report.",
            help: t("burned"),
          }) +
          field(ID, "wontTouch", t("wontTouchField"), v("wontTouch"), {
            type: "longtext",
            placeholder: "Won't go near shared leads again.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) {
    const s = ctx.state.m[ID] || {};
    // Channels typed into the free-text box count just as much as tiles —
    // someone who ran only direct mail and radio has still answered this.
    const shim = { ...s, chanAny: selected(s).length || customChannels(s).length ? "y" : "" };
    return statusFor(shim, CORE);
  },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const picked = selected(s);
    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    put("Incumbent agency", s.agency);
    put("Contract ends", s.contractEnd);
    put("Notice period", s.notice);
    put("Ad accounts owned by", s.ownsAccounts);
    put("Channels tried", picked.length ? String(picked.length) : "");
    put("What worked", s.worked);
    put("What burned them", s.burned);
    put("Won't touch", s.wontTouch);

    // one CSV-ready row per channel
    const body = picked.map((id) => {
      const ch = BY_ID.get(id);
      const rate = RATINGS.find((r) => r.value === s[rateKey(id)]);
      return [
        ch ? ch.label : id,
        ch ? ch.cat : "Custom",
        rate ? rate.label : "",
        s[volKey(id)] || "",
        s[noteKey(id)] || "",
      ];
    });
    for (const name of customChannels(s)) body.push([name, "Other", "", "", ""]);

    const table = body.length
      ? { head: ["channel", "category", "how it's going", "leads / mo", "note"], body }
      : null;

    const open = [];
    const wasted = picked.filter((id) => s[rateKey(id)] === "waste");
    if (wasted.length) {
      open.push({
        what: "Channels they call a waste",
        detail: wasted.map((id) => (BY_ID.get(id) || {}).label || id).join(", ") +
          " — confirm we're not about to rebuild one of these",
      });
    }
    const unrated = picked.filter((id) => !filled(s[rateKey(id)]));
    if (unrated.length) {
      open.push({
        what: "Unrated channels",
        detail: unrated.length + " channel" + (unrated.length > 1 ? "s" : "") +
          " selected with no verdict on how they're performing",
      });
    }
    if (filled(s.agency) && !filled(s.contractEnd)) {
      open.push({ what: "Incumbent contract", detail: "An agency is named but nobody knows when the contract ends",
        ask: "Check when your current contract ends and how much notice it needs." });
    }
    if (filled(s.agency) && !filled(s.ownsAccounts)) {
      open.push({ what: "Ad account ownership", detail: "Unknown — if the agency owns them, the history doesn't transfer",
        ask: "Find out whether you or your current agency owns your ad accounts." });
    }

    return table ? { rows, table, open } : { rows, open };
  },
};
