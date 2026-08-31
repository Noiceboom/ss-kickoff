// ============================================================
// 10 — Conversions
// ============================================================
//
// What counts as a lead, and what fires when one arrives.
//
// This used to be three fields on the Company screen — a tracking-number
// question, an inbox and a booking link — which is the wrong size for it.
// Every argument about reporting starts here: we say the campaign produced
// ninety leads, they say they got forty calls worth having, and both are
// looking at a real number. The difference is always a definition nobody
// wrote down.
//
// Kickoff only. On a first sales call this is detail nobody has yet.

import {
  sectionHeadFor, skipRow, field, chipGroup, toggle, rowGroup,
  statusFor, filled, esc,
} from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "conversions";

const CORE = ["phoneSetup", "formTo"];

const PHONE_SETUP = [
  { value: "main", label: "Main number everywhere" },
  { value: "one", label: "One tracking number" },
  { value: "perchannel", label: "A number per channel" },
  { value: "unsure", label: "Needs a conversation" },
];

const ANSWERS = [
  { value: "inhouse", label: "In-house, during hours" },
  { value: "service", label: "Answering service" },
  { value: "ai", label: "AI answering" },
  { value: "mixed", label: "Mixed" },
];

export default {
  id: ID,
  nav: "Conversions",
  title: "What counts as a lead?",
  lede:
    "Where leads come in, what fires when they do, and what everyone agrees is worth counting. " +
    "Settle it now and the reporting conversation in month three is a short one.",
  skippable: true,
  notePrompt:
    "How they actually count leads today, and where they think the current number is wrong.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Calls</div>' +
        chipGroup(ID, "phoneSetup", "How are numbers set up today?", s.phoneSetup, PHONE_SETUP, {
          help: "A number per channel is how a call becomes attributable. One number for everything " +
            "means every call is an unknown.",
        }) +
        (s.phoneSetup === "perchannel" || s.phoneSetup === "one"
          ? '<div class="fields two" style="margin-top:20px">' +
              field(ID, "trackingTool", "What runs the tracking?", v("trackingTool"), {
                placeholder: "CallRail",
              }) +
              field(ID, "trackingWho", "Whose account is it in?", v("trackingWho"), {
                placeholder: "The old agency's",
                help: "If it is the incumbent's, the call history does not come with us.",
              }) +
            "</div>"
          : "") +
        '<div style="margin-top:20px">' +
          rowGroup(ID, "numbers", [
            { key: "channel", label: "Channel", placeholder: "Google Ads" },
            { key: "number", label: "Number", placeholder: "(816) 555-0180", width: "190px" },
            { key: "rings", label: "Rings where", placeholder: "Front desk", width: "200px" },
          ], getRows(ctx.state, ID, "numbers"), {
            addLabel: "Add a number",
            empty: "Nothing listed yet — add one per channel they already track separately.",
          }) +
        "</div>" +
        '<div class="fields two" style="margin-top:22px">' +
          field(ID, "answers", "Who answers?", v("answers"), {
            type: "select",
            options: [{ value: "", label: "—" }].concat(ANSWERS),
          }) +
          field(ID, "missedCalls", "What happens to a missed call?", v("missedCalls"), {
            placeholder: "Voicemail nobody checks",
            help: "Usually the cheapest thing on this page to fix.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Form fills</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "formTo", "Where do form fills land?", v("formTo"), {
            type: "email", placeholder: "office@acmeplumbing.com",
            help: "Often the dispatcher, not the owner. Get the address that is actually watched.",
          }) +
          field(ID, "formAlso", "Anywhere else?", v("formAlso"), {
            placeholder: "Also into ServiceTitan",
            help: "CRM, Slack, a spreadsheet. Anything that would need rebuilding if the site changed.",
          }) +
          field(ID, "formCount", "How many forms are on the site?", v("formCount"), {
            type: "number", placeholder: "3",
            help: "Contact, quote request, the one in the footer nobody remembers.",
          }) +
        "</div>" +
        '<div style="margin-top:18px">' +
          toggle(ID, "formConfirm", "There's a thank-you page after submitting", !!s.formConfirm) +
        "</div>" +
        '<div style="font-size:13px;color:var(--muted);margin-top:8px">' +
          "Without one there is nothing to fire a conversion on, which is the most common reason " +
          "a form-heavy site reports almost no leads." +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Booked online</div>' +
        '<div style="margin-top:14px">' +
          toggle(ID, "bookingOn", "They take bookings on the site", !!s.bookingOn) +
        "</div>" +
        (s.bookingOn
          ? '<div class="fields two" style="margin-top:18px">' +
              field(ID, "bookingUrl", "Booking link", v("bookingUrl"), {
                placeholder: "https://…",
              }) +
              field(ID, "bookingTool", "What runs it?", v("bookingTool"), {
                placeholder: "ServiceTitan scheduler",
              }) +
              field(ID, "bookingTo", "Where does a booking go?", v("bookingTo"), {
                placeholder: "Straight onto the dispatch board",
              }) +
            "</div>"
          : "") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What we agree to count</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "counts", "A lead is…", v("counts"), {
            type: "longtext", rows: 3,
            placeholder: "A homeowner in our area asking about work we do. Call over 60 seconds, any form, any booking.",
            help: "Their words. This is the sentence both sides point at later.",
          }) +
          field(ID, "doesNotCount", "A lead is NOT…", v("doesNotCount"), {
            type: "longtext", rows: 3,
            placeholder: "Existing customers chasing a job, suppliers, recruiters, wrong numbers, anyone outside the area.",
            help: "Ask directly and write it down. Almost every reporting argument is about something on this line.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const label = (list, val) => {
      const hit = list.find((o) => o.value === val);
      return hit ? hit.label : val;
    };
    const rows = [];
    const put = (k, val) => { if (filled(val)) rows.push([k, val]); };

    put("Phone setup", label(PHONE_SETUP, s.phoneSetup));
    put("Call tracking", s.trackingTool);
    put("Tracking owned by", s.trackingWho);
    put("Who answers", label(ANSWERS, s.answers));
    put("Missed calls", s.missedCalls);
    put("Forms land at", s.formTo);
    put("Also goes to", s.formAlso);
    put("Forms on site", s.formCount);
    put("Thank-you page", s.formConfirm ? "Yes" : "");
    put("Online booking", s.bookingOn ? (s.bookingTool || "Yes") : "");
    put("Booking link", s.bookingUrl);
    put("Bookings go to", s.bookingTo);
    put("A lead is", s.counts);
    put("A lead is not", s.doesNotCount);

    const numbers = (Array.isArray(s.numbers) ? s.numbers : [])
      .filter((r) => r && (r.channel || r.number));
    const table = numbers.length
      ? { head: ["channel", "number", "rings where"],
          body: numbers.map((r) => [r.channel || "", r.number || "", r.rings || ""]) }
      : null;

    const open = [];
    if (s.phoneSetup === "main") {
      open.push({
        what: "Every call looks the same",
        detail: "One number across everything, so no call can be attributed to what caused it.",
        ask: "We'll set up tracking numbers so you can see which calls came from where.",
      });
    }
    if (s.phoneSetup === "unsure") {
      open.push({ what: "Phone tracking undecided", detail: "Nobody agreed how numbers get set up." });
    }
    if (filled(s.trackingWho) && /agency|old|previous|them/i.test(s.trackingWho)) {
      open.push({
        what: "Call history sits with the incumbent",
        detail: "The tracking account is theirs, so the history does not transfer.",
        ask: "Ask your current provider to release the call-tracking account, or we'll start a clean one.",
      });
    }
    if (!filled(s.formTo)) {
      open.push({
        what: "Form fills have no destination on record",
        detail: "Nobody said where a form fill actually lands.",
        ask: "Tell us which inbox web enquiries should go to.",
      });
    }
    if (s.formCount && !s.formConfirm) {
      open.push({
        what: "No thank-you page",
        detail: "Nothing to fire a conversion on, so forms will under-report from day one.",
      });
    }
    if (!filled(s.doesNotCount)) {
      open.push({
        what: "Nobody said what doesn't count",
        detail: "Every reporting argument starts here. Ask before the first report, not after it.",
      });
    }

    const out = { rows, open };
    if (table) out.table = table;
    return out;
  },
};
