import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  CandidateQuestion,
  ClueCategory,
  ClueNode,
  DetectiveCase,
  DifficultyLevel,
  InvestigationTurn,
  Suspect,
} from './src/types/mystery.ts';
import {
  rankNextQuestions,
  recomputePosteriorFromEvidence,
} from './src/engine/aiAlgorithms.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes('503') ||
    text.includes('UNAVAILABLE') ||
    text.includes('429') ||
    text.includes('high demand') ||
    text.includes('RESOURCE_EXHAUSTED')
  );
}

function formatGeminiErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Not raw JSON
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return 'The AI reasoning service is experiencing a momentary spike in demand. Please try sending your inquiry again.';
  }
  return raw;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  ai: GoogleGenAI,
  requestConfig: {
    contents: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
  }
) {
  const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel; delayMs: number }> = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 0 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 500 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.MINIMAL, delayMs: 400 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    try {
      return await ai.models.generateContent({
        model: attempt.model,
        contents: requestConfig.contents,
        config: {
          systemInstruction: requestConfig.systemInstruction,
          thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema: requestConfig.responseSchema,
        },
      });
    } catch (err) {
      lastError = err;
      if (!isTransientError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

function parseJsonSafe<T>(rawText: string | undefined): T {
  const trimmed = (rawText ?? '{}').trim();
  const stripped = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(stripped || '{}') as T;
}

function detectExplicitAccusation(userInput: string, suspects: Suspect[]): string {
  const normalized = userInput.trim().toLowerCase();
  // Never treat questions like "who do you think is the culprit?" as a formal accusation
  if (normalized.endsWith('?') || /^(who|what|why|how|when|where|could|is|are|do|does)\b/.test(normalized)) {
    return '';
  }
  const hasAccusationVerb =
    /\b(i accuse|accuse|arrest|charge|my final answer is|the culprit is|the killer is|the murderer is|the thief is|it was)\b/.test(
      normalized
    );
  if (!hasAccusationVerb) return '';

  for (const suspect of suspects) {
    const full = suspect.name.toLowerCase();
    const parts = full.split(/\s+/).filter((p) => p.length >= 3);
    if (normalized.includes(full) || parts.some((p) => new RegExp(`\\b${p}\\b`, 'i').test(normalized))) {
      return suspect.id;
    }
  }
  return '';
}

function makeSafeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/cases/generate', async (req, res) => {
  try {
    const body = req.body as {
      era?: string;
      themePrompt?: string;
      difficulty?: DifficultyLevel;
      ownerId?: string;
    };

    const era = (body.era || '1928 English Country Estate · Manor Murder').slice(0, 80);
    const themePrompt = (
      body.themePrompt || 'A wealthy patron is found poisoned behind a locked study door while four guests claim unbroken alibis'
    ).slice(0, 400);
    const difficulty: DifficultyLevel =
      body.difficulty === 'Novice' || body.difficulty === 'Master' ? body.difficulty : 'Adept';
    const ownerId = (body.ownerId || 'guest').slice(0, 128);

    const ai = getGeminiClient();

    const prompt = `Create an original, gripping fictional murder mystery case set in "${era}" inspired by: "${themePrompt}". Difficulty: ${difficulty}.
Requirements:
- Make it a clear, compelling crime/murder investigation with a clearly explained crime scene situation in the synopsis (who the victim was, how and where the murder occurred, and why everyone inside is suspect).
- Invent exactly 4 distinct suspects with realistic motives and specific alibis.
- Choose exactly 1 suspect index (0..3) as the true culprit.
- Invent exactly 5 clue nodes forming a connected investigation graph:
  * Clues 0, 1, 2 are initially discovered (discovered: true) and create genuine intrigue/ambiguity across at least two suspects.
  * Clues 3, 4 are hidden (discovered: false) and hold decisive forensic or alibi breakthroughs.
  * For each clue, provide likelihoods (4 numbers between 0.08 and 0.95 corresponding to suspects 0..3) representing P(Evidence | Suspect is Culprit). Make sure the culprit has consistently coherent likelihoods without making clue 0 alone 100% obvious.
  * Provide connectedIndices (1 to 3 valid clue indices 0..4) linking related clues into a connected graph.
- Invent 3 candidate investigative questions for the Decision Engine, each targeting one suspect index (0..3) with positiveLikelihoods (4 floats 0.08..0.95) and negativeLikelihoods (4 floats 0.08..0.95).
- Keep prose atmospheric, literary, concise, and razor-sharp.`;

    const response = await generateWithRetry(ai, {
      contents: prompt,
      systemInstruction:
        'You are Raazi, a master murder-mystery detective and probabilistic deduction architect. Return strictly valid JSON matching the requested schema.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          era: { type: Type.STRING },
          synopsis: { type: Type.STRING },
          settingDetail: { type: Type.STRING },
          culpritIndex: { type: Type.INTEGER },
          solutionSummary: { type: Type.STRING },
          suspects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                motive: { type: Type.STRING },
                alibi: { type: Type.STRING },
                priorProbability: { type: Type.NUMBER },
              },
              required: ['name', 'role', 'motive', 'alibi', 'priorProbability'],
            },
          },
          clues: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                category: { type: Type.STRING },
                discovered: { type: Type.BOOLEAN },
                connectedIndices: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
                likelihoods: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
              },
              required: ['title', 'detail', 'category', 'discovered', 'connectedIndices', 'likelihoods'],
            },
          },
          candidateQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                targetSuspectIndex: { type: Type.INTEGER },
                positiveLikelihoods: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                negativeLikelihoods: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
              },
              required: ['prompt', 'targetSuspectIndex', 'positiveLikelihoods', 'negativeLikelihoods'],
            },
          },
        },
        required: [
          'title',
          'era',
          'synopsis',
          'settingDetail',
          'culpritIndex',
          'solutionSummary',
          'suspects',
          'clues',
          'candidateQuestions',
        ],
      },
    });

    const parsed = parseJsonSafe<{
      title: string;
      era: string;
      synopsis: string;
      settingDetail: string;
      culpritIndex: number;
      solutionSummary: string;
      suspects: Array<{
        name: string;
        role: string;
        motive: string;
        alibi: string;
        priorProbability: number;
      }>;
      clues: Array<{
        title: string;
        detail: string;
        category: string;
        discovered: boolean;
        connectedIndices: number[];
        likelihoods: number[];
      }>;
      candidateQuestions: Array<{
        prompt: string;
        targetSuspectIndex: number;
        positiveLikelihoods: number[];
        negativeLikelihoods: number[];
      }>;
    }>(response.text);

    const caseId = makeSafeId('case');
    const rawSuspects = (parsed.suspects || []).slice(0, 4);
    const priorSum = rawSuspects.reduce((acc, s) => acc + (s.priorProbability > 0 ? s.priorProbability : 0.25), 0) || 1;

    const suspects: Suspect[] = rawSuspects.map((s, idx) => {
      const prior = (s.priorProbability > 0 ? s.priorProbability : 0.25) / priorSum;
      return {
        id: `suspect_${idx + 1}`,
        name: (s.name || `Suspect ${idx + 1}`).slice(0, 80),
        role: (s.role || 'Witness').slice(0, 80),
        motive: (s.motive || 'Undisclosed motive').slice(0, 400),
        alibi: (s.alibi || 'No corroborated alibi').slice(0, 400),
        priorProbability: prior,
        posteriorProbability: prior,
        deltaFromPrior: 0,
      };
    });

    const safeCulpritIndex =
      typeof parsed.culpritIndex === 'number' && parsed.culpritIndex >= 0 && parsed.culpritIndex < suspects.length
        ? parsed.culpritIndex
        : 0;

    const rawClues = (parsed.clues || []).slice(0, 5);
    const clueIds = rawClues.map((_, idx) => `clue_${idx + 1}`);
    const validCategories = new Set<ClueCategory>(['physical', 'testimony', 'alibi', 'cipher', 'location']);

    const clues: ClueNode[] = rawClues.map((c, idx) => {
      const cat = validCategories.has(c.category as ClueCategory)
        ? (c.category as ClueCategory)
        : 'physical';
      const likelihoodMap: Record<string, number> = {};
      suspects.forEach((s, sIdx) => {
        const val = c.likelihoods?.[sIdx];
        likelihoodMap[s.id] =
          typeof val === 'number' && Number.isFinite(val) ? Math.min(Math.max(val, 0.08), 0.95) : 0.5;
      });
      const connectedNodeIds = (c.connectedIndices || [])
        .filter((ci) => typeof ci === 'number' && ci >= 0 && ci < clueIds.length && ci !== idx)
        .map((ci) => clueIds[ci]);

      return {
        id: clueIds[idx],
        ownerId,
        caseId,
        title: (c.title || `Evidence ${idx + 1}`).slice(0, 140),
        detail: (c.detail || 'Fragment recorded in the ledger.').slice(0, 1200),
        category: cat,
        source: idx < 3 ? 'initial' : 'discovered',
        discovered: idx < 3 ? true : Boolean(c.discovered),
        connectedNodeIds: connectedNodeIds.length > 0 ? connectedNodeIds : idx > 0 ? [clueIds[0]] : [clueIds[1] || clueIds[0]],
        likelihoods: likelihoodMap,
      };
    });

    const candidateQuestions: CandidateQuestion[] = (parsed.candidateQuestions || []).slice(0, 4).map((q, idx) => {
      const targetIdx =
        typeof q.targetSuspectIndex === 'number' &&
        q.targetSuspectIndex >= 0 &&
        q.targetSuspectIndex < suspects.length
          ? q.targetSuspectIndex
          : 0;
      const posMap: Record<string, number> = {};
      const negMap: Record<string, number> = {};
      suspects.forEach((s, sIdx) => {
        const pv = q.positiveLikelihoods?.[sIdx];
        const nv = q.negativeLikelihoods?.[sIdx];
        posMap[s.id] = typeof pv === 'number' ? Math.min(Math.max(pv, 0.08), 0.95) : 0.5;
        negMap[s.id] = typeof nv === 'number' ? Math.min(Math.max(nv, 0.08), 0.95) : 0.5;
      });
      return {
        id: `q_${idx + 1}`,
        prompt: (q.prompt || 'Examine the alibi contradictions.').slice(0, 220),
        targetSuspectId: suspects[targetIdx].id,
        positiveLikelihoods: posMap,
        negativeLikelihoods: negMap,
        asked: false,
      };
    });

    const updatedSuspects = recomputePosteriorFromEvidence(suspects, clues);
    const topSuspect = updatedSuspects[0];
    const rankedDecisions = rankNextQuestions(updatedSuspects, candidateQuestions);

    const isAncientSetting = /ancient|alexandria|silk road|baghdad|bce|imperium/i.test(era);

    const caseData: DetectiveCase = {
      id: caseId,
      ownerId,
      title: (parsed.title || 'Untitled Murder Mystery').slice(0, 160),
      era: (parsed.era || era).slice(0, 80),
      difficulty,
      synopsis: (parsed.synopsis || 'A murder mystery awaits deduction.').slice(0, 2400),
      settingDetail: (parsed.settingDetail || era).slice(0, 800),
      status: 'active',
      suspects: updatedSuspects,
      culpritId: suspects[safeCulpritIndex].id,
      solutionSummary: (parsed.solutionSummary || 'The truth emerged from the ledger.').slice(0, 2000),
      clueCount: clues.filter((c) => c.discovered).length,
      turnCount: 1,
      candidateQuestions,
      bannerImageUrl: isAncientSetting
        ? '/src/assets/images/alexandria_observatory_case_1794877118308.jpg'
        : '/src/assets/images/blackwood_manor_murder_1794878589143.jpg',
    };

    const messages: InvestigationTurn[] = [
      {
        id: makeSafeId('turn'),
        ownerId,
        caseId,
        role: 'raazi',
        content: `The dossier for "${caseData.title}" lies open. ${caseData.synopsis}\n\nFrom initial evidence, ${topSuspect.name} holds the highest prior suspicion at ${(topSuspect.posteriorProbability * 100).toFixed(1)}%. Ask me to explain the situation, question any suspect's alibi, submit a new clue, or pursue our highest information-gain inquiry: "${rankedDecisions[0]?.prompt ?? 'Examine the primary physical evidence.'}"`,
        nlpIntent: 'initial_briefing',
        topSuspectName: topSuspect.name,
        topProbability: topSuspect.posteriorProbability,
      },
    ];

    res.json({ caseData, clues, messages });
  } catch (error) {
    console.error('Error generating mystery case:', error);
    res.status(500).json({ error: formatGeminiErrorMessage(error) });
  }
});

