import {
  AppConfig,
  BAKED_APP_CONFIG,
  DEFAULT_APP_CONFIG,
  DEFAULT_USER_ICONS,
  UserIconsVisibility,
} from '../config/appConfig';

const STORAGE_KEY_CONFIG = 'cargas_app_config_v1';
const STORAGE_KEY_BAKED_CONFIG_SIG = 'cargas_baked_config_sig_v1';
export const APP_CONFIG_UPDATED_EVENT = 'cargas-app-config-updated';

const isDevEnvironment = (): boolean => Boolean(import.meta.env.DEV);

let configWriteQueue: Promise<void> = Promise.resolve();

function computeConfigSignature(cfg: AppConfig): string {
  return JSON.stringify(normalizeConfig(cfg));
}

export function normalizeConfig(raw?: Partial<AppConfig> | null): AppConfig {
  const iconsRaw = (raw?.userIcons || {}) as Partial<UserIconsVisibility>;
  return {
    appName:
      typeof raw?.appName === 'string' && raw.appName.trim()
        ? raw.appName.trim()
        : DEFAULT_APP_CONFIG.appName,
    appShortName:
      typeof raw?.appShortName === 'string' && raw.appShortName.trim()
        ? raw.appShortName.trim()
        : DEFAULT_APP_CONFIG.appShortName,
    appSubtitle:
      typeof raw?.appSubtitle === 'string' ? raw.appSubtitle.trim() : DEFAULT_APP_CONFIG.appSubtitle,
    appDescription:
      typeof raw?.appDescription === 'string' && raw.appDescription.trim()
        ? raw.appDescription.trim()
        : DEFAULT_APP_CONFIG.appDescription,
    adminPassword:
      typeof raw?.adminPassword === 'string' && raw.adminPassword.trim().length > 0
        ? raw.adminPassword.trim()
        : DEFAULT_APP_CONFIG.adminPassword,
    // Always disabled per user requirement: street map stays in bright street mode
    mapNightModeDisabled: true,
    userIcons: {
      nearestStation: iconsRaw.nearestStation ?? DEFAULT_USER_ICONS.nearestStation,
      offlineMap: iconsRaw.offlineMap ?? DEFAULT_USER_ICONS.offlineMap,
      installPwa: iconsRaw.installPwa ?? DEFAULT_USER_ICONS.installPwa,
      stationsList: iconsRaw.stationsList ?? DEFAULT_USER_ICONS.stationsList,
      themeToggle: iconsRaw.themeToggle ?? DEFAULT_USER_ICONS.themeToggle,
      networkBadge: iconsRaw.networkBadge ?? DEFAULT_USER_ICONS.networkBadge,
      locationBadge: iconsRaw.locationBadge ?? DEFAULT_USER_ICONS.locationBadge,
      mapSearch: iconsRaw.mapSearch ?? DEFAULT_USER_ICONS.mapSearch,
      recenterGps: iconsRaw.recenterGps ?? DEFAULT_USER_ICONS.recenterGps,
      zoomControls: iconsRaw.zoomControls ?? DEFAULT_USER_ICONS.zoomControls,
      fitAllStations: iconsRaw.fitAllStations ?? DEFAULT_USER_ICONS.fitAllStations,
      quickList: iconsRaw.quickList ?? DEFAULT_USER_ICONS.quickList,
    },
  };
}

export class AppConfigService {
  private static memoryConfig: AppConfig | null = null;

  static getConfig(): AppConfig {
    if (this.memoryConfig) return this.memoryConfig;

    const baked = normalizeConfig(BAKED_APP_CONFIG);

    // Production / Vercel / APK: always strictly use baked source config
    if (!isDevEnvironment()) {
      this.memoryConfig = baked;
      return baked;
    }

    try {
      const storedRaw = localStorage.getItem(STORAGE_KEY_CONFIG);
      const lastBakedSig = localStorage.getItem(STORAGE_KEY_BAKED_CONFIG_SIG);
      const currentBakedSig = computeConfigSignature(baked);

      if (lastBakedSig && lastBakedSig !== currentBakedSig) {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(baked));
        localStorage.setItem(STORAGE_KEY_BAKED_CONFIG_SIG, currentBakedSig);
        this.memoryConfig = baked;
        return baked;
      }

      if (storedRaw) {
        const parsed = normalizeConfig(JSON.parse(storedRaw) as Partial<AppConfig>);
        this.memoryConfig = parsed;
        if (!lastBakedSig) {
          localStorage.setItem(STORAGE_KEY_BAKED_CONFIG_SIG, currentBakedSig);
        }
        return parsed;
      }
    } catch {
      // ignore storage read error
    }

