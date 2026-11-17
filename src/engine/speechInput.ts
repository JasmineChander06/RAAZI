/**
 * RAAZI Speech Input Engine (Speech-to-Text)
 * Wraps browser SpeechRecognition to enable spoken inquiries and interrogations.
 */

// Typing for browser SpeechRecognition
interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export class SpeechInputEngine {
  private recognition: SpeechRecognitionLike | null = null;
  private isListening = false;
  private onTranscriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onStateChangeCallback: ((isListening: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;
    const Recognizer = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognizer) return;

    try {
      this.recognition = new Recognizer();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let transcript = '';
        let isFinal = false;

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]) {
            transcript += item[0].transcript;
            if (item.isFinal) {
              isFinal = true;
            }
          }
        }

        if (this.onTranscriptCallback && transcript.trim()) {
          this.onTranscriptCallback(transcript.trim(), isFinal);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        this.isListening = false;
        this.onStateChangeCallback?.(false);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          this.onErrorCallback?.(`Microphone error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onStateChangeCallback?.(false);
      };
    } catch {
      this.recognition = null;
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public start(callbacks: {
    onTranscript: (transcript: string, isFinal: boolean) => void;
    onStateChange: (isListening: boolean) => void;
    onError?: (error: string) => void;
  }): boolean {
    if (!this.recognition) return false;

    this.onTranscriptCallback = callbacks.onTranscript;
    this.onStateChangeCallback = callbacks.onStateChange;
    this.onErrorCallback = callbacks.onError || null;

    try {
      this.recognition.start();
      this.isListening = true;
      this.onStateChangeCallback?.(true);
      return true;
    } catch (err) {
      this.isListening = false;
      this.onStateChangeCallback?.(false);
      this.onErrorCallback?.(err instanceof Error ? err.message : 'Unable to activate microphone');
      return false;
    }
  }

  public stop(): void {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch {
      // Ignore
    } finally {
      this.isListening = false;
      this.onStateChangeCallback?.(false);
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechInput = new SpeechInputEngine();
