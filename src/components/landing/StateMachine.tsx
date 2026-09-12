import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PenLine, Send, Check, Hammer, FileUp, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const stages = [
  {
    id: "draft",
    label: "Draft",
    icon: PenLine,
    actor: "The delegator",
    title: "Write the agreement once",
    body: "Title, scope, deadline and parties — captured as version 1. From here, the original can never be silently altered: every change becomes a new, numbered version with a stated reason.",
    chip: "v1 locked · 0x8f3a…c21e",
  },
  {
    id: "sent",
    label: "Sent",
    icon: Send,
    actor: "The delegator",
    title: "Offer it formally",
    body: "Sending notifies the executor and opens the acceptance window. Nothing about the agreement is ambiguous because the exact wording they saw is preserved.",
    chip: "notification → executor",
  },
  {
    id: "accepted",
    label: "Accepted",
    icon: Check,
    actor: "The executor",
    title: "Acceptance is consent",
    body: "The executor accepts the exact version they received — not a vague chat message. Acceptance timestamps the commitment and moves the contract into active work.",
    chip: "consent recorded · 14:32 UTC",
  },
  {
    id: "in_progress",
    label: "In Progress",
    icon: Hammer,
    actor: "Both parties",
    title: "Structured dialogue",
    body: "Progress updates, clarifications, issues and scope proposals — every conversation is typed, threaded to the contract, and part of the record. No more digging through chat history.",
    chip: "progress 55% · 12 updates",
  },
  {
    id: "submitted",
    label: "Submitted",
    icon: FileUp,
    actor: "The executor",
    title: "Completion is a claim",
    body: "Finishing means submitting with evidence — a summary and attachments. The contract moves to review, and the delegator is notified that a decision is owed.",
    chip: "awaiting review · 1 day",
  },
  {
    id: "approved",
    label: "Approved",
    icon: BadgeCheck,
    actor: "The delegator",
    title: "Sealed into the ledger",
    body: "Approval closes the loop: the contract is sealed, the full history is preserved, and analytics update. Rejection is just as structured — with reasons, and a clear path to resubmit.",
    chip: "sealed · archived to ledger",
  },
];

export function StateMachine() {
  const [active, setActive] = useState(1);
  const reduce = useReducedMotion();
  const stage = stages[active];
  const Icon = stage.icon;

  const progress = useMemo(() => ((active + 1) / stages.length) * 100, [active]);

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0d1020]/80 p-6 backdrop-blur-sm sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Contract lifecycle</p>
        <p className="font-mono text-[10px] text-white/30">
          {active + 1} / {stages.length}
        </p>
      </div>

      {/* rail */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
          <motion.div
            className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-indigo to-brass"
            animate={{ width: `${progress}%` }}
            transition={{ duration: reduce ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="relative flex justify-between">
            {stages.map((s, i) => {
              const SIcon = s.icon;
              const done = i < active;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(i)}
                  aria-label={`View stage: ${s.label}`}
                  aria-pressed={i === active}
                  className="group flex flex-col items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo"
                >
                  <motion.span
                    animate={{
                      scale: i === active ? 1.12 : 1,
                      backgroundColor: i <= active ? "rgba(123,135,255,1)" : "rgba(255,255,255,0.06)",
                      borderColor: i <= active ? "rgba(123,135,255,1)" : "rgba(255,255,255,0.14)",
                    }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
                      i <= active ? "text-[#0b0d1c]" : "text-white/40 group-hover:text-white/70"
                    )}
                  >
                    <SIcon className="h-4 w-4" />
                  </motion.span>
                  <span
                    className={cn(
                      "hidden text-[10px] font-semibold uppercase tracking-wider transition-colors sm:block",
                      i === active ? "text-white" : i < active ? "text-indigo-bright" : "text-white/35 group-hover:text-white/60"
                    )}
                  >
                    {done && i !== active ? "✓ " : ""}
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* detail */}
      <div className="mt-8 min-h-[190px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-6 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-brass" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brass">{stage.actor}</p>
              </div>
              <h3 className="mt-2 font-display text-2xl italic text-white" style={{ fontVariationSettings: "'opsz' 48" }}>
                {stage.title}
              </h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">{stage.body}</p>
            </div>
            <div className="flex items-start">
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-white/45">
                {stage.chip}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
