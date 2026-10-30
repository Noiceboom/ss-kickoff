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
} from "../ui.js";
import { isSkipped, slot } from "../state.js";
import { sayer } from "../modes.js";

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
  apptsNow: {
    kickoff: "Appointments actually booked and run, not leads. The step between the phone ringing and the close.",
    discovery: "Appointments actually booked and run, not leads. A rough number is fine.",
  },
  avgTicket: {
    kickoff: "What a closed job is worth. This sets what we can afford to pay for a lead.",
    discovery: "What a closed job is worth to you, on average.",
  },
  closeRate: {
    kickoff: "Of the appointments they run, how many turn into paid work. If they don't know, that itself is a finding.",
    discovery: "Of the appointments you run, how many turn into paid work. A rough number is fine.",
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
  minutes: { min: 0, max: 1440, curve: 2.6, mode: "count", unit: "min" },
};

function num(s, key) {
  const raw = s[key];
  if (!filled(raw)) return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : null;
}

/**
 * Leads → appointments → closed jobs → revenue. Close rate is a share of
 * appointments, so every "what a lead is worth" and "leads it takes" runs
 * through the booking rate too. Next steps reads the same two functions,
 * which is what keeps its funnel and this screen in agreement.
 *
 * Booking rate comes from the counts when both are given (what actually
 * happened), else the booking-rate slider. With neither, close rate is
 * applied to leads directly, which is how this screen used to read it.
 */
export function bookRate(s) {
  const leads = num(s, "leadsNow");
  const appts = num(s, "apptsNow");
  if (leads && appts) return (appts / leads) * 100;
  return num(s, "apptRate");
}

/** Revenue one lead is worth on average, or null without a ticket and close rate. */
export function leadWorth(s) {
  const ticket = num(s, "avgTicket");
  const close = num(s, "closeRate");
  if (!ticket || !close) return null;
  const book = bookRate(s);
  return ticket * (close / 100) * (book ? book / 100 : 1);
}

/** How far two figures can drift apart before the check calls it out. */
const MISS = 0.2;

/** Rounds a suggested figure to something a person would actually say. */
function nice(v) {
  const step = v < 100 ? 1 : v < 1000 ? 10 : v < 10000 ? 50 : v < 100000 ? 500 : 1000;
  return Math.round(v / step) * step;
}

/**
 * Numbers on this screen that can't all be true at once, as a yellow note
 * under each figure involved saying what it would have to be for the rest
 * to add up. Holding the others still, so the AM can ask the client which
 * one is the shaky one and move just that.
 */
