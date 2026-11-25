/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../button';
import { Tile } from '../card';
import { Chip } from '../chip';
import { IconButton } from '../icon-button';

describe('Chip', () => {
  it('is a button that reports whether it is selected', () => {
    render(<Chip selected>Posted</Chip>);
    expect(screen.getByRole('button', { name: 'Posted' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('carries no pressed state when it is a plain action', () => {
    render(<Chip>3 more</Chip>);
    expect(screen.getByRole('button', { name: '3 more' })).not.toHaveAttribute('aria-pressed');
  });

  it('runs its action on click, and not when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Chip onClick={onClick}>Shorter</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Chip onClick={onClick} disabled>Shorter</Chip>);
    fireEvent.click(screen.getByRole('button', { name: 'Shorter' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('never submits a surrounding form by accident', () => {
    render(<Chip>Drafts</Chip>);
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('type', 'button');
  });

  it('grows its touch area to 44px without growing the drawn pill', () => {
    render(<Chip surface="card">Shorter</Chip>);
    expect(screen.getByRole('button', { name: 'Shorter' }).className).toContain('tap-44');
  });

  it('when disabled, is disabled and drops to 40% with no shadow (spec state rule)', () => {
    render(<Chip disabled>Posted</Chip>);
    const chip = screen.getByRole('button', { name: 'Posted' });
    expect(chip).toBeDisabled();
    expect(chip.classList).toContain('disabled:opacity-40');
    expect(chip.classList).toContain('disabled:shadow-none');
  });
});

describe('IconButton', () => {
  it('is named by its label, because it shows no text', () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Back" onClick={onClick}>
        <svg aria-hidden />
      </IconButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('grows its touch area to 44px without growing the drawn circle', () => {
    render(<IconButton aria-label="Save"><svg aria-hidden /></IconButton>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('tap-44');
  });

  it('when disabled, is disabled and drops to 40% with no shadow (spec state rule)', () => {
    render(<IconButton aria-label="Share" disabled><svg aria-hidden /></IconButton>);
    const button = screen.getByRole('button', { name: 'Share' });
    expect(button).toBeDisabled();
    expect(button.classList).toContain('disabled:opacity-40');
    expect(button.classList).toContain('disabled:shadow-none');
  });
});

describe('Button: the two additions', () => {
  it('has a quiet variant for links like "See all"', () => {
    render(<Button variant="quiet">See all</Button>);
    const cls = screen.getByRole('button', { name: 'See all' }).className;
    expect(cls).toContain('text-foreground-secondary');
    expect(cls).not.toContain('bg-action');
  });

  it('has a 56px size for the one main action of a screen', () => {
    render(<Button variant="primary" size="xl">Simulate</Button>);
    expect(screen.getByRole('button', { name: 'Simulate' }).className).toContain('h-14');
  });
});

describe('Tile', () => {
  it('renders its children and takes extra classes', () => {
    render(<Tile className="mt-2">inner</Tile>);
    expect(screen.getByText('inner').className).toContain('mt-2');
  });
});
