#!/usr/bin/env python3
"""يقسّم ملف ردود الترجمة (عناوين ### <lessonId> + كتل json) إلى tools/translations/<lang>/<id>.json
الاستعمال: python3 tools/split-translations.py fr replies.md"""
import re, json, sys, os
lang, src = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()
out = os.path.join(os.path.dirname(__file__), "translations", lang)
os.makedirs(out, exist_ok=True)
n = 0
for m in re.finditer(r"###\s*(ln-[a-z0-9-]+)\s*\n+```(?:json)?\s*\n(.*?)\n```", text, re.S):
    lid, raw = m.group(1), m.group(2)
    raw = raw.replace("“", "«").replace("”", "»") if False else raw
    try: d = json.loads(raw)
    except Exception as e: print(f"FAIL {lid}: {e}"); continue
    json.dump(d, open(os.path.join(out, lid + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    n += 1; print("saved", lid)
print(n, "lesson(s)")
