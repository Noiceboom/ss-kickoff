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

/* ── search ───────────────────────────────────────────── */

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Match a typed city, best first. Exact name beats prefix beats contains,
 * and population breaks ties — someone typing "kansas city" means the big
 * one, not Kansas City, Kansas's smaller namesake showing up first.
 */
export function search(places, query, limit) {
  const q = norm(query);
  if (q.length < 2) return [];
  const stateMatch = /,\s*([a-z]{2})\s*$/i.exec(query);
  const wantState = stateMatch ? stateMatch[1].toUpperCase() : null;
  const bare = norm(query.replace(/,\s*[a-z]{2}\s*$/i, ""));

  const out = [];
  for (const p of places) {
    if (wantState && p.state !== wantState) continue;
    const n = norm(p.name);
    let score = 0;
    if (n === bare) score = 3;
    else if (n.indexOf(bare) === 0) score = 2;
    else if (n.indexOf(bare) > -1) score = 1;
    if (score) out.push({ place: p, score });
  }
  out.sort((a, b) => b.score - a.score || b.place.pop - a.place.pop);
  return out.slice(0, limit || 8).map((x) => x.place);
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
