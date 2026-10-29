// ============================================================
// 14 — Next steps
// ============================================================
//
// The last thing the client sees before the call ends. The AM walks it
// top to bottom: where you are, where we're taking you, how we get
// there, the next two weeks, when we talk next, goodbye.
//
// Most of it is read from other screens rather than asked again — the
// revenue numbers from Goals, what we're running from the intro cards,
// what leads the build from Services and Cities, what we need from them
// from every screen's open items. The only new answers are the levers,
// the two-week plan and the next meeting.
//
// Kickoff only. A sales call ends on a proposal, not a plan.

import {
  sectionHeadFor, field, chipGroup, rowGroup, filled, money, esc, ICON,
} from "../ui.js";
import { slot, getRows, getField, isSkipped } from "../state.js";
import { OFFER } from "./00-intro.js";
import { bookRate } from "./02-goals.js";

const ID = "nextsteps";

const LEVERS = [
  { value: "budget", label: "Ad budget" },
  { value: "offers", label: "Offers & promotions" },
  { value: "targeting", label: "Bids & targeting" },
  { value: "svcpages", label: "New service pages" },
  { value: "citypages", label: "New city pages" },
  { value: "reviews", label: "More reviews" },
  { value: "booking", label: "Answering & booking rate" },
  { value: "seasonal", label: "Seasonal pushes" },
];

// What "Start from the usual two weeks" fills in. Edit the rows on the
// call; edit this list to change the default for everyone.
const PLAN = [
  { when: "Days 1–3", what: "Access and tracking: we get into your accounts and set up call tracking.", you: "Click the access link we send." },
  { when: "Days 4–7", what: "We build the campaigns, pages and profile updates for the services and cities we ranked today.", you: "Send your logo, photos and brand files." },
  { when: "Days 8–10", what: "You see everything before it goes live.", you: "Approve it or tell us what to change." },
  { when: "Days 11–14", what: "We launch, then watch the first calls and leads closely.", you: "Tell us how the first leads look." },
];

const ASKS_SHOWN = 5;

const PLAN_COLS = [
  { key: "when", label: "When", placeholder: "Days 1–3", width: "130px" },
  { key: "what", label: "What happens", type: "longtext", placeholder: "We get into your accounts and set up tracking" },
  { key: "you", label: "From you", type: "longtext", placeholder: "Click the access link", width: "240px" },
];

export default {
  id: ID,
  nav: "Next steps",
  title: "Where we go from here.",
  lede: "Walk this top to bottom to close the call. Most of it fills itself in from the screens before.",
  skippable: false,
  notePrompt: "Anything they asked for before the next meeting, or anything to put in the follow-up email.",

  seeds: { plan: PLAN },

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");
    const plan = getRows(ctx.state, ID, "plan");

    return (
      sectionHeadFor(this, ctx) +
      gapCard(ctx) +

      '<div class="card">' +
        '<div class="mlabel">How we get you there</div>' +
        running(ctx) +
        leading(ctx) +
        '<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">' +
          chipGroup(ID, "levers", "Levers we can pull", s.levers, LEVERS, {
            multi: true,
            help: "Tick the ones you talk through. These are what move the number if the first month is slow.",
          }) +
          '<div class="fields one" style="margin-top:14px">' +
            field(ID, "leversOther", "Anything else", v("leversOther"), {
              placeholder: "Financing offer in the ads once they have it set up",
            }) +
          "</div>" +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">The next two weeks</div>' +
        '<div style="margin-top:14px">' +
          rowGroup(ID, "plan", PLAN_COLS, plan, {
            addLabel: "Add a step",
            empty: "Nothing planned yet.",
          }) +
        "</div>" +
        (plan.length ? "" :
          '<div style="margin-top:10px"><button class="btn sm" data-seedrows="' + ID + '|plan">' +
            "Start from the usual two weeks</button></div>") +
        asksFromThem(ctx) +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">When we talk next</div>' +
        '<div class="fields" style="margin-top:16px">' +
          field(ID, "meetDate", "Date", v("meetDate"), { type: "date" }) +
          field(ID, "meetTime", "Time", v("meetTime"), { type: "time" }) +
          field(ID, "meetHow", "Where", v("meetHow"), { placeholder: "Zoom, link in the invite" }) +
          field(ID, "meetFor", "What it's for", v("meetFor"), {
            wide: true, placeholder: "Walk through everything we built before it goes live",
          }) +
        "</div>" +
      "</div>" +

      closer(ctx)
    );
  },

  derive(ctx) {
    const { win, goal } = numbers(ctx);
    return {
      [ID + ":wLeads"]: fmt(win.leads),
      [ID + ":wBooked"]: fmt(win.booked),
      [ID + ":wJobs"]: fmt(win.jobs),
      [ID + ":wNeed"]: needLine(win, goal),
    };
  },

  status(ctx) {
    const s = ctx.state.m[ID] || {};
    const hits = [filled(s.meetDate), getRows(ctx.state, ID, "plan").length > 0].filter(Boolean).length;
    return hits === 2 ? "done" : hits ? "partial" : "empty";
  },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    const rows = [];
    const put = (k, val) => { if (filled(val)) rows.push([k, val]); };

    put("Next meeting", [prettyDate(s.meetDate), prettyTime(s.meetTime)].filter(Boolean).join(", "));
    put("Where", s.meetHow);
    put("What it's for", s.meetFor);
    const levers = (Array.isArray(s.levers) ? s.levers : [])
      .map((x) => (LEVERS.find((l) => l.value === x) || { label: x }).label);
    if (filled(s.leversOther)) levers.push(s.leversOther);
    put("Levers we can pull", levers.join(", "));

    const { win, goal } = numbers(ctx);
    if (win.leads) {
      put("To hit the goal", fmt(win.leads) + " leads a month for " + money(goal) + " a month, at " +
        (win.appt ? win.appt + "% booking, " : "") + win.close + "% close and a " + money(win.ticket) + " average order");
    }

    const plan = getRows(ctx.state, ID, "plan").filter((r) => r && (r.when || r.what || r.you));
    const open = [];
    if (!filled(s.meetDate)) {
      open.push({ what: "No next meeting booked", detail: "The call ended without a date for the next one." });
    }
    if (!plan.length) {
      open.push({ what: "No two-week plan", detail: "Nobody walked them through what happens next." });
    }

    const out = { rows, open };
    if (plan.length) {
      out.table = { head: ["when", "what happens", "from you"], body: plan.map((r) => [r.when || "", r.what || "", r.you || ""]) };
    }
    return rows.length || plan.length ? out : { open };
  },
};

