import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

/** ScrollProgress — a hairline of indigo→brass ink tracking the reader's position. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[80] h-[2px] origin-left bg-gradient-to-r from-indigo via-[#8B96F5] to-brass"
      style={{ scaleX: reduce ? scrollYProgress : scaleX }}
    />
  );
}
