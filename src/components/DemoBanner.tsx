import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, X } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

/**
 * DemoBanner — an honest, dismissible notice shown whenever the app is
 * running against the in-browser demo workspace instead of the backend.
 */
export function DemoBanner() {
  const { isAuthenticated } = useAuth();
  const [demoActive, setDemoActive] = useState(api.demoActive);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => api.subscribeDemo(setDemoActive), []);

  const visible = demoActive && isAuthenticated && !dismissed;
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-4 pb-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        role="status"
        className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-brass/30 bg-[#141022]/95 px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brass/15">
          <FlaskConical className="h-4 w-4 text-brass" />
        </span>
        <p className="flex-1 text-xs leading-relaxed text-white/80">
          <span className="font-semibold text-brass">Demo workspace</span> — the backend isn't connected, so this
          session runs entirely in your browser with sample data. Everything you do persists locally for your next visit.
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss demo notice"
          className="shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </div>
  );
}
