// ============================================================
// channels.js — the lead-channel universe
// ============================================================
//
// Shared between module 03, which renders the pick grid, and state.js,
// which needs to know whether a legacy row name matches a real channel
// when migrating. One list, so the two can never disagree.

import { slugify } from "./ui.js";

export const CATEGORIES = [
  {
    name: "Google",
    items: ["Google Ads", "Local Services Ads (LSA)", "Google Business Profile / Maps", "SEO"],
  },
  {
    name: "Social & AI search",
    items: [
      "Meta (Facebook / Instagram)", "TikTok", "Nextdoor",
      "Facebook local & neighborhood groups", "ChatGPT", "Perplexity", "Claude",
    ],
  },
  {
    name: "Pay-per-lead marketplaces",
    items: [
      "Angi / Angi Leads", "HomeAdvisor", "Thumbtack", "Porch", "Modernize", "Networx",
      "Bark", "HomeBuddy", "EverConnect", "CraftJack", "HelloProject", "HomeYou",
      "Contractor Appointments", "BluePagesPro", "Service Direct", "Lavin Media",
      "Other pay-per-lead service",
    ],
  },
  {
    name: "Directories & listings",
    items: [
      "Yelp", "Houzz / Houzz Pro", "BuildZoom", "HomeStars",
      "TaskRabbit / Handy", "Angi Ads (not leads)",
    ],
  },
];

export const RATINGS = [
  { value: "good", label: "Good" },
  { value: "mixed", label: "Mixed" },
  { value: "waste", label: "Waste" },
];

export const ALL = [];
for (const cat of CATEGORIES) {
  for (const label of cat.items) ALL.push({ id: slugify(label), label, cat: cat.name });
}
export const BY_ID = new Map(ALL.map((c) => [c.id, c]));

export function isKnownChannel(id) { return BY_ID.has(id); }

/**
 * Older versions of module 03 used short labels. Slugifying those gives
 * ids that match nothing, so without this table a legacy "LSA" row lands
 * in the free-text box instead of becoming a rated tile.
 */
const ALIASES = {
  lsa: "local-services-ads-lsa",
  gbp: "google-business-profile-maps",
  "google-my-business": "google-business-profile-maps",
  maps: "google-business-profile-maps",
  meta: "meta-facebook-instagram",
  facebook: "meta-facebook-instagram",
  instagram: "meta-facebook-instagram",
  angi: "angi-angi-leads",
  "home-advisor": "homeadvisor",
  ppc: "google-ads",
  adwords: "google-ads",
  "google-adwords": "google-ads",
};

/** Resolve a free-form channel name to a known id, or null. */
export function resolveChannel(name) {
  const id = slugify(String(name || ""));
  if (!id) return null;
  if (BY_ID.has(id)) return id;
  const alias = ALIASES[id];
  return alias && BY_ID.has(alias) ? alias : null;
}

/** Per-channel state keys, shared so migration and pruning agree. */
export const CHANNEL_KEY_PREFIXES = ["rate_", "vol_", "note_"];
