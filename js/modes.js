// ============================================================
// modes.js — the two documents this app is
// ============================================================
//
// One codebase, two documents. `kickoff` is the original: run after
// someone signs, with a client who is already a client. `discovery` is
// the first sales call, run with a prospect who is READING THE SCREEN.
//
// That second sentence is the whole reason this file exists. Everything
// mode-dependent resolves through here so there is exactly one place to
// look when asking "what does the prospect see?", and exactly one place
// for docs/check.mjs to hold the line.

export const KICKOFF = "kickoff";
export const DISCOVERY = "discovery";
export const MODES = [KICKOFF, DISCOVERY];
export const DEFAULT_MODE = KICKOFF;

export function isMode(v) { return MODES.indexOf(v) > -1; }

/** `?mode=discovery`. Anything unrecognised falls back to the kickoff. */
export function modeFromSearch(search) {
  const raw = new URLSearchParams(search || "").get("mode") || "";
  return isMode(raw) ? raw : DEFAULT_MODE;
}

/**
 * Resolve a piece of module chrome (`title`, `lede`, `nav`, `notePrompt`)
 * for a mode.
 *
 * A module carries its kickoff copy on the module object itself, and any
 * mode that needs different words carries them in a block named for that
 * mode:
 *
 *   { id: "goals", title: "Where are you trying to get to?",
 *     discovery: { title: "Where are you trying to get to?", lede: "…" } }
 *
 * Falling back to the kickoff wording is deliberate — a missing block
 * means "the same words work" — but it is also exactly how an unsafe
 * string reaches a prospect, so docs/check.mjs pins the phrases that must
 * never survive that fallback.
 */
export function variant(mod, mode, key) {
  const block = mod && mode !== DEFAULT_MODE ? mod[mode] : null;
  if (block && block[key] !== undefined) return block[key];
  return mod ? mod[key] : undefined;
}

/**
 * Resolve one entry from a module's COPY map.
 *
 * COPY holds every string whose wording changes between the two
 * documents — help text, card ledes, the prose around a field. The shape
 * is deliberately uniform so the harness can walk it:
 *
 *   export const COPY = {
 *     closeRate: {
 *       kickoff:   "…of the leads that come in. If they don't know, that itself is a finding.",
 *       discovery: "…of the leads that come in.",
 *     },
 *   };
 *
 * An entry missing its `discovery` variant is a FAILURE in check.mjs, not
 * a silent fallback. That is the single easiest thing to get wrong here:
 * the kickoff's help is written to Sam, about the client, and reads as
 * coaching when the client is the one looking at it.
 */
export function say(COPY, key, mode) {
  const e = COPY && COPY[key];
  if (e === undefined) return "";
  if (typeof e === "string") return e;
  return e[mode] !== undefined ? e[mode] : e[DEFAULT_MODE];
}

/** Bound resolver, so a module writes `t("closeRate")` and not much else. */
export function sayer(COPY, mode) {
  return function (key) { return say(COPY, key, mode); };
}
