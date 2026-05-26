'use client';
import { Stage, Layer, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Camera } from './board-types';
import { computeZoomAtPointer } from './use-camera';

interface Props {
  camera: Camera;
  setCamera: (c: Camera) => void;
  /** Called on any user-initiated pan or zoom — signals board-store to disable auto-follow (D-09). */
  onUserInteract?: () => void;
  width: number;
  height: number;
  children?: React.ReactNode; // Layer contents from sibling plans
}

export function BoardCanvas({ camera, setCamera, onUserInteract, width, height, children }: Props) {
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    onUserInteract?.();
    setCamera(computeZoomAtPointer(camera, pointer, e.evt.deltaY));
  };

  // UAT gap 2 (2026-05-26): DOM overlays read camera.x/y from board-store
  // and project world→screen as `world * scale + camera.{x,y}`. Konva's
  // built-in drag updates the Stage's internal x/y but does NOT touch
  // board-store until onDragEnd, leaving DOM overlays frozen mid-drag.
  // onDragMove writes the live drag offset into the store every tick so
  // the DOM overlay layer stays in lockstep with the Konva transform.
  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const x = stage.x();
    const y = stage.y();
    // Skip the no-op write if Konva fired a move event with the same coords
    // (defensive — avoids triggering downstream re-renders on idle moves).
    if (x === camera.x && y === camera.y) return;
    setCamera({ ...camera, x, y });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    onUserInteract?.();
    const stage = e.target.getStage();
    if (!stage) return;
    setCamera({ ...camera, x: stage.x(), y: stage.y() });
  };

  return (
    <Stage
      width={width}
      height={height}
      x={camera.x}
      y={camera.y}
      scaleX={camera.scale}
      scaleY={camera.scale}
      onWheel={handleWheel}
      draggable
      onDragStart={() => { onUserInteract?.(); }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      // a11y handled by ARIA on the wrapper div in Board.tsx (Konva Stage renders to <canvas>)
    >
      <Layer perfectDrawEnabled={false} listening={false}>
        {/* Background placeholder — frames land in plan 2.2 via `children` */}
        <Rect x={-10000} y={-10000} width={20000} height={20000} fill="transparent" />
      </Layer>
      <Layer perfectDrawEnabled={false}>{children}</Layer>
    </Stage>
  );
}
