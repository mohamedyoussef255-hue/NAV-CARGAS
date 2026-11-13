import { Station } from '../types';

const DB_NAME = 'cargas_offline_db';
const DB_VERSION = 2;
const STORE_STATIONS = 'stations';
const STORE_META = 'meta';
const STORE_TILES = 'tiles';

export interface StoredTileRecord {
  key: string;
  url: string;
  z: number;
  x: number;
  y: number;
  blob: Blob;
  savedAt: number;
}

export class StationDb {
  private static dbPromise: Promise<IDBDatabase | null> | null = null;

  private static openDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_STATIONS)) {
            db.createObjectStore(STORE_STATIONS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORE_TILES)) {
            db.createObjectStore(STORE_TILES, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('IndexedDB open failed, falling back to localStorage:', request.error);
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB unavailable:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  static async getAllStations(): Promise<Station[] | null> {
    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_STATIONS, 'readonly');
        const store = tx.objectStore(STORE_STATIONS);
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  static async saveAllStations(stations: Station[]): Promise<boolean> {
    const db = await this.openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_STATIONS, 'readwrite');
        const store = tx.objectStore(STORE_STATIONS);
        store.clear();
        for (const station of stations) {
          store.put(station);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  static async getMeta<T>(key: string): Promise<T | null> {
    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_META, 'readonly');
        const store = tx.objectStore(STORE_META);
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result ? (req.result.value as T) : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  static async setMeta<T>(key: string, value: T): Promise<boolean> {
    const db = await this.openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_META, 'readwrite');
        const store = tx.objectStore(STORE_META);
        store.put({ key, value, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  static async getTile(key: string): Promise<Blob | null> {
    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TILES, 'readonly');
        const store = tx.objectStore(STORE_TILES);
        const req = store.get(key);
        req.onsuccess = () => {
          const rec = req.result as StoredTileRecord | undefined;
          resolve(rec?.blob instanceof Blob && rec.blob.size > 0 ? rec.blob : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  static async putTile(record: Omit<StoredTileRecord, 'savedAt'>): Promise<boolean> {
    if (!(record.blob instanceof Blob) || record.blob.size === 0) return false;
    const db = await this.openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TILES, 'readwrite');
        const store = tx.objectStore(STORE_TILES);
        store.put({ ...record, savedAt: Date.now() } satisfies StoredTileRecord);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  static async getAllTileKeys(): Promise<Set<string>> {
    const db = await this.openDb();
    if (!db) return new Set();

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TILES, 'readonly');
        const store = tx.objectStore(STORE_TILES);
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = Array.isArray(req.result) ? req.result.map((k) => String(k)) : [];
          resolve(new Set(keys));
        };
        req.onerror = () => resolve(new Set());
      } catch {
        resolve(new Set());
      }
    });
  }

  static async getTileCount(): Promise<number> {
    const db = await this.openDb();
    if (!db) return 0;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TILES, 'readonly');
        const store = tx.objectStore(STORE_TILES);
        const req = store.count();
        req.onsuccess = () => resolve(typeof req.result === 'number' ? req.result : 0);
        req.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  static async clearTiles(): Promise<boolean> {
    const db = await this.openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TILES, 'readwrite');
        const store = tx.objectStore(STORE_TILES);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
}