function mathFixes(s) {
  const f = (v) => Math.round(v).toLocaleString("en-US");
  const up = (v) => Math.ceil(v).toLocaleString("en-US");
  const far = (a, b) => Math.abs(a - b) / Math.max(a, b) > MISS;
  const revNow = num(s, "revNow");
  const revTarget = num(s, "revTarget");
  const leadsNow = num(s, "leadsNow");
  const leadsTarget = num(s, "leadsTarget");
  const appts = num(s, "apptsNow");
  const ticket = num(s, "avgTicket");
  const close = num(s, "closeRate");
  const typed = num(s, "apptRate");
  const out = {};
  const add = (key, html) => { out[key] = out[key] ? out[key] + " " + html : html; };

  if (leadsNow && appts && appts > leadsNow) {
    add("apptsNow", "Can&rsquo;t be more than the <strong>" + f(leadsNow) + " leads</strong>.");
    add("leadsNow", "Needs to be at least <strong>" + f(appts) + "</strong> to book " + f(appts) + " appointments.");
  } else if (leadsNow && appts && typed && Math.abs(typed - (appts / leadsNow) * 100) > 10) {
    add("apptRate", "Their appointment and lead counts say <strong>" + f((appts / leadsNow) * 100) +
      "%</strong>. Move this to match.");
  }

  // today: leads → appointments → jobs → revenue
  const book = bookRate(s);
  const booked = appts || (leadsNow && book ? leadsNow * (book / 100) : 0);
  if (revNow && ticket && close && booked) {
    const made = booked * (close / 100) * ticket;
    if (far(made, revNow)) {
      add("revNow", "Leads, appointments, close rate and ticket add up to <strong>" + money(nice(made)) + "</strong> a month. " +
        "Move this to match, or fix whichever of those is off.");
      if (appts) {
        const need = revNow / ((close / 100) * ticket);
        add("apptsNow", "To make " + money(revNow) + " at this close rate and ticket: about <strong>" +
          up(need) + "</strong>" + (leadsNow && need > leadsNow ? ", more than their " + f(leadsNow) + " leads" : "") + ".");
      } else if (leadsNow && book) {
        add("leadsNow", "To make " + money(revNow) + " at these booking and close rates: about <strong>" +
          up(revNow / ((book / 100) * (close / 100) * ticket)) + "</strong>.");
      }
      add("avgTicket", "To make " + money(revNow) + " from " + f(booked * (close / 100)) +
        " jobs: about <strong>" + money(nice(revNow / (booked * (close / 100)))) + "</strong> a job.");
      const needClose = (revNow / (booked * ticket)) * 100;
      add("closeRate", needClose <= 100
        ? "To make " + money(revNow) + " from " + f(booked) + " appointments: about <strong>" + f(needClose) + "%</strong>."
        : "Even closing every appointment doesn&rsquo;t reach " + money(revNow) + ". Revenue, appointments or ticket is off.");
    }
  }

  // the goal: leads goal × what a lead is worth → revenue goal
  const worth = leadWorth(s);
  if (revTarget && leadsTarget && worth && far(leadsTarget * worth, revTarget)) {
    add("revTarget", f(leadsTarget) + " leads a month at today&rsquo;s rates brings about <strong>" +
      money(nice(leadsTarget * worth)) + "</strong>.");
    add("leadsTarget", money(revTarget) + " a month at today&rsquo;s rates takes about <strong>" +
      up(revTarget / worth) + " leads</strong>.");
  }
  if (revNow && revTarget && revTarget <= revNow) {
    add("revTarget", "At or below today&rsquo;s <strong>" + money(revNow) + "</strong>. Worth checking that&rsquo;s deliberate.");
  }
  if (leadsNow && leadsTarget && leadsTarget < leadsNow && (!revTarget || !revNow || revTarget > revNow)) {
    add("leadsTarget", "Below today&rsquo;s <strong>" + f(leadsNow) + "</strong> while revenue is meant to grow.");
  }

  const budget = num(s, "budget");
  const adSpend = num(s, "adSpend");
  if (budget && adSpend && adSpend > budget) {
    add("adSpend", "More than the whole <strong>" + money(budget) + "</strong> budget.");
    add("budget", "Needs to be at least the <strong>" + money(adSpend) + "</strong> ad spend.");
  }
  return out;
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
        // Now and goal sit side by side. Asking "what is it" here and
        // "what should it be" three cards later made the gap — the only
        // number that matters — something you had to hold in your head.
        '<div class="fields sliders" style="margin-top:26px">' +
          slider(ID, "revNow", "Revenue per month, now", v("revNow"), {
            ...SCALE.revenue, check: "goals:fix_revNow", start: 120000, help: t("revNow"),
          }) +
          slider(ID, "revTarget", "Revenue per month, goal", v("revTarget"), {
            ...SCALE.revenue, check: "goals:fix_revTarget", start: 250000, help: t("revTarget"),
          }) +
          slider(ID, "leadsNow", "Leads per month, now", v("leadsNow"), {
            ...SCALE.leads, check: "goals:fix_leadsNow", start: 150, help: t("leadsNow"),
          }) +
          slider(ID, "leadsTarget", "Leads per month, goal", v("leadsTarget"), {
            ...SCALE.leads, check: "goals:fix_leadsTarget", start: 250,
          }) +
          slider(ID, "apptsNow", "Appointments per month", v("apptsNow"), {
            ...SCALE.leads, check: "goals:fix_apptsNow", start: 60, help: t("apptsNow"),
          }) +
          slider(ID, "avgTicket", "Average ticket", v("avgTicket"), {
            ...SCALE.ticket, check: "goals:fix_avgTicket", start: 900, help: t("avgTicket"),
          }) +
        "</div>" +
        derived("goals:today") +
        derived("goals:gap") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What happens to a lead</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Everything between the phone ringing and the money arriving. Most of the money " +
          "already in the building is sitting in these four numbers." +
        "</div>" +
        '<div class="fields sliders" style="margin-top:26px">' +
          slider(ID, "speedToLead", "Response time", v("speedToLead"), {
            ...SCALE.minutes, start: 15,
            help: "How long before someone gets back to a new lead. The single biggest lever on the three numbers below it.",
          }) +
          slider(ID, "apptRate", "Appointment booking rate", v("apptRate"), {
            ...SCALE.rate, check: "goals:fix_apptRate", start: 45,
            help: "Of the leads that come in, how many end up as a booked appointment.",
          }) +
          slider(ID, "closeRate", "Sales booking rate", v("closeRate"), {
            ...SCALE.rate, check: "goals:fix_closeRate", start: 40, help: t("closeRate"),
          }) +
          slider(ID, "reviewRate", "Review rate", v("reviewRate"), {
            ...SCALE.rate, start: 15,
            help: "Of the jobs completed, how many leave a review.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">' + t("targetLabel") + "</div>" +
        '<div class="fields sliders" style="margin-top:22px">' +
          slider(ID, "budget", "Marketing budget per month", v("budget"), {
            ...SCALE.budget, check: "goals:fix_budget", start: 8000, help: t("budget"),
          }) +
          slider(ID, "adSpend", "Of that, ad spend", v("adSpend"), {
            ...SCALE.budget, check: "goals:fix_adSpend", start: 5000,
            help: "What reaches the platforms, separate from what it costs to have it run.",
          }) +
        "</div>" +
        derived("goals:cpl") +
        '<div class="fields two" style="margin-top:24px">' +
          field(ID, "budgetFlex", "Is that number movable?", v("budgetFlex"), {
            type: "select", options: BUDGET_FLEX, help: t("budgetFlex"),
          }) +
        "</div>" +
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
      const appts = num(s, "apptsNow");
      const book = bookRate(s);
      const base = appts || (leadsNow ? leadsNow * (book ? book / 100 : 1) : 0);
      if (base && rate) {
        const implied = Math.round(base * (rate / 100));
        const off = implied ? Math.abs(implied - jobs) / jobs : 1;
        const from = appts || book ? "appointment" : "lead";
        if (off <= MISS) line += " Their " + from + " numbers and close rate line up with that.";
      }
      out["goals:today"] = line;
    }
    const apptsNow = num(s, "apptsNow");
    if (leadsNow && apptsNow) {
      const r = Math.round((apptsNow / leadsNow) * 100);
      const typed = num(s, "apptRate");
      out["goals:today"] = (out["goals:today"] ? out["goals:today"] + " " : "") +
        apptsNow.toLocaleString("en-US") + " appointments from " + leadsNow.toLocaleString("en-US") +
        " leads is a <strong>" + r + "% booking rate</strong>.";
    }

    // the gap — what the target actually costs in leads
    if (revNow && revTarget && revTarget > revNow) {
      const lift = Math.round(((revTarget - revNow) / revNow) * 100);
      let line = "That's <strong>+" + lift + "%</strong> on today, or " +
        "<strong>" + money(revTarget - revNow) + "</strong> more a month.";
      const worth = leadWorth(s);
      if (worth) {
        const leadsNeeded = Math.round(revTarget / worth);
        line += " At their ticket, booking and close rates that needs about <strong>" +
          leadsNeeded.toLocaleString("en-US") + " leads a month</strong>";
        line += leadsNow ? " — up from " + leadsNow.toLocaleString("en-US") + "." : ".";
      }
      if (budget && revTarget) {
        line += " Budget is <strong>" + Math.round((budget / revTarget) * 100) +
          "%</strong> of the target; owners who grow past $5M typically run 6–10%.";
      }
      out["goals:gap"] = line;
    }

    // what a lead is allowed to cost, if the goal is to be hit on that spend
    const adSpend = num(s, "adSpend");
    const leadsTarget = num(s, "leadsTarget");
    if (adSpend && leadsTarget) {
      const cpl = adSpend / leadsTarget;
      let line = "That's <strong>" + money(Math.round(cpl)) +
        "</strong> a lead to hit " + leadsTarget.toLocaleString("en-US") + " at that spend.";
      const worth = leadWorth(s);
      if (worth) {
        // What a lead is worth, so the cost has something to be judged against.
        line += " A lead is worth about <strong>" + money(Math.round(worth)) + "</strong> at their " +
          "ticket and booking rate" +
          (cpl >= worth
            ? " — that costs more than it returns."
            : ", so roughly <strong>" + Math.round(worth / cpl) + "x</strong>.");
      }
      out["goals:cpl"] = line;
    } else if (adSpend && !leadsTarget) {
      out["goals:cpl"] = "Set a leads goal and this works out what a lead is allowed to cost.";
    }

    const fixes = mathFixes(s);
    for (const k in fixes) out["goals:fix_" + k] = fixes[k];

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

    // In the order the screen asks it, with the figures the screen works
    // out. Those derived lines — the gap, the leads it takes, what a lead
    // is worth, what one may cost — were shown on screen and reached no
    // readout, and they are the numbers most worth carrying out of the call.
    const n = (k) => { const v = Number(String(s[k] == null ? "" : s[k]).replace(/[^0-9.]/g, "")); return isFinite(v) && v > 0 ? v : null; };
    const revNow = n("revNow"), revTarget = n("revTarget"), ticket = n("avgTicket"), rate = n("closeRate");
    const leadsTarget = n("leadsTarget"), adSpend = n("adSpend");

    put("Revenue / mo", span("revNow", "revTarget", money));
    put("Leads / mo", span("leadsNow", "leadsTarget", (x) => String(x)));
    put("Appointments / mo", filled(s.apptsNow) ? String(s.apptsNow) : "");
    put("Average ticket", filled(s.avgTicket) ? money(s.avgTicket) : "");
    if (revNow && revTarget && revTarget > revNow) {
      put("Gap to goal", money(revTarget - revNow) + " / mo (+" + Math.round(((revTarget - revNow) / revNow) * 100) + "%)");
    }
    const worthS = leadWorth(s);
    if (revTarget && worthS) {
      put("Leads needed at goal", Math.round(revTarget / worthS).toLocaleString("en-US") + " / mo at this ticket, booking and close rate");
    }

    put("Response time", filled(s.speedToLead) ? s.speedToLead + " min" : "");
    put("Appointment booking rate", pct(s.apptRate));
    put("Sales booking rate", filled(s.closeRate) ? pct(s.closeRate) : "");
    put("Review rate", pct(s.reviewRate));
    if (worthS) put("A lead is worth", money(Math.round(worthS)));

    put("Marketing budget", filled(s.budget) ? money(s.budget) + " / mo" : "");
    put("Ad spend", filled(s.adSpend) ? money(s.adSpend) + " / mo" : "");
    if (adSpend && leadsTarget) {
      const cpl = adSpend / leadsTarget;
      const worth = worthS;
      put("Cost per lead at goal", money(Math.round(cpl)) +
        (worth ? " — " + (cpl >= worth ? "more than a lead returns" : "about " + Math.round(worth / cpl) + "x return") : ""));
    }
    put("Budget movable", label(BUDGET_FLEX, s.budgetFlex));
    put("Horizon", s.horizon);
    put("Matters most", label(PRIORITIES, s.priority));
    put("A good lead is", label(GOOD_LEAD, s.goodLead));
    put("Spare capacity", filled(s.capacity) ? s.capacity + " more jobs / week" : "");
    put("Breaks first", label(CONSTRAINTS, s.capacityBlock));
    put("Winning in 90 days", s.win90);

    const open = [];
    // Two goals that cannot both be true. The screen works out the leads a
    // revenue target needs; when the leads target they gave is well short of
    // it, one of the two numbers is wrong, and that is worth knowing before
    // anything is priced against either.
    if (revTarget && worthS && leadsTarget) {
      const needed = Math.round(revTarget / worthS);
      if (needed > leadsTarget * 1.25) {
        open.push({
          what: "The two goals disagree",
          detail: "A " + money(revTarget) + " month needs about " + needed.toLocaleString("en-US") +
            " leads at their ticket and booking rate; their leads goal is " + leadsTarget.toLocaleString("en-US") +
            ". Either the revenue goal, the ticket, or the booking rate is off.",
        });
      }
    }
    if (filled(s.revTarget) && !filled(s.budget)) {
      open.push({ what: "Marketing budget", detail: "They named a target but no budget — nothing can be scoped against that",
        ask: "Confirm the monthly marketing budget you're comfortable with." });
    }
    if (!filled(s.capacity)) {
      open.push({ what: "Capacity ceiling", detail: "We don't know how much more work they can actually take",
        ask: "Let us know how much extra work you can take on before it becomes a problem." });
    }
    if (!filled(s.closeRate)) {
      open.push({ what: "Sales booking rate", detail: "Unknown — we can't work out what a lead is worth to them",
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
