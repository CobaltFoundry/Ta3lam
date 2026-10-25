// عرض الشاشات. دوال نقية تأخذ بيانات ومعالجات وترجع عناصر DOM.
import { h, svg, num, richEl } from "./util.js";
import { mascot, icon } from "./mascot.js";

const pick = (obj, lang) => obj?.[lang] || obj?.en || obj?.ar || "";

// ───────────── شريط علوي مشترك ─────────────
function topStats(c) {
  const { me, t, lang } = c;
  return h("div", { class: "stats" },
    h("span", { class: "stat", "aria-label": t.streakLbl(num(me.user.streak, lang)) }, icon("flame", 22, "var(--flame-d)", "var(--flame)"), h("b", {}, num(me.user.streak, lang))),
    h("span", { class: "stat", "aria-label": t.xpLbl(num(me.user.xp, lang)) }, icon("star", 22, "var(--gold-d)", "var(--gold)"), h("b", {}, num(me.user.xp, lang))));
}

// ───────────── الرئيسية: خريطة المسار ─────────────
export function homeView(c) {
  const { t, lang, track, nodes, me } = c;
  const current = nodes.find((n) => n.state === "current");
  const lessonCount = (n) => n.unit.lessons.length;

  let greet;
  if (!nodes.some((n) => n.state === "done")) greet = t.greetNew;
  else if (me.dueCount > 0) greet = t.greetReview(num(me.dueCount, lang));
  else if (current) greet = t.greetContinue(pick(current.title, lang));
  else greet = t.greetDone;

  const root = h("div", { class: "screen home" });
  root.append(
    h("div", { class: "top" },
      h("span", { class: "track-chip" }, pick(track.title, lang)),
      topStats(c)),
    ...(c.isDemo ? [h("div", { class: "demo-banner", role: "note" }, t.demoBanner)] : []),
    h("div", { class: "mascot-row" }, mascot(me.dueCount > 0 ? "think" : "happy", 84), h("div", { class: "bubble" }, greet)),
    ...(!nodes.some((n) => n.state === "done") ? [h("div", { class: "place-card" },
      h("h2", {}, t.placementCardH), h("p", {}, t.placementCardP),
      h("button", { class: "btn ghost", type: "button", onclick: c.onPlacement }, t.placementBtn))] : []),
  );

  // مجموعات حسب الوحدة
  const byUnit = [];
  for (const n of nodes) {
    let g = byUnit[byUnit.length - 1];
    if (!g || g.unit.id !== n.unit.id) { g = { unit: n.unit, level: n.level, items: [] }; byUnit.push(g); }
    g.items.push(n);
  }

  for (const g of byUnit) {
    const lessons = g.items.filter((n) => n.kind === "lesson");
    const doneCount = lessons.filter((n) => n.state === "done").length;
    root.append(h("div", { class: "unit-banner" },
      h("div", {},
        h("div", { class: "ub-sub" }, `${pick(g.level.title, lang)}`),
        h("div", { class: "ub-title" }, pick(g.unit.title, lang))),
      h("span", { class: "ub-count" }, `${num(doneCount, lang)}/${num(lessons.length, lang)}`)));
    root.append(pathView(g.items, c));
  }
  return root;
}

