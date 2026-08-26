// ============================================================
// ui.js — shared render helpers and the field kit
// ============================================================
//
// Every module composes its screen from these. All of them emit HTML
// strings carrying data-* attributes; app.js owns the listeners, so a
// module never touches the DOM.

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

/* ── icons ────────────────────────────────────────────── */

export const ICON = {
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fffbf2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  grip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg>',
  up: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  next: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  warn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/></svg>',
  doc: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

/* ── section chrome ───────────────────────────────────── */

export function sectionHead(num, title, lede) {
  return (
    '<div class="sechead"><div class="secnum">' + esc(num) + "</div><h2>" + esc(title) + "</h2></div>" +
    (lede ? '<p class="lede">' + esc(lede) + "</p>" : "")
  );
}

export function skipRow(moduleId, skipped) {
  return (
    '<div class="skiprow">' +
      '<button class="skipbtn' + (skipped ? " on" : "") + '" data-skip="' + esc(moduleId) + '">' +
        (skipped ? "&#9673; Marked: didn&rsquo;t cover" : "&#8856; Didn&rsquo;t cover this") +
      "</button>" +
      (skipped
        ? '<span class="skipnote">Logged as an open item in the readout.</span>'
        : '<span class="hint" style="font-size:14px;color:var(--muted)">Skip it and it lands in the readout instead of reading as blank.</span>') +
    "</div>"
  );
}

export function warnBox(html, icon) {
  return '<div class="warn">' + (icon || ICON.warn) + "<div>" + html + "</div></div>";
}

export function navRow(prev, next, hint) {
  let h = '<div class="navrow">';
  if (prev) h += '<button class="btn ghost" data-go="' + esc(prev) + '">Back</button>';
  if (next) h += '<button class="btn" data-go="' + esc(next) + '">' + esc(next.label || "Next") + " " + ICON.next + "</button>";
  if (hint) h += '<span class="hint">' + esc(hint) + "</span>";
  return h + "</div>";
}

/* ── the field kit ────────────────────────────────────── */
//
// f(mod, key, label, opts) — every field carries data-f="<mod>|<key>"
// so app.js can route input events without per-module wiring.

const SYMS = { money: "$", percent: "%", number: "" };

export function field(mod, key, label, value, opts) {
  const o = opts || {};
  const type = o.type || "text";
  const name = esc(mod) + "|" + esc(key);
  const cls = "f" + (o.wide ? " wide" : "");
  const ph = o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "";
  let input;

  if (type === "longtext") {
    input = '<textarea data-f="' + name + '"' + ph +
      (o.rows ? ' rows="' + o.rows + '"' : "") + ">" + esc(value) + "</textarea>";
  } else if (type === "select") {
    input = '<select data-f="' + name + '">' +
      (o.options || []).map(function (op) {
        const val = typeof op === "string" ? op : op.value;
        const lab = typeof op === "string" ? op : op.label;
        return '<option value="' + esc(val) + '"' + (String(value) === String(val) ? " selected" : "") + ">" + esc(lab) + "</option>";
      }).join("") + "</select>";
  } else if (type === "money" || type === "percent") {
    const sym = SYMS[type];
    const sfx = type === "percent";
    input =
      '<div class="pre' + (sfx ? " sfx" : "") + '"><span class="sym">' + sym + "</span>" +
      '<input type="text" inputmode="decimal" data-f="' + name + '" value="' + esc(value) + '"' + ph + "></div>";
  } else {
    const it = type === "number" ? "number" : type === "email" ? "email" : type === "phone" ? "tel" : "text";
    input = '<input type="' + it + '" data-f="' + name + '" value="' + esc(value) + '"' + ph + ">";
  }

  return (
    '<div class="' + cls + '">' +
      "<label>" + esc(label) + "</label>" + input +
      (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") +
    "</div>"
  );
}

/** Single- or multi-select chip group. */
export function chipGroup(mod, key, label, value, options, opts) {
  const o = opts || {};
  const multi = !!o.multi;
  const sel = multi ? (Array.isArray(value) ? value : []) : [value];
  const body = (options || []).map(function (op) {
    const val = typeof op === "string" ? op : op.value;
    const lab = typeof op === "string" ? op : op.label;
    const on = sel.indexOf(val) > -1;
    return '<button class="chip' + (on ? " on" : "") + '" data-chip="' + esc(mod) + "|" + esc(key) +
      "|" + esc(val) + '" data-multi="' + (multi ? "1" : "0") + '">' + esc(lab) + "</button>";
  }).join("");
  return (
    '<div class="f' + (o.wide === false ? "" : " wide") + '">' +
      (label ? "<label>" + esc(label) + "</label>" : "") +
      '<div class="chips">' + body + "</div>" +
      (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") +
    "</div>"
  );
}

export function toggle(mod, key, label, value) {
  return (
    '<button class="tog' + (value ? " on" : "") + '" data-toggle="' + esc(mod) + "|" + esc(key) + '">' +
      '<span class="sw"></span><span class="lbl">' + esc(label) + "</span>" +
    "</button>"
  );
}

/**
 * Repeatable rows. `cols` is [{key,label,type,width,options,placeholder}].
 * Grid template comes from the widths so header and rows stay aligned.
 */
export function rowGroup(mod, key, cols, rows, opts) {
  const o = opts || {};
  const tpl = cols.map(function (c) { return c.width || "1fr"; }).join(" ") + " auto";
  const head =
    '<div class="rowhead" style="grid-template-columns:' + tpl + '">' +
      cols.map(function (c) { return "<span>" + esc(c.label) + "</span>"; }).join("") +
      "<span></span></div>";

  const body = (rows || []).map(function (row, i) {
    const cells = cols.map(function (c) {
      const name = esc(mod) + "|" + esc(key) + "|" + i + "|" + esc(c.key);
      const v = row[c.key] == null ? "" : row[c.key];
      const ph = c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : "";
      if (c.type === "select") {
        return '<select data-row="' + name + '">' +
          (c.options || []).map(function (op) {
            const val = typeof op === "string" ? op : op.value;
            const lab = typeof op === "string" ? op : op.label;
            return '<option value="' + esc(val) + '"' + (String(v) === String(val) ? " selected" : "") + ">" + esc(lab) + "</option>";
          }).join("") + "</select>";
      }
      if (c.type === "longtext") {
        return '<textarea data-row="' + name + '"' + ph + ">" + esc(v) + "</textarea>";
      }
      return '<input type="text" data-row="' + name + '" value="' + esc(v) + '"' + ph + ">";
    }).join("");
    return '<div class="rrow" style="grid-template-columns:' + tpl + '">' + cells +
      '<button class="del" data-delrow="' + esc(mod) + "|" + esc(key) + "|" + i + '" aria-label="Remove row">' + ICON.x + "</button></div>";
  }).join("");

  return (
    '<div class="f wide">' +
      (o.label ? "<label>" + esc(o.label) + "</label>" : "") +
      (rows && rows.length ? head : "") +
      '<div class="rows">' + body + "</div>" +
      (!rows || !rows.length ? '<div class="emptyrows">' + esc(o.empty || "Nothing added yet.") + "</div>" : "") +
      '<div style="margin-top:12px"><button class="btn ghost sm" data-addrow="' + esc(mod) + "|" + esc(key) + '">' +
        ICON.plus + " " + esc(o.addLabel || "Add row") + "</button></div>" +
      (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") +
    "</div>"
  );
}

export const STATUSES = [
  { value: "granted", label: "Granted" },
  { value: "pending", label: "Pending" },
  { value: "blocked", label: "Blocked" },
  { value: "na", label: "N/A" },
];

export function statusPicker(mod, key, value) {
  return '<div class="chips">' + STATUSES.map(function (s) {
    return '<button class="stat ' + s.value + (value === s.value ? " on" : "") +
      '" data-status="' + esc(mod) + "|" + esc(key) + "|" + s.value + '">' +
      '<span class="d"></span>' + esc(s.label) + "</button>";
  }).join("") + "</div>";
}

export const PAGE_KEY = "_page";

/**
 * The scratchpad at the foot of every screen. Deliberately always open
 * and always in the same place — on a live call there is no time to hunt
 * for it, and a collapsed box may as well not exist.
 *
 * Rendered OUTSIDE `.body` so it still works on a screen marked
 * "didn't cover this" — "we skipped it, but he mentioned…" is exactly
 * the note worth keeping.
 */
export function pageNote(moduleId, label, value, prompt) {
  const has = !!String(value || "").trim();
  return (
    '<div class="pagenote' + (has ? " has" : "") + '">' +
      '<div class="pnhead">' +
        '<span class="mlabel">Notes &mdash; ' + esc(label || moduleId) + "</span>" +
        (has ? '<span class="badge b-page">Captured</span>' : "") +
        '<span class="pnhint">&#8984;&#9166; jumps here</span>' +
      "</div>" +
      '<textarea data-note="' + esc(moduleId) + ':' + PAGE_KEY + '" placeholder="' + esc(prompt) + '">' +
        esc(value) +
      "</textarea>" +
    "</div>"
  );
}

/* ── sliders ──────────────────────────────────────────── */
//
// Position runs 0–1000 and maps to a value through a power curve, so the
// low end (where most home-services numbers actually live) gets real
// resolution instead of one pixel per $50k.
//
// The committed value is stored in state, never the slider position —
// exports must read a number, not a UI coordinate.

const SLIDER_POS_MAX = 1000;

export function sliderValue(pos, min, max, curve) {
  const t = Math.min(1, Math.max(0, pos / SLIDER_POS_MAX));
  return min + (max - min) * Math.pow(t, curve);
}

export function sliderPos(value, min, max, curve) {
  const span = max - min;
  if (span <= 0) return 0;
  const t = Math.min(1, Math.max(0, (Number(value) - min) / span));
  return Math.round(SLIDER_POS_MAX * Math.pow(t, 1 / curve));
}

/**
 * Round to a figure someone would actually say out loud. Nobody answers
 * "what's your average ticket" with $1,437.
 */
export function snapNice(v, mode) {
  const a = Math.abs(v);
  let step;
  if (mode === "pct") step = 1;
  else if (mode === "count") step = a < 50 ? 1 : a < 200 ? 5 : a < 1000 ? 10 : 25;
  else step = a < 100 ? 5 : a < 1000 ? 25 : a < 10000 ? 100 : a < 100000 ? 1000 : a < 1000000 ? 5000 : 25000;
  return Math.round(v / step) * step;
}

export function formatSlider(v, mode, max) {
  const n = Number(v);
  if (!isFinite(n)) return "";
  const capped = max != null && n >= max;
  if (mode === "pct") return n + "%";
  const s = n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return (mode === "money" ? "$" + s : s) + (capped ? "+" : "");
}

/**
 * Slider with a typeable readout.
 *
 * Unset is a first-class state: a slider that always shows a number makes
 * an unanswered question look answered, which is the one thing this doc
 * must never do. Until it is touched the readout shows a dash and the
 * track stays grey, and state holds nothing.
 *
 * opts: { min, max, curve, mode: "money"|"count"|"pct", unit, help, start }
 */
export function slider(mod, key, label, value, opts) {
  const o = opts || {};
  const min = o.min == null ? 0 : o.min;
  const max = o.max == null ? 100 : o.max;
  const curve = o.curve || 1;
  const mode = o.mode || "count";
  const name = esc(mod) + "|" + esc(key);
  const set = filled(value);
  const num = set ? Number(String(value).replace(/[^0-9.\-]/g, "")) : null;
  const pos = set ? sliderPos(num, min, max, curve) : sliderPos(o.start == null ? (max - min) * 0.12 + min : o.start, min, max, curve);

  return (
    '<div class="f sl' + (o.wide ? " wide" : "") + (set ? "" : " unset") + '" data-slwrap="' + name + '">' +
      '<div class="slhead">' +
        "<label>" + esc(label) + "</label>" +
        '<div class="slval">' +
          '<input class="slnum" data-f="' + name + '" data-slnum="' + name + '" inputmode="numeric" ' +
            'autocomplete="off" size="9" value="' + (set ? esc(formatSlider(num, mode, max)) : "") + '" placeholder="—">' +
          (o.unit ? '<span class="slunit">' + esc(o.unit) + "</span>" : "") +
        "</div>" +
      "</div>" +
      '<input type="range" class="slrange" data-slrange="' + name + '" ' +
        'min="0" max="' + SLIDER_POS_MAX + '" value="' + pos + '" ' +
        'data-scale="' + min + "|" + max + "|" + curve + "|" + mode + '" ' +
        'aria-label="' + esc(label) + '">' +
      '<div class="slscale"><span>' + esc(formatSlider(min, mode)) + "</span>" +
        "<span>" + esc(formatSlider(max, mode, max)) + "</span></div>" +
      (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") +
    "</div>"
  );
}

/**
 * A bipolar scale — two words, a track between them, no number.
 *
 * "How formal?" has no units, so a numeric readout would be false
 * precision. What matters is which end they lean towards and how hard, so
 * the readout is the nearer word.
 *
 * Starts UNSET like every slider here: an untouched scale sitting at dead
 * centre would read as a considered "balanced" answer.
 */
export function scale(mod, key, label, value, left, right, opts) {
  const o = opts || {};
  const name = esc(mod) + "|" + esc(key);
  const set = filled(value);
  const v = set ? Math.max(0, Math.min(100, Number(value))) : 50;
  const word = !set ? "&mdash;"
    : v <= 15 ? esc(left)
    : v <= 40 ? "Leans " + esc(left).toLowerCase()
    : v < 60 ? "Right down the middle"
    : v < 85 ? "Leans " + esc(right).toLowerCase()
    : esc(right);

  return (
    '<div class="f sc' + (set ? "" : " unset") + '" data-scwrap="' + name + '">' +
      '<div class="schead"><label>' + esc(label) + "</label>" +
        '<span class="scval">' + word + "</span></div>" +
      '<input type="range" class="slrange scrange" data-scale-field="' + name + '" ' +
        'min="0" max="100" step="5" value="' + v + '" aria-label="' + esc(label) + '">' +
      '<div class="slscale"><span>' + esc(left) + "</span><span>" + esc(right) + "</span></div>" +
      (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") +
    "</div>"
  );
}

/**
 * File upload with a preview. The bytes go to IndexedDB, never to state —
 * see assets.js for why that separation is load-bearing.
 */
export function upload(mod, key, label, meta, opts) {
  const o = opts || {};
  const name = esc(mod) + "|" + esc(key);
  const has = meta && meta.name;

  const body = has
    ? '<div class="upfile">' +
        (o.previewUrl
          ? '<img class="upthumb" src="' + esc(o.previewUrl) + '" alt="">'
          : '<div class="upicon">' + (o.icon || ICON.check) + "</div>") +
        '<div class="upmeta"><div class="upname">' + esc(meta.name) + "</div>" +
          '<div class="upsize">' + esc(o.sizeLabel || "") + "</div></div>" +
        '<button class="btn ghost xs" data-getfile="' + name + '">Download</button>' +
        '<button class="btn ghost xs" data-delfile="' + name + '">Remove</button>' +
      "</div>"
    : '<label class="updrop">' +
        '<input type="file" data-putfile="' + name + '"' +
          (o.accept ? ' accept="' + esc(o.accept) + '"' : "") + ">" +
        '<span class="upcta">' + esc(o.cta || "Choose a file") + "</span>" +
        (o.hint ? '<span class="uphint">' + esc(o.hint) + "</span>" : "") +
      "</label>";

  return (
    '<div class="f wide up">' +
      "<label>" + esc(label) + "</label>" + body +
      (o.help ? '<div class="help">' + esc(o.help) + "</div>" : "") +
    "</div>"
  );
}

/** A live-computed line the module can refresh without a re-render. */
export function derived(key, initial) {
  return '<div class="derived" data-derived="' + esc(key) + '">' + esc(initial || "") + "</div>";
}

/* ── formatting ───────────────────────────────────────── */

export function money(v) {
  const n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n) || !String(v || "").trim()) return "";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function pct(v) {
  const s = String(v == null ? "" : v).trim();
  return s ? s.replace(/%*$/, "") + "%" : "";
}

/** True when a value counts as filled in — used by every status(). */
export function filled(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return String(v).trim() !== "";
}

/**
 * Standard status(): "done" when every key in `required` is filled,
 * "partial" when some are, "empty" when none.
 */
export function statusFor(modState, keys) {
  const s = modState || {};
  const hits = keys.filter(function (k) { return filled(s[k]); }).length;
  if (!hits) return "empty";
  return hits === keys.length ? "done" : "partial";
}