/* ── blocks ───────────────────────────────────────────── */

/**
 * The numbers behind the hero card, shared by render, derive and summary
 * so the three can never disagree.
 *
 * Everything on the left is Goals as typed: revenue now, the goal, and
 * today's leads, appointments, close rate and average order. Today's
 * funnel is those KPIs multiplied out; when that product doesn't land
 * within 10% of the revenue on Goals, `mismatch` says so rather than the
 * screen quietly picking one of the two.
 *
 * The goal row runs the same funnel backwards from the target. Booking
 * rate, close rate and average order start at today's and the AM can
 * change them on screen, so the client sees what a better close rate or
 * a bigger ticket does to the leads it takes.
 */
function numbers(ctx) {
  const g = ctx.state.m.goals || {};
  const s = ctx.state.m[ID] || {};
  const n = (v) => Number(String(v == null ? "" : v).replace(/[^0-9.]/g, "")) || 0;

  // Booked is the appointment count from Goals when they gave one, and the
  // booking rate is then what that count works out to; otherwise booked
  // comes from the booking-rate slider.
  const appts = n(g.apptsNow);
  const now = {
    leads: n(g.leadsNow), appt: Math.round(bookRate(g) || 0), close: n(g.closeRate), ticket: n(g.avgTicket),
  };
  now.booked = appts || (now.leads && now.appt ? Math.round(now.leads * now.appt / 100) : 0);
  now.jobs = now.close ? Math.round((now.booked || now.leads) * now.close / 100) : 0;
  now.rev = now.jobs && now.ticket ? now.jobs * now.ticket : 0;

  const goal = n(g.revTarget);
  const win = {
    appt: filled(s.winAppt) ? n(s.winAppt) : now.appt,
    close: filled(s.winClose) ? n(s.winClose) : now.close,
    ticket: filled(s.winTicket) ? n(s.winTicket) : now.ticket,
    rev: goal,
  };
  // Rounded UP at every step, so the jobs it lands on always reach the goal.
  win.jobs = goal && win.ticket ? Math.ceil(goal / win.ticket) : 0;
  win.booked = win.jobs && win.close && win.appt ? Math.ceil(win.jobs / (win.close / 100)) : 0;
  win.leads = !win.jobs || !win.close ? 0
    : win.appt ? Math.ceil(win.booked / (win.appt / 100))
    : Math.ceil(win.jobs / (win.close / 100));
  win.more = win.leads && now.leads ? win.leads - now.leads : 0;

  const typed = n(g.revNow);
  const today = typed || now.rev;
  const mismatch = !!(typed && now.rev && Math.abs(now.rev - typed) / typed > 0.1);
  // An edited rate on the goal row, as opposed to one still following Goals.
  const edited = ["winAppt", "winClose", "winTicket"].some((k, i) =>
    filled(s[k]) && n(s[k]) !== [now.appt, now.close, now.ticket][i]);

  return { now, win, today, goal, mismatch, edited };
}

