import { Station, UserLocation } from '../types';
import { LocationService } from '../services/locationService';
import { SoundService } from '../services/soundService';
import { ToastService } from '../services/toastService';
import { escapeHtml } from '../utils/html';
import { normalizeArabicSearch } from '../utils/arabicSearch';
import { getStationNavigationUrls, canLaunchNativeGeoUri } from '../utils/navigationLinks';

export class StationListModalComponent {
  private container: HTMLElement;
  private stations: Station[] = [];
  private userLocation: UserLocation;
  private onSelectStationCallback: (station: Station) => void;
  private onNavigateStationCallback?: (station: Station) => void;
  private searchQuery = '';
  private selectedGov = 'all';
  private selectedService = 'all';

  constructor(
    container: HTMLElement,
    userLocation: UserLocation,
    handlers: {
      onSelectStation: (station: Station) => void;
      onNavigateStation?: (station: Station) => void;
    }
  ) {
    this.container = container;
    this.userLocation = userLocation;
    this.onSelectStationCallback = handlers.onSelectStation;
    this.onNavigateStationCallback = handlers.onNavigateStation;
  }

  updateData(stations: Station[], userLocation: UserLocation): void {
    this.stations = stations;
    this.userLocation = userLocation;
    if (!this.container.classList.contains('hidden')) {
      this.render();
    }
  }

  show(): void {
    this.container.classList.remove('hidden');
    this.render();
  }

  showWithQuery(query: string): void {
    this.searchQuery = query;
    this.selectedGov = 'all';
    this.selectedService = 'all';
    this.container.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }

