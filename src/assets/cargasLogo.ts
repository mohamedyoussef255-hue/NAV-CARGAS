// ============================================================
// الشعار الرسمي وأيقونات الخدمات - محطات كارجاس (الأقرب لك دائماً)
// يدعم تخصيص شعار للتطبيق وشعار آخر لمحطات الغاز على الخريطة
// ============================================================

export const DEFAULT_CARGAS_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="cargasGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E676" />
      <stop offset="50%" stop-color="#00A859" />
      <stop offset="100%" stop-color="#00693E" />
    </linearGradient>
    <linearGradient id="cargasBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00B0FF" />
      <stop offset="100%" stop-color="#0072CE" />
    </linearGradient>
    <linearGradient id="goldFlame" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFD600" />
      <stop offset="100%" stop-color="#FF9100" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- Circular Outer Shield -->
  <circle cx="100" cy="100" r="92" fill="#0D2C54" stroke="url(#cargasGreenGrad)" stroke-width="7" filter="url(#shadow)" />
  <circle cx="100" cy="100" r="82" fill="#0A192F" stroke="rgba(255,255,255,0.12)" stroke-width="2" />

  <!-- Eco-Green Gas & Oil Swirls -->
  <path d="M52 110 C52 75 75 48 100 48 C125 48 148 75 148 110 C148 136 126 156 100 156 C74 156 52 136 52 110 Z" fill="url(#cargasGreenGrad)" />
  
  <!-- Inner Clean Gas Drop (Blue / Cyan) -->
  <path d="M72 112 C72 88 88 68 100 58 C112 68 128 88 128 112 C128 128 116 142 100 142 C84 142 72 128 72 112 Z" fill="url(#cargasBlueGrad)" />

  <!-- Natural Gas Clean Energy Flame -->
  <path d="M92 118 C92 102 98 90 100 84 C102 90 108 102 108 118 C108 126 104 132 100 132 C96 132 92 126 92 118 Z" fill="url(#goldFlame)" />

  <!-- Arabic Typography CARGAS / كارجاس -->
  <text x="100" y="174" font-family="'Cairo', sans-serif" font-size="16" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">كارجاس</text>
  <text x="100" y="34" font-family="'Cairo', sans-serif" font-size="11" font-weight="800" fill="#00E676" text-anchor="middle" letter-spacing="2">CARGAS</text>
</svg>
`;

export const DEFAULT_CARGAS_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_CARGAS_LOGO_SVG.trim())}`;

// أيقونة 1: أقرب محطة كارجاس (Gas Dispenser Pump)
export const ICON_CARGAS_STATION_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h6c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18"/>
  <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>
  <path d="M3 22h12"/>
  <path d="M7 10h4"/>
  <circle cx="9" cy="6" r="1.5" fill="currentColor"/>
</svg>
`;

// أيقونة 2: مركز التحويل والصيانة (Gear + Wrench)
export const ICON_CONVERSION_CENTER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  <circle cx="18" cy="18" r="3"/>
  <path d="m16 16 4 4"/>
</svg>
`;

// أيقونة 3: مركز الزيوت المتخصص (Oil Can / Drop)
export const ICON_LUBE_CENTER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
  <path d="M12 9v4"/>
  <path d="M10 11h4"/>
</svg>
`;

// أيقونة 4: مركز فحص واختبار الأسطوانات (CNG Cylinder / Pressure Shield)
export const ICON_CYLINDER_TESTING_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="7" y="5" width="10" height="15" rx="4" />
  <path d="M10 2h4v3h-4z" />
  <path d="m9 13 2 2 4-4" />
</svg>
`;

// أيقونة 5: زيوت أسفل المظلة (Canopy / Shelter)
export const ICON_CANOPY_OIL_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 10h20"/>
  <path d="M4 10l2-6h12l2 6"/>
  <path d="M6 10v10"/>
  <path d="M18 10v10"/>
  <circle cx="12" cy="15" r="2.5" fill="currentColor"/>
</svg>
`;

// 1. شعار التطبيق المثبت في الكود المصدري (Header / App Branding)
export const BAKED_APP_LOGO: string = DEFAULT_CARGAS_LOGO_DATA_URL;

// 2. شعار دبابيس المحطات المثبت في الكود المصدري (Map Pins / Station Badges)
export const BAKED_STATION_LOGO: string = DEFAULT_CARGAS_LOGO_DATA_URL;

// للتوافق مع الإصدارات السابقة
export const BAKED_SOURCE_LOGO: string = BAKED_APP_LOGO;

// دالة لتوليد كود cargasLogo.ts يحتوي على كلا الشعارين
export function generateLogoSourceCode(appLogo?: string, stationLogo?: string): string {
  const chosenAppLogo = appLogo || DEFAULT_CARGAS_LOGO_DATA_URL;
  const chosenStationLogo = stationLogo || chosenAppLogo;

  return `// ============================================================
// الشعار المثبت في الكود المصدري - محطات كارجاس (الأقرب لك دائماً)
// تم الحفظ والتصدير بتاريخ: ${new Date().toLocaleString('ar-EG')}
// ============================================================

export const DEFAULT_CARGAS_LOGO_SVG = \`${DEFAULT_CARGAS_LOGO_SVG.trim()}\`;
export const DEFAULT_CARGAS_LOGO_DATA_URL = \`${DEFAULT_CARGAS_LOGO_DATA_URL}\`;

// أيقونات الخدمات
export const ICON_CARGAS_STATION_SVG = \`${ICON_CARGAS_STATION_SVG.trim()}\`;
export const ICON_CONVERSION_CENTER_SVG = \`${ICON_CONVERSION_CENTER_SVG.trim()}\`;
export const ICON_LUBE_CENTER_SVG = \`${ICON_LUBE_CENTER_SVG.trim()}\`;
export const ICON_CYLINDER_TESTING_SVG = \`${ICON_CYLINDER_TESTING_SVG.trim()}\`;
export const ICON_CANOPY_OIL_SVG = \`${ICON_CANOPY_OIL_SVG.trim()}\`;

// 1. شعار التطبيق المخصص (الهيدر وواجهة البرنامج)
export const BAKED_APP_LOGO: string = ${JSON.stringify(chosenAppLogo)};

// 2. شعار المحطات المخصص (دبابيس الخريطة وبطاقات المحطات)
export const BAKED_STATION_LOGO: string = ${JSON.stringify(chosenStationLogo)};

export const BAKED_SOURCE_LOGO: string = BAKED_APP_LOGO;

export function generateLogoSourceCode(appLogo?: string, stationLogo?: string): string {
  return '';
}
`;
}
