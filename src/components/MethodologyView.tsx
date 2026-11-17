export function MethodologyView() {
  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-10 space-y-12">
      <header className="space-y-3 border-b border-[#C9A45C]/15 pb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-[#C9A45C]">
          Algorithmic Foundations
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[#E8DEC8]">
          How Raazi Reasons Through a Mystery
        </h1>
        <p className="text-sm sm:text-base text-[#9C9281] max-w-prose leading-relaxed">
          Rather than relying solely on opaque text generation, Raazi separates literary synthesis from mathematical deduction—running classical AI algorithms transparently on every clue you uncover.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 bg-[#141210] border border-[#C9A45C]/15 rounded-lg space-y-2.5">
          <p className="text-xs font-mono text-[#C9A45C]">01. Natural Language Processing</p>
          <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
            Intent &amp; Entity Extraction
          </h2>
          <p className="text-sm text-[#9C9281] leading-relaxed">
            Every question or user-submitted clue is parsed server-side into structured intent classes (interrogation, clue submission, connection query) and linked to suspect entities before updating the mathematical graph.
          </p>
        </div>

        <div className="p-6 bg-[#141210] border border-[#C9A45C]/15 rounded-lg space-y-2.5">
          <p className="text-xs font-mono text-[#C9A45C]">02. Graph Search (BFS / DFS)</p>
          <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
            Evidence Path Exploration
          </h2>
          <p className="text-sm text-[#9C9281] leading-relaxed">
            Clues form an undirected evidence graph. Breadth-First Search (FIFO queue) maps level-by-level corroboration around a clue, while Depth-First Search (LIFO stack) follows deep causal chains down a single hypothesis.
          </p>
        </div>

        <div className="p-6 bg-[#141210] border border-[#C9A45C]/15 rounded-lg space-y-2.5">
          <p className="text-xs font-mono text-[#C9A45C]">03. Bayesian Networks</p>
          <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
            Exact Posterior Suspect Ranking
          </h2>
          <p className="text-sm text-[#9C9281] leading-relaxed">
            Each clue carries conditional likelihoods P(E | Suspect). Raazi applies Bayes’ Theorem across all discovered evidence so suspect probabilities normalize cleanly to 100.0% after every observation.
          </p>
        </div>

        <div className="p-6 bg-[#141210] border border-[#C9A45C]/15 rounded-lg space-y-2.5">
          <p className="text-xs font-mono text-[#C9A45C]">04. Decision Theory</p>
          <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
            Information-Gain Inquiry Selection
          </h2>
          <p className="text-sm text-[#9C9281] leading-relaxed">
            Candidate next questions are scored by Expected Information Gain IG(Q) = H(S) − E[H(S|Q)] using Shannon Entropy in bits, guiding the detective toward whichever question resolves the greatest ambiguity.
          </p>
        </div>
      </section>

      <section className="p-6 bg-[#141210] border border-[#C9A45C]/20 rounded-lg space-y-3">
        <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
          Architecture Note: Web Platform vs. Standalone Desktop
        </h2>
        <p className="text-sm text-[#9C9281] leading-relaxed max-w-prose">
          Raazi is engineered as a full-stack web platform rather than a standalone desktop binary. Because Bayesian inference, BFS/DFS traversal, and entropy ranking execute in sub-millisecond memory while NLP runs via secure server routes, a web architecture delivers instant cross-device access, Cloud Firestore memory sync, and fluid hardware-accelerated animations with zero installation friction.
        </p>
      </section>
    </main>
  );
}
