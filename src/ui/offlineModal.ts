import {
  EGYPT_OFFLINE_BOUNDS,
  MapLayerStyle,
  OfflineMapService,
  OfflineTileProgress,
  TileDownloadBounds,
} from '../services/offlineMapService';
import { PwaService } from '../services/pwaService';
import { SoundService } from '../services/soundService';
import { ToastService } from '../services/toastService';

export interface MapViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom?: number;
}

export class OfflineModalComponent {
  private container: HTMLElement;
  private getMapBoundsCallback: () => MapViewportBounds | null;
  private isDownloading = false;
  private abortController: AbortController | null = null;
  private progress: OfflineTileProgress | null = null;
  private cachedCount = 0;
  private selectedStyle: MapLayerStyle = 'streets';
  private showInstallGuideMode: 'none' | 'ios' | 'manual' = 'none';

  constructor(
    container: HTMLElement,
    handlers: {
      getMapBounds: () => MapViewportBounds | null;
    }
  ) {
    this.container = container;
    this.getMapBoundsCallback = handlers.getMapBounds;
  }

  async showMapDownloader(preferredStyle?: MapLayerStyle): Promise<void> {
    this.showInstallGuideMode = 'none';
    if (preferredStyle) {
      this.selectedStyle = preferredStyle;
    }
    this.cachedCount = await OfflineMapService.getCachedTileCount();
    this.container.classList.remove('hidden');
    this.render();
  }

  showInstallGuide(mode: 'ios' | 'manual'): void {
    this.showInstallGuideMode = mode;
    this.container.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.container.classList.add('hidden');
  }

