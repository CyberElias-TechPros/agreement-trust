import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/**
 * CursorGlow — a quiet ambient response to the pointer:
 * a soft indigo halo that follows the cursor plus a small
 * trailing dot. Fine pointers only; invisible to keyboards,
 * screen readers, and reduced-motion users.
 */
export function CursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const reduce = useReducedMotion();
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const glowX = useSpring(x, { stiffness: 90, damping: 20, mass: 0.8 });
  const glowY = useSpring(y, { stiffness: 90, damping: 20, mass: 0.8 });
  const dotX = useSpring(x, { stiffness: 700, damping: 40, mass: 0.2 });
  const dotY = useSpring(y, { stiffness: 700, damping: 40, mass: 0.2 });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine || reduce) return;
    setEnabled(true);
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, x, y]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] hidden lg:block">
      <motion.div
        style={{ x: glowX, y: glowY }}
        className="absolute h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.13]"
      >
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_center,rgba(123,135,255,0.9),transparent_60%)] blur-2xl" />
      </motion.div>
      <motion.div
        style={{ x: dotX, y: dotY }}
        className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass shadow-[0_0_12px_rgba(217,164,65,0.8)]"
      />
    </div>
  );
}
