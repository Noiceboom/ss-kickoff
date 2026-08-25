// ============================================================
// 06 — Services, rank
// ============================================================

import { sectionHead } from "../ui.js";
import { onList } from "../state.js";
import { renderList } from "../rank.js";

const ID = "servicesRank";
const KEY = "services";

function describe(it) {
  const on = it.subs.filter((s) => s.on);
  if (on.length) return on.map((s) => s.name).join(" · ");
  return it.custom ? "Added on this call" : "Single page";
}

export default {
  id: ID,
  nav: "Rank services",
  title: "Put the money-makers on top",
  lede: "Drag the handle to move a service. Ask which job they'd take if the phone only rang once today — that one goes to #1. Ties are fine; get the top five roughly right and we're good.",
  skippable: false,

  render(ctx) {
    const list = onList(ctx.state, KEY, ctx.client.services);
    return (
      sectionHead("06", this.title, this.lede) +
      '<div class="tools">' +
        '<div class="count"><i>' + list.length + "</i> ranked</div>" +
        '<button class="btn ghost sm" data-reset="' + KEY + '">Reset to site order</button>' +
        '<span class="hint" style="font-size:14px;color:var(--muted)">Click a handle and use &uarr; / &darr; if dragging is fiddly on a shared screen.</span>' +
      "</div>" +
      renderList(KEY, list, describe, "Build first")
    );
  },

  status(ctx) {
    const list = onList(ctx.state, KEY, ctx.client.services);
    if (!list.length) return "empty";
    return (ctx.state.order[KEY] || []).length ? "done" : "partial";
  },

  summary(ctx) {
    const list = onList(ctx.state, KEY, ctx.client.services);
    if (!list.length) return null;
    return {
      list: {
        title: "Services in priority order",
        items: list.map((it, i) => ({ n: i + 1, name: it.name, meta: describe(it) })),
      },
      table: {
        head: ["type", "rank", "name", "tier", "detail"],
        body: list.map((it, i) => [
          "service", String(i + 1), it.name, i < 5 ? "1" : i < 10 ? "2" : "3", describe(it),
        ]),
      },
    };
  },
};
