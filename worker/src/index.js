import { validateInitData } from "./auth.js";
import { decide, xpFor, cleanToday, updateStreak, cleanIds, isId, PASS } from "./engine.js";
import { nextState, newMistake } from "./srs.js";

const TRACKS = ["native", "learner"];
const THEMES = ["warm", "night", "sage", "telegram"];
const LANGS = ["ar", "en", "fr"];

// ---------- أدوات الرد ----------
function cors(env, req) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const origin = req.headers.get("Origin") || "";
  const ok = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (env, req, data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors(env, req) } });

async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

// ---------- الوصول للبيانات ----------
let langColReady = false;
async function ensureLangCol(env) {
  if (langColReady) return;
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN lang_code TEXT").run(); } catch { /* موجود مسبقًا */ }
  langColReady = true;
}

async function getOrCreateUser(env, tgUser, today) {
  await ensureLangCol(env);
  const code = typeof tgUser.language_code === "string" ? tgUser.language_code.toLowerCase().slice(0, 12) : null;
  let u = await env.DB.prepare("SELECT * FROM users WHERE tg_id = ?").bind(tgUser.id).first();
  if (!u) {
    await env.DB.prepare("INSERT INTO users (tg_id, first_name, last_active_date, lang_code) VALUES (?, ?, NULL, ?)")
      .bind(tgUser.id, tgUser.first_name, code).run();
    u = await env.DB.prepare("SELECT * FROM users WHERE tg_id = ?").bind(tgUser.id).first();
  } else if (code && u.lang_code !== code) {
    try { await env.DB.prepare("UPDATE users SET lang_code = ? WHERE tg_id = ?").bind(code, tgUser.id).run(); } catch { /* غير حرج */ }
  }
  return u;
}

async function ownerStats(env, today) {
  await ensureLangCol(env);
  const one = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()) || {};
  const rows = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
  const d7 = new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10);
  return {
    total_users: (await one("SELECT COUNT(*) AS n FROM users")).n,
    active_today: (await one("SELECT COUNT(*) AS n FROM users WHERE last_active_date = ?", today)).n,
    active_7d: (await one("SELECT COUNT(*) AS n FROM users WHERE last_active_date >= ?", d7)).n,
    new_7d: (await one("SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now','-7 days')")).n,
    by_track: await rows("SELECT COALESCE(track,'unset') AS track, COUNT(*) AS n FROM users GROUP BY 1 ORDER BY n DESC"),
    by_language: await rows("SELECT COALESCE(lang_code,'unknown') AS lang, COUNT(*) AS n FROM users GROUP BY 1 ORDER BY n DESC"),
    lessons_passed: (await one("SELECT COUNT(*) AS n FROM progress WHERE status = 'passed'")).n,
    note: "من ضغط /start ولم يفتح التطبيق لا يظهر هنا.",
  };
}

async function snapshot(env, tgId, today) {
  const user = await env.DB.prepare("SELECT tg_id, first_name, track, ui_lang, theme, xp, streak, best_streak, last_active_date, reminder_hour FROM users WHERE tg_id = ?").bind(tgId).first();
  const prog = await env.DB.prepare("SELECT lesson_id, best_score, status, attempts FROM progress WHERE tg_id = ?").bind(tgId).all();
  const due = await env.DB.prepare("SELECT COUNT(*) AS n FROM reviews WHERE tg_id = ? AND due_date <= ?").bind(tgId, today).first();
  return { user, progress: prog.results || [], dueCount: due?.n || 0 };
}

