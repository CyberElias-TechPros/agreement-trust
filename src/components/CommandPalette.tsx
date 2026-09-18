import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import type { ApiContract, ApiUser } from "@/types/api";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ contracts: ApiContract[]; users: ApiUser[] }>({ contracts: [], users: [] });
  const navigate = useNavigate();
  const { currentOrganization, isAuthenticated } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !currentOrganization || q.trim().length < 2) {
      setHits({ contracts: [], users: [] });
      return;
    }
    const t = setTimeout(() => {
      api.search(currentOrganization.id, q.trim()).then((r) => setHits({ contracts: r.contracts, users: r.users })).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [q, open, currentOrganization]);

  const actions = useMemo(
    () => [
      { label: "Dashboard", to: "/dashboard", hint: "G D" },
      { label: "All contracts", to: "/contracts", hint: "G C" },
      { label: "New contract", to: "/contracts/new", hint: "G N" },
      { label: "Reports", to: "/reports", hint: "" },
      { label: "Notifications", to: "/notifications", hint: "" },
      { label: "Settings", to: "/settings", hint: "G S" },
      { label: "Profile", to: "/profile", hint: "" },
      { label: "Help", to: "/help", hint: "?" },
    ],
    []
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    let g = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "g") {
        g = true;
        setTimeout(() => { g = false; }, 600);
        return;
      }
      if (!g) return;
      const map: Record<string, string> = { d: "/dashboard", c: "/contracts", n: "/contracts/new", s: "/settings" };
      const to = map[e.key.toLowerCase()];
      if (to) navigate(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthenticated, navigate]);

  if (!open || !isAuthenticated) return null;

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    navigate(to);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Command className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contracts, people, or jump…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {hits.contracts.map((c) => (
            <button key={c.id} onClick={() => go(`/contracts/${c.id}`)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary/60">
              <span className="truncate">{c.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{c.contractNumber}</span>
            </button>
          ))}
          {hits.users.map((u) => (
            <div key={u.id} className="px-4 py-2 text-sm text-muted-foreground">
              {u.firstName} {u.lastName} · {u.email}
            </div>
          ))}
          {actions
            .filter((a) => a.label.toLowerCase().includes(q.toLowerCase()) || !q)
            .map((a) => (
              <button key={a.to} onClick={() => go(a.to)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary/60">
                <span>{a.label}</span>
                {a.hint && <kbd className="font-mono text-[10px] text-muted-foreground">{a.hint}</kbd>}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
