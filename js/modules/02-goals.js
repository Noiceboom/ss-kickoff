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
  sectionHead, skipRow, field, chipGroup, slider, derived,
  statusFor, filled, money, pct,
} from "../ui.js";
import { isSkipped, slot } from "../state.js";

const ID = "goals";

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

const CADENCE = [
  { value: "weekly", label: "Weekly call" },
  { value: "biweekly", label: "Every other week" },
  { value: "monthly", label: "Monthly report" },
  { value: "async", label: "Message me, don't meet me" },
  { value: "exception", label: "Only when something's wrong" },
];

const BUDGET_FLEX = [
  { value: "", label: "—" },
  { value: "fixed", label: "Fixed — that's the ceiling" },
  { value: "flex", label: "Will scale if it works" },
  { value: "unsure", label: "Needs a conversation" },
];

const CONSTRAINTS = [
  { value: "", label: "—" },
  { value: "techs", label: "Techs in the field" },
  { value: "office", label: "Phones / dispatch" },
  { value: "trucks", label: "Trucks and equipment" },
  { value: "cash", label: "Cash to fund the work" },
  { value: "nothing", label: "Nothing — they can absorb it" },
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
  lede: "Numbers on the table before anyone talks tactics. What they do today, what they want, and — the one everybody skips — how much more work they can actually take without falling over.",
  skippable: true,
  notePrompt:
    "Numbers they hedged on, targets they walked back, what growth actually means to them.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHead("02", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Where they are today</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Real numbers, not the ones on the website. Drag to roughly right &mdash; an honest guess beats a precise dodge." +
        "</div>" +
        '<div class="fields sliders" style="margin-top:26px">' +
          slider(ID, "revNow", "Revenue per month, now", v("revNow"), {
            ...SCALE.revenue, start: 120000,
            help: "An average month, not their best one.",
          }) +
          slider(ID, "leadsNow", "Leads per month, now", v("leadsNow"), {
            ...SCALE.leads, start: 150,
            help: "Calls and forms from everywhere, not just paid.",
          }) +
          slider(ID, "avgTicket", "Average ticket", v("avgTicket"), {
            ...SCALE.ticket, start: 900,
            help: "What a closed job is worth. This sets what we can afford to pay for a lead.",
          }) +
          slider(ID, "closeRate", "Close rate", v("closeRate"), {
            ...SCALE.rate, start: 40,
            help: "Of the leads that come in, how many turn into paid work. If they don't know, that itself is a finding.",
          }) +
        "</div>" +
        derived("goals:today") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Where they want to be</div>' +
        '<div class="fields sliders" style="margin-top:22px">' +
          slider(ID, "revTarget", "Revenue per month, target", v("revTarget"), {
            ...SCALE.revenue, start: 250000,
            help: "The number that makes this engagement a win in their head.",
          }) +
          slider(ID, "leadsTarget", "Leads per month, target", v("leadsTarget"), {
            ...SCALE.leads, start: 250,
          }) +
          slider(ID, "budget", "Marketing budget per month", v("budget"), {
            ...SCALE.budget, start: 8000,
            help: "Everything in — ad spend plus fees. If they won't name a number, ask what they spend today.",
          }) +
        "</div>" +
        derived("goals:gap") +
        '<div class="fields two" style="margin-top:24px">' +
          field(ID, "budgetFlex", "Is that number movable?", v("budgetFlex"), {
            type: "select", options: BUDGET_FLEX,
            help: "Decides whether we build to a cap or build to a return.",
          }) +
        "</div>" +
        chipGroup(ID, "horizon", "By when?", s.horizon, HORIZONS, {
          help: "The window they're judging us in. Say it out loud so nobody's quietly on a different clock.",
        }) +
      "</div>" +

      '<div class="card">' +
        "<h3>What matters most</h3>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
          "How they'll decide whether this is working &mdash; which is not always the same as the revenue number above." +
        "</div>" +
        chipGroup(ID, "priority", "If they could only keep one", s.priority, PRIORITIES, {
          help: "Volume and quality pull against each other. Make them pick.",
        }) +
        chipGroup(ID, "goodLead", "What counts as a good lead", s.goodLead, GOOD_LEAD, {
          help: "The single most argued-about definition in this business. Settle it now and the reporting never becomes a fight.",
        }) +
        chipGroup(ID, "cadence", "How they want to hear from us", s.cadence, CADENCE, {
          help: "Match this and half the relationship problems never happen.",
        }) +
        '<div class="fields two" style="margin-top:22px">' +
          field(ID, "scoreboard", "What number do they check first?", v("scoreboard"), {
            placeholder: "Calls booked this week",
            help: "Whatever they open the dashboard for is the real KPI, whatever they said above.",
          }) +
          field(ID, "whoElse", "Who else is judging this?", v("whoElse"), {
            placeholder: "His wife does the books",
            help: "There's usually one more person with an opinion. Find them now.",
          }) +
          field(ID, "fireUs", "What would make them fire us?", v("fireUs"), {
            type: "longtext", wide: true,
            placeholder: "Three months of no calls. Or surprises on the invoice.",
            help: "Ask it plainly. The answer is worth more than anything else on this screen.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What they can actually absorb</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "The question everybody skips, then regrets in month two." +
        "</div>" +
        '<div class="fields sliders" style="margin-top:26px">' +
          slider(ID, "capacity", "How many MORE jobs a week could they take?", v("capacity"), {
            ...SCALE.jobs, start: 10,
            help: "Today, with the crew they have. Not after hiring.",
          }) +
        "</div>" +
        '<div class="fields two" style="margin-top:22px">' +
          field(ID, "capacityBlock", "What breaks first?", v("capacityBlock"), {
            type: "select", options: CONSTRAINTS,
            help: "When the phone rings more than they can handle, this is what gives.",
          }) +
          field(ID, "win90", "What does winning look like in 90 days?", v("win90"), {
            type: "longtext", wide: true,
            placeholder: "Phone ringing enough that I stop worrying about January.",
            help: "In their words. This line ends up in the recap.",
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
    const span = (a, b, fmt) => {
      const A = filled(s[a]) ? fmt(s[a]) : "";
      const B = filled(s[b]) ? fmt(s[b]) : "";
      if (A && B) return A + " → " + B;
      return A || B || "";
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
    put("Reporting cadence", label(CADENCE, s.cadence));
    put("Checks first", s.scoreboard);
    put("Also judging this", s.whoElse);
    put("Would fire us over", s.fireUs);
    put("Spare capacity", filled(s.capacity) ? s.capacity + " more jobs / week" : "");
    put("Breaks first", label(CONSTRAINTS, s.capacityBlock));
    put("Winning in 90 days", s.win90);

    const open = [];
    if (filled(s.revTarget) && !filled(s.budget)) {
      open.push({ what: "Marketing budget", detail: "They named a target but no budget — nothing can be scoped against that" });
    }
    if (!filled(s.capacity)) {
      open.push({ what: "Capacity ceiling", detail: "We don't know how much more work they can actually take" });
    }
    if (!filled(s.closeRate)) {
      open.push({ what: "Close rate", detail: "Unknown — we can't work out what a lead is worth to them" });
    }
    if (!filled(s.goodLead)) {
      open.push({ what: "Definition of a good lead", detail: "Unsettled — this is what reporting arguments are made of" });
    }
    if (!filled(s.fireUs)) {
      open.push({ what: "What would make them fire us", detail: "Never asked — worth a follow-up call" });
    }
    if (s.budgetFlex === "unsure") {
      open.push({ what: "Budget flexibility", detail: "They weren't sure whether the number can move" });
    }

    return { rows, open };
  },
};