const fmt = (x) => (x ? Number(x).toLocaleString("en-US") : "&mdash;");

function needLine(win, goal) {
  if (!win.leads) return "";
  return "To make " + money(goal) + " a month: <strong>" + fmt(win.leads) + " leads</strong> a month" +
    (win.more > 0 ? " &mdash; <strong>" + fmt(win.more) + " more</strong> than today."
      : win.more < 0 ? " &mdash; <strong>" + fmt(-win.more) + " fewer</strong> than today." : ".");
}

/** Where they are and where we're taking them, with the funnel behind both. */
function gapCard(ctx) {
  const { now, win, today, goal, mismatch, edited } = numbers(ctx);
  const s = ctx.state.m[ID] || {};
  const big = (v) => v ? money(v) + '<span class="per">/mo</span>' : "&mdash;";

  let gap = "";
  if (today && goal && goal > today) {
    gap = '<div class="nsgap"><span class="cond">+' + money(goal - today) + " a month</span> &middot; +" +
      Math.round(((goal - today) / today) * 100) + "% on today</div>";
  }

  const step = (v, label, sub) =>
    '<div class="nsstep"><div class="v">' + v + "</div>" +
      '<div class="l">' + label + "</div>" + (sub ? '<div class="s">' + sub + "</div>" : "") + "</div>";
  const op = (c) => '<div class="nsop" aria-hidden="true">' + c + "</div>";
  const live = (k, v) => '<span data-derived="' + ID + ":" + k + '">' + v + "</span>";
  const rate = (key, val, word) =>
    '<label class="nsrate"><input type="text" inputmode="decimal" data-f="' + ID + "|" + key + '" value="' +
      esc(filled(s[key]) ? s[key] : val || "") + '" aria-label="' + word + ' at goal">% ' + word + "</label>";

  const hasFunnel = now.leads || now.close || now.ticket;
  const rows = !hasFunnel ? "" :
    '<div class="nsfun">' +
      '<div class="mlabel">What your numbers add up to</div>' +
      '<div class="nssteps">' +
        step(fmt(now.leads), "Leads a month") + op("&rarr;") +
        step(fmt(now.booked), "Booked", now.appt ? now.appt + "% booking rate" : "") + op("&rarr;") +
        step(fmt(now.jobs), "Closed jobs", now.close ? now.close + "% close rate" : "") + op("&times;") +
        step(now.ticket ? money(now.ticket) : "&mdash;", "Average order") + op("=") +
        step(now.rev ? money(now.rev) : "&mdash;", "Revenue a month") +
      "</div>" +
      (mismatch
        ? '<div class="nsoff">These come to ' + money(now.rev) + " a month, but Goals has " + money(today) +
            ". One of the numbers on Goals is off &mdash; fix it there and both rows follow. " +
            '<button class="btn xs" data-go="goals">Open Goals</button></div>'
        : "") +
    "</div>" +
    (goal
      ? '<div class="nsfun win">' +
          '<div class="mlabel">What winning looks like</div>' +
          '<div class="nssteps">' +
            step(live("wLeads", fmt(win.leads)), "Leads a month") + op("&rarr;") +
            step(live("wBooked", fmt(win.booked)), "Booked", rate("winAppt", now.appt, "booking rate")) + op("&rarr;") +
            step(live("wJobs", fmt(win.jobs)), "Closed jobs", rate("winClose", now.close, "close rate")) + op("&times;") +
            step('<label class="nsorder">$<input type="text" inputmode="decimal" data-f="' + ID + '|winTicket" value="' +
              esc(filled(s.winTicket) ? s.winTicket : now.ticket || "") + '" aria-label="Average order at goal"></label>',
              "Average order") + op("=") +
            step(money(goal), "Revenue a month") +
          "</div>" +
          '<div class="nsneed">' + live("wNeed", needLine(win, goal)) + "</div>" +
          '<div class="nshint">Change the booking rate, close rate or average order to see the leads it takes.' +
            (edited
              ? ' <button class="nsreset" data-clear="' + ID + '|winAppt,winClose,winTicket">Back to today&rsquo;s numbers</button>'
              : "") +
          "</div>" +
        "</div>"
      : "");

  return (
    '<div class="dark nshero">' +
      '<div class="nsrev">' +
        '<div><div class="mlabel">Where you are</div><div class="nsbig">' + big(today) + "</div></div>" +
        '<div class="nsarrow" aria-hidden="true">' + ICON.next + "</div>" +
        '<div><div class="mlabel">Where we&rsquo;re taking you</div><div class="nsbig gold">' + big(goal) + "</div></div>" +
      "</div>" +
      gap +
      rows +
      (!today || !goal || !hasFunnel
        ? '<div style="margin-top:18px"><button class="btn xs" data-go="goals" style="color:var(--cream)">' +
            "Leads, rates, average order and the goal are on Goals</button></div>"
        : "") +
    "</div>"
  );
}

