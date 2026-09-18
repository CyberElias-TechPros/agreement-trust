import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  useReducedMotion,
  useInView,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GitBranch,
  ShieldCheck,
  MessageSquareText,
  Users,
  BarChart3,
  Zap,
  Quote,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Magnetic } from "@/components/motion/Magnetic";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { CursorGlow } from "@/components/motion/CursorGlow";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { Preloader } from "@/components/landing/Preloader";
import { AgreementCard } from "@/components/landing/AgreementCard";
import { StateMachine } from "@/components/landing/StateMachine";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const painPoints = [
  {
    n: "01",
    title: "Ambiguity",
    body: "“I thought you meant…” is where delegated work goes to die. A chat message is not an agreement — it has no version, no scope, and no memory.",
  },
  {
    n: "02",
    title: "Scope creep",
    body: "Requirements drift through meetings and threads until nobody can say what was actually promised. Every silent change erodes trust.",
  },
  {
    n: "03",
    title: "No evidence",
    body: "When a deadline slips, the conversation becomes archaeology: whose understanding was right? Without a record, disputes are settled by loudness.",
  },
];

const features = [
  {
    icon: GitBranch,
    title: "Version-locked agreements",
    body: "The agreement is append-only. Edits become numbered versions with a stated reason — the original is always recoverable and always cited.",
  },
  {
    icon: MessageSquareText,
    title: "Structured interactions",
    body: "Progress updates, clarifications, scope proposals and issues — each has a type, a place and a history. Conversations stop living in chat.",
  },
  {
    icon: ShieldCheck,
    title: "An audit trail that testifies",
    body: "Every state change, version and interaction is logged with actor and timestamp. When questions arise, the record answers.",
  },
  {
    icon: Users,
    title: "Roles with clear sightlines",
    body: "Delegators, executors and observers see exactly what concerns them. Accountability is assigned, not assumed.",
  },
  {
    icon: BarChart3,
    title: "Analytics, not anecdotes",
    body: "Completion rates, workloads and bottlenecks derived from real contract data — the numbers your retrospectives have been missing.",
  },
  {
    icon: Zap,
    title: "A lifecycle that finishes",
    body: "Draft → sent → accepted → submitted → approved. Every contract has a path to a sealed ending — and a record of how it got there.",
  },
];

const steps = [
  {
    n: "01",
    title: "Draft the agreement",
    body: "Scope, deadline, priority and parties — written once, locked as version 1.",
  },
  {
    n: "02",
    title: "Send it. Accept it.",
    body: "The executor accepts the exact version they received. Consent is timestamped.",
  },
  {
    n: "03",
    title: "Track, submit, seal",
    body: "Structured updates along the way; a submission with evidence at the end; a seal when approved.",
  },
];

const proofCards = [
  {
    label: "Version history",
    title: "Every edit, numbered and reasoned",
    body: "v2 adds the revenue overview — “after finance stakeholder review”. The diff, the author, the why: preserved forever.",
    detail: "v3 · latest",
  },
  {
    label: "Interaction feed",
    title: "Progress you can point to",
    body: "55% — wireframes complete. Typed interactions replace “I thought I told you” with a URL.",
    detail: "12 updates",
  },
  {
    label: "The ledger",
    title: "Sealed, not deleted",
    body: "Approved contracts archive with their full history intact. Nothing is ever overwritten or lost.",
    detail: "0x8f3a…c21e",
  },
];

