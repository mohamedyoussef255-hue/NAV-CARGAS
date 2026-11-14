import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

function loadBakedAppManifestMeta(): { name: string; shortName: string; description: string } {
  const fallback = {
    name: 'محطات كارجاس (الأقرب لك دائماً)',
    shortName: 'كارجاس',
    description:
      'تطبيق الملاحة الذكي لمحطات غاز كارجاس - يعمل أوفلاين بالكامل مع تحديد أقرب محطة وحفظ الخريطة والبيانات.',
  };
  try {
    const cfgPath = path.resolve(process.cwd(), 'src/config/appConfig.ts');
    if (!fs.existsSync(cfgPath)) return fallback;
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const marker = 'export const BAKED_APP_CONFIG: AppConfig = ';
    const startIdx = raw.indexOf(marker);
    if (startIdx === -1) return fallback;
    const jsonStart = startIdx + marker.length;
    const endIdx = raw.lastIndexOf(';');
    if (endIdx <= jsonStart) return fallback;
    const parsed = JSON.parse(raw.slice(jsonStart, endIdx));
    const appName = typeof parsed.appName === 'string' && parsed.appName.trim() ? parsed.appName.trim() : 'محطات كارجاس';
    const appSubtitle = typeof parsed.appSubtitle === 'string' ? parsed.appSubtitle.trim() : '';
    const appShortName =
      typeof parsed.appShortName === 'string' && parsed.appShortName.trim()
        ? parsed.appShortName.trim()
        : appName;
    const appDescription =
      typeof parsed.appDescription === 'string' && parsed.appDescription.trim()
        ? parsed.appDescription.trim()
        : fallback.description;
    return {
      name: appSubtitle ? `${appName} (${appSubtitle})` : appName,
      shortName: appShortName,
      description: appDescription,
    };
  } catch {
    return fallback;
  }
}

