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
  BAKED_APP_LOGO_ALT,
  BAKED_ACTIVE_APP_LOGO_SLOT,
  BAKED_STATION_LOGO,
  DEFAULT_CARGAS_LOGO_DATA_URL,
  generateLogoSourceCode,
} from '../assets/cargasLogo';
import { BAKED_COMPANY_LOGOS } from '../assets/companyLogos';
import { AppConfig } from '../config/appConfig';
import { AppConfigService } from './appConfigService';

const STORAGE_KEY_STATIONS = 'cargas_stations_list_v1';
const STORAGE_KEY_STATIONS_CLEARED = 'cargas_stations_cleared_v1';
const STORAGE_KEY_STATIONS_UPDATED_AT = 'cargas_stations_updated_at_v1';
const STORAGE_KEY_BUNDLED_SIG = 'cargas_bundled_sig_v1';
const STORAGE_KEY_USER_MODIFIED = 'cargas_stations_user_modified_v1';
const STORAGE_KEY_APP_LOGO = 'cargas_app_logo_v2';
const STORAGE_KEY_APP_LOGO_1 = 'cargas_app_logo_slot1_v1';
const STORAGE_KEY_APP_LOGO_2 = 'cargas_app_logo_slot2_v1';
const STORAGE_KEY_ACTIVE_APP_LOGO_SLOT = 'cargas_active_app_logo_slot_v1';
const STORAGE_KEY_BAKED_APP_LOGOS_SIG = 'cargas_baked_app_logos_sig_v1';
const STORAGE_KEY_APP_LOGOS_USER_MODIFIED = 'cargas_app_logos_user_modified_v1';
const STORAGE_KEY_STATION_LOGO = 'cargas_station_logo_v2';
const STORAGE_KEY_COMPANY_LOGOS = 'cargas_company_logos_v1';
const STORAGE_KEY_BAKED_COMPANY_LOGOS_SIG = 'cargas_baked_company_logos_sig_v1';
const STORAGE_KEY_COMPANY_LOGOS_USER_MODIFIED = 'cargas_company_logos_user_modified_v1';
const STORAGE_KEY_THEME = 'cargas_theme_mode_v1';

const META_KEY_SEEDED = 'stations_seeded_v1';
const META_KEY_CLEARED = 'stations_cleared_v1';
const META_KEY_UPDATED_AT = 'stations_updated_at_v1';
const META_KEY_BUNDLED_SIG = 'bundled_sig_v1';
const META_KEY_USER_MODIFIED = 'stations_user_modified_v1';
const META_KEY_APP_LOGO = 'app_logo_v2';
const META_KEY_APP_LOGO_1 = 'app_logo_slot1_v1';
const META_KEY_APP_LOGO_2 = 'app_logo_slot2_v1';
const META_KEY_ACTIVE_APP_LOGO_SLOT = 'active_app_logo_slot_v1';
const META_KEY_BAKED_APP_LOGOS_SIG = 'baked_app_logos_sig_v1';
const META_KEY_APP_LOGOS_USER_MODIFIED = 'app_logos_user_modified_v1';
const META_KEY_STATION_LOGO = 'station_logo_v2';
const META_KEY_COMPANY_LOGOS = 'company_logos_v1';
const META_KEY_BAKED_COMPANY_LOGOS_SIG = 'baked_company_logos_sig_v1';
const META_KEY_COMPANY_LOGOS_USER_MODIFIED = 'company_logos_user_modified_v1';

const BAKED_SLOT_1_SENTINEL = '__BAKED_APP_LOGO_1__';
const BAKED_SLOT_2_SENTINEL = '__BAKED_APP_LOGO_2__';

const STATIONS_UPDATED_EVENT = 'cargas:stations:updated';
const THEME_CHANGED_EVENT = 'cargas:theme:changed';
const APP_LOGO_CHANGED_EVENT = 'cargas:app-logo:changed';
const STATION_LOGO_CHANGED_EVENT = 'cargas:station-logo:changed';
const COMPANY_LOGOS_CHANGED_EVENT = 'cargas:company-logos:changed';

function isDevEnvironment(): boolean {
  return Boolean(import.meta.env.DEV);
}

