// مشغّل الدرس: تعلّم ← تدريب ← اختبار. يرجع النتيجة ولا يتصل بالخادم بنفسه.
import { h, rich, richEl, shuffle, normAnswer } from "./util.js";
import { icon } from "./mascot.js";

const IS_AR_ONLY = (s) => /[؀-ۿ]/.test(s) && !/[A-Za-z]/.test(s);

/**
 * @param {object} o
 *  - title: عنوان للشريط العلوي
 *  - lesson: {teach, practice, quiz}   (وضع الدرس الكامل)
 *  - questions: [..]                    (وضع الاختبار فقط: مراجعة أو اختبار وحدة)
 *  - t: نصوص الواجهة، dir: rtl|ltr، haptic(kind)، confirmLeave(): Promise<boolean>
 * @returns Promise<null | {correct, total, wrongIds, results}>   null = أغلق المتعلم الدرس
 */
export function runPlayer(o) {
  const { t, dir, haptic = () => {} } = o;
  const steps = [];
  if (o.lesson) {
    o.lesson.teach.forEach((b) => steps.push({ phase: "teach", block: b }));
    o.lesson.practice.forEach((q) => steps.push({ phase: "practice", q }));
    o.lesson.quiz.forEach((q) => steps.push({ phase: "quiz", q }));
  } else {
    o.questions.forEach((q) => steps.push({ phase: "quiz", q }));
  }

  return new Promise((resolve) => {
    const root = h("div", { class: "player", dir });
    document.getElementById("overlay").append(root);
    document.body.classList.add("no-scroll");

    const answers = new Map(); // qid -> correct?
    const orders = new Map(); // qid -> ترتيب الخيارات المخلوط
    let i = 0;
    let st = fresh();

    function fresh() { return { selected: null, checked: false, correct: false, value: "", m: null }; }

    function done(result) {
      root.remove();
      document.body.classList.remove("no-scroll");
      resolve(result);
    }

    function finish() {
      const quiz = steps.filter((s) => s.phase === "quiz");
      const results = [...answers.entries()].map(([id, correct]) => ({ id, correct }));
      const wrongIds = results.filter((r) => !r.correct).map((r) => r.id);
      const correct = quiz.filter((s) => answers.get(s.q.id)).length;
      done({ correct, total: quiz.length, wrongIds, results });
    }

    async function close() {
      const ok = o.confirmLeave ? await o.confirmLeave() : true;
      if (ok) done(null);
    }

    function advance() {
      i++;
      st = fresh();
      if (i >= steps.length) finish(); else render();
      if (root.isConnected) root.querySelector(".body")?.scrollTo(0, 0);
    }

    function record(q, correct) {
      answers.set(q.id, correct);
      st.checked = true;
      st.correct = correct;
      haptic(correct ? "success" : "error");
    }

    // ───────────── الإطار العام ─────────────
    function render() {
      const step = steps[i];
      const frac = i / steps.length;
      const top = h("div", { class: "p-top" },
        h("button", { class: "icon-btn", type: "button", "aria-label": t.close, onclick: close }, icon("close", 22)),
        h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(frac * 100) },
          h("div", { class: "bar-fill", style: { width: `${Math.max(frac * 100, 3)}%` } })),
        h("span", { class: "count" }, `${i + 1}/${steps.length}`),
      );
      const body = h("div", { class: "body" });
      const foot = h("div", { class: "foot" });
      root.replaceChildren(top, body, foot);

      if (step.phase === "teach") {
        body.append(teachCard(step.block, t));
        foot.append(h("button", { class: "btn primary", type: "button", onclick: advance }, t.cont));
      } else {
        questionView(step.q, body, foot);
      }
    }

    // ───────────── الأسئلة ─────────────
    function questionView(q, body, foot) {
      body.append(h("div", { class: "q-prompt" }, richEl("span", {}, q.prompt)));
      if (q.type === "mcq") mcqView(q, body, foot);
      else if (q.type === "tf") tfView(q, body, foot);
      else if (q.type === "type") typeView(q, body, foot);
      else if (q.type === "match") matchView(q, body, foot);
    }

    const choiceBtn = (label, idx, cls, onclick, disabled) =>
      h("button", { class: `choice ${cls}`, type: "button", onclick, disabled, "aria-pressed": cls.includes("sel") ? "true" : "false" },
        h("span", { class: "key" }, String(idx + 1)), h("span", { class: "lbl" }, rich(label)));

    function footFor(q, foot, canCheck, onCheck, answerText) {
      if (!st.checked) {
        foot.append(h("button", { class: "btn primary", id: "check-btn", type: "button", disabled: !canCheck, onclick: onCheck }, t.check));
        return;
      }
      const msg = st.correct
        ? t.correct[Math.floor(Math.random() * t.correct.length)]
        : t.wrong;
      foot.classList.add(st.correct ? "ok" : "bad");
      foot.append(
        h("div", { class: "fb", role: "status" },
          h("strong", {}, msg),
          !st.correct && answerText ? h("div", { class: "fb-ans" }, t.correctAnswerIs, richEl("span", {}, answerText)) : null,
          q.explain ? richEl("div", { class: "fb-exp" }, q.explain) : null),
        h("button", { class: "btn primary", type: "button", onclick: advance }, t.cont),
      );
    }

    function mcqView(q, body, foot) {
      if (!orders.has(q.id)) orders.set(q.id, shuffle(q.options.map((_, k) => k)));
      const order = orders.get(q.id);
      const list = h("div", { class: "choices" });
      order.forEach((orig, pos) => {
        let cls = IS_AR_ONLY(q.options[orig]) ? "ar-big " : "";
        if (st.checked) {
          if (orig === q.answer) cls += "right";
          else if (pos === st.selected) cls += "wrong";
        } else if (pos === st.selected) cls += "sel";
        list.append(choiceBtn(q.options[orig], pos, cls, () => { st.selected = pos; render(); }, st.checked));
      });
      body.append(list);
      footFor(q, foot, st.selected !== null, () => record(q, order[st.selected] === q.answer) || render(), q.options[q.answer]);
    }

    function tfView(q, body, foot) {
      const list = h("div", { class: "choices tf" });
      [true, false].forEach((val, pos) => {
        let cls = "";
        if (st.checked) { if (val === q.answer) cls = "right"; else if (val === st.selected) cls = "wrong"; }
        else if (st.selected === val) cls = "sel";
        list.append(choiceBtn(val ? t.trueL : t.falseL, pos, cls, () => { st.selected = val; render(); }, st.checked));
      });
      body.append(list);
      footFor(q, foot, st.selected !== null, () => record(q, st.selected === q.answer) || render(), q.answer ? t.trueL : t.falseL);
    }

    function typeView(q, body, foot) {
      const input = h("input", {
        class: "text-in", type: "text", dir: "auto", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
        placeholder: t.typeHere, value: st.value, disabled: st.checked, "aria-label": t.typeHere,
      });
      input.addEventListener("input", () => {
        st.value = input.value;
        const btn = root.querySelector("#check-btn");
        if (btn) btn.disabled = !st.value.trim();
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && st.value.trim() && !st.checked) check(); });
      const check = () => { record(q, q.answers.some((a) => normAnswer(a) === normAnswer(st.value))); render(); };
      if (st.checked) input.classList.add(st.correct ? "right" : "wrong");
      body.append(input);
      footFor(q, foot, !!st.value.trim(), check, q.answers[0]);
      if (!st.checked) setTimeout(() => input.focus({ preventScroll: true }), 50);
    }

    function matchView(q, body, foot) {
      if (!st.m) st.m = { left: shuffle(q.pairs.map((_, k) => k)), right: shuffle(q.pairs.map((_, k) => k)), sel: null, done: new Set(), mistakes: 0, flash: null };
      const m = st.m;
      const col = (side) => h("div", { class: "m-col" }, m[side].map((k) => {
        const text = q.pairs[k][side === "left" ? 0 : 1];
        let cls = IS_AR_ONLY(text) ? "ar-big " : "";
        if (m.done.has(k)) cls += "matched";
        else if (side === "left" && m.sel === k) cls += "sel";
        else if (side === "right" && m.flash === k) cls += "wrong";
        return h("button", { class: `choice m-item ${cls}`, type: "button", disabled: m.done.has(k) || st.checked, onclick: () => tap(side, k) }, rich(text));
      }));
      function tap(side, k) {
        m.flash = null;
        if (side === "left") m.sel = m.sel === k ? null : k;
        else if (m.sel !== null) {
          if (m.sel === k) { m.done.add(k); m.sel = null; haptic("light"); }
          else { m.mistakes++; m.flash = k; m.sel = null; haptic("error"); }
        }
        if (m.done.size === q.pairs.length) record(q, m.mistakes === 0);
        render();
      }
      body.append(h("p", { class: "hint" }, t.tapMatch), h("div", { class: "m-grid" }, col("left"), col("right")));
      footFor(q, foot, false, null, null);
    }

    render();
  });
}

