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
// 02 — Goals & targets
// ============================================================
//
// The numbers half of the kickoff. Every figure here is a slider, because
// on a call nobody knows their close rate to the decimal — dragging to
// "about there" gets an honest answer where a blank text box gets a
// deferral. Each one is still typeable when they do know the exact number.
//
// Sliders start UNSET. A slider that always shows a value would make an
// unanswered question look answered, which is the one thing this doc must
// never do.

import {
  sectionHeadFor, skipRow, field, chipGroup, slider, derived,
  statusFor, filled, money, pct,
} from "../../ui.js";
import { isSkipped, slot } from "../../state.js";
import { sayer } from "../../modes.js";

const ID = "goals";

/* ── copy ─────────────────────────────────────────────── */
//
// Every string on this screen whose wording depends on who is reading it.
//
// The kickoff column is written to Sam, about a client who has already
// signed: "if they don't know, that itself is a finding", "make them
// pick", "real numbers, not the ones on the website". All of it is true
// and all of it is useful — and every word of it is on a shared screen
// the prospect is reading while they answer.
//
// So the discovery column is not a softened version of the same
// sentence. It is the same question asked TO the person answering it,
// with the part that is Sam's business — what a lead is worth to us, what
// we can afford to pay for one, what their answer reveals — taken out
// rather than reworded. Anything that only makes sense as a note to
// oneself does not belong on a screen someone else is reading.
//
// docs/check.mjs fails if any entry here is missing its discovery
// variant, and separately pins the kickoff phrases that must never
// appear in a discovery render.

export const COPY = {
  lede: {
    kickoff: "Numbers on the table before anyone talks tactics. What they do today, what they want, and — the one everybody skips — how much more work they can actually take without falling over.",
    discovery: "Numbers on the table before we talk about tactics: where you are now, where you want to be, and how much more work you could actually take on.",
  },

  todayLabel: { kickoff: "Where they are today", discovery: "Where you are today" },
  todayLede: {
    kickoff: "Real numbers, not the ones on the website. Drag to roughly right — an honest guess beats a precise dodge.",
    discovery: "Drag each one to roughly right. Ballpark is genuinely fine — we're looking for the shape, not the accounts.",
  },
  revNow: {
    kickoff: "An average month, not their best one.",
    discovery: "An average month, not your best one.",
  },
  leadsNow: {
    kickoff: "Calls and forms from everywhere, not just paid.",
    discovery: "Calls and forms from everywhere, not just paid.",
    same: true,
  },
  avgTicket: {
    kickoff: "What a closed job is worth. This sets what we can afford to pay for a lead.",
    discovery: "What a closed job is worth to you, on average.",
  },
  closeRate: {
    kickoff: "Of the leads that come in, how many turn into paid work. If they don't know, that itself is a finding.",
    discovery: "Of the leads that come in, how many turn into paid work. A rough number is fine.",
  },

  targetLabel: { kickoff: "Where they want to be", discovery: "Where you want to be" },
  revTarget: {
    kickoff: "The number that makes this engagement a win in their head.",
    discovery: "The number that would make this obviously worth doing.",
  },
  budget: {
    kickoff: "Everything in — ad spend plus fees. If they won't name a number, ask what they spend today.",
    discovery: "Everything in — ad spend plus fees.",
  },
  budgetFlex: {
    kickoff: "Decides whether we build to a cap or build to a return.",
    discovery: "A fixed ceiling and an open one are two different plans. Worth knowing which this is.",
  },
  horizon: {
    kickoff: "The window they're judging us in. Say it out loud so nobody's quietly on a different clock.",
    discovery: "The window we're both working to, so nobody's quietly on a different clock.",
  },

  mattersLede: {
    kickoff: "How they'll decide whether this is working — which is not always the same as the revenue number above.",
    discovery: "How you'll decide whether this is working — which isn't always the same as the revenue number above.",
  },
  priorityLabel: { kickoff: "If they could only keep one", discovery: "If you could only have one" },
  priority: {
    kickoff: "Volume and quality pull against each other. Make them pick.",
    discovery: "Volume and quality pull against each other, so it's worth saying which one you'd take.",
  },
  goodLead: {
    kickoff: "The single most argued-about definition in this business. Settle it now and the reporting never becomes a fight.",
    discovery: "The most argued-about definition in this business. Better to agree it now than when we're both looking at a report.",
  },

  capacityLabel: { kickoff: "What they can actually absorb", discovery: "What you could actually absorb" },
  capacityLede: {
    kickoff: "The question everybody skips, then regrets in month two.",
    discovery: "Worth asking before anyone turns the taps on. More work than you can service isn't a win.",
  },
  capacityField: {
    kickoff: "How many MORE jobs a week could they take?",
    discovery: "How many more jobs a week could you take?",
  },
  capacity: {
    kickoff: "Today, with the crew they have. Not after hiring.",
    discovery: "Today, with the crew you have — not after hiring.",
  },
  capacityBlock: {
    kickoff: "When the phone rings more than they can handle, this is what gives.",
    discovery: "If the phone rang twice as much starting tomorrow, what gives first?",
  },
  win90: {
    kickoff: "In their words. This line ends up in the recap.",
    discovery: "In your words — this one goes in the document you get after this call.",
  },
};

