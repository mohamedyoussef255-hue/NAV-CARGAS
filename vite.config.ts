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
        server.middlewares.use((req, res, next) => {
          // POST /api/save-stations: writes directly to src/data/defaultStations.ts
          if (req.url === '/api/save-stations' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const stations = parsed.stations;
                if (!Array.isArray(stations)) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ success: false, error: 'يجب إرسال مصفوفة محطات صالحة' }));
                  return;
                }

                // Format as clean TypeScript code for src/data/defaultStations.ts
                const tsContent = `import { Station } from '../types';\n\n/**\n * قاعدة بيانات محطات كارجاس المثبتة في الكود المصدري\n * إجمالي المحطات: ${stations.length}\n * تاريخ الحفظ والتحديث: ${new Date().toLocaleString('ar-EG')} (${new Date().toISOString()})\n */\nexport const DEFAULT_STATIONS: Station[] = ${JSON.stringify(stations, null, 2)};\nexport const DEFAULT_CARGAS_STATIONS = DEFAULT_STATIONS;\n`;

                const targetFile = path.resolve(process.cwd(), 'src/data/defaultStations.ts');
                fs.writeFileSync(targetFile, tsContent, 'utf-8');

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({
                  success: true,
                  count: stations.length,
                  message: `تم حفظ وتثبيت ${stations.length} محطة كارجاس مباشرة في الكود المصدري (src/data/defaultStations.ts) بنجاح!`,
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          // POST /api/save-logo: writes custom logo to src/assets/cargasLogo.ts
          if (req.url === '/api/save-logo' && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const logoDataUrl = parsed.logoDataUrl;
                const logoType = parsed.type || 'all'; // 'app' | 'station' | 'all'

                if (typeof logoDataUrl !== 'string') {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ success: false, error: 'بيانات الشعار غير صالحة' }));
                  return;
                }

                const targetFile = path.resolve(process.cwd(), 'src/assets/cargasLogo.ts');
                let existingContent = fs.readFileSync(targetFile, 'utf-8');

                if (logoType === 'app' || logoType === 'all') {
                  const appReplacement = logoDataUrl
                    ? `export const BAKED_APP_LOGO: string = ${JSON.stringify(logoDataUrl)};`
                    : `export const BAKED_APP_LOGO: string = DEFAULT_CARGAS_LOGO_DATA_URL;`;
                  existingContent = existingContent.replace(
                    /export const BAKED_APP_LOGO:\s*string\s*=\s*[\s\S]*?;/,
                    () => appReplacement
                  );
                }

                if (logoType === 'station' || logoType === 'all') {
                  const stationReplacement = logoDataUrl
                    ? `export const BAKED_STATION_LOGO: string = ${JSON.stringify(logoDataUrl)};`
                    : `export const BAKED_STATION_LOGO: string = DEFAULT_CARGAS_LOGO_DATA_URL;`;
                  existingContent = existingContent.replace(
                    /export const BAKED_STATION_LOGO:\s*string\s*=\s*[\s\S]*?;/,
                    () => stationReplacement
                  );
                }

                fs.writeFileSync(targetFile, existingContent, 'utf-8');

                const typeLabel = logoType === 'app' ? 'شعار التطبيق' : logoType === 'station' ? 'شعار دبابيس المحطات' : 'الشعار';
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({
                  success: true,
                  message: `تم حفظ وتثبيت ${typeLabel} مباشرة في الكود المصدري (src/assets/cargasLogo.ts) بنجاح!`,
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          next();
        });
      },
    },
  ],
});
