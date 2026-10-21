// فحص سلامة المحتوى قبل نشره. يرمي خطأ عند أي مشكلة.
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function validateAll(lessons, index) {
  const errors = [];
  const err = (m) => errors.push(m);
  const seen = new Set();

  for (const l of lessons) {
    if (!ID_RE.test(l.id)) err(`${l.id}: bad lesson id`);
    if (l.id.includes("_")) err(`${l.id}: lesson id must not contain "_"`);
    if (seen.has(l.id)) err(`${l.id}: duplicate lesson id`);
    seen.add(l.id);
    if (!l.title?.ar || !l.title?.en) err(`${l.id}: missing title`);
    if (!Array.isArray(l.teach) || l.teach.length < 2) err(`${l.id}: teach too short`);
    for (const [k, b] of (l.teach || []).entries()) {
      if (!b || !["text", "tip", "letter"].includes(b.type)) err(`${l.id}: teach[${k}] bad type`);
      else if (b.type !== "letter" && (typeof b.text !== "string" || !b.text.trim())) err(`${l.id}: teach[${k}] needs text`);
    }
    if (l.practice.length < 4) err(`${l.id}: needs >=4 practice`);
    if (l.quiz.length < 8) err(`${l.id}: needs >=8 quiz`);
    if (l.quiz.length > 50) err(`${l.id}: quiz > 50`);

    for (const q of [...l.practice, ...l.quiz]) {
      const at = `${l.id}/${q.id}`;
      if (!q.id || !ID_RE.test(q.id) || !q.id.startsWith(l.id + "_")) err(`${at}: bad question id`);
      if (seen.has(q.id)) err(`${at}: duplicate question id`);
      seen.add(q.id);
      if (!q.prompt || typeof q.prompt !== "string") err(`${at}: missing prompt`);
      if (!q.explain) err(`${at}: missing explain`);
      if (q.type === "mcq") {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) err(`${at}: options count`);
        else {
          if (new Set(q.options).size !== q.options.length) err(`${at}: duplicate options`);
          if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(`${at}: answer out of range`);
        }
      } else if (q.type === "tf") {
        if (typeof q.answer !== "boolean") err(`${at}: tf answer must be boolean`);
      } else if (q.type === "type") {
        if (!Array.isArray(q.answers) || !q.answers.length) err(`${at}: type answers`);
      } else if (q.type === "match") {
        if (!Array.isArray(q.pairs) || q.pairs.length < 2 || q.pairs.length > 6) err(`${at}: pairs count`);
        else {
          const left = q.pairs.map((p) => p[0]), right = q.pairs.map((p) => p[1]);
          if (new Set(left).size !== left.length || new Set(right).size !== right.length) err(`${at}: duplicate pair side`);
        }
      } else err(`${at}: unknown type ${q.type}`);
    }
  }

  // كل درس في الفهرس له ملف، وكل ملف مذكور في الفهرس
  const inIndex = new Set();
  for (const t of index.tracks) for (const lv of t.levels) for (const u of lv.units) for (const ls of u.lessons) {
    if (!seen.has(ls.id)) err(`index: lesson ${ls.id} has no file`);
    inIndex.add(ls.id);
  }
  for (const l of lessons) if (!inIndex.has(l.id)) err(`${l.id}: not in index`);

  if (errors.length) throw new Error("Content validation failed:\n - " + errors.join("\n - "));
}
