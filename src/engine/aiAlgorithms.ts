import type {
  CandidateQuestion,
  ClueNode,
  DecisionRank,
  Suspect,
  TraversalMode,
  TraversalResult,
  TraversalStep,
} from '../types/mystery.ts';

/**
 * Normalizes a probability distribution so all entries sum strictly to 1.0.
 */
export function normalizeDistribution(weights: number[]): number[] {
  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0.0001 ? w : 0.0001));
  const sum = safeWeights.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) {
    const equal = 1 / Math.max(1, safeWeights.length);
    return safeWeights.map(() => equal);
  }
  return safeWeights.map((w) => w / sum);
}

/**
 * Bayesian Network Posterior Update:
 * P(S_i | E_1..E_k) proportional to P(S_i) * prod_k P(E_k | S_i)
 */
export function recomputePosteriorFromEvidence(
  suspects: Suspect[],
  clues: ClueNode[]
): Suspect[] {
  if (suspects.length === 0) return [];

  const discoveredClues = clues.filter((c) => c.discovered);
  const rawPosteriors = suspects.map((suspect) => {
    let score = suspect.priorProbability > 0 ? suspect.priorProbability : 1 / suspects.length;
    for (const clue of discoveredClues) {
      const likelihood = clue.likelihoods[suspect.id];
      const safeLikelihood =
        typeof likelihood === 'number' && Number.isFinite(likelihood)
          ? Math.min(Math.max(likelihood, 0.05), 0.98)
          : 0.5;
      score *= safeLikelihood;
    }
    return score;
  });

  const normalized = normalizeDistribution(rawPosteriors);

  return suspects
    .map((suspect, index) => {
      const posterior = normalized[index] ?? 1 / suspects.length;
      return {
        ...suspect,
        posteriorProbability: posterior,
        deltaFromPrior: posterior - suspect.priorProbability,
      };
    })
    .sort((a, b) => b.posteriorProbability - a.posteriorProbability);
}

/**
 * Computes Shannon Entropy H(S) = - sum( P(s) * log2(P(s)) ) in bits.
 */
export function calculateShannonEntropy(probabilities: number[]): number {
  const normalized = normalizeDistribution(probabilities);
  let entropy = 0;
  for (const p of normalized) {
    if (p > 1e-9) {
      entropy -= p * Math.log2(p);
    }
  }
  return Number(entropy.toFixed(4));
}

/**
 * Decision-Making Engine: Ranks candidate investigative questions by
 * Expected Information Gain: IG(Q) = H(S) - E[H(S | Q)].
 */
export function rankNextQuestions(
  suspects: Suspect[],
  questions: CandidateQuestion[]
): DecisionRank[] {
  if (suspects.length === 0 || questions.length === 0) return [];

  const currentProbs = suspects.map((s) => s.posteriorProbability);
  const currentEntropy = calculateShannonEntropy(currentProbs);

  const unasked = questions.filter((q) => !q.asked);
  const pool = unasked.length > 0 ? unasked : questions;

  const ranked: DecisionRank[] = pool.map((q) => {
    // Probability of positive vs negative outcome marginalized over current suspect posteriors
    let pPos = 0;
    let pNeg = 0;
    const unnormPos: number[] = [];
    const unnormNeg: number[] = [];

    for (let i = 0; i < suspects.length; i++) {
      const s = suspects[i];
      const prior = currentProbs[i] ?? 1 / suspects.length;
      const lPos = Math.min(Math.max(q.positiveLikelihoods[s.id] ?? 0.5, 0.05), 0.95);
      const lNeg = Math.min(Math.max(q.negativeLikelihoods[s.id] ?? 1 - lPos, 0.05), 0.95);

      const jPos = prior * lPos;
      const jNeg = prior * lNeg;
      pPos += jPos;
      pNeg += jNeg;
      unnormPos.push(jPos);
      unnormNeg.push(jNeg);
    }

    const totalBranch = pPos + pNeg || 1;
    const normPosWeight = pPos / totalBranch;
    const normNegWeight = pNeg / totalBranch;

    const hPos = calculateShannonEntropy(unnormPos);
    const hNeg = calculateShannonEntropy(unnormNeg);
    const expectedEntropy = Number((normPosWeight * hPos + normNegWeight * hNeg).toFixed(4));
    const gain = Math.max(0, Number((currentEntropy - expectedEntropy).toFixed(4)));

    const targetSuspect = suspects.find((s) => s.id === q.targetSuspectId);
    const targetName = targetSuspect ? targetSuspect.name : 'leading suspects';

    return {
      questionId: q.id,
      prompt: q.prompt,
      targetSuspectId: q.targetSuspectId,
      currentEntropyBits: currentEntropy,
      expectedPosteriorEntropyBits: expectedEntropy,
      informationGainBits: gain,
      rationale: `Reduces uncertainty around ${targetName} by ${gain.toFixed(3)} bits of entropy.`,
    };
  });

  return ranked.sort((a, b) => b.informationGainBits - a.informationGainBits);
}

