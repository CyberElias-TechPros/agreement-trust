import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AuthShell } from "./AuthShell";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoActive, setDemoActive] = useState(api.demoActive);
  const [challenge, setChallenge] = useState("");
  const [otp, setOtp] = useState("");
  const navigate = useNavigate();
  const { login, refreshUser } = useAuth();

  usePageMeta(
    "Sign in — TaskContract",
    "Sign in to your TaskContract workspace and continue governing your delegated work."
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (challenge) {
        await api.verify2fa(challenge, otp);
        await refreshUser();
        navigate("/dashboard");
        return;
      }
      const res = await api.login(email, password);
      if (res.requires2fa && res.challengeToken) {
        setChallenge(res.challengeToken);
        return;
      }
      await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
      setDemoActive(api.demoActive);
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    setError("");
    try {
      await api.enterDemo();
      await login("alex.morgan@northwind.studio", "demo1234");
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enter the demo workspace");
    } finally {
      setDemoLoading(false);
    }
  };

  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.04] text-white placeholder:text-white/25 transition-all duration-300 focus-visible:border-indigo-bright/60 focus-visible:ring-2 focus-visible:ring-indigo-bright/25 hover:border-white/25";
  const labelClass = "mb-2 block text-[13px] font-medium text-white/70";

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-[13px] text-white/45">
          New to TaskContract?{" "}
          <Link to="/register" className="font-semibold text-brass transition-colors hover:text-white">
            Create an account
          </Link>
        </p>
      }
    >
      <h1 className="font-display text-3xl italic text-white" style={{ fontVariationSettings: "'opsz' 48" }}>
        Welcome back
      </h1>
      <p className="mt-2 text-sm text-white/45">Sign in to your ledger and pick up where the record left off.</p>

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        <div>
          <label htmlFor="email" className={labelClass}>
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
        {challenge && (
          <div>
            <label htmlFor="otp" className={labelClass}>Authenticator code</label>
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} className={inputClass} />
          </div>
        )}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <Link to="/forgot-password" className="mb-2 text-xs text-white/40 transition-colors hover:text-brass">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#0b0d1c] transition-all duration-300 hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
          {!loading && <LogIn className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <button
        onClick={handleDemo}
        disabled={demoLoading}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brass/35 bg-brass/10 text-sm font-semibold text-brass transition-all duration-300 hover:bg-brass hover:text-[#241503] disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        {demoLoading ? "Opening the demo…" : "Explore the demo workspace"}
      </button>

      {demoActive && (
        <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center font-mono text-[10px] leading-relaxed text-white/35">
          Backend not connected — the demo workspace runs fully in your browser.
          <br />
          Demo login: alex.morgan@northwind.studio · demo1234
        </p>
      )}
    </AuthShell>
  );
}
