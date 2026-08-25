// ============================================================
// 02 — Goals & targets
// ============================================================
//
// The numbers half of the kickoff. Two fields here do real work later:
// budget (nothing gets scoped without it) and the capacity ceiling — the
// only thing standing between a good month and a client drowning in jobs
// they can't run. Both become open items when they're left blank.

import { sectionHead, skipRow, field, chipGroup, statusFor, filled, money, pct } from "../ui.js";
import { isSkipped, slot } from "../state.js";

const ID = "goals";

// Keys that count toward "done". Anything not listed is a bonus field.
const CORE = ["revNow", "revTarget", "budget", "closeRate", "capacity"];

const HORIZONS = ["90 days", "6 months", "12 months"];

// Option lists live up here because summary() reads the labels back out.
const PRIORITIES = [
  { value: "calls", label: "More calls" },
  { value: "quality", label: "Better calls" },
  { value: "cpl", label: "Lower cost per lead" },
  { value: "brand", label: "Brand / being known" },
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
  { value: "nothing", label: "Nothing — room to grow" },
];

/** Label for a stored option value. Unknown values resolve to "". */
function labelOf(options, value) {
  const hit = options.filter(function (o) { return o.value && o.value === value; })[0];
  return hit ? hit.label : "";
}

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
          "Real numbers, not the ones on the website. Rough is fine &mdash; an honest guess beats a precise dodge." +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "revNow", "Revenue per month, now", v("revNow"), {
            type: "money", placeholder: "180,000",
            help: "An average month, not their best one.",
          }) +
          field(ID, "leadsNow", "Leads per month, now", v("leadsNow"), {
            type: "number", placeholder: "120",
            help: "Calls and forms from everywhere, not just paid.",
          }) +
          field(ID, "avgTicket", "Average ticket", v("avgTicket"), {
            type: "money", placeholder: "1,400",
            help: "What a closed job is worth. This sets what we can afford to pay for a lead.",
          }) +
          field(ID, "closeRate", "Close rate", v("closeRate"), {
            type: "percent", placeholder: "35",
            help: "Of the leads that come in, how many turn into paid work. If they don't know, that itself is a finding.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Where they want to be</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "revTarget", "Revenue per month, target", v("revTarget"), {
            type: "money", placeholder: "300,000",
            help: "The number that makes this engagement a win in their head.",
          }) +
          field(ID, "leadsTarget", "Leads per month, target", v("leadsTarget"), {
            type: "number", placeholder: "220",
          }) +
          field(ID, "budget", "Marketing budget per month", v("budget"), {
            type: "money", placeholder: "12,000",
            help: "Everything in — ad spend plus fees. If they won't name a number, ask what they spend today.",
          }) +
          field(ID, "budgetFlex", "Is that number movable?", v("budgetFlex"), {
            type: "select", options: BUDGET_FLEX,
            help: "Decides whether we build to a cap or build to a return.",
          }) +
        "</div>" +
        chipGroup(ID, "horizon", "By when?", s.horizon, HORIZONS, {
          help: "The window they're judging us in. Say it out loud so nobody's quietly on a different clock.",
        }) +
        chipGroup(ID, "priority", "What matters most to them", s.priority, PRIORITIES, {
          help: "The one they'd protect if they could only keep one. Volume and quality pull against each other.",
        }) +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What they can actually absorb</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "The overselling check. Ask it plainly and write down the number they say." +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "capacity", "How many MORE jobs a week could you take?", v("capacity"), {
            type: "number", placeholder: "15",
            help: "On top of what they run now, without hiring. If the answer is two, we are not buying more calls.",
          }) +
          field(ID, "capacityBlock", "What breaks first?", v("capacityBlock"), {
            type: "select", options: CONSTRAINTS,
            help: "Whatever they name is the real growth constraint. It is almost never the ad account.",
          }) +
        "</div>" +
        '<div class="fields one" style="margin-top:18px">' +
          field(ID, "win90", "What does winning look like in 90 days?", v("win90"), {
            type: "longtext", rows: 4, wide: true,
            placeholder: "Six trucks full Monday to Friday, and we stop paying for water heater leads we can't service.",
            help: "Their words, not ours. This is what gets read back at the first review.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    // now → target, collapsing to whichever half they actually gave us.
    const plain = (x) => (filled(x) ? String(x).trim() : "");
    const span = (now, target, fmt) => {
      const a = fmt(now);
      const b = fmt(target);
      if (a && b) return a + " → " + b;
      return b ? "target " + b : a;
    };

    put("Revenue / mo", span(s.revNow, s.revTarget, money));
    put("Leads / mo", span(s.leadsNow, s.leadsTarget, plain));
    put("Average ticket", money(s.avgTicket));
    put("Close rate", pct(s.closeRate));
    put("Marketing budget / mo", money(s.budget));
    put("Budget flexibility", labelOf(BUDGET_FLEX, s.budgetFlex));
    put("Time horizon", s.horizon);
    put("Matters most", labelOf(PRIORITIES, s.priority));
    put("Spare capacity", filled(s.capacity) ? plain(s.capacity) + " more jobs / week" : "");
    put("Breaks first", labelOf(CONSTRAINTS, s.capacityBlock));
    put("Winning in 90 days", s.win90);

    const open = [];
    if (filled(s.revTarget) && !filled(s.budget)) {
      open.push({
        what: "Marketing budget",
        detail: "They named a revenue target but no spend to reach it — nothing gets scoped until they do",
      });
    }
    if (!filled(s.capacity)) {
      open.push({
        what: "Capacity ceiling",
        detail: "We don't know how much work they can take. Ask before we turn any spend up",
      });
    }
    if (!filled(s.closeRate)) {
      open.push({
        what: "Close rate",
        detail: "Unknown — no way to work backwards from a revenue target to the leads we owe them",
      });
    }

    return { rows, open };
  },
};
