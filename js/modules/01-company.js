// ============================================================
// 01 — Company & contact
// ============================================================
//
// Reference implementation for the form-shaped modules. Every screen
// follows this shape: sectionHead + skipRow + cards of fields, all built
// from the ui.js field kit. No listeners, no DOM, no state mutation.
//
// Business name and website arrive from the sales handoff via the client
// JSON — they are shown prefilled rather than asked for. Everything else
// gets found out on the call.

import { sectionHeadFor, skipRow, field, chipGroup, toggle, rowGroup, statusFor, filled, ICON } from "../ui.js";
import { isSkipped, slot, getRows } from "../state.js";
import { sayer, DISCOVERY } from "../modes.js";

const ID = "company";

/**
 * Billing goes to the point of contact unless someone said otherwise.
 *
 * "no" is the only value that means a second contact. Anything else —
 * including the legacy `true` and a session that never touched it — is
 * the same person, which is the usual answer and the one worth defaulting
 * to. See the note in render() for why this is not a toggle.
 */
function billingSameOf(s) { return (s || {}).billingSame !== "no"; }

// Keys that count toward "done". Anything not listed is a bonus field.
const CORE = ["contactName", "contactPhone", "contactEmail", "phone", "city", "hoursWeekday"];

// The sales call renders a fraction of this screen, so it cannot be
// judged against fields it never shows — every discovery session would
// read "empty" and land in the readout as a gap that was never asked.
const DISCOVERY_CORE = ["businessName", "crews", "customerMix"];

/* ── copy ─────────────────────────────────────────────── */

export const COPY = {
  lede: {
    kickoff: "The factual layer — the stuff that has to be identical everywhere it appears. Who we call, the number that rings, the address Google sees.",
    discovery: "The quick version — how long you've been going, how big the operation is, and who you actually sell to.",
  },
  title: { kickoff: "Who are they, on paper?", discovery: "Who are you, on paper?" },
  handoffLabel: { kickoff: "From the sales handoff", discovery: "The basics" },
  handoffLede: {
    kickoff: "Carried over from the deal — correct it here if sales got it wrong.",
    discovery: "Pulled off your site before the call. Correct anything we got wrong.",
  },
  founded: {
    kickoff: "Worth having — \"serving the metro since 2015\" earns its place in copy.",
    discovery: "Worth having — \"serving the metro since 2015\" earns its place in copy.",
    same: true,
  },
  contactRole: {
    kickoff: "And whether they can approve spend without asking anyone.",
    discovery: "So we know who we're talking to.",
  },
  coverageRadius: { kickoff: "How far will they drive?", discovery: "How far will you drive?" },
  customerMix: {
    kickoff: "Pick every one that's a real part of the business.",
    discovery: "Pick every one that's a real part of the business.",
    same: true,
  },
};

