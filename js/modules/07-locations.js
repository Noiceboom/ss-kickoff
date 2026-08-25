// ============================================================
// 07 — Locations, confirm
// ============================================================

import { esc, sectionHead, skipRow } from "../ui.js";
import { isSkipped, mergedList, listState } from "../state.js";
import { renderGrid, toolbar, addBox, gridStatus, gridSummary } from "../listgrid.js";

const ID = "locations";

function badges(it) {
  return (
    (it.hasPage ? '<span class="badge b-page">Has a page</span>' : "") +
    (it.verify ? '<span class="badge b-ver">Verify</span>' : "") +
    (it.custom ? '<span class="badge b-ver">Added on call</span>' : "") +
    (it.state ? '<span class="badge b-st">' + esc(it.state) + "</span>" : "")
  );
}

/** State filter buttons, built from whatever states the client actually has. */
function stateButtons(ctx) {
  const seen = [];
  for (const l of ctx.client.locations || []) {
    if (l.state && seen.indexOf(l.state) < 0) seen.push(l.state);
  }
  if (seen.length < 2) return "";
  return seen
    .map((s) => '<button class="btn ghost sm" data-only="' + ID + "|" + esc(s) + '">' + esc(s) + " only</button>")
    .join("");
}

export default {
  id: ID,
  nav: "Cities",
  title: "Do they really run trucks there?",
  lede: "A city page only pays off if they'll actually take the call. Uncheck anywhere they're listed but won't drive. Gold flags are entries we need settled before anything gets written.",
  skippable: true,

  render(ctx) {
    return (
      sectionHead("07", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +
      toolbar(ctx, ID, "cities", stateButtons(ctx)) +
      renderGrid(ctx, {
        key: ID,
        badgesFor: badges,
        notePlaceholder: "Note — drive time, ticket size, techs covering it…",
        groupBy: (it) => (it.state ? it.state : "Other"),
      }) +
      addBox(
        ID,
        "City missing from the list?",
        "Somewhere they already work that never made it onto the site.",
        "Add a city and hit Enter…",
        "Add city"
      )
    );
  },

  status(ctx) { return gridStatus(ctx.state, ID); },

  summary(ctx) {
    const base = gridSummary(ctx, ID, "cities");
    if (!base) return null;
    const items = mergedList(ctx.state, ID, ctx.client.locations);
    const unresolved = items.filter((x) => x.on && x.verify);
    return {
      rows: base.rows,
      open: unresolved.map((x) => ({ what: x.name, detail: x.verify })),
    };
  },
};
