// ============================================================
// places.js — US place lookup and radius search
// ============================================================
//
// Every US place with coordinates and population, from the Census Bureau's
// 2023 Gazetteer joined to the 2023 population estimates on GEOID. An exact
// key join, not a name match: name matching lost ten Kansas City suburbs
// including Merriam, Raytown and North Kansas City, which is precisely the
// kind of silent gap that would go unnoticed on a call.
//
// Sharded one file per state and loaded on demand, so a Kansas City kickoff
// pulls KS and MO — about 26KB — rather than all 32,000 places. Radius
// searches near a border reach into neighbouring states, hence ADJACENT.
//
// Data: public domain (US Census Bureau). No API, no key, no network at
// call time beyond the one same-origin fetch.

const CACHE = new Map();
const EARTH_MILES = 3958.8;

/** Neighbouring states, so a radius that crosses a border still works. */
export const ADJACENT = {
  AL: ["FL", "GA", "MS", "TN"], AK: [], AZ: ["CA", "CO", "NM", "NV", "UT"],
  AR: ["LA", "MS", "MO", "OK", "TN", "TX"], CA: ["AZ", "NV", "OR"],
  CO: ["AZ", "KS", "NE", "NM", "OK", "UT", "WY"], CT: ["MA", "NY", "RI"],
  DE: ["MD", "NJ", "PA"], DC: ["MD", "VA"], FL: ["AL", "GA"],
  GA: ["AL", "FL", "NC", "SC", "TN"], HI: [], ID: ["MT", "NV", "OR", "UT", "WA", "WY"],
  IL: ["IN", "IA", "KY", "MO", "WI"], IN: ["IL", "KY", "MI", "OH"],
  IA: ["IL", "MN", "MO", "NE", "SD", "WI"], KS: ["CO", "MO", "NE", "OK"],
  KY: ["IL", "IN", "MO", "OH", "TN", "VA", "WV"], LA: ["AR", "MS", "TX"],
  ME: ["NH"], MD: ["DE", "PA", "VA", "WV", "DC"], MA: ["CT", "NH", "NY", "RI", "VT"],
  MI: ["IN", "OH", "WI"], MN: ["IA", "ND", "SD", "WI"], MS: ["AL", "AR", "LA", "TN"],
  MO: ["AR", "IL", "IA", "KS", "KY", "NE", "OK", "TN"], MT: ["ID", "ND", "SD", "WY"],
  NE: ["CO", "IA", "KS", "MO", "SD", "WY"], NV: ["AZ", "CA", "ID", "OR", "UT"],
  NH: ["ME", "MA", "VT"], NJ: ["DE", "NY", "PA"], NM: ["AZ", "CO", "OK", "TX", "UT"],
  NY: ["CT", "MA", "NJ", "PA", "VT"], NC: ["GA", "SC", "TN", "VA"], ND: ["MN", "MT", "SD"],
  OH: ["IN", "KY", "MI", "PA", "WV"], OK: ["AR", "CO", "KS", "MO", "NM", "TX"],
  OR: ["CA", "ID", "NV", "WA"], PA: ["DE", "MD", "NJ", "NY", "OH", "WV"],
  RI: ["CT", "MA"], SC: ["GA", "NC"], SD: ["IA", "MN", "MT", "ND", "NE", "WY"],
  TN: ["AL", "AR", "GA", "KY", "MS", "MO", "NC", "VA"], TX: ["AR", "LA", "NM", "OK"],
  UT: ["AZ", "CO", "ID", "NM", "NV", "WY"], VT: ["MA", "NH", "NY"],
  VA: ["KY", "MD", "NC", "TN", "WV", "DC"], WA: ["ID", "OR"],
  WV: ["KY", "MD", "OH", "PA", "VA"], WI: ["IA", "IL", "MI", "MN"],
  WY: ["CO", "ID", "MT", "NE", "SD", "UT"], PR: [],
};

export const STATES = Object.keys(ADJACENT).sort();

/* ── loading ──────────────────────────────────────────── */

