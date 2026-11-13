export class SoundService {
  private static audioCtx: AudioContext | null = null;
  private static speechSynth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static enabled = true;

  private static getContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play pleasant navigation chime (tone sequence)
  static playChime(type: 'start' | 'turn' | 'arrive' | 'click' = 'click'): void {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.08, now);

      if (type === 'start') {
        // Ascending tone
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'arrive') {
        // Success fanfare tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'turn') {
        // Notification double beep
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(750, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Gentle click
        osc.frequency.setValueAtTime(800, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch {
      // AudioContext might be blocked until user gesture
    }
  }

  // Speak Arabic instruction via browser TTS if available
  static speakArabic(text: string): void {
    if (!this.enabled || !this.speechSynth) return;
    try {
      if (this.speechSynth.speaking) {
        this.speechSynth.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-EG'; // Egyptian Arabic or fallback ar-SA
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Find Arabic voice if available
      const voices = this.speechSynth.getVoices();
      const arVoice = voices.find((v) => v.lang.startsWith('ar'));
      if (arVoice) {
        utterance.voice = arVoice;
      }

      this.speechSynth.speak(utterance);
    } catch {
      // Ignore if speech failed
    }
  }

  static toggleAudio(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  static isAudioEnabled(): boolean {
    return this.enabled;
  }
}
