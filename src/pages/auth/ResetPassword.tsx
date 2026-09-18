import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AuthShell } from "./AuthShell";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  usePageMeta("Choose a new password — TaskContract", "Reset your TaskContract password.");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.resetPassword(token, password);
      await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.04] text-white placeholder:text-white/25 focus-visible:border-indigo-bright/60";

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-[13px] text-white/45">
          <Link to="/login" className="font-semibold text-brass hover:text-white">
            Back to sign in
          </Link>
        </p>
      }
    >
      <h1 className="font-display text-3xl italic text-white">Set a new key</h1>
      <p className="mt-2 text-sm text-white/45">Choose a password of at least 8 characters.</p>
      {error && <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">{error}</div>}
      <form onSubmit={submit} className="mt-7 space-y-5">
        <Input type="password" required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <Input type="password" required minLength={8} placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        <button disabled={loading || !token} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-[#0b0d1c] disabled:opacity-50">
          {loading ? "Sealing…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
