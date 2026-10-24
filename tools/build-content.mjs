// يولّد ملفات المحتوى في app/content من بيانات المنهج، ثم يتحقق منها.
// التشغيل:  node tools/build-content.mjs
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { LETTERS, DOTS_TEXT, forms, CONSONANTS, VOWELS } from "./data-learner.mjs";
import { NATIVE_LESSONS } from "./data-native.mjs";
import { validateAll } from "./validate-content.mjs";

const OUT = new URL("../app/content/", import.meta.url);

// ---------- أدوات ----------
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uniq = (arr) => [...new Set(arr)];

const mcq = (prompt, options, correct, explain) => {
  const answer = options.indexOf(correct);
  if (answer < 0) throw new Error("correct option missing: " + prompt);
  return { type: "mcq", prompt, options, answer, explain };
};
const tf = (prompt, answer, explain) => ({ type: "tf", prompt, answer, explain });
const type = (prompt, answers, explain) => ({ type: "type", prompt, answers, explain });
const match = (prompt, pairs, explain) => ({ type: "match", prompt, pairs, explain });

function finish(lesson) {
  lesson.practice.forEach((q, i) => (q.id = `${lesson.id}_p${i + 1}`));
  lesson.quiz.forEach((q, i) => (q.id = `${lesson.id}_q${i + 1}`));
  return lesson;
}