function dispatchSafe(eventName: string, detail: unknown): void {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

function computeCompanyLogosSignature(logos: Record<string, string>): string {
  const keys = Object.keys(logos).sort();
  if (keys.length === 0) return '0';
  return keys.map((k) => `${k}:${logos[k]?.length || 0}:${logos[k]?.slice(0, 32) || ''}`).join('|');
}

function computeAppLogosSignature(logo1: string, logo2: string, activeSlot: 1 | 2): string {
  const sig1 = `${logo1?.length || 0}:${logo1?.slice(0, 32) || ''}:${logo1?.slice(-24) || ''}`;
  const sig2 = `${logo2?.length || 0}:${logo2?.slice(0, 32) || ''}:${logo2?.slice(-24) || ''}`;
  return `${activeSlot}|${sig1}|${sig2}`;
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function decodeAppSlotFromLocalStorage(
  raw: string | null,
  bakedVal: string,
  sentinel: string
): string | null {
  if (raw === null) return null;
  if (raw === sentinel) return bakedVal;
  return raw;
}

function writeAppSlotsToLocalStorage(
  logo1: string,
  logo2: string,
  activeSlot: 1 | 2,
  bakedSig: string,
  userModified?: boolean
): void {
  try {
    const val1 = logo1 && logo1 === BAKED_APP_LOGO ? BAKED_SLOT_1_SENTINEL : logo1;
    const val2 = logo2 && logo2 === BAKED_APP_LOGO_ALT ? BAKED_SLOT_2_SENTINEL : logo2;
    const activeVal = activeSlot === 2 && logo2 ? val2 : val1;
    localStorage.setItem(STORAGE_KEY_ACTIVE_APP_LOGO_SLOT, String(activeSlot));
    localStorage.setItem(STORAGE_KEY_BAKED_APP_LOGOS_SIG, bakedSig);
    if (typeof userModified === 'boolean') {
      localStorage.setItem(STORAGE_KEY_APP_LOGOS_USER_MODIFIED, userModified ? 'true' : 'false');
    }
    try {
      localStorage.setItem(STORAGE_KEY_APP_LOGO_1, val1);
    } catch {
      // IndexedDB preserves oversized custom images safely
    }
    try {
      localStorage.setItem(STORAGE_KEY_APP_LOGO_2, val2);
    } catch {
      // ignore quota
    }
    try {
      localStorage.setItem(STORAGE_KEY_APP_LOGO, activeVal);
    } catch {
      // ignore quota
    }
  } catch {
    // ignore
  }
}

function sanitizeCompanyLogosMap(raw: unknown): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const company = String(k || '').replace(/\s+/g, ' ').trim();
    const logo = typeof v === 'string' ? v.trim() : '';
    if (company && logo) {
      clean[company] = logo;
    }
  }
  return clean;
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
  private static memoryAppLogo: string | null = null;
  private static memoryAppLogo1: string | null = null;
  private static memoryAppLogo2: string | null = null;
  private static memoryActiveAppLogoSlot: 1 | 2 | null = null;
  private static memoryStationLogo: string | null = null;
  private static memoryCompanyLogos: Record<string, string> | null = null;
  private static idbWriteQueue: Promise<unknown> = Promise.resolve();
  private static sourceWriteQueue: Promise<unknown> = Promise.resolve();

  static normalizeCompanyName(company?: string | null): string {
    const cleaned = String(company ?? '').replace(/\s+/g, ' ').trim();
    return cleaned || 'كارجاس';
  }

  static normalizeCompanyKey(company?: string | null): string {
    return this.normalizeCompanyName(company)
      .toLowerCase()
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static enqueueIdbWrite(task: () => Promise<void>): void {
    this.idbWriteQueue = this.idbWriteQueue
      .then(() => task())
      .catch((err) => {
        console.warn('IndexedDB write failed cleanly:', err);
      });
  }

  private static enqueueSourceWrite<T>(task: () => Promise<T>): Promise<T> {
    const next = this.sourceWriteQueue.then(() => task());
    this.sourceWriteQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  static normalizeStation(raw: Station, fallbackIndex = 0): Station {
    const rawName = raw?.name ?? raw?.stationName ?? '';
    const rawStationName = raw?.stationName ?? raw?.name ?? '';
    const company = this.normalizeCompanyName(raw?.company);
    const stationName = String(rawStationName || rawName || `محطة ${company} #${fallbackIndex + 1}`);
    const name = String(rawName || stationName);

    const parsedLat = parseCoordinate(raw?.lat ?? raw?.latitude);
    const parsedLng = parseCoordinate(raw?.lng ?? raw?.longitude);

    const governorate = raw?.governorate !== undefined && raw?.governorate !== null ? String(raw.governorate) : '';
    const city = raw?.city !== undefined && raw?.city !== null ? String(raw.city) : '';
    const address = raw?.address !== undefined && raw?.address !== null ? String(raw.address) : '';
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
      const [idbStationsRaw, idbSeeded, idbCleared, idbUpdatedAt, idbBundledSig, idbUserModified] = await Promise.all([
        StationDb.getAllStations(),
        StationDb.getMeta<boolean>(META_KEY_SEEDED),
        StationDb.getMeta<boolean>(META_KEY_CLEARED),
        StationDb.getMeta<number>(META_KEY_UPDATED_AT),
        StationDb.getMeta<string>(META_KEY_BUNDLED_SIG),
        StationDb.getMeta<boolean>(META_KEY_USER_MODIFIED),
      ]);

      let lsCleared = false;
      let lsStations: Station[] | null = null;
      let lsUpdatedAt = 0;
      let lsBundledSig: string | null = null;
      let lsUserModified = false;
      try {
        lsCleared = localStorage.getItem(STORAGE_KEY_STATIONS_CLEARED) === 'true';
        lsUpdatedAt = Number(localStorage.getItem(STORAGE_KEY_STATIONS_UPDATED_AT) || '0');
        lsBundledSig = localStorage.getItem(STORAGE_KEY_BUNDLED_SIG);
        lsUserModified = localStorage.getItem(STORAGE_KEY_USER_MODIFIED) === 'true';
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

      const hasUserModifications = Boolean(idbUserModified || lsUserModified);

      // Always ensure bundled/active app logos (Slot 1 & Slot 2 + active choice), station & per-company logos are seeded and preserved in IndexedDB + LocalStorage
      const bakedCompanyLogos = sanitizeCompanyLogosMap(BAKED_COMPANY_LOGOS);
      const bakedCompanyLogosSig = computeCompanyLogosSignature(bakedCompanyLogos);
      const bakedLogo1 = BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
      const bakedLogo2 = BAKED_APP_LOGO_ALT || '';
      const bakedActiveSlot: 1 | 2 = BAKED_ACTIVE_APP_LOGO_SLOT === 2 && bakedLogo2 ? 2 : 1;
      const bakedAppLogosSig = computeAppLogosSignature(bakedLogo1, bakedLogo2, bakedActiveSlot);

      const [
        idbAppLogo,
        idbAppLogo1,
        idbAppLogo2,
        idbActiveSlotRaw,
        idbAppLogosSig,
        idbAppLogosModified,
        idbStationLogo,
        idbCompanyLogos,
        idbCompanySig,
        idbCompanyModified,
      ] = await Promise.all([
        StationDb.getMeta<string>(META_KEY_APP_LOGO),
        StationDb.getMeta<string>(META_KEY_APP_LOGO_1),
        StationDb.getMeta<string>(META_KEY_APP_LOGO_2),
        StationDb.getMeta<number>(META_KEY_ACTIVE_APP_LOGO_SLOT),
        StationDb.getMeta<string>(META_KEY_BAKED_APP_LOGOS_SIG),
        StationDb.getMeta<boolean>(META_KEY_APP_LOGOS_USER_MODIFIED),
        StationDb.getMeta<string>(META_KEY_STATION_LOGO),
        StationDb.getMeta<Record<string, string>>(META_KEY_COMPANY_LOGOS),
        StationDb.getMeta<string>(META_KEY_BAKED_COMPANY_LOGOS_SIG),
        StationDb.getMeta<boolean>(META_KEY_COMPANY_LOGOS_USER_MODIFIED),
      ]);

      const lsAppLogo = decodeAppSlotFromLocalStorage(
        safeLocalStorageGet(STORAGE_KEY_APP_LOGO),
        BAKED_APP_LOGO,
        BAKED_SLOT_1_SENTINEL
      );
      const lsAppLogo1 = decodeAppSlotFromLocalStorage(
        safeLocalStorageGet(STORAGE_KEY_APP_LOGO_1),
        BAKED_APP_LOGO,
        BAKED_SLOT_1_SENTINEL
      );
      const lsAppLogo2 = decodeAppSlotFromLocalStorage(
        safeLocalStorageGet(STORAGE_KEY_APP_LOGO_2),
        BAKED_APP_LOGO_ALT,
        BAKED_SLOT_2_SENTINEL
      );
      const lsActiveSlotRaw = safeLocalStorageGet(STORAGE_KEY_ACTIVE_APP_LOGO_SLOT);
      const lsActiveSlot: 1 | 2 | null =
        lsActiveSlotRaw === '2' ? 2 : lsActiveSlotRaw === '1' ? 1 : null;
      const lsAppLogosSig = safeLocalStorageGet(STORAGE_KEY_BAKED_APP_LOGOS_SIG);
      const lsAppLogosModified = safeLocalStorageGet(STORAGE_KEY_APP_LOGOS_USER_MODIFIED) === 'true';

      let lsStationLogo: string | null = null;
      let lsCompanyLogos: Record<string, string> | null = null;
      let lsCompanySig: string | null = null;
      let lsCompanyModified = false;
      try {
        lsStationLogo = localStorage.getItem(STORAGE_KEY_STATION_LOGO);
        lsCompanySig = localStorage.getItem(STORAGE_KEY_BAKED_COMPANY_LOGOS_SIG);
        lsCompanyModified = localStorage.getItem(STORAGE_KEY_COMPANY_LOGOS_USER_MODIFIED) === 'true';
        const rawCompanyLogos = localStorage.getItem(STORAGE_KEY_COMPANY_LOGOS);
        if (rawCompanyLogos !== null) {
          lsCompanyLogos = sanitizeCompanyLogosMap(JSON.parse(rawCompanyLogos));
        }
      } catch {
        // ignore
      }

      const hasAppLogoModifications = Boolean(idbAppLogosModified || lsAppLogosModified);
      const storedAppLogosSig = idbAppLogosSig || lsAppLogosSig;
      let resolvedLogo1: string;
      let resolvedLogo2: string;
      let resolvedActiveSlot: 1 | 2;

      if (!isDev && !hasAppLogoModifications && storedAppLogosSig && storedAppLogosSig !== bakedAppLogosSig) {
        resolvedLogo1 = bakedLogo1;
        resolvedLogo2 = bakedLogo2;
        resolvedActiveSlot = bakedActiveSlot;
      } else {
        resolvedLogo1 = lsAppLogo1 || idbAppLogo1 || lsAppLogo || idbAppLogo || bakedLogo1;
        resolvedLogo2 =
          lsAppLogo2 !== null
            ? lsAppLogo2
            : idbAppLogo2 !== undefined && idbAppLogo2 !== null
              ? idbAppLogo2
              : bakedLogo2;
        if (!isDev && !hasAppLogoModifications && !resolvedLogo2 && bakedLogo2) {
          resolvedLogo2 = bakedLogo2;
        }
        const preferredSlot =
          lsActiveSlot ??
          (idbActiveSlotRaw === 2 ? 2 : idbActiveSlotRaw === 1 ? 1 : bakedActiveSlot);
        resolvedActiveSlot = preferredSlot === 2 && resolvedLogo2 ? 2 : 1;
      }

      const resolvedAppLogo = resolvedActiveSlot === 2 && resolvedLogo2 ? resolvedLogo2 : resolvedLogo1;
      const resolvedStationLogo =
        lsStationLogo || idbStationLogo || BAKED_STATION_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;

      this.memoryAppLogo1 = resolvedLogo1;
      this.memoryAppLogo2 = resolvedLogo2;
      this.memoryActiveAppLogoSlot = resolvedActiveSlot;
      this.memoryAppLogo = resolvedAppLogo;
      this.memoryStationLogo = resolvedStationLogo;

      writeAppSlotsToLocalStorage(
        resolvedLogo1,
        resolvedLogo2,
        resolvedActiveSlot,
        bakedAppLogosSig,
        hasAppLogoModifications
      );

      this.enqueueIdbWrite(async () => {
        await StationDb.setMeta(META_KEY_APP_LOGO_1, resolvedLogo1);
        await StationDb.setMeta(META_KEY_APP_LOGO_2, resolvedLogo2);
        await StationDb.setMeta(META_KEY_ACTIVE_APP_LOGO_SLOT, resolvedActiveSlot);
        await StationDb.setMeta(META_KEY_BAKED_APP_LOGOS_SIG, bakedAppLogosSig);
        await StationDb.setMeta(META_KEY_APP_LOGOS_USER_MODIFIED, hasAppLogoModifications);
        await StationDb.setMeta(META_KEY_APP_LOGO, resolvedAppLogo);
      });

      if (
        isDev &&
        (typeof navigator === 'undefined' || navigator.onLine) &&
        computeAppLogosSignature(resolvedLogo1, resolvedLogo2, resolvedActiveSlot) !== bakedAppLogosSig
      ) {
        void this.saveAppLogosToSourceCode(resolvedLogo1, resolvedLogo2, resolvedActiveSlot);
      }

      dispatchSafe(APP_LOGO_CHANGED_EVENT, resolvedAppLogo);

      const hasCompanyLogoModifications = Boolean(idbCompanyModified || lsCompanyModified);
      const storedCompanySig = idbCompanySig || lsCompanySig;
      let resolvedCompanyLogos: Record<string, string>;
      if (!isDev && !hasCompanyLogoModifications && storedCompanySig && storedCompanySig !== bakedCompanyLogosSig) {
        resolvedCompanyLogos = bakedCompanyLogos;
      } else if (lsCompanyLogos && Object.keys(lsCompanyLogos).length > 0) {
        resolvedCompanyLogos = lsCompanyLogos;
      } else if (idbCompanyLogos && Object.keys(idbCompanyLogos).length > 0) {
        resolvedCompanyLogos = sanitizeCompanyLogosMap(idbCompanyLogos);
      } else {
        resolvedCompanyLogos = bakedCompanyLogos;
      }
      this.memoryCompanyLogos = resolvedCompanyLogos;
      try {
        localStorage.setItem(STORAGE_KEY_COMPANY_LOGOS, JSON.stringify(resolvedCompanyLogos));
        localStorage.setItem(STORAGE_KEY_BAKED_COMPANY_LOGOS_SIG, bakedCompanyLogosSig);
      } catch {
        // ignore
      }
      this.enqueueIdbWrite(async () => {
        await StationDb.setMeta(META_KEY_COMPANY_LOGOS, resolvedCompanyLogos);
        await StationDb.setMeta(META_KEY_BAKED_COMPANY_LOGOS_SIG, bakedCompanyLogosSig);
        await StationDb.setMeta(META_KEY_COMPANY_LOGOS_USER_MODIFIED, hasCompanyLogoModifications);
      });
      if (isDev && computeCompanyLogosSignature(resolvedCompanyLogos) !== bakedCompanyLogosSig) {
        void this.saveCompanyLogosToSourceCode(resolvedCompanyLogos);
      }
      dispatchSafe(COMPANY_LOGOS_CHANGED_EVENT, resolvedCompanyLogos);

      if (!idbStationLogo || idbStationLogo !== resolvedStationLogo) {
        this.enqueueIdbWrite(async () => {
          await StationDb.setMeta(META_KEY_STATION_LOGO, resolvedStationLogo);
        });
      }

      // In production / APK builds, if the baked DEFAULT_STATIONS in source code changed
      // since the previous app install AND the user has not saved custom edits on this device,
      // refresh cached stations cleanly from source code!
      const storedBundledSig = idbBundledSig || lsBundledSig;
      if (
        !isDev &&
        !hasUserModifications &&
        storedBundledSig &&
        storedBundledSig !== bundledSignature &&
        DEFAULT_STATIONS.length > 0
      ) {
        const freshlyBaked = this.sanitizeAndFixStations([...DEFAULT_STATIONS]);
        this.memoryStations = freshlyBaked;
        const now = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(freshlyBaked));
          localStorage.setItem(STORAGE_KEY_STATIONS_CLEARED, 'false');
          localStorage.setItem(STORAGE_KEY_STATIONS_UPDATED_AT, String(now));
          localStorage.setItem(STORAGE_KEY_BUNDLED_SIG, bundledSignature);
          localStorage.setItem(STORAGE_KEY_USER_MODIFIED, 'false');
        } catch {
          // ignore
        }
        this.enqueueIdbWrite(async () => {
          await StationDb.saveAllStations(freshlyBaked);
          await StationDb.setMeta(META_KEY_SEEDED, true);
          await StationDb.setMeta(META_KEY_CLEARED, false);
          await StationDb.setMeta(META_KEY_UPDATED_AT, now);
          await StationDb.setMeta(META_KEY_BUNDLED_SIG, bundledSignature);
          await StationDb.setMeta(META_KEY_USER_MODIFIED, false);
          await StationDb.setMeta(META_KEY_APP_LOGO, resolvedAppLogo);
          await StationDb.setMeta(META_KEY_STATION_LOGO, resolvedStationLogo);
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

      const syncDevEditsToSourceIfNeeded = async (loaded: Station[]) => {
        if (!isDev || typeof navigator === 'undefined' || !navigator.onLine) return;
        const loadedSig = computeStationsSignature(loaded);
        if (loaded.length > 0 && loadedSig !== bundledSignature) {
          await this.saveStationsToSourceCode(loaded);
        }
        try {
          const customStationLogo = localStorage.getItem(STORAGE_KEY_STATION_LOGO);
          if (customStationLogo && customStationLogo !== BAKED_STATION_LOGO) {
            await this.saveLogoToSourceCode(customStationLogo, 'station');
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
        void syncDevEditsToSourceIfNeeded(sanitized);
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
        void syncDevEditsToSourceIfNeeded(sanitized);
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
  static saveStations(stations: Station[], options?: { cleared?: boolean; userModified?: boolean }): void {
    const normalized = this.sanitizeAndFixStations(stations);
    this.memoryStations = normalized;
    const isCleared = Boolean(options?.cleared);
    const updatedAt = Date.now();
    const bundledSignature = computeStationsSignature(DEFAULT_STATIONS);
    const isUserModified = options?.userModified ?? true;

    try {
      localStorage.setItem(STORAGE_KEY_STATIONS, JSON.stringify(normalized));
      localStorage.setItem(STORAGE_KEY_STATIONS_CLEARED, isCleared ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEY_STATIONS_UPDATED_AT, String(updatedAt));
      localStorage.setItem(STORAGE_KEY_BUNDLED_SIG, bundledSignature);
      localStorage.setItem(STORAGE_KEY_USER_MODIFIED, isUserModified ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to save stations to localStorage', e);
    }

    this.enqueueIdbWrite(async () => {
      await StationDb.saveAllStations(normalized);
      await StationDb.setMeta(META_KEY_SEEDED, true);
      await StationDb.setMeta(META_KEY_CLEARED, isCleared);
      await StationDb.setMeta(META_KEY_UPDATED_AT, updatedAt);
      await StationDb.setMeta(META_KEY_BUNDLED_SIG, bundledSignature);
      await StationDb.setMeta(META_KEY_USER_MODIFIED, isUserModified);
    });

    dispatchSafe(STATIONS_UPDATED_EVENT, normalized);

    if (isDevEnvironment() && (typeof navigator === 'undefined' || navigator.onLine)) {
      void this.saveStationsToSourceCode(normalized);
    }
  }

  // Directly writes stations array into the source code file (src/data/defaultStations.ts) via API
  static saveStationsToSourceCode(stations?: Station[]): Promise<{ success: boolean; count: number; message: string }> {
    const list = stations ?? this.getStations();
    return this.enqueueSourceWrite(async () => {
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
        try {
          localStorage.setItem(STORAGE_KEY_USER_MODIFIED, 'false');
        } catch {
          // ignore
        }
        this.enqueueIdbWrite(async () => {
          await StationDb.setMeta(META_KEY_USER_MODIFIED, false);
        });
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
    });
  }

  // Directly writes custom logo into the source code file (src/assets/cargasLogo.ts) via API
  static saveLogoToSourceCode(
    logoDataUrl: string,
    type: 'app' | 'app-alt' | 'station' = 'app'
  ): Promise<{ success: boolean; message: string }> {
    return this.enqueueSourceWrite(async () => {
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
    });
  }

  // Directly writes BOTH app logos + active slot choice into src/assets/cargasLogo.ts via API
  static saveAppLogosToSourceCode(
    logo1?: string,
    logo2?: string,
    activeSlot?: 1 | 2
  ): Promise<{ success: boolean; message: string }> {
    const slots = this.getAppLogoSlots();
    const finalLogo1 = typeof logo1 === 'string' ? logo1 : slots.logo1;
    const finalLogo2 = typeof logo2 === 'string' ? logo2 : slots.logo2;
    const finalActiveSlot: 1 | 2 =
      (activeSlot ?? slots.activeSlot) === 2 && Boolean(finalLogo2) ? 2 : 1;

    return this.enqueueSourceWrite(async () => {
      try {
        const response = await fetch('/api/save-logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'app-slots',
            appLogo1: finalLogo1 === DEFAULT_CARGAS_LOGO_DATA_URL ? '' : finalLogo1,
            appLogo2: finalLogo2,
            activeAppSlot: finalActiveSlot,
          }),
        });
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
        const data = await response.json();
        const sig = computeAppLogosSignature(
          finalLogo1 || DEFAULT_CARGAS_LOGO_DATA_URL,
          finalLogo2,
          finalActiveSlot
        );
        try {
          localStorage.setItem(STORAGE_KEY_APP_LOGOS_USER_MODIFIED, 'false');
          localStorage.setItem(STORAGE_KEY_BAKED_APP_LOGOS_SIG, sig);
        } catch {
          // ignore
        }
        this.enqueueIdbWrite(async () => {
          await StationDb.setMeta(META_KEY_APP_LOGOS_USER_MODIFIED, false);
          await StationDb.setMeta(META_KEY_BAKED_APP_LOGOS_SIG, sig);
        });
        return {
          success: true,
          message:
            data.message || 'تم حفظ وتثبيت شعاري التطبيق والاختيار المفعّل في الكود المصدري بنجاح!',
        };
      } catch (e: any) {
        console.warn('Direct dual app logos save via API failed:', e);
        return {
          success: false,
          message: e?.message || 'تعذر حفظ شعاري التطبيق في الكود المصدري',
        };
      }
    });
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
    this.saveStations([...DEFAULT_STATIONS], { cleared: false, userModified: false });
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
  // 1. App Logo Handling (Header & Splash — Dual Selectable Slots)
  // ==========================================
  static getAppLogoSlots(): { logo1: string; logo2: string; activeSlot: 1 | 2 } {
    const lsLogo1 = decodeAppSlotFromLocalStorage(
      safeLocalStorageGet(STORAGE_KEY_APP_LOGO_1),
      BAKED_APP_LOGO,
      BAKED_SLOT_1_SENTINEL
    );
    const lsLegacy = decodeAppSlotFromLocalStorage(
      safeLocalStorageGet(STORAGE_KEY_APP_LOGO),
      BAKED_APP_LOGO,
      BAKED_SLOT_1_SENTINEL
    );
    const logo1 =
      this.memoryAppLogo1 ||
      lsLogo1 ||
      lsLegacy ||
      BAKED_APP_LOGO ||
      DEFAULT_CARGAS_LOGO_DATA_URL;

    const lsLogo2 = decodeAppSlotFromLocalStorage(
      safeLocalStorageGet(STORAGE_KEY_APP_LOGO_2),
      BAKED_APP_LOGO_ALT,
      BAKED_SLOT_2_SENTINEL
    );
    const logo2 =
      this.memoryAppLogo2 !== null
        ? this.memoryAppLogo2
        : lsLogo2 ?? (BAKED_APP_LOGO_ALT || '');

    const lsSlotRaw = safeLocalStorageGet(STORAGE_KEY_ACTIVE_APP_LOGO_SLOT);
    const preferredSlot: 1 | 2 =
      this.memoryActiveAppLogoSlot ??
      (lsSlotRaw === '2' ? 2 : lsSlotRaw === '1' ? 1 : BAKED_ACTIVE_APP_LOGO_SLOT);
    const activeSlot: 1 | 2 = preferredSlot === 2 && Boolean(logo2) ? 2 : 1;

    return { logo1, logo2, activeSlot };
  }

  static getAppLogo(): string {
    const { logo1, logo2, activeSlot } = this.getAppLogoSlots();
    if (activeSlot === 2 && logo2) return logo2;
    if (this.memoryAppLogo) return this.memoryAppLogo;
    return logo1 || BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
  }

  static saveAppLogoSlot(
    slot: 1 | 2,
    logoDataUrl: string | null,
    options?: { activate?: boolean; skipSourceSync?: boolean }
  ): void {
    try {
      const current = this.getAppLogoSlots();
      let nextLogo1 = current.logo1 || BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
      let nextLogo2 = current.logo2 || '';
      let nextActiveSlot: 1 | 2 = current.activeSlot;

      if (slot === 1) {
        nextLogo1 = logoDataUrl ? logoDataUrl : DEFAULT_CARGAS_LOGO_DATA_URL;
        if (options?.activate !== false) {
          nextActiveSlot = 1;
        }
      } else {
        nextLogo2 = logoDataUrl ? logoDataUrl : '';
        if (!nextLogo2) {
          nextActiveSlot = 1;
        } else if (options?.activate !== false) {
          nextActiveSlot = 2;
        }
      }

      const activeLogo = nextActiveSlot === 2 && nextLogo2 ? nextLogo2 : nextLogo1;
      const bakedSig = computeAppLogosSignature(
        BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL,
        BAKED_APP_LOGO_ALT || '',
        BAKED_ACTIVE_APP_LOGO_SLOT === 2 && BAKED_APP_LOGO_ALT ? 2 : 1
      );

      this.memoryAppLogo1 = nextLogo1;
      this.memoryAppLogo2 = nextLogo2;
      this.memoryActiveAppLogoSlot = nextActiveSlot;
      this.memoryAppLogo = activeLogo;

      writeAppSlotsToLocalStorage(nextLogo1, nextLogo2, nextActiveSlot, bakedSig, true);

      this.enqueueIdbWrite(async () => {
        await StationDb.setMeta(META_KEY_APP_LOGO_1, nextLogo1);
        await StationDb.setMeta(META_KEY_APP_LOGO_2, nextLogo2);
        await StationDb.setMeta(META_KEY_ACTIVE_APP_LOGO_SLOT, nextActiveSlot);
        await StationDb.setMeta(META_KEY_BAKED_APP_LOGOS_SIG, bakedSig);
        await StationDb.setMeta(META_KEY_APP_LOGOS_USER_MODIFIED, true);
        await StationDb.setMeta(META_KEY_APP_LOGO, activeLogo);
      });

      if (isDevEnvironment() && !options?.skipSourceSync) {
        void this.saveAppLogosToSourceCode(nextLogo1, nextLogo2, nextActiveSlot);
      }

      dispatchSafe(APP_LOGO_CHANGED_EVENT, activeLogo);
    } catch (e) {
      console.error('Failed to save app logo slot', e);
    }
  }

  static setActiveAppLogoSlot(
    slot: 1 | 2,
    options?: { skipSourceSync?: boolean }
  ): void {
    try {
      const current = this.getAppLogoSlots();
      const nextActiveSlot: 1 | 2 = slot === 2 && Boolean(current.logo2) ? 2 : 1;
      const activeLogo = nextActiveSlot === 2 && current.logo2 ? current.logo2 : current.logo1;
      const bakedSig = computeAppLogosSignature(
        BAKED_APP_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL,
        BAKED_APP_LOGO_ALT || '',
        BAKED_ACTIVE_APP_LOGO_SLOT === 2 && BAKED_APP_LOGO_ALT ? 2 : 1
      );

      this.memoryAppLogo1 = current.logo1;
      this.memoryAppLogo2 = current.logo2;
      this.memoryActiveAppLogoSlot = nextActiveSlot;
      this.memoryAppLogo = activeLogo;

      writeAppSlotsToLocalStorage(
        current.logo1,
        current.logo2,
        nextActiveSlot,
        bakedSig,
        true
      );

      this.enqueueIdbWrite(async () => {
        await StationDb.setMeta(META_KEY_ACTIVE_APP_LOGO_SLOT, nextActiveSlot);
        await StationDb.setMeta(META_KEY_BAKED_APP_LOGOS_SIG, bakedSig);
        await StationDb.setMeta(META_KEY_APP_LOGOS_USER_MODIFIED, true);
        await StationDb.setMeta(META_KEY_APP_LOGO, activeLogo);
      });

      if (isDevEnvironment() && !options?.skipSourceSync) {
        void this.saveAppLogosToSourceCode(current.logo1, current.logo2, nextActiveSlot);
      }

      dispatchSafe(APP_LOGO_CHANGED_EVENT, activeLogo);
    } catch (e) {
      console.error('Failed to switch active app logo slot', e);
    }
  }

  static saveAppLogo(logoDataUrl: string | null, options?: { skipSourceSync?: boolean }): void {
    this.saveAppLogoSlot(1, logoDataUrl, { activate: true, skipSourceSync: options?.skipSourceSync });
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
    if (this.memoryStationLogo) return this.memoryStationLogo;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STATION_LOGO);
      if (stored) return stored;
    } catch {
      // ignore
    }
    return BAKED_STATION_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
  }

  static saveStationLogo(logoDataUrl: string | null, options?: { skipSourceSync?: boolean }): void {
    try {
      const nextVal = logoDataUrl || BAKED_STATION_LOGO || DEFAULT_CARGAS_LOGO_DATA_URL;
      this.memoryStationLogo = nextVal;
      if (logoDataUrl) {
        localStorage.setItem(STORAGE_KEY_STATION_LOGO, logoDataUrl);
        this.enqueueIdbWrite(async () => {
          await StationDb.setMeta(META_KEY_STATION_LOGO, logoDataUrl);
        });
        if (isDevEnvironment() && !options?.skipSourceSync) {
          void this.saveLogoToSourceCode(logoDataUrl, 'station');
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_STATION_LOGO);
        this.enqueueIdbWrite(async () => {
          await StationDb.setMeta(META_KEY_STATION_LOGO, nextVal);
        });
        if (isDevEnvironment() && !options?.skipSourceSync) {
          void this.saveLogoToSourceCode('', 'station');
        }
      }
      dispatchSafe(STATION_LOGO_CHANGED_EVENT, nextVal);
    } catch (e) {
      console.error('Failed to save station logo', e);
    }
  }

  // ==========================================
  // 3. Per-Company Logos & Filtering (Multi-Company Support)
  // ==========================================
  static getCompanyLogos(): Record<string, string> {
    if (this.memoryCompanyLogos) {
      return { ...this.memoryCompanyLogos };
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMPANY_LOGOS);
      if (stored !== null) {
        const parsed = sanitizeCompanyLogosMap(JSON.parse(stored));
        this.memoryCompanyLogos = parsed;
        return { ...parsed };
      }
    } catch {
      // ignore
    }
    const baked = sanitizeCompanyLogosMap(BAKED_COMPANY_LOGOS);
    this.memoryCompanyLogos = baked;
    return { ...baked };
  }

  static getLogoForCompany(company?: string | null, stationLogoUrl?: string | null): string {
    if (stationLogoUrl && String(stationLogoUrl).trim()) {
      return String(stationLogoUrl).trim();
    }
    const targetKey = this.normalizeCompanyKey(company);
    const logos = this.getCompanyLogos();
    for (const [k, v] of Object.entries(logos)) {
      if (this.normalizeCompanyKey(k) === targetKey && v) {
        return v;
      }
    }
    return this.getStationLogo() || DEFAULT_CARGAS_LOGO_DATA_URL;
  }

  static saveCompanyLogo(
    company: string,
    logoDataUrl: string | null,
    options?: { skipSourceSync?: boolean }
  ): Record<string, string> {
    const cleanName = this.normalizeCompanyName(company);
    const targetKey = this.normalizeCompanyKey(cleanName);
    const nextMap = { ...this.getCompanyLogos() };

    for (const existingKey of Object.keys(nextMap)) {
      if (this.normalizeCompanyKey(existingKey) === targetKey) {
        delete nextMap[existingKey];
      }
    }

    if (logoDataUrl && logoDataUrl.trim()) {
      nextMap[cleanName] = logoDataUrl.trim();
    }

    const bakedSig = computeCompanyLogosSignature(sanitizeCompanyLogosMap(BAKED_COMPANY_LOGOS));
    this.memoryCompanyLogos = nextMap;

    try {
      localStorage.setItem(STORAGE_KEY_COMPANY_LOGOS, JSON.stringify(nextMap));
      localStorage.setItem(STORAGE_KEY_BAKED_COMPANY_LOGOS_SIG, bakedSig);
      localStorage.setItem(STORAGE_KEY_COMPANY_LOGOS_USER_MODIFIED, 'true');
    } catch (e) {
      console.error('Failed to save company logo to localStorage:', e);
    }

    this.enqueueIdbWrite(async () => {
      await StationDb.setMeta(META_KEY_COMPANY_LOGOS, nextMap);
      await StationDb.setMeta(META_KEY_BAKED_COMPANY_LOGOS_SIG, bakedSig);
      await StationDb.setMeta(META_KEY_COMPANY_LOGOS_USER_MODIFIED, true);
    });

    dispatchSafe(COMPANY_LOGOS_CHANGED_EVENT, nextMap);

    if (isDevEnvironment() && !options?.skipSourceSync && (typeof navigator === 'undefined' || navigator.onLine)) {
      void this.saveCompanyLogosToSourceCode(nextMap);
    }

    return nextMap;
  }

  static onCompanyLogosUpdated(callback: (logos: Record<string, string>) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, string>>;
      callback(customEvent.detail || this.getCompanyLogos());
    };
    window.addEventListener(COMPANY_LOGOS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(COMPANY_LOGOS_CHANGED_EVENT, handler);
  }

  static saveCompanyLogosToSourceCode(
    logos?: Record<string, string>
  ): Promise<{ success: boolean; count: number; message: string }> {
    const map = sanitizeCompanyLogosMap(logos ?? this.getCompanyLogos());
    return this.enqueueSourceWrite(async () => {
      try {
        const response = await fetch('/api/save-company-logos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyLogos: map }),
        });
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
        const data = await response.json();
        try {
          localStorage.setItem(STORAGE_KEY_COMPANY_LOGOS_USER_MODIFIED, 'false');
          localStorage.setItem(STORAGE_KEY_BAKED_COMPANY_LOGOS_SIG, computeCompanyLogosSignature(map));
        } catch {
          // ignore
        }
        this.enqueueIdbWrite(async () => {
          await StationDb.setMeta(META_KEY_COMPANY_LOGOS_USER_MODIFIED, false);
          await StationDb.setMeta(META_KEY_BAKED_COMPANY_LOGOS_SIG, computeCompanyLogosSignature(map));
        });
        return {
          success: true,
          count: Object.keys(map).length,
          message:
            data.message || `تم حفظ شعارات (${Object.keys(map).length}) شركة في الكود المصدري بنجاح`,
        };
      } catch (e: any) {
        console.warn('Direct company logos save via API failed:', e);
        return {
          success: false,
          count: Object.keys(map).length,
          message: e?.message || 'تعذر حفظ شعارات الشركات في الكود المصدري',
        };
      }
    });
  }

  static generateCompanyLogosSourceCode(logos?: Record<string, string>): string {
    const map = sanitizeCompanyLogosMap(logos ?? this.getCompanyLogos());
    return `/**
 * شعارات شركات الغاز الطبيعي المعتمدة والمثبتة في الكود المصدري
 * تاريخ التحديث: ${new Date().toLocaleString('ar-EG')} (${new Date().toISOString()})
 */
export const BAKED_COMPANY_LOGOS: Record<string, string> = ${JSON.stringify(map, null, 2)};
`;
  }

  static getUniqueCompanies(stations?: Station[], includeLogoKeys = false): string[] {
    const list = stations ?? this.getStations();
    const byKey = new Map<string, string>();
    for (const s of list) {
      const display = this.normalizeCompanyName(s.company);
      const key = this.normalizeCompanyKey(display);
      if (!byKey.has(key)) byKey.set(key, display);
    }
    if (includeLogoKeys) {
      for (const k of Object.keys(this.getCompanyLogos())) {
        const display = this.normalizeCompanyName(k);
        const key = this.normalizeCompanyKey(display);
        if (!byKey.has(key)) byKey.set(key, display);
      }
    }
    if (byKey.size === 0) {
      byKey.set(this.normalizeCompanyKey('كارجاس'), 'كارجاس');
    }
    return Array.from(byKey.values());
  }

  static filterStationsByVisibleCompanies(stations: Station[], config?: AppConfig): Station[] {
    const cfg = config ?? AppConfigService.getConfig();
    if (!Array.isArray(cfg.visibleCompanies) || cfg.visibleCompanies.length === 0) {
      return stations;
    }
    const allowedKeys = new Set(cfg.visibleCompanies.map((c) => this.normalizeCompanyKey(c)));
    return stations.filter((s) => allowedKeys.has(this.normalizeCompanyKey(s.company)));
  }

  static getVisibleCompanyBrands(
    stations?: Station[],
    config?: AppConfig
  ): Array<{ company: string; logo: string }> {
    const cfg = config ?? AppConfigService.getConfig();
    const allCompanies = this.getUniqueCompanies(stations, true);
    const byKeyDisplay = new Map<string, string>();
    for (const c of allCompanies) {
      byKeyDisplay.set(this.normalizeCompanyKey(c), c);
    }

    let targetCompanies: string[];
    if (Array.isArray(cfg.visibleCompanies) && cfg.visibleCompanies.length > 0) {
      const seen = new Set<string>();
      targetCompanies = [];
      for (const raw of cfg.visibleCompanies) {
        const display = this.normalizeCompanyName(raw);
        const key = this.normalizeCompanyKey(display);
        if (!seen.has(key)) {
          seen.add(key);
          targetCompanies.push(byKeyDisplay.get(key) || display);
        }
      }
      if (targetCompanies.length === 0) {
        targetCompanies = allCompanies;
      }
    } else {
      targetCompanies = allCompanies;
    }

    return targetCompanies.map((company) => ({
      company,
      logo: this.getLogoForCompany(company),
    }));
  }

  static async commitAllEditsToSourceCode(): Promise<{ success: boolean; count: number; message: string }> {
    const stations = this.getStations();
    const stationsRes = await this.saveStationsToSourceCode(stations);
    const { logo1, logo2, activeSlot } = this.getAppLogoSlots();
    const stationLogo = this.getStationLogo();
    await this.saveAppLogosToSourceCode(logo1, logo2, activeSlot);
    await this.saveLogoToSourceCode(stationLogo === DEFAULT_CARGAS_LOGO_DATA_URL ? '' : stationLogo, 'station');
    await this.saveCompanyLogosToSourceCode();
    await AppConfigService.saveConfigToSourceCode();
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
    const { logo1, logo2, activeSlot } = this.getAppLogoSlots();
    const stationLogo = this.getStationLogo();
    return generateLogoSourceCode(logo1, stationLogo, logo2, activeSlot);
  }
}
