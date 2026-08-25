// ============================================================
// 10 — Brand, voice & proof
// ============================================================
//
// Everything the copy and design work has to stand on. Two thirds of
// this is inventory (do the assets exist?) and one third is ammunition
// (what can we actually claim, and can we back it up?).
//
// Form-shaped module, same shape as 01: sectionHead + skipRow + cards
// of field-kit output. Pure render, no listeners, no state writes.

import { sectionHead, skipRow, field, chipGroup, toggle, rowGroup, statusFor, filled } from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "brand";

// Keys that count toward "done". Anything not listed is a bonus field.
const CORE = ["logoStatus", "photoStatus", "reviewCount", "reviewRating", "usps"];

const LOGO = ["Have vector", "Have raster only", "Need one", "Needs a redesign"];
const PHOTOS = ["Professional shoot", "Phone pics", "Stock only", "Nothing"];
const PLATFORMS = [
  "Google", "Facebook", "Yelp", "Angi", "Nextdoor", "BBB", "Thumbtack", "Houzz", "Trustpilot",
];

// Photo states that stop a landing page from shipping.
const THIN_PHOTOS = ["Stock only", "Nothing"];

export default {
  id: ID,
  nav: "Brand & proof",
  title: "What do we have to work with?",
  lede: "Assets, proof and language. A claim we can't prove is dead weight in ad copy, so the USP table has a proof column and we fill both halves on the call.",
  skippable: true,

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k, fallback) => (s[k] !== undefined ? s[k] : (fallback || ""));

    return (
      sectionHead("10", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Assets</div>' +
        chipGroup(ID, "logoStatus", "Logo", s.logoStatus, LOGO, {
          help: "Vector means .ai / .eps / .svg. A 400px PNG off the old site is raster only.",
        }) +
        '<div class="fields two" style="margin-top:18px">' +
          field(ID, "colors", "Brand colors", v("colors"), {
            placeholder: "#1B4D3E green, #DDB458 gold, white",
            help: "Hex codes if they have them, plain names if they don't. We'll pull the rest off the truck wrap.",
          }) +
          field(ID, "fonts", "Fonts they use", v("fonts"), {
            placeholder: "Whatever the sign shop used",
          }) +
        "</div>" +
        '<div style="margin-top:18px">' +
          chipGroup(ID, "photoStatus", "Photo library", s.photoStatus, PHOTOS, {
            help: "Real trucks, real crews, real jobs. This is the single biggest driver of landing page conversion.",
          }) +
        "</div>" +
        (THIN_PHOTOS.indexOf(s.photoStatus) > -1
          ? '<div class="fields one" style="margin-top:18px">' +
              field(ID, "photoPlan", "How we fix the photo problem", v("photoPlan"), {
                type: "longtext",
                placeholder: "Owner shoots 30 phone pics of trucks and crews this week; proper shoot booked for month 2.",
                help: "Say it out loud now and it gets done. Leave it and we ship stock photos.",
              }) +
            "</div>"
          : "") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Proof</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "reviewCount", "Google reviews — how many", v("reviewCount"), {
            type: "number", placeholder: "184",
            help: "Read it off the profile on the call. This is the baseline we measure review growth against.",
          }) +
          field(ID, "reviewRating", "Google rating", v("reviewRating"), {
            placeholder: "4.8",
          }) +
        "</div>" +
        '<div style="margin-top:18px">' +
          chipGroup(ID, "reviewPlatforms", "Other platforms they care about", s.reviewPlatforms, PLATFORMS, {
            multi: true,
            help: "Only the ones they'll actually maintain. Three dead profiles is worse than one live one.",
          }) +
        "</div>" +
        '<div class="fields one" style="margin-top:18px">' +
          field(ID, "awards", "Awards, certifications, memberships", v("awards"), {
            type: "longtext",
            placeholder: "NATE certified · Angi Super Service 2023, 2024 · BBB A+ · factory-authorized Carrier dealer",
            help: "Anything with a logo we can put in the footer or a trust bar. Get the exact wording.",
          }) +
          field(ID, "guarantees", "Guarantees", v("guarantees"), {
            type: "longtext",
            placeholder: "100% satisfaction or we come back free. On time or $50 off. No overtime charges.",
            help: "The ones they'll honour without arguing. These become headlines, so don't inflate them here.",
          }) +
        "</div>" +
        '<div class="fields two" style="margin-top:18px">' +
          field(ID, "warranty", "Warranty terms", v("warranty"), {
            placeholder: "1 yr parts & labour, 10 yr on installs",
          }) +
        "</div>" +
        '<div style="margin-top:20px">' +
          toggle(ID, "financing", "Offers financing", !!s.financing) +
        "</div>" +
        (s.financing
          ? '<div class="fields one" style="margin-top:18px">' +
              field(ID, "financingNote", "Financing detail", v("financingNote"), {
                type: "longtext",
                placeholder: "GreenSky. 0% for 18 months on approved credit, $2k minimum. Same-day approval in the truck.",
                help: "Provider, the headline offer, and the minimum. \"Financing available\" converts far worse than the actual number.",
              }) +
            "</div>"
          : "") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What makes them the pick</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Every claim needs something behind it. If the proof column is empty we can't run the claim." +
        "</div>" +
        '<div style="margin-top:18px">' +
          rowGroup(ID, "usps", [
            { key: "claim", label: "Claim", placeholder: "Same-day service, every day" },
            { key: "proof", label: "Proof — why it's true", placeholder: "9 trucks, dispatcher on until 8pm, 94% same-day last year" },
          ], getRows(ctx.state, ID, "usps"), {
            addLabel: "Add a USP",
            empty: "No USPs yet. Ask what makes them different, then ask how they know.",
            help: "Three strong ones beat eight vague ones. \"Family owned\" is not a USP unless the proof column says why it matters.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Language</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "sayThis", "Phrases they want used", v("sayThis"), {
            type: "longtext",
            placeholder: "\"Your neighbours in Overland Park since 1998\" · always \"technician\", never \"guy\"",
            help: "How they talk about themselves. Steal their exact words — they usually sell better than ours.",
          }) +
          field(ID, "neverSay", "Phrases we must never use", v("neverSay"), {
            type: "longtext",
            placeholder: "Never \"cheap\" or \"discount\". Never \"free estimate\" — they charge a diagnostic. Franchise bans \"#1\".",
            help: "Franchise rules, legal restrictions, and anything that makes the owner wince. This one saves rewrites.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const usps = Array.isArray(s.usps) ? s.usps : [];
    const reviews = [
      filled(s.reviewCount) ? s.reviewCount + " reviews" : "",
      filled(s.reviewRating) ? s.reviewRating + "★" : "",
    ].filter(Boolean).join(" · ");

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    put("Logo", s.logoStatus);
    put("Colors", s.colors);
    put("Fonts", s.fonts);
    put("Photos", s.photoStatus);
    put("Photo plan", s.photoPlan);
    put("Google", reviews);
    put("Other platforms", Array.isArray(s.reviewPlatforms) ? s.reviewPlatforms.join(", ") : s.reviewPlatforms);
    put("Awards / certs", s.awards);
    put("Guarantees", s.guarantees);
    put("Warranty", s.warranty);
    put("Financing", s.financing ? (s.financingNote || "Yes") : "");
    put("Say this", s.sayThis);
    put("Never say", s.neverSay);

    const table = usps.length
      ? { head: ["claim", "proof"], body: usps.map((r) => [r.claim || "", r.proof || ""]) }
      : null;

    const open = [];

    if (THIN_PHOTOS.indexOf(s.photoStatus) > -1) {
      open.push({
        what: "No usable photography — blocks landing pages",
        detail: s.photoStatus === "Stock only"
          ? "Stock photos on a home-services page read as fake and kill conversion. Need real trucks and crews before build."
          : "There is nothing to build a page with. Phone pics of trucks, crews and finished jobs are the minimum.",
      });
    }
    if (!filled(s.reviewCount)) {
      open.push({
        what: "Google review count not captured",
        detail: "No baseline to measure review growth against, and no number we can put in ad copy.",
      });
    }
    usps.forEach((r) => {
      if (filled(r.claim) && !filled(r.proof)) {
        open.push({
          what: "Unproven claim — “" + r.claim + "”",
          detail: "Nothing behind it yet. Can't run it in copy until someone can back it up.",
        });
      }
    });

    const out = { rows, open };
    if (table) out.table = table;
    return out;
  },
};
