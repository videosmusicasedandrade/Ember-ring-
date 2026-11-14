class SoundEngine {
  private ctx: AudioContext | null = null;
  public mutedMusic = false;
  public mutedSfx = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMutedMusic(muted: boolean) {
    this.mutedMusic = muted;
    if (muted) {
      this.stopMusic();
    }
  }

  public setMutedSfx(muted: boolean) {
    this.mutedSfx = muted;
  }

  public startMusic() {
    if (this.mutedMusic || this.musicTimer || typeof window === 'undefined') return;
    const pentatonic = [261.63, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63, 293.66];
    const bass = [130.81, 130.81, 164.81, 146.83];

    this.musicTimer = setInterval(() => {
      if (this.mutedMusic) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const melodyFreq = pentatonic[this.musicStep % pentatonic.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(melodyFreq, now);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);

      if (this.musicStep % 2 === 0) {
        const bassFreq = bass[Math.floor(this.musicStep / 2) % bass.length];
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bassFreq, now);
        bGain.gain.setValueAtTime(0.03, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        bOsc.connect(bGain).connect(ctx.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.46);
      }

      this.musicStep = (this.musicStep + 1) % 16;
    }, 420);
  }

  public stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private getSfxCtx(): AudioContext | null {
    if (this.mutedSfx) return null;
    return this.ensureContext();
  }

  public playClick() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playShoot() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const pitchVar = 0.92 + Math.random() * 0.16;
    osc.frequency.setValueAtTime(520 * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(220 * pitchVar, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playShieldBash() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.14);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playSlash() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const pitchVar = 0.94 + Math.random() * 0.12;
    osc.frequency.setValueAtTime(680 * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(160 * pitchVar, now + 0.12);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playKill() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Zombie low groan + crisp burst pop
    const groan = ctx.createOscillator();
    const groanGain = ctx.createGain();
    groan.type = 'sawtooth';
    groan.frequency.setValueAtTime(175, now);
    groan.frequency.exponentialRampToValueAtTime(62, now + 0.16);
    groanGain.gain.setValueAtTime(0.075, now);
    groanGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    groan.connect(groanGain).connect(ctx.destination);
    groan.start(now);
    groan.stop(now + 0.18);

    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(480, now + 0.03);
    pop.frequency.exponentialRampToValueAtTime(780, now + 0.1);
    popGain.gain.setValueAtTime(0.06, now + 0.03);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    pop.connect(popGain).connect(ctx.destination);
    pop.start(now + 0.03);
    pop.stop(now + 0.12);
  }

  public playDeploy() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.setValueAtTime(540, now + 0.06);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playMerge() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    });
  }

  public playUnitHit() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playSpellBlade() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.33);
  }

  public playSpellShockwave() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.35);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.37);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playSpellOvercharge() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playLowHpAlarm() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.16].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now + offset);
      osc.frequency.setValueAtTime(380, now + offset + 0.08);
      gain.gain.setValueAtTime(0.06, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  public playVictory() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playDefeat() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [330, 293.66, 246.94, 196].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.33);
    });
  }

  public playBaseHit() {
    const ctx = this.getSfxCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.2);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }
}

export const soundEngine = new SoundEngine();
