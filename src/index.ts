import { Station, UserLocation } from './types';
import { AppConfig } from './config/appConfig';
import { AppConfigService } from './services/appConfigService';
import { StationStorage } from './services/stationStorage';
import { LocationService } from './services/locationService';
import { RoutingService } from './services/routingService';
import { SoundService } from './services/soundService';
import { ToastService } from './services/toastService';
import { PwaService } from './services/pwaService';

import { MapView } from './ui/mapView';
import { MapSearchComponent } from './ui/mapSearch';
import { HeaderComponent } from './ui/header';
import { StationCardComponent } from './ui/stationCard';
import { NavigationHudComponent } from './ui/navigationHud';
import { StationListModalComponent } from './ui/stationListModal';
import type { AdminModalComponent } from './ui/adminModal';
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
  private selectedStation: Station | null = null;
  private isNavigating = false;

  constructor() {
    PwaService.init();
    const initialConfig = AppConfigService.getConfig();
    AppConfigService.applyDocumentBranding(initialConfig);

    this.userLocation = LocationService.getLocation();
    this.stations = StationStorage.getStations();
    this.visibleStations = this.stations;

    // 1. Setup DOM Containers
    const appEl = document.getElementById('app') || document.body;
    appEl.innerHTML = `
      <div id="header-container" class="relative z-40"></div>
      
      <!-- Framed Map Wrapper with Street Details (Daylight street mode only) -->
      <div id="map-wrapper" class="relative w-full flex-1 overflow-hidden">
        <div id="map-container" class="w-full h-full"></div>

        <!-- Top Map Overlay: Location Badge + Map Search Bar -->
        <div id="map-top-overlay">
          <!-- Interactive Current User Location Pill -->
          <button id="btn-current-location-badge" class="map-status-badge" title="اضغط لتحديد أو تغيير موقعك الحالي بدقة">
            <span class="status-pulse"></span>
            <span id="map-status-text" class="truncate">📍 موقعي: القاهرة • تعديل</span>
            <span class="text-[10px] opacity-80 shrink-0">▾</span>
          </button>

          <!-- Interactive Map Search Bar & Service Filter Chips -->
          <div id="map-search-container"></div>
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

      ${import.meta.env.DEV ? '<div id="admin-modal-container" class="hidden"></div>' : ''}

      <!-- Current Location Picker Modal -->
      <div id="location-modal-container" class="hidden"></div>

      <!-- Offline Map Downloader & PWA Install Guide Modal -->
      <div id="offline-modal-container" class="hidden"></div>
    `;

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
      enableSecretAdmin: import.meta.env.DEV,
      onTriggerAdmin: import.meta.env.DEV ? () => this.adminModal?.show() : undefined,
      onFindNearest: () => void this.handleFindNearest(),
      onOpenList: () => this.listModal.show(),
      onToggleTheme: () => {
        const nextTheme = StationStorage.toggleTheme();
        this.map.setTheme(nextTheme);
      },
      onOpenOfflineMap: () => void this.offlineModal.showMapDownloader(),
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
    });

    // 8. Initialize Admin Modal ONLY in Development Mode (excluded from APK / production bundle)
    if (import.meta.env.DEV) {
      const adminModalContainer = document.getElementById('admin-modal-container');
      if (adminModalContainer) {
        void import('./ui/adminModal').then(({ AdminModalComponent }) => {
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
          });

          const params = new URLSearchParams(window.location.search);
          if (params.get('admin') === '1') {
            this.adminModal.show('manage');
          }
        });
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

    // 11. Interactive Location Badge & Floating Map Controls Events
    document.getElementById('btn-current-location-badge')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.locationModal.show();
    });

    document.getElementById('btn-recenter-user')?.addEventListener('click', async () => {
      SoundService.playChime('click');
      this.map.recenterUser(this.userLocation);
      const district = LocationService.getDistrictOrCityName(this.userLocation.lat, this.userLocation.lng);
      ToastService.show(`📍 موقعك الحالي: ${district}`, 'info', 2500);

      if (!LocationService.getDiagnostics().hasManualOverride) {
        const res = await LocationService.forceRefreshGPS();
        if (res.success) {
          this.userLocation = res.loc;
          this.map.updateUserLocation(this.userLocation, true);
          this.map.recenterUser(this.userLocation);
          this.listModal.updateData(this.stations, this.userLocation);
          this.mapSearch.updateData(this.stations, this.userLocation);
        }
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
        diag.status === 'low_accuracy' ||
        diag.status === 'outside_egypt' ||
        diag.status === 'denied' ||
        diag.status === 'timeout' ||
        diag.status === 'unavailable';
      badge.classList.toggle('warning', isWarning);

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
      if (seededStations && seededStations.length > 0) {
        this.stations = seededStations;
        this.map.setStationLogo(StationStorage.getStationLogo());
        this.header.updateLogo(headerContainer, StationStorage.getAppLogo());
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

    const icons = cfg.userIcons;
    document.getElementById('btn-current-location-badge')?.classList.toggle('hidden', !icons.locationBadge);
    document.getElementById('map-search-container')?.classList.toggle('hidden', !icons.mapSearch);

    document.getElementById('btn-recenter-user')?.classList.toggle('hidden', !icons.recenterGps);
    document.getElementById('btn-map-zoom-in')?.classList.toggle('hidden', !icons.zoomControls);
    document.getElementById('btn-map-zoom-out')?.classList.toggle('hidden', !icons.zoomControls);
    document.getElementById('btn-fit-all-stations')?.classList.toggle('hidden', !icons.fitAllStations);
    document.getElementById('btn-quick-list')?.classList.toggle('hidden', !icons.quickList);

    const anyFloatingVisible =
      icons.recenterGps || icons.zoomControls || icons.fitAllStations || icons.quickList;
    document.querySelector('.floating-map-controls')?.classList.toggle('hidden', !anyFloatingVisible);
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
      this.userLocation = loc;
      this.map.updateUserLocation(loc);

      // On first GPS reception, fly to user location smoothly
      if (!this.hasInitialCentered) {
        this.hasInitialCentered = true;
        this.map.flyToLocation(loc.lat, loc.lng, 13);
      }

      // Update distance in open card or list
      if (this.selectedStation) {
        const dist = LocationService.getDistanceKm(loc.lat, loc.lng, this.selectedStation.lat, this.selectedStation.lng);
        this.selectedStation.distanceKm = dist;
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
