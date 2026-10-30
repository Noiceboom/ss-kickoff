// ============================================================
// 14 — Next steps
// ============================================================
//
// The last thing the client sees before the call ends. The AM walks it
// top to bottom: where you are, where we're taking you, what to expect
// next, when we talk next, goodbye.
//
// Most of it is read from other screens rather than asked again — the
// revenue numbers and funnel from Goals, the plan from the intro cards,
// what we need from them from every screen's open items. The only new
// answers are the goal-row rates, plus any edits to the plan and asks.
//
// Kickoff only. A sales call ends on a proposal, not a plan.

import { sectionHeadFor, rowGroup, warnBox, filled, money, esc, ICON } from "../ui.js";
import { getRows, getField, setField, isSkipped } from "../state.js";
import { OFFER } from "./00-intro.js";
import { bookRate } from "./02-goals.js";
import { BY_ID } from "../channels.js";

const ID = "nextsteps";

const ASKS_SHOWN = 5;

const CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/>' +
  '<path d="M16 2v4M8 2v4M3 10h18"/></svg>';

const ASK_COLS = [
  { key: "ask", label: "What we need", type: "longtext", placeholder: "Send us your logo and a few job photos" },
];

const PLAN_COLS = [
  { key: "what", label: "What happens", type: "longtext", placeholder: "We get access to everything you've got" },
  { key: "you", label: "From you", type: "longtext", placeholder: "Click the access link we send", width: "260px" },
];

/**
 * What to expect next, built from the intro cards so a client who didn't
 * buy SEO never hears about an SEO build. Edit the wording here to change
 * it for everyone; "Edit the plan" copies it into rows for one client.
 */
function standardPlan(ctx) {
  const on = (key) => !getField(ctx.state, "intro", key, false);
  const items = (key, skip) => {
    const b = OFFER.find((x) => x.key === key);
    const names = b.items.map((it) => it[0]).filter((n) => n !== skip);
    return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0] || "";
  };
  const others = items("noOrganic", "SEO");
  const plan = [
    { what: "We get access to everything you've got.", you: "Click the access link we send." },
    { what: "We build out your plan.", you: "" },
  ];
  if (on("noWebsite")) plan.push({ what: "We build out the website.", you: "" });
  if (on("noPaid")) plan.push({ what: "We build out your paid campaigns: " + items("noPaid") + ".", you: "" });
  if (on("noOrganic")) plan.push({ what: "We build out your SEO campaigns" + (others ? ", plus " + others : "") + ".", you: "" });
  plan.push({ what: "We get you launched.", you: "" });
  return plan;
}

/** The rows the AM edited for this client, else the standard plan. */
function planFor(ctx) {
  const rows = getRows(ctx.state, ID, "plan").filter((r) => r && (r.what || r.you));
  return { rows: rows.length ? rows : standardPlan(ctx), custom: rows.length > 0 };
}

