import type { WeaponId } from "../game/types";

export class GunAudio {
  private context: AudioContext | null = null;

  resume(): void {
    const context = this.getContext();
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  playShot(weapon: WeaponId): void {
    const context = this.getContext();
    const now = context.currentTime;
    const duration = weapon === "pistol" ? 0.09 : 0.055;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(weapon === "pistol" ? 105 : 82, now);
    oscillator.frequency.exponentialRampToValueAtTime(38, now + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(weapon === "pistol" ? 900 : 700, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(weapon === "pistol" ? 0.36 : 0.24, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  playDryFire(): void {
    const context = this.getContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(240, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.06);
  }

  playHit(): void {
    const context = this.getContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(720, now);
    oscillator.frequency.exponentialRampToValueAtTime(320, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }

    return this.context;
  }
}
