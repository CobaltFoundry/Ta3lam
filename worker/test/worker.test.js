import test from "node:test";
import assert from "node:assert/strict";
import { validateInitData, signInitData } from "../src/auth.js";
import { decide, xpFor, cleanToday, updateStreak, cleanIds } from "../src/engine.js";
import { nextState, addDays, MASTERED } from "../src/srs.js";
import worker from "../src/index.js";
import { makeDB } from "./d1shim.js";

const TOKEN = "123456:TEST-TOKEN";
const NOW = Math.floor(Date.now() / 1000);

// ---------- التحقق من الهوية ----------
test("initData صحيح يُقبل", async () => {
  const init = await signInitData({ auth_date: String(NOW), user: JSON.stringify({ id: 42, first_name: "سارة" }) }, TOKEN);
  const u = await validateInitData(init, TOKEN);
  assert.equal(u.id, 42);
  assert.equal(u.first_name, "سارة");
});

test("توقيع خاطئ أو توكن مختلف يُرفض", async () => {
  const init = await signInitData({ auth_date: String(NOW), user: JSON.stringify({ id: 42, first_name: "x" }) }, TOKEN);
  await assert.rejects(validateInitData(init, "999:OTHER"), /bad signature/);
  const tampered = init.replace("42", "43");
  await assert.rejects(validateInitData(tampered, TOKEN), /bad signature/);
});

test("بيانات منتهية أو ناقصة تُرفض", async () => {
  const old = await signInitData({ auth_date: String(NOW - 999999), user: JSON.stringify({ id: 1, first_name: "x" }) }, TOKEN);
  await assert.rejects(validateInitData(old, TOKEN), /expired/);
  await assert.rejects(validateInitData("", TOKEN), /missing/);
  await assert.rejects(validateInitData("auth_date=1&user=%7B%7D", TOKEN), /missing hash/);
});

// ---------- المحرك ----------
test("قرار التقدم", () => {
  assert.equal(decide(0.8), "pass");
  assert.equal(decide(1), "pass");
  assert.equal(decide(0.79), "review");
  assert.equal(decide(0.6), "review");
  assert.equal(decide(0.59), "repeat");
});

test("النقاط", () => {
  assert.equal(xpFor({ correct: 8, total: 8, decision: "pass" }), 80 + 15 + 20);
  assert.equal(xpFor({ correct: 5, total: 8, decision: "repeat" }), 50);
});

test("التاريخ والسلسلة", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(cleanToday("2026-10-21", now), "2026-10-21");
  assert.equal(cleanToday("2030-01-01", now), "2026-10-20");
  assert.equal(cleanToday("garbage", now), "2026-10-20");
  assert.equal(updateStreak(3, "2026-10-19", "2026-10-20"), 4);
  assert.equal(updateStreak(3, "2026-10-20", "2026-10-20"), 3);
  assert.equal(updateStreak(3, "2026-10-10", "2026-10-20"), 1);
  assert.equal(updateStreak(0, null, "2026-10-20"), 1);
});

test("تنظيف المعرّفات", () => {
  assert.deepEqual(cleanIds(["a-1", "a-1", "bad id", "<x>", 5, "ok_2"]), ["a-1", "ok_2"]);
  assert.deepEqual(cleanIds("nope"), []);
});

// ---------- التكرار المتباعد ----------
test("صناديق لايتنر", () => {
  assert.deepEqual(nextState(1, true, "2026-10-20"), { box: 2, due_date: "2026-10-23" });
  assert.deepEqual(nextState(4, true, "2026-10-20"), { box: 5, due_date: "2026-11-19" });
  assert.equal(nextState(5, true, "2026-10-20").box, MASTERED);
  assert.deepEqual(nextState(4, false, "2026-10-20"), { box: 1, due_date: "2026-10-21" });
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});

