import { LocationService, PREDEFINED_LOCATIONS } from '../services/locationService';
import { StationStorage } from '../services/stationStorage';
import { SoundService } from '../services/soundService';
import { ToastService } from '../services/toastService';
import { normalizeArabicSearch } from '../utils/arabicSearch';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export class LocationModalComponent {
  private container: HTMLElement;
  private onLocationChosen: (lat: number, lng: number, label?: string) => void;
  private onRequestMapPick: () => void;
  private searchResults: NominatimResult[] = [];
  private isSearching = false;
  private isRefreshingGps = false;
  private searchQuery = '';

  constructor(
    container: HTMLElement,
    handlers: {
      onLocationChosen: (lat: number, lng: number, label?: string) => void;
      onRequestMapPick: () => void;
    }
  ) {
    this.container = container;
    this.onLocationChosen = handlers.onLocationChosen;
    this.onRequestMapPick = handlers.onRequestMapPick;
  }

  show(): void {
    this.container.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }

  private render(): void {
    const diag = LocationService.getDiagnostics();
    const { location, districtName, status, warningMessage, lastRejectedLocation } = diag;

    const statusBadgeHtml = (() => {
      switch (status) {
        case 'accurate':
          return `<span class="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">📡 GPS عالي الدقة (±${Math.round(location.accuracy || 0)} م)</span>`;
        case 'manual':
          return `<span class="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full font-bold">📌 موقع محدد يدوياً</span>`;
        case 'low_accuracy':
          return `<span class="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold">⚠️ إشارة متصفح ضعيفة الدقة</span>`;
        case 'outside_egypt':
          return `<span class="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold">⚠️ موقع متصفح خارج مصر</span>`;
        case 'timeout':
          return `<span class="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold">⏱️ انتهت مهلة إشارة الـ GPS</span>`;
        case 'unavailable':
          return `<span class="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-bold">📡 إشارة الـ GPS غير متاحة</span>`;
        case 'denied':
          return `<span class="text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full font-bold">🚫 إذن الموقع مرفوض</span>`;
        default:
          return `<span class="text-[11px] bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-bold">⏳ موقع افتراضي (القاهرة)</span>`;
      }
    })();

    const cairoGizaLocations = PREDEFINED_LOCATIONS.filter(
      (p) => p.governorate === 'القاهرة' || p.governorate === 'الجيزة' || p.governorate === 'القليوبية'
    );
    const otherGovLocations = PREDEFINED_LOCATIONS.filter(
      (p) => p.governorate !== 'القاهرة' && p.governorate !== 'الجيزة' && p.governorate !== 'القليوبية'
    );

    this.container.innerHTML = `
      <div class="modal-backdrop fixed inset-0 bg-black/75 backdrop-blur-sm z-[1100] flex items-center justify-center p-3 sm:p-5">
        <div class="glass-card w-full max-w-2xl max-h-[90vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden animate-scale-up text-right">
          
          <!-- Header -->
          <div class="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/70">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl border border-blue-500/30">
                📍
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black text-white">تحديد موقعي الحالي بدقة</h3>
                <p class="text-xs text-slate-400">لإيجاد أقرب محطة كارجاس ورسم المسار الصحيح من شارعك</p>
              </div>
            </div>
            <button id="btn-close-loc-modal" class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800/80 transition-colors" title="إغلاق">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">

            <!-- Current Active Location Card -->
            <div class="p-4 rounded-2xl bg-slate-900/70 border border-emerald-500/30 space-y-2.5">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs text-slate-400 font-bold">الموقع المستخدم حالياً لحساب أقرب محطة:</span>
                ${statusBadgeHtml}
              </div>
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="text-base font-black text-emerald-400">${districtName}</div>
                <div class="text-xs font-mono text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-white/5" dir="ltr">
                  ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}
                </div>
              </div>

              ${
                warningMessage
                  ? `
                <div class="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 leading-relaxed space-y-2">
                  <div>⚠️ ${warningMessage}</div>
                  ${
                    lastRejectedLocation && LocationService.isWithinEgypt(lastRejectedLocation.lat, lastRejectedLocation.lng)
                      ? `
                    <button id="btn-accept-rejected-loc" class="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold px-3 py-1 rounded-lg text-[11px] transition-all">
                      استخدام موقع المتصفح على أي حال (${lastRejectedLocation.district})
                    </button>
                  `
                      : ''
                  }
                </div>
              `
                  : ''
              }

              <!-- Primary Action Buttons -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button id="btn-loc-gps-refresh" ${this.isRefreshingGps ? 'disabled' : ''} class="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black py-2.5 px-3 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                  <span>📡</span>
                  <span>${this.isRefreshingGps ? 'جارٍ فحص إشارة الـ GPS...' : 'تحديث الموقع من الـ GPS'}</span>
                </button>
                <button id="btn-loc-pick-map" class="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-3 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2">
                  <span>👆</span>
                  <span>تحديد موقعي بنقرة على الخريطة</span>
                </button>
              </div>
              <div class="text-[11px] text-slate-400 text-center">
                تلميح: يمكنك أيضاً سحب الدبوس الأزرق على الخريطة مباشرة إلى شارعك!
              </div>
            </div>

            <!-- Street / Address Search in Egypt (Free OSM Nominatim) -->
            <div class="p-4 rounded-2xl bg-slate-900/50 border border-white/10 space-y-2.5">
              <div class="text-xs font-black text-white">🔍 ابحث باسم شارعك أو حيّك في مصر (خرائط مجانية):</div>
              <form id="loc-address-search-form" class="flex items-center gap-2">
                <input
                  type="text"
                  id="loc-address-input"
                  value="${this.searchQuery}"
                  placeholder="مثال: عباس العقاد مدينة نصر، أو كورنيش المعادي، أو محطة الرمل..."
                  class="flex-1 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-cairo"
                />
                <button type="submit" ${this.isSearching ? 'disabled' : ''} class="bg-slate-700 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shrink-0">
                  ${this.isSearching ? 'بحث...' : 'بحث'}
                </button>
              </form>

              ${
                this.searchResults.length > 0
                  ? `
                <div class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pt-1">
                  ${this.searchResults
                    .map(
                      (r, idx) => `
                    <button
                      type="button"
                      data-nominatim-idx="${idx}"
                      class="w-full text-right p-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-600/30 border border-white/5 hover:border-emerald-500/40 text-xs text-slate-200 transition-all flex items-center justify-between gap-2"
                    >
                      <span class="truncate">📍 ${r.display_name}</span>
                      <span class="text-[10px] text-emerald-400 font-bold shrink-0">اختيار</span>
                    </button>
                  `
                    )
                    .join('')}
                </div>
              `
                  : ''
              }
            </div>

            <!-- Quick Predefined Districts: Greater Cairo -->
            <div class="space-y-2">
              <div class="text-xs font-black text-emerald-400">🏙️ اختيار سريع — القاهرة الكبرى والجيزة:</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${cairoGizaLocations
                  .map(
                    (loc) => `
                  <button
                    type="button"
                    data-preset-id="${loc.id}"
                    class="text-right p-2.5 rounded-xl bg-slate-800/60 hover:bg-emerald-600/25 border border-white/10 hover:border-emerald-500/50 transition-all group"
                  >
                    <div class="text-xs font-bold text-white group-hover:text-emerald-300 flex items-center justify-between">
                      <span>${loc.name}</span>
                      <span class="text-[10px] text-slate-400">${loc.governorate}</span>
                    </div>
                    <div class="text-[10px] text-slate-400 truncate mt-0.5">${loc.description}</div>
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Quick Predefined Districts: Other Governorates -->
            <div class="space-y-2">
              <div class="text-xs font-black text-blue-400">🌍 المحافظات الأخرى:</div>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                ${otherGovLocations
                  .map(
                    (loc) => `
                  <button
                    type="button"
                    data-preset-id="${loc.id}"
                    class="text-right p-2.5 rounded-xl bg-slate-800/60 hover:bg-blue-600/25 border border-white/10 hover:border-blue-500/50 transition-all"
                  >
                    <div class="text-xs font-bold text-white">${loc.name}</div>
                    <div class="text-[10px] text-slate-400 truncate">${loc.governorate}</div>
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    this.container.querySelector('#btn-close-loc-modal')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.hide();
    });

    this.container.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hide();
    });

    this.container.querySelector('#btn-loc-gps-refresh')?.addEventListener('click', async () => {
      SoundService.playChime('click');
      this.isRefreshingGps = true;
      this.render();
      const result = await LocationService.forceRefreshGPS();
      this.isRefreshingGps = false;
      if (result.success) {
        SoundService.playChime('start');
        ToastService.show(`✅ ${result.message}`, 'success', 4000);
        this.hide();
        this.onLocationChosen(result.loc.lat, result.loc.lng);
      } else {
        ToastService.show(result.message, 'warning', 4500);
        this.render();
      }
    });

    this.container.querySelector('#btn-loc-pick-map')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.hide();
      this.onRequestMapPick();
    });

    this.container.querySelector('#btn-accept-rejected-loc')?.addEventListener('click', () => {
      if (LocationService.acceptRejectedLocation()) {
        const loc = LocationService.getLocation();
        SoundService.playChime('start');
        this.hide();
        this.onLocationChosen(loc.lat, loc.lng);
      }
    });

    this.container.querySelector('#loc-address-search-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = this.container.querySelector('#loc-address-input') as HTMLInputElement;
      const query = input?.value.trim() || '';
      this.searchQuery = query;
      if (!query) return;

      const buildOfflineMatches = (): NominatimResult[] => {
        const qNorm = normalizeArabicSearch(query);
        const tokens = qNorm.split(/\s+/).filter(Boolean);
        const results: NominatimResult[] = [];

        for (const preset of PREDEFINED_LOCATIONS) {
          const hay = normalizeArabicSearch(`${preset.name} ${preset.governorate} ${preset.description}`);
          if (tokens.every((t) => hay.includes(t))) {
            results.push({
              display_name: `${preset.governorate} - ${preset.name} (${preset.description})`,
              lat: String(preset.lat),
              lon: String(preset.lng),
            });
          }
        }

        const stations = StationStorage.getStations();
        for (const st of stations) {
          if (results.length >= 8) break;
          const hay = normalizeArabicSearch(`${st.name} ${st.governorate} ${st.city || ''} ${st.address || ''}`);
          if (tokens.every((t) => hay.includes(t))) {
            results.push({
              display_name: `قرب محطة ${st.name} (${st.governorate}${st.city ? ` - ${st.city}` : ''})`,
              lat: String(st.lat),
              lon: String(st.lng),
            });
          }
        }
        return results;
      };

      // Strictly skip external Nominatim network request when offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.searchResults = buildOfflineMatches();
        if (this.searchResults.length === 0) {
          ToastService.show('أنت في وضع الأوفلاين: اختر منطقتك من القائمة أو انقر على الخريطة.', 'info');
        } else {
          ToastService.show(`تم العثور على ${this.searchResults.length} موقع مطابق من قاعدة البيانات المحلية (أوفلاين).`, 'info', 3000);
        }
        this.render();
        return;
      }

      this.isSearching = true;
      this.render();
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=eg&accept-language=ar&limit=6&q=${encodeURIComponent(query)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Network error');
        const data = (await resp.json()) as NominatimResult[];
        this.searchResults = data.length > 0 ? data : buildOfflineMatches();
        if (this.searchResults.length === 0) {
          ToastService.show('لم يتم العثور على نتائج مطابقة في مصر، جرب كتابة اسم الحي أو الشارع بشكل أبسط.', 'info');
        }
      } catch {
        this.searchResults = buildOfflineMatches();
        ToastService.show('تعذر الاتصال بخدمة العناوين؛ تم البحث محلياً أوفلاين أو يمكنك النقر على الخريطة.', 'warning');
      } finally {
        this.isSearching = false;
        this.render();
      }
    });

    this.container.querySelectorAll('[data-nominatim-idx]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.nominatimIdx);
        const item = this.searchResults[idx];
        if (item) {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            SoundService.playChime('start');
            LocationService.setManualLocation(lat, lng, true);
            this.hide();
            this.onLocationChosen(lat, lng, item.display_name.split(',')[0]);
          }
        }
      });
    });

    this.container.querySelectorAll('[data-preset-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.presetId;
        const preset = PREDEFINED_LOCATIONS.find((p) => p.id === id);
        if (preset) {
          SoundService.playChime('start');
          LocationService.setManualLocation(preset.lat, preset.lng, true);
          this.hide();
          this.onLocationChosen(preset.lat, preset.lng, `${preset.governorate} - ${preset.name}`);
        }
      });
    });
  }
}
