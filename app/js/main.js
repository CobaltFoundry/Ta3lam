// نقطة الدخول: الحالة، التنقل، وربط المشغّل بالخادم.
import { call, isDemo, telegram } from "./api.js";
import { loadIndex, loadLesson, flattenTrack, lessonOfQuestion, unitTestQuestions, placementPlan, placementOutcome } from "./content.js";
import { runPlayer } from "./player.js";
import { homeView, reviewView, progressView, meView, onboardingView, resultView, placementResultView, navView, errorView } from "./views.js";
import { T } from "./i18n.js";
import { h, localDate } from "./util.js";

const S = { me: null, index: null, tab: "home", busy: false };
const $ = (id) => document.getElementById(id);

const lang = () => (S.me?.user.ui_lang === "en" ? "en" : "ar");
const t = () => T[lang()];
const trackObj = () => S.index.tracks.find((x) => x.id === S.me.user.track);
const today = () => localDate();

// ───────────── المظهر واللغة ─────────────
function applyLook() {
  const u = S.me?.user;
  const l = lang();
  const root = document.documentElement;
  root.lang = l;
  root.dir = l === "ar" ? "rtl" : "ltr";
  root.dataset.theme = u?.theme || "warm";
  document.title = T[l].appName;
  if (telegram) {
    try {
      const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
      if (bg.startsWith("#")) { telegram.setHeaderColor(bg); telegram.setBackgroundColor(bg); }
    } catch { /* نسخ قديمة */ }
  }
}

const HK = "ta3lam.haptic";
const hapticOn = () => { try { return localStorage.getItem(HK) !== "off"; } catch { return true; } };
function setHaptic(on) {
  try { localStorage.setItem(HK, on ? "on" : "off"); } catch { /* التخزين غير متاح */ }
  render();
  if (on) haptic("light");
}

const haptic = (kind) => {
  const hf = hapticOn() ? telegram?.HapticFeedback : null;
  if (!hf) return;
  try { if (kind === "success" || kind === "error") hf.notificationOccurred(kind); else hf.impactOccurred("light"); } catch { /* تجاهل */ }
};

