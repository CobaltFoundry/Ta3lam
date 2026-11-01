// بيانات الحروف الـ28 للمتعلمين الأجانب.
// dots: none | 1a | 1b | 2a | 2b | 3a   (a = فوق، b = تحت)
// joins: هل يتصل بما بعده؟ (ا د ذ ر ز و لا تتصل)

export const DOTS_TEXT = {
  none: "no dots",
  "1a": "one dot above",
  "1b": "one dot below",
  "2a": "two dots above",
  "2b": "two dots below",
  "3a": "three dots above",
};

export const LETTERS = [
  { ch: "ا", name: "alif", sound: "aa (long 'a', as in 'father')", dots: "none", joins: false, word: { ar: "أَسَد", en: "lion" }, note: "A plain vertical line. It never connects to the letter after it. At the start of a word it usually carries a small hamza (أ), as in أَسَد." },
  { ch: "ب", name: "baa", sound: "b", dots: "1b", joins: true, word: { ar: "بَاب", en: "door" }, note: "A shallow bowl with one dot below." },
  { ch: "ت", name: "taa", sound: "t", dots: "2a", joins: true, word: { ar: "تُفَّاح", en: "apple" }, note: "Same bowl as ب but two dots above." },
  { ch: "ث", name: "thaa", sound: "th (as in 'think')", dots: "3a", joins: true, word: { ar: "ثَوْر", en: "bull" }, note: "Same bowl, three dots above." },
  { ch: "ج", name: "jeem", sound: "j (as in 'jam')", dots: "1b", joins: true, word: { ar: "جَمَل", en: "camel" }, note: "A hook shape with one dot inside." },
  { ch: "ح", name: "Haa", sound: "a breathy 'h' from the throat (no English equivalent)", dots: "none", joins: true, word: { ar: "حَلِيب", en: "milk" }, note: "Same hook as ج but with no dot. Capital H in 'Haa' reminds you it is the throaty one." },
  { ch: "خ", name: "khaa", sound: "kh (like 'loch' in Scottish English)", dots: "1a", joins: true, word: { ar: "خُبْز", en: "bread" }, note: "Same hook as ح with one dot above." },
  { ch: "د", name: "daal", sound: "d", dots: "none", joins: false, word: { ar: "دَجَاج", en: "chicken" }, note: "A small corner shape. It does not connect to the next letter." },
  { ch: "ذ", name: "dhaal", sound: "dh (as in 'this')", dots: "1a", joins: false, word: { ar: "ذُرَة", en: "corn" }, note: "Same as د with one dot above." },
  { ch: "ر", name: "raa", sound: "r (a quick rolled 'r')", dots: "none", joins: false, word: { ar: "رَجُل", en: "man" }, note: "A curve dropping below the line. Does not connect forward." },
  { ch: "ز", name: "zaay", sound: "z", dots: "1a", joins: false, word: { ar: "زَهْرَة", en: "flower" }, note: "Same as ر with one dot above." },
  { ch: "س", name: "seen", sound: "s", dots: "none", joins: true, word: { ar: "سَمَكَة", en: "fish" }, note: "Three small teeth, no dots." },
  { ch: "ش", name: "sheen", sound: "sh", dots: "3a", joins: true, word: { ar: "شَمْس", en: "sun" }, note: "Same teeth as س with three dots above." },
  { ch: "ص", name: "Saad", sound: "a heavy, emphatic 's'", dots: "none", joins: true, word: { ar: "صَبَاح", en: "morning" }, note: "A loop with a tail, no dots. Say it deep in the mouth." },
  { ch: "ض", name: "Daad", sound: "a heavy, emphatic 'd'", dots: "1a", joins: true, word: { ar: "ضِفْدَع", en: "frog" }, note: "Same as ص with one dot above. Arabic is called 'the language of Daad'." },
  { ch: "ط", name: "Taa", sound: "a heavy, emphatic 't'", dots: "none", joins: true, word: { ar: "طَائِر", en: "bird" }, note: "A loop with a tall stem, no dots." },
  { ch: "ظ", name: "Zaa", sound: "a heavy, emphatic 'dh'", dots: "1a", joins: true, word: { ar: "ظَرْف", en: "envelope" }, note: "Same as ط with one dot above." },
  { ch: "ع", name: "'ayn", sound: "a deep squeezed sound from the throat (no English equivalent)", dots: "none", joins: true, word: { ar: "عَيْن", en: "eye" }, note: "Looks like a small 3 or an open head. No dots." },
  { ch: "غ", name: "ghayn", sound: "gh (like a French 'r', gargled)", dots: "1a", joins: true, word: { ar: "غَيْمَة", en: "cloud" }, note: "Same as ع with one dot above." },
  { ch: "ف", name: "faa", sound: "f", dots: "1a", joins: true, word: { ar: "فِيل", en: "elephant" }, note: "A small round head with one dot above." },
  { ch: "ق", name: "qaaf", sound: "q (a deep 'k' from the back of the throat)", dots: "2a", joins: true, word: { ar: "قَمَر", en: "moon" }, note: "Like ف but with two dots and a deeper tail." },
  { ch: "ك", name: "kaaf", sound: "k", dots: "none", joins: true, word: { ar: "كِتَاب", en: "book" }, note: "Has a small zigzag stroke inside, but no dots." },
  { ch: "ل", name: "laam", sound: "l", dots: "none", joins: true, word: { ar: "لَيْمُون", en: "lemon" }, note: "A tall stem with a hook at the bottom." },
  { ch: "م", name: "meem", sound: "m", dots: "none", joins: true, word: { ar: "مَوْز", en: "banana" }, note: "A small closed circle with a tail." },
  { ch: "ن", name: "noon", sound: "n", dots: "1a", joins: true, word: { ar: "نَجْمَة", en: "star" }, note: "A bowl with one dot above." },
  { ch: "ه", name: "haa", sound: "h (as in 'hat')", dots: "none", joins: true, word: { ar: "هِلَال", en: "crescent" }, note: "Changes shape a lot. Lowercase 'haa' = the soft, light h." },
  { ch: "و", name: "waaw", sound: "w (also the long vowel 'oo')", dots: "none", joins: false, word: { ar: "وَرْدَة", en: "rose" }, note: "A small loop with a tail. Does not connect forward." },
  { ch: "ي", name: "yaa", sound: "y (also the long vowel 'ee')", dots: "2b", joins: true, word: { ar: "يَد", en: "hand" }, note: "A curved tail with two dots below." },
];

// الأشكال: منفصل / أول / وسط / آخر (باستخدام الوصل ZWJ)
const ZWJ = "‍";
export function forms(l) {
  const f = { iso: l.ch, fin: ZWJ + l.ch };
  if (l.joins) { f.ini = l.ch + ZWJ; f.med = ZWJ + l.ch + ZWJ; }
  return f;
}

// مقاطع الحركات: حرف صامت + نطقه
export const CONSONANTS = [
  { ch: "ب", lat: "b" }, { ch: "ت", lat: "t" }, { ch: "م", lat: "m" }, { ch: "ن", lat: "n" },
  { ch: "ل", lat: "l" }, { ch: "ك", lat: "k" }, { ch: "س", lat: "s" }, { ch: "د", lat: "d" },
];
export const VOWELS = [
  { mark: "َ", name: "fatha", v: "a", desc: "a small diagonal line ABOVE the letter" },
  { mark: "ِ", name: "kasra", v: "i", desc: "a small diagonal line BELOW the letter" },
  { mark: "ُ", name: "damma", v: "u", desc: "a small curl (like a tiny و) ABOVE the letter" },
];