// ---------- الـ API كاملًا فوق قاعدة وهمية ----------
async function call(env, path, payload, user = { id: 7, first_name: "علي" }, token = TOKEN) {
  const init = await signInitData({ auth_date: String(NOW), user: JSON.stringify(user) }, token);
  const res = await worker.fetch(new Request("https://x.test" + path, {
    method: "POST", headers: { Authorization: "tma " + init, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }), env);
  return { status: res.status, data: await res.json() };
}

const mkEnv = () => ({ DB: makeDB(), BOT_TOKEN: TOKEN, WEBHOOK_SECRET: "wh", APP_URL: "https://app.test/", ALLOWED_ORIGIN: "*" });

test("API: بدون توقيع = 401", async () => {
  const env = mkEnv();
  const res = await worker.fetch(new Request("https://x.test/api/me", { method: "POST", body: "{}" }), env);
  assert.equal(res.status, 401);
  const bad = await call(env, "/api/me", {}, undefined, "other:token");
  assert.equal(bad.status, 401);
});

test("API: مستخدم جديد → إعدادات → درس ناجح → مراجعة", async () => {
  const env = mkEnv();
  const today = new Date().toISOString().slice(0, 10);

  let r = await call(env, "/api/me", { today });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.xp, 0);

  r = await call(env, "/api/settings", { track: "native", theme: "night", reminder_hour: 18, today });
  assert.equal(r.data.user.track, "native");
  assert.equal(r.data.user.theme, "night");
  r = await call(env, "/api/settings", { track: "hacker", theme: "<script>", today });
  assert.equal(r.data.user.track, "native"); // قيم غير صالحة تُتجاهل

  r = await call(env, "/api/lesson/complete", { lessonId: "native-L1-U1-L1", total: 8, correct: 7, wrongIds: ["N1U1L1-q3"], today });
  assert.equal(r.data.decision, "pass");
  assert.equal(r.data.streak, 1);
  assert.equal(r.data.user.xp, 70 + 15);
  assert.equal(r.data.progress[0].status, "passed");

  // إعادة المحاولة بنتيجة أقل لا تُنزل الدرجة ولا تُلغي النجاح
  r = await call(env, "/api/lesson/complete", { lessonId: "native-L1-U1-L1", total: 8, correct: 4, wrongIds: [], today });
  assert.equal(r.data.decision, "repeat");
  assert.equal(r.data.progress[0].best_score, 7 / 8);
  assert.equal(r.data.progress[0].status, "passed");
  assert.equal(r.data.progress[0].attempts, 2);

  // السؤال الخطأ يظهر في مراجعة الغد فقط
  r = await call(env, "/api/review/due", { today });
  assert.equal(r.data.due.length, 0);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  r = await call(env, "/api/review/due", { today: tomorrow });
  assert.deepEqual(r.data.due.map((d) => d.question_id), ["N1U1L1-q3"]);

  r = await call(env, "/api/review/answer", { today: tomorrow, results: [{ id: "N1U1L1-q3", correct: true }, { id: "غير-موجود", correct: true }] });
  assert.equal(r.data.xp, 5);
  const row = env.DB.raw.prepare("SELECT box FROM reviews WHERE question_id = ?").get("N1U1L1-q3");
  assert.equal(row.box, 2);
});

test("API: اختبار تحديد المستوى يعلّم الدروس ناجحة بدون نقاط ولا يُنزل شيئًا", async () => {
  const env = mkEnv();
  const today = new Date().toISOString().slice(0, 10);
  await call(env, "/api/lesson/complete", { lessonId: "ln-l0-u1-01", total: 8, correct: 8, wrongIds: [], today });
  let r = await call(env, "/api/placement", { passedIds: ["ln-l0-u1-01", "ln-l0-u1-02", "ln-l0-u1-test", "bad id!"], wrongIds: ["ln-l0-u2-03_q1"], today });
  assert.equal(r.status, 200);
  const st = Object.fromEntries(r.data.progress.map((p) => [p.lesson_id, p]));
  assert.equal(st["ln-l0-u1-02"].status, "passed");
  assert.equal(st["ln-l0-u1-test"].status, "passed");
  assert.equal(st["ln-l0-u1-01"].best_score, 1); // الدرجة الأعلى محفوظة
  assert.equal(st["ln-l0-u1-01"].attempts, 1);
  assert.equal(st["bad id!"], undefined);
  assert.equal(r.data.user.xp, 115); // 80 + 15 + 20 من الدرس الفعلي فقط
  r = await call(env, "/api/placement", {});
  assert.equal(r.status, 200);
});

test("API: مدخلات خاطئة ترجع 400", async () => {
  const env = mkEnv();
  let r = await call(env, "/api/lesson/complete", { lessonId: "bad id!", total: 8, correct: 7 });
  assert.equal(r.status, 400);
  r = await call(env, "/api/lesson/complete", { lessonId: "ok-1", total: 8, correct: 9 });
  assert.equal(r.status, 400);
  r = await call(env, "/api/lesson/complete", { lessonId: "ok-1", total: 0, correct: 0 });
  assert.equal(r.status, 400);
});

test("API: مستخدمان لا يريان بيانات بعضهما", async () => {
  const env = mkEnv();
  const today = new Date().toISOString().slice(0, 10);
  await call(env, "/api/lesson/complete", { lessonId: "a-1", total: 8, correct: 8, wrongIds: [], today }, { id: 1, first_name: "a" });
  const r = await call(env, "/api/me", { today }, { id: 2, first_name: "b" });
  assert.equal(r.data.progress.length, 0);
  assert.equal(r.data.user.xp, 0);
});

