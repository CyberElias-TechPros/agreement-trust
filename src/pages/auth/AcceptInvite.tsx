import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AuthShell } from "./AuthShell";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AcceptInvite() {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<{ email: string; role: string; organization: { name: string } } | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  usePageMeta("Join organisation — TaskContract", "Accept your TaskContract invitation.");

  useEffect(() => {
    let cancelled = false;
    api
      .getInvite(token)
      .then((d) => {
        if (!cancelled) setInfo(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Invite invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.acceptInvite(token, form);
      await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-11 rounded-xl border-white/12 bg-white/[0.04] text-white placeholder:text-white/25";

  return (
    <AuthShell
      footer={
        <p className="mt-8 text-center text-[13px] text-white/45">
          Already a member?{" "}
          <Link to="/login" className="font-semibold text-brass hover:text-white">
            Sign in
          </Link>
        </p>
      }
    >
      <h1 className="font-display text-3xl italic text-white">You are invited</h1>
      {info && (
        <p className="mt-2 text-sm text-white/45">
          Join <span className="text-white">{info.organization.name}</span> as <span className="capitalize text-brass">{info.role}</span> ({info.email}).
        </p>
      )}
      {error && <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">{error}</div>}
      <form onSubmit={submit} className="mt-7 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input required placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
          <Input required placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
        </div>
        <Input required type="password" minLength={8} placeholder="Choose a password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
        <button disabled={loading || !info} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-[#0b0d1c] disabled:opacity-50">
          {loading ? "Joining…" : "Accept & enter"}
        </button>
      </form>
    </AuthShell>
  );
}