/**
 * Graph Search Engine: Explores clue connection graph using Breadth-First Search (BFS)
 * or Depth-First Search (DFS) from a chosen evidence node.
 */
export function traverseClueGraph(
  clues: ClueNode[],
  suspects: Suspect[],
  startNodeId: string,
  mode: TraversalMode
): TraversalResult {
  const discoveredClues = clues.filter((c) => c.discovered);
  const clueMap = new Map<string, ClueNode>();
  for (const clue of discoveredClues) {
    clueMap.set(clue.id, clue);
  }

  // Build undirected adjacency map across discovered clues
  const adjacency = new Map<string, string[]>();
  for (const clue of discoveredClues) {
    if (!adjacency.has(clue.id)) adjacency.set(clue.id, []);
    for (const targetId of clue.connectedNodeIds) {
      if (clueMap.has(targetId)) {
        adjacency.get(clue.id)!.push(targetId);
        if (!adjacency.has(targetId)) adjacency.set(targetId, []);
        adjacency.get(targetId)!.push(clue.id);
      }
    }
  }

  const effectiveStart = clueMap.has(startNodeId)
    ? startNodeId
    : discoveredClues[0]?.id ?? '';

  const steps: TraversalStep[] = [];
  const visitedOrder: string[] = [];
  const edgesTraversed: Array<{ from: string; to: string }> = [];
  const visited = new Set<string>();

  if (effectiveStart) {
    if (mode === 'BFS') {
      const queue: Array<{ id: string; depth: number; parentId: string | null }> = [
        { id: effectiveStart, depth: 0, parentId: null },
      ];
      visited.add(effectiveStart);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const order = steps.length + 1;
        steps.push({
          nodeId: current.id,
          depth: current.depth,
          parentId: current.parentId,
          order,
        });
        visitedOrder.push(current.id);
        if (current.parentId) {
          edgesTraversed.push({ from: current.parentId, to: current.id });
        }

        const neighbors = adjacency.get(current.id) ?? [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ id: neighbor, depth: current.depth + 1, parentId: current.id });
          }
        }
      }
    } else {
      // Iterative DFS using an explicit stack
      const stack: Array<{ id: string; depth: number; parentId: string | null }> = [
        { id: effectiveStart, depth: 0, parentId: null },
      ];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current.id)) continue;
        visited.add(current.id);

        const order = steps.length + 1;
        steps.push({
          nodeId: current.id,
          depth: current.depth,
          parentId: current.parentId,
          order,
        });
        visitedOrder.push(current.id);
        if (current.parentId) {
          edgesTraversed.push({ from: current.parentId, to: current.id });
        }

        const neighbors = [...(adjacency.get(current.id) ?? [])].reverse();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push({ id: neighbor, depth: current.depth + 1, parentId: current.id });
          }
        }
      }
    }

    // Include disconnected discovered components at the end so all evidence remains reachable
    for (const clue of discoveredClues) {
      if (!visited.has(clue.id)) {
        visited.add(clue.id);
        steps.push({
          nodeId: clue.id,
          depth: 0,
          parentId: null,
          order: steps.length + 1,
        });
        visitedOrder.push(clue.id);
      }
    }
  }

  // Find strongest suspect links across visited clues
  const strongestSuspectLinks: Array<{ suspectId: string; viaClueId: string; weight: number }> = [];
  for (const suspect of suspects) {
    let bestClueId = '';
    let bestWeight = 0;
    for (const clueId of visitedOrder) {
      const clue = clueMap.get(clueId);
      const w = clue?.likelihoods[suspect.id] ?? 0;
      if (w > bestWeight) {
        bestWeight = w;
        bestClueId = clueId;
      }
    }
    if (bestClueId) {
      strongestSuspectLinks.push({
        suspectId: suspect.id,
        viaClueId: bestClueId,
        weight: bestWeight,
      });
    }
  }

  return {
    mode,
    startNodeId: effectiveStart,
    steps,
    visitedOrder,
    edgesTraversed,
    strongestSuspectLinks,
  };
}