test("webhook: يرفض بدون ترويسة السر", async () => {
  const env = mkEnv();
  const res = await worker.fetch(new Request("https://x.test/webhook/wh", { method: "POST", body: "{}" }), env);
  assert.equal(res.status, 403);
});

// نسخة المنطق داخل التطبيق (للوضع التجريبي) يجب أن تطابق نسخة الخادم
import { readFileSync } from "node:fs";
test("نسخ المنطق المشترك متطابقة بين الخادم والتطبيق", () => {
  for (const f of ["engine.js", "srs.js"]) {
    const a = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    const b = readFileSync(new URL(`../../app/js/shared/${f}`, import.meta.url), "utf8");
    assert.equal(a, b, `${f} out of sync: run  node tools/sync-shared.mjs`);
  }
});

// تصحيح الإجابات المكتوبة (الواجهة): لاتيني متسامح، وعربي يحافظ على الهمزات
import { normAnswer } from "../../app/js/util.js";
test("تطبيع الإجابات المكتوبة", () => {
  assert.equal(normAnswer("Maa smuka?"), normAnswer("maa smuka?"));
  assert.equal(normAnswer("ana min ..."), normAnswer("ana min …"));
  assert.equal(normAnswer("wa alaykumu s-salaam"), normAnswer("wa 'alaykumu s-salaam"));
  assert.equal(normAnswer("shukrān"), normAnswer("shukran"));
  assert.equal(normAnswer("marhabaa"), normAnswer("marhaba")); // المد المكرر لا يفرّق
  assert.notEqual(normAnswer("أحمد"), normAnswer("احمد"));       // الهمزة تفرّق في العربي
  assert.equal(normAnswer("كَتَبَ"), normAnswer("كتب"));         // التشكيل لا يفرّق
});

test("تسجيل language_code وإحصائيات المالك", async () => {
  const env = mkEnv();
  const today = new Date().toISOString().slice(0, 10);
  await call(env, "/api/me", { today }, { id: 1, first_name: "a", language_code: "fr" });
  await call(env, "/api/me", { today }, { id: 2, first_name: "b", language_code: "ar-EG" });
  await call(env, "/api/me", { today }, { id: 3, first_name: "c" });
  const res = await worker.fetch(new Request("https://x.test/stats/wh"), env);
  const s = await res.json();
  assert.equal(s.total_users, 3);
  assert.deepEqual(s.by_language.map((x) => x.lang).sort(), ["ar-eg", "fr", "unknown"]);
  const bad = await worker.fetch(new Request("https://x.test/stats/nope"), env);
  assert.equal(bad.status, 404);
});

test("بلاغات الأخطاء: حفظ وتجميع ورفض المدخلات السيئة", async () => {
  const env = mkEnv();
  const u1 = { id: 11, first_name: "a" }, u2 = { id: 12, first_name: "b" };
  const r = await call(env, "/api/report", { questionId: "nt-l1-u4-02_p1", kind: "wrong", note: "x", lang: "ar" }, u1);
  assert.equal(r.data.ok, true);
  await call(env, "/api/report", { questionId: "nt-l1-u4-02_p1", kind: "typo" }, u1); // تحديث لا تكرار
  await call(env, "/api/report", { questionId: "nt-l1-u4-02_p1", kind: "unclear" }, u2);
  const s = await (await worker.fetch(new Request("https://x.test/reports/wh"), env)).json();
  assert.equal(s.total, 2);
  assert.equal(s.by_question[0].n, 2);
  assert.equal((await worker.fetch(new Request("https://x.test/reports/no"), env)).status, 404);
  assert.equal((await call(env, "/api/report", { questionId: "'; drop", kind: "wrong" }, u1)).status, 400);
  assert.equal((await call(env, "/api/report", { questionId: "a-b_q1", kind: "zzz" }, u1)).status, 400);
});

// ---------- الأوسمة والرتب والدرر ----------
import * as G from "../src/gamify.js";
import { LEVEL_LESSONS } from "../src/levels.js";

test("الأوسمة: أسبوع السبت وإجازة السلسلة", () => {
  assert.equal(G.weekStart("2026-10-24"), "2026-10-24"); // السبت
  assert.equal(G.weekStart("2026-10-30"), "2026-10-24"); // الجمعة
  assert.equal(G.weekStart("2026-10-25"), "2026-10-24"); // الأحد
  const s = G.blankState(); s.freezes = 1;
  assert.equal(G.applyFreeze(s, "2026-10-20", "2026-10-22"), "2026-10-21"); // فاته يوم واحد
  assert.equal(s.freezes, 0);
  s.freezes = 1;
  assert.equal(G.applyFreeze(s, "2026-10-18", "2026-10-22"), "2026-10-18"); // فاته أكثر من يوم: لا تُستهلك
  assert.equal(s.freezes, 1);
  assert.equal(G.applyFreeze(s, "2026-10-21", "2026-10-22"), "2026-10-21");
});

