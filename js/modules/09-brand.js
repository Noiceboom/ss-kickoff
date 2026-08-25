// ============================================================
// 09 — Brand
// ============================================================
//
// Assets and voice. The proof half — review counts, awards, guarantees,
// warranties — came out: it belongs to the sales conversation, not to the
// people who have to write the ads.
//
// Tone is captured on bipolar scales rather than in prose. "Keep it
// professional" means five different things to five different people;
// dragging a marker between "Formal" and "Conversational" while the owner
// watches settles it in a way a text box never does, and the reader of the
// brief gets the same answer the owner gave.

import { sectionHead, skipRow, field, chipGroup, scale, upload, statusFor, filled, esc, ICON } from "../ui.js";
import { isSkipped, slot } from "../state.js";
import { humanSize, MAX_MB } from "../assets.js";

const ID = "brand";

const CORE = ["logoStatus", "colors", "photoStatus"];

const LOGO = [
  { value: "vector", label: "Have vector" },
  { value: "raster", label: "Raster only" },
  { value: "none", label: "Need one" },
  { value: "redesign", label: "Needs a redesign" },
];

const GUIDE = [
  { value: "yes", label: "They have one" },
  { value: "partial", label: "Bits and pieces" },
  { value: "no", label: "Nothing written down" },
];

const PHOTOS = [
  { value: "pro", label: "Professional shoot" },
  { value: "phone", label: "Phone pics" },
  { value: "stock", label: "Stock only" },
  { value: "none", label: "Nothing" },
];

/**
 * Each pair is a real decision someone has to make while writing an ad.
 * Nothing here is a virtue scale — both ends are legitimate places to be.
 */
const TONE = [
  { key: "formal", label: "How formal?", left: "Formal", right: "Conversational",
    help: "Sir/ma'am and full sentences, or “we'll get someone out there today”." },
  { key: "premium", label: "Where do they sit on price?", left: "Best value", right: "Premium",
    help: "Decides whether copy leads on price or on doing it properly." },
  { key: "urgency", label: "How hard do we push?", left: "Reassuring", right: "Urgent",
    help: "Emergency trades earn urgency. Everyone else sounds desperate using it." },
  { key: "local", label: "Corporate or family-run?", left: "Established", right: "Family-run",
    help: "Most home services win on the second. Franchises often can't claim it." },
  { key: "technical", label: "How technical?", left: "Plain-spoken", right: "Technical",
    help: "How much they want the homeowner told about the actual work." },
  { key: "playful", label: "Any humour?", left: "Straight", right: "Playful",
    help: "A mascot and a pun, or strictly business." },
];

