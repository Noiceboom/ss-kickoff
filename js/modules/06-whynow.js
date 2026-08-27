// ============================================================
// 06 — Why now  (discovery only)
// ============================================================
//
// The three things a sales call needs that a kickoff doesn't: what made
// them pick up the phone, what is actually broken, and who has to say yes
// before anything happens.
//
// This screen carries NO help text. Not because it didn't need any, but
// because everything worth saying here is said out loud — and the person
// answering is reading the screen while they answer. A help string under
// "what's not working" that explains how to prise the answer out of them
// is the single worst thing that could be on this page.
//
// Every label is written to be read aloud, verbatim, to the person in the
// room. That is the test each one had to pass.

import { sectionHeadFor, skipRow, field, chipGroup, statusFor, filled } from "../ui.js";
import { isSkipped, slot } from "../state.js";

const ID = "whynow";

// The three that make this screen worth having. `costOfNothing`,
// `whoDecides` and `process` are bonus — real answers, but plenty of
// owners genuinely can't answer them in the first fifteen minutes.
const CORE = ["whyNow", "broken", "liveBy"];

// Deliberately vague at the top end. "This year sometime" is a real
// answer and a useful one; forcing it into a month invents precision.
const WHEN = [
  { value: "", label: "—" },
  { value: "now", label: "Yesterday" },
  { value: "30", label: "Within a month" },
  { value: "quarter", label: "This quarter" },
  { value: "halfyear", label: "Next six months" },
  { value: "looking", label: "Just looking for now" },
];

export default {
  id: ID,
  nav: "Why now",
  title: "Why now?",
  lede: "Before we talk about services or cities — what made today the day you took this call.",
  skippable: true,
  notePrompt:
    "How they told it, not just what they said. The pauses, the number they hesitated on, who they blamed.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">The short version</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "whyNow", "What made you take this call?", v("whyNow"), {
            type: "longtext", rows: 3,
            placeholder: "Phone's been quiet since spring. Last agency stopped returning calls.",
          }) +
          field(ID, "broken", "What's not working the way you want it to?", v("broken"), {
            type: "longtext", rows: 3,
            placeholder: "Leads come in but half of them are price shoppers. Nothing from Google unless we pay for it.",
          }) +
          field(ID, "costOfNothing", "If nothing changes, what does that cost you over the next year?", v("costOfNothing"), {
            type: "longtext", rows: 2,
            placeholder: "In their words — a number, a truck they can't add, a guy they'd have to let go.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">How this gets decided</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "So we bring the right thing to the next conversation, and don&rsquo;t waste yours." +
        "</div>" +
        '<div class="fields" style="margin-top:16px">' +
          field(ID, "whoDecides", "Besides you, who weighs in on a decision like this?", v("whoDecides"), {
            placeholder: "Just me · my wife · my ops manager",
          }) +
          field(ID, "process", "What does the process look like from here?", v("process"), {
            placeholder: "See a plan, sleep on it, decide by Friday",
          }) +
        "</div>" +
        chipGroup(ID, "liveBy", "When would you want this live?", s.liveBy, WHEN) +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };
    const when = WHEN.find((w) => w.value === s.liveBy);

    put("Why now", s.whyNow);
    put("What's not working", s.broken);
    put("Cost of standing still", s.costOfNothing);
    put("Who else decides", s.whoDecides);
    put("Process from here", s.process);
    put("Wants it live", when && when.value ? when.label : "");

    // These are the unknowns that stop an offer being priced, so they are
    // written as gaps rather than as scoring. There is no fit signal on
    // this document and there is not going to be one — see the readout.
    const open = [];
    if (!filled(s.whyNow) && !filled(s.broken)) {
      open.push({
        what: "Why now",
        detail: "No trigger and no stated problem — there is nothing to build an offer around yet",
      });
    }
    if (!filled(s.whoDecides)) {
      open.push({
        what: "Who else decides",
        detail: "Decision-makers unknown — a proposal can land in front of someone who has heard none of this",
        ask: "Let us know who else should see this before you decide.",
      });
    }
    if (!filled(s.liveBy)) {
      open.push({
        what: "Timeline",
        detail: "No date to work back from",
        ask: "Tell us roughly when you'd want this up and running.",
      });
    }
    if (s.liveBy === "looking") {
      open.push({
        what: "Timeline",
        detail: "Said they're just looking — this is a nurture, not a close",
      });
    }

    return { rows, open };
  },
};
