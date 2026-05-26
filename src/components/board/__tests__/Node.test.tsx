/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeOverlay } from '../NodeOverlay';
import type { NodeSpec } from '../board-types';

const spec: NodeSpec = {
  id: 'test-1',
  groupId: 'input',
  bounds: { x: 100, y: 200, width: 240, height: 100 },
  ariaLabel: 'Edit analysis input',
};

describe('NodeOverlay', () => {
  it('projects bounds to screen using camera transform', () => {
    const { container } = render(
      <NodeOverlay
        spec={spec}
        camera={{ x: 50, y: 30, scale: 2 }}
        status="idle"
        selected={false}
      >
        <div>body</div>
      </NodeOverlay>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.left).toBe('250px'); // 100*2 + 50
    expect(root.style.top).toBe('430px');  // 200*2 + 30
    expect(root.style.width).toBe('480px');
    expect(root.style.height).toBe('200px');
  });

  it('has button role + aria-label + tabIndex=0', () => {
    render(
      <NodeOverlay spec={spec} camera={{ x: 0, y: 0, scale: 1 }} status="idle" selected={false}>
        x
      </NodeOverlay>,
    );
    const btn = screen.getByRole('button', { name: 'Edit analysis input' });
    expect(btn).toHaveAttribute('tabIndex', '0');
  });

  it('invokes onTap on Enter', () => {
    const onTap = vi.fn();
    render(
      <NodeOverlay spec={spec} camera={{ x: 0, y: 0, scale: 1 }} status="idle" selected={false} onTap={onTap}>
        x
      </NodeOverlay>,
    );
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('invokes onTap on Space', () => {
    const onTap = vi.fn();
    render(
      <NodeOverlay spec={spec} camera={{ x: 0, y: 0, scale: 1 }} status="idle" selected={false} onTap={onTap}>
        x
      </NodeOverlay>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onTap).toHaveBeenCalledOnce();
  });
});