export default {
  id: ID,
  nav: "Brand",
  title: "What do we have to work with?",
  lede: "The assets we'd be building with, and how they want to sound. Tone gets dragged rather than described — everyone agrees they want to sound professional, and nobody means the same thing by it.",
  skippable: true,
  notePrompt:
    "How they talk about themselves. Phrases worth stealing, and anything they'd hate seeing in an ad.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");
    const files = ctx.transient[ID] || {};

    return (
      sectionHead(ctx.num, this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Logo</div>' +
        chipGroup(ID, "logoStatus", "What have they got?", s.logoStatus, LOGO, {
          help: "Vector means .ai / .eps / .svg. A 400px PNG off the old site is raster only.",
        }) +
        '<div class="fields one" style="margin-top:20px">' +
          upload(ID, "logoFile", "Upload it", s.logoFile, {
            accept: "image/*,.ai,.eps,.svg,.pdf",
            cta: "Choose a logo file",
            hint: "SVG, PNG, AI, EPS or PDF · up to " + MAX_MB + "MB",
            previewUrl: files.logoUrl,
            sizeLabel: s.logoFile ? humanSize(s.logoFile.size) : "",
            help: "Held on this machine so it isn't lost before the call ends. It does not travel with the share link — download it and file it properly.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Brand guide</div>' +
        chipGroup(ID, "guideStatus", "Is anything written down?", s.guideStatus, GUIDE, {
          help: "Even a one-page PDF from whoever built the truck wrap counts.",
        }) +
        (s.guideStatus && s.guideStatus !== "no"
          ? '<div class="fields one" style="margin-top:20px">' +
              upload(ID, "guideFile", "Upload the guide", s.guideFile, {
                accept: ".pdf,image/*,.doc,.docx,.ai,.indd",
                cta: "Choose the brand guide",
                hint: "PDF or images · up to " + MAX_MB + "MB",
                previewUrl: files.guideUrl,
                sizeLabel: s.guideFile ? humanSize(s.guideFile.size) : "",
              }) +
            "</div>"
          : "") +
        '<div class="fields two" style="margin-top:20px">' +
          field(ID, "colors", "Brand colors", v("colors"), {
            placeholder: "#1B4D3E green, #DDB458 gold, white",
            help: "Hex codes if they have them, plain names if they don't. We'll pull the rest off the truck wrap.",
          }) +
          field(ID, "fonts", "Fonts they use", v("fonts"), {
            placeholder: "Whatever the sign shop used",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Photography</div>' +
        chipGroup(ID, "photoStatus", "Photo library", s.photoStatus, PHOTOS, {
          help: "Real trucks, real crews, real jobs. This is the single biggest driver of landing page conversion.",
        }) +
        (s.photoStatus === "stock" || s.photoStatus === "none"
          ? '<div class="fields one" style="margin-top:18px">' +
              field(ID, "photoPlan", "How we fix that", v("photoPlan"), {
                type: "longtext",
                placeholder: "Owner shoots the next three jobs on his phone. We pick the usable ones.",
                help: "Stock photos of models in clean polos cost conversions. Worth solving in week one.",
              }) +
            "</div>"
          : "") +
      "</div>" +

      '<div class="card">' +
        "<h3>How should they sound?</h3>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
          "Drag each one while they watch. Both ends are legitimate &mdash; this is about which " +
          "one is <em>them</em>, not which is better." +
        "</div>" +
        '<div class="fields scales" style="margin-top:26px">' +
          TONE.map((t) => scale(ID, "tone_" + t.key, t.label, s["tone_" + t.key], t.left, t.right, { help: t.help })).join("") +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Words</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "sayThis", "Phrases they want used", v("sayThis"), {
            type: "longtext",
            placeholder: "“Straight-forward pricing.” “We show up when we say we will.”",
            help: "Their own words, verbatim. These end up in headlines.",
          }) +
          field(ID, "neverSay", "Phrases we must never use", v("neverSay"), {
            type: "longtext",
            placeholder: "Don't say “cheap”. Never “handyman”. He isn't a plumber, he's a master plumber.",
            help: "Ask directly. Every owner has at least one, and finding it in a live ad is expensive.",
          }) +
          field(ID, "howTheyDescribe", "How they describe themselves in one line", v("howTheyDescribe"), {
            placeholder: "We're the guys who actually answer the phone.",
            help: "Say it back to them at the end of the call. If they wince, it's wrong.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const label = (list, val) => {
      const hit = list.find((o) => o.value === val);
      return hit ? hit.label : val;
    };

    const rows = [];
    const put = (k, val) => { if (filled(val)) rows.push([k, val]); };

    put("Logo", label(LOGO, s.logoStatus));
    put("Logo file", s.logoFile ? s.logoFile.name + " (" + humanSize(s.logoFile.size) + ")" : "");
    put("Brand guide", label(GUIDE, s.guideStatus));
    put("Guide file", s.guideFile ? s.guideFile.name + " (" + humanSize(s.guideFile.size) + ")" : "");
    put("Colors", s.colors);
    put("Fonts", s.fonts);
    put("Photography", label(PHOTOS, s.photoStatus));
    put("Photo plan", s.photoPlan);

    // Tone reads as a table so the brief shows where each dial landed
    const toneRows = TONE
      .filter((t) => filled(s["tone_" + t.key]))
      .map((t) => {
        const n = Number(s["tone_" + t.key]);
        const lean = n <= 15 ? t.left : n <= 40 ? "leans " + t.left.toLowerCase()
          : n < 60 ? "middle" : n < 85 ? "leans " + t.right.toLowerCase() : t.right;
        return [t.label, t.left + " ↔ " + t.right, lean];
      });

    put("Says", s.sayThis);
    put("Never says", s.neverSay);
    put("In their words", s.howTheyDescribe);

    const open = [];
    if (s.logoStatus === "raster" && !s.logoFile) {
      open.push({ what: "Logo", detail: "Raster only and nothing uploaded — we'll need the original before anything goes to print" });
    }
    if ((s.logoStatus === "none" || s.logoStatus === "redesign") && !filled(s.photoPlan)) {
      open.push({ what: "Logo", detail: "They need one made — scope it before the site build starts" });
    }
    if (s.photoStatus === "stock" || s.photoStatus === "none") {
      open.push({ what: "Photography", detail: "No real photos — the single biggest drag on landing page conversion" });
    }
    if (!toneRows.length) {
      open.push({ what: "Tone", detail: "Nothing set — the copywriter is guessing" });
    }
    if (!filled(s.neverSay)) {
      open.push({ what: "Words to avoid", detail: "Never asked. Every owner has one, and finding it in a live ad is expensive" });
    }

    const out = { rows, open };
    if (toneRows.length) out.table = { head: ["dial", "scale", "where it landed"], body: toneRows };
    return out;
  },
};