const STEP = 108, TOP = 52;
function pathView(items, c) {
  const { t, lang } = c;
  const H = TOP + (items.length - 1) * STEP + 90;
  const pts = items.map((n, k) => ({ x: 50 + 24 * Math.sin(k * 1.35 + 0.6), y: TOP + k * STEP }));

  let base = `M${pts[0].x} ${pts[0].y}`, gold = "";
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const seg = `C${a.x} ${a.y + STEP / 2} ${b.x} ${b.y - STEP / 2} ${b.x} ${b.y}`;
    base += seg;
    if (items[k - 1].state === "done") gold += `M${a.x} ${a.y}${seg}`;
  }
  const line = svg(`<svg class="path-svg" aria-hidden="true" viewBox="0 0 100 ${H}" preserveAspectRatio="none" style="height:${H}px">
    <path d="${base}" fill="none" stroke="var(--path)" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${gold ? `<path d="${gold}" fill="none" stroke="var(--gold)" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : ""}</svg>`);

  const wrap = h("div", { class: "path", style: { height: `${H}px` } }, line);
  items.forEach((n, k) => {
    const p = pts[k];
    const size = n.state === "current" ? 88 : 72;
    const ic = n.state === "done" ? icon("check", 34, "var(--on-gold)", "none")
      : n.state === "locked" ? icon("lock", 30, "var(--lock-ic)")
      : n.kind === "test" ? icon("flag", 38, "var(--on-primary)") : icon("book", 40, "var(--on-primary)");
    const name = pick(n.title, lang);
    const label = n.kind === "test" ? t.unitTest : name;
    const aria = `${label}${n.state === "done" ? " ✓" : n.state === "locked" ? " 🔒" : ""}`;
    const btn = h("button", {
      class: `node ${n.state} ${n.kind}`, type: "button", "aria-label": aria,
      style: { width: `${size}px`, height: `${size}px`, left: `calc(${p.x}% - ${size / 2}px)`, top: `${p.y - size / 2}px` },
      onclick: () => c.onNode(n),
    }, ic);
    const side = p.x >= 50 ? "l" : "r";
    const lbl = h("div", { class: `node-lbl ${side}${n.state === "current" ? " cur" : ""}`, style: side === "l" ? { right: `calc(${100 - p.x}% + ${size / 2 + 10}px)`, top: `${p.y - 20}px` } : { left: `calc(${p.x}% + ${size / 2 + 10}px)`, top: `${p.y - 20}px` } }, label);
    wrap.append(btn, lbl);
    if (n.state === "current") wrap.append(h("div", { class: "pulse", style: { width: `${size + 18}px`, height: `${size + 18}px`, left: `calc(${p.x}% - ${(size + 18) / 2}px)`, top: `${p.y - (size + 18) / 2}px` } }));
  });
  return wrap;
}

// ───────────── المراجعة ─────────────
export function reviewView(c) {
  const { t, lang, me } = c;
  const n = me.dueCount;
  return h("div", { class: "screen center" },
    h("h1", {}, t.reviewTitle),
    mascot(n > 0 ? "think" : "happy", 110),
    h("p", { class: "lead" }, n > 0 ? t.reviewDue(num(n, lang)) : t.reviewNone),
    n > 0 ? h("button", { class: "btn primary wide", type: "button", onclick: c.onStartReview }, t.reviewStart) : null);
}

// ───────────── التقدّم ─────────────
export function progressView(c) {
  const { t, lang, me, nodes } = c;
  const lessons = nodes.filter((n) => n.kind === "lesson");
  const passed = lessons.filter((n) => n.state === "done").length;
  const card = (label, value, ic) => h("div", { class: "stat-card" }, ic, h("div", { class: "sc-v" }, value), h("div", { class: "sc-l" }, label));
  const root = h("div", { class: "screen" }, h("h1", {}, t.progTitle),
    h("div", { class: "stat-grid" },
      card(t.totalXp, num(me.user.xp, lang), icon("star", 26, "var(--gold-d)", "var(--gold)")),
      card(t.streak, num(me.user.streak, lang), icon("flame", 26, "var(--flame-d)", "var(--flame)")),
      card(t.bestStreak, num(me.user.best_streak, lang), icon("flame", 26, "var(--muted)")),
      card(t.lessonsPassed, `${num(passed, lang)}/${num(lessons.length, lang)}`, icon("check", 26, "var(--primary)"))));
  const ring = (pct, size, stroke, cls) => {
    const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
    return svg(`<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--primary)" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`);
  };
  const pct = lessons.length ? Math.round((passed / lessons.length) * 100) : 0;
  const cur = nodes.find((n) => n.state === "current");
  root.append(h("div", { class: "ring-card", role: "img", "aria-label": `${num(pct, lang)}%` },
    h("div", { class: "ring-big" }, ring(pct, 190, 18, "ring-svg"),
      h("div", { class: "ring-c" }, h("b", {}, `${num(pct, lang)}${lang === "ar" ? "٪" : "%"}`), h("small", {}, t.progOf(num(passed, lang), num(lessons.length, lang))))),
    h("div", { class: "ring-sub" }, cur ? t.progAt(pick(cur.level.title, lang)) : t.greetDone)));
  const levels = [];
  for (const n of lessons) if (!levels.some((l) => l.id === n.level.id)) levels.push(n.level);
  root.append(h("div", { class: "ring-mini" }, levels.map((lv) => {
    const ls = lessons.filter((x) => x.level.id === lv.id);
    const d = ls.filter((x) => x.state === "done").length;
    const p = ls.length ? Math.round((d / ls.length) * 100) : 0;
    return h("div", { class: "rm" }, ring(p, 46, 6, "rm-svg"), h("span", {}, `${t.level} ${num(lv.id.slice(1), lang)}`), h("b", {}, `${num(p, lang)}${lang === "ar" ? "٪" : "%"}`));
  })));
  return root;
}

