/**
 * Normalizes Arabic & Latin text for forgiving search matching:
 * - Converts أ / إ / آ -> ا
 * - Converts ى -> ي
 * - Converts ة -> ه
 * - Removes Arabic diacritics (tashkeel) and tatweel
 * - Converts Eastern Arabic numerals ٠-٩ to 0-9
 */
export function normalizeArabicSearch(input: unknown): string {
  if (input === undefined || input === null) return '';
  let str = String(input)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[‐‑‒–—―]/g, '-');

  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i));
  }
  return str;
}

/**
 * Extracts a pair of (lat, lng) coordinates from a pasted string,
 * such as "30.0147, 31.3125" or a Google Maps URL "?q=30.0147,31.3125" or "@30.0147,31.3125".
 */
export function extractLatLngPairFromInput(raw: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  let text = raw.trim();
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  for (let i = 0; i < 10; i++) {
    text = text.replaceAll(arabicDigits[i], String(i));
  }
  text = text.replaceAll('٫', '.').replaceAll('،', ',');

  const patterns = [
    /@(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|ll|destination|query)=(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(-?\d{1,3}(?:\.\d+)?)\s*[,;\s/|]+\s*(-?\d{1,3}(?:\.\d+)?)/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return { lat: a, lng: b };
      }
    }
  }
  return null;
}
