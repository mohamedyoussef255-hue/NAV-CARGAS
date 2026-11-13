export interface StationServices {
  hasConversionCenter: boolean; // مركز تحويل وصيانة
  hasLubeCenter: boolean;       // مركز زيوت متخصص
  hasCanopyOil: boolean;        // زيوت أسفل المظلة
  hasCylinderTesting: boolean;  // مركز فحص واختبار أسطوانات
  hasFastService?: boolean;     // خدمات سريعة / كافيه / سوبرماركت
  cngPumps?: number;            // عدد نقاط تموين الغاز
}

export interface Station {
  id: string;
  name: string;
  stationName?: string;
  company: string; // كارجاس (Cargas) أو غازتك أو غيرها
  governorate: string; // المحافظة
  city: string; // الحي أو المدينة
  address: string; // العنوان التفصيلي
  lat: number; // خط العرض
  lng: number; // خط الطول
  latitude?: number;
  longitude?: number;
  phone: string; // رقم الهاتف / الخط الساخن
  operatingHours: string; // مواعيد العمل
  services: StationServices;
  logoUrl?: string; // شعار مخصص للمحطة إذا وجد
  notes?: string;
  distanceKm?: number; // المسافة المحسوبة من موقع المستخدم
  durationMin?: number; // الوقت المتوقع بالسيارة
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  isSimulated?: boolean;
}

export interface RouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  name?: string;
}

export interface RouteData {
  coordinates: [number, number][]; // [lat, lng] array for Leaflet
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
  summary: string;
}

export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
  theme: ThemeMode;
  customLogoUrl: string | null;
  autoStartGps: boolean;
  voiceGuidance: boolean;
  lastUpdated: number;
}
