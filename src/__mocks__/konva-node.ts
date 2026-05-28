/**
 * Vitest alias stub for konva/lib/Node.
 * Provides the KonvaEventObject type used in BoardCanvas + GroupFrame.
 */
export type KonvaEventObject<E> = { evt: E; target: { getStage: () => unknown } };
