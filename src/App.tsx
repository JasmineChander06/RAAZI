import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './firebase.ts';
import {
  deleteCaseFromArchive,
  ensureUserProfile,
  finalizeCaseAccusation,
  loadCaseDetails,
  persistInvestigationStep,
  recordCampaignStageCompletion,
  saveNewCaseToFirestore,
  subscribeUserCases,
} from './services/firestoreCases.ts';
import { CAMPAIGN_STAGES } from './data/campaignCases.ts';
import { createStarterCase } from './data/starterCase.ts';
import { rankNextQuestions, recomputePosteriorFromEvidence } from './engine/aiAlgorithms.ts';
import { generateOracleHint } from './engine/oracleHints.ts';
import type {
  CampaignStage,
  ClueCategory,
  ClueNode,
  DecisionRank,
  DetectiveCase,
  DifficultyLevel,
  InvestigateTurnPayload,
  InvestigationTurn,
} from './types/mystery.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { CipherGateIntro } from './components/CipherGateIntro.tsx';
import { TopBar, type WorkspaceView } from './components/TopBar.tsx';
import { DetectiveChamber } from './components/DetectiveChamber.tsx';
import { AiLedgerDrawer } from './components/AiLedgerDrawer.tsx';
import { ArchivesView } from './components/ArchivesView.tsx';
import { CampaignMapView } from './components/CampaignMapView.tsx';
import { MethodologyView } from './components/MethodologyView.tsx';
import { AccusationModal, NewCaseModal } from './components/CaseModals.tsx';
import { CaseReportModal } from './components/CaseReportModal.tsx';
import { AuthGateScreen, AuthModal } from './components/AuthModal.tsx';
import { AmbientAudioEngine, type AmbientSoundscape } from './engine/ambientAudio.ts';

const GUEST_PROGRESS_STORAGE_KEY = 'raazi_campaign_progress_v1';

function readGuestProgress(): { unlockedStage: number; completedStageIds: string[] } {
  try {
    const raw = localStorage.getItem(GUEST_PROGRESS_STORAGE_KEY);
    if (!raw) return { unlockedStage: 1, completedStageIds: [] };
    const parsed = JSON.parse(raw) as { unlockedStage?: number; completedStageIds?: string[] };
    return {
      unlockedStage: typeof parsed.unlockedStage === 'number' && parsed.unlockedStage >= 1 ? parsed.unlockedStage : 1,
      completedStageIds: Array.isArray(parsed.completedStageIds) ? parsed.completedStageIds : [],
    };
  } catch {
    return { unlockedStage: 1, completedStageIds: [] };
  }
}

function writeGuestProgress(unlockedStage: number, completedStageIds: string[]) {
  try {
    localStorage.setItem(
      GUEST_PROGRESS_STORAGE_KEY,
      JSON.stringify({ unlockedStage, completedStageIds })
    );
  } catch {
    // Ignore storage errors
  }
}

function getDefaultPromptsForCase(caseData: DetectiveCase): string[] {
  const lead = caseData.suspects[0]?.name ?? 'the leading suspect';
  return [
    'Explain the situation in detail',
    'Who do you think is the prime suspect right now?',
    `Question ${lead}'s alibi timeline`,
  ];
}