/** The intro cards that are switched on, with what's in each. */
function running(ctx) {
  const on = OFFER.filter((b) => !getField(ctx.state, "intro", b.key, false));
  if (!on.length) {
    return '<div style="margin-top:12px;font-size:15px;color:var(--muted)">Nothing is switched on in the intro cards.</div>';
  }
  return (
    '<div class="nsrun">' + on.map((b) =>
      '<div class="nsbucket"><div class="n">' + esc(b.name) + "</div>" +
        '<div class="w">' + b.items.map((it) => esc(it[0])).join(" &middot; ") + "</div></div>"
    ).join("") + "</div>"
  );
}

/** The top of each ranked list, so the client hears what goes first. */
function leading(ctx) {
  const list = (id) => {
    const m = ctx.modules.find((x) => x.id === id);
    if (!m || !m.summary || isSkipped(ctx.state, id)) return [];
    try {
      const sum = m.summary(ctx);
      return sum && sum.list && sum.list.items ? sum.list.items.slice(0, 3) : [];
    } catch (e) { return []; }
  };
  const svc = list("services");
  const loc = list("locations");
  if (!svc.length && !loc.length) return "";

  const col = (label, items) =>
    "<div><div class=\"mlabel\">" + label + "</div>" +
      (items.length
        ? '<ol class="olist">' + items.map((it) =>
            '<li><span class="k">' + it.n + '</span><span class="v">' + esc(it.name) + "</span></li>").join("") + "</ol>"
        : '<div style="margin-top:12px;font-size:14px;color:var(--muted)">Not ranked yet.</div>') +
    "</div>";

  return (
    '<div class="sumcols" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">' +
      col("Services we lead with", svc) + col("Cities we start in", loc) +
    "</div>"
  );
}

/** Every open item written for the client, from the screens before this one. */
function asksFromThem(ctx) {
  const asks = [];
  for (const m of ctx.modules) {
    if (m.id === ID) break;
    if (!m.summary || (m.skippable && isSkipped(ctx.state, m.id))) continue;
    try {
      const sum = m.summary(ctx);
      for (const o of (sum && sum.open) || []) if (o.ask && asks.indexOf(o.ask) < 0) asks.push(o.ask);
    } catch (e) { /* a broken screen must not take this one down */ }
  }
  if (!asks.length) return "";
  // Five is what can be said out loud at the end of a call; the rest are
  // in the readout and go out with the email.
  const more = asks.length - ASKS_SHOWN;
  return (
    '<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">' +
      '<div class="mlabel">What we need from you</div>' +
      '<ol class="asklist">' + asks.slice(0, ASKS_SHOWN).map((a) => '<li><span class="a">' + esc(a) + "</span></li>").join("") + "</ol>" +
      (more > 0
        ? '<div style="margin-top:8px;font-size:14px;color:var(--muted)">And ' + more + " more in the follow-up email.</div>"
        : "") +
    "</div>"
  );
}

function closer(ctx) {
  const c = ctx.state.m.company || {};
  const to = filled(c.contactEmail)
    ? (filled(c.contactName) ? esc(c.contactName) + " at " : "") + esc(c.contactEmail)
    : filled(c.contactName) ? esc(c.contactName) : "";
  return (
    '<div class="nsbye">' +
      "<h2>Have an <span class=\"volt\">amazing day.</span></h2>" +
      "<p>We&rsquo;ll follow up by email with everything from today: the plan, the next two weeks and the invite" +
        (to ? " &mdash; it goes to " + to : "") + ".</p>" +
    "</div>"
  );
}

/* ── formatting ───────────────────────────────────────── */

function prettyDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function prettyTime(hm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hm || ""));
  if (!m) return String(hm || "");
  const h = Number(m[1]);
  return (h % 12 || 12) + ":" + m[2] + (h < 12 ? " am" : " pm");
}
