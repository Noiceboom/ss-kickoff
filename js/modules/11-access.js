// ============================================================
// 11 — Access
// ============================================================
//
// A STATUS TRACKER, not a credential store. It records whether we were
// let in. Nothing else.
//
// The design constraint is deliberate: on a live call a client will read
// a password out loud, and it lands in whatever box is nearest. So there
// is no box it could reasonably land in. Status is an enum; there is no
// free-text field on an account row at all.
//
// Leadsie comes first because it is how this actually gets done — one
// link, they click through their own Google and Meta logins, and most of
// the roster below turns green without anybody typing anything. The
// account list is the fallback and the audit trail, not the main event.
//
// Same rules as every other module: pure render, no listeners, no writes.

import {
  esc, sectionHead, skipRow, field, rowGroup, statusPicker, chipGroup, warnBox,
  STATUSES, ICON, filled,
} from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "access";

export const LEADSIE_URL = "https://app.leadsie.com/connect/servicescalers/manage";

// Keys are persisted, so `key` is stable forever — renaming one orphans
// that account's saved status.
//
// CORE is what we need on essentially every account. EXTRA is everything
// else: real, but only worth putting on screen when it comes up, so it
// doesn't pad the list with twelve rows nobody fills in.
const CORE = [
  { key: "ga4", label: "Google Analytics", note: "Editor. Check it's GA4 and not a dead Universal property." },
  { key: "gsc", label: "Google Search Console", note: "Full user. If nobody has it, we verify via DNS." },
  { key: "gads", label: "Google Ads", note: "Standard access on their existing account — we don't start a fresh one." },
  { key: "gtm", label: "Google Tag Manager", note: "Publish rights, or nothing we build can go live." },
  { key: "crm", label: "CRM", note: "ServiceTitan, Housecall Pro, Jobber. Read access is enough — we need it to close the loop on lead quality." },
  { key: "web", label: "Website", note: "Admin on whatever the site runs on." },
  { key: "host", label: "Hosting", note: "Who controls the hosting account. Often not the same person as the site." },
  { key: "meta", label: "Meta", note: "Partner access to the Business Manager, not a personal page invite." },
];

const EXTRA = [
  { key: "gbp", label: "Google Business Profile", note: "Manager access. Worth grabbing when local is in play." },
  { key: "dns", label: "Domain / DNS registrar", note: "Often the web guy from 2016. This one takes weeks." },
  { key: "calls", label: "Call tracking", note: "CallRail or similar, if they already run one." },
  { key: "reviews", label: "Review platform", note: "Whatever sends the review requests, if anything." },
  { key: "email", label: "Email / sending domain", note: "Who can add DNS records for sending." },
  { key: "bing", label: "Bing / Microsoft Ads", note: "Usually forgotten and still spending." },
  { key: "yelp", label: "Yelp", note: "Ads or just the listing." },
  { key: "social", label: "Other social", note: "Instagram, LinkedIn, TikTok, YouTube." },
];

const BY_KEY = {};
CORE.concat(EXTRA).forEach((a) => { BY_KEY[a.key] = a; });