const CORE = ["revNow", "revTarget", "budget", "closeRate", "capacity"];

const HORIZONS = ["90 days", "6 months", "12 months"];

// Option lists live up here because summary() reads the labels back out.
const PRIORITIES = [
  { value: "calls", label: "More calls" },
  { value: "quality", label: "Better calls" },
  { value: "cpl", label: "Lower cost per lead" },
  { value: "brand", label: "Brand / being known" },
];

const GOOD_LEAD = [
  { value: "booked", label: "A booked job" },
  { value: "qualified", label: "A real conversation" },
  { value: "anycall", label: "Any call that connects" },
  { value: "form", label: "A form fill counts too" },
];

const BUDGET_FLEX = [
  { value: "", label: "—" },
  { value: "fixed", label: "Fixed — that's the ceiling" },
  { value: "flex", label: "Will scale if it works" },
  { value: "unsure", label: "Needs a conversation" },
];

// Option LABELS are as visible as help text, and this list is a set of
// sentences about the person answering. Kept per mode for the same reason
// everything else here is.
const CONSTRAINTS_BY_MODE = {
  kickoff: "Nothing — they can absorb it",
  discovery: "Nothing — we could absorb it",
};

const CONSTRAINTS = [
  { value: "", label: "—" },
  { value: "techs", label: "Techs in the field" },
  { value: "office", label: "Phones / dispatch" },
  { value: "trucks", label: "Trucks and equipment" },
  { value: "cash", label: "Cash to fund the work" },
  { value: "nothing", label: CONSTRAINTS_BY_MODE.kickoff },
];

/* ── slider scales ────────────────────────────────────── */
//
// Curves are tuned so the range a home-services business actually lives in
// gets most of the track, instead of everything below $200k sharing three
// pixels with everything above it.

const SCALE = {
  revenue: { min: 0, max: 2000000, curve: 2.6, mode: "money", unit: "/mo" },
  leads: { min: 0, max: 3000, curve: 2.2, mode: "count", unit: "/mo" },
  ticket: { min: 0, max: 25000, curve: 2.4, mode: "money" },
  rate: { min: 0, max: 100, curve: 1, mode: "pct" },
  budget: { min: 0, max: 150000, curve: 2.5, mode: "money", unit: "/mo" },
  jobs: { min: 0, max: 200, curve: 2, mode: "count", unit: "/wk" },
};

function num(s, key) {
  const raw = s[key];
  if (!filled(raw)) return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : null;
}

/* ── module ───────────────────────────────────────────── */

