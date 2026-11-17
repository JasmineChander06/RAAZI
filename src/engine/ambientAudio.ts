export type AmbientSoundscape = 'violin' | 'chimes';

const VIOLIN_NOTES_HZ = [146.83, 174.61, 164.81, 138.59]; // D3, F3, E3, C#3 (ancient Hijaz/Dorian tension)
const CHIME_NOTES_HZ = [293.66, 349.23, 415.3, 440.0, 523.25, 587.33]; // D4, F4, G#4, A4, C5, D5

export class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private schedulerId: number | null = null;
  private activeOscillators: Set<AudioNode> = new Set();
  private running = false;
  private mode: AmbientSoundscape = 'violin';
  private stepIndex = 0;

  public isRunning(): boolean {
    return this.running;
  }

  public getMode(): AmbientSoundscape {
    return this.mode;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  private buildDarkDelay(ctx: AudioContext, destination: AudioNode): GainNode {
    const input = ctx.createGain();
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.48;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;

    const dampFilter = ctx.createBiquadFilter();
    dampFilter.type = 'lowpass';
    dampFilter.frequency.value = 1100;

    input.connect(destination);
    input.connect(delay);
    delay.connect(dampFilter);
    dampFilter.connect(feedback);
    feedback.connect(delay);
    dampFilter.connect(destination);

    return input;
  }

  private startLoFiTexture(ctx: AudioContext, destination: AudioNode, gainLevel: number) {
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 1.8;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = gainLevel;

    source.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(destination);
    source.start();

    this.noiseSource = source;
  }

  private triggerViolinPhrase(ctx: AudioContext, fxBus: AudioNode) {
    const now = ctx.currentTime;
    const noteHz = VIOLIN_NOTES_HZ[this.stepIndex % VIOLIN_NOTES_HZ.length];
    const droneHz = 110.0; // Subtle A2 fifth drone
    this.stepIndex += 1;

    const duration = 5.4;

    const playBowedVoice = (freq: number, level: number) => {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscB.type = 'triangle';
      oscA.frequency.value = freq;
      oscB.frequency.value = freq * 1.0035; // Slight warm chorus detune

      // Expressive vibrato
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 4.6;
      lfoGain.gain.value = freq * 0.0045;
      lfo.connect(lfoGain);
      lfoGain.connect(oscA.frequency);
      lfoGain.connect(oscB.frequency);

      // Warm lo-fi wood body lowpass filter
      const bodyFilter = ctx.createBiquadFilter();
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(520, now);
      bodyFilter.frequency.linearRampToValueAtTime(840, now + 2.2);
      bodyFilter.frequency.linearRampToValueAtTime(480, now + duration);
      bodyFilter.Q.value = 1.6;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(level, now + 1.4);
      env.gain.setValueAtTime(level * 0.85, now + 3.4);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscA.connect(bodyFilter);
      oscB.connect(bodyFilter);
      bodyFilter.connect(env);
      env.connect(fxBus);

      oscA.start(now);
      oscB.start(now);
      lfo.start(now);
      oscA.stop(now + duration + 0.1);
      oscB.stop(now + duration + 0.1);
      lfo.stop(now + duration + 0.1);

      this.activeOscillators.add(oscA);
      this.activeOscillators.add(oscB);
      this.activeOscillators.add(lfo);

      oscA.onended = () => {
        this.activeOscillators.delete(oscA);
        this.activeOscillators.delete(oscB);
        this.activeOscillators.delete(lfo);
      };
    };

    playBowedVoice(noteHz, 0.22);
    playBowedVoice(droneHz, 0.11);
  }

  private triggerWindChime(ctx: AudioContext, fxBus: AudioNode) {
    const now = ctx.currentTime;
    const freq = CHIME_NOTES_HZ[Math.floor(Math.random() * CHIME_NOTES_HZ.length)];
    const partials = [
      { ratio: 1.0, amp: 0.24, decay: 3.6 },
      { ratio: 2.02, amp: 0.09, decay: 2.4 },
      { ratio: 3.16, amp: 0.04, decay: 1.4 },
    ];

    const lofiFilter = ctx.createBiquadFilter();
    lofiFilter.type = 'lowpass';
    lofiFilter.frequency.value = 1900;
    lofiFilter.connect(fxBus);

    for (const part of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * part.ratio;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(part.amp, now + 0.045);
      env.gain.exponentialRampToValueAtTime(0.0001, now + part.decay);

      osc.connect(env);
      env.connect(lofiFilter);

      osc.start(now);
      osc.stop(now + part.decay + 0.1);
      this.activeOscillators.add(osc);
      osc.onended = () => {
        this.activeOscillators.delete(osc);
      };
    }
  }

  public async start(mode: AmbientSoundscape): Promise<void> {
    this.stopImmediate();
    this.mode = mode;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.9);
    master.connect(ctx.destination);
    this.masterGain = master;

    const fxBus = this.buildDarkDelay(ctx, master);
    this.running = true;
    this.stepIndex = 0;

    if (mode === 'violin') {
      this.startLoFiTexture(ctx, master, 0.055);
      this.triggerViolinPhrase(ctx, fxBus);
      this.schedulerId = window.setInterval(() => {
        if (this.running && this.ctx) {
          this.triggerViolinPhrase(this.ctx, fxBus);
        }
      }, 4800);
    } else {
      this.startLoFiTexture(ctx, master, 0.075);
      this.triggerWindChime(ctx, fxBus);
      this.schedulerId = window.setInterval(() => {
        if (this.running && this.ctx) {
          this.triggerWindChime(this.ctx, fxBus);
        }
      }, 2400);
    }
  }

  public stop(): void {
    this.running = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }

    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      const fadingMaster = this.masterGain;
      try {
        fadingMaster.gain.cancelScheduledValues(now);
        fadingMaster.gain.setValueAtTime(fadingMaster.gain.value, now);
        fadingMaster.gain.linearRampToValueAtTime(0.0001, now + 0.45);
      } catch {
        // Ignore if context already closed
      }
      const oldNoise = this.noiseSource;
      this.noiseSource = null;
      this.masterGain = null;

      window.setTimeout(() => {
        if (!this.running) {
          try {
            oldNoise?.stop();
            fadingMaster.disconnect();
          } catch {
            // Safe cleanup
          }
        }
      }, 500);
    } else {
      this.stopImmediate();
    }
  }

  private stopImmediate(): void {
    this.running = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    try {
      this.noiseSource?.stop();
    } catch {
      // Ignore already stopped
    }
    this.noiseSource = null;
    try {
      this.masterGain?.disconnect();
    } catch {
      // Ignore already disconnected
    }
    this.masterGain = null;
  }

  public dispose(): void {
    this.stopImmediate();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
