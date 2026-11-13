import { StationDb } from './stationDb';

export const OSM_TILE_CACHE_NAME = 'cargas-osm-tiles-v1';

export interface TileDownloadBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  minZoom: number;
  maxZoom: number;
}

export const EGYPT_OFFLINE_BOUNDS: TileDownloadBounds = {
  minLat: 24.0,
  maxLat: 31.5,
  minLng: 27.0,
  maxLng: 34.4,
  minZoom: 6,
  maxZoom: 12,
};

export interface OfflineTileProgress {
  completed: number;
  total: number;
  cachedNow: number;
  skippedExisting: number;
  failed: number;
  percent: number;
  currentZoom: number;
  done: boolean;
  cancelled: boolean;
}

export interface TileCoord {
  z: number;
  x: number;
  y: number;
  url: string;
}

export function lng2tile(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

export function tile2lat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tile2lng(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

export class OfflineMapService {
  static getTilesInBounds(bounds: TileDownloadBounds): TileCoord[] {
    const tiles: TileCoord[] = [];
    for (let z = bounds.minZoom; z <= bounds.maxZoom; z++) {
      const minX = Math.max(0, lng2tile(bounds.minLng, z));
      const maxX = Math.min(Math.pow(2, z) - 1, lng2tile(bounds.maxLng, z));
      const minY = Math.max(0, lat2tile(bounds.maxLat, z)); // higher lat => lower y
      const maxY = Math.min(Math.pow(2, z) - 1, lat2tile(bounds.minLat, z));

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({
            z,
            x,
            y,
            url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
          });
        }
      }
    }
    return tiles;
  }

  static estimateTileCount(bounds: TileDownloadBounds): number {
    let count = 0;
    for (let z = bounds.minZoom; z <= bounds.maxZoom; z++) {
      const minX = Math.max(0, lng2tile(bounds.minLng, z));
      const maxX = Math.min(Math.pow(2, z) - 1, lng2tile(bounds.maxLng, z));
      const minY = Math.max(0, lat2tile(bounds.maxLat, z));
      const maxY = Math.min(Math.pow(2, z) - 1, lat2tile(bounds.minLat, z));
      count += (maxX - minX + 1) * (maxY - minY + 1);
    }
    return count;
  }

  static async getCachedTileCount(): Promise<number> {
    if (typeof caches === 'undefined') return 0;
    try {
      const cache = await caches.open(OSM_TILE_CACHE_NAME);
      const keys = await cache.keys();
      return keys.length;
    } catch {
      return 0;
    }
  }

  static async clearCachedTiles(): Promise<void> {
    if (typeof caches === 'undefined') return;
    try {
      await caches.delete(OSM_TILE_CACHE_NAME);
      await StationDb.setMeta('offline_map_stats', { cachedCount: 0, lastDownloadedAt: null });
    } catch {
      // ignore
    }
  }

  static async downloadTiles(
    bounds: TileDownloadBounds,
    onProgress: (progress: OfflineTileProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<OfflineTileProgress> {
    const tiles = this.getTilesInBounds(bounds);
    const total = tiles.length;
    let completed = 0;
    let cachedNow = 0;
    let skippedExisting = 0;
    let failed = 0;
    let currentZoom = bounds.minZoom;

    if (typeof caches === 'undefined') {
      const res: OfflineTileProgress = {
        completed: 0,
        total,
        cachedNow: 0,
        skippedExisting: 0,
        failed: total,
        percent: 0,
        currentZoom,
        done: true,
        cancelled: false,
      };
      onProgress(res);
      return res;
    }

    const cache = await caches.open(OSM_TILE_CACHE_NAME);
    const CONCURRENCY = 6;
    let cursor = 0;

    const emit = (done = false, cancelled = false) => {
      onProgress({
        completed,
        total,
        cachedNow,
        skippedExisting,
        failed,
        percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 100,
        currentZoom,
        done,
        cancelled,
      });
    };

    emit(false, false);

    const worker = async () => {
      while (cursor < tiles.length) {
        if (abortSignal?.aborted) return;
        const idx = cursor++;
        const tile = tiles[idx];
        currentZoom = tile.z;

        try {
          const existing = await cache.match(tile.url);
          if (existing) {
            skippedExisting++;
          } else {
            let response: Response | null = null;
            try {
              response = await fetch(tile.url, { mode: 'cors', signal: abortSignal });
            } catch {
              if (!abortSignal?.aborted) {
                response = await fetch(tile.url, { mode: 'no-cors', signal: abortSignal });
              }
            }

            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(tile.url, response.clone());
              cachedNow++;
            } else {
              failed++;
            }
          }
        } catch {
          if (!abortSignal?.aborted) {
            failed++;
          }
        }

        completed++;
        if (completed % 8 === 0 || completed === total) {
          emit(false, false);
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, tiles.length || 1) }, () => worker());
    await Promise.all(workers);

    const totalCached = await this.getCachedTileCount();
    await StationDb.setMeta('offline_map_stats', {
      cachedCount: totalCached,
      lastDownloadedAt: Date.now(),
    });

    const finalState: OfflineTileProgress = {
      completed,
      total,
      cachedNow,
      skippedExisting,
      failed,
      percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 100,
      currentZoom,
      done: true,
      cancelled: Boolean(abortSignal?.aborted),
    };
    onProgress(finalState);
    return finalState;
  }
}
