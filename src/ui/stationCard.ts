import { Station } from '../types';
import { LocationService } from '../services/locationService';
import { SoundService } from '../services/soundService';
import { ToastService } from '../services/toastService';
import { StationStorage } from '../services/stationStorage';
import {
  ICON_CONVERSION_CENTER_SVG,
  ICON_LUBE_CENTER_SVG,
  ICON_CYLINDER_TESTING_SVG,
  ICON_CANOPY_OIL_SVG,
  ICON_CARGAS_STATION_SVG,
  DEFAULT_CARGAS_LOGO_DATA_URL,
} from '../assets/cargasLogo';
import { escapeHtml } from '../utils/html';
import { getStationNavigationUrls, canLaunchNativeGeoUri } from '../utils/navigationLinks';

export class StationCardComponent {
  private container: HTMLElement;
  private currentStation: Station | null = null;
  private onStartNavigationCallback: (station: Station) => void;
  private onCloseCallback: () => void;
  private onClearRouteCallback?: () => void;

  constructor(
    container: HTMLElement,
    handlers: {
      onStartNavigation: (station: Station) => void;
      onClose: () => void;
      onClearRoute?: () => void;
    }
  ) {
    this.container = container;
    this.onStartNavigationCallback = handlers.onStartNavigation;
    this.onCloseCallback = handlers.onClose;
    this.onClearRouteCallback = handlers.onClearRoute;
  }

  show(station: Station): void {
    this.currentStation = station;
    this.render();
  }

  hide(): void {
    this.currentStation = null;
    this.container.innerHTML = '';
    this.container.classList.add('translate-y-full', 'pointer-events-none');
    this.container.classList.remove('translate-y-0', 'pointer-events-auto');
  }

  getStation(): Station | null {
    return this.currentStation;
  }

