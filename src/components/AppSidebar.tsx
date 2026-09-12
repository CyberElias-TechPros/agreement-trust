import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Send,
  AlertCircle,
  Archive,
  BarChart3,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  FileCheck,
  ChevronsUpDown,
  Check,
  Building2,
} from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { LogoMark } from "./Logo";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "All Contracts", icon: FileText, path: "/contracts" },
  { label: "Created by Me", icon: Send, path: "/contracts?filter=created" },
  { label: "Awaiting Review", icon: FileCheck, path: "/contracts?filter=review" },
  { label: "Overdue", icon: AlertCircle, path: "/contracts?filter=overdue" },
  { label: "Archived", icon: Archive, path: "/contracts?filter=archived" },
];

const secondaryNav = [
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, currentOrganization, organizations, setCurrentOrganization } = useAuth();

  const isActive = (path: string) => {
    if (path.includes("?")) return location.pathname + location.search === path;
    return location.pathname === path;
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleOrgSelect = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      setOrgMenuOpen(false);
      navigate("/dashboard");
    }
  };

  const navItems = (items: typeof mainNav, label: string) => (
    <>
      <p
        className={cn(
          "px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/35",
          collapsed && "text-center"
        )}
      >
        {collapsed ? "·" : label}
      </p>
      {items.map((item) => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200",
              active
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg bg-sidebar-primary/10 ring-1 ring-inset ring-sidebar-primary/20"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <item.icon className="relative z-10 h-4 w-4 shrink-0" />
            {!collapsed && <span className="relative z-10">{item.label}</span>}
          </Link>
        );
      })}
    </>
  );

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 256 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2.5 overflow-hidden text-left"
          aria-label="TaskContract home"
        >
          <LogoMark className="h-7 w-7 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-baseline gap-[0.3em] whitespace-nowrap"
              >
                <span className="text-sm font-bold tracking-tight text-white">Task</span>
                <span className="font-display text-sm italic text-white/90">Contract</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Organization switcher */}
      {!collapsed && (
        <div className="shrink-0 px-3 pt-3">
          <button
            onClick={() => setOrgMenuOpen(!orgMenuOpen)}
            aria-expanded={orgMenuOpen}
            aria-haspopup="listbox"
            className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-left transition-colors hover:bg-sidebar-accent/70"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-sidebar-accent-foreground">
                {currentOrganization?.name || "Workspace"}
              </span>
              <span className="block text-[10px] capitalize text-sidebar-foreground/40">{currentOrganization?.role || "member"}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
          </button>

          <AnimatePresence>
            {orgMenuOpen && (
              <motion.ul
                role="listbox"
                aria-label="Switch organization"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="mt-1.5 space-y-0.5 rounded-lg border border-sidebar-border bg-[#141828] p-1 shadow-xl"
              >
                {organizations.map((org) => (
                  <li key={org.id}>
                    <button
                      onClick={() => handleOrgSelect(org.id)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-sidebar-accent-foreground">{org.name}</span>
                        <span className="block text-[10px] capitalize text-sidebar-foreground/40">{org.role}</span>
                      </span>
                      {org.id === currentOrganization?.id && <Check className="h-3.5 w-3.5 text-sidebar-primary" />}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* New contract */}
      <div className="shrink-0 px-3 pb-2 pt-3">
        <Button
          onClick={() => navigate("/contracts/new")}
          className={cn(
            "w-full justify-start gap-2 bg-gradient-to-r from-indigo to-[#7b5fd3] text-white shadow-[0_4px_20px_rgba(111,124,255,0.35)] transition-all duration-300 hover:shadow-[0_6px_28px_rgba(111,124,255,0.5)]",
            collapsed && "justify-center px-0"
          )}
          size={collapsed ? "icon" : "default"}
          title={collapsed ? "New contract" : undefined}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && "New Contract"}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 custom-scrollbar">
        {navItems(mainNav, "Contracts")}
        <div className="pt-4">{navItems(secondaryNav, "Workspace")}</div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>

        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Link to="/profile" className="shrink-0" aria-label="Open profile">
            <UserAvatar
              user={{
                id: user?.id,
                email: user?.email,
                firstName: user?.firstName || "U",
                lastName: user?.lastName || "ser",
                avatarUrl: user?.avatarUrl,
              }}
              size="md"
            />
          </Link>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-accent-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/45">{user?.email}</p>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "justify-center px-0"
          )}
          size={collapsed ? "icon" : "sm"}
          title={collapsed ? "Log out" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Log out</span>}
        </Button>
      </div>
    </motion.aside>
  );
}
