# دليل النشر: كله من الموبايل وبدون تكلفة

> أسماء الأزرار في GitHub وCloudflare ممكن تتغير شوية مع الوقت. لو زرار مش موجود بنفس الاسم، دوّر على أقرب واحد ليه.
> افتح المواقع من متصفح الموبايل، ولو الصفحة مش بتعرض الأزرار كويس فعّل «Desktop site» من قائمة المتصفح.

## قبل ما تبدأ: اعمل 3 أسرار عشوائية
هتحتاج 3 كلمات طويلة عشوائية (حروف إنجليزي وأرقام فقط، 24 حرف أو أكتر). اكتبهم في مكان آمن عندك:
- `WEBHOOK_SECRET`
- `SETUP_SECRET`
- وتوكن البوت اللي معاك من BotFather (`BOT_TOKEN`)

> التوكن **ما يتبعتش لأي حد ولا يتكتب في أي ملف على جيت هب.** لو اتسرّب، ابعت `/revoke` لـ BotFather واستلم توكن جديد.

---

## الجزء 1: GitHub (الكود والواجهة)

1. **أنشئ مستودع جديد**: New repository ← الاسم `ta3lam` ← اختار **Public** (ضروري: GitHub Pages المجاني مش بيشتغل مع المستودعات الخاصة) ← فعّل Add a README ← Create.
2. **ارفع المشروع**: Add file ← Upload files ← اختار الملف `ta3lam.zip` ← Commit changes.
3. **ثبّت ملف فك الضغط**: Add file ← Create new file. في خانة الاسم اكتب بالظبط `.github/workflows/unpack.yml` (لما تكتب `/` بيعمل مجلد). الصق محتوى ملف `unpack.yml` اللي معاك ← Commit.
4. **شغّله**: تبويب Actions ← اختار «Unpack project» ← Run workflow. استنى لحد ما يبقى أخضر ✓ (دقيقة تقريبًا). بعدها هتلاقي ملفات المشروع ظهرت في المستودع.
5. **ثبّت ملف النشر**: نفس طريقة الخطوة 3 باسم `.github/workflows/pages.yml` والصق محتوى ملف `pages.yml` ← Commit.
6. **فعّل الصفحات**: Settings ← Pages ← في Source اختار **GitHub Actions**.
7. **انشر الواجهة**: Actions ← «Deploy app» ← Run workflow. بعد ما يخلص رابط تطبيقك هيبقى:
   `https://اسم-حسابك.github.io/ta3lam/`
   افتحه في المتصفح للتأكد: لازم يظهر اختيار المسار (ده الوضع التجريبي).

---

## الجزء 2: Cloudflare (الخلفية وقاعدة البيانات)

1. اعمل حساب مجاني على cloudflare.com.
2. **قاعدة البيانات**: Storage & Databases ← D1 ← Create database باسم `ta3lam`. افتحها ← Console، والصق الكود التالي ونفّذه (Execute):

```sql
CREATE TABLE IF NOT EXISTS users (
  tg_id INTEGER PRIMARY KEY, first_name TEXT, track TEXT, ui_lang TEXT DEFAULT 'ar', theme TEXT DEFAULT 'warm',
  xp INTEGER DEFAULT 0, streak INTEGER DEFAULT 0, best_streak INTEGER DEFAULT 0, last_active_date TEXT,
  reminder_hour INTEGER, last_reminded_date TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS progress (
  tg_id INTEGER NOT NULL, lesson_id TEXT NOT NULL, best_score REAL DEFAULT 0, status TEXT DEFAULT 'in_progress',
  attempts INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (tg_id, lesson_id));
CREATE TABLE IF NOT EXISTS reviews (
  tg_id INTEGER NOT NULL, question_id TEXT NOT NULL, box INTEGER DEFAULT 1, due_date TEXT NOT NULL,
  PRIMARY KEY (tg_id, question_id));
CREATE INDEX IF NOT EXISTS idx_reviews_due ON reviews (tg_id, due_date);
CREATE INDEX IF NOT EXISTS idx_users_reminder ON users (reminder_hour);
```

   وانسخ **Database ID** من صفحة القاعدة.
