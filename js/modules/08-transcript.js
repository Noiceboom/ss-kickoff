// ============================================================
// 08 — The recording
// ============================================================
//
// This page has no way to call a model. It is static files served from
// GitHub Pages with `connect-src 'self'`, so "upload a transcript and
// watch the answers fill in" is not a thing it can do, and pretending
// otherwise would produce a screen that quietly did nothing.
//
// So the work is split. The recording is read here, deterministically —
// who spoke, how long, how many turns. The judgement happens in Claude,
// outside, against a schema this file publishes, and comes back as a
// read-out that lands as PROPOSALS.
//
// Proposals never write themselves in. A machine's account of what it
// thought it heard does not get to overwrite a number somebody typed, and
// on a discovery call the prospect is watching the screen while it
// happens. Every value is shown next to what is already there, and
// applied by hand.

import {
  sectionHead, skipRow, upload, statusFor, filled, esc, ICON,
} from "../ui.js";
import { isSkipped, slot } from "../state.js";
import { humanSize, MAX_MB } from "../assets.js";
import { EXTRACT_SCHEMA } from "../transcript.js";
import { sayer, DISCOVERY } from "../modes.js";

const ID = "transcript";

const COPY = {
  lede: {
    kickoff:
      "Drop in the recording, then paste the read-out. Nothing it says is written in " +
      "until you say so.",
    discovery:
      "Drop in the recording, then paste the read-out. Nothing it says is written in " +
      "until you say so.",
  },
  recHelp: {
    kickoff: "The JSON export from Fireflies. Stays on this machine — it does not travel with the share link.",
    discovery: "The JSON export from Fireflies. Stays on this machine — it does not travel with the share link.",
  },
};

/** The prompt that turns a recording into something this screen can read. */
export function extractPrompt(mods) {
  return [
    "You are reading a transcript of a sales or kickoff call for Service Scalers,",
    "a marketing agency for home-services businesses. Return ONLY JSON, no prose.",
    "",
    "Shape:",
    "{",
    '  "schema": "' + EXTRACT_SCHEMA + '",',
    '  "call": { "title": "", "date": "YYYY-MM-DD", "durationMin": 0, "participants": [] },',
    '  "fields": { "<screen>": { "<key>": "value" } },',
    '  "quotes": [ { "speaker": "", "at": "12:31", "text": "", "module": "<screen>" } ],',
    '  "services": [], "cities": [], "unclear": []',
    "}",
    "",
    "Rules:",
    "- Only fill a field the client actually answered. Omit it otherwise — a guess",
    "  costs more to unpick than a blank costs to fill in.",
    "- Numbers as digits with no symbols: 120000, not \"$120k\".",
    "- Quotes verbatim, and short. They are evidence, not summary.",
    "- `unclear` is for anything asked but not really answered.",
    "- `services` and `cities` are things they said they do or cover, by name.",
    "  Those two screens are not in the list below on purpose — their keys are",
    "  generated per item, so names are what can be matched up by hand.",
    "",
    "Screens and keys available:",
    mods,
  ].join("\n");
}

// Screens whose answers are per-item, not per-field. Their state keys are
// generated from ids — prio_emergency, rate_google-ads — and naming those
// in the prompt invites an extraction to guess at ids it cannot know.
// What they sell and where they work comes back as names instead, in
// `services` and `cities`, and gets ticked by hand.
const BY_ITEM = new Set([ID, "readout", "services", "locations"]);
const PER_ITEM_KEY = /^(prio_|rate_|vol_|note_|status_|owner_|how_)/;

/**
 * Every field key each screen owns, harvested from what it renders.
 *
 * Read off the markup rather than declared on the modules, because a
 * declaration is a second copy of the truth and this one has to be right:
 * a prompt naming keys that do not exist produces a read-out where
 * nothing maps, and the failure looks like "the extraction was bad"
 * rather than "the prompt was wrong".
 */
function keyMap(ctx) {
  const out = [];
  for (const m of ctx.modules) {
    if (BY_ITEM.has(m.id)) continue;

    let html = "";
    try { html = m.render({ ...ctx, num: "00" }); } catch (e) { continue; }

    const fields = [];
    const chips = new Map();
    for (const hit of html.matchAll(/data-f="([a-z]+)\|([A-Za-z0-9_]+)"/g)) {
      if (hit[1] === m.id && !PER_ITEM_KEY.test(hit[2]) && fields.indexOf(hit[2]) < 0) fields.push(hit[2]);
    }
    for (const hit of html.matchAll(/data-(?:chip|status)="([a-z]+)\|([A-Za-z0-9_]+)\|([^"]*)"/g)) {
      if (hit[1] !== m.id || PER_ITEM_KEY.test(hit[2])) continue;
      if (!chips.has(hit[2])) chips.set(hit[2], []);
      const vals = chips.get(hit[2]);
      if (hit[3] && vals.indexOf(hit[3]) < 0) vals.push(hit[3]);
    }

    const parts = fields.slice();
    for (const [k, vals] of chips) parts.push(k + " (one of: " + vals.join(" | ") + ")");
    if (parts.length) out.push("  " + m.id + " — " + parts.join(", "));
  }
  return out.join("\n");
}