  private render(): void {
    const govs = Array.from(
      new Set(this.stations.map((s) => (s.governorate || '').trim()).filter(Boolean))
    );

    const sorted = LocationService.sortStationsByDistance(this.userLocation, this.stations);

    const normalizedQuery = normalizeArabicSearch(this.searchQuery);
    const queryTokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

    const filtered = sorted.filter((s) => {
      let matchSearch = true;
      if (queryTokens.length > 0) {
        const haystack = normalizeArabicSearch(
          `${s.name || ''} ${s.stationName || ''} ${s.address || ''} ${s.city || ''} ${s.governorate || ''} ${s.company || ''} ${s.lat ?? ''},${s.lng ?? ''}`
        );
        matchSearch = queryTokens.every((tok) => haystack.includes(tok));
      }

      const gov = (s.governorate || '').trim();
      const matchGov = this.selectedGov === 'all' || gov === this.selectedGov;

      const svc = s.services || {
        hasConversionCenter: false,
        hasLubeCenter: false,
        hasCylinderTesting: false,
        hasCanopyOil: false,
        hasFastService: false,
      };
      let matchService = true;
      if (this.selectedService === 'conversion') {
        matchService = Boolean(svc.hasConversionCenter);
      } else if (this.selectedService === 'lube') {
        matchService = Boolean(svc.hasLubeCenter);
      } else if (this.selectedService === 'canopy') {
        matchService = Boolean(svc.hasCanopyOil);
      } else if (this.selectedService === 'cylinder') {
        matchService = Boolean(svc.hasCylinderTesting);
      }

      return matchSearch && matchGov && matchService;
    });

    const hasActiveFilters =
      Boolean(this.searchQuery.trim()) ||
      this.selectedGov !== 'all' ||
      this.selectedService !== 'all';

    this.container.innerHTML = `
      <div class="modal-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-center justify-center p-3 sm:p-5">
        <div class="modal-window glass-card w-full max-w-2xl max-h-[90vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden animate-scale-up">
          
          <!-- Modal Header -->
          <div class="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                ⛽
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black text-white">
                  دليل محطات الغاز وكارجاس
                </h3>
                <p class="text-xs text-slate-400">
                  إجمالي ${this.stations.length} محطة مسجلة • عرض ${filtered.length} محطة مرتبة حسب الأقرب لموقعك
                </p>
              </div>
            </div>

            <button 
              id="btn-close-list-modal"
              class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800/80 transition-colors"
              title="إغلاق"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Search & Filter Controls -->
          <div class="p-3 sm:p-4 bg-slate-900/60 border-b border-white/10 space-y-2.5">
            
            <!-- Search Input -->
            <div class="relative flex items-center gap-2">
              <div class="relative flex-1">
                <input 
                  type="text" 
                  id="station-search-input"
                  placeholder="ابحث باسم المحطة، المقطم، الشارع، الحي، أو المحافظة..."
                  value="${escapeHtml(this.searchQuery)}"
                  class="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl px-4 py-2.5 pl-16 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-cairo"
                />
                <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                ${
                  this.searchQuery
                    ? `<button type="button" id="btn-clear-list-search" class="absolute left-9 top-2.5 w-6 h-6 rounded-full bg-slate-700 hover:bg-rose-500/40 text-slate-200 text-xs flex items-center justify-center transition-colors" title="مسح البحث">✕</button>`
                    : ''
                }
              </div>
              ${
                hasActiveFilters
                  ? `<button type="button" id="btn-reset-list-filters" class="px-3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold shrink-0 transition-all" title="إعادة ضبط كافة الفلاتر">🔄 مسح الفلاتر</button>`
                  : ''
              }
            </div>

            <!-- Filter Row: Gov & Services -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              
              <!-- Governorate Selector -->
              <select 
                id="filter-gov-select" 
                class="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-cairo"
              >
                <option value="all">كل المحافظات (${this.stations.length})</option>
                ${govs.map((g) => `<option value="${escapeHtml(g)}" ${this.selectedGov === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
              </select>

              <!-- Service Filter Chips -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button data-service="all" class="filter-chip ${this.selectedService === 'all' ? 'active' : ''} px-3 py-1.5 rounded-xl border text-xs font-bold transition-all">
                  الكل
                </button>
                <button data-service="conversion" class="filter-chip ${this.selectedService === 'conversion' ? 'active' : ''} px-3 py-1.5 rounded-xl border text-xs font-bold transition-all">
                  ⚙️ مركز تحويل
                </button>
                <button data-service="lube" class="filter-chip ${this.selectedService === 'lube' ? 'active' : ''} px-3 py-1.5 rounded-xl border text-xs font-bold transition-all">
                  🛢️ مركز زيوت
                </button>
                <button data-service="cylinder" class="filter-chip ${this.selectedService === 'cylinder' ? 'active' : ''} px-3 py-1.5 rounded-xl border text-xs font-bold transition-all">
                  🔬 فحص أسطوانات
                </button>
                <button data-service="canopy" class="filter-chip ${this.selectedService === 'canopy' ? 'active' : ''} px-3 py-1.5 rounded-xl border text-xs font-bold transition-all">
                  ⛽ زيوت مظلة
                </button>
              </div>

            </div>

          </div>

          <!-- Station Cards List -->
          <div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar">
            ${
              filtered.length === 0
                ? `
              <div class="text-center py-12 text-slate-400 space-y-2">
                <div class="text-3xl mb-2">🔍</div>
                <div class="font-bold">لا توجد محطات تطابق بحثك</div>
                <div class="text-xs text-slate-500 mt-1">جرب تغيير معايير البحث أو اختيار محافظة أخرى</div>
                ${
                  hasActiveFilters
                    ? `<button type="button" id="btn-empty-reset-filters" class="mt-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">عرض كافة المحطات (${this.stations.length})</button>`
                    : ''
                }
              </div>
            `
                : filtered
                    .map((station) => {
                      const distText = station.distanceKm !== undefined ? LocationService.formatDistance(station.distanceKm) : '';
                      const latOk = Number.isFinite(Number(station.lat)) && Number.isFinite(Number(station.lng));
                      const svc = station.services || {
                        hasConversionCenter: false,
                        hasLubeCenter: false,
                        hasCylinderTesting: false,
                        hasCanopyOil: false,
                        hasFastService: false,
                      };
                      return `
                  <div 
                    class="station-item-card glass-panel hover:border-emerald-500/60 p-3 sm:p-4 rounded-2xl border border-white/5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between gap-3 group"
                    data-station-id="${escapeHtml(station.id)}"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1 flex-wrap">
                        <span class="text-xs font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          ${escapeHtml(station.company || 'كارجاس')}
                        </span>
                        <span class="text-[11px] text-slate-400">
                          📍 ${escapeHtml(station.governorate || 'مصر')} ${station.city ? `• ${escapeHtml(station.city)}` : ''}
                        </span>
                      </div>

                      <h4 class="text-sm sm:text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        ${escapeHtml(station.name || station.stationName || 'محطة كارجاس')}
                      </h4>

                      <p class="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                        ${escapeHtml(station.address || station.city || station.governorate || '')}
                      </p>

                      <!-- Mini badges -->
                      <div class="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                        ${svc.hasConversionCenter ? '<span class="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold">⚙️ تحويل وصيانة</span>' : ''}
                        ${svc.hasLubeCenter ? '<span class="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-semibold">🛢️ مركز زيوت</span>' : ''}
                        ${svc.hasCylinderTesting ? '<span class="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-semibold">🔬 فحص أسطوانات</span>' : ''}
                        ${svc.hasCanopyOil ? '<span class="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-md font-semibold">⛽ زيوت مظلة</span>' : ''}
                      </div>
                    </div>

                    <!-- Distance & Action Buttons -->
                    <div class="flex flex-col items-end gap-1.5 shrink-0">
                      ${
                        distText
                          ? `
                        <div class="text-right">
                          <div class="text-xs sm:text-sm font-black text-emerald-400">${distText}</div>
                          <div class="text-[10px] text-slate-400">${station.durationMin ? `~ ${station.durationMin} دقيقة` : ''}</div>
                        </div>
                      `
                          : ''
                      }
                      <div class="flex items-center gap-1 flex-wrap justify-end">
                        ${
                          latOk
                            ? `<a
                                href="${getStationNavigationUrls(station, this.userLocation).geoUri}"
                                data-station-action="geo"
                                data-station-id="${escapeHtml(station.id)}"
                                class="p-1.5 bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 rounded-xl transition-all"
                                title="التوجه للمحطة مباشرة (مسار داخل الخريطة أو تطبيق الملاحة geo:)"
                              >
                                🧭
                              </a>`
                            : ''
                        }
                        <button 
                          data-station-action="copy" 
                          data-station-id="${escapeHtml(station.id)}"
                          class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                          title="نسخ الإحداثيات"
                        >
                          📍
                        </button>
                        <button 
                          data-station-action="select"
                          data-station-id="${escapeHtml(station.id)}"
                          class="bg-emerald-600/30 group-hover:bg-emerald-600 text-emerald-300 group-hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <span>عرض</span>
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                  </div>
                `;
                    })
                    .join('')
            }
          </div>

        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    this.container.querySelector('#btn-close-list-modal')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.hide();
    });

