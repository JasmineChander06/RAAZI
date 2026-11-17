import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CipherGateIntroProps {
  onEnter: () => void;
}

const SEAL_IMAGE = '/src/assets/images/noir_detective_seal_1794878591366.jpg';

export function CipherGateIntro({ onEnter }: CipherGateIntroProps) {
  const [aligned, setAligned] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAligned(true);
    }, 1150);
    return () => window.clearTimeout(timer);
  }, []);

  const handleEnter = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      onEnter();
    }, 460);
  };

  return (
    <AnimatePresence>
      {!exiting ? (
        <motion.div
          key="cipher-gate"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-[#0B0A09] flex flex-col items-center justify-center px-6 py-10 overflow-hidden"
        >
          {/* Ambient radial obsidian & crimson noir glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(181,72,66,0.12)_0%,rgba(201,164,92,0.06)_32%,rgba(11,10,9,0.94)_62%,#0B0A09_100%)]"
          />

          <button
            type="button"
            onClick={handleEnter}
            className="absolute top-6 right-6 z-10 text-xs font-medium text-[#9C9281] hover:text-[#E8DEC8] transition-colors px-3 py-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C9A45C]"
          >
            Skip Intro
          </button>

          <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
            <div className="relative w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center mb-8">
              <motion.svg
                viewBox="0 0 240 240"
                className="absolute inset-0 w-full h-full text-[#C9A45C]/45"
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: aligned ? 0 : 18, opacity: 1 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              >
                <circle cx="120" cy="120" r="114" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="4 6" />
                <circle cx="120" cy="120" r="102" fill="none" stroke="currentColor" strokeWidth="1" />
                <line x1="120" y1="6" x2="120" y2="20" stroke="currentColor" strokeWidth="1.2" />
                <line x1="120" y1="220" x2="120" y2="234" stroke="currentColor" strokeWidth="1.2" />
                <line x1="6" y1="120" x2="20" y2="120" stroke="currentColor" strokeWidth="1.2" />
                <line x1="220" y1="120" x2="234" y2="120" stroke="currentColor" strokeWidth="1.2" />
              </motion.svg>

              <motion.svg
                viewBox="0 0 240 240"
                className="absolute inset-0 w-full h-full text-[#B54842]/45"
                initial={{ rotate: 60, opacity: 0 }}
                animate={{ rotate: aligned ? 0 : -24, opacity: 1 }}
                transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              >
                <circle cx="120" cy="120" r="88" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 8" />
                <polygon
                  points="120,28 200,166 40,166"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.7"
                />
              </motion.svg>

              <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                className="w-36 h-36 sm:w-40 sm:h-40 rounded-full overflow-hidden border border-[#C9A45C]/35 bg-[#141210] shadow-2xl flex items-center justify-center"
              >
                {!imgFailed ? (
                  <img
                    src={SEAL_IMAGE}
                    alt="Obsidian compass and crimson wax detective seal"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover scale-110"
                  />
                ) : (
                  <span className="font-serif text-4xl text-[#C9A45C] tracking-widest">R</span>
                )}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <p className="text-xs font-mono tracking-[0.22em] uppercase text-[#B54842]">
                Murder Mystery &amp; Deduction
              </p>
              <h1 className="text-5xl sm:text-6xl font-serif font-semibold tracking-tight text-[#E8DEC8]">
                Raazi
              </h1>
              <p className="text-sm text-[#9C9281] leading-relaxed max-w-sm mx-auto">
                Unravel staged murder mysteries from manor studies to midnight sleepers—guided by Bayesian inference and evidence graph search.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: aligned ? 1 : 0.6, y: 0 }}
              transition={{ delay: 0.85, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8"
            >
              <button
                type="button"
                onClick={handleEnter}
                className="px-7 py-3 text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C] whitespace-nowrap"
              >
                Enter the Chamber
              </button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
