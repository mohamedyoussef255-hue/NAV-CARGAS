/**
 * WebView & Median.co (GoNative) Navigation and VisualViewport Guard.
 * - Prevents accidental external browser redirects to Vercel URL inside WebView wrappers.
 * - Keeps visualViewport height synced to `--vvh` CSS variable so soft keyboards never cover inputs.
 */

let guardInitialized = false;

export function isMedianOrWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const win = window as unknown as { median?: unknown; gonative?: unknown; ReactNativeWebView?: unknown };
  if (win.median || win.gonative || win.ReactNativeWebView) return true;
  if (ua.includes('gonative') || ua.includes('median') || ua.includes('; wv)') || ua.includes('webview')) {
    return true;
  }
  return false;
}

export function initWebViewNavigationGuard(): void {
  if (guardInitialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  guardInitialized = true;

  if (isMedianOrWebView()) {
    document.documentElement.dataset.webview = 'median';
  }

  // 1. Sync visualViewport height so mobile virtual keyboard resizes overlays cleanly
  const syncVisualViewport = () => {
    const vv = window.visualViewport;
    const height = vv ? Math.round(vv.height) : window.innerHeight;
    if (height > 0) {
      document.documentElement.style.setProperty('--vvh', `${height}px`);
    }
  };
  syncVisualViewport();
  window.visualViewport?.addEventListener('resize', syncVisualViewport);
  window.visualViewport?.addEventListener('scroll', syncVisualViewport);
  window.addEventListener('resize', syncVisualViewport);

  // 2. Intercept same-origin links so Median/WebView never opens an external Chrome/Safari tab
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;

      // Allow genuine device intents (geo:, tel:, mailto:) to pass through normally
      if (rawHref.startsWith('geo:') || rawHref.startsWith('tel:') || rawHref.startsWith('mailto:')) {
        if (anchor.target === '_blank') anchor.removeAttribute('target');
        return;
      }

      try {
        const resolved = new URL(rawHref, window.location.href);
        if (resolved.origin === window.location.origin) {
          // Force same-origin navigation to stay strictly inside the WebView
          anchor.removeAttribute('target');
          if (resolved.pathname === window.location.pathname && resolved.search === window.location.search) {
            event.preventDefault();
          }
        }
      } catch {
        // Relative or malformed href: keep inside WebView
        anchor.removeAttribute('target');
      }
    },
    true
  );

  // 3. Guard window.open so same-origin URLs never escape the WebView
  const originalOpen = window.open.bind(window);
  window.open = function (url?: string | URL, target?: string, features?: string): Window | null {
    if (url) {
      try {
        const resolved = new URL(String(url), window.location.href);
        if (resolved.origin === window.location.origin) {
          if (resolved.href !== window.location.href) {
            window.history.replaceState(null, '', resolved.pathname + resolved.search + resolved.hash);
          }
          return window;
        }
      } catch {
        // ignore URL parse failure
      }
    }
    return originalOpen(url, target, features);
  };
}
