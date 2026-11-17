import { useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { DetectiveCase } from '../types/mystery.ts';

interface ArchivesViewProps {
  user: User | null;
  cases: DetectiveCase[];
  activeCaseId: string;
  loading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSelectCase: (caseData: DetectiveCase) => void;
  onDeleteCase: (caseId: string) => void;
  onOpenNewCase: () => void;
}

const ARCHIVE_IMAGE = '/src/assets/images/obsidian_parchment_archive_1794877118440.jpg';

export function ArchivesView({
  user,
  cases,
  activeCaseId,
  loading,
  onSignIn,
  onSignOut,
  onSelectCase,
  onDeleteCase,
  onOpenNewCase,
}: ArchivesViewProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'solved'>('all');

  const filtered = cases.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const solvedCount = cases.filter((c) => c.status === 'solved' && c.solvedCorrectly).length;

  return (
    <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-10 space-y-10">
      {/* Header split */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        <div className="md:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-[#C9A45C]">
              Persistent Investigation Memory
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-[#E8DEC8]">
              Case Archives
            </h1>
            <p className="text-sm sm:text-base text-[#9C9281] leading-relaxed max-w-prose">
              Every mystery opened, clue connected, and Bayesian probability snapshot is archived to your private Cloud Firestore vault so you may resume any investigation across sessions.
            </p>
          </div>

          {user ? (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#C9A45C]/15">
              <div className="text-xs text-[#9C9281] space-y-0.5 tabular-nums">
                <p className="text-sm font-medium text-[#E8DEC8]">
                  {user.displayName || user.email}
                </p>
                <p>
                  {cases.length} Archived Cases · {solvedCount} Solved
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenNewCase}
                  className="px-4 py-2 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer"
                >
                  New Mystery
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3.5 py-2 text-xs font-medium border border-[#C9A45C]/25 text-[#E8DEC8] hover:border-[#C9A45C] rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-[#C9A45C]/15 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-[#9C9281]">
                Sign in or create an investigator account to synchronize your Case Map and saved dossiers in the cloud.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="px-5 py-2.5 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer"
              >
                Sign In / Create Account
              </button>
            </div>
          )}
        </div>

        <div className="md:col-span-5 rounded-lg overflow-hidden border border-[#C9A45C]/15 bg-[#141210] min-h-[200px]">
          {!imgFailed ? (
            <img
              src={ARCHIVE_IMAGE}
              alt="Ancient parchment scrolls, brass calipers, and wax seal on obsidian slate"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-6 text-xs text-[#9C9281]">
              Obsidian Archival Ledger
            </div>
          )}
        </div>
      </section>

      {/* Filter & Case List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9A45C]/15 pb-3">
          <div className="flex items-center gap-1 p-1 bg-[#141210] rounded-md border border-[#C9A45C]/10">
            {(['all', 'active', 'solved'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium capitalize rounded transition-colors cursor-pointer ${
                  filter === tab
                    ? 'bg-[#1C1915] text-[#C9A45C]'
                    : 'text-[#9C9281] hover:text-[#E8DEC8]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#9C9281] tabular-nums">
            Showing {filtered.length} dossiers
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-24 bg-[#141210] border border-[#C9A45C]/10 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 bg-[#141210] border border-[#C9A45C]/15 rounded-lg text-center space-y-3">
            <h2 className="text-xl font-serif font-semibold text-[#E8DEC8]">
              No archived cases found
            </h2>
            <p className="text-sm text-[#9C9281] max-w-md mx-auto">
              Generate a new fictional mystery to begin building your permanent investigative ledger.
            </p>
            <button
              type="button"
              onClick={onOpenNewCase}
              className="px-5 py-2.5 text-xs font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer"
            >
              Generate First Case
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#C9A45C]/10 border-t border-b border-[#C9A45C]/10">
            {filtered.map((item) => {
              const isCurrent = item.id === activeCaseId;
              const lead = item.suspects[0];
              return (
                <div
                  key={item.id}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#9C9281] tabular-nums">
                      <span className="text-[#C9A45C]">{item.era}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.difficulty}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.clueCount} clues</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{item.status}</span>
                    </div>
                    <h3 className="text-xl font-serif font-semibold text-[#E8DEC8]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-[#9C9281] line-clamp-2 max-w-2xl">
                      {item.synopsis}
                    </p>
                    {lead && (
                      <p className="text-xs text-[#9C9281] tabular-nums">
                        Top suspect: {lead.name} ({(lead.posteriorProbability * 100).toFixed(1)}%)
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectCase(item)}
                      className={`px-4 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-[#1C1915] border border-[#C9A45C] text-[#C9A45C]'
                          : 'bg-[#C9A45C] text-[#0B0A09] font-semibold hover:bg-[#d8b671]'
                      }`}
                    >
                      {isCurrent ? 'Active in Chamber' : 'Open Dossier'}
                    </button>
                    {user && item.ownerId === user.uid && (
                      <button
                        type="button"
                        onClick={() => onDeleteCase(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="p-2 text-[#9C9281] hover:text-[#B54842] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
