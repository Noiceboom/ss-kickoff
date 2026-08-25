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

import { sectionHead, skipRow, field, chipGroup, toggle, statusFor, filled, ICON } from "../ui.js";
import { isSkipped, slot } from "../state.js";

const ID = "company";

// Keys that count toward "done". Anything not listed is a bonus field.
const CORE = ["contactName", "contactPhone", "contactEmail", "phone", "city", "hoursWeekday"];

export default {
  id: ID,
  nav: "Company",
  title: "Who are they, on paper?",
  lede: "The factual layer — the stuff that has to be identical everywhere it appears. Who we call, the number that rings, the address Google sees.",
  skippable: true,
  notePrompt:
    "How the business actually runs — who answers the phone, who's really in charge, anything odd about the setup.",

  render(ctx) {
    const s = slot(ctx.state, ID);
    const c = ctx.client.client || {};
    const v = (k, fallback) => (s[k] !== undefined ? s[k] : (fallback || ""));
    const billingSame = !!s.billingSame;

    return (
      sectionHead("01", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">From the sales handoff</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Carried over from the deal — correct it here if sales got it wrong." +
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
            help: "Worth having — \"serving the metro since 2015\" earns its place in copy.",
          }) +
        "</div>" +
      "</div>" +

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
            placeholder: "Owner", help: "And whether they can approve spend without asking anyone.",
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
          '<div class="mlabel">Billing contact</div>' +
          '<div style="margin-top:12px">' +
            toggle(ID, "billingSame", "Same as the point of contact", billingSame) +
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
        '<div class="mlabel">The number that rings</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Not who we call &mdash; what the customer calls. This is what goes on the ads." +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "phone", "Main business phone", v("phone"), {
            type: "phone", placeholder: "(816) 555-0100",
            help: "The number that actually gets answered.",
          }) +
          field(ID, "trackingOk", "Can we swap in a tracking number?", v("trackingOk"), {
            type: "select",
            options: [
              { value: "", label: "—" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "unsure", label: "Needs a conversation" },
            ],
          }) +
          field(ID, "leadEmail", "Where web leads should land", v("leadEmail"), {
            type: "email", placeholder: "office@acmeplumbing.com",
            help: "Form fills, not invoices. Often the dispatcher, not the owner.",
          }) +
          field(ID, "bookingUrl", "Booking / scheduling link", v("bookingUrl"), {
            placeholder: "https://…", help: "If they have online booking already.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Address</div>' +
        '<div style="font-size:14px;color:var(--muted);margin-top:4px">' +
          "Must match the Google Business Profile character for character." +
        "</div>" +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "street", "Street", v("street"), { placeholder: "1420 Baltimore Ave", wide: true }) +
          field(ID, "city", "City", v("city", c.market), { placeholder: "Kansas City" }) +
          field(ID, "state", "State", v("state"), { placeholder: "MO" }) +
          field(ID, "zip", "ZIP", v("zip"), { placeholder: "64108" }) +
        "</div>" +
        '<div style="margin-top:20px">' +
          toggle(ID, "serviceAreaBiz", "Service-area business (address hidden on GBP)", !!s.serviceAreaBiz) +
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
          ? '<div class="fields one" style="margin-top:18px">' +
              field(ID, "emergencyNote", "How after-hours actually works", v("emergencyNote"), {
                type: "longtext",
                placeholder: "Answering service until 10pm, on-call tech after. Premium rate after midnight.",
                help: "Worth getting right — it changes what we can promise in ad copy.",
              }) +
            "</div>"
          : "") +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Coverage</div>' +
        '<div class="fields" style="margin-top:16px">' +
          field(ID, "radius", "How far will they drive?", v("radius"), {
            placeholder: "45 min from the shop",
          }) +
          field(ID, "crews", "Trucks / crews on the road", v("crews"), {
            type: "number", placeholder: "6",
          }) +
        "</div>" +
        chipGroup(ID, "customerMix", "Customer mix", s.customerMix, [
          "Residential", "Commercial", "New construction", "Property management", "Warranty / home shield",
        ], { multi: true, help: "Pick every one that's a real part of the business." }) +
      "</div>"
    );
  },

  status(ctx) { return statusFor(ctx.state.m[ID], CORE); },

  summary(ctx) {
    const s = ctx.state.m[ID] || {};
    if (!Object.keys(s).length) return null;

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
    put("Billing contact", s.billingSame
      ? "Same as point of contact" + (s.contactName ? " (" + s.contactName + ")" : "")
      : who(s.billingName, s.billingEmail, s.billingPhone));
    put("Main business phone", s.phone);
    put("Tracking number OK", s.trackingOk);
    put("Web leads to", s.leadEmail);
    put("Booking link", s.bookingUrl);
    put("Address", s.serviceAreaBiz ? (addr ? addr + " (hidden on GBP)" : "Service-area business") : addr);
    put("Hours", hours);
    put("After hours", s.emergencyNote);
    put("Drive radius", s.radius);
    put("Crews", s.crews);
    put("Customer mix", Array.isArray(s.customerMix) ? s.customerMix.join(", ") : s.customerMix);

    const open = [];
    if (!filled(s.contactName)) {
      open.push({ what: "Point of contact", detail: "No named contact — nobody to chase for anything below" });
    }
    if (!filled(s.contactEmail) && !filled(s.contactPhone)) {
      open.push({ what: "Contact details", detail: "No email or phone for the point of contact" });
    }
    // When billing falls back to the point of contact, that contact's email
    // IS the billing email — so a blank one still means invoices have nowhere
    // to go. The old check skipped this case entirely.
    if (s.billingSame) {
      if (!filled(s.contactEmail)) {
        open.push({
          what: "Billing contact",
          detail: "Billing is set to the point of contact, but no email for them — invoices have nowhere to go",
        });
      }
    } else if (!filled(s.billingEmail)) {
      open.push({ what: "Billing contact", detail: "No billing email — the first invoice will bounce around" });
    }
    if (!filled(s.phone)) {
      open.push({ what: "Main business phone", detail: "Blocks call tracking setup and ad extensions" });
    }
    if (s.trackingOk === "unsure") {
      open.push({ what: "Call tracking", detail: "They weren't sure about swapping the number — needs a decision" });
    }

    return { rows, open };
  },
};

/** Small local escape — the field kit handles its own, this is for inline prose. */
function escName(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