export default {
  id: ID,
  nav: "Next steps",
  title: "Where we go from here.",
  lede: "Walk this top to bottom to close the call. Most of it fills itself in from the screens before.",
  skippable: false,
  notePrompt: "Anything they asked for before the next meeting, or anything to put in the follow-up email.",

  seeds: {
    plan: standardPlan,
    // what the AM sees is what gets frozen: the first five
    asks: (ctx) => autoAsks(ctx).slice(0, ASKS_SHOWN).map((ask) => ({ ask })),
  },

  render(ctx) {
    const edited = getRows(ctx.state, ID, "plan");

    return (
      sectionHeadFor(this, ctx) +
      gapCard(ctx) +
      channelCard(ctx) +

      '<div class="card">' +
        '<div class="mlabel">What to expect next</div>' +
        (edited.length
          ? '<div style="margin-top:14px">' +
              rowGroup(ID, "plan", PLAN_COLS, edited, { addLabel: "Add a step", empty: "Nothing planned yet." }) +
            "</div>" +
            '<div style="margin-top:10px"><button class="nsreset dark-on-light" data-clear="' + ID + '|plan">' +
              "Back to the standard plan</button></div>"
          : planList(standardPlan(ctx)) +
            '<div style="margin-top:14px"><button class="btn ghost sm" data-seedrows="' + ID + '|plan">' +
              "Edit the plan for this client</button></div>") +
        asksFromThem(ctx) +
      "</div>" +

      // A prompt, not a form: the meeting gets booked in the calendar
      // while everyone is still on the call.
      warnBox("<strong>Let&rsquo;s get our next meeting scheduled.</strong><br>" +
        "Pick a time now, while everyone&rsquo;s still here, and the invite goes out with the follow-up email.",
        CALENDAR) +

      closer(ctx)
    );
  },

  /**
   * The first number typed into the channel plan for a given goal pins
   * the whole plan as it stands, against that goal. From then on a goal
   * change refits the plan instead of leaving typed numbers stranded.
   */
  beforeField(ctx, key) {
    if (key.indexOf("need_") !== 0) return;
    const cp = channelPlan(ctx);
    if (!cp.target) return;
    const s = ctx.state.m[ID] || {};
    if (Number(s.needAt) === cp.target && cp.rows.every((r) => r.fixed || r.edited)) return;
    for (const r of cp.rows) if (!r.fixed) setField(ctx.state, ID, "need_" + r.id, String(r.need));
    setField(ctx.state, ID, "needAt", String(cp.target));
  },

  derive(ctx) {
    const { win, goal } = numbers(ctx);
    const out = {
      [ID + ":wLeads"]: fmt(win.leads),
      [ID + ":wBooked"]: fmt(win.booked),
      [ID + ":wJobs"]: fmt(win.jobs),
      [ID + ":wNeed"]: needLine(win, goal),
    };
    const cp = channelPlan(ctx);
    if (cp.target) {
      for (const r of cp.rows) {
        out[ID + ":chg_" + r.id] = change(r.need - r.now);
        out[ID + ":need_" + r.id] = needCell(r);
      }
      out[ID + ":chTotal"] = cnt(cp.planned);
      out[ID + ":chChg"] = change(cp.planned - cp.totalNow);
      out[ID + ":chGap"] = gapLine(cp);
    }
    return out;
  },

  status(ctx) {
    // Nothing here is a question: the screen is ready the moment it opens.
    return "done";
  },

  summary(ctx) {
    const rows = [];
    const put = (k, val) => { if (filled(val)) rows.push([k, val]); };

    const { win, goal } = numbers(ctx);
    if (win.leads) {
      put("To hit the goal", fmt(win.leads) + " leads a month for " + money(goal) + " a month, at " +
        (win.appt ? win.appt + "% booking, " : "") + win.close + "% close and a " + money(win.ticket) + " average order");
    }
    const cp = channelPlan(ctx);
    if (cp.rows.length) {
      put("Leads by channel, now → needed", cp.rows.map((r) =>
        r.label + " " + cnt(r.now) + (cp.target ? " → " + cnt(r.need) : "")).join("; "));
    }

    const asks = editedAsks(ctx);
    if (asks.length) put("What we need from you", asks.map((a, i) => (i + 1) + ". " + a).join("  "));

    const plan = planFor(ctx).rows;
    return {
      rows,
      table: { head: ["step", "what happens", "from you"], body: plan.map((r, i) => [String(i + 1), r.what || "", r.you || ""]) },
    };
  },
};

function planList(plan) {
  return (
    '<ol class="nsplan">' + plan.map((r, i) =>
      '<li><span class="k">' + (i + 1) + "</span><div>" +
        '<div class="w">' + esc(r.what) + "</div>" +
        (r.you ? '<div class="y">From you: ' + esc(r.you) + "</div>" : "") +
      "</div></li>"
    ).join("") + "</ol>"
  );
}

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
const cnt = (x) => Number(x || 0).toLocaleString("en-US");
const change = (d) => (d > 0 ? "+" + cnt(d) : d < 0 ? "&minus;" + cnt(-d) : "&mdash;");

/* ── what it's going to take ──────────────────────────── */

