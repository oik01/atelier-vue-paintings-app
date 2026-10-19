import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AmbientLightingMode,
  FRAME_PROFILES,
  FrameProfileId,
  MatColorId,
  MatWidthId,
  OrientationMode,
  PaintingSpec,
  PanelLayoutMode,
  PerspectiveQuad,
  PRINT_SIZES,
  PrintSizeId,
  RoomAsset,
  WallPlacementState,
} from '../../contracts/masterContract';
import {
  computePhysicalFrameDimensions,
  computeShadowVectors,
  renderFramedArtworkToCanvas,
  sanitizeWallPlacement,
} from './framingAndMattingRenderer';

export interface InRoomWallCanvasProps {
  room: RoomAsset;
  painting: PaintingSpec;
  sizeId: PrintSizeId;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
  ambientMode: AmbientLightingMode;
  placement: WallPlacementState;
  showGuides: boolean;
  beforeAfterSplit: number | null;
  onUpdatePlacement: (next: Partial<WallPlacementState>) => void;
  onToggleGuides: () => void;
  onChangeAmbientMode: (mode: AmbientLightingMode) => void;
  onChangeBeforeAfter: (split: number | null) => void;
  onCyclePainting: (delta: number) => void;
  onCycleSize: (delta: number) => void;
  onCycleFrame: () => void;
  onPinLookbook: () => void;
}

type CornerKey = keyof PerspectiveQuad;

type ActiveDragState =
  | {
      kind: 'artwork';
      startClientX: number;
      startClientY: number;
      initialCenterX: number;
      initialCenterY: number;
    }
  | {
      kind: 'corner';
      corner: CornerKey;
      startClientX: number;
      startClientY: number;
      initialQuad: PerspectiveQuad;
    }
  | {
      kind: 'split';
    };

