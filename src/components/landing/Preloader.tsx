import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LogoMark } from "@/components/Logo";

/**
 * Preloader — the seal lands before the page does.
 * Shown once per session; skipped entirely for reduced-motion users.
 */
export function Preloader() {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduce || sessionStorage.getItem("tc-intro-seen")) {
      setDone(true);
      return;
    }
    sessionStorage.setItem("tc-intro-seen", "1");
    const t = setTimeout(() => setDone(true), 1700);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080a12]"
          exit={{ y: "-100%", transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ scale: 2.6, opacity: 0, rotate: -16, filter: "blur(8px)" }}
              animate={{ scale: 1, opacity: 1, rotate: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.55, ease: [0.34, 1.3, 0.64, 1] }}
            >
              <LogoMark className="h-16 w-16" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="flex items-baseline gap-[0.3em] text-xl text-white"
            >
              <span className="font-sans font-bold tracking-tight">Task</span>
              <span className="font-display italic">Contract</span>
            </motion.div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeInOut" }}
              className="h-px w-40 origin-left bg-gradient-to-r from-brass/70 to-transparent"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
