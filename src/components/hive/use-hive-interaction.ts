'use client';

// ---------------------------------------------------------------------------
// use-hive-interaction.ts -- React hook for hive canvas interaction state
// ---------------------------------------------------------------------------
//
// Manages quadtree-based hit detection, hover debounce, click-vs-drag
// discrimination, selection state, camera tracking, and overlay positioning.
//
// Key design decisions:
//   - Ref-based interaction state for per-frame data (no React re-renders)
//   - useState ONLY for selectedNode (drives overlay) and isCameraMoved (reset btn)
//   - All coordinate math in CSS pixel space (DPR handled by canvas transform)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Quadtree } from 'd3-quadtree';

import { CLICK_DRAG_THRESHOLD, HOVER_DEBOUNCE_MS } from './hive-constants';
import {
  buildAdjacencyMap,
  buildHiveQuadtree,
  findHoveredNode,
  screenToWorld,
  worldToScreen,
} from './hive-interaction';
import { computeFitTransform } from './hive-layout';
import type {
  Camera,
  CanvasSize,
  FitTransform,
  InteractionState,
  LayoutNode,
  LayoutResult,
} from './hive-types';

// ---------------------------------------------------------------------------
// Options & result interfaces
// ---------------------------------------------------------------------------

export interface UseHiveInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Reactive layout value -- hook rebuilds quadtree/adjacency when this changes. */
  layout: LayoutResult | null;
  cameraRef: React.RefObject<Camera>;
  sizeRef: React.RefObject<CanvasSize>;
  render: () => void;
}

export interface UseHiveInteractionResult {
  /** Current interaction state ref (read by renderer each frame). */
  readonly interactionRef: React.RefObject<InteractionState>;
  /** Selected node data (triggers React re-render for overlay). */
  readonly selectedNode: LayoutNode | null;
  /** Screen position of selected node (for overlay positioning). */
  readonly selectedNodeScreen: { x: number; y: number } | null;
  /** Clear the current selection (dismiss overlay). */
  readonly clearSelection: () => void;
  /** Whether camera has been moved from default position. */
  readonly isCameraMoved: boolean;
  /** Reset camera to default zoom=1, pan=0,0. */
  readonly resetCamera: () => void;
  /** Notify hook that camera changed (recalculates overlay position + isCameraMoved). */
  readonly onCameraChange: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHiveInteraction(
  options: UseHiveInteractionOptions,
): UseHiveInteractionResult {
  const { canvasRef, layout, cameraRef, sizeRef, render } = options;

  // ---- Ref-based interaction state (no React re-renders) ----
  const interactionRef = useRef<InteractionState>({
    hoveredNodeId: null,
    selectedNodeId: null,
    connectedNodeIds: new Set(),
  });

  // ---- Spatial index refs (rebuilt when layout changes) ----
  const quadtreeRef = useRef<Quadtree<LayoutNode> | null>(null);
  const adjacencyMapRef = useRef<Map<string, Set<string>>>(new Map());
  const fitTransformRef = useRef<FitTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  // ---- Mouse tracking refs ----
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const hoverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  // ---- React state (drives overlay + reset button) ----
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [selectedNodeScreen, setSelectedNodeScreen] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isCameraMoved, setIsCameraMoved] = useState(false);

