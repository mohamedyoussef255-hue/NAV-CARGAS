import { Station, UserLocation } from '../types';
import { LocationService } from '../services/locationService';
import { StationStorage } from '../services/stationStorage';
import { SoundService } from '../services/soundService';
import { escapeHtml } from '../utils/html';
import { normalizeArabicSearch } from '../utils/arabicSearch';
import { DEFAULT_CARGAS_LOGO_DATA_URL } from '../assets/cargasLogo';

export type MapServiceFilter = 'all' | 'conversion' | 'lube' | 'cylinder' | 'canopy';

export class MapSearchComponent {
  private container: HTMLElement;
  private stations: Station[] = [];
  private userLocation: UserLocation;
  private query = '';
  private activeFilter: MapServiceFilter = 'all';
  private isDropdownOpen = false;
  private onSelectStationCallback: (station: Station) => void;
  private onFilterChangeCallback: (filteredStations: Station[], filter: MapServiceFilter) => void;
  private onOpenFullListCallback: (query: string) => void;

  constructor(
    container: HTMLElement,
    userLocation: UserLocation,
    handlers: {
      onSelectStation: (station: Station) => void;
      onFilterChange: (filteredStations: Station[], filter: MapServiceFilter) => void;
      onOpenFullList: (query: string) => void;
    }
  ) {
    this.container = container;
    this.userLocation = userLocation;
    this.onSelectStationCallback = handlers.onSelectStation;
    this.onFilterChangeCallback = handlers.onFilterChange;
    this.onOpenFullListCallback = handlers.onOpenFullList;

    this.render();
    this.bindGlobalClose();
  }

  updateData(stations: Station[], userLocation: UserLocation): void {
    this.stations = stations;
    this.userLocation = userLocation;
    this.updateFilterCounts();
    if (this.isDropdownOpen || this.query.trim().length > 0) {
      this.renderDropdown();
    }
  }

  getActiveFilter(): MapServiceFilter {
    return this.activeFilter;
  }

  resetFilter(): void {
    this.activeFilter = 'all';
    this.updateFilterButtonsUI();
    this.onFilterChangeCallback(this.stations, 'all');
  }

  getFilteredStationsByService(stations: Station[] = this.stations): Station[] {
    if (this.activeFilter === 'all') return stations;
    return stations.filter((s) => {
      const svc = s.services;
      if (!svc) return false;
      switch (this.activeFilter) {
        case 'conversion':
          return svc.hasConversionCenter;
        case 'lube':
          return svc.hasLubeCenter;
        case 'cylinder':
          return svc.hasCylinderTesting;
        case 'canopy':
          return svc.hasCanopyOil;
        default:
          return true;
      }
    });
  }

