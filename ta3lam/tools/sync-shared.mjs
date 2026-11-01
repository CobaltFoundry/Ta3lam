// ينسخ منطق التعليم المشترك من الخادم إلى التطبيق (الوضع التجريبي). شغّله بعد أي تعديل في engine.js أو srs.js
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync(new URL("../app/js/shared/", import.meta.url), { recursive: true });
for (const f of ["engine.js", "srs.js", "gamify.js", "levels.js"]) copyFileSync(new URL(`../worker/src/${f}`, import.meta.url), new URL(`../app/js/shared/${f}`, import.meta.url));
console.log("synced");
