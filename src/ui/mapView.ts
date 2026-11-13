import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Station, UserLocation, RouteData, ThemeMode } from '../types';
import { DEFAULT_CARGAS_LOGO_DATA_URL } from '../assets/cargasLogo';
import { StationStorage } from '../services/stationStorage';
import { LocationService } from '../services/locationService';
import { OSM_TILE_CACHE_NAME, tile2lat, tile2lng } from '../services/offlineMapService';
import { escapeHtml } from '../utils/html';

class OfflineCoordinateGridLayer extends L.GridLayer {
  private mapStyle: 'streets' | 'dark' = 'streets';

  setMapStyle(style: 'streets' | 'dark'): void {
    this.mapStyle = style;
    this.redraw();
  }

  override createTile(coords: L.Coords): HTMLElement {
    const tile = document.createElement('canvas');
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const ctx = tile.getContext('2d');
    if (!ctx) return tile;

    const isDark = this.mapStyle === 'dark';
    ctx.fillStyle = isDark ? '#111827' : '#e5e7eb';
    ctx.fillRect(0, 0, size.x, size.y);

    // Subtle sub-grid lines every 64px
    ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.06)';
    ctx.lineWidth = 1;
    for (let pos = 0; pos <= size.x; pos += 64) {
      ctx.beginPath();
      ctx.moveTo(pos + 0.5, 0);
      ctx.lineTo(pos + 0.5, size.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos + 0.5);
      ctx.lineTo(size.x, pos + 0.5);
      ctx.stroke();
    }

    // Tile boundary graticule line
    ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(5, 150, 105, 0.14)';
    ctx.strokeRect(0.5, 0.5, size.x - 1, size.y - 1);

    // Coordinate label for the tile corner (only visible when street tiles are unavailable/offline)
    const lat = tile2lat(coords.y, coords.z).toFixed(3);
    const lng = tile2lng(coords.x, coords.z).toFixed(3);

    ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(71, 85, 105, 0.5)';
    ctx.font = '600 10px monospace';
    ctx.fillText(`${lat}°, ${lng}°`, 8, 16);

    ctx.fillStyle = isDark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(5, 150, 105, 0.35)';
    ctx.font = '700 10px Cairo, sans-serif';
    ctx.fillText(`Z${coords.z} • خريطة إحداثيات`, 8, size.y - 10);

    return tile;
  }
}

export class MapView {
  private map: L.Map | null = null;
  private offlineGridLayer: OfflineCoordinateGridLayer | null = null;
  private tileLayer: L.TileLayer | null = null;
  private userMarker: L.Marker | null = null;
  private userAccuracyCircle: L.Circle | null = null;
  private stationMarkers: Map<string, L.Marker> = new Map();
  private routeLayers: L.Polyline[] = [];
  private routeSvgRenderer: L.SVG | null = null;
  private onStationSelectCallback: ((station: Station) => void) | null = null;
  private onUserLocationDragCallback: ((lat: number, lng: number) => void) | null = null;
  private pickLocationHandler: ((e: L.LeafletMouseEvent) => void) | null = null;
  private containerId: string;
  private currentTheme: ThemeMode = 'dark';
  private currentTileStyle: 'streets' | 'dark' = 'streets'; // Default to detailed streets!
  private stationLogo: string | null = null;
  private stationsCache: Station[] = [];
  private lastSelectedStationId?: string;
  private lastRenderStats = { total: 0, rendered: 0, skipped: 0 };

  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler = () => this.invalidateSize();

  constructor(containerId: string) {
    this.containerId = containerId;
    this.stationLogo = StationStorage.getStationLogo();
  }

