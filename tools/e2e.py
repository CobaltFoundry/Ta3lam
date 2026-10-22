"""اختبار شامل للواجهة في متصفح حقيقي (وضع تجريبي بدون خادم).
التشغيل:  python3 tools/e2e.py   (من جذر المشروع؛ يشغّل خادمًا ثابتًا بنفسه)
"""
import json, os, re, subprocess, sys, time, glob
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get("SHOTS", "/tmp/ta3lam-shots")
os.makedirs(SHOTS, exist_ok=True)
PORT = 8099

# ---- المحتوى للإجابة الصحيحة ----
LESSONS = {}
for f in glob.glob(os.path.join(ROOT, "app/content/lessons/*.json")):
    d = json.load(open(f, encoding="utf-8"))
    LESSONS[d["id"]] = d
BY_SIG = {}
for l in LESSONS.values():
    for q in l["practice"] + l["quiz"]:
        key = (q["prompt"], tuple(sorted(q.get("options", []))) or tuple(sorted(p[0] for p in q.get("pairs", []))))
        BY_SIG.setdefault(key, []).append(q)

def exact(t): return re.compile(r"^\s*" + re.escape(t) + r"\s*$")

problems = []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: problems.append(msg)

def find_question(page):
    prompt = page.locator(".q-prompt").inner_text().strip()
    opts = tuple(sorted(t.strip() for t in page.locator(".choice .lbl").all_inner_texts()))
    if not opts:
        opts = tuple(sorted(t.strip() for t in page.locator(".m-col:first-child .m-item").all_inner_texts()))
    for (p, o), qs in BY_SIG.items():
        if p.replace("\n", " ").strip() == prompt.replace("\n", " ") and (o == opts or not o):
            return qs[0]
    return None

def play(page, wrong_every=0, shot=None):
    """يلعب الدرس كاملًا. wrong_every=N: يخطئ عمدًا في كل N-ي سؤال اختيار."""
    n = 0
    for _ in range(80):
        if page.locator(".result").count(): return
        if not page.locator(".player").count(): return
        if page.locator(".q-prompt").count() == 0:
            page.locator(".foot .btn.primary").click(); continue
        q = find_question(page)
        assert q, "question not found: " + page.locator(".q-prompt").inner_text()
        n += 1
        deliberately_wrong = wrong_every and n % wrong_every == 0
        if q["type"] == "mcq":
            idx = q["answer"] if not deliberately_wrong else (q["answer"] + 1) % len(q["options"])
            target = q["options"][idx]
            page.locator(".choice", has=page.locator(".lbl", has_text=exact(target))).first.click()
        elif q["type"] == "tf":
            val = q["answer"] if not deliberately_wrong else (not q["answer"])
            page.locator(".choice").nth(0 if val else 1).click()
        elif q["type"] == "type":
            page.locator(".text-in").fill("zzz" if deliberately_wrong else q["answers"][0])
        elif q["type"] == "match":
            for a, b in q["pairs"]:
                page.locator(".m-col").nth(0).locator(".m-item", has_text=exact(a)).first.click()
                page.locator(".m-col").nth(1).locator(".m-item", has_text=exact(b)).first.click()
            page.locator(".foot .btn.primary").click(); continue
        if shot and n == 1: page.screenshot(path=f"{SHOTS}/{shot}-selected.png")
        page.locator("#check-btn").click()
        if shot and n == 1: page.screenshot(path=f"{SHOTS}/{shot}-feedback.png")
        page.locator(".foot .btn.primary").click()

