import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowLeft, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase.ts';
import { ensureUserProfile } from '../services/firestoreCases.ts';

function mapAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('auth/operation-not-allowed')) {
    return 'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Enable Authentication > Sign-in method > Email/Password, or use Continue with Google below.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Switch to Sign In to enter your Raazi password.';
  }
  if (
    raw.includes('auth/invalid-credential') ||
    raw.includes('auth/wrong-password') ||
    raw.includes('auth/user-not-found')
  ) {
    return 'Incorrect email or Raazi password. Please verify your credentials or switch to Create Account.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'Your Raazi platform password must be at least 6 characters long.';
  }
  if (raw.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.';
  }
  return raw;
}

interface AuthCardProps {
  onSuccess: () => void;
  onClose?: () => void;
  onContinueAsGuest?: () => void;
  submitSignInLabel?: string;
  submitSignUpLabel?: string;
}

function AuthCard({
  onSuccess,
  onClose,
  onContinueAsGuest,
  submitSignInLabel = 'Sign In & Enter Chambers',
  submitSignUpLabel = 'Create Account & Enter Chambers',
}: AuthCardProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const cleanName = fullName.trim();
      const cleanEmail = email.trim();

      if (mode === 'signup') {
        if (!cleanName) {
          throw new Error('Please enter your full name to register your investigator dossier.');
        }
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: cleanName });
        await ensureUserProfile(cred.user, cleanName);
        void sendEmailVerification(cred.user).catch(() => undefined);
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (cleanName && cred.user.displayName !== cleanName) {
          await updateProfile(cred.user, { displayName: cleanName });
          await ensureUserProfile(cred.user, cleanName);
        }
      }
      onSuccess();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-[#141210]/95 border border-[#C9A45C]/25 rounded-lg p-6 sm:p-8 space-y-5 shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-mono uppercase tracking-widest text-[#B54842]">
            Investigator Registry
          </p>
          <h2 id="auth-modal-title" className="text-2xl sm:text-3xl font-serif font-semibold text-[#E8DEC8]">
            Welcome, Mystery Seekers
          </h2>
          <p className="text-xs text-[#9C9281] leading-relaxed">
            Sign in or register an investigator account dedicated exclusively to Raazi to enter the chambers, track your Case Map, and save solved dossiers.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="p-1.5 text-[#9C9281] hover:text-[#E8DEC8] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sign In / Create Account Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B0A09] rounded-md border border-[#C9A45C]/15">
        <button
          type="button"
          onClick={() => {
            setMode('signin');
            setError(null);
          }}
          className={`py-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
            mode === 'signin'
              ? 'bg-[#1C1915] text-[#C9A45C]'
              : 'text-[#9C9281] hover:text-[#E8DEC8]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={`py-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
            mode === 'signup'
              ? 'bg-[#1C1915] text-[#C9A45C]'
              : 'text-[#9C9281] hover:text-[#E8DEC8]'
          }`}
        >
          Create Account
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-[#1C1915] border border-[#B54842]/50 rounded text-xs text-[#E8DEC8] leading-relaxed"
        >
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#E8DEC8]">
            {mode === 'signup' ? 'Full Name' : 'Full Name (Optional on Sign In)'}
          </label>
          <input
            type="text"
            required={mode === 'signup'}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={
              mode === 'signup'
                ? 'e.g., Clara Vance'
                : 'Optional — updates your investigator badge'
            }
            maxLength={100}
            className="w-full bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3.5 py-2.5 text-sm text-[#E8DEC8] placeholder:text-[#9C9281]/60 focus:outline-none focus:border-[#C9A45C]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#E8DEC8]">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seeker@example.com"
            maxLength={254}
            className="w-full bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3.5 py-2.5 text-sm text-[#E8DEC8] placeholder:text-[#9C9281]/60 focus:outline-none focus:border-[#C9A45C]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-[#E8DEC8]">
              Raazi Platform Password
            </label>
            <span className="text-[11px] text-[#9C9281]">For this website only</span>
          </div>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters (unique to Raazi)"
            className="w-full bg-[#0B0A09] border border-[#C9A45C]/20 rounded-md px-3.5 py-2.5 text-sm text-[#E8DEC8] placeholder:text-[#9C9281]/60 focus:outline-none focus:border-[#C9A45C]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer disabled:opacity-50"
        >
          {submitting
            ? 'Authenticating…'
            : mode === 'signup'
              ? submitSignUpLabel
              : submitSignInLabel}
        </button>
      </form>

      <div className="relative flex items-center py-0.5">
        <div className="flex-grow border-t border-[#C9A45C]/15" />
        <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#9C9281]">
          Or
        </span>
        <div className="flex-grow border-t border-[#C9A45C]/15" />
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleGoogleSignIn()}
        className="w-full py-2.5 text-xs font-medium bg-[#0B0A09] border border-[#C9A45C]/25 text-[#E8DEC8] hover:border-[#C9A45C] rounded-md transition-colors cursor-pointer disabled:opacity-50"
      >
        Continue with Google
      </button>

      {onContinueAsGuest && (
        <div className="pt-1 text-center">
          <button
            type="button"
            disabled={submitting}
            onClick={onContinueAsGuest}
            className="text-xs text-[#9C9281] hover:text-[#E8DEC8] underline underline-offset-4 transition-colors cursor-pointer"
          >
            Enter Chamber as Guest Investigator (Local Session Only)
          </button>
        </div>
      )}
    </div>
  );
}

interface AuthGateScreenProps {
  onAuthenticated: () => void;
  onContinueAsGuest: () => void;
  onBackToIntro: () => void;
}

export function AuthGateScreen({
  onAuthenticated,
  onContinueAsGuest,
  onBackToIntro,
}: AuthGateScreenProps) {
  return (
    <div className="fixed inset-0 z-40 bg-[#0B0A09] flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(181,72,66,0.10)_0%,rgba(201,164,92,0.05)_34%,rgba(11,10,9,0.95)_66%,#0B0A09_100%)]"
      />

      <div className="relative z-10 w-full max-w-md space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToIntro}
            className="inline-flex items-center gap-1.5 text-xs text-[#9C9281] hover:text-[#E8DEC8] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Gate</span>
          </button>
          <span className="font-serif text-lg font-semibold text-[#C9A45C] tracking-wide">Raazi</span>
        </div>

        <AuthCard
          onSuccess={onAuthenticated}
          onContinueAsGuest={onContinueAsGuest}
        />
      </div>
    </div>
  );
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 bg-[#0B0A09]/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <AuthCard
        onSuccess={onClose}
        onClose={onClose}
        submitSignInLabel="Sign In to Raazi"
        submitSignUpLabel="Create Investigator Account"
      />
    </div>
  );
}