// ───────────── حسابي ─────────────
export function meView(c) {
  const { t, lang, me } = c;
  const seg = (items, active, onpick) => h("div", { class: "seg", role: "group" }, items.map(([val, label]) =>
    h("button", { class: `seg-btn${val === active ? " on" : ""}`, type: "button", "aria-pressed": String(val === active), onclick: () => onpick(val) }, label)));

  const tzOff = -new Date().getTimezoneOffset() / 60; // ساعات
  const toLocal = (utc) => (((utc + tzOff) % 24) + 24) % 24;
  const toUtc = (loc) => (((loc - tzOff) % 24) + 24) % 24;
  const hours = h("select", { class: "select", "aria-label": t.reminder, disabled: c.isDemo, onchange: (e) => c.onSetting({ reminder_hour: e.target.value === "" ? null : Math.round(toUtc(Number(e.target.value))) }) },
    h("option", { value: "" }, t.off),
    Array.from({ length: 24 }, (_, k) => h("option", { value: String(k), selected: me.user.reminder_hour !== null && Math.round(toLocal(me.user.reminder_hour)) === k }, t.hourFmt(k))));

  const themes = h("div", { class: "swatches" }, ["warm", "night", "sage", "telegram"].map((th) =>
    h("button", { class: `swatch th-${th}${me.user.theme === th ? " on" : ""}`, type: "button", "aria-pressed": String(me.user.theme === th), "aria-label": t.themeNames[th], onclick: () => c.onSetting({ theme: th }) },
      h("span", { class: "sw-dot" }), h("span", { class: "sw-name" }, t.themeNames[th]))));

  return h("div", { class: "screen" },
    h("h1", {}, t.meTitle),
    me.user.first_name ? h("p", { class: "lead small" }, me.user.first_name) : null,
    h("section", { class: "set" }, h("h2", {}, t.track),
      seg([["native", "أتقن العربية"], ["learner", "Learn Arabic"]], me.user.track, (v) => c.onSetting({ track: v }))),
    h("section", { class: "set" }, h("h2", {}, t.placementMe), h("p", { class: "lead small" }, t.placementMeSub),
      h("button", { class: "btn ghost", type: "button", onclick: c.onPlacement }, t.placementBtn)),
    h("section", { class: "set" }, h("h2", {}, t.language), seg(Object.entries(t.langNames), lang, (v) => c.onSetting({ ui_lang: v }))),
    h("section", { class: "set" }, h("h2", {}, t.theme), themes),
    h("section", { class: "set" }, h("h2", {}, t.vibration), seg([[true, t.on], [false, t.offV]], c.hapticOn, (v) => c.onHaptic(v))),
    h("section", { class: "set" }, h("h2", {}, t.reminder), hours),
    c.isDemo ? h("p", { class: "demo-banner", role: "note" }, t.demoBanner) : null);
}

// ───────────── اختيار المسار (أول مرة) ─────────────
export function onboardingView(c) {
  const t = c.t;
  const card = (track, title, sub, dir) => h("button", { class: "track-card", type: "button", dir, onclick: () => c.onPickTrack(track) },
    h("div", { class: "tc-title" }, title), h("div", { class: "tc-sub" }, sub));
  return h("div", { class: "screen center onboard" },
    mascot("cheer", 120),
    h("h1", {}, "تَعلّمْ · Ta3lam"),
    h("p", { class: "lead" }, "ما الذي تريد أن تتعلّمه؟ / What do you want to learn?"),
    card("native", t.trackNative, t.trackNativeSub, "rtl"),
    card("learner", t.trackLearner, t.trackLearnerSub, "ltr"));
}

