import { Station } from '../types';
import { AppConfigService } from '../services/appConfigService';
import { DEFAULT_APP_CONFIG, UserIconsVisibility } from '../config/appConfig';
import { StationStorage } from '../services/stationStorage';
import {
  ColumnMappingOverride,
  ExcelParser,
  ParseResult,
  fixEgyptLatLngSwap,
  parseCoordinate,
} from '../services/excelParser';
import { LocationService } from '../services/locationService';
import { SoundService } from '../services/soundService';
import { ToastService } from '../services/toastService';
import { escapeHtml } from '../utils/html';
import { extractLatLngPairFromInput, normalizeArabicSearch } from '../utils/arabicSearch';
import { DEFAULT_CARGAS_LOGO_DATA_URL } from '../assets/cargasLogo';

interface AddStationDraft {
  name: string;
  lat: string;
  lng: string;
  gov: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  hasConversion: boolean;
  hasLube: boolean;
  hasCanopy: boolean;
  hasCylinder: boolean;
  hasFast: boolean;
}

const createEmptyAddDraft = (): AddStationDraft => ({
  name: '',
  lat: '',
  lng: '',
  gov: '',
  city: '',
  address: '',
  phone: '19617',
  hours: '24 ساعة',
  hasConversion: false,
  hasLube: true,
  hasCanopy: true,
  hasCylinder: false,
  hasFast: true,
});

function normalizePasswordDigits(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .trim();
}

export class AdminModalComponent {
  private container: HTMLElement;
  private isAuthenticated = false;
  private currentTab: 'upload' | 'manage' | 'add' | 'branding' | 'settings' | 'source' = 'upload';
  private stations: Station[] = [];
  private onDataChangedCallback: (focusedStation?: Station) => void;
  private onLocateStationCallback?: (station: Station) => void;
  private onPickCoordsOnMapCallback?: (cb: (lat: number, lng: number) => void) => void;
  private pendingParsedResult: ParseResult | null = null;
  private lastUploadedFile: File | null = null;
  private columnMappingOverride: ColumnMappingOverride = {};
  private editingStation: Station | null = null;
  private manageSearchQuery = '';
  private manageGovFilter = 'all';
  private recentlyAddedId: string | null = null;
  private addDraft: AddStationDraft = createEmptyAddDraft();

  constructor(
    container: HTMLElement,
    handlers: {
      onDataChanged: (focusedStation?: Station) => void;
      onLocateStation?: (station: Station) => void;
      onPickCoordsOnMap?: (cb: (lat: number, lng: number) => void) => void;
    }
  ) {
    this.container = container;
    this.onDataChangedCallback = handlers.onDataChanged;
    this.onLocateStationCallback = handlers.onLocateStation;
    this.onPickCoordsOnMapCallback = handlers.onPickCoordsOnMap;
  }

  show(preferredTab?: 'upload' | 'manage' | 'add' | 'branding' | 'settings' | 'source'): void {
    this.stations = StationStorage.getStations();
    if (preferredTab) {
      this.currentTab = preferredTab;
    }
    this.container.classList.remove('hidden');
    if (!this.isAuthenticated) {
      this.renderPasswordPrompt();
    } else {
      this.renderDashboard();
    }
  }

  openEditStation(station: Station): void {
    this.isAuthenticated = true;
    this.stations = StationStorage.getStations();
    this.editingStation = { ...station };
    this.currentTab = 'manage';
    this.container.classList.remove('hidden');
    this.renderDashboard();
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }

  // Password verification modal for secret 0000 password
  private renderPasswordPrompt(): void {
    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-md z-[1500] flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-sm rounded-3xl p-6 shadow-2xl border text-center animate-scale-up" id="auth-box">
          
          <div class="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center text-2xl mb-4 border border-amber-500/30">
            🔒
          </div>

          <h3 class="text-lg font-black text-white mb-1">
            لوحة التحكم الخفية
          </h3>
          <p class="text-xs text-slate-400 mb-5">
            يرجى إدخال كلمة المرور للوصول إلى إدارة المحطات ورفع ملفات الإكسيل
          </p>

          <form id="admin-auth-form" class="space-y-4">
            <div>
              <div class="relative flex items-center">
                <input 
                  type="password" 
                  id="admin-password-input" 
                  dir="ltr"
                  inputmode="text"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck="false"
                  placeholder="أدخل كلمة المرور" 
                  maxlength="32"
                  autocomplete="off"
                  class="w-full text-center tracking-widest text-xl font-bold bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-2xl py-3 px-10 text-white outline-none font-sans"
                />
                <button
                  type="button"
                  id="btn-toggle-auth-pwd"
                  class="absolute left-2.5 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors text-sm"
                  title="إظهار / إخفاء كلمة المرور"
                >
                  👁️
                </button>
              </div>
              <div id="auth-error-msg" class="hidden text-xs text-rose-400 font-bold mt-2">
                كلمة المرور غير صحيحة، حاول ثانية
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button 
                type="submit" 
                class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/30"
              >
                دخول
              </button>
              <button 
                type="button" 
                id="btn-cancel-auth"
                class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const input = this.container.querySelector('#admin-password-input') as HTMLInputElement | null;
    input?.focus();
    setTimeout(() => input?.focus(), 60);

    this.container.querySelector('#btn-toggle-auth-pwd')?.addEventListener('click', () => {
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      const btn = this.container.querySelector('#btn-toggle-auth-pwd');
      if (btn) btn.textContent = showing ? '👁️' : '🙈';
    });

    const form = this.container.querySelector('#admin-auth-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = normalizePasswordDigits(input?.value || '');
      const configured = normalizePasswordDigits(
        AppConfigService.getConfig().adminPassword || DEFAULT_APP_CONFIG.adminPassword
      );
      if (val && val === configured) {
        this.isAuthenticated = true;
        try {
          SoundService.playChime('start');
        } catch {
          // ignore
        }
        this.renderDashboard();
      } else {
        try {
          SoundService.playChime('turn');
        } catch {
          // ignore
        }
        const err = this.container.querySelector('#auth-error-msg');
        const box = this.container.querySelector('#auth-box');
        err?.classList.remove('hidden');
        box?.classList.add('animate-shake');
        setTimeout(() => box?.classList.remove('animate-shake'), 600);
        if (input) {
          input.value = '';
          input.focus();
        }
      }
    });

