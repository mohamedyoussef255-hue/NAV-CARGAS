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
}

export interface AppConfig {
  appName: string;
  appShortName: string;
  appSubtitle: string;
  appDescription: string;
  adminPassword: string;
  mapNightModeDisabled: boolean;
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
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: 'محطات كارجاس',
  appShortName: 'كارجاس',
  appSubtitle: 'الأقرب لك دائماً',
  appDescription: 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
  adminPassword: '0000',
  mapNightModeDisabled: true,
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
  "adminPassword": "0000",
  "mapNightModeDisabled": true,
  "userIcons": {
    "nearestStation": true,
    "offlineMap": true,
    "installPwa": true,
    "stationsList": true,
    "themeToggle": true,
    "networkBadge": true,
    "locationBadge": true,
    "mapSearch": true,
    "recenterGps": true,
    "zoomControls": true,
    "fitAllStations": true,
    "quickList": true
  }
};
