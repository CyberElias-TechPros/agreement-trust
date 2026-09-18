import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  read: boolean;
  contractId?: string;
  createdAt: string;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Your contracts at a glance" },
  "/contracts": { title: "Contracts", subtitle: "The full ledger of agreements" },
  "/contracts/new": { title: "New Contract", subtitle: "Draft a version-locked agreement" },
  "/reports": { title: "Reports", subtitle: "Analytics from the record" },
  "/settings": { title: "Settings", subtitle: "Organization & workspace" },
  "/profile": { title: "Profile", subtitle: "Your identity in the ledger" },
  "/notifications": { title: "Notifications", subtitle: "Everything that needs your attention" },
  "/onboarding": { title: "Welcome", subtitle: "Seal your first agreement" },
};

const THEME_KEY = "taskcontract.theme";

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(THEME_KEY) === "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

export function AppLayout() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle } = useTheme();

  const meta =
    routeTitles[location.pathname] ||
    (location.pathname.startsWith("/contracts/")
      ? { title: "Contract", subtitle: "Agreement detail" }
      : { title: "Workspace", subtitle: "" });

  useEffect(() => {
    let cancelled = false;
    const loadNotifications = async () => {
      try {
        const data = await api.getNotifications({ limit: 5 });
        if (!cancelled) setNotifications(data.notifications || []);
      } catch {
        /* backend unreachable — banner communicates state */
      }
    };
    loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/contracts?search=${encodeURIComponent(q)}` : "/contracts");
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/60 px-5 backdrop-blur-sm sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">{meta.title}</h1>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{meta.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="relative hidden md:block" role="search">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search contracts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search contracts"
                className="w-56 rounded-full border-0 bg-secondary/70 pl-9 focus-visible:ring-1 focus-visible:ring-primary/30 lg:w-72"
              />
            </form>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              className="rounded-full"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={dark ? "moon" : "sun"}
                  initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                  className="flex"
                >
                  {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </Button>

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
                aria-expanded={showNotifications}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-2 top-2 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                  </span>
                )}
              </Button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-border p-4">
                      <h2 className="text-sm font-semibold">Notifications</h2>
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/notifications");
                        }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">Nothing new in the ledger.</div>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setShowNotifications(false);
                              if (n.contractId) navigate(`/contracts/${n.contractId}`);
                            }}
                            className={cn(
                              "block w-full border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/50",
                              !n.read && "bg-primary/[0.03]"
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-foreground">{n.title}</p>
                                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.content}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main content with page transitions */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
