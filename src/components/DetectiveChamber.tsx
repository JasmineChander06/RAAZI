import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Compass, Eye, FileText, Gavel, MapPin, Mic, MicOff, PlusCircle, Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type {
  ClueCategory,
  ClueNode,
  DecisionRank,
  DetectiveCase,
  InvestigationTurn,
} from '../types/mystery.ts';
import type { AmbientSoundscape } from '../engine/ambientAudio.ts';
import { AmbientSoundControl } from './AmbientSoundControl.tsx';
import { ImageClueUploader } from './ImageClueUploader.tsx';
import { voiceEngine } from '../engine/voiceEngine.ts';
import { speechInput } from '../engine/speechInput.ts';

interface DetectiveChamberProps {
  activeCase: DetectiveCase;
  clues: ClueNode[];
  messages: InvestigationTurn[];
  rankedDecisions: DecisionRank[];
  suggestedPrompts: string[];
  hasNextStage?: boolean;
  stalledTurns: number;
  ledgerOpen: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  onDismissError: () => void;
  onConsultOracle: () => void;
  onToggleLedger: () => void;
  onOpenNewCase: () => void;
  onOpenAccusation: () => void;
  onSelectClueInGraph: (clueId: string) => void;
  onOpenReport: () => void;
  onOpenMap?: () => void;
  onAdvanceNextStage?: () => void;
  ambientEnabled: boolean;
  ambientSoundscape: AmbientSoundscape;
  onToggleAmbient: () => void;
  onChangeSoundscape: (mode: AmbientSoundscape) => void;
  onSubmitTurn: (params: {
    userInput: string;
    mode: 'query' | 'clue';
    clueTitle?: string;
    clueCategory?: ClueCategory;
    askedQuestionId?: string;
    imageDataUrl?: string;
  }) => Promise<void>;
}

const DEFAULT_BANNER = '/src/assets/images/blackwood_manor_murder_1794878589143.jpg';

