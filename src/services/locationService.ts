import { Station, UserLocation } from '../types';

export interface PredefinedLocation {
  id: string;
  name: string;
  governorate: string;
  lat: number;
  lng: number;
  description: string;
}

export type GpsStatus =
  | 'pending'
  | 'accurate'
  | 'low_accuracy'
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'outside_egypt'
  | 'manual';

export type GpsErrorCode =
  | 'unsupported'
  | 'insecure_context'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown';

export interface RejectedBrowserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  district: string;
}

export interface LocationDiagnostics {
  location: UserLocation;
  districtName: string;
  status: GpsStatus;
  errorCode: GpsErrorCode | null;
  permissionState: PermissionState | 'unsupported';
  hasManualOverride: boolean;
  warningMessage: string | null;
  lastBrowserAccuracy: number | null;
  lastRejectedLocation: RejectedBrowserLocation | null;
}

export const PREDEFINED_LOCATIONS: PredefinedLocation[] = [
  { id: 'cairo-tahrir', name: 'وسط البلد والتحرير', governorate: 'القاهرة', lat: 30.0444, lng: 31.2357, description: 'ميدان التحرير / رمسيس / وسط القاهرة' },
  { id: 'cairo-nasr-city', name: 'مدينة نصر', governorate: 'القاهرة', lat: 30.0512, lng: 31.3412, description: 'طريق النصر / مكرم عبيد / عباس العقاد' },
  { id: 'cairo-heliopolis', name: 'مصر الجديدة وألماظة', governorate: 'القاهرة', lat: 30.0931, lng: 31.3524, description: 'شارع الثورة / الكوربة / الميرغني' },
  { id: 'cairo-tagamoa', name: 'التجمع الخامس والقاهرة الجديدة', governorate: 'القاهرة', lat: 30.0124, lng: 31.4398, description: 'شارع التسعين / مجمع البنوك' },
  { id: 'cairo-maadi', name: 'المعادي وحلوان', governorate: 'القاهرة', lat: 29.9612, lng: 31.2584, description: 'كورنيش النيل / دجلة / الأوتوستراد' },
  { id: 'cairo-mokattam', name: 'المقطم (الهضبة العليا والوسطى)', governorate: 'القاهرة', lat: 30.0147, lng: 31.3125, description: 'شارع 9 / محور حسب الله الكفراوي / الأباجية' },
  { id: 'cairo-shubra-m', name: 'شبرا مصر والمظلات', governorate: 'القاهرة', lat: 30.0885, lng: 31.2468, description: 'روض الفرج / الساحل / المظلات' },
  { id: 'giza-dokki', name: 'الدقي والمهندسين', governorate: 'الجيزة', lat: 30.0385, lng: 31.2114, description: 'شارع جامعة الدول العربية / البطل' },
  { id: 'giza-haram', name: 'الهرم وفيصل', governorate: 'الجيزة', lat: 29.9982, lng: 31.1643, description: 'شارع الهرم الرئيسي / فيصل' },
  { id: 'giza-october', name: '6 أكتوبر والشيخ زايد', governorate: 'الجيزة', lat: 29.9721, lng: 30.9412, description: 'المحور المركزي / الحصري' },
  { id: 'qal-shubra', name: 'شبرا الخيمة', governorate: 'القليوبية', lat: 30.1254, lng: 31.2435, description: 'المؤسسة / الكابلات / بيجام' },
  { id: 'qal-banha', name: 'بنها وكفر شكر', governorate: 'القليوبية', lat: 30.4667, lng: 31.1833, description: 'طريق مصر الإسكندرية الزراعي / كفر شكر' },
  { id: 'alex-raml', name: 'الإسكندرية', governorate: 'الإسكندرية', lat: 31.2001, lng: 29.9187, description: 'محطة الرمل / الكورنيش' },
  { id: 'dak-mansoura', name: 'المنصورة', governorate: 'الدقهلية', lat: 31.0409, lng: 31.3785, description: 'شارع الجيش / المشاية' },
  { id: 'ghar-tanta', name: 'طنطا', governorate: 'الغربية', lat: 30.7865, lng: 31.0004, description: 'شارع البحر / المحطة' },
  { id: 'shar-zagazig', name: 'الزقازيق', governorate: 'الشرقية', lat: 30.5877, lng: 31.5020, description: 'شارع المحافظة / القومية' },
  { id: 'suez-city', name: 'السويس', governorate: 'السويس', lat: 29.9668, lng: 32.5498, description: 'بورتوفيق / الأربعين' },
  { id: 'ism-city', name: 'الإسماعيلية', governorate: 'الإسماعيلية', lat: 30.5965, lng: 32.2715, description: 'شارع محمد علي / الممر' },
  { id: 'port-city', name: 'بورسعيد', governorate: 'بورسعيد', lat: 31.2653, lng: 32.3019, description: 'شارع 23 يوليو / الميناء' },
  { id: 'menouf-shebin', name: 'شبين الكوم (المنوفية)', governorate: 'المنوفية', lat: 30.5522, lng: 31.0089, description: 'شبين الكوم / ميدان شرف' },
  { id: 'assiut-city', name: 'أسيوط', governorate: 'أسيوط', lat: 27.1809, lng: 31.1837, description: 'ميدان المحطة / الجامعة' },
];

