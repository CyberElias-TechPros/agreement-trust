import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CursorGlow } from "@/components/motion/CursorGlow";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function NotFound() {
  const location = useLocation();
  usePageMeta("Page not found — TaskContract", "This page doesn't exist in the ledger.");

  return (
    <div className="ink relative flex min-h-screen flex-col items-center justify-center overflow-x-clip px-6 text-center">
      <CursorGlow />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="aurora opacity-50" />
        <div className="grain" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center"
      >
        <p className="text-outline font-display text-[120px] font-semibold italic leading-none sm:text-[180px]">404</p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.24em] text-brass">
          Entry not found in the ledger
        </p>
        <h1 className="mt-6 max-w-md font-display text-2xl italic leading-snug text-white">
          This page was never sealed — so it was never recorded.
        </h1>
        <p className="mt-4 max-w-sm font-mono text-xs leading-relaxed text-white/35">
          {location.pathname}
          <br />
          <span className="text-white/25">hash 0x0000…0000 · v0</span>
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)]"
          >
            <ArrowLeft className="h-4 w-4" /> Return to the ledger
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 transition-all duration-300 hover:border-white/35 hover:text-white"
          >
            Open workspace
          </Link>
        </div>
      </motion.div>

      <div className="absolute bottom-8">
        <Logo />
      </div>
    </div>
  );
}