  private searchStations(rawQuery: string): Station[] {
    const q = normalizeArabicSearch(rawQuery);
    const pool = LocationService.sortStationsByDistance(this.userLocation, this.stations);
    if (!q) {
      return pool.slice(0, 8);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    return pool.filter((s) => {
      const haystack = normalizeArabicSearch(
        `${s.name || ''} ${s.stationName || ''} ${s.governorate || ''} ${s.city || ''} ${s.address || ''} ${s.company || ''} ${s.lat},${s.lng}`
      );
      return tokens.every((tok) => haystack.includes(tok));
    });
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="map-search-shell w-full max-w-md mx-auto pointer-events-auto relative">
        <!-- Search Box -->
        <div class="map-search-bar flex items-center gap-1.5 rounded-2xl px-3 py-1.5 shadow-2xl border transition-all">
          <button
            type="button"
            id="btn-map-search-go"
            class="w-7 h-7 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0 transition-all"
            title="بحث عن محطة على الخريطة"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          <input
            type="text"
            id="map-search-input"
            value="${escapeHtml(this.query)}"
            autocomplete="off"
            placeholder="ابحث بالخريطة: اسم المحطة، المقطم، المحافظة..."
            class="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm font-bold text-white placeholder-slate-400 font-cairo min-w-0 py-1"
          />

          <button
            type="button"
            id="btn-map-search-clear"
            class="${this.query ? 'flex' : 'hidden'} w-6 h-6 rounded-full bg-slate-700/80 hover:bg-rose-500/40 text-slate-300 hover:text-white items-center justify-center text-xs transition-all shrink-0"
            title="مسح البحث"
          >
            ✕
          </button>

          <button
            type="button"
            id="btn-map-search-expand-list"
            class="w-7 h-7 rounded-xl bg-slate-800/80 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 flex items-center justify-center text-xs shrink-0 transition-all border border-white/10"
            title="فتح نتائج البحث في الجدول الكامل"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Quick Service Filter Chips on Map -->
        <div id="map-quick-filters" class="flex items-center justify-center gap-1 mt-1.5 overflow-x-auto no-scrollbar pb-0.5 text-[10px] font-bold">
          <button type="button" data-map-filter="all" class="map-filter-chip active px-2.5 py-1 rounded-full border transition-all shrink-0">
            الكل (<span id="map-count-all">${this.stations.length}</span>)
          </button>
          <button type="button" data-map-filter="conversion" class="map-filter-chip px-2.5 py-1 rounded-full border transition-all shrink-0">
            ⚙️ تحويل
          </button>
          <button type="button" data-map-filter="lube" class="map-filter-chip px-2.5 py-1 rounded-full border transition-all shrink-0">
            🛢️ زيوت
          </button>
          <button type="button" data-map-filter="cylinder" class="map-filter-chip px-2.5 py-1 rounded-full border transition-all shrink-0">
            🔬 فحص
          </button>
          <button type="button" data-map-filter="canopy" class="map-filter-chip px-2.5 py-1 rounded-full border transition-all shrink-0">
            ⛽ مظلة
          </button>
        </div>

        <!-- Live Search Results Dropdown -->
        <div id="map-search-dropdown" class="hidden absolute top-[44px] left-0 right-0 mt-1 rounded-2xl glass-card border border-emerald-500/30 shadow-2xl overflow-hidden z-40"></div>
      </div>
    `;

    this.attachEvents();
  }

  private updateFilterCounts(): void {
    const countEl = this.container.querySelector('#map-count-all');
    if (countEl) {
      countEl.textContent = String(this.stations.length);
    }
  }

  private updateFilterButtonsUI(): void {
    this.container.querySelectorAll('[data-map-filter]').forEach((btn) => {
      const f = (btn as HTMLElement).dataset.mapFilter as MapServiceFilter;
      btn.classList.toggle('active', f === this.activeFilter);
    });
  }

  private renderDropdown(): void {
    const dropdown = this.container.querySelector('#map-search-dropdown') as HTMLElement | null;
    if (!dropdown) return;

    if (!this.isDropdownOpen) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }

    const matches = this.searchStations(this.query);
    const fallbackUrl = DEFAULT_CARGAS_LOGO_DATA_URL.replace(/"/g, '&quot;');
    const topMatches = matches.slice(0, 12);

    dropdown.classList.remove('hidden');

    if (topMatches.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-300 space-y-2">
          <div class="text-xl">🔍</div>
          <div class="font-bold">لا توجد محطة مطابقة لـ "${escapeHtml(this.query)}"</div>
          <button type="button" id="btn-map-search-reset-all" class="bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-1.5 rounded-xl font-bold text-[11px] border border-white/10">
            مسح كلمة البحث وعرض المحطات الأقرب
          </button>
        </div>
      `;
      dropdown.querySelector('#btn-map-search-reset-all')?.addEventListener('click', () => {
        this.query = '';
        const input = this.container.querySelector('#map-search-input') as HTMLInputElement | null;
        if (input) input.value = '';
        this.updateClearButton();
        this.renderDropdown();
      });
      return;
    }

    dropdown.innerHTML = `
      <div class="px-3 py-2 bg-slate-900/90 border-b border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <span>${this.query.trim() ? `نتائج البحث (${matches.length})` : `أقرب المحطات إليك (${this.stations.length})`}</span>
        <button type="button" id="btn-dropdown-close" class="text-slate-400 hover:text-white px-1.5">إغلاق ✕</button>
      </div>
      <div class="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-white/5">
        ${topMatches
          .map((s) => {
            const dist = s.distanceKm !== undefined ? LocationService.formatDistance(s.distanceKm) : '';
            const logo = StationStorage.getLogoForCompany(s.company, s.logoUrl);
            const companyName = StationStorage.normalizeCompanyName(s.company);
            return `
              <button
                type="button"
                data-map-result-id="${escapeHtml(s.id)}"
                class="w-full text-right p-2.5 hover:bg-emerald-600/20 transition-colors flex items-center justify-between gap-2.5"
              >
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                  <img
                    src="${logo}"
                    onerror="this.onerror=null;this.src='${fallbackUrl}';"
                    alt="${escapeHtml(companyName)}"
                    class="w-7 h-7 rounded-full object-contain bg-slate-900 border border-emerald-500/40 p-0.5 shrink-0"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-black text-white truncate">${escapeHtml(s.name)}</div>
                    <div class="text-[10px] text-slate-400 truncate">
                      <span class="text-emerald-300 font-bold">[${escapeHtml(companyName)}]</span> 📍 ${escapeHtml(s.governorate || 'مصر')}${s.city ? ` • ${escapeHtml(s.city)}` : ''}${s.address ? ` — ${escapeHtml(s.address)}` : ''}
                    </div>
                  </div>
                </div>
                <div class="text-left shrink-0">
                  ${dist ? `<div class="text-[11px] font-black text-emerald-400">${dist}</div>` : ''}
                  <div class="text-[9px] text-slate-400">انتقال ↵</div>
                </div>
              </button>
            `;
          })
          .join('')}
      </div>
      ${
        matches.length > 12
          ? `
        <button type="button" id="btn-map-search-more" class="w-full py-2 bg-slate-900/95 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-black border-t border-white/10 transition-colors">
          عرض كل النتائج (${matches.length}) في قائمة المحطات ←
        </button>
      `
          : ''
      }
    `;

    dropdown.querySelector('#btn-dropdown-close')?.addEventListener('click', () => {
      this.isDropdownOpen = false;
      this.renderDropdown();
    });

    dropdown.querySelector('#btn-map-search-more')?.addEventListener('click', () => {
      this.isDropdownOpen = false;
      this.renderDropdown();
      this.onOpenFullListCallback(this.query);
    });

    dropdown.querySelectorAll('[data-map-result-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.mapResultId;
        const station = this.stations.find((st) => st.id === id);
        if (station) {
          SoundService.playChime('click');
          this.isDropdownOpen = false;
          this.renderDropdown();
          this.onSelectStationCallback(station);
        }
      });
    });
  }

  private updateClearButton(): void {
    const clearBtn = this.container.querySelector('#btn-map-search-clear');
    if (!clearBtn) return;
    clearBtn.classList.toggle('hidden', !this.query);
    clearBtn.classList.toggle('flex', Boolean(this.query));
  }

  private attachEvents(): void {
    const input = this.container.querySelector('#map-search-input') as HTMLInputElement | null;
    const clearBtn = this.container.querySelector('#btn-map-search-clear');
    const goBtn = this.container.querySelector('#btn-map-search-go');
    const listBtn = this.container.querySelector('#btn-map-search-expand-list');

    input?.addEventListener('focus', () => {
      this.isDropdownOpen = true;
      this.renderDropdown();
    });

    input?.addEventListener('input', () => {
      this.query = input.value;
      this.isDropdownOpen = true;
      this.updateClearButton();
      this.renderDropdown();
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const matches = this.searchStations(this.query);
        if (matches.length > 0) {
          SoundService.playChime('click');
          this.isDropdownOpen = false;
          this.renderDropdown();
          this.onSelectStationCallback(matches[0]);
        }
      } else if (e.key === 'Escape') {
        this.isDropdownOpen = false;
        this.renderDropdown();
        input.blur();
      }
    });

    clearBtn?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.query = '';
      if (input) {
        input.value = '';
        input.focus();
      }
      this.updateClearButton();
      this.isDropdownOpen = true;
      this.renderDropdown();
    });

    goBtn?.addEventListener('click', () => {
      SoundService.playChime('click');
      const matches = this.searchStations(this.query);
      if (this.query.trim() && matches.length > 0) {
        this.isDropdownOpen = false;
        this.renderDropdown();
        this.onSelectStationCallback(matches[0]);
      } else {
        this.isDropdownOpen = true;
        this.renderDropdown();
        input?.focus();
      }
    });

    listBtn?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.isDropdownOpen = false;
      this.renderDropdown();
      this.onOpenFullListCallback(this.query);
    });

    this.container.querySelectorAll('[data-map-filter]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        SoundService.playChime('click');
        const nextFilter = (e.currentTarget as HTMLElement).dataset.mapFilter as MapServiceFilter;
        this.activeFilter = nextFilter || 'all';
        this.updateFilterButtonsUI();
        const filtered = this.getFilteredStationsByService();
        this.onFilterChangeCallback(filtered, this.activeFilter);
      });
    });
  }

  private bindGlobalClose(): void {
    document.addEventListener('click', (e) => {
      if (!this.isDropdownOpen) return;
      if (!this.container.contains(e.target as Node)) {
        this.isDropdownOpen = false;
        this.renderDropdown();
      }
    });
  }
}
