// تحميل المنهج والدروس من ملفات JSON الثابتة.
let indexP = null;
const lessonCache = new Map();

export const loadIndex = () => (indexP ??= fetch("content/index.json").then((r) => { if (!r.ok) throw new Error("index"); return r.json(); }));

export async function loadLesson(id) {
  if (!lessonCache.has(id)) {
    lessonCache.set(id, fetch(`content/lessons/${id}.json`).then((r) => { if (!r.ok) throw new Error("lesson " + id); return r.json(); }));
  }
  return lessonCache.get(id);
}

export const lessonOfQuestion = (qid) => qid.slice(0, qid.lastIndexOf("_"));

/** يبني قائمة مسطحة بدروس المسار بالترتيب + أنواع العقد (درس / اختبار وحدة) */
export function flattenTrack(track) {
  const nodes = [];
  for (const lv of track.levels) {
    for (const u of lv.units) {
      u.lessons.forEach((l, i) => nodes.push({ kind: "lesson", id: l.id, title: l.title, unit: u, level: lv, n: i + 1 }));
      nodes.push({ kind: "test", id: `${u.id}-test`, title: { ar: "اختبار الوحدة", en: "Unit test" }, unit: u, level: lv });
    }
  }
  return nodes;
}

/** أسئلة اختبار الوحدة: عيّنة من اختبارات دروس الوحدة */
export async function unitTestQuestions(unit, count = 15) {
  const lessons = await Promise.all(unit.lessons.map((l) => loadLesson(l.id)));
  const pool = lessons.flatMap((l) => l.quiz);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(count, a.length));
}
