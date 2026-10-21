// أدوات صغيرة: بناء العناصر بأمان (بدون innerHTML)، نص غني، تطبيع الإجابات.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const svg = (markup) => {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
};

const AR = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF\\u200D";
const AR_RUN = new RegExp(`[${AR}]+(?:[ \\u00A0]+[${AR}]+)*`, "g");

/** يلف مقاطع العربية داخل <bdi> حتى تظهر سليمة وسط نص إنجليزي */
function bidi(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(AR_RUN)) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    frag.append(h("bdi", { class: "ar", dir: "rtl", lang: "ar" }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

/** نص غني بسيط: **غامق** وأسطر جديدة */
export function rich(str) {
  const frag = document.createDocumentFragment();
  String(str).split("\n").forEach((line, i) => {
    if (i) frag.append(document.createElement("br"));
    line.split(/(\*\*.+?\*\*)/g).forEach((part) => {
      if (!part) return;
      if (part.startsWith("**") && part.endsWith("**")) frag.append(h("b", {}, bidi(part.slice(2, -2))));
      else frag.append(bidi(part));
    });
  });
  return frag;
}

export const richEl = (tag, attrs, str) => { const el = h(tag, attrs); el.append(rich(str)); return el; };

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const HAS_AR = /[؀-ۿ]/;
/** تطبيع الإجابة المكتوبة. عربي: نحذف التشكيل والتطويل فقط (نحافظ على الهمزات!). لاتيني: نتجاهل الترقيم والمسافات وعلامات المد (ā) وتكرار الصوائت */
export function normAnswer(s) {
  s = String(s || "").trim();
  if (HAS_AR.test(s)) return s.replace(/[ً-ٰٟـ\s]/g, "");
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/([aeiou])\1+/g, "$1");
}

export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const num = (n, lang) => (lang === "ar" ? String(n).replace(/\d/g, (d) => AR_DIGITS[d]) : String(n));
