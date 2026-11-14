import { RouteData, RouteStep } from '../types';
import { LocationService } from './locationService';
import { StationDb } from './stationDb';

const ROUTE_CACHE_META_KEY = 'offline_routes_cache_v1';
const ROUTE_CACHE_MAX_ENTRIES = 40;

interface CachedRouteEntry {
  key: string;
  route: RouteData;
  cachedAt: number;
}

export class RoutingService {
  private static OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

  private static makeRouteCacheKey(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ): string {
    // Round start to ~300m grid so cached routes still match nearby GPS jitter offline
    return `${startLat.toFixed(3)},${startLng.toFixed(3)}->${endLat.toFixed(4)},${endLng.toFixed(4)}`;
  }

  private static async getCachedRoute(key: string): Promise<RouteData | null> {
    try {
      const entries = await StationDb.getMeta<CachedRouteEntry[]>(ROUTE_CACHE_META_KEY);
      if (!Array.isArray(entries)) return null;
      const found = entries.find((e) => e.key === key);
      return found?.route ?? null;
    } catch {
      return null;
    }
  }

  private static async saveCachedRoute(key: string, route: RouteData): Promise<void> {
    try {
      const existing = (await StationDb.getMeta<CachedRouteEntry[]>(ROUTE_CACHE_META_KEY)) || [];
      const filtered = existing.filter((e) => e.key !== key);
      filtered.unshift({ key, route, cachedAt: Date.now() });
      await StationDb.setMeta(ROUTE_CACHE_META_KEY, filtered.slice(0, ROUTE_CACHE_MAX_ENTRIES));
    } catch {
      // ignore route cache write failure
    }
  }

  // Translates OSRM maneuver types and modifiers to clear Arabic guidance
  private static translateManeuverToArabic(maneuver: any, roadName: string): string {
    const type = maneuver?.type || 'turn';
    const modifier = maneuver?.modifier || '';
    const street = roadName && roadName.trim() !== '' ? ` إلى ${roadName}` : '';

    if (type === 'depart') {
      return `انطلق باتجاه ${roadName || 'المسار المحدد'}`;
    }
    if (type === 'arrive') {
      return 'لقد وصلت إلى محطة الغاز على وجهتك';
    }
    if (type === 'roundabout' || type === 'rotary') {
      const exit = maneuver.exit ? `المخرج رقم ${maneuver.exit}` : 'المخرج المناسب';
      return `ادخل الميدان واسلك ${exit}${street}`;
    }

    switch (modifier) {
      case 'sharp right':
        return `انعطف يميناً حاداً${street}`;
      case 'right':
        return `انعطف يميناً${street}`;
      case 'slight right':
        return `انحرف قليلاً إلى اليمين${street}`;
      case 'sharp left':
        return `انعطف يساراً حاداً${street}`;
      case 'left':
        return `انعطف يساراً${street}`;
      case 'slight left':
        return `انحرف قليلاً إلى اليسار${street}`;
      case 'straight':
        return `تابع للأمام مباشرة في ${roadName || 'نفس الشارع'}`;
      case 'uturn':
        return `قم بالدوران للخلف (U-Turn)${street}`;
      default:
        return `تابع السير${street}`;
    }
  }

  // Fetches live driving route from OSRM when online, with IndexedDB route cache + Haversine offline fallback
  static async getRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ): Promise<RouteData> {
    const cacheKey = this.makeRouteCacheKey(startLat, startLng, endLat, endLng);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await this.getCachedRoute(cacheKey);
      if (cached) return cached;
      return this.createFallbackRoute(startLat, startLng, endLat, endLng);
    }

    const url = `${this.OSRM_URL}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sec timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM coordinates are [lng, lat], convert to Leaflet [lat, lng]
        const rawCoords: [number, number][] = route.geometry.coordinates;
        const coordinates: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);

        const distanceMeters = route.distance;
        const durationSec = route.duration;
        const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
        const durationMin = Math.max(1, Math.round(durationSec / 60));

        // Parse turn-by-turn steps
        const steps: RouteStep[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((st: any) => {
            const instruction = this.translateManeuverToArabic(st.maneuver, st.name);
            steps.push({
              instruction,
              distance: Math.round(st.distance),
              duration: Math.round(st.duration),
              name: st.name || '',
            });
          });
        }

        const result: RouteData = {
          coordinates,
          distanceKm,
          durationMin,
          steps,
          summary: `المسافة ${distanceKm} كم • الزمن التقديري ${durationMin} دقيقة`,
        };
        void this.saveCachedRoute(cacheKey, result);
        return result;
      }
    } catch (e: any) {
      console.warn('OSRM online routing unavailable. Checking offline cache & Haversine fallback.', e);
    }

    const cached = await this.getCachedRoute(cacheKey);
    if (cached) return cached;

    // High quality offline fallback trajectory using accurate Haversine distance
    return this.createFallbackRoute(startLat, startLng, endLat, endLng);
  }

  // Offline Haversine trajectory when no internet or cached route exists
  private static createFallbackRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ): RouteData {
    const pointsCount = 12;
    const coordinates: [number, number][] = [];

    for (let i = 0; i <= pointsCount; i++) {
      const t = i / pointsCount;
      const curve = Math.sin(t * Math.PI) * 0.0025;
      const lat = startLat + (endLat - startLat) * t + curve * 0.5;
      const lng = startLng + (endLng - startLng) * t - curve * 0.5;
      coordinates.push([lat, lng]);
    }

    const directKm = LocationService.getDistanceKm(startLat, startLng, endLat, endLng);
    const distanceKm = parseFloat(Math.max(0.1, directKm * 1.25).toFixed(2));
    const durationMin = Math.max(2, Math.round((distanceKm / 35) * 60));

    return {
      coordinates,
      distanceKm,
      durationMin,
      steps: [
        {
          instruction: 'تحرك باتجاه المحطة عبر أقصر مسار متاح (وضع أوفلاين)',
          distance: Math.round((distanceKm * 1000) / 2),
          duration: Math.round((durationMin * 60) / 2),
        },
        {
          instruction: 'تابع المسار باتجاه محطة كارجاس',
          distance: Math.round((distanceKm * 1000) / 2),
          duration: Math.round((durationMin * 60) / 2),
        },
        {
          instruction: 'ستصل إلى محطة الغاز قريباً',
          distance: 50,
          duration: 10,
        },
      ],
      summary: `مسار أوفلاين تقديري (Haversine): ${distanceKm} كم • حوالي ${durationMin} دقيقة`,
    };
  }
}
