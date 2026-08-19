"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";

/** Sticky header that hides on scroll-down and reappears on scroll-up. Stays
 * visible near the top of the page so it doesn't flicker before there's
 * anything to scroll past. Skips the hide behavior entirely under
 * prefers-reduced-motion -- an appearing/disappearing header is more
 * disorienting than useful for that preference, not just un-animated. */
export default function StickyHeader({ children }: { children: React.ReactNode }) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const reduceMotion = useReducedMotion();

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (reduceMotion) return;
    const delta = latest - lastY.current;
    if (latest < 64) {
      setHidden(false);
    } else if (delta > 4) {
      setHidden(true);
    } else if (delta < -4) {
      setHidden(false);
    }
    lastY.current = latest;
  });

  return (
    <motion.div
      className="sticky top-0 z-30"
      animate={{ y: reduceMotion || !hidden ? "0%" : "-100%" }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
