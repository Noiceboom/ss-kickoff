// ============================================================
// The registries. Sequence lives here and nowhere else.
// ============================================================
//
// Two documents, one codebase.
//
//   KICKOFF   — run after they sign. The client is a client.
//   DISCOVERY — the first sales call. The prospect is READING THE SCREEN.
//
// Adding, reordering or cutting a screen is a one-line change. Module
// `id` values are persisted in saved state and share links — renaming one
// orphans that module's saved data. Don't.
//
// The two lists deliberately share module OBJECTS, not copies. A screen
// that appears in both is the same file, the same id and the same state
// keys, which is the entire mechanism behind the discovery → kickoff
// handoff: `fields.goals` written on the sales call is `fields.goals`
// read on the kickoff call. Fork a module and you break that silently.

import intro from "./00-intro.js";
import company from "./01-company.js";
import goals from "./02-goals.js";
import marketing from "./03-marketing.js";
import competitors from "./04-competitors.js";

// The sales call keeps these four as they were. Same ids, same state keys,
// different screens — see js/modules/discovery/.
import dCompany from "./discovery/01-company.js";
import dGoals from "./discovery/02-goals.js";
import dMarketing from "./discovery/03-marketing.js";
import dCompetitors from "./discovery/04-competitors.js";
import services from "./05-services.js";
import whynow from "./06-whynow.js";
import locations from "./07-locations.js";
import transcript from "./08-transcript.js";
import conversions from "./10-conversions.js";
import brand from "./09-brand.js";
import profiles from "./13-profiles.js";
import access from "./11-access.js";
import readout from "./12-readout.js";

export const KICKOFF = [
  intro,
  company,
  goals,
  marketing,
  competitors,
  services,
  locations,
  conversions,
  brand,
  profiles,
  access,
  transcript,
  readout,
];

// Kickoff order with "Why now" inserted at the top and everything that
// only exists because someone has signed taken out:
//
//   brand   — logo, tone and words-we-never-use are a post-sale exercise
//   access  — there is no account to be granted access to yet
//
// `company` survives but renders a fraction of itself: no point of
// contact, no billing contact, no call-tracking decision, no lead
// destination. What is left — how long they've been going, how many
// trucks, who they sell to — is worth knowing before you price anything.
export const DISCOVERY = [
  intro,
  whynow,
  dCompany,
  dGoals,
  dMarketing,
  dCompetitors,
  services,
  locations,
  transcript,
  readout,
];

/** Every module in either document, once. Used by the check harness. */
export const ALL = KICKOFF.concat(DISCOVERY.filter((m) => KICKOFF.indexOf(m) < 0));

export function registryFor(mode) {
  return mode === "discovery" ? DISCOVERY : KICKOFF;
}

export default KICKOFF;
