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

import { sectionHead, skipRow, field, statusFor, filled, esc } from "../ui.js";
import { isSkipped, slot } from "../state.js";
import { CATEGORIES, RATINGS, ALL, BY_ID } from "../channels.js";

const ID = "marketing";

const CORE = ["chanAny", "worked", "burned"];

/** Per-channel keys, kept flat so they ride the field kit unchanged. */
const rateKey = (id) => "rate_" + id;
const volKey = (id) => "vol_" + id;
const noteKey = (id) => "note_" + id;

function selected(s) {
  return Array.isArray(s.chan) ? s.chan : [];
}

/** Channels added on the call that aren't in the built-in list. */
function customChannels(s) {
  return String(s.otherChan || "")
    .split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
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

function picker(s, query) {
  const on = new Set(selected(s));
  const count = on.size;

  const body = CATEGORIES.map((cat) => {
    const tiles = ALL.filter((c) => c.cat === cat.name).map((c) => tile(s, c, on.has(c.id))).join("");
    return '<div class="pickcat" data-filter-cat>' + esc(cat.name) + "</div>" +
      '<div class="pickgrid">' + tiles + "</div>";
  }).join("");

  return (
    '<div class="pickhead">' +
      "<div><h3>Lead channels they've tried</h3>" +
        "<p>Tap what they've run. Then rate it &mdash; good, mixed, or a waste &mdash; " +
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
  lede: "Everything the phone currently rings from, who runs it, and what it's actually worth. The stuff that burned them matters as much as the stuff that worked.",
  skippable: true,
  notePrompt:
    "What they said about the last agency, what they've already tried, where the money went.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHead("03", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Who has it now</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "agency", "Incumbent agency", v("agency"), {
            placeholder: "Nobody — it's all in-house",
            help: "Including the freelancer nobody counts as an agency.",
          }) +
          field(ID, "contractEnd", "Contract ends", v("contractEnd"), {
            placeholder: "March, month-to-month, no idea",
          }) +
          field(ID, "notice", "Notice period", v("notice"), {
            placeholder: "30 days",
          }) +
          field(ID, "ownsAccounts", "Who owns the ad accounts?", v("ownsAccounts"), {
            placeholder: "Agency does",
            help: "If the agency owns them, the history doesn't come with us. Worth knowing on day one.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' + picker(s, (ctx.transient[ID] || {}).filter || "") +
        '<div class="pickother">' +
          '<div class="mlabel">Something we missed</div>' +
          '<div class="fields one" style="margin-top:12px">' +
            field(ID, "otherChan", "Other channels", v("otherChan"), {
              type: "longtext", rows: 2,
              placeholder: "Direct mail, truck wraps, the radio spot on 98.1…",
              help: "One per line. Anything that isn't in the list above.",
            }) +
          "</div>" +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What they&rsquo;ve learned the hard way</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "worked", "What has actually worked?", v("worked"), {
            type: "longtext",
            placeholder: "Word of mouth and the van. Everything else has been a coin flip.",
          }) +
          field(ID, "burned", "What burned them?", v("burned"), {
            type: "longtext",
            placeholder: "Paid an agency $4k a month for a year and never saw a report.",
            help: "This is the sentence that tells you how to keep them.",
          }) +
          field(ID, "wontTouch", "Anything they refuse to touch?", v("wontTouch"), {
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
      open.push({ what: "Incumbent contract", detail: "An agency is named but nobody knows when the contract ends" });
    }
    if (filled(s.agency) && !filled(s.ownsAccounts)) {
      open.push({ what: "Ad account ownership", detail: "Unknown — if the agency owns them, the history doesn't transfer" });
    }

    return table ? { rows, table, open } : { rows, open };
  },
};
