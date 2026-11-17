import { useMemo } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type {
  ClueNode,
  DecisionRank,
  DetectiveCase,
  InvestigationTurn,
} from '../types/mystery.ts';
import { calculateShannonEntropy, traverseClueGraph } from '../engine/aiAlgorithms.ts';

interface CaseReportModalProps {
  open: boolean;
  onClose: () => void;
  activeCase: DetectiveCase;
  clues: ClueNode[];
  messages: InvestigationTurn[];
  rankedDecisions: DecisionRank[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function CaseReportModal({
  open,
  onClose,
  activeCase,
  clues,
  messages,
  rankedDecisions,
}: CaseReportModalProps) {
  const discoveredClues = useMemo(() => clues.filter((c) => c.discovered), [clues]);

  const entropyBits = useMemo(
    () => calculateShannonEntropy(activeCase.suspects.map((s) => s.posteriorProbability)),
    [activeCase.suspects]
  );

  const bfsTraversal = useMemo(
    () =>
      traverseClueGraph(
        discoveredClues,
        activeCase.suspects,
        discoveredClues[0]?.id ?? '',
        'BFS'
      ),
    [discoveredClues, activeCase.suspects]
  );

  if (!open) return null;

  const isSolved = activeCase.status !== 'active';
  const accused = activeCase.suspects.find((s) => s.id === activeCase.accusedSuspectId);
  const culprit = activeCase.suspects.find((s) => s.id === activeCase.culpritId);
  const topSuspect = activeCase.suspects[0];
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const slug = activeCase.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    const suspectRows = activeCase.suspects
      .map((s, idx) => {
        const priorPct = (s.priorProbability * 100).toFixed(1);
        const postPct = (s.posteriorProbability * 100).toFixed(1);
        const deltaPct = (s.deltaFromPrior * 100).toFixed(1);
        const deltaLabel = s.deltaFromPrior >= 0 ? `+${deltaPct}%` : `${deltaPct}%`;
        return `<tr>
          <td>0${idx + 1}</td>
          <td><strong>${escapeHtml(s.name)}</strong><br/><span class="muted">${escapeHtml(s.role)}</span></td>
          <td>${escapeHtml(s.motive)}<br/><span class="muted">Alibi: ${escapeHtml(s.alibi)}</span></td>
          <td class="num">${priorPct}%</td>
          <td class="num"><strong>${postPct}%</strong></td>
          <td class="num">${deltaLabel}</td>
        </tr>`;
      })
      .join('');

    const clueRows = bfsTraversal.steps
      .map((step) => {
        const clue = discoveredClues.find((c) => c.id === step.nodeId);
        if (!clue) return '';
        const connectedTitles = clue.connectedNodeIds
          .map((id) => discoveredClues.find((c) => c.id === id)?.title)
          .filter(Boolean)
          .join(', ');
        return `<tr>
          <td class="num">#${step.order} (d${step.depth})</td>
          <td><strong>${escapeHtml(clue.title)}</strong><br/><span class="muted">${escapeHtml(clue.category)} · ${escapeHtml(clue.source)}</span></td>
          <td>${escapeHtml(clue.detail)}${connectedTitles ? `<br/><span class="muted">Linked to: ${escapeHtml(connectedTitles)}</span>` : ''}</td>
        </tr>`;
      })
      .join('');

    const dialogueBlocks = messages
      .map(
        (m) => `<div class="turn">
          <div class="turn-head">
            <strong>${m.role === 'raazi' ? 'Raazi' : 'Investigator'}</strong>
            ${m.nlpIntent ? `<span class="muted"> · Intent: ${escapeHtml(m.nlpIntent)}</span>` : ''}
          </div>
          <p>${escapeHtml(m.content).replace(/\n/g, '<br/>')}</p>
        </div>`
      )
      .join('');

    const conclusionHtml = isSolved
      ? `<p><strong>Verdict:</strong> ${activeCase.solvedCorrectly ? 'Deduction Confirmed' : 'Culprit Misidentified'} — Accused: ${escapeHtml(accused?.name ?? 'N/A')} · True Culprit: ${escapeHtml(culprit?.name ?? 'N/A')}</p>
         <p>${escapeHtml(activeCase.solutionSummary)}</p>`
      : `<p><strong>Preliminary Assessment (Case Active):</strong> Leading Bayesian suspect is <strong>${escapeHtml(topSuspect?.name ?? 'N/A')}</strong> at ${((topSuspect?.posteriorProbability ?? 0) * 100).toFixed(1)}% posterior probability (Shannon Entropy ${entropyBits.toFixed(3)} bits).</p>
         ${rankedDecisions[0] ? `<p><strong>Recommended Next Inquiry:</strong> ${escapeHtml(rankedDecisions[0].prompt)}</p>` : ''}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Detective Case Report — ${escapeHtml(activeCase.title)}</title>
  <style>
    body { font-family: Georgia, serif; background: #FBF9F5; color: #1C1917; max-width: 820px; margin: 40px auto; padding: 0 28px; line-height: 1.6; }
    h1 { font-size: 30px; margin: 6px 0 10px; }
    h2 { font-size: 18px; border-bottom: 1px solid #D6CEBE; padding-bottom: 6px; margin-top: 28px; }
    .meta { font-family: monospace; font-size: 12px; color: #78350F; letter-spacing: 0.06em; text-transform: uppercase; }
    .submeta { font-size: 13px; color: #57534E; margin-bottom: 16px; }
    .muted { color: #57534E; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { text-align: left; vertical-align: top; padding: 10px 8px; border-bottom: 1px solid #E7E1D5; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #57534E; }
    .num { font-family: monospace; text-align: right; white-space: nowrap; }
    .turn { padding: 10px 0; border-bottom: 1px solid #ECE6DA; font-size: 14px; }
    .turn-head { font-size: 12px; margin-bottom: 4px; }
    @media print { body { margin: 0; padding: 12px; } }
  </style>
</head>
<body>
  <div class="meta">Raazi Archival Dossier · ${escapeHtml(activeCase.id)} · ${escapeHtml(generatedDate)}</div>
  <h1>${escapeHtml(activeCase.title)}</h1>
  <div class="submeta">${escapeHtml(activeCase.era)} · ${escapeHtml(activeCase.difficulty)} · Status: ${escapeHtml(activeCase.status)} · Entropy: ${entropyBits.toFixed(3)} bits</div>

  <h2>I. Case Synopsis &amp; Setting</h2>
  <p><strong>Location:</strong> ${escapeHtml(activeCase.settingDetail)}</p>
  <p>${escapeHtml(activeCase.synopsis)}</p>

  <h2>II. Suspect Roster &amp; Final Bayesian Ledger</h2>
  <table>
    <thead>
      <tr><th>Rank</th><th>Suspect</th><th>Motive &amp; Alibi</th><th class="num">Prior</th><th class="num">Posterior</th><th class="num">Delta</th></tr>
    </thead>
    <tbody>${suspectRows}</tbody>
  </table>

  <h2>III. Evidence Ledger (BFS Discovery Order)</h2>
  <table>
    <thead>
      <tr><th>Step</th><th>Clue</th><th>Detail &amp; Connections</th></tr>
    </thead>
    <tbody>${clueRows}</tbody>
  </table>

  <h2>IV. Investigation Transcript</h2>
  ${dialogueBlocks}

  <h2>V. Conclusion</h2>
  ${conclusionHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raazi-case-report-${slug || 'dossier'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-report-heading"
      className="fixed inset-0 z-50 bg-[#0B0A09]/85 backdrop-blur-sm overflow-y-auto p-4 sm:p-8 print:static print:bg-white print:p-0 print:overflow-visible"
    >
      <div className="max-w-4xl mx-auto space-y-4 print:max-w-none">
        {/* Action Bar (hidden during print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141210] border border-[#C9A45C]/25 rounded-lg px-5 py-3.5 print:hidden">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[#C9A45C]">
              Archival Document Preview
            </p>
            <p className="text-xs text-[#9C9281]">
              Print to PDF or export a standalone formatted case dossier.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3.5 py-2 text-xs font-medium bg-[#0B0A09] border border-[#C9A45C]/30 text-[#E8DEC8] hover:border-[#C9A45C] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>Download Report</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] hover:bg-[#d8b671] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close case report"
              className="p-2 text-[#9C9281] hover:text-[#E8DEC8] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Formal Parchment Paper Sheet */}
        <article
          id="printable-case-report"
          className="bg-[#FBF9F5] text-[#1C1917] border border-[#D6CEBE] rounded-lg shadow-2xl p-8 sm:p-12 space-y-8 print:border-0 print:shadow-none print:rounded-none print:p-6"
        >
          {/* Masthead */}
          <header className="border-b border-[#D6CEBE] pb-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono uppercase tracking-widest text-[#78350F]">
              <span>Raazi Archival Dossier · {activeCase.id.slice(0, 22)}</span>
              <span>{generatedDate}</span>
            </div>

            <h2
              id="case-report-heading"
              className="text-3xl sm:text-4xl font-serif font-semibold text-[#1C1917]"
            >
              {activeCase.title}
            </h2>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E] tabular-nums">
              <span>{activeCase.era}</span>
              <span aria-hidden="true">·</span>
              <span>Difficulty: {activeCase.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">Status: {activeCase.status}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Final Entropy: {entropyBits.toFixed(3)} bits</span>
            </div>
          </header>

          {/* I. Case Synopsis */}
          <section className="space-y-2.5">
            <h3 className="text-lg font-serif font-semibold text-[#1C1917] border-b border-[#E7E1D5] pb-1.5">
              I. Case Synopsis &amp; Setting
            </h3>
            <p className="text-xs font-medium text-[#57534E]">
              Setting: {activeCase.settingDetail}
            </p>
            <p className="text-sm text-[#292524] leading-relaxed max-w-prose">
              {activeCase.synopsis}
            </p>
          </section>

          {/* II. Suspects & Bayesian Ledger */}
          <section className="space-y-3">
            <h3 className="text-lg font-serif font-semibold text-[#1C1917] border-b border-[#E7E1D5] pb-1.5">
              II. Suspects &amp; Final Bayesian Probability Ledger
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#D6CEBE] text-[11px] uppercase tracking-wider text-[#57534E]">
                    <th className="py-2 pr-3 font-medium">Rank</th>
                    <th className="py-2 pr-3 font-medium">Suspect</th>
                    <th className="py-2 pr-3 font-medium">Motive &amp; Alibi</th>
                    <th className="py-2 pl-3 text-right font-medium">Prior</th>
                    <th className="py-2 pl-3 text-right font-medium">Posterior</th>
                    <th className="py-2 pl-3 text-right font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E1D5]">
                  {activeCase.suspects.map((suspect, idx) => {
                    const priorPct = (suspect.priorProbability * 100).toFixed(1);
                    const postPct = (suspect.posteriorProbability * 100).toFixed(1);
                    const deltaPct = (suspect.deltaFromPrior * 100).toFixed(1);
                    const deltaPrefix = suspect.deltaFromPrior >= 0 ? '+' : '';
                    return (
                      <tr key={suspect.id}>
                        <td className="py-3 pr-3 font-mono tabular-nums text-[#78350F] align-top">
                          0{idx + 1}
                        </td>
                        <td className="py-3 pr-3 align-top">
                          <div className="font-semibold text-[#1C1917]">{suspect.name}</div>
                          <div className="text-xs text-[#57534E]">{suspect.role}</div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-[#292524] align-top space-y-1 max-w-xs">
                          <p>{suspect.motive}</p>
                          <p className="text-[#57534E]">Alibi: {suspect.alibi}</p>
                        </td>
                        <td className="py-3 pl-3 text-right font-mono tabular-nums text-[#57534E] align-top whitespace-nowrap">
                          {priorPct}%
                        </td>
                        <td className="py-3 pl-3 text-right font-mono tabular-nums font-semibold text-[#1C1917] align-top whitespace-nowrap">
                          {postPct}%
                        </td>
                        <td className="py-3 pl-3 text-right font-mono tabular-nums text-[#57534E] align-top whitespace-nowrap">
                          {deltaPrefix}
                          {deltaPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* III. Evidence Ledger */}
          <section className="space-y-3">
            <h3 className="text-lg font-serif font-semibold text-[#1C1917] border-b border-[#E7E1D5] pb-1.5">
              III. Evidence Ledger (BFS Discovery Order)
            </h3>

            <div className="divide-y divide-[#E7E1D5]">
              {bfsTraversal.steps.map((step) => {
                const clue = discoveredClues.find((c) => c.id === step.nodeId);
                if (!clue) return null;
                const linkedNames = clue.connectedNodeIds
                  .map((id) => discoveredClues.find((c) => c.id === id)?.title)
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div key={clue.id} className="py-3 flex gap-4 text-xs sm:text-sm">
                    <div className="w-16 shrink-0 font-mono tabular-nums text-[#78350F]">
                      #{step.order} · d{step.depth}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-[#1C1917]">{clue.title}</span>
                        <span className="text-xs text-[#57534E] capitalize">
                          {clue.category} · {clue.source === 'user_submitted' ? 'Submitted' : 'Archive'}
                        </span>
                      </div>
                      <p className="text-xs text-[#292524] leading-relaxed">{clue.detail}</p>
                      {linkedNames && (
                        <p className="text-[11px] text-[#57534E]">
                          Connected nodes: {linkedNames}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* IV. Investigation Log */}
          <section className="space-y-3">
            <h3 className="text-lg font-serif font-semibold text-[#1C1917] border-b border-[#E7E1D5] pb-1.5">
              IV. Investigation Record ({messages.length} Entries)
            </h3>

            <div className="space-y-3">
              {messages.map((turn) => (
                <div key={turn.id} className="py-2 border-b border-[#ECE6DA] last:border-b-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#57534E]">
                    <span className="font-semibold text-[#1C1917]">
                      {turn.role === 'raazi' ? 'Raazi' : 'Investigator'}
                    </span>
                    {turn.nlpIntent && (
                      <span className="font-mono text-[11px]">
                        Intent: {turn.nlpIntent}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#292524] leading-relaxed whitespace-pre-line">
                    {turn.content}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* V. Conclusion */}
          <section className="p-5 bg-[#F3EFE6] border border-[#D6CEBE] rounded-md space-y-2.5">
            <h3 className="text-lg font-serif font-semibold text-[#1C1917]">
              V. Conclusion &amp; Verdict
            </h3>

            {isSolved ? (
              <div className="space-y-2 text-sm text-[#292524]">
                <p className="font-medium">
                  Outcome:{' '}
                  <span className={activeCase.solvedCorrectly ? 'text-[#14532D]' : 'text-[#991B1B]'}>
                    {activeCase.solvedCorrectly ? 'Deduction Confirmed' : 'Culprit Misidentified'}
                  </span>{' '}
                  · Accused: {accused?.name ?? 'Unknown'} · True Culprit: {culprit?.name ?? 'Unknown'}
                </p>
                <p className="leading-relaxed">{activeCase.solutionSummary}</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-[#292524]">
                <p>
                  <strong>Preliminary Assessment (Case Open):</strong> Current Bayesian inference places{' '}
                  <strong>{topSuspect?.name ?? 'the leading suspect'}</strong> at{' '}
                  <span className="font-mono tabular-nums">
                    {((topSuspect?.posteriorProbability ?? 0) * 100).toFixed(1)}%
                  </span>{' '}
                  likelihood across {discoveredClues.length} logged clues.
                </p>
                {rankedDecisions[0] && (
                  <p className="text-xs text-[#57534E]">
                    Highest Information-Gain Next Inquiry (+{rankedDecisions[0].informationGainBits.toFixed(3)} bits):{' '}
                    &ldquo;{rankedDecisions[0].prompt}&rdquo;
                  </p>
                )}
              </div>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
