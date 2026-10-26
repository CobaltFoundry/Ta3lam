// طبقة الاتصال: الخادم الحقيقي داخل تليجرام، أو وضع تجريبي محلي خارجه.
import { API_URL } from "./config.js";
import { decide, xpFor, cleanToday, updateStreak, cleanIds, isId, PASS } from "./shared/engine.js";
import { nextState, newMistake, MASTERED } from "./shared/srs.js";
import { cleanState, applyFreeze, onLesson, onReview, onReport, buyFreeze, setGoal, view as gview, rankOf } from "./shared/gamify.js";

const tg = window.Telegram?.WebApp;
const initData = tg?.initData || "";

export const isDemo = !initData || API_URL.includes("YOUR");
export const telegram = tg || null;
export const tgUser = tg?.initDataUnsafe?.user || null;

const TRACKS = ["native", "learner"], THEMES = ["warm", "night", "sage", "telegram"], LANGS = ["ar", "en", "fr"];

export async function call(path, payload = {}) {
  if (isDemo) return localCall(path, payload);
  const res = await fetch(API_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "tma " + initData },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ───────────── الوضع التجريبي (نفس منطق الخادم، لكن في localStorage) ─────────────
const KEY = "ta3lam.demo.v1";
const blank = () => ({
  user: { tg_id: 0, first_name: tgUser?.first_name || "", track: null, ui_lang: "ar", theme: "warm", xp: 0, streak: 0, best_streak: 0, last_active_date: null, reminder_hour: null },
  progress: {}, reviews: {}, g: null,
});
function load() { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return blank(); } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* التخزين غير متاح */ } }

function snapshot(s, today) {
  return {
    user: s.user,
    progress: Object.entries(s.progress).map(([lesson_id, p]) => ({ lesson_id, ...p })),
    dueCount: Object.values(s.reviews).filter((r) => r.due_date <= today).length,
    gamify: gview(cleanState(s.g), today),
  };
}

async function localCall(path, b) {
  const s = load();
  const today = cleanToday(b.today);
  switch (path) {
    case "/api/me": return snapshot(s, today);

    case "/api/settings":
      if (TRACKS.includes(b.track)) s.user.track = b.track;
      if (LANGS.includes(b.ui_lang)) s.user.ui_lang = b.ui_lang;
      if (THEMES.includes(b.theme)) s.user.theme = b.theme;
      save(s); return snapshot(s, today);

    case "/api/lesson/complete": {
      const total = Number(b.total), correct = Number(b.correct);
      if (!isId(b.lessonId) || !(total >= 1) || !(correct >= 0 && correct <= total)) throw new Error("bad input");
      const score = correct / total, decision = decide(score), xp = xpFor({ correct, total, decision });
      const g = cleanState(s.g), lastActive = s.user.last_active_date, xpBefore = s.user.xp;
      const streak = updateStreak(s.user.streak, applyFreeze(g, lastActive, today), today);
      const p = s.progress[b.lessonId] || { best_score: 0, status: "in_progress", attempts: 0 };
      p.best_score = Math.max(p.best_score, score);
      p.status = p.status === "passed" || decision === "pass" ? "passed" : "in_progress";
      p.attempts += 1;
      s.progress[b.lessonId] = p;
      Object.assign(s.user, { xp: s.user.xp + xp, streak, best_streak: Math.max(s.user.best_streak, streak), last_active_date: today });
      for (const qid of cleanIds(b.wrongIds)) s.reviews[qid] = newMistake(today);
      const passedIds = new Set(Object.entries(s.progress).filter(([, v]) => v.status === "passed").map(([k]) => k));
      const hour = Number.isInteger(b.hour) && b.hour >= 0 && b.hour <= 23 ? b.hour : null;
      const award = onLesson(g, { lessonId: b.lessonId, correct, total, decision, hour, today, lastActive, streak, passedIds });
      award.rankUp = rankOf(xpBefore + xp) > rankOf(xpBefore) ? rankOf(xpBefore + xp) : null;
      s.g = g;
      save(s);
      return { decision, xp, streak, award, ...snapshot(s, today) };
    }

    case "/api/placement": {
      for (const id of cleanIds(b.passedIds, 300)) {
        const p = s.progress[id] || { best_score: 0, status: "in_progress", attempts: 0 };
        p.status = "passed"; p.best_score = Math.max(p.best_score, PASS);
        s.progress[id] = p;
      }
      for (const qid of cleanIds(b.wrongIds)) s.reviews[qid] = newMistake(today);
      save(s); return snapshot(s, today);
    }

    case "/api/review/due": {
      const due = Object.entries(s.reviews).filter(([, r]) => r.due_date <= today)
        .sort((a, b2) => a[1].due_date.localeCompare(b2[1].due_date)).slice(0, 20)
        .map(([question_id, r]) => ({ question_id, box: r.box }));
      return { due };
    }

    case "/api/review/answer": {
      let right = 0, mastered = 0;
      for (const r of (b.results || []).slice(0, 50)) {
        const row = s.reviews[r?.id];
        if (!row) continue;
        if (r.correct) right++;
        const ns = nextState(row.box, !!r.correct, today);
        if (r.correct && ns.box === MASTERED) mastered++;
        s.reviews[r.id] = ns;
      }
      const g = cleanState(s.g), lastActive = s.user.last_active_date, xpBefore = s.user.xp;
      const xp = right * 5, streak = updateStreak(s.user.streak, applyFreeze(g, lastActive, today), today);
      Object.assign(s.user, { xp: s.user.xp + xp, streak, best_streak: Math.max(s.user.best_streak, streak), last_active_date: today });
      const award = onReview(g, { right, mastered, today, lastActive, streak });
      award.rankUp = rankOf(xpBefore + xp) > rankOf(xpBefore) ? rankOf(xpBefore + xp) : null;
      s.g = g;
      save(s);
      return { xp, award, ...snapshot(s, today) };
    }
    case "/api/report": {
      const g = cleanState(s.g), award = onReport(g, today);
      s.g = g; save(s);
      return { ok: true, award };
    }
    case "/api/shop/freeze": {
      const g = cleanState(s.g), result = buyFreeze(g);
      s.g = g; save(s);
      return { result, ...snapshot(s, today) };
    }
    case "/api/goal": {
      const g = cleanState(s.g);
      if (!setGoal(g, b.days)) throw new Error("bad goal");
      s.g = g; save(s);
      return snapshot(s, today);
    }

    default: throw new Error("unknown route " + path);
  }
}