  private render(): void {
    if (this.showInstallGuideMode !== 'none') {
      this.renderInstallGuide();
      return;
    }

    const egyptEstimate = OfflineMapService.estimateTileCount(EGYPT_OFFLINE_BOUNDS);
    const prog = this.progress;
    const pwaState = PwaService.getState();

    this.container.innerHTML = `
      <div class="fixed inset-0 bg-black/75 backdrop-blur-md z-[1100] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
        <div class="glass-card w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden animate-scale-up text-right">
          
          <!-- Header -->
          <div class="p-4 sm:p-5 bg-gradient-to-l from-slate-900 to-emerald-950 border-b border-white/10 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xl">
                ${this.selectedStyle === 'satellite' ? '🛰️' : '🗺️'}
              </div>
              <div>
                <h3 class="text-base font-black text-white">تحميل الخريطة للعمل أوفلاين</h3>
                <p class="text-[11px] text-emerald-300">حفظ خرائط الشوارع أو القمر الصناعي للعمل بدون إنترنت على الهاتف</p>
              </div>
            </div>
            <button id="btn-close-offline-modal" class="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors">
              ✕
            </button>
          </div>

          <div class="p-4 sm:p-5 space-y-4 text-xs">
            <!-- Status Cards -->
            <div class="grid grid-cols-2 gap-2.5 text-center">
              <div class="p-3 rounded-2xl bg-slate-900/70 border border-white/10">
                <div class="text-slate-400 mb-1">البلاطات المحفوظة أوفلاين</div>
                <div id="offline-cached-count" class="text-lg font-black text-emerald-400">${this.cachedCount.toLocaleString('en-US')}</div>
              </div>
              <div class="p-3 rounded-2xl bg-slate-900/70 border border-white/10">
                <div class="text-slate-400 mb-1">حالة خدمة العمل أوفلاين</div>
                <div class="text-xs font-black ${pwaState.swReady ? 'text-emerald-400' : 'text-amber-400'} mt-1">
                  ${pwaState.swReady ? '✅ Service Worker نشط' : '⏳ جارٍ التفعيل...'}
                </div>
              </div>
            </div>

            <!-- Layer Type Selector (Streets / Satellite) -->
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-offline-style-streets"
                ${this.isDownloading ? 'disabled' : ''}
                class="py-2.5 px-3 rounded-2xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  this.selectedStyle === 'streets'
                    ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 shadow'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                }"
              >
                <span>🗺️</span>
                <span>خرائط الشوارع</span>
              </button>
              <button
                type="button"
                id="btn-offline-style-satellite"
                ${this.isDownloading ? 'disabled' : ''}
                class="py-2.5 px-3 rounded-2xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                  this.selectedStyle === 'satellite'
                    ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 shadow'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                }"
              >
                <span>🛰️</span>
                <span>قمر صناعي (Satellite)</span>
              </button>
            </div>

            <!-- Egypt Coverage Specs -->
            <div class="p-3.5 rounded-2xl bg-slate-800/40 border border-white/10 space-y-1.5 text-slate-300 leading-relaxed">
              <div class="font-bold text-white flex items-center justify-between">
                <span>نطاق خريطة جمهورية مصر العربية (${this.selectedStyle === 'satellite' ? 'قمر صناعي' : 'شوارع'})</span>
                <span class="text-[11px] text-emerald-400 font-mono" dir="ltr">Zoom 6 – 12</span>
              </div>
              <div class="text-[11px] text-slate-400 font-mono" dir="ltr">
                Lat: 24.0° .. 31.5° | Lng: 27.0° .. 34.4° (~${egyptEstimate.toLocaleString('en-US')} tiles)
              </div>
              <p class="text-[11px] text-slate-400">
                بالإضافة للتخزين التلقائي أثناء تصفح الخريطة، كما توفر الخريطة شبكة إحداثيات أوفلاين بديلة للمستويات الأعلى لتظل كافة الدبابيس والمواقع دقيقة تماماً.
              </p>
            </div>

            <!-- Live Progress Bar -->
            ${
              prog
                ? `
              <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
                <div class="flex items-center justify-between text-xs font-bold">
                  <span class="text-emerald-300">
                    ${
                      prog.done
                        ? prog.cancelled
                          ? '⏸️ تم إيقاف التحميل مؤقتاً'
                          : '✅ اكتمل حفظ الخريطة أوفلاين!'
                        : `⏳ جارٍ التحميل (Zoom ${prog.currentZoom})...`
                    }
                  </span>
                  <span class="font-mono text-white" dir="ltr">${prog.percent}%</span>
                </div>
                <div class="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                    style="width: ${prog.percent}%"
                  ></div>
                </div>
                <div class="flex items-center justify-between text-[11px] text-slate-300">
                  <span>تم فحص: ${prog.completed.toLocaleString('en-US')} / ${prog.total.toLocaleString('en-US')}</span>
                  <span>جديد: ${prog.cachedNow} • مسبقاً: ${prog.skippedExisting}${prog.failed > 0 ? ` • تعذر: ${prog.failed}` : ''}</span>
                </div>
              </div>
            `
                : ''
            }

            <!-- Download Buttons -->
            <div class="space-y-2">
              ${
                this.isDownloading
                  ? `
                <button
                  id="btn-cancel-offline-download"
                  class="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <span>⏹️</span>
                  <span>إيقاف التحميل مؤقتاً (يمكن الاستكمال لاحقاً)</span>
                </button>
              `
                  : `
                <button
                  id="btn-download-egypt-map"
                  class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 rounded-2xl transition-all shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2"
                >
                  <span>📥</span>
                  <span>تحميل ${this.selectedStyle === 'satellite' ? 'القمر الصناعي لمصر' : 'خريطة مصر للشوارع'} أوفلاين (Zoom 6-12)</span>
                </button>

                <div class="grid grid-cols-2 gap-2">
                  <button
                    id="btn-download-viewport-map"
                    class="bg-blue-600/20 hover:bg-blue-600/35 text-blue-300 border border-blue-500/30 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🎯</span>
                    <span>حفظ المنطقة الحالية (دقة عالية)</span>
                  </button>
                  <button
                    id="btn-clear-offline-tiles"
                    class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🗑️</span>
                    <span>مسح كاش الخريطة</span>
                  </button>
                </div>
              `
              }
            </div>
          </div>

        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderInstallGuide(): void {
    const isIos = this.showInstallGuideMode === 'ios';
    this.container.innerHTML = `
      <div class="fixed inset-0 bg-black/75 backdrop-blur-md z-[1100] flex items-center justify-center p-4 animate-fade-in">
        <div class="glass-card w-full max-w-md rounded-3xl p-5 shadow-2xl border space-y-4 text-right animate-scale-up">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-black text-white">📲 تثبيت التطبيق للعمل أوفلاين</h3>
            <button id="btn-close-offline-modal" class="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10">✕</button>
          </div>

          <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-slate-200 leading-relaxed space-y-2">
            ${
              isIos
                ? `
              <p class="font-bold text-emerald-300">خطوات التثبيت على هواتف iPhone / iPad (Safari):</p>
              <ol class="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>اضغط على أيقونة <b>المشاركة (Share)</b> في شريط متصفح Safari بالأسفل.</li>
                <li>مرر للأسفل واختر <b>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</b>.</li>
                <li>اضغط <b>إضافة (Add)</b> ليظهر تطبيق <b>كارجاس</b> كتطبيق مستقل يعمل أوفلاين بالكامل.</li>
              </ol>
            `
                : `
              <p class="font-bold text-emerald-300">خطوات التثبيت على Android أو الكمبيوتر (Chrome / Edge):</p>
              <ol class="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>اضغط على قائمة المتصفح (<b>⋮</b>) بالأعلى أو أيقونة التثبيت في شريط العنوان.</li>
                <li>اختر <b>تثبيت التطبيق (Install App)</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.</li>
                <li>إذا كنت داخل نافذة معاينة، افتح رابط التطبيق في تبويب مستقل ليظهر زر التثبيت المباشر.</li>
              </ol>
            `
            }
          </div>

          <button id="btn-close-guide-ok" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs transition-all">
            فهمت، إغلاق
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-close-offline-modal')?.addEventListener('click', () => this.hide());
    this.container.querySelector('#btn-close-guide-ok')?.addEventListener('click', () => this.hide());
  }