function recCard(ctx, s, t) {
  const sum = s.recSummary;
  const files = ctx.transient[ID] || {};
  return (
    '<div class="card">' +
      '<div class="mlabel">The recording</div>' +
      '<div class="fields one" style="margin-top:16px">' +
        upload(ID, "rec", "Fireflies transcript JSON", s.rec, {
          accept: ".json,application/json",
          cta: "Choose the transcript file",
          hint: "Fireflies JSON export · up to " + MAX_MB + "MB",
          sizeLabel: s.rec ? humanSize(s.rec.size) : "",
          help: t("recHelp"),
        }) +
      "</div>" +
      (sum
        ? '<div class="dl" style="margin-top:18px"><dl class="dl">' +
            (sum.title ? "<dt>Call</dt><dd>" + esc(sum.title) + "</dd>" : "") +
            (sum.date ? "<dt>Date</dt><dd>" + esc(sum.date) + "</dd>" : "") +
            (sum.durationMin ? "<dt>Length</dt><dd>" + esc(sum.durationMin) + " min</dd>" : "") +
            "<dt>Turns</dt><dd>" + esc(String(sum.turns)) + "</dd>" +
            (sum.speakers && sum.speakers.length
              ? "<dt>Speakers</dt><dd>" + esc(sum.speakers.map((x) => x.name).join(", ")) + "</dd>"
              : "") +
            (sum.talkShare && sum.talkShare.length
              ? "<dt>Talk share</dt><dd>" +
                esc(sum.talkShare.map((x) => x.name + " " + x.pct + "%").join(" · ")) + "</dd>"
              : "") +
          "</dl></div>"
        : "") +
    "</div>"
  );
}

function promptCard(ctx, s) {
  const prompt = extractPrompt(keyMap(ctx));
  return (
    '<div class="card">' +
      '<div class="mlabel">Turn it into answers</div>' +
      '<div style="font-size:14px;color:var(--muted);margin-top:6px;line-height:1.55">' +
        "This page can&rsquo;t read a transcript for meaning &mdash; it has no way to call a " +
        "model. Copy the prompt, give it to Claude along with the transcript, and bring back " +
        "the JSON it returns." +
      "</div>" +
      '<div class="linkrow" style="align-items:flex-start">' +
        "<code>" + esc(prompt.slice(0, 190)) + "&hellip;</code>" +
        '<button class="btn sm" data-copy="' + esc(prompt) + '">Copy prompt</button>' +
      "</div>" +
      '<div class="fields one" style="margin-top:20px">' +
        upload(ID, "extract", "The read-out", s.extractFile, {
          accept: ".json,application/json",
          cta: "Choose the read-out JSON",
          hint: EXTRACT_SCHEMA,
          sizeLabel: s.extractFile ? humanSize(s.extractFile.size) : "",
        }) +
      "</div>" +
    "</div>"
  );
}

function proposalRows(ctx, s) {
  const ex = s.extract;
  if (!ex || !ex.proposals.length) return "";
  const applied = Array.isArray(s.applied) ? s.applied : [];
  const nav = new Map(ctx.modules.map((m) => [m.id, m.nav]));

  const rows = ex.proposals.map((p) => {
    const tag = p.mod + "." + p.key;
    const now = (ctx.state.m[p.mod] || {})[p.key];
    const done = applied.indexOf(tag) > -1;
    const clash = filled(now) && String(now) !== p.value;
    return (
      '<div class="prow' + (done ? " done" : "") + '">' +
        '<div class="pwhere">' + esc(nav.get(p.mod) || p.mod) + " &middot; " + esc(p.key) + "</div>" +
        '<div class="pval">' + esc(p.value) + "</div>" +
        (clash
          ? '<div class="pnow">on screen now: <strong>' + esc(String(now)) + "</strong></div>"
          : "") +
        '<div class="pact">' +
          (done
            ? '<span class="badge b-ok">Used</span>'
            : '<button class="btn xs" data-useprop="' + esc(tag) + '">' +
              (clash ? "Replace" : "Use it") + "</button>") +
        "</div>" +
      "</div>"
    );
  }).join("");

  const blanks = ex.proposals.filter((p) =>
    applied.indexOf(p.mod + "." + p.key) < 0 && !filled((ctx.state.m[p.mod] || {})[p.key])).length;

  return (
    '<div class="card">' +
      '<div class="mlabel">What it heard (' + ex.proposals.length + ")</div>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
        "Nothing here is written in yet. Anything that disagrees with what&rsquo;s already " +
        "on screen says so." +
      "</div>" +
      (blanks
        ? '<div style="margin-top:16px"><button class="btn sm" data-useprop="*blank">' +
          "Fill the " + blanks + " blank field" + (blanks > 1 ? "s" : "") + "</button></div>"
        : "") +
      '<div class="plist">' + rows + "</div>" +
    "</div>"
  );
}

