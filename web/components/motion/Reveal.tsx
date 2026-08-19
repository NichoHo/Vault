"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const variants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/** Fades and rises a block into view. `mode="mount"` plays immediately (for
 * above-the-fold content like a hero); `mode="in-view"` (default) plays once
 * when the block scrolls into the viewport. */
export default function Reveal({
  children,
  className,
  delay = 0,
  mode = "in-view",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  mode?: "mount" | "in-view";
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate={mode === "mount" ? "visible" : undefined}
      whileInView={mode === "in-view" ? "visible" : undefined}
      viewport={mode === "in-view" ? { once: true, margin: "-80px" } : undefined}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
