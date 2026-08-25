// ============================================================
// 03 — Current marketing & spend
// ============================================================
//
// What's already running, who's running it, and what it costs. The
// channel rows are the useful artefact — they roll straight into the
// readout table and the CSV, so the build order starts from what exists
// rather than from a blank page.

import { sectionHead, skipRow, field, rowGroup, statusFor, filled } from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "marketing";

// Keys that count toward "done". Anything not listed is a bonus field.
const CORE = ["channels", "worked", "burned"];

const CHANNELS = [
  { value: "", label: "—" },
  "Google Ads",
  "LSA",
  "SEO",
  "GBP",
  "Meta",
  "Yelp",
  "Angi",
  "Direct mail",
  "Radio/TV",
  "Truck wraps",
  "Referral",
  "Other",
];

const WORKING = [
  { value: "", label: "—" },
  "Working",
  "Mixed",
  "Not working",
  "Unknown",
];

const COLS = [
  { key: "channel", label: "Channel", type: "select", width: "1.1fr", options: CHANNELS },
  { key: "spend", label: "Spend / mo", width: "0.8fr", placeholder: "$4,000" },
  { key: "who", label: "Who runs it", width: "1.1fr", placeholder: "In-house, or the agency's name" },
  { key: "working", label: "How it's working", type: "select", width: "1fr", options: WORKING },
];

export default {
  id: ID,
  nav: "Marketing now",
  title: "What's running today?",
  lede: "Everything they're already paying for, whether or not they think it works. Add a row per channel — a wrong guess on the spend is still more useful than an empty row.",
  skippable: true,

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    return (
      sectionHead("03", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Who has it now</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "If someone else holds the accounts, the handover dates set our start date. Get them on the call, not by email later." +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "agency", "Incumbent agency", v("agency"), {
            placeholder: "Blue Corona — or “nobody, we do it ourselves”",
            help: "Leave blank if it's all in-house.",
          }) +
          field(ID, "contractEnd", "Contract ends", v("contractEnd"), {
            placeholder: "31 March 2027",
            help: "Month and year is enough. If they don't know, that's the first thing to go find.",
          }) +
          field(ID, "notice", "Notice period", v("notice"), {
            placeholder: "60 days, written",
            help: "How much warning they owe before walking. Decides when we can switch anything on.",
          }) +
          field(ID, "ownsAccounts", "Who owns the ad accounts?", v("ownsAccounts"), {
            placeholder: "Agency's MCC — never been under the client",
            help: "If the agency owns them, the history doesn't come with us. Flag it now.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Channels &amp; spend</div>' +
        rowGroup(ID, "channels", COLS, getRows(ctx.state, ID, "channels"), {
          addLabel: "Add channel",
          empty: "No channels yet. Start with wherever the phone rings from most, then work down to the things nobody's checked in a year.",
          help: "One row per channel. “Who runs it” can be a person, the agency, or the owner's nephew — write what's true.",
        }) +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What they&rsquo;ve learned the hard way</div>' +
        '<div class="fields one" style="margin-top:16px">' +
          field(ID, "worked", "What has actually worked?", v("worked"), {
            type: "longtext", rows: 3, wide: true,
            placeholder: "LSA has been the cheapest phone calls they've ever had. Truck wraps get named on half the inbound calls.",
            help: "Ask for the specific thing, not the channel. “Google worked” tells us nothing.",
          }) +
          field(ID, "burned", "What burned them?", v("burned"), {
            type: "longtext", rows: 3, wide: true,
            placeholder: "Two agencies in three years, both locked them into 12 months and reported on impressions.",
            help: "This is the one that shapes how we report and how often we call. Let them talk.",
          }) +
          field(ID, "wontTouch", "Anything they refuse to touch?", v("wontTouch"), {
            type: "longtext", rows: 2, wide: true,
            placeholder: "No Yelp, ever. No discount coupons — it drags in the wrong customer.",
            help: "Hard nos. Cheaper to hear it now than in the second month of a campaign.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

    const channels = getRows(ctx.state, ID, "channels");

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    put("Incumbent agency", s.agency);
    put("Contract ends", s.contractEnd);
    put("Notice period", s.notice);
    put("Ad account ownership", s.ownsAccounts);
    put("Channels running", channels.length ? String(channels.length) : "");
    put("What has worked", s.worked);
    put("What burned them", s.burned);
    put("Won't touch", s.wontTouch);

    const open = [];
    if (filled(s.agency) && !filled(s.contractEnd)) {
      open.push({
        what: "Incumbent contract end date",
        detail: "They're still with " + s.agency + " and nobody knows when that ends — it gates our start date",
      });
    }

    const out = { rows, open };

    // The channel grid goes out as a table so it lands in the CSV verbatim.
    if (channels.length) {
      out.table = {
        head: ["type", "channel", "spend / mo", "who runs it", "how it's working"],
        body: channels.map(function (r) {
          return [
            "channel",
            String(r.channel || "Unnamed"),
            String(r.spend || ""),
            String(r.who || ""),
            String(r.working || "Unknown"),
          ];
        }),
      };
    }

    return out;
  },
};
