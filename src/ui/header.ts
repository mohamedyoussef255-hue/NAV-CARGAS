import { StationStorage } from '../services/stationStorage';
import { AppConfigService } from '../services/appConfigService';
import { AppConfig } from '../config/appConfig';
import { SoundService } from '../services/soundService';
import { PwaService, PwaState } from '../services/pwaService';
import { DEFAULT_CARGAS_LOGO_DATA_URL } from '../assets/cargasLogo';
import { escapeHtml } from '../utils/html';

export class HeaderComponent {
  private logoClickCount = 0;
  private logoClickTimer: any = null;
  private enableSecretAdmin: boolean;
  private onTriggerAdminCallback?: () => void;
  private onFindNearestCallback: () => void;
  private onOpenListCallback: () => void;
  private onToggleThemeCallback: () => void;
  private onOpenOfflineMapCallback?: () => void;
  private onInstallAppCallback?: () => void;

  constructor(handlers: {
    enableSecretAdmin?: boolean;
    onTriggerAdmin?: () => void;
    onFindNearest: () => void;
    onOpenList: () => void;
    onToggleTheme: () => void;
    onOpenOfflineMap?: () => void;
    onInstallApp?: () => void;
  }) {
    this.enableSecretAdmin = Boolean(handlers.enableSecretAdmin);
    this.onTriggerAdminCallback = handlers.onTriggerAdmin;
    this.onFindNearestCallback = handlers.onFindNearest;
    this.onOpenListCallback = handlers.onOpenList;
    this.onToggleThemeCallback = handlers.onToggleTheme;
    this.onOpenOfflineMapCallback = handlers.onOpenOfflineMap;
    this.onInstallAppCallback = handlers.onInstallApp;
  }

  render(container: HTMLElement): void {
    const currentTheme = StationStorage.getTheme();
    const appLogo = StationStorage.getAppLogo();
    const pwa = PwaService.getState();
    const cfg = AppConfigService.getConfig();
    const icons = cfg.userIcons;

    container.innerHTML = `
      <header class="app-header shadow-lg z-30 transition-colors duration-200">
        <div class="header-inner max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
          
          <!-- Logo & Brand -->
          <div class="flex items-center gap-2.5 select-none group" id="header-logo-trigger" title="${escapeHtml(cfg.appName)}">
            <div class="logo-box relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center p-1 transition-transform shadow-lg border border-emerald-500/40 bg-slate-900/90 ring-2 ring-emerald-500/20">
              <div id="header-logo-img-wrapper" class="w-full h-full flex items-center justify-center overflow-hidden rounded-xl">
                <img src="${appLogo}" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="App Logo" class="w-full h-full object-contain drop-shadow" />
              </div>
            </div>

            <div class="flex flex-col text-right">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h1 id="header-app-title" class="text-base sm:text-lg font-black tracking-tight leading-none brand-title">
                  ${escapeHtml(cfg.appName)}
                </h1>
                <span id="header-app-subtitle" class="${cfg.appSubtitle ? 'inline-flex' : 'hidden'} text-[11px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-full leading-none">
                  ${cfg.appSubtitle ? `(${escapeHtml(cfg.appSubtitle)})` : ''}
                </span>
                <span id="network-status-badge" class="${icons.networkBadge ? 'inline-flex' : 'hidden'} items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  pwa.isOnline
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }">
                  <span class="w-1.5 h-1.5 rounded-full ${pwa.isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}"></span>
                  <span id="network-status-text">${pwa.isOnline ? 'متصل (Online)' : 'وضع الأوفلاين نشط (Offline Mode Ready)'}</span>
                </span>
              </div>
              <span id="header-app-description" class="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                ${escapeHtml(cfg.appDescription)}
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            
            <!-- Quick Nearest Station Button -->
            <button 
              id="btn-nearest-station"
              class="btn-nearest ${icons.nearestStation ? 'flex' : 'hidden'} items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-900/30 transition-all active:scale-95"
              title="تحديد وتوجيه إلى أقرب محطة من موقعي الحالي"
            >
              <svg class="w-4 h-4 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
              <span>أقرب محطة كارجاس</span>
            </button>

            <!-- Download Offline Map Button -->
            <button
              id="btn-offline-map"
              class="btn-icon ${icons.offlineMap ? 'flex' : 'hidden'} px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl items-center gap-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 transition-all"
              title="تحميل خريطة مصر للعمل أوفلاين"
            >
              <span>🗺️</span>
              <span class="hidden lg:inline">تحميل خريطة مصر للعمل أوفلاين</span>
              <span class="lg:hidden">خريطة أوفلاين</span>
            </button>

            <!-- PWA Install Button (hidden automatically when installed in standalone mode or disabled in settings) -->
            <button
              id="btn-install-pwa"
              class="${icons.installPwa && !pwa.isInstalled ? 'flex' : 'hidden'} items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs font-bold bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 transition-all"
              title="تثبيت التطبيق للعمل أوفلاين"
            >
              <span>📲</span>
              <span class="hidden xl:inline">تثبيت التطبيق للعمل أوفلاين</span>
              <span class="xl:hidden">تثبيت أوفلاين</span>
            </button>

            <!-- All Stations List / Search Modal Button -->
            <button
              id="btn-open-list"
              class="btn-icon ${icons.stationsList ? 'flex' : 'hidden'} p-2 sm:px-3 sm:py-2 rounded-xl items-center gap-1.5 text-xs font-bold transition-all"
              title="دليل وبحث المحطات"
            >
              <svg class="w-4 h-4 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              <span class="hidden md:inline">قائمة المحطات</span>
            </button>

            <!-- Dark / Light Mode UI Toggle -->
            <button
              id="btn-toggle-theme"
              class="btn-icon ${icons.themeToggle ? 'flex' : 'hidden'} p-2 rounded-xl text-slate-300 hover:text-white transition-all"
              title="التبديل بين مظهر الواجهة الليلي والنهاري"
            >
              <span id="theme-icon-container">
                ${
                  currentTheme === 'dark'
                    ? `<svg class="w-5 h-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>`
                    : `<svg class="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>`
                }
              </span>
            </button>

