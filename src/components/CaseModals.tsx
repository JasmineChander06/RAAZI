import { useState } from 'react';
import { X } from 'lucide-react';
import type { DifficultyLevel, Suspect } from '../types/mystery.ts';

interface NewCaseModalProps {
  open: boolean;
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: (params: {
    era: string;
    themePrompt: string;
    difficulty: DifficultyLevel;
  }) => Promise<void>;
}

const MYSTERY_TYPE_OPTIONS = [
  {
    id: 'murder',
    label: 'Murder Mystery',
    era: '1928 English Country Estate · Manor Murder',
    prompt:
      'A wealthy host is found fatally poisoned behind a locked study door while four guests swear unbroken alibis.',
  },
  {
    id: 'ancient',
    label: 'Ancient Mystery',
    era: '240 BCE Alexandria Observatory · Ancient Scroll & Murder',
    prompt:
      'A sacred bronze astrolabe plate vanishes from a sealed temple dome beside a slain watchman.',
  },
  {
    id: 'heist',
    label: 'Heist & Cipher Mystery',
    era: '1912 Maritime Exchange · Vault & Cipher Theft',
    prompt:
      'Confidential cipher keys vanish from a time-locked safe without triggering a single corridor alarm.',
  },
] as const;

export function NewCaseModal({
  open,
  isGenerating,
  onClose,
  onGenerate,
}: NewCaseModalProps) {
  const [selectedType, setSelectedType] = useState<'murder' | 'ancient' | 'heist'>('murder');
  const [era, setEra] = useState<string>(MYSTERY_TYPE_OPTIONS[0].era);
  const [themePrompt, setThemePrompt] = useState<string>(MYSTERY_TYPE_OPTIONS[0].prompt);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Novice');

  if (!open) return null;

  const handleSelectType = (typeId: 'murder' | 'ancient' | 'heist') => {
    setSelectedType(typeId);
    const match = MYSTERY_TYPE_OPTIONS.find((opt) => opt.id === typeId);
    if (match) {
      setEra(match.era);
      setThemePrompt(match.prompt);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
    await onGenerate({ era, themePrompt, difficulty });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-case-title"
      className="fixed inset-0 z-40 bg-[#0B0A09]/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="max-w-lg w-full bg-[#141210] border border-[#C9A45C]/25 rounded-lg p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#B54842]">
              Custom Case Synthesis
            </p>
            <h2 id="new-case-title" className="text-2xl font-serif font-semibold text-[#E8DEC8]">
              Generate New Mystery
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close modal"
            className="p-1.5 text-[#9C9281] hover:text-[#E8DEC8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#E8DEC8]">
              Mystery Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MYSTERY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectType(opt.id)}
                  className={`py-2 px-2.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                    selectedType === opt.id
                      ? 'bg-[#C9A45C] text-[#0B0A09] border-[#C9A45C] font-semibold'
                      : 'bg-[#0B0A09] text-[#9C9281] border-[#C9A45C]/20 hover:text-[#E8DEC8]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#E8DEC8]">
              Setting &amp; Era
            </label>
            <input
              type="text"
              value={era}
              onChange={(e) => setEra(e.target.value)}
              maxLength={80}
              required
              className="w-full bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3 py-2 text-sm text-[#E8DEC8] focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#E8DEC8]">
              Mystery Scenario or Premise
            </label>
            <textarea
              rows={3}
              value={themePrompt}
              onChange={(e) => setThemePrompt(e.target.value)}
              maxLength={400}
              required
              className="w-full bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3 py-2 text-sm text-[#E8DEC8] focus:outline-none focus:border-[#C9A45C]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#E8DEC8]">
              Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { level: 'Novice', label: 'Easy (Novice)' },
                { level: 'Adept', label: 'Medium (Adept)' },
                { level: 'Master', label: 'Hard (Master)' },
              ] as const).map((item) => (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => setDifficulty(item.level)}
                  className={`py-2 px-3 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                    difficulty === item.level
                      ? 'bg-[#C9A45C] text-[#0B0A09] border-[#C9A45C] font-semibold'
                      : 'bg-[#0B0A09] text-[#9C9281] border-[#C9A45C]/20 hover:text-[#E8DEC8]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-medium text-[#9C9281] hover:text-[#E8DEC8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating || !themePrompt.trim()}
              className="px-5 py-2.5 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? 'Synthesizing Case…' : 'Open Dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AccusationModalProps {
  open: boolean;
  suspects: Suspect[];
  onClose: () => void;
  onConfirmAccusation: (suspectId: string) => Promise<void>;
}

export function AccusationModal({
  open,
  suspects,
  onClose,
  onConfirmAccusation,
}: AccusationModalProps) {
  const [selectedId, setSelectedId] = useState(suspects[0]?.id ?? '');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const currentSelection = suspects.some((s) => s.id === selectedId)
    ? selectedId
    : suspects[0]?.id ?? '';

  const handleConfirm = async () => {
    if (!currentSelection || submitting) return;
    setSubmitting(true);
    try {
      await onConfirmAccusation(currentSelection);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accuse-title"
      className="fixed inset-0 z-40 bg-[#0B0A09]/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="max-w-lg w-full bg-[#141210] border border-[#C9A45C]/25 rounded-lg p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C9A45C]">
              Final Deduction
            </p>
            <h2 id="accuse-title" className="text-2xl font-serif font-semibold text-[#E8DEC8]">
              Name the Culprit
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close accusation dialog"
            className="p-1.5 text-[#9C9281] hover:text-[#E8DEC8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#9C9281] leading-relaxed">
          Submitting your final accusation closes the ledger and reveals the ground truth against our Bayesian ranking.
        </p>

        <div className="space-y-2.5">
          {suspects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left p-3.5 rounded-md border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                currentSelection === s.id
                  ? 'bg-[#1C1915] border-[#C9A45C]'
                  : 'bg-[#0B0A09] border-[#C9A45C]/15 hover:border-[#C9A45C]/40'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-[#E8DEC8]">{s.name}</p>
                <p className="text-xs text-[#9C9281]">{s.role}</p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#C9A45C]">
                {(s.posteriorProbability * 100).toFixed(1)}%
              </span>
            </button>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#9C9281] hover:text-[#E8DEC8] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !currentSelection}
            onClick={() => void handleConfirm()}
            className="px-5 py-2.5 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Sealing Verdict…' : 'Confirm Accusation'}
          </button>
        </div>
      </div>
    </div>
  );
}