// What each line on the intro cards brings in as a lead channel, by the
// id Marketing now uses for it. Website, Designs and Hosting aren't lead
// channels; AEO has no Marketing-now tile, so it gets an id of its own.
const OURS = {
  "Google Ads": "google-ads",
  "Local Services Ads": "local-services-ads-lsa",
  "Meta": "meta-facebook-instagram",
  "SEO": "seo",
  "Google Business Profile": "google-business-profile-maps",
  "AEO": "aeo",
};
const EXTRA_LABELS = { aeo: "AI search (AEO)", untracked: "Not tracked by channel" };

/**
 * Leads by channel: today, from Marketing now, and what each needs to
 * bring for the goal row's lead number.
 *
 * Rows are the channels we're running (from the intro cards) and every
 * channel they run today. Leads Goals counts that no channel accounts
 * for get a row of their own, so the totals match Goals.
 *
 * The starting "needed" holds their own channels flat and splits the gap
 * evenly across ours. A number typed on screen never moves another named
 * channel: whatever the edits leave short of the goal lands on "Not
 * tracked by channel", so the total never drops below what the goal needs.
 *
 * Typed numbers belong to the goal they were typed against (needAt). When
 * the goal's lead number moves — a better close rate, a bigger ticket —
 * the plan is refitted: fewer leads come off "Not tracked" first, then off
 * every channel's increase in proportion; more leads go onto the
 * increases in proportion. No channel drops below what it brings today.
 */
function channelPlan(ctx) {
  const m = ctx.state.m.marketing || {};
  const s = ctx.state.m[ID] || {};
  const g = ctx.state.m.goals || {};
  const n = (v) => Number(String(v == null ? "" : v).replace(/[^0-9.]/g, "")) || 0;

  const ours = [];
  for (const b of OFFER) {
    if (getField(ctx.state, "intro", b.key, false)) continue;
    for (const it of b.items) { const id = OURS[it[0]]; if (id && ours.indexOf(id) < 0) ours.push(id); }
  }
  const running = (Array.isArray(m.chan) ? m.chan : []).filter((id) => BY_ID.has(id));
  const ids = ours.concat(running.filter((id) => ours.indexOf(id) < 0));

  const rows = ids.map((id) => ({
    id,
    label: BY_ID.has(id) ? BY_ID.get(id).label : EXTRA_LABELS[id] || id,
    ours: ours.indexOf(id) > -1,
    running: running.indexOf(id) > -1,
    now: n(m["vol_" + id]),
  }));
  const tracked = rows.reduce((a, r) => a + r.now, 0);
  const untracked = Math.max(0, n(g.leadsNow) - tracked);
  const totalNow = tracked + untracked;

  const goalLeads = numbers(ctx).win.leads || n(g.leadsTarget);
  // With a goal, the untracked row always shows: it's where a shortfall goes.
  if (untracked || (goalLeads && rows.length)) {
    rows.push({ id: "untracked", label: EXTRA_LABELS.untracked, ours: false, running: true, now: untracked, fixed: true });
  }
  const target = goalLeads;
  const typedFor = n(s.needAt);
  const anyEdit = rows.some((r) => !r.fixed && filled(s["need_" + r.id]));
  const from = anyEdit && typedFor ? typedFor : target;

  // the plan as it stood for the goal the numbers were typed against
  const gap = Math.max(0, from - totalNow);
  const share = rows.filter((r) => r.ours);
  rows.forEach((r) => { r.base = r.now; });
  if (share.length && gap) {
    const each = Math.floor(gap / share.length);
    let extra = gap - each * share.length;
    for (const r of share) { r.base = r.now + each + (extra > 0 ? 1 : 0); extra--; }
  }
  let edited = false;
  for (const r of rows) {
    const k = "need_" + r.id;
    r.edited = !r.fixed && filled(s[k]);
    if (r.edited) edited = true;
    r.need = r.edited ? n(s[k]) : r.base;
  }
  const fixed = rows.find((r) => r.fixed);
  if (fixed && from) {
    const named = rows.reduce((a, r) => a + (r.fixed ? 0 : r.need), 0);
    fixed.need = Math.max(fixed.now, from - named);
  }

  // refit to the goal as it is now
  const was = anyEdit && typedFor ? typedFor : rows.reduce((a, r) => a + r.need, 0);
  if (target && target !== was) refit(rows, target - was, share);

  const short = fixed && target ? fixed.need - fixed.now : 0;
  const planned = rows.reduce((a, r) => a + r.need, 0);
  return { rows, totalNow, target, planned, edited, short, ours: share.length };
}

