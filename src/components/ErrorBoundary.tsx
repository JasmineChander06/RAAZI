import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        friendly = `${parsed.error}${parsed.path ? ` (${parsed.operationType ?? 'op'} on ${parsed.path})` : ''}`;
      }
    } catch {
      // Keep raw message if not JSON
    }
    return { hasError: true, message: friendly };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0A09] text-[#E8DEC8] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#141210] border border-[#C9A45C]/25 rounded-lg p-8 space-y-4">
            <p className="text-xs font-mono uppercase tracking-widest text-[#C9A45C]">
              Ledger Interrupted
            </p>
            <h2 className="text-2xl font-serif font-semibold text-[#E8DEC8]">
              An archival error occurred
            </h2>
            <p className="text-sm text-[#9C9281] leading-relaxed break-words">
              {this.state.message || 'An unexpected issue interrupted the investigation chamber.'}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 text-sm font-medium bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d6b572] transition-colors cursor-pointer"
            >
              Return to Chamber
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
