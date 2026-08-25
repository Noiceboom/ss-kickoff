// ============================================================
// trades/index.js — the industry registry
// ============================================================
//
// One file per trade, each exporting { id, label, services: [{id,label,subs}] }.
// Adding a trade is a two-line change here.
//
// Service `id` values matter: a scraped service whose id matches one in
// the taxonomy merges into that row instead of showing up twice. Keep
// them stable — they are persisted in saved sessions and share links.

import plumbing from "./plumbing.js";
import hvac from "./hvac.js";
import electrical from "./electrical.js";
import roofing from "./roofing.js";
import fencing from "./fencing.js";
import garageDoor from "./garage-door.js";
import landscaping from "./landscaping.js";
import pestControl from "./pest-control.js";
import cleaning from "./cleaning.js";
import painting from "./painting.js";
import flooring from "./flooring.js";
import windowsDoors from "./windows-doors.js";
import concreteMasonry from "./concrete-masonry.js";
import poolSpa from "./pool-spa.js";
import restoration from "./restoration.js";
import treeService from "./tree-service.js";

export const TRADES = [
  plumbing, hvac, electrical, roofing, fencing, garageDoor,
  landscaping, pestControl, cleaning, painting, flooring,
  windowsDoors, concreteMasonry, poolSpa, restoration, treeService,
];

const BY_ID = new Map(TRADES.map((t) => [t.id, t]));

export function getTrade(id) { return BY_ID.get(id) || null; }
export function tradeExists(id) { return BY_ID.has(id); }

/**
 * Match the client JSON's free-text trade ("Plumbing", "HVAC") to a
 * taxonomy id, so a kickoff opens on the right industry without anyone
 * picking it.
 */
export function resolveTrade(name) {
  const q = String(name || "").toLowerCase().trim();
  if (!q) return null;
  if (BY_ID.has(q)) return q;
  const direct = TRADES.find((t) => t.label.toLowerCase() === q);
  if (direct) return direct.id;
  const ALIASES = {
    "heating": "hvac", "cooling": "hvac", "air conditioning": "hvac",
    "heating & air": "hvac", "heating and air": "hvac", "ac": "hvac",
    "plumber": "plumbing", "electrician": "electrical", "electric": "electrical",
    "roofer": "roofing", "roof": "roofing", "fence": "fencing",
    "garage doors": "garage-door", "lawn": "landscaping", "lawn care": "landscaping",
    "landscape": "landscaping", "pest": "pest-control", "exterminator": "pest-control",
    "maid": "cleaning", "house cleaning": "cleaning", "painter": "painting",
    "floors": "flooring", "windows": "windows-doors", "doors": "windows-doors",
    "concrete": "concrete-masonry", "masonry": "concrete-masonry",
    "pool": "pool-spa", "spa": "pool-spa", "water damage": "restoration",
    "restoration": "restoration", "tree": "tree-service", "arborist": "tree-service",
  };
  return ALIASES[q] && BY_ID.has(ALIASES[q]) ? ALIASES[q] : null;
}
