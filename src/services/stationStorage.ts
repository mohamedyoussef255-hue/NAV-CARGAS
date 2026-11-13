import { Station, ThemeMode } from '../types';
import { DEFAULT_STATIONS } from '../data/defaultStations';
import {
  detectCoordinateGeometryIssue,
  fixEgyptLatLngSwap,
  parseCoordinate,
} from './excelParser';
import { StationDb } from './stationDb';
import {
  BAKED_APP_LOGO,
  BAKED_STATION_LOGO,
  DEFAULT_CARGAS_LOGO_DATA_URL,
  generateLogoSourceCode,
} from '../assets/cargasLogo';

const STORAGE_KEY_STATIONS = 'cargas_stations_list_v1';
const STORAGE_KEY_STATIONS_CLEARED = 'cargas_stations_cleared_v1';
const STORAGE_KEY_STATIONS_UPDATED_AT = 'cargas_stations_updated_at_v1';
const STORAGE_KEY_BUNDLED_SIG = 'cargas_bundled_sig_v1';
const STORAGE_KEY_APP_LOGO = 'cargas_app_logo_v2';
const STORAGE_KEY_STATION_LOGO = 'cargas_station_logo_v2';
const STORAGE_KEY_THEME = 'cargas_theme_mode_v1';

const META_KEY_SEEDED = 'stations_seeded_v1';
const META_KEY_CLEARED = 'stations_cleared_v1';
const META_KEY_UPDATED_AT = 'stations_updated_at_v1';
const META_KEY_BUNDLED_SIG = 'bundled_sig_v1';

const STATIONS_UPDATED_EVENT = 'cargas:stations:updated';
const THEME_CHANGED_EVENT = 'cargas:theme:changed';
const APP_LOGO_CHANGED_EVENT = 'cargas:app-logo:changed';
const STATION_LOGO_CHANGED_EVENT = 'cargas:station-logo:changed';

function isDevEnvironment(): boolean {
  return Boolean(import.meta.env.DEV);
}

