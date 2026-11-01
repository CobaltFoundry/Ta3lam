// التحقق من بيانات Telegram Mini App (initData) بدون أي مكتبات.
// المرجع: HMAC-SHA256 بمفتاح = HMAC("WebAppData", botToken)

const enc = new TextEncoder();

async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * يتحقق من initData ويرجع بيانات المستخدم أو يرمي خطأ.
 * @param {string} initData  السلسلة الخام من Telegram.WebApp.initData
 * @param {string} botToken
 * @param {number} maxAgeSec  أقصى عمر مسموح للتوقيع (افتراضي يوم)
 * @param {number} nowSec     للاختبار فقط
 */
export async function validateInitData(initData, botToken, maxAgeSec = 86400, nowSec = Math.floor(Date.now() / 1000)) {
  if (!initData || typeof initData !== "string") throw new Error("missing initData");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("missing hash");
  params.delete("hash");

  const dataCheck = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const calc = toHex(await hmac(secret, dataCheck));
  if (!safeEqual(calc, hash)) throw new Error("bad signature");

  const authDate = Number(params.get("auth_date"));
  if (!authDate || nowSec - authDate > maxAgeSec) throw new Error("expired");

  let user;
  try { user = JSON.parse(params.get("user") || ""); } catch { throw new Error("bad user"); }
  if (!user || typeof user.id !== "number") throw new Error("bad user");
  return { id: user.id, first_name: String(user.first_name || "").slice(0, 64), language_code: user.language_code || null };
}

// أداة مساعدة للاختبارات: توقيع initData صحيح
export async function signInitData(fields, botToken) {
  const params = new URLSearchParams(fields);
  const dataCheck = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  params.set("hash", toHex(await hmac(secret, dataCheck)));
  return params.toString();
}
