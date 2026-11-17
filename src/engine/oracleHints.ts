import type { ClueNode, DecisionRank, DetectiveCase } from '../types/mystery.ts';
import { calculateShannonEntropy, traverseClueGraph } from './aiAlgorithms.ts';

interface OracleHintInput {
  activeCase: DetectiveCase;
  clues: ClueNode[];
  rankedDecisions: DecisionRank[];
  previousHint?: string | null;
}

function extractAngleKeywords(text: string): string {
  const stopWords = new Set([
    'about', 'after', 'inside', 'under', 'their', 'there', 'these', 'those',
    'where', 'which', 'while', 'would', 'could', 'should', 'between', 'before',
    'being', 'from', 'with', 'that', 'this', 'into', 'only', 'near', 'beside',
    'until', 'during', 'through', 'across', 'around', 'confirm', 'confirms',
  ]);
  const words = text
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 5 && !stopWords.has(w.toLowerCase()));

  const unique: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!unique.some((u) => u.toLowerCase() === lower)) {
      unique.push(w);
    }
    if (unique.length >= 3) break;
  }
  return unique.length > 0 ? unique.join(', ') : 'the overlooked physical setting';
}

export function generateOracleHint({
  activeCase,
  clues,
  rankedDecisions,
  previousHint,
}: OracleHintInput): string {
  const discoveredClues = clues.filter((c) => c.discovered);
  const hiddenClues = clues.filter((c) => !c.discovered);
  const lead = activeCase.suspects[0];
  const runnerUp = activeCase.suspects[1];
  const topDecision = rankedDecisions[0];

  const entropyBits = calculateShannonEntropy(
    activeCase.suspects.map((s) => s.posteriorProbability)
  );

  const traversal = traverseClueGraph(
    clues,
    activeCase.suspects,
    discoveredClues[0]?.id ?? '',
    'BFS'
  );

  const candidateHints: string[] = [];

  // 1. Hints tied to unrevealed hidden clues & their connected discovered evidence
  for (const hidden of hiddenClues) {
    const linkedParent = discoveredClues.find(
      (d) =>
        hidden.connectedNodeIds.includes(d.id) || d.connectedNodeIds.includes(hidden.id)
    );
    const parentLabel = linkedParent?.title ?? discoveredClues[0]?.title ?? 'the initial evidence';
    const keywords = extractAngleKeywords(`${hidden.title} ${hidden.detail}`);

    candidateHints.push(
      `Oracle Counsel — Untapped Evidence: Return to "${parentLabel}" and probe the surrounding ${hidden.category} details. Focus your next inquiry on angles involving ${keywords} to bring a hidden clue into the ledger.`
    );
    candidateHints.push(
      `Oracle Counsel — Blind Spot: You have yet to uncover a decisive ${hidden.category} thread connected to "${parentLabel}". Ask Raazi directly to inspect ${keywords} within ${activeCase.settingDetail}.`
    );
  }

  // 2. Decision Theory / Information-Gain hint
  if (topDecision) {
    const target = activeCase.suspects.find((s) => s.id === topDecision.targetSuspectId);
    candidateHints.push(
      `Oracle Counsel — Decision Theory (${entropyBits.toFixed(2)} bits entropy): The highest information-gain inquiry (+${topDecision.informationGainBits.toFixed(3)} bits) targets ${target?.name ?? 'the prime suspect'}: "${topDecision.prompt}"`
    );
  }

  // 3. Bayesian Posterior & Alibi Contradiction hint
  if (lead && runnerUp) {
    const leadPct = (lead.posteriorProbability * 100).toFixed(1);
    const runnerPct = (runnerUp.posteriorProbability * 100).toFixed(1);
    const strongestLink = traversal.strongestSuspectLinks.find((l) => l.suspectId === lead.id);
    const linkedClue = discoveredClues.find((c) => c.id === strongestLink?.viaClueId);

    candidateHints.push(
      `Oracle Counsel — Alibi Cross-Check: ${lead.name} leads at ${leadPct}% ahead of ${runnerUp.name} (${runnerPct}%). Test whether ${lead.name}'s alibi ("${lead.alibi}") truly reconciles with "${linkedClue?.title ?? 'your primary evidence'}".`
    );
    candidateHints.push(
      `Oracle Counsel — Motive vs. Opportunity: Do not rely on motive alone. Contrast ${runnerUp.name}'s statement ("${runnerUp.alibi}") against the timeline established by "${discoveredClues[0]?.title ?? 'the scene'}" or submit a new field observation.`
    );
  }

  // 4. Final Deduction / Closing Verdict hint (especially relevant when all clues are found)
  if (lead) {
    if (hiddenClues.length === 0) {
      candidateHints.push(
        `Oracle Counsel — Ready for Verdict: Every hidden clue in "${activeCase.title}" has already been uncovered. Open the AI Ledger to verify the BFS chain pointing to ${lead.name} (${(lead.posteriorProbability * 100).toFixed(1)}%), then type "I accuse ${lead.name}" or click Final Accusation.`
      );
      candidateHints.push(
        `Oracle Counsel — Synthesis Step: No unrevealed evidence remains at the scene. Weigh the strongest Bayesian likelihoods between ${lead.name} and ${runnerUp?.name ?? 'the others'} and deliver your formal accusation to unlock the next map stage.`
      );
    } else {
      candidateHints.push(
        `Oracle Counsel — Graph Connection: Use the AI Ledger to trace BFS connections starting from "${discoveredClues[0]?.title ?? 'Clue 01'}". Once suspicion concentrates beyond 60%, state "I accuse [Suspect Name]" to close the stage.`
      );
    }
  }

  const filteredPool =
    previousHint && candidateHints.length > 1
      ? candidateHints.filter((h) => h !== previousHint)
      : candidateHints;

  const chosen =
    filteredPool[Math.floor(Math.random() * filteredPool.length)] ??
    'Oracle Counsel: Re-examine the primary physical evidence and test the leading suspect’s alibi timeline.';

  return chosen;
}
