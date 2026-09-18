import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, SkipForward, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useToast } from "@/hooks/use-toast";

export default function Onboarding() {
  const { currentOrganization, user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  usePageMeta("Welcome — TaskContract", "Seal your first agreement.");

  const orgId = currentOrganization?.id;

  const invite = async () => {
    if (!orgId || !email.includes("@")) {
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      const res = await api.inviteMember(orgId, email, "executor");
      toast({
        title: "Invitation ready",
        description: res.inviteUrl ? `Share ${res.inviteUrl}` : `Invited ${email}`,
      });
      setStep(2);
    } catch (e) {
      toast({ variant: "destructive", title: "Invite failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    if (!orgId) return;
    if (!title.trim() || !description.trim()) {
      navigate("/dashboard");
      return;
    }
    setLoading(true);
    try {
      const { contract } = await api.createContract(orgId, { title, description, priority: "medium" });
      navigate(`/contracts/${contract.id}`);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not draft", description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Welcome, {user?.firstName}</p>
      <h1 className="mt-2 font-display text-4xl italic text-foreground">Open the ledger.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Two optional steps. Skip either — you can always come back.</p>

      <div className="mt-8 flex gap-2" aria-hidden>
        <div className="h-1 flex-1 rounded-full bg-primary" />
        <div className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-primary" : "bg-border"}`} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card mt-8 p-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Invite a teammate
            </div>
            <p className="text-sm text-muted-foreground">They’ll receive a join link. In this environment the link is shown immediately.</p>
            <Input type="email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm">
                <SkipForward className="h-4 w-4" /> Skip
              </button>
              <button onClick={invite} disabled={loading} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {loading ? "Inviting…" : "Send invite"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Check className="h-4 w-4 text-primary" /> Draft your first contract
            </div>
            <Input placeholder="Title — e.g. Q3 board pack" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Scope, deadline, definition of done…" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => navigate("/dashboard")} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm">
                Skip to dashboard
              </button>
              <button onClick={create} disabled={loading} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {loading ? "Drafting…" : "Create draft"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
