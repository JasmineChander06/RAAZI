import { Volume2, VolumeX } from 'lucide-react';
import type { AmbientSoundscape } from '../engine/ambientAudio.ts';

interface AmbientSoundControlProps {
  enabled: boolean;
  soundscape: AmbientSoundscape;
  onToggleEnabled: () => void;
  onChangeSoundscape: (mode: AmbientSoundscape) => void;
}

export function AmbientSoundControl({
  enabled,
  soundscape,
  onToggleEnabled,
  onChangeSoundscape,
}: AmbientSoundControlProps) {
  return (
    <div className="inline-flex items-center rounded-md border border-[#C9A45C]/25 bg-[#141210] overflow-hidden">
      <button
        type="button"
        onClick={onToggleEnabled}
        aria-pressed={enabled}
        aria-label={enabled ? 'Mute ambient sound' : 'Play ambient sound'}
        className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
          enabled
            ? 'text-[#C9A45C] bg-[#1C1915]'
            : 'text-[#E8DEC8] hover:text-[#C9A45C]'
        }`}
      >
        {enabled ? (
          <Volume2 className="w-3.5 h-3.5 text-[#C9A45C]" />
        ) : (
          <VolumeX className="w-3.5 h-3.5 text-[#9C9281]" />
        )}
        <span>{enabled ? 'Sound On' : 'Ambient Sound'}</span>
      </button>

      <div className="flex items-center border-l border-[#C9A45C]/15">
        <button
          type="button"
          onClick={() => onChangeSoundscape('violin')}
          className={`px-2.5 py-2 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
            soundscape === 'violin'
              ? 'text-[#E8DEC8] bg-[#1C1915]'
              : 'text-[#9C9281] hover:text-[#E8DEC8]'
          }`}
          title="Low-fidelity mysterious violin"
        >
          Violin
        </button>
        <button
          type="button"
          onClick={() => onChangeSoundscape('chimes')}
          className={`px-2.5 py-2 text-[11px] font-medium border-l border-[#C9A45C]/10 transition-colors whitespace-nowrap cursor-pointer ${
            soundscape === 'chimes'
              ? 'text-[#E8DEC8] bg-[#1C1915]'
              : 'text-[#9C9281] hover:text-[#E8DEC8]'
          }`}
          title="Ancient wind chimes"
        >
          Chimes
        </button>
      </div>
    </div>
  );
}