  init(centerLat = 30.0444, centerLng = 31.2357, zoom = 12): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Initialize Leaflet map
    this.map = L.map(this.containerId, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
    });

    // Custom attribution
    L.control
      .attribution({
        position: 'bottomleft',
        prefix: '<span>© خرائط الشوارع المفتوحة OSM & OSRM</span>',
      })
      .addTo(this.map);

    // Add permanent offline coordinate canvas grid layer beneath street tiles
    this.offlineGridLayer = new OfflineCoordinateGridLayer({
      zIndex: 1,
      maxZoom: 19,
    });
    this.offlineGridLayer.setMapStyle(this.currentTileStyle);
    this.offlineGridLayer.addTo(this.map);

    // Apply the street tiles immediately
    this.updateTileLayer();

    // Ensure Leaflet recalculates viewport cleanly after zoom/layout transitions
    this.map.on('zoomend', () => {
      this.map?.invalidateSize({ animate: false });
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.invalidateSize());
      this.resizeObserver.observe(container);
    }

    // Invalidate size to guarantee tiles render properly even if layout was deferred
    this.invalidateSize();
    setTimeout(() => this.invalidateSize(), 100);
    setTimeout(() => this.invalidateSize(), 350);
    setTimeout(() => this.invalidateSize(), 900);

    window.addEventListener('resize', this.resizeHandler);
  }

  invalidateSize(): void {
    if (this.map) {
      this.map.invalidateSize({ animate: false });
    }
  }

  setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;
    // Street map night mode is permanently disabled: keep street tiles in daylight mode
    this.currentTileStyle = 'streets';
    this.offlineGridLayer?.setMapStyle('streets');
  }

  toggleTileStyle(): 'streets' | 'dark' {
    this.currentTileStyle = 'streets';
    this.updateTileLayer();
    return this.currentTileStyle;
  }

  getTileStyle(): 'streets' | 'dark' {
    return 'streets';
  }

  setStationLogo(logo: string | null): void {
    this.stationLogo = logo;
    if (this.stationsCache.length > 0) {
      this.renderStations(this.stationsCache, this.lastSelectedStationId);
    }
  }

  // Alias for backward compatibility
  setCustomLogo(logo: string | null): void {
    this.setStationLogo(logo);
  }

  onUserLocationDrag(callback: (lat: number, lng: number) => void): void {
    this.onUserLocationDragCallback = callback;
  }

  enablePickLocationOnMap(callback: (lat: number, lng: number) => void): void {
    if (!this.map) return;
    this.cancelPickLocationOnMap();

    const container = document.getElementById(this.containerId);
    container?.classList.add('picking-location');

    this.pickLocationHandler = (e: L.LeafletMouseEvent) => {
      this.cancelPickLocationOnMap();
      callback(e.latlng.lat, e.latlng.lng);
    };
    this.map.once('click', this.pickLocationHandler);
  }

  cancelPickLocationOnMap(): void {
    const container = document.getElementById(this.containerId);
    container?.classList.remove('picking-location');
    if (this.map && this.pickLocationHandler) {
      this.map.off('click', this.pickLocationHandler);
      this.pickLocationHandler = null;
    }
  }

  private updateTileLayer(): void {
    if (!this.map) return;

    this.currentTileStyle = 'streets';
    this.offlineGridLayer?.setMapStyle('streets');

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    // Do NOT set crossOrigin: 'anonymous' on tile <img> tags:
    // opaque Service Worker cached tiles (status 0) and APK/WebView tile requests
    // fail CORS validation if crossOrigin is forced, causing blank tiles until zoom.
    this.tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      zIndex: 2,
      keepBuffer: 4,
      updateWhenIdle: false,
      attribution: '© OpenStreetMap contributors',
    });

    // Reset opacity when tile actually loads (prevents stale opacity:0 on reused tile nodes)
    this.tileLayer.on('tileload', (loadEvent: L.TileEvent) => {
      const tileImg = loadEvent.tile as HTMLImageElement | undefined;
      if (tileImg) {
        tileImg.style.opacity = '1';
      }
    });

    // Offline & mirror fallback: check Cache API directly, then Carto mirror if online,
    // and only hide broken icon so OfflineCoordinateGridLayer shows cleanly underneath.
    this.tileLayer.on('tileerror', async (errEvent: L.TileErrorEvent) => {
      const tileImg = errEvent.tile as HTMLImageElement | undefined;
      if (!tileImg) return;
      const originalSrc = tileImg.dataset.originalSrc || tileImg.src;
      tileImg.dataset.originalSrc = originalSrc;

      if (tileImg.dataset.cacheChecked !== '1' && typeof caches !== 'undefined' && originalSrc) {
        tileImg.dataset.cacheChecked = '1';
        try {
          const cache = await caches.open(OSM_TILE_CACHE_NAME);
          const cached = await cache.match(originalSrc);
          if (cached && cached.type !== 'opaque') {
            const blob = await cached.blob();
            if (blob.size > 0) {
              const objUrl = URL.createObjectURL(blob);
              tileImg.onload = () => {
                tileImg.style.opacity = '1';
                URL.revokeObjectURL(objUrl);
              };
              tileImg.src = objUrl;
              return;
            }
          }
        } catch {
          // ignore cache read error
        }
      }

      // If primary OSM tile failed while online (rate-limit / temporary block), try Carto Voyager mirror
      if (
        this.currentTileStyle === 'streets' &&
        tileImg.dataset.mirrorTried !== '1' &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        tileImg.dataset.mirrorTried = '1';
        const coords = errEvent.coords;
        if (coords && Number.isFinite(coords.z) && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
          const sub = ['a', 'b', 'c', 'd'][Math.abs(coords.x + coords.y) % 4];
          tileImg.src = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${coords.z}/${coords.x}/${coords.y}.png`;
          return;
        }
      }

      // Hide broken tile icon so OfflineCoordinateGridLayer shows cleanly underneath
      tileImg.style.opacity = '0';
    });

    this.tileLayer.addTo(this.map);
  }

  private buildUserPopupHtml(loc: UserLocation): string {
    const district = LocationService.getDistrictOrCityName(loc.lat, loc.lng);
    const sourceText = loc.isSimulated
      ? 'موقع محدد يدوياً / افتراضي'
      : `GPS حي (±${Math.round(loc.accuracy || 0)} م)`;
    return `
      <div style="font-family:'Cairo', sans-serif; text-align:center; padding:4px; min-width:170px;">
        <b style="font-size:13px; color:#00A859;">📍 ${district}</b>
        <div style="font-size:11px; color:#475569; margin-top:2px;">${sourceText}</div>
        <div style="font-size:10px; color:#64748B; font-family:monospace; margin-top:2px;" dir="ltr">
          ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}
        </div>
        <div style="font-size:10px; color:#2563EB; margin-top:4px; font-weight:700;">
          ✋ اسحب الدبوس الأزرق لتعديل موقعك
        </div>
      </div>
    `;
  }

  // Update or render user GPS location marker with pulsing ripple (draggable!)
  updateUserLocation(loc: UserLocation, autoPan = false): void {
    if (!this.map) return;

    const latLng: L.LatLngExpression = [loc.lat, loc.lng];

    const iconHtml = `
      <div class="user-gps-marker" style="width:36px; height:36px; position:relative; display:flex; align-items:center; justify-content:center; cursor:grab;">
        <div class="user-gps-pulse" style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(37,99,235,0.4); animation:pulse-ring 2s infinite;"></div>
        <div class="user-gps-dot" style="position:relative; width:22px; height:22px; border-radius:50%; background:#2563EB; border:3px solid #fff; box-shadow:0 0 10px #2563EB; display:flex; align-items:center; justify-content:center; z-index:2;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: iconHtml,
      className: 'user-location-custom-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (!this.userMarker) {
      this.userMarker = L.marker(latLng, {
        icon: userIcon,
        zIndexOffset: 1000,
        draggable: true,
        title: 'موقعي الحالي (اسحب لتعديل الموقع)',
      }).addTo(this.map);

      this.userMarker.bindPopup(this.buildUserPopupHtml(loc));

      this.userMarker.on('dragend', () => {
        if (!this.userMarker) return;
        const pos = this.userMarker.getLatLng();
        this.onUserLocationDragCallback?.(pos.lat, pos.lng);
      });
    } else {
      this.userMarker.setLatLng(latLng);
      this.userMarker.setPopupContent(this.buildUserPopupHtml(loc));
    }

    // Accuracy circle (non-interactive subtle ring; don't tint entire viewport blue when zoomed in)
    if (loc.accuracy && loc.accuracy > 20 && loc.accuracy <= 300) {
      if (!this.userAccuracyCircle) {
        this.userAccuracyCircle = L.circle(latLng, {
          radius: loc.accuracy,
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 0.08,
          weight: 1,
          interactive: false,
        }).addTo(this.map);
      } else {
        this.userAccuracyCircle.setLatLng(latLng);
        this.userAccuracyCircle.setRadius(loc.accuracy);
      }
    } else if (this.userAccuracyCircle) {
      this.map.removeLayer(this.userAccuracyCircle);
      this.userAccuracyCircle = null;
    }

    if (autoPan) {
      this.map.panTo(latLng, { animate: true });
    }
  }

  // Render stations on map with custom Cargas badge pins
  renderStations(stations: Station[], selectedStationId?: string): { total: number; rendered: number; skipped: number } {
    if (!this.map) return { total: stations.length, rendered: 0, skipped: stations.length };
    this.stationsCache = stations;
    this.lastSelectedStationId = selectedStationId;

    // Remove existing markers
    this.stationMarkers.forEach((marker) => marker.removeFrom(this.map!));
    this.stationMarkers.clear();

    // Track coordinates to detect exact duplicate coords and jitter slightly
    const coordCounts = new Map<string, number>();
    let rendered = 0;
    let skipped = 0;

    stations.forEach((station) => {
      const lat = Number(station.lat ?? station.latitude);
      const lng = Number(station.lng ?? station.longitude);

      // Validate numeric coordinates
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 15 || lat > 40 || lng < 15 || lng > 50) {
        skipped++;
        return;
      }

      // Check for exact coordinate duplicate
      const coordKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      const duplicateIndex = coordCounts.get(coordKey) || 0;
      coordCounts.set(coordKey, duplicateIndex + 1);

      // If duplicate, apply tiny spiral offset (approx 15-20 meters) so pins don't occlude
      let displayLat = lat;
      let displayLng = lng;
      if (duplicateIndex > 0) {
        const angle = duplicateIndex * 2.39996; // Golden angle
        const radius = 0.00018 * Math.sqrt(duplicateIndex);
        displayLat += radius * Math.cos(angle);
        displayLng += radius * Math.sin(angle);
      }

      const isSelected = station.id === selectedStationId;
      const marker = this.createStationMarker(station, isSelected, displayLat, displayLng);
      marker.addTo(this.map!);
      this.stationMarkers.set(station.id, marker);
      rendered++;
    });

    this.lastRenderStats = { total: stations.length, rendered, skipped };
    return this.lastRenderStats;
  }

  getRenderStats(): { total: number; rendered: number; skipped: number } {
    return this.lastRenderStats;
  }

  focusStation(station: Station, zoom = 15): void {
    const lat = Number(station.lat ?? station.latitude);
    const lng = Number(station.lng ?? station.longitude);
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    this.map.flyTo([lat, lng], zoom, { duration: 1.0 });
    const marker = this.stationMarkers.get(station.id);
    if (marker) {
      marker.setZIndexOffset(1400);
      setTimeout(() => {
        if (this.map && this.stationMarkers.has(station.id)) {
          marker.openTooltip();
        }
      }, 400);
    }
  }

  private createStationMarker(
    station: Station,
    isSelected: boolean,
    displayLat = station.lat,
    displayLng = station.lng
  ): L.Marker {
    const svc = station.services || {
      hasConversionCenter: false,
      hasLubeCenter: false,
      hasCanopyOil: false,
      hasCylinderTesting: false,
      hasFastService: false,
    };
    const hasConversion = svc.hasConversionCenter;
    const hasCylinder = svc.hasCylinderTesting;
    const hasLube = svc.hasLubeCenter;
    const hasCanopy = svc.hasCanopyOil;

    let pinBorderColor = '#00C853';
    let pinBgColor = '#0D2C54';
    let serviceBadge = '';

    if (hasConversion) {
      pinBorderColor = '#F59E0B'; // Amber
      pinBgColor = '#1E1B4B';
      serviceBadge =
        '<span class="station-mini-tag" style="position:absolute; top:-8px; right:-8px; transform:rotate(45deg); font-size:8px; font-weight:900; background:#F59E0B; color:#000; padding:1px 4px; border-radius:4px;">تحويل</span>';
    } else if (hasCylinder) {
      pinBorderColor = '#A855F7'; // Purple
      serviceBadge =
        '<span class="station-mini-tag" style="position:absolute; top:-8px; right:-8px; transform:rotate(45deg); font-size:8px; font-weight:900; background:#A855F7; color:#fff; padding:1px 4px; border-radius:4px;">فحص</span>';
    } else if (hasLube) {
      pinBorderColor = '#3B82F6'; // Blue
      serviceBadge =
        '<span class="station-mini-tag" style="position:absolute; top:-8px; right:-8px; transform:rotate(45deg); font-size:8px; font-weight:900; background:#3B82F6; color:#fff; padding:1px 4px; border-radius:4px;">زيوت</span>';
    } else if (hasCanopy) {
      pinBorderColor = '#14B8A6'; // Teal
      serviceBadge =
        '<span class="station-mini-tag" style="position:absolute; top:-8px; right:-8px; transform:rotate(45deg); font-size:8px; font-weight:900; background:#14B8A6; color:#fff; padding:1px 4px; border-radius:4px;">مظلة</span>';
    }

    const activeLogo =
      station.logoUrl || this.stationLogo || StationStorage.getStationLogo() || DEFAULT_CARGAS_LOGO_DATA_URL;
    const fallbackUrl = DEFAULT_CARGAS_LOGO_DATA_URL.replace(/"/g, '&quot;');
    const logoHtml = `<img src="${activeLogo}" alt="${escapeHtml(station.name)}" onerror="this.onerror=null;this.src='${fallbackUrl}';" style="width:24px; height:24px; object-fit:contain; border-radius:50%; display:block;" />`;

    const pinHtml = `
      <div class="cargas-pin-container ${isSelected ? 'selected' : ''}" style="width:44px; height:44px; display:flex; flex-direction:column; align-items:center; cursor:pointer; position:relative;" data-station-id="${escapeHtml(station.id)}">
        <div class="cargas-pin" style="width:38px; height:38px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); background:${pinBgColor}; border:2.5px solid ${pinBorderColor}; box-shadow:${isSelected ? '0 0 18px rgba(0,230,118,0.85), 0 4px 14px rgba(0,0,0,0.6)' : '0 4px 14px rgba(0,0,0,0.5)'}; display:flex; align-items:center; justify-content:center; position:relative;">
          <div class="cargas-pin-icon" style="transform:rotate(45deg); display:flex; align-items:center; justify-content:center; width:26px; height:26px;">
            ${logoHtml}
          </div>
          ${serviceBadge}
        </div>
        <div class="cargas-pin-shadow" style="position:absolute; bottom:0; width:14px; height:5px; border-radius:50%; background:rgba(0,0,0,0.4); filter:blur(1px);"></div>
      </div>
    `;

    const icon = L.divIcon({
      html: pinHtml,
      className: 'cargas-marker-icon-wrapper',
      iconSize: [44, 44],
      iconAnchor: [22, 42],
      popupAnchor: [0, -42],
    });

    const marker = L.marker([displayLat, displayLng], {
      icon,
      title: station.name,
      riseOnHover: true,
      zIndexOffset: isSelected ? 1200 : 100,
    });

    const tooltipLabel = `<div style="font-family:'Cairo',sans-serif; font-size:11px; font-weight:800; direction:rtl; text-align:right;">
      <div>${escapeHtml(station.name)}</div>
      ${station.governorate ? `<div style="font-size:10px; font-weight:600; color:#10b981;">📍 ${escapeHtml(station.governorate)}${station.city ? ` • ${escapeHtml(station.city)}` : ''}</div>` : ''}
    </div>`;
    marker.bindTooltip(tooltipLabel, {
      direction: 'top',
      offset: [0, -38],
      opacity: 0.95,
    });

    marker.on('click', () => {
      if (this.onStationSelectCallback) {
        this.onStationSelectCallback(station);
      }
    });

    return marker;
  }

  // Draw driving route on the map (tri-color dashed: orange -> yellow -> green)
  drawRoute(route: RouteData): void {
    if (!this.map) return;

    this.clearRoute();

    if (route.coordinates.length < 2) return;

    if (!this.routeSvgRenderer) {
      this.routeSvgRenderer = L.svg({ padding: 0.5 });
    }

    // Tri-color dashed pattern (dash = 14px, gap = 13px => step = 27px, 3-color cycle = 81px)
    // Dark contrast casing behind every dash keeps yellow/orange/green crisp on both light & dark maps
    const casingLine = L.polyline(route.coordinates, {
      renderer: this.routeSvgRenderer,
      color: '#0B1626',
      weight: 9.5,
      opacity: 0.72,
      dashArray: '14, 13',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(this.map);

    const orangeDash = L.polyline(route.coordinates, {
      renderer: this.routeSvgRenderer,
      color: '#FF6D00',
      weight: 5.5,
      opacity: 0.98,
      dashArray: '14, 67',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(this.map);

    const yellowDash = L.polyline(route.coordinates, {
      renderer: this.routeSvgRenderer,
      color: '#FFD600',
      weight: 5.5,
      opacity: 0.98,
      dashArray: '14, 67',
      dashOffset: '54',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(this.map);

    const greenDash = L.polyline(route.coordinates, {
      renderer: this.routeSvgRenderer,
      color: '#00E676',
      weight: 5.5,
      opacity: 0.98,
      dashArray: '14, 67',
      dashOffset: '27',
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(this.map);

    this.routeLayers = [casingLine, orangeDash, yellowDash, greenDash];

    // Fit map bounds to show full route comfortably
    const bounds = L.latLngBounds(route.coordinates);
    this.map.fitBounds(bounds, {
      paddingTopLeft: [60, 60],
      paddingBottomRight: [60, 260],
      maxZoom: 16,
      animate: true,
    });
  }

  clearRoute(): void {
    if (!this.map) return;
    for (const layer of this.routeLayers) {
      this.map.removeLayer(layer);
    }
    this.routeLayers = [];
  }

  flyToLocation(lat: number, lng: number, zoom = 15): void {
    if (!this.map) return;
    this.map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }

  fitToStations(stations: Station[]): void {
    if (!this.map || stations.length === 0) return;
    const validCoords = stations
      .map((s) => [Number(s.lat), Number(s.lng)] as [number, number])
      .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng) && lat > 15 && lat < 38 && lng > 20 && lng < 40);
    if (validCoords.length === 0) return;
    const bounds = L.latLngBounds(validCoords);
    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }

  onStationSelect(callback: (station: Station) => void): void {
    this.onStationSelectCallback = callback;
  }

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  recenterUser(loc: UserLocation): void {
    this.flyToLocation(loc.lat, loc.lng, 15);
  }

  getBounds(): { minLat: number; maxLat: number; minLng: number; maxLng: number; zoom: number } | null {
    if (!this.map) return null;
    const b = this.map.getBounds();
    return {
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
      zoom: this.map.getZoom(),
    };
  }
}
