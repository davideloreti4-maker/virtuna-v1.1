'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

/**
 * FrameTabs — underline-style tabs for progressive disclosure inside a frame.
 * Built directly on Radix (the shared ui/tabs is pill-styled). Active tab gets
 * a coral underline; idle tabs are muted. Pair with FrameTabPanel.
 */
export interface FrameTab {
  value: string;
  label: string;
  count?: number;
}

export interface FrameTabsProps {
  tabs: FrameTab[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function FrameTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: FrameTabsProps) {
  const resolved = defaultValue ?? tabs[0]?.value;
  return (
    <TabsPrimitive.Root
      value={value}
      defaultValue={value === undefined ? resolved : undefined}
      onValueChange={onValueChange}
      className={cn('w-full', className)}
      data-testid="frame-tabs"
    >
      <TabsPrimitive.List className="flex items-center gap-4 border-b border-white/[0.06]">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              'relative -mb-px whitespace-nowrap border-b-[1.5px] border-transparent pb-2 text-[12px] font-medium transition-colors',
              'text-white/45 hover:text-white/75',
              'data-[state=active]:border-accent data-[state=active]:text-white',
              'focus-visible:text-white focus-visible:outline-none',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1 text-white/35">({t.count})</span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export function FrameTabPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={cn('mt-4 focus-visible:outline-none', className)}
    >
      {children}
    </TabsPrimitive.Content>
  );
}
