import { Station, UserLocation } from './types';
import { AppConfig } from './config/appConfig';
import { AppConfigService } from './services/appConfigService';
import { StationStorage } from './services/stationStorage';
import { LocationService } from './services/locationService';
import { RoutingService } from './services/routingService';
import { SoundService } from './services/soundService';
import { ToastService } from './services/toastService';
import { PwaService } from './services/pwaService';
import { initWebViewNavigationGuard } from './services/webviewGuard';

import { DEFAULT_CARGAS_LOGO_DATA_URL } from './assets/cargasLogo';
import { escapeHtml } from './utils/html';
import { MapView } from './ui/mapView';
import { MapSearchComponent } from './ui/mapSearch';
import { HeaderComponent } from './ui/header';
import { StationCardComponent } from './ui/stationCard';
import { NavigationHudComponent } from './ui/navigationHud';
import { StationListModalComponent } from './ui/stationListModal';
import { AdminModalComponent } from './ui/adminModal';
import { LocationModalComponent } from './ui/locationModal';
import { OfflineModalComponent } from './ui/offlineModal';

class CargasApp {
  private map: MapView;
  private mapSearch: MapSearchComponent;
  private header: HeaderComponent;
  private stationCard: StationCardComponent;
  private navHud: NavigationHudComponent;
  private listModal: StationListModalComponent;
  private adminModal: AdminModalComponent | null = null;
  private locationModal: LocationModalComponent;
  private offlineModal: OfflineModalComponent;

  private stations: Station[] = [];
  private visibleStations: Station[] = [];
  private userLocation: UserLocation;
  private hasInitialCentered = false;
  private hasCenteredOnLiveGps = false;
  private lastAutoCenteredLoc: { lat: number; lng: number } | null = null;
  private selectedStation: Station | null = null;
  private isNavigating = false;
  private splashTimers: number[] = [];

