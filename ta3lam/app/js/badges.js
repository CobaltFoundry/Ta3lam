// الأوسمة والرتب: الميدالية، شاشة «أوسمتي»، وشاشات الاحتفال.
import { h, svg, num } from "./util.js";
import { icon } from "./mascot.js";
import { BADGES, BADGE_GROUPS, RANK_XP, rankOf, GOALS, FREEZE_COST, FREEZE_MAX } from "./shared/gamify.js";

const GLYPH = {
  streak3: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9z",
  streak7: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9zM9 21h6",
  streak30: "M3 20l6-10 3 4 3-6 6 12z",
  streak100: "M3 8l4 4 5-7 5 7 4-4-2 11H5z",
  goal: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  first: "M12 21v-8M12 13c0-4-3-6-7-6 0 4 3 6 7 6zm0 0c0-3 2-5 6-5 0 3-2 5-6 5z",
  lvl1: "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3",
  lvl2: "M4 5h7a2 2 0 0 1 1 1v14a2 2 0 0 0-1-1H4zM20 5h-7a2 2 0 0 0-1 1v14a2 2 0 0 1 1-1h7z",
  lvl3: "M6 3h12v18l-6-4-6 4z",
  lvl4: "M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7z",
  lvl5: "M12 3l2.7 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.2-.9z",
  lvl6: "M3 9l9-5 9 5zM5 9v9M9 9v9M15 9v9M19 9v9M3 20h18",
  final: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5",
  flawless: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  five: "M12 3l2.7 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.2-.9z",
  master: "M6 4h12l4 6-10 11L2 10zM2 10h20",
  iron: "M12 3a6 6 0 0 0-6 6c0 2 1 3 1 5v3h8v-3c0-2 1-3 1-5a6 6 0 0 0-6-6zM9 21h6",
  reviewer: "M4 11V9a3 3 0 0 1 3-3h11l-3-3M20 13v2a3 3 0 0 1-3 3H6l3 3",
  c100: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12l3 3 5-6",
  c1000: "M7 4h10v6a5 5 0 0 1-10 0zM7 6H3c0 4 2 5 4 5M17 6h4c0 4-2 5-4 5M12 15v4M8 21h8",
  marathon: "M13 2L4 14h7l-1 8 9-12h-7z",
  owl: "M20 14a8 8 0 1 1-10-10 7 7 0 0 0 10 10z",
  early: "M3 18h18M7 18a5 5 0 0 1 10 0M12 4v4M5 9l2 2M19 9l-2 2",
  eagle: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
};
const GROUP_COLOR = { streak: "#C2410C", progress: "#0F766E", mastery: "#6D28D9", volume: "#1D4ED8", surprise: "#BE185D" };
const groupOf = (id) => BADGES.find((b) => b.id === id)?.group || "progress";

/** ميدالية وسام: ملوّنة إن فُتحت، رمادية إن لم تُفتح */
export function medal(id, earned, size = 72) {
  const col = GROUP_COLOR[groupOf(id)];
  const bg = earned ? col : "var(--lock)";
  const ring = earned ? "var(--gold)" : "var(--line)";
  const fg = earned ? "#FFFFFF" : "var(--lock-ic)";
  return svg(`<svg class="medal${earned ? " on" : ""}" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 72 72">
<circle cx="36" cy="36" r="33" fill="${bg}" stroke="${ring}" stroke-width="5"/>
<g transform="translate(18 18) scale(1.5)" fill="none" stroke="${fg}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${GLYPH[id] || GLYPH.first}"/></g></svg>`);
}

const rankSpan = (xp, lang, t) => {
  const r = rankOf(xp), next = RANK_XP[r + 1];
  return { r, next, text: next == null ? t.rankMax : t.rankMore(num(next - xp, lang), t.rankNames[r + 1]) };
};