/** Whole numbers in proportion to `weights` that add up to exactly `total`. */
function apportion(weights, total) {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w * total) / sum);
  const out = exact.map(Math.floor);
  let left = Math.round(total) - out.reduce((a, v) => a + v, 0);
  exact.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}

/** Moves the plan by `delta` leads a month, the way channelPlan describes. */
function refit(rows, delta, ours) {
  const fixed = rows.find((r) => r.fixed);
  const named = rows.filter((r) => !r.fixed);
  const lift = named.map((r) => Math.max(0, r.need - r.now));
  const lifted = lift.reduce((a, v) => a + v, 0);
  const set = (list, adds) => list.forEach((r, i) => { r.need = r.now + adds[i]; });

  if (delta < 0) {
    let cut = -delta;
    if (fixed) {
      const take = Math.min(cut, fixed.need - fixed.now);
      fixed.need -= take;
      cut -= take;
    }
    if (cut > 0 && lifted) set(named, apportion(lift, Math.max(0, lifted - cut)));
  } else if (lifted) {
    set(named, apportion(lift, lifted + delta));
  } else if (ours.length) {
    const adds = apportion(ours.map(() => 1), delta);
    ours.forEach((r, i) => { r.need += adds[i]; });
  } else if (fixed) {
    fixed.need += delta;
  }
}

function gapLine(cp) {
  if (cp.short > 0) {
    return "<strong>" + cnt(cp.short) + " leads</strong> a month aren&rsquo;t on a channel yet, so they sit under " +
      "&ldquo;" + EXTRA_LABELS.untracked + "&rdquo;.";
  }
  const left = cp.target - cp.planned;
  if (left > 0) return "Still <strong>" + cnt(left) + " leads</strong> a month to find &mdash; put them on a channel.";
  if (left < 0) return "That plans <strong>" + cnt(-left) + " more</strong> than the " + cnt(cp.target) + " a month the goal needs.";
  return "That adds up to the <strong>" + cnt(cp.target) + " leads</strong> a month the goal needs.";
}

/** A channel's "leads needed": typeable, except the untracked row. */
function needCell(r) {
  return r.fixed ? cnt(r.need)
    : '<input type="text" inputmode="numeric" class="nsin" data-f="' + ID + "|need_" + esc(r.id) +
        '" value="' + r.need + '" aria-label="Leads needed from ' + esc(r.label) + '">';
}

function channelCard(ctx) {
  const cp = channelPlan(ctx);
  if (!cp.rows.length) return "";
  const live = (k, v) => '<span data-derived="' + ID + ":" + k + '">' + v + "</span>";
  const tag = (r) => r.ours
    ? '<span class="nstag' + (r.running ? "" : " new") + '">' + (r.running ? "Ours" : "New") + "</span>"
    : "";

  const body = cp.rows.map((r) =>
    "<tr>" +
      '<th scope="row">' + esc(r.label) + tag(r) + "</th>" +
      "<td>" + cnt(r.now) + "</td>" +
      (cp.target
        ? "<td>" + live("need_" + r.id, needCell(r)) + "</td>" +
          '<td class="chg">' + live("chg_" + r.id, change(r.need - r.now)) + "</td>"
        : "") +
    "</tr>"
  ).join("");

  return (
    '<div class="card">' +
      '<div class="mlabel">What it&rsquo;s going to take</div>' +
      '<p style="margin:8px 0 0;font-size:15px;color:var(--green-text)">' +
        "Where the leads come from today, and where they need to come from to hit the goal." +
      "</p>" +
      '<div style="overflow-x:auto;margin-top:16px"><table class="nschan">' +
        "<thead><tr><th>Channel</th><th>Leads now</th>" +
          (cp.target ? "<th>Leads needed</th><th>Change</th>" : "") + "</tr></thead>" +
        "<tbody>" + body + "</tbody>" +
        '<tfoot><tr><th scope="row">Total a month</th><td>' + cnt(cp.totalNow) + "</td>" +
          (cp.target ? "<td>" + live("chTotal", cnt(cp.planned)) + '</td><td class="chg">' +
            live("chChg", change(cp.planned - cp.totalNow)) + "</td>" : "") +
        "</tr></tfoot>" +
      "</table></div>" +
      (cp.target
        ? '<div class="nschgap">' + live("chGap", gapLine(cp)) + "</div>" +
          '<div class="nshint" style="color:var(--muted)">' +
            (cp.ours ? "Starts with their own channels flat and the gap spread across ours. " : "") +
            "Change any number." +
            (cp.edited
              ? ' <button class="nsreset dark-on-light" data-clear="' + ID + "|" +
                  cp.rows.filter((r) => !r.fixed).map((r) => "need_" + r.id).concat("needAt").join(",") +
                  '">Back to the starting split</button>'
              : "") +
          "</div>"
        : '<div class="nshint" style="color:var(--muted);margin-top:12px">Set the goal and the funnel on Goals to see the leads each channel needs to bring.</div>') +
    "</div>"
  );
}

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