const bakedManifestMeta = loadBakedAppManifestMeta();

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ],
      manifest: {
        id: '/',
        name: bakedManifestMeta.name,
        short_name: bakedManifestMeta.shortName,
        description: bakedManifestMeta.description,
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        prefer_related_applications: false,
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cargas-osm-tiles-v1',
              expiration: {
                maxEntries: 20000,
                maxAgeSeconds: 60 * 60 * 24 * 120,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cargas-osm-tiles-v1',
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 60 * 60 * 24 * 120,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/(server|services)\.arcgisonline\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cargas-satellite-tiles-v1',
              expiration: {
                maxEntries: 20000,
                maxAgeSeconds: 60 * 60 * 24 * 120,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
    {
      name: 'cargas-source-persistence',
      configureServer(server) {
        let writeQueue: Promise<void> = Promise.resolve();

        const enqueueWrite = <T>(fn: () => Promise<T> | T): Promise<T> => {
          const next = writeQueue.then(() => fn());
          writeQueue = next.then(
            () => undefined,
            () => undefined
          );
          return next;
        };

        const atomicWriteIfChanged = (targetFile: string, content: string): boolean => {
          try {
            if (fs.existsSync(targetFile)) {
              const existing = fs.readFileSync(targetFile, 'utf-8');
              if (existing === content) return false;
            }
          } catch {
            // proceed with write
          }
          const tmpDir = path.resolve(process.cwd(), 'node_modules/.vite');
          fs.mkdirSync(tmpDir, { recursive: true });
          const tmpFile = path.join(
            tmpDir,
            `.tmp-${path.basename(targetFile)}-${process.pid}-${Date.now()}`
          );
          fs.writeFileSync(tmpFile, content, 'utf-8');
          fs.renameSync(tmpFile, targetFile);
          return true;
        };

        const readJsonBody = (req: import('node:http').IncomingMessage): Promise<any> =>
          new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer | string) => {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk);
            });
            req.on('end', () => {
              try {
                const raw = Buffer.concat(chunks).toString('utf-8');
                resolve(JSON.parse(raw));
              } catch (err) {
                reject(err);
              }
            });
            req.on('error', reject);
          });

        server.middlewares.use((req, res, next) => {
          // POST /api/save-stations: writes atomically to src/data/defaultStations.ts
          if (req.url === '/api/save-stations' && req.method === 'POST') {
            void readJsonBody(req)
              .then((parsed) =>
                enqueueWrite(() => {
                  const stations = parsed?.stations;
                  if (!Array.isArray(stations)) {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(
                      JSON.stringify({ success: false, error: 'يجب إرسال مصفوفة محطات صالحة' })
                    );
                    return;
                  }

                  const targetFile = path.resolve(process.cwd(), 'src/data/defaultStations.ts');
                  const serialized = JSON.stringify(stations, null, 2);

                  // Skip write if exact stations JSON array is already baked on disk
                  try {
                    if (fs.existsSync(targetFile)) {
                      const prev = fs.readFileSync(targetFile, 'utf-8');
                      if (prev.includes(`export const DEFAULT_STATIONS: Station[] = ${serialized};`)) {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                        res.end(
                          JSON.stringify({
                            success: true,
                            count: stations.length,
                            unchanged: true,
                            message: `المحطات (${stations.length}) مثبتة بالفعل في الكود المصدري.`,
                          })
                        );
                        return;
                      }
                    }
                  } catch {
                    // continue
                  }

                  const tsContent = `import { Station } from '../types';\n\n/**\n * قاعدة بيانات محطات كارجاس المثبتة في الكود المصدري\n * إجمالي المحطات: ${stations.length}\n * تاريخ الحفظ والتحديث: ${new Date().toLocaleString('ar-EG')} (${new Date().toISOString()})\n */\nexport const DEFAULT_STATIONS: Station[] = ${serialized};\nexport const DEFAULT_CARGAS_STATIONS = DEFAULT_STATIONS;\n`;

                  atomicWriteIfChanged(targetFile, tsContent);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      success: true,
                      count: stations.length,
                      message: `تم حفظ وتثبيت ${stations.length} محطة كارجاس مباشرة في الكود المصدري (src/data/defaultStations.ts) بنجاح!`,
                    })
                  );
                })
              )
              .catch((err: any) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: false, error: err?.message || 'Error' }));
              });
            return;
          }

          // POST /api/save-logo: writes custom logo atomically to src/assets/cargasLogo.ts
          if (req.url === '/api/save-logo' && req.method === 'POST') {
            void readJsonBody(req)
              .then((parsed) =>
                enqueueWrite(() => {
                  const logoDataUrl = parsed?.logoDataUrl;
                  const logoType = parsed?.type || 'all';

                  if (typeof logoDataUrl !== 'string') {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: false, error: 'بيانات الشعار غير صالحة' }));
                    return;
                  }

                  const targetFile = path.resolve(process.cwd(), 'src/assets/cargasLogo.ts');
                  const existingContent = fs.readFileSync(targetFile, 'utf-8');
                  const fnBoundary = existingContent.indexOf('export function generateLogoSourceCode');
                  let headerPart = fnBoundary !== -1 ? existingContent.slice(0, fnBoundary) : existingContent;
                  const footerPart = fnBoundary !== -1 ? existingContent.slice(fnBoundary) : '';

                  if (logoType === 'app' || logoType === 'all') {
                    const appReplacement = logoDataUrl
                      ? `export const BAKED_APP_LOGO: string = ${JSON.stringify(logoDataUrl)};`
                      : `export const BAKED_APP_LOGO: string = DEFAULT_CARGAS_LOGO_DATA_URL;`;
                    const appPattern = /^export const BAKED_APP_LOGO:\s*string\s*=[^\r\n]*$/m;
                    if (!appPattern.test(headerPart)) {
                      throw new Error('تعذر العثور على تعريف BAKED_APP_LOGO في الملف');
                    }
                    headerPart = headerPart.replace(appPattern, () => appReplacement);
                  }

                  if (logoType === 'station' || logoType === 'all') {
                    const stationReplacement = logoDataUrl
                      ? `export const BAKED_STATION_LOGO: string = ${JSON.stringify(logoDataUrl)};`
                      : `export const BAKED_STATION_LOGO: string = DEFAULT_CARGAS_LOGO_DATA_URL;`;
                    const stationPattern = /^export const BAKED_STATION_LOGO:\s*string\s*=[^\r\n]*$/m;
                    if (!stationPattern.test(headerPart)) {
                      throw new Error('تعذر العثور على تعريف BAKED_STATION_LOGO في الملف');
                    }
                    headerPart = headerPart.replace(stationPattern, () => stationReplacement);
                  }

                  const nextContent = headerPart + footerPart;
                  const changed = atomicWriteIfChanged(targetFile, nextContent);

                  const typeLabel =
                    logoType === 'app'
                      ? 'شعار التطبيق'
                      : logoType === 'station'
                        ? 'شعار دبابيس المحطات'
                        : 'الشعار';
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      success: true,
                      unchanged: !changed,
                      message: `تم حفظ وتثبيت ${typeLabel} مباشرة في الكود المصدري (src/assets/cargasLogo.ts) بنجاح!`,
                    })
                  );
                })
              )
              .catch((err: any) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: false, error: err?.message || 'Error' }));
              });
            return;
          }

          // POST /api/save-config: writes app name, admin password, and icon visibility into src/config/appConfig.ts & index.html
          if (req.url === '/api/save-config' && req.method === 'POST') {
            void readJsonBody(req)
              .then((parsed) =>
                enqueueWrite(() => {
                  const cfg = parsed?.config;
                  if (!cfg || typeof cfg !== 'object') {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify({ success: false, error: 'بيانات الإعدادات غير صالحة' }));
                    return;
                  }

                  const icons = cfg.userIcons || {};
                  const normalized = {
                    appName:
                      typeof cfg.appName === 'string' && cfg.appName.trim()
                        ? cfg.appName.trim()
                        : 'محطات كارجاس',
                    appShortName:
                      typeof cfg.appShortName === 'string' && cfg.appShortName.trim()
                        ? cfg.appShortName.trim()
                        : 'كارجاس',
                    appSubtitle:
                      typeof cfg.appSubtitle === 'string' ? cfg.appSubtitle.trim() : 'الأقرب لك دائماً',
                    appDescription:
                      typeof cfg.appDescription === 'string' && cfg.appDescription.trim()
                        ? cfg.appDescription.trim()
                        : 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
                    splashAppTitle:
                      typeof cfg.splashAppTitle === 'string' ? cfg.splashAppTitle.trim() : 'محطات كارجاس',
                    splashAppMessage:
                      typeof cfg.splashAppMessage === 'string' ? cfg.splashAppMessage.trim() : 'الأقرب لك دائماً',
                    splashAppLoadingText:
                      typeof cfg.splashAppLoadingText === 'string'
                        ? cfg.splashAppLoadingText.trim()
                        : 'جارٍ تهيئة الخريطة وقاعدة المحطات...',
                    splashStationTitle:
                      typeof cfg.splashStationTitle === 'string'
                        ? cfg.splashStationTitle.trim()
                        : 'محطات غاز كارجاس',
                    splashStationMessage:
                      typeof cfg.splashStationMessage === 'string'
                        ? cfg.splashStationMessage.trim()
                        : 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
                    splashStationLoadingText:
                      typeof cfg.splashStationLoadingText === 'string'
                        ? cfg.splashStationLoadingText.trim()
                        : 'جارٍ تحميل محطات كارجاس على الخريطة...',
                    adminPassword:
                      typeof cfg.adminPassword === 'string' && cfg.adminPassword.trim()
                        ? cfg.adminPassword.trim()
                        : '0000',
                    mapNightModeDisabled: true,
                    userIcons: {
                      nearestStation: icons.nearestStation ?? true,
                      offlineMap: icons.offlineMap ?? true,
                      installPwa: icons.installPwa ?? true,
                      stationsList: icons.stationsList ?? true,
                      themeToggle: icons.themeToggle ?? true,
                      networkBadge: icons.networkBadge ?? true,
                      locationBadge: icons.locationBadge ?? true,
                      mapSearch: icons.mapSearch ?? true,
                      recenterGps: icons.recenterGps ?? true,
                      zoomControls: icons.zoomControls ?? true,
                      fitAllStations: icons.fitAllStations ?? true,
                      quickList: icons.quickList ?? true,
                      mapLayerToggle: icons.mapLayerToggle ?? true,
                    },
                  };

                  const configFile = path.resolve(process.cwd(), 'src/config/appConfig.ts');
                  const tsContent = `export interface UserIconsVisibility {
  nearestStation: boolean;
  offlineMap: boolean;
  installPwa: boolean;
  stationsList: boolean;
  themeToggle: boolean;
  networkBadge: boolean;
  locationBadge: boolean;
  mapSearch: boolean;
  recenterGps: boolean;
  zoomControls: boolean;
  fitAllStations: boolean;
  quickList: boolean;
  mapLayerToggle: boolean;
}

export interface AppConfig {
  appName: string;
  appShortName: string;
  appSubtitle: string;
  appDescription: string;
  splashAppTitle: string;
  splashAppMessage: string;
  splashAppLoadingText: string;
  splashStationTitle: string;
  splashStationMessage: string;
  splashStationLoadingText: string;
  adminPassword: string;
  mapNightModeDisabled: boolean;
  userIcons: UserIconsVisibility;
}

export const DEFAULT_USER_ICONS: UserIconsVisibility = {
  nearestStation: true,
  offlineMap: true,
  installPwa: true,
  stationsList: true,
  themeToggle: true,
  networkBadge: true,
  locationBadge: true,
  mapSearch: true,
  recenterGps: true,
  zoomControls: true,
  fitAllStations: true,
  quickList: true,
  mapLayerToggle: true,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  appName: 'محطات كارجاس',
  appShortName: 'كارجاس',
  appSubtitle: 'الأقرب لك دائماً',
  appDescription: 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
  splashAppTitle: 'محطات كارجاس',
  splashAppMessage: 'الأقرب لك دائماً',
  splashAppLoadingText: 'جارٍ تهيئة الخريطة وقاعدة المحطات...',
  splashStationTitle: 'محطات غاز كارجاس',
  splashStationMessage: 'الشبكة القومية لمحطات تموين الغاز الطبيعي • جاهز للعمل أوفلاين',
  splashStationLoadingText: 'جارٍ تحميل محطات كارجاس على الخريطة...',
  adminPassword: '0000',
  mapNightModeDisabled: true,
  userIcons: { ...DEFAULT_USER_ICONS },
};

/**
 * الإعدادات المعتمدة والمثبتة في الكود المصدري (تُقرأ مباشرة في Vercel و APK)
 */
export const BAKED_APP_CONFIG: AppConfig = ${JSON.stringify(normalized, null, 2)};
`;

                  const configChanged = atomicWriteIfChanged(configFile, tsContent);

                  // Sync title and meta tags in index.html cleanly
                  const indexPath = path.resolve(process.cwd(), 'index.html');
                  let htmlChanged = false;
                  if (fs.existsSync(indexPath)) {
                    const escapeAttr = (v: string) =>
                      v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const fullTitle = normalized.appSubtitle
                      ? `${normalized.appName} (${normalized.appSubtitle})`
                      : normalized.appName;
                    let html = fs.readFileSync(indexPath, 'utf-8');
                    html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeAttr(fullTitle)}</title>`);
                    html = html.replace(
                      /<meta name="apple-mobile-web-app-title" content="[^"]*"\s*\/?>/,
                      () => `<meta name="apple-mobile-web-app-title" content="${escapeAttr(normalized.appShortName)}" />`
                    );
                    html = html.replace(
                      /<meta property="og:title" content="[^"]*"\s*\/?>/,
                      () => `<meta property="og:title" content="${escapeAttr(fullTitle)}" />`
                    );
                    html = html.replace(
                      /<meta name="description" content="[^"]*"\s*\/?>/,
                      () => `<meta name="description" content="${escapeAttr(normalized.appDescription)}" />`
                    );
                    html = html.replace(
                      /<meta property="og:description" content="[^"]*"\s*\/?>/,
                      () => `<meta property="og:description" content="${escapeAttr(normalized.appDescription)}" />`
                    );
                    htmlChanged = atomicWriteIfChanged(indexPath, html);
                  }

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(
                    JSON.stringify({
                      success: true,
                      unchanged: !configChanged && !htmlChanged,
                      message: 'تم اعتماد وتثبيت إعدادات التطبيق وكلمة المرور والأيقونات في الكود المصدري بنجاح!',
                    })
                  );
                })
              )
              .catch((err: any) => {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: false, error: err?.message || 'Error' }));
              });
            return;
          }

          next();
        });
      },
    },
  ],
});
