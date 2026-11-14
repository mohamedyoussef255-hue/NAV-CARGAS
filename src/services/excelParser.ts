import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Station } from '../types';

export interface ColumnMappingOverride {
  nameCol?: string;
  latCol?: string;
  lngCol?: string;
  combinedCol?: string;
  govCol?: string;
  cityCol?: string;
  addressCol?: string;
}

export interface ParseOptions {
  defaultCompany?: string;
  overrideCompany?: boolean;
}

export interface ParseDiagnostics {
  uniqueCoordCount: number;
  governoratesCount: number;
  swappedCount: number;
  utmConvertedCount: number;
  collapsedIntegerCount: number;
  syntheticNameCount: number;
  isDiagonalLine: boolean;
  diagonalReason?: string;
  headerRowNumber: number;
  latRange?: [number, number];
  lngRange?: [number, number];
  detectedColumns: {
    nameCol?: string;
    latCol?: string;
    lngCol?: string;
    combinedCol?: string;
    govCol?: string;
  };
}

export interface ParseResult {
  success: boolean;
  stations: Station[];
  errors: string[];
  totalRows: number;
  validRows: number;
  headers: string[];
  sampleRows: Record<string, any>[];
  diagnostics: ParseDiagnostics;
}

const NORTHWEST_EGYPT_KEYWORDS = [
  'إسكندرية',
  'اسكندرية',
  'الاسكندرية',
  'الإسكندرية',
  'alexandria',
  'مطروح',
  'مرسى مطروح',
  'علمين',
  'العلمين',
  'سيوة',
  'بحيرة',
  'البحيرة',
  'دمنهور',
  'رشيد',
  'كفر الشيخ',
  'برج العرب',
  'الساحل',
  'الضبعة',
  'السلوم',
];

// Convert Eastern Arabic / Persian numerals & Arabic decimal/comma symbols
export function normalizeNumerals(val: any): string {
  if (val === undefined || val === null) return '';
  let res = String(val).trim();
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicDigits[i], String(i));
    res = res.replaceAll(persianDigits[i], String(i));
  }
  // Arabic decimal separator (U+066B) -> '.'
  res = res.replaceAll('٫', '.');
  // Arabic thousands/list comma (U+060C / U+066C) -> ','
  res = res.replaceAll('،', ',').replaceAll('٬', '');
  return res;
}

// Convert UTM (WGS84 Northern Hemisphere) Easting/Northing meters to Decimal Lat/Lng
function utmToLatLng(easting: number, northing: number, zone = 36): { lat: number; lng: number } {
  const a = 6378137.0;
  const eccSquared = 0.00669437999014;
  const k0 = 0.9996;

  const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
  const x = easting - 500000.0;
  const y = northing;

  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);

  const M = y / k0;
  const mu =
    M /
    (a *
      (1 -
        eccSquared / 4 -
        (3 * eccSquared * eccSquared) / 64 -
        (5 * eccSquared * eccSquared * eccSquared) / 256));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
  const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
  const C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
  const R1 = (a * (1 - eccSquared)) / Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
  const D = x / (N1 * k0);

  let lat =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSquared - 3 * C1 * C1) * Math.pow(D, 6)) / 720);

  let lng =
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSquared + 24 * T1 * T1) * Math.pow(D, 5)) / 120) /
    Math.cos(phi1Rad);

  lat = (lat * 180) / Math.PI;
  lng = longOrigin + (lng * 180) / Math.PI;
  return { lat, lng };
}