3. **عدّل ملف الإعدادات على جيت هب**: افتح `worker/wrangler.toml` ← أيقونة القلم ← غيّر 3 قيم:
   - `APP_URL` ← رابط تطبيقك من الجزء 1 (ينتهي بـ `/`)
   - `ALLOWED_ORIGIN` ← نفس الرابط بدون `/ta3lam/` (يعني `https://اسم-حسابك.github.io`)
   - `database_id` ← الـ ID اللي نسخته
   ثم Commit.
4. **انشر الـ Worker**: Workers & Pages ← Create ← اختار الربط بـ GitHub (Import a repository) ← اختار `ta3lam`. في إعدادات البناء:
   - **Project/Worker name**: `ta3lam-api` (لازم يطابق `name` في wrangler.toml)
   - **Root directory**: `worker`
   - باقي الإعدادات الافتراضية (أمر النشر `npx wrangler deploy`).
   ← Deploy.
5. **ضع الأسرار**: افتح الـ Worker ← Settings ← Variables and Secrets ← Add، ونوعها **Secret**:
   - `BOT_TOKEN` = توكن البوت
   - `WEBHOOK_SECRET` = السر الأول
   - `SETUP_SECRET` = السر الثاني
   بعد الحفظ اعمل Deploy/Redeploy لو طلب منك.
6. **انسخ رابط الـ Worker** (شكله `https://ta3lam-api.xxxxx.workers.dev`).
7. **اربط الواجهة بالخلفية**: على جيت هب افتح `app/js/config.js` وغيّر `API_URL` لرابط الـ Worker ← Commit. (الواجهة بتتنشر تلقائيًا بعد دقيقة.)
8. **فعّل البوت** (مرة واحدة): افتح في متصفح الموبايل
   `https://ta3lam-api.xxxxx.workers.dev/setup/السر-الثاني`
   لازم يظهر نص فيه `"ok":true` مرتين (الـ webhook وزر القائمة).
   بعدها يستحسن تمسح السر `SETUP_SECRET` من إعدادات الـ Worker علشان تقفل الرابط ده.

---

## الجزء 3: جرّب البوت
1. افتح **@Ta3almAppBot** وابعت `/start`.
2. اضغط زر «افتح تَعلّمْ». اختار المسار واعمل أول درس.
3. اقفل التطبيق وافتحه تاني: لازم تلاقي تقدّمك محفوظ (ده معناه إن الخلفية شغالة).
4. من «حسابي» جرّب تغيير الثيم، وضبط التذكير اليومي.

## لو حاجة مشتغلتش
| العَرَض | السبب المحتمل |
|---|---|
| الواجهة بتقول «وضع تجريبي» جوه تليجرام | `API_URL` لسه فيه كلمة YOUR، أو لسه ما اتنشرتش الواجهة بعد التعديل |
| «تعذّر الاتصال بالخادم» | `ALLOWED_ORIGIN` غلط (لازم نفس دومين الواجهة بالظبط)، أو الأسرار مش متضافة |
| `/start` ما بيردش | ما فتحتش رابط `/setup/...`، أو `WEBHOOK_SECRET` غير متضاف |
| الـ Workflow فشل | افتح تفاصيله من تبويب Actions وابعتلي سطر الخطأ |
| التذكير اليومي مش بيوصل | لازم تضبط الساعة من «حسابي»، والتذكير بيتبعت فقط لو ما أخذتش درس اليوم |

## بعد كده
- أي تعديل في `app/` بينشر نفسه تلقائيًا، وأي تعديل في `worker/` بينشر الـ Worker تلقائيًا.
- **الإعلانات:** مؤجلة. قبل ما نفكر فيها هنراجع شروط تليجرام وCloudflare.
