import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CursorGlow } from "@/components/motion/CursorGlow";

/**
 * AuthShell — the ink atmosphere shared by login, registration and recovery.
 * Left: brand statement + the seal. Right: the form.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="ink relative flex min-h-screen overflow-x-clip">
      <CursorGlow />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="aurora" />
        <div className="grain" />
      </div>

      {/* Brand panel */}
      <aside className="relative hidden w-[44%] flex-col justify-between border-r border-white/8 p-12 lg:flex">
        <Link to="/" aria-label="Back to TaskContract home" className="transition-opacity hover:opacity-85">
          <Logo />
        </Link>

        <div className="relative">
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-4xl font-medium italic leading-[1.15] text-white"
          >
            “The agreement is the
            <span className="text-white/40"> memory </span>
            of the work.”
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 1 }}
            className="mt-8 space-y-2.5 border-l border-brass/30 pl-5"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">Ledger status</p>
            <div className="flex items-center gap-2">
              <span className="dot-pulse h-1.5 w-1.5 rounded-full bg-brass" />
              <span className="text-[13px] text-white/60">All systems recording</span>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25"
        >
          Version-locked · Append-only · Sealed
        </motion.p>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo />
            <Link to="/" className="flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
          {children}
          {footer}
        </motion.div>
      </main>
    </div>
  );
}