test("الأوسمة: الرتب بحسب النقاط", () => {
  assert.equal(G.rankOf(0), 0);
  assert.equal(G.rankOf(999), 1);
  assert.equal(G.rankOf(1000), 2);
  assert.equal(G.rankOf(99999), 6);
});

test("الأوسمة: درس كامل يمنح أوسمة ودررًا مرة واحدة فقط", () => {
  const s = G.blankState();
  const ev = { lessonId: "nt-l1-u1-01", correct: 12, total: 12, decision: "pass", hour: 2, today: "2026-10-26", lastActive: null, streak: 1, passedIds: new Set(["nt-l1-u1-01"]) };
  const a = G.onLesson(s, ev);
  for (const id of ["first", "flawless", "owl"]) assert.ok(a.newBadges.includes(id), id);
  assert.equal(a.gained, 12 + 10 * a.newBadges.length);
  const again = G.onLesson(s, { ...ev, lastActive: "2026-10-26" });
  assert.deepEqual(again.newBadges, []); // لا تكرار
  assert.equal(s.perfectIds.length, 1);   // نفس الدرس لا يُحسب كاملًا مرتين
});

test("الأوسمة: إنهاء مستوى كامل ومنع الغش بالتكرار", () => {
  const s = G.blankState();
  const ids = LEVEL_LESSONS["nt-l1"];
  const all = new Set(ids);
  const almost = new Set(ids.slice(1));
  assert.ok(!G.onLesson(s, { lessonId: ids[1], correct: 8, total: 8, decision: "pass", hour: null, today: "2026-10-26", lastActive: null, streak: 1, passedIds: almost }).newBadges.includes("lvl1"));
  assert.ok(G.onLesson(s, { lessonId: ids[0], correct: 8, total: 8, decision: "pass", hour: null, today: "2026-10-26", lastActive: "2026-10-26", streak: 1, passedIds: all }).newBadges.includes("lvl1"));
});

test("الأوسمة: هدف الأسبوع، المتجر، والحالة التالفة", () => {
  const s = G.blankState(); s.goalDays = 3;
  const out = [];
  for (const [d, last] of [["2026-10-24", null], ["2026-10-25", "2026-10-24"], ["2026-10-26", "2026-10-25"]]) {
    out.push(G.onReview(s, { right: 0, mastered: 0, today: d, lastActive: last, streak: 1 }));
  }
  assert.ok(out[2].newBadges.includes("goal"));
  assert.equal(G.onReview(s, { right: 0, mastered: 0, today: "2026-10-27", lastActive: "2026-10-26", streak: 1 }).newBadges.length, 0);
  s.gems = 99; assert.equal(G.buyFreeze(s), "gems");
  s.gems = 250; assert.equal(G.buyFreeze(s), "ok"); assert.equal(G.buyFreeze(s), "ok"); assert.equal(G.buyFreeze(s), "max");
  assert.equal(s.gems, 50); assert.equal(s.freezes, 2);
  assert.equal(G.setGoal(s, 4), false);
  const bad = G.cleanState({ gems: -5, freezes: 99, badges: { hack: "x", first: "2026-01-01" }, goalDays: 99 });
  assert.equal(bad.gems, 0); assert.equal(bad.freezes, 2); assert.deepEqual(Object.keys(bad.badges), ["first"]); assert.equal(bad.goalDays, 5);
});

test("API: الأوسمة تصل في الرد وتُحفظ للمستخدم", async () => {
  const env = mkEnv();
  const today = new Date().toISOString().slice(0, 10);
  let r = await call(env, "/api/lesson/complete", { lessonId: "nt-l1-u1-01", total: 8, correct: 8, wrongIds: [], today, hour: 1 });
  assert.equal(r.status, 200);
  assert.ok(r.data.award.newBadges.includes("first") && r.data.award.newBadges.includes("owl"));
  assert.ok(r.data.gamify.gems >= 8);
  r = await call(env, "/api/lesson/complete", { lessonId: "nt-l1-u1-01", total: 8, correct: 8, wrongIds: [], today, hour: 99 });
  assert.deepEqual(r.data.award.newBadges, []);
  r = await call(env, "/api/me", { today });
  assert.ok(r.data.gamify.badges.first);
  r = await call(env, "/api/goal", { today, days: 7 }); assert.equal(r.data.gamify.goalDays, 7);
  r = await call(env, "/api/goal", { today, days: 4 }); assert.equal(r.status, 400);
  r = await call(env, "/api/shop/freeze", { today }); assert.equal(r.data.result, "gems");
  r = await call(env, "/api/report", { questionId: "nt-l1-u1-01_q1", kind: "typo", today });
  assert.ok(r.data.award.newBadges.includes("eagle"));
});