const useCases = [
  {
    role: "Manager → Team",
    quote: "“The team knows exactly what ‘done’ means, and I know exactly what was promised.”",
    body: "Delegate deliverables with versioned scope, structured check-ins and a review gate that forces a decision.",
  },
  {
    role: "Client ↔ Freelancer",
    quote: "“Scope changes are proposals now — visible, versioned, accepted. Not surprises.”",
    body: "Client and freelancer work against the same immutable agreement, with every clarification on the record.",
  },
  {
    role: "You → Your assistant",
    quote: "“I stopped repeating myself. The contract is the brief, the tracker and the receipt.”",
    body: "Even solo delegators get the clarity of a system: agreements, updates and receipts in one ledger.",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    features: ["5 active contracts", "2 team members", "Full audit trail", "Email notifications"],
    cta: "Start free",
    popular: false,
  },
  {
    name: "Professional",
    price: "$12",
    period: "per user / month",
    features: [
      "Unlimited contracts & members",
      "Audit export (PDF / CSV)",
      "Custom categories & branding",
      "API access",
      "Priority support",
    ],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual agreement",
    features: ["Everything in Professional", "SSO / SAML", "Advanced RBAC & departments", "Data residency options", "Dedicated support"],
    cta: "Contact sales",
    popular: false,
  },
];

const faqs = [
  {
    q: "How is this different from a task manager?",
    a: "Task managers optimise for visualising work. TaskContract optimises for accountability: agreements are version-locked, interactions are structured by type, and every state change is part of an immutable audit trail. It's a governance layer for delegated work, not another board.",
  },
  {
    q: "What happens when scope changes mid-project?",
    a: "Scope changes are proposals, not edits. The new version is drafted with a stated reason, the change is visible to both parties, and the previous version remains on record. Acceptance applies to a specific version — there's never a silent rewrite.",
  },
  {
    q: "Who can see my contracts?",
    a: "Only your organisation's members, and only within their role. Delegators manage their contracts, executors see what's assigned to them, and observers get read access. Organisations are fully isolated from one another.",
  },
  {
    q: "Can I export the audit trail?",
    a: "Yes — on Professional and Enterprise plans, contracts export with their full version history, interaction feed and audit log, so the record travels with you into any dispute or review process.",
  },
  {
    q: "Do both parties need an account?",
    a: "The executor accepts and reports inside the workspace, so yes — they're invited with a role. Inviting takes seconds, and the acceptance timestamp is what turns a task into a commitment.",
  },
];

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

function WordReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: reduce ? 0 : "110%", opacity: reduce ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: delay + i * 0.055, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#product", label: "Product" },
    { href: "#features", label: "Features" },
    { href: "#workflow", label: "Workflow" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "border-b border-white/8 bg-[#080a12]/80 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="TaskContract home" className="transition-opacity hover:opacity-85">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative text-[13px] font-medium text-white/55 transition-colors hover:text-white"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-indigo to-brass transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="hidden text-[13px] font-medium text-white/60 transition-colors hover:text-white sm:block"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/register")}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)]"
          >
            Enter the ledger
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Marquee() {
  const items = [
    "Version-locked agreements",
    "Structured interactions",
    "Immutable audit trail",
    "Role-based clarity",
    "Evidence over argument",
  ];
  const row = [...items, ...items];
  return (
    <div aria-hidden="true" className="relative overflow-hidden border-y border-white/8 py-5">
      <div className="marquee-track gap-10 pr-10">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-outline font-display text-3xl font-semibold italic sm:text-4xl">{item}</span>
            <span className="h-1.5 w-1.5 rotate-45 bg-brass/70" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#080a12] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#080a12] to-transparent" />
    </div>
  );
}

function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-heading" className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">The problem</p>
        <h2 id="problem-heading" className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-white sm:text-5xl">
          Delegation fails <em className="text-white/40">silently.</em>
        </h2>
      </Reveal>
      <RevealGroup className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 lg:grid-cols-3" stagger={0.12}>
        {painPoints.map((p) => (
          <RevealItem key={p.n} className="group relative bg-[#0a0c16] p-8 transition-colors duration-500 hover:bg-[#0d1020]">
            <span className="font-display text-6xl font-light italic text-white/8 transition-colors duration-500 group-hover:text-brass/20">
              {p.n}
            </span>
            <h3 className="mt-6 font-display text-2xl italic text-white">{p.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{p.body}</p>
            <span className="absolute inset-x-8 bottom-0 h-px scale-x-0 bg-gradient-to-r from-indigo to-brass transition-transform duration-500 group-hover:scale-x-100" />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

function Product() {
  return (
    <section id="product" aria-labelledby="product-heading" className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">The product</p>
        <h2 id="product-heading" className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
          One agreement, <em className="text-white/40">a complete record.</em>
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-white/50">
          Every contract runs the same lifecycle — six states, governed transitions, and a ledger that remembers everything. Explore it:
        </p>
      </Reveal>

      <Reveal className="mt-14" y={40}>
        <StateMachine />
      </Reveal>

      <RevealGroup className="mt-6 grid gap-6 md:grid-cols-3" stagger={0.1}>
        {proofCards.map((c) => (
          <RevealItem key={c.label}>
            <div className="group h-full rounded-2xl border border-white/8 bg-white/[0.02] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.04]">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{c.label}</p>
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-brass/80">
                  {c.detail}
                </span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-white">{c.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/45">{c.body}</p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

function Features() {
  return (
    <section id="features" aria-labelledby="features-heading" className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.4fr]">
        <div>
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Capabilities</p>
            <h2 id="features-heading" className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
              Built for the <em className="text-white/40">moment it matters.</em>
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/50">
              Disputes aren't won with vibes. Every capability exists to make one thing true: the record is better than anyone's memory.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-8">
            <button
              onClick={() => document.getElementById("cta")?.scrollIntoView({ behavior: "smooth" })}
              className="group inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              Start sealing work
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </Reveal>
        </div>

        <RevealGroup className="divide-y divide-white/8 border-t border-white/8" stagger={0.06}>
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <RevealItem key={f.title}>
                <div className="group flex gap-6 py-7 transition-colors duration-300 hover:bg-white/[0.015] sm:gap-10 sm:px-4">
                  <span className="font-mono text-xs text-white/25 transition-colors group-hover:text-brass">{String(i + 1).padStart(2, "0")}</span>
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-bright/80 transition-transform duration-300 group-hover:scale-110" />
                  <div>
                    <h3 className="font-display text-xl italic text-white transition-transform duration-300 group-hover:translate-x-1">
                      {f.title}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/45">{f.body}</p>
                  </div>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}

function Workflow() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotion();
  const scaleY = useSpring(0, { stiffness: 60, damping: 20 });
  useEffect(() => {
    if (inView && !reduce) scaleY.set(1);
    else scaleY.set(0);
  }, [inView, reduce, scaleY]);

  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="relative border-y border-white/8 bg-[#0a0c16] py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Workflow</p>
          <h2 id="workflow-heading" className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
            Three moves. <em className="text-white/40">Zero ambiguity.</em>
          </h2>
        </Reveal>

        <div ref={ref} className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          <div aria-hidden="true" className="absolute left-0 right-0 top-6 hidden h-px bg-white/10 md:block">
            <motion.div
              style={{ scaleY }}
              className="absolute inset-0 origin-left bg-gradient-to-r from-indigo via-[#8b96f5] to-brass"
            />
          </div>
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="relative">
              <div className="flex items-center gap-4">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-[#0d1020] font-display text-lg italic text-brass">
                  {s.n}
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 md:block">
                  {["Agreement", "Consent", "Completion"][i]}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/45">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: 8, label: "States in the lifecycle", note: "governed transitions" },
    { value: 100, suffix: "%", label: "Append-only history", note: "nothing overwritten" },
    { value: 6, label: "Structured interaction types", note: "every conversation typed" },
    { value: 1, label: "Click to seal", note: "approval, recorded forever" },
  ];
  return (
    <section aria-label="Product facts" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <RevealGroup className="grid grid-cols-2 gap-10 lg:grid-cols-4" stagger={0.1}>
        {stats.map((s) => (
          <RevealItem key={s.label} className="text-center">
            <p className="font-display text-5xl font-light text-white sm:text-6xl">
              <CountUp to={s.value} suffix={s.suffix || ""} />
            </p>
            <p className="mt-3 text-sm font-medium text-white/70">{s.label}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">{s.note}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

function UseCases() {
  return (
    <section aria-labelledby="usecases-heading" className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Who it's for</p>
        <h2 id="usecases-heading" className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
          Anywhere work is <em className="text-white/40">delegated.</em>
        </h2>
      </Reveal>
      <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-3" stagger={0.12}>
        {useCases.map((u) => (
          <RevealItem key={u.role}>
            <figure className="group flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.02] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-brass/25 hover:bg-white/[0.04]">
              <Quote className="h-5 w-5 text-brass/60" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 font-display text-lg italic leading-snug text-white/90">
                {u.quote}
              </blockquote>
              <figcaption className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">{u.role}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/45">{u.body}</p>
              </figcaption>
            </figure>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

function Pricing() {
  const navigate = useNavigate();
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="relative mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Pricing</p>
        <h2 id="pricing-heading" className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
          Start free. <em className="text-white/40">Scale when trust scales.</em>
        </h2>
      </Reveal>
      <RevealGroup className="mt-14 grid gap-6 lg:grid-cols-3" stagger={0.1}>
        {pricingPlans.map((p) => (
          <RevealItem key={p.name}>
            <div
              className={cn(
                "relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-500 hover:-translate-y-1",
                p.popular
                  ? "border-brass/40 bg-gradient-to-b from-brass/[0.08] to-transparent shadow-[0_24px_80px_-30px_rgba(217,164,65,0.35)]"
                  : "border-white/8 bg-white/[0.02] hover:border-white/16"
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-7 rounded-full border border-brass/40 bg-[#0d1020] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">
                  Most chosen
                </span>
              )}
              <h3 className="font-display text-xl italic text-white">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-light text-white">{p.price}</span>
                <span className="text-xs text-white/40">{p.period}</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/60">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/register")}
                className={cn(
                  "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-all duration-300",
                  p.popular
                    ? "bg-brass text-[#241503] hover:shadow-[0_8px_36px_rgba(217,164,65,0.4)]"
                    : "border border-white/15 text-white hover:border-white/35 hover:bg-white/5"
                )}
              >
                {p.cta}
              </button>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
      <Reveal className="mt-8 text-center">
        <p className="text-xs text-white/35">No credit card required. Demo workspace available on sign-in.</p>
      </Reveal>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="relative mx-auto max-w-3xl px-5 py-28 sm:px-8">
      <Reveal className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Questions</p>
        <h2 id="faq-heading" className="mt-4 font-display text-4xl leading-[1.08] text-white sm:text-5xl">
          Asked, <em className="text-white/40">and answered.</em>
        </h2>
      </Reveal>
      <Reveal className="mt-12" delay={0.1}>
        <Accordion type="single" collapsible className="divide-y divide-white/8 border-y border-white/8">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-0">
              <AccordionTrigger className="group py-5 text-left font-display text-lg italic text-white hover:no-underline [&[data-state=open]>svg]:rotate-45">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-white/50">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  return (
    <section id="cta" aria-labelledby="cta-heading" className="relative overflow-hidden border-t border-white/8 py-32">
      <div aria-hidden="true" className="aurora opacity-60" />
      <div className="relative mx-auto max-w-4xl px-5 text-center sm:px-8">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Begin</p>
          <h2 id="cta-heading" className="mt-6 font-display text-5xl leading-[1.04] text-white sm:text-7xl">
            Sign it.
            <br />
            Send it.
            <br />
            <em className="bg-gradient-to-r from-indigo-bright via-[#a5a0ff] to-brass bg-clip-text font-medium italic text-transparent gradient-pan">
              Seal it.
            </em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-white/50">
            Your first agreement is three minutes away. The record of it will outlive the meeting it replaces.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Magnetic strength={0.25}>
              <button
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/register")}
                className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_12px_48px_rgba(255,255,255,0.3)]"
              >
                {isAuthenticated ? "Open your workspace" : "Create your first agreement"}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </Magnetic>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-8 py-3.5 text-sm font-semibold text-white/70 transition-all duration-300 hover:border-white/35 hover:text-white"
            >
              Explore the demo
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  const cols = [
    { title: "Product", links: [
      { label: "Features", to: "/#features" },
      { label: "Workflow", to: "/#workflow" },
      { label: "Pricing", to: "/pricing" },
      { label: "Changelog", to: "/changelog" },
    ]},
    { title: "Company", links: [
      { label: "About", to: "/about" },
      { label: "Security", to: "/security" },
      { label: "Contact", to: "/contact" },
    ]},
    { title: "Resources", links: [
      { label: "Help", to: "/help" },
      { label: "Documentation", to: "/docs" },
      { label: "Status", to: "/status" },
    ]},
    { title: "Legal", links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "DPA", to: "/dpa" },
    ]},
  ];
  return (
    <footer className="border-t border-white/8">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-white/40">
              The delegation governance platform. Version-locked agreements, structured interactions, and an audit trail that testifies.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {cols.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{c.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className="text-[13px] text-white/50 transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/8 pt-8 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] text-white/30">© {year} TaskContract. Sealed, not stored loosely.</p>
          <p className="font-mono text-[11px] text-white/30">SOC 2 aligned · 256-bit encryption · EU data residency options</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  usePageMeta(
    "TaskContract — Delegation governance, sealed in the ledger",
    "TaskContract replaces ambiguous delegated work with version-locked agreements, structured interactions and an immutable audit trail. Draft it, send it, seal it."
  );

  return (
    <div id="top" className="ink relative min-h-screen overflow-x-clip">
      <ScrollProgress />
      <CursorGlow />
      <Preloader />

      {/* atmosphere */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="aurora" />
        <div className="grain" />
        <div className="blueprint" />
      </div>

      <Nav />

      <main>
        {/* Hero */}
        <section aria-labelledby="hero-heading" className="relative">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 pb-24 pt-36 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-40">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5"
              >
                <span className="dot-pulse h-1.5 w-1.5 rounded-full bg-brass" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
                  Delegation governance platform
                </span>
              </motion.p>

              <h1 id="hero-heading" className="mt-7 font-display text-[44px] font-medium leading-[1.04] text-white sm:text-6xl lg:text-[64px]">
                <WordReveal text="The contract for how" delay={0.25} className="block" />
                <WordReveal text="work gets" delay={0.55} className="block" />
                <WordReveal
                  text="done."
                  delay={0.85}
                  className="block italic bg-gradient-to-r from-indigo-bright via-[#a5a0ff] to-brass bg-clip-text text-transparent gradient-pan"
                />
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
                className="mt-7 max-w-md text-[15px] leading-relaxed text-white/55"
              >
                TaskContract turns delegated work into version-locked agreements — with structured updates, governed hand-offs, and an audit trail that ends arguments before they start.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="mt-9 flex flex-wrap items-center gap-4"
              >
                <Magnetic strength={0.25}>
                  <Link
                    to="/register"
                    className="group inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_12px_48px_rgba(255,255,255,0.3)]"
                  >
                    Start free
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Magnetic>
                <button
                  onClick={() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white/75 transition-all duration-300 hover:border-white/35 hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brass transition-transform duration-300 group-hover:scale-150" />
                  Watch it work
                </button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6, duration: 0.8 }}
                className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30"
              >
                Free plan · No credit card · 3-minute setup
              </motion.p>
            </div>

            <AgreementCard />
          </div>
        </section>

        <Marquee />
        <Problem />
        <Product />
        <Features />
        <Workflow />
        <Stats />
        <UseCases />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