    this.memoryConfig = baked;
    return baked;
  }

  static async initializeConfigSync(): Promise<AppConfig> {
    const current = this.getConfig();
    const baked = normalizeConfig(BAKED_APP_CONFIG);

    if (isDevEnvironment() && (typeof navigator === 'undefined' || navigator.onLine)) {
      if (computeConfigSignature(current) !== computeConfigSignature(baked)) {
        await this.saveConfigToSourceCode(current);
      }
    }
    this.applyDocumentBranding(current);
    return current;
  }

  static saveConfig(
    nextConfig: Partial<AppConfig>,
    options?: { skipSourceSync?: boolean }
  ): AppConfig {
    const current = this.getConfig();
    const merged = normalizeConfig({
      ...current,
      ...nextConfig,
      userIcons: {
        ...current.userIcons,
        ...(nextConfig.userIcons || {}),
      },
    });

    this.memoryConfig = merged;

    if (isDevEnvironment()) {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(merged));
        localStorage.setItem(STORAGE_KEY_BAKED_CONFIG_SIG, computeConfigSignature(normalizeConfig(BAKED_APP_CONFIG)));
      } catch (e) {
        console.warn('Failed to persist app config to localStorage:', e);
      }
    }

    this.applyDocumentBranding(merged);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(APP_CONFIG_UPDATED_EVENT, { detail: merged }));
    }

    if (isDevEnvironment() && !options?.skipSourceSync && (typeof navigator === 'undefined' || navigator.onLine)) {
      void this.saveConfigToSourceCode(merged);
    }

    return merged;
  }

  static applyDocumentBranding(config: AppConfig): void {
    if (typeof document === 'undefined') return;
    const fullTitle = config.appSubtitle ? `${config.appName} (${config.appSubtitle})` : config.appName;
    document.title = fullTitle;

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', fullTitle);

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute('content', config.appShortName || config.appName);

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.setAttribute('content', config.appDescription);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', config.appDescription);
  }

  static onConfigUpdated(callback: (config: AppConfig) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<AppConfig>;
      callback(customEvent.detail || this.getConfig());
    };
    window.addEventListener(APP_CONFIG_UPDATED_EVENT, handler);
    return () => window.removeEventListener(APP_CONFIG_UPDATED_EVENT, handler);
  }

  static saveConfigToSourceCode(
    config?: AppConfig
  ): Promise<{ success: boolean; unchanged?: boolean; message: string }> {
    const normalized = normalizeConfig(config ?? this.getConfig());
    const task = configWriteQueue.then(async () => {
      try {
        const response = await fetch('/api/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: normalized }),
        });
        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}`);
        }
        const data = await response.json();
        if (isDevEnvironment()) {
          try {
            localStorage.setItem(STORAGE_KEY_BAKED_CONFIG_SIG, computeConfigSignature(normalized));
          } catch {
            // ignore
          }
        }
        return {
          success: true,
          unchanged: Boolean(data.unchanged),
          message: data.message || 'تم حفظ وتثبيت إعدادات التطبيق في الكود المصدري بنجاح!',
        };
      } catch (e: any) {
        console.warn('Direct config save via API failed:', e);
        return {
          success: false,
          message: e?.message || 'تعذر حفظ إعدادات التطبيق في الكود المصدري',
        };
      }
    });
    configWriteQueue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  static generateConfigSourceCode(config?: AppConfig): string {
    const c = normalizeConfig(config ?? this.getConfig());
    return `export interface UserIconsVisibility {
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
export const BAKED_APP_CONFIG: AppConfig = ${JSON.stringify(c, null, 2)};
`;
  }
}
