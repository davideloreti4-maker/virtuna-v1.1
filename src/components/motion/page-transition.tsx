"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useSelectedLayoutSegment } from "next/navigation";
import { FrozenRouter } from "./frozen-router";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const segment = useSelectedLayoutSegment();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={segment}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
