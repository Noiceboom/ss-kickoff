// ============================================================
// 04 — Competitors
// ============================================================
//
// The roster goes out as a `table` so it lands in the CSV verbatim —
// that list gets handed straight to whoever runs the SERP pass. The
// three free-text answers underneath are the ones that actually move
// the copy; the grid on its own is just names.

import { sectionHead, skipRow, field, rowGroup, statusFor, filled } from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "competitors";

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
  lede: "Names and domains, not a feeling. Every one of these gets looked up after the call — what they rank for, what they're bidding on, where the hole is.",
  skippable: true,

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHead("04", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">The roster</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Three or four real ones beat a list of ten. If they name someone, get the domain " +
          "&mdash; two shops in one metro share a name more often than you'd think." +
        "</div>" +
        '<div class="fields one" style="margin-top:16px">' +
          rowGroup(ID, "rows", COLS, getRows(ctx.state, ID, "rows"), {
            empty: "Nobody named yet. Easiest way in: who did you lose the last big job to?",
            addLabel: "Add competitor",
            help: "Threat level is their read, not ours. It decides who we benchmark against first.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Where the work is going</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "losesTo", "Who do you lose jobs to most often?", v("losesTo"), {
            type: "longtext", rows: 3,
            placeholder: "Mostly the two big franchises on brand search. Below $400 it's whoever the homeowner's neighbour used.",
            help: "Not the same question as who they respect. Ask about the last five jobs that got away.",
          }) +
          field(ID, "cantMatch", "What do they do that you can't or won't match?", v("cantMatch"), {
            type: "longtext", rows: 3,
            placeholder: "Same-day everything, and they'll eat the trip charge. We won't run techs that thin.",
            help: "Both halves matter. Can't is a gap to work around; won't is a positioning line we can lean on.",
          }) +
          field(ID, "takeShare", "Anyone you specifically want to take share from?", v("takeShare"), {
            type: "longtext", rows: 3,
            placeholder: "Anchor. They took two of our commercial accounts last year and I'd like them back.",
            help: "If there's a name here, it changes what we build first.",
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
