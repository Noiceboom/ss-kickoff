// ============================================================
// transcript.js — reading a recorded call
// ============================================================
//
// Two different files arrive here and they do different jobs.
//
//   THE RECORDING   Fireflies' own JSON. Read deterministically: who
//                   spoke, for how long, how many turns. No inference,
//                   because none is possible without a model and this
//                   page has no way to call one — it is static files with
//                   `connect-src 'self'`.
//
//   THE READ-OUT    A Claude extraction of that recording, in the schema
//                   below. This is what carries answers, and it arrives
//                   already structured precisely because the page cannot
//                   do the extracting itself.
//
// Nothing here writes to state. Everything is proposed, reviewed on
// screen and applied by hand. A transcript is a machine's account of what
// it thought it heard; letting it overwrite a number somebody typed would
// be trusting it further than it has earned.

export const EXTRACT_SCHEMA = "ss-extract/1";

/* ── the recording ────────────────────────────────────── */

/** Fireflies has shipped these shapes; find the turns wherever they are. */
function sentencesIn(raw) {
  const paths = [
    (o) => o.sentences,
    (o) => o.transcript && o.transcript.sentences,
    (o) => o.data && o.data.transcript && o.data.transcript.sentences,
    (o) => o.data && o.data.sentences,
  ];
  for (const at of paths) {
    let v = null;
    try { v = at(raw); } catch (e) { /* ignore */ }
    if (Array.isArray(v) && v.length) return v;
  }
  return null;
}

function head(raw) {
  return (raw && raw.transcript) || (raw && raw.data && raw.data.transcript) || raw || {};
}

function clock(seconds) {
  const n = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(n / 60);
  return m + ":" + String(n % 60).padStart(2, "0");
}

/**
 * Read a Fireflies transcript into a summary small enough to live in
 * state. The bytes stay in IndexedDB; this is what the readout shows and
 * the export carries.
 *
 * @throws when it isn't a transcript this can read — loudly, because a
 *   silent empty import reads as "the file was fine and had nothing in it".
 */
export function readTranscript(raw) {
  if (!raw || typeof raw !== "object") throw new Error("That file isn't JSON this can read.");
  const sentences = sentencesIn(raw);
  if (!sentences) {
    throw new Error(
      "No transcript turns in that file. Fireflies exports an array of sentences — " +
      "if this came from somewhere else, it needs a different reader."
    );
  }

  const h = head(raw);
  const bySpeaker = new Map();
  let last = 0;

  for (const s of sentences) {
    if (!s || typeof s !== "object") continue;
    const who = String(s.speaker_name || s.speaker || s.speakerName || "Unknown").trim() || "Unknown";
    const text = String(s.text || s.raw_text || "").trim();
    const end = Number(s.end_time != null ? s.end_time : s.endTime) || 0;
    if (end > last) last = end;
    const row = bySpeaker.get(who) || { name: who, turns: 0, words: 0 };
    row.turns += 1;
    row.words += text ? text.split(/\s+/).length : 0;
    bySpeaker.set(who, row);
  }

  const speakers = [...bySpeaker.values()].sort((a, b) => b.words - a.words);
  const totalWords = speakers.reduce((n, s) => n + s.words, 0);

  // Rounded, and only when there is enough of a call to be meaningful.
  // "You talked 71% of the time" off a two-minute clip is noise.
  const share = totalWords > 200
    ? speakers.map((s) => ({ name: s.name, pct: Math.round((s.words / totalWords) * 100) }))
    : [];

  const mins = Number(h.duration) || (last ? last / 60 : 0);

  return {
    title: String(h.title || "").slice(0, 200),
    date: String(h.date || h.dateString || "").slice(0, 40),
    durationMin: mins ? Math.round(mins) : 0,
    turns: sentences.length,
    speakers: speakers.map((s) => ({ name: s.name, turns: s.turns })),
    talkShare: share,
    lastAt: clock(last),
  };
}

/* ── the read-out ─────────────────────────────────────── */

function str(v) { return typeof v === "string" ? v.trim() : ""; }
function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function arr(v) { return Array.isArray(v) ? v : []; }

/**
 * Validate a Claude extraction and turn it into proposals.
 *
 * Every value comes back as a PROPOSAL — a module, a key, the suggested
 * value and the quote it was drawn from — never as state. What the screen
 * does with it is the user's business.
 *
 * @param known  a Set of module ids this document actually has a screen
 *   for. Anything else is reported, not silently dropped: an extraction
 *   naming a screen that does not exist is a prompt that has drifted.
 * @throws on anything that is not an extraction.
 */
export function readExtract(raw, known) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("That file isn't a call read-out.");
  }
  const schema = str(raw.schema);
  if (schema.indexOf("ss-extract/") !== 0) {
    throw new Error(
      "That file isn't a call read-out. Expected a \"schema\" of \"" + EXTRACT_SCHEMA + "\"" +
      (schema ? ', got "' + schema + '"' : " and found none") + "."
    );
  }

  const warnings = [];
  const warn = (m) => { if (warnings.indexOf(m) < 0) warnings.push(m); };
  if (schema !== EXTRACT_SCHEMA) {
    warn('The read-out says "' + schema + '" and this build expects "' + EXTRACT_SCHEMA +
      '". Reading it anyway — check the values before you use them.');
  }

  const proposals = [];
  const fields = obj(raw.fields);
  for (const [mod, slot] of Object.entries(fields)) {
    if (known && !known.has(mod)) { warn('The read-out has answers for "' + mod + '", which this document has no screen for.'); continue; }
    for (const [key, value] of Object.entries(obj(slot))) {
      const v = typeof value === "number" ? String(value) : str(value);
      if (!v) continue;
      proposals.push({ mod, key, value: v.slice(0, 2000) });
    }
  }

  const quotes = arr(raw.quotes).map((q, i) => {
    const o = obj(q);
    return {
      id: "q" + i,
      speaker: str(o.speaker).slice(0, 80),
      at: str(o.at).slice(0, 16),
      text: str(o.text).slice(0, 600),
      module: known && known.has(str(o.module)) ? str(o.module) : "",
    };
  }).filter((q) => q.text);

  const call = obj(raw.call);
  return {
    call: {
      title: str(call.title).slice(0, 200),
      date: str(call.date).slice(0, 40),
      durationMin: Number(call.durationMin) || 0,
      participants: arr(call.participants).map((p) => str(p).slice(0, 80)).filter(Boolean).slice(0, 20),
    },
    proposals,
    quotes,
    mentionedServices: arr(raw.services).map((x) => str(x).slice(0, 80)).filter(Boolean).slice(0, 60),
    mentionedCities: arr(raw.cities).map((x) => str(x).slice(0, 80)).filter(Boolean).slice(0, 60),
    unclear: arr(raw.unclear).map((x) => str(x).slice(0, 300)).filter(Boolean).slice(0, 40),
    warnings,
  };
}