const LEGACY_MANUAL_LOC_KEY = 'cargas_user_manual_loc_v2';
const STORAGE_KEY_LAST_GPS_HINT = 'cargas_last_gps_hint_v3';
const HINT_MAX_AGE_MS = 15 * 60 * 1000; // Only reuse warm-start hint for 15 minutes so previous locations never linger
// Accept initial indoor cellular/Wi-Fi A-GPS up to 25km when still on simulated default so users outside Downtown Cairo move immediately to their real area, then refine via continuous watchPosition.
const INITIAL_ACCEPTABLE_ACCURACY_METERS = 25000;
const CONTINUOUS_ACCEPTABLE_ACCURACY_METERS = 4000;
const HEARTBEAT_INTERVAL_MS = 10000;
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 2000,
};
const BALANCED_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 15000,
};

export class LocationService {
  private static watchId: number | null = null;
  private static balancedWatchId: number | null = null;
  private static heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private static lastWatchCallbackAt = 0;
  private static medianPromptRequested = false;
  private static medianHookAttached = false;
  private static hasManualOverride = false;
  private static gpsStatus: GpsStatus = 'pending';
  private static lastErrorCode: GpsErrorCode | null = null;
  private static permissionState: PermissionState | 'unsupported' = 'unsupported';
  private static permissionObserverAttached = false;
  private static lifecycleListenersAttached = false;
  private static gpsWarningMessage: string | null = null;
  private static lastBrowserAccuracy: number | null = null;
  private static lastAcceptedAccuracy: number | null = null;
  private static lastRejectedLocation: RejectedBrowserLocation | null = null;
  private static currentLocation: UserLocation = LocationService.initInitialLocation();
  private static listeners: Set<(loc: UserLocation) => void> = new Set();
  private static statusListeners: Set<(diag: LocationDiagnostics) => void> = new Set();
  private static isTracking = false;

