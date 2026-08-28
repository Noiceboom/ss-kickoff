// ============================================================
// import.js — a sales call, replayed as a kickoff
// ============================================================
//
// The discovery document and the kickoff document deliberately share
// module ids and state keys, so most of the handoff is a copy. The parts
// that are not are the parts that will break, and every one of them is
// here rather than spread across the modules.
//
// The governing fact: the payload is a set of RESOLVED VIEWS, not raw
// state. `services.items` is what `serviceUniverse()` produced after
// folding the scrape, the taxonomies, the snapshots and the on/off lists
// together — it is the answer, not the working. Going backwards means
// reconstructing the working, and the rules differ per block:
//
//   payload block   rebuilds into        keys
//   services     →  m.services           trades, on, off, prio, added, snap, subsOff
//   locations    →  m.locations          on, off, excluded, prio, added, base, radius
//   channels     →  m.MARKETING          chan[], rate_<id>, vol_<id>, note_<id>
//   access       →  m.access             extra[], status_<key>, custom[], leadsie
//
// Note the third row. The block is called `channels` and it rebuilds into
// `marketing`; every other block happens to share its name with the
// module it targets, which makes that one look like a typo right up until
// it silently drops every channel rating on the call.
//
// The authority for what is missing from `fields` — and therefore what
// has to come back from a block — is `STRUCTURAL` in js/export.js.

import { fresh } from "./state.js";
import { KICKOFF } from "./modules/index.js";
import { DEFAULT_MODE, DISCOVERY } from "./modes.js";

/** Module ids the kickoff actually has a screen for. */
const KICKOFF_IDS = new Set(KICKOFF.map((m) => m.id));

const PRIORITIES = ["high", "med", "low"];

