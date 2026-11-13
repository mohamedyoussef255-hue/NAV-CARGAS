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

const STORAGE_KEY_MANUAL_LOC = 'cargas_user_manual_loc_v2';
// Browser IP/cell-tower geolocation frequently reports ISP/hub centers (e.g. Benha/Menoufia) with accuracy > 600m.
const MAX_ACCEPTABLE_ACCURACY_METERS = 600;
const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};
const BALANCED_FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 10000,
};

export class LocationService {
  private static watchId: number | null = null;
  private static hasManualOverride = false;
  private static gpsStatus: GpsStatus = 'pending';
  private static lastErrorCode: GpsErrorCode | null = null;
  private static permissionState: PermissionState | 'unsupported' = 'unsupported';
  private static permissionObserverAttached = false;
  private static gpsWarningMessage: string | null = null;
  private static lastBrowserAccuracy: number | null = null;
  private static lastAcceptedAccuracy: number | null = null;
  private static lastRejectedLocation: RejectedBrowserLocation | null = null;
  private static currentLocation: UserLocation = LocationService.initInitialLocation();
  private static listeners: Set<(loc: UserLocation) => void> = new Set();
  private static statusListeners: Set<(diag: LocationDiagnostics) => void> = new Set();
  private static isTracking = false;

  private static initInitialLocation(): UserLocation {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MANUAL_LOC);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          LocationService.isWithinEgypt(parsed.lat, parsed.lng)
        ) {
          LocationService.hasManualOverride = true;
          LocationService.gpsStatus = 'manual';
          return {
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: 10,
            timestamp: Date.now(),
            isSimulated: true,
          };
        }
      }
    } catch {
      // ignore storage errors
    }

    // Guaranteed Default: Cairo Downtown / Tahrir Square
    LocationService.gpsStatus = 'pending';
    return {
      lat: 30.0444,
      lng: 31.2357,
      accuracy: 25,
      timestamp: Date.now(),
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

  private static mapGeolocationError(err: GeolocationPositionError): {
    status: GpsStatus;
    code: GpsErrorCode;
    message: string;
  } {
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        return {
          status: 'denied',
          code: 'permission_denied',
          message:
            'تم رفض إذن الوصول للموقع. يرجى تفعيل صلاحية الموقع (Location) من إعدادات المتصفح بجانب شريط العنوان، أو تحديد موقعك يدوياً.',
        };
      case 2: // POSITION_UNAVAILABLE
        return {
          status: 'unavailable',
          code: 'position_unavailable',
          message:
            'تعذر التقاط إشارة الـ GPS أو تحديد الموقع من الجهاز حالياً. تأكد من تفعيل خدمة الموقع (GPS) أو اختر منطقتك يدوياً.',
        };
      case 3: // TIMEOUT
        return {
          status: 'timeout',
          code: 'timeout',
          message:
            'انتهت مهلة انتظار إشارة الـ GPS عالية الدقة. تأكد من وجودك في مكان مفتوح أو حدد موقعك على الخريطة.',
        };
      default:
        return {
          status: 'unavailable',
          code: 'unknown',
          message: `حدث خطأ أثناء تحديد الموقع (${err.message || 'غير معروف'}). يمكنك تحديد موقعك يدوياً.`,
        };
    }
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
            this.requestCurrentFix(true);
          } else if (permStatus.state === 'denied' && !this.hasManualOverride) {
            this.gpsStatus = 'denied';
            this.lastErrorCode = 'permission_denied';
            this.gpsWarningMessage =
              'تم رفض إذن الوصول للموقع من المتصفح. يمكنك تفعيل الصلاحية أو اختيار موقعك يدوياً.';
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

    // 2. Reject low-accuracy ISP/IP geolocation (e.g. reporting Menoufia/Delta from Cairo with >1.5km accuracy)
    if (accuracy && accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      const guessedDistrict = this.getDistrictOrCityName(lat, lng);
      this.lastRejectedLocation = {
        lat,
        lng,
        accuracy: roundedAccuracy,
        district: guessedDistrict,
      };
      this.gpsStatus = 'low_accuracy';
      this.lastErrorCode = null;
      this.gpsWarningMessage = `دقة GPS المتصفح ضعيفة (±${(accuracy / 1000).toFixed(1)} كم في ${guessedDistrict}) — تم الإبقاء على موقع القاهرة لتجنب الخطأ. يمكنك تحديد موقعك بدقة من هنا.`;
      this.notifyStatusListeners();
      return;
    }

    // 3. During continuous watchPosition updates, prevent sudden accuracy regression unless previous fix is >30s old
    if (
      isWatchUpdate &&
      this.lastAcceptedAccuracy !== null &&
      roundedAccuracy > this.lastAcceptedAccuracy * 2 &&
      roundedAccuracy > 80 &&
      Date.now() - (this.currentLocation.timestamp || 0) < 30000
    ) {
      return;
    }

    // 4. Ignore tiny sub-5m GPS drift jitter when already locked at high accuracy
    if (
      isWatchUpdate &&
      !this.currentLocation.isSimulated &&
      this.lastAcceptedAccuracy !== null &&
      roundedAccuracy >= this.lastAcceptedAccuracy
    ) {
      const movedMeters =
        this.getDistanceKm(this.currentLocation.lat, this.currentLocation.lng, lat, lng) * 1000;
      if (movedMeters < 5) {
        return;
      }
    }

    // 5. Accept high-accuracy GPS location inside Egypt
    this.lastRejectedLocation = null;
    this.lastAcceptedAccuracy = roundedAccuracy;
    this.gpsStatus = 'accurate';
    this.lastErrorCode = null;
    this.gpsWarningMessage = null;
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

    // If watch fails temporarily with timeout after we already have an accurate fix, keep the existing fix silently
    if (isWatchError && this.gpsStatus === 'accurate' && mapped.code === 'timeout') {
      return;
    }

    if (!this.hasManualOverride) {
      this.gpsStatus = mapped.status;
      this.lastErrorCode = mapped.code;
      this.gpsWarningMessage = mapped.message;
      this.notifyStatusListeners();
    }
  }

  private static requestCurrentFix(allowTimeoutFallback = true): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => this.processBrowserPosition(pos, false),
      (err) => {
        // If high-accuracy GPS times out indoors, retry once with balanced accuracy before reporting failure
        if (allowTimeoutFallback && err.code === 3) {
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
  }

  private static startWatchLoop(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.processBrowserPosition(pos, true),
      (err) => this.handleGeolocationError(err, true),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 2000,
      }
    );
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
      this.gpsWarningMessage = 'المتصفح لا يدعم GPS التلقائي — يمكنك اختيار منطقتك أو النقر على الخريطة.';
      this.notifyStatusListeners();
      return;
    }

    if (!this.isSecureEnvironment()) {
      this.gpsStatus = this.hasManualOverride ? 'manual' : 'denied';
      this.lastErrorCode = 'insecure_context';
      this.gpsWarningMessage = 'يتطلب تحديد الموقع عبر GPS اتصالاً آمناً (HTTPS). يمكنك تحديد موقعك يدوياً من الخريطة.';
      this.notifyStatusListeners();
      return;
    }

    this.isTracking = true;
    this.attachPermissionObserver();
    this.requestCurrentFix(true);
    this.startWatchLoop();
  }

  static stopTracking(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
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

  // Allows user to manually set their exact position (from preset, Nominatim search, map click, or pin drag)
  static setManualLocation(lat: number, lng: number, persist = true): void {
    this.hasManualOverride = true;
    this.gpsStatus = 'manual';
    this.lastErrorCode = null;
    this.gpsWarningMessage = null;

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY_MANUAL_LOC, JSON.stringify({ lat, lng }));
      } catch {
        // ignore
      }
    }

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
    this.hasManualOverride = true;
    this.gpsStatus = 'manual';
    this.lastErrorCode = null;
    this.gpsWarningMessage = null;
    try {
      localStorage.setItem(STORAGE_KEY_MANUAL_LOC, JSON.stringify({ lat, lng }));
    } catch {
      // ignore
    }
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

  static forceRefreshGPS(): Promise<{
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
      localStorage.removeItem(STORAGE_KEY_MANUAL_LOC);
    } catch {
      // ignore
    }
    this.notifyStatusListeners();

    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        this.gpsStatus = 'unavailable';
        this.lastErrorCode = 'unsupported';
        this.gpsWarningMessage = 'المتصفح لا يدعم خدمة GPS.';
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

      if (!this.isSecureEnvironment()) {
        this.gpsStatus = 'denied';
        this.lastErrorCode = 'insecure_context';
        this.gpsWarningMessage = 'يتطلب تحديد الموقع عبر GPS اتصالاً آمناً (HTTPS).';
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

      const handleSuccess = (pos: GeolocationPosition) => {
        const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          this.gpsStatus = 'unavailable';
          this.lastErrorCode = 'position_unavailable';
          this.gpsWarningMessage = 'إحداثيات الـ GPS المستلمة غير صالحة.';
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

        const roundedAccuracy = Math.round(accuracy || 0);
        this.lastBrowserAccuracy = roundedAccuracy;

        if (!this.isWithinEgypt(lat, lng)) {
          this.lastRejectedLocation = {
            lat,
            lng,
            accuracy: roundedAccuracy,
            district: this.getDistrictOrCityName(lat, lng),
          };
          this.gpsStatus = 'outside_egypt';
          this.lastErrorCode = null;
          this.gpsWarningMessage = 'المتصفح أرجع موقعاً خارج مصر (غالباً بسبب شبكة الإنترنت أو الخادم). يرجى اختيار منطقتك يدوياً.';
          this.notifyStatusListeners();
          resolve({
            success: false,
            status: this.gpsStatus,
            errorCode: null,
            loc: this.getLocation(),
            message: this.gpsWarningMessage,
          });
          return;
        }

        if (accuracy && accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
          const guessed = this.getDistrictOrCityName(lat, lng);
          this.lastRejectedLocation = {
            lat,
            lng,
            accuracy: roundedAccuracy,
            district: guessed,
          };
          this.gpsStatus = 'low_accuracy';
          this.lastErrorCode = null;
          this.gpsWarningMessage = `المتصفح أعاد موقعاً تقريبياً ضعيف الدقة (±${(accuracy / 1000).toFixed(1)} كم في ${guessed}). يرجى اختيار منطقتك أو النقر على الخريطة.`;
          this.notifyStatusListeners();
          resolve({
            success: false,
            status: this.gpsStatus,
            errorCode: null,
            loc: this.getLocation(),
            message: this.gpsWarningMessage,
          });
          return;
        }

        this.lastRejectedLocation = null;
        this.lastAcceptedAccuracy = roundedAccuracy;
        this.gpsStatus = 'accurate';
        this.lastErrorCode = null;
        this.gpsWarningMessage = null;
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

        // Ensure live continuous watch is running cleanly after manual refresh
        this.isTracking = true;
        this.startWatchLoop();

        resolve({
          success: true,
          status: 'accurate',
          errorCode: null,
          loc: nextLoc,
          message: `تم تحديد موقعك بدقة عالية (±${roundedAccuracy} م) في ${this.getDistrictOrCityName(lat, lng)}`,
        });
      };

      const handleFailure = (err: GeolocationPositionError) => {
        const mapped = this.mapGeolocationError(err);
        this.gpsStatus = mapped.status;
        this.lastErrorCode = mapped.code;
        this.gpsWarningMessage = mapped.message;
        this.notifyStatusListeners();
        resolve({
          success: false,
          status: mapped.status,
          errorCode: mapped.code,
          loc: this.getLocation(),
          message: mapped.message,
        });
      };

      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (err) => {
          // On TIMEOUT with enableHighAccuracy: true, try balanced fallback before reporting timeout
          if (err.code === 3) {
            navigator.geolocation.getCurrentPosition(handleSuccess, handleFailure, BALANCED_FALLBACK_OPTIONS);
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
