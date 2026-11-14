export interface UserIconsVisibility {
  nearestStation: boolean;
  offlineMap: boolean;
  installPwa: boolean;
  stationsList: boolean;
  themeToggle: boolean;
  networkBadge: boolean;
  locationBadge: boolean;
  mapSearch: boolean;
  recenterGps: boolean;
  zoomControls: boolean;
  fitAllStations: boolean;
  quickList: boolean;
  mapLayerToggle: boolean;
}

export interface AppConfig {
  appName: string;
  appShortName: string;
  appSubtitle: string;
  appDescription: string;
  splashAppTitle: string;
  splashAppMessage: string;
  splashAppLoadingText: string;
  splashStationTitle: string;
  splashStationMessage: string;
  splashStationLoadingText: string;
  adminPassword: string;
  mapNightModeDisabled: boolean;
  enableMultiCompanyMode: boolean;
  visibleCompanies: string[];
  userIcons: UserIconsVisibility;
}

export const DEFAULT_USER_ICONS: UserIconsVisibility = {
  nearestStation: true,
  offlineMap: true,
  installPwa: true,
  stationsList: true,
  themeToggle: true,
  networkBadge: true,
  locationBadge: true,
  mapSearch: true,
  recenterGps: true,
  zoomControls: true,
  fitAllStations: true,
  quickList: true,
  mapLayerToggle: true,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: 'محطات كارجاس',
  appShortName: 'كارجاس',
  appSubtitle: 'الأقرب لك دائماً',
  appDescription: 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
  splashAppTitle: 'محطات كارجاس',
  splashAppMessage: 'الأقرب لك دائماً',
  splashAppLoadingText: 'جارٍ تهيئة الخريطة وقاعدة المحطات...',
  splashStationTitle: 'محطات غاز كارجاس',
  splashStationMessage: 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
  splashStationLoadingText: 'جارٍ تحميل محطات كارجاس على الخريطة...',
  adminPassword: '0000',
  mapNightModeDisabled: true,
  enableMultiCompanyMode: false,
  visibleCompanies: [],
  userIcons: { ...DEFAULT_USER_ICONS },
};

/**
 * الإعدادات المعتمدة والمثبتة في الكود المصدري (تُقرأ مباشرة في Vercel و APK)
 */
export const BAKED_APP_CONFIG: AppConfig = {
  "appName": "محطات كارجاس",
  "appShortName": "كارجاس",
  "appSubtitle": "الأقرب لك دائماً",
  "appDescription": "الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين",
  "splashAppTitle": "محطات كارجاس",
  "splashAppMessage": "الأقرب لك دائماً",
  "splashAppLoadingText": "جارٍ تهيئة الخريطة وقاعدة المحطات...",
  "splashStationTitle": "محطات كارجاس",
  "splashStationMessage": "شبكة محطات تموين كارجاس • جاهز للعمل أوفلاين",
  "splashStationLoadingText": "جارٍ تحميل محطات كارجاس على الخريطة...",
  "adminPassword": "0000",
  "mapNightModeDisabled": true,
  "enableMultiCompanyMode": false,
  "visibleCompanies": [],
  "userIcons": {
    "nearestStation": true,
    "offlineMap": true,
    "installPwa": false,
    "stationsList": true,
    "themeToggle": true,
    "networkBadge": true,
    "locationBadge": true,
    "mapSearch": true,
    "recenterGps": true,
    "zoomControls": true,
    "fitAllStations": true,
    "quickList": true,
    "mapLayerToggle": true
  }
};
