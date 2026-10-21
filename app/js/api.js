// طبقة الاتصال: الخادم الحقيقي داخل تليجرام، أو وضع تجريبي محلي خارجه.
import { API_URL } from "./config.js";
import { decide, xpFor, cleanToday, updateStreak, cleanIds, isId } from "./shared/engine.js";
import { nextState, newMistake } from "./shared/srs.js";

const tg = window.Telegram?.WebApp;
const initData = tg?.initData || "";

export const isDemo = !initData || API_URL.includes("YOUR");
export const telegram = tg || null;
export const tgUser = tg?.initDataUnsafe?.user || null;

const TRACKS = ["native", "learner"], THEMES = ["warm", "night", "sage", "telegram"], LANGS = ["ar", "en"];

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
  progress: {}, reviews: {},
});
function load() { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return blank(); } }
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* التخزين غير متاح */ } }

function snapshot(s, today) {
  return {
    user: s.user,
    progress: Object.entries(s.progress).map(([lesson_id, p]) => ({ lesson_id, ...p })),
    dueCount: Object.values(s.reviews).filter((r) => r.due_date <= today).length,
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
      const streak = updateStreak(s.user.streak, s.user.last_active_date, today);
      const p = s.progress[b.lessonId] || { best_score: 0, status: "in_progress", attempts: 0 };
      p.best_score = Math.max(p.best_score, score);
      p.status = p.status === "passed" || decision === "pass" ? "passed" : "in_progress";
      p.attempts += 1;
      s.progress[b.lessonId] = p;
      Object.assign(s.user, { xp: s.user.xp + xp, streak, best_streak: Math.max(s.user.best_streak, streak), last_active_date: today });
      for (const qid of cleanIds(b.wrongIds)) s.reviews[qid] = newMistake(today);
      save(s);
      return { decision, xp, streak, ...snapshot(s, today) };
    }

    case "/api/review/due": {
      const due = Object.entries(s.reviews).filter(([, r]) => r.due_date <= today)
        .sort((a, b2) => a[1].due_date.localeCompare(b2[1].due_date)).slice(0, 20)
        .map(([question_id, r]) => ({ question_id, box: r.box }));
      return { due };
    }

    case "/api/review/answer": {
      let right = 0;
      for (const r of (b.results || []).slice(0, 50)) {
        const row = s.reviews[r?.id];
        if (!row) continue;
        if (r.correct) right++;
        s.reviews[r.id] = nextState(row.box, !!r.correct, today);
      }
      const xp = right * 5, streak = updateStreak(s.user.streak, s.user.last_active_date, today);
      Object.assign(s.user, { xp: s.user.xp + xp, streak, best_streak: Math.max(s.user.best_streak, streak), last_active_date: today });
      save(s);
      return { xp, ...snapshot(s, today) };
    }
    default: throw new Error("unknown route " + path);
  }
}
