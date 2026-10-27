// الأوسمة والرتب والدرر: دوال نقية على كائن حالة بسيط.
// مشتركة بين الخادم (D1) والوضع التجريبي (localStorage) فيتطابق السلوك تمامًا.
import { LEVEL_LESSONS, FINAL_ID } from "./levels.js";
import { addDays } from "./srs.js";

export const RANK_XP = [0, 2000, 4500, 7500, 11000, 14500, 20000];
export const rankOf = (xp) => {
  let r = 0;
  for (let i = 0; i < RANK_XP.length; i++) if ((xp || 0) >= RANK_XP[i]) r = i;
  return r;
};

export const BADGE_GROUPS = ["streak", "progress", "mastery", "volume", "surprise"];
export const BADGES = [
  { id: "streak3", group: "streak" }, { id: "streak7", group: "streak" }, { id: "streak30", group: "streak" }, { id: "streak100", group: "streak" }, { id: "goal", group: "streak" },
  { id: "first", group: "progress" }, { id: "lvl1", group: "progress" }, { id: "lvl2", group: "progress" }, { id: "lvl3", group: "progress" },
  { id: "lvl4", group: "progress" }, { id: "lvl5", group: "progress" }, { id: "lvl6", group: "progress" }, { id: "final", group: "progress" },
  { id: "flawless", group: "mastery" }, { id: "five", group: "mastery" }, { id: "master", group: "mastery" }, { id: "iron", group: "mastery" }, { id: "reviewer", group: "mastery" },
  { id: "c100", group: "volume" }, { id: "c1000", group: "volume" }, { id: "marathon", group: "volume" },
  { id: "owl", group: "surprise" }, { id: "early", group: "surprise" }, { id: "eagle", group: "surprise" },
];
const BADGE_IDS = new Set(BADGES.map((b) => b.id));

export const BADGE_GEMS = 10;
export const GOAL_GEMS = 30;
export const GOALS = [3, 5, 7];
export const FREEZE_COST = 100;
export const FREEZE_MAX = 2;
const PASS_FINAL = 0.8;

export const blankState = () => ({
  gems: 0, correct: 0, reviewCorrect: 0, perfectIds: [], lessonsDay: "", lessonsToday: 0,
  weekKey: "", weekDays: 0, goalDays: 5, goalClaimed: "", freezes: 0, badges: {},
});

/** يدمج حالة محفوظة (قد تكون ناقصة أو تالفة) في حالة سليمة */
export function cleanState(raw) {
  const s = blankState();
  if (!raw || typeof raw !== "object") return s;
  const n = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  s.gems = n(raw.gems); s.correct = n(raw.correct); s.reviewCorrect = n(raw.reviewCorrect);
  s.perfectIds = Array.isArray(raw.perfectIds) ? raw.perfectIds.filter((x) => typeof x === "string").slice(0, 400) : [];
  s.lessonsDay = typeof raw.lessonsDay === "string" ? raw.lessonsDay : ""; s.lessonsToday = n(raw.lessonsToday);
  s.weekKey = typeof raw.weekKey === "string" ? raw.weekKey : ""; s.weekDays = n(raw.weekDays);
  s.goalDays = GOALS.includes(raw.goalDays) ? raw.goalDays : 5;
  s.goalClaimed = typeof raw.goalClaimed === "string" ? raw.goalClaimed : "";
  s.freezes = Math.min(n(raw.freezes), FREEZE_MAX);
  if (raw.badges && typeof raw.badges === "object") for (const [k, v] of Object.entries(raw.badges)) if (BADGE_IDS.has(k)) s.badges[k] = String(v).slice(0, 10);
  return s;
}

/** بداية الأسبوع (السبت) لتاريخ YYYY-MM-DD */
export function weekStart(date) {
  const d = new Date(date + "T00:00:00Z");
  return addDays(date, -((d.getUTCDay() + 1) % 7));
}

/** إجازة السلسلة: لو فاته يوم واحد بالضبط ولديه إجازة، تُستهلك ويُعامَل كأنه نشط أمس */
export function applyFreeze(s, lastDate, today) {
  if (!lastDate || lastDate === today || s.freezes < 1) return lastDate;
  const gap = Math.round((Date.parse(today) - Date.parse(lastDate)) / 86400000);
  if (gap !== 2) return lastDate;
  s.freezes -= 1;
  return addDays(today, -1);
}

