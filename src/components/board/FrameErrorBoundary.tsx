'use client';
/**
 * FrameErrorBoundary — reusable render-error boundary for board frames.
 *
 * Wraps Decode and Adapt frame mounts so a render-time throw inside either
 * frame is contained (does NOT blank the whole board). T-05-09 mitigation.
 *
 * React error boundaries must be class components (getDerivedStateFromError).
 *
 * Fallback tone: honest + muted — no alarmism, no coral, no glow (CLAUDE.md
 * §Raycast Design Language Rules). Raw error logged to console only (T-05-10).
 */
import React from 'react';

interface FrameErrorBoundaryProps {
  frameLabel: string;
  children: React.ReactNode;
}

interface FrameErrorBoundaryState {
  hasError: boolean;
}

export class FrameErrorBoundary extends React.Component<
  FrameErrorBoundaryProps,
  FrameErrorBoundaryState
> {
  constructor(props: FrameErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: unknown): FrameErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[FrameErrorBoundary]', this.props.frameLabel, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          data-testid="frame-error-boundary"
          className="rounded-xl border border-white/[0.06] p-4"
        >
          <p className="text-sm font-medium text-foreground">
            {this.props.frameLabel} couldn&apos;t render
          </p>
          <p className="mt-1 text-xs font-medium text-foreground-muted">
            The rest of the board is unaffected.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
