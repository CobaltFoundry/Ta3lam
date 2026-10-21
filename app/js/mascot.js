// الشخصية المرافقة: «ع» الذهبية. المزاج يغيّر الفم فقط.
import { svg } from "./util.js";

const MOUTH = {
  happy: '<path d="M36 50q8 7 16 0" fill="none" stroke="var(--mascot-ink)" stroke-width="2.4" stroke-linecap="round"/>',
  cheer: '<path d="M34 49q10 12 20 0z" fill="var(--mascot-ink)" stroke="var(--mascot-ink)" stroke-width="2" stroke-linejoin="round"/>',
  think: '<path d="M38 52q6 4 12 0" fill="none" stroke="var(--mascot-ink)" stroke-width="2.4" stroke-linecap="round"/>',
};

export function mascot(mood = "happy", size = 88) {
  return svg(`<svg role="img" aria-label="" width="${size}" height="${size}" viewBox="0 0 88 88" class="mascot">
<ellipse cx="28" cy="82" rx="10" ry="4" fill="var(--mascot-foot)"/>
<ellipse cx="60" cy="82" rx="10" ry="4" fill="var(--mascot-foot)"/>
<ellipse cx="44" cy="48" rx="34" ry="35" fill="var(--mascot-body)" stroke="var(--mascot-line)" stroke-width="2"/>
<ellipse cx="44" cy="61" rx="21" ry="17" fill="var(--mascot-belly)"/>
<circle cx="32" cy="36" r="9" fill="#fff" stroke="var(--mascot-line)" stroke-width="1.6"/>
<circle cx="56" cy="36" r="9" fill="#fff" stroke="var(--mascot-line)" stroke-width="1.6"/>
<circle cx="34" cy="37" r="4.2" fill="var(--mascot-ink)"/><circle cx="58" cy="37" r="4.2" fill="var(--mascot-ink)"/>
<circle cx="35.4" cy="35.4" r="1.4" fill="#fff"/><circle cx="59.4" cy="35.4" r="1.4" fill="#fff"/>
${MOUTH[mood] || MOUTH.happy}
<text x="44" y="73" text-anchor="middle" font-family="Tajawal, sans-serif" font-weight="800" font-size="24" fill="var(--mascot-letter)">ع</text>
</svg>`);
}

// أيقونات خطية صغيرة
const ICONS = {
  check: '<path d="M5 12l5 5L20 7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  flag: '<path d="M5 21V4M5 5h12l-2 4 2 4H5"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cards: '<rect x="4" y="6" width="13" height="14" rx="2"/><path d="M8 3h11a1 1 0 0 1 1 1v13"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  star: '<polygon points="12 3 14.7 9 21 9.6 16.2 13.8 17.8 20 12 16.7 6.2 20 7.8 13.8 3 9.6 9.3 9"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
};
export function icon(name, size = 24, stroke = "currentColor", fill = "none") {
  return svg(`<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
}