export default {
  id: ID,
  nav: "Company",
  title: "Who are they, on paper?",
  lede: COPY.lede.kickoff,
  skippable: true,
  notePrompt:
    "How the business actually runs — who answers the phone, who's really in charge, anything odd about the setup.",

  discovery: {
    nav: "Business",
    title: COPY.title.discovery,
    lede: COPY.lede.discovery,
    notePrompt: "Anything about how the business runs worth keeping.",
  },

  render(ctx) {
    const s = slot(ctx.state, ID);
    const c = ctx.client.client || {};
    const v = (k, fallback) => (s[k] !== undefined ? s[k] : (fallback || ""));
    // A CHIP, not a toggle. setField deletes a key set to "", and an
    // absent key is what the default reads as — so a default-on toggle
    // could never be switched off: clearing it restored the default.
    // Two explicit values have no such hole.
    const billingSame = s.billingSame !== "no";
    const t = sayer(COPY, ctx.mode);
    // Everything gated on this only matters once somebody has signed. On
    // the sales call there is no invoice to address, no number to swap for
    // a tracking one and no GBP for an address to match — and a prospect
    // asked for a billing contact in the first meeting is being asked to
    // feel sold to.
    const signed = ctx.mode !== DISCOVERY;

    return (
      sectionHeadFor(this, ctx) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">' + t("handoffLabel") + "</div>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          t("handoffLede") +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "businessName", "Business name", v("businessName", c.name), {
            placeholder: "Acme Plumbing",
            help: "What goes on the site, the ads and the GBP.",
          }) +
          field(ID, "website", "Website", v("website", c.website), {
            placeholder: "https://…",
          }) +
          field(ID, "founded", "Year founded", v("founded"), {
            type: "number", placeholder: "2015",
            help: t("founded"),
          }) +
          // Was under "Coverage". Neither is coverage — where they work is
          // the Cities screen's job — but how much crew they have and who
          // they sell to are worth knowing and had nowhere else to go.
          field(ID, "crews", "Trucks / crews on the road", v("crews"), {
            type: "number", placeholder: "6",
          }) +
        "</div>" +
      "</div>" +

      (signed ? (
      '<div class="card">' +
        "<h3>Who are we contacting?</h3>" +
        '<div style="font-size:14px;color:var(--muted);margin-top:5px">' +
          "The two names we'll actually need: the person who answers questions, and the person who pays invoices." +
        "</div>" +

        '<div class="mlabel" style="margin-top:26px">Point of contact</div>' +
        '<div class="fields" style="margin-top:12px">' +
          field(ID, "contactName", "Name", v("contactName"), { placeholder: "Mike Kessler" }) +
          field(ID, "contactEmail", "Email", v("contactEmail"), {
            type: "email", placeholder: "mike@acmeplumbing.com",
          }) +
          field(ID, "contactPhone", "Phone", v("contactPhone"), {
            type: "phone", placeholder: "(816) 555-0142",
          }) +
          field(ID, "contactRole", "Role", v("contactRole"), {
            placeholder: "Owner", help: t("contactRole"),
          }) +
          field(ID, "contactPref", "Best way to reach them", v("contactPref"), {
            type: "select",
            options: [
              { value: "", label: "—" },
              { value: "text", label: "Text" },
              { value: "call", label: "Call" },
              { value: "email", label: "Email" },
              { value: "slack", label: "Slack / Teams" },
            ],
            help: "Get this right and everything moves faster.",
          }) +
        "</div>" +

        '<div style="margin-top:30px;padding-top:24px;border-top:1px solid var(--line)">' +
          '<div class="mlabel">Anyone else</div>' +
          '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
            "Office manager, dispatcher, the son who runs the Facebook page. Anyone we'll end up emailing." +
          "</div>" +
          '<div style="margin-top:16px">' +
            rowGroup(ID, "people", [
              { key: "name", label: "Name", placeholder: "Dana Whitfield" },
              { key: "role", label: "Role", placeholder: "Office manager", width: "180px" },
              { key: "email", label: "Email", placeholder: "dana@acmeplumbing.com" },
              { key: "phone", label: "Phone", placeholder: "(816) 555-0143", width: "160px" },
            ], getRows(ctx.state, ID, "people"), {
              addLabel: "Add someone",
              empty: "Just the two above.",
            }) +
          "</div>" +
        "</div>" +

        '<div style="margin-top:30px;padding-top:24px;border-top:1px solid var(--line)">' +
          '<div class="mlabel">Billing contact</div>' +
          '<div style="margin-top:12px">' +
            chipGroup(ID, "billingSame", "Who pays the invoices?", billingSame ? "yes" : "no", [
              { value: "yes", label: "Same as the point of contact" },
              { value: "no", label: "Someone else" },
            ]) +
          "</div>" +
          (billingSame
            ? '<div style="margin-top:14px;font-size:14px;color:var(--muted)">' +
                "Invoices go to " +
                (filled(s.contactName) ? "<strong>" + escName(s.contactName) + "</strong>" : "the point of contact") +
                "." +
              "</div>"
            : '<div class="fields" style="margin-top:16px">' +
                field(ID, "billingName", "Name", v("billingName"), { placeholder: "Dana Kessler" }) +
                field(ID, "billingEmail", "Email", v("billingEmail"), {
                  type: "email", placeholder: "accounts@acmeplumbing.com",
                  help: "Where the invoice actually needs to land.",
                }) +
                field(ID, "billingPhone", "Phone", v("billingPhone"), {
                  type: "phone", placeholder: "(816) 555-0188",
                }) +
              "</div>") +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Name, address, phone</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Exactly as it should appear everywhere &mdash; the site, the ads, the Google profile, " +
          "every directory. Getting these three to agree is most of local SEO." +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "phone", "Main business phone", v("phone"), {
            type: "phone", placeholder: "(816) 555-0100",
            help: "The number that actually gets answered.",
          }) +
          // One card, because NAP is one thing. Split across two it was
          // possible to fill in an address that disagreed with the phone
          // number's listing and never see them side by side.
          field(ID, "street", "Street", v("street"), { placeholder: "1420 Baltimore Ave", wide: true }) +
          field(ID, "city", "City", v("city", c.market), { placeholder: "Kansas City" }) +
          field(ID, "state", "State", v("state"), { placeholder: "MO" }) +
          field(ID, "zip", "ZIP", v("zip"), { placeholder: "64108" }) +
        "</div>" +
        '<div style="margin-top:20px">' +
          toggle(ID, "serviceAreaBiz", "Service-area business (address hidden on GBP)", !!s.serviceAreaBiz) +
        "</div>" +
        '<div style="font-size:13px;color:var(--muted);margin-top:10px">' +
          "These three have to match the Google Business Profile character for character, " +
          "and match each other everywhere else." +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Hours</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "hoursWeekday", "Mon–Fri", v("hoursWeekday"), { placeholder: "7am – 7pm" }) +
          field(ID, "hoursWeekend", "Sat–Sun", v("hoursWeekend"), { placeholder: "8am – 5pm, Sun closed" }) +
        "</div>" +
        '<div style="margin-top:20px">' +
          toggle(ID, "emergency", "Runs a 24/7 emergency line", !!s.emergency) +
        "</div>" +
        (s.emergency
          ? chipGroup(ID, "afterHoursWho", "Who picks up after hours?", s.afterHoursWho, [
              { value: "human", label: "A person" },
              { value: "ai", label: "AI answering" },
              { value: "service", label: "Answering service" },
              { value: "voicemail", label: "Voicemail" },
            ], { help: "Changes what we can promise in ad copy, and what a missed call actually costs." }) +
            '<div class="fields one" style="margin-top:18px">' +
              field(ID, "emergencyNote", "How after-hours actually works", v("emergencyNote"), {
                type: "longtext",
                placeholder: "Answering service until 10pm, on-call tech after. Premium rate after midnight.",
                help: "Worth getting right — it changes what we can promise in ad copy.",
              }) +
            "</div>"
          : "") +
      "</div>"
      ) : "") +

            '<div class="card">' +
        '<div class="mlabel">Who they sell to</div>' +
        chipGroup(ID, "customerMix", "Customer mix", s.customerMix, [
          "Residential", "Commercial", "New construction", "Property management", "Warranty / home shield",
        ], { multi: true, help: t("customerMix") }) +
      "</div>"
    );
  },

  status(ctx) {
    return statusFor(ctx.state.m[ID], ctx.mode === DISCOVERY ? DISCOVERY_CORE : CORE);
  },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;
    const signed = ctx.mode !== DISCOVERY;

    const addr = [s.street, s.city, s.state, s.zip].filter(Boolean).join(", ");
    const hours = [
      s.hoursWeekday ? "Mon–Fri " + s.hoursWeekday : "",
      s.hoursWeekend ? "Sat–Sun " + s.hoursWeekend : "",
      s.emergency ? "24/7 emergency line" : "",
    ].filter(Boolean).join(" · ");

    const who = (name, email, phone, role) =>
      [name, role, email, phone].filter(Boolean).join(" · ");

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    put("Business name", s.businessName);
    put("Website", s.website);
    put("Founded", s.founded);
    put("Point of contact", who(s.contactName, s.contactEmail, s.contactPhone, s.contactRole));
    put("Reach them by", s.contactPref);
    put("After-hours cover", { human: "A person", ai: "AI answering", service: "Answering service", voicemail: "Voicemail" }[s.afterHoursWho] || "");
    put("Billing contact", billingSameOf(s)
      ? "Same as point of contact" + (s.contactName ? " (" + s.contactName + ")" : "")
      : who(s.billingName, s.billingEmail, s.billingPhone));
    // Everyone else we'll end up emailing — otherwise the office manager
    // exists on screen and nowhere the work actually gets read.
    for (const r of (Array.isArray(s.people) ? s.people : [])) {
      if (!r || !(r.name || r.email)) continue;
      const who = [r.role, r.email, r.phone].filter(Boolean).join(" · ");
      rows.push([r.name || "Also", who]);
    }
    put("Main business phone", s.phone);
    put("Address", s.serviceAreaBiz ? (addr ? addr + " (hidden on GBP)" : "Service-area business") : addr);
    put("Hours", hours);
    put("After hours", s.emergencyNote);
    put("Drive radius", s.radius);
    put("Crews", s.crews);
    put("Customer mix", Array.isArray(s.customerMix) ? s.customerMix.join(", ") : s.customerMix);

    // Every open item below chases something that only exists after a
    // signature. Raised on a sales call they would read as a list of
    // things the prospect had failed to hand over.
    const open = [];
    if (!signed) return { rows, open };
    if (!filled(s.contactName)) {
      open.push({ what: "Point of contact", detail: "No named contact — nobody to chase for anything below",
        ask: "Tell us who we should be speaking to day to day." });
    }
    if (!filled(s.contactEmail) && !filled(s.contactPhone)) {
      open.push({ what: "Contact details", detail: "No email or phone for the point of contact",
        ask: "Send us a direct email and phone number for your main contact." });
    }
    // When billing falls back to the point of contact, that contact's email
    // IS the billing email — so a blank one still means invoices have nowhere
    // to go. The old check skipped this case entirely.
    if (billingSameOf(s)) {
      if (!filled(s.contactEmail)) {
        open.push({
          what: "Billing contact",
          detail: "Billing is set to the point of contact, but no email for them — invoices have nowhere to go",
          ask: "Send us the email address invoices should go to.",
        });
      }
    } else if (!filled(s.billingEmail)) {
      open.push({ what: "Billing contact", detail: "No billing email — the first invoice will bounce around",
        ask: "Send us the email address invoices should go to." });
    }
    if (!filled(s.phone)) {
      open.push({ what: "Main business phone", detail: "Blocks call tracking setup and ad extensions",
        ask: "Confirm the main phone number you want used in your ads." });
    }
    if (s.trackingOk === "unsure") {
      open.push({ what: "Call tracking", detail: "They weren't sure about swapping the number — needs a decision",
        ask: "Let us know if we can use a call-tracking number on your site." });
    }

    return { rows, open };
  },
};

/** Small local escape — the field kit handles its own, this is for inline prose. */
function escName(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
