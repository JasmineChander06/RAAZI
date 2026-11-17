/**
 * RAAZI Voice & Audio Engine (Speech Synthesis / TTS)
 * Provides literary, atmospheric spoken recitation for Raazi and distinct
 * pitch/rate acoustic profiles for individual suspects.
 */

export interface VoiceProfile {
  name: string;
  pitch: number;
  rate: number;
  description: string;
}

export const SUSPECT_VOICE_PROFILES: VoiceProfile[] = [
  {
    name: 'Aristocratic / Dignified',
    pitch: 0.82,
    rate: 0.88,
    description: 'Deep, low-cadence aristocratic tone',
  },
  {
    name: 'Anxious / Guarded',
    pitch: 1.18,
    rate: 1.05,
    description: 'Higher-register, hurried, cautious cadence',
  },
  {
    name: 'Somber / Cold',
    pitch: 0.9,
    rate: 0.92,
    description: 'Measured, gravelly, quiet delivery',
  },
  {
    name: 'Calculating / Sharp',
    pitch: 1.05,
    rate: 0.96,
    description: 'Crisp, deliberate, articulate tone',
  },
];

export const RAAZI_VOICE_PROFILE: VoiceProfile = {
  name: 'Detective Raazi',
  pitch: 0.88,
  rate: 0.92,
  description: 'Deep, analytical, contemplative detective voice',
};

/**
 * Strips markdown symbols, asterisks, hashtags, bracketed notations
 * so speech synthesis reads naturally like prose.
 */
export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](link) -> text
    .replace(/\[Clue Logged:[^\]]+\]/gi, '')
    .replace(/\[Photographic evidence submitted:[^\]]+\]/gi, '')
    .replace(/[#*_`~>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class VoiceEngine {
  private static instance: VoiceEngine | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentSpeakerId: string | null = null;
  private onEndCallbacks: Set<() => void> = new Set();

  public static getInstance(): VoiceEngine {
    if (!VoiceEngine.instance) {
      VoiceEngine.instance = new VoiceEngine();
    }
    return VoiceEngine.instance;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public isSpeaking(): boolean {
    if (!this.isSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  public getCurrentSpeakerId(): string | null {
    return this.currentSpeakerId;
  }

  private pickBestVoice(): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // Prefer English voices with natural deep/narrative quality
    const preferredNames = [
      'Google UK English Male',
      'Daniel',
      'Oliver',
      'George',
      'Microsoft Ryan Online (Natural)',
      'Microsoft Guy Online (Natural)',
      'en-GB',
      'en-US',
    ];

    for (const name of preferredNames) {
      const match = voices.find(
        (v) => v.name.includes(name) || v.lang.includes(name)
      );
      if (match) return match;
    }

    // Default to first English voice or first available
    return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
  }

  public speak(
    text: string,
    options?: {
      speakerId?: string;
      profile?: VoiceProfile;
      onStart?: () => void;
      onEnd?: () => void;
    }
  ): boolean {
    if (!this.isSupported()) return false;

    this.stop();

    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return false;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    const profile = options?.profile || RAAZI_VOICE_PROFILE;
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;

    const voice = this.pickBestVoice();
    if (voice) {
      utterance.voice = voice;
    }

    this.currentSpeakerId = options?.speakerId || 'raazi';
    this.currentUtterance = utterance;

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.currentSpeakerId = null;
      this.currentUtterance = null;
      options?.onEnd?.();
      this.onEndCallbacks.forEach((cb) => cb());
    };

    utterance.onerror = () => {
      this.currentSpeakerId = null;
      this.currentUtterance = null;
      options?.onEnd?.();
      this.onEndCallbacks.forEach((cb) => cb());
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }

  public stop(): void {
    if (!this.isSupported()) return;
    this.currentSpeakerId = null;
    this.currentUtterance = null;
    window.speechSynthesis.cancel();
  }

  public registerOnEnd(cb: () => void): () => void {
    this.onEndCallbacks.add(cb);
    return () => this.onEndCallbacks.delete(cb);
  }

  public getSuspectVoiceProfile(index: number): VoiceProfile {
    return SUSPECT_VOICE_PROFILES[index % SUSPECT_VOICE_PROFILES.length]!;
  }
}

export const voiceEngine = VoiceEngine.getInstance();