function formatDimensionInches(val: number): string {
  const rounded = Math.round(val * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}"` : `${rounded.toFixed(1)}"`;
}

function formatDimensionCm(inches: number): number {
  return Math.round(inches * 2.54);
}

/**
 * Computes a smooth, bounded 3D CSS perspective transform string from a normalized 4-corner quad.
 * Guarantees finite, artifact-free planar tilt and foreshortening.
 */
function computePerspectiveTransformFromQuad(
  quad: PerspectiveQuad,
  usePerspectiveWarp: boolean
): string {
  if (!usePerspectiveWarp) {
    return 'translate(-50%, -50%)';
  }

  const leftHeight = Math.max(0.08, quad.bottomLeft.y - quad.topLeft.y);
  const rightHeight = Math.max(0.08, quad.bottomRight.y - quad.topRight.y);
  const topWidth = Math.max(0.08, quad.topRight.x - quad.topLeft.x);
  const bottomWidth = Math.max(0.08, quad.bottomRight.x - quad.bottomLeft.x);

  // Horizontal perspective foreshortening -> rotateY (-28deg .. +28deg)
  const heightDiffRatio = (leftHeight - rightHeight) / Math.max(leftHeight, rightHeight, 0.1);
  const rotateYDeg = Math.max(-28, Math.min(28, heightDiffRatio * 42));

  // Vertical perspective foreshortening -> rotateX (-22deg .. +22deg)
  const widthDiffRatio = (bottomWidth - topWidth) / Math.max(topWidth, bottomWidth, 0.1);
  const rotateXDeg = Math.max(-22, Math.min(22, widthDiffRatio * 34));

  // Vertical shear (wall slope) -> skewY (-14deg .. +14deg)
  const topSlope = (quad.topRight.y - quad.topLeft.y) / Math.max(0.1, topWidth);
  const bottomSlope = (quad.bottomRight.y - quad.bottomLeft.y) / Math.max(0.1, bottomWidth);
  const avgSlopeY = (topSlope + bottomSlope) * 0.5;
  const skewYDeg = Math.max(-14, Math.min(14, Math.atan(avgSlopeY) * (180 / Math.PI) * 0.65));

  // Horizontal shear -> skewX (-12deg .. +12deg)
  const leftSlope = (quad.bottomLeft.x - quad.topLeft.x) / Math.max(0.1, leftHeight);
  const rightSlope = (quad.bottomRight.x - quad.topRight.x) / Math.max(0.1, rightHeight);
  const avgSlopeX = (leftSlope + rightSlope) * 0.5;
  const skewXDeg = Math.max(-12, Math.min(12, Math.atan(avgSlopeX) * (180 / Math.PI) * 0.5));

  return `translate(-50%, -50%) perspective(1100px) rotateY(${rotateYDeg.toFixed(2)}deg) rotateX(${rotateXDeg.toFixed(2)}deg) skewY(${skewYDeg.toFixed(2)}deg) skewX(${skewXDeg.toFixed(2)}deg)`;
}

export const InRoomWallCanvas: React.FC<InRoomWallCanvasProps> = ({
  room,
  painting,
  sizeId,
  orientation,
  panelLayout,
  frameId,
  matWidthId,
  matColorId,
  ambientMode,
  placement,
  showGuides,
  beforeAfterSplit,
  onUpdatePlacement,
  onToggleGuides,
  onChangeAmbientMode,
  onChangeBeforeAfter,
  onCyclePainting,
  onCycleSize,
  onCycleFrame,
  onPinLookbook,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const artworkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastWheelTimestampRef = useRef<number>(0);

  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const dragStateRef = useRef<ActiveDragState | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const stageSwipeRef = useRef<{
    startX: number;
    startY: number;
    pointerId: number | null;
    swiped: boolean;
  } | null>(null);

  const [snappedEyeLevel, setSnappedEyeLevel] = useState<boolean>(false);
  const [snappedWallCenter, setSnappedWallCenter] = useState<boolean>(false);
  const [isCalibratorOpen, setIsCalibratorOpen] = useState<boolean>(false);

  const updateDragState = useCallback((next: ActiveDragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  }, []);

  const safePlacement = useMemo(() => sanitizeWallPlacement(placement), [placement]);

  const sizeSpec = PRINT_SIZES[sizeId] ?? PRINT_SIZES['24x36'];
  const frameSpec = FRAME_PROFILES[frameId] ?? FRAME_PROFILES['natural-white-oak'];

  const geom = useMemo(
    () =>
      computePhysicalFrameDimensions({
        sizeSpec,
        orientation,
        panelLayout,
        frameSpec,
        matWidthId,
        wallWidthInches: safePlacement.wallWidthInches,
        interPanelGapInches: safePlacement.interPanelGapInches,
      }),
    [
      sizeSpec,
      orientation,
      panelLayout,
      frameSpec,
      matWidthId,
      safePlacement.wallWidthInches,
      safePlacement.interPanelGapInches,
    ]
  );

  const shadows = useMemo(
    () =>
      computeShadowVectors({
        lightVector: room.analysis.lightVector,
        ambientMode,
        frameDepthInches: frameSpec.depthInches,
      }),
    [room.analysis.lightVector, ambientMode, frameSpec.depthInches]
  );

  // Render the framed painting onto the active wall canvas whenever props change
  useEffect(() => {
    const canvas = artworkCanvasRef.current;
    if (!canvas) return;
    renderFramedArtworkToCanvas(canvas, {
      painting,
      sizeSpec,
      orientation,
      panelLayout,
      frameSpec,
      matWidthId,
      matColorId,
      lightVector: room.analysis.lightVector,
      ambientMode,
      estimatedKelvin: room.analysis.estimatedKelvin,
    });
  }, [
    painting,
    sizeSpec,
    orientation,
    panelLayout,
    frameSpec,
    matWidthId,
    matColorId,
    room.analysis.lightVector,
    room.analysis.estimatedKelvin,
    ambientMode,
  ]);

  // Ambient lighting filter & overlay styles for the room photograph
  const roomFilterStyle = useMemo((): React.CSSProperties => {
    switch (ambientMode) {
      case 'golden-hour':
        return {
          filter: 'brightness(0.97) contrast(1.05) sepia(0.14) saturate(1.12)',
          transition: 'filter 240ms ease',
        };
      case 'evening-sconce':
        return {
          filter: 'brightness(0.75) contrast(1.12) saturate(0.92)',
          transition: 'filter 240ms ease',
        };
      case 'daylight':
      default:
        return {
          filter: 'brightness(1.02) contrast(1.02) saturate(1.0)',
          transition: 'filter 240ms ease',
        };
    }
  }, [ambientMode]);

  const ambientOverlayStyle = useMemo((): React.CSSProperties => {
    const cxPct = (safePlacement.centerX * 100).toFixed(1);
    const cyPct = (safePlacement.centerY * 100).toFixed(1);
    if (ambientMode === 'golden-hour') {
      return {
        background: `linear-gradient(125deg, rgba(255, 188, 112, 0.22) 0%, rgba(218, 126, 68, 0.10) 52%, rgba(28, 20, 14, 0.24) 100%)`,
      };
    }
    if (ambientMode === 'evening-sconce') {
      return {
        background: `radial-gradient(ellipse 46% 52% at ${cxPct}% ${cyPct}%, rgba(255, 224, 172, 0.26) 0%, rgba(24, 20, 18, 0.38) 58%, rgba(10, 9, 12, 0.68) 100%)`,
      };
    }
    return {
      background: `linear-gradient(180deg, rgba(255, 253, 248, 0.06) 0%, rgba(24, 22, 19, 0.04) 100%)`,
    };
  }, [ambientMode, safePlacement.centerX, safePlacement.centerY]);

  // Pointer / Mouse Drag Handlers for Artwork Repositioning, Corner Perspective Quad, and Split Slider
  const getStageRect = useCallback(() => {
    const el = stageRef.current;
    if (!el) {
      return { left: 0, top: 0, width: 1000, height: 650 };
    }
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width > 0 ? rect.width : 1000,
      height: rect.height > 0 ? rect.height : 650,
    };
  }, []);

  const evaluatePinchDistance = useCallback(
    (dist: number) => {
      if (!Number.isFinite(dist) || dist <= 0) return;
      if (pinchStartDistRef.current === null) {
        pinchStartDistRef.current = dist;
        return;
      }
      const delta = dist - pinchStartDistRef.current;
      if (delta >= 28) {
        onCycleSize(1);
        pinchStartDistRef.current = dist;
      } else if (delta <= -28) {
        onCycleSize(-1);
        pinchStartDistRef.current = dist;
      }
    },
    [onCycleSize]
  );

  const evaluateStageSwipe = useCallback(
    (clientX: number, clientY: number) => {
      const swipe = stageSwipeRef.current;
      if (!swipe || swipe.swiped || dragStateRef.current !== null) return;
      const dx = clientX - swipe.startX;
      const dy = clientY - swipe.startY;
      if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swipe.swiped = true;
        onCyclePainting(dx < 0 ? 1 : -1);
      }
    },
    [onCyclePainting]
  );

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;
      if (activePointersRef.current.size >= 2) return;

      const rect = getStageRect();

      if (currentDrag.kind === 'artwork') {
        const dx = (clientX - currentDrag.startClientX) / rect.width;
        const dy = (clientY - currentDrag.startClientY) / rect.height;

        let nextX = Math.max(0.12, Math.min(0.88, currentDrag.initialCenterX + dx));
        let nextY = Math.max(0.12, Math.min(0.88, currentDrag.initialCenterY + dy));

        // Magnetic snap to 57" Museum Eye-Level line
        const eyeSnapThreshold = 0.018;
        if (Math.abs(nextY - room.eyeLevelRatioY) <= eyeSnapThreshold) {
          nextY = room.eyeLevelRatioY;
          setSnappedEyeLevel(true);
        } else {
          setSnappedEyeLevel(false);
        }

        // Magnetic snap to detected open-wall horizontal center
        const wallCenterX = room.analysis.detectedWallZone.centerX;
        if (Math.abs(nextX - wallCenterX) <= eyeSnapThreshold) {
          nextX = wallCenterX;
          setSnappedWallCenter(true);
        } else {
          setSnappedWallCenter(false);
        }

        onUpdatePlacement({
          centerX: Number(nextX.toFixed(4)),
          centerY: Number(nextY.toFixed(4)),
        });
      } else if (currentDrag.kind === 'corner') {
        const dx = (clientX - currentDrag.startClientX) / rect.width;
        const dy = (clientY - currentDrag.startClientY) / rect.height;
        const nextQuad: PerspectiveQuad = {
          topLeft: { ...currentDrag.initialQuad.topLeft },
          topRight: { ...currentDrag.initialQuad.topRight },
          bottomRight: { ...currentDrag.initialQuad.bottomRight },
          bottomLeft: { ...currentDrag.initialQuad.bottomLeft },
        };

        const target = nextQuad[currentDrag.corner];
        target.x = Math.max(0.05, Math.min(0.95, target.x + dx));
        target.y = Math.max(0.05, Math.min(0.95, target.y + dy));

        // Enforce minimum 8% span so quad never collapses or inverts
        const minSpan = 0.08;
        if (currentDrag.corner === 'topLeft') {
          target.x = Math.min(target.x, nextQuad.topRight.x - minSpan);
          target.y = Math.min(target.y, nextQuad.bottomLeft.y - minSpan);
        } else if (currentDrag.corner === 'topRight') {
          target.x = Math.max(target.x, nextQuad.topLeft.x + minSpan);
          target.y = Math.min(target.y, nextQuad.bottomRight.y - minSpan);
        } else if (currentDrag.corner === 'bottomRight') {
          target.x = Math.max(target.x, nextQuad.bottomLeft.x + minSpan);
          target.y = Math.max(target.y, nextQuad.topRight.y + minSpan);
        } else if (currentDrag.corner === 'bottomLeft') {
          target.x = Math.min(target.x, nextQuad.bottomRight.x - minSpan);
          target.y = Math.max(target.y, nextQuad.topLeft.y + minSpan);
        }

        const sanitized = sanitizeWallPlacement({
          ...safePlacement,
          perspectiveQuad: nextQuad,
          usePerspectiveWarp: true,
        });

        onUpdatePlacement({
          perspectiveQuad: sanitized.perspectiveQuad,
          usePerspectiveWarp: true,
        });
      } else if (currentDrag.kind === 'split') {
        const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
        onChangeBeforeAfter(Math.round(pct));
      }
    },
    [
      getStageRect,
      onChangeBeforeAfter,
      onUpdatePlacement,
      room.analysis.detectedWallZone.centerX,
      room.eyeLevelRatioY,
      safePlacement,
    ]
  );

  const capturePointerSafely = (target: EventTarget | null, pointerId?: number) => {
    if (pointerId === undefined || !target || !(target instanceof Element)) return;
    try {
      if (typeof target.setPointerCapture === 'function') {
        target.setPointerCapture(pointerId);
      }
    } catch {
      // Ignore synthetic events in JSDOM where pointerId isn't active
    }
  };

  const handleStartArtworkDrag = useCallback(
    (clientX: number, clientY: number, e: React.SyntheticEvent, pointerId?: number) => {
      e.stopPropagation();
      if (pointerId !== undefined) {
        activePointersRef.current.set(pointerId, { x: clientX, y: clientY });
        capturePointerSafely(e.currentTarget, pointerId);
      }

      if (activePointersRef.current.size >= 2) {
        updateDragState(null);
        setSnappedEyeLevel(false);
        setSnappedWallCenter(false);
        stageSwipeRef.current = null;
        const pts = Array.from(activePointersRef.current.values());
        pinchStartDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        return;
      }

      stageSwipeRef.current = null;
      updateDragState({
        kind: 'artwork',
        startClientX: clientX,
        startClientY: clientY,
        initialCenterX: safePlacement.centerX,
        initialCenterY: safePlacement.centerY,
      });
    },
    [safePlacement.centerX, safePlacement.centerY, updateDragState]
  );

  const handleStartCornerDrag = useCallback(
    (
      corner: CornerKey,
      clientX: number,
      clientY: number,
      e: React.SyntheticEvent,
      pointerId?: number
    ) => {
      e.stopPropagation();
      e.preventDefault();
      if (pointerId !== undefined) {
        capturePointerSafely(e.currentTarget, pointerId);
      }
      stageSwipeRef.current = null;
      updateDragState({
        kind: 'corner',
        corner,
        startClientX: clientX,
        startClientY: clientY,
        initialQuad: {
          topLeft: { ...safePlacement.perspectiveQuad.topLeft },
          topRight: { ...safePlacement.perspectiveQuad.topRight },
          bottomRight: { ...safePlacement.perspectiveQuad.bottomRight },
          bottomLeft: { ...safePlacement.perspectiveQuad.bottomLeft },
        },
      });
    },
    [safePlacement.perspectiveQuad, updateDragState]
  );

  const handleStartSplitDrag = useCallback(
    (e: React.SyntheticEvent, pointerId?: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (pointerId !== undefined) {
        capturePointerSafely(e.currentTarget, pointerId);
      }
      stageSwipeRef.current = null;
      updateDragState({ kind: 'split' });
    },
    [updateDragState]
  );

  // Stage-level Pointer & Touch Handlers for Two-Finger Pinch-to-Scale & Background Horizontal Swipe
  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capturePointerSafely(e.currentTarget, e.pointerId);

      if (activePointersRef.current.size >= 2) {
        updateDragState(null);
        setSnappedEyeLevel(false);
        setSnappedWallCenter(false);
        stageSwipeRef.current = null;
        const pts = Array.from(activePointersRef.current.values());
        pinchStartDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        return;
      }

      const targetEl = e.target as HTMLElement | null;
      const isInteractiveHud = targetEl?.closest(
        'button, input, [data-testid="wall-floating-toolbar"], [data-testid="room-telemetry-pill"], [data-testid="wall-calibrator-popover"], [data-testid="wall-gallery-placard"]'
      );

      if (!isInteractiveHud && !dragStateRef.current) {
        stageSwipeRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          pointerId: e.pointerId,
          swiped: false,
        };
      }
    },
    [updateDragState]
  );

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (activePointersRef.current.size >= 2) {
        const pts = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        evaluatePinchDistance(dist);
        return;
      }

      if (dragStateRef.current) {
        handleDragMove(e.clientX, e.clientY);
      } else if (stageSwipeRef.current) {
        evaluateStageSwipe(e.clientX, e.clientY);
      }
    },
    [evaluatePinchDistance, evaluateStageSwipe, handleDragMove]
  );

  const handleStagePointerUpOrCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (
        stageSwipeRef.current &&
        !dragStateRef.current &&
        activePointersRef.current.size <= 1
      ) {
        evaluateStageSwipe(e.clientX, e.clientY);
      }

      activePointersRef.current.delete(e.pointerId);

      if (activePointersRef.current.size < 2) {
        pinchStartDistRef.current = null;
      }

      if (activePointersRef.current.size === 0) {
        stageSwipeRef.current = null;
        if (dragStateRef.current) {
          updateDragState(null);
          setSnappedEyeLevel(false);
          setSnappedWallCenter(false);
        }
      }
    },
    [evaluateStageSwipe, updateDragState]
  );

  const handleStageTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length >= 2) {
        updateDragState(null);
        setSnappedEyeLevel(false);
        setSnappedWallCenter(false);
        stageSwipeRef.current = null;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        pinchStartDistRef.current = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      } else if (e.touches.length === 1 && !dragStateRef.current && !stageSwipeRef.current) {
        const targetEl = e.target as HTMLElement | null;
        const isInteractiveOrArtwork = targetEl?.closest(
          'button, input, [data-testid="wall-mounted-artwork-container"], [data-testid="before-after-divider"], [data-testid="wall-floating-toolbar"], [data-testid="room-telemetry-pill"], [data-testid="wall-calibrator-popover"], [data-testid="wall-gallery-placard"]'
        );
        if (!isInteractiveOrArtwork) {
          stageSwipeRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            pointerId: null,
            swiped: false,
          };
        }
      }
    },
    [updateDragState]
  );

  const handleStageTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length >= 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        evaluatePinchDistance(dist);
      } else if (e.touches.length === 1 && stageSwipeRef.current && !dragStateRef.current) {
        evaluateStageSwipe(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [evaluatePinchDistance, evaluateStageSwipe]
  );

  const handleStageTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (stageSwipeRef.current && !dragStateRef.current && e.changedTouches.length > 0) {
        evaluateStageSwipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null;
      }
      if (e.touches.length === 0) {
        stageSwipeRef.current = null;
      }
    },
    [evaluateStageSwipe]
  );

  useEffect(() => {
    if (!dragState) return;

    const onPointerMove = (e: PointerEvent) => {
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (activePointersRef.current.size >= 2) {
        const pts = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        evaluatePinchDistance(dist);
        return;
      }
      handleDragMove(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onEnd = (e?: PointerEvent | MouseEvent) => {
      if (e && 'pointerId' in e) {
        activePointersRef.current.delete(e.pointerId);
      } else {
        activePointersRef.current.clear();
      }
      if (activePointersRef.current.size < 2) {
        pinchStartDistRef.current = null;
      }
      updateDragState(null);
      setSnappedEyeLevel(false);
      setSnappedWallCenter(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('mouseup', onEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('mouseup', onEnd);
    };
  }, [dragState, evaluatePinchDistance, handleDragMove, updateDragState]);

  // Wheel / Trackpad Scrubber over the Wall Stage
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const now = Date.now();
      if (now - lastWheelTimestampRef.current < 120) {
        return;
      }
      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(rawDelta) < 2) return;

      lastWheelTimestampRef.current = now;
      const step: 1 | -1 = rawDelta > 0 ? 1 : -1;

      if (e.shiftKey) {
        onCycleSize(step);
      } else {
        onCyclePainting(step);
      }
    },
    [onCyclePainting, onCycleSize]
  );

  const isGuidesVisible = showGuides || dragState?.kind === 'artwork' || dragState?.kind === 'corner';
  const clampedBeforeAfter =
    beforeAfterSplit !== null && Number.isFinite(beforeAfterSplit)
      ? Math.max(0, Math.min(100, beforeAfterSplit))
      : null;

  const artworkContainerTransform = useMemo(
    () =>
      computePerspectiveTransformFromQuad(
        safePlacement.perspectiveQuad,
        safePlacement.usePerspectiveWarp
      ),
    [safePlacement.perspectiveQuad, safePlacement.usePerspectiveWarp]
  );

  // Outer drop-shadow CSS reinforcement paired with canvas 3-layer optical shadow
  const containerDropShadow = useMemo(() => {
    const c = shadows.contactOcclusion;
    const d = shadows.directionalCast;
    const a = shadows.ambientPenumbra;
    return `drop-shadow(${c.offsetX.toFixed(1)}px ${c.offsetY.toFixed(1)}px ${Math.max(1, c.blur * 0.45).toFixed(1)}px ${c.color}) drop-shadow(${(d.offsetX * 0.55).toFixed(1)}px ${(d.offsetY * 0.55).toFixed(1)}px ${(d.blur * 0.45).toFixed(1)}px ${d.color}) drop-shadow(${(a.offsetX * 0.35).toFixed(1)}px ${(a.offsetY * 0.35).toFixed(1)}px ${(a.blur * 0.35).toFixed(1)}px ${a.color})`;
  }, [shadows]);

  const outerWidthCm = formatDimensionCm(geom.totalOuterWidthInches);
  const outerHeightCm = formatDimensionCm(geom.totalOuterHeightInches);

  return (
    <div
      ref={stageRef}
      data-testid="in-room-wall-stage"
      data-ambient-mode={ambientMode}
      data-room-id={room.id}
      onWheel={handleWheel}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUpOrCancel}
      onPointerCancel={handleStagePointerUpOrCancel}
      onTouchStart={handleStageTouchStart}
      onTouchMove={handleStageTouchMove}
      onTouchEnd={handleStageTouchEnd}
      style={{ touchAction: 'none' }}
      className="relative w-full h-full min-h-[240px] md:min-h-[460px] bg-[#EAE6DF] overflow-hidden select-none touch-none flex items-center justify-center"
    >
      {/* Base Architectural Room Photograph Layer (After / Curated Wall) */}
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={room.imageDataUrl}
          alt={room.name}
          data-testid="room-background-image"
          style={roomFilterStyle}
          className="w-full h-full object-cover object-center pointer-events-none select-none"
          draggable={false}
        />

        {/* Dynamic Ambient Lighting Modulation Overlay */}
        <div
          data-testid="ambient-lighting-overlay"
          style={ambientOverlayStyle}
          className="absolute inset-0 pointer-events-none transition-all duration-300"
        />

        {/* Curated Wall Layer (Clipped when Before/After Split is active) */}
        <div
          data-testid="curated-wall-layer"
          style={
            clampedBeforeAfter !== null
              ? { clipPath: `inset(0 0 0 ${clampedBeforeAfter}%)` }
              : undefined
          }
          className="absolute inset-0"
        >
          {/* Contextual 57" Museum Eye-Level Reference Line & Detected Wall Zone (ONLY visible when showGuides or dragging) */}
          {isGuidesVisible && (
            <div
              data-testid="contextual-guides-overlay"
              className="absolute inset-0 pointer-events-none z-10"
            >
              {/* Detected Open Wall Zone Subtle Frame */}
              <div
                data-testid="detected-wall-zone-guide"
                style={{
                  left: `${(room.analysis.detectedWallZone.centerX - room.analysis.detectedWallZone.widthRatio / 2) * 100}%`,
                  top: `${(room.analysis.detectedWallZone.centerY - room.analysis.detectedWallZone.heightRatio / 2) * 100}%`,
                  width: `${room.analysis.detectedWallZone.widthRatio * 100}%`,
                  height: `${room.analysis.detectedWallZone.heightRatio * 100}%`,
                }}
                className="absolute border border-dashed border-[#B69553]/45 bg-[#B69553]/[0.03] rounded-[2px]"
              >
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-[#161514]/80 text-[#F6F4EF] rounded-[2px]">
                  Detected Open Wall Zone · {safePlacement.wallWidthInches}&quot; Calibrated Span
                </span>
              </div>

              {/* 57" Museum Eye-Level Horizontal Brass Line */}
              <div
                data-testid="eye-level-guide-line"
                style={{ top: `${room.eyeLevelRatioY * 100}%` }}
                className={`absolute left-0 right-0 border-t border-dashed transition-colors ${
                  snappedEyeLevel
                    ? 'border-[#B85D3B] border-t-2'
                    : 'border-[#B69553]/85'
                }`}
              >
                <div className="absolute left-4 -top-3 px-2 py-0.5 rounded-[2px] bg-[#161514]/90 text-[#F6F4EF] text-[10px] font-mono tracking-wider uppercase flex items-center gap-1.5 shadow-sm">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B69553]" />
                  <span>57&Prime; Museum Eye-Level Centerline</span>
                  {snappedEyeLevel && (
                    <span className="text-[#DEC284] font-semibold">· SNAPPED</span>
                  )}
                </div>
              </div>

              {/* Vertical Wall Centerline Snap Indicator */}
              {snappedWallCenter && (
                <div
                  data-testid="wall-center-snap-line"
                  style={{ left: `${room.analysis.detectedWallZone.centerX * 100}%` }}
                  className="absolute top-0 bottom-0 border-l border-dashed border-[#B85D3B]/90"
                />
              )}
            </div>
          )}

          {/* Physically Scaled Mounted Artwork Container */}
          <div
            data-testid="wall-mounted-artwork-container"
            data-outer-width-ratio={geom.outerWallWidthRatio.toFixed(4)}
            data-artwork-width-ratio={geom.artworkWallWidthRatio.toFixed(4)}
            data-outer-width-inches={geom.totalOuterWidthInches}
            data-outer-height-inches={geom.totalOuterHeightInches}
            data-artwork-width-inches={geom.artworkWidthInches}
            data-artwork-height-inches={geom.artworkHeightInches}
            data-panel-layout={panelLayout}
            data-panel-count={geom.panelCount}
            data-size-id={sizeId}
            data-frame-id={frameId}
            data-mat-width-id={matWidthId}
            data-orientation={orientation}
            data-ambient-mode={ambientMode}
            data-perspective-active={safePlacement.usePerspectiveWarp ? 'true' : 'false'}
            onPointerDown={(e) => handleStartArtworkDrag(e.clientX, e.clientY, e, e.pointerId)}
            onPointerMove={(e) => {
              if (activePointersRef.current.has(e.pointerId)) {
                activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              }
              if (activePointersRef.current.size >= 2) {
                const pts = Array.from(activePointersRef.current.values());
                evaluatePinchDistance(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
                return;
              }
              handleDragMove(e.clientX, e.clientY);
            }}
            onPointerUp={handleStagePointerUpOrCancel}
            onPointerCancel={handleStagePointerUpOrCancel}
            onMouseDown={(e) => handleStartArtworkDrag(e.clientX, e.clientY, e)}
            style={{
              left: `${safePlacement.centerX * 100}%`,
              top: `${safePlacement.centerY * 100}%`,
              width: `${geom.outerWallWidthRatio * 100}%`,
              aspectRatio: `${geom.totalOuterWidthInches} / ${geom.totalOuterHeightInches}`,
              transform: artworkContainerTransform,
              filter: containerDropShadow,
              touchAction: 'none',
            }}
            className="absolute z-20 cursor-grab active:cursor-grabbing touch-none group"
          >
            {/* Framed Painting HTML5 Canvas */}
            <canvas
              ref={artworkCanvasRef}
              data-testid="framed-artwork-canvas"
              className="w-full h-full block select-none pointer-events-none"
            />

            {/* Contextual Architectural Dimension Rulers & 4-Corner Perspective Handles */}
            {isGuidesVisible && (
              <>
                {/* Top Horizontal Outer Dimension Callout Bar */}
                <div
                  data-testid="dimension-callout-horizontal"
                  className="absolute -top-8 left-0 right-0 flex items-center justify-center pointer-events-none"
                >
                  <div className="w-full flex items-center">
                    <div className="h-2.5 border-l border-[#161514]/80" />
                    <div className="flex-1 border-t border-[#161514]/70" />
                    <span className="mx-1.5 px-2 py-0.5 rounded-[2px] bg-[#161514]/90 text-[#F6F4EF] font-mono text-[10px] tracking-tight whitespace-nowrap shadow-sm">
                      {formatDimensionInches(geom.artworkWidthInches)} &times;{' '}
                      {formatDimensionInches(geom.artworkHeightInches)} Print &middot;{' '}
                      {formatDimensionInches(geom.totalOuterWidthInches)} &times;{' '}
                      {formatDimensionInches(geom.totalOuterHeightInches)} Framed ({outerWidthCm}{' '}
                      &times; {outerHeightCm} cm)
                      {geom.panelCount > 1
                        ? ` · ${geom.panelCount} Panels (${geom.interPanelGapInches.toFixed(1)}" gap)`
                        : ''}
                    </span>
                    <div className="flex-1 border-t border-[#161514]/70" />
                    <div className="h-2.5 border-r border-[#161514]/80" />
                  </div>
                </div>

                {/* Right Vertical Height Callout Bar */}
                <div
                  data-testid="dimension-callout-vertical"
                  className="absolute top-0 bottom-0 -right-14 flex flex-col items-center justify-center pointer-events-none"
                >
                  <div className="w-2.5 border-t border-[#161514]/80" />
                  <div className="flex-1 border-l border-[#161514]/70" />
                  <span className="my-1 px-1.5 py-0.5 rounded-[2px] bg-[#161514]/90 text-[#F6F4EF] font-mono text-[10px] whitespace-nowrap">
                    {formatDimensionInches(geom.totalOuterHeightInches)} ({outerHeightCm} cm)
                  </span>
                  <div className="flex-1 border-l border-[#161514]/70" />
                  <div className="w-2.5 border-b border-[#161514]/80" />
                </div>

                {/* 4-Corner Perspective Quad Adjustment Handles (>= 44x44px hit targets) */}
                {(
                  [
                    { key: 'topLeft', posClass: '-top-5 -left-5', label: 'TL' },
                    { key: 'topRight', posClass: '-top-5 -right-5', label: 'TR' },
                    { key: 'bottomRight', posClass: '-bottom-5 -right-5', label: 'BR' },
                    { key: 'bottomLeft', posClass: '-bottom-5 -left-5', label: 'BL' },
                  ] as const
                ).map(({ key, posClass, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Adjust ${key} perspective handle`}
                    data-testid={`perspective-handle-${key}`}
                    onPointerDown={(e) =>
                      handleStartCornerDrag(key, e.clientX, e.clientY, e, e.pointerId)
                    }
                    onPointerMove={(e) => handleDragMove(e.clientX, e.clientY)}
                    onPointerUp={handleStagePointerUpOrCancel}
                    onPointerCancel={handleStagePointerUpOrCancel}
                    onMouseDown={(e) => handleStartCornerDrag(key, e.clientX, e.clientY, e)}
                    style={{ touchAction: 'none', minWidth: 44, minHeight: 44 }}
                    className={`absolute ${posClass} w-11 h-11 min-w-[44px] min-h-[44px] touch-none flex items-center justify-center cursor-crosshair z-30 group/handle`}
                    title={`Drag ${label} corner to calibrate wall perspective`}
                  >
                    <span className="w-4 h-4 rounded-[2px] bg-[#F6F4EF] border-2 border-[#B85D3B] shadow-md group-hover/handle:scale-125 transition-transform flex items-center justify-center pointer-events-none">
                      <span className="w-1 h-1 bg-[#161514] rounded-full" />
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Before / After Split-Compare Wipe Overlay & Interactive Scrubber */}
        {clampedBeforeAfter !== null && (
          <div
            data-testid="before-after-overlay"
            className="absolute inset-0 pointer-events-none z-25"
          >
            {/* Labels */}
            <div className="absolute top-14 md:top-16 left-2.5 md:left-4 px-2 py-0.5 md:px-2.5 md:py-1 rounded-[3px] bg-[#161514]/85 text-[#F6F4EF] font-mono text-[10px] tracking-widest uppercase">
              Before &middot; Bare Wall
            </div>
            <div className="absolute top-14 md:top-16 right-2.5 md:right-4 px-2 py-0.5 md:px-2.5 md:py-1 rounded-[3px] bg-[#161514]/85 text-[#F6F4EF] font-mono text-[10px] tracking-widest uppercase">
              After &middot; Curated Wall
            </div>

            {/* Vertical Split Line & >= 44x44px Touch Hit Handle */}
            <div
              data-testid="before-after-divider"
              style={{
                left: `${clampedBeforeAfter}%`,
                touchAction: 'none',
                minWidth: 44,
                minHeight: 44,
              }}
              onPointerDown={(e) => handleStartSplitDrag(e, e.pointerId)}
              onPointerMove={(e) => handleDragMove(e.clientX, e.clientY)}
              onPointerUp={handleStagePointerUpOrCancel}
              onPointerCancel={handleStagePointerUpOrCancel}
              onMouseDown={(e) => handleStartSplitDrag(e)}
              className="absolute top-0 bottom-0 -ml-[22px] w-11 min-w-[44px] min-h-[44px] touch-none pointer-events-auto cursor-ew-resize flex items-center justify-center"
            >
              <div className="relative h-full w-[2px] bg-[#F6F4EF] shadow-[0_0_10px_rgba(0,0,0,0.45)] flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 shrink-0 rounded-full bg-[#161514] border border-[#F6F4EF] text-[#F6F4EF] text-[10px] font-mono flex items-center justify-center shadow-lg">
                  &harr;
                </div>
              </div>
            </div>

            {/* Accessible Range Scrubber Input for Keyboard & Automated Tests */}
            <div className="absolute bottom-3 md:bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#F6F4EF]/95 backdrop-blur-md border border-[#E2DDD3] px-3 py-1.5 rounded-[4px] shadow-sm flex items-center gap-2.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#5C5852]">
                Split Wipe
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(clampedBeforeAfter)}
                aria-label="Before and after split percentage"
                data-testid="before-after-slider"
                onChange={(e) => onChangeBeforeAfter(Number(e.target.value))}
                className="w-28 md:w-32 accent-[#B85D3B] cursor-pointer"
              />
              <span className="text-[11px] font-mono tabular-nums text-[#161514]">
                {Math.round(clampedBeforeAfter)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Unified Non-Overlapping Top HUD Flex Bar (Telemetry Pill + Contextual Gallery Toolbar) */}
      <div className="absolute top-2 inset-x-2 md:top-3 md:inset-x-3.5 z-30 flex items-center justify-between gap-1.5 md:gap-2 pointer-events-none">
        {/* Top-Left Room & Light Vector Telemetry Pill (Micro-Restraint on <768px per SPEC PATCH #20) */}
        <div
          data-testid="room-telemetry-pill"
          className="pointer-events-auto shrink min-w-[38px] min-h-[38px] px-2 py-1 md:px-2.5 md:py-1.5 bg-[#F6F4EF]/85 backdrop-blur-sm border border-[#E2DDD3] rounded-[4px] shadow-sm flex items-center gap-1.5 md:gap-2"
        >
          <span
            className="w-2.5 h-2.5 shrink-0 rounded-full border border-[#161514]/20"
            style={{
              backgroundColor: room.analysis.dominantSwatches[0]?.hex ?? '#D8D2C5',
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] md:text-[11px] font-medium text-[#161514] leading-tight max-w-[72px] sm:max-w-[130px] xl:max-w-[200px] truncate">
              {room.name}
            </span>
            <span className="text-[9px] md:text-[10px] font-mono tabular-nums text-[#5C5852] leading-tight truncate">
              {room.analysis.estimatedKelvin}K
              <span className="hidden 2xl:inline">
                {' '}
                {room.analysis.temperatureCategory} &middot; Light{' '}
                {Math.round(room.analysis.lightVector.azimuthDeg)}&deg; &middot; Wall{' '}
                {safePlacement.wallWidthInches}&Prime; ({formatDimensionCm(safePlacement.wallWidthInches)}{' '}
                cm)
              </span>
            </span>
          </div>
        </div>

        {/* Top-Right Contextual Gallery Toolbar (Compact Micro-Pills on <1280px so HUD never overlaps) */}
        <div
          data-testid="wall-floating-toolbar"
          className="pointer-events-auto shrink-0 max-w-full flex items-center gap-1 md:gap-1.5 backdrop-blur-sm bg-[#F6F4EF]/85 border border-[#E2DDD3] rounded-[4px] p-0.5 md:p-1 shadow-sm overflow-x-auto no-scrollbar"
        >
          {/* Ambient Lighting Mode Switcher */}
          <div className="flex items-center bg-[#EFECE6] rounded-[3px] p-0.5 shrink-0">
            {(
              [
                { id: 'daylight', label: 'Daylight', shortLabel: 'Day' },
                { id: 'golden-hour', label: 'Golden Hour', shortLabel: 'Gold' },
                { id: 'evening-sconce', label: 'Evening', shortLabel: 'Eve' },
              ] as const
            ).map((mode) => {
              const active = ambientMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`ambient-mode-${mode.id}`}
                  onClick={() => onChangeAmbientMode(mode.id)}
                  className={`min-h-[34px] md:min-h-[28px] px-1.5 md:px-2 py-1 text-[10px] md:text-[11px] font-medium rounded-[2px] transition-colors shrink-0 ${
                    active
                      ? 'bg-[#FFFFFF] text-[#161514] shadow-sm'
                      : 'text-[#5C5852] hover:text-[#161514]'
                  }`}
                >
                  <span className="xl:hidden">{mode.shortLabel}</span>
                  <span className="hidden xl:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-[#E2DDD3] shrink-0" />

          {/* Dimensions & Perspective (D) Toggle */}
          <button
            type="button"
            data-testid="toggle-guides-btn"
            onClick={onToggleGuides}
            className={`min-h-[38px] min-w-[38px] md:min-h-[28px] md:min-w-0 px-1.5 md:px-2.5 py-1 text-[10px] md:text-[11px] font-medium rounded-[3px] border transition-colors shrink-0 flex items-center justify-center ${
              showGuides
                ? 'bg-[#161514] text-[#F6F4EF] border-[#161514]'
                : 'bg-transparent text-[#161514] border-transparent hover:bg-[#EFECE6]'
            }`}
            title="Toggle 57-inch Museum Eye-Level & Perspective Handles (Shortcut: D)"
          >
            <span className="xl:hidden">Guides</span>
            <span className="hidden xl:inline">Dimensions &amp; Perspective (D)</span>
          </button>

          {/* Before / After Split Toggle */}
          <button
            type="button"
            data-testid="toggle-before-after-btn"
            onClick={() => onChangeBeforeAfter(beforeAfterSplit === null ? 50 : null)}
            className={`min-h-[38px] min-w-[38px] md:min-h-[28px] md:min-w-0 px-1.5 md:px-2.5 py-1 text-[10px] md:text-[11px] font-medium rounded-[3px] border transition-colors shrink-0 flex items-center justify-center ${
              beforeAfterSplit !== null
                ? 'bg-[#B85D3B] text-[#FFFFFF] border-[#B85D3B]'
                : 'bg-transparent text-[#161514] border-transparent hover:bg-[#EFECE6]'
            }`}
          >
            <span className="xl:hidden">Split</span>
            <span className="hidden xl:inline">Before / After</span>
          </button>

          {/* Wall Scale Calibrator Trigger */}
          <button
            type="button"
            data-testid="toggle-wall-calibrator-btn"
            onClick={() => setIsCalibratorOpen((prev) => !prev)}
            className={`min-h-[38px] min-w-[38px] md:min-h-[28px] md:min-w-0 px-1.5 md:px-2.5 py-1 text-[10px] md:text-[11px] font-mono tabular-nums rounded-[3px] border transition-colors shrink-0 flex items-center justify-center ${
              isCalibratorOpen
                ? 'bg-[#2E4A3E] text-[#FFFFFF] border-[#2E4A3E]'
                : 'bg-[#EFECE6] text-[#161514] border-[#E2DDD3] hover:bg-[#E2DDD3]/60'
            }`}
          >
            <span className="xl:hidden">{safePlacement.wallWidthInches}&Prime;</span>
            <span className="hidden xl:inline">Wall: {safePlacement.wallWidthInches}&Prime;</span>
          </button>

          {/* Pin to Lookbook Button */}
          <button
            type="button"
            data-testid="pin-lookbook-btn"
            onClick={onPinLookbook}
            className="hidden sm:inline-flex min-h-[38px] min-w-[38px] md:min-h-[28px] md:min-w-0 px-2 md:px-2.5 py-1 text-[10px] md:text-[11px] font-medium rounded-[3px] bg-[#FFFFFF] text-[#161514] border border-[#E2DDD3] hover:border-[#B85D3B] hover:text-[#B85D3B] transition-colors shrink-0 items-center justify-center"
          >
            <span className="xl:hidden">Pin</span>
            <span className="hidden xl:inline">Pin Setup</span>
          </button>
        </div>
      </div>

      {/* Wall Scale & Perspective Calibrator Popover */}
      {isCalibratorOpen && (
        <div
          data-testid="wall-calibrator-popover"
          className="absolute top-12 md:top-14 right-2 md:right-3.5 z-30 w-72 max-w-[calc(100vw-16px)] backdrop-blur-md bg-[#F6F4EF]/95 border border-[#E2DDD3] rounded-[4px] p-3.5 shadow-lg text-[#161514]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852]">
              Wall Scale Calibration
            </span>
            <span className="text-[11px] font-mono tabular-nums font-semibold">
              {safePlacement.wallWidthInches}&Prime; ({formatDimensionCm(safePlacement.wallWidthInches)} cm)
            </span>
          </div>

          <input
            type="range"
            min={80}
            max={200}
            step={2}
            value={safePlacement.wallWidthInches}
            aria-label="Calibrated wall width in inches"
            data-testid="wall-width-slider"
            onChange={(e) =>
              onUpdatePlacement({ wallWidthInches: Number(e.target.value) })
            }
            className="w-full accent-[#B85D3B] cursor-pointer mb-2"
          />

          <div className="flex justify-between text-[10px] font-mono text-[#5C5852] mb-3">
            <span>80&Prime; Alcove</span>
            <span>120&Prime; Standard</span>
            <span>200&Prime; Loft</span>
          </div>

          {geom.panelCount > 1 && (
            <div className="mb-3 pt-2 border-t border-[#E2DDD3]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852]">
                  Inter-Panel Gap
                </span>
                <span className="text-[11px] font-mono tabular-nums font-semibold">
                  {safePlacement.interPanelGapInches.toFixed(1)}&Prime;
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={0.5}
                value={safePlacement.interPanelGapInches}
                aria-label="Inter-panel gap in inches"
                data-testid="inter-panel-gap-slider"
                onChange={(e) =>
                  onUpdatePlacement({ interPanelGapInches: Number(e.target.value) })
                }
                className="w-full accent-[#B85D3B] cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[#E2DDD3]">
            <button
              type="button"
              data-testid="snap-eye-level-btn"
              onClick={() =>
                onUpdatePlacement({
                  centerX: room.analysis.detectedWallZone.centerX,
                  centerY: room.eyeLevelRatioY,
                })
              }
              className="flex-1 min-h-[38px] md:min-h-0 px-2 py-1 text-[11px] font-medium rounded-[3px] bg-[#EFECE6] hover:bg-[#E2DDD3] text-[#161514] transition-colors"
            >
              Snap 57&Prime; Eye-Level
            </button>
            <button
              type="button"
              data-testid="reset-perspective-btn"
              onClick={() =>
                onUpdatePlacement({
                  usePerspectiveWarp: false,
                  perspectiveQuad: {
                    topLeft: { x: 0.35, y: 0.25 },
                    topRight: { x: 0.65, y: 0.25 },
                    bottomRight: { x: 0.65, y: 0.65 },
                    bottomLeft: { x: 0.35, y: 0.65 },
                  },
                })
              }
              className="min-h-[38px] md:min-h-0 px-2 py-1 text-[11px] font-medium rounded-[3px] bg-[#FFFFFF] border border-[#E2DDD3] hover:border-[#161514] text-[#161514] transition-colors"
            >
              Reset Quad
            </button>
          </div>
        </div>
      )}

      {/* Bottom Floating Museum Gallery Placard (Hidden on <768px per SPEC PATCH #20 so >=85% of room/painting is unobstructed) */}
      <div
        data-testid="wall-gallery-placard"
        className="hidden md:flex absolute bottom-3.5 left-1/2 -translate-x-1/2 z-30 max-w-[92%] backdrop-blur-md bg-[#F6F4EF]/95 border border-[#E2DDD3] rounded-[4px] px-3.5 py-2 shadow-sm items-center gap-3"
      >
        <button
          type="button"
          aria-label="Previous painting"
          data-testid="placard-prev-painting"
          onClick={() => onCyclePainting(-1)}
          className="w-6 h-6 rounded-[3px] bg-[#EFECE6] hover:bg-[#E2DDD3] text-[#161514] flex items-center justify-center text-xs font-mono transition-colors"
          title="Previous Painting (Left Arrow)"
        >
          &larr;
        </button>

        <div className="flex flex-col min-w-0 text-center">
          <div className="text-[12px] font-medium text-[#161514] truncate">
            <span className="font-mono text-[11px] text-[#B85D3B] mr-1.5">
              {painting.catalogNumber}
            </span>
            <span>{painting.title}</span>
            <span className="mx-1.5 text-[#5C5852]">&mdash;</span>
            <span className="font-mono tabular-nums text-[11px]">
              {sizeSpec.labelInches}
            </span>
            <span className="mx-1.5 text-[#5C5852]">&middot;</span>
            <span>{frameSpec.name}</span>
          </div>
          <div className="text-[10px] font-mono tabular-nums text-[#5C5852] truncate">
            {orientation.toUpperCase()} &middot; {panelLayout.toUpperCase()} (
            {formatDimensionInches(geom.totalOuterWidthInches)} &times;{' '}
            {formatDimensionInches(geom.totalOuterHeightInches)} outer) &middot;{' '}
            {matWidthId === 'none' ? 'No Mat' : `${matWidthId} Archival Mat`} &middot; Scroll or
            Shift+Scroll to size
          </div>
        </div>

        <button
          type="button"
          aria-label="Next painting"
          data-testid="placard-next-painting"
          onClick={() => onCyclePainting(1)}
          className="w-6 h-6 rounded-[3px] bg-[#EFECE6] hover:bg-[#E2DDD3] text-[#161514] flex items-center justify-center text-xs font-mono transition-colors"
          title="Next Painting (Right Arrow)"
        >
          &rarr;
        </button>

        <button
          type="button"
          data-testid="placard-cycle-frame"
          onClick={onCycleFrame}
          className="px-2 py-1 rounded-[3px] bg-[#EFECE6] hover:bg-[#E2DDD3] text-[#161514] text-[10px] font-mono uppercase tracking-wider transition-colors"
          title="Cycle Frame Profile (Shortcut: F)"
        >
          Frame (F)
        </button>
      </div>
    </div>
  );
};
