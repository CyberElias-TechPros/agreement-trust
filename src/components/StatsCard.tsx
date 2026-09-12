import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  delay?: number;
  hint?: string;
}

const variantClasses = {
  default: "bg-card",
  primary: "bg-primary/[0.04] border-primary/20",
  success: "bg-success/[0.05] border-success/20",
  warning: "bg-warning/[0.05] border-warning/20",
  danger: "bg-destructive/[0.04] border-destructive/20",
};

const iconVariantClasses = {
  default: "bg-secondary text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

export function StatsCard({ title, value, icon: Icon, trend, variant = "default", delay = 0, hint }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "stat-card relative overflow-hidden border transition-shadow duration-300 hover:shadow-[var(--shadow-lg)]",
        variantClasses[variant]
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconVariantClasses[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="font-display text-[32px] font-medium leading-none tracking-tight text-foreground" style={{ fontVariationSettings: "'opsz' 60" }}>
          {value}
        </p>
        {trend && (
          <span className={cn("mb-0.5 text-xs font-medium", trend.value >= 0 ? "text-success" : "text-destructive")}>
            {trend.value >= 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r opacity-60",
          variant === "primary" && "from-primary to-transparent",
          variant === "success" && "from-success to-transparent",
          variant === "warning" && "from-warning to-transparent",
          variant === "danger" && "from-destructive to-transparent"
        )}
      />
    </motion.div>
  );
}
