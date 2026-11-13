import { RouteData, Station, RouteStep } from '../types';
import { SoundService } from '../services/soundService';
import { ToastService } from '../services/toastService';
import { LocationService } from '../services/locationService';
import { escapeHtml } from '../utils/html';
import { getStationNavigationUrls, canLaunchNativeGeoUri } from '../utils/navigationLinks';

export class NavigationHudComponent {
  private container: HTMLElement;
  private currentRoute: RouteData | null = null;
  private currentStation: Station | null = null;
  private currentStepIndex = 0;
  private onExitCallback: () => void;
  private voiceEnabled = true;

  constructor(container: HTMLElement, handlers: { onExit: () => void }) {
    this.container = container;
    this.onExitCallback = handlers.onExit;
  }

  start(route: RouteData, station: Station): void {
    this.currentRoute = route;
    this.currentStation = station;
    this.currentStepIndex = 0;
    this.voiceEnabled = SoundService.isAudioEnabled();
    this.render();

    // Speak initial instruction
    if (route.steps.length > 0) {
      const firstStep = route.steps[0];
      SoundService.speakArabic(`بدء الملاحة إلى ${station.name}. ${firstStep.instruction}`);
    }
  }

  stop(): void {
    this.currentRoute = null;
    this.currentStation = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.container.innerHTML = '';
    this.container.classList.add('hidden');
  }

  private nextStep(): void {
    if (!this.currentRoute) return;
    if (this.currentStepIndex < this.currentRoute.steps.length - 1) {
      this.currentStepIndex++;
      const step = this.currentRoute.steps[this.currentStepIndex];
      SoundService.playChime('turn');
      SoundService.speakArabic(step.instruction);
      this.render();
    } else {
      SoundService.playChime('arrive');
      SoundService.speakArabic(`لقد وصلت إلى محطة ${this.currentStation?.name || 'الغاز'}. شكراً لاختياركم كارجاس.`);
      ToastService.show(`🎉 وصلت بنجاح إلى ${this.currentStation?.name}!\nمرحباً بك في محطة تموين الغاز الطبيعي.`, 'success', 5000);
      this.stop();
      this.onExitCallback();
    }
  }

  private render(): void {
    if (!this.currentRoute || !this.currentStation) return;

    this.container.classList.remove('hidden');

    const step: RouteStep =
      this.currentRoute.steps[this.currentStepIndex] || {
        instruction: 'تابع السير باتجاه المحطة',
        distance: 200,
        duration: 30,
      };

    const isLastStep = this.currentStepIndex >= this.currentRoute.steps.length - 1;
    const distanceText = step.distance < 1000 ? `${step.distance} متر` : `${(step.distance / 1000).toFixed(1)} كم`;
    const navUrls = getStationNavigationUrls(this.currentStation, LocationService.getLocation());

    this.container.innerHTML = `
      <div class="nav-hud-inner glass-panel-hud max-w-lg mx-auto w-full rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl border border-emerald-500/30 text-white animate-fade-in">
        
        <!-- Top bar: Destination & Exit -->
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs">
          <div class="flex items-center gap-1.5 overflow-hidden">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="font-bold text-emerald-400">ملاحة حية:</span>
            <span class="font-semibold text-slate-200 truncate">${escapeHtml(this.currentStation.name)}</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Voice Mute/Unmute -->
            <button 
              id="btn-nav-voice"
              class="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="تفعيل/كتم الصوت"
            >
              ${
                this.voiceEnabled
                  ? `<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>`
                  : `<svg class="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>`
              }
            </button>

            <!-- Exit Navigation -->
            <button 
              id="btn-nav-exit"
              class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-2.5 py-1 rounded-xl transition-all"
            >
              إنهاء الملاحة
            </button>
          </div>
        </div>

        <!-- Main Maneuver Guidance -->
        <div class="flex items-center gap-3 py-1">
          <div class="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center shrink-0 shadow-inner">
            <svg class="w-7 h-7 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              ${
                isLastStep
                  ? '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'
                  : '<polygon points="3 11 22 2 13 21 11 13 3 11"/>'
              }
            </svg>
          </div>

          <div class="flex-1">
            <div class="text-[11px] font-bold text-emerald-400 mb-0.5">
              بعد ${distanceText}
            </div>
            <div class="text-sm sm:text-base font-black leading-snug text-white">
              ${escapeHtml(step.instruction)}
            </div>
          </div>

          <!-- Step Progression / Simulation Button -->
          <button 
            id="btn-nav-next-step"
            class="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl text-xs font-bold shrink-0 shadow-md transition-all active:scale-95 flex flex-col items-center gap-0.5"
            title="الانتقال للخطوة التالية في المسار"
          >
            <span>التالي</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <!-- Progress, Overall Stats & External GPS Apps -->
        <div class="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-300 pt-2 mt-2 border-t border-white/10 font-medium">
          <div class="flex items-center gap-3">
            <span>⏱️ <b class="text-white">${this.currentRoute.durationMin} دقيقة</b></span>
            <span>🛣️ <b class="text-white">${this.currentRoute.distanceKm} كم</b></span>
            <span class="text-[10px] text-slate-400">خطوة ${this.currentStepIndex + 1}/${this.currentRoute.steps.length}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <a
              id="btn-hud-google-maps"
              href="${navUrls.googleMapsUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-white/10 text-[11px] font-bold transition-all"
              title="فتح المسار في خرائط جوجل"
            >
              🗺️ جوجل مابس
            </a>
            <a
              id="btn-hud-geo"
              href="${navUrls.geoUri}"
              class="px-2 py-1 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/30 text-[11px] font-bold transition-all"
              title="فتح الإحداثيات في تطبيق الخرائط المحلي على الهاتف (أوفلاين)"
            >
              🧭 تطبيق الهاتف
            </a>
          </div>
        </div>

      </div>
    `;

    this.container.querySelector('#btn-nav-exit')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.stop();
      this.onExitCallback();
    });

    this.container.querySelector('#btn-nav-next-step')?.addEventListener('click', () => {
      this.nextStep();
    });

    this.container.querySelector('#btn-nav-voice')?.addEventListener('click', () => {
      this.voiceEnabled = SoundService.toggleAudio();
      SoundService.playChime('click');
      this.render();
    });

    this.container.querySelector('#btn-hud-geo')?.addEventListener('click', (e) => {
      SoundService.playChime('click');
      if (!canLaunchNativeGeoUri()) {
        e.preventDefault();
        const coords = `${navUrls.lat}, ${navUrls.lng}`;
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(coords);
        }
        ToastService.show(
          `تطبيق الملاحة الخارجي (geo:) يعمل مباشرة على الهواتف الذكية. تم نسخ الإحداثيات: ${coords}`,
          'info',
          4000
        );
      }
    });
  }
}