function dispatchSafe(eventName: string, detail: unknown): void {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

function computeStationsSignature(list: Station[]): string {
  if (!list || list.length === 0) return '0';
  const first = list[0];
  const last = list[list.length - 1];
  const mid = list[Math.floor(list.length / 2)];
  return [
    list.length,
    first?.id,
    first?.name,
    first?.lat,
    first?.lng,
    mid?.id,
    mid?.lat,
    last?.id,
    last?.name,
    last?.lat,
    last?.lng,
  ].join('|');
}

export class StationStorage {
  private static memoryStations: Station[] | null = null;
  private static idbWriteQueue: Promise<unknown> = Promise.resolve();

  private static enqueueIdbWrite(task: () => Promise<void>): void {
    this.idbWriteQueue = this.idbWriteQueue
      .then(() => task())
      .catch((err) => {
        console.warn('IndexedDB write failed cleanly:', err);
      });
  }

  static normalizeStation(raw: Station, fallbackIndex = 0): Station {
    const rawName = raw?.name ?? raw?.stationName ?? '';
    const rawStationName = raw?.stationName ?? raw?.name ?? '';
    const stationName = String(rawStationName || rawName || `محطة كارجاس #${fallbackIndex + 1}`);
    const name = String(rawName || stationName);

    const parsedLat = parseCoordinate(raw?.lat ?? raw?.latitude);
    const parsedLng = parseCoordinate(raw?.lng ?? raw?.longitude);

    const governorate = raw?.governorate !== undefined && raw?.governorate !== null ? String(raw.governorate) : '';
    const city = raw?.city !== undefined && raw?.city !== null ? String(raw.city) : '';
    const address = raw?.address !== undefined && raw?.address !== null ? String(raw.address) : '';
    const company = raw?.company ? String(raw.company) : 'كارجاس';
    const phone = raw?.phone !== undefined && raw?.phone !== null ? String(raw.phone) : '';
    const operatingHours =
      raw?.operatingHours !== undefined && raw?.operatingHours !== null ? String(raw.operatingHours) : '';

    const contextText = `${governorate} ${address} ${city} ${name}`;
    let finalLat = parsedLat;
    let finalLng = parsedLng;
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      const swapRes = fixEgyptLatLngSwap(parsedLat, parsedLng, contextText);
      finalLat = swapRes.lat;
      finalLng = swapRes.lng;
    }

    const rawId = raw?.id !== undefined && raw?.id !== null ? String(raw.id).trim() : '';
    const id = rawId || `st-${Date.now()}-${fallbackIndex}-${Math.random().toString(36).slice(2, 6)}`;

    const svc = raw?.services || ({} as Station['services']);

    return {
      ...raw,
      id,
      name,
      stationName,
      company,
      lat: finalLat,
      lng: finalLng,
      latitude: finalLat,
      longitude: finalLng,
      governorate,
      city,
      address,
      phone,
      operatingHours,
      services: {
        hasConversionCenter: Boolean(svc.hasConversionCenter),
        hasLubeCenter: Boolean(svc.hasLubeCenter),
        hasCanopyOil: Boolean(svc.hasCanopyOil),
        hasCylinderTesting: Boolean(svc.hasCylinderTesting),
        hasFastService: Boolean(svc.hasFastService),
      },
    };
  }

  private static ensureUniqueIds(stations: Station[]): { list: Station[]; deduped: boolean } {
    const seen = new Set<string>();
    let deduped = false;
    const list = stations.map((s, idx) => {
      let id = s.id ? String(s.id).trim() : `st-${Date.now()}-${idx}`;
      if (seen.has(id)) {
        deduped = true;
        id = `${id}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
      }
      seen.add(id);
      return id === s.id ? s : { ...s, id };
    });
    return { list, deduped };
  }

  // Auto-seed default stations into IndexedDB on very first app load & hydrate memory cache
  static async initializeOfflineStorage(): Promise<Station[]> {
    const bundledSignature = computeStationsSignature(DEFAULT_STATIONS);
    const isDev = isDevEnvironment();

    try {
      await this.idbWriteQueue;
      const [idbStationsRaw, idbSeeded, idbCleared, idbUpdatedAt, idbBundledSig] = await Promise.all([
        StationDb.getAllStations(),
        StationDb.getMeta<boolean>(META_KEY_SEEDED),
        StationDb.getMeta<boolean>(META_KEY_CLEARED),
        StationDb.getMeta<number>(META_KEY_UPDATED_AT),
        StationDb.getMeta<string>(META_KEY_BUNDLED_SIG),
      ]);

      let lsCleared = false;
      let lsStations: Station[] | null = null;
      let lsUpdatedAt = 0;
      let lsBundledSig: string | null = null;
      try {
        lsCleared = localStorage.getItem(STORAGE_KEY_STATIONS_CLEARED) === 'true';
        lsUpdatedAt = Number(localStorage.getItem(STORAGE_KEY_STATIONS_UPDATED_AT) || '0');
        lsBundledSig = localStorage.getItem(STORAGE_KEY_BUNDLED_SIG);
        const stored = localStorage.getItem(STORAGE_KEY_STATIONS);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            lsStations = parsed;
          }
        }
      } catch {
        // ignore
      }

      // In production / APK builds, if the baked DEFAULT_STATIONS in source code changed
      // since the previous app install, refresh cached stations cleanly from source code!
      const storedBundledSig = idbBundledSig || lsBundledSig;
      if (!isDev && storedBundledSig !== bundledSignature && DEFAULT_STATIONS.length > 0) {
        const freshlyBaked = this.sanitizeAndFixStations([...DEFAULT_STATIONS]);
        this.memoryStations = freshlyBaked;
        const now = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(freshlyBaked));
          localStorage.setItem(STORAGE_KEY_STATIONS_CLEARED, 'false');
          localStorage.setItem(STORAGE_KEY_STATIONS_UPDATED_AT, String(now));
          localStorage.setItem(STORAGE_KEY_BUNDLED_SIG, bundledSignature);
        } catch {
          // ignore
        }
        this.enqueueIdbWrite(async () => {
          await StationDb.saveAllStations(freshlyBaked);
          await StationDb.setMeta(META_KEY_SEEDED, true);
          await StationDb.setMeta(META_KEY_CLEARED, false);
          await StationDb.setMeta(META_KEY_UPDATED_AT, now);
          await StationDb.setMeta(META_KEY_BUNDLED_SIG, bundledSignature);
        });
        dispatchSafe(STATIONS_UPDATED_EVENT, freshlyBaked);
        return freshlyBaked;
      }

      const idbStations = idbStationsRaw && idbStationsRaw.length > 0 ? idbStationsRaw : null;

      // Reconcile IndexedDB vs localStorage: keep whichever is explicitly newer, or non-empty larger dataset
      const preferLocalStorage =
        lsStations !== null &&
        lsStations.length > 0 &&
        (!idbStations ||
          lsUpdatedAt > (idbUpdatedAt || 0) ||
          (lsUpdatedAt === 0 && !idbUpdatedAt && lsStations.length > idbStations.length));

      const syncDevEditsToSourceIfNeeded = (loaded: Station[]) => {
        if (!isDev || typeof navigator === 'undefined' || !navigator.onLine) return;
        const loadedSig = computeStationsSignature(loaded);
        if (loaded.length > 0 && loadedSig !== bundledSignature) {
          void this.saveStationsToSourceCode(loaded);
        }
        try {
          const customAppLogo = localStorage.getItem(STORAGE_KEY_APP_LOGO);
          if (customAppLogo && customAppLogo !== BAKED_APP_LOGO) {
            void this.saveLogoToSourceCode(customAppLogo, 'app');
          }
          const customStationLogo = localStorage.getItem(STORAGE_KEY_STATION_LOGO);
          if (customStationLogo && customStationLogo !== BAKED_STATION_LOGO) {
            void this.saveLogoToSourceCode(customStationLogo, 'station');
          }
        } catch {
          // ignore
        }
      };

      if (preferLocalStorage && lsStations) {
        const sanitized = this.sanitizeAndFixStations(lsStations);
        this.memoryStations = sanitized;
        const syncTs = Math.max(lsUpdatedAt || 0, Date.now());
        this.enqueueIdbWrite(async () => {
          await StationDb.saveAllStations(sanitized);
          await StationDb.setMeta(META_KEY_SEEDED, true);
          await StationDb.setMeta(META_KEY_CLEARED, false);
          await StationDb.setMeta(META_KEY_UPDATED_AT, syncTs);
          await StationDb.setMeta(META_KEY_BUNDLED_SIG, bundledSignature);
        });
        syncDevEditsToSourceIfNeeded(sanitized);
        dispatchSafe(STATIONS_UPDATED_EVENT, sanitized);
        return sanitized;
      }

      if (idbStations && idbStations.length > 0) {
        const sanitized = this.sanitizeAndFixStations(idbStations);
        this.memoryStations = sanitized;
        try {
          localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(sanitized));
          localStorage.setItem(STORAGE_KEY_STATIONS_CLEARED, 'false');
          localStorage.setItem(STORAGE_KEY_BUNDLED_SIG, bundledSignature);
          if (idbUpdatedAt) {
            localStorage.setItem(STORAGE_KEY_STATIONS_UPDATED_AT, String(idbUpdatedAt));
          }
        } catch {
          // ignore
        }
        syncDevEditsToSourceIfNeeded(sanitized);
        dispatchSafe(STATIONS_UPDATED_EVENT, sanitized);
        return sanitized;
      }

      if (idbCleared || lsCleared) {
        this.memoryStations = [];
        dispatchSafe(STATIONS_UPDATED_EVENT, []);
        return [];
      }

      // Very first load (or empty unseeded DB): automatically seed bundled DEFAULT_STATIONS into IndexedDB + localStorage
      if (!idbSeeded || (idbStationsRaw && idbStationsRaw.length === 0)) {
        const seeded = this.sanitizeAndFixStations([...DEFAULT_STATIONS]);
        this.memoryStations = seeded;
        const now = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(seeded));
          localStorage.setItem(STORAGE_KEY_STATIONS_UPDATED_AT, String(now));
          localStorage.setItem(STORAGE_KEY_BUNDLED_SIG, bundledSignature);
        } catch {
          // ignore
        }
        this.enqueueIdbWrite(async () => {
          await StationDb.saveAllStations(seeded);
          await StationDb.setMeta(META_KEY_SEEDED, true);
          await StationDb.setMeta(META_KEY_CLEARED, false);
          await StationDb.setMeta(META_KEY_UPDATED_AT, now);
          await StationDb.setMeta(META_KEY_BUNDLED_SIG, bundledSignature);
        });
        dispatchSafe(STATIONS_UPDATED_EVENT, seeded);
        return seeded;
      }
    } catch (e) {
      console.warn('Offline IndexedDB initialization fallback to localStorage:', e);
    }

    return this.getStations();
  }

  // Cleans and auto-fixes any stations with swapped/inverted coordinates or duplicate IDs
  static sanitizeAndFixStations(stations: Station[]): Station[] {
    let changed = false;
    const cleanedRaw = stations.map((raw, idx) => {
      const s = this.normalizeStation(raw, idx);
      if (
        s.lat !== raw.lat ||
        s.lng !== raw.lng ||
        s.id !== raw.id ||
        s.stationName !== raw.stationName
      ) {
        changed = true;
      }
      return s;
    });

    const { list: cleaned, deduped } = this.ensureUniqueIds(cleanedRaw);
    if (deduped) changed = true;

    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(cleaned));
      } catch {
        // ignore
      }
    }

    return cleaned;
  }

  // Detects if stored stations have collapsed/truncated/collinear diagonal coordinates
  static hasSuspiciousCoordinates(stations: Station[]): {
    suspicious: boolean;
    isDiagonalLine?: boolean;
    reason?: string;
  } {
    return detectCoordinateGeometryIssue(stations);
  }

  // Returns stations from memory cache, localStorage, or bundled default stations
  static getStations(): Station[] {
    if (this.memoryStations !== null) {
      return this.memoryStations;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_STATIONS);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const sanitized = this.sanitizeAndFixStations(parsed);
          this.memoryStations = sanitized;
          return sanitized;
        }
      }
    } catch (e) {
      console.error('Failed to read stations from localStorage', e);
    }
    const defaults = this.sanitizeAndFixStations([...DEFAULT_STATIONS]);
    this.memoryStations = defaults;
    return defaults;
  }

  // Persists stations to IndexedDB + localStorage and writes to source code src/data/defaultStations.ts when online/dev
  static saveStations(stations: Station[], options?: { cleared?: boolean }): void {
    const normalized = this.sanitizeAndFixStations(stations);
    this.memoryStations = normalized;
    const isCleared = Boolean(options?.cleared);
    const updatedAt = Date.now();
    const bundledSignature = computeStationsSignature(normalized);

    try {
      localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(normalized));
      localStorage.setItem(STORAGE_KEY_STATIONS_CLEARED, isCleared ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEY_STATIONS_UPDATED_AT, String(updatedAt));
      localStorage.setItem(STORAGE_KEY_BUNDLED_SIG, bundledSignature);
    } catch (e) {
      console.error('Failed to save stations to localStorage', e);
    }

    this.enqueueIdbWrite(async () => {
      await StationDb.saveAllStations(normalized);
      await StationDb.setMeta(META_KEY_SEEDED, true);
      await StationDb.setMeta(META_KEY_CLEARED, isCleared);
      await StationDb.setMeta(META_KEY_UPDATED_AT, updatedAt);
      await StationDb.setMeta(META_KEY_BUNDLED_SIG, bundledSignature);
    });

    dispatchSafe(STATIONS_UPDATED_EVENT, normalized);

    if (isDevEnvironment() && (typeof navigator === 'undefined' || navigator.onLine)) {
      void this.saveStationsToSourceCode(normalized);
    }
  }

  // Directly writes stations array into the source code file (src/data/defaultStations.ts) via API
  static async saveStationsToSourceCode(stations?: Station[]): Promise<{ success: boolean; count: number; message: string }> {
    const list = stations ?? this.getStations();
    try {
      const response = await fetch('/api/save-stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stations: list }),
      });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        count: list.length,
        message: data.message || `تم حفظ ${list.length} محطة في الكود المصدري بنجاح`,
      };
    } catch (e: any) {
      console.warn('Direct source code write via API failed:', e);
      return {
        success: false,
        count: list.length,
        message: e.message || 'تعذر الاتصال بخادم الحفظ التلقائي',
      };
    }
  }

  // Directly writes custom logo into the source code file (src/assets/cargasLogo.ts) via API
  static async saveLogoToSourceCode(logoDataUrl: string, type: 'app' | 'station' = 'app'): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/save-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoDataUrl, type }),
      });
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        message: data.message || 'تم حفظ الشعار في الكود المصدري بنجاح',
      };
    } catch (e: any) {
      console.warn('Direct logo save via API failed:', e);
      return {
        success: false,
        message: e.message || 'تعذر حفظ الشعار في الكود المصدري',
      };
    }
  }

  // Add a single station (normalizes coordinates & returns the stored Station)
  static addStation(station: Station): Station {
    const current = [...this.getStations()];
    const normalized = this.normalizeStation(station, 0);
    // Guarantee unique ID against existing list
    if (current.some((s) => s.id === normalized.id)) {
      normalized.id = `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
    current.unshift(normalized);
    this.saveStations(current);
    return this.getStations().find((s) => s.id === normalized.id) || normalized;
  }

  // Update a single station
  static updateStation(station: Station): Station {
    const current = [...this.getStations()];
    const normalized = this.normalizeStation(station);
    const index = current.findIndex((s) => s.id === normalized.id);
    if (index !== -1) {
      current[index] = normalized;
      this.saveStations(current);
    }
    return this.getStations().find((s) => s.id === normalized.id) || normalized;
  }

  // Delete a station
  static deleteStation(id: string): void {
    const current = this.getStations().filter((s) => s.id !== id);
    this.saveStations(current);
  }

  // Clear default demo data to prepare for real uploads
  static clearDefaultData(): void {
    this.saveStations([], { cleared: true });
  }

  // Restore bundled demo stations
  static restoreDefaultData(): void {
    this.saveStations([...DEFAULT_STATIONS], { cleared: false });
  }

  // Listen to station data changes
  static onStationsUpdated(callback: (stations: Station[]) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Station[]>;
      callback(customEvent.detail || this.getStations());
    };
    window.addEventListener(STATIONS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(STATIONS_UPDATED_EVENT, handler);
  }

  // ==========================================
  // 1. App Logo Handling (Header & UI)
  // ==========================================
  static getAppLogo(): string {
    if (isDevEnvironment()) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_APP_LOGO);
        if (stored) return stored;
      } catch {
        // ignore
      }
    }
    return BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
  }

  static saveAppLogo(logoDataUrl: string | null): void {
    try {
      if (logoDataUrl) {
        localStorage.setItem(STORAGE_KEY_APP_LOGO, logoDataUrl);
        if (isDevEnvironment()) {
          void this.saveLogoToSourceCode(logoDataUrl, 'app');
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_APP_LOGO);
        if (isDevEnvironment()) {
          void this.saveLogoToSourceCode('', 'app');
        }
      }
      dispatchSafe(APP_LOGO_CHANGED_EVENT, logoDataUrl || BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL);
    } catch (e) {
      console.error('Failed to save app logo', e);
    }
  }

  static onAppLogoUpdated(callback: (logoUrl: string | null) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      callback(customEvent.detail ?? this.getAppLogo());
    };
    window.addEventListener(APP_LOGO_CHANGED_EVENT, handler);
    return () => window.removeEventListener(APP_LOGO_CHANGED_EVENT, handler);
  }

  // ==========================================
  // 2. Station Map Pin Logo Handling (Pins & Station Cards)
  // ==========================================
  static getStationLogo(): string {
    if (isDevEnvironment()) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_STATION_LOGO);
        if (stored) return stored;
      } catch {
        // ignore
      }
    }
    return BAKED_STATION_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
  }

  static saveStationLogo(logoDataUrl: string | null): void {
    try {
      if (logoDataUrl) {
        localStorage.setItem(STORAGE_KEY_STATION_LOGO, logoDataUrl);
        if (isDevEnvironment()) {
          void this.saveLogoToSourceCode(logoDataUrl, 'station');
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_STATION_LOGO);
        if (isDevEnvironment()) {
          void this.saveLogoToSourceCode('', 'station');
        }
      }
      dispatchSafe(STATION_LOGO_CHANGED_EVENT, logoDataUrl || BAKED_STATION_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL);
    } catch (e) {
      console.error('Failed to save station logo', e);
    }
  }

  static async commitAllEditsToSourceCode(): Promise<{ success: boolean; count: number; message: string }> {
    const stations = this.getStations();
    const stationsRes = await this.saveStationsToSourceCode(stations);
    const appLogo = this.getAppLogo();
    const stationLogo = this.getStationLogo();
    await this.saveLogoToSourceCode(appLogo === DEFAULT_CARGAS_LOGO_DATA_URL ? '' : appLogo, 'app');
    await this.saveLogoToSourceCode(stationLogo === DEFAULT_CARGAS_LOGO_DATA_URL ? '' : stationLogo, 'station');
    return stationsRes;
  }

  static onStationLogoUpdated(callback: (logoUrl: string | null) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      callback(customEvent.detail ?? this.getStationLogo());
    };
    window.addEventListener(STATION_LOGO_CHANGED_EVENT, handler);
    return () => window.removeEventListener(STATION_LOGO_CHANGED_EVENT, handler);
  }

  // Backwards compatibility aliases
  static getCustomLogo(): string {
    return this.getAppLogo();
  }

  static saveCustomLogo(logoDataUrl: string | null): void {
    this.saveAppLogo(logoDataUrl);
  }

  static onLogoUpdated(callback: (logoUrl: string | null) => void): () => void {
    return this.onAppLogoUpdated(callback);
  }

  // Theme mode handling
  static getTheme(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_THEME);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // fallback
    }
    return 'dark';
  }

  static setTheme(theme: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
      window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: theme }));
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  }

  static toggleTheme(): ThemeMode {
    const next = this.getTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  static onThemeChanged(callback: (theme: ThemeMode) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      callback(customEvent.detail || this.getTheme());
    };
    window.addEventListener(THEME_CHANGED_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, handler);
  }

  // Generates complete TypeScript source code for defaultStations.ts
  static generateSourceCodeTypeScript(stations?: Station[]): string {
    const list = stations ?? this.getStations();
    return `// ============================================================
// ملف محطات كارجاس المحدث تلقائياً - محطات كارجاس (الأقرب لك دائماً)
// تم التصدير بتاريخ: ${new Date().toLocaleString('ar-EG')}
// إجمالي المحطات: ${list.length} محطة
// يمكن استبدال هذا الملف في مسار: src/data/defaultStations.ts
// ============================================================

import { Station } from '../types';

export const DEFAULT_STATIONS: Station[] = ${JSON.stringify(list, null, 2)};
export const DEFAULT_CARGAS_STATIONS = DEFAULT_STATIONS;
`;
  }

  // Generates complete TypeScript source code for cargasLogo.ts to commit directly to GitHub / Vercel
  static generateLogoSourceCode(): string {
    const appLogo = this.getAppLogo();
    const stationLogo = this.getStationLogo();
    return generateLogoSourceCode(appLogo, stationLogo);
  }
}