const LEADSIE = [
  { value: "notsent", label: "Not sent yet" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partly connected" },
  { value: "done", label: "All connected" },
];

const STATUS_OPTIONS = [{ value: "", label: "—" }].concat(STATUSES);

function statusLabel(v) {
  const hit = STATUSES.filter((s) => s.value === v)[0];
  return hit ? hit.label : "";
}

/** Extras the call actually put in play. */
function extrasOn(s) {
  return Array.isArray(s.extra) ? s.extra : [];
}

/** Every account with a status set, fixed roster plus anything added live. */
function touchedRows(state) {
  const s = state.m[ID] || {};
  const out = [];

  CORE.concat(EXTRA.filter((a) => extrasOn(s).indexOf(a.key) > -1)).forEach((a) => {
    const status = s["status_" + a.key] || "";
    if (filled(status)) out.push({ label: a.label, status: status });
  });

  (Array.isArray(s.custom) ? s.custom : []).forEach((r) => {
    if (filled(r.account) || filled(r.status)) {
      out.push({ label: r.account || "Unnamed account", status: r.status || "" });
    }
  });

  return out;
}

function card(a, value) {
  return (
    '<div class="item">' +
      "<h3>" + esc(a.label) + "</h3>" +
      '<div style="font-size:13px;color:var(--muted);margin-top:6px;line-height:1.45">' + esc(a.note) + "</div>" +
      '<div style="margin-top:14px">' + statusPicker(ID, "status_" + a.key, value) + "</div>" +
    "</div>"
  );
}

function extraTile(a, on) {
  return (
    '<div class="tile' + (on ? " on" : "") + '">' +
      '<button class="tilebtn" data-chip="' + ID + "|extra|" + esc(a.key) + '" data-multi="1">' +
        '<span class="box">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" ' +
          'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        "</span>" +
        '<span class="nm">' + esc(a.label) + "</span>" +
      "</button>" +
    "</div>"
  );
}

export default {
  id: ID,
  nav: "Access",
  title: "Can we get in?",
  lede: "Send the Leadsie link and most of this answers itself. What's left is the handful of accounts Leadsie can't reach — and whoever's sitting on them.",
  skippable: true,
  notePrompt:
    "Who actually holds the logins, and what it'll take to get in. No credentials.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");
    const on = extrasOn(s);

    const chosen = EXTRA.filter((a) => on.indexOf(a.key) > -1);

    return (
      sectionHead(ctx.num, this.title, this.lede) +

      warnBox(
        "<strong>No credentials in this document.</strong> Never type a password, API key, " +
        "token or recovery code into any box on this page — the whole kickoff can be shared " +
        "as a link. This screen records <em>whether access was granted</em>, and nothing " +
        "else. If a client starts reading a login out loud, stop them and send them the " +
        "Leadsie link instead.",
        ICON.lock
      ) +

      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Start here</div>' +
        "<h3 style=\"margin-top:6px\">Send them the Leadsie link</h3>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:6px;line-height:1.5">' +
          "One link, they sign in with the accounts they already have, and we get " +
          "everything Google and Meta in one go. Do it <em>on the call</em> while " +
          "whoever owns the logins is still on the phone." +
        "</div>" +
        '<div class="linkrow">' +
          '<code>' + esc(LEADSIE_URL) + "</code>" +
          '<button class="btn sm" data-copy="' + esc(LEADSIE_URL) + '">Copy link</button>' +
        "</div>" +
        '<div style="margin-top:20px">' +
          chipGroup(ID, "leadsie", "Where did it get to?", s.leadsie, LEADSIE, {
            help: "If it's still “Sent” when the call ends, that's the first follow-up.",
          }) +
        "</div>" +
        '<div class="fields one" style="margin-top:18px">' +
          field(ID, "leadsieWho", "Who's clicking it?", v("leadsieWho"), {
            placeholder: "Mike — he's the one with the Google login",
            help: "It has to be whoever is actually signed in to the accounts, not whoever answers email.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">What we need</div>' +
        '<div style="font-size:14px;color:var(--muted);margin:4px 0 20px">' +
          "Anything left on Pending or Blocked is what holds up launch, so it goes straight " +
          "into the readout as an action." +
        "</div>" +
        '<div class="grid">' + CORE.map((a) => card(a, v("status_" + a.key))).join("") + "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Anything else in play</div>' +
        '<div style="font-size:14px;color:var(--muted);margin:4px 0 18px">' +
          "Tap what came up. These aren't on every account, so they only appear once you say they exist." +
        "</div>" +
        '<div class="pickgrid">' + EXTRA.map((a) => extraTile(a, on.indexOf(a.key) > -1)).join("") + "</div>" +
        (chosen.length
          ? '<div class="grid" style="margin-top:22px">' +
              chosen.map((a) => card(a, v("status_" + a.key))).join("") +
            "</div>"
          : "") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Something we don\'t have a box for</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "A listings tool nobody remembers buying, an old scheduling system, whatever it is." +
        "</div>" +
        '<div style="margin-top:18px">' +
          rowGroup(ID, "custom", [
            { key: "account", label: "Account", placeholder: "That listings tool" },
            { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, width: "170px" },
          ], getRows(ctx.state, ID, "custom"), {
            addLabel: "Add an account",
            empty: "Nothing extra yet.",
          }) +
        "</div>" +
      "</div>"
    );
  },

  status(ctx) {
    const s = ctx.state.m[ID] || {};
    const hits = CORE.filter((a) => filled(s["status_" + a.key])).length;
    if (!hits && !filled(s.leadsie)) return "empty";
    return hits === CORE.length ? "done" : "partial";
  },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    const rows = touchedRows(ctx.state);
    const open = [];

    const lead = LEADSIE.filter((o) => o.value === s.leadsie)[0];
    const meta = [];
    if (lead) meta.push(["Leadsie link", lead.label]);
    if (filled(s.leadsieWho)) meta.push(["Clicking it", s.leadsieWho]);

    if (!filled(s.leadsie) || s.leadsie === "notsent") {
      open.push({
        what: "Leadsie link not sent",
        detail: "One link covers most of the Google and Meta access — send it before anything else.",
      });
    } else if (s.leadsie === "sent" || s.leadsie === "partial") {
      open.push({
        what: "Leadsie link outstanding",
        detail: (filled(s.leadsieWho) ? s.leadsieWho + " still has to click through." : "Still waiting on the client to click through.") +
          " Chase it the same day.",
      });
    }

    rows.forEach((r) => {
      if (r.status !== "pending" && r.status !== "blocked") return;
      open.push({
        what: r.label + " access — " + r.status,
        detail: "Not resolved on the call. Decide who chases it before the build starts.",
      });
    });

    if (!rows.length && !meta.length) return null;

    const out = { rows: meta, open };
    if (rows.length) {
      out.table = {
        head: ["account", "status"],
        body: rows.map((r) => [r.label, statusLabel(r.status) || r.status]),
      };
    }
    return out;
  },
};