  constructor() {
    initWebViewNavigationGuard();
    PwaService.init();
    const initialConfig = AppConfigService.getConfig();
    AppConfigService.applyDocumentBranding(initialConfig);

    this.userLocation = LocationService.getLocation();
    this.stations = StationStorage.getStations();
    this.visibleStations = this.stations;

    const initialAppLogo = StationStorage.getAppLogo();
    const initialStationLogo = StationStorage.getStationLogo();

    // 1. Setup DOM Containers + Dual-Logo Launch Splash Screen (10 seconds total: 7s App Logo + 3s Stations Logo)
    const appEl = document.getElementById('app') || document.body;
    appEl.innerHTML = `
      <!-- 10s Dual-Logo Splash Screen: App Logo (0-7s) -> Cargas Station Logo (7-10s) -->
      <div id="app-splash-screen" dir="rtl">
        <div class="relative w-full max-w-sm flex flex-col items-center justify-center min-h-[280px]">
          
          <!-- Stage 1: App Logo (7 seconds) -->
          <div id="splash-stage-app" class="splash-stage flex flex-col items-center justify-center text-center gap-4 w-full">
            <div class="w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-3xl bg-slate-900/90 border-2 border-emerald-400/60 shadow-2xl shadow-emerald-500/20 p-3.5 overflow-hidden flex items-center justify-center">
              <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center">
                <img id="splash-app-logo-img" src="${initialAppLogo}" draggable="false" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="App Logo" class="max-w-full max-h-full w-full h-full object-contain block drop-shadow-xl" />
              </div>
            </div>
            <div class="space-y-1 px-2">
              <h2 id="splash-app-title" class="text-2xl sm:text-3xl font-black text-white tracking-tight ${initialConfig.splashAppTitle ? '' : 'hidden'}">${escapeHtml(initialConfig.splashAppTitle)}</h2>
              <p id="splash-app-message" class="text-sm font-bold text-emerald-300 leading-relaxed ${initialConfig.splashAppMessage ? '' : 'hidden'}">${escapeHtml(initialConfig.splashAppMessage)}</p>
            </div>
          </div>

          <!-- Stage 2: Cargas Station Logo (3 seconds) -->
          <div id="splash-stage-station" class="splash-stage splash-stage-hidden absolute inset-0 flex flex-col items-center justify-center text-center gap-4 w-full">
            <div class="w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-3xl bg-gradient-to-br from-emerald-950 to-slate-900 border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 p-3.5 overflow-hidden flex items-center justify-center">
              <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center">
                <img id="splash-station-logo-img" src="${initialStationLogo}" draggable="false" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="Cargas Station Logo" class="max-w-full max-h-full w-full h-full object-contain block drop-shadow-xl" />
              </div>
            </div>
            <div class="space-y-1 px-2">
              <div id="splash-station-title" class="text-xl sm:text-2xl font-black text-emerald-300 ${initialConfig.splashStationTitle ? '' : 'hidden'}">${escapeHtml(initialConfig.splashStationTitle)}</div>
              <p id="splash-station-message" class="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed ${initialConfig.splashStationMessage ? '' : 'hidden'}">${escapeHtml(initialConfig.splashStationMessage)}</p>
            </div>
          </div>

        </div>

        <!-- Animated 10s Progress Indicator -->
        <div class="w-56 sm:w-64 mt-8 space-y-2 text-center">
          <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div class="splash-progress-bar h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"></div>
          </div>
          <div id="splash-status-label" class="text-[11px] font-bold text-slate-400">${escapeHtml(initialConfig.splashAppLoadingText)}</div>
        </div>
      </div>

      <div id="header-container" class="relative z-40"></div>
      
      <!-- Framed Map Wrapper with Street & Satellite Details (Night street mode permanently disabled) -->
      <div id="map-wrapper" class="relative w-full flex-1 overflow-hidden">
        <div id="map-container" class="w-full h-full"></div>

        <!-- Top Map Overlay: Location Badge + Map Search Bar + Satellite/Streets Switcher -->
        <div id="map-top-overlay">
          <!-- Interactive Current User Location Pill -->
          <button id="btn-current-location-badge" class="map-status-badge" title="اضغط لتحديد أو تغيير موقعك الحالي بدقة">
            <span class="status-pulse"></span>
            <span id="map-status-text" class="truncate">📍 موقعي: القاهرة • تعديل</span>
            <span class="text-[10px] opacity-80 shrink-0">▾</span>
          </button>

          <!-- Interactive Map Search Bar & Service Filter Chips -->
          <div id="map-search-container"></div>

          <!-- Map Style Toggle: Streets <-> Satellite -->
          <button id="btn-map-layer-toggle" class="map-style-switcher" title="التبديل بين خريطة الشوارع وخريطة القمر الصناعي">
            <span id="map-layer-toggle-icon">🛰️</span>
            <span id="map-layer-toggle-label">قمر صناعي</span>
          </button>
        </div>

        ${import.meta.env.DEV ? `
        <!-- Dev-Only Coordinate Health Warning Banner -->
        <div id="corrupt-coords-banner" class="hidden absolute top-28 sm:top-24 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-lg z-30 p-3 rounded-2xl bg-amber-950/95 backdrop-blur-md border-2 border-amber-500/70 shadow-2xl text-xs text-amber-100 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="leading-relaxed">
              <div class="font-black text-amber-300">⚠️ تنبيه: إحداثيات المحطات المخزنة تالفة أو في صف مائل</div>
              <div id="corrupt-coords-reason" class="text-[11px] text-amber-100/90 mt-0.5"></div>
            </div>
            <button id="btn-dismiss-corrupt-banner" class="text-amber-300 hover:text-white px-1.5 py-0.5 rounded" title="إخفاء">✕</button>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-banner-reupload-excel" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-xl text-[11px] transition-all">
              📤 إعادة رفع الإكسيل لتوزيعها
            </button>
            <button id="btn-banner-restore-defaults" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-[11px] border border-white/15 transition-all">
              🔄 استعادة المحطات الافتراضية الصحيحة
            </button>
          </div>
        </div>
        ` : ''}
      </div>

      <!-- Floating Map Utility Buttons -->
      <div class="floating-map-controls">
        <button id="btn-recenter-user" class="map-control-btn" title="توسيط وتحديث موقعي الحالي (GPS)">
          <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="8"/>
            <line x1="12" y1="2" x2="12" y2="4"/>
            <line x1="12" y1="20" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="4" y2="12"/>
            <line x1="20" y1="12" x2="22" y2="12"/>
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
          </svg>
        </button>

        <button id="btn-map-zoom-in" class="map-control-btn" title="تكبير الخريطة">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <button id="btn-map-zoom-out" class="map-control-btn" title="تصغير الخريطة">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <button id="btn-fit-all-stations" class="map-control-btn" title="عرض كافة المحطات على مستوى الجمهورية">
          <svg class="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </button>

        <button id="btn-quick-list" class="map-control-btn" title="قائمة وجدول كافة المحطات">
          <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Station Detail Bottom Sheet -->
      <div id="station-card-container" class="translate-y-full pointer-events-none"></div>

      <!-- Turn-by-Turn Navigation HUD Overlay -->
      <div id="nav-hud-container" class="hidden"></div>

      <!-- Station Search & Filter Modal -->
      <div id="list-modal-container" class="hidden"></div>

      <div id="admin-modal-container" class="hidden"></div>

      <!-- Current Location Picker Modal -->
      <div id="location-modal-container" class="hidden"></div>

      <!-- Offline Map Downloader & PWA Install Guide Modal -->
      <div id="offline-modal-container" class="hidden"></div>
    `;

    this.runLaunchSplashSequence();

    // 2. Initialize Theme
    const theme = StationStorage.getTheme();
    StationStorage.setTheme(theme);

    // 3. Initialize Map
    this.map = new MapView('map-container');
    this.map.init(this.userLocation.lat, this.userLocation.lng, 12);
    this.map.setTheme(theme);
    this.map.setStationLogo(StationStorage.getStationLogo());

    // 3b. Initialize On-Map Search & Quick Filter Bar
    const mapSearchContainer = document.getElementById('map-search-container')!;
    this.mapSearch = new MapSearchComponent(mapSearchContainer, this.userLocation, {
      onSelectStation: (station) => {
        void this.selectStation(station, true);
      },
      onFilterChange: (filteredStations, filter) => {
        this.visibleStations = filteredStations;
        this.renderMapStations();
        if (filter !== 'all') {
          ToastService.show(`تم عرض ${filteredStations.length} محطة مطابقة للنشاط المحدد على الخريطة`, 'info', 2500);
        }
      },
      onOpenFullList: (query) => {
        this.listModal.showWithQuery(query);
      },
    });
    this.mapSearch.updateData(this.stations, this.userLocation);

    // 4. Initialize Header & Subscribe to PWA Network/Install State
    const headerContainer = document.getElementById('header-container')!;
    this.header = new HeaderComponent({
      enableSecretAdmin: true,
      onTriggerAdmin: () => this.adminModal?.show(),
      onFindNearest: () => void this.handleFindNearest(),
      onOpenList: () => this.listModal.show(),
      onToggleTheme: () => {
        const nextTheme = StationStorage.toggleTheme();
        this.map.setTheme(nextTheme);
      },
      onOpenOfflineMap: () => void this.offlineModal.showMapDownloader(this.map.getTileStyle()),
      onInstallApp: async () => {
        const outcome = await PwaService.triggerInstall();
        if (outcome === 'accepted') {
          SoundService.playChime('start');
          ToastService.show('✅ تم تثبيت التطبيق بنجاح! يعمل الآن أوفلاين من الشاشة الرئيسية.', 'success', 4000);
        } else if (outcome === 'ios') {
          this.offlineModal.showInstallGuide('ios');
        } else if (outcome === 'manual') {
          this.offlineModal.showInstallGuide('manual');
        }
      },
    });
    this.header.render(headerContainer);
    this.applyAppConfig(initialConfig);
    PwaService.subscribe((pwaState) => {
      this.header.updatePwaState(headerContainer, pwaState);
    });

    // 5. Initialize Station Bottom Sheet
    const cardContainer = document.getElementById('station-card-container')!;
    this.stationCard = new StationCardComponent(cardContainer, {
      onStartNavigation: (station) => void this.handleStartNavigation(station),
      onClose: () => {
        this.selectedStation = null;
        this.map.clearRoute();
      },
      onClearRoute: () => {
        this.map.clearRoute();
      },
    });

    // 6. Initialize Navigation HUD
    const hudContainer = document.getElementById('nav-hud-container')!;
    this.navHud = new NavigationHudComponent(hudContainer, {
      onExit: () => {
        this.isNavigating = false;
        if (this.selectedStation) {
          this.stationCard.show(this.selectedStation);
        }
      },
    });

    // 7. Initialize Station List Modal
    const listModalContainer = document.getElementById('list-modal-container')!;
    this.listModal = new StationListModalComponent(listModalContainer, this.userLocation, {
      onSelectStation: (station) => void this.selectStation(station, true),
      onNavigateStation: (station) => {
        this.selectedStation = station;
        this.renderMapStations();
        this.map.focusStation(station, 15);
        void this.handleStartNavigation(station);
      },
      onTriggerAdmin: () => {
        this.adminModal?.show();
        window.setTimeout(() => {
          const adminEl = document.getElementById('admin-modal-container');
          if (adminEl && !adminEl.classList.contains('hidden')) {
            this.listModal.hide();
          }
        }, 750);
      },
    });

    // 8. Initialize Secret Password-Protected Admin Modal (triggered by 5 taps on App Logo)
    const adminModalContainer = document.getElementById('admin-modal-container');
    if (adminModalContainer) {
      this.adminModal = new AdminModalComponent(adminModalContainer, {
        onDataChanged: (focusedStation) => {
          if (focusedStation && this.mapSearch.getActiveFilter() !== 'all') {
            this.mapSearch.resetFilter();
          }
          this.refreshData();
          if (focusedStation) {
            void this.selectStation(focusedStation, true);
          } else if (this.visibleStations.length > 0) {
            this.map.fitToStations(this.visibleStations);
          }
        },
        onLocateStation: (station) => {
          if (this.mapSearch.getActiveFilter() !== 'all') {
            this.mapSearch.resetFilter();
          }
          this.refreshData();
          void this.selectStation(station, true);
        },
        onPickCoordsOnMap: (cb) => {
          this.map.enablePickLocationOnMap((lat, lng) => cb(lat, lng));
        },
        onPreviewSplash: () => {
          this.previewSplashScreen();
        },
      });

      const params = new URLSearchParams(window.location.search);
      const isAdminRoute =
        window.location.pathname.replace(/\/+$/, '') === '/admin' || params.get('admin') === '1';
      if (isAdminRoute) {
        document.getElementById('app-splash-screen')?.remove();
        this.adminModal.show('manage');
      }
    }

    // 9. Initialize Current Location Picker Modal
    const locationModalContainer = document.getElementById('location-modal-container')!;
    this.locationModal = new LocationModalComponent(locationModalContainer, {
      onLocationChosen: (lat, lng, label) => {
        this.userLocation = LocationService.getLocation();
        this.map.updateUserLocation(this.userLocation, true);
        this.map.flyToLocation(lat, lng, 14);
        this.listModal.updateData(this.stations, this.userLocation);
        this.mapSearch.updateData(this.stations, this.userLocation);
        const district = label || LocationService.getDistrictOrCityName(lat, lng);
        ToastService.show(`📍 تم ضبط موقعك الحالي على: ${district}`, 'success', 3500);
      },
      onRequestMapPick: () => {
        ToastService.show('👆 انقر في أي نقطة على الخريطة لتثبيت موقعك الحالي', 'info', 5000);
        this.map.enablePickLocationOnMap((lat, lng) => {
          LocationService.setManualLocation(lat, lng, true);
          this.userLocation = LocationService.getLocation();
          this.map.updateUserLocation(this.userLocation, true);
          this.listModal.updateData(this.stations, this.userLocation);
          this.mapSearch.updateData(this.stations, this.userLocation);
          const district = LocationService.getDistrictOrCityName(lat, lng);
          SoundService.playChime('start');
          ToastService.show(`✅ تم تثبيت موقعك على الخريطة: ${district}`, 'success', 3500);
        });
      },
    });

    // 9b. Initialize Offline Map & PWA Modal
    const offlineModalContainer = document.getElementById('offline-modal-container')!;
    this.offlineModal = new OfflineModalComponent(offlineModalContainer, {
      getMapBounds: () => this.map.getBounds(),
    });

    // 10. Wire Map click & drag events
    this.map.onStationSelect((station) => {
      SoundService.playChime('click');
      void this.selectStation(station, false);
    });

    this.map.onUserLocationDrag((lat, lng) => {
      LocationService.setManualLocation(lat, lng, true);
      this.userLocation = LocationService.getLocation();
      this.map.updateUserLocation(this.userLocation, false);
      this.listModal.updateData(this.stations, this.userLocation);
      this.mapSearch.updateData(this.stations, this.userLocation);
      const district = LocationService.getDistrictOrCityName(lat, lng);
      SoundService.playChime('click');
      ToastService.show(`📍 تم تحديث موقعك إلى: ${district}`, 'success', 3000);
    });

    // 11. Interactive Location Badge, Street/Satellite Toggle & Floating Map Controls
    this.syncMapLayerToggleUi();
    document.getElementById('btn-map-layer-toggle')?.addEventListener('click', () => {
      SoundService.playChime('click');
      const nextStyle = this.map.toggleTileStyle();
      this.syncMapLayerToggleUi();
      ToastService.show(
        nextStyle === 'satellite' ? '🛰️ تم التبديل إلى خريطة القمر الصناعي' : '🗺️ تم التبديل إلى خريطة الشوارع',
        'info',
        2200
      );
    });

    document.getElementById('btn-current-location-badge')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.locationModal.show();
    });

    const recenterBtn = document.getElementById('btn-recenter-user') as HTMLButtonElement | null;
    recenterBtn?.addEventListener('click', async () => {
      SoundService.playChime('click');
      recenterBtn.disabled = true;
      recenterBtn.classList.add('animate-pulse');
      ToastService.show('📡 جارٍ تحديث موقعك الفعلي عبر الـ GPS...', 'info', 2000);

      try {
        const res = await LocationService.forceRefreshGPS();
        this.userLocation = res.loc;
        this.listModal.updateData(this.stations, this.userLocation);
        this.mapSearch.updateData(this.stations, this.userLocation);

        if (res.success) {
          this.hasCenteredOnLiveGps = true;
          this.lastAutoCenteredLoc = { lat: this.userLocation.lat, lng: this.userLocation.lng };
          this.map.updateUserLocation(this.userLocation, true);
          this.map.flyToLocation(this.userLocation.lat, this.userLocation.lng, 15);
          if (this.selectedStation) {
            this.selectedStation.distanceKm = LocationService.getDistanceKm(
              this.userLocation.lat,
              this.userLocation.lng,
              this.selectedStation.lat,
              this.selectedStation.lng
            );
            this.stationCard.show(this.selectedStation);
          }
          SoundService.playChime('start');
          ToastService.show(`✅ ${res.message}`, 'success', 3500);
        } else {
          this.map.recenterUser(this.userLocation);
          ToastService.show(res.message, 'warning', 4500);
          if (res.errorCode === 'permission_denied') {
            this.locationModal.show();
          }
        }
      } finally {
        recenterBtn.disabled = false;
        recenterBtn.classList.remove('animate-pulse');
      }
    });

    document.getElementById('btn-map-zoom-in')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.map.zoomIn();
    });

    document.getElementById('btn-map-zoom-out')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.map.zoomOut();
    });

    document.getElementById('btn-fit-all-stations')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.mapSearch.resetFilter();
      this.map.fitToStations(this.stations);
      ToastService.show(`🌍 تم عرض وتوزيع كافة المحطات (${this.stations.length} محطة) على مستوى الجمهورية`, 'info', 3000);
    });

    document.getElementById('btn-quick-list')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.listModal.show();
    });

    // 12. Render Initial Stations on Map & Check Coordinate Health (Dev-only banner)
    this.renderMapStations();
    this.updateCoordinateHealthBanner();

    if (import.meta.env.DEV) {
      document.getElementById('btn-dismiss-corrupt-banner')?.addEventListener('click', () => {
        document.getElementById('corrupt-coords-banner')?.classList.add('hidden');
      });

      document.getElementById('btn-banner-reupload-excel')?.addEventListener('click', () => {
        SoundService.playChime('click');
        this.adminModal?.show('upload');
      });

      document.getElementById('btn-banner-restore-defaults')?.addEventListener('click', () => {
        StationStorage.restoreDefaultData();
        SoundService.playChime('start');
        this.refreshData();
        if (this.stations.length > 0) {
          this.map.fitToStations(this.stations);
        }
        ToastService.show('✅ تمت استعادة المحطات الافتراضية الموزعة على مستوى الجمهورية بنجاح!', 'success', 4000);
      });
    }

    // 13. Setup Storage Listeners for Real-time Reactive Updates
    StationStorage.onStationsUpdated((newStations) => {
      this.stations = newStations;
      this.mapSearch.updateData(this.stations, this.userLocation);
      this.renderMapStations();
      this.listModal.updateData(this.stations, this.userLocation);
      this.updateCoordinateHealthBanner();
    });

    // Separate updates for App Logo (Header) vs Station Logo (Map Pins)
    StationStorage.onAppLogoUpdated((appLogo) => {
      this.header.updateLogo(headerContainer, appLogo);
    });

    StationStorage.onStationLogoUpdated((stationLogo) => {
      this.map.setStationLogo(stationLogo);
      this.renderMapStations();
    });

    // 14. Subscribe to GPS Status & Start Tracking Immediately on Launch
    LocationService.subscribeStatus((diag) => {
      const badge = document.getElementById('btn-current-location-badge');
      const statusText = document.getElementById('map-status-text');
      if (!badge || !statusText) return;

      const isWarning =
        diag.status === 'outside_egypt' ||
        diag.status === 'denied' ||
        diag.status === 'timeout' ||
        diag.status === 'unavailable';
      badge.classList.toggle('warning', isWarning);

      if (diag.location.isSimulated && diag.status !== 'manual') {
        if (diag.status === 'pending') {
          statusText.textContent = '⏳ جارٍ تحديد موقعك عبر الـ GPS...';
        } else if (diag.status === 'denied') {
          statusText.textContent = '🚫 فعّل إذن الـ GPS أو اضغط لتحديد موقعك';
        } else {
          statusText.textContent = '⚠️ GPS غير متاح • اضغط لتحديد موقعك';
        }
        return;
      }

      const prefix =
        diag.status === 'accurate'
          ? '📡 GPS:'
          : diag.status === 'manual'
            ? '📌 موقعي:'
            : isWarning
              ? '⚠️ موقعي:'
              : '📍 موقعي:';
      statusText.textContent = `${prefix} ${diag.districtName}`;
    });

    this.startGpsTracking();

    AppConfigService.onConfigUpdated((updatedConfig) => {
      this.applyAppConfig(updatedConfig);
    });

    // 15. Seed/Load IndexedDB Station Data & AppConfig for 100% Offline Persistence & Auto-Sync Dev Edits
    void AppConfigService.initializeConfigSync().then((syncedCfg) => {
      this.applyAppConfig(syncedCfg);
    });

    void StationStorage.initializeOfflineStorage().then((seededStations) => {
      const latestStationLogo = StationStorage.getStationLogo();
      const latestAppLogo = StationStorage.getAppLogo();
      const splashAppImg = document.getElementById('splash-app-logo-img') as HTMLImageElement | null;
      const splashStationImg = document.getElementById('splash-station-logo-img') as HTMLImageElement | null;
      if (splashAppImg && latestAppLogo) splashAppImg.src = latestAppLogo;
      if (splashStationImg && latestStationLogo) splashStationImg.src = latestStationLogo;

      if (seededStations && seededStations.length > 0) {
        this.stations = seededStations;
        this.map.setStationLogo(latestStationLogo);
        this.header.updateLogo(headerContainer, latestAppLogo);
        this.mapSearch.updateData(this.stations, this.userLocation);
        this.renderMapStations();
        this.listModal.updateData(this.stations, this.userLocation);
        this.updateCoordinateHealthBanner();
      }
    });
  }

  private applyAppConfig(cfg: AppConfig): void {
    AppConfigService.applyDocumentBranding(cfg);
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      this.header.applyConfig(headerContainer, cfg);
    }

    const syncSplashText = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = val;
      el.classList.toggle('hidden', !val);
    };
    syncSplashText('splash-app-title', cfg.splashAppTitle);
    syncSplashText('splash-app-message', cfg.splashAppMessage);
    syncSplashText('splash-station-title', cfg.splashStationTitle);
    syncSplashText('splash-station-message', cfg.splashStationMessage);
    const statusLabel = document.getElementById('splash-status-label');
    const stageStationVisible = !document
      .getElementById('splash-stage-station')
      ?.classList.contains('splash-stage-hidden');
    if (statusLabel) {
      statusLabel.textContent = stageStationVisible ? cfg.splashStationLoadingText : cfg.splashAppLoadingText;
    }

    const icons = cfg.userIcons;
    document.getElementById('btn-current-location-badge')?.classList.toggle('hidden', !icons.locationBadge);
    document.getElementById('map-search-container')?.classList.toggle('hidden', !icons.mapSearch);
    document.getElementById('btn-map-layer-toggle')?.classList.toggle('hidden', !icons.mapLayerToggle);

    document.getElementById('btn-recenter-user')?.classList.toggle('hidden', !icons.recenterGps);
    document.getElementById('btn-map-zoom-in')?.classList.toggle('hidden', !icons.zoomControls);
    document.getElementById('btn-map-zoom-out')?.classList.toggle('hidden', !icons.zoomControls);
    document.getElementById('btn-fit-all-stations')?.classList.toggle('hidden', !icons.fitAllStations);
    document.getElementById('btn-quick-list')?.classList.toggle('hidden', !icons.quickList);

    const anyFloatingVisible =
      icons.recenterGps || icons.zoomControls || icons.fitAllStations || icons.quickList;
    document.querySelector('.floating-map-controls')?.classList.toggle('hidden', !anyFloatingVisible);
  }

  private syncMapLayerToggleUi(): void {
    const btn = document.getElementById('btn-map-layer-toggle');
    const icon = document.getElementById('map-layer-toggle-icon');
    const label = document.getElementById('map-layer-toggle-label');
    if (!btn || !icon || !label) return;

    const isSatellite = this.map.getTileStyle() === 'satellite';
    btn.classList.toggle('satellite-active', isSatellite);
    icon.textContent = isSatellite ? '🗺️' : '🛰️';
    label.textContent = isSatellite ? 'خريطة الشوارع' : 'قمر صناعي';
  }

  private clearSplashTimers(): void {
    for (const id of this.splashTimers) {
      window.clearTimeout(id);
    }
    this.splashTimers = [];
  }

  private runLaunchSplashSequence(): void {
    this.clearSplashTimers();
    const splash = document.getElementById('app-splash-screen');
    const stageApp = document.getElementById('splash-stage-app');
    const stageStation = document.getElementById('splash-stage-station');
    const statusLabel = document.getElementById('splash-status-label');
    if (!splash) return;

    // Phase 1: App Logo stays for 7 seconds, then transitions to Cargas Stations Logo for 3 seconds (10s total)
    this.splashTimers.push(
      window.setTimeout(() => {
        if (!splash.isConnected) return;
        stageApp?.classList.add('splash-stage-hidden');
        stageStation?.classList.remove('splash-stage-hidden');
        if (statusLabel) {
          statusLabel.textContent = AppConfigService.getConfig().splashStationLoadingText;
        }
      }, 7000)
    );

    // Phase 2: Reveal the interactive map after 10 seconds total (7s + 3s)
    this.splashTimers.push(
      window.setTimeout(() => {
        if (!splash.isConnected) return;
        splash.classList.add('splash-fade-out');
        this.map?.invalidateSize();
        this.splashTimers.push(
          window.setTimeout(() => {
            splash.remove();
            this.map?.invalidateSize();
          }, 420)
        );
      }, 10000)
    );
  }

  private previewSplashScreen(): void {
    this.clearSplashTimers();
    document.getElementById('app-splash-screen')?.remove();
    const cfg = AppConfigService.getConfig();
    const appLogo = StationStorage.getAppLogo();
    const stationLogo = StationStorage.getStationLogo();
    const overlay = document.createElement('div');
    overlay.id = 'app-splash-screen';
    overlay.setAttribute('dir', 'rtl');
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <button type="button" id="btn-close-splash-preview" class="absolute top-4 left-4 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-white/15 shadow-lg transition-all">
        ✕ إنهاء المعاينة
      </button>
      <div class="relative w-full max-w-sm flex flex-col items-center justify-center min-h-[280px]">
        <div id="splash-stage-app" class="splash-stage flex flex-col items-center justify-center text-center gap-4 w-full">
          <div class="w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-3xl bg-slate-900/90 border-2 border-emerald-400/60 shadow-2xl shadow-emerald-500/20 p-3.5 overflow-hidden flex items-center justify-center">
            <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center">
              <img src="${appLogo}" draggable="false" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="App Logo" class="max-w-full max-h-full w-full h-full object-contain block drop-shadow-xl" />
            </div>
          </div>
          <div class="space-y-1 px-2">
            <h2 id="splash-app-title" class="text-2xl sm:text-3xl font-black text-white tracking-tight ${cfg.splashAppTitle ? '' : 'hidden'}">${escapeHtml(cfg.splashAppTitle)}</h2>
            <p id="splash-app-message" class="text-sm font-bold text-emerald-300 leading-relaxed ${cfg.splashAppMessage ? '' : 'hidden'}">${escapeHtml(cfg.splashAppMessage)}</p>
          </div>
        </div>
        <div id="splash-stage-station" class="splash-stage splash-stage-hidden absolute inset-0 flex flex-col items-center justify-center text-center gap-4 w-full">
          <div class="w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-3xl bg-gradient-to-br from-emerald-950 to-slate-900 border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 p-3.5 overflow-hidden flex items-center justify-center">
            <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center">
              <img src="${stationLogo}" draggable="false" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="Cargas Station Logo" class="max-w-full max-h-full w-full h-full object-contain block drop-shadow-xl" />
            </div>
          </div>
          <div class="space-y-1 px-2">
            <div id="splash-station-title" class="text-xl sm:text-2xl font-black text-emerald-300 ${cfg.splashStationTitle ? '' : 'hidden'}">${escapeHtml(cfg.splashStationTitle)}</div>
            <p id="splash-station-message" class="text-xs sm:text-sm font-bold text-slate-300 leading-relaxed ${cfg.splashStationMessage ? '' : 'hidden'}">${escapeHtml(cfg.splashStationMessage)}</p>
          </div>
        </div>
      </div>
      <div class="w-56 sm:w-64 mt-8 space-y-2 text-center">
        <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div class="splash-progress-bar h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"></div>
        </div>
        <div id="splash-status-label" class="text-[11px] font-bold text-slate-400">${escapeHtml(cfg.splashAppLoadingText)}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-close-splash-preview')?.addEventListener('click', () => {
      this.clearSplashTimers();
      overlay.remove();
    });
    this.runLaunchSplashSequence();
  }

  private renderMapStations(): void {
    this.visibleStations = this.mapSearch
      ? this.mapSearch.getFilteredStationsByService(this.stations)
      : this.stations;
    const stats = this.map.renderStations(this.visibleStations, this.selectedStation?.id);
    if (stats.skipped > 0) {
      ToastService.show(`تنبيه: هناك ${stats.skipped} محطة بدون إحداثيات صالحة لم تُعرض على الخريطة.`, 'warning', 4500);
    }
  }

  // Starts continuous live GPS location tracking
  private startGpsTracking(): void {
    LocationService.startTracking((loc) => {
      const prevLat = this.userLocation?.lat;
      const prevLng = this.userLocation?.lng;
      const movedKm =
        Number.isFinite(prevLat) && Number.isFinite(prevLng)
          ? LocationService.getDistanceKm(prevLat, prevLng, loc.lat, loc.lng)
          : 0;

      this.userLocation = loc;
      const isLiveGps = !loc.isSimulated;

      const cumulativeMovedKm = this.lastAutoCenteredLoc
        ? LocationService.getDistanceKm(
            this.lastAutoCenteredLoc.lat,
            this.lastAutoCenteredLoc.lng,
            loc.lat,
            loc.lng
          )
        : Infinity;

      // Center initially on default, and ALWAYS re-fly once real hardware GPS locks or user moves cumulatively (>120m)
      if (!this.hasInitialCentered) {
        this.hasInitialCentered = true;
        this.map.updateUserLocation(loc, false);
        this.map.flyToLocation(loc.lat, loc.lng, 13);
      } else if (isLiveGps && (!this.hasCenteredOnLiveGps || cumulativeMovedKm > 0.12 || this.isNavigating)) {
        const firstLiveLock = !this.hasCenteredOnLiveGps;
        this.hasCenteredOnLiveGps = true;
        this.lastAutoCenteredLoc = { lat: loc.lat, lng: loc.lng };
        this.map.updateUserLocation(loc, !firstLiveLock);
        if (firstLiveLock) {
          this.map.flyToLocation(loc.lat, loc.lng, 14);
        }
      } else {
        this.map.updateUserLocation(loc, false);
      }

      // Update distance in open card, route while navigating, or list in real time
      if (this.selectedStation) {
        const dist = LocationService.getDistanceKm(
          loc.lat,
          loc.lng,
          this.selectedStation.lat,
          this.selectedStation.lng
        );
        this.selectedStation.distanceKm = dist;
        if (!this.isNavigating && movedKm > 0.05) {
          this.stationCard.show(this.selectedStation);
        } else if (this.isNavigating && isLiveGps && movedKm > 0.15) {
          const destLat = Number(this.selectedStation.lat ?? this.selectedStation.latitude);
          const destLng = Number(this.selectedStation.lng ?? this.selectedStation.longitude);
          if (Number.isFinite(destLat) && Number.isFinite(destLng)) {
            void RoutingService.getRoute(loc.lat, loc.lng, destLat, destLng)
              .then((route) => {
                if (this.isNavigating && this.selectedStation) {
                  this.map.drawRoute(route);
                }
              })
              .catch(() => {
                // ignore background route recalculation failure
              });
          }
        }
      }

      this.listModal.updateData(this.stations, this.userLocation);
      this.mapSearch.updateData(this.stations, this.userLocation);
    });
  }

  private updateCoordinateHealthBanner(): void {
    if (!import.meta.env.DEV) return;
    const banner = document.getElementById('corrupt-coords-banner');
    const reasonEl = document.getElementById('corrupt-coords-reason');
    if (!banner || !reasonEl) return;

    const coordCheck = StationStorage.hasSuspiciousCoordinates(this.stations);
    if (coordCheck.suspicious) {
      reasonEl.textContent = `${coordCheck.reason || ''} أعد رفع ملف الإكسيل ليعيد النظام قراءة خطوط الطول والعرض وتوزيع المحطات في أماكنها الصحيحة.`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // Handles finding and navigating to the absolute nearest Cargas station
  private async handleFindNearest(): Promise<void> {
    if (this.stations.length === 0) {
      ToastService.show('لا توجد محطات مسجلة في التطبيق حالياً.', 'warning');
      return;
    }

    if (import.meta.env.DEV) {
      const coordCheck = StationStorage.hasSuspiciousCoordinates(this.stations);
      if (coordCheck.suspicious) {
        this.updateCoordinateHealthBanner();
        ToastService.show(`⚠️ تنبيه مطور: إحداثيات المحطات الحالية في صف واحد مائل، لذلك قد لا تعكس المسافات الحقيقية.`, 'warning', 6000);
      }
    }

    const pool = this.visibleStations.length > 0 ? this.visibleStations : this.stations;
    const nearest = LocationService.getNearestStation(this.userLocation, pool);
    if (!nearest) {
      ToastService.show('تعذر حساب أقرب محطة، يرجى التأكد من إحداثيات المحطات.', 'warning');
      return;
    }

    const dist = LocationService.getDistanceKm(this.userLocation.lat, this.userLocation.lng, nearest.lat, nearest.lng);
    const distFormatted = LocationService.formatDistance(dist);
    const userDistrict = LocationService.getDistrictOrCityName(this.userLocation.lat, this.userLocation.lng);
    ToastService.show(`🎯 من ${userDistrict} • أقرب محطة: "${nearest.name}" (${distFormatted})`, 'success', 4500);

    SoundService.playChime('start');
    await this.selectStation(nearest, true);
  }

  // Select a station, center map, draw in-app OSRM route, and show card
  private async selectStation(station: Station, flyTo = true): Promise<void> {
    this.selectedStation = station;

    // Calculate real distance
    const dist = LocationService.getDistanceKm(this.userLocation.lat, this.userLocation.lng, station.lat, station.lng);
    station.distanceKm = dist;

    // Show details bottom sheet
    this.stationCard.show(station);

    // Re-render markers with selection highlight
    this.renderMapStations();

    if (flyTo) {
      this.map.focusStation(station, 15);
    }

    // Fetch and draw live free OSRM route on the map
    try {
      const route = await RoutingService.getRoute(
        this.userLocation.lat,
        this.userLocation.lng,
        station.lat,
        station.lng
      );
      this.map.drawRoute(route);
      station.durationMin = route.durationMin;
      if (this.selectedStation?.id === station.id) {
        this.stationCard.show(station);
      }
    } catch (e) {
      console.warn('Failed to draw route', e);
    }
  }

  // Starts turn-by-turn guidance mode inside the app with route drawing and Arabic HUD
  private async handleStartNavigation(station: Station): Promise<void> {
    const destLat = Number(station.lat ?? station.latitude);
    const destLng = Number(station.lng ?? station.longitude);
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
      ToastService.show('⚠️ تعذر التوجه للمحطة لأن إحداثياتها غير صالحة.', 'warning');
      return;
    }

    this.selectedStation = station;
    this.isNavigating = true;
    this.stationCard.hide();
    ToastService.show(`🧭 جاري حساب المسار إلى "${station.name}"...`, 'info', 2200);

    try {
      // Fetch route with full turn-by-turn steps (falls back cleanly offline)
      const route = await RoutingService.getRoute(
        this.userLocation.lat,
        this.userLocation.lng,
        destLat,
        destLng
      );

      this.map.drawRoute(route);
      this.navHud.start(route, station);
    } catch (error) {
      console.error('Navigation start failed:', error);
      this.isNavigating = false;
      this.stationCard.show(station);
      ToastService.show('تعذر بدء المسار حالياً، حاول مرة أخرى أو افتح خرائط جوجل.', 'warning');
    }
  }

  // Refresh data when admin modifies anything
  private refreshData(): void {
    this.stations = StationStorage.getStations();
    this.map.setStationLogo(StationStorage.getStationLogo());
    this.mapSearch.updateData(this.stations, this.userLocation);
    this.renderMapStations();
    this.listModal.updateData(this.stations, this.userLocation);
    this.updateCoordinateHealthBanner();

    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      this.header.updateLogo(headerContainer, StationStorage.getAppLogo());
    }
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CargasApp();
});