function makeClientId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function RaaziWorkspace() {
  const starter = useMemo(() => createStarterCase(), []);

  const [gateStage, setGateStage] = useState<'intro' | 'auth' | 'chamber'>('intro');
  const [activeView, setActiveView] = useState<WorkspaceView>('chamber');
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const initialGuestProgress = useMemo(() => readGuestProgress(), []);

  // Firebase Auth & Archives State
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [archivedCases, setArchivedCases] = useState<DetectiveCase[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);

  // Campaign Map Progression State
  const [unlockedStage, setUnlockedStage] = useState<number>(initialGuestProgress.unlockedStage);
  const [completedStageIds, setCompletedStageIds] = useState<string[]>(
    initialGuestProgress.completedStageIds
  );

  // Active Investigation State
  const [activeCase, setActiveCase] = useState<DetectiveCase>(starter.caseData);
  const [clues, setClues] = useState<ClueNode[]>(starter.clues);
  const [messages, setMessages] = useState<InvestigationTurn[]>(starter.messages);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(() =>
    getDefaultPromptsForCase(starter.caseData)
  );
  const [stalledTurns, setStalledTurns] = useState(0);
  const [lastOracleHint, setLastOracleHint] = useState<string | null>(null);
  const [selectedStartClueId, setSelectedStartClueId] = useState<string>(
    starter.clues[0]?.id ?? ''
  );

  // UI & Async Control State
  const [isBusy, setIsBusy] = useState(false);
  const [isGeneratingCase, setIsGeneratingCase] = useState(false);
  const [newCaseModalOpen, setNewCaseModalOpen] = useState(false);
  const [accusationModalOpen, setAccusationModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ambient Soundscape State
  const audioEngine = useMemo(() => new AmbientAudioEngine(), []);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [ambientSoundscape, setAmbientSoundscape] = useState<AmbientSoundscape>('violin');

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, [audioEngine]);

  const rankedDecisions = useMemo(
    () => rankNextQuestions(activeCase.suspects, activeCase.candidateQuestions ?? []),
    [activeCase.suspects, activeCase.candidateQuestions]
  );

  // Subscribe to Firebase Auth state & user archives
  useEffect(() => {
    let unsubscribeCases: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (unsubscribeCases) {
        unsubscribeCases();
        unsubscribeCases = undefined;
      }

      if (nextUser) {
        setGateStage((prev) => (prev === 'auth' ? 'chamber' : prev));
        setArchivesLoading(true);
        try {
          const profile = await ensureUserProfile(nextUser);
          setUnlockedStage(profile.unlockedStage);
          setCompletedStageIds(profile.completedStageIds);
          unsubscribeCases = subscribeUserCases(
            nextUser.uid,
            (items) => {
              setArchivedCases(items);
              setArchivesLoading(false);
            },
            (err) => {
              setErrorMessage(err.message);
              setArchivesLoading(false);
            }
          );
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to load investigator profile.');
          setArchivesLoading(false);
        }
      } else {
        const guestProg = readGuestProgress();
        setUnlockedStage(guestProg.unlockedStage);
        setCompletedStageIds(guestProg.completedStageIds);
        setArchivedCases([]);
        setArchivesLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCases) unsubscribeCases();
    };
  }, []);

  const handleOpenSignIn = () => {
    setErrorMessage(null);
    setAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-out failed.');
    }
  };

  const handleSelectArchivedCase = async (caseItem: DetectiveCase) => {
    if (!user) return;
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const details = await loadCaseDetails(user.uid, caseItem.id);
      const syncedSuspects = recomputePosteriorFromEvidence(caseItem.suspects, details.clues);
      setActiveCase({ ...caseItem, suspects: syncedSuspects });
      setClues(details.clues);
      setMessages(details.messages);
      setSuggestedPrompts(getDefaultPromptsForCase({ ...caseItem, suspects: syncedSuspects }));
      setStalledTurns(0);
      setLastOracleHint(null);
      setSelectedStartClueId(details.clues.find((c) => c.discovered)?.id ?? '');
      setActiveView('chamber');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to open archived dossier.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteArchivedCase = async (caseId: string) => {
    if (!user) return;
    setErrorMessage(null);
    try {
      await deleteCaseFromArchive(user.uid, caseId);
      if (activeCase.id === caseId) {
        const fresh = createStarterCase();
        setActiveCase(fresh.caseData);
        setClues(fresh.clues);
        setMessages(fresh.messages);
        setSuggestedPrompts(getDefaultPromptsForCase(fresh.caseData));
        setStalledTurns(0);
        setLastOracleHint(null);
        setSelectedStartClueId(fresh.clues[0]?.id ?? '');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not delete archived dossier.');
    }
  };

  const handleStartStage = async (stage: CampaignStage) => {
    setErrorMessage(null);

    // Resume archived copy if user already opened this stage previously
    if (user) {
      const existing = archivedCases.find((c) => c.stageId === stage.stageId);
      if (existing) {
        await handleSelectArchivedCase(existing);
        return;
      }
    }

    const bundle = stage.createBundle();
    let finalCase = bundle.caseData;

    if (user) {
      setIsBusy(true);
      try {
        const savedId = await saveNewCaseToFirestore(
          user.uid,
          bundle.caseData,
          bundle.clues,
          bundle.messages
        );
        finalCase = { ...bundle.caseData, id: savedId, ownerId: user.uid };
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not save stage dossier.');
      } finally {
        setIsBusy(false);
      }
    }

    setActiveCase(finalCase);
    setClues(bundle.clues);
    setMessages(bundle.messages);
    setSuggestedPrompts(getDefaultPromptsForCase(finalCase));
    setStalledTurns(0);
    setLastOracleHint(null);
    setSelectedStartClueId(bundle.clues[0]?.id ?? '');
    setActiveView('chamber');
  };

  const handleGenerateNewCase = async (params: {
    era: string;
    themePrompt: string;
    difficulty: DifficultyLevel;
  }) => {
    setIsGeneratingCase(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/cases/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          ownerId: user?.uid ?? 'guest',
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        caseData?: DetectiveCase;
        clues?: ClueNode[];
        messages?: InvestigationTurn[];
      };
      if (!res.ok || !data.caseData || !data.clues || !data.messages) {
        throw new Error(data.error || 'Case synthesis failed.');
      }

      let finalCase = data.caseData;
      if (user) {
        const savedId = await saveNewCaseToFirestore(
          user.uid,
          data.caseData,
          data.clues,
          data.messages
        );
        finalCase = { ...data.caseData, id: savedId, ownerId: user.uid };
      }

      setActiveCase(finalCase);
      setClues(data.clues);
      setMessages(data.messages);
      setSuggestedPrompts(getDefaultPromptsForCase(finalCase));
      setStalledTurns(0);
      setLastOracleHint(null);
      setSelectedStartClueId(data.clues.find((c) => c.discovered)?.id ?? '');
      setNewCaseModalOpen(false);
      setActiveView('chamber');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to generate new mystery.');
    } finally {
      setIsGeneratingCase(false);
    }
  };

  const handleSubmitTurn = async (params: {
    userInput: string;
    mode: 'query' | 'clue';
    clueTitle?: string;
    clueCategory?: ClueCategory;
    askedQuestionId?: string;
    imageDataUrl?: string;
  }) => {
    setIsBusy(true);
    setErrorMessage(null);

    const userTurnId = makeClientId('turn_u');
    const raaziTurnId = makeClientId('turn_r');
    const ownerId = user?.uid ?? 'guest';

    const userTurn: InvestigationTurn = {
      id: userTurnId,
      ownerId,
      caseId: activeCase.id,
      role: 'investigator',
      content:
        params.mode === 'clue' && params.clueTitle
          ? `[Clue Logged: ${params.clueTitle}] ${params.userInput}`
          : params.userInput,
    };

    const nextMessages = [...messages, userTurn];
    setMessages(nextMessages);

    try {
      const res = await fetch('/api/investigate/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseData: activeCase,
          clues,
          messages: nextMessages,
          ...params,
        }),
      });
      const payload = (await res.json()) as InvestigateTurnPayload & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Investigation turn failed.');
      }

      let updatedClues = clues.map((c) => ({ ...c }));
      let newlyCreatedClue: ClueNode | undefined;

      if (payload.discoveredClue) {
        newlyCreatedClue = {
          ...payload.discoveredClue,
          ownerId,
          caseId: activeCase.id,
        };
        updatedClues.push(newlyCreatedClue);
      }

      if (payload.revealedClueIds && payload.revealedClueIds.length > 0) {
        const revealedSet = new Set(payload.revealedClueIds);
        updatedClues = updatedClues.map((c) =>
          revealedSet.has(c.id) ? { ...c, discovered: true } : c
        );
      }

      const updatedQuestions = (activeCase.candidateQuestions ?? []).map((q) =>
        params.askedQuestionId && q.id === params.askedQuestionId ? { ...q, asked: true } : q
      );

      const topSuspect = payload.updatedSuspects[0];
      const raaziTurn: InvestigationTurn = {
        id: raaziTurnId,
        ownerId,
        caseId: activeCase.id,
        role: 'raazi',
        content: payload.raaziReply,
        nlpIntent: payload.nlpAnalysis.intent,
        topSuspectName: topSuspect?.name,
        topProbability: topSuspect?.posteriorProbability,
      };

      const finalMessages = [...nextMessages, raaziTurn];
      const nextClueCount = updatedClues.filter((c) => c.discovered).length;
      const nextTurnCount = finalMessages.length;

      const updatedCaseSnapshot: DetectiveCase = {
        ...activeCase,
        suspects: payload.updatedSuspects,
        clueCount: nextClueCount,
        turnCount: nextTurnCount,
        candidateQuestions: updatedQuestions,
      };

      setClues(updatedClues);
      setMessages(finalMessages);
      if (payload.suggestedPrompts && payload.suggestedPrompts.length > 0) {
        setSuggestedPrompts(payload.suggestedPrompts);
      }
      setActiveCase(updatedCaseSnapshot);

      const madeProgress =
        params.mode === 'clue' ||
        Boolean(payload.discoveredClue) ||
        Boolean(payload.revealedClueIds && payload.revealedClueIds.length > 0) ||
        Boolean(payload.accuseSuspectId);

      setStalledTurns((prev) => (madeProgress ? 0 : prev + 1));

      if (user && activeCase.ownerId === user.uid) {
        await persistInvestigationStep({
          uid: user.uid,
          caseId: activeCase.id,
          updatedSuspects: payload.updatedSuspects,
          clueCount: nextClueCount,
          turnCount: nextTurnCount,
          candidateQuestions: updatedQuestions,
          newClue: newlyCreatedClue,
          revealedClueIds: payload.revealedClueIds,
          newMessages: [userTurn, raaziTurn],
        });
      }

      if (
        payload.accuseSuspectId &&
        updatedCaseSnapshot.suspects.some((s) => s.id === payload.accuseSuspectId)
      ) {
        await handleConfirmAccusation(payload.accuseSuspectId, updatedCaseSnapshot);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to process inquiry with Raazi.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleConsultOracle = async () => {
    if (isBusy || activeCase.status !== 'active') return;
    const hintText = generateOracleHint({
      activeCase,
      clues,
      rankedDecisions,
      previousHint: lastOracleHint,
    });

    const ownerId = user?.uid ?? 'guest';
    const lead = activeCase.suspects[0];
    const oracleTurn: InvestigationTurn = {
      id: makeClientId('turn_oracle'),
      ownerId,
      caseId: activeCase.id,
      role: 'raazi',
      content: hintText,
      nlpIntent: 'oracle_hint',
      topSuspectName: lead?.name,
      topProbability: lead?.posteriorProbability,
    };

    const nextMessages = [...messages, oracleTurn];
    const nextTurnCount = nextMessages.length;

    setMessages(nextMessages);
    setLastOracleHint(hintText);
    setStalledTurns(0);
    setActiveCase((prev) => ({
      ...prev,
      turnCount: nextTurnCount,
    }));

    if (user && activeCase.ownerId === user.uid) {
      try {
        await persistInvestigationStep({
          uid: user.uid,
          caseId: activeCase.id,
          updatedSuspects: activeCase.suspects,
          clueCount: activeCase.clueCount,
          turnCount: nextTurnCount,
          candidateQuestions: activeCase.candidateQuestions ?? [],
          newMessages: [oracleTurn],
        });
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not archive Oracle guidance.'
        );
      }
    }
  };

  const handleConfirmAccusation = async (
    suspectId: string,
    caseOverride?: DetectiveCase
  ) => {
    const targetCase = caseOverride ?? activeCase;
    const accused = targetCase.suspects.find((s) => s.id === suspectId);
    const culprit = targetCase.suspects.find((s) => s.id === targetCase.culpritId);
    const solvedCorrectly = suspectId === targetCase.culpritId;

    const ownerId = user?.uid ?? 'guest';
    const closingTurn: InvestigationTurn = {
      id: makeClientId('turn_verdict'),
      ownerId,
      caseId: targetCase.id,
      role: 'raazi',
      content: solvedCorrectly
        ? `Your deduction strikes true. ${accused?.name ?? 'The accused'} was indeed the culprit.\n\n${targetCase.solutionSummary}`
        : `A tragic misdirection. You named ${accused?.name ?? 'the wrong suspect'}, yet the true culprit was ${culprit?.name ?? 'another'}.\n\n${targetCase.solutionSummary}`,
      nlpIntent: 'final_verdict',
      topSuspectName: culprit?.name,
      topProbability: culprit?.posteriorProbability,
    };

    setActiveCase((prev) => ({
      ...prev,
      status: 'solved',
      accusedSuspectId: suspectId,
      solvedCorrectly,
    }));
    setMessages((prev) => [...prev, closingTurn]);
    setAccusationModalOpen(false);

    if (solvedCorrectly && targetCase.stageId && targetCase.stageOrder) {
      const nextStageOrder = Math.min(3, Math.max(unlockedStage, targetCase.stageOrder + 1));
      const nextCompleted = completedStageIds.includes(targetCase.stageId)
        ? completedStageIds
        : [...completedStageIds, targetCase.stageId];

      setUnlockedStage(nextStageOrder);
      setCompletedStageIds(nextCompleted);
      writeGuestProgress(nextStageOrder, nextCompleted);

      if (user) {
        try {
          await recordCampaignStageCompletion(user.uid, targetCase.stageId, nextStageOrder);
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Could not update campaign map progression.'
          );
        }
      }
    }

    if (user && targetCase.ownerId === user.uid) {
      try {
        await finalizeCaseAccusation({
          uid: user.uid,
          caseId: targetCase.id,
          accusedSuspectId: suspectId,
          solvedCorrectly,
          closingTurn,
        });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not save final verdict.');
      }
    }
  };

  const handleSelectClueInGraph = (clueId: string) => {
    setSelectedStartClueId(clueId);
    setLedgerOpen(true);
  };

  const handleAskDecisionQuestion = (decision: DecisionRank) => {
    void handleSubmitTurn({
      userInput: decision.prompt,
      mode: 'query',
      askedQuestionId: decision.questionId,
    });
  };

  const handleToggleAmbient = () => {
    if (ambientEnabled) {
      audioEngine.stop();
      setAmbientEnabled(false);
    } else {
      setAmbientEnabled(true);
      void audioEngine.start(ambientSoundscape);
    }
  };

  const handleChangeSoundscape = (nextMode: AmbientSoundscape) => {
    setAmbientSoundscape(nextMode);
    if (ambientEnabled) {
      void audioEngine.start(nextMode);
    } else {
      setAmbientEnabled(true);
      void audioEngine.start(nextMode);
    }
  };

  return (
    <>
      <div id="raazi-app-shell" className="min-h-screen bg-[#0B0A09] text-[#E8DEC8] flex flex-col">
        {gateStage === 'intro' && (
          <CipherGateIntro onEnter={() => setGateStage(user ? 'chamber' : 'auth')} />
        )}
        {gateStage === 'auth' && !user && (
          <AuthGateScreen
            onAuthenticated={() => setGateStage('chamber')}
            onContinueAsGuest={() => setGateStage('chamber')}
            onBackToIntro={() => setGateStage('intro')}
          />
        )}

      <TopBar
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        ledgerOpen={ledgerOpen}
        onToggleLedger={() => {
          setActiveView('chamber');
          setLedgerOpen((prev) => !prev);
        }}
        isSignedIn={Boolean(user)}
        onSignIn={handleOpenSignIn}
        onOpenNewCase={() => setNewCaseModalOpen(true)}
      />

      {activeView === 'chamber' && (
        <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] mx-auto w-full">
          <DetectiveChamber
            activeCase={activeCase}
            clues={clues}
            messages={messages}
            rankedDecisions={rankedDecisions}
            suggestedPrompts={suggestedPrompts}
            hasNextStage={Boolean(
              CAMPAIGN_STAGES.find((s) => s.stageId === activeCase.stageId) &&
                (activeCase.stageOrder ?? 0) < 3
            )}
            stalledTurns={stalledTurns}
            ledgerOpen={ledgerOpen}
            isBusy={isBusy}
            errorMessage={errorMessage}
            onDismissError={() => setErrorMessage(null)}
            onConsultOracle={() => void handleConsultOracle()}
            onToggleLedger={() => setLedgerOpen((prev) => !prev)}
            onOpenNewCase={() => setNewCaseModalOpen(true)}
            onOpenAccusation={() => setAccusationModalOpen(true)}
            onSelectClueInGraph={handleSelectClueInGraph}
            onOpenReport={() => setReportModalOpen(true)}
            onOpenMap={() => setActiveView('map')}
            onAdvanceNextStage={() => {
              const current = CAMPAIGN_STAGES.find((s) => s.stageId === activeCase.stageId);
              if (!current) return;
              const next = CAMPAIGN_STAGES.find(
                (s) =>
                  s.categoryId === current.categoryId &&
                  s.stageOrder === current.stageOrder + 1
              );
              if (next) {
                void handleStartStage(next);
              }
            }}
            ambientEnabled={ambientEnabled}
            ambientSoundscape={ambientSoundscape}
            onToggleAmbient={handleToggleAmbient}
            onChangeSoundscape={handleChangeSoundscape}
            onSubmitTurn={handleSubmitTurn}
          />

          <AiLedgerDrawer
            open={ledgerOpen}
            onClose={() => setLedgerOpen(false)}
            suspects={activeCase.suspects}
            clues={clues}
            rankedDecisions={rankedDecisions}
            selectedStartClueId={selectedStartClueId}
            onSelectStartClue={(id) => setSelectedStartClueId(id)}
            onAskDecisionQuestion={handleAskDecisionQuestion}
            isBusy={isBusy}
          />
        </div>
      )}

      {activeView === 'map' && (
        <CampaignMapView
          completedStageIds={completedStageIds}
          activeStageId={activeCase.stageId}
          onStartStage={(stage) => void handleStartStage(stage)}
        />
      )}

      {activeView === 'archives' && (
        <ArchivesView
          user={user}
          cases={
            user
              ? archivedCases
              : [activeCase]
          }
          activeCaseId={activeCase.id}
          loading={archivesLoading}
          onSignIn={handleOpenSignIn}
          onSignOut={() => void handleSignOut()}
          onSelectCase={(item) => {
            if (user && item.ownerId === user.uid) {
              void handleSelectArchivedCase(item);
            } else {
              setActiveView('chamber');
            }
          }}
          onDeleteCase={(id) => void handleDeleteArchivedCase(id)}
          onOpenNewCase={() => setNewCaseModalOpen(true)}
        />
      )}

      {activeView === 'methodology' && <MethodologyView />}

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <NewCaseModal
        open={newCaseModalOpen}
        isGenerating={isGeneratingCase}
        onClose={() => setNewCaseModalOpen(false)}
        onGenerate={handleGenerateNewCase}
      />

      <AccusationModal
        open={accusationModalOpen}
        suspects={activeCase.suspects}
        onClose={() => setAccusationModalOpen(false)}
        onConfirmAccusation={handleConfirmAccusation}
      />
      </div>

      <CaseReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        activeCase={activeCase}
        clues={clues}
        messages={messages}
        rankedDecisions={rankedDecisions}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RaaziWorkspace />
    </ErrorBoundary>
  );
}
