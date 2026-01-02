/**
 * AudioManager - Synthesizes retro-style game sounds using Web Audio API
 * No external audio files needed - all sounds generated at runtime
 */
// Use type alias for browser AudioContext
type BrowserAudioContext = typeof window.AudioContext;

export class AudioManager {
  private context: InstanceType<BrowserAudioContext> | null = null;
  private masterVolume = 0.3;
  private enabled = true;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    // AudioContext will be created on first user interaction (browser requirement)
    this.setupVisibilityHandler();
  }

  /**
   * Set up visibility change handler to resume audio when app returns from background
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (!document.hidden && this.context && this.context.state === 'suspended') {
        // Page became visible and audio context is suspended - resume it
        this.context.resume().catch((err) => {
          console.warn('Failed to resume AudioContext on visibility change:', err);
        });
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private getContext(): InstanceType<BrowserAudioContext> | null {
    if (!this.context) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: BrowserAudioContext }).webkitAudioContext;
        this.context = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported:', e);
        return null;
      }
    }

    // If context is suspended (e.g., after returning from background), try to resume it
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {
        // Silently ignore - will retry on next interaction
      });
    }

    return this.context;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Resume audio context (required after user interaction)
   */
  async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /**
   * Arrow/bullet firing sound - short high-pitched blip
   */
  playShoot(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }

  /**
   * Enemy hit sound - satisfying thump
   */
  playHit(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }

  /**
   * Player damage sound - painful buzz
   */
  playPlayerHit(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.35, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }

  /**
   * Level up sound - ascending triumphant arpeggio
   */
  playLevelUp(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const duration = 0.12;

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * duration);

      const startTime = ctx.currentTime + i * duration;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.3, startTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.25, startTime + duration * 0.8);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    });
  }

  /**
   * Ability selected sound - confirmation chime
   */
  playAbilitySelect(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, ctx.currentTime);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.08);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.2, ctx.currentTime + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }

  /**
   * Room cleared sound - victory fanfare
   */
  playRoomClear(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [392, 523.25, 659.25]; // G4, C5, E5
    const durations = [0.15, 0.15, 0.3];

    let time = ctx.currentTime;
    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(freq, time);

      gainNode.gain.setValueAtTime(this.masterVolume * 0.3, time);
      gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.25, time + durations[i] * 0.7);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);

      oscillator.start(time);
      oscillator.stop(time + durations[i]);

      time += durations[i];
    });
  }

  /**
   * Death sound - descending sad tone
   */
  playDeath(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.8);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.4, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.3, ctx.currentTime + 0.4);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  }

  /**
   * Victory sound - triumphant major chord progression
   */
  playVictory(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Major chord: C-E-G followed by higher C-E-G
    const chords = [
      [261.63, 329.63, 392], // C4, E4, G4
      [523.25, 659.25, 783.99] // C5, E5, G5
    ];

    let time = ctx.currentTime;
    chords.forEach((chord, chordIndex) => {
      chord.forEach((freq) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, time);

        const duration = chordIndex === 0 ? 0.25 : 0.5;
        gainNode.gain.setValueAtTime(this.masterVolume * 0.2, time);
        gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.15, time + duration * 0.8);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);

        oscillator.start(time);
        oscillator.stop(time + duration);
      });
      time += 0.25;
    });
  }

  /**
   * Menu select sound - simple click
   */
  playMenuSelect(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }

  /**
   * Game start sound - energetic ascending sweep
   */
  playGameStart(): void {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(220, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);

    gainNode.gain.setValueAtTime(this.masterVolume * 0.25, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.3, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.25);
  }
}

// Singleton instance for global access
export const audioManager = new AudioManager();