          </div>
        </div>
      </header>
    `;

    this.attachEventListeners(container);
  }

  applyConfig(container: HTMLElement, cfg: AppConfig): void {
    const titleEl = container.querySelector('#header-app-title');
    if (titleEl) titleEl.textContent = cfg.appName;

    const triggerEl = container.querySelector('#header-logo-trigger');
    if (triggerEl) triggerEl.setAttribute('title', cfg.appName);

    const subEl = container.querySelector('#header-app-subtitle');
    if (subEl) {
      if (cfg.appSubtitle) {
        subEl.textContent = `(${cfg.appSubtitle})`;
        subEl.classList.remove('hidden');
        subEl.classList.add('inline-flex');
      } else {
        subEl.textContent = '';
        subEl.classList.add('hidden');
        subEl.classList.remove('inline-flex');
      }
    }

    const descEl = container.querySelector('#header-app-description');
    if (descEl) descEl.textContent = cfg.appDescription;

    const icons = cfg.userIcons;
    const pwa = PwaService.getState();

    const toggleFlex = (selector: string, show: boolean, displayClass = 'flex') => {
      const el = container.querySelector(selector);
      if (!el) return;
      el.classList.toggle('hidden', !show);
      el.classList.toggle(displayClass, show);
    };

    toggleFlex('#btn-nearest-station', icons.nearestStation, 'flex');
    toggleFlex('#btn-offline-map', icons.offlineMap, 'flex');
    toggleFlex('#btn-install-pwa', icons.installPwa && !pwa.isInstalled, 'flex');
    toggleFlex('#btn-open-list', icons.stationsList, 'flex');
    toggleFlex('#btn-toggle-theme', icons.themeToggle, 'flex');
    toggleFlex('#network-status-badge', icons.networkBadge, 'inline-flex');
  }

  updatePwaState(container: HTMLElement, pwa: PwaState): void {
    const cfg = AppConfigService.getConfig();
    const badge = container.querySelector('#network-status-badge');
    const text = container.querySelector('#network-status-text');
    if (badge && text) {
      badge.className = `${cfg.userIcons.networkBadge ? 'inline-flex' : 'hidden'} items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        pwa.isOnline
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      }`;
      const dot = badge.querySelector('span:first-child');
      if (dot) {
        dot.className = `w-1.5 h-1.5 rounded-full ${pwa.isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`;
      }
      text.textContent = pwa.isOnline ? 'متصل (Online)' : 'وضع الأوفلاين نشط (Offline Mode Ready)';
    }

    const installBtn = container.querySelector('#btn-install-pwa');
    if (installBtn) {
      const showInstall = cfg.userIcons.installPwa && !pwa.isInstalled;
      installBtn.classList.toggle('hidden', !showInstall);
      installBtn.classList.toggle('flex', showInstall);
    }
  }

  private attachEventListeners(container: HTMLElement): void {
    // Silent 5-click developer trigger (active ONLY in dev mode; completely disabled in APK / production)
    if (this.enableSecretAdmin && this.onTriggerAdminCallback) {
      const logoTrigger = container.querySelector('#header-logo-trigger');
      logoTrigger?.addEventListener('click', () => {
        this.logoClickCount++;
        if (this.logoClickTimer) clearTimeout(this.logoClickTimer);

        if (this.logoClickCount >= 5) {
          this.logoClickCount = 0;
          SoundService.playChime('start');
          this.onTriggerAdminCallback?.();
        } else {
          this.logoClickTimer = setTimeout(() => {
            this.logoClickCount = 0;
          }, 2500);
        }
      });
    }

    container.querySelector('#btn-nearest-station')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.onFindNearestCallback();
    });

    container.querySelector('#btn-offline-map')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.onOpenOfflineMapCallback?.();
    });

    container.querySelector('#btn-install-pwa')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.onInstallAppCallback?.();
    });

    container.querySelector('#btn-open-list')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.onOpenListCallback();
    });

    container.querySelector('#btn-toggle-theme')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.onToggleThemeCallback();
      this.updateThemeIcon(container);
    });
  }

  private updateThemeIcon(container: HTMLElement): void {
    const currentTheme = StationStorage.getTheme();
    const iconContainer = container.querySelector('#theme-icon-container');
    if (!iconContainer) return;

    if (currentTheme === 'dark') {
      iconContainer.innerHTML = `
        <svg class="w-5 h-5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      `;
    } else {
      iconContainer.innerHTML = `
        <svg class="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      `;
    }
  }

  updateLogo(container: HTMLElement, logoUrl: string | null): void {
    const wrapper = container.querySelector('#header-logo-img-wrapper');
    if (!wrapper) return;

    if (logoUrl) {
      wrapper.innerHTML = `<img src="${logoUrl}" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="Logo" class="max-w-full max-h-full object-contain" />`;
    } else {
      wrapper.innerHTML = `
        <svg class="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h6c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18"/>
          <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>
          <path d="M3 22h12"/>
          <path d="M7 10h4"/>
        </svg>
      `;
    }
  }
}
