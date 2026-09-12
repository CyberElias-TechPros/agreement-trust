import { useRef, type ReactNode, type CSSProperties } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
  useMotionTemplate,
} from "framer-motion";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  style?: CSSProperties;
  onClick?: () => void;
  title?: string;
  "aria-label"?: string;
}

/**
 * Magnetic — interactive elements lean toward the pointer,
 * then release with a spring. Desktop pointer devices only;
 * nothing is lost on touch or with reduced motion.
 */
export function Magnetic({ children, className, strength = 0.35, style, onClick, title, ...rest }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.6 });
  const transform = useMotionTemplate`translate3d(${springX}px, ${springY}px, 0)`;

  const handleMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ ...style, transform, display: "inline-block" }}
      className={className}
      onClick={onClick}
      title={title}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
