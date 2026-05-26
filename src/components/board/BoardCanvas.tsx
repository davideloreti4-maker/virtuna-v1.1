'use client';
import { Stage, Layer, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Camera } from './board-types';
import { computeZoomAtPointer } from './use-camera';

interface Props {
  camera: Camera;
  setCamera: (c: Camera) => void;
  width: number;
  height: number;
  children?: React.ReactNode; // Layer contents from sibling plans
}

export function BoardCanvas({ camera, setCamera, width, height, children }: Props) {
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    setCamera(computeZoomAtPointer(camera, pointer, e.evt.deltaY));
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
      onDragEnd={(e) => setCamera({ ...camera, x: e.target.x(), y: e.target.y() })}
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
