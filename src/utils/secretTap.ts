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
    this.windowMs = options.windowMs ?? 2500;
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
    pwdInput.focus();
    pwdInput.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  bind(triggerEl: HTMLElement | null, visualFeedbackEl?: HTMLElement | null): void {
    if (!triggerEl) return;

    let pointerDownPos: { x: number; y: number } | null = null;
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

    triggerEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    triggerEl.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pointerDownPos) {
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        pointerDownPos = null;
        if (dist > 44) return;
      }
      this.lastPointerTapAt = performance.now();
      registerTap();
    });

    triggerEl.addEventListener('pointercancel', () => {
      pointerDownPos = null;
    });

    triggerEl.addEventListener('click', (e) => {
      if (performance.now() - this.justOpenedAdminAt < 650) {
        e.stopPropagation();
        this.focusAdminPasswordInput();
        return;
      }
      if (e.detail !== 0 && performance.now() - this.lastPointerTapAt < 450) {
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