async function loadState(code) {
  if (CACHE.has(code)) return CACHE.get(code);
  const p = fetch("data/places/" + code + ".json", { cache: "force-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((rows) => rows.map((r) => ({ name: r[0], state: code, lat: r[1], lng: r[2], pop: r[3] })))
    .catch(() => []);
  CACHE.set(code, p);
  return p;
}

/** Load these states plus everything bordering them. */
export async function loadRegion(codes) {
  const want = new Set();
  for (const c of codes || []) {
    if (!ADJACENT[c]) continue;
    want.add(c);
    for (const n of ADJACENT[c]) want.add(n);
  }
  const lists = await Promise.all([...want].map(loadState));
  return lists.flat();
}

/**
 * National search index — every place over 1,000 people, loaded once.
 *
 * Searching only the client's own region was a real bug: a Kansas City
 * kickoff loaded ten states around Missouri, so typing "Dallas" could
 * never find Texas and offered Dallas Center, Iowa instead. The base city
 * is a national question; the radius is a regional one.
 */
let INDEX = null;
export async function loadIndex() {
  if (!INDEX) {
    INDEX = fetch("data/places-index.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => rows.map((r) => ({ name: r[0], state: r[1], lat: r[2], lng: r[3], pop: r[4] })))
      .catch(() => []);
  }
  return INDEX;
}

/* ── search ───────────────────────────────────────────── */

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const STATE_SET = new Set(Object.keys(ADJACENT));

/**
 * Pull a city and state out of whatever was typed — a bare city, a
 * "City, ST", or a full street address off a business card.
 *
 *   "3090 W Market St Ste 124-2, Akron, OH 44333" -> { city: "Akron", state: "OH" }
 *
 * Street lines are discarded rather than searched: nothing in the dataset
 * would ever match them, which is why pasting an address returned nothing
 * at all.
 */
export function parseLocation(raw) {
  let q = String(raw || "").trim();
  if (!q) return { city: "", state: "" };

  // strip a trailing ZIP, with or without the +4
  q = q.replace(/\s*\b\d{5}(-\d{4})?\s*$/, "").trim().replace(/,\s*$/, "");

  // Newlines count as separators too. An address copied off a Google
  // listing arrives as two lines, and a single-line input turns the break
  // into a space — so the street and the city end up in one segment.
  const parts = q.split(/[\n\r,]+/).map((x) => x.trim()).filter(Boolean);
  let state = "";

  if (parts.length) {
    const last = parts[parts.length - 1];
    const asState = last.toUpperCase();
    if (STATE_SET.has(asState)) {
      state = asState;
      parts.pop();
    } else {
      // "Akron OH" with no comma
      const m = /^(.*?)[\s]+([A-Za-z]{2})$/.exec(last);
      if (m && STATE_SET.has(m[2].toUpperCase())) {
        state = m[2].toUpperCase();
        parts[parts.length - 1] = m[1].trim();
      }
    }
  }

  // The city is the last remaining segment; anything before it is street.
  const seg = parts.length ? parts[parts.length - 1] : "";
  return { city: stripStreet(seg), state: state, candidates: cityCandidates(seg) };
}

const UNIT_MARKERS = new Set([
  "ste", "suite", "unit", "apt", "apartment", "bldg", "building", "fl", "floor",
  "rm", "room", "#", "no", "lot", "trlr",
]);

const STREET_TYPES = new Set([
  "st", "street", "ave", "avenue", "rd", "road", "blvd", "boulevard", "dr", "drive",
  "ln", "lane", "way", "ct", "court", "pkwy", "parkway", "hwy", "highway", "pl",
  "place", "ter", "terrace", "cir", "circle", "trl", "trail", "loop", "sq", "square",
  "run", "path", "row", "xing", "crossing", "pike", "expy", "expressway",
]);

const clean = (t) => String(t).toLowerCase().replace(/[.,]/g, "");

/**
 * Best single guess at the city when nothing can be checked against the
 * place list — splits after the first street type and drops any unit that
 * follows. search() prefers cityCandidates(), which resolves the genuinely
 * ambiguous cases against real data instead.
 */
function stripStreet(seg) {
  const raw = String(seg || "").trim();
  if (!/^\d/.test(raw)) return raw;
  const tokens = raw.split(/\s+/);
  let cut = tokens.findIndex((t) => STREET_TYPES.has(clean(t)));
  if (cut < 0) {
    const u = tokens.findIndex((t) => UNIT_MARKERS.has(clean(t)));
    cut = u < 0 ? -1 : u - 1;
  }
  if (cut < 0) return raw;

  let rest = tokens.slice(cut + 1);
  while (rest.length) {
    const head = clean(rest[0]);
    if (UNIT_MARKERS.has(head) || head.charAt(0) === "#") {
      rest = rest.slice(rest.length > 1 ? 2 : 1);
      continue;
    }
    if (/\d/.test(rest[0])) { rest = rest.slice(1); continue; }
    break;
  }
  return rest.length ? rest.join(" ") : raw;
}

/**
 * Every trailing run of words that could be the city, longest first.
 *
 * No token rule separates a street from a city reliably: the street name
 * can itself be a street word ("500 Court St"), and the city can contain
 * one ("Circle Pines", "Grand Terrace"). Splitting at the first street
 * type breaks the former, splitting at the last breaks the latter.
 *
 * So don't guess — hand the caller every plausible ending and let it check
 * them against the actual place list. The gazetteer already knows which of
 * "Placid" and "Lake Placid" is a real city.
 */
export function cityCandidates(seg) {
  const raw = String(seg || "").trim();
  if (!raw) return [];
  const tokens = raw.split(/\s+/);
  const out = [];
  const max = Math.min(4, tokens.length);
  for (let n = max; n >= 1; n--) {
    const win = tokens.slice(tokens.length - n);
    // A window carrying a house number, a unit or a suite value is not a city
    if (win.some((t) => /\d/.test(t) || UNIT_MARKERS.has(clean(t)) || clean(t).charAt(0) === "#")) continue;
    out.push(win.join(" "));
  }
  if (!out.length) out.push(raw);
  return out;
}

/**
 * Match a typed city, best first. Exact name beats prefix beats contains,
 * and population breaks ties — someone typing "kansas city" means the big
 * one, not Kansas City, Kansas's smaller namesake showing up first.
 */
export function search(places, query, limit) {
  const { city, state, candidates } = parseLocation(query);

  // Longest plausible ending first: if "Lake Placid" is a real place, it
  // beats "Placid", and the street/city ambiguity resolves itself against
  // the data instead of against a guess.
  for (const cand of candidates || []) {
    if (norm(cand).length < 2) continue;
    const hits = rank(places, norm(cand), state, limit);
    if (hits.length && hits[0].exact) return hits.map((h) => h.place);
  }
  return rank(places, norm(city), state, limit).map((h) => h.place);
}

function rank(places, bare, state, limit) {
  if (bare.length < 2) return [];
  const out = [];
  const seen = new Set();
  for (const p of places) {
    if (state && p.state !== state) continue;
    const n = norm(p.name);
    let score = 0;
    if (n === bare) score = 4;                       // Dallas === Dallas
    else if (n.indexOf(bare + " ") === 0) score = 3; // Dallas Center
    else if (n.indexOf(bare) === 0) score = 2;
    else if (n.indexOf(" " + bare) > -1) score = 1;  // Melcher-Dallas
    else if (n.indexOf(bare) > -1) score = 0.5;
    if (!score) continue;
    const key = n + "|" + p.state;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ place: p, score, exact: score === 4 });
  }
  // Population breaks ties, so an exact match on a big city always beats an
  // exact match on a hamlet, and "Dallas" lands on Texas.
  out.sort((a, b) => b.score - a.score || b.place.pop - a.place.pop);
  return out.slice(0, limit || 8);
}

/* ── radius ───────────────────────────────────────────── */

export function distanceMiles(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_MILES * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Places within `miles` of the origin, nearest first. The origin itself is
 * included — it is normally the first city they want a page for.
 */
export function within(places, origin, miles) {
  const out = [];
  for (const p of places) {
    const d = distanceMiles(origin, p);
    if (d <= miles) out.push({ ...p, miles: Math.round(d * 10) / 10 });
  }
  out.sort((a, b) => a.miles - b.miles);
  return out;
}

/** A stable id for a place, matching the client JSON's slug convention. */
export function placeId(place) {
  return String(place.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" + String(place.state).toLowerCase();
}
