// ============================================================
// 13 — Profiles
// ============================================================
//
// Every place the business already exists online, as a link we can open.
//
// Deliberately links and not credentials — who can get INTO these is the
// Access screen's job. This is the shorter, duller question that stalls
// work just as often: nobody can find the Facebook page, and three people
// spend a morning looking for it.
//
// Kickoff only.

import {
  sectionHeadFor, skipRow, field, rowGroup, statusFor, filled, esc,
} from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "profiles";

// Keys are persisted — renaming one orphans that link.
const LINKS = [
  { key: "gbp", label: "Google Business Profile", placeholder: "https://maps.app.goo.gl/…",
    help: "The maps listing itself, not the dashboard. Paste the link a customer would land on." },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "yelp", label: "Yelp", placeholder: "https://yelp.com/biz/…" },
  { key: "bbb", label: "BBB", placeholder: "https://bbb.org/…" },
  { key: "angi", label: "Angi", placeholder: "https://angi.com/…" },
  { key: "nextdoor", label: "Nextdoor", placeholder: "https://nextdoor.com/…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/…" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@…" },
];

const CORE = ["gbp"];

export default {
  id: ID,
  nav: "Profiles",
  title: "Where do they already exist?",
  lede:
    "Links, not logins — who can get into these is the Access screen. Paste what you can find " +
    "on the call; anything blank is something for us to go and look for.",
  skippable: true,
  notePrompt: "Duplicate listings, an old page nobody can get into, a name that doesn't match.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">The usual ones</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          LINKS.map((l) => field(ID, l.key, l.label, v(l.key), {
            placeholder: l.placeholder,
            help: l.help,
          })).join("") +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Anything else</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "A trade association listing, a franchise page, the directory somebody paid for in 2019." +
        "</div>" +
        '<div style="margin-top:18px">' +
          rowGroup(ID, "other", [
            { key: "what", label: "Where", placeholder: "Houzz" },
            { key: "url", label: "Link", placeholder: "https://…" },
          ], getRows(ctx.state, ID, "other"), {
            addLabel: "Add a link",
            empty: "Nothing extra yet.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const rows = [];
    for (const l of LINKS) if (filled(s[l.key])) rows.push([l.label, s[l.key]]);
    for (const r of (Array.isArray(s.other) ? s.other : [])) {
      if (r && (r.what || r.url)) rows.push([r.what || "Other", r.url || ""]);
    }

    const open = [];
    if (!filled(s.gbp)) {
      open.push({
        what: "No Google Business Profile link",
        detail: "The single highest-leverage listing for a home-services business, and we can't see it.",
        ask: "Send us the link to your Google Business Profile — the map listing customers see.",
      });
    }
    if (!rows.length) return { rows: [], open };
    return { rows, open };
  },
};
