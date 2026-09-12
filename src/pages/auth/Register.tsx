import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AuthShell } from "./AuthShell";
import { cn } from "@/lib/utils";

const passwordRules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
];

export default function Register() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", orgName: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();
  const { register } = useAuth();

  usePageMeta(
    "Create your account — TaskContract",
    "Create a free TaskContract workspace and start sealing version-locked agreements with your team."
  );

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const canContinue = step === 1 ? form.firstName.trim() && form.lastName.trim() && form.email.includes("@") && form.password.length >= 8 : form.orgName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.04] text-white placeholder:text-white/25 transition-all duration-300 focus-visible:border-indigo-bright/60 focus-visible:ring-2 focus-visible:ring-indigo-bright/25 hover:border-white/25";
  const labelClass = "mb-2 block text-[13px] font-medium text-white/70";

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-[13px] text-white/45">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brass transition-colors hover:text-white">
            Sign in
          </Link>
        </p>
      }
    >
      <h1 className="font-display text-3xl italic text-white" style={{ fontVariationSettings: "'opsz' 48" }}>
        Open the ledger
      </h1>
      <p className="mt-2 text-sm text-white/45">
        Step {step} of 2 — {step === 1 ? "you, the person" : "the organization"}.
      </p>

      {/* progress */}
      <div className="mt-6 flex gap-2" aria-hidden="true">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.div animate={{ width: "100%" }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-indigo to-brass" />
        </div>
        <motion.div
          animate={{ width: step >= 2 ? "100%" : "0%" }}
          transition={{ duration: 0.5 }}
          className={cn("h-1 overflow-hidden rounded-full", step >= 2 ? "flex-1" : "w-0")}
        >
          <div className="h-full w-full bg-gradient-to-r from-indigo to-brass" />
        </motion.div>
      </div>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-7">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className={labelClass}>First name</label>
                  <Input id="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required placeholder="Alex" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>Last name</label>
                  <Input id="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required placeholder="Morgan" className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Work email</label>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} required placeholder="you@company.com" className={inputClass} />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>Password</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                    placeholder="Min 8 characters"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {passwordRules.map((r) => {
                    const ok = r.test(form.password);
                    return (
                      <li key={r.label} className={cn("flex items-center gap-2 text-[11px] transition-colors", ok ? "text-brass" : "text-white/35")}>
                        <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-full border", ok ? "border-brass/50 bg-brass/15" : "border-white/15")}>
                          {ok && <Check className="h-2 w-2" />}
                        </span>
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div>
                <label htmlFor="orgName" className={labelClass}>Organization name</label>
                <Input id="orgName" value={form.orgName} onChange={(e) => update("orgName", e.target.value)} required placeholder="Acme Corporation" className={inputClass} />
                <p className="mt-2 text-xs text-white/35">You can invite teammates right after — no need to wait.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-7 flex gap-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white/70 transition-all duration-300 hover:border-white/35 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!canContinue || loading}
            className="group inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] disabled:opacity-50"
          >
            {loading ? "Sealing your account…" : step === 1 ? "Continue" : "Create account"}
            {!loading && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
