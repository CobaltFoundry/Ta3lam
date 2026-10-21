// منطق التعليم: مستقل تمامًا عن تليجرام وعن قاعدة البيانات،
// فيمكن إعادة استخدامه في تطبيق أندرويد لاحقًا.

export const PASS = 0.8;
export const REPEAT_BELOW = 0.6;

export function decide(score) {
  if (score >= PASS) return "pass";
  if (score >= REPEAT_BELOW) return "review";
  return "repeat";
}

export function xpFor({ correct, total, decision }) {
  let xp = correct * 10;
  if (decision === "pass") xp += 15;
  if (total > 0 && correct === total) xp += 20;
  return xp;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** يقبل تاريخ العميل فقط إذا كان قريبًا من تاريخ الخادم (فرق المناطق الزمنية) */
export function cleanToday(clientDate, nowMs = Date.now()) {
  const server = new Date(nowMs).toISOString().slice(0, 10);
  if (typeof clientDate !== "string" || !DATE_RE.test(clientDate)) return server;
  const diff = Math.abs(Date.parse(clientDate) - Date.parse(server)) / 86400000;
  return diff <= 1 ? clientDate : server;
}

/** تحديث سلسلة الأيام المتتالية */
export function updateStreak(prevStreak, lastDate, today) {
  if (lastDate === today) return prevStreak || 1;
  if (lastDate) {
    const gap = Math.round((Date.parse(today) - Date.parse(lastDate)) / 86400000);
    if (gap === 1) return (prevStreak || 0) + 1;
  }
  return 1;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const isId = (s) => typeof s === "string" && ID_RE.test(s);

export function cleanIds(arr, max = 50) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.filter(isId))].slice(0, max);
}
