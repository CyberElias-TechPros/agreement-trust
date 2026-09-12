import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Magnetic } from "@/components/motion/Magnetic";

const terms = [
  { index: "1.1", text: "Deliver the Q3 analytics revamp — dashboards, exports and the new report builder." },
  { index: "1.2", text: "Every change is proposed as a new version, with a stated reason, before it applies." },
  { index: "1.3", text: "Completion is a submission, not a guess. Approval seals it into the ledger." },
];

const parties = [
  { role: "Delegator", name: "Alex Morgan", initials: "AM", tone: "bg-indigo/20 text-indigo-bright border-indigo/30" },
  { role: "Executor", name: "Sarah Chen", initials: "SC", tone: "bg-brass/15 text-brass border-brass/30" },
];

/**
 * AgreementCard — the signature hero interaction.
 * A living agreement document that can be sealed: terms reveal,
 * the signature draws itself, and the brass seal lands with impact.
 */
export function AgreementCard() {
  const [sealed, setSealed] = useState(false);
  const [replay, setReplay] = useState(0);
  const reduce = useReducedMotion();

  const seal = () => {
    if (sealed) {
      setSealed(false);
      setTimeout(() => {
        setReplay((r) => r + 1);
        setSealed(true);
      }, 60);
    } else {
      setSealed(true);
    }
  };

  return (
    <div className="relative">
      {/* ambient glow behind the document */}
      <div aria-hidden="true" className="absolute -inset-10 rounded-[40px] bg-[radial-gradient(circle_at_60%_40%,rgba(123,135,255,0.16),transparent_65%)] blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 42, rotateX: 6 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1200 }}
        className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-[#12162b] to-[#0c0f1e] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)] overflow-hidden animate-float-slow"
      >
        {/* document chrome */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.18em] text-[#8b96d9]">
              AGREEMENT — TCP-2026-00042
            </span>
          </div>
          <AnimatePresence mode="wait">
            {sealed ? (
              <motion.span
                key="sealed"
                initial={{ opacity: 0, scale: 0.8, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brass"
              >
                <Check className="h-3 w-3" /> Sealed
              </motion.span>
            ) : (
              <motion.span
                key="draft"
                exit={{ opacity: 0, y: 4 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50"
              >
                Awaiting seal
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="relative px-6 py-6">
          {/* title */}
          <p className="font-display text-[22px] leading-snug text-white italic" style={{ fontVariationSettings: "'opsz' 60" }}>
            Ship the Q3 analytics revamp
          </p>
          <p className="mt-1.5 text-[13px] text-white/45">Scope, parties and terms — locked as version 1.</p>

          {/* parties */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {parties.map((p, i) => (
              <div key={p.role} className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{p.role}</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${p.tone}`}>
                    {p.initials}
                  </span>
                  <span className="text-[13px] font-medium text-white/85">{p.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* terms */}
          <div className="mt-5 space-y-3">
            {terms.map((t, i) => (
              <motion.div
                key={`${replay}-${t.index}`}
                initial={{ opacity: reduce ? 1 : 0.12, y: reduce ? 0 : 6 }}
                animate={sealed ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.5 + i * 0.28, duration: 0.5, ease: "easeOut" }}
                className="flex items-start gap-3"
              >
                <span className="mt-[3px] font-mono text-[10px] text-brass/80">{t.index}</span>
                <p className="text-[13px] leading-relaxed text-white/70">{t.text}</p>
              </motion.div>
            ))}
          </div>

          {/* signature row */}
          <div className="mt-6 flex items-end justify-between border-t border-dashed border-white/10 pt-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Executor signature</p>
              <div className="relative mt-1 h-12 w-44">
                {sealed && (
                  <svg viewBox="0 0 176 48" fill="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <motion.path
                      d="M14 34 C 16 20, 22 12, 30 16 C 36 19, 34 26, 28 28 C 24 29, 22 24, 26 21 C 32 16, 40 18, 42 24 C 44 30, 38 34, 34 32 C 31 30, 33 24, 40 21 C 48 17, 56 19, 57 26 C 58 33, 52 36, 47 34 C 43 32, 45 25, 52 23 C 60 21, 68 24, 67 30 C 66 36, 58 38, 52 35"
                      stroke="#e8c37a"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 1.35, duration: 1.5, ease: "easeInOut" }}
                    />
                  </svg>
                )}
              </div>
              <AnimatePresence>
                {sealed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.2 }}
                    className="mt-1 font-mono text-[9px] text-white/30"
                  >
                    recorded · hash 0x8f3a…c21e · v1
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* the seal */}
            <div className="relative h-20 w-20 shrink-0">
              <AnimatePresence>
                {sealed && (
                  <>
                    <motion.div
                      initial={{ scale: 0.2, opacity: 0.9 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ delay: 1.9, duration: 0.7, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border-2 border-brass/60"
                    />
                    <motion.div
                      initial={{ scale: 2.6, rotate: -24, opacity: 0, filter: "blur(6px)" }}
                      animate={{ scale: 1, rotate: -8, opacity: 1, filter: "blur(0px)" }}
                      transition={{ delay: 1.95, duration: 0.55, ease: [0.34, 1.5, 0.64, 1] }}
                      className="absolute inset-0 flex items-center justify-center rounded-full"
                      style={{
                        background: "radial-gradient(circle at 35% 30%, #e8c37a, #d9a441 45%, #a86f1c 90%)",
                        boxShadow: "0 10px 30px rgba(217,164,65,0.45), inset 0 -3px 8px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.35)",
                      }}
                    >
                      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[#7a4f12]/40">
                        <div className="text-center leading-none">
                          <p className="font-display text-[15px] font-semibold italic text-[#4a3009]">TC</p>
                          <p className="mt-0.5 text-[6.5px] font-bold uppercase tracking-[0.22em] text-[#4a3009]/80">Sealed</p>
                          <p className="mt-0.5 text-[6px] font-mono tracking-wider text-[#4a3009]/70">{new Date().getFullYear()}</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* control */}
      <div className="mt-6 flex justify-center">
        <Magnetic strength={0.3}>
          <button
            onClick={seal}
            className="group inline-flex items-center gap-2.5 rounded-full border border-brass/40 bg-brass/10 px-6 py-3 text-sm font-semibold text-brass transition-all duration-300 hover:bg-brass hover:text-[#241503] hover:shadow-[0_8px_40px_rgba(217,164,65,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
            {sealed ? "Seal another copy" : "Seal this agreement"}
          </button>
        </Magnetic>
      </div>
    </div>
  );
}