function quoteCard(s) {
  const ex = s.extract;
  if (!ex || !ex.quotes.length) return "";
  const ok = Array.isArray(s.approved) ? s.approved : [];
  return (
    '<div class="card">' +
      '<div class="mlabel">Their own words (' + ex.quotes.length + ")</div>" +
      '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
        "These stay internal until you tick one. Ticked quotes are the only ones that reach " +
        "the document you send." +
      "</div>" +
      ex.quotes.map((q) =>
        '<div class="quo' + (ok.indexOf(q.id) > -1 ? " on" : "") + '">' +
          '<button class="quotick" data-quote="' + esc(q.id) + '">' + ICON.check + "</button>" +
          "<div><div class=\"qtext\">&ldquo;" + esc(q.text) + "&rdquo;</div>" +
          '<div class="qwho">' + esc([q.speaker, q.at].filter(Boolean).join(" &middot; ")) + "</div></div>" +
        "</div>"
      ).join("") +
    "</div>"
  );
}

function loose(s) {
  const ex = s.extract;
  if (!ex) return "";
  const bits = [];
  const list = (label, items, note) => {
    if (!items.length) return "";
    return '<div style="margin-top:18px"><div class="mlabel">' + esc(label) + "</div>" +
      '<div style="font-size:15px;margin-top:8px;line-height:1.6">' + esc(items.join(" · ")) + "</div>" +
      (note ? '<div style="font-size:13px;color:var(--muted);margin-top:6px">' + note + "</div>" : "") +
      "</div>";
  };
  bits.push(list("Services mentioned", ex.mentionedServices,
    "Not ticked for you &mdash; names don&rsquo;t map to service ids reliably enough to do that silently. Check them on the Services screen."));
  bits.push(list("Cities mentioned", ex.mentionedCities,
    "Same &mdash; add them on the Cities screen."));
  bits.push(list("Asked but not really answered", ex.unclear, ""));
  const body = bits.filter(Boolean).join("");
  return body ? '<div class="card">' + body + "</div>" : "";
}

export default {
  id: ID,
  nav: "Recording",
  title: "What was actually said",
  lede: COPY.lede.kickoff,
  discovery: { lede: COPY.lede.discovery },
  skippable: true,
  notePrompt: "Anything the recording missed, or got wrong.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const t = sayer(COPY, ctx.mode);
    return (
      sectionHead(ctx.num, this.title, ctx.mode === DISCOVERY ? COPY.lede.discovery : COPY.lede.kickoff) +
      skipRow(ID, isSkipped(ctx.state, ID)) +
      recCard(ctx, s, t) +
      promptCard(ctx, s) +
      proposalRows(ctx, s) +
      quoteCard(s) +
      loose(s)
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], ["rec"]); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!s.recSummary && !s.extract) return null;

    const rows = [];
    const put = (k, v) => { if (filled(v)) rows.push([k, v]); };
    const sum = s.recSummary;
    if (sum) {
      put("Call", sum.title);
      put("Recorded", sum.date);
      put("Length", sum.durationMin ? sum.durationMin + " min" : "");
      put("Speakers", (sum.speakers || []).map((x) => x.name).join(", "));
      put("Talk share", (sum.talkShare || []).map((x) => x.name + " " + x.pct + "%").join(" · "));
    }

    const open = [];
    const ex = s.extract;
    if (ex) {
      const applied = Array.isArray(s.applied) ? s.applied : [];
      const unused = ex.proposals.filter((p) => applied.indexOf(p.mod + "." + p.key) < 0).length;
      if (unused) {
        open.push({
          what: "Read-out not fully applied",
          detail: unused + " answer" + (unused > 1 ? "s" : "") + " from the recording were never used.",
        });
      }
      for (const u of ex.unclear) open.push({ what: "Unanswered on the call", detail: u });
    }

    return { rows, open };
  },
};
