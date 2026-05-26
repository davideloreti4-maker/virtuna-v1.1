/**
 * Vitest alias stub for react-konva.
 * react-konva is not installed in the worktree (no node_modules).
 * All test files that need react-konva override this with vi.mock('react-konva', ...).
 * This stub prevents vite's import-analysis transform from erroring when it
 * encounters `import { Stage, Layer, Rect } from 'react-konva'` in source files.
 */
export const Stage = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const Layer = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const Rect = () => null;
export const Group = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
export const Text = () => null;
export const Line = () => null;
