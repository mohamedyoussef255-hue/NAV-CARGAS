import { Station } from '../types';

const DB_NAME = 'cargas_offline_db';
const DB_VERSION = 1;
const STORE_STATIONS = 'stations';
const STORE_META = 'meta';

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
}
