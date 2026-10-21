// نظام صناديق لايتنر للمراجعة المتباعدة.
// الصندوق 1..5 بفواصل أيام، والصندوق 6 = محفوظ (لا يظهر في المراجعة).

export const BOX_DAYS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
export const MASTERED = 6;

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** الحالة الجديدة بعد إجابة سؤال مراجعة */
export function nextState(box, correct, today) {
  if (!correct) return { box: 1, due_date: addDays(today, BOX_DAYS[1]) };
  const nb = Math.min(box + 1, MASTERED);
  if (nb === MASTERED) return { box: MASTERED, due_date: "9999-12-31" };
  return { box: nb, due_date: addDays(today, BOX_DAYS[nb]) };
}

/** سؤال أخطأ فيه المتعلم داخل درس يدخل الصندوق 1 (يُراجع غدًا) */
export function newMistake(today) {
  return { box: 1, due_date: addDays(today, 1) };
}