    this.container.querySelector('#btn-cancel-auth')?.addEventListener('click', () => {
      this.hide();
    });
    this.container.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hide();
    });
  }

  // Main Admin Dashboard
  private renderDashboard(): void {
    this.stations = StationStorage.getStations();

    this.container.innerHTML = `
      <div class="modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-md z-[1500] flex items-center justify-center p-2 sm:p-4">
        <div class="glass-card w-full max-w-4xl h-[92vh] rounded-3xl flex flex-col shadow-2xl border overflow-hidden animate-scale-up">
          
          <!-- Top Header -->
          <div class="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                ⚙️
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-base sm:text-lg font-black text-white">
                    لوحة تحكم مدير النظام
                  </h3>
                  <span class="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
                    مفعلة
                  </span>
                </div>
                <p class="text-xs text-slate-400">
                  إدارة المحطات • الاسم وكلمة المرور وأيقونات المستخدم • الشعار • اعتماد الكود لـ Vercel
                </p>
              </div>
            </div>

            <button 
              id="btn-close-admin-dash"
              class="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800/80 transition-colors"
              title="إغلاق"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Navigation Tabs -->
          <div class="flex items-center gap-1.5 px-4 pt-3 pb-2 bg-slate-900/60 border-b border-white/10 overflow-x-auto text-xs font-bold">
            <button data-tab="upload" class="admin-tab ${this.currentTab === 'upload' ? 'active' : ''} px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0">
              <span>📁</span>
              <span>رفع ملف إكسيل</span>
            </button>
            <button data-tab="manage" class="admin-tab ${this.currentTab === 'manage' ? 'active' : ''} px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0">
              <span>🏢</span>
              <span>إدارة المحطات (${this.stations.length})</span>
            </button>
            <button data-tab="add" class="admin-tab ${this.currentTab === 'add' ? 'active' : ''} px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0">
              <span>➕</span>
              <span>إضافة محطة</span>
            </button>
            <button data-tab="branding" class="admin-tab ${this.currentTab === 'branding' ? 'active' : ''} px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0">
              <span>🎨</span>
              <span>الشعار والمظهر</span>
            </button>
            <button data-tab="settings" class="admin-tab ${this.currentTab === 'settings' ? 'active' : ''} px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0">
              <span>⚙️</span>
              <span>الاسم وكلمة السر والأيقونات</span>
            </button>
            <button data-tab="source" class="admin-tab ${this.currentTab === 'source' ? 'active' : ''} px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0">
              <span>💾</span>
              <span>تثبيت الكود و Vercel</span>
            </button>
          </div>

          <!-- Tab Content Area -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            ${this.renderTabContent()}
          </div>

        </div>
      </div>
    `;

    this.attachDashboardEvents();
  }

  private renderTabContent(): string {
    switch (this.currentTab) {
      case 'upload':
        return this.renderUploadTab();
      case 'manage':
        return this.renderManageTab();
      case 'add':
        return this.renderAddTab();
      case 'branding':
        return this.renderBrandingTab();
      case 'settings':
        return this.renderSettingsTab();
      case 'source':
        return this.renderSourceCodeTab();
    }
  }

  // Tab 1: Upload Excel/CSV
  private renderUploadTab(): string {
    const res = this.pendingParsedResult;
    const diag = res?.diagnostics;
    const headerOptions = (selected?: string) =>
      [
        `<option value="">— تلقائي —</option>`,
        ...(res?.headers || []).map(
          (h) => `<option value="${escapeHtml(h)}" ${selected === h ? 'selected' : ''}>${escapeHtml(h)}</option>`
        ),
      ].join('');

    return `
      <div class="space-y-5 max-w-3xl mx-auto">
        <div class="text-right">
          <h4 class="text-base font-bold text-white mb-1">
            رفع ملف إكسيل أو KMZ/KML يحمل إحداثيات وبيانات محطات كارجاس
          </h4>
          <p class="text-xs text-slate-400">
            يدعم النظام ملفات Excel (.xlsx, .xls, .csv) و Google Earth (.kmz, .kml)، والإحداثيات العشرية، والفواصل الأوروبية، والدرجات والدقائق والثواني (DMS)، وروابط خرائط جوجل، وإحداثيات UTM، مع الحفظ الدائم في IndexedDB للعمل أوفلاين.
          </p>
        </div>

        <!-- Dropzone Box -->
        <div 
          id="excel-dropzone" 
          class="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-slate-800/30 hover:bg-slate-800/60 rounded-3xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
        >
          <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-3xl">
            📊
          </div>
          <div>
            <div class="text-sm font-bold text-white mb-1">
              اسحب وأفلت ملف الإكسيل أو KMZ هنا، أو اضغط للاختيار
            </div>
            <div class="text-xs text-slate-400">
              الملفات المدعومة: .xlsx, .xls, .csv, .kmz, .kml
            </div>
          </div>
          <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv,.kmz,.kml" class="hidden" />
          <button type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all">
            اختر ملفاً من جهازك
          </button>
        </div>

        <!-- Sample Template Download -->
        <div class="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-bold text-white">هل تحتاج إلى نموذج إكسيل منظم؟</div>
            <div class="text-[11px] text-slate-400">قم بتحميل نموذج إكسيل جاهز بالعناوين العربية لملء إحداثيات محطاتك مباشرة</div>
          </div>
          <button 
            id="btn-download-sample-excel"
            class="bg-slate-700 hover:bg-slate-600 text-emerald-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
          >
            <span>📥</span>
            <span>تحميل النموذج</span>
          </button>
        </div>

        <!-- Preview of uploaded file if available -->
        ${
          res
            ? `
          <div class="p-4 rounded-2xl bg-emerald-950/35 border border-emerald-500/40 space-y-4 animate-fade-in">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 text-lg">✅</span>
                <span class="text-sm font-bold text-white">معاينة وفحص ملف الإكسيل قبل الحفظ</span>
              </div>
              <span class="text-xs bg-emerald-500 text-black font-black px-2.5 py-0.5 rounded-full">
                ${res.validRows} من ${res.totalRows} محطة صالحة
              </span>
            </div>

            <!-- Coordinate Quality Diagnostics -->
            ${
              diag
                ? `
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                <div class="p-2 rounded-xl bg-slate-900/70 border border-white/10">
                  <div class="text-slate-400">مواقع جغرافية فريدة</div>
                  <div class="text-sm font-black text-emerald-400">${diag.uniqueCoordCount}</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-900/70 border border-white/10">
                  <div class="text-slate-400">المحافظات</div>
                  <div class="text-sm font-black text-blue-400">${diag.governoratesCount}</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-900/70 border border-white/10">
                  <div class="text-slate-400">تبديل مصحح</div>
                  <div class="text-sm font-black text-amber-400">${diag.swappedCount}</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-900/70 border border-white/10">
                  <div class="text-slate-400">تحويل UTM</div>
                  <div class="text-sm font-black text-purple-400">${diag.utmConvertedCount}</div>
                </div>
              </div>
              ${
                diag.latRange && diag.lngRange
                  ? `
                <div class="flex items-center justify-between flex-wrap gap-2 text-[11px] px-3 py-1.5 rounded-xl bg-slate-900/50 border border-white/5 text-slate-300" dir="ltr">
                  <span>Lat: ${diag.latRange[0].toFixed(3)}° .. ${diag.latRange[1].toFixed(3)}°</span>
                  <span>Lng: ${diag.lngRange[0].toFixed(3)}° .. ${diag.lngRange[1].toFixed(3)}°</span>
                  <span>Header Row: #${diag.headerRowNumber}</span>
                </div>
              `
                  : ''
              }
            `
                : ''
            }

            ${
              diag
                ? `
              <div class="flex items-center justify-between flex-wrap gap-2 text-[11px] px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200">
                <span>📝 عمود أسماء المحطات المنسوخ منه حرفياً: <b class="text-white">${escapeHtml(diag.detectedColumns.nameCol || 'لم يتم التحديد')}</b></span>
                <span class="text-emerald-300/90">يتم نقل الأسماء كما هي بالجدول دون زيادة أو نقصان</span>
              </div>
              ${
                !diag.detectedColumns.nameCol || diag.syntheticNameCount > 0
                  ? `
                <div class="p-3 rounded-xl bg-amber-950/70 border border-amber-500/60 text-xs text-amber-100 leading-relaxed">
                  ⚠️ <b>تنبيه عمود الأسماء:</b> ${
                    !diag.detectedColumns.nameCol
                      ? 'لم يتم التعرف تلقائياً على عمود أسماء المحطات! يرجى اختيار <b>عمود اسم المحطة</b> الصحيح من القائمة بالأسفل ليتم نقل الأسماء كما هي في الجدول.'
                      : `يوجد ${diag.syntheticNameCount} صفاً خلا فيه عمود "${escapeHtml(diag.detectedColumns.nameCol)}" من الاسم؛ تأكد من اختيار عمود اسم المحطة الصحيح بالأسفل.`
                  }
                </div>
              `
                  : ''
              }
            `
                : ''
            }

            ${
              diag && (diag.isDiagonalLine || diag.collapsedIntegerCount > 0 || (res.stations.length >= 5 && diag.uniqueCoordCount < res.stations.length * 0.4))
                ? `
              <div class="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-xs text-rose-200 leading-relaxed">
                ⚠️ <b>تنبيه توزيع الإحداثيات:</b> ${escapeHtml(diag.diagonalReason || `لوحظ تقارب أو تكرار في الإحداثيات (${diag.uniqueCoordCount} موقع فريد من أصل ${res.stations.length} محطة).`)}
                يرجى التأكد من اختيار أعمدة <b>خط العرض (Lat)</b> و <b>خط الطول (Lng)</b> المختلفين في القوائم بالأسفل قبل الحفظ!
              </div>
            `
                : ''
            }

            <!-- Interactive Column Mapping Override -->
            <div class="p-3 rounded-xl bg-slate-900/70 border border-white/10 space-y-2">
              <div class="text-xs font-bold text-slate-200">تأكيد أو تعديل أعمدة الإكسيل المكتشفة:</div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <label class="block text-slate-400 mb-1">عمود اسم المحطة</label>
                  <select id="map-col-name" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white font-cairo">
                    ${headerOptions(this.columnMappingOverride.nameCol ?? diag?.detectedColumns.nameCol)}
                  </select>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">عمود خط العرض (Lat)</label>
                  <select id="map-col-lat" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white font-cairo">
                    ${headerOptions(this.columnMappingOverride.latCol ?? diag?.detectedColumns.latCol)}
                  </select>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">عمود خط الطول (Lng)</label>
                  <select id="map-col-lng" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white font-cairo">
                    ${headerOptions(this.columnMappingOverride.lngCol ?? diag?.detectedColumns.lngCol)}
                  </select>
                </div>
                <div>
                  <label class="block text-slate-400 mb-1">عمود المحافظة</label>
                  <select id="map-col-gov" class="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white font-cairo">
                    ${headerOptions(this.columnMappingOverride.govCol ?? diag?.detectedColumns.govCol)}
                  </select>
                </div>
              </div>
            </div>

            <!-- Sample Preview Table (First 15 Stations) -->
            ${
              res.stations.length > 0
                ? `
              <div class="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-slate-950/60">
                <table class="w-full text-right text-[11px]">
                  <thead class="bg-slate-800/90 text-slate-300 sticky top-0">
                    <tr>
                      <th class="p-2">المحطة كما هي في الجدول (أول ${Math.min(15, res.stations.length)} صف)</th>
                      <th class="p-2">المحافظة</th>
                      <th class="p-2">خط العرض (Lat)</th>
                      <th class="p-2">خط الطول (Lng)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    ${res.stations
                      .slice(0, 15)
                      .map(
                        (s) => `
                      <tr>
                        <td class="p-2 font-bold text-white">${escapeHtml(s.name)}</td>
                        <td class="p-2 text-slate-300">${escapeHtml(s.governorate)}</td>
                        <td class="p-2 font-mono text-emerald-400" dir="ltr">${s.lat.toFixed(6)}</td>
                        <td class="p-2 font-mono text-emerald-400" dir="ltr">${s.lng.toFixed(6)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
                : ''
            }

            ${
              res.errors.length > 0
                ? `
              <div class="text-xs text-amber-400 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30 max-h-24 overflow-y-auto">
                <div class="font-bold mb-1">تنبيهات (${res.errors.length} صف غير صالح):</div>
                ${res.errors.slice(0, 3).map((e) => `<div>• ${e}</div>`).join('')}
              </div>
            `
                : ''
            }

            <div class="p-2.5 rounded-xl bg-emerald-900/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
              <span>💾</span>
              <span>سيتم حفظ المحطات وتثبيتها مباشرة في الكود المصدري (src/data/defaultStations.ts)</span>
            </div>

            <div class="text-xs text-slate-300 font-bold">حدد طريقة الحفظ:</div>
            <div class="flex items-center gap-2">
              <button 
                id="btn-apply-replace"
                class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>🔄</span>
                <span>استبدال وحفظ في الكود المصدري مباشرة</span>
              </button>
              <button 
                id="btn-apply-append"
                class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>➕</span>
                <span>إلحاق وحفظ في الكود المصدري مباشرة</span>
              </button>
            </div>
          </div>
        `
            : ''
        }

      </div>
    `;
  }

  // Tab 2: Manage and edit stations table
  private renderManageTab(): string {
    const coordCheck = StationStorage.hasSuspiciousCoordinates(this.stations);
    const govs = Array.from(
      new Set(this.stations.map((s) => (s.governorate || '').trim()).filter(Boolean))
    );

    const normalizedSearch = normalizeArabicSearch(this.manageSearchQuery);
    const tokens = normalizedSearch ? normalizedSearch.split(/\s+/).filter(Boolean) : [];
    const filteredStations = this.stations.filter((station) => {
      const gov = (station.governorate || '').trim();
      if (this.manageGovFilter !== 'all' && gov !== this.manageGovFilter) {
        return false;
      }
      if (tokens.length > 0) {
        const haystack = normalizeArabicSearch(
          `${station.name || ''} ${station.stationName || ''} ${station.governorate || ''} ${station.city || ''} ${station.address || ''} ${station.lat ?? ''},${station.lng ?? ''}`
        );
        return tokens.every((tok) => haystack.includes(tok));
      }
      return true;
    });

    const invalidCount = this.stations.filter((s) => {
      const lat = Number(s.lat);
      const lng = Number(s.lng);
      return !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0);
    }).length;

    const hasManageFilter =
      Boolean(this.manageSearchQuery.trim()) || this.manageGovFilter !== 'all';

    return `
      <div class="space-y-4">
        ${
          invalidCount > 0
            ? `
          <div class="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-100 flex items-center justify-between gap-2 flex-wrap">
            <span>⚠️ توجد <b>${invalidCount}</b> محطة بدون إحداثيات صالحة — لن تظهر على الخريطة حتى تعديل إحداثياتها (اضغط ✏️ بجانبها).</span>
          </div>
        `
            : ''
        }
        ${
          coordCheck.suspicious
            ? `
          <div class="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/60 text-xs text-amber-100 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex-1 leading-relaxed">
              ⚠️ <b>تنبيه إحداثيات:</b> ${coordCheck.reason}
              <div class="text-[11px] text-amber-300/90 mt-0.5">أعد رفع ملف الإكسيل ليقوم المحلل المحدّث بقراءة خط الطول والعرض وتوزيع الدبابيس على أماكنها الفعلية.</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button id="btn-go-upload-tab" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all">
                📤 رفع الإكسيل وتصحيحها
              </button>
              <button id="btn-restore-defaults-banner" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs border border-white/10 transition-all">
                🔄 استعادة الافتراضية
              </button>
            </div>
          </div>
        `
            : ''
        }
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 class="text-base font-bold text-white">
              قائمة المحطات الحالية (${this.stations.length} محطة)
            </h4>
            <p class="text-xs text-slate-400">
              عرض <b>${filteredStations.length}</b> من أصل <b>${this.stations.length}</b> محطة • يمكنك البحث أو العرض على الخريطة أو التعديل والحفظ مباشرة في الكود المصدري.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button 
              id="btn-direct-save-manage" 
              class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3.5 py-1.5 rounded-xl transition-all shadow-md flex items-center gap-1"
              title="تثبيت وحفظ جميع المحطات الحالية مباشرة في ملف الكود المصدري"
            >
              <span>💾</span>
              <span>حفظ بالكود المصدري (${this.stations.length})</span>
            </button>
            <button 
              id="btn-clear-all-data-quick" 
              class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
            >
              🗑️ مسح كافة المحطات
            </button>
            <button 
              id="btn-restore-defaults" 
              class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition-all"
            >
              🔄 استعادة الافتراضية
            </button>
          </div>
        </div>

        <!-- Search & Governorate Filter inside Manage Table -->
        <div class="flex items-center gap-2 flex-wrap bg-slate-900/60 p-2.5 rounded-2xl border border-white/10">
          <div class="relative flex-1 min-w-[200px]">
            <input
              type="text"
              id="admin-manage-search"
              value="${escapeHtml(this.manageSearchQuery)}"
              placeholder="ابحث في الجدول باسم المحطة (مثل: المقطم)، العنوان، أو المحافظة..."
              class="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 pl-14 text-xs text-white placeholder-slate-400 outline-none font-cairo"
            />
            <svg class="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            ${
              this.manageSearchQuery
                ? `<button type="button" id="btn-admin-manage-clear-search" class="absolute left-8 top-1.5 w-6 h-6 rounded-full bg-slate-700 hover:bg-rose-500/40 text-slate-200 text-[11px] flex items-center justify-center" title="مسح البحث">✕</button>`
                : ''
            }
          </div>
          <select
            id="admin-manage-gov"
            class="bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-cairo"
          >
            <option value="all">كل المحافظات (${this.stations.length})</option>
            ${govs.map((g) => `<option value="${escapeHtml(g)}" ${this.manageGovFilter === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
          </select>
          ${
            hasManageFilter
              ? `<button type="button" id="btn-admin-manage-reset" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold">🔄 عرض الكل</button>`
              : ''
          }
        </div>

        <!-- Stations Table -->
        <div class="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
          <table class="w-full text-right text-xs">
            <thead class="bg-slate-800/80 text-slate-300 font-bold border-b border-white/10">
              <tr>
                <th class="p-3">اسم المحطة</th>
                <th class="p-3">المحافظة</th>
                <th class="p-3">الإحداثيات</th>
                <th class="p-3">الأنشطة والخدمات</th>
                <th class="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${
                filteredStations.length === 0
                  ? `
                <tr>
                  <td colspan="5" class="text-center py-8 text-slate-400">
                    ${
                      this.stations.length === 0
                        ? 'لا توجد محطات حالياً. يمكنك رفع ملف إكسيل أو إضافة محطة يدوياً أو استعادة الافتراضية.'
                        : 'لا توجد محطات مطابقة للبحث أو المحافظة المختارة.'
                    }
                  </td>
                </tr>
              `
                  : filteredStations
                      .map((station) => {
                        const lat = Number(station.lat);
                        const lng = Number(station.lng);
                        const coordsValid =
                          Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
                        const rowSuspicious = coordsValid && Math.abs(lat - lng) < 0.05;
                        const isRecent = this.recentlyAddedId === station.id;
                        const svc = station.services || {
                          hasConversionCenter: false,
                          hasLubeCenter: false,
                          hasCylinderTesting: false,
                          hasCanopyOil: false,
                          hasFastService: false,
                        };
                        return `
                    <tr class="hover:bg-slate-800/40 transition-colors ${
                      isRecent
                        ? 'bg-emerald-950/40 ring-1 ring-inset ring-emerald-500/50'
                        : !coordsValid
                          ? 'bg-rose-950/30'
                          : rowSuspicious
                            ? 'bg-amber-950/25'
                            : ''
                    }">
                      <td class="p-3 font-bold text-white">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span>${escapeHtml(station.name || station.stationName || 'محطة كارجاس')}</span>
                          ${isRecent ? '<span class="text-[10px] bg-emerald-500 text-black font-black px-1.5 py-0.5 rounded">✨ مضافة حديثاً</span>' : ''}
                          ${!coordsValid ? '<span class="text-[10px] bg-rose-500/25 text-rose-300 px-1.5 py-0.5 rounded">إحداثي ناقص/خاطئ</span>' : rowSuspicious ? '<span class="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">إحداثي مشبوه</span>' : ''}
                        </div>
                        <div class="text-[10px] text-slate-400 font-normal truncate max-w-xs">${escapeHtml(station.address || station.city || '')}</div>
                      </td>
                      <td class="p-3 text-slate-300 font-medium">
                        ${escapeHtml(station.governorate || '—')}
                      </td>
                      <td class="p-3 font-mono text-[11px] ${!coordsValid ? 'text-rose-400' : rowSuspicious ? 'text-amber-400' : 'text-emerald-400'}" dir="ltr">
                        ${coordsValid ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'غير صالح (اضغط ✏️)'}
                      </td>
                      <td class="p-3">
                        <div class="flex items-center gap-1 flex-wrap text-[10px]">
                          ${svc.hasConversionCenter ? '<span class="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">تحويل</span>' : ''}
                          ${svc.hasLubeCenter ? '<span class="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">زيوت</span>' : ''}
                          ${svc.hasCylinderTesting ? '<span class="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">فحص</span>' : ''}
                          ${svc.hasCanopyOil ? '<span class="bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded">مظلة</span>' : ''}
                        </div>
                      </td>
                      <td class="p-3 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            data-action="locate" 
                            data-id="${escapeHtml(station.id)}" 
                            class="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg transition-colors"
                            title="عرض دبوس المحطة على الخريطة"
                          >
                            🗺️
                          </button>
                          <button 
                            type="button"
                            data-action="edit" 
                            data-id="${escapeHtml(station.id)}" 
                            class="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            ✏️
                          </button>
                          <button 
                            type="button"
                            data-action="delete" 
                            data-id="${escapeHtml(station.id)}" 
                            class="p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg transition-colors"
                            title="حذف"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>

        <!-- Edit Station Modal if active -->
        ${this.editingStation ? this.renderEditStationModal() : ''}

      </div>
    `;
  }

  // Edit station modal
  private renderEditStationModal(): string {
    if (!this.editingStation) return '';
    const s = this.editingStation;
    const svc = s.services || {
      hasConversionCenter: false,
      hasLubeCenter: false,
      hasCylinderTesting: false,
      hasCanopyOil: false,
      hasFastService: false,
    };

    return `
      <div class="fixed inset-0 bg-black/80 backdrop-blur-md z-[1550] flex items-center justify-center p-3">
        <div class="glass-card w-full max-w-lg max-h-[90vh] rounded-3xl p-5 shadow-2xl border overflow-y-auto custom-scrollbar animate-scale-up text-right">
          
          <div class="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <h4 class="text-base font-black text-white">تعديل بيانات المحطة</h4>
            <button type="button" id="btn-close-edit-modal" class="text-slate-400 hover:text-white p-1 rounded-full">✕</button>
          </div>

          <form id="edit-station-form" class="space-y-3 text-xs">
            <div>
              <label class="block text-slate-300 font-bold mb-1">اسم المحطة</label>
              <input type="text" id="edit-name" value="${escapeHtml(s.name)}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
            </div>

            <!-- Smart Coords Paste / Map Pick -->
            <div class="p-2.5 rounded-2xl bg-slate-900/70 border border-emerald-500/30 space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-[11px] font-bold text-emerald-300">تحديث الموقع من الخريطة أو رابط جوجل:</span>
                <button type="button" id="btn-pick-edit-coords" class="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition-all">
                  📍 التقاط من الخريطة
                </button>
              </div>
              <div class="flex items-center gap-1.5">
                <input type="text" id="edit-smart-coords" placeholder="الصق رابط Google Maps أو 30.015, 31.305" class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none" dir="ltr" />
                <button type="button" id="btn-extract-edit-coords" class="bg-slate-700 hover:bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] shrink-0">استخراج</button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-slate-300 font-bold mb-1">خط العرض (Latitude)</label>
                <input type="text" inputmode="decimal" id="edit-lat" value="${Number.isFinite(Number(s.lat)) ? s.lat : ''}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono" dir="ltr" />
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">خط الطول (Longitude)</label>
                <input type="text" inputmode="decimal" id="edit-lng" value="${Number.isFinite(Number(s.lng)) ? s.lng : ''}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono" dir="ltr" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-slate-300 font-bold mb-1">المحافظة</label>
                <input type="text" id="edit-gov" value="${escapeHtml(s.governorate || '')}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">المدينة / الحي</label>
                <input type="text" id="edit-city" value="${escapeHtml(s.city || '')}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
              </div>
            </div>

            <div>
              <label class="block text-slate-300 font-bold mb-1">العنوان التفصيلي</label>
              <input type="text" id="edit-address" value="${escapeHtml(s.address || '')}" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-slate-300 font-bold mb-1">الهاتف</label>
                <input type="text" id="edit-phone" value="${escapeHtml(s.phone || '19617')}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
              </div>
              <div>
                <label class="block text-slate-300 font-bold mb-1">مواعيد العمل</label>
                <input type="text" id="edit-hours" value="${escapeHtml(s.operatingHours || '24 ساعة')}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
              </div>
            </div>

            <!-- Services Checkboxes -->
            <div class="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
              <div class="font-bold text-emerald-400">الأنشطة والخدمات المتوفرة بالمحطة:</div>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="edit-serv-conversion" ${svc.hasConversionCenter ? 'checked' : ''} class="rounded" />
                  <span>مركز تحويل وصيانة</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="edit-serv-lube" ${svc.hasLubeCenter ? 'checked' : ''} class="rounded" />
                  <span>مركز زيوت متخصص</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="edit-serv-canopy" ${svc.hasCanopyOil ? 'checked' : ''} class="rounded" />
                  <span>زيوت أسفل المظلة</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="edit-serv-cylinder" ${svc.hasCylinderTesting ? 'checked' : ''} class="rounded" />
                  <span>مركز فحص واختبار أسطوانات</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="edit-serv-fast" ${svc.hasFastService ? 'checked' : ''} class="rounded" />
                  <span>خدمات سريعة / كافيه</span>
                </label>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-md transition-all">
                حفظ التعديلات وعرضها على الخريطة
              </button>
              <button type="button" id="btn-cancel-edit" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">
                إلغاء
              </button>
            </div>
          </form>

        </div>
      </div>
    `;
  }

  // Tab 3: Add station manually
  private renderAddTab(): string {
    const d = this.addDraft;
    return `
      <div class="max-w-xl mx-auto space-y-4 text-right">
        <div>
          <h4 class="text-base font-bold text-white mb-1">إضافة محطة غاز جديدة</h4>
          <p class="text-xs text-slate-400">أدخل الإحداثيات يدوياً، أو الصق رابط خرائط جوجل، أو انقر مباشرة على الخريطة لتحديد مكان المحطة بدقة.</p>
        </div>

        <form id="add-station-form" class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-300 font-bold mb-1">اسم المحطة *</label>
            <input type="text" id="add-name" value="${escapeHtml(d.name)}" placeholder="مثال: كارجاس - المقطم (الهضبة العليا)" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
          </div>

          <!-- Smart Coordinates Picker & Paster -->
          <div class="p-3 rounded-2xl bg-slate-900/75 border border-emerald-500/35 space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="font-bold text-emerald-300">📍 تحديد إحداثيات المحطة بسهولة:</span>
              <button type="button" id="btn-pick-add-coords" class="bg-blue-600 hover:bg-blue-500 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow transition-all">
                📍 التقاط الموقع من الخريطة
              </button>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                id="add-smart-coords"
                placeholder="الصق رابط خرائط جوجل أو 30.0155, 31.3052 لاستخراج خط العرض والطول تلقائياً"
                class="flex-1 bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2 text-white text-xs outline-none"
                dir="ltr"
              />
              <button type="button" id="btn-extract-add-coords" class="bg-slate-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition-all shrink-0">
                استخراج
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-300 font-bold mb-1">خط العرض (Lat) *</label>
              <input type="text" inputmode="decimal" id="add-lat" value="${escapeHtml(d.lat)}" placeholder="مثال: 30.0155" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono" dir="ltr" />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">خط الطول (Lng) *</label>
              <input type="text" inputmode="decimal" id="add-lng" value="${escapeHtml(d.lng)}" placeholder="مثال: 31.3052" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono" dir="ltr" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-300 font-bold mb-1">المحافظة *</label>
              <input type="text" id="add-gov" value="${escapeHtml(d.gov)}" placeholder="مثال: القاهرة" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">المدينة / المنطقة</label>
              <input type="text" id="add-city" value="${escapeHtml(d.city)}" placeholder="مثال: المقطم" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
            </div>
          </div>

          <div>
            <label class="block text-slate-300 font-bold mb-1">العنوان التفصيلي *</label>
            <input type="text" id="add-address" value="${escapeHtml(d.address)}" placeholder="مثال: شارع 9 - الهضبة العليا - المقطم" required class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-300 font-bold mb-1">الهاتف</label>
              <input type="text" id="add-phone" value="${escapeHtml(d.phone)}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">مواعيد العمل</label>
              <input type="text" id="add-hours" value="${escapeHtml(d.hours)}" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-cairo" />
            </div>
          </div>

          <div class="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div class="font-bold text-emerald-400">الأنشطة والخدمات المتوفرة:</div>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="add-serv-conversion" ${d.hasConversion ? 'checked' : ''} class="rounded" />
                <span>مركز تحويل وصيانة</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="add-serv-lube" ${d.hasLube ? 'checked' : ''} class="rounded" />
                <span>مركز زيوت متخصص</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="add-serv-canopy" ${d.hasCanopy ? 'checked' : ''} class="rounded" />
                <span>زيوت أسفل المظلة</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="add-serv-cylinder" ${d.hasCylinder ? 'checked' : ''} class="rounded" />
                <span>مركز فحص واختبار أسطوانات</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="add-serv-fast" ${d.hasFast ? 'checked' : ''} class="rounded" />
                <span>خدمات سريعة / كافيه</span>
              </label>
            </div>
          </div>

          <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg transition-all text-sm">
            ➕ إضافة المحطة وعرضها على الخريطة والجدول
          </button>
        </form>
      </div>
    `;
  }

  // Tab 4: Branding and Dual Logo upload (App Logo vs Station Pins Logo)
  private renderBrandingTab(): string {
    const appLogo = StationStorage.getAppLogo();
    const stationLogo = StationStorage.getStationLogo();

    return `
      <div class="max-w-2xl mx-auto space-y-6 text-right">
        <div>
          <h4 class="text-base font-bold text-white mb-1">
            تخصيص شعار التطبيق وشعار دبابيس المحطات
          </h4>
          <p class="text-xs text-slate-400">
            بناءً على طلبك: يمكنك تحديد شعار خاص للتطبيق (يظهر بالشريط العلوي) وشعار مستقل تماماً لدبابيس المحطات على الخريطة وبطاقات المحطة، وحفظهما في الكود المصدري.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- 1. App Logo Card -->
          <div class="p-4 rounded-3xl bg-slate-900/60 border border-emerald-500/30 flex flex-col items-center justify-between gap-4 text-center">
            <div class="w-full text-right border-b border-white/10 pb-2">
              <div class="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <span>📱</span>
                <span>1. شعار التطبيق (Header & Brand)</span>
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">يظهر في الشريط العلوي وواجهة التطبيق الرئيسية</p>
            </div>

            <!-- Preview -->
            <div class="w-24 h-24 rounded-2xl bg-slate-950 border-2 border-emerald-500/50 p-2 flex items-center justify-center shadow-inner relative group">
              <img src="${appLogo}" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="App Logo" class="max-w-full max-h-full object-contain drop-shadow" />
            </div>

            <div class="text-[11px] font-bold text-slate-300">
              شعار التطبيق الحالي
            </div>

            <!-- Upload & Actions -->
            <div class="w-full space-y-2">
              <input type="file" id="app-logo-file-input" accept="image/*" class="hidden" />
              <button 
                id="btn-trigger-app-logo-upload"
                class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <span>📤</span>
                <span>رفع وتغيير شعار التطبيق</span>
              </button>

              <div class="flex items-center gap-2">
                <button 
                  id="btn-save-app-logo-source"
                  class="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  title="تثبيت شعار التطبيق مباشرة في ملف الكود المصدري src/assets/cargasLogo.ts"
                >
                  💾 حفظ في الكود المصدري
                </button>
                <button 
                  id="btn-remove-app-logo"
                  class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  title="استعادة الشعار الافتراضي"
                >
                  استعادة
                </button>
              </div>
            </div>
          </div>

          <!-- 2. Station Pin Logo Card -->
          <div class="p-4 rounded-3xl bg-slate-900/60 border border-blue-500/30 flex flex-col items-center justify-between gap-4 text-center">
            <div class="w-full text-right border-b border-white/10 pb-2">
              <div class="text-xs font-black text-blue-400 flex items-center gap-1.5">
                <span>⛽</span>
                <span>2. شعار دبابيس المحطات على الخريطة</span>
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">يظهر داخل علامات ودبابيس المحطات وبطاقات التفاصيل</p>
            </div>

            <!-- Realistic Pin Preview -->
            <div class="h-24 flex items-center justify-center">
              <div style="width:44px; height:44px; display:flex; flex-direction:column; align-items:center; position:relative;">
                <div style="width:38px; height:38px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); background:#0D2C54; border:2.5px solid #00C853; box-shadow:0 4px 14px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;">
                  <div style="transform:rotate(45deg); display:flex; align-items:center; justify-content:center; width:26px; height:26px;">
                    <img src="${stationLogo}" onerror="this.onerror=null;this.src='${DEFAULT_CARGAS_LOGO_DATA_URL}';" alt="Station Pin Logo" style="width:24px; height:24px; object-fit:contain; border-radius:50%;" />
                  </div>
                </div>
              </div>
            </div>

            <div class="text-[11px] font-bold text-slate-300">
              معاينة مظهر دبوس المحطة على الخريطة
            </div>

            <!-- Upload & Actions -->
            <div class="w-full space-y-2">
              <input type="file" id="station-logo-file-input" accept="image/*" class="hidden" />
              <button 
                id="btn-trigger-station-logo-upload"
                class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <span>📤</span>
                <span>رفع وتغيير شعار دبابيس المحطات</span>
              </button>

              <div class="flex items-center gap-2">
                <button 
                  id="btn-save-station-logo-source"
                  class="flex-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  title="تثبيت شعار المحطات مباشرة في ملف الكود المصدري src/assets/cargasLogo.ts"
                >
                  💾 حفظ في الكود المصدري
                </button>
                <button 
                  id="btn-remove-station-logo"
                  class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  title="استعادة الشعار الافتراضي"
                >
                  استعادة
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- Unified Logo Source Code Baking Box -->
        <div class="w-full p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/40 text-right space-y-2">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span class="text-xs font-bold text-emerald-400">تثبيت كافة الشعارات في الكود المصدري (cargasLogo.ts):</span>
              <div class="text-[10px] text-slate-400">حفظ الشعارات مباشرة في المشروع لتظهر دائماً على GitHub و Vercel</div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                id="btn-copy-logo-code" 
                class="bg-slate-700 hover:bg-slate-600 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                📋 نسخ الكود
              </button>
              <button 
                id="btn-download-logo-file" 
                class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
              >
                💾 تحميل cargasLogo.ts
              </button>
            </div>
          </div>
          <p class="text-[11px] text-slate-400">
            عند رفع أي شعار يتم تحديثه لحظياً في التطبيق والخريطة، كما يمكنك تثبيته دائماً في ملف الكود المصدري <code>src/assets/cargasLogo.ts</code> بنقرة واحدة!
          </p>
        </div>

      </div>
    `;
  }

  // Tab 5: App Name, Admin Password, User Icons Visibility & Street Map Lock
  private renderSettingsTab(): string {
    const cfg = AppConfigService.getConfig();
    const icons = cfg.userIcons;

    const headerToggles: Array<{ key: keyof UserIconsVisibility; icon: string; label: string; desc: string }> = [
      { key: 'nearestStation', icon: '🧭', label: 'زر أقرب محطة', desc: 'الزر الأخضر السريع لتحديد أقرب محطة' },
      { key: 'offlineMap', icon: '🗺️', label: 'زر خريطة أوفلاين', desc: 'تحميل خريطة مصر للعمل بدون إنترنت' },
      { key: 'installPwa', icon: '📲', label: 'زر تثبيت التطبيق', desc: 'تثبيت التطبيق على شاشة الهاتف' },
      { key: 'stationsList', icon: '📋', label: 'زر قائمة المحطات (الشريط العلوي)', desc: 'فتح دليل وجدول المحطات الكامل' },
      { key: 'themeToggle', icon: '🌓', label: 'زر مظهر الواجهة (الليلي/النهاري)', desc: 'تبديل ألوان القوائم والشريط فقط (دون الخريطة)' },
      { key: 'networkBadge', icon: '📶', label: 'شارة حالة الاتصال (متصل/أوفلاين)', desc: 'إظهار مؤشر الاتصال بجانب الاسم' },
    ];

    const mapToggles: Array<{ key: keyof UserIconsVisibility; icon: string; label: string; desc: string }> = [
      { key: 'locationBadge', icon: '📍', label: 'شارة موقعي الحالي', desc: 'الزر التفاعلي أعلى الخريطة لتحديد الموقع' },
      { key: 'mapSearch', icon: '🔍', label: 'شريط البحث وفلاتر الخدمات', desc: 'البحث داخل الخريطة وفلاتر الأنشطة' },
      { key: 'recenterGps', icon: '🎯', label: 'زر توسيط موقعي (GPS)', desc: 'الزر العائم لتوسيط الخريطة على موقع المستخدم' },
      { key: 'zoomControls', icon: '➕', label: 'أزرار التكبير والتصغير (+ / -)', desc: 'التحكم بمستوى تقريب الخريطة' },
      { key: 'fitAllStations', icon: '🌍', label: 'زر عرض كافة محطات الجمهورية', desc: 'ضبط الخريطة لإظهار جميع المحطات' },
      { key: 'quickList', icon: '📑', label: 'زر قائمة المحطات العائم', desc: 'اختصار فتح القائمة أسفل يسار الخريطة' },
      { key: 'mapLayerToggle', icon: '🛰️', label: 'زر التبديل (شوارع / قمر صناعي)', desc: 'التبديل بين خريطة الشوارع وخريطة القمر الصناعي' },
    ];

    const renderToggleCard = (item: { key: keyof UserIconsVisibility; icon: string; label: string; desc: string }) => {
      const checked = icons[item.key];
      return `
        <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/70 border ${checked ? 'border-emerald-500/40' : 'border-white/10 opacity-75'} hover:border-emerald-400/60 cursor-pointer transition-all">
          <div class="flex items-start gap-2.5 text-right">
            <span class="text-lg leading-none mt-0.5">${item.icon}</span>
            <div>
              <div class="text-xs font-bold text-white">${item.label}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${item.desc}</div>
            </div>
          </div>
          <input
            type="checkbox"
            data-icon-key="${item.key}"
            class="cfg-icon-checkbox w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0"
            ${checked ? 'checked' : ''}
          />
        </label>
      `;
    };

    return `
      <form id="app-settings-form" class="space-y-5 max-w-3xl mx-auto text-right">
        <div>
          <h4 class="text-base font-bold text-white mb-1">
            التحكم في اسم التطبيق وكلمة السر وأيقونات صفحة المستخدم
          </h4>
          <p class="text-xs text-slate-400">
            كافة التعديلات هنا تُطبق فوراً وتُثبت مباشرة في الكود المصدري (<code>src/config/appConfig.ts</code> و<code>index.html</code>) لتعمل تلقائياً بعد الرفع على Vercel دون أي تعديل يدوي.
          </p>
        </div>

        <!-- Street Map Lock Info -->
        <div class="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">☀️</span>
            <div>
              <div class="text-xs font-black text-emerald-300">تم إلغاء النظام الليلي من خريطة الشوارع</div>
              <div class="text-[11px] text-slate-300">خريطة الشوارع تعمل بالوضع النهاري الواضح دائماً وتمت إزالة زر التبديل الليلي للخريطة.</div>
            </div>
          </div>
          <span class="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">مفعل ومثبت</span>
        </div>

        <!-- 1. App Identity Section -->
        <div class="p-4 rounded-3xl bg-slate-900/60 border border-white/10 space-y-3">
          <div class="text-xs font-black text-emerald-400 flex items-center gap-1.5 border-b border-white/10 pb-2">
            <span>🏷️</span>
            <span>1. التحكم في اسم التطبيق وهويته</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label class="block text-slate-300 font-bold mb-1">اسم التطبيق الرئيسي *</label>
              <input type="text" id="cfg-app-name" value="${escapeHtml(cfg.appName)}" required class="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white font-cairo outline-none" />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">الاسم المختصر (لشاشة الهاتف / PWA)</label>
              <input type="text" id="cfg-app-short-name" value="${escapeHtml(cfg.appShortName)}" required class="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white font-cairo outline-none" />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">الشعار اللفظي بجانب الاسم</label>
              <input type="text" id="cfg-app-subtitle" value="${escapeHtml(cfg.appSubtitle)}" placeholder="مثال: الأقرب لك دائماً" class="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white font-cairo outline-none" />
            </div>
            <div>
              <label class="block text-slate-300 font-bold mb-1">الوصف أسفل العنوان وفي المتصفح</label>
              <input type="text" id="cfg-app-description" value="${escapeHtml(cfg.appDescription)}" class="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-white font-cairo outline-none" />
            </div>
          </div>
        </div>

        <!-- 2. Admin Password Section -->
        <div class="p-4 rounded-3xl bg-slate-900/60 border border-amber-500/30 space-y-3">
          <div class="text-xs font-black text-amber-400 flex items-center gap-1.5 border-b border-white/10 pb-2">
            <span>🔐</span>
            <span>2. تعديل كلمة سر لوحة التحكم</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs items-end">
            <div>
              <label class="block text-slate-300 font-bold mb-1">كلمة المرور المعتمدة *</label>
              <div class="flex items-center gap-2">
                <input type="password" id="cfg-admin-password" value="${escapeHtml(cfg.adminPassword)}" required minlength="1" maxlength="32" autocomplete="new-password" class="flex-1 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl p-2.5 text-white font-mono outline-none" dir="ltr" />
                <button type="button" id="btn-toggle-cfg-pwd" class="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-2.5 rounded-xl text-xs font-bold shrink-0">
                  👁️ إظهار
                </button>
              </div>
            </div>
            <div class="text-[11px] text-slate-400 leading-relaxed">
              تُستخدم كلمة المرور عند الدخول للوحة الإدارة السرية وتُحفظ مباشرة داخل الكود المصدري.
            </div>
          </div>
        </div>

        <!-- 3. User Page Icon Visibility Section -->
        <div class="p-4 rounded-3xl bg-slate-900/60 border border-blue-500/30 space-y-4">
          <div class="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-2">
            <div class="text-xs font-black text-blue-400 flex items-center gap-1.5">
              <span>🎛️</span>
              <span>3. إخفاء وإظهار الأيقونات من صفحة المستخدم</span>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" id="btn-icons-show-all" class="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all">
                ✓ إظهار الكل
              </button>
              <button type="button" id="btn-icons-minimal" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all">
                الأساسيات فقط
              </button>
              <button type="button" id="btn-icons-hide-all" class="bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all">
                ✕ إخفاء الكل
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-[11px] font-bold text-slate-300">أيقونات وشارات الشريط العلوي (الهيدر):</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${headerToggles.map(renderToggleCard).join('')}
            </div>
          </div>

          <div class="space-y-2 pt-1">
            <div class="text-[11px] font-bold text-slate-300">أيقونات وأدوات الخريطة:</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${mapToggles.map(renderToggleCard).join('')}
            </div>
          </div>
        </div>

        <!-- Save & Bake Action Bar -->
        <div class="flex items-center gap-3 flex-wrap">
          <button type="submit" id="btn-save-app-settings" class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-3 px-5 rounded-2xl text-xs sm:text-sm shadow-xl transition-all active:scale-95">
            💾 حفظ الإعدادات وتثبيتها في الكود المصدري
          </button>
          <button type="button" id="btn-commit-everything-vercel" class="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm shadow-lg transition-all active:scale-95">
            🚀 اعتماد كل شيء لـ Vercel
          </button>
        </div>
      </form>
    `;
  }

  // Tab 6: Source Code & GitHub / Vercel Export
  private renderSourceCodeTab(): string {
    const stationsCode = StationStorage.generateSourceCodeTypeScript();
    const logoCode = StationStorage.generateLogoSourceCode();
    const configCode = AppConfigService.generateConfigSourceCode();

    return `
      <div class="space-y-4 max-w-3xl mx-auto text-right">
        
        <div>
          <h4 class="text-base font-bold text-white mb-1">
            اعتماد وتثبيت كافة التعديلات في الكود المصدري للتطبيق (GitHub & Vercel)
          </h4>
          <p class="text-xs text-slate-400">
            يتم حفظ المحطات الـ (${this.stations.length}) والشعارات واسم التطبيق وكلمة السر وإعدادات إظهار/إخفاء الأيقونات مباشرة في الكود المصدري، لتُرفع على Vercel وتعمل فوراً دون أي تعديل يدوي!
          </p>
        </div>

        <!-- Direct Source Code Persistence Banner -->
        <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 to-slate-900/90 border-2 border-emerald-500/60 shadow-xl flex items-center justify-between gap-4 flex-wrap">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xl">🚀</span>
              <h5 class="text-sm sm:text-base font-black text-emerald-400">
                اعتماد وتثبيت كافة التعديلات في المشروع الآن (جاهز للرفع على Vercel)
              </h5>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">
              بالضغط على هذا الزر يتم تثبيت جميع المحطات (${this.stations.length} محطة) + شعار التطبيق والدبابيس + الاسم وكلمة السر وإعدادات الأيقونات داخل ملفات الكود المصدري (<code>defaultStations.ts</code>, <code>cargasLogo.ts</code>, <code>appConfig.ts</code>, <code>index.html</code>) وإلغاء الوضع الليلي للخريطة نهائياً.
            </p>
          </div>
          <button 
            id="btn-direct-save-source"
            class="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-3 rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-950/60 transition-all flex items-center gap-2 shrink-0 active:scale-95"
          >
            <span>💾</span>
            <span>اعتماد وتثبيت كل التعديلات الآن</span>
          </button>
        </div>

        <!-- Buttons for clearing & resetting -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
          <div>
            <div class="text-xs font-bold text-rose-400 mb-1">زر إزالة البيانات الافتراضية:</div>
            <p class="text-[11px] text-slate-400 mb-2">إفراغ المحطات التجريبية تمهيداً لرفع ملف إكسيل المحطات الحقيقية فقط.</p>
            <button 
              id="btn-clear-demo-data"
              class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md w-full"
            >
              🗑️ إزالة البيانات الافتراضية الآن
            </button>
          </div>

          <div>
            <div class="text-xs font-bold text-emerald-400 mb-1">استعادة البيانات الأصلية:</div>
            <p class="text-[11px] text-slate-400 mb-2">إعادة محطات كارجاس الافتراضية المجهزة مسبقاً في أي وقت.</p>
            <button 
              id="btn-restore-demo-data"
              class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition-all border border-slate-700 w-full"
            >
              🔄 استعادة البيانات الافتراضية
            </button>
          </div>
        </div>

        <!-- Download & Copy defaultStations.ts -->
        <div class="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span class="text-xs font-bold text-white">1. كود ملف المحطات المحدث (src/data/defaultStations.ts):</span>
              <div class="text-[10px] text-emerald-400">يحتوي على ${this.stations.length} محطة ببياناتها وإحداثياتها</div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                id="btn-copy-ts-code" 
                class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <span>📋</span>
                <span>نسخ الكود</span>
              </button>
              <button 
                id="btn-download-ts-file" 
                class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <span>💾</span>
                <span>تحميل defaultStations.ts</span>
              </button>
            </div>
          </div>

          <pre class="bg-slate-950 p-3 rounded-xl border border-white/5 font-mono text-[11px] text-emerald-300 max-h-48 overflow-y-auto custom-scrollbar select-all" dir="ltr">${escapeHtml(stationsCode)}</pre>
        </div>

        <!-- Download & Copy cargasLogo.ts -->
        <div class="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span class="text-xs font-bold text-white">2. كود ملف الشعار المحدث (src/assets/cargasLogo.ts):</span>
              <div class="text-[10px] text-blue-400">يثبت الشعار المرفوع في الكود المصدري</div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                id="btn-copy-logo-code-tab5" 
                class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <span>📋</span>
                <span>نسخ كود الشعار</span>
              </button>
              <button 
                id="btn-download-logo-file-tab5" 
                class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <span>💾</span>
                <span>تحميل cargasLogo.ts</span>
              </button>
            </div>
          </div>

          <pre class="bg-slate-950 p-3 rounded-xl border border-white/5 font-mono text-[11px] text-blue-300 max-h-36 overflow-y-auto custom-scrollbar select-all" dir="ltr">${logoCode.slice(0, 300)}... [تم اختصار العرض]</pre>
        </div>

        <!-- Download & Copy appConfig.ts -->
        <div class="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span class="text-xs font-bold text-white">3. كود إعدادات الاسم وكلمة السر والأيقونات (src/config/appConfig.ts):</span>
              <div class="text-[10px] text-amber-400">يثبت اسم التطبيق وكلمة المرور وإظهار/إخفاء الأيقونات لـ Vercel</div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                id="btn-copy-config-code" 
                class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <span>📋</span>
                <span>نسخ الإعدادات</span>
              </button>
              <button 
                id="btn-download-config-file" 
                class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <span>💾</span>
                <span>تحميل appConfig.ts</span>
              </button>
            </div>
          </div>

          <pre class="bg-slate-950 p-3 rounded-xl border border-white/5 font-mono text-[11px] text-amber-300 max-h-48 overflow-y-auto custom-scrollbar select-all" dir="ltr">${escapeHtml(configCode)}</pre>
        </div>

      </div>
    `;
  }

  private attachDashboardEvents(): void {
    // Close dashboard
    this.container.querySelector('#btn-close-admin-dash')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.hide();
    });

    // Tab buttons
    this.container.querySelectorAll('.admin-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', (e) => {
        SoundService.playChime('click');
        const tab = (e.currentTarget as HTMLElement).dataset.tab as any;
        if (tab) {
          this.currentTab = tab;
          this.renderDashboard();
        }
      });
    });

    // Tab 1 Events: Upload & Template & Column Mapping Override
    const dropzone = this.container.querySelector('#excel-dropzone');
    const fileInput = this.container.querySelector('#excel-file-input') as HTMLInputElement;

    dropzone?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-emerald-400', 'bg-slate-800/70');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-emerald-400', 'bg-slate-800/70');
    });
    dropzone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-emerald-400', 'bg-slate-800/70');
      const file = (e as DragEvent).dataTransfer?.files?.[0];
      if (file) {
        this.columnMappingOverride = {};
        await this.handleExcelFile(file);
      }
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.columnMappingOverride = {};
        await this.handleExcelFile(file);
      }
    });

    const reparseWithMapping = async () => {
      if (!this.lastUploadedFile) return;
      this.columnMappingOverride = {
        nameCol: (this.container.querySelector('#map-col-name') as HTMLSelectElement)?.value || undefined,
        latCol: (this.container.querySelector('#map-col-lat') as HTMLSelectElement)?.value || undefined,
        lngCol: (this.container.querySelector('#map-col-lng') as HTMLSelectElement)?.value || undefined,
        govCol: (this.container.querySelector('#map-col-gov') as HTMLSelectElement)?.value || undefined,
      };
      await this.handleExcelFile(this.lastUploadedFile, true);
    };

    ['#map-col-name', '#map-col-lat', '#map-col-lng', '#map-col-gov'].forEach((sel) => {
      this.container.querySelector(sel)?.addEventListener('change', () => {
        void reparseWithMapping();
      });
    });

    this.container.querySelector('#btn-download-sample-excel')?.addEventListener('click', () => {
      SoundService.playChime('click');
      ExcelParser.downloadSampleTemplate();
    });

    this.container.querySelector('#btn-apply-replace')?.addEventListener('click', async () => {
      if (this.pendingParsedResult && this.pendingParsedResult.stations.length > 0) {
        const count = this.pendingParsedResult.stations.length;
        const stationsToSave = this.pendingParsedResult.stations;
        StationStorage.saveStations(stationsToSave);
        SoundService.playChime('start');
        const res = await StationStorage.saveStationsToSourceCode(stationsToSave);
        if (res.success) {
          ToastService.show(`✅ تم حفظ وتثبيت ${count} محطة كارجاس بأسمائها كما هي في الكود المصدري (src/data/defaultStations.ts) مباشرة!`, 'success', 5000);
        } else {
          ToastService.show(`تم حفظ ${count} محطة بنجاح في التطبيق!`, 'success', 4000);
        }
        this.pendingParsedResult = null;
        this.onDataChangedCallback();
        this.currentTab = 'manage';
        this.renderDashboard();
      }
    });

    this.container.querySelector('#btn-apply-append')?.addEventListener('click', async () => {
      if (this.pendingParsedResult && this.pendingParsedResult.stations.length > 0) {
        const current = StationStorage.getStations();
        const combined = [...this.pendingParsedResult.stations, ...current];
        StationStorage.saveStations(combined);
        SoundService.playChime('start');
        const res = await StationStorage.saveStationsToSourceCode(combined);
        if (res.success) {
          ToastService.show(`✅ تم إلحاق وحفظ المحطات مباشرة في الكود المصدري (src/data/defaultStations.ts)! الإجمالي: ${combined.length} محطة.`, 'success', 5000);
        } else {
          ToastService.show(`تم إلحاق ${this.pendingParsedResult.stations.length} محطة بنجاح! الإجمالي: ${combined.length} محطة.`, 'success', 4000);
        }
        this.pendingParsedResult = null;
        this.onDataChangedCallback();
        this.currentTab = 'manage';
        this.renderDashboard();
      }
    });

    // Direct Source Code Persistence Buttons (Manage tab & Source tab)
    const handleDirectSave = async () => {
      SoundService.playChime('click');
      const count = this.stations.length;
      ToastService.show('جارٍ اعتماد وتثبيت كافة المحطات والشعارات والإعدادات في الكود المصدري...', 'info', 2000);
      const res = await StationStorage.commitAllEditsToSourceCode();
      if (res.success) {
        SoundService.playChime('start');
        ToastService.show(`✅ تم اعتماد وتثبيت ${count} محطة والشعارات واسم التطبيق وكلمة السر والأيقونات في الكود المصدري (جاهز لـ Vercel)!`, 'success', 5000);
      } else {
        ToastService.show(`تم الحفظ في التخزين (${res.message})`, 'info', 4000);
      }
    };
    this.container.querySelector('#btn-direct-save-source')?.addEventListener('click', handleDirectSave);
    this.container.querySelector('#btn-direct-save-manage')?.addEventListener('click', handleDirectSave);

    // Tab 2 Events: Search, Gov Filter, Locate, Edit, Delete
    const manageSearchInput = this.container.querySelector('#admin-manage-search') as HTMLInputElement | null;
    manageSearchInput?.addEventListener('input', (e) => {
      this.manageSearchQuery = (e.target as HTMLInputElement).value;
      this.renderDashboard();
      const restored = this.container.querySelector('#admin-manage-search') as HTMLInputElement | null;
      if (restored) {
        restored.focus();
        restored.setSelectionRange(restored.value.length, restored.value.length);
      }
    });

    this.container.querySelector('#btn-admin-manage-clear-search')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.manageSearchQuery = '';
      this.renderDashboard();
      (this.container.querySelector('#admin-manage-search') as HTMLInputElement | null)?.focus();
    });

    this.container.querySelector('#admin-manage-gov')?.addEventListener('change', (e) => {
      this.manageGovFilter = (e.target as HTMLSelectElement).value || 'all';
      this.renderDashboard();
    });

    this.container.querySelector('#btn-admin-manage-reset')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.manageSearchQuery = '';
      this.manageGovFilter = 'all';
      this.renderDashboard();
    });

    this.container.querySelectorAll('[data-action="locate"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const station = this.stations.find((s) => s.id === id);
        if (!station) return;
        const lat = Number(station.lat);
        const lng = Number(station.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
          ToastService.show('إحداثيات هذه المحطة غير صالحة. اضغط ✏️ لتصحيحها أولاً.', 'warning');
          return;
        }
        SoundService.playChime('click');
        this.hide();
        this.onLocateStationCallback?.(station);
      });
    });

    this.container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const station = this.stations.find((s) => s.id === id);
        if (station) {
          this.editingStation = { ...station };
          this.renderDashboard();
        }
      });
    });

    this.container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const station = this.stations.find((s) => s.id === id);
        if (id) {
          ToastService.confirm({
            title: 'حذف المحطة',
            message: `هل أنت متأكد من رغبتك في حذف محطة "${station?.name || ''}" بشكل نهائي؟`,
            isDanger: true,
            confirmText: 'نعم، احذف',
            onConfirm: () => {
              StationStorage.deleteStation(id);
              SoundService.playChime('turn');
              ToastService.show(`تم حذف محطة "${station?.name || ''}" بنجاح`, 'info');
              this.onDataChangedCallback();
              this.renderDashboard();
            },
          });
        }
      });
    });

    this.container.querySelector('#btn-clear-all-data-quick')?.addEventListener('click', () => {
      ToastService.confirm({
        title: 'مسح كافة المحطات',
        message: 'تحذير: هل أنت متأكد من مسح جميع المحطات المسجلة بالتطبيق تمهيداً لرفع ملف إكسيل جديد؟',
        isDanger: true,
        confirmText: 'نعم، امسح الكل',
        onConfirm: () => {
          StationStorage.clearDefaultData();
          SoundService.playChime('turn');
          ToastService.show('تم مسح جميع المحطات بنجاح. الخريطة فارغة وجاهزة للملف الجديد.', 'info');
          this.onDataChangedCallback();
          this.renderDashboard();
        },
      });
    });

    this.container.querySelector('#btn-go-upload-tab')?.addEventListener('click', () => {
      SoundService.playChime('click');
      this.currentTab = 'upload';
      this.renderDashboard();
    });

    const restoreDefaultsHandler = () => {
      ToastService.confirm({
        title: 'استعادة المحطات الافتراضية',
        message: 'هل ترغب في استعادة محطات كارجاس الافتراضية الصحيحة؟',
        confirmText: 'نعم، استعادة',
        onConfirm: () => {
          StationStorage.restoreDefaultData();
          SoundService.playChime('start');
          ToastService.show('تمت استعادة المحطات الافتراضية بنجاح!', 'success');
          this.onDataChangedCallback();
          this.renderDashboard();
        },
      });
    };

    this.container.querySelector('#btn-restore-defaults')?.addEventListener('click', restoreDefaultsHandler);
    this.container.querySelector('#btn-restore-defaults-banner')?.addEventListener('click', restoreDefaultsHandler);

    // Edit form events & smart coordinate tools
    const applySmartEditCoords = () => {
      const raw = (this.container.querySelector('#edit-smart-coords') as HTMLInputElement | null)?.value || '';
      const pair = extractLatLngPairFromInput(raw);
      if (!pair) {
        ToastService.show('لم يتم التعرف على إحداثيات صالحة. الصق رابط Google Maps أو اكتب: 30.015, 31.305', 'warning');
        return;
      }
      const govVal = (this.container.querySelector('#edit-gov') as HTMLInputElement | null)?.value || '';
      const cityVal = (this.container.querySelector('#edit-city') as HTMLInputElement | null)?.value || '';
      const nameVal = (this.container.querySelector('#edit-name') as HTMLInputElement | null)?.value || '';
      const fixed = fixEgyptLatLngSwap(pair.lat, pair.lng, `${govVal} ${cityVal} ${nameVal}`);
      const latInput = this.container.querySelector('#edit-lat') as HTMLInputElement | null;
      const lngInput = this.container.querySelector('#edit-lng') as HTMLInputElement | null;
      if (latInput) latInput.value = fixed.lat.toFixed(6);
      if (lngInput) lngInput.value = fixed.lng.toFixed(6);
      SoundService.playChime('click');
      ToastService.show(`✅ تم استخراج الإحداثيات: ${fixed.lat.toFixed(5)}, ${fixed.lng.toFixed(5)}`, 'success');
    };

    this.container.querySelector('#btn-extract-edit-coords')?.addEventListener('click', applySmartEditCoords);
    this.container.querySelector('#edit-smart-coords')?.addEventListener('paste', () => {
      setTimeout(applySmartEditCoords, 30);
    });

    const syncEditFieldsFromDom = () => {
      if (!this.editingStation) return;
      const parsedLat = parseCoordinate((this.container.querySelector('#edit-lat') as HTMLInputElement)?.value);
      const parsedLng = parseCoordinate((this.container.querySelector('#edit-lng') as HTMLInputElement)?.value);
      this.editingStation = {
        ...this.editingStation,
        name: (this.container.querySelector('#edit-name') as HTMLInputElement)?.value || this.editingStation.name,
        lat: Number.isFinite(parsedLat) ? parsedLat : this.editingStation.lat,
        lng: Number.isFinite(parsedLng) ? parsedLng : this.editingStation.lng,
        governorate: (this.container.querySelector('#edit-gov') as HTMLInputElement)?.value || this.editingStation.governorate,
        city: (this.container.querySelector('#edit-city') as HTMLInputElement)?.value || '',
        address: (this.container.querySelector('#edit-address') as HTMLInputElement)?.value || '',
        phone: (this.container.querySelector('#edit-phone') as HTMLInputElement)?.value || '19617',
        operatingHours: (this.container.querySelector('#edit-hours') as HTMLInputElement)?.value || '24 ساعة',
        services: {
          hasConversionCenter: Boolean((this.container.querySelector('#edit-serv-conversion') as HTMLInputElement)?.checked),
          hasLubeCenter: Boolean((this.container.querySelector('#edit-serv-lube') as HTMLInputElement)?.checked),
          hasCanopyOil: Boolean((this.container.querySelector('#edit-serv-canopy') as HTMLInputElement)?.checked),
          hasCylinderTesting: Boolean((this.container.querySelector('#edit-serv-cylinder') as HTMLInputElement)?.checked),
          hasFastService: Boolean((this.container.querySelector('#edit-serv-fast') as HTMLInputElement)?.checked),
        },
      };
    };

    this.container.querySelector('#btn-pick-edit-coords')?.addEventListener('click', () => {
      if (!this.onPickCoordsOnMapCallback) return;
      syncEditFieldsFromDom();
      this.hide();
      ToastService.show('👆 انقر على موقع المحطة على الخريطة لالتقاط إحداثياتها بدقة', 'info', 5000);
      this.onPickCoordsOnMapCallback((lat, lng) => {
        if (this.editingStation) {
          this.editingStation.lat = Number(lat.toFixed(6));
          this.editingStation.lng = Number(lng.toFixed(6));
          const district = LocationService.getDistrictOrCityName(lat, lng);
          if (!this.editingStation.governorate) {
            this.editingStation.governorate = district.split(' - ')[0] || 'القاهرة';
          }
          if (!this.editingStation.city && district.includes(' - ')) {
            this.editingStation.city = district.split(' - ')[1] || '';
          }
        }
        this.currentTab = 'manage';
        this.container.classList.remove('hidden');
        this.renderDashboard();
        SoundService.playChime('start');
        ToastService.show(`✅ تم التقاط الموقع: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'success');
      });
    });

    this.container.querySelector('#btn-close-edit-modal')?.addEventListener('click', () => {
      this.editingStation = null;
      this.renderDashboard();
    });

    this.container.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
      this.editingStation = null;
      this.renderDashboard();
    });

    const editForm = this.container.querySelector('#edit-station-form');
    editForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.editingStation) return;

      const name = ((this.container.querySelector('#edit-name') as HTMLInputElement).value || '').trim();
      const rawLat = (this.container.querySelector('#edit-lat') as HTMLInputElement).value;
      const rawLng = (this.container.querySelector('#edit-lng') as HTMLInputElement).value;
      const gov = ((this.container.querySelector('#edit-gov') as HTMLInputElement).value || '').trim();
      const city = ((this.container.querySelector('#edit-city') as HTMLInputElement).value || '').trim();
      const address = ((this.container.querySelector('#edit-address') as HTMLInputElement).value || '').trim();
      const phone = ((this.container.querySelector('#edit-phone') as HTMLInputElement).value || '').trim();
      const hours = ((this.container.querySelector('#edit-hours') as HTMLInputElement).value || '').trim();

      let lat = parseCoordinate(rawLat);
      let lng = parseCoordinate(rawLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const pair = extractLatLngPairFromInput(`${rawLat} ${rawLng}`);
        if (pair) {
          lat = pair.lat;
          lng = pair.lng;
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        ToastService.show('يرجى إدخال خط عرض وخط طول صالحين (أو التقط الموقع من الخريطة).', 'warning');
        return;
      }

      const fixed = fixEgyptLatLngSwap(lat, lng, `${gov} ${city} ${address} ${name}`);
      lat = fixed.lat;
      lng = fixed.lng;

      const hasConversion = (this.container.querySelector('#edit-serv-conversion') as HTMLInputElement).checked;
      const hasLube = (this.container.querySelector('#edit-serv-lube') as HTMLInputElement).checked;
      const hasCanopy = (this.container.querySelector('#edit-serv-canopy') as HTMLInputElement).checked;
      const hasCylinder = (this.container.querySelector('#edit-serv-cylinder') as HTMLInputElement).checked;
      const hasFast = (this.container.querySelector('#edit-serv-fast') as HTMLInputElement).checked;

      const updated: Station = {
        ...this.editingStation,
        name,
        stationName: name,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        governorate: gov,
        city,
        address,
        phone,
        operatingHours: hours,
        services: {
          hasConversionCenter: hasConversion,
          hasLubeCenter: hasLube,
          hasCanopyOil: hasCanopy,
          hasCylinderTesting: hasCylinder,
          hasFastService: hasFast,
        },
      };

      const saved = StationStorage.updateStation(updated);
      this.recentlyAddedId = saved.id;
      SoundService.playChime('start');
      ToastService.show(
        fixed.swapped
          ? `✅ تم حفظ تعديل "${saved.name}" وتصحيح تبديل خط الطول والعرض تلقائياً!`
          : `✅ تم حفظ تعديل محطة "${saved.name}" بنجاح!`,
        'success'
      );
      this.editingStation = null;
      this.onDataChangedCallback(saved);
      this.renderDashboard();
    });

    // Tab 3 Events: Add Station Form + Smart Coordinates + Pick on Map
    const syncAddDraftFromDom = () => {
      this.addDraft = {
        name: (this.container.querySelector('#add-name') as HTMLInputElement | null)?.value ?? this.addDraft.name,
        lat: (this.container.querySelector('#add-lat') as HTMLInputElement | null)?.value ?? this.addDraft.lat,
        lng: (this.container.querySelector('#add-lng') as HTMLInputElement | null)?.value ?? this.addDraft.lng,
        gov: (this.container.querySelector('#add-gov') as HTMLInputElement | null)?.value ?? this.addDraft.gov,
        city: (this.container.querySelector('#add-city') as HTMLInputElement | null)?.value ?? this.addDraft.city,
        address: (this.container.querySelector('#add-address') as HTMLInputElement | null)?.value ?? this.addDraft.address,
        phone: (this.container.querySelector('#add-phone') as HTMLInputElement | null)?.value ?? this.addDraft.phone,
        hours: (this.container.querySelector('#add-hours') as HTMLInputElement | null)?.value ?? this.addDraft.hours,
        hasConversion: (this.container.querySelector('#add-serv-conversion') as HTMLInputElement | null)?.checked ?? this.addDraft.hasConversion,
        hasLube: (this.container.querySelector('#add-serv-lube') as HTMLInputElement | null)?.checked ?? this.addDraft.hasLube,
        hasCanopy: (this.container.querySelector('#add-serv-canopy') as HTMLInputElement | null)?.checked ?? this.addDraft.hasCanopy,
        hasCylinder: (this.container.querySelector('#add-serv-cylinder') as HTMLInputElement | null)?.checked ?? this.addDraft.hasCylinder,
        hasFast: (this.container.querySelector('#add-serv-fast') as HTMLInputElement | null)?.checked ?? this.addDraft.hasFast,
      };
    };

    const applySmartAddCoords = () => {
      const raw = (this.container.querySelector('#add-smart-coords') as HTMLInputElement | null)?.value || '';
      const pair = extractLatLngPairFromInput(raw);
      if (!pair) {
        ToastService.show('لم يتم التعرف على إحداثيات صالحة. الصق رابط Google Maps أو اكتب: 30.0155, 31.3052', 'warning');
        return;
      }
      const govEl = this.container.querySelector('#add-gov') as HTMLInputElement | null;
      const cityEl = this.container.querySelector('#add-city') as HTMLInputElement | null;
      const nameEl = this.container.querySelector('#add-name') as HTMLInputElement | null;
      const fixed = fixEgyptLatLngSwap(pair.lat, pair.lng, `${govEl?.value || ''} ${cityEl?.value || ''} ${nameEl?.value || ''}`);
      const latInput = this.container.querySelector('#add-lat') as HTMLInputElement | null;
      const lngInput = this.container.querySelector('#add-lng') as HTMLInputElement | null;
      if (latInput) latInput.value = fixed.lat.toFixed(6);
      if (lngInput) lngInput.value = fixed.lng.toFixed(6);
      const district = LocationService.getDistrictOrCityName(fixed.lat, fixed.lng);
      if (govEl && !govEl.value.trim()) {
        govEl.value = district.split(' - ')[0] || 'القاهرة';
      }
      if (cityEl && !cityEl.value.trim() && district.includes(' - ')) {
        cityEl.value = district.split(' - ')[1] || '';
      }
      SoundService.playChime('click');
      ToastService.show(`✅ تم استخراج الإحداثيات: ${fixed.lat.toFixed(5)}, ${fixed.lng.toFixed(5)}`, 'success');
    };

    this.container.querySelector('#btn-extract-add-coords')?.addEventListener('click', applySmartAddCoords);
    this.container.querySelector('#add-smart-coords')?.addEventListener('paste', () => {
      setTimeout(applySmartAddCoords, 30);
    });

    this.container.querySelector('#btn-pick-add-coords')?.addEventListener('click', () => {
      if (!this.onPickCoordsOnMapCallback) return;
      syncAddDraftFromDom();
      this.hide();
      ToastService.show('👆 انقر على موقع المحطة على الخريطة لالتقاط إحداثياتها بدقة', 'info', 5000);
      this.onPickCoordsOnMapCallback((lat, lng) => {
        this.addDraft.lat = lat.toFixed(6);
        this.addDraft.lng = lng.toFixed(6);
        const district = LocationService.getDistrictOrCityName(lat, lng);
        if (!this.addDraft.gov.trim()) {
          this.addDraft.gov = district.split(' - ')[0] || 'القاهرة';
        }
        if (!this.addDraft.city.trim() && district.includes(' - ')) {
          this.addDraft.city = district.split(' - ')[1] || '';
        }
        this.isAuthenticated = true;
        this.currentTab = 'add';
        this.container.classList.remove('hidden');
        this.renderDashboard();
        SoundService.playChime('start');
        ToastService.show(`✅ تم التقاط الموقع: ${lat.toFixed(5)}, ${lng.toFixed(5)} (${district})`, 'success');
      });
    });

    const addForm = this.container.querySelector('#add-station-form');
    addForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = ((this.container.querySelector('#add-name') as HTMLInputElement).value || '').trim();
      const rawLat = (this.container.querySelector('#add-lat') as HTMLInputElement).value;
      const rawLng = (this.container.querySelector('#add-lng') as HTMLInputElement).value;
      const gov = ((this.container.querySelector('#add-gov') as HTMLInputElement).value || '').trim();
      const city = ((this.container.querySelector('#add-city') as HTMLInputElement).value || '').trim();
      const address = ((this.container.querySelector('#add-address') as HTMLInputElement).value || '').trim();
      const phone = ((this.container.querySelector('#add-phone') as HTMLInputElement).value || '').trim();
      const hours = ((this.container.querySelector('#add-hours') as HTMLInputElement).value || '').trim();

      let lat = parseCoordinate(rawLat);
      let lng = parseCoordinate(rawLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const pair = extractLatLngPairFromInput(`${rawLat} ${rawLng}`);
        if (pair) {
          lat = pair.lat;
          lng = pair.lng;
        }
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        ToastService.show('يرجى إدخال خط عرض وخط طول صالحين (أو استخدم زر "التقاط الموقع من الخريطة").', 'warning', 4500);
        return;
      }

      const fixed = fixEgyptLatLngSwap(lat, lng, `${gov} ${city} ${address} ${name}`);
      lat = fixed.lat;
      lng = fixed.lng;

      const hasConversion = (this.container.querySelector('#add-serv-conversion') as HTMLInputElement).checked;
      const hasLube = (this.container.querySelector('#add-serv-lube') as HTMLInputElement).checked;
      const hasCanopy = (this.container.querySelector('#add-serv-canopy') as HTMLInputElement).checked;
      const hasCylinder = (this.container.querySelector('#add-serv-cylinder') as HTMLInputElement).checked;
      const hasFast = (this.container.querySelector('#add-serv-fast') as HTMLInputElement).checked;

      const newStation: Station = {
        id: `station-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        stationName: name,
        company: 'كارجاس',
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        governorate: gov || 'القاهرة',
        city,
        address: address || city || gov,
        phone: phone || '19617',
        operatingHours: hours || '24 ساعة',
        services: {
          hasConversionCenter: hasConversion,
          hasLubeCenter: hasLube,
          hasCanopyOil: hasCanopy,
          hasCylinderTesting: hasCylinder,
          hasFastService: hasFast,
        },
      };

      const saved = StationStorage.addStation(newStation);
      this.addDraft = createEmptyAddDraft();
      this.manageSearchQuery = '';
      this.manageGovFilter = 'all';
      this.recentlyAddedId = saved.id;
      SoundService.playChime('start');
      ToastService.show(
        fixed.swapped
          ? `✅ تمت إضافة "${saved.name}" وتثبيت دبوسها على الخريطة والجدول (مع تصحيح Lat/Lng تلقائياً)!`
          : `✅ تمت إضافة محطة "${saved.name}" وظهور دبوسها في الجدول والخريطة (${StationStorage.getStations().length} محطة)!`,
        'success',
        4500
      );
      this.onDataChangedCallback(saved);
      this.currentTab = 'manage';
      this.renderDashboard();
    });

    // Tab 4 Events: Dual Branding (App Logo vs Station Pin Logo)
    // 1. App Logo
    const triggerAppLogoBtn = this.container.querySelector('#btn-trigger-app-logo-upload');
    const appLogoFileInput = this.container.querySelector('#app-logo-file-input') as HTMLInputElement;

    triggerAppLogoBtn?.addEventListener('click', () => appLogoFileInput?.click());
    appLogoFileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          StationStorage.saveAppLogo(dataUrl, { skipSourceSync: true });
          SoundService.playChime('start');
          const res = await StationStorage.saveLogoToSourceCode(dataUrl, 'app');
          if (res.success) {
            ToastService.show('✅ تم تحديث وتثبيت شعار التطبيق في الكود المصدري (src/assets/cargasLogo.ts) بنجاح!', 'success');
          } else {
            ToastService.show('تم تحديث شعار التطبيق بنجاح!', 'success');
          }
          this.onDataChangedCallback();
          this.renderDashboard();
        };
        reader.readAsDataURL(file);
      }
    });

    this.container.querySelector('#btn-save-app-logo-source')?.addEventListener('click', async () => {
      SoundService.playChime('click');
      const current = StationStorage.getAppLogo();
      const res = await StationStorage.saveLogoToSourceCode(current, 'app');
      if (res.success) {
        SoundService.playChime('start');
        ToastService.show('✅ تم تثبيت شعار التطبيق في الكود المصدري (src/assets/cargasLogo.ts) بنجاح!', 'success');
      } else {
        ToastService.show(res.message, 'info');
      }
    });

    this.container.querySelector('#btn-remove-app-logo')?.addEventListener('click', async () => {
      StationStorage.saveAppLogo(null, { skipSourceSync: true });
      SoundService.playChime('turn');
      await StationStorage.saveLogoToSourceCode('', 'app');
      ToastService.show('تمت استعادة شعار التطبيق الافتراضي.', 'info');
      this.onDataChangedCallback();
      this.renderDashboard();
    });

    // 2. Station Pin Logo
    const triggerStationLogoBtn = this.container.querySelector('#btn-trigger-station-logo-upload');
    const stationLogoFileInput = this.container.querySelector('#station-logo-file-input') as HTMLInputElement;

    triggerStationLogoBtn?.addEventListener('click', () => stationLogoFileInput?.click());
    stationLogoFileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          StationStorage.saveStationLogo(dataUrl, { skipSourceSync: true });
          SoundService.playChime('start');
          const res = await StationStorage.saveLogoToSourceCode(dataUrl, 'station');
          if (res.success) {
            ToastService.show('✅ تم تحديث وتثبيت شعار دبابيس المحطات في الكود المصدري بنجاح!', 'success');
          } else {
            ToastService.show('تم تحديث شعار دبابيس المحطات بنجاح!', 'success');
          }
          this.onDataChangedCallback();
          this.renderDashboard();
        };
        reader.readAsDataURL(file);
      }
    });

    this.container.querySelector('#btn-save-station-logo-source')?.addEventListener('click', async () => {
      SoundService.playChime('click');
      const current = StationStorage.getStationLogo();
      const res = await StationStorage.saveLogoToSourceCode(current, 'station');
      if (res.success) {
        SoundService.playChime('start');
        ToastService.show('✅ تم تثبيت شعار دبابيس المحطات في الكود المصدري بنجاح!', 'success');
      } else {
        ToastService.show(res.message, 'info');
      }
    });

    this.container.querySelector('#btn-remove-station-logo')?.addEventListener('click', async () => {
      StationStorage.saveStationLogo(null, { skipSourceSync: true });
      SoundService.playChime('turn');
      await StationStorage.saveLogoToSourceCode('', 'station');
      ToastService.show('تمت استعادة شعار دبابيس المحطات الافتراضي.', 'info');
      this.onDataChangedCallback();
      this.renderDashboard();
    });

    // Tab 5 (Settings) Events: App Name, Password, Icon Visibility & Commit All
    const collectIconsFromDom = (): UserIconsVisibility => {
      const icons = { ...AppConfigService.getConfig().userIcons };
      this.container.querySelectorAll('.cfg-icon-checkbox').forEach((el) => {
        const cb = el as HTMLInputElement;
        const key = cb.dataset.iconKey as keyof UserIconsVisibility | undefined;
        if (key && key in icons) {
          icons[key] = cb.checked;
        }
      });
      return icons;
    };

    const setAllIconCheckboxes = (predicate: (key: keyof UserIconsVisibility) => boolean) => {
      this.container.querySelectorAll('.cfg-icon-checkbox').forEach((el) => {
        const cb = el as HTMLInputElement;
        const key = cb.dataset.iconKey as keyof UserIconsVisibility | undefined;
        if (key) cb.checked = predicate(key);
      });
    };

    this.container.querySelector('#btn-toggle-cfg-pwd')?.addEventListener('click', () => {
      const pwdInput = this.container.querySelector('#cfg-admin-password') as HTMLInputElement | null;
      const btn = this.container.querySelector('#btn-toggle-cfg-pwd');
      if (!pwdInput || !btn) return;
      const showing = pwdInput.type === 'text';
      pwdInput.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '👁️ إظهار' : '🙈 إخفاء';
    });

    this.container.querySelector('#btn-icons-show-all')?.addEventListener('click', () => {
      SoundService.playChime('click');
      setAllIconCheckboxes(() => true);
    });

    this.container.querySelector('#btn-icons-minimal')?.addEventListener('click', () => {
      SoundService.playChime('click');
      const essential = new Set<keyof UserIconsVisibility>([
        'nearestStation',
        'locationBadge',
        'mapSearch',
        'recenterGps',
        'zoomControls',
        'mapLayerToggle',
      ]);
      setAllIconCheckboxes((k) => essential.has(k));
    });

    this.container.querySelector('#btn-icons-hide-all')?.addEventListener('click', () => {
      SoundService.playChime('click');
      setAllIconCheckboxes(() => false);
    });

    const saveSettingsForm = async (alsoCommitAll: boolean) => {
      const appName =
        (this.container.querySelector('#cfg-app-name') as HTMLInputElement)?.value.trim() ||
        DEFAULT_APP_CONFIG.appName;
      const appShortName =
        (this.container.querySelector('#cfg-app-short-name') as HTMLInputElement)?.value.trim() ||
        appName;
      const appSubtitle =
        (this.container.querySelector('#cfg-app-subtitle') as HTMLInputElement)?.value.trim() ?? '';
      const appDescription =
        (this.container.querySelector('#cfg-app-description') as HTMLInputElement)?.value.trim() ||
        DEFAULT_APP_CONFIG.appDescription;
      const adminPassword =
        (this.container.querySelector('#cfg-admin-password') as HTMLInputElement)?.value.trim() || '';

      if (!adminPassword) {
        ToastService.show('يرجى إدخال كلمة مرور صالحة غير فارغة.', 'warning');
        return;
      }

      const userIcons = collectIconsFromDom();
      const saved = AppConfigService.saveConfig(
        {
          appName,
          appShortName,
          appSubtitle,
          appDescription,
          adminPassword,
          mapNightModeDisabled: true,
          userIcons,
        },
        { skipSourceSync: true }
      );

      if (alsoCommitAll) {
        ToastService.show('جارٍ اعتماد كافة التعديلات (المحطات + الشعارات + الإعدادات) لـ Vercel...', 'info', 2500);
        const res = await StationStorage.commitAllEditsToSourceCode();
        if (res.success) {
          SoundService.playChime('start');
          ToastService.show('✅ تم اعتماد وتثبيت كافة التعديلات في الكود المصدري بنجاح! جاهز للرفع على Vercel.', 'success', 5000);
        } else {
          ToastService.show(`تم الحفظ محلياً (${res.message})`, 'info', 4000);
        }
      } else {
        const res = await AppConfigService.saveConfigToSourceCode(saved);
        if (res.success) {
          SoundService.playChime('start');
          ToastService.show('✅ تم حفظ وتثبيت اسم التطبيق وكلمة السر وإعدادات الأيقونات في الكود المصدري بنجاح!', 'success', 4500);
        } else {
          SoundService.playChime('start');
          ToastService.show('تم تطبيق الإعدادات وحفظها محلياً.', 'success');
        }
      }
      this.renderDashboard();
    };

    this.container.querySelector('#app-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveSettingsForm(false);
    });

    this.container.querySelector('#btn-commit-everything-vercel')?.addEventListener('click', async () => {
      await saveSettingsForm(true);
    });

    // Tab 6 Events: Source code, appConfig.ts & Clear default data
    this.container.querySelector('#btn-clear-demo-data')?.addEventListener('click', () => {
      ToastService.confirm({
        title: 'إزالة البيانات الافتراضية',
        message: 'هل أنت متأكد من مسح البيانات الافتراضية؟ سيتم تفريغ الخريطة لتستقبل ملفك الفعلي.',
        isDanger: true,
        confirmText: 'نعم، مسح البيانات',
        onConfirm: () => {
          StationStorage.clearDefaultData();
          SoundService.playChime('turn');
          ToastService.show('تم مسح البيانات الافتراضية بنجاح.', 'info');
          this.onDataChangedCallback();
          this.renderDashboard();
        },
      });
    });

    this.container.querySelector('#btn-restore-demo-data')?.addEventListener('click', () => {
      ToastService.confirm({
        title: 'استعادة المحطات الافتراضية',
        message: 'هل أنت متأكد من استعادة كافة المحطات الافتراضية؟',
        confirmText: 'نعم، استعادة',
        onConfirm: () => {
          StationStorage.restoreDefaultData();
          SoundService.playChime('start');
          ToastService.show('تمت استعادة المحطات الافتراضية بنجاح.', 'success');
          this.onDataChangedCallback();
          this.renderDashboard();
        },
      });
    });

    this.container.querySelector('#btn-copy-ts-code')?.addEventListener('click', () => {
      const tsCode = StationStorage.generateSourceCodeTypeScript();
      navigator.clipboard.writeText(tsCode).then(() => {
        SoundService.playChime('start');
        ToastService.show('تم نسخ كود محطات كارجاس (defaultStations.ts) للحافظة!', 'success');
      });
    });

    this.container.querySelector('#btn-download-ts-file')?.addEventListener('click', () => {
      const tsCode = StationStorage.generateSourceCodeTypeScript();
      const blob = new Blob([tsCode], { type: 'text/typescript;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'defaultStations.ts';
      link.click();
      URL.revokeObjectURL(url);
      SoundService.playChime('start');
      ToastService.show('تم تنزيل ملف defaultStations.ts بنجاح!', 'success');
    });

    // Copy logo code handlers
    const copyLogoAction = () => {
      const logoCode = StationStorage.generateLogoSourceCode();
      navigator.clipboard.writeText(logoCode).then(() => {
        SoundService.playChime('start');
        ToastService.show('تم نسخ كود الشعار المصدري (cargasLogo.ts) للحافظة!', 'success');
      });
    };
    this.container.querySelector('#btn-copy-logo-code')?.addEventListener('click', copyLogoAction);
    this.container.querySelector('#btn-copy-logo-code-tab5')?.addEventListener('click', copyLogoAction);

    // Download logo file handlers
    const downloadLogoAction = () => {
      const logoCode = StationStorage.generateLogoSourceCode();
      const blob = new Blob([logoCode], { type: 'text/typescript;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cargasLogo.ts';
      link.click();
      URL.revokeObjectURL(url);
      SoundService.playChime('start');
      ToastService.show('تم تنزيل ملف cargasLogo.ts بنجاح!', 'success');
    };
    this.container.querySelector('#btn-download-logo-file')?.addEventListener('click', downloadLogoAction);
    this.container.querySelector('#btn-download-logo-file-tab5')?.addEventListener('click', downloadLogoAction);

    this.container.querySelector('#btn-copy-config-code')?.addEventListener('click', () => {
      const cfgCode = AppConfigService.generateConfigSourceCode();
      navigator.clipboard.writeText(cfgCode).then(() => {
        SoundService.playChime('start');
        ToastService.show('تم نسخ ملف إعدادات التطبيق (appConfig.ts) للحافظة!', 'success');
      });
    });

    this.container.querySelector('#btn-download-config-file')?.addEventListener('click', () => {
      const cfgCode = AppConfigService.generateConfigSourceCode();
      const blob = new Blob([cfgCode], { type: 'text/typescript;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'appConfig.ts';
      link.click();
      URL.revokeObjectURL(url);
      SoundService.playChime('start');
      ToastService.show('تم تنزيل ملف appConfig.ts بنجاح!', 'success');
    });
  }

  private async handleExcelFile(file: File, isRemap = false): Promise<void> {
    this.lastUploadedFile = file;
    const result = await ExcelParser.parseStationFile(
      file,
      isRemap ? this.columnMappingOverride : undefined
    );
    this.pendingParsedResult = result;
    if (!result.success) {
      ToastService.show(`تنبيه عند قراءة الملف: ${result.errors[0] || 'تحقق من اختيار الأعمدة بالأسفل'}`, 'warning');
      this.renderDashboard();
      return;
    }

    SoundService.playChime('turn');
    ToastService.show(`تمت قراءة ${result.validRows} محطة بنجاح (${result.diagnostics.uniqueCoordCount} موقع فريد)!`, 'success');
    this.renderDashboard();
  }
}
