import { SoundService } from '../services/soundService';

export interface SecretTapOptions {
  requiredTaps?: number;
  windowMs?: number;
  onTrigger: () => void;
}

/**
 * Reliable 5-tap secret trigger controller for mobile WebView (Median/Android/iOS) & desktop.
 * Guards against swipe/scroll false positives, deduplicates pointerup+click,
 * and preserves native click gesture so virtual keyboards focus #admin-password-input cleanly.
 */
export class SecretTapController {
  private tapCount = 0;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPointerTapAt = 0;
  private justOpenedAdminAt = 0;
  private requiredTaps: number;
  private windowMs: number;
  private onTrigger: () => void;

  constructor(options: SecretTapOptions) {
    this.requiredTaps = options.requiredTaps ?? 5;
    this.windowMs = options.windowMs ?? 3500;
    this.onTrigger = options.onTrigger;
  }

  reset(): void {
    this.tapCount = 0;
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
  }

  private focusAdminPasswordInput(): void {
    const pwdInput = document.getElementById('admin-password-input') as HTMLInputElement | null;
    if (!pwdInput) return;
    try {
      pwdInput.focus({ preventScroll: false });
      pwdInput.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch {
      pwdInput.focus();
    }
  }

  bind(triggerEl: HTMLElement | null, visualFeedbackEl?: HTMLElement | null): void {
    if (!triggerEl) return;
    if (triggerEl.dataset.secretTapBound === '1') return;
    triggerEl.dataset.secretTapBound = '1';

    let pointerDownPos: { x: number; y: number } | null = null;
    let touchStartPos: { x: number; y: number } | null = null;
    let lastGestureKind: 'touch' | 'pointer' | null = null;
    let lastGestureAt = 0;
    const feedbackTarget = visualFeedbackEl ?? triggerEl;

    const registerTap = () => {
      this.tapCount++;
      if (this.tapTimer) {
        clearTimeout(this.tapTimer);
        this.tapTimer = null;
      }

      if (feedbackTarget) {
        feedbackTarget.style.transform = 'scale(0.92)';
        setTimeout(() => {
          feedbackTarget.style.transform = '';
        }, 90);
      }

      if (this.tapCount >= this.requiredTaps) {
        this.tapCount = 0;
        this.justOpenedAdminAt = performance.now();
        (document.activeElement as HTMLElement | null)?.blur?.();
        this.onTrigger();
        this.focusAdminPasswordInput();
        try {
          SoundService.playChime('start');
        } catch {
          // ignore WebAudio restrictions in mobile WebViews
        }
      } else {
        this.tapTimer = setTimeout(() => {
          this.tapCount = 0;
          this.tapTimer = null;
        }, this.windowMs);
      }
    };

    triggerEl.addEventListener('dblclick', (e) => {
      if (e.cancelable) e.preventDefault();
    });

    // Touch events (Android WebView / Median / iOS fallback & primary fast path)
    triggerEl.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length !== 1) {
          touchStartPos = null;
          return;
        }
        const t = e.touches[0];
        touchStartPos = { x: t.clientX, y: t.clientY };
      },
      { passive: true }
    );

    triggerEl.addEventListener(
      'touchend',
      (e) => {
        const t = e.changedTouches[0];
        if (touchStartPos && t) {
          const dist = Math.hypot(t.clientX - touchStartPos.x, t.clientY - touchStartPos.y);
          touchStartPos = null;
          if (dist > 60) return;
        }
        const now = performance.now();
        lastGestureKind = 'touch';
        lastGestureAt = now;
        this.lastPointerTapAt = now;
        registerTap();
      },
      { passive: true }
    );

    triggerEl.addEventListener(
      'touchcancel',
      () => {
        touchStartPos = null;
      },
      { passive: true }
    );

    // Pointer events (Mouse, Stylus, or Touch when touch events aren't used)
    triggerEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    triggerEl.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const now = performance.now();
      // If touchend just counted this exact touch tap (< 120ms), do not double-count on pointerup
      if (e.pointerType === 'touch' && lastGestureKind === 'touch' && now - lastGestureAt < 120) {
        pointerDownPos = null;
        return;
      }
      if (pointerDownPos) {
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        pointerDownPos = null;
        if (dist > 60) return;
      }
      lastGestureKind = 'pointer';
      lastGestureAt = now;
      this.lastPointerTapAt = now;
      registerTap();
    });

    triggerEl.addEventListener('pointercancel', () => {
      pointerDownPos = null;
    });

    // Click fallback (handles WebViews where touch/pointer was cancelled or accessibility/keyboard clicks)
    triggerEl.addEventListener('click', (e) => {
      const now = performance.now();
      if (now - this.justOpenedAdminAt < 750) {
        e.stopPropagation();
        this.focusAdminPasswordInput();
        return;
      }
      // Only suppress synthetic click that immediately follows touchend/pointerup from the SAME tap
      if (e.detail !== 0 && now - this.lastPointerTapAt < 650) {
        return;
      }
      registerTap();
    });

    triggerEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        registerTap();
      }
    });
  }
}
