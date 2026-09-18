import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { CursorGlow } from "@/components/motion/CursorGlow";
import { ScrollProgress } from "@/components/motion/ScrollProgress";

const nav = [
  { to: "/#product", label: "Product" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/security", label: "Security" },
  { to: "/help", label: "Help" },
];

export function PublicChrome({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <div className="ink relative min-h-screen overflow-x-clip">
      <ScrollProgress />
      <CursorGlow />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="aurora" />
        <div className="grain" />
        <div className="blueprint" />
      </div>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#080a12]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="TaskContract home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {nav.map((l) => (
              <Link key={l.to} to={l.to} className="text-[13px] font-medium text-white/55 transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-[13px] font-medium text-white/60 hover:text-white sm:block">
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-[#0b0d1c] transition-all hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)]"
            >
              Enter the ledger
            </Link>
          </div>
        </div>
      </header>
      <main className="relative pt-24">{children}</main>
      {footer && (
        <footer className="relative border-t border-white/8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <Logo />
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/45">
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <Link to="/security" className="hover:text-white">Security</Link>
              <Link to="/contact" className="hover:text-white">Contact</Link>
              <Link to="/status" className="hover:text-white">Status</Link>
            </nav>
            <p className="font-mono text-[11px] text-white/30">© {year} TaskContract</p>
          </div>
        </footer>
      )}
    </div>
  );
}

export function InkArticle({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-brass">{kicker}</p>
      <h1 className="mt-4 font-display text-4xl italic leading-tight text-white sm:text-5xl">{title}</h1>
      <div className="prose-ink mt-10 space-y-5 text-[15px] leading-relaxed text-white/60">{children}</div>
    </article>
  );
}