export default {
  id: ID,
  nav: "Goals",
  title: "Where are you trying to get to?",
  lede: COPY.lede.kickoff,
  skippable: true,
  notePrompt:
    "Numbers they hedged on, targets they walked back, what growth actually means to them.",

  discovery: {
    lede: COPY.lede.discovery,
    notePrompt: "Anything about the numbers worth keeping — caveats, ranges, where each figure came from.",
  },

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");
    const t = sayer(COPY, ctx.mode);

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">' + t("todayLabel") + "</div>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          t("todayLede") +
        "</div>" +
        '<div class="fields sliders" style="margin-top:26px">' +
          slider(ID, "revNow", "Revenue per month, now", v("revNow"), {
            ...SCALE.revenue, start: 120000,
            help: t("revNow"),
          }) +
          slider(ID, "leadsNow", "Leads per month, now", v("leadsNow"), {
            ...SCALE.leads, start: 150,
            help: t("leadsNow"),
          }) +
          slider(ID, "avgTicket", "Average ticket", v("avgTicket"), {
            ...SCALE.ticket, start: 900,
            help: t("avgTicket"),
          }) +
          slider(ID, "closeRate", "Close rate", v("closeRate"), {
            ...SCALE.rate, start: 40,
            help: t("closeRate"),
          }) +
        "</div>" +
        derived("goals:today") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">' + t("targetLabel") + "</div>" +
        '<div class="fields sliders" style="margin-top:22px">' +
          slider(ID, "revTarget", "Revenue per month, target", v("revTarget"), {
            ...SCALE.revenue, start: 250000,
            help: t("revTarget"),
          }) +
          slider(ID, "leadsTarget", "Leads per month, target", v("leadsTarget"), {
            ...SCALE.leads, start: 250,
          }) +
          slider(ID, "budget", "Marketing budget per month", v("budget"), {
            ...SCALE.budget, start: 8000,
            help: t("budget"),
          }) +
        "</div>" +
        derived("goals:gap") +
        '<div class="fields two" style="margin-top:24px">' +
          field(ID, "budgetFlex", "Is that number movable?", v("budgetFlex"), {
            type: "select", options: BUDGET_FLEX,
            help: t("budgetFlex"),
          }) +
        "</div>" +
        // `horizon` came out of both documents. The sales call already
        // asks when they want this live on the Why-now screen, and the
        // kickoff no longer reads it — a duplicate answer with nowhere to
        // arrive.
      "</div>" +

      '<div class="card">' +
        "<h3>What matters most</h3>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
          t("mattersLede") +
        "</div>" +
        chipGroup(ID, "priority", t("priorityLabel"), s.priority, PRIORITIES, {
          help: t("priority"),
        }) +
        chipGroup(ID, "goodLead", "What counts as a good lead", s.goodLead, GOOD_LEAD, {
          help: t("goodLead"),
        }) +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">' + t("capacityLabel") + "</div>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          t("capacityLede") +
        "</div>" +
        '<div class="fields sliders" style="margin-top:26px">' +
          slider(ID, "capacity", t("capacityField"), v("capacity"), {
            ...SCALE.jobs, start: 10,
            help: t("capacity"),
          }) +
        "</div>" +
        '<div class="fields two" style="margin-top:22px">' +
          field(ID, "capacityBlock", "What breaks first?", v("capacityBlock"), {
            type: "select",
            options: CONSTRAINTS.map((o) => (o.value === "nothing"
              ? { value: o.value, label: CONSTRAINTS_BY_MODE[ctx.mode] || CONSTRAINTS_BY_MODE.kickoff }
              : o)),
            help: t("capacityBlock"),
          }) +
          field(ID, "win90", "What does winning look like in 90 days?", v("win90"), {
            type: "longtext", wide: true,
            placeholder: "Phone ringing enough that I stop worrying about January.",
            help: t("win90"),
          }) +
        "</div>" +
      "</div>"
    );
  },

  /**
   * Live comparison lines. Recomputed by app.js on every input, without a
   * re-render, so the maths keeps up with the slider while it's moving.
   */
  derive(ctx) {
    const s = slot(ctx.state, ID);
    const revNow = num(s, "revNow");
    const revTarget = num(s, "revTarget");
    const ticket = num(s, "avgTicket");
    const rate = num(s, "closeRate");
    const leadsNow = num(s, "leadsNow");
    const budget = num(s, "budget");
    const out = {};

    // today — implied jobs a month, and whether the numbers agree
    if (revNow && ticket) {
      const jobs = Math.round(revNow / ticket);
      let line = "That's about <strong>" + jobs.toLocaleString("en-US") + " closed jobs</strong> a month.";
      if (leadsNow && rate) {
        const implied = Math.round(leadsNow * (rate / 100));
        const off = implied ? Math.abs(implied - jobs) / jobs : 1;
        line += off > 0.35
          ? ' Their lead and close numbers imply <strong>' + implied.toLocaleString("en-US") +
            "</strong> — worth asking which figure is the shaky one."
          : " Their lead volume and close rate line up with that.";
      }
      out["goals:today"] = line;
    }

    // the gap — what the target actually costs in leads
    if (revNow && revTarget && revTarget > revNow) {
      const lift = Math.round(((revTarget - revNow) / revNow) * 100);
      let line = "That's <strong>+" + lift + "%</strong> on today, or " +
        "<strong>" + money(revTarget - revNow) + "</strong> more a month.";
      if (ticket && rate) {
        const leadsNeeded = Math.round((revTarget / ticket) / (rate / 100));
        line += " At their ticket and close rate that needs about <strong>" +
          leadsNeeded.toLocaleString("en-US") + " leads a month</strong>";
        line += leadsNow ? " — up from " + leadsNow.toLocaleString("en-US") + "." : ".";
      }
      if (budget && revTarget) {
        line += " Budget is <strong>" + Math.round((budget / revTarget) * 100) +
          "%</strong> of the target; owners who grow past $5M typically run 6–10%.";
      }
      out["goals:gap"] = line;
    } else if (revNow && revTarget && revTarget <= revNow) {
      out["goals:gap"] = "Target is at or below today's revenue — worth checking that's deliberate.";
    }

    return out;
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const label = (list, val) => {
      const hit = list.find((o) => o.value === val);
      return hit ? hit.label : val;
    };
    // A single figure with no arrow is ambiguous — someone reading the
    // brief cannot tell today's revenue from the target they asked for.
    const span = (a, b, fmt) => {
      const A = filled(s[a]) ? fmt(s[a]) : "";
      const B = filled(s[b]) ? fmt(s[b]) : "";
      if (A && B) return A + " → " + B;
      if (A) return A + " (today, no target set)";
      if (B) return B + " (target, today not captured)";
      return "";
    };

    const rows = [];
    const put = (k, val) => { if (filled(val)) rows.push([k, val]); };

    put("Revenue / mo", span("revNow", "revTarget", money));
    put("Leads / mo", span("leadsNow", "leadsTarget", (x) => String(x)));
    put("Average ticket", filled(s.avgTicket) ? money(s.avgTicket) : "");
    put("Close rate", filled(s.closeRate) ? pct(s.closeRate) : "");
    put("Marketing budget", filled(s.budget) ? money(s.budget) + " / mo" : "");
    put("Budget movable", label(BUDGET_FLEX, s.budgetFlex));
    put("Horizon", s.horizon);
    put("Matters most", label(PRIORITIES, s.priority));
    put("A good lead is", label(GOOD_LEAD, s.goodLead));
    put("Spare capacity", filled(s.capacity) ? s.capacity + " more jobs / week" : "");
    put("Breaks first", label(CONSTRAINTS, s.capacityBlock));
    put("Winning in 90 days", s.win90);

    const open = [];
    if (filled(s.revTarget) && !filled(s.budget)) {
      open.push({ what: "Marketing budget", detail: "They named a target but no budget — nothing can be scoped against that",
        ask: "Confirm the monthly marketing budget you're comfortable with." });
    }
    if (!filled(s.capacity)) {
      open.push({ what: "Capacity ceiling", detail: "We don't know how much more work they can actually take",
        ask: "Let us know how much extra work you can take on before it becomes a problem." });
    }
    if (!filled(s.closeRate)) {
      open.push({ what: "Close rate", detail: "Unknown — we can't work out what a lead is worth to them",
        ask: "Send us your close rate if you track it — it tells us what a lead is worth." });
    }
    if (!filled(s.goodLead)) {
      open.push({ what: "Definition of a good lead", detail: "Unsettled — this is what reporting arguments are made of",
        ask: "Agree with us what counts as a good lead, so we're measuring the same thing." });
    }
    if (s.budgetFlex === "unsure") {
      open.push({ what: "Budget flexibility", detail: "They weren't sure whether the number can move" });
    }

    return { rows, open };
  },
};