function toast(msg) {
  const el = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

const confirmLeave = () => new Promise((res) => {
  const msg = t().leaveConfirm;
  if (telegram?.showConfirm) telegram.showConfirm(msg, (ok) => res(!!ok)); else res(window.confirm(msg));
});

// ───────────── عقد المسار وحالاتها ─────────────
function nodesWithState() {
  const passed = new Map(S.me.progress.map((p) => [p.lesson_id, p.status === "passed"]));
  let open = true; // أول عقدة غير ناجحة = الحالية، وما بعدها مقفل
  return flattenTrack(trackObj()).map((n) => {
    let state;
    if (passed.get(n.id)) state = "done";
    else if (open) { state = "current"; open = false; }
    else state = "locked";
    return { ...n, state };
  });
}

// ───────────── العرض ─────────────
function ctx() {
  const base = { t: t(), lang: lang(), me: S.me, isDemo, tab: S.tab, onTab: (id) => { S.tab = id; render(); } };
  if (!S.me.user.track) return base;
  return {
    ...base, track: trackObj(), nodes: nodesWithState(),
    onNode: onNode, onStartReview: startReview, onSetting: saveSettings, hapticOn: hapticOn(), onHaptic: setHaptic, onPlacement: startPlacement,
  };
}

function render() {
  const view = $("view"), nav = $("nav");
  applyLook();
  if (!S.me.user.track) {
    nav.replaceChildren();
    view.replaceChildren(onboardingView({ ...ctx(), onPickTrack: (track) => saveSettings({ track, ui_lang: track === "native" ? "ar" : "en" }) }));
    return;
  }
  const c = ctx();
  const screens = { home: homeView, review: reviewView, progress: progressView, me: meView };
  view.replaceChildren(screens[S.tab](c));
  nav.replaceChildren(navView(c));
  view.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

function showError(retry) {
  $("nav").replaceChildren();
  $("view").replaceChildren(errorView({ t: t(), onRetry: retry }));
}

// ───────────── الإعدادات ─────────────
async function saveSettings(patch) {
  try {
    const r = await call("/api/settings", { ...patch, today: today() });
    S.me = r;
    S.tab = patch.track ? "home" : S.tab;
    render();
  } catch { toast(t().loadError); }
}

// ───────────── اللعب ─────────────
async function onNode(n) {
  if (S.busy) return;
  if (n.state === "locked") { toast(t().lockedToast); haptic("error"); return; }
  S.busy = true;
  try {
    if (n.kind === "lesson") await playLesson(n.id, n.title[lang()] || n.title.en);
    else await playUnitTest(n);
  } catch (e) {
    console.error(e);
    toast(t().loadError);
  } finally { S.busy = false; render(); }
}

const playerBase = () => ({ t: t(), dir: S.me.user.track === "native" ? "rtl" : "ltr", haptic, confirmLeave });

function showResult(res, extra = {}) {
  return new Promise((resolve) => {
    const ov = $("overlay");
    const el = resultView({ t: t(), lang: lang(), dir: playerBase().dir, res: { ...res, ...extra }, onAction: (a) => { el.remove(); resolve(a); } });
    ov.append(el);
    document.body.classList.add("no-scroll");
  }).finally(() => document.body.classList.remove("no-scroll"));
}

async function submit(lessonId, r) {
  const resp = await call("/api/lesson/complete", { lessonId, total: r.total, correct: r.correct, wrongIds: r.wrongIds, today: today() });
  S.me = { user: resp.user, progress: resp.progress, dueCount: resp.dueCount };
  return resp;
}

async function playLesson(lessonId, title) {
  const lesson = await loadLesson(lessonId);
  let mode = "full";
  for (;;) {
    const opts = mode === "full" ? { lesson } : { questions: lesson.quiz };
    const r = await runPlayer({ ...playerBase(), title, ...opts });
    if (!r) return;
    const resp = await submit(lessonId, r);
    const all = [...lesson.practice, ...lesson.quiz];
    const weak = r.wrongIds.map((id) => all.find((q) => q.id === id)).filter(Boolean);
    const action = await showResult({ decision: resp.decision, xp: resp.xp, streak: resp.streak, correct: r.correct, total: r.total }, { weak });
    if (action === "retry") mode = "quiz";
    else if (action === "study") mode = "full";
    else return;
  }
}

async function playUnitTest(n) {
  for (;;) {
    const questions = await unitTestQuestions(n.unit, 15);
    const r = await runPlayer({ ...playerBase(), title: t().unitTest, questions });
    if (!r) return;
    const resp = await submit(n.id, r);
    const weak = r.wrongIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
    const action = await showResult({ decision: resp.decision, xp: resp.xp, streak: resp.streak, correct: r.correct, total: r.total }, { weak });
    if (action === "home") return;
  }
}

async function startPlacement() {
  if (S.busy) return;
  S.busy = true;
  try {
    const track = trackObj();
    const plan = await placementPlan(track);
    const questions = plan.flatMap((p) => p.questions);
    const r = await runPlayer({ ...playerBase(), title: t().placementTitle, questions });
    if (!r) return;
    const out = placementOutcome(track, plan, r.results);
    const resp = await call("/api/placement", { passedIds: out.passedIds, wrongIds: r.wrongIds, today: today() });
    S.me = { user: resp.user, progress: resp.progress, dueCount: resp.dueCount };
    S.tab = "home";
    await new Promise((resolve) => {
      const el = placementResultView({ t: t(), lang: lang(), dir: playerBase().dir, out, onDone: () => { el.remove(); resolve(); } });
      $("overlay").append(el);
    });
  } catch (e) {
    console.error(e);
    toast(t().loadError);
  } finally { S.busy = false; render(); }
}

async function startReview() {
  if (S.busy) return;
  S.busy = true;
  try {
    const { due } = await call("/api/review/due", { today: today() });
    const lessonIds = [...new Set(due.map((d) => lessonOfQuestion(d.question_id)))];
    const lessons = await Promise.all(lessonIds.map((id) => loadLesson(id).catch(() => null)));
    const pool = new Map();
    lessons.filter(Boolean).forEach((l) => [...l.practice, ...l.quiz].forEach((q) => pool.set(q.id, q)));
    const questions = due.map((d) => pool.get(d.question_id)).filter(Boolean);
    if (!questions.length) { toast(t().reviewNone); return; }
    const r = await runPlayer({ ...playerBase(), title: t().reviewTitle, questions });
    if (!r) return;
    const resp = await call("/api/review/answer", { results: r.results, today: today() });
    S.me = { user: resp.user, progress: resp.progress, dueCount: resp.dueCount };
    await showResult({ decision: "pass", xp: resp.xp, streak: resp.user.streak, correct: r.correct, total: r.total, weak: [] });
  } catch (e) {
    console.error(e);
    toast(t().loadError);
  } finally { S.busy = false; render(); }
}

// ───────────── الإقلاع ─────────────
async function boot() {
  if (telegram) { telegram.ready(); telegram.expand(); }
  try {
    const [index, me] = await Promise.all([loadIndex(), call("/api/me", { today: today() })]);
    S.index = index;
    S.me = me;
    render();
  } catch (e) {
    console.error(e);
    S.me ??= { user: { ui_lang: "ar", theme: "warm" }, progress: [], dueCount: 0 };
    applyLook();
    showError(() => location.reload());
  }
}

boot();
