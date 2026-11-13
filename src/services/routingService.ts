import { RouteData, RouteStep } from '../types';

export class RoutingService {
  private static OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

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

  // Fetches live driving route from OSRM free routing service
  static async getRoute(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ): Promise<RouteData> {
    const url = `${this.OSRM_URL}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return this.createFallbackRoute(startLat, startLng, endLat, endLng);
    }

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

        return {
          coordinates,
          distanceKm,
          durationMin,
          steps,
          summary: `المسافة ${distanceKm} كم • الزمن التقديري ${durationMin} دقيقة`,
        };
      }
    } catch (e: any) {
      console.warn('OSRM online routing failed or timed out. Falling back to internal trajectory generator.', e);
    }

    // High quality offline fallback trajectory (interpolates realistic road points)
    return this.createFallbackRoute(startLat, startLng, endLat, endLng);
  }

  // Fallback trajectory if internet is blocked or OSRM is slow
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
      // Add slight organic curvature to simulate real roads
      const curve = Math.sin(t * Math.PI) * 0.003;
      const lat = startLat + (endLat - startLat) * t + curve * 0.5;
      const lng = startLng + (endLng - startLng) * t - curve * 0.5;
      coordinates.push([lat, lng]);
    }

    // Straight distance * 1.3 to approximate driving road distance
    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    const directKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
    const distanceKm = parseFloat((directKm * 1.25).toFixed(1));
    const durationMin = Math.max(2, Math.round((distanceKm / 35) * 60));

    return {
      coordinates,
      distanceKm,
      durationMin,
      steps: [
        {
          instruction: 'تحرك باتجاه المحطة عبر أقصر طريق معبد',
          distance: Math.round((distanceKm * 1000) / 2),
          duration: Math.round((durationMin * 60) / 2),
        },
        {
          instruction: 'تابع المسار باتجاه وجهة كارجاس',
          distance: Math.round((distanceKm * 1000) / 2),
          duration: Math.round((durationMin * 60) / 2),
        },
        {
          instruction: 'ستصل إلى محطة الغاز قريباً',
          distance: 50,
          duration: 10,
        },
      ],
      summary: `مسار مباشر تقديري: ${distanceKm} كم • حوالي ${durationMin} دقيقة`,
    };
  }
}