  // ---- Stable refs for callbacks ----
  const renderRef = useRef(render);
  renderRef.current = render;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // ---- Rebuild quadtree + adjacency on layout change ----
  useEffect(() => {
    if (!layout) {
      quadtreeRef.current = null;
      adjacencyMapRef.current = new Map();
      return;
    }

    quadtreeRef.current = buildHiveQuadtree(layout);
    adjacencyMapRef.current = buildAdjacencyMap(layout.links);

    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      fitTransformRef.current = computeFitTransform(layout.bounds, width, height);
    }
  }, [layout, sizeRef]);

  // ---- Recompute fit transform when canvas size changes ----
  // (The resize handler calls render which reads fitTransform, so keep it current)
  const updateFitTransform = useCallback(() => {
    const currentLayout = layoutRef.current;
    if (!currentLayout) return;
    const { width, height } = sizeRef.current;
    if (width > 0 && height > 0) {
      fitTransformRef.current = computeFitTransform(
        currentLayout.bounds,
        width,
        height,
      );
    }
  }, [sizeRef]);

  // ---- Helper: compute connected node IDs for a given node ----
  const getConnectedIds = useCallback((nodeId: string): Set<string> => {
    return adjacencyMapRef.current.get(nodeId) ?? new Set();
  }, []);

  // ---- Helper: update overlay screen position from world coords ----
  const updateSelectedNodeScreen = useCallback(
    (node: LayoutNode) => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;

      const cam = cameraRef.current;
      const screen = worldToScreen(
        node.x,
        node.y,
        cam,
        width,
        height,
        fitTransformRef.current,
      );
      setSelectedNodeScreen({ x: screen.x, y: screen.y });
    },
    [cameraRef, sizeRef],
  );

  // ---- Clear selection ----
  const clearSelection = useCallback(() => {
    interactionRef.current.selectedNodeId = null;
    // If no hover active, clear connected set too
    if (!interactionRef.current.hoveredNodeId) {
      interactionRef.current.connectedNodeIds = new Set();
    } else {
      // Restore connected set to hovered node's connections
      interactionRef.current.connectedNodeIds = getConnectedIds(
        interactionRef.current.hoveredNodeId,
      );
    }
    setSelectedNode(null);
    setSelectedNodeScreen(null);
    renderRef.current();
  }, [getConnectedIds]);

  // ---- Camera change handler (exposed to HiveCanvas) ----
  const onCameraChange = useCallback(() => {
    updateFitTransform();

    // Update isCameraMoved
    const cam = cameraRef.current;
    const moved =
      Math.abs(cam.zoom - 1) > 0.001 ||
      Math.abs(cam.panX) > 0.5 ||
      Math.abs(cam.panY) > 0.5;
    setIsCameraMoved(moved);

    // Recalculate overlay position if a node is selected
    const interaction = interactionRef.current;
    if (interaction.selectedNodeId && layoutRef.current) {
      const node = layoutRef.current.nodes.find(
        (n) => n.id === interaction.selectedNodeId,
      );
      if (node) {
        updateSelectedNodeScreen(node);
      }
    }
  }, [cameraRef, updateFitTransform, updateSelectedNodeScreen]);

  // ---- Reset camera ----
  const resetCamera = useCallback(() => {
    const cam = cameraRef.current;
    cam.zoom = 1;
    cam.panX = 0;
    cam.panY = 0;
    setIsCameraMoved(false);

    // Clear selection (overlay would be mispositioned after reset)
    clearSelection();

    renderRef.current();
  }, [cameraRef, clearSelection]);

  // ---- Attach canvas event handlers ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // -- Mousemove: hover detection with debounce --
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) return;

      const tree = quadtreeRef.current;
      if (!tree) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;

      const cam = cameraRef.current;
      const world = screenToWorld(
        screenX,
        screenY,
        cam,
        width,
        height,
        fitTransformRef.current,
      );

      const found = findHoveredNode(tree, world.x, world.y, cam.zoom);
      const foundId = found?.id ?? null;
      const currentId = interactionRef.current.hoveredNodeId;

      // Same node: no-op
      if (foundId === currentId) return;

      // Clear debounce timer
      if (hoverDebounceRef.current !== null) {
        clearTimeout(hoverDebounceRef.current);
        hoverDebounceRef.current = null;
      }

      // Node -> null: instant clear (snappy feel)
      if (foundId === null) {
        interactionRef.current.hoveredNodeId = null;
        // If selected, keep selected node's connections; otherwise clear
        if (interactionRef.current.selectedNodeId) {
          interactionRef.current.connectedNodeIds = getConnectedIds(
            interactionRef.current.selectedNodeId,
          );
        } else {
          interactionRef.current.connectedNodeIds = new Set();
        }
        canvas.style.cursor = 'grab';
        renderRef.current();
        return;
      }

      // Node -> different node: debounce
      hoverDebounceRef.current = setTimeout(() => {
        hoverDebounceRef.current = null;
        interactionRef.current.hoveredNodeId = foundId;

        // Merge connections: hovered + selected
        const hoverConnected = getConnectedIds(foundId);
        if (interactionRef.current.selectedNodeId) {
          const selectedConnected = getConnectedIds(
            interactionRef.current.selectedNodeId,
          );
          interactionRef.current.connectedNodeIds = new Set([
            ...hoverConnected,
            ...selectedConnected,
          ]);
        } else {
          interactionRef.current.connectedNodeIds = hoverConnected;
        }

        canvas.style.cursor = 'pointer';
        renderRef.current();
      }, HOVER_DEBOUNCE_MS);
    };

    // -- Mousedown: record position for click-vs-drag --
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    };

    // -- Mousemove on window: detect drag threshold --
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return;
      if (isDraggingRef.current) return;

      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= CLICK_DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        // Clear hover debounce during drag
        if (hoverDebounceRef.current !== null) {
          clearTimeout(hoverDebounceRef.current);
          hoverDebounceRef.current = null;
        }
        canvas.style.cursor = 'grabbing';
      }
    };

    // -- Mouseup: click-vs-drag discrimination + node selection --
    const handleMouseUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // Restore cursor based on hover state
        canvas.style.cursor = interactionRef.current.hoveredNodeId
          ? 'pointer'
          : 'grab';
        return;
      }

      // Check click-vs-drag threshold
      const dx = e.clientX - mouseDownPosRef.current.x;
      const dy = e.clientY - mouseDownPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= CLICK_DRAG_THRESHOLD) return;

      // This is a click -- perform hit detection
      const tree = quadtreeRef.current;
      if (!tree) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;

      const cam = cameraRef.current;
      const world = screenToWorld(
        screenX,
        screenY,
        cam,
        width,
        height,
        fitTransformRef.current,
      );

      const found = findHoveredNode(tree, world.x, world.y, cam.zoom);

      if (found) {
        // Toggle: click same node = deselect
        if (found.id === interactionRef.current.selectedNodeId) {
          clearSelection();
          return;
        }

        // Select new node
        interactionRef.current.selectedNodeId = found.id;
        const connected = getConnectedIds(found.id);
        interactionRef.current.connectedNodeIds = connected;

        // Compute screen position for overlay
        const screen = worldToScreen(
          found.x,
          found.y,
          cam,
          width,
          height,
          fitTransformRef.current,
        );
        setSelectedNodeScreen({ x: screen.x, y: screen.y });
        setSelectedNode(found);
      } else {
        // Click on empty space: clear selection
        clearSelection();
      }

      renderRef.current();
    };

    // -- Mouseleave: clear hover --
    const handleMouseLeave = () => {
      if (hoverDebounceRef.current !== null) {
        clearTimeout(hoverDebounceRef.current);
        hoverDebounceRef.current = null;
      }
      interactionRef.current.hoveredNodeId = null;
      if (interactionRef.current.selectedNodeId) {
        interactionRef.current.connectedNodeIds = getConnectedIds(
          interactionRef.current.selectedNodeId,
        );
      } else {
        interactionRef.current.connectedNodeIds = new Set();
      }
      renderRef.current();
    };

    // Attach listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousemove', handleWindowMouseMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousemove', handleWindowMouseMove);

      // Cleanup debounce timer
      if (hoverDebounceRef.current !== null) {
        clearTimeout(hoverDebounceRef.current);
      }
    };
  }, [canvasRef, cameraRef, sizeRef, clearSelection, getConnectedIds]);

  // ---- Return stable result ----
  return {
    interactionRef,
    selectedNode,
    selectedNodeScreen,
    clearSelection,
    isCameraMoved,
    resetCamera,
    onCameraChange,
  };
}