// ---------- مسار الأجانب: الحروف ----------
function letterLesson(idx) {
  const L = LETTERS.slice(idx * 4, idx * 4 + 4);
  const id = `ln-l0-u1-${String(idx + 1).padStart(2, "0")}`;
  const r = rng(id);
  const chars = L.map((l) => l.ch);
  const names = L.map((l) => l.name);
  const sounds = L.map((l) => l.sound);
  const meanings = L.map((l) => l.word.en);
  const words = L.map((l) => l.word.ar);
  const [a, b, c, d] = L;

  const intro = idx === 0
    ? "Arabic is written and read from **right to left**. It has **28 letters**, no capital letters, and most letters connect to the next one. Let's learn the first 4."
    : `Letters ${idx * 4 + 1}–${idx * 4 + 4} of 28. Look at the dots: they are what tells many letters apart.`;

  const teach = [{ type: "text", text: intro }];
  for (const l of L) {
    teach.push({
      type: "letter", ch: l.ch, name: l.name, sound: l.sound, note: l.note,
      dots: DOTS_TEXT[l.dots], forms: forms(l), word: l.word,
    });
  }
  if (idx === 0) teach.push({ type: "tip", text: "Words that begin with a vowel sound start with أ (alif with a small hamza on top). It is still the letter alif." });

  const dotOptions = (l) => {
    const others = shuffle(Object.keys(DOTS_TEXT).filter((k) => k !== l.dots), r).slice(0, 3);
    return shuffle([l.dots, ...others], r).map((k) => DOTS_TEXT[k]);
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  const practice = [
    mcq(`Which letter is called «${a.name}»?`, shuffle(chars, r), a.ch, `${a.ch} is called ${a.name}.`),
    mcq(`What is the name of this letter: ${b.ch}`, shuffle(names, r), b.name, `${b.ch} is called ${b.name}.`),
    match("Match each letter to its name", L.map((l) => [l.ch, l.name]), "Look at the shape and the dots."),
    mcq(`The word ${c.word.ar} means:`, shuffle(meanings, r), c.word.en, `${c.word.ar} = ${c.word.en}. It starts with ${c.ch}.`),
  ];

  const quiz = [
    mcq(`Which letter makes this sound: ${d.sound}`, shuffle(chars, r), d.ch, `${d.ch} (${d.name}) = ${d.sound}.`),
    mcq(`How many dots does ${b.ch} have, and where?`, dotOptions(b).map(cap), cap(DOTS_TEXT[b.dots]), `${b.ch} has ${DOTS_TEXT[b.dots]}.`),
    mcq(`What is the name of this letter: ${c.ch}`, shuffle(names, r), c.name, `${c.ch} is called ${c.name}.`),
    idx % 2 === 0
      ? tf(`True or false: ${a.ch} is called "${a.name}".`, true, `Correct, ${a.ch} is ${a.name}.`)
      : tf(`True or false: ${a.ch} is called "${b.name}".`, false, `${a.ch} is called ${a.name}; ${b.name} is ${b.ch}.`),
    type(`Type the name of this letter (in English letters): ${d.ch}`, [d.name], `${d.ch} is called ${d.name}.`),
    mcq(`The word ${b.word.ar} means:`, shuffle(meanings, r), b.word.en, `${b.word.ar} = ${b.word.en}.`),
    mcq(`Which word starts with the letter ${c.ch}?`, shuffle(words, r), c.word.ar, `${c.word.ar} (${c.word.en}) starts with ${c.ch}.`),
    mcq(`What sound does ${a.ch} make?`, shuffle(sounds, r), a.sound, `${a.ch} (${a.name}) = ${a.sound}.`),
  ];

  return finish({
    id, track: "learner", pass_score: 0.8,
    title: { ar: `الحروف: ${chars.join(" ")}`, en: `Letters: ${chars.join(" ")}` },
    teach, practice, quiz,
  });
}

// ---------- مسار الأجانب: الحركات ----------
function vowelLesson1() {
  const id = "ln-l0-u2-01";
  const r = rng(id);
  const syl = (c, v) => ({ ar: c.ch + v.mark, lat: c.lat + v.v });
  const sylOpts = (c) => VOWELS.map((v) => syl(c, v));

  const teach = [
    { type: "text", text: "Arabic has 3 **short vowels**. They are not letters: they are tiny marks written above or below a letter." },
    ...VOWELS.map((v) => ({ type: "text", text: `**${v.name[0].toUpperCase() + v.name.slice(1)}** ( ${"ب" + v.mark} ): ${v.desc}. Sound: **${v.v}**.\n${CONSONANTS.slice(0, 3).map((c) => `${syl(c, v).ar} = ${syl(c, v).lat}`).join("   ")}` })),
    { type: "tip", text: "Adult Arabic texts (newspapers, books) usually leave the short vowels out. Learners use them to know exactly how to read a word." },
  ];

  const readQ = (c, v, k) => {
    const opts = sylOpts(c).map((s) => s.lat);
    return mcq(`How is ${syl(c, v).ar} read?`, shuffle(opts, r), syl(c, v).lat, `${syl(c, v).ar} = ${syl(c, v).lat}.`);
  };
  const findQ = (c, v) => mcq(`Which one is read «${syl(c, v).lat}»?`, shuffle(sylOpts(c).map((s) => s.ar), r), syl(c, v).ar, `${syl(c, v).ar} = ${syl(c, v).lat}.`);
  const [c0, c1, c2, c3] = CONSONANTS;

  const practice = [
    readQ(c0, VOWELS[0]),
    findQ(c1, VOWELS[1]),
    mcq("Which short vowel is a small line BELOW the letter?", shuffle(["fatha", "kasra", "damma"], r), "kasra", "Kasra goes below the letter: بِ = bi."),
    match("Match each syllable to its sound", VOWELS.map((v) => [syl(c2, v).ar, syl(c2, v).lat]), "Fatha = a, kasra = i, damma = u."),
  ];
  const quiz = [
    readQ(c1, VOWELS[2]), readQ(c3, VOWELS[0]), readQ(c2, VOWELS[1]), readQ(CONSONANTS[4], VOWELS[2]),
    findQ(CONSONANTS[5], VOWELS[0]), findQ(CONSONANTS[6], VOWELS[2]),
    mcq("Which short vowel is a small curl (like a tiny و) ABOVE the letter?", shuffle(["fatha", "kasra", "damma"], r), "damma", "Damma looks like a small و: بُ = bu."),
    tf("True or false: نُ is read «na».", false, "نُ has a damma, so it is read «nu»."),
  ];
  return finish({ id, track: "learner", pass_score: 0.8, title: { ar: "الحركات القصيرة: فتحة، كسرة، ضمة", en: "Short vowels: fatha, kasra, damma" }, teach, practice, quiz });
}

function vowelLesson2() {
  const id = "ln-l0-u2-02";
  const r = rng(id);
  const teach = [
    { type: "text", text: "Three more signs complete the system:" },
    { type: "text", text: "**Sukun** ( ْ ): a small circle. The letter has **no vowel** after it.\nبَيْت = bayt (house)   كَلْب = kalb (dog)   شَمْس = shams (sun)" },
    { type: "text", text: "**Shadda** ( ّ ): a small «w» shape. The letter is **doubled** (said twice, with stress).\nأُمّ = umm (mother)   جَدّ = jadd (grandfather)   مُعَلِّم = mu'allim (teacher)" },
    { type: "text", text: "**Tanween**: a doubled vowel mark at the end of a word that adds an **-n** sound.\nكِتَابٌ = kitaabun   كِتَابًا = kitaaban   كِتَابٍ = kitaabin" },
    { type: "tip", text: "Tanween is only ever on the LAST letter of a word. It is the sound «-un / -an / -in» added to the end." },
  ];
  const practice = [
    mcq("The sign ْ (sukun) means the letter has:", shuffle(["no vowel", "a long vowel", "a doubled sound"], r), "no vowel", "Sukun = no vowel after that letter."),
    mcq("The sign ّ (shadda) means the letter is:", shuffle(["doubled", "silent", "long"], r), "doubled", "Shadda doubles the letter: أُمّ = umm."),
    mcq("How do you read كَلْب?", shuffle(["kalb", "kalab", "kalib"], r), "kalb", "The sukun on ل means no vowel after it: kalb."),
    mcq("كِتَابٌ is read:", shuffle(["kitaabun", "kitaaban", "kitaabin"], r), "kitaabun", "The ـٌ ending adds -un."),
  ];
  const quiz = [
    mcq("أُمّ is read:", shuffle(["umm", "um", "uma"], r), "umm", "The shadda doubles م: umm."),
    mcq("Which word means «house»?", shuffle(["بَيْت", "كَلْب", "شَمْس", "جَدّ"], r), "بَيْت", "بَيْت = house."),
    mcq("The ending ـًا on كِتَابًا adds the sound:", shuffle(["-an", "-un", "-in"], r), "-an", "ـً = -an."),
    mcq("The ending ـٌ adds the sound:", shuffle(["-an", "-un", "-in"], r), "-un", "ـٌ = -un."),
    mcq("The ending ـٍ adds the sound:", shuffle(["-an", "-un", "-in"], r), "-in", "ـٍ = -in."),
    tf("True or false: a shadda means the letter is pronounced twice.", true, "Shadda = doubled letter."),
    mcq("How do you read مُعَلِّم (teacher)?", shuffle(["mu'allim", "mu'alim", "ma'lam"], r), "mu'allim", "The shadda doubles ل: mu'allim."),
    mcq("Which word contains a sukun?", shuffle(["شَمْس", "كَتَبَ", "جَمَل", "بَاب"], r), "شَمْس", "In شَمْس the م has a sukun: shams."),
  ];
  return finish({ id, track: "learner", pass_score: 0.8, title: { ar: "السكون والشدة والتنوين", en: "Sukun, shadda and tanween" }, teach, practice, quiz });
}

// ---------- مسار الناطقين ----------
function nativeLesson(def) {
  const id = `nt-l1-u${def.unit}-${String(def.n).padStart(2, "0")}`;
  return finish({
    id, track: "native", pass_score: 0.8, title: def.title,
    teach: def.teach,
    practice: def.practice.map((q) => ({ ...q })),
    quiz: def.quiz.map((q) => ({ ...q })),
  });
}

// ---------- التجميع ----------
const learnerU1 = Array.from({ length: 7 }, (_, i) => letterLesson(i));
const learnerU2 = [vowelLesson1(), vowelLesson2()];
const nativeU1 = NATIVE_LESSONS.filter((l) => l.unit === 1).map(nativeLesson);
const nativeU2 = NATIVE_LESSONS.filter((l) => l.unit === 2).map(nativeLesson);

const all = [...learnerU1, ...learnerU2, ...nativeU1, ...nativeU2];
const ref = (ls) => ls.map((l) => ({ id: l.id, title: l.title }));

const index = {
  version: 1,
  tracks: [
    {
      id: "native",
      title: { ar: "من الأساس إلى الإتقان", en: "Master Arabic (for Arabic speakers)" },
      levels: [{
        id: "l1", title: { ar: "المستوى ١ · الأساس المتين", en: "Level 1 · Solid foundations" },
        units: [
          { id: "nt-l1-u1", title: { ar: "الهمزات", en: "Hamzas" }, lessons: ref(nativeU1) },
          { id: "nt-l1-u2", title: { ar: "التاء والألف", en: "Taa and Alif" }, lessons: ref(nativeU2) },
        ],
      }],
    },
    {
      id: "learner",
      title: { ar: "العربية من الصفر", en: "Arabic from zero" },
      levels: [{
        id: "l0", title: { ar: "المستوى ٠ · الحروف والأصوات", en: "Level 0 · Letters & sounds" },
        units: [
          { id: "ln-l0-u1", title: { ar: "الحروف الثمانية والعشرون", en: "The 28 letters" }, lessons: ref(learnerU1) },
          { id: "ln-l0-u2", title: { ar: "الحركات والعلامات", en: "Vowels & signs" }, lessons: ref(learnerU2) },
        ],
      }],
    },
  ],
};

// ---------- محتوى وارد من مصادر خارجية (tools/incoming/*.json) ----------
// الصيغة: {track, level, levelTitle:{ar,en}, units:[{n, title:{ar,en}, lessons:[{title:{ar,en}, teach, practice, quiz}]}]}
// أي ملف يبدأ اسمه بـ _ يُتجاهل. أي خطأ في الصيغة يوقف البناء برسالة واضحة.
const hasTitle = (t) => t && typeof t.ar === "string" && t.ar && typeof t.en === "string" && t.en;
function mergeIncoming(spec, file) {
  const bad = (m) => { throw new Error(`incoming/${file}: ${m}`); };
  if (!["native", "learner"].includes(spec.track)) bad("track must be native|learner");
  if (!/^l\d+$/.test(spec.level || "")) bad("level must look like l2");
  if (!hasTitle(spec.levelTitle)) bad("levelTitle needs ar+en");
  if (!Array.isArray(spec.units) || !spec.units.length) bad("units missing");
  const prefix = spec.track === "native" ? "nt" : "ln";
  const track = index.tracks.find((t) => t.id === spec.track);
  let level = track.levels.find((l) => l.id === spec.level);
  if (!level) { level = { id: spec.level, title: spec.levelTitle, units: [] }; track.levels.push(level); }
  track.levels.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  for (const u of spec.units) {
    if (!Number.isInteger(u.n) || u.n < 1) bad("unit n must be a positive integer");
    if (!hasTitle(u.title)) bad(`unit ${u.n}: title needs ar+en`);
    if (!Array.isArray(u.lessons) || !u.lessons.length) bad(`unit ${u.n}: no lessons`);
    const unitId = `${prefix}-${spec.level}-u${u.n}`;
    if (level.units.some((x) => x.id === unitId)) bad(`unit ${unitId} already exists`);
    const made = u.lessons.map((l, i) => {
      if (!hasTitle(l.title)) bad(`unit ${u.n} lesson ${i + 1}: title needs ar+en`);
      for (const k of ["teach", "practice", "quiz"]) if (!Array.isArray(l[k])) bad(`unit ${u.n} lesson ${i + 1}: ${k} must be an array`);
      return finish({
        id: `${unitId}-${String(i + 1).padStart(2, "0")}`, track: spec.track, pass_score: 0.8, title: l.title,
        teach: l.teach, practice: l.practice.map((q) => ({ ...q })), quiz: l.quiz.map((q) => ({ ...q })),
      });
    });
    all.push(...made);
    level.units.push({ id: unitId, title: u.title, lessons: ref(made) });
  }
  level.units.sort((a, b) => Number(a.id.split("-u")[1]) - Number(b.id.split("-u")[1]));
}
const INC = new URL("./incoming/", import.meta.url);
if (existsSync(INC)) {
  for (const f of readdirSync(INC).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort()) {
    let spec;
    try { spec = JSON.parse(readFileSync(new URL(f, INC), "utf8")); } catch (e) { throw new Error(`incoming/${f}: invalid JSON (${e.message})`); }
    mergeIncoming(spec, f);
  }
}

// ---------- الترجمات (tools/translations/<lang>/<lessonId>.json) ----------
// الملف = نسخة كاملة من الدرس الإنجليزي بنص مترجم. يجب أن تتطابق البنية تمامًا، وتبقى كل الكلمات العربية والكتابة اللاتينية للنطق كما هي.
const TR = new URL("./translations/", import.meta.url);
const AR_RUN = /[\u0600-\u061E\u0620-\u06FF\u0750-\u077F]+/g;
const translated = [];
function validateTranslation(en, tr, lang) {
  const bad = (m) => { throw new Error(`translations/${lang}/${en.id}: ${m}`); };
  const same = (a, b, path) => {
    if (typeof a === "string") {
      if (typeof b !== "string" || !b.trim()) bad(`${path}: must be non-empty text`);
      for (const w of a.match(AR_RUN) || []) if (!b.includes(w)) bad(`${path}: Arabic text "${w}" was changed or dropped`);
    } else bad(`${path}: unexpected`);
  };
  if (tr.id !== en.id) bad("id mismatch");
  if (!tr.title || typeof tr.title[lang] !== "string" || !tr.title[lang]) bad(`title.${lang} missing`);
  if (tr.teach.length !== en.teach.length) bad("teach card count differs");
  en.teach.forEach((c, i) => {
    const d = tr.teach[i], P = `teach[${i}]`;
    if (!d || d.type !== c.type) bad(`${P}: type differs`);
    if (c.type === "letter") {
      for (const k of ["ch", "name"]) if (d[k] !== c[k]) bad(`${P}.${k} must stay "${c[k]}"`);
      if (JSON.stringify(d.forms) !== JSON.stringify(c.forms)) bad(`${P}.forms changed`);
      if (!d.word || d.word.ar !== c.word.ar || !d.word.en) bad(`${P}.word wrong`);
      for (const k of ["sound", "note", "dots"]) same(c[k], d[k], `${P}.${k}`);
    } else same(c.text, d.text, `${P}.text`);
  });
  for (const part of ["practice", "quiz"]) {
    if (tr[part].length !== en[part].length) bad(`${part} count differs`);
    en[part].forEach((q, i) => {
      const d = tr[part][i], P = `${part}[${i}]`;
      if (!d || d.type !== q.type || d.id !== q.id) bad(`${P}: type or id differs`);
      same(q.prompt ?? "", d.prompt ?? "", `${P}.prompt`);
      same(q.explain, d.explain, `${P}.explain`);
      if (q.type === "mcq") {
        if (d.answer !== q.answer) bad(`${P}.answer must stay ${q.answer}`);
        if (!Array.isArray(d.options) || d.options.length !== q.options.length) bad(`${P}: options count differs`);
        q.options.forEach((o, j) => same(o, d.options[j], `${P}.options[${j}]`));
        if (new Set(d.options).size !== d.options.length) bad(`${P}: duplicate options`);
      } else if (q.type === "tf") {
        if (d.answer !== q.answer) bad(`${P}.answer must stay ${q.answer}`);
      } else if (q.type === "type") {
        if (JSON.stringify(d.answers) !== JSON.stringify(q.answers)) bad(`${P}.answers must stay unchanged`);
      } else if (q.type === "match") {
        if (!Array.isArray(d.pairs) || d.pairs.length !== q.pairs.length) bad(`${P}: pairs count differs`);
        q.pairs.forEach((p, j) => {
          if (d.pairs[j][0] !== p[0]) bad(`${P}.pairs[${j}] left side must stay "${p[0]}"`);
          same(p[1], d.pairs[j][1], `${P}.pairs[${j}][1]`);
        });
        if (new Set(d.pairs.map((p) => p[1])).size !== d.pairs.length) bad(`${P}: duplicate right sides`);
      }
    });
  }
}
function applyTitles(lang, titles) {
  const put = (o, key) => { if (titles[key]) o.title[lang] = titles[key]; };
  for (const tk of index.tracks) { put(tk, tk.id); for (const lv of tk.levels) { put(lv, lv.id); for (const u of lv.units) put(u, u.id); } }
}
for (const lang of existsSync(TR) ? readdirSync(TR) : []) {
  const dir = new URL(`${lang}/`, TR);
  const tfile = new URL("_titles.json", dir);
  if (existsSync(tfile)) applyTitles(lang, JSON.parse(readFileSync(tfile, "utf8")));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort()) {
    let tr;
    try { tr = JSON.parse(readFileSync(new URL(f, dir), "utf8")); } catch (e) { throw new Error(`translations/${lang}/${f}: invalid JSON (${e.message})`); }
    const en = all.find((l) => l.id === f.replace(/\.json$/, ""));
    if (!en) throw new Error(`translations/${lang}/${f}: no such lesson`);
    validateTranslation(en, tr, lang);
    en.title[lang] = tr.title[lang];
    for (const u of index.tracks.flatMap((t) => t.levels.flatMap((lv) => lv.units))) { const r = u.lessons.find((x) => x.id === en.id); if (r) r.title[lang] = tr.title[lang]; }
    translated.push({ lang, lesson: { ...tr, track: en.track, pass_score: en.pass_score, title: { ...en.title } } });
  }
}

// ---------- كتابة الملفات ----------
validateAll(all, index);
rmSync(new URL("lessons/", OUT), { recursive: true, force: true });
mkdirSync(new URL("lessons/", OUT), { recursive: true });
for (const l of all) writeFileSync(new URL(`lessons/${l.id}.json`, OUT), JSON.stringify(l));
for (const { lang, lesson } of translated) writeFileSync(new URL(`lessons/${lesson.id}.${lang}.json`, OUT), JSON.stringify(lesson));
writeFileSync(new URL("index.json", OUT), JSON.stringify(index, null, 1));
console.log(`OK: ${all.length} lessons, ${all.reduce((n, l) => n + l.practice.length + l.quiz.length, 0)} questions`);
