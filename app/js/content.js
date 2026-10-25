// تحميل المنهج والدروس من ملفات JSON الثابتة.
let indexP = null;
const lessonCache = new Map();

export const loadIndex = () => (indexP ??= fetch("content/index.json").then((r) => { if (!r.ok) throw new Error("index"); return r.json(); }));

// لغة المحتوى: الترجمات (مثل الفرنسية) ملفات جانبية <id>.fr.json؛ إن لم توجد نرجع للأصل.
let contentLang = "en";
export const setContentLang = (l) => { contentLang = l; };
const getJson = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });

export async function loadLesson(id) {
  const tr = contentLang === "fr" && id.startsWith("ln-") ? contentLang : null;
  const key = `${id}|${tr || ""}`;
  if (!lessonCache.has(key)) {
    lessonCache.set(key, (tr ? getJson(`content/lessons/${id}.${tr}.json`).catch(() => getJson(`content/lessons/${id}.json`)) : getJson(`content/lessons/${id}.json`)));
  }
  return lessonCache.get(key);
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

/** الاختبار النهائي: سؤال واحد عشوائي من اختبار درس عشوائي في كل وحدة من وحدات المسار. */
export async function finalExamQuestions(track) {
  const units = track.levels.flatMap((lv) => lv.units).filter((u) => !u.final && u.lessons.length);
  const qs = await Promise.all(units.map(async (u) => {
    const l = await loadLesson(u.lessons[Math.floor(Math.random() * u.lessons.length)].id);
    return l.quiz[Math.floor(Math.random() * l.quiz.length)];
  }));
  for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
  return qs.slice(0, 40);
}

const PER_UNIT = 4, MAX_UNITS = 6;

/** خطة اختبار تحديد المستوى: عدة وحدات موزّعة على المسار بالتساوي، ولكل وحدة 4 أسئلة من اختبارات دروسها بالتناوب. */
export async function placementPlan(track) {
  const units = track.levels.flatMap((lv) => lv.units);
  const idx = units.length <= MAX_UNITS ? units.map((_, i) => i)
    : Array.from({ length: MAX_UNITS }, (_, k) => Math.round((k * (units.length - 1)) / (MAX_UNITS - 1)));
  const shuf = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return Promise.all(idx.map(async (i) => {
    const u = units[i];
    const lessons = await Promise.all(u.lessons.map((l) => loadLesson(l.id)));
    const pools = lessons.map((l) => shuf(l.quiz));
    const qs = [];
    for (let r = 0; qs.length < PER_UNIT && r < 50; r++) for (const p of pools) if (p[r] && qs.length < PER_UNIT) qs.push(p[r]);
    return { unitIndex: i, unit: u, questions: qs, need: Math.ceil(qs.length * 0.75) };
  }));
}

/** ينفّذ قرار الاختبار: كل الوحدات حتى آخر وحدة مُختبَرة ناجحة قبل أول فشل تُعتبر مُتخطّاة. */
export function placementOutcome(track, plan, results) {
  const ok = new Map(results.map((x) => [x.id, x.correct]));
  const units = track.levels.flatMap((lv) => lv.units);
  let last = -1;
  for (const p of plan) {
    const right = p.questions.filter((q) => ok.get(q.id)).length;
    if (right >= p.need) last = p.unitIndex; else break;
  }
  const skipped = units.slice(0, last + 1);
  const passedIds = skipped.flatMap((u) => [...u.lessons.map((l) => l.id), `${u.id}-test`]);
  return { passedIds, skippedUnits: skipped.length, nextUnit: units[last + 1] || null };
}
