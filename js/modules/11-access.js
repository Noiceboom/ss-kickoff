// ============================================================
// 11 — Access
// ============================================================
//
// A STATUS TRACKER, not a credential store. It records who owns an
// account and whether we were let in. Nothing else.
//
// The design constraint is deliberate: on a live call a client will read
// a password out loud, and it lands in whatever box is nearest. So there
// is no box it could reasonably land in. Owner is a name or a role,
// status is an enum, and "how to request" is a fixed select — never free
// text. See the Security section of the spec.
//
// Same rules as every other module: pure render, no listeners, no writes.

import {
  esc, sectionHead, skipRow, field, rowGroup, statusPicker, warnBox,
  STATUSES, ICON, filled,
} from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";

const ID = "access";

// The fixed roster. Keys are persisted, so `key` is stable forever —
// renaming one orphans that row's saved owner and status.
const ACCOUNTS = [
  { key: "gbp", label: "Google Business Profile", note: "Manager access. The one that stalls everything else if it's missing." },
  { key: "gads", label: "Google Ads", note: "Standard access on their existing account — we don't start a fresh one." },
  { key: "ga4", label: "Google Analytics 4", note: "Editor. Check it's GA4 and not a dead Universal property." },
  { key: "gsc", label: "Search Console", note: "Full user. If nobody has it, we verify via DNS." },
  { key: "gtm", label: "Google Tag Manager", note: "Publish rights, or nothing we build can go live." },
  { key: "meta", label: "Meta Business Manager", note: "Partner access to the business, not a personal page invite." },
  { key: "calls", label: "Call tracking (CallRail etc)", note: "Existing account or we spin one up under our own billing." },
  { key: "dns", label: "Domain / DNS registrar", note: "Often the web guy from 2016. Find out early — this one takes weeks." },
  { key: "host", label: "Website hosting / CMS", note: "Admin on the CMS plus who controls the hosting account." },
  { key: "crm", label: "CRM / FSM (ServiceTitan, Housecall Pro etc)", note: "Read access is enough. We need it to close the loop on lead quality." },
  { key: "reviews", label: "Review platform", note: "Whatever tool sends the review requests, if any." },
  { key: "email", label: "Email / sending domain", note: "Who can add DNS records for sending. Matters for any outbound." },
];

// The only answers to "how do we get in". No free-text option, on purpose.
const HOW = [
  { value: "", label: "—" },
  "Client adds us as user",
  "Client sends invite",
  "We send access request",
  "Agency handoff needed",
  "Client doesn't have one",
  "Needs vendor support",
  "Unknown",
];

const STATUS_OPTIONS = [{ value: "", label: "—" }].concat(STATUSES);

function statusLabel(v) {
  const hit = STATUSES.filter((s) => s.value === v)[0];
  return hit ? hit.label : "";
}

/** Every row — fixed roster plus anything added on the call — with a value set. */
function touchedRows(state) {
  const s = state.m[ID] || {};
  const out = [];

  ACCOUNTS.forEach((a) => {
    const owner = s["owner_" + a.key] || "";
    const status = s["status_" + a.key] || "";
    const how = s["how_" + a.key] || "";
    if (filled(owner) || filled(status) || filled(how)) {
      out.push({ label: a.label, owner: owner, status: status, how: how });
    }
  });

  (Array.isArray(s.custom) ? s.custom : []).forEach((r) => {
    if (filled(r.account) || filled(r.owner) || filled(r.status) || filled(r.how)) {
      out.push({ label: r.account || "Unnamed account", owner: r.owner || "", status: r.status || "", how: r.how || "" });
    }
  });

  return out;
}

export default {
  id: ID,
  nav: "Access",
  title: "Who owns what, and can we get in?",
  lede: "Ownership and status only. We are not collecting logins here — we're finding out whose name is on each account and what it takes to be added.",
  skippable: true,
  notePrompt:
    "Who actually holds the logins, and what it'll take to get in. No credentials.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const v = (k) => (s[k] !== undefined ? s[k] : "");

    const cards = ACCOUNTS.map(function (a) {
      return (
        '<div class="item">' +
          "<h3>" + esc(a.label) + "</h3>" +
          '<div style="font-size:13px;color:var(--muted);margin-top:6px;line-height:1.45">' + esc(a.note) + "</div>" +
          '<div style="margin-top:14px">' + statusPicker(ID, "status_" + a.key, v("status_" + a.key)) + "</div>" +
          '<div class="fields one" style="margin-top:16px">' +
            field(ID, "owner_" + a.key, "Owner", v("owner_" + a.key), {
              placeholder: "Name or role — e.g. Mike, office manager",
            }) +
            field(ID, "how_" + a.key, "How we get it", v("how_" + a.key), {
              type: "select", options: HOW,
            }) +
          "</div>" +
        "</div>"
      );
    }).join("");

    return (
      sectionHead("11", this.title, this.lede) +

      warnBox(
        "<strong>No credentials in this document.</strong> Never type a password, API key, " +
        "token or recovery code into any box on this page — the whole kickoff can be shared " +
        "as a link. This screen records <em>who owns</em> an account and <em>whether access " +
        "was granted</em>, and nothing else. If a client starts reading a login out loud, " +
        "stop them and send them to the password manager.",
        ICON.lock
      ) +

      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">The standard twelve</div>' +
        '<div style="font-size:14px;color:var(--muted);margin:4px 0 20px">' +
          "Anything left on Pending or Blocked is what holds up launch, so it goes straight into the readout as an action." +
        "</div>" +
        '<div class="grid">' + cards + "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Anything else</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Yelp Ads, an old Bing account, a listings tool nobody remembers buying — same three columns." +
        "</div>" +
        '<div style="margin-top:18px">' +
          rowGroup(ID, "custom", [
            { key: "account", label: "Account", placeholder: "Yelp Ads" },
            { key: "owner", label: "Owner", placeholder: "Name or role" },
            { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, width: "150px" },
            { key: "how", label: "How to request", type: "select", options: HOW, width: "230px" },
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
    const hits = ACCOUNTS.filter((a) => filled(s["status_" + a.key])).length;
    if (!hits) return "empty";
    return hits === ACCOUNTS.length ? "done" : "partial";
  },

  summary(ctx) {
    const rows = touchedRows(ctx.state);
    if (!rows.length) return null;

    const table = {
      head: ["account", "owner", "status", "how to request"],
      body: rows.map((r) => [r.label, r.owner, statusLabel(r.status) || r.status, r.how]),
    };

    // Pending and blocked are precisely the things that stall a launch,
    // so they read as actions rather than as a status report.
    const open = [];
    rows.forEach((r) => {
      if (r.status !== "pending" && r.status !== "blocked") return;
      const who = filled(r.owner) ? " with " + r.owner : "";
      open.push({
        what: r.label + " access — " + r.status + who,
        detail: filled(r.how)
          ? r.how
          : "No route agreed yet — decide who asks and how before the build starts.",
      });
    });

    return { table, open };
  },
};