// ───────────── شاشة أوسمتي ─────────────
export function badgesView(c) {
  const { t, lang, me } = c;
  const g = me.gamify || { gems: 0, freezes: 0, goalDays: 5, weekDays: 0, badges: {} };
  const xp = me.user.xp || 0;
  const { r, next, text } = rankSpan(xp, lang, t);
  const pct = next == null ? 100 : Math.round(((xp - RANK_XP[r]) / (next - RANK_XP[r])) * 100);
  const earned = Object.keys(g.badges).length;

  const root = h("div", { class: "screen badges" },
    h("div", { class: "bd-top" }, h("h1", {}, t.badgesTitle),
      h("span", { class: "chip gold", "aria-label": `${t.gemsLbl}: ${g.gems}` }, icon("gem", 20, "var(--primary-d)", "var(--primary-soft)"), num(g.gems, lang))),

    h("section", { class: "rank-card" },
      h("div", { class: "rk-row" },
        h("div", { class: "rk-num", "aria-hidden": "true" }, num(r + 1, lang)),
        h("div", { class: "rk-txt" }, h("small", {}, t.rankLabel), h("b", {}, t.rankNames[r])),
        h("small", { class: "rk-of" }, t.goalProg(num(r + 1, lang), num(RANK_XP.length, lang)))),
      h("div", { class: "rk-bar", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, h("i", { style: { width: `${pct}%` } })),
      h("small", { class: "rk-more" }, `${num(xp, lang)} XP · ${text}`)),

    h("section", { class: "bd-card" },
      h("div", { class: "bd-row" }, h("b", {}, t.goalTitle), h("span", { class: "bd-val" }, t.goalProg(num(Math.min(g.weekDays, g.goalDays), lang), num(g.goalDays, lang)))),
      h("div", { class: "goal-dots", "aria-hidden": "true" }, Array.from({ length: g.goalDays }, (_, k) => h("i", { class: k < g.weekDays ? "on" : "" }))),
      h("div", { class: "seg", role: "group", "aria-label": t.goalTitle }, GOALS.map((n) =>
        h("button", { class: `seg-btn${n === g.goalDays ? " on" : ""}`, type: "button", "aria-pressed": String(n === g.goalDays), onclick: () => c.onGoal(n) }, t.goalDays(num(n, lang))))),
      h("small", { class: "bd-note" }, t.goalSub)),

    h("section", { class: "bd-card" },
      h("div", { class: "bd-row" }, h("b", {}, t.freezeTitle), h("span", { class: "bd-val" }, t.freezeHave(num(g.freezes, lang)))),
      h("small", { class: "bd-note" }, t.freezeSub),
      h("button", { class: "btn ghost", type: "button", disabled: g.freezes >= FREEZE_MAX || g.gems < FREEZE_COST, onclick: c.onBuyFreeze }, t.freezeBuy(num(FREEZE_COST, lang)))));

  for (const grp of BADGE_GROUPS) {
    const list = BADGES.filter((b) => b.group === grp);
    const got = list.filter((b) => g.badges[b.id]).length;
    root.append(h("section", { class: "bd-group" },
      h("h2", {}, t.groups[grp], h("small", {}, t.earnedCount(num(got, lang), num(list.length, lang)))),
      h("div", { class: "bd-grid" }, list.map((b) => {
        const on = !!g.badges[b.id];
        return h("div", { class: `bd-item${on ? " on" : ""}`, role: "group", "aria-label": `${t.badgeNames[b.id]}: ${t.badgeDescs[b.id]}${on ? " ✓" : ""}` },
          medal(b.id, on, 68), h("b", {}, t.badgeNames[b.id]), h("small", {}, t.badgeDescs[b.id]));
      }))));
  }

  root.append(h("section", { class: "bd-group" }, h("h2", {}, t.ranksTitle),
    h("ol", { class: "rank-list" }, t.rankNames.map((n, k) =>
      h("li", { class: k === r ? "cur" : k < r ? "done" : "" }, h("span", { class: "rl-n" }, num(k + 1, lang)), h("b", {}, n), h("small", {}, `${num(RANK_XP[k], lang)} XP`))))));
  root.append(h("p", { class: "lead small bd-foot" }, `${t.earnedCount(num(earned, lang), num(BADGES.length, lang))}`));
  return root;
}

// ───────────── احتفال: وسام جديد / رتبة جديدة ─────────────
export function celebrateView(c) {
  const { t, lang, kind, id, rank, gems, onDone } = c;
  const isBadge = kind === "badge";
  const root = h("div", { class: "celebrate", role: "dialog", "aria-modal": "true", "aria-label": isBadge ? t.newBadge : t.rankUpTitle },
    h("div", { class: "cb-body" },
      h("div", { class: "cb-kick" }, isBadge ? t.newBadge : t.rankUpTitle),
      isBadge ? medal(id, true, 168) : h("div", { class: "cb-rank" }, num(rank + 1, lang)),
      h("h1", {}, isBadge ? t.badgeNames[id] : t.rankNames[rank]),
      h("p", { class: "cb-sub" }, isBadge ? t.badgeDescs[id] : t.rankLabel),
      isBadge && gems ? h("span", { class: "chip gold" }, icon("gem", 20, "var(--primary-d)", "var(--primary-soft)"), t.gemsPlus(num(gems, lang))) : null),
    h("div", { class: "foot col" }, h("button", { class: "btn primary", type: "button", onclick: onDone }, t.ok)));
  requestAnimationFrame(() => root.querySelector("button")?.focus());
  return root;
}