app.post('/api/investigate/turn', async (req, res) => {
  try {
    const body = req.body as {
      caseData: DetectiveCase;
      clues: ClueNode[];
      messages: InvestigationTurn[];
      userInput: string;
      mode?: 'query' | 'clue';
      clueTitle?: string;
      clueCategory?: ClueCategory;
      askedQuestionId?: string;
    };

    const { caseData, clues, messages, userInput, mode = 'query', clueTitle, clueCategory, askedQuestionId } = body;
    if (!caseData || !userInput || !userInput.trim()) {
      res.status(400).json({ error: 'Case context and investigator input are required.' });
      return;
    }

    const ai = getGeminiClient();

    const suspectSummary = caseData.suspects
      .map(
        (s, idx) =>
          `${idx}: id=${s.id} | ${s.name} (${s.role}) | motive: ${s.motive} | alibi: ${s.alibi} | current P=${(
            s.posteriorProbability * 100
          ).toFixed(1)}%`
      )
      .join('\n');

    const discoveredSummary = clues
      .filter((c) => c.discovered)
      .map((c) => `- [${c.id}] (${c.category}) ${c.title}: ${c.detail}`)
      .join('\n');

    const hiddenSummary = clues
      .filter((c) => !c.discovered)
      .map((c) => `- [${c.id}] (${c.category}) ${c.title}: ${c.detail}`)
      .join('\n');

    const recentHistory = messages
      .slice(-6)
      .map((m) => `${m.role === 'raazi' ? 'Raazi' : 'Investigator'}: ${m.content}`)
      .join('\n');

    const nlpPrompt = `Analyze this investigator action in our mystery "${caseData.title}" (${caseData.era}).
Case Situation / Synopsis: ${caseData.synopsis}
Mode: ${mode === 'clue' ? 'USER SUBMITTED A NEW CLUE' : 'INVESTIGATOR QUESTION / DEDUCTION'}
${clueTitle ? `Submitted Clue Title: ${clueTitle}` : ''}
${clueCategory ? `Submitted Clue Category: ${clueCategory}` : ''}
Investigator Input: "${userInput}"

Suspects:
${suspectSummary}

True Hidden Solution (for consistent narrative guidance ONLY—NEVER reveal or name the culprit outright unless the user makes a formal accusation):
Culprit ID: ${caseData.culpritId}
Truth: ${caseData.solutionSummary}

Currently Discovered Clues:
${discoveredSummary || 'None'}

Hidden Unrevealed Clues (you may set revealClueId to ONE of these IDs if the investigator's question directly inspects or uncovers it!):
${hiddenSummary || 'None'}

Recent Dialogue:
${recentHistory}

Instructions:
1. Classify intent as one of: "interrogate", "submit_clue", "analyze_connection", "request_hint", "accuse", "general_query".
2. Extract key entities mentioned and matching suspect IDs.
3. ONLY if the investigator explicitly states a definitive formal accusation to close the case (e.g., "I accuse Julian Vance", "The culprit is Dr. Otto Keller", "Arrest Marco Bellini"), set intent to "accuse" and accuseSuspectId to that suspect's exact id; otherwise ALWAYS set accuseSuspectId to "". NEVER set accuseSuspectId for questions like "Who do you think did it?".
4. If mode is "clue", generate a new ClueNode likelihood profile (array of floats 0.08..0.95 aligned strictly with suspects 0..${caseData.suspects.length - 1}) reflecting how strongly this user-submitted clue implicates or exonerates each suspect, plus up to 2 existing discovered clue IDs it logically connects to.
5. If mode is "query" and the investigator explores an angle matching a hidden clue, set revealClueId to that hidden clue's exact ID; otherwise set revealClueId to empty string "".
6. Write Raazi's reply in a sharp, atmospheric detective voice (2–4 concise paragraphs):
   - If the user asks to explain the situation, clearly break down the crime scene, victim, timeline, and why the key suspects are under scrutiny.
   - If the user asks "who do you think" or who is most suspicious, discuss the current Bayesian probabilities and evidence links objectively without confirming the hidden solution outright.
   - Highlight logical connections between clues.
7. Generate exactly 3 concise, natural follow-up prompts in "suggestedPrompts" (each 5–12 words, written in first person for the investigator to click next—for example checking a suspect's alibi, inspecting an unexamined location/object from the scene, or accusing the leading suspect if evidence is overwhelming).`;

    const response = await generateWithRetry(ai, {
      contents: nlpPrompt,
      systemInstruction:
        'You are Raazi, an analytical AI detective assistant. Perform accurate NLP entity/intent extraction, generate logically consistent Bayesian clue likelihoods, and always propose 3 insightful follow-up prompts.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          extractedEntities: { type: Type.ARRAY, items: { type: Type.STRING } },
          referencedSuspectIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
          revealClueId: { type: Type.STRING },
          accuseSuspectId: { type: Type.STRING },
          newClueLikelihoods: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          connectedClueIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          newClueTitle: { type: Type.STRING },
          raaziReply: { type: Type.STRING },
          suggestedPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'intent',
          'extractedEntities',
          'referencedSuspectIds',
          'summary',
          'revealClueId',
          'accuseSuspectId',
          'newClueLikelihoods',
          'connectedClueIds',
          'newClueTitle',
          'raaziReply',
          'suggestedPrompts',
        ],
      },
    });

    const parsed = parseJsonSafe<{
      intent: string;
      extractedEntities: string[];
      referencedSuspectIds: string[];
      summary: string;
      revealClueId: string;
      accuseSuspectId?: string;
      newClueLikelihoods: number[];
      connectedClueIds: string[];
      newClueTitle: string;
      raaziReply: string;
      suggestedPrompts?: string[];
    }>(response.text);

    const updatedClues: ClueNode[] = clues.map((c) => ({ ...c }));
    let discoveredClue: Omit<ClueNode, 'ownerId' | 'caseId' | 'createdAt'> | undefined;
    const revealedClueIds: string[] = [];

    if (mode === 'clue') {
      const likelihoodMap: Record<string, number> = {};
      caseData.suspects.forEach((s, idx) => {
        const raw = parsed.newClueLikelihoods?.[idx];
        likelihoodMap[s.id] =
          typeof raw === 'number' && Number.isFinite(raw) ? Math.min(Math.max(raw, 0.08), 0.95) : 0.5;
      });
      const existingDiscoveredIds = new Set(updatedClues.filter((c) => c.discovered).map((c) => c.id));
      const connectedNodeIds = (parsed.connectedClueIds || [])
        .filter((id) => existingDiscoveredIds.has(id))
        .slice(0, 4);
      if (connectedNodeIds.length === 0 && updatedClues[0]) {
        connectedNodeIds.push(updatedClues[0].id);
      }

      const newId = makeSafeId('clue_user');
      const validCats = new Set<ClueCategory>(['physical', 'testimony', 'alibi', 'cipher', 'location']);
      const safeCategory: ClueCategory =
        clueCategory && validCats.has(clueCategory) ? clueCategory : 'physical';

      discoveredClue = {
        id: newId,
        title: (clueTitle || parsed.newClueTitle || 'Field Observation').slice(0, 140),
        detail: userInput.trim().slice(0, 1200),
        category: safeCategory,
        source: 'user_submitted',
        discovered: true,
        connectedNodeIds,
        likelihoods: likelihoodMap,
      };
      updatedClues.push({
        ...discoveredClue,
        ownerId: caseData.ownerId,
        caseId: caseData.id,
      });
    } else if (parsed.revealClueId) {
      const target = updatedClues.find((c) => c.id === parsed.revealClueId && !c.discovered);
      if (target) {
        target.discovered = true;
        revealedClueIds.push(target.id);
      }
    }

    // Recompute exact Bayesian posteriors deterministically
    const updatedSuspects = recomputePosteriorFromEvidence(caseData.suspects, updatedClues);

    // Update asked status on candidate questions and re-rank by Shannon Entropy Information Gain
    const updatedQuestions = (caseData.candidateQuestions ?? []).map((q) =>
      askedQuestionId && q.id === askedQuestionId ? { ...q, asked: true } : q
    );
    const rankedDecisions = rankNextQuestions(updatedSuspects, updatedQuestions);

    const validIntents = new Set([
      'interrogate',
      'submit_clue',
      'analyze_connection',
      'request_hint',
      'accuse',
      'general_query',
    ]);
    const deterministicAccuseId =
      mode === 'query' ? detectExplicitAccusation(userInput, caseData.suspects) : '';
    const candidateAccuseId = (parsed.accuseSuspectId || deterministicAccuseId || '').trim();
    const validAccuseId = caseData.suspects.some((s) => s.id === candidateAccuseId)
      ? candidateAccuseId
      : undefined;

    const safeIntent = validAccuseId
      ? 'accuse'
      : validIntents.has(parsed.intent)
        ? (parsed.intent as
            | 'interrogate'
            | 'submit_clue'
            | 'analyze_connection'
            | 'request_hint'
            | 'accuse'
            | 'general_query')
        : mode === 'clue'
          ? 'submit_clue'
          : 'general_query';

    const aiSuggested = (parsed.suggestedPrompts || [])
      .map((item) => item.trim().slice(0, 140))
      .filter((item) => item.length > 0)
      .slice(0, 3);

    const fallbackPrompts = [
      rankedDecisions[0]?.prompt ||
        `Check ${updatedSuspects[0]?.name ?? 'the leading suspect'}'s alibi timeline`,
      `What connects our newest evidence to ${updatedSuspects[1]?.name ?? 'the other suspects'}?`,
      `I accuse ${updatedSuspects[0]?.name ?? 'the prime suspect'}`,
    ];

    const suggestedPrompts = aiSuggested.length >= 2 ? aiSuggested : fallbackPrompts;

    res.json({
      raaziReply: parsed.raaziReply || 'The ledger records your inquiry.',
      nlpAnalysis: {
        intent: safeIntent,
        extractedEntities: (parsed.extractedEntities || []).slice(0, 8),
        referencedSuspectIds: (parsed.referencedSuspectIds || []).slice(0, 4),
        summary: (parsed.summary || '').slice(0, 240),
      },
      discoveredClue,
      revealedClueIds,
      updatedSuspects,
      rankedDecisions,
      suggestedPrompts,
      accuseSuspectId: validAccuseId,
      askedQuestionId,
    });
  } catch (error) {
    console.error('Error processing investigation turn:', error);
    res.status(500).json({ error: formatGeminiErrorMessage(error) });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Raazi server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
