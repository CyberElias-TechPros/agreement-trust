import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, Shield, Lock, Globe, Server } from "lucide-react";
import { PublicChrome, InkArticle } from "@/components/PublicChrome";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    features: ["5 active contracts", "2 team members", "Full audit trail", "Email-ready notifications"],
    cta: "Start free",
    popular: false,
  },
  {
    name: "Professional",
    price: "$12",
    period: "per user / month",
    features: ["Unlimited contracts & members", "Audit export (JSON / CSV)", "Custom categories & branding", "API access", "Priority support"],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual agreement",
    features: ["Everything in Professional", "SSO / SAML ready", "Advanced RBAC & departments", "Data residency options", "Dedicated support"],
    cta: "Contact sales",
    popular: false,
  },
];

export function PricingPage() {
  usePageMeta("Pricing — TaskContract", "Start free. Scale when trust scales. Starter, Professional and Enterprise plans.");
  return (
    <PublicChrome>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Pricing</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl italic leading-tight text-white">Start free. Scale when trust scales.</h1>
        <p className="mt-4 max-w-lg text-white/50">No credit card. The ledger is ready the moment you are.</p>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7",
                p.popular ? "border-brass/40 bg-gradient-to-b from-brass/[0.08] to-transparent" : "border-white/8 bg-white/[0.02]"
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-7 rounded-full border border-brass/40 bg-[#0d1020] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">
                  Most chosen
                </span>
              )}
              <h2 className="font-display text-xl italic text-white">{p.name}</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl font-light text-white">{p.price}</span>
                <span className="text-xs text-white/40">{p.period}</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/60">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate(p.name === "Enterprise" ? "/contact" : "/register")}
                className={cn(
                  "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold",
                  p.popular ? "bg-brass text-[#241503]" : "border border-white/15 text-white hover:bg-white/5"
                )}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}

export function AboutPage() {
  usePageMeta("About — TaskContract", "Delegation governance infrastructure. We exist so ‘I thought you meant…’ never happens again.");
  return (
    <PublicChrome>
      <InkArticle kicker="About" title="Built for the moment it matters.">
        <p>TaskContract is a delegation governance platform. Not a board. Not a chat. An agreement with a memory.</p>
        <p>
          Every informal “can you take this?” becomes a version-locked contract: accepted, tracked, submitted, sealed. When
          scope drifts, the record is the referee — not whoever speaks loudest.
        </p>
        <p>
          We built it for managers, freelancers, churches, assistants, NGOs — anyone who assigns work to another human and
          needs both parties to see the same truth.
        </p>
        <p className="text-white/80">The agreement is the memory of the work.</p>
      </InkArticle>
    </PublicChrome>
  );
}

export function PrivacyPage() {
  usePageMeta("Privacy — TaskContract", "How TaskContract handles your data.");
  return (
    <PublicChrome>
      <InkArticle kicker="Legal" title="Privacy policy">
        <p>We collect only what the ledger needs: account identity, organisation membership, contracts, interactions and audit events.</p>
        <p>Passwords are hashed with PBKDF2. Access tokens expire in 15 minutes. Refresh tokens rotate and can be revoked per session.</p>
        <p>Organisations are isolated. We do not sell personal data. You may export or request deletion of your records.</p>
        <p>Questions: use the contact form or email privacy@taskcontract.app.</p>
      </InkArticle>
    </PublicChrome>
  );
}

export function TermsPage() {
  usePageMeta("Terms — TaskContract", "Terms of service for TaskContract.");
  return (
    <PublicChrome>
      <InkArticle kicker="Legal" title="Terms of service">
        <p>By creating an account you agree to use TaskContract lawfully and to keep credentials confidential.</p>
        <p>The product provides an audit trail of delegated work. It is not legal advice and does not create a lawyer–client relationship.</p>
        <p>You retain ownership of the content you put in contracts. You grant us a licence to host it in order to provide the service.</p>
        <p>We may suspend accounts that abuse the platform. The free plan is provided as-is.</p>
      </InkArticle>
    </PublicChrome>
  );
}

