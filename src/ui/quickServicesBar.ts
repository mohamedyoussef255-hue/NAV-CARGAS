import {
  ICON_CARGAS_STATION_SVG,
  ICON_CONVERSION_CENTER_SVG,
  ICON_LUBE_CENTER_SVG,
  ICON_CYLINDER_TESTING_SVG,
  ICON_CANOPY_OIL_SVG,
} from '../assets/cargasLogo';
import { SoundService } from '../services/soundService';

export interface QuickActionHandler {
  onFindNearestAll: () => void;
  onFindNearestConversion: () => void;
  onFindNearestLube: () => void;
  onFindNearestCylinder: () => void;
  onFindNearestCanopy: () => void;
}

export class QuickServicesBarComponent {
  private container: HTMLElement;
  private handlers: QuickActionHandler;
  private activeFilter: string = 'all';

  constructor(container: HTMLElement, handlers: QuickActionHandler) {
    this.container = container;
    this.handlers = handlers;
  }

  render(): void {
    this.container.innerHTML = `
      <div class="quick-services-bar-wrapper max-w-5xl mx-auto px-2 sm:px-4 py-2 z-20 pointer-events-auto">
        <div class="quick-services-bar glass-card rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-xl border flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          
          <!-- 1. أقرب محطة كارجاس -->
          <button 
            id="btn-quick-nearest-all"
            data-action="all"
            class="quick-service-btn active group flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shrink-0 transition-all select-none"
            title="تحديد والتوجيه فوراً إلى أقرب محطة كارجاس من موقعك"
          >
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black flex items-center justify-center shrink-0 transition-colors">
              ${ICON_CARGAS_STATION_SVG}
            </div>
            <div class="flex flex-col text-right">
              <span class="leading-tight text-white font-black">أقرب محطة كارجاس</span>
              <span class="text-[9px] sm:text-[10px] text-emerald-300 font-medium leading-none mt-0.5">تموين غاز CNG</span>
            </div>
          </button>

          <!-- 2. مركز التحويل والصيانة -->
          <button 
            id="btn-quick-conversion"
            data-action="conversion"
            class="quick-service-btn group flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shrink-0 transition-all select-none"
            title="تحديد والتوجيه لأقرب محطة بها مركز تحويل وصيانة معتمد"
          >
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-black flex items-center justify-center shrink-0 transition-colors">
              ${ICON_CONVERSION_CENTER_SVG}
            </div>
            <div class="flex flex-col text-right">
              <span class="leading-tight text-white font-black">مركز التحويل والصيانة</span>
              <span class="text-[9px] sm:text-[10px] text-amber-300 font-medium leading-none mt-0.5">تحويل وصيانة دورية</span>
            </div>
          </button>

          <!-- 3. مركز الزيوت المتخصص -->
          <button 
            id="btn-quick-lube"
            data-action="lube"
            class="quick-service-btn group flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shrink-0 transition-all select-none"
            title="تحديد والتوجيه لأقرب مركز زيوت مخصص لسيارات الغاز"
          >
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-blue-500/20 text-blue-400 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
              ${ICON_LUBE_CENTER_SVG}
            </div>
            <div class="flex flex-col text-right">
              <span class="leading-tight text-white font-black">مركز الزيوت</span>
              <span class="text-[9px] sm:text-[10px] text-blue-300 font-medium leading-none mt-0.5">غيار زيوت كارجاس</span>
            </div>
          </button>

          <!-- 4. مركز فحص الأسطوانات -->
          <button 
            id="btn-quick-cylinder"
            data-action="cylinder"
            class="quick-service-btn group flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shrink-0 transition-all select-none"
            title="تحديد والتوجيه لأقرب مركز فحص واختبار أسطوانات غاز معتمد"
          >
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
              ${ICON_CYLINDER_TESTING_SVG}
            </div>
            <div class="flex flex-col text-right">
              <span class="leading-tight text-white font-black">فحص الأسطوانات</span>
              <span class="text-[9px] sm:text-[10px] text-purple-300 font-medium leading-none mt-0.5">اختبار دوري معتمد</span>
            </div>
          </button>

          <!-- 5. زيوت أسفل المظلة -->
          <button 
            id="btn-quick-canopy"
            data-action="canopy"
            class="quick-service-btn group flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shrink-0 transition-all select-none"
            title="تحديد والتوجيه لأقرب محطة توفر زيوت أسفل المظلة"
          >
            <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-teal-500/20 text-teal-400 group-hover:bg-teal-500 group-hover:text-black flex items-center justify-center shrink-0 transition-colors">
              ${ICON_CANOPY_OIL_SVG}
            </div>
            <div class="flex flex-col text-right">
              <span class="leading-tight text-white font-black">زيوت أسفل المظلة</span>
              <span class="text-[9px] sm:text-[10px] text-teal-300 font-medium leading-none mt-0.5">تزويد سريع</span>
            </div>
          </button>

        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    const setActive = (action: string) => {
      this.activeFilter = action;
      this.container.querySelectorAll('.quick-service-btn').forEach((btn) => {
        if ((btn as HTMLElement).dataset.action === action) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    };

    this.container.querySelector('#btn-quick-nearest-all')?.addEventListener('click', () => {
      SoundService.playChime('start');
      setActive('all');
      this.handlers.onFindNearestAll();
    });

    this.container.querySelector('#btn-quick-conversion')?.addEventListener('click', () => {
      SoundService.playChime('start');
      setActive('conversion');
      this.handlers.onFindNearestConversion();
    });

    this.container.querySelector('#btn-quick-lube')?.addEventListener('click', () => {
      SoundService.playChime('start');
      setActive('lube');
      this.handlers.onFindNearestLube();
    });

    this.container.querySelector('#btn-quick-cylinder')?.addEventListener('click', () => {
      SoundService.playChime('start');
      setActive('cylinder');
      this.handlers.onFindNearestCylinder();
    });

    this.container.querySelector('#btn-quick-canopy')?.addEventListener('click', () => {
      SoundService.playChime('start');
      setActive('canopy');
      this.handlers.onFindNearestCanopy();
    });
  }
}
