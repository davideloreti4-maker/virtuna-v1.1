/** @vitest-environment happy-dom */
/**
 * Regression suite for UAT gap 2 (2026-05-26):
 * "frame content stays at old position during drag — only snaps on release"
 *
 * Root cause: BoardCanvas Stage had only onDragEnd, leaving board-store camera
 * stale while Konva's internal drag ran. DOM overlays (GroupFrameOverlay etc.)
 * read camera from board-store and stayed frozen until onDragEnd wrote the
 * final position. Fix: onDragMove writes live stage.x()/y() to the store.
 *
 * Note: This file uses an in-file vi.mock('react-konva', …) to capture Stage
 * props for handler testing. It does NOT conflict with the shared mock in
 * setup.ts (react-konva is not mocked there). If a future global mock is
 * added to setup.ts, this file's hoisted vi.mock takes precedence for this
 * module scope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';

// Capture Stage props so we can invoke its handlers from outside.
let capturedStageProps: Record<string, unknown> | null = null;

vi.mock('react-konva', () => ({
  Stage: (props: Record<string, unknown>) => {
    capturedStageProps = props;
    // Render children so React-Testing-Library is happy.
    return <div data-testid="stage-mock">{props.children as React.ReactNode}</div>;
  },
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: () => <div />,
}));

// Import AFTER vi.mock so the mock is applied.
// eslint-disable-next-line import/first
import { BoardCanvas } from '../BoardCanvas';
import type { Camera } from '../board-types';

function makeStageEventTarget(x: number, y: number) {
  return {
    target: {
      getStage: () => ({
        x: () => x,
        y: () => y,
        getPointerPosition: () => ({ x: 0, y: 0 }),
      }),
    },
    evt: { preventDefault: () => {} },
  };
}

function defaultProps(overrides: Partial<ComponentProps<typeof BoardCanvas>> = {}) {
  return {
    camera: { x: 10, y: 20, scale: 1 } as Camera,
    setCamera: vi.fn(),
    onUserInteract: vi.fn(),
    width: 800,
    height: 600,
    ...overrides,
  };
}

beforeEach(() => {
  capturedStageProps = null;
});

describe('BoardCanvas drag-sync (UAT gap 2 regression — 2026-05-26)', () => {
  it('passes draggable + onDragMove + onDragEnd + onDragStart to Stage', () => {
    render(<BoardCanvas {...defaultProps()} />);
    expect(capturedStageProps).not.toBeNull();
    expect(capturedStageProps!.draggable).toBe(true);
    expect(typeof capturedStageProps!.onDragMove).toBe('function');
    expect(typeof capturedStageProps!.onDragEnd).toBe('function');
    expect(typeof capturedStageProps!.onDragStart).toBe('function');
  });

  it('onDragMove calls setCamera with live stage coords (UAT gap 2 fix)', () => {
    const props = defaultProps();
    render(<BoardCanvas {...props} />);
    const onDragMove = capturedStageProps!.onDragMove as (e: unknown) => void;
    onDragMove(makeStageEventTarget(123, 456));
    expect(props.setCamera).toHaveBeenCalledTimes(1);
    expect(props.setCamera).toHaveBeenCalledWith({ x: 123, y: 456, scale: 1 });
  });

  it('onDragMove no-op when stage position equals current camera (no spurious renders)', () => {
    const props = defaultProps({ camera: { x: 99, y: 99, scale: 1 } });
    render(<BoardCanvas {...props} />);
    const onDragMove = capturedStageProps!.onDragMove as (e: unknown) => void;
    onDragMove(makeStageEventTarget(99, 99));
    expect(props.setCamera).not.toHaveBeenCalled();
  });

  it('onDragStart fires onUserInteract (auto-follow cancellation per D-09)', () => {
    const props = defaultProps();
    render(<BoardCanvas {...props} />);
    const onDragStart = capturedStageProps!.onDragStart as () => void;
    onDragStart();
    expect(props.onUserInteract).toHaveBeenCalledTimes(1);
  });

  it('onDragEnd fires onUserInteract AND setCamera with final position', () => {
    const props = defaultProps();
    render(<BoardCanvas {...props} />);
    const onDragEnd = capturedStageProps!.onDragEnd as (e: unknown) => void;
    onDragEnd(makeStageEventTarget(200, 300));
    expect(props.onUserInteract).toHaveBeenCalled();
    expect(props.setCamera).toHaveBeenCalledWith({ x: 200, y: 300, scale: 1 });
  });
});