export function SecurityPage() {
  usePageMeta("Security — TaskContract", "How TaskContract protects the ledger.");
  const items = [
    { icon: Lock, title: "Hashed credentials", body: "PBKDF2-SHA256 passwords, short-lived JWTs, rotating refresh tokens stored hashed." },
    { icon: Shield, title: "RBAC at the edge", body: "Owner → observer hierarchy enforced on every mutating route. IDOR-safe membership checks." },
    { icon: Server, title: "Cloudflare native", body: "Workers + D1 + KV + R2. Rate limits in KV. Attachments in R2. Cron deadline sweeps." },
    { icon: Globe, title: "Transport", body: "TLS in production, HSTS, nosniff, frame-deny, strict referrer policy." },
  ];
  return (
    <PublicChrome>
      <section className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Security</p>
        <h1 className="mt-4 font-display text-5xl italic text-white">The ledger is a vault, not a whiteboard.</h1>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <it.icon className="h-5 w-5 text-brass" />
              <h2 className="mt-4 font-display text-xl italic text-white">{it.title}</h2>
              <p className="mt-2 text-sm text-white/50">{it.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}

export function ContactPage() {
  usePageMeta("Contact — TaskContract", "Talk to the TaskContract team.");
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.contact(form);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setLoading(false);
    }
  };
  return (
    <PublicChrome>
      <section className="mx-auto max-w-lg px-5 py-20 sm:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">Contact</p>
        <h1 className="mt-4 font-display text-4xl italic text-white">Write to the registrar.</h1>
        {sent ? (
          <p className="mt-8 rounded-2xl border border-brass/30 bg-brass/10 p-6 text-sm text-brass">Received. We’ll be in touch.</p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
            <Input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl border-white/12 bg-white/[0.04] text-white" />
            <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl border-white/12 bg-white/[0.04] text-white" />
            <Textarea required minLength={8} placeholder="How can we help?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="min-h-[140px] rounded-xl border-white/12 bg-white/[0.04] text-white" />
            <button disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#0b0d1c]">
              {loading ? "Sending…" : "Send"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </section>
    </PublicChrome>
  );
}

export function HelpPage() {
  usePageMeta("Help — TaskContract", "How the ledger works, keyboard shortcuts, and the contract lifecycle.");
  return (
    <PublicChrome>
      <InkArticle kicker="Help" title="How the ledger works.">
        <p><strong className="text-white">Draft → Sent → Accepted → In progress → Submitted → Approved.</strong> Decline from Sent. Request changes from Submitted (returns to in progress). Archive anytime you’re a manager.</p>
        <p>Edits after send create a numbered version with a required reason. Nothing is overwritten.</p>
        <p>Keyboard: <span className="font-mono text-brass">⌘K</span> command palette · <span className="font-mono text-brass">G then D</span> dashboard · <span className="font-mono text-brass">G then C</span> contracts · <span className="font-mono text-brass">G then N</span> new contract.</p>
        <p>
          Demo workspace: <span className="font-mono text-white/80">alex.morgan@northwind.studio / demo1234</span>
        </p>
        <p>
          <Link to="/contact" className="text-brass hover:underline">Still stuck? Write to us.</Link>
        </p>
      </InkArticle>
    </PublicChrome>
  );
}

export function StatusPage() {
  usePageMeta("Status — TaskContract", "System status for the TaskContract ledger.");
  return (
    <PublicChrome>
      <InkArticle kicker="Status" title="All systems recording.">
        <p>API, D1, KV and R2 are operating normally in this environment.</p>
        <p className="font-mono text-xs text-white/40">Last check: {new Date().toISOString()}</p>
      </InkArticle>
    </PublicChrome>
  );
}

export function DocsPage() {
  usePageMeta("Documentation — TaskContract", "API and product documentation.");
  return (
    <PublicChrome>
      <InkArticle kicker="Docs" title="The contract, documented.">
        <p>REST base path: <span className="font-mono text-brass">/api/v1</span></p>
        <p>Auth: register, login, refresh, logout, me, change-password, forgot/reset, sessions, 2FA, invites.</p>
        <p>Resources: organizations, members, contracts (state machine), interactions, notifications, categories, search, billing, attachments, analytics, audit export.</p>
        <p>Health: <span className="font-mono">GET /health</span></p>
      </InkArticle>
    </PublicChrome>
  );
}

export function DpaPage() {
  usePageMeta("DPA — TaskContract", "Data processing addendum.");
  return (
    <PublicChrome>
      <InkArticle kicker="Legal" title="Data processing addendum">
        <p>TaskContract processes customer data solely to provide the ledger: hosting, backup, security and support.</p>
        <p>Subprocessors: Cloudflare (Workers, D1, KV, R2). Data is not used for advertising.</p>
      </InkArticle>
    </PublicChrome>
  );
}

export function ChangelogPage() {
  usePageMeta("Changelog — TaskContract", "What shipped.");
  return (
    <PublicChrome>
      <InkArticle kicker="Product" title="Changelog">
        <p><span className="font-mono text-brass">1.0.0</span> — Cloudflare Worker backend (D1/KV/R2), full contract lifecycle, invites, sessions, 2FA, billing happy path, cinematic workspace.</p>
      </InkArticle>
    </PublicChrome>
  );
}
