import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

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
        name: 'محطات كارجاس (الأقرب لك دائماً)',
        short_name: 'كارجاس',
        description:
          'تطبيق الملاحة الذكي لمحطات غاز كارجاس - يعمل أوفلاين بالكامل مع تحديد أقرب محطة وحفظ الخريطة والبيانات.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
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
          {
            urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tailwind-cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
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

          next();
        });
      },
    },
  ],
});
