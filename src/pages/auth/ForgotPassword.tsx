import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AuthShell } from "./AuthShell";
import api from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  usePageMeta(
    "Reset your password — TaskContract",
    "Request a password reset for your TaskContract account."
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      if (res.resetUrl) setResetUrl(res.resetUrl);
    } catch {
      /* still confirm — no enumeration */
    }
    setLoading(false);
    setSent(true);
  };

  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.04] text-white placeholder:text-white/25 transition-all duration-300 focus-visible:border-indigo-bright/60 focus-visible:ring-2 focus-visible:ring-indigo-bright/25 hover:border-white/25";

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-[13px] text-white/45">
          Remembered it after all?{" "}
          <Link to="/login" className="font-semibold text-brass transition-colors hover:text-white">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brass/35 bg-brass/10">
            <MailCheck className="h-6 w-6 text-brass" />
          </div>
          <h1 className="mt-6 font-display text-3xl italic text-white" style={{ fontVariationSettings: "'opsz' 48" }}>
            Check your inbox
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            If an account exists for <span className="font-mono text-brass">{email || "that address"}</span>, a reset link is on its way. The link expires in 30 minutes.
          </p>
          {resetUrl && (
            <p className="mt-4 rounded-xl border border-brass/30 bg-brass/10 p-3 text-left text-xs text-brass">
              No mail provider in this environment — use{" "}
              <Link to={resetUrl.startsWith("http") ? resetUrl.replace(/^https?:\/\/[^/]+/, "") : resetUrl} className="underline">
                this reset link
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <>
          <h1 className="font-display text-3xl italic text-white" style={{ fontVariationSettings: "'opsz' 48" }}>
            Recover the key
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/45">
            Enter your email and we'll send a reset link. The ledger itself won't forget you.
          </p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-[13px] font-medium text-white/70">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
