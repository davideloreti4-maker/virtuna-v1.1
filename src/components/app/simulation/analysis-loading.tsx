'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Database, Brain, BarChart3, Sparkles } from 'lucide-react';
import { Text } from '@/components/ui/typography';

interface AnalysisLoadingStep {
  icon: LucideIcon;
  label: string;
  delay: number; // ms after mount to show this step
}

const LOADING_STEPS: AnalysisLoadingStep[] = [
  { icon: Brain, label: 'Analyzing content with AI models...', delay: 0 },
  { icon: Database, label: 'Scanning 10M+ video database...', delay: 1800 },
  { icon: BarChart3, label: 'Processing behavioral predictions...', delay: 3200 },
  { icon: Sparkles, label: 'Generating engagement forecast...', delay: 4500 },
];

/**
 * AnalysisLoadingSteps — Shows animated loading steps during analysis.
 * Includes the "Scanning 10M+ database" step (MOD-3).
 *
 * Each step fades in sequentially with a subtle shimmer effect.
 * Renders as an overlay on top of the skeleton loading phases.
 */
export function AnalysisLoadingSteps() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = LOADING_STEPS.map((step, i) =>
      setTimeout(() => setVisibleCount(i + 1), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-2 py-2">
      <AnimatePresence mode="popLayout">
        {LOADING_STEPS.slice(0, visibleCount).map((step, i) => {
          const isActive = i === visibleCount - 1;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
              className="flex items-center gap-2.5"
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-accent animate-pulse' : 'text-foreground-muted'
                }`}
              />
              <Text
                size="sm"
                className={
                  isActive
                    ? 'text-foreground animate-pulse'
                    : 'text-foreground-muted'
                }
              >
                {step.label}
              </Text>
              {!isActive && (
                <span className="ml-auto text-xs text-green-400/70">done</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
