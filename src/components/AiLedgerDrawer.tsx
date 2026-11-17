import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, Scale, Sparkles, X } from 'lucide-react';
import type {
  ClueNode,
  DecisionRank,
  Suspect,
  TraversalMode,
} from '../types/mystery.ts';
import { calculateShannonEntropy, traverseClueGraph } from '../engine/aiAlgorithms.ts';

type LedgerTab = 'bayes' | 'graph' | 'decision';

interface AiLedgerDrawerProps {
  open: boolean;
  onClose: () => void;
  suspects: Suspect[];
  clues: ClueNode[];
  rankedDecisions: DecisionRank[];
  selectedStartClueId: string;
  onSelectStartClue: (clueId: string) => void;
  onAskDecisionQuestion: (decision: DecisionRank) => void;
  isBusy: boolean;
}

export function AiLedgerDrawer({
  open,
  onClose,
  suspects,
  clues,
  rankedDecisions,
  selectedStartClueId,
  onSelectStartClue,
  onAskDecisionQuestion,
  isBusy,
}: AiLedgerDrawerProps) {
  const [activeTab, setActiveTab] = useState<LedgerTab>('bayes');
  const [traversalMode, setTraversalMode] = useState<TraversalMode>('BFS');
  const [expandedSuspectId, setExpandedSuspectId] = useState<string | null>(null);

  const discoveredClues = useMemo(() => clues.filter((c) => c.discovered), [clues]);

  const currentEntropy = useMemo(
    () => calculateShannonEntropy(suspects.map((s) => s.posteriorProbability)),
    [suspects]
  );

  const traversal = useMemo(
    () =>
      traverseClueGraph(
        discoveredClues,
        suspects,
        selectedStartClueId || discoveredClues[0]?.id || '',
        traversalMode
      ),
    [discoveredClues, suspects, selectedStartClueId, traversalMode]
  );

  // Radial astrolabe coordinates for SVG clue graph
  const graphNodes = useMemo(() => {
    const count = discoveredClues.length;
    const cx = 175;
    const cy = 128;
    const rx = 112;
    const ry = 82;

    return discoveredClues.map((clue, idx) => {
      const angle = (idx / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
      const x = count === 1 ? cx : cx + Math.cos(angle) * rx;
      const y = count === 1 ? cy : cy + Math.sin(angle) * ry;
      const step = traversal.steps.find((s) => s.nodeId === clue.id);
      return {
        clue,
        x,
        y,
        order: step?.order ?? idx + 1,
        depth: step?.depth ?? 0,
      };
    });
  }, [discoveredClues, traversal.steps]);

  if (!open) return null;

  return (
    <aside
      aria-label="AI Reasoning Ledger"
      className="w-full lg:w-[400px] xl:w-[420px] shrink-0 bg-[#141210] border-t lg:border-t-0 lg:border-l border-[#C9A45C]/15 flex flex-col max-h-[calc(100vh-4rem)] lg:sticky lg:top-16"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#C9A45C]/15 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-serif font-semibold text-[#E8DEC8]">
            AI Reasoning Ledger
          </h2>
          <p className="text-xs text-[#9C9281] tabular-nums">
            Entropy {currentEntropy.toFixed(3)} bits · {discoveredClues.length} active nodes
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse AI Ledger"
          className="p-2 text-[#9C9281] hover:text-[#E8DEC8] transition-colors cursor-pointer rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Control */}
      <div className="px-5 pt-3 pb-2 border-b border-[#C9A45C]/10">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B0A09] rounded-md border border-[#C9A45C]/10">
          <button
            type="button"
            onClick={() => setActiveTab('bayes')}
            className={`px-2 py-1.5 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'bayes'
                ? 'bg-[#1C1915] text-[#C9A45C]'
                : 'text-[#9C9281] hover:text-[#E8DEC8]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Bayes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('graph')}
            className={`px-2 py-1.5 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'graph'
                ? 'bg-[#1C1915] text-[#C9A45C]'
                : 'text-[#9C9281] hover:text-[#E8DEC8]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Clue Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('decision')}
            className={`px-2 py-1.5 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'decision'
                ? 'bg-[#1C1915] text-[#C9A45C]'
                : 'text-[#9C9281] hover:text-[#E8DEC8]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Decision</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeTab === 'bayes' && (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between text-xs text-[#9C9281]">
              <span>Bayesian Posterior Ranking</span>
              <span className="font-mono tabular-nums">Sum = 100.0%</span>
            </div>

            <div className="divide-y divide-[#C9A45C]/10 border-t border-b border-[#C9A45C]/10">
              {suspects.map((suspect, idx) => {
                const pct = (suspect.posteriorProbability * 100).toFixed(1);
                const delta = (suspect.deltaFromPrior * 100).toFixed(1);
                const isUp = suspect.deltaFromPrior >= 0;
                const isExpanded = expandedSuspectId === suspect.id;
                const isLeading = idx === 0;

                return (
                  <div key={suspect.id} className="py-3.5 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSuspectId(isExpanded ? null : suspect.id)
                      }
                      className="w-full text-left flex items-start justify-between gap-3 cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono tabular-nums text-[#9C9281]">
                            0{idx + 1}
                          </span>
                          <span className="text-sm font-medium text-[#E8DEC8] group-hover:text-[#C9A45C] transition-colors truncate">
                            {suspect.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#9C9281] mt-0.5 truncate">
                          {suspect.role}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <div
                            className={`text-sm font-mono tabular-nums font-medium ${
                              isLeading ? 'text-[#C9A45C]' : 'text-[#E8DEC8]'
                            }`}
                          >
                            {pct}%
                          </div>
                          <div
                            className={`text-[11px] font-mono tabular-nums ${
                              isUp ? 'text-[#B54842]' : 'text-[#5C8D76]'
                            }`}
                          >
                            {isUp ? `+${delta}%` : `${delta}%`}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#9C9281]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[#9C9281]" />
                        )}
                      </div>
                    </button>

                    {/* Subtle probability meter */}
                    <div className="h-1 w-full bg-[#0B0A09] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isLeading ? 'bg-[#C9A45C]' : 'bg-[#9C9281]/50'
                        }`}
                        style={{ width: `${Math.max(2, suspect.posteriorProbability * 100)}%` }}
                      />
                    </div>

                    {isExpanded && (
                      <div className="pt-2 space-y-2 text-xs text-[#9C9281]">
                        <p>
                          <span className="text-[#E8DEC8]">Motive:</span> {suspect.motive}
                        </p>
                        <p>
                          <span className="text-[#E8DEC8]">Alibi:</span> {suspect.alibi}
                        </p>
                        <div className="pt-1 border-t border-[#C9A45C]/10 space-y-1">
                          <p className="text-[11px] uppercase tracking-wider text-[#C9A45C]">
                            Evidence Likelihoods P(E | Suspect)
                          </p>
                          {discoveredClues.map((clue) => {
                            const l = clue.likelihoods[suspect.id] ?? 0.5;
                            return (
                              <div
                                key={clue.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{clue.title}</span>
                                <span className="font-mono tabular-nums text-[#E8DEC8]">
                                  {l.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#0B0A09] rounded-md border border-[#C9A45C]/10">
                <button
                  type="button"
                  onClick={() => setTraversalMode('BFS')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                    traversalMode === 'BFS'
                      ? 'bg-[#C9A45C] text-[#0B0A09] font-semibold'
                      : 'text-[#9C9281] hover:text-[#E8DEC8]'
                  }`}
                >
                  BFS
                </button>
                <button
                  type="button"
                  onClick={() => setTraversalMode('DFS')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                    traversalMode === 'DFS'
                      ? 'bg-[#C9A45C] text-[#0B0A09] font-semibold'
                      : 'text-[#9C9281] hover:text-[#E8DEC8]'
                  }`}
                >
                  DFS
                </button>
              </div>

              <label className="text-xs text-[#9C9281] flex items-center gap-2 min-w-0">
                <span className="shrink-0">Root</span>
                <select
                  value={traversal.startNodeId}
                  onChange={(e) => onSelectStartClue(e.target.value)}
                  className="bg-[#0B0A09] border border-[#C9A45C]/20 rounded px-2 py-1 text-xs text-[#E8DEC8] max-w-[155px] truncate focus:outline-none focus:border-[#C9A45C]"
                >
                  {discoveredClues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Interactive SVG Evidence Graph */}
            <div className="bg-[#0B0A09] border border-[#C9A45C]/15 rounded-lg p-2">
              <svg viewBox="0 0 350 256" className="w-full h-auto" role="img" aria-label="Evidence Connection Graph">
                {/* Underlying structural astrolabe circle */}
                <circle
                  cx="175"
                  cy="128"
                  r="88"
                  fill="none"
                  stroke="rgba(201,164,92,0.12)"
                  strokeDasharray="3 4"
                />

                {/* All clue adjacency edges */}
                {graphNodes.map((n) =>
                  n.clue.connectedNodeIds.map((targetId) => {
                    const target = graphNodes.find((t) => t.clue.id === targetId);
                    if (!target || n.clue.id > target.clue.id) return null;
                    const isTraversed = traversal.edgesTraversed.some(
                      (e) =>
                        (e.from === n.clue.id && e.to === target.clue.id) ||
                        (e.to === n.clue.id && e.from === target.clue.id)
                    );
                    return (
                      <line
                        key={`${n.clue.id}-${target.clue.id}`}
                        x1={n.x}
                        y1={n.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isTraversed ? '#C9A45C' : 'rgba(156,146,129,0.28)'}
                        strokeWidth={isTraversed ? 1.8 : 1}
                      />
                    );
                  })
                )}

                {/* Clue nodes */}
                {graphNodes.map((node) => {
                  const isStart = node.clue.id === traversal.startNodeId;
                  return (
                    <g
                      key={node.clue.id}
                      onClick={() => onSelectStartClue(node.clue.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isStart ? 16 : 13}
                        fill={isStart ? '#C9A45C' : '#1C1915'}
                        stroke="#C9A45C"
                        strokeWidth={isStart ? 2 : 1.2}
                      />
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        className="text-[11px] font-mono font-semibold"
                        fill={isStart ? '#0B0A09' : '#E8DEC8'}
                      >
                        {node.order}
                      </text>
                      <text
                        x={node.x}
                        y={node.y + 27}
                        textAnchor="middle"
                        className="text-[10px]"
                        fill="#9C9281"
                      >
                        {node.clue.title.length > 18
                          ? `${node.clue.title.slice(0, 17)}…`
                          : node.clue.title}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Step-by-step Traversal Log */}
            <div className="space-y-2">
              <p className="text-xs text-[#9C9281]">
                {traversalMode === 'BFS'
                  ? 'Breadth-First Queue Order (level-by-level corroboration)'
                  : 'Depth-First Stack Order (deep chain hypothesis trace)'}
              </p>
              <div className="space-y-1.5 border-t border-[#C9A45C]/10 pt-2">
                {traversal.steps.map((step) => {
                  const clue = discoveredClues.find((c) => c.id === step.nodeId);
                  if (!clue) return null;
                  return (
                    <div
                      key={step.nodeId}
                      className="flex items-center justify-between gap-2 text-xs py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono tabular-nums text-[#C9A45C]">
                          #{step.order}
                        </span>
                        <span className="text-[#E8DEC8] truncate">{clue.title}</span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-[#9C9281] shrink-0">
                        depth {step.depth}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'decision' && (
          <div className="space-y-4">
            <p className="text-xs text-[#9C9281] leading-relaxed">
              Questions ranked by Expected Information Gain <span className="font-mono text-[#E8DEC8]">IG(Q) = H(S) − E[H(S|Q)]</span> to minimize suspect entropy fastest.
            </p>

            {rankedDecisions.length === 0 ? (
              <p className="text-sm text-[#9C9281] py-6 text-center">
                No remaining structured inquiries. Ask Raazi directly or make your accusation.
              </p>
            ) : (
              <div className="space-y-3">
                {rankedDecisions.map((item, idx) => (
                  <div
                    key={item.questionId}
                    className="p-3.5 bg-[#0B0A09] border border-[#C9A45C]/15 rounded-md space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                      <span className="text-[#C9A45C]">Rank 0{idx + 1}</span>
                      <span className="text-[#5C8D76]">
                        +{item.informationGainBits.toFixed(3)} bits IG
                      </span>
                    </div>
                    <p className="text-sm text-[#E8DEC8] leading-snug">{item.prompt}</p>
                    <p className="text-xs text-[#9C9281]">{item.rationale}</p>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onAskDecisionQuestion(item)}
                      className="w-full py-2 px-3 text-xs font-medium border border-[#C9A45C]/35 text-[#E8DEC8] hover:bg-[#C9A45C] hover:text-[#0B0A09] rounded transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Pursue This Inquiry
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