  private attachEvents(): void {
    this.container.querySelector('#btn-close-offline-modal')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.hide();
    });

    this.container.querySelector('#btn-offline-style-streets')?.addEventListener('click', () => {
      if (this.isDownloading) return;
      SoundService.playChime('click');
      this.selectedStyle = 'streets';
      this.render();
    });

    this.container.querySelector('#btn-offline-style-satellite')?.addEventListener('click', () => {
      if (this.isDownloading) return;
      SoundService.playChime('click');
      this.selectedStyle = 'satellite';
      this.render();
    });

    this.container.querySelector('#btn-download-egypt-map')?.addEventListener('click', () => {
      void this.startDownload(EGYPT_OFFLINE_BOUNDS);
    });

    this.container.querySelector('#btn-download-viewport-map')?.addEventListener('click', () => {
      const current = this.getMapBoundsCallback();
      if (!current) {
        ToastService.show('تعذر قراءة نطاق الخريطة الحالي.', 'warning');
        return;
      }
      const bounds: TileDownloadBounds = {
        minLat: current.minLat,
        maxLat: current.maxLat,
        minLng: current.minLng,
        maxLng: current.maxLng,
        minZoom: 10,
        maxZoom: 15,
      };
      void this.startDownload(bounds);
    });

    this.container.querySelector('#btn-cancel-offline-download')?.addEventListener('click', () => {
      this.abortController?.abort();
    });

    this.container.querySelector('#btn-clear-offline-tiles')?.addEventListener('click', async () => {
      await OfflineMapService.clearCachedTiles();
      this.cachedCount = 0;
      this.progress = null;
      ToastService.show('تم مسح بلاطات الخريطة المحفوظة من الكاش.', 'info');
      this.render();
    });
  }

  private async startDownload(bounds: TileDownloadBounds): Promise<void> {
    if (this.isDownloading) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      ToastService.show('أنت الآن في وضع الأوفلاين. يرجى الاتصال بالإنترنت لمرة واحدة لتحميل البلاطات.', 'warning');
      return;
    }

    this.isDownloading = true;
    this.abortController = new AbortController();
    SoundService.playChime('start');
    this.render();

    const final = await OfflineMapService.downloadTiles(
      bounds,
      (prog) => {
        this.progress = prog;
        if (!this.container.classList.contains('hidden')) {
          this.render();
        }
      },
      this.abortController.signal,
      this.selectedStyle
    );

    this.isDownloading = false;
    this.abortController = null;
    this.cachedCount = await OfflineMapService.getCachedTileCount();
    this.progress = final;

    if (final.cancelled) {
      ToastService.show(`تم إيقاف التحميل مؤقتاً (${final.cachedNow} بلاطة جديدة محفوظة).`, 'info');
    } else {
      SoundService.playChime('arrive');
      ToastService.show(
        `✅ اكتمل حفظ الخريطة أوفلاين! (${this.cachedCount.toLocaleString('en-US')} بلاطة جاهزة للعمل بدون إنترنت)`,
        'success',
        4500
      );
    }

    if (!this.container.classList.contains('hidden')) {
      this.render();
    }
  }
}
