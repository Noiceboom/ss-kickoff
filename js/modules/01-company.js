// ============================================================
// 01 — Company & contact
// ============================================================
//
// Reference implementation for the form-shaped modules. Every screen
// follows this shape: sectionHead + skipRow + cards of fields, all built
// from the ui.js field kit. No listeners, no DOM, no state mutation.

import { sectionHead, skipRow, field, chipGroup, toggle, statusFor, filled } from "../ui.js";
import { isSkipped, slot } from "../state.js";

const ID = "company";

// Keys that count toward "done". Anything not listed is a bonus field.
const CORE = ["legalName", "phone", "email", "city", "hoursWeekday"];

export default {
  id: ID,
  nav: "Company",
  title: "Who are they, on paper?",
  lede: "The factual layer — the stuff that has to be identical everywhere it appears. Legal name, the number that rings, the address Google sees.",
  skippable: true,

  render(ctx) {
    const s = slot(ctx.state, ID);
    const c = ctx.client.client || {};
    const v = (k, fallback) => (s[k] !== undefined ? s[k] : (fallback || ""));

    return (
      sectionHead("01", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +

      '<div class="card">' +
        '<div class="mlabel">Identity</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "legalName", "Legal business name", v("legalName", c.name), {
            placeholder: "Acme Plumbing LLC",
            help: "Exactly as it appears on the license and the bank account.",
          }) +
          field(ID, "dba", "DBA / what customers call them", v("dba"), {
            placeholder: "Acme Plumbing",
          }) +
          field(ID, "tagline", "Tagline", v("tagline"), {
            placeholder: "Fast, honest, on time",
          }) +
          field(ID, "founded", "Year founded", v("founded"), {
            type: "number", placeholder: "2015",
          }) +
          field(ID, "license", "License number", v("license"), {
            placeholder: "TACL-B12345",
            help: "Goes in the footer and the schema. Get the exact string.",
          }) +
          field(ID, "website", "Website", v("website", c.website), {
            placeholder: "https://…",
          }) +
          field(ID, "description", "One-line description", v("description"), {
            type: "longtext", wide: true,
            placeholder: "Licensed plumbing and drain service across the Kansas City metro. 24/7 emergency.",
            help: "One or two sentences. This becomes the meta description and the schema blurb.",
          }) +
        "</div>" +
      "</div>" +

      '<div class="card">' +
        '<div class="mlabel">Contact</div>' +
        '<div class="fields two" style="margin-top:16px">' +
          field(ID, "phone", "Main phone", v("phone"), {
            type: "phone", placeholder: "(816) 555-0142",
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
          field(ID, "email", "Where leads should land", v("email"), {
            type: "email", placeholder: "office@acmeplumbing.com",
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

    const rows = [];
    const put = (label, val) => { if (filled(val)) rows.push([label, val]); };

    put("Legal name", s.legalName);
    put("Trading as", s.dba);
    put("Tagline", s.tagline);
    put("Founded", s.founded);
    put("License", s.license);
    put("Website", s.website);
    put("Description", s.description);
    put("Phone", s.phone);
    put("Tracking number OK", s.trackingOk);
    put("Leads to", s.email);
    put("Booking link", s.bookingUrl);
    put("Address", s.serviceAreaBiz ? (addr ? addr + " (hidden on GBP)" : "Service-area business") : addr);
    put("Hours", hours);
    put("After hours", s.emergencyNote);
    put("Drive radius", s.radius);
    put("Crews", s.crews);
    put("Customer mix", Array.isArray(s.customerMix) ? s.customerMix.join(", ") : s.customerMix);

    const open = [];
    if (!filled(s.legalName)) open.push({ what: "Legal business name", detail: "Needed before anything gets published" });
    if (!filled(s.phone)) open.push({ what: "Main phone number", detail: "Blocks tracking setup and ad extensions" });
    if (s.trackingOk === "unsure") open.push({ what: "Call tracking", detail: "They weren't sure about swapping the number — needs a decision" });

    return { rows, open };
  },
};