export function DetectiveChamber({
  activeCase,
  clues,
  messages,
  rankedDecisions,
  suggestedPrompts,
  hasNextStage,
  stalledTurns,
  ledgerOpen,
  isBusy,
  errorMessage,
  onDismissError,
  onConsultOracle,
  onToggleLedger,
  onOpenNewCase,
  onOpenAccusation,
  onSelectClueInGraph,
  onOpenReport,
  onOpenMap,
  onAdvanceNextStage,
  ambientEnabled,
  ambientSoundscape,
  onToggleAmbient,
  onChangeSoundscape,
  onSubmitTurn,
}: DetectiveChamberProps) {
  const [composerMode, setComposerMode] = useState<'query' | 'clue' | 'image'>('query');
  const [queryText, setQueryText] = useState('');
  const [clueTitle, setClueTitle] = useState('');
  const [clueCategory, setClueCategory] = useState<ClueCategory>('physical');
  const [bannerError, setBannerError] = useState(false);
  const [recentClueIds, setRecentClueIds] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speakingTurnId, setSpeakingTurnId] = useState<string | null>(null);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const dialogueEndRef = useRef<HTMLDivElement | null>(null);
  const prevCaseIdRef = useRef<string>(activeCase.id);
  const seenClueIdsRef = useRef<Set<string>>(
    new Set(clues.filter((c) => c.discovered).map((c) => c.id))
  );
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setBannerError(false);
  }, [activeCase.id]);

  useEffect(() => {
    if (messages.length > 1 || isBusy) {
      dialogueEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, isBusy]);

  const discoveredClues = clues.filter((c) => c.discovered);

  useEffect(() => {
    const currentIds = clues.filter((c) => c.discovered).map((c) => c.id);

    if (prevCaseIdRef.current !== activeCase.id) {
      prevCaseIdRef.current = activeCase.id;
      seenClueIdsRef.current = new Set(currentIds);
      setRecentClueIds([]);
      return;
    }

    const newlyAdded = currentIds.filter((id) => !seenClueIdsRef.current.has(id));
    if (newlyAdded.length === 0) return;

    for (const id of newlyAdded) {
      seenClueIdsRef.current.add(id);
    }
    setRecentClueIds((prev) => Array.from(new Set([...prev, ...newlyAdded])));

    const clearTimer = window.setTimeout(() => {
      setRecentClueIds((prev) => prev.filter((id) => !newlyAdded.includes(id)));
    }, 2400);

    return () => window.clearTimeout(clearTimer);
  }, [activeCase.id, clues]);

  const topSuspect = activeCase.suspects[0];
  const topDecision = rankedDecisions[0];
  const isSolved = activeCase.status !== 'active';

  useEffect(() => {
    return () => {
      voiceEngine.stop();
      speechInput.stop();
    };
  }, []);

  useEffect(() => {
    if (!autoVoiceEnabled || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'raazi') {
      setSpeakingTurnId(lastMsg.id);
      voiceEngine.speak(lastMsg.content, {
        speakerId: lastMsg.id,
        onEnd: () => setSpeakingTurnId((curr) => (curr === lastMsg.id ? null : curr)),
      });
    }
  }, [messages.length, autoVoiceEnabled]);

  const handleToggleSpeak = (turnId: string, content: string) => {
    if (speakingTurnId === turnId) {
      voiceEngine.stop();
      setSpeakingTurnId(null);
    } else {
      setSpeakingTurnId(turnId);
      voiceEngine.speak(content, {
        speakerId: turnId,
        onEnd: () => setSpeakingTurnId((curr) => (curr === turnId ? null : curr)),
      });
    }
  };

  const handleToggleListening = () => {
    setMicNotice(null);
    if (isListening) {
      speechInput.stop();
      setIsListening(false);
    } else {
      if (!speechInput.isSupported()) {
        setMicNotice('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }
      const success = speechInput.start({
        onTranscript: (transcript) => {
          setQueryText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        },
        onStateChange: (active) => {
          setIsListening(active);
        },
        onError: (err) => {
          setMicNotice(err);
          setIsListening(false);
        },
      });
      if (!success) {
        setIsListening(false);
      }
    }
  };

  const handleImageClueAnalyzed = async (analysis: {
    title: string;
    detail: string;
    category: ClueCategory;
    imageDataUrl: string;
  }) => {
    setComposerMode('query');
    await onSubmitTurn({
      userInput: `${analysis.detail} [Photographic evidence submitted: ${analysis.title}]`,
      mode: 'clue',
      clueTitle: analysis.title,
      clueCategory: analysis.category,
      imageDataUrl: analysis.imageDataUrl,
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || isSolved) return;
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const currentMode = composerMode;
    const currentTitle = clueTitle.trim();
    const currentCat = clueCategory;

    setQueryText('');
    if (currentMode === 'clue') {
      setClueTitle('');
    }

    await onSubmitTurn({
      userInput: trimmed,
      mode: currentMode,
      ...(currentMode === 'clue'
        ? { clueTitle: currentTitle || 'Field Observation', clueCategory: currentCat }
        : {}),
    });
  };

  return (
    <main className="flex-1 min-w-0 max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 space-y-10">
      {/* Case Dossier Header */}
      <section className="space-y-6">
        <div className="relative rounded-lg overflow-hidden border border-[#C9A45C]/20 bg-[#141210] min-h-[210px] sm:min-h-[240px] flex items-end">
          {!bannerError ? (
            <img
              src={activeCase.bannerImageUrl || DEFAULT_BANNER}
              alt={`Atmospheric illustration for ${activeCase.title}`}
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-55"
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,164,92,0.16),#141210_70%)]"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0B0A09] via-[#0B0A09]/70 to-transparent"
          />

          <div className="relative z-10 p-6 sm:p-8 w-full space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#C9A45C] tabular-nums">
              {activeCase.stageOrder ? (
                <>
                  <span className="font-mono text-[#B54842] font-semibold">
                    Stage 0{activeCase.stageOrder}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span>{activeCase.era}</span>
              <span aria-hidden="true">·</span>
              <span>{activeCase.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span>{discoveredClues.length} Clues Logged</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{activeCase.status}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[#E8DEC8] leading-tight">
              {activeCase.title}
            </h1>

            <p className="text-sm sm:text-base text-[#E8DEC8]/85 max-w-2xl leading-relaxed">
              {activeCase.synopsis}
            </p>
          </div>
        </div>

        {/* Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#C9A45C]/15">
          <div className="text-xs sm:text-sm text-[#9C9281] tabular-nums">
            {topSuspect ? (
              <span>
                Leading suspect: <strong className="text-[#E8DEC8] font-medium">{topSuspect.name}</strong> ({(topSuspect.posteriorProbability * 100).toFixed(1)}%)
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <AmbientSoundControl
              enabled={ambientEnabled}
              soundscape={ambientSoundscape}
              onToggleEnabled={onToggleAmbient}
              onChangeSoundscape={onChangeSoundscape}
            />

            <button
              type="button"
              onClick={() => {
                const next = !autoVoiceEnabled;
                setAutoVoiceEnabled(next);
                if (!next) voiceEngine.stop();
              }}
              aria-pressed={autoVoiceEnabled}
              className={`px-3 py-2 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                autoVoiceEnabled
                  ? 'border-[#C9A45C] bg-[#1C1915] text-[#C9A45C]'
                  : 'border-[#C9A45C]/25 bg-[#141210] text-[#E8DEC8] hover:text-[#C9A45C]'
              }`}
              title={autoVoiceEnabled ? 'Disable automatic voice narration' : 'Enable automatic voice narration for Raazi'}
            >
              {autoVoiceEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#C9A45C]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-[#9C9281]" />
              )}
              <span>{autoVoiceEnabled ? 'Voice Narrator On' : 'Voice Narrator'}</span>
            </button>

            {onOpenMap && (
              <button
                type="button"
                onClick={onOpenMap}
                className="px-3.5 py-2 text-xs font-medium bg-[#141210] border border-[#C9A45C]/25 text-[#E8DEC8] rounded-md hover:border-[#C9A45C] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>Mystery Map</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNewCase}
              className="px-3.5 py-2 text-xs font-medium bg-[#141210] border border-[#C9A45C]/25 text-[#E8DEC8] rounded-md hover:border-[#C9A45C] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>New Mystery</span>
            </button>

            <button
              type="button"
              onClick={onToggleLedger}
              className="px-3.5 py-2 text-xs font-medium bg-[#141210] border border-[#C9A45C]/25 text-[#E8DEC8] rounded-md hover:border-[#C9A45C] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>{ledgerOpen ? 'Hide AI Ledger' : 'Inspect AI Ledger'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenReport}
              className="px-3.5 py-2 text-xs font-medium bg-[#141210] border border-[#C9A45C]/25 text-[#E8DEC8] rounded-md hover:border-[#C9A45C] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>Case Report</span>
            </button>

            {!isSolved && (
              <button
                type="button"
                onClick={onOpenAccusation}
                className="px-4 py-2 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>Final Accusation</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Solved Case Verdict Banner */}
      {isSolved && (
        <section className="p-6 bg-[#141210] border border-[#C9A45C]/30 rounded-lg space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs font-mono uppercase tracking-wider">
            <span className={activeCase.solvedCorrectly ? 'text-[#5C8D76]' : 'text-[#B54842]'}>
              {activeCase.solvedCorrectly ? 'Deduction Confirmed' : 'Culprit Misidentified'}
            </span>
            <span className="text-[#9C9281]">Case Closed</span>
          </div>
          <h2 className="text-2xl font-serif font-semibold text-[#E8DEC8]">
            Archival Resolution
          </h2>
          <p className="text-sm text-[#E8DEC8]/90 leading-relaxed max-w-prose">
            {activeCase.solutionSummary}
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenReport}
              className="px-4 py-2 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Generate Final Case Report</span>
            </button>

            {activeCase.solvedCorrectly && hasNextStage && onAdvanceNextStage && (
              <button
                type="button"
                onClick={onAdvanceNextStage}
                className="px-4 py-2 text-xs font-semibold bg-[#B54842] text-[#E8DEC8] rounded-md hover:bg-[#c8554e] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Next Stage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenMap && (
              <button
                type="button"
                onClick={onOpenMap}
                className="px-4 py-2 text-xs font-medium bg-[#0B0A09] border border-[#C9A45C]/30 text-[#E8DEC8] rounded-md hover:border-[#C9A45C] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-[#C9A45C]" />
                <span>View Case Map</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Discovered Evidence Ledger Strip */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
            Discovered Evidence
          </h2>
          <span className="text-xs text-[#9C9281] tabular-nums">
            Click a clue to trace its BFS/DFS path
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <AnimatePresence mode="popLayout" initial={true}>
            {discoveredClues.map((clue, index) => {
              const recentIdx = recentClueIds.indexOf(clue.id);
              const isRecent = recentIdx !== -1;
              const staggerDelay = isRecent
                ? Math.min(recentIdx, 5) * 0.09
                : Math.min(index, 7) * 0.075;

              return (
                <motion.button
                  key={`${activeCase.id}-${clue.id}`}
                  layout={!prefersReducedMotion}
                  type="button"
                  initial={
                    prefersReducedMotion
                      ? false
                      : { opacity: 0, y: 18, scale: 0.96 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }
                  }
                  transition={{
                    duration: 0.48,
                    delay: prefersReducedMotion ? 0 : staggerDelay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                  onClick={() => onSelectClueInGraph(clue.id)}
                  className={`relative overflow-hidden text-left p-4 bg-[#141210] rounded-lg transition-colors cursor-pointer space-y-1.5 border ${
                    isRecent
                      ? 'border-[#C9A45C]/65 shadow-[0_10px_28px_rgba(201,164,92,0.12)]'
                      : 'border-[#C9A45C]/15 hover:border-[#C9A45C]/45'
                  }`}
                >
                  {isRecent && !prefersReducedMotion && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ scaleX: 0, opacity: 0.9 }}
                      animate={{ scaleX: 1, opacity: 0 }}
                      transition={{ duration: 1.4, delay: staggerDelay, ease: [0.16, 1, 0.3, 1] }}
                      className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] origin-left bg-gradient-to-r from-[#C9A45C] via-[#E8DEC8] to-transparent"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs text-[#9C9281]">
                    <span className="capitalize tabular-nums">
                      0{index + 1} · {clue.category}
                      {isRecent ? (
                        <span className="text-[#C9A45C] font-medium"> · Newly Logged</span>
                      ) : null}
                    </span>
                    <span className="font-mono text-[11px] text-[#C9A45C]">
                      {clue.source === 'user_submitted' ? 'Submitted' : 'Archive'}
                    </span>
                  </div>
                  <h3 className="text-base font-serif font-semibold text-[#E8DEC8]">
                    {clue.title}
                  </h3>
                  <p className="text-xs text-[#9C9281] leading-relaxed line-clamp-3">
                    {clue.detail}
                  </p>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* Dialogue & Deduction Stream */}
      <section className="space-y-6" aria-label="Investigation Dialogue">
        <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
          Chamber Dialogue
        </h2>

        <div className="space-y-6">
          {messages.map((turn) => {
            const isRaazi = turn.role === 'raazi';
            return (
              <article
                key={turn.id}
                className={`p-5 rounded-lg border ${
                  isRaazi
                    ? 'bg-[#141210] border-[#C9A45C]/15'
                    : 'bg-[#0B0A09] border-[#9C9281]/20 ml-0 sm:ml-10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9C9281] mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={isRaazi ? 'font-serif text-sm text-[#C9A45C] font-semibold' : 'font-medium text-[#E8DEC8]'}>
                      {isRaazi ? 'Raazi' : 'Investigator'}
                    </span>
                    {isRaazi && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(turn.id, turn.content)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-colors cursor-pointer ${
                          speakingTurnId === turn.id
                            ? 'bg-[#B54842]/20 border-[#B54842] text-[#B54842]'
                            : 'border-[#C9A45C]/25 text-[#C9A45C] hover:bg-[#C9A45C]/10'
                        }`}
                        title={speakingTurnId === turn.id ? 'Stop recitation' : 'Listen to Raazi recite this response'}
                      >
                        {speakingTurnId === turn.id ? (
                          <>
                            <VolumeX className="w-3 h-3 text-[#B54842]" />
                            <span className="font-mono text-[10px]">Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span className="font-mono text-[10px]">Listen</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {turn.nlpIntent || turn.topSuspectName ? (
                    <span className="font-mono text-[11px] tabular-nums">
                      {turn.nlpIntent ? `Intent: ${turn.nlpIntent}` : ''}
                      {turn.nlpIntent && turn.topSuspectName ? ' · ' : ''}
                      {turn.topSuspectName && typeof turn.topProbability === 'number'
                        ? `Lead: ${turn.topSuspectName} (${(turn.topProbability * 100).toFixed(1)}%)`
                        : ''}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm sm:text-[15px] text-[#E8DEC8] leading-relaxed whitespace-pre-line max-w-prose">
                  {turn.content}
                </div>
              </article>
            );
          })}

          {isBusy && (
            <div className="p-5 rounded-lg border border-[#C9A45C]/15 bg-[#141210] space-y-2.5 animate-pulse">
              <div className="text-xs font-mono text-[#C9A45C]">Raazi is analyzing clues and Bayesian weights…</div>
              <div className="h-3 w-full bg-[#1C1915] rounded" />
              <div className="h-3 w-4/5 bg-[#1C1915] rounded" />
            </div>
          )}
          <div ref={dialogueEndRef} />
        </div>
      </section>

      {/* Optimal Decision Recommendation + Composer */}
      {!isSolved && (
        <section className="space-y-4 pt-2 border-t border-[#C9A45C]/15">
          {errorMessage && (
            <div
              role="alert"
              className="p-4 bg-[#1C1915] border border-[#B54842]/50 rounded-lg flex items-start justify-between gap-4 text-sm"
            >
              <div className="space-y-1">
                <p className="font-medium text-[#E8DEC8]">Inquiry could not be completed</p>
                <p className="text-xs text-[#9C9281]">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={onDismissError}
                className="text-xs text-[#C9A45C] hover:underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
          {stalledTurns >= 3 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#141210] border border-[#B54842]/45 rounded-lg">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#B54842] font-mono tabular-nums">
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>Investigation Stalled · {stalledTurns} Inquiries Without New Evidence</span>
                </div>
                <p className="text-sm text-[#E8DEC8]/90">
                  Draw a context-aware hint about the next logical deduction step from your current clues.
                </p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={onConsultOracle}
                className="px-4 py-2 text-xs font-semibold bg-[#B54842] text-[#E8DEC8] hover:bg-[#c8554e] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Consult the Oracle
              </button>
            </div>
          )}

          {topDecision && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#141210] border border-[#C9A45C]/20 rounded-lg">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#C9A45C] font-mono tabular-nums">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Optimal Inquiry · +{topDecision.informationGainBits.toFixed(3)} bits IG</span>
                </div>
                <p className="text-sm text-[#E8DEC8]">{topDecision.prompt}</p>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  void onSubmitTurn({
                    userInput: topDecision.prompt,
                    mode: 'query',
                    askedQuestionId: topDecision.questionId,
                  })
                }
                className="px-4 py-2 text-xs font-medium border border-[#C9A45C]/40 text-[#E8DEC8] hover:bg-[#C9A45C] hover:text-[#0B0A09] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Ask Recommended
              </button>
            </div>
          )}

          {/* Dual-Mode Input Form */}
          <form
            onSubmit={(e) => void handleFormSubmit(e)}
            className="bg-[#141210] border border-[#C9A45C]/20 rounded-lg p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#0B0A09] rounded-md border border-[#C9A45C]/10 w-fit">
                <button
                  type="button"
                  onClick={() => setComposerMode('query')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    composerMode === 'query'
                      ? 'bg-[#1C1915] text-[#C9A45C]'
                      : 'text-[#9C9281] hover:text-[#E8DEC8]'
                  }`}
                >
                  Ask Raazi
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode('clue')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    composerMode === 'clue'
                      ? 'bg-[#1C1915] text-[#C9A45C]'
                      : 'text-[#9C9281] hover:text-[#E8DEC8]'
                  }`}
                >
                  Submit New Clue
                </button>
                <button
                  type="button"
                  onClick={() => setComposerMode('image')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                    composerMode === 'image'
                      ? 'bg-[#1C1915] text-[#C9A45C]'
                      : 'text-[#9C9281] hover:text-[#E8DEC8]'
                  }`}
                >
                  📎 Photo Clue
                </button>
              </div>

              <span className="text-[11px] text-[#9C9281]">
                {composerMode === 'query'
                  ? 'Press Enter to send · Type "I accuse [Name]" to solve stage'
                  : composerMode === 'image'
                  ? 'Upload a photo or sketch — Gemini will analyze it as evidence'
                  : 'Enter clue title, category, and observation'}
              </span>
            </div>

            {composerMode === 'query' && topSuspect && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-mono uppercase tracking-wider text-[#9C9281]">
                  Suggested Follow-Up Inquiries (Click to Ask Raazi)
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(suggestedPrompts.length > 0
                    ? suggestedPrompts
                    : [
                        'Explain the situation in detail',
                        'Who do you think is the prime suspect right now?',
                        `Question ${topSuspect.name}'s alibi timeline`,
                      ]
                  ).map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void onSubmitTurn({
                          userInput: sample,
                          mode: 'query',
                        })
                      }
                      className="text-left px-3 py-1.5 bg-[#0B0A09] border border-[#C9A45C]/20 hover:border-[#C9A45C] rounded text-[#E8DEC8]/90 hover:text-[#C9A45C] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {composerMode === 'image' && (
              <ImageClueUploader
                activeCase={activeCase}
                isBusy={isBusy}
                onImageClueAnalyzed={(analysis) => void handleImageClueAnalyzed(analysis)}
                onCancel={() => setComposerMode('query')}
              />
            )}

            {composerMode === 'clue' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={clueTitle}
                  onChange={(e) => setClueTitle(e.target.value)}
                  placeholder="Clue title (e.g., Torn Papyrus Edge)"
                  maxLength={140}
                  className="sm:col-span-2 bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3 py-2 text-sm text-[#E8DEC8] placeholder:text-[#9C9281]/60 focus:outline-none focus:border-[#C9A45C]"
                />
                <select
                  value={clueCategory}
                  onChange={(e) => setClueCategory(e.target.value as ClueCategory)}
                  className="bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3 py-2 text-sm text-[#E8DEC8] focus:outline-none focus:border-[#C9A45C]"
                >
                  <option value="physical">Physical</option>
                  <option value="testimony">Testimony</option>
                  <option value="alibi">Alibi</option>
                  <option value="cipher">Cipher</option>
                  <option value="location">Location</option>
                </select>
              </div>
            )}

            {composerMode !== 'image' && (
              <div className="space-y-2">
                {isListening && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#B54842]/15 border border-[#B54842]/30 text-xs text-[#E8DEC8] animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-[#B54842] animate-ping" />
                    <span className="font-medium text-[#B54842]">Microphone active:</span>
                    <span>Speak your inquiry clearly...</span>
                  </div>
                )}
                {micNotice && (
                  <div className="text-xs text-[#B54842] px-1">{micNotice}</div>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    rows={2}
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isBusy && queryText.trim()) {
                          void handleFormSubmit(e);
                        }
                      }
                    }}
                    placeholder={
                      isListening
                        ? 'Listening to speech... your words will appear here...'
                        : composerMode === 'clue'
                        ? 'Describe the clue or contradiction you discovered so Raazi can update Bayesian suspect weights...'
                        : 'Ask Raazi to interrogate a suspect, examine a contradiction, or explain clue connections...'
                    }
                    maxLength={1200}
                    className="flex-1 bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3.5 py-2.5 text-sm text-[#E8DEC8] placeholder:text-[#9C9281]/60 focus:outline-none focus:border-[#C9A45C] resize-y"
                  />
                  <div className="flex sm:flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleToggleListening}
                      title={isListening ? 'Stop listening' : 'Speak inquiry using microphone'}
                      className={`px-3 py-2.5 rounded-md border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isListening
                          ? 'bg-[#B54842] text-white border-[#B54842] shadow-[0_0_12px_rgba(181,72,66,0.5)]'
                          : 'bg-[#0B0A09] border-[#C9A45C]/25 text-[#E8DEC8] hover:border-[#C9A45C] hover:text-[#C9A45C]'
                      }`}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span className="text-xs sm:hidden">{isListening ? 'Listening…' : 'Speak'}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isBusy || !queryText.trim()}
                      className="flex-1 sm:flex-initial px-5 py-2.5 text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>{composerMode === 'clue' ? 'Log Clue' : 'Inquire'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </section>
      )}
    </main>
  );
}