// ───────────── شاشة النتيجة ─────────────
export function resultView(c) {
  const { t, lang, res, onAction } = c;
  const mood = res.decision === "pass" ? "cheer" : res.decision === "review" ? "happy" : "think";
  const msg = res.decision === "pass" ? t.resPass : res.decision === "review" ? t.resReview : t.resRepeat;
  const root = h("div", { class: "result", dir: c.dir });
  root.append(
    h("div", { class: "res-body" },
      mascot(mood, 120),
      h("h1", {}, res.decision === "pass" ? t.passed : t.tryAgain),
      h("div", { class: "res-score", "aria-label": t.score }, `${num(res.correct, lang)} / ${num(res.total, lang)}`),
      h("p", { class: "lead" }, msg),
      h("div", { class: "res-chips" },
        h("span", { class: "chip gold" }, icon("star", 18, "var(--gold-d)", "var(--gold)"), t.xpGained(num(res.xp, lang))),
        res.streak ? h("span", { class: "chip" }, icon("flame", 18, "var(--flame-d)", "var(--flame)"), num(res.streak, lang)) : null),
      res.weak && res.weak.length ? h("section", { class: "weak" }, h("h2", {}, t.weak),
        res.weak.slice(0, 5).map((q) => h("div", { class: "weak-item" }, richEl("div", { class: "w-q" }, q.prompt), richEl("div", { class: "w-e" }, q.explain)))) : null),
    h("div", { class: "foot col" },
      res.decision === "pass"
        ? h("button", { class: "btn primary", type: "button", onclick: () => onAction("home") }, t.backHome)
        : [
          h("button", { class: "btn primary", type: "button", onclick: () => onAction(res.decision === "review" ? "retry" : "study") }, res.decision === "review" ? t.retryQuiz : t.studyAgain),
          h("button", { class: "btn ghost", type: "button", onclick: () => onAction(res.decision === "review" ? "study" : "retry") }, res.decision === "review" ? t.studyAgain : t.retryQuiz),
          h("button", { class: "btn ghost", type: "button", onclick: () => onAction("home") }, t.backHome),
        ]));
  return root;
}

// ───────────── نتيجة اختبار تحديد المستوى ─────────────
export function placementResultView(c) {
  const { t, lang, out, total, onDone } = c;
  const msg = out.skippedUnits === 0 ? t.placementFromStart
    : out.nextUnit ? t.placementSkip(num(out.skippedUnits, lang), pick(out.nextUnit.title, lang))
    : t.placementAll(num(out.skippedUnits, lang));
  const root = h("div", { class: "result", dir: c.dir });
  root.append(
    h("div", { class: "res-body" }, mascot(out.skippedUnits ? "cheer" : "happy", 120), h("h1", {}, t.placementDoneH), h("p", { class: "lead" }, msg)),
    h("div", { class: "foot col" }, h("button", { class: "btn primary", type: "button", onclick: onDone }, t.backHome)));
  return root;
}

// ───────────── التنقل السفلي ─────────────
export function navView(c) {
  const { t, lang, tab, me } = c;
  const item = (id, label, ic, badge) => h("button", { class: `nav-btn${tab === id ? " on" : ""}`, type: "button", "aria-current": tab === id ? "page" : null, onclick: () => c.onTab(id) },
    h("span", { class: "nav-ic" }, icon(ic, 26), badge > 0 ? h("span", { class: "badge", "aria-label": `${badge}` }, num(Math.min(badge, 99), lang)) : null),
    h("span", {}, label));
  return h("nav", { class: "nav" },
    item("home", t.home, "home", 0), item("review", t.review, "cards", me.dueCount),
    item("progress", t.progress, "chart", 0), item("me", t.me, "user", 0));
}

export function errorView(c) {
  return h("div", { class: "screen center" }, mascot("think", 110), h("p", { class: "lead" }, c.t.loadError),
    h("button", { class: "btn primary wide", type: "button", onclick: c.onRetry }, c.t.retry));
}