function str(v) { return typeof v === "string" ? v : ""; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function prio(v) { return PRIORITIES.indexOf(v) > -1 ? v : ""; }

/** Ids in agreed build order. Unranked items are absent, not appended. */
function orderFrom(items) {
  return arr(items)
    .filter((it) => typeof it.rank === "number" && it.rank > 0)
    .sort((a, b) => a.rank - b.rank)
    .map((it) => str(it.id))
    .filter(Boolean);
}

/** Drop empty containers so an imported slot looks like a typed one. */
function tidy(slot) {
  for (const k of Object.keys(slot)) {
    const v = slot[k];
    if (Array.isArray(v) ? !v.length : (v && typeof v === "object" && !Object.keys(v).length)) {
      delete slot[k];
    }
  }
  return slot;
}

/* ── services ─────────────────────────────────────────── */
//
// Selection is two-sided and the side depends on `source`:
//
//   both / scrape — it is on their website, so it is ON unless listed off
//   trade         — taxonomy only, so it is OFF unless listed on
//   added         — typed on the call, ON unless listed off
//
// Writing every selected id into `on` regardless would look right and be
// wrong: a scraped service the prospect switched OFF would come back ON,
// because `off` is what carries that decision and `on` is ignored for
// scraped rows entirely.
//
// The `snap` entry on a taxonomy-only tick is not optional. Without it,
// changing trade on the kickoff call makes the service — and its priority,
// and its note — vanish from the screen with no way to get it back.
function services(payload, warn) {
  const block = obj(payload.services);
  const slot = { trades: arr(block.trades).map(str).filter(Boolean),
                 on: [], off: [], prio: {}, snap: {}, subsOff: {}, added: [] };

  for (const raw of arr(block.items)) {
    const id = str(raw.id);
    if (!id) { warn("a service in the payload had no id and was dropped"); continue; }
    const name = str(raw.name) || id;
    const subs = arr(raw.subs);
    const subNames = subs.map((x) => str(x && x.name)).filter(Boolean);
    const selected = !!raw.selected;
    const source = str(raw.source);

    if (source === "trade") {
      if (selected) {
        slot.on.push(id);
        // Trade-scoped ids look like "hvac:water-heaters"; a bare one here
        // means the scoping migration never ran on the source session, and
        // the tick would land on whichever trade is showing at the time.
        if (id.indexOf(":") < 0) {
          warn(`taxonomy service "${name}" carries an unscoped id (${id}) — it may land on the wrong trade`);
        }
        slot.snap[id] = { name: name, subs: subNames };
      }
    } else if (source === "added") {
      // The id came off the sales call and every note and priority is
      // hung off it. Regenerating one from the name here would orphan all
      // of them, so it is carried across untouched.
      slot.added.push({ id: id, name: name, subs: subNames });
      if (!selected) slot.off.push(id);
    } else {
      if (!selected) slot.off.push(id);
    }

    if (selected && prio(raw.priority)) slot.prio[id] = prio(raw.priority);

    const dropped = subs.filter((x) => x && x.selected === false)
      .map((x) => str(x.name)).filter(Boolean);
    if (dropped.length) slot.subsOff[id] = dropped;
  }

  return { slot: tidy(slot), order: orderFrom(block.items) };
}

/* ── locations ────────────────────────────────────────── */
//
// The trap here is `source: "radius"`. Those rows exist in the universe
// only while a radius search is holding them in TRANSIENT state — rerun
// the search with a different base city, or before it has finished, and
// they are simply not there. An id written into `on` for a row that is
// not in the universe selects nothing at all, silently.
//
// So radius cities are imported as `added`, which is unconditional. The
// id is preserved, `radiusCandidates()` dedupes them out of the picker by
// name and state, and `locationUniverse()` folds the distance back in if
// the search does return them later.
function locations(payload, warn) {
  const block = obj(payload.locations);
  const slot = {
    on: [], off: [], excluded: [], prio: {}, added: [],
    base: str(block.baseAddress),
    radius: typeof block.radiusMiles === "number" ? block.radiusMiles : 25,
  };

  for (const raw of arr(block.items)) {
    const id = str(raw.id);
    if (!id) { warn("a city in the payload had no id and was dropped"); continue; }
    const source = str(raw.source);
    const excluded = !!raw.excluded;
    const selected = !!raw.selected;

    if (source === "radius" || source === "added") {
      slot.added.push({ id: id, name: str(raw.name) || id, state: str(raw.state), hasPage: !!raw.hasPage });
      if (!selected && !excluded) slot.off.push(id);
    } else if (!selected && !excluded) {
      slot.off.push(id);
    }

    // Excluding clears priority everywhere else in the app; keep that true
    // here rather than importing a ranked city nobody will ever market to.
    if (excluded) slot.excluded.push(id);
    else if (selected && prio(raw.priority)) slot.prio[id] = prio(raw.priority);
  }

  // Read the exclusions BEFORE tidy(), which deletes empty containers —
  // a session with nothing excluded would otherwise leave `slot.excluded`
  // undefined and throw here, taking the whole import with it. The
  // commonest session of all is the one with no exclusions.
  const excluded = slot.excluded.slice();
  return {
    slot: tidy(slot),
    order: orderFrom(block.items).filter((id) => excluded.indexOf(id) < 0),
  };
}

/* ── channels → marketing ─────────────────────────────── */
//
// `fields.marketing` holds the loose text answers and NOTHING else — for a
// fully worked screen it can be as little as {"agency":"Lead Ninjas"}.
// Every selection, rating, lead volume and per-channel note is in the
// top-level `channels` array, because STRUCTURAL strips those keys out of
// `fields` on the way out. An importer that replays `fields.marketing` and
// stops loses the entire "what's running today" picture.
function channels(payload, into) {
  const chan = [];
  for (const raw of arr(payload.channels)) {
    const id = str(raw.id);
    if (!id) continue;
    chan.push(id);
    if (str(raw.rating)) into["rate_" + id] = str(raw.rating);
    if (str(raw.monthlyLeads)) into["vol_" + id] = str(raw.monthlyLeads);
    if (str(raw.note)) into["note_" + id] = str(raw.note);
  }
  if (chan.length) into.chan = chan;
  return into;
}

/* ── access ───────────────────────────────────────────── */
//
// The sales call has no access screen, so this is all nulls coming out of
// discovery and is skipped. It is written anyway, for the kickoff → kickoff
// case, and because a block that only round-trips in one direction is a
// block nobody notices has stopped working.
/**
 * The recording, replayed into transcript state.
 *
 * `rec` is deliberately NOT restored. That is metadata for bytes sitting
 * in IndexedDB on the machine the sales call was run from — the file does
 * not travel with the payload, and a Download button that fails is worse
 * than no button at all. The call summary comes back; the file does not.
 *
 * Quote ids are positional and regenerated here to match, because
 * `approved` is a list of those ids while the payload stores approval on
 * the quote itself.
 */
function recording(payload, into, warn) {
  const r = obj(payload.recording);
  if (!Object.keys(r).length) return;

  const quotes = arr(r.quotes).map((q, i) => ({
    id: "q" + i,
    speaker: str(obj(q).speaker),
    at: str(obj(q).at),
    text: str(obj(q).text),
    module: str(obj(q).module),
  })).filter((q) => q.text);

  const approved = [];
  arr(r.quotes).forEach((q, i) => { if (obj(q).approved) approved.push("q" + i); });

  const call = obj(r.call);
  const slot = {
    extract: {
      call: obj(r.readout),
      // Only for screens this document actually has. `whynow` exists on
      // the sales call and not here, and a proposal pointing at it renders
      // a Use button that writes to a module id no registry resolves —
      // invisible on screen, absent from the readout, gone from the next
      // export.
      proposals: arr(r.unused).map((u) => ({
        mod: str(obj(u).module), key: str(obj(u).key), value: str(obj(u).value),
      })).filter((p) => {
        if (!p.mod || !p.key) return false;
        if (KICKOFF_IDS.has(p.mod)) return true;
        if (warn) warn(`the recording had an unused answer for "${p.mod}", which this document has no screen for`);
        return false;
      }),
      quotes: quotes,
      mentionedServices: arr(r.mentionedServices).map(str).filter(Boolean),
      mentionedCities: arr(r.mentionedCities).map(str).filter(Boolean),
      unclear: arr(r.unclear).map(str).filter(Boolean),
      warnings: [],
    },
    approved: approved,
    // Applications are per-read-out, and the answers they produced are
    // already in `fields`. Carrying the tags across would mark proposals
    // "used" against a document that never used them.
    applied: [],
  };
  if (Object.keys(call).length) slot.recSummary = call;

  // Mentions and unanswered questions are reason enough to keep it.
  // "They said they do drain cleaning and we never ticked it" and "never
  // gave a close rate" are precisely what the kickoff call is for.
  const anything = quotes.length || slot.extract.proposals.length || slot.recSummary ||
    slot.extract.mentionedServices.length || slot.extract.mentionedCities.length ||
    slot.extract.unclear.length;
  if (!anything) return;
  into.transcript = slot;
}

function access(payload, into) {
  const block = obj(payload.access);
  const extra = [];
  for (const raw of arr(block.accounts)) {
    const key = str(raw.key);
    if (!key) continue;
    if (!raw.core && raw.inPlay) extra.push(key);
    if (str(raw.status)) into["status_" + key] = str(raw.status);
  }
  if (extra.length) into.extra = extra;
  const leadsie = obj(block.leadsie);
  if (str(leadsie.status)) into.leadsie = str(leadsie.status);
  if (str(leadsie.who)) into.leadsieWho = str(leadsie.who);
  const custom = arr(block.other)
    .filter((r) => r && (str(r.label) || str(r.status)))
    .map((r) => ({ account: str(r.label), status: str(r.status) }));
  if (custom.length) into.custom = custom;
  return into;
}

/* ── the whole thing ──────────────────────────────────── */

/**
 * Turn an exported payload into kickoff state.
 *
 * @returns {{ state, warnings: string[], name: string, slug: string }}
 * @throws  on anything that is not a payload this build understands.
 */
export function importPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("That file isn't a Service Scalers export.");
  }
  const schema = str(raw.schema);
  if (schema.indexOf("ss-kickoff/") !== 0) {
    throw new Error("That file isn't a Service Scalers export.");
  }

  const warnings = [];
  const warn = (m) => { if (warnings.indexOf(m) < 0) warnings.push(m); };

  // A version this build has never seen may have moved a key underneath
  // us. Import it rather than refusing — losing a whole sales call to a
  // version bump is worse — but say so out loud.
  const version = Number(schema.split("/")[1]);
  if (!isFinite(version)) warn(`the file declares schema "${schema}", which has no version`);

  const from = str(raw.mode) || DEFAULT_MODE;
  if (from !== DISCOVERY) {
    warn(from === DEFAULT_MODE
      ? "This file came from a kickoff, not a sales call. Loading it anyway."
      : `This file came from "${from}", which this build doesn't know. Loading it anyway.`);
  }

  const state = fresh(DEFAULT_MODE);

  // fields — keyed on state keys, so it maps back directly. This is the
  // easy half, and the only half that is easy.
  const fields = obj(raw.fields);
  const handoffFields = {};
  for (const [mod, slot] of Object.entries(fields)) {
    const values = obj(slot);
    if (!Object.keys(values).length) continue;
    if (KICKOFF_IDS.has(mod)) state.m[mod] = { ...values };
    // A screen the sales call has and the kickoff doesn't — `whynow`.
    // Replaying it into state.m would park answers under a module id no
    // registry resolves: invisible on screen, absent from the readout, and
    // dropped from the next export. They ride in `handoff` instead, where
    // the intro screen shows them and the export carries them on.
    else handoffFields[mod] = { ...values };
  }

  const notes = obj(raw.notes);
  const handoffNotes = {};
  for (const [mod, note] of Object.entries(notes)) {
    if (!str(note)) continue;
    if (KICKOFF_IDS.has(mod)) state.notes[mod + ":_page"] = str(note);
    else handoffNotes[mod] = str(note);
  }

  const svc = services(raw, warn);
  if (Object.keys(svc.slot).length) state.m.services = { ...(state.m.services || {}), ...svc.slot };
  if (svc.order.length) state.order.services = svc.order;

  const loc = locations(raw, warn);
  if (Object.keys(loc.slot).length) state.m.locations = { ...(state.m.locations || {}), ...loc.slot };
  if (loc.order.length) state.order.locations = loc.order;

  state.m.marketing = tidy(channels(raw, { ...(state.m.marketing || {}) }));
  state.m.access = tidy(access(raw, { ...(state.m.access || {}) }));
  recording(raw, state.m, warn);

  for (const mod of Object.keys(state.m)) {
    if (!Object.keys(state.m[mod]).length) delete state.m[mod];
  }

  // Skips do NOT carry across. "We didn't cover competitors on the sales
  // call" is a fact about that call; replaying it would open the kickoff
  // with a screen pre-marked as covered-and-declined, and nobody would
  // think to un-mark it.
  state.step = KICKOFF[0].id;

  const client = obj(raw.client);
  // A prospect usually has no clients/<slug>.json, so `client.name` is
  // empty and the name they actually gave is the one they typed on the
  // call. That one wins; `client.name` is the fallback, not the truth.
  const typed = str(obj(fields.company).businessName);
  const name = typed || str(client.name);

  state.handoff = {
    from: from,
    schema: schema,
    build: str(raw.build),
    capturedAt: str(raw.capturedAt),
    slug: str(client.slug),
    name: name,
    fields: handoffFields,
    notes: handoffNotes,
    // Only the items written for the client to read. The bare `detail` is
    // written for whoever picks up the work and reads as an insult once
    // the prospect is a client.
    asks: arr(raw.openItems)
      .filter((o) => o && str(o.ask))
      .map((o) => ({ what: str(o.what), ask: str(o.ask) })),
  };

  return { state, warnings, name, slug: str(client.slug) };
}