  private static saveGpsHint(lat: number, lng: number): void {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_GPS_HINT, JSON.stringify({ lat, lng, ts: Date.now() }));
    } catch {
      // ignore storage errors
    }
  }

  private static initInitialLocation(): UserLocation {
    // Clean up legacy permanent manual lock so automatic hardware GPS always works across days/locations
    try {
      localStorage.removeItem(LEGACY_MANUAL_LOC_KEY);
      const hintRaw = localStorage.getItem(STORAGE_KEY_LAST_GPS_HINT);
      if (hintRaw) {
        const parsed = JSON.parse(hintRaw);
        const hintAge = typeof parsed?.ts === 'number' ? Date.now() - parsed.ts : Infinity;
        if (
          parsed &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          hintAge >= 0 &&
          hintAge < HINT_MAX_AGE_MS &&
          LocationService.isWithinEgypt(parsed.lat, parsed.lng)
        ) {
          LocationService.hasManualOverride = false;
          LocationService.gpsStatus = 'pending';
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: 500,
            timestamp: 0,
            isSimulated: true,
          };
        } else {
          localStorage.removeItem(STORAGE_KEY_LAST_GPS_HINT);
        }
      }
    } catch {
      // ignore storage errors
    }

    // Guaranteed Default: Cairo Downtown / Tahrir Square until live GPS locks
    LocationService.hasManualOverride = false;
    LocationService.gpsStatus = 'pending';
    return {
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 500,
      timestamp: 0,
      isSimulated: true,
    };
  }

  static isWithinEgypt(lat: number, lng: number): boolean {
    return !isNaN(lat) && !isNaN(lng) && lat >= 21.5 && lat <= 32.0 && lng >= 24.5 && lng <= 37.0;
  }

  // Haversine formula: great-circle distance in kilometers
  static getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static formatDistance(km: number): string {
    if (isNaN(km) || km < 0) return '—';
    if (km < 1) {
      return `${Math.round(km * 1000)} م`;
    }
    return `${km.toFixed(1)} كم`;
  }

  // Detects and formats the neighborhood / governorate name based on coordinates
  static getDistrictOrCityName(lat: number, lng: number): string {
    // Cairo Metropolitan Area:
    if (lat >= 29.78 && lat <= 30.22 && lng >= 31.18 && lng <= 31.65) {
      if (lng > 31.38) return 'القاهرة (القاهرة الجديدة والتجمع)';
      if (lat >= 29.985 && lat <= 30.032 && lng >= 31.275 && lng <= 31.355) return 'القاهرة (المقطم)';
      if (lat > 30.085 && lng >= 31.29) return 'القاهرة (مصر الجديدة والنزهة)';
      if (lat > 30.075 && lng < 31.29) return 'القاهرة (شبرا وروض الفرج)';
      if (lat < 29.98) return 'القاهرة (المعادي وحلوان)';
      if (lng > 31.28) return 'القاهرة (مدينة نصر)';
      return 'القاهرة (وسط البلد / التحرير)';
    }
    // Giza Metropolitan Area:
    if (lat >= 29.8 && lat <= 30.15 && lng >= 30.8 && lng < 31.23) {
      if (lng < 31.05) return 'الجيزة (6 أكتوبر والشيخ زايد)';
      if (lat < 30.02) return 'الجيزة (الهرم وفيصل)';
      return 'الجيزة (الدقي والمهندسين)';
    }
    // Menoufia:
    if (lat >= 30.28 && lat <= 30.72 && lng >= 30.75 && lng <= 31.18) {
      return 'المنوفية (شبين الكوم / قويسنا)';
    }
    // Qalyubia:
    if (lat >= 30.35 && lat <= 30.65 && lng >= 31.15 && lng <= 31.42) {
      return 'القليوبية (بنها)';
    }
    if (lat >= 30.11 && lat <= 30.35 && lng >= 31.15 && lng <= 31.55) {
      return 'القليوبية (شبرا الخيمة / العبور)';
    }
    // Alexandria:
    if (lat >= 30.95 && lat <= 31.35 && lng >= 29.55 && lng <= 30.2) {
      return 'الإسكندرية';
    }
    // Gharbia:
    if (lat >= 30.68 && lat <= 31.05 && lng >= 30.85 && lng <= 31.25) {
      return 'الغربية (طنطا / المحلة)';
    }
    // Dakahlia:
    if (lat >= 30.85 && lat <= 31.35 && lng >= 31.2 && lng <= 31.8) {
      return 'الدقهلية (المنصورة)';
    }
    // Sharqia:
    if (lat >= 30.4 && lat <= 30.9 && lng >= 31.35 && lng <= 32.05) {
      return 'الشرقية (الزقازيق / العاشر)';
    }
    // Suez:
    if (lat >= 29.8 && lat <= 30.15 && lng >= 32.35 && lng <= 32.65) {
      return 'السويس';
    }
    // Ismailia:
    if (lat >= 30.4 && lat <= 30.85 && lng >= 32.15 && lng <= 32.5) {
      return 'الإسماعيلية';
    }
    // Port Said:
    if (lat >= 31.15 && lat <= 31.35 && lng >= 32.15 && lng <= 32.45) {
      return 'بورسعيد';
    }
    // Upper Egypt & Red Sea:
    if (lat >= 27.0 && lat <= 27.35 && lng >= 31.0 && lng <= 31.4) {
      return 'أسيوط';
    }
    if (lat >= 27.0 && lat <= 27.45 && lng >= 33.6 && lng <= 34.0) {
      return 'الغردقة (البحر الأحمر)';
    }

    if (!this.isWithinEgypt(lat, lng)) {
      return `خارج مصر (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
    }

    return `موقع داخل مصر (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  }

  private static attachMedianLibraryReadyHook(): void {
    if (this.medianHookAttached || typeof window === 'undefined') return;
    this.medianHookAttached = true;

    const win = window as unknown as {
      median_library_ready?: () => void;
      gonative_library_ready?: () => void;
    };

    const onReady = () => {
      void this.promptMedianLocationIfAvailable(true).then((invoked) => {
        if (invoked && !this.hasManualOverride) {
          this.lastErrorCode = null;
          this.requestCurrentFix(true);
          this.startWatchLoop();
          window.setTimeout(() => {
            if (!this.hasManualOverride && this.currentLocation.isSimulated) {
              this.requestCurrentFix(true);
            }
          }, 1800);
        }
      });
    };

    const prevMedianReady = win.median_library_ready;
    win.median_library_ready = () => {
      try {
        prevMedianReady?.();
      } catch {
        // ignore
      }
      onReady();
    };

    const prevGonativeReady = win.gonative_library_ready;
    win.gonative_library_ready = () => {
      try {
        prevGonativeReady?.();
      } catch {
        // ignore
      }
      onReady();
    };
  }

  private static async promptMedianLocationIfAvailable(forcePrompt = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.medianPromptRequested && !forcePrompt) return false;

    const win = window as unknown as {
      median?: { android?: { geoLocation?: { promptLocationServices?: () => unknown } } };
      gonative?: { android?: { geoLocation?: { promptLocationServices?: () => unknown } } };
    };
    const promptFn =
      win.median?.android?.geoLocation?.promptLocationServices ||
      win.gonative?.android?.geoLocation?.promptLocationServices;

    if (typeof promptFn !== 'function') return false;

    this.medianPromptRequested = true;
    try {
      const maybePromise = promptFn();
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
        await Promise.race([
          maybePromise as Promise<unknown>,
          new Promise<void>((resolve) => setTimeout(resolve, 4000)),
        ]);
      }
      return true;
    } catch {
      return false;
    }
  }

  private static mapGeolocationError(err: GeolocationPositionError): {
    status: GpsStatus;
    code: GpsErrorCode;
    message: string;
  } {
    switch (err.code) {
      case 1: {
        const msg = err.message || '';
        const isPolicyBlocked = /permissions?\s*policy|disabled in this document/i.test(msg);
        return {
          status: 'denied',
          code: 'permission_denied',
          message: isPolicyBlocked
            ? 'إطار المعاينة الحالي لا يسمح بصلاحية الموقع تلقائياً. افتح التطبيق في المتصفح أو ثبّته على الهاتف للتتبع التلقائي، أو حدد موقعك يدوياً.'
            : 'تم رفض إذن الوصول للموقع. فعّل صلاحية الموقع (GPS) من إعدادات التطبيق أو المتصفح، وسيتم التحديث تلقائياً.',
        };
      }
      case 2: // POSITION_UNAVAILABLE
        return {
          status: 'unavailable',
          code: 'position_unavailable',
          message:
            'تعذر التقاط إشارة الـ GPS من الجهاز حالياً. تأكد من تشغيل زر الموقع (GPS) بالهاتف أو اختر منطقتك يدوياً.',
        };
      case 3: // TIMEOUT
        return {
          status: 'timeout',
          code: 'timeout',
          message:
            'انتهت مهلة انتظار إشارة الـ GPS عالية الدقة. تأكد من تشغيل الموقع أو اضغط تحديث الموقع.',
        };
      default:
        return {
          status: 'unavailable',
          code: 'unknown',
          message: `حدث خطأ أثناء تحديد الموقع (${err.message || 'غير معروف'}). يمكنك تحديد موقعك يدوياً.`,
        };
    }
  }

  private static recheckPermissionState(triggerFixIfGranted = true): void {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permStatus) => {
        const prev = this.permissionState;
        this.permissionState = permStatus.state;
        if (
          triggerFixIfGranted &&
          !this.hasManualOverride &&
          (permStatus.state === 'granted' ||
            (prev === 'denied' && permStatus.state === 'prompt'))
        ) {
          if (this.lastErrorCode === 'permission_denied' || this.currentLocation.isSimulated) {
            this.lastErrorCode = null;
            this.gpsWarningMessage = null;
            this.requestCurrentFix(true);
            this.startWatchLoop();
          }
        }
        this.notifyStatusListeners();
      })
      .catch(() => {
        // ignore unsupported permission query
      });
  }

  private static attachPermissionObserver(): void {
    if (this.permissionObserverAttached) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;

    this.permissionObserverAttached = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((permStatus) => {
        this.permissionState = permStatus.state;
        this.notifyStatusListeners();

        permStatus.onchange = () => {
          this.permissionState = permStatus.state;
          if (permStatus.state === 'granted' && !this.hasManualOverride) {
            this.lastErrorCode = null;
            this.gpsWarningMessage = null;
            this.requestCurrentFix(true);
            this.startWatchLoop();
          } else if (permStatus.state === 'denied' && !this.hasManualOverride) {
            this.gpsStatus = 'denied';
            this.lastErrorCode = 'permission_denied';
            this.gpsWarningMessage =
              'تم رفض إذن الوصول للموقع من المتصفح أو التطبيق. يمكنك تفعيل الصلاحية أو اختيار موقعك يدوياً.';
            this.notifyStatusListeners();
          }
        };
      })
      .catch(() => {
        this.permissionState = 'unsupported';
      });
  }

  private static isSecureEnvironment(): boolean {
    if (typeof window === 'undefined') return true;
    return window.isSecureContext !== false;
  }

  private static processBrowserPosition(pos: GeolocationPosition, isWatchUpdate = false): void {
    const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;

    // Guard against invalid/null-island coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      return;
    }

    const roundedAccuracy = Math.round(accuracy || 0);
    this.lastBrowserAccuracy = roundedAccuracy;

    // If the user explicitly picked or dragged their location, do not silently overwrite it with background updates
    if (this.hasManualOverride) {
      this.notifyStatusListeners();
      return;
    }

    // 1. Reject coordinates outside Egypt (common in VPNs or cloud server environments)
    if (!this.isWithinEgypt(lat, lng)) {
      this.lastRejectedLocation = {
        lat,
        lng,
        accuracy: roundedAccuracy,
        district: this.getDistrictOrCityName(lat, lng),
      };
      this.gpsStatus = 'outside_egypt';
      this.lastErrorCode = null;
      this.gpsWarningMessage = `المتصفح أعاد موقعاً خارج مصر (${lat.toFixed(2)}, ${lng.toFixed(2)}) — يتم استخدام القاهرة افتراضياً حتى تحدد موقعك.`;
      this.notifyStatusListeners();
      return;
    }

    // 2. Reject extreme low-accuracy ISP/IP geolocation (e.g. reporting Menoufia/Delta from Cairo with >8km accuracy)
    const maxAccuracyAllowed = this.currentLocation.isSimulated
      ? INITIAL_ACCEPTABLE_ACCURACY_METERS
      : CONTINUOUS_ACCEPTABLE_ACCURACY_METERS;
    if (accuracy && accuracy > maxAccuracyAllowed) {
      const guessedDistrict = this.getDistrictOrCityName(lat, lng);
      this.lastRejectedLocation = {
        lat,
        lng,
        accuracy: roundedAccuracy,
        district: guessedDistrict,
      };
      this.gpsStatus = 'low_accuracy';
      this.lastErrorCode = null;
      this.gpsWarningMessage = `دقة GPS المتصفح ضعيفة (±${(accuracy / 1000).toFixed(1)} كم في ${guessedDistrict}) — يمكنك تحديد موقعك بدقة أو التحديث من الخارج.`;
      this.notifyStatusListeners();
      return;
    }

    const movedMeters =
      this.getDistanceKm(this.currentLocation.lat, this.currentLocation.lng, lat, lng) * 1000;

    // 3. During continuous watchPosition updates, only reject temporary accuracy regression if user barely moved (<120m) and previous fix is recent (<15s)
    if (
      isWatchUpdate &&
      !this.currentLocation.isSimulated &&
      this.lastAcceptedAccuracy !== null &&
      roundedAccuracy > this.lastAcceptedAccuracy * 2.5 &&
      roundedAccuracy > 120 &&
      movedMeters < 120 &&
      Date.now() - (this.currentLocation.timestamp || 0) < 15000
    ) {
      return;
    }

    // 4. Ignore tiny sub-5m GPS drift jitter when already locked at high accuracy
    if (
      isWatchUpdate &&
      !this.currentLocation.isSimulated &&
      this.lastAcceptedAccuracy !== null &&
      roundedAccuracy >= this.lastAcceptedAccuracy &&
      movedMeters < 5
    ) {
      return;
    }

    // 5. Accept live GPS location inside Egypt & store as short-lived warm-start hint only
    if (isWatchUpdate) {
      this.lastWatchCallbackAt = Date.now();
    }
    this.lastRejectedLocation = null;
    this.lastAcceptedAccuracy = roundedAccuracy;
    this.gpsStatus = roundedAccuracy > 2500 ? 'low_accuracy' : 'accurate';
    this.lastErrorCode = null;
    this.gpsWarningMessage =
      roundedAccuracy > 2500
        ? `تم تحديد المنطقة عبر الشبكة (±${(roundedAccuracy / 1000).toFixed(1)} كم) وجارٍ تحسين دقة الـ GPS...`
        : null;
    // Keep warm-start hint only for high/medium-accuracy fixes
    if (roundedAccuracy <= 2500) {
      this.saveGpsHint(lat, lng);
    }
    this.updateLocation({
      lat,
      lng,
      accuracy,
      heading,
      speed,
      timestamp: pos.timestamp || Date.now(),
      isSimulated: false,
    });
  }

  private static handleGeolocationError(err: GeolocationPositionError, isWatchError = false): void {
    const mapped = this.mapGeolocationError(err);
    console.warn(`Geolocation ${isWatchError ? 'watchPosition' : 'getCurrentPosition'} error [${err.code}]:`, err.message);

    // On Median.co / GoNative Android APKs, prompt native location services if initial watch/fix fails
    if (err.code === 1 || err.code === 2) {
      void this.promptMedianLocationIfAvailable(false).then((invoked) => {
        if (invoked && !this.hasManualOverride) {
          window.setTimeout(() => {
            if (!this.hasManualOverride && this.currentLocation.isSimulated) {
              this.requestCurrentFix(true);
              this.startWatchLoop();
            }
          }, 1500);
        }
      });
    }

    // If watch fails temporarily with timeout after we already have a live fix, keep the existing fix silently
    if (isWatchError && !this.currentLocation.isSimulated && mapped.code === 'timeout') {
      return;
    }

    if (!this.hasManualOverride) {
      // Do not overwrite a valid live fix with a transient watch error
      if (!this.currentLocation.isSimulated && err.code !== 1) {
        return;
      }
      this.gpsStatus = mapped.status;
      this.lastErrorCode = mapped.code;
      this.gpsWarningMessage = mapped.message;
      this.notifyStatusListeners();
    }
  }

  private static requestCurrentFix(allowFallback = true): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    let highAccuracyResolved = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        highAccuracyResolved = true;
        this.processBrowserPosition(pos, false);
      },
      (err) => {
        // If high-accuracy GPS times out or is unavailable indoors, retry with balanced network/A-GPS accuracy
        if (allowFallback && (err.code === 3 || err.code === 2)) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => this.processBrowserPosition(fallbackPos, false),
            (fallbackErr) => this.handleGeolocationError(fallbackErr, false),
            BALANCED_FALLBACK_OPTIONS
          );
          return;
        }
        this.handleGeolocationError(err, false);
      },
      HIGH_ACCURACY_OPTIONS
    );

    // Parallel fast balanced network/A-GPS request while still on simulated default so user never stays stuck on Downtown Cairo
    if (allowFallback && this.currentLocation.isSimulated) {
      navigator.geolocation.getCurrentPosition(
        (balancedPos) => {
          if (!highAccuracyResolved && this.currentLocation.isSimulated) {
            this.processBrowserPosition(balancedPos, false);
          }
        },
        () => {
          // Let primary high-accuracy handler report any error
        },
        BALANCED_FALLBACK_OPTIONS
      );
    }
  }

  private static attachLifecycleRefresh(): void {
    if (this.lifecycleListenersAttached || typeof window === 'undefined' || typeof document === 'undefined') return;
    this.lifecycleListenersAttached = true;

    const refreshOnResume = () => {
      if (this.hasManualOverride) return;
      this.recheckPermissionState(true);
      this.requestCurrentFix(true);
      this.startWatchLoop();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshOnResume();
      }
    });
    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('pageshow', refreshOnResume);
    window.addEventListener('online', refreshOnResume);
  }

  private static startBalancedWatch(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    if (this.balancedWatchId !== null) return;
    try {
      this.balancedWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          // Prefer high-accuracy satellite readings if received recently (<15s)
          if (
            !this.currentLocation.isSimulated &&
            this.lastAcceptedAccuracy !== null &&
            this.lastAcceptedAccuracy <= 80 &&
            Date.now() - this.lastWatchCallbackAt < 15000 &&
            (pos.coords.accuracy || 9999) > 250
          ) {
            return;
          }
          this.processBrowserPosition(pos, true);
        },
        () => {
          // Silent cleanup of secondary balanced watch
          if (this.balancedWatchId !== null) {
            navigator.geolocation.clearWatch(this.balancedWatchId);
            this.balancedWatchId = null;
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 5000,
        }
      );
    } catch {
      this.balancedWatchId = null;
    }
  }

  private static startWatchLoop(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.balancedWatchId !== null) {
      navigator.geolocation.clearWatch(this.balancedWatchId);
      this.balancedWatchId = null;
    }

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.processBrowserPosition(pos, true),
        (err) => {
          // If high-accuracy watch is blocked/times out indoors, ensure fused network watch keeps live updates flowing
          if (err.code === 2 || err.code === 3) {
            this.startBalancedWatch();
          }
          this.handleGeolocationError(err, true);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    } catch (e) {
      console.warn('Geolocation watchPosition threw synchronously:', e);
    }

    // Start secondary balanced fused watch whenever device hasn't locked high-accuracy yet
    if (this.currentLocation.isSimulated || (this.lastAcceptedAccuracy ?? 9999) > 250) {
      this.startBalancedWatch();
    }

    if (this.heartbeatTimer === null && typeof setInterval !== 'undefined') {
      this.heartbeatTimer = setInterval(() => {
        if (this.hasManualOverride || !this.isTracking) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        // Re-check permissions periodically on Android WebView/mobile in case user enabled Location in OS settings
        if (this.lastErrorCode === 'permission_denied') {
          this.recheckPermissionState(true);
          if (this.permissionState === 'denied') return;
        }

        if (Date.now() - this.lastWatchCallbackAt > HEARTBEAT_INTERVAL_MS - 1000) {
          this.requestCurrentFix(true);
          if (this.watchId === null) {
            this.startWatchLoop();
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    }
  }

  // Start live GPS tracking
  static startTracking(onUpdate?: (loc: UserLocation) => void): void {
    if (onUpdate) {
      this.listeners.add(onUpdate);
    }

    if (this.isTracking) {
      if (onUpdate) onUpdate(this.currentLocation);
      return;
    }

    // Immediately emit initial location & status so UI draws promptly
    this.notifyListeners();

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      this.gpsStatus = this.hasManualOverride ? 'manual' : 'unavailable';
      this.lastErrorCode = 'unsupported';
      this.gpsWarningMessage = 'الجهاز لا يدعم GPS التلقائي — يمكنك اختيار منطقتك أو النقر على الخريطة.';
      this.notifyStatusListeners();
      return;
    }

    // Attempt hardware GPS directly even inside APK WebView file:// / local origins
    this.isTracking = true;
    this.attachMedianLibraryReadyHook();
    this.attachPermissionObserver();
    this.attachLifecycleRefresh();
    try {
      void this.promptMedianLocationIfAvailable(false).then((invoked) => {
        if (invoked && !this.hasManualOverride) {
          this.requestCurrentFix(true);
          this.startWatchLoop();
        }
      });
      this.requestCurrentFix(true);
      this.startWatchLoop();
    } catch (e) {
      console.warn('Geolocation tracking error:', e);
      if (!this.isSecureEnvironment() && !this.hasManualOverride) {
        this.gpsStatus = 'denied';
        this.lastErrorCode = 'insecure_context';
        this.gpsWarningMessage = 'يتطلب تحديد الموقع عبر GPS اتصالاً آمناً أو صلاحية الموقع بالتطبيق.';
        this.notifyStatusListeners();
      }
    }
  }

  static stopTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.balancedWatchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.balancedWatchId);
      this.balancedWatchId = null;
    }
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isTracking = false;
  }

  static getLocation(): UserLocation {
    return { ...this.currentLocation };
  }

  static getDiagnostics(): LocationDiagnostics {
    return {
      location: { ...this.currentLocation },
      districtName: this.getDistrictOrCityName(this.currentLocation.lat, this.currentLocation.lng),
      status: this.gpsStatus,
      errorCode: this.lastErrorCode,
      permissionState: this.permissionState,
      hasManualOverride: this.hasManualOverride,
      warningMessage: this.gpsWarningMessage,
      lastBrowserAccuracy: this.lastBrowserAccuracy,
      lastRejectedLocation: this.lastRejectedLocation,
    };
  }

  // Allows user to manually set their position for the current session without permanently locking tomorrow's GPS
  static setManualLocation(lat: number, lng: number, _persist = false): void {
    this.hasManualOverride = true;
    this.gpsStatus = 'manual';
    this.lastErrorCode = null;
    this.gpsWarningMessage = null;

    this.updateLocation({
      lat,
      lng,
      accuracy: 10,
      timestamp: Date.now(),
      isSimulated: true,
    });
  }

  // Explicitly accept the low-accuracy browser location if the user verifies they are actually there
  static acceptRejectedLocation(): boolean {
    if (!this.lastRejectedLocation) return false;
    const { lat, lng, accuracy } = this.lastRejectedLocation;
    this.hasManualOverride = false;
    this.gpsStatus = 'accurate';
    this.lastErrorCode = null;
    this.gpsWarningMessage = null;
    this.updateLocation({
      lat,
      lng,
      accuracy,
      timestamp: Date.now(),
      isSimulated: false,
    });
    return true;
  }

  // Clear manual override and re-request fresh high-accuracy GPS
  static clearManualOverride(): void {
    void this.forceRefreshGPS();
  }

  static async forceRefreshGPS(): Promise<{
    success: boolean;
    status: GpsStatus;
    errorCode: GpsErrorCode | null;
    loc: UserLocation;
    message: string;
  }> {
    this.hasManualOverride = false;
    this.gpsStatus = 'pending';
    this.lastErrorCode = null;
    this.lastAcceptedAccuracy = null;
    this.gpsWarningMessage = null;
    try {
      localStorage.removeItem(LEGACY_MANUAL_LOC_KEY);
    } catch {
      // ignore
    }
    this.notifyStatusListeners();

    // Wait briefly if Median.co / GoNative is displaying a native Android GPS/permission dialog
    await this.promptMedianLocationIfAvailable(true);
    this.recheckPermissionState(false);

    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        this.gpsStatus = 'unavailable';
        this.lastErrorCode = 'unsupported';
        this.gpsWarningMessage = 'الجهاز لا يدعم خدمة GPS.';
        this.notifyStatusListeners();
        resolve({
          success: false,
          status: this.gpsStatus,
          errorCode: this.lastErrorCode,
          loc: this.getLocation(),
          message: this.gpsWarningMessage,
        });
        return;
      }

      let settled = false;
      let balancedTimer: ReturnType<typeof setTimeout> | null = null;
      let lastBalancedPos: GeolocationPosition | null = null;
      let lastRejectionResult: {
        status: GpsStatus;
        errorCode: GpsErrorCode | null;
        message: string;
      } | null = null;

      const finish = (payload: {
        success: boolean;
        status: GpsStatus;
        errorCode: GpsErrorCode | null;
        loc: UserLocation;
        message: string;
      }) => {
        if (settled) return;
        settled = true;
        if (balancedTimer) {
          clearTimeout(balancedTimer);
          balancedTimer = null;
        }
        resolve(payload);
      };

      const acceptPosition = (pos: GeolocationPosition, isApproximateFallback: boolean) => {
        const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          lastRejectionResult = {
            status: 'unavailable',
            errorCode: 'position_unavailable',
            message: 'إحداثيات الـ GPS المستلمة غير صالحة.',
          };
          return false;
        }

        const roundedAccuracy = Math.round(accuracy || 0);
        this.lastBrowserAccuracy = roundedAccuracy;

        if (!this.isWithinEgypt(lat, lng)) {
          this.lastRejectedLocation = {
            lat,
            lng,
            accuracy: roundedAccuracy,
            district: this.getDistrictOrCityName(lat, lng),
          };
          lastRejectionResult = {
            status: 'outside_egypt',
            errorCode: null,
            message:
              'المتصفح أرجع موقعاً خارج مصر (غالباً بسبب شبكة الإنترنت أو VPN). يرجى اختيار منطقتك يدوياً.',
          };
          return false;
        }

        if (accuracy && accuracy > INITIAL_ACCEPTABLE_ACCURACY_METERS) {
          const guessed = this.getDistrictOrCityName(lat, lng);
          this.lastRejectedLocation = {
            lat,
            lng,
            accuracy: roundedAccuracy,
            district: guessed,
          };
          lastRejectionResult = {
            status: 'low_accuracy',
            errorCode: null,
            message: `المتصفح أعاد موقعاً تقريبياً ضعيف الدقة (±${(accuracy / 1000).toFixed(1)} كم في ${guessed}). يرجى اختيار منطقتك أو النقر على الخريطة.`,
          };
          return false;
        }

        this.lastRejectedLocation = null;
        this.lastAcceptedAccuracy = roundedAccuracy;
        this.lastWatchCallbackAt = Date.now();
        this.gpsStatus = roundedAccuracy > 2500 ? 'low_accuracy' : 'accurate';
        this.lastErrorCode = null;
        this.gpsWarningMessage =
          roundedAccuracy > 2500
            ? `تم تحديد المنطقة عبر الشبكة (±${(roundedAccuracy / 1000).toFixed(1)} كم) وجارٍ تحسين دقة الـ GPS...`
            : null;
        if (roundedAccuracy <= 2500) {
          this.saveGpsHint(lat, lng);
        }
        const nextLoc: UserLocation = {
          lat,
          lng,
          accuracy,
          heading,
          speed,
          timestamp: pos.timestamp || Date.now(),
          isSimulated: false,
        };
        this.updateLocation(nextLoc);

        this.isTracking = true;
        this.startWatchLoop();

        const district = this.getDistrictOrCityName(lat, lng);
        const accuracyText =
          roundedAccuracy > 2500
            ? `تقريباً (±${(roundedAccuracy / 1000).toFixed(1)} كم)`
            : `بدقة عالية (±${roundedAccuracy} م)`;
        finish({
          success: true,
          status: this.gpsStatus,
          errorCode: null,
          loc: nextLoc,
          message: isApproximateFallback
            ? `تم تحديد موقعك عبر الشبكة ${accuracyText} في ${district} (جارٍ تحسين الدقة...)`
            : `تم تحديد موقعك ${accuracyText} في ${district}`,
        });
        return true;
      };

      const failWith = (status: GpsStatus, errorCode: GpsErrorCode | null, message: string) => {
        this.gpsStatus = status;
        this.lastErrorCode = errorCode;
        this.gpsWarningMessage = message;
        this.notifyStatusListeners();
        finish({
          success: false,
          status,
          errorCode,
          loc: this.getLocation(),
          message,
        });
      };

      const handleFailure = (err: GeolocationPositionError) => {
        if (lastBalancedPos && acceptPosition(lastBalancedPos, true)) {
          return;
        }
        if (lastRejectionResult) {
          failWith(lastRejectionResult.status, lastRejectionResult.errorCode, lastRejectionResult.message);
          return;
        }
        const mapped = this.mapGeolocationError(err);
        failWith(mapped.status, mapped.code, mapped.message);
      };

      // Race balanced network/A-GPS in parallel so indoor locks take ~1-2s instead of timing out after 22s
      navigator.geolocation.getCurrentPosition(
        (balancedPos) => {
          lastBalancedPos = balancedPos;
          if (settled) return;
          const acc = balancedPos.coords.accuracy || 9999;
          // If balanced reading is already accurate (<150m), accept immediately; otherwise wait up to 2.5s for high-accuracy GPS
          if (acc <= 150) {
            acceptPosition(balancedPos, false);
          } else if (!balancedTimer) {
            balancedTimer = setTimeout(() => {
              if (!settled && lastBalancedPos) {
                acceptPosition(lastBalancedPos, true);
              }
            }, 2500);
          }
        },
        () => {
          // Ignore secondary error; primary high-accuracy handler handles fallback & reporting
        },
        BALANCED_FALLBACK_OPTIONS
      );

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!acceptPosition(pos, false) && lastRejectionResult) {
            failWith(lastRejectionResult.status, lastRejectionResult.errorCode, lastRejectionResult.message);
          }
        },
        (err) => {
          if (lastBalancedPos && acceptPosition(lastBalancedPos, true)) {
            return;
          }
          if (err.code === 3 || err.code === 2) {
            navigator.geolocation.getCurrentPosition(
              (fallbackPos) => {
                if (!acceptPosition(fallbackPos, true) && lastRejectionResult) {
                  failWith(lastRejectionResult.status, lastRejectionResult.errorCode, lastRejectionResult.message);
                }
              },
              handleFailure,
              BALANCED_FALLBACK_OPTIONS
            );
            return;
          }
          handleFailure(err);
        },
        HIGH_ACCURACY_OPTIONS
      );
    });
  }

  static subscribe(listener: (loc: UserLocation) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentLocation);
    return () => this.listeners.delete(listener);
  }

  static subscribeStatus(listener: (diag: LocationDiagnostics) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getDiagnostics());
    return () => this.statusListeners.delete(listener);
  }

  private static updateLocation(loc: UserLocation): void {
    this.currentLocation = loc;
    this.notifyListeners();
    this.notifyStatusListeners();
  }

  private static notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentLocation);
      } catch (e) {
        console.error('Error in location listener', e);
      }
    }
  }

  private static notifyStatusListeners(): void {
    const diag = this.getDiagnostics();
    for (const listener of this.statusListeners) {
      try {
        listener(diag);
      } catch (e) {
        console.error('Error in location status listener', e);
      }
    }
  }

  // Find the closest station to current location
  static getNearestStation(
    userLoc: UserLocation,
    stations: Station[],
    filterFn?: (s: Station) => boolean
  ): Station | null {
    if (!stations || stations.length === 0) return null;

    let closest: Station | null = null;
    let minDistance = Infinity;

    for (const station of stations) {
      if (filterFn && !filterFn(station)) continue;
      const lat = Number(station.lat);
      const lng = Number(station.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !this.isWithinEgypt(lat, lng)) continue;

      const dist = this.getDistanceKm(userLoc.lat, userLoc.lng, lat, lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = {
          ...station,
          lat,
          lng,
          distanceKm: dist,
        };
      }
    }

    return closest;
  }

  // Sorts stations ascending by distance from user
  static sortStationsByDistance(userLoc: UserLocation, stations: Station[]): Station[] {
    return stations
      .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
      .map((station) => {
        const lat = Number(station.lat);
        const lng = Number(station.lng);
        const dist = this.getDistanceKm(userLoc.lat, userLoc.lng, lat, lng);
        const estMinutes = Math.max(1, Math.round((dist / 35) * 60));
        return {
          ...station,
          lat,
          lng,
          distanceKm: dist,
          durationMin: estMinutes,
        };
      })
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }
}