def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", os.path.join(ROOT, "app")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        with sync_playwright() as p:
            br = p.chromium.launch()
            ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ar", is_mobile=True, has_touch=True)
            ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://localhost:{PORT}") else r.abort())
            page = ctx.new_page()
            _shot = page.screenshot
            page.screenshot = lambda **k: (page.wait_for_timeout(450), _shot(**k))[1]
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "Failed to load resource" not in m.text else None)
            page.goto(f"http://localhost:{PORT}/")

            # 1) اختيار المسار
            page.wait_for_selector(".track-card")
            page.screenshot(path=f"{SHOTS}/01-onboarding.png")
            page.locator(".track-card").nth(1).click()
            page.wait_for_selector(".node")
            check(page.locator(".node.current").count() == 1, "learner: exactly one current node")
            check("null" not in page.locator(".home").inner_text(), "home screen has no stray 'null' text")
            check(page.locator(".node.locked").count() >= 8, "learner: later nodes locked")
            page.screenshot(path=f"{SHOTS}/02-home-learner.png")

            # 2) عقدة مقفلة لا تفتح
            page.locator(".node.locked").first.click()
            check(page.locator(".toast").count() == 1, "locked node shows toast")

            # 3) درس كامل بإجابات صحيحة
            page.locator(".node.current").click()
            page.wait_for_selector(".player")
            page.screenshot(path=f"{SHOTS}/03-teach-letter.png")
            page.locator(".foot .btn.primary").click(); page.locator(".foot .btn.primary").click()
            page.screenshot(path=f"{SHOTS}/03b-teach-letter2.png")
            play(page, shot="q-learner")
            page.wait_for_selector(".result")
            check("Passed" in page.locator(".result h1").inner_text(), "perfect lesson passes")
            page.screenshot(path=f"{SHOTS}/04-result-pass.png")
            page.locator(".result .btn.primary").click()
            page.wait_for_selector(".node")
            check(page.locator(".node.done").count() == 1, "first node done after pass")
            page.screenshot(path=f"{SHOTS}/05-home-after.png")

            # 4) درس بأخطاء → مراجعة مؤجلة؛ ثم نقدّم تاريخ الاستحقاق ونجرّب المراجعة
            page.locator(".node.current").click()
            page.wait_for_selector(".player")
            play(page, wrong_every=2)
            page.wait_for_selector(".result")
            decision_failed = "Passed" not in page.locator(".result h1").inner_text()
            check(decision_failed, "lesson with many mistakes does not pass")
            check(page.locator(".weak-item").count() > 0, "result lists weak points")
            page.screenshot(path=f"{SHOTS}/06-result-fail.png")
            page.locator(".result .btn.ghost").last.click()  # العودة للخريطة
            page.wait_for_selector(".node")
            check(page.locator(".node.done").count() == 1, "failed lesson stays unpassed")

            page.evaluate("""() => { const k='ta3lam.demo.v1'; const s=JSON.parse(localStorage.getItem(k));
              for (const r of Object.values(s.reviews)) r.due_date='2000-01-01'; localStorage.setItem(k, JSON.stringify(s)); }""")
            page.reload(); page.wait_for_selector(".nav")
            check(page.locator(".badge").count() == 1, "review badge appears")
            page.locator(".nav-btn").nth(1).click()
            page.screenshot(path=f"{SHOTS}/07-review.png")
            page.locator(".screen .btn.primary").click()
            page.wait_for_selector(".player")
            play(page)
            page.wait_for_selector(".result")
            page.locator(".result .btn.primary").click()
            page.wait_for_selector(".nav")
            check(page.locator(".badge").count() == 0, "review cleared after answering correctly")

            # 5) الثيمات واللغة والتقدم
            page.locator(".nav-btn").nth(3).click()
            page.locator(".swatch").nth(1).click()
            check(page.evaluate("document.documentElement.dataset.theme") == "night", "night theme applied")
            page.screenshot(path=f"{SHOTS}/08-me-night.png")
            page.locator(".swatch").nth(0).click()
            page.locator(".nav-btn").nth(2).click()
            page.screenshot(path=f"{SHOTS}/09-progress.png")

            # 6) مسار الناطقين (RTL) ودرس كامل
            page.locator(".nav-btn").nth(3).click()
            page.locator(".seg").nth(0).locator(".seg-btn").nth(0).click()
            page.wait_for_selector(".node")
            check(page.evaluate("document.documentElement.dir") == "rtl", "native track is RTL")
            page.screenshot(path=f"{SHOTS}/10-home-native.png")
            page.locator(".node.current").click()
            page.wait_for_selector(".player")
            page.screenshot(path=f"{SHOTS}/11-native-teach.png")
            play(page, shot="q-native")
            page.wait_for_selector(".result")
            check("أحسنت" in page.locator(".result").inner_text() or page.locator(".result .res-score").count() == 1, "native lesson completes")
            page.screenshot(path=f"{SHOTS}/12-native-result.png")
            page.locator(".result .btn.primary").click()

            # 7) كل دروس المسار تُلعب بلا أخطاء برمجية (يمشي على كل العقد)
            for _ in range(20):
                page.wait_for_selector(".node")
                cur = page.locator(".node.current")
                if cur.count() == 0: break
                cur.click()
                page.wait_for_selector(".player")
                play(page)
                page.wait_for_selector(".result")
                if "Passed" not in page.locator(".result h1").inner_text() and "نجحت" not in page.locator(".result h1").inner_text():
                    check(False, "native chain lesson failed unexpectedly"); break
                page.locator(".result .btn.primary").click()
            check(page.locator(".node.locked").count() == 0 and page.locator(".node.current").count() == 0, "native track fully completable (lessons + unit tests)")
            page.screenshot(path=f"{SHOTS}/13-native-done.png")

            # 8) مسار الأجانب كاملًا (حروف + حركات + تحيات + اختبارات الوحدات)
            page.locator(".nav-btn").nth(3).click()
            page.locator(".seg").nth(0).locator(".seg-btn").nth(1).click()
            page.wait_for_selector(".node")
            played = 0
            for _ in range(40):
                page.wait_for_selector(".node")
                cur = page.locator(".node.current")
                if cur.count() == 0: break
                cur.click()
                page.wait_for_selector(".player")
                play(page)
                page.wait_for_selector(".result")
                if "Passed" not in page.locator(".result h1").inner_text():
                    check(False, "learner chain lesson failed unexpectedly"); break
                played += 1
                page.locator(".result .btn.primary").click()
            check(page.locator(".node.locked").count() == 0 and page.locator(".node.current").count() == 0, f"learner track fully completable ({played} more nodes played)")
            page.screenshot(path=f"{SHOTS}/14-learner-done.png")

            # 7) اختبار تحديد المستوى (حساب جديد): يخطئ في الوحدة الأخيرة فقط → يتخطى أول وحدتين
            ctx2 = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ar", is_mobile=True, has_touch=True)
            ctx2.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://localhost:{PORT}") else r.abort())
            pg = ctx2.new_page()
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(f"http://localhost:{PORT}/")
            pg.wait_for_selector(".track-card")
            pg.locator(".track-card").nth(0).click()
            pg.wait_for_selector(".place-card")
            pg.locator(".place-card .btn").click()
            pg.wait_for_selector(".player")
            play(pg, wrong_every=3)
            pg.wait_for_selector(".result")
            check(pg.locator(".result h1").count() == 1, "placement result shown")
            pg.screenshot(path=f"{SHOTS}/15-placement-result.png")
            pg.locator(".result .btn.primary").click()
            pg.wait_for_selector(".node")
            check(pg.locator(".node.done").count() == 7, "placement skipped first two units (7 nodes done)")
            check(pg.locator(".node.current").count() == 1, "placement leaves exactly one current node")
            check(pg.locator(".place-card").count() == 0, "placement card hidden once progress exists")
            check("null" not in pg.locator(".home").inner_text(), "no stray 'null' after placement")
            ctx2.close()

            check(not errors, "no JS errors: " + "; ".join(errors[:3]))
            br.close()
    finally:
        srv.terminate()
    print("\nRESULT:", "ALL OK" if not problems else f"{len(problems)} problem(s)")
    sys.exit(1 if problems else 0)

main()
