import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaState {
  isOnline: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isInstallable: boolean;
  swReady: boolean;
}

export class PwaService {
  private static deferredPrompt: BeforeInstallPromptEvent | null = null;
  private static isInstalled = false;
  private static isIOS = false;
  private static isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private static swReady = false;
  private static initialized = false;
  private static listeners: Set<(state: PwaState) => void> = new Set();

  static init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.isInstalled =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    const ua = window.navigator.userAgent.toLowerCase();
    this.isIOS = /iphone|ipad|ipod/.test(ua);
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notify();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.notify();
    });

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify();
    });

    // Register Service Worker via vite-plugin-pwa
    try {
      registerSW({
        immediate: true,
        onRegisteredSW: () => {
          this.swReady = true;
          this.notify();
        },
        onOfflineReady: () => {
          this.swReady = true;
          this.notify();
        },
      });
    } catch (err) {
      console.warn('Service worker registration skipped:', err);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          this.swReady = true;
          this.notify();
        })
        .catch(() => {
          // ignore
        });
    }
  }

  static getState(): PwaState {
    return {
      isOnline: this.isOnline,
      isInstalled: this.isInstalled,
      isIOS: this.isIOS,
      isInstallable: Boolean(this.deferredPrompt),
      swReady: this.swReady,
    };
  }

  static subscribe(cb: (state: PwaState) => void): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => this.listeners.delete(cb);
  }

  private static notify(): void {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }

  static async triggerInstall(): Promise<'accepted' | 'dismissed' | 'ios' | 'manual'> {
    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notify();
        return 'accepted';
      }
      return 'dismissed';
    }
    if (this.isIOS) {
      return 'ios';
    }
    return 'manual';
  }
}