// ───────────── بطاقات التعلّم ─────────────
function teachCard(b, t) {
  if (b.type === "text") return h("div", { class: "card teach-text" }, richEl("div", {}, b.text));
  if (b.type === "tip") return h("div", { class: "card tip" }, h("span", { class: "tip-ic" }, icon("star", 20)), richEl("div", {}, b.text));
  if (b.type === "letter") {
    const f = b.forms;
    const formBox = (label, glyph) => h("div", { class: "form" }, h("div", { class: "form-ar", dir: "rtl", lang: "ar" }, glyph), h("div", { class: "form-lbl" }, label));
    const boxes = [formBox(t.forms[0], f.iso)];
    if (f.ini) { boxes.push(formBox(t.forms[1], f.ini), formBox(t.forms[2], f.med)); }
    boxes.push(formBox(t.forms[3], f.fin));
    return h("div", { class: "card letter" },
      h("div", { class: "l-head" },
        h("div", { class: "l-glyph", dir: "rtl", lang: "ar" }, b.ch),
        h("div", { class: "l-meta" }, h("div", { class: "l-name" }, b.name), h("div", { class: "l-sound" }, h("b", {}, t.sound + ": "), b.sound), h("div", { class: "l-dots" }, h("b", {}, t.dots + ": "), b.dots))),
      h("div", { class: "forms" }, boxes),
      richEl("p", { class: "l-note" }, b.note),
      h("div", { class: "l-word" }, h("span", { class: "l-word-ar", dir: "rtl", lang: "ar" }, b.word.ar), h("span", { class: "l-word-en" }, `${t.exampleWord}: ${b.word.en}`)));
  }
  return h("div", {});
}