    this.container.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hide();
      }
    });

    const resetFilters = () => {
      SoundService.playChime('click');
      this.searchQuery = '';
      this.selectedGov = 'all';
      this.selectedService = 'all';
      this.render();
    };

    this.container.querySelector('#btn-clear-list-search')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.searchQuery = '';
      this.render();
      (this.container.querySelector('#station-search-input') as HTMLInputElement)?.focus();
    });

    this.container.querySelector('#btn-reset-list-filters')?.addEventListener('click', resetFilters);
    this.container.querySelector('#btn-empty-reset-filters')?.addEventListener('click', resetFilters);

    const searchInput = this.container.querySelector('#station-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
      const newInput = this.container.querySelector('#station-search-input') as HTMLInputElement;
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });

    const govSelect = this.container.querySelector('#filter-gov-select') as HTMLSelectElement;
    govSelect?.addEventListener('change', (e) => {
      this.selectedGov = (e.target as HTMLSelectElement).value;
      this.render();
    });

    this.container.querySelectorAll('[data-service]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        SoundService.playChime('click');
        this.selectedService = (e.currentTarget as HTMLElement).dataset.service || 'all';
        this.render();
      });
    });

    this.container.querySelectorAll('[data-station-action="geo"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canLaunchNativeGeoUri()) {
          e.preventDefault();
        }
        SoundService.playChime('start');
        const id = (e.currentTarget as HTMLElement).dataset.stationId;
        const station = this.stations.find((s) => s.id === id);
        if (station) {
          this.hide();
          if (this.onNavigateStationCallback) {
            this.onNavigateStationCallback(station);
          } else {
            this.onSelectStationCallback(station);
          }
        }
      });
    });

    // Copy coordinates button inside card
    this.container.querySelectorAll('[data-station-action="copy"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundService.playChime('click');
        const id = (e.currentTarget as HTMLElement).dataset.stationId;
        const station = this.stations.find((s) => s.id === id);
        if (station) {
          const text = `${station.lat}, ${station.lng}`;
          navigator.clipboard?.writeText(text).then(
            () => ToastService.show(`تم نسخ الإحداثيات: ${text}`, 'success'),
            () => ToastService.show(`الإحداثيات: ${text}`, 'info')
          );
        }
      });
    });

    // Card or select button click
    this.container.querySelectorAll('.station-item-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.stationId;
        const station = this.stations.find((s) => s.id === id);
        if (station) {
          SoundService.playChime('click');
          this.hide();
          this.onSelectStationCallback(station);
        }
      });
    });
  }
}
