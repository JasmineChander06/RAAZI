export type DifficultyLevel = 'Novice' | 'Adept' | 'Master';
export type CaseStatus = 'active' | 'solved' | 'closed';
export type ClueCategory = 'physical' | 'testimony' | 'alibi' | 'cipher' | 'location';
export type ClueSource = 'initial' | 'discovered' | 'user_submitted';
export type TurnRole = 'investigator' | 'raazi';
export type TraversalMode = 'BFS' | 'DFS';

export interface Suspect {
  id: string;
  name: string;
  role: string;
  motive: string;
  alibi: string;
  priorProbability: number;
  posteriorProbability: number;
  deltaFromPrior: number;
}

export interface ClueNode {
  id: string;
  ownerId: string;
  caseId: string;
  title: string;
  detail: string;
  category: ClueCategory;
  source: ClueSource;
  discovered: boolean;
  connectedNodeIds: string[];
  likelihoods: Record<string, number>;
  imageDataUrl?: string;
  createdAt?: unknown;
}

export interface CandidateQuestion {
  id: string;
  prompt: string;
  targetSuspectId: string;
  positiveLikelihoods: Record<string, number>;
  negativeLikelihoods: Record<string, number>;
  asked: boolean;
}

export interface InvestigationTurn {
  id: string;
  ownerId: string;
  caseId: string;
  role: TurnRole;
  content: string;
  nlpIntent?: string;
  topSuspectName?: string;
  topProbability?: number;
  createdAt?: unknown;
}

export interface DetectiveCase {
  id: string;
  ownerId: string;
  title: string;
  era: string;
  difficulty: DifficultyLevel;
  synopsis: string;
  settingDetail: string;
  status: CaseStatus;
  suspects: Suspect[];
  culpritId: string;
  solutionSummary: string;
  accusedSuspectId?: string;
  solvedCorrectly?: boolean;
  stageId?: string;
  stageOrder?: number;
  clueCount: number;
  turnCount: number;
  candidateQuestions?: CandidateQuestion[];
  bannerImageUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type MysteryCategoryId = 'murder' | 'ancient' | 'heist';

export interface CampaignStage {
  stageId: string;
  categoryId: MysteryCategoryId;
  categoryLabel: string;
  stageOrder: number;
  stageLabel: string;
  difficultyTier: 'Easy' | 'Medium' | 'Hard';
  difficulty: DifficultyLevel;
  genre: string;
  locationName: string;
  coordinates: { x: number; y: number };
  summary: string;
  createBundle: () => {
    caseData: DetectiveCase;
    clues: ClueNode[];
    messages: InvestigationTurn[];
  };
}

export interface TraversalStep {
  nodeId: string;
  depth: number;
  parentId: string | null;
  order: number;
}

export interface TraversalResult {
  mode: TraversalMode;
  startNodeId: string;
  steps: TraversalStep[];
  visitedOrder: string[];
  edgesTraversed: Array<{ from: string; to: string }>;
  strongestSuspectLinks: Array<{ suspectId: string; viaClueId: string; weight: number }>;
}

export interface DecisionRank {
  questionId: string;
  prompt: string;
  targetSuspectId: string;
  currentEntropyBits: number;
  expectedPosteriorEntropyBits: number;
  informationGainBits: number;
  rationale: string;
}

export interface NlpAnalysis {
  intent:
    | 'interrogate'
    | 'submit_clue'
    | 'analyze_connection'
    | 'request_hint'
    | 'accuse'
    | 'general_query';
  extractedEntities: string[];
  referencedSuspectIds: string[];
  summary: string;
}

export interface InvestigateTurnPayload {
  raaziReply: string;
  nlpAnalysis: NlpAnalysis;
  discoveredClue?: Omit<ClueNode, 'ownerId' | 'caseId' | 'createdAt'>;
  revealedClueIds?: string[];
  updatedSuspects: Suspect[];
  rankedDecisions: DecisionRank[];
  suggestedPrompts?: string[];
  accuseSuspectId?: string;
  askedQuestionId?: string;
}
