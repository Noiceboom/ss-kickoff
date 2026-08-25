// ============================================================
// The registry. Sequence lives here and nowhere else.
// ============================================================
//
// Adding, reordering or cutting a screen is a one-line change.
// Module `id` values are persisted in saved state and share links —
// renaming one orphans that module's saved data. Don't.

import intro from "./00-intro.js";
import company from "./01-company.js";
import goals from "./02-goals.js";
import marketing from "./03-marketing.js";
import competitors from "./04-competitors.js";
import services from "./05-services.js";
import locations from "./07-locations.js";
import brand from "./09-brand.js";
import access from "./11-access.js";
import readout from "./12-readout.js";

export default [
  intro,
  company,
  goals,
  marketing,
  competitors,
  services,
  locations,
  brand,
  access,
  readout,
];
