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
  key: string;
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
  static getTileKey(z: number, x: number, y: number): string {
    return `${z}/${x}/${y}`;
  }

  static getTileUrl(z: number, x: number, y: number): string {
    return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  }

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
            key: this.getTileKey(z, x, y),
            url: this.getTileUrl(z, x, y),
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

  /**
   * Reads a tile strictly from local device storage (IndexedDB first, then Cache API)
   * without touching the network.
   */
  static async getCachedTileBlob(z: number, x: number, y: number, url: string): Promise<Blob | null> {
    const key = this.getTileKey(z, x, y);

    try {
      const idbBlob = await StationDb.getTile(key);
      if (idbBlob && idbBlob.size > 0) {
        return idbBlob;
      }
    } catch {
      // fallback to Cache API
    }

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(OSM_TILE_CACHE_NAME);
        const cached = await cache.match(url);
        if (cached && cached.type !== 'opaque') {
          const blob = await cached.blob();
          if (blob && blob.size > 0) {
            // Backfill into IndexedDB for instant WebView reads next time
            void StationDb.putTile({ key, url, z, x, y, blob });
            return blob;
          }
        }
      } catch {
        // ignore cache API error
      }
    }

    return null;
  }

  /**
   * Saves a downloaded tile Blob to both IndexedDB and Cache API.
   */
  static async saveTileBlob(z: number, x: number, y: number, url: string, blob: Blob): Promise<void> {
    if (!blob || blob.size === 0) return;
    const key = this.getTileKey(z, x, y);

    const tasks: Promise<unknown>[] = [
      StationDb.putTile({ key, url, z, x, y, blob }).catch(() => false),
    ];

    if (typeof caches !== 'undefined') {
      tasks.push(
        caches
          .open(OSM_TILE_CACHE_NAME)
          .then((cache) =>
            cache.put(
              url,
              new Response(blob, {
                status: 200,
                headers: { 'Content-Type': blob.type || 'image/png' },
              })
            )
          )
          .catch(() => undefined)
      );
    }

    await Promise.all(tasks);
  }

  static async getCachedTileCount(): Promise<number> {
    let idbCount = 0;
    let cacheCount = 0;

    try {
      idbCount = await StationDb.getTileCount();
    } catch {
      idbCount = 0;
    }

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(OSM_TILE_CACHE_NAME);
        const keys = await cache.keys();
        cacheCount = keys.length;
      } catch {
        cacheCount = 0;
      }
    }

    return Math.max(idbCount, cacheCount);
  }

  static async clearCachedTiles(): Promise<void> {
    try {
      await StationDb.clearTiles();
    } catch {
      // ignore
    }

    if (typeof caches !== 'undefined') {
      try {
        await caches.delete(OSM_TILE_CACHE_NAME);
      } catch {
        // ignore
      }
    }

    try {
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

    // Never issue runtime fetches if the device is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineState: OfflineTileProgress = {
        completed: 0,
        total,
        cachedNow: 0,
        skippedExisting: 0,
        failed: total,
        percent: 0,
        currentZoom,
        done: true,
        cancelled: true,
      };
      onProgress(offlineState);
      return offlineState;
    }

    const cache =
      typeof caches !== 'undefined' ? await caches.open(OSM_TILE_CACHE_NAME).catch(() => null) : null;
    const existingIdbKeys = await StationDb.getAllTileKeys().catch(() => new Set<string>());
    const existingCacheUrls = new Set<string>();
    if (cache) {
      try {
        const reqs = await cache.keys();
        for (const r of reqs) {
          existingCacheUrls.add(r.url);
        }
      } catch {
        // ignore
      }
    }

    const CONCURRENCY = 6;
    let cursor = 0;

    emit(false, false);

    const worker = async () => {
      while (cursor < tiles.length) {
        if (abortSignal?.aborted || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
        const idx = cursor++;
        const tile = tiles[idx];
        currentZoom = tile.z;

        try {
          if (existingIdbKeys.has(tile.key)) {
            skippedExisting++;
          } else if (existingCacheUrls.has(tile.url) && cache) {
            const matched = await cache.match(tile.url);
            if (matched && matched.type !== 'opaque') {
              const blob = await matched.blob();
              if (blob.size > 0) {
                await StationDb.putTile({ key: tile.key, url: tile.url, z: tile.z, x: tile.x, y: tile.y, blob });
              }
            }
            skippedExisting++;
          } else {
            let response: Response | null = null;
            try {
              response = await fetch(tile.url, { mode: 'cors', signal: abortSignal });
            } catch {
              if (!abortSignal?.aborted && (typeof navigator === 'undefined' || navigator.onLine)) {
                response = await fetch(tile.url, { mode: 'no-cors', signal: abortSignal });
              }
            }

            if (response && response.ok && response.type !== 'opaque') {
              const blob = await response.clone().blob();
              await this.saveTileBlob(tile.z, tile.x, tile.y, tile.url, blob);
              cachedNow++;
            } else if (response && response.type === 'opaque' && cache) {
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

    try {
      const totalCached = await this.getCachedTileCount();
      await StationDb.setMeta('offline_map_stats', {
        cachedCount: totalCached,
        lastDownloadedAt: Date.now(),
      });
    } catch {
      // ignore
    }

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