// ---------- نقاط الـ API ----------
const routes = {
  async "/api/me"(env, req, tg, b) {
    const today = cleanToday(b.today);
    await getOrCreateUser(env, tg, today);
    return snapshot(env, tg.id, today);
  },

  async "/api/settings"(env, req, tg, b) {
    await getOrCreateUser(env, tg, cleanToday(b.today));
    const sets = [], vals = [];
    if (TRACKS.includes(b.track)) { sets.push("track = ?"); vals.push(b.track); }
    if (LANGS.includes(b.ui_lang)) { sets.push("ui_lang = ?"); vals.push(b.ui_lang); }
    if (THEMES.includes(b.theme)) { sets.push("theme = ?"); vals.push(b.theme); }
    if (b.reminder_hour === null || (Number.isInteger(b.reminder_hour) && b.reminder_hour >= 0 && b.reminder_hour <= 23)) {
      sets.push("reminder_hour = ?"); vals.push(b.reminder_hour);
    }
    if (sets.length) await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE tg_id = ?`).bind(...vals, tg.id).run();
    return snapshot(env, tg.id, cleanToday(b.today));
  },

  // إنهاء درس: العميل يصحح محليًا (المحتوى على GitHub Pages) والخادم يسجل النتيجة.
  async "/api/lesson/complete"(env, req, tg, b) {
    if (!isId(b.lessonId)) throw httpErr(400, "bad lessonId");
    const total = Number(b.total), correct = Number(b.correct);
    if (!Number.isInteger(total) || !Number.isInteger(correct) || total < 1 || total > 50 || correct < 0 || correct > total) {
      throw httpErr(400, "bad score");
    }
    const today = cleanToday(b.today);
    const user = await getOrCreateUser(env, tg, today);
    const score = correct / total;
    const decision = decide(score);
    const xp = xpFor({ correct, total, decision });
    const streak = updateStreak(user.streak, user.last_active_date, today);
    const wrong = cleanIds(b.wrongIds);

    const stmts = [
      env.DB.prepare(`INSERT INTO progress (tg_id, lesson_id, best_score, status, attempts, updated_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(tg_id, lesson_id) DO UPDATE SET
          best_score = MAX(best_score, excluded.best_score),
          status = CASE WHEN status = 'passed' OR excluded.status = 'passed' THEN 'passed' ELSE 'in_progress' END,
          attempts = attempts + 1, updated_at = datetime('now')`)
        .bind(tg.id, b.lessonId, score, decision === "pass" ? "passed" : "in_progress"),
      env.DB.prepare(`UPDATE users SET xp = xp + ?, streak = ?, best_streak = MAX(best_streak, ?), last_active_date = ? WHERE tg_id = ?`)
        .bind(xp, streak, streak, today, tg.id),
    ];
    const m = newMistake(today);
    for (const qid of wrong) {
      stmts.push(env.DB.prepare(`INSERT INTO reviews (tg_id, question_id, box, due_date) VALUES (?, ?, ?, ?)
        ON CONFLICT(tg_id, question_id) DO UPDATE SET box = 1, due_date = excluded.due_date`)
        .bind(tg.id, qid, m.box, m.due_date));
    }
    await env.DB.batch(stmts);
    return { decision, xp, streak, ...(await snapshot(env, tg.id, today)) };
  },

  // اختبار تحديد المستوى: يعلّم الدروس المتخطّاة كناجحة دون نقاط خبرة، ويضيف الأسئلة الخاطئة للمراجعة.
  async "/api/placement"(env, req, tg, b) {
    const today = cleanToday(b.today);
    await getOrCreateUser(env, tg, today);
    const passed = cleanIds(b.passedIds, 300);
    const wrong = cleanIds(b.wrongIds);
    const stmts = passed.map((id) => env.DB.prepare(`INSERT INTO progress (tg_id, lesson_id, best_score, status, attempts, updated_at)
      VALUES (?, ?, ?, 'passed', 0, datetime('now'))
      ON CONFLICT(tg_id, lesson_id) DO UPDATE SET status = 'passed', best_score = MAX(best_score, excluded.best_score), updated_at = datetime('now')`)
      .bind(tg.id, id, PASS));
    const m = newMistake(today);
    for (const qid of wrong) {
      stmts.push(env.DB.prepare(`INSERT INTO reviews (tg_id, question_id, box, due_date) VALUES (?, ?, ?, ?)
        ON CONFLICT(tg_id, question_id) DO UPDATE SET box = 1, due_date = excluded.due_date`).bind(tg.id, qid, m.box, m.due_date));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return snapshot(env, tg.id, today);
  },

  async "/api/review/due"(env, req, tg, b) {
    const today = cleanToday(b.today);
    const rows = await env.DB.prepare(
      "SELECT question_id, box FROM reviews WHERE tg_id = ? AND due_date <= ? ORDER BY due_date, box LIMIT 20"
    ).bind(tg.id, today).all();
    return { due: rows.results || [] };
  },

  async "/api/review/answer"(env, req, tg, b) {
    const today = cleanToday(b.today);
    const results = Array.isArray(b.results) ? b.results.slice(0, 50) : [];
    const user = await getOrCreateUser(env, tg, today);
    let right = 0;
    const stmts = [];
    for (const r of results) {
      if (!r || !isId(r.id)) continue;
      const row = await env.DB.prepare("SELECT box FROM reviews WHERE tg_id = ? AND question_id = ?").bind(tg.id, r.id).first();
      if (!row) continue;
      const ns = nextState(row.box, !!r.correct, today);
      if (r.correct) right++;
      stmts.push(env.DB.prepare("UPDATE reviews SET box = ?, due_date = ? WHERE tg_id = ? AND question_id = ?").bind(ns.box, ns.due_date, tg.id, r.id));
    }
    const xp = right * 5;
    const streak = updateStreak(user.streak, user.last_active_date, today);
    stmts.push(env.DB.prepare("UPDATE users SET xp = xp + ?, streak = ?, best_streak = MAX(best_streak, ?), last_active_date = ? WHERE tg_id = ?")
      .bind(xp, streak, streak, today, tg.id));
    await env.DB.batch(stmts);
    return { xp, ...(await snapshot(env, tg.id, today)) };
  },
};

function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

// ---------- تليجرام ----------
async function tgApi(env, method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return r.json();
}

const WELCOME = "أهلًا بك في «تَعلّمْ» 🌿\nتعلّم العربية من الحروف إلى الإتقان، دروس قصيرة واختبارات وتكرار متباعد.\n\nاضغط الزر لتبدأ.\n\nWelcome to Ta3lam — learn Arabic from the alphabet to mastery.";

async function handleUpdate(env, update) {
  const msg = update.message;
  if (!msg || !msg.chat || msg.chat.type !== "private") return;
  const open = { inline_keyboard: [[{ text: "افتح «تَعلّمْ» · Open Ta3lam", web_app: { url: env.APP_URL } }]] };
  await tgApi(env, "sendMessage", { chat_id: msg.chat.id, text: WELCOME, reply_markup: open });
}

async function sendReminders(env) {
  const now = new Date();
  const hour = now.getUTCHours();
  const today = now.toISOString().slice(0, 10);
  const rows = await env.DB.prepare(
    `SELECT tg_id, streak, last_active_date FROM users
     WHERE reminder_hour = ? AND (last_active_date IS NULL OR last_active_date < ?)
       AND (last_reminded_date IS NULL OR last_reminded_date < ?) LIMIT 500`
  ).bind(hour, today, today).all();
  for (const u of rows.results || []) {
    const text = u.streak > 1
      ? `سلسلتك ${u.streak} أيام 🔥 درس قصير اليوم يحافظ عليها!`
      : "وقت درس «تَعلّمْ» اليومي 🌿 خمس دقائق فقط.";
    const res = await tgApi(env, "sendMessage", {
      chat_id: u.tg_id, text,
      reply_markup: { inline_keyboard: [[{ text: "افتح التطبيق", web_app: { url: env.APP_URL } }]] },
    });
    await env.DB.prepare("UPDATE users SET last_reminded_date = ?, reminder_hour = CASE WHEN ? THEN reminder_hour ELSE NULL END WHERE tg_id = ?")
      .bind(today, res && res.ok ? 1 : 0, u.tg_id).run(); // مستخدم حظر البوت → نوقف تذكيره
  }
}

// ---------- نقطة الدخول ----------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, req) });

    try {
      if (url.pathname === "/") return json(env, req, { ok: true, app: "ta3lam" });

      // webhook تليجرام: المسار يحتوي سرًّا + ترويسة السر الرسمية
      if (url.pathname === `/webhook/${env.WEBHOOK_SECRET}` && req.method === "POST") {
        if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
        await handleUpdate(env, await req.json());
        return new Response("ok");
      }

      // إحصائيات للمالك فقط: افتح /stats/<WEBHOOK_SECRET> من المتصفح
      if (url.pathname === `/stats/${env.WEBHOOK_SECRET}` && env.WEBHOOK_SECRET && req.method === "GET") {
        return json(env, req, await ownerStats(env, new Date().toISOString().slice(0, 10)));
      }

      // إعداد لمرة واحدة من متصفح الموبايل: افتح /setup/<SETUP_SECRET>
      if (url.pathname === `/setup/${env.SETUP_SECRET}` && env.SETUP_SECRET) {
        const hook = await tgApi(env, "setWebhook", {
          url: `${url.origin}/webhook/${env.WEBHOOK_SECRET}`,
          secret_token: env.WEBHOOK_SECRET,
          allowed_updates: ["message"],
        });
        const menu = await tgApi(env, "setChatMenuButton", {
          menu_button: { type: "web_app", text: "تَعلّمْ", web_app: { url: env.APP_URL } },
        });
        return json(env, req, { webhook: hook, menu });
      }

      const handler = routes[url.pathname];
      if (handler && req.method === "POST") {
        const auth = req.headers.get("Authorization") || "";
        if (!auth.startsWith("tma ")) throw httpErr(401, "unauthorized");
        let tg;
        try { tg = await validateInitData(auth.slice(4), env.BOT_TOKEN); }
        catch { throw httpErr(401, "unauthorized"); }
        const data = await handler(env, req, tg, await body(req));
        return json(env, req, data);
      }
      return json(env, req, { error: "not found" }, 404);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      return json(env, req, { error: status === 500 ? "server error" : e.message }, status);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReminders(env));
  },
};