  private render(): void {
    if (!this.currentStation) return;

    const s = this.currentStation;
    const navUrls = getStationNavigationUrls(s, LocationService.getLocation());
    const distanceStr = s.distanceKm !== undefined ? LocationService.formatDistance(s.distanceKm) : '';
    const durationStr = s.durationMin !== undefined ? `~ ${s.durationMin} دقيقة` : '';

    this.container.classList.remove('translate-y-full', 'pointer-events-none');
    this.container.classList.add('translate-y-0', 'pointer-events-auto');

    this.container.innerHTML = `
      <div class="station-card-inner glass-card w-full max-w-xl mx-auto rounded-3xl p-4 sm:p-5 shadow-2xl border transition-all duration-300">
        
        <!-- Header: Name, Distance & Close -->
        <div class="flex items-start justify-between gap-3 mb-2.5">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black px-2.5 py-1 rounded-full">
                <img src="${s.logoUrl || StationStorage.getStationLogo() || DEFAULT_CARGAS_LOGO_DATA_URL}" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="Logo" class="w-4 h-4 rounded-full object-contain bg-slate-900" />
                <span>${escapeHtml(s.company || 'كارجاس')}</span>
              </span>
              ${
                s.operatingHours
                  ? `<span class="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50">
                      🕒 ${escapeHtml(s.operatingHours)}
                    </span>`
                  : ''
              }
              <span class="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/50">
                📍 ${escapeHtml(s.governorate)} ${s.city ? `• ${escapeHtml(s.city)}` : ''}
              </span>
            </div>
            
            <h2 class="text-base sm:text-lg font-black text-white leading-snug">
              ${escapeHtml(s.name)}
            </h2>
            <p class="text-xs text-slate-300 mt-1 flex items-center gap-1.5 line-clamp-2">
              <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>${escapeHtml(s.address)}</span>
            </p>
          </div>

          <!-- Close Button -->
          <button 
            id="btn-close-card" 
            class="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800/60 transition-colors"
            title="إغلاق البطاقة"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Distance and Travel Time Metrics -->
        ${
          distanceStr
            ? `
          <div class="metrics-bar grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-800/40 border border-slate-700/40 mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                📏
              </div>
              <div>
                <div class="text-[10px] text-slate-400 font-medium">المسافة من موقعك</div>
                <div class="text-xs sm:text-sm font-black text-white">${distanceStr}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                🚗
              </div>
              <div>
                <div class="text-[10px] text-slate-400 font-medium">الوقت التقديري</div>
                <div class="text-xs sm:text-sm font-black text-white">${durationStr || 'حسب حركة السير'}</div>
              </div>
            </div>
          </div>
        `
            : ''
        }

        <!-- Services and Facilities Badges -->
        <div class="mb-3.5">
          <div class="text-[11px] font-bold text-slate-400 mb-1.5">الأنشطة والخدمات المتاحة بالمحطة:</div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            
            <!-- Conversion Center -->
            <div class="service-pill ${
              s.services.hasConversionCenter
                ? 'active-service border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'inactive-service text-slate-500 bg-slate-800/20 opacity-50'
            } flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-semibold">
              <span class="w-4 h-4 flex items-center justify-center shrink-0 ${s.services.hasConversionCenter ? 'text-amber-400' : 'text-slate-500'}">
                ${ICON_CONVERSION_CENTER_SVG}
              </span>
              <span>مركز تحويل وصيانة</span>
            </div>

            <!-- Specialized Lube Center -->
            <div class="service-pill ${
              s.services.hasLubeCenter
                ? 'active-service border-blue-500/40 bg-blue-500/10 text-blue-300'
                : 'inactive-service text-slate-500 bg-slate-800/20 opacity-50'
            } flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-semibold">
              <span class="w-4 h-4 flex items-center justify-center shrink-0 ${s.services.hasLubeCenter ? 'text-blue-400' : 'text-slate-500'}">
                ${ICON_LUBE_CENTER_SVG}
              </span>
              <span>مركز زيوت متخصص</span>
            </div>

            <!-- Canopy Oil Service -->
            <div class="service-pill ${
              s.services.hasCanopyOil
                ? 'active-service border-teal-500/40 bg-teal-500/10 text-teal-300'
                : 'inactive-service text-slate-500 bg-slate-800/20 opacity-50'
            } flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-semibold">
              <span class="w-4 h-4 flex items-center justify-center shrink-0 ${s.services.hasCanopyOil ? 'text-teal-400' : 'text-slate-500'}">
                ${ICON_CANOPY_OIL_SVG}
              </span>
              <span>زيوت أسفل المظلة</span>
            </div>

            <!-- Cylinder Testing & Inspection -->
            <div class="service-pill ${
              s.services.hasCylinderTesting
                ? 'active-service border-purple-500/40 bg-purple-500/10 text-purple-300'
                : 'inactive-service text-slate-500 bg-slate-800/20 opacity-50'
            } flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-semibold">
              <span class="w-4 h-4 flex items-center justify-center shrink-0 ${s.services.hasCylinderTesting ? 'text-purple-400' : 'text-slate-500'}">
                ${ICON_CYLINDER_TESTING_SVG}
              </span>
              <span>فحص واختبار أسطوانات</span>
            </div>

            <!-- CNG Dispensing -->
            <div class="service-pill active-service border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-semibold">
              <span class="w-4 h-4 flex items-center justify-center shrink-0 text-emerald-400">
                ${ICON_CARGAS_STATION_SVG}
              </span>
              <span>تموين غاز طبيعي CNG</span>
            </div>

            <!-- Fast Service / Market -->
            <div class="service-pill ${
              s.services.hasFastService
                ? 'active-service border-rose-500/40 bg-rose-500/10 text-rose-300'
                : 'inactive-service text-slate-500 bg-slate-800/20 opacity-50'
            } flex items-center gap-1.5 p-1.5 rounded-xl border text-[11px] font-semibold">
              <span class="text-xs">${s.services.hasFastService ? '☕' : '⚪'}</span>
              <span>خدمات سريعة / كافيه</span>
            </div>

          </div>
        </div>

        ${
          s.notes
            ? `
          <div class="text-[11px] text-slate-400 bg-slate-800/40 p-2 rounded-xl mb-3 border border-slate-700/30">
            ℹ️ ${escapeHtml(s.notes)}
          </div>
        `
            : ''
        }

        <!-- Quick Utility Toolbar: Copy Coords & Clear Route -->
        <div class="flex items-center gap-1.5 mb-3 p-1.5 rounded-2xl bg-slate-900/60 border border-white/5 overflow-x-auto text-xs">
          <!-- Copy Coordinates Button -->
          <button 
            id="btn-card-copy-coords"
            class="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 border border-slate-700/60"
            title="نسخ خط العرض والطول"
          >
            <span>📍</span>
            <span>نسخ الإحداثيات</span>
          </button>

          <!-- Clear Route Button -->
          <button 
            id="btn-card-clear-route"
            class="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 border border-slate-700/60"
            title="إزالة خط المسار من الخريطة"
          >
            <span>🧹</span>
            <span>مسح المسار</span>
          </button>
        </div>

        <!-- Action Buttons: Primary Navigation (In-App + Universal Offline geo: URI + Google Maps) -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <!-- Primary Navigate Button: Starts In-App Turn-by-Turn Navigation + Native geo: URI on Android -->
            <a
              id="btn-navigate-geo"
              href="${navUrls.geoUri}"
              class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all active:scale-95 text-xs sm:text-sm cursor-pointer"
              title="بدء التوجيه والمسار إلى المحطة (يعمل أوفلاين ويدعم تطبيق الملاحة بالهاتف geo:)"
            >
              <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span>التوجه للمحطة</span>
            </a>

            <!-- Google Maps external link -->
            <a
              id="btn-navigate-google"
              href="${navUrls.googleMapsUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-2xl border border-slate-700/60 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-all text-xs font-bold shrink-0 cursor-pointer"
              title="فتح كمسار في خرائط جوجل (Google Maps)"
            >
              <svg class="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
              </svg>
              <span>خرائط جوجل</span>
            </a>

            <!-- Phone Call -->
            ${
              s.phone
                ? `
              <a
                href="tel:${escapeHtml(s.phone)}"
                class="p-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-2xl border border-slate-700/60 flex items-center justify-center transition-all shrink-0"
                title="اتصال: ${escapeHtml(s.phone)}"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </a>
            `
                : ''
            }
          </div>

          <!-- Secondary Row: In-App Turn-by-Turn OSRM / Offline Direct Route -->
          <button
            id="btn-navigate-inapp"
            type="button"
            class="w-full bg-slate-800/80 hover:bg-slate-700/80 text-emerald-300 border border-emerald-500/30 font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
          >
            <span>🧭</span>
            <span>عرض المسار والإرشاد الصوتي داخل الخريطة</span>
          </button>
        </div>

      </div>
    `;

    // Bind Close Card
    this.container.querySelector('#btn-close-card')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.hide();
      this.onCloseCallback();
    });

    // Bind Primary "التوجه للمحطة" button: Always starts live navigation & routing, and triggers native geo: on Android
    this.container.querySelector('#btn-navigate-geo')?.addEventListener('click', (e) => {
      if (!navUrls.hasValidCoords) {
        e.preventDefault();
        ToastService.show('⚠️ تعذر قراءة إحداثيات هذه المحطة حالياً.', 'warning', 3500);
        return;
      }

      SoundService.playChime('start');

      // On Desktop, iOS, or inside iframes, `geo:` protocol has no handler and fails silently.
      // Prevent default dead protocol navigation and start in-app Turn-by-Turn Navigation immediately.
      if (!canLaunchNativeGeoUri()) {
        e.preventDefault();
      }

      this.onStartNavigationCallback(s);
    });

    // Bind Google Maps button with coordinate validation & offline fallback
    this.container.querySelector('#btn-navigate-google')?.addEventListener('click', (e) => {
      if (!navUrls.hasValidCoords) {
        e.preventDefault();
        ToastService.show('⚠️ إحداثيات هذه المحطة غير صالحة لفتحها في خرائط جوجل.', 'warning');
        return;
      }
      SoundService.playChime('start');
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        e.preventDefault();
        ToastService.show(
          'أنت في وضع الأوفلاين حالياً — تم تشغيل مسار التوجيه المباشر داخل خريطة التطبيق.',
          'info',
          4000
        );
        this.onStartNavigationCallback(s);
      }
    });

    // Bind In-App Navigation
    this.container.querySelector('#btn-navigate-inapp')?.addEventListener('click', () => {
      if (!navUrls.hasValidCoords) {
        ToastService.show('⚠️ إحداثيات هذه المحطة غير صالحة لتحديد المسار.', 'warning');
        return;
      }
      SoundService.playChime('start');
      this.onStartNavigationCallback(s);
    });

    // Bind Copy Coordinates
    this.container.querySelector('#btn-card-copy-coords')?.addEventListener('click', () => {
      SoundService.playChime('click');
      const text = `${navUrls.lat}, ${navUrls.lng}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
          () => ToastService.show(`تم نسخ الإحداثيات: ${text}`, 'success'),
          () => ToastService.show(`الإحداثيات: ${text}`, 'info')
        );
      } else {
        ToastService.show(`الإحداثيات: ${text}`, 'info');
      }
    });

    // Bind Clear Route
    this.container.querySelector('#btn-card-clear-route')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.onClearRouteCallback?.();
      ToastService.show('تم مسح خط المسار من الخريطة', 'info');
    });
  }
}
