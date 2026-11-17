export type WorkspaceView = 'chamber' | 'map' | 'archives' | 'methodology';

interface TopBarProps {
  activeView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  ledgerOpen: boolean;
  onToggleLedger: () => void;
  isSignedIn: boolean;
  onSignIn: () => void;
  onOpenNewCase: () => void;
}

export function TopBar({
  activeView,
  onNavigate,
  ledgerOpen,
  onToggleLedger,
  isSignedIn,
  onSignIn,
  onOpenNewCase,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#0B0A09]/95 backdrop-blur-sm border-b border-[#C9A45C]/15">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('chamber')}
          className="text-2xl font-serif font-semibold tracking-wide text-[#E8DEC8] hover:text-[#C9A45C] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C9A45C]"
        >
          Raazi
        </button>

        {/* Zone 2: Clean single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Primary Navigation">
          <button
            type="button"
            onClick={() => onNavigate('chamber')}
            className={`py-1.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'chamber'
                ? 'text-[#E8DEC8] border-[#C9A45C]'
                : 'text-[#9C9281] border-transparent hover:text-[#E8DEC8]'
            }`}
          >
            Chamber
          </button>
          <button
            type="button"
            onClick={() => onNavigate('map')}
            className={`py-1.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'map'
                ? 'text-[#E8DEC8] border-[#C9A45C]'
                : 'text-[#9C9281] border-transparent hover:text-[#E8DEC8]'
            }`}
          >
            Case Map
          </button>
          <button
            type="button"
            onClick={() => onNavigate('archives')}
            className={`py-1.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'archives'
                ? 'text-[#E8DEC8] border-[#C9A45C]'
                : 'text-[#9C9281] border-transparent hover:text-[#E8DEC8]'
            }`}
          >
            Archives
          </button>
          <button
            type="button"
            onClick={onToggleLedger}
            className={`py-1.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              ledgerOpen && activeView === 'chamber'
                ? 'text-[#C9A45C] border-[#C9A45C]'
                : 'text-[#9C9281] border-transparent hover:text-[#E8DEC8]'
            }`}
          >
            AI Ledger
          </button>
          <button
            type="button"
            onClick={() => onNavigate('methodology')}
            className={`py-1.5 border-b transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'methodology'
                ? 'text-[#E8DEC8] border-[#C9A45C]'
                : 'text-[#9C9281] border-transparent hover:text-[#E8DEC8]'
            }`}
          >
            Methodology
          </button>
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="shrink-0">
          {isSignedIn ? (
            <button
              type="button"
              onClick={onOpenNewCase}
              className="px-4 py-2 text-xs sm:text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C9A45C]"
            >
              New Mystery
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 text-xs sm:text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C9A45C]"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile compact navigation row */}
      <nav
        className="flex md:hidden items-center justify-around border-t border-[#C9A45C]/10 px-2 py-1.5 text-xs"
        aria-label="Mobile Navigation"
      >
        <button
          type="button"
          onClick={() => onNavigate('chamber')}
          className={`px-2 py-1.5 whitespace-nowrap cursor-pointer ${
            activeView === 'chamber' ? 'text-[#C9A45C] font-semibold' : 'text-[#9C9281]'
          }`}
        >
          Chamber
        </button>
        <button
          type="button"
          onClick={() => onNavigate('map')}
          className={`px-2 py-1.5 whitespace-nowrap cursor-pointer ${
            activeView === 'map' ? 'text-[#C9A45C] font-semibold' : 'text-[#9C9281]'
          }`}
        >
          Case Map
        </button>
        <button
          type="button"
          onClick={() => onNavigate('archives')}
          className={`px-2 py-1.5 whitespace-nowrap cursor-pointer ${
            activeView === 'archives' ? 'text-[#C9A45C] font-semibold' : 'text-[#9C9281]'
          }`}
        >
          Archives
        </button>
        <button
          type="button"
          onClick={onToggleLedger}
          className={`px-2 py-1.5 whitespace-nowrap cursor-pointer ${
            ledgerOpen ? 'text-[#C9A45C] font-semibold' : 'text-[#9C9281]'
          }`}
        >
          Ledger
        </button>
        <button
          type="button"
          onClick={() => onNavigate('methodology')}
          className={`px-2 py-1.5 whitespace-nowrap cursor-pointer ${
            activeView === 'methodology' ? 'text-[#C9A45C] font-semibold' : 'text-[#9C9281]'
          }`}
        >
          Method
        </button>
      </nav>
    </header>
  );
}
