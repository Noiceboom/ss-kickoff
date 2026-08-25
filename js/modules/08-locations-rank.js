// ============================================================
// 08 — Locations, rank
// ============================================================

import { sectionHead } from "../ui.js";
import { onList } from "../state.js";
import { renderList } from "../rank.js";

const ID = "locationsRank";
const KEY = "locations";

function describe(it) {
  const bits = [];
  if (it.state) bits.push(it.state);
  bits.push(it.hasPage ? "already has a page" : "needs a page");
  if (it.verify) bits.push("verify");
  return bits.join(" · ");
}

export default {
  id: ID,
  nav: "Rank cities",
  title: "Which city gets a page first?",
  lede: "Rank by where the good work is — ticket size, drive time, techs already covering it. Not by population. Top five get built first.",
  skippable: false,

  render(ctx) {
    const list = onList(ctx.state, KEY, ctx.client.locations);
    return (
      sectionHead("08", this.title, this.lede) +
      '<div class="tools">' +
        '<div class="count"><i>' + list.length + "</i> ranked</div>" +
        '<button class="btn ghost sm" data-reset="' + KEY + '">Reset to A&ndash;Z</button>' +
        '<span class="hint" style="font-size:14px;color:var(--muted)">Cities that already have a page are marked &mdash; those are rewrites, not builds.</span>' +
      "</div>" +
      renderList(KEY, list, describe, "Page one")
    );
  },

  status(ctx) {
    const list = onList(ctx.state, KEY, ctx.client.locations);
    if (!list.length) return "empty";
    return (ctx.state.order[KEY] || []).length ? "done" : "partial";
  },

  summary(ctx) {
    const list = onList(ctx.state, KEY, ctx.client.locations);
    if (!list.length) return null;
    return {
      list: {
        title: "Cities in priority order",
        items: list.map((it, i) => ({ n: i + 1, name: it.name, meta: describe(it) })),
      },
      table: {
        head: ["type", "rank", "name", "tier", "detail"],
        body: list.map((it, i) => [
          "city", String(i + 1), it.name + (it.state ? ", " + it.state : ""),
          i < 5 ? "1" : i < 10 ? "2" : "3", describe(it),
        ]),
      },
    };
  },
};
