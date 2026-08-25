// ============================================================
// 05 — Services, confirm
// ============================================================

import { esc, sectionHead, skipRow } from "../ui.js";
import { isSkipped } from "../state.js";
import { renderGrid, toolbar, addBox, gridStatus, gridSummary } from "../listgrid.js";

const ID = "services";

function badges(it) {
  const subsOn = it.subs.filter((s) => s.on).length;
  return (
    (it.custom ? '<span class="badge b-ver">Added on call</span>' : "") +
    (it.hasPage ? '<span class="badge b-page">Has a page</span>' : "") +
    (it.subs.length
      ? '<span class="badge b-sub">' + subsOn + " / " + it.subs.length + " sub-services</span>"
      : '<span class="badge b-st">No sub-pages</span>')
  );
}

export default {
  id: ID,
  nav: "Services",
  title: "Is this everything you sell?",
  lede: "Uncheck anything they don't actually do, or don't want leads for. Toggle the sub-services underneath if only part of a category applies. Add whatever the scrape missed.",
  skippable: true,
  notePrompt:
    "What they said about specific jobs — margins, which crew does what, work they'd rather not take.",

  render(ctx) {
    return (
      sectionHead("05", this.title, this.lede) +
      skipRow(ID, isSkipped(ctx.state, ID)) +
      toolbar(ctx, ID, "services") +
      renderGrid(ctx, {
        key: ID,
        badgesFor: badges,
        notePlaceholder: "Note — avg ticket, who does it, anything to flag…",
      }) +
      addBox(
        ID,
        "Something we missed?",
        "Water softeners, backflow testing, well pumps, slab leaks — anything not on the site yet that they want leads for.",
        "Add a service and hit Enter…",
        "Add service"
      )
    );
  },

  status(ctx) { return gridStatus(ctx.state, ID); },
  summary(ctx) { return gridSummary(ctx, ID, "services"); },
};
