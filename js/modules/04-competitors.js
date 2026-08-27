// ============================================================
// 04 — Competitors
// ============================================================
//
// The roster goes out as a `table` so it lands in the CSV verbatim —
// that list gets handed straight to whoever runs the SERP pass. The
// three free-text answers underneath are the ones that actually move
// the copy; the grid on its own is just names.

import { sectionHeadFor, skipRow, field, rowGroup, statusFor, filled } from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";
import { sayer } from "../modes.js";

const ID = "competitors";

/* ── copy ─────────────────────────────────────────────── */
//
// This screen asks a business owner to name the people beating them,
// which is not a comfortable question, and the kickoff help makes it
// worse by narrating the tactic — "ask about the last five jobs that got
// away", "a positioning line we can lean on". Fine in a note to self.
// Read off a shared screen it sounds like being worked.

export const COPY = {
  lede: {
    kickoff: "Names and domains, not a feeling. Every one of these gets looked up after the call — what they rank for, what they're bidding on, where the hole is.",
    discovery: "Names and domains, not a feeling. We look every one of these up after the call — what they rank for, what they're bidding on, and where the gap is.",
  },
  rosterLede: {
    kickoff: "Three or four real ones beat a list of ten. If they name someone, get the domain &mdash; two shops in one metro share a name more often than you'd think.",
    discovery: "Three or four real ones beat a list of ten. The domain matters &mdash; two shops in one metro share a name more often than you'd think.",
  },
  rosterEmpty: {
    kickoff: "Nobody named yet. Easiest way in: who did you lose the last big job to?",
    discovery: "Nobody named yet. Easiest way in: who did you lose the last big job to?",
    same: true,
  },
  roster: {
    kickoff: "Threat level is their read, not ours. It decides who we benchmark against first.",
    discovery: "Threat level is your call, not ours — it decides who we look at first.",
  },
  losesTo: {
    kickoff: "Not the same question as who they respect. Ask about the last five jobs that got away.",
    discovery: "Not the same question as who you respect. Think about the last five jobs that got away.",
  },
  cantMatch: {
    kickoff: "Both halves matter. Can't is a gap to work around; won't is a positioning line we can lean on.",
    discovery: "Both halves matter. Can't is something to work around; won't is a decision, and we'd build around it rather than argue with it.",
  },
  takeShare: {
    kickoff: "If there's a name here, it changes what we build first.",
    discovery: "If there's a name here, it changes what we build first.",
    same: true,
  },
};

// Keys that count toward "done". A roster with no story behind it isn't an answer.
const CORE = ["rows", "losesTo", "cantMatch"];

const THREAT = [
  { value: "", label: "—" },
  { value: "biggest", label: "Biggest threat" },
  { value: "real", label: "Real" },
  { value: "watching", label: "Watching" },
  { value: "none", label: "Not worried" },
];

const COLS = [
  { key: "name", label: "Competitor", width: "1.1fr", placeholder: "Anchor Plumbing" },
  { key: "domain", label: "Domain", width: "1fr", placeholder: "anchorplumbing.com" },
  { key: "why", label: "Why they win", width: "1.7fr", placeholder: "Owns the map pack in the north suburbs" },
  { key: "threat", label: "Threat", width: "165px", type: "select", options: THREAT },
];

const threatLabel = (v) => {
  const hit = THREAT.find((t) => t.value === v);
  return hit && hit.value ? hit.label : "";
};

export default {
  id: ID,
  nav: "Competitors",
  title: "Who keeps taking the jobs you wanted?",
  lede: COPY.lede.kickoff,
  skippable: true,
  notePrompt:
    "Who they named, what they said about them, anything they got heated about.",

  discovery: {
    lede: COPY.lede.discovery,
    notePrompt: "Anything about the competitive picture worth keeping.",
  },

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");
    const t = sayer(COPY, ctx.mode);

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">The roster</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          t("rosterLede") +
        "</div>" +
        '<div class="fields one" style="margin-top:16px">' +
          rowGroup(ID, "rows", COLS, getRows(ctx.state, ID, "rows"), {
            empty: t("rosterEmpty"),
            addLabel: "Add competitor",
            help: t("roster"),
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Where the work is going</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "losesTo", "Who do you lose jobs to most often?", v("losesTo"), {
            type: "longtext", rows: 3,
            placeholder: "Mostly the two big franchises on brand search. Below $400 it's whoever the homeowner's neighbour used.",
            help: t("losesTo"),
          }) +
          field(ID, "cantMatch", "What do they do that you can't or won't match?", v("cantMatch"), {
            type: "longtext", rows: 3,
            placeholder: "Same-day everything, and they'll eat the trip charge. We won't run techs that thin.",
            help: t("cantMatch"),
          }) +
          field(ID, "takeShare", "Anyone you specifically want to take share from?", v("takeShare"), {
            type: "longtext", rows: 3,
            placeholder: "Anchor. They took two of our commercial accounts last year and I'd like them back.",
            help: t("takeShare"),
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    const all = Array.isArray(s.rows) ? s.rows : [];
    // A row with only a threat level set isn't a competitor, it's a stray click.
    const named = all.filter((r) => filled(r.name) || filled(r.domain));
    const touched = named.length || filled(s.losesTo) || filled(s.cantMatch) || filled(s.takeShare);
    if (!touched) return null;

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    const biggest = named.filter((r) => r.threat === "biggest").map((r) => r.name || r.domain);

    put("Named", named.length ? named.length + (named.length === 1 ? " competitor" : " competitors") : "");
    put("Biggest threat", biggest.join(", "));
    put("Losing jobs to", s.losesTo);
    put("Can't or won't match", s.cantMatch);
    put("Wants share back from", s.takeShare);

    const open = [];
    if (!named.length) {
      open.push({
        what: "No competitors named",
        detail: "Either they couldn't name one or we ran past it. Pull the top three out of the local pack and the paid results before the strategy call — this can't stay blank.",
      });
    }

    const out = { rows, open };
    if (named.length) {
      out.table = {
        head: ["Competitor", "Domain", "Why they win", "Threat"],
        body: named.map((r) => [r.name || "", r.domain || "", r.why || "", threatLabel(r.threat)]),
      };
    }
    return out;
  },
};
