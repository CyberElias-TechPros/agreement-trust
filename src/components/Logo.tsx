import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  light?: boolean; // light variant for dark backgrounds
}

/**
 * The TaskContract brand mark — a notary seal.
 * A double ring with tick notches (the stamp) around a
 * folded-agreement monogram. Brass gradient on the seal,
 * ink on the sheet.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="seal-brass" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8C37A" />
          <stop offset="0.5" stopColor="#D9A441" />
          <stop offset="1" stopColor="#B47D22" />
        </linearGradient>
        <linearGradient id="seal-sheet" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B96F5" />
          <stop offset="1" stopColor="#5F6BDB" />
        </linearGradient>
      </defs>
      {/* seal ring */}
      <circle cx="20" cy="20" r="18.25" stroke="url(#seal-brass)" strokeWidth="2.5" />
      {/* tick notches */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        const x1 = 20 + Math.cos(a) * 15.6;
        const y1 = 20 + Math.sin(a) * 15.6;
        const x2 = 20 + Math.cos(a) * 17.6;
        const y2 = 20 + Math.sin(a) * 17.6;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#seal-brass)" strokeWidth="1.1" />;
      })}
      <circle cx="20" cy="20" r="13.6" stroke="url(#seal-brass)" strokeOpacity="0.45" strokeWidth="0.8" />
      {/* the agreement sheet */}
      <path d="M13 13.5c0-1.4 1.1-2.5 2.5-2.5h9c1.4 0 2.5 1.1 2.5 2.5v13c0 1.4-1.1 2.5-2.5 2.5h-9c-1.4 0-2.5-1.1-2.5-2.5v-13Z" fill="url(#seal-sheet)" />
      {/* fold */}
      <path d="M22.5 11l4.5 4.5h-3.2c-.72 0-1.3-.58-1.3-1.3V11Z" fill="#fff" fillOpacity="0.35" />
      {/* ledger lines */}
      <rect x="16.2" y="17.5" width="8.6" height="1.3" rx="0.65" fill="#fff" fillOpacity="0.9" />
      <rect x="16.2" y="21" width="6.2" height="1.3" rx="0.65" fill="#fff" fillOpacity="0.65" />
      {/* brass check — sealed */}
      <path d="M15.4 25.2l1.9 1.9 4-4.6" stroke="#F3D9A0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, markClassName, wordmark = true, light = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <LogoMark className={markClassName} />
      {wordmark && (
        <span
          className={cn(
            "flex items-baseline gap-[0.35em] whitespace-nowrap leading-none",
            light ? "text-white" : "text-foreground"
          )}
        >
          <span className="font-sans text-[0.95em] font-bold tracking-tight">Task</span>
          <span className="font-display text-[1.05em] font-medium italic tracking-tight" style={{ fontVariationSettings: "'opsz' 72" }}>
            Contract
          </span>
        </span>
      )}
    </span>
  );
}
