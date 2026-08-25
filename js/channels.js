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