// Normalize Arabic/English compass keywords & decimal commas in coordinate strings
function normalizeCompassAndSeparators(str: string): string {
  let out = str
    .replace(/شمالاً|شمالا|شمال/gi, 'N')
    .replace(/جنوباً|جنوبا|جنوب/gi, 'S')
    .replace(/شرقاً|شرقا|شرق/gi, 'E')
    .replace(/غرباً|غربا|غرب/gi, 'W')
    .replace(/(^|[\s\d°º'"′’″”])ش(?=\s|$|[,\-;\/|])/g, '$1N')
    .replace(/(^|[\s\d°º'"′’″”])ج(?=\s|$|[,\-;\/|])/g, '$1S')
    .replace(/(^|[\s\d°º'"′’″”])ق(?=\s|$|[,\-;\/|])/g, '$1E')
    .replace(/(^|[\s\d°º'"′’″”])غ(?=\s|$|[,\-;\/|])/g, '$1W');

  // Replace European decimal commas inside numbers (e.g. "30,1234" or "12,4\"")
  out = out.replace(/(\d),(\d)/g, '$1.$2');
  return out;
}

// Robust coordinate parser supporting Decimal, Comma Decimal, DMS (30°05'12.4"N / ش), and DDM (30°05.206'N)
export function parseCoordinate(val: any): number {
  if (val === undefined || val === null || val === '') return NaN;
  if (typeof val === 'number') return isNaN(val) ? NaN : val;

  let str = normalizeNumerals(val);
  if (!str) return NaN;
  str = normalizeCompassAndSeparators(str);

  // 1. Check DMS: e.g. 30°05'12.4"N or 30° 5' 12.4"
  const dmsRegex =
    /(-?\d+)\s*[°º˚*]\s*(\d+(?:\.\d+)?)\s*['′’]?\s*(?:(\d+(?:\.\d+)?)\s*["″”]?)?\s*([NSEWnsew])?/;
  const dmsMatch = str.match(dmsRegex);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2] || '0');
    const sec = parseFloat(dmsMatch[3] || '0');
    const hemi = (dmsMatch[4] || '').toUpperCase();
    if (!isNaN(deg) && !isNaN(min) && !isNaN(sec)) {
      let dec = Math.abs(deg) + min / 60 + sec / 3600;
      if (deg < 0 || hemi === 'S' || hemi === 'W') dec = -dec;
      return dec;
    }
  }

  // 2. Check space/colon separated DMS without symbols: e.g. "30 05 12.4" or "30:05:12.4"
  const spaceDms = str.match(/^(-?\d+)[\s:]+(\d{1,2})[\s:]+(\d{1,2}(?:\.\d+)?)\s*([NSEWnsew])?$/);
  if (spaceDms) {
    const deg = parseFloat(spaceDms[1]);
    const min = parseFloat(spaceDms[2]);
    const sec = parseFloat(spaceDms[3]);
    const hemi = (spaceDms[4] || '').toUpperCase();
    let dec = Math.abs(deg) + min / 60 + sec / 3600;
    if (deg < 0 || hemi === 'S' || hemi === 'W') dec = -dec;
    return dec;
  }

  // 3. Standard floating-point number (respect S/W hemisphere if present)
  const floatMatch = str.match(/-?\d+(?:\.\d+)?/);
  if (!floatMatch) return NaN;
  let num = parseFloat(floatMatch[0]);
  if (/[SWsw]/.test(str) && num > 0) num = -num;
  return num;
}

// Extract [lat, lng] pair from combined text or Google Maps URL
export function extractCoordsPair(text: any): { lat: number; lng: number } | null {
  if (text === undefined || text === null) return null;
  let str = normalizeNumerals(text);
  if (!str) return null;
  str = normalizeCompassAndSeparators(str);

  // Google Maps !3dLAT!4dLNG
  const protoMatch = str.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,2}\.\d+)/);
  if (protoMatch) {
    return { lat: parseFloat(protoMatch[1]), lng: parseFloat(protoMatch[2]) };
  }

  // Google Maps @LAT,LNG or q=LAT,LNG or ll=LAT,LNG or destination=LAT,LNG
  const urlMatch = str.match(/(?:@|[?&](?:q|ll|destination|center)=)(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,2}\.\d+)/);
  if (urlMatch) {
    return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]) };
  }

  // DMS pair e.g. 30°05'12"N 31°14'08"E
  const dmsPair = str.match(
    /(\d{1,2}\s*[°º˚*]\s*\d+(?:\.\d+)?\s*['′’]?\s*(?:\d+(?:\.\d+)?\s*["″”]?)?\s*[NSns]?)[,\s/;|]+(\d{1,2}\s*[°º˚*]\s*\d+(?:\.\d+)?\s*['′’]?\s*(?:\d+(?:\.\d+)?\s*["″”]?)?\s*[EWew]?)/
  );
  if (dmsPair) {
    const a = parseCoordinate(dmsPair[1]);
    const b = parseCoordinate(dmsPair[2]);
    if (!isNaN(a) && !isNaN(b)) return { lat: a, lng: b };
  }

  // Plain decimal pair "30.0512, 31.3412" or "30.0512 / 31.3412" or "30.0512 - 31.3412"
  const pairMatch = str.match(/(-?\d{1,2}\.\d+)\s*[,;/|&\-\s]\s*(-?\d{1,2}\.\d+)/);
  if (pairMatch) {
    const a = parseCoordinate(pairMatch[1]);
    const b = parseCoordinate(pairMatch[2]);
    if (!isNaN(a) && !isNaN(b) && a >= 15 && a <= 42 && b >= 15 && b <= 45) {
      return { lat: a, lng: b };
    }
  }

  return null;
}

// Geographic ground truth correction for Egypt
export function fixEgyptLatLngSwap(
  lat: number,
  lng: number,
  contextText: string
): { lat: number; lng: number; swapped: boolean } {
  const text = contextText.toLowerCase();
  const isNorthwestEgypt = NORTHWEST_EGYPT_KEYWORDS.some((kw) => text.includes(kw));

  // 1. Definite rule: No coordinate in Egypt exceeds Latitude 31.75°N (Mediterranean Sea)
  if (lat > 31.75 && lng >= 21.5 && lng <= 31.75) {
    return { lat: lng, lng: lat, swapped: true };
  }

  // 2. Cairo/Giza/Delta/Canal/Upper Egypt: Longitude is strictly greater than Latitude everywhere except Northwest coast
  if (!isNorthwestEgypt && lat > lng) {
    if (lat >= 24.5 && lat <= 37.0 && lng >= 21.5 && lng <= 32.0) {
      return { lat: lng, lng: lat, swapped: true };
    }
  }

  return { lat, lng, swapped: false };
}

// Geometry health detector: catches collapsed integer coords, duplicates, lat===lng, and any 1D diagonal/straight line
export function detectCoordinateGeometryIssue(
  points: Array<{ lat: number; lng: number }>
): { suspicious: boolean; isDiagonalLine: boolean; reason?: string } {
  if (!points || points.length < 3) return { suspicious: false, isDiagonalLine: false };

  const valid = points.filter(
    (p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  );
  if (valid.length < 3) return { suspicious: false, isDiagonalLine: false };

  if (valid.length >= 8) {
    // 1. Direct lat === lng diagonal bug check
    const equalLatLngCount = valid.filter((s) => Math.abs(s.lat - s.lng) < 0.05).length;
    if (equalLatLngCount >= Math.max(4, valid.length * 0.25)) {
      return {
        suspicious: true,
        isDiagonalLine: true,
        reason: `يوجد ${equalLatLngCount} محطة تتطابق فيها قيمة خط العرض مع خط الطول تقريباً (صف واحد مائل على الخريطة).`,
      };
    }

    // 2. General 2D PCA / covariance collinearity check (detects ANY straight or diagonal line)
    const n = valid.length;
    let meanLat = 0;
    let meanLng = 0;
    for (const p of valid) {
      meanLat += p.lat;
      meanLng += p.lng;
    }
    meanLat /= n;
    meanLng /= n;

    let cxx = 0;
    let cyy = 0;
    let cxy = 0;
    for (const p of valid) {
      const dx = p.lat - meanLat;
      const dy = p.lng - meanLng;
      cxx += dx * dx;
      cyy += dy * dy;
      cxy += dx * dy;
    }
    cxx /= n;
    cyy /= n;
    cxy /= n;

    const trace = cxx + cyy;
    const diff = cxx - cyy;
    const disc = Math.sqrt(diff * diff + 4 * cxy * cxy);
    const lambda1 = (trace + disc) / 2;
    const lambda2 = Math.max(0, (trace - disc) / 2);

    const majorStd = Math.sqrt(lambda1);
    const minorStd = Math.sqrt(lambda2);

    if (majorStd > 0.15 && minorStd / majorStd < 0.04 && minorStd < 0.035) {
      return {
        suspicious: true,
        isDiagonalLine: true,
        reason: `المحطات مرصوصة في خط مستقيم أو مائل واحد بدلاً من توزيعها الجغرافي على المحافظات.`,
      };
    }
  }

  const integerCoords = valid.filter(
    (s) =>
      Math.abs(s.lat - Math.round(s.lat)) < 0.0001 ||
      Math.abs(s.lng - Math.round(s.lng)) < 0.0001
  ).length;

  if (integerCoords > Math.max(2, valid.length * 0.15)) {
    return {
      suspicious: true,
      isDiagonalLine: false,
      reason: `يوجد ${integerCoords} محطة بإحداثيات مقربة لأرقام صحيحة (بدون كسور عشرية)، مما يجمعها في نقاط مكدسة على الخريطة.`,
    };
  }

  const uniqueCoords = new Set(
    valid.map((s) => `${Number(s.lat).toFixed(3)},${Number(s.lng).toFixed(3)}`)
  );
  if (valid.length >= 10 && uniqueCoords.size <= Math.max(2, valid.length * 0.25)) {
    return {
      suspicious: true,
      isDiagonalLine: false,
      reason: `العديد من المحطات تشترك في نفس الإحداثيات (${uniqueCoords.size} موقع فريد فقط من أصل ${valid.length} محطة).`,
    };
  }

  return { suspicious: false, isDiagonalLine: false };
}

function cleanHeaderKey(key: string): string {
  return key
    .replace(/[\u0640\u064B-\u065F\u0670\u200B-\u200F\uFEFF]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s_\-().,،/\\:]/g, '');
}

// Candidates-first matcher (prevents weak early columns like 'Company'/'City' from matching 'y', and blocks reusing already-claimed columns)
function findMatchingColumnKey(
  keys: string[],
  candidates: string[],
  excludeWords: string[] = [],
  excludeKeys: Set<string> = new Set()
): string | undefined {
  const cleanedExcludes = excludeWords.map((w) => cleanHeaderKey(w));
  const availableKeys = keys.filter((k) => !excludeKeys.has(k));

  // Pass 1: Exact normalized match (highest candidate priority first)
  for (const cand of candidates) {
    const cleanCand = cleanHeaderKey(cand);
    for (const key of availableKeys) {
      if (cleanHeaderKey(key) === cleanCand) {
        return key;
      }
    }
  }

  // Pass 2: Substring match ONLY for candidates >= 2 chars (never bare 'x' or 'y'!)
  for (const cand of candidates) {
    const cleanCand = cleanHeaderKey(cand);
    if (cleanCand.length < 2) continue;

    for (const key of availableKeys) {
      const cleanKey = cleanHeaderKey(key);
      if (cleanedExcludes.some((ex) => cleanKey.includes(ex))) continue;
      if (cleanKey.includes(cleanCand)) {
        return key;
      }
    }
  }

  return undefined;
}

const HEADER_SCAN_KEYWORDS = [
  'محطه',
  'محطة',
  'محطات',
  'مسمى',
  'مسمي',
  'بيان',
  'البيان',
  'فرع',
  'الفرع',
  'منفذ',
  'المنفذ',
  'موقع',
  'الموقع',
  'اسم',
  'station',
  'branch',
  'outlet',
  'site',
  'name',
  'title',
  'عرض',
  'طول',
  'lat',
  'lng',
  'lon',
  'long',
  'محافظه',
  'محافظة',
  'governorate',
  'عنوان',
  'address',
  'احداثي',
  'coord',
  'gps',
  'easting',
  'northing',
  'شمال',
  'شرق',
];

function extractRowsWithAutoHeader(worksheet: XLSX.WorkSheet): {
  rawRows: Record<string, any>[];
  headerRowNumber: number;
} {
  const matrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) {
    return { rawRows: [], headerRowNumber: 1 };
  }

  let bestRowIdx = 0;
  let bestScore = -1000;
  const maxScan = Math.min(15, matrix.length);

  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] || [];
    let nonEmptyStrings = 0;
    let keywordHits = 0;
    let numericCells = 0;
    let exactKeywordHits = 0;

    for (const cell of row) {
      const str = String(cell ?? '').trim();
      if (!str) continue;
      if (/^-?\d+([.,]\d+)?$/.test(normalizeNumerals(str)) || extractCoordsPair(str)) {
        numericCells++;
        continue;
      }
      nonEmptyStrings++;
      const cleaned = cleanHeaderKey(str);
      if (
        HEADER_SCAN_KEYWORDS.some((kw) => cleaned.includes(cleanHeaderKey(kw))) ||
        ['x', 'y', 'n', 'e', 'س', 'ص'].includes(cleaned)
      ) {
        keywordHits++;
      }
      if (
        [
          'اسم المحطه',
          'اسماء المحطات',
          'مسمي المحطه',
          'بيان المحطه',
          'المحطه',
          'البيان',
          'الفرع',
          'خط العرض',
          'خط الطول',
          'الاحداثيات',
          'المحافظه',
          'station name',
          'branch name',
          'site name',
          'lat',
          'lng',
          'lon',
          'latitude',
          'longitude',
        ].some((kw) => cleanHeaderKey(kw) === cleaned)
      ) {
        exactKeywordHits++;
      }
    }

    // Disqualify rows with coordinate numbers unless the row has >= 2 exact header matches
    if (numericCells > 0 && exactKeywordHits < 2) continue;

    // Real header rows have >= 2 text columns and no numeric coordinate data
    const score = exactKeywordHits * 20 + keywordHits * 10 + nonEmptyStrings - numericCells * 15;
    if (nonEmptyStrings >= 2 && score > bestScore) {
      bestScore = score;
      bestRowIdx = r;
    }
  }

  const headerCells = matrix[bestRowIdx] || [];
  const usedNames = new Map<string, number>();
  const colNames: string[] = headerCells.map((cell, idx) => {
    const raw = String(cell ?? '').trim();
    const base = raw || `عمود_${idx + 1}`;
    const count = usedNames.get(base) || 0;
    usedNames.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });

  const rawRows: Record<string, any>[] = [];
  for (let r = bestRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const hasContent = row.some((c) => String(c ?? '').trim() !== '');
    if (!hasContent) continue;

    const obj: Record<string, any> = {};
    for (let c = 0; c < colNames.length; c++) {
      obj[colNames[c]] = row[c] !== undefined ? row[c] : '';
    }
    rawRows.push(obj);
  }

  return { rawRows, headerRowNumber: bestRowIdx + 1 };
}

// Data-driven fallback if column headers are missing or unrecognized (__EMPTY, Col1, etc.)
function inferCoordinateColumnsFromData(
  headers: string[],
  rows: Record<string, any>[],
  excludeKeys: Set<string>
): { latCol?: string; lngCol?: string; combinedCol?: string } {
  const sample = rows.slice(0, Math.min(40, rows.length));
  if (sample.length === 0) return {};

  // 1. Check for a column containing coordinate pairs (e.g. "30.05, 31.23" or Google Maps URL)
  let bestCombined: { key: string; hits: number } | null = null;
  for (const key of headers) {
    if (excludeKeys.has(key)) continue;
    let hits = 0;
    for (const r of sample) {
      if (extractCoordsPair(r[key])) hits++;
    }
    if (hits >= Math.max(2, sample.length * 0.4) && (!bestCombined || hits > bestCombined.hits)) {
      bestCombined = { key, hits };
    }
  }
  if (bestCombined) {
    return { combinedCol: bestCombined.key };
  }

  // 2. Evaluate numeric columns matching Egypt geographic decimal or UTM ranges
  interface ColStats {
    key: string;
    decimalCount: number;
    egyptLatCount: number;
    egyptLngCount: number;
    utmEastingCount: number;
    utmNorthingCount: number;
    mean: number;
    distinctRounded: number;
  }

  const stats: ColStats[] = [];
  for (const key of headers) {
    if (excludeKeys.has(key)) continue;
    const nums: number[] = [];
    let decimalCount = 0;
    let egyptLatCount = 0;
    let egyptLngCount = 0;
    let utmEastingCount = 0;
    let utmNorthingCount = 0;

    for (const r of sample) {
      const raw = r[key];
      if (raw === undefined || raw === null || String(raw).trim() === '') continue;
      // Ignore phone numbers starting with 0 like "010..." or "19617"
      const rawStr = normalizeNumerals(raw);
      if (/^0\d{7,}$/.test(rawStr.trim())) continue;
      const val = parseCoordinate(raw);
      if (isNaN(val)) continue;
      nums.push(val);
      if (Math.abs(val - Math.round(val)) > 0.0001) decimalCount++;
      if (val >= 21.5 && val <= 31.8) egyptLatCount++;
      if (val >= 24.5 && val <= 37.0) egyptLngCount++;
      if (val >= 100000 && val <= 900000) utmEastingCount++;
      if (val >= 2300000 && val <= 3700000) utmNorthingCount++;
    }

    if (nums.length >= Math.max(2, sample.length * 0.4)) {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const distinctRounded = new Set(nums.map((n) => n.toFixed(3))).size;
      stats.push({
        key,
        decimalCount,
        egyptLatCount,
        egyptLngCount,
        utmEastingCount,
        utmNorthingCount,
        mean,
        distinctRounded,
      });
    }
  }

  // Check decimal Egypt coordinate columns first
  const decimalCols = stats.filter(
    (s) => s.decimalCount >= Math.max(2, sample.length * 0.35) && (s.egyptLatCount > 0 || s.egyptLngCount > 0)
  );
  if (decimalCols.length >= 2) {
    // Best pair: Lat has smaller values/all <= 31.8, Lng extends higher (mean around 30.8-32.5)
    const sorted = [...decimalCols].sort((a, b) => a.mean - b.mean);
    const latCandidate = sorted.find((s) => s.egyptLatCount >= s.decimalCount * 0.8);
    const lngCandidate = [...sorted]
      .reverse()
      .find((s) => s.key !== latCandidate?.key && s.egyptLngCount >= s.decimalCount * 0.8);
    if (latCandidate && lngCandidate) {
      return { latCol: latCandidate.key, lngCol: lngCandidate.key };
    }
  }

  // Check UTM columns
  const northingCol = stats.find((s) => s.utmNorthingCount >= Math.max(2, sample.length * 0.4));
  const eastingCol = stats.find(
    (s) => s.key !== northingCol?.key && s.utmEastingCount >= Math.max(2, sample.length * 0.4)
  );
  if (northingCol && eastingCol) {
    return { latCol: northingCol.key, lngCol: eastingCol.key };
  }

  return {};
}

// Data-driven fallback to identify the station name column when headers are missing/custom
function inferNameColumnFromData(
  headers: string[],
  rows: Record<string, any>[],
  excludeKeys: Set<string>
): string | undefined {
  const sample = rows.slice(0, Math.min(100, rows.length));
  if (sample.length === 0) return undefined;

  const nonNameHeaderHints = [
    'محافظه',
    'governorate',
    'gov',
    'province',
    'شركه',
    'company',
    'brand',
    'هاتف',
    'تليفون',
    'موبايل',
    'phone',
    'tel',
    'mobile',
    'ساعات',
    'مواعيد',
    'hours',
    'ملاحظ',
    'note',
    'تاريخ',
    'date',
    'بريد',
    'email',
    'كود',
    'code',
    'مسلسل',
    'serial',
    'رابط',
    'url',
    'link',
    'تحويل',
    'زيوت',
    'اسطوانات',
    'مظله',
    'خدمات',
  ].map((w) => cleanHeaderKey(w));

  let best: { key: string; score: number } | null = null;

  for (const key of headers) {
    if (excludeKeys.has(key)) continue;
    const cleanedKey = cleanHeaderKey(key);
    if (nonNameHeaderHints.some((hint) => cleanedKey === hint || cleanedKey.includes(hint))) {
      continue;
    }

    let validTextCount = 0;
    let letterTextCount = 0;
    let numericOrBoolCount = 0;
    let totalLen = 0;
    let cargasHints = 0;
    const distinctValues = new Set<string>();

    for (const r of sample) {
      const raw = r[key];
      if (raw === undefined || raw === null) continue;
      const str = String(raw).replace(/\r?\n+/g, ' ').trim();
      if (!str) continue;

      const norm = normalizeNumerals(str).toLowerCase();
      if (
        /^-?\d+([.,]\d+)?$/.test(norm) ||
        /^(?:\+?2)?0?1\d{8,9}$/.test(norm.replace(/[\s\-()]/g, '')) ||
        /^https?:\/\//i.test(str) ||
        ['نعم', 'لا', 'true', 'false', 'yes', 'no', '✓', '✔', 'يوجد', 'لا يوجد'].includes(norm) ||
        extractCoordsPair(str)
      ) {
        numericOrBoolCount++;
        continue;
      }

      if (str.length >= 2) {
        validTextCount++;
        totalLen += str.length;
        distinctValues.add(str);
        if (/[\u0600-\u06FFa-zA-Z]/.test(str)) {
          letterTextCount++;
        }
        if (/كارجاس|غازتك|طاقة|ماستر|محطة|محطه|cargas|gastec|taqa|master/i.test(str)) {
          cargasHints++;
        }
      }
    }

    if (validTextCount < Math.max(1, sample.length * 0.4) || letterTextCount === 0) {
      continue;
    }
    if (numericOrBoolCount > validTextCount) {
      continue;
    }

    const avgLen = totalLen / validTextCount;
    const distinctRatio = distinctValues.size / validTextCount;

    // Prefer columns with unique station names rather than repeated governorates/cities/hours
    let score = validTextCount * 2 + distinctRatio * 50 + (cargasHints > 0 ? 15 : 0);
    if (avgLen >= 3 && avgLen <= 85) score += 15;
    if (distinctRatio < 0.25 && sample.length >= 8) score -= 35;
    if (cleanedKey.includes(cleanHeaderKey('عنوان')) || cleanedKey.includes(cleanHeaderKey('address'))) {
      score -= 10;
    }

    if (!best || score > best.score) {
      best = { key, score };
    }
  }

  return best?.key;
}

export class ExcelParser {
  static async parseExcelOrCsv(
    file: File,
    mappingOverride?: ColumnMappingOverride,
    parseOptions?: ParseOptions
  ): Promise<ParseResult> {
    const errors: string[] = [];
    const stations: Station[] = [];
    let totalRows = 0;
    let headers: string[] = [];
    let sampleRows: Record<string, any>[] = [];
    let swappedCount = 0;
    let utmConvertedCount = 0;
    let syntheticNameCount = 0;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      let selectedSheetName = workbook.SheetNames[0];

      // If the first sheet is empty or a cover sheet with <2 rows, pick the first populated sheet
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const preview = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        if (preview.filter((row) => row.some((c) => String(c ?? '').trim() !== '')).length >= 2) {
          selectedSheetName = sheetName;
          break;
        }
      }

      if (!selectedSheetName) {
        return {
          success: false,
          stations: [],
          errors: ['الملف فارغ أو لا يحتوي على أوراق عمل'],
          totalRows: 0,
          validRows: 0,
          headers: [],
          sampleRows: [],
          diagnostics: {
            uniqueCoordCount: 0,
            governoratesCount: 0,
            swappedCount: 0,
            utmConvertedCount: 0,
            collapsedIntegerCount: 0,
            syntheticNameCount: 0,
            isDiagonalLine: false,
            headerRowNumber: 1,
            detectedColumns: {},
          },
        };
      }

      const worksheet = workbook.Sheets[selectedSheetName];
      const { rawRows, headerRowNumber } = extractRowsWithAutoHeader(worksheet);
      totalRows = rawRows.length;

      if (rawRows.length === 0) {
        return {
          success: false,
          stations: [],
          errors: ['ورقة العمل فارغة ولا تحتوي على بيانات'],
          totalRows: 0,
          validRows: 0,
          headers: [],
          sampleRows: [],
          diagnostics: {
            uniqueCoordCount: 0,
            governoratesCount: 0,
            swappedCount: 0,
            utmConvertedCount: 0,
            collapsedIntegerCount: 0,
            syntheticNameCount: 0,
            isDiagonalLine: false,
            headerRowNumber,
            detectedColumns: {},
          },
        };
      }

      // Collect all headers across the first 10 rows
      const headerSet = new Set<string>();
      rawRows.slice(0, 10).forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
      headers = Array.from(headerSet);
      sampleRows = rawRows.slice(0, 5);

      const claimedCols = new Set<string>();

      // Detect columns once across sheet (unless overridden by Admin mapping)
      let detectedLatCol =
        mappingOverride?.latCol ||
        findMatchingColumnKey(
          headers,
          [
            'خط العرض',
            'دائرة العرض',
            'دايرة العرض',
            'العرض',
            'الاحداثي الشمالي',
            'احداثي شمالي',
            'احداثي العرض',
            'latitude',
            'lat',
            'y_coord',
            'ycoord',
            'احداثي y',
            'احداثي ص',
            'northing',
            'north',
            'شمال',
            'شماليات',
            'y',
            'ص',
            'n',
          ],
          ['طول', 'long', 'lng', 'lon', 'east', 'شرق', 'س']
        );
      if (detectedLatCol) claimedCols.add(detectedLatCol);

      let detectedLngCol =
        mappingOverride?.lngCol ||
        findMatchingColumnKey(
          headers,
          [
            'خط الطول',
            'خط طول',
            'الطول',
            'الاحداثي الشرقي',
            'احداثي شرقي',
            'احداثي الطول',
            'longitude',
            'long',
            'lng',
            'lon',
            'x_coord',
            'xcoord',
            'احداثي x',
            'احداثي س',
            'easting',
            'east',
            'شرق',
            'شرقيات',
            'x',
            'س',
            'e',
          ],
          ['عرض', 'lat', 'north', 'شمال', 'ص'],
          claimedCols
        );
      if (detectedLngCol) claimedCols.add(detectedLngCol);

      let detectedCombinedCol =
        mappingOverride?.combinedCol ||
        findMatchingColumnKey(
          headers,
          [
            'الاحداثيات',
            'احداثيات',
            'الموقع الجغرافي',
            'احداثيات الموقع',
            'coordinates',
            'coordinate',
            'coords',
            'location',
            'gps',
            'رابط الخريطة',
            'رابط الموقع',
            'google maps',
            'map link',
            'maps',
            'url',
            'link',
          ],
          [],
          claimedCols
        );
      if (detectedCombinedCol) claimedCols.add(detectedCombinedCol);

      // Data-driven fallback if either Lat or Lng header wasn't matched (and no combined col found)
      if ((!detectedLatCol || !detectedLngCol) && !detectedCombinedCol) {
        const inferred = inferCoordinateColumnsFromData(headers, rawRows, claimedCols);
        if (inferred.combinedCol && !detectedLatCol && !detectedLngCol) {
          detectedCombinedCol = inferred.combinedCol;
          claimedCols.add(detectedCombinedCol);
        } else {
          if (!detectedLatCol && inferred.latCol && inferred.latCol !== detectedLngCol) {
            detectedLatCol = inferred.latCol;
            claimedCols.add(detectedLatCol);
          }
          if (!detectedLngCol && inferred.lngCol && inferred.lngCol !== detectedLatCol) {
            detectedLngCol = inferred.lngCol;
            claimedCols.add(detectedLngCol);
          }
        }
      }

      // Tiered detection for station name column:
      // 1) Explicit override, 2) Specific station-name headers (never blocked by compound words like شارع/كود/محافظة),
      // 3) Broader label headers, 4) Data-driven inference so real table names are always copied verbatim.
      const detectedNameCol =
        mappingOverride?.nameCol ||
        findMatchingColumnKey(
          headers,
          [
            'اسم المحطة بالكامل',
            'اسم المحطة',
            'اسم محطة',
            'اسماء المحطات',
            'أسماء المحطات',
            'مسمى المحطة',
            'مسمى محطة',
            'بيان المحطة',
            'عنوان واسم المحطة',
            'اسم المركز',
            'اسم الموقع',
            'اسم الفرع',
            'اسم المنفذ',
            'station_name',
            'station name',
            'site_name',
            'site name',
            'branch_name',
            'branch name',
            'facility_name',
            'facility name',
          ],
          ['بريد', 'email', 'صوره', 'شعار', 'logo', 'رابط', 'url', 'link'],
          claimedCols
        ) ||
        findMatchingColumnKey(
          headers,
          [
            'المحطة',
            'المحطات',
            'الفرع',
            'المنفذ',
            'البيان',
            'بيان',
            'مسمى',
            'المسمى',
            'اسم الجهة',
            'الوصف',
            'اسم',
            'station',
            'branch',
            'outlet',
            'facility',
            'site',
            'name',
            'title',
            'label',
          ],
          [
            'شركه',
            'company',
            'brand',
            'محافظه',
            'governorate',
            'gov',
            'province',
            'مدينه',
            'city',
            'شارع',
            'street',
            'عنوان',
            'address',
            'هاتف',
            'تليفون',
            'موبايل',
            'phone',
            'tel',
            'mobile',
            'كود',
            'code',
            'مسلسل',
            'serial',
            'رقم',
            'id',
            'ملاحظ',
            'note',
            'بريد',
            'email',
            'ساعات',
            'مواعيد',
            'hours',
            'تاريخ',
            'date',
            'رابط',
            'url',
            'link',
            'صوره',
            'شعار',
            'logo',
            'احداثي',
            'coord',
            'lat',
            'lng',
            'lon',
            'عرض',
            'طول',
          ],
          claimedCols
        ) ||
        inferNameColumnFromData(headers, rawRows, claimedCols);
      if (detectedNameCol) claimedCols.add(detectedNameCol);

      const detectedGovCol =
        mappingOverride?.govCol ||
        findMatchingColumnKey(
          headers,
          ['المحافظة', 'محافظة', 'اسم المحافظة', 'governorate', 'gov', 'province', 'الاقليم', 'المنطقة الادارية'],
          ['محطه'],
          claimedCols
        );

      const detectedCityCol =
        mappingOverride?.cityCol ||
        findMatchingColumnKey(
          headers,
          ['المدينة', 'مدينة', 'الحي', 'حي', 'المنطقة', 'منطقة', 'المركز', 'مركز', 'قسم', 'city', 'district', 'area'],
          ['محافظه'],
          claimedCols
        );

      const detectedAddressCol =
        mappingOverride?.addressCol ||
        findMatchingColumnKey(
          headers,
          ['العنوان', 'عنوان', 'العنوان بالتفصيل', 'عنوان المحطة', 'address', 'location_desc', 'street'],
          ['الكتروني', 'بريد', 'email'],
          claimedCols
        );

      rawRows.forEach((row, index) => {
        const rowNum = index + headerRowNumber + 1;

        const getVal = (candidates: string[], excludeWords: string[] = []): any => {
          const matchedKey = findMatchingColumnKey(Object.keys(row), candidates, excludeWords);
          if (!matchedKey) return undefined;
          const val = row[matchedKey];
          return val !== undefined && val !== null && String(val).trim() !== '' ? val : undefined;
        };

        // 1. Extract Coordinates (Check for combined pair in Lat/Lng cells FIRST to prevent lat===lng!)
        const rawLat = detectedLatCol ? row[detectedLatCol] : undefined;
        const rawLng = detectedLngCol ? row[detectedLngCol] : undefined;

        let lat = NaN;
        let lng = NaN;

        const pairInLat = extractCoordsPair(rawLat);
        const pairInLng = extractCoordsPair(rawLng);
        if (pairInLat) {
          lat = pairInLat.lat;
          lng = pairInLat.lng;
        } else if (pairInLng) {
          lat = pairInLng.lat;
          lng = pairInLng.lng;
        } else {
          lat = parseCoordinate(rawLat);
          lng = parseCoordinate(rawLng);
        }

        if (isNaN(lat) || isNaN(lng) || Math.abs(lat - lng) < 0.0005) {
          const combinedVal = detectedCombinedCol ? row[detectedCombinedCol] : undefined;
          const pair = extractCoordsPair(combinedVal);
          if (pair) {
            lat = pair.lat;
            lng = pair.lng;
          } else if (isNaN(lat) || isNaN(lng)) {
            // Fallback: scan every cell in row for a Google Maps URL or combined "lat, lng" string
            for (const key of Object.keys(row)) {
              const cellPair = extractCoordsPair(row[key]);
              if (cellPair) {
                lat = cellPair.lat;
                lng = cellPair.lng;
                break;
              }
            }
          }
        }

        if (isNaN(lat) || isNaN(lng)) {
          errors.push(`السطر ${rowNum}: إحداثيات غير صحيحة أو مفقودة (العرض: ${rawLat ?? 'فارغ'}, الطول: ${rawLng ?? 'فارغ'})`);
          return;
        }

        const rowText = JSON.stringify(row);

        // 2. Check for UTM metric coordinates (e.g., Easting 150k-850k, Northing 2.4M-3.6M)
        if (lat > 100000 || lng > 100000) {
          let easting = NaN;
          let northing = NaN;
          if (lng >= 100000 && lng <= 900000 && lat >= 2300000 && lat <= 3700000) {
            easting = lng;
            northing = lat;
          } else if (lat >= 100000 && lat <= 900000 && lng >= 2300000 && lng <= 3700000) {
            easting = lat;
            northing = lng;
          }

          if (!isNaN(easting) && !isNaN(northing)) {
            const lowerRow = rowText.toLowerCase();
            const isZone35 =
              lowerRow.includes('مطروح') ||
              lowerRow.includes('سيوة') ||
              lowerRow.includes('السلوم') ||
              lowerRow.includes('علمين');
            const converted = utmToLatLng(easting, northing, isZone35 ? 35 : 36);
            lat = Number(converted.lat.toFixed(6));
            lng = Number(converted.lng.toFixed(6));
            utmConvertedCount++;
          }
        }

        // 3. Egypt lat/lng swap correction
        const swapRes = fixEgyptLatLngSwap(lat, lng, rowText);
        lat = swapRes.lat;
        lng = swapRes.lng;
        if (swapRes.swapped) swappedCount++;

        // 4. Global Egypt sanity bounds check
        if (lat < 20.5 || lat > 32.5 || lng < 24.0 || lng > 37.5) {
          errors.push(`السطر ${rowNum}: إحداثيات خارج النطاق الجغرافي لمصر (${lat}, ${lng})`);
          return;
        }

        const fallbackCompany = (parseOptions?.defaultCompany || '').trim() || 'كارجاس';
        const rawCompanyFromFile = getVal([
          'الشركة',
          'الشركه',
          'اسم الشركة',
          'اسم الشركه',
          'شركة',
          'شركه',
          'الجهة',
          'company',
          'brand',
          'operator',
        ]);
        const stationCompany =
          parseOptions?.overrideCompany && parseOptions?.defaultCompany?.trim()
            ? parseOptions.defaultCompany.trim()
            : rawCompanyFromFile !== undefined && String(rawCompanyFromFile).trim()
              ? String(rawCompanyFromFile).trim()
              : fallbackCompany;

        // 5. Preserve exact station name verbatim as it appears in the table (no prefix/suffix/modification)
        const rawName = detectedNameCol ? row[detectedNameCol] : undefined;
        const verbatimName =
          rawName !== undefined && rawName !== null
            ? String(rawName).replace(/\r?\n+/g, ' ').trim()
            : '';
        if (!verbatimName) {
          syntheticNameCount++;
        }
        const stationName = verbatimName !== '' ? verbatimName : `محطة ${stationCompany} ${index + 1}`;

        // 6. Metadata fields
        const rawGov = (detectedGovCol ? row[detectedGovCol] : undefined) || 'القاهرة';
        const rawCity = (detectedCityCol ? row[detectedCityCol] : undefined) || '';
        const rawAddress =
          (detectedAddressCol ? row[detectedAddressCol] : undefined) ||
          `${rawGov}${rawCity ? ` - ${rawCity}` : ''}`;

        const rawPhone =
          getVal(['الهاتف', 'تليفون', 'الموبايل', 'الخط الساخن', 'رقم الهاتف', 'phone', 'tel', 'mobile']) || '19617';

        const rawHours =
          getVal(['مواعيد العمل', 'ساعات العمل', 'المواعيد', 'أوقات العمل', 'hours', 'time']) || '24 ساعة';

        const rawNotes =
          getVal(['ملاحظات', 'ملاحظة', 'ملاحظه', 'notes', 'desc', 'description']) || '';

        const parseBool = (val: any): boolean => {
          if (val === undefined || val === null || val === '') return false;
          const str = String(val).trim().toLowerCase();
          return (
            str === 'نعم' ||
            str === 'صحيح' ||
            str === 'يوجد' ||
            str === 'متاح' ||
            str === 'ن' ||
            str === 'مفعل' ||
            str === 'true' ||
            str === '1' ||
            str === 'yes' ||
            str === 'y' ||
            str === '✓' ||
            str === '✔'
          );
        };

        const hasConversion = parseBool(
          getVal(['مركز تحويل', 'تحويل وصيانة', 'تحويل و صيانة', 'تحويل', 'conversion', 'conversion_center'])
        );
        const hasLube = parseBool(
          getVal(['مركز زيوت', 'زيوت متخصص', 'غيار زيوت', 'مركز الزيوت', 'lube', 'lube_center'])
        );
        const hasCanopy = parseBool(
          getVal(['زيوت أسفل المظلة', 'زيوت اسفل المظلة', 'مظلة', 'مظله', 'زيوت مظلة', 'canopy_oil', 'canopy'])
        );
        const hasCylinder = parseBool(
          getVal(['فحص أسطوانات', 'فحص اسطوانات', 'اختبار أسطوانات', 'اختبار اسطوانات', 'cylinder_testing', 'cylinder'])
        );
        const hasFast = parseBool(
          getVal(['خدمات سريعة', 'سوبرماركت', 'كافيه', 'كافيتريا', 'fast_service', 'services'])
        );

        stations.push({
          id: `station-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
          name: stationName,
          stationName,
          company: stationCompany,
          governorate: String(rawGov).trim() || 'القاهرة',
          city: String(rawCity).trim(),
          address: String(rawAddress).trim(),
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          phone: String(rawPhone).trim(),
          operatingHours: String(rawHours).trim(),
          notes: String(rawNotes).trim(),
          services: {
            hasConversionCenter: hasConversion,
            hasLubeCenter: hasLube,
            hasCanopyOil: hasCanopy,
            hasCylinderTesting: hasCylinder,
            hasFastService: hasFast,
          },
        });
      });

      const uniqueCoords = new Set(stations.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));
      const govs = new Set(stations.map((s) => s.governorate).filter(Boolean));
      const collapsedIntegerCount = stations.filter(
        (s) => Math.abs(s.lat - Math.round(s.lat)) < 0.0001 || Math.abs(s.lng - Math.round(s.lng)) < 0.0001
      ).length;
      const geomIssue = detectCoordinateGeometryIssue(stations);
      const lats = stations.map((s) => s.lat);
      const lngs = stations.map((s) => s.lng);

      return {
        success: stations.length > 0,
        stations,
        errors,
        totalRows,
        validRows: stations.length,
        headers,
        sampleRows,
        diagnostics: {
          uniqueCoordCount: uniqueCoords.size,
          governoratesCount: govs.size,
          swappedCount,
          utmConvertedCount,
          collapsedIntegerCount,
          syntheticNameCount,
          isDiagonalLine: geomIssue.isDiagonalLine,
          diagonalReason: geomIssue.reason,
          headerRowNumber,
          latRange: lats.length > 0 ? [Math.min(...lats), Math.max(...lats)] : undefined,
          lngRange: lngs.length > 0 ? [Math.min(...lngs), Math.max(...lngs)] : undefined,
          detectedColumns: {
            nameCol: detectedNameCol,
            latCol: detectedLatCol,
            lngCol: detectedLngCol,
            combinedCol: detectedCombinedCol,
            govCol: detectedGovCol,
          },
        },
      };
    } catch (e: any) {
      return {
        success: false,
        stations: [],
        errors: [`حدث خطأ أثناء قراءة الملف: ${e?.message || 'تنسيق الملف غير مدعوم'}`],
        totalRows,
        validRows: 0,
        headers,
        sampleRows,
        diagnostics: {
          uniqueCoordCount: 0,
          governoratesCount: 0,
          swappedCount: 0,
          utmConvertedCount: 0,
          collapsedIntegerCount: 0,
          syntheticNameCount: 0,
          isDiagonalLine: false,
          headerRowNumber: 1,
          detectedColumns: {},
        },
      };
    }
  }

  static downloadSampleTemplate(companyName?: string): void {
    const comp = (companyName || '').trim() || 'كارجاس';
    const secondComp = comp === 'كارجاس' ? 'غازتك' : comp;
    const templateData = [
      {
        'اسم المحطة': `${comp} - التجمع الخامس`,
        'الشركة': comp,
        'المحافظة': 'القاهرة',
        'المدينة': 'التجمع الخامس',
        'العنوان': 'شارع التسعين الجنوبي بجوار الجامعة الأمريكية',
        'خط العرض': 30.0124,
        'خط الطول': 31.4398,
        'الهاتف': '19617',
        'مواعيد العمل': '24 ساعة',
        'مركز تحويل': 'نعم',
        'مركز زيوت': 'نعم',
        'زيوت أسفل المظلة': 'نعم',
        'فحص أسطوانات': 'نعم',
        'خدمات سريعة': 'نعم',
        'ملاحظات': 'محطة متكاملة تموين وفحص زيوت وتحويل',
      },
      {
        'اسم المحطة': `${secondComp} - المعادي كورنيش النيل`,
        'الشركة': secondComp,
        'المحافظة': 'القاهرة',
        'المدينة': 'المعادي',
        'العنوان': 'كورنيش النيل أمام مستشفى القوات المسلحة',
        'خط العرض': 29.9612,
        'خط الطول': 31.2584,
        'الهاتف': '19617',
        'مواعيد العمل': '24 ساعة',
        'مركز تحويل': 'لا',
        'مركز زيوت': 'نعم',
        'زيوت أسفل المظلة': 'نعم',
        'فحص أسطوانات': 'لا',
        'خدمات سريعة': 'نعم',
        'ملاحظات': 'تموين سيارات ومركز زيوت',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'محطات الغاز');
    XLSX.writeFile(workbook, 'نموذج_احداثيات_محطات_الغاز.xlsx');
  }

  static async parseStationFile(
    file: File,
    mappingOverride?: ColumnMappingOverride,
    parseOptions?: ParseOptions
  ): Promise<ParseResult> {
    const fileName = (file.name || '').toLowerCase();
    if (fileName.endsWith('.kmz') || fileName.endsWith('.kml')) {
      return this.parseKmzOrKml(file, parseOptions);
    }
    return this.parseExcelOrCsv(file, mappingOverride, parseOptions);
  }

  static async parseKmzOrKml(file: File, parseOptions?: ParseOptions): Promise<ParseResult> {
    const errors: string[] = [];
    const stations: Station[] = [];
    let swappedCount = 0;
    let syntheticNameCount = 0;

    try {
      const buffer = await file.arrayBuffer();
      const fileName = (file.name || '').toLowerCase();
      let kmlText = '';

      if (fileName.endsWith('.kmz')) {
        const zip = await JSZip.loadAsync(buffer);
        const kmlEntries = Object.keys(zip.files).filter(
          (name) => !zip.files[name].dir && name.toLowerCase().endsWith('.kml')
        );
        if (kmlEntries.length === 0) {
          throw new Error('ملف KMZ لا يحتوي على أي ملف KML بالداخل');
        }
        const preferred =
          kmlEntries.find((n) => n.toLowerCase().endsWith('doc.kml')) || kmlEntries[0];
        kmlText = await zip.files[preferred].async('string');
      } else {
        kmlText = new TextDecoder('utf-8').decode(buffer);
      }

      const placemarks: Array<{
        name: string;
        description: string;
        coordsText: string;
        folderName: string;
        extended: Record<string, string>;
      }> = [];

      if (typeof DOMParser !== 'undefined') {
        const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
        const nodes = Array.from(xmlDoc.getElementsByTagName('Placemark'));
        for (const node of nodes) {
          const nameNode = node.getElementsByTagName('name')[0];
          const descNode = node.getElementsByTagName('description')[0];
          const coordNode = node.getElementsByTagName('coordinates')[0];
          let folderName = '';
          let parent: Element | null = node.parentElement;
          while (parent) {
            if (parent.tagName === 'Folder') {
              const fn = parent.getElementsByTagName('name')[0]?.textContent?.trim();
              if (fn) {
                folderName = fn;
                break;
              }
            }
            parent = parent.parentElement;
          }
          const extended: Record<string, string> = {};

          const dataNodes = Array.from(node.getElementsByTagName('Data'));
          for (const d of dataNodes) {
            const key = d.getAttribute('name') || '';
            const val = d.getElementsByTagName('value')[0]?.textContent?.trim() || '';
            if (key && val) extended[key] = val;
          }
          const simpleNodes = Array.from(node.getElementsByTagName('SimpleData'));
          for (const s of simpleNodes) {
            const key = s.getAttribute('name') || '';
            const val = s.textContent?.trim() || '';
            if (key && val) extended[key] = val;
          }

          placemarks.push({
            name: (nameNode?.textContent || '').replace(/\r?\n+/g, ' ').trim(),
            description: (descNode?.textContent || '').replace(/<[^>]+>/g, ' ').trim(),
            coordsText: (coordNode?.textContent || '').trim(),
            folderName,
            extended,
          });
        }
      } else {
        const placemarkRegex = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
        let match: RegExpExecArray | null;
        while ((match = placemarkRegex.exec(kmlText)) !== null) {
          const block = match[1];
          const extractTag = (tag: string) => {
            const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
          };
          placemarks.push({
            name: extractTag('name').replace(/\r?\n+/g, ' ').trim(),
            description: extractTag('description').replace(/<[^>]+>/g, ' ').trim(),
            coordsText: extractTag('coordinates'),
            folderName: '',
            extended: {},
          });
        }
      }

      const fallbackCompany = (parseOptions?.defaultCompany || '').trim() || 'كارجاس';
      const detectKnownCompany = (txt: string): string | undefined => {
        if (/غاز\s*تك|gastec/i.test(txt)) return 'غازتك';
        if (/ماستر\s*غاز|master\s*gas/i.test(txt)) return 'ماستر غاز';
        if (/طاقة\s*عربية|طاقه\s*عربيه|طاقة\s*غاز|taqa/i.test(txt)) return 'طاقة عربية';
        if (/كارجاس|cargas/i.test(txt)) return 'كارجاس';
        return undefined;
      };

      placemarks.forEach((pm, index) => {
        const firstCoordTuple = pm.coordsText.split(/\s+/).find((t) => t.includes(',')) || '';
        const parts = firstCoordTuple.split(',').map((p) => parseCoordinate(p.trim()));
        // Standard KML coordinates order is: longitude,latitude[,altitude]
        let lng = parts[0];
        let lat = parts[1];

        if (isNaN(lat) || isNaN(lng)) {
          errors.push(`المعلم ${index + 1} (${pm.name || 'بدون اسم'}): إحداثيات KML غير صالحة`);
          return;
        }

        const contextText = `${pm.name} ${pm.description} ${pm.folderName} ${JSON.stringify(pm.extended)}`;
        const swapRes = fixEgyptLatLngSwap(lat, lng, contextText);
        lat = swapRes.lat;
        lng = swapRes.lng;
        if (swapRes.swapped) swappedCount++;

        if (lat < 20.5 || lat > 32.5 || lng < 24.0 || lng > 37.5) {
          errors.push(`المعلم ${index + 1} (${pm.name || 'بدون اسم'}): خارج نطاق مصر (${lat}, ${lng})`);
          return;
        }

        const extendedCompany =
          pm.extended['الشركة'] ||
          pm.extended['الشركه'] ||
          pm.extended['شركة'] ||
          pm.extended['company'] ||
          pm.extended['brand'] ||
          pm.extended['operator'];
        const stationCompany =
          parseOptions?.overrideCompany && parseOptions?.defaultCompany?.trim()
            ? parseOptions.defaultCompany.trim()
            : extendedCompany?.trim() ||
              parseOptions?.defaultCompany?.trim() ||
              detectKnownCompany(`${pm.folderName} ${pm.name}`) ||
              fallbackCompany;

        const verbatimName = pm.name || pm.extended['اسم المحطة'] || pm.extended['stationName'] || '';
        if (!verbatimName) syntheticNameCount++;
        const stationName = verbatimName || `محطة ${stationCompany} ${index + 1}`;

        const governorate =
          pm.extended['المحافظة'] ||
          pm.extended['governorate'] ||
          pm.extended['gov'] ||
          'القاهرة';
        const city = pm.extended['المدينة'] || pm.extended['city'] || '';
        const address =
          pm.extended['العنوان'] ||
          pm.extended['address'] ||
          pm.description ||
          `${governorate}${city ? ` - ${city}` : ''}`;

        stations.push({
          id: `kmz-station-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
          name: stationName,
          stationName,
          company: stationCompany,
          governorate,
          city,
          address,
          lat,
          lng,
          latitude: lat,
          longitude: lng,
          phone: pm.extended['الهاتف'] || pm.extended['phone'] || '19617',
          operatingHours: pm.extended['مواعيد العمل'] || pm.extended['hours'] || '24 ساعة',
          notes: pm.description || '',
          services: {
            hasConversionCenter: /تحويل|conversion/i.test(contextText),
            hasLubeCenter: /زيوت|lube/i.test(contextText),
            hasCanopyOil: /مظلة|canopy/i.test(contextText),
            hasCylinderTesting: /فحص|اسطوانات|أسطوانات|cylinder/i.test(contextText),
            hasFastService: true,
          },
        });
      });

      const uniqueCoords = new Set(stations.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));
      const govs = new Set(stations.map((s) => s.governorate).filter(Boolean));
      const geomIssue = detectCoordinateGeometryIssue(stations);
      const lats = stations.map((s) => s.lat);
      const lngs = stations.map((s) => s.lng);

      return {
        success: stations.length > 0,
        stations,
        errors,
        totalRows: placemarks.length,
        validRows: stations.length,
        headers: ['name', 'company', 'governorate', 'lat', 'lng', 'address'],
        sampleRows: stations.slice(0, 5),
        diagnostics: {
          uniqueCoordCount: uniqueCoords.size,
          governoratesCount: govs.size,
          swappedCount,
          utmConvertedCount: 0,
          collapsedIntegerCount: 0,
          syntheticNameCount,
          isDiagonalLine: geomIssue.isDiagonalLine,
          diagonalReason: geomIssue.reason,
          headerRowNumber: 1,
          latRange: lats.length > 0 ? [Math.min(...lats), Math.max(...lats)] : undefined,
          lngRange: lngs.length > 0 ? [Math.min(...lngs), Math.max(...lngs)] : undefined,
          detectedColumns: {
            nameCol: 'KML <name>',
            latCol: 'KML latitude',
            lngCol: 'KML longitude',
            govCol: 'KML governorate',
          },
        },
      };
    } catch (e: any) {
      return {
        success: false,
        stations: [],
        errors: [`تعذر قراءة ملف KMZ/KML: ${e?.message || 'صيغة غير صالحة'}`],
        totalRows: 0,
        validRows: 0,
        headers: [],
        sampleRows: [],
        diagnostics: {
          uniqueCoordCount: 0,
          governoratesCount: 0,
          swappedCount: 0,
          utmConvertedCount: 0,
          collapsedIntegerCount: 0,
          syntheticNameCount: 0,
          isDiagonalLine: false,
          headerRowNumber: 1,
          detectedColumns: {},
        },
      };
    }
  }
}