/** Every open item written for the client, from the screens before this one. */
function autoAsks(ctx) {
  const asks = [];
  for (const m of ctx.modules) {
    if (m.id === ID) break;
    if (!m.summary || (m.skippable && isSkipped(ctx.state, m.id))) continue;
    try {
      const sum = m.summary(ctx);
      for (const o of (sum && sum.open) || []) if (o.ask && asks.indexOf(o.ask) < 0) asks.push(o.ask);
    } catch (e) { /* a broken screen must not take this one down */ }
  }
  return asks;
}

/** The asks the AM edited for this client, if any. */
function editedAsks(ctx) {
  return getRows(ctx.state, ID, "asks").map((r) => String((r && r.ask) || "").trim()).filter(Boolean);
}

/**
 * What we need from them. Until the AM touches it, it follows the open
 * items on every earlier screen, so an answer given later drops off it.
 * "Edit these" or "Add one" freezes it into rows for this client.
 */
function asksFromThem(ctx) {
  const rows = getRows(ctx.state, ID, "asks");
  const head = '<div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--line)">' +
    '<div class="mlabel">What we need from you</div>';

  if (rows.length) {
    return head +
      '<div style="margin-top:14px">' +
        rowGroup(ID, "asks", ASK_COLS, rows, { addLabel: "Add one", empty: "Nothing on the list." }) +
      "</div>" +
      '<div style="margin-top:10px"><button class="nsreset dark-on-light" data-clear="' + ID + '|asks">' +
        "Back to the automatic list</button></div>" +
    "</div>";
  }

  const asks = autoAsks(ctx);
  // Five is what can be said out loud at the end of a call; the rest are
  // in the readout and go out with the email.
  const more = asks.length - ASKS_SHOWN;
  return head +
    (asks.length
      ? '<ol class="asklist">' + asks.slice(0, ASKS_SHOWN).map((a) => '<li><span class="a">' + esc(a) + "</span></li>").join("") + "</ol>"
      : '<div style="margin-top:12px;font-size:15px;color:var(--muted)">Nothing outstanding from the earlier screens.</div>') +
    (more > 0
      ? '<div style="margin-top:8px;font-size:14px;color:var(--muted)">And ' + more + " more in the follow-up email.</div>"
      : "") +
    '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
      (asks.length ? '<button class="btn ghost sm" data-seedrows="' + ID + '|asks">Edit these</button>' : "") +
      '<button class="btn ghost sm" data-seedrows="' + ID + '|asks|add">' + ICON.plus + " Add one</button>" +
    "</div>" +
  "</div>";
}

function closer(ctx) {
  const c = ctx.state.m.company || {};
  const to = filled(c.contactEmail)
    ? (filled(c.contactName) ? esc(c.contactName) + " at " : "") + esc(c.contactEmail)
    : filled(c.contactName) ? esc(c.contactName) : "";
  return (
    '<div class="nsbye">' +
      "<h2>Have an <span class=\"volt\">amazing day.</span></h2>" +
      "<p>We&rsquo;ll follow up by email with everything from today: the plan, what happens next and the meeting invite" +
        (to ? " &mdash; it goes to " + to : "") + ".</p>" +
    "</div>"
  );
}