function award(s, id, today, out) {
  if (s.badges[id]) return;
  s.badges[id] = today;
  s.gems += BADGE_GEMS; out.gained += BADGE_GEMS;
  out.newBadges.push(id);
}

function streakBadges(s, streak, today, out) {
  if (streak >= 3) award(s, "streak3", today, out);
  if (streak >= 7) award(s, "streak7", today, out);
  if (streak >= 30) award(s, "streak30", today, out);
  if (streak >= 100) award(s, "streak100", today, out);
}

function volumeBadges(s, today, out) {
  if (s.correct >= 100) award(s, "c100", today, out);
  if (s.correct >= 1000) award(s, "c1000", today, out);
}

/** يسجّل يوم نشاط جديدًا في الأسبوع الحالي، ويمنح هدف الأسبوع */
function touchDay(s, today, lastActive, out) {
  const wk = weekStart(today);
  if (s.weekKey !== wk) { s.weekKey = wk; s.weekDays = 0; }
  if (lastActive !== today || s.weekDays === 0) s.weekDays += 1;
  if (s.weekDays >= s.goalDays && s.goalClaimed !== wk) {
    s.goalClaimed = wk;
    s.gems += GOAL_GEMS; out.gained += GOAL_GEMS;
    award(s, "goal", today, out);
  }
}

const newOut = () => ({ gained: 0, newBadges: [] });

/** بعد إنهاء درس أو اختبار. passedIds: مجموعة الدروس الناجحة بعد التحديث */
export function onLesson(s, ev) {
  const out = newOut();
  const { lessonId, correct, total, decision, hour, today, lastActive, streak, passedIds } = ev;
  s.correct += correct; s.gems += correct; out.gained += correct;
  const pass = decision === "pass";

  if (pass && correct === total && total >= 1 && !s.perfectIds.includes(lessonId) && s.perfectIds.length < 400) s.perfectIds.push(lessonId);
  if (s.lessonsDay !== today) { s.lessonsDay = today; s.lessonsToday = 0; }
  if (pass) s.lessonsToday += 1;

  if (pass && passedIds.size >= 1) award(s, "first", today, out);
  streakBadges(s, streak, today, out);
  for (const [key, ids] of Object.entries(LEVEL_LESSONS)) {
    if (ids.length && ids.every((id) => passedIds.has(id))) award(s, "lvl" + key.slice(4), today, out);
  }
  if (lessonId === FINAL_ID && total > 0 && correct / total >= PASS_FINAL) award(s, "final", today, out);
  if (s.perfectIds.length >= 1) award(s, "flawless", today, out);
  if (s.perfectIds.length >= 5) award(s, "five", today, out);
  if (s.perfectIds.length >= 20) award(s, "master", today, out);
  volumeBadges(s, today, out);
  if (s.lessonsToday >= 3) award(s, "marathon", today, out);
  if (pass && Number.isInteger(hour)) {
    if (hour >= 0 && hour < 4) award(s, "owl", today, out);
    if (hour >= 4 && hour < 7) award(s, "early", today, out);
  }
  touchDay(s, today, lastActive, out);
  return out;
}

/** بعد جلسة مراجعة. mastered: عدد الأسئلة التي وصلت لآخر صندوق */
export function onReview(s, ev) {
  const out = newOut();
  const { right, mastered, today, lastActive, streak } = ev;
  s.correct += right; s.reviewCorrect += right; s.gems += right; out.gained += right;
  if (mastered > 0) award(s, "iron", today, out);
  if (s.reviewCorrect >= 50) award(s, "reviewer", today, out);
  streakBadges(s, streak, today, out);
  volumeBadges(s, today, out);
  touchDay(s, today, lastActive, out);
  return out;
}

export function onReport(s, today) {
  const out = newOut();
  award(s, "eagle", today, out);
  return out;
}

export function buyFreeze(s) {
  if (s.freezes >= FREEZE_MAX) return "max";
  if (s.gems < FREEZE_COST) return "gems";
  s.gems -= FREEZE_COST; s.freezes += 1;
  return "ok";
}

export function setGoal(s, days) {
  if (!GOALS.includes(days)) return false;
  s.goalDays = days;
  return true;
}

/** ما يراه العميل */
export function view(s, today) {
  const cur = weekStart(today) === s.weekKey;
  return { gems: s.gems, freezes: s.freezes, goalDays: s.goalDays, weekDays: cur ? s.weekDays : 0,
    badges: s.badges, correct: s.correct, perfect: s.perfectIds.length };
}
