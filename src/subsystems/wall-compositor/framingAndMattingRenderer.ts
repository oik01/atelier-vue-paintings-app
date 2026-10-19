// src/subsystems/wall-compositor/framingAndMattingRenderer.ts
// Leaf 3A: Pure Physical-Scale Geometry Engine, 3-Layer Directional Shadow Solver,
// and HTML5 Canvas 2D Multi-Pass Optical Framing, Conservation Matting & Glazing Compositor.

import {
  AmbientLightingMode,
  FrameProfileSpec,
  MatColorId,
  MatWidthId,
  OrientationMode,
  PaintingSpec,
  PanelLayoutMode,
  PerspectiveQuad,
  PrintSizeSpec,
  WallAnalysisResult,
  WallPlacementState,
} from '../../contracts/masterContract';
import { renderPaintingToCanvas } from '../painting-synthesis';

export interface PhysicalFrameGeometry {
  panelCount: 1 | 2 | 3;
  artworkWidthInches: number;
  artworkHeightInches: number;
  panelArtworkWidthInches: number;
  panelArtworkHeightInches: number;
  mouldingWidthInches: number;
  floatGapInches: number;
  effectiveMatWidthInches: number;
  interPanelGapInches: number;
  singlePanelOuterWidthInches: number;
  singlePanelOuterHeightInches: number;
  totalOuterWidthInches: number;
  totalOuterHeightInches: number;
  outerWallWidthRatio: number;
  artworkWallWidthRatio: number;
}

export interface ShadowLayerSpec {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  opacity: number;
  color: string;
}

export interface ThreeLayerShadowVectors {
  contactOcclusion: ShadowLayerSpec;
  directionalCast: ShadowLayerSpec;
  ambientPenumbra: ShadowLayerSpec;
}

export interface RenderFramedArtworkParams {
  painting: PaintingSpec;
  sizeSpec: PrintSizeSpec;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameSpec: FrameProfileSpec;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
  lightVector: WallAnalysisResult['lightVector'];
  ambientMode: AmbientLightingMode;
  estimatedKelvin: number;
}

const MAT_COLOR_HEX: Record<MatColorId, { surface: string; textureTint: string }> = {
  'archival-ivory': {
    surface: '#F7F4EC',
    textureTint: 'rgba(218, 210, 194, 0.18)',
  },
  'warm-museum-linen': {
    surface: '#EAE4D7',
    textureTint: 'rgba(192, 182, 164, 0.24)',
  },
  'charcoal-conservation': {
    surface: '#252422',
    textureTint: 'rgba(255, 250, 240, 0.05)',
  },
};

const BEVEL_CREAM_CORE_LIT_HEX = '#FBF9F4';
const BEVEL_CREAM_CORE_SHADOW_HEX = '#CFC9BC';
const FLOAT_CHANNEL_VOID_HEX = '#121110';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Maps MatWidthId ('none' | '1.5in' | '2.5in' | '3.5in') to physical inches.
 * Automatically suppresses matboard (returns 0) when mounted as an unframed gallery wrap
 * or inside a recessed float frame.
 */
export function parseMatWidthInches(
  matWidthId: MatWidthId,
  frameSpec?: FrameProfileSpec
): number {
  if (frameSpec && (frameSpec.id === 'unframed-canvas' || frameSpec.isFloatFrame)) {
    return 0;
  }

  switch (matWidthId) {
    case '1.5in':
      return 1.5;
    case '2.5in':
      return 2.5;
    case '3.5in':
      return 3.5;
    case 'none':
    default:
      return 0;
  }
}

function enforceOrderedPair(
  lowRaw: number,
  highRaw: number,
  minBound = 0.05,
  maxBound = 0.95,
  minSpan = 0.08
): [number, number] {
  const lowClamped = clamp(lowRaw, minBound, maxBound);
  const highClamped = clamp(highRaw, minBound, maxBound);

  if (highClamped - lowClamped >= minSpan - 1e-9) {
    return [Number(lowClamped.toFixed(4)), Number(highClamped.toFixed(4))];
  }

  const halfSpan = minSpan * 0.5;
  const mid = clamp(
    (lowClamped + highClamped) * 0.5,
    minBound + halfSpan,
    maxBound - halfSpan
  );
  return [
    Number(clamp(mid - halfSpan, minBound, maxBound - minSpan).toFixed(4)),
    Number(clamp(mid + halfSpan, minBound + minSpan, maxBound).toFixed(4)),
  ];
}

/**
 * Sanitizes and clamps wall placement state, guaranteeing finite bounds and preventing
 * perspective quad collapse or inversion even under adversarial NaN/Infinity inputs.
 */
export function sanitizeWallPlacement(
  placement?: Partial<WallPlacementState> | null
): WallPlacementState {
  const centerX = Number(
    clamp(safeFinite(placement?.centerX, 0.5), 0.12, 0.88).toFixed(4)
  );
  const centerY = Number(
    clamp(safeFinite(placement?.centerY, 0.46), 0.12, 0.88).toFixed(4)
  );
  const wallWidthInches = Number(
    clamp(safeFinite(placement?.wallWidthInches, 120), 60, 240).toFixed(2)
  );
  const interPanelGapInches = Number(
    clamp(safeFinite(placement?.interPanelGapInches, 2.0), 0.5, 6.0).toFixed(2)
  );
  const usePerspectiveWarp = Boolean(placement?.usePerspectiveWarp);

  const rawQuad = placement?.perspectiveQuad;
  const rawTLX = safeFinite(rawQuad?.topLeft?.x, 0.35);
  const rawTLY = safeFinite(rawQuad?.topLeft?.y, 0.25);
  const rawTRX = safeFinite(rawQuad?.topRight?.x, 0.65);
  const rawTRY = safeFinite(rawQuad?.topRight?.y, 0.25);
  const rawBRX = safeFinite(rawQuad?.bottomRight?.x, 0.65);
  const rawBRY = safeFinite(rawQuad?.bottomRight?.y, 0.65);
  const rawBLX = safeFinite(rawQuad?.bottomLeft?.x, 0.35);
  const rawBLY = safeFinite(rawQuad?.bottomLeft?.y, 0.65);

  const [topLeftX, topRightX] = enforceOrderedPair(rawTLX, rawTRX, 0.05, 0.95, 0.08);
  const [bottomLeftX, bottomRightX] = enforceOrderedPair(rawBLX, rawBRX, 0.05, 0.95, 0.08);
  const [topLeftY, bottomLeftY] = enforceOrderedPair(rawTLY, rawBLY, 0.05, 0.95, 0.08);
  const [topRightY, bottomRightY] = enforceOrderedPair(rawTRY, rawBRY, 0.05, 0.95, 0.08);

  const perspectiveQuad: PerspectiveQuad = {
    topLeft: { x: topLeftX, y: topLeftY },
    topRight: { x: topRightX, y: topRightY },
    bottomRight: { x: bottomRightX, y: bottomRightY },
    bottomLeft: { x: bottomLeftX, y: bottomLeftY },
  };

  return {
    centerX,
    centerY,
    wallWidthInches,
    perspectiveQuad,
    usePerspectiveWarp,
    interPanelGapInches,
  };
}

/**
 * Computes exact physical dimensions in inches and normalized wall width ratios
 * for any combination of print size, orientation, multi-panel split, frame moulding,
 * mat width, and calibrated wall width.
 */
export function computePhysicalFrameDimensions(params: {
  sizeSpec: PrintSizeSpec;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameSpec: FrameProfileSpec;
  matWidthId: MatWidthId;
  wallWidthInches: number;
  interPanelGapInches?: number;
}): PhysicalFrameGeometry {
  const rawW = safeFinite(params?.sizeSpec?.widthInches, 24);
  const rawH = safeFinite(params?.sizeSpec?.heightInches, 36);
  const baseW = rawW > 0 ? rawW : 24;
  const baseH = rawH > 0 ? rawH : 36;

  let artworkWidthInches: number;
  let artworkHeightInches: number;

  if (params.orientation === 'landscape') {
    artworkWidthInches = Math.max(baseW, baseH);
    artworkHeightInches = Math.min(baseW, baseH);
  } else if (params.orientation === 'square') {
    const squareSide = Math.round((baseW + baseH) * 0.5);
    artworkWidthInches = squareSide;
    artworkHeightInches = squareSide;
  } else {
    artworkWidthInches = Math.min(baseW, baseH);
    artworkHeightInches = Math.max(baseW, baseH);
  }

  const panelCount: 1 | 2 | 3 =
    params.panelLayout === 'triptych'
      ? 3
      : params.panelLayout === 'diptych'
        ? 2
        : 1;

  const panelArtworkWidthInches = Number((artworkWidthInches / panelCount).toFixed(4));
  const panelArtworkHeightInches = Number(artworkHeightInches.toFixed(4));

  const mouldingWidthInches =
    params.frameSpec?.id === 'unframed-canvas'
      ? 0
      : Math.max(0, safeFinite(params.frameSpec?.mouldingWidthInches, 0));

  const floatGapInches = params.frameSpec?.isFloatFrame ? 0.35 : 0;
  const effectiveMatWidthInches = parseMatWidthInches(params.matWidthId, params.frameSpec);

  const perSideBorderInches =
    mouldingWidthInches + floatGapInches + effectiveMatWidthInches;

  const singlePanelOuterWidthInches = Number(
    (panelArtworkWidthInches + 2 * perSideBorderInches).toFixed(4)
  );
  const singlePanelOuterHeightInches = Number(
    (panelArtworkHeightInches + 2 * perSideBorderInches).toFixed(4)
  );

  const rawGap = safeFinite(params.interPanelGapInches, 2.0);
  const interPanelGapInches =
    panelCount > 1 ? Number(clamp(rawGap, 0.5, 6.0).toFixed(4)) : 0;

  const totalOuterWidthInches = Number(
    (
      panelCount * singlePanelOuterWidthInches +
      (panelCount - 1) * interPanelGapInches
    ).toFixed(4)
  );
  const totalOuterHeightInches = singlePanelOuterHeightInches;

  const rawWallWidth = safeFinite(params.wallWidthInches, 120);
  const safeWallWidth = clamp(rawWallWidth > 0 ? rawWallWidth : 120, 60, 240);

  const outerWallWidthRatio = Number(
    clamp(totalOuterWidthInches / safeWallWidth, 0.06, 0.92).toFixed(4)
  );
  const artworkWallWidthRatio = Number(
    clamp(artworkWidthInches / safeWallWidth, 0.05, 0.9).toFixed(4)
  );

  return {
    panelCount,
    artworkWidthInches,
    artworkHeightInches,
    panelArtworkWidthInches,
    panelArtworkHeightInches,
    mouldingWidthInches,
    floatGapInches,
    effectiveMatWidthInches,
    interPanelGapInches,
    singlePanelOuterWidthInches,
    singlePanelOuterHeightInches,
    totalOuterWidthInches,
    totalOuterHeightInches,
    outerWallWidthRatio,
    artworkWallWidthRatio,
  };
}

/**
 * Computes a 3-layer optical shadow model (contactOcclusion, directionalCast, ambientPenumbra)
 * driven by the room's directional light vector, ambient lighting mode, and frame depth.
 */
export function computeShadowVectors(params: {
  lightVector: WallAnalysisResult['lightVector'];
  ambientMode: AmbientLightingMode;
  frameDepthInches: number;
}): ThreeLayerShadowVectors {
  const lv = params?.lightVector;
  const azimuthDeg = ((safeFinite(lv?.azimuthDeg, 315) % 360) + 360) % 360;
  const elevationDeg = clamp(safeFinite(lv?.elevationDeg, 45), 15, 75);
  const rawOffsetX = clamp(safeFinite(lv?.shadowOffsetX, 0.28), -1, 1);
  const rawOffsetY = clamp(safeFinite(lv?.shadowOffsetY, 0.34), 0.08, 1);
  const softness = clamp(safeFinite(lv?.shadowSoftness, 0.55), 0.2, 1.0);

  const safeDepth = clamp(
    safeFinite(params?.frameDepthInches, 1.5) > 0
      ? safeFinite(params?.frameDepthInches, 1.5)
      : 1.5,
    0.25,
    4.0
  );

  // Convert light source azimuth (0=top, 90=right, 180=bottom, 270=left) to shadow cast direction
  const azRad = (azimuthDeg * Math.PI) / 180;
  const azShadowX = -Math.sin(azRad);
  const azShadowY = Math.max(0.18, Math.cos(azRad) * 0.65 + 0.35);

  // Determine horizontal shadow sign: responds to both azimuthDeg changes (e.g. 315 -> 135)
  // and direct shadowOffsetX overrides
  let signX = 1;
  if (Math.abs(azimuthDeg - 315) > 1 && Math.abs(azShadowX) > 0.05) {
    signX = azShadowX >= 0 ? 1 : -1;
  } else if (Math.abs(rawOffsetX) > 0.01) {
    signX = rawOffsetX >= 0 ? 1 : -1;
  } else if (azShadowX < 0) {
    signX = -1;
  }

  const magX = Math.max(
    0.16,
    (Math.abs(rawOffsetX) > 0.02 ? Math.abs(rawOffsetX) : 0.28) * 0.6 +
      Math.abs(azShadowX) * 0.4
  );
  const magY = Math.max(0.2, rawOffsetY * 0.65 + azShadowY * 0.35);

  const depthScale = 0.55 + safeDepth * 0.45;
  const elevationFactor = 0.75 + ((75 - elevationDeg) / 60) * 0.55;

  let castMult = 1.0;
  let blurMult = 1.0;
  let opacityMult = 1.0;
  let shadowRgb = '20, 18, 15';

  if (params.ambientMode === 'golden-hour') {
    castMult = 1.28;
    blurMult = 1.12;
    opacityMult = 1.08;
    shadowRgb = '28, 20, 14';
  } else if (params.ambientMode === 'evening-sconce') {
    castMult = 1.16;
    blurMult = 1.32;
    opacityMult = 1.22;
    shadowRgb = '12, 10, 14';
  }

  const contactOpacity = Number(clamp(0.42 * opacityMult, 0.22, 0.72).toFixed(3));
  const contactOcclusion: ShadowLayerSpec = {
    offsetX: Number((signX * (1.1 + safeDepth * 0.65)).toFixed(2)),
    offsetY: Number((1.6 + safeDepth * 0.85).toFixed(2)),
    blur: Number((2.4 + safeDepth * 1.1).toFixed(2)),
    spread: 0,
    opacity: contactOpacity,
    color: `rgba(${shadowRgb}, ${contactOpacity})`,
  };

  const castOpacity = Number(
    clamp((0.27 - softness * 0.06) * opacityMult, 0.14, 0.52).toFixed(3)
  );
  const directionalCast: ShadowLayerSpec = {
    offsetX: Number(
      (signX * magX * 18 * depthScale * elevationFactor * castMult).toFixed(2)
    ),
    offsetY: Number((magY * 21 * depthScale * elevationFactor * castMult).toFixed(2)),
    blur: Number(((11 + softness * 15) * depthScale * blurMult).toFixed(2)),
    spread: Number((1.4 * depthScale).toFixed(2)),
    opacity: castOpacity,
    color: `rgba(${shadowRgb}, ${castOpacity})`,
  };

  const penumbraOpacity = Number(clamp(0.15 * opacityMult, 0.08, 0.36).toFixed(3));
  const ambientPenumbra: ShadowLayerSpec = {
    offsetX: Number((signX * magX * 8.5 * depthScale).toFixed(2)),
    offsetY: Number((magY * 14 * depthScale * blurMult).toFixed(2)),
    blur: Number(((26 + softness * 24) * depthScale * blurMult).toFixed(2)),
    spread: Number((2.8 * depthScale).toFixed(2)),
    opacity: penumbraOpacity,
    color: `rgba(${shadowRgb}, ${penumbraOpacity})`,
  };

  return {
    contactOcclusion,
    directionalCast,
    ambientPenumbra,
  };
}

function setCanvasMetadataAttribute(
  canvas: HTMLCanvasElement,
  attrName: string,
  datasetKey: string,
  value: string
): void {
  try {
    if (typeof canvas.setAttribute === 'function') {
      canvas.setAttribute(attrName, value);
    }
  } catch {
    // Ignore in restricted mock objects
  }
  try {
    if (canvas.dataset) {
      canvas.dataset[datasetKey] = value;
    }
  } catch {
    // Ignore read-only dataset mocks
  }
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<[number, number]>,
  fillStyle: string
): void {
  if (
    typeof ctx.beginPath !== 'function' ||
    typeof ctx.moveTo !== 'function' ||
    typeof ctx.lineTo !== 'function' ||
    typeof ctx.closePath !== 'function' ||
    typeof ctx.fill !== 'function'
  ) {
    return;
  }
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  strokeStyle: string,
  lineWidth = 1
): void {
  if (
    typeof ctx.beginPath !== 'function' ||
    typeof ctx.moveTo !== 'function' ||
    typeof ctx.lineTo !== 'function' ||
    typeof ctx.stroke !== 'function'
  ) {
    return;
  }
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function renderFallbackArtworkSlice(
  ctx: CanvasRenderingContext2D,
  painting: PaintingSpec,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  panelIndex: number,
  panelCount: number
): void {
  if (typeof ctx.fillRect !== 'function') return;

  const pigments =
    painting?.pigments && painting.pigments.length > 0
      ? painting.pigments
      : [
          { hex: '#E5DFD3', rgb: [229, 223, 211] as [number, number, number], pigmentName: 'Warm Linen', opacity: 1, viscosity: 0.5 },
          { hex: '#B85D3B', rgb: [184, 93, 59] as [number, number, number], pigmentName: 'Terracotta', opacity: 0.85, viscosity: 0.8 },
          { hex: '#2E4A3E', rgb: [46, 74, 62] as [number, number, number], pigmentName: 'Forest Umber', opacity: 0.8, viscosity: 0.7 },
          { hex: '#C8A97E', rgb: [200, 169, 126] as [number, number, number], pigmentName: 'Raw Ochre', opacity: 0.75, viscosity: 0.6 },
        ];

  const c0 = pigments[0]?.hex ?? '#E5DFD3';
  const c1 = pigments[1]?.hex ?? '#B85D3B';
  const c2 = pigments[2]?.hex ?? '#2E4A3E';
  const c3 = pigments[3]?.hex ?? '#C8A97E';

  ctx.fillStyle = c0;
  ctx.fillRect(destX, destY, destW, destH);

  const sliceStartRatio = panelIndex / panelCount;
  ctx.fillStyle = c1;
  ctx.fillRect(
    destX + destW * (0.08 * (1 - sliceStartRatio)),
    destY + destH * 0.12,
    destW * 0.84,
    destH * 0.42
  );

  ctx.fillStyle = c2;
  ctx.fillRect(
    destX + destW * 0.1,
    destY + destH * 0.58,
    destW * 0.8,
    destH * 0.28
  );

  ctx.fillStyle = c3;
  ctx.fillRect(
    destX + destW * 0.18,
    destY + destH * 0.48,
    destW * 0.64,
    destH * 0.08
  );
}

/**
 * Multi-pass HTML5 Canvas 2D compositor for framed, conservation-matted, and glazed wall artwork.
 * Supports Single, Diptych (2-panel), and Triptych (3-panel) continuous artwork slicing,
 * 3-layer directional drop shadows, 45° mitered mouldings, 0.35" float channels,
 * 45° cream-core archival mat bevels (#FBF9F4), room-Kelvin tinting, and 4% museum glass reflection.
 */
export function renderFramedArtworkToCanvas(
  canvas: HTMLCanvasElement,
  params: RenderFramedArtworkParams
): void {
  if (!canvas || !params) return;

  const geom = computePhysicalFrameDimensions({
    sizeSpec: params.sizeSpec,
    orientation: params.orientation,
    panelLayout: params.panelLayout,
    frameSpec: params.frameSpec,
    matWidthId: params.matWidthId,
    wallWidthInches: 120,
    interPanelGapInches: 2.0,
  });

  const shadows = computeShadowVectors({
    lightVector: params.lightVector,
    ambientMode: params.ambientMode,
    frameDepthInches: params.frameSpec?.depthInches ?? 1.5,
  });

  // Compute proportional pixel dimensions capped for 60fps mobile & desktop rendering
  const basePpi = 16;
  const rawW = geom.totalOuterWidthInches * basePpi;
  const rawH = geom.totalOuterHeightInches * basePpi;
  const maxDim = 860;
  const minDim = 180;
  const maxSide = Math.max(rawW, rawH, 1);
  const scaleFactor = maxSide > maxDim ? maxDim / maxSide : 1;

  const targetWidthPx = Math.max(minDim, Math.round(rawW * scaleFactor));
  const targetHeightPx = Math.max(minDim, Math.round(rawH * scaleFactor));

  canvas.width = targetWidthPx;
  canvas.height = targetHeightPx;

  const effectiveMatLabel =
    geom.effectiveMatWidthInches > 0 ? params.matWidthId : 'none';
  const hasMiteredMoulding = geom.mouldingWidthInches > 0;

  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-frame',
    'renderedFrame',
    params.frameSpec.id
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-mat',
    'renderedMat',
    effectiveMatLabel
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-mat-color',
    'renderedMatColor',
    params.matColorId
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-panels',
    'renderedPanels',
    String(geom.panelCount)
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-panel-layout',
    'renderedPanelLayout',
    params.panelLayout
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-orientation',
    'renderedOrientation',
    params.orientation
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-rendered-ambient',
    'renderedAmbient',
    params.ambientMode
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-kelvin',
    'kelvin',
    String(Math.round(safeFinite(params.estimatedKelvin, 3400)))
  );
  setCanvasMetadataAttribute(canvas, 'data-glass-glaze', 'glassGlaze', 'true');
  setCanvasMetadataAttribute(
    canvas,
    'data-mitered-corners',
    'miteredCorners',
    hasMiteredMoulding ? 'true' : 'false'
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-bevel-core',
    'bevelCore',
    BEVEL_CREAM_CORE_LIT_HEX
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-shadow-offset-x',
    'shadowOffsetX',
    String(shadows.directionalCast.offsetX)
  );
  setCanvasMetadataAttribute(
    canvas,
    'data-shadow-offset-y',
    'shadowOffsetY',
    String(shadows.directionalCast.offsetY)
  );

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return;

  if (typeof ctx.clearRect === 'function') {
    ctx.clearRect(0, 0, targetWidthPx, targetHeightPx);
  }

  // Outer shadow inset pad so in-canvas 3-layer shadows render cleanly without clipping
  const outerPadPx = Math.max(2, Math.round(Math.min(targetWidthPx, targetHeightPx) * 0.012));
  const usableW = Math.max(40, targetWidthPx - outerPadPx * 2);
  const usableH = Math.max(40, targetHeightPx - outerPadPx * 2);

  const pxPerInchX = usableW / Math.max(1, geom.totalOuterWidthInches);
  const pxPerInchY = usableH / Math.max(1, geom.totalOuterHeightInches);
  const pxPerInch = (pxPerInchX + pxPerInchY) * 0.5;

  const interGapPx =
    geom.panelCount > 1
      ? Math.max(4, Math.round(geom.interPanelGapInches * pxPerInchX))
      : 0;
  const totalGapsPx = (geom.panelCount - 1) * interGapPx;
  const singlePanelPxW = Math.max(
    24,
    Math.floor((usableW - totalGapsPx) / geom.panelCount)
  );
  const singlePanelPxH = usableH;

  const mouldingPx =
    geom.mouldingWidthInches > 0
      ? Math.max(4, Math.round(geom.mouldingWidthInches * pxPerInch))
      : 0;
  const floatGapPx =
    geom.floatGapInches > 0
      ? Math.max(2, Math.round(geom.floatGapInches * pxPerInch))
      : 0;
  const matPx =
    geom.effectiveMatWidthInches > 0
      ? Math.max(6, Math.round(geom.effectiveMatWidthInches * pxPerInch))
      : 0;

  const totalBorderPx = mouldingPx + floatGapPx + matPx;
  const panelArtPxW = Math.max(12, singlePanelPxW - 2 * totalBorderPx);
  const panelArtPxH = Math.max(12, singlePanelPxH - 2 * totalBorderPx);

  // Synthesize continuous full-span artwork onto an offscreen canvas so multi-panel
  // diptychs and triptychs slice seamlessly across panels
  const fullArtWidthPx = Math.max(36, panelArtPxW * geom.panelCount);
  const fullArtHeightPx = Math.max(36, panelArtPxH);
  let offscreenArtCanvas: HTMLCanvasElement | null = null;

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      offscreenArtCanvas = document.createElement('canvas');
      offscreenArtCanvas.width = fullArtWidthPx;
      offscreenArtCanvas.height = fullArtHeightPx;
      renderPaintingToCanvas(offscreenArtCanvas, params.painting, {
        width: fullArtWidthPx,
        height: fullArtHeightPx,
        orientation: params.orientation,
        ambientMode: params.ambientMode,
      });
    } catch {
      offscreenArtCanvas = null;
    }
  }

  const lightFromLeft = shadows.directionalCast.offsetX >= 0;

  for (let panelIdx = 0; panelIdx < geom.panelCount; panelIdx++) {
    const panelX = outerPadPx + panelIdx * (singlePanelPxW + interGapPx);
    const panelY = outerPadPx;
    const panelW = singlePanelPxW;
    const panelH = singlePanelPxH;

    // =========================================================================
    // PASS 1: 3-Layer Directional Wall Drop Shadow (Ambient Penumbra, Cast, Contact)
    // =========================================================================
    const shadowLayers: readonly ShadowLayerSpec[] = [
      shadows.ambientPenumbra,
      shadows.directionalCast,
      shadows.contactOcclusion,
    ];

    for (const layer of shadowLayers) {
      if (typeof ctx.save === 'function') ctx.save();
      ctx.shadowOffsetX = layer.offsetX * 0.25;
      ctx.shadowOffsetY = layer.offsetY * 0.25;
      ctx.shadowBlur = layer.blur * 0.35;
      ctx.shadowColor = layer.color;
      ctx.fillStyle = layer.color;
      if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(
          panelX + clamp(layer.offsetX * 0.12, -outerPadPx, outerPadPx),
          panelY + clamp(layer.offsetY * 0.12, -outerPadPx, outerPadPx),
          panelW,
          panelH
        );
      }
      if (typeof ctx.restore === 'function') ctx.restore();
    }

    // =========================================================================
    // PASS 2: Frame Moulding with 45° Mitered Trapezoids (or Unframed Gallery Wrap)
    // =========================================================================
    if (mouldingPx > 0) {
      const topFaceColor = params.frameSpec.highlightHex;
      const bottomFaceColor = params.frameSpec.secondaryHex;
      const leftFaceColor = lightFromLeft
        ? params.frameSpec.primaryHex
        : params.frameSpec.secondaryHex;
      const rightFaceColor = lightFromLeft
        ? params.frameSpec.secondaryHex
        : params.frameSpec.primaryHex;

      const x0 = panelX;
      const y0 = panelY;
      const x1 = panelX + panelW;
      const y1 = panelY + panelH;
      const ix0 = x0 + mouldingPx;
      const iy0 = y0 + mouldingPx;
      const ix1 = x1 - mouldingPx;
      const iy1 = y1 - mouldingPx;

      // Base fill for frame perimeter
      ctx.fillStyle = params.frameSpec.primaryHex;
      if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(x0, y0, panelW, panelH);
      }

      // 4 directional 45° mitered trapezoid rails
      drawPolygon(
        ctx,
        [
          [x0, y0],
          [x1, y0],
          [ix1, iy0],
          [ix0, iy0],
        ],
        topFaceColor
      );
      drawPolygon(
        ctx,
        [
          [ix0, iy1],
          [ix1, iy1],
          [x1, y1],
          [x0, y1],
        ],
        bottomFaceColor
      );
      drawPolygon(
        ctx,
        [
          [x0, y0],
          [ix0, iy0],
          [ix0, iy1],
          [x0, y1],
        ],
        leftFaceColor
      );
      drawPolygon(
        ctx,
        [
          [ix1, iy0],
          [x1, y0],
          [x1, y1],
          [ix1, iy1],
        ],
        rightFaceColor
      );

      // Procedural wood grain / brushed brass / travertine striations along frame rails
      const grainColor =
        params.frameSpec.id === 'brushed-brass-float'
          ? 'rgba(255, 244, 214, 0.16)'
          : params.frameSpec.id === 'matte-gallery-black'
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(24, 18, 12, 0.10)';

      const grainSteps = Math.max(2, Math.min(5, Math.floor(mouldingPx / 3)));
      for (let g = 1; g <= grainSteps; g++) {
        const offset = Math.round((g / (grainSteps + 1)) * mouldingPx);
        drawLine(ctx, x0 + offset, y0 + offset, x1 - offset, y0 + offset, grainColor, 0.75);
        drawLine(ctx, x0 + offset, y1 - offset, x1 - offset, y1 - offset, grainColor, 0.75);
        drawLine(ctx, x0 + offset, y0 + offset, x0 + offset, y1 - offset, grainColor, 0.75);
        drawLine(ctx, x1 - offset, y0 + offset, x1 - offset, y1 - offset, grainColor, 0.75);
      }

      // Crisp 45° corner miter join lines at all 4 corners
      const miterStroke = 'rgba(18, 15, 12, 0.38)';
      drawLine(ctx, x0, y0, ix0, iy0, miterStroke, 1.1);
      drawLine(ctx, x1, y0, ix1, iy0, miterStroke, 1.1);
      drawLine(ctx, x1, y1, ix1, iy1, miterStroke, 1.1);
      drawLine(ctx, x0, y1, ix0, iy1, miterStroke, 1.1);

      // Outer perimeter crisp gallery edge
      if (typeof ctx.strokeRect === 'function') {
        ctx.strokeStyle = 'rgba(16, 14, 12, 0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, panelW - 1, panelH - 1);
      }
    } else {
      // Unframed Gallery Wrap: 3D stretched canvas return edge & specular top fold
      ctx.fillStyle = params.frameSpec.primaryHex;
      if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(panelX, panelY, panelW, panelH);
      }
    }

    // =========================================================================
    // PASS 3: Recessed Float-Frame Shadow Channel (0.35" Dark Reveal Gap)
    // =========================================================================
    const innerMouldingX = panelX + mouldingPx;
    const innerMouldingY = panelY + mouldingPx;
    const innerMouldingW = Math.max(16, panelW - 2 * mouldingPx);
    const innerMouldingH = Math.max(16, panelH - 2 * mouldingPx);

    if (floatGapPx > 0) {
      ctx.fillStyle = FLOAT_CHANNEL_VOID_HEX;
      if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(innerMouldingX, innerMouldingY, innerMouldingW, innerMouldingH);
      }
      if (typeof ctx.strokeRect === 'function') {
        ctx.strokeStyle = 'rgba(222, 194, 132, 0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          innerMouldingX + floatGapPx - 0.5,
          innerMouldingY + floatGapPx - 0.5,
          Math.max(8, innerMouldingW - 2 * floatGapPx + 1),
          Math.max(8, innerMouldingH - 2 * floatGapPx + 1)
        );
      }
    }

    // =========================================================================
    // PASS 4: Archival Conservation Matboard & 45° Cream-Core Bevel Cut (#FBF9F4)
    // =========================================================================
    const matOuterX = innerMouldingX + floatGapPx;
    const matOuterY = innerMouldingY + floatGapPx;
    const matOuterW = Math.max(14, innerMouldingW - 2 * floatGapPx);
    const matOuterH = Math.max(14, innerMouldingH - 2 * floatGapPx);

    const artX = matOuterX + matPx;
    const artY = matOuterY + matPx;
    const artW = Math.max(12, matOuterW - 2 * matPx);
    const artH = Math.max(12, matOuterH - 2 * matPx);

    if (matPx > 0) {
      const matPalette =
        MAT_COLOR_HEX[params.matColorId] ?? MAT_COLOR_HEX['archival-ivory'];
      ctx.fillStyle = matPalette.surface;
      if (typeof ctx.fillRect === 'function') {
        ctx.fillRect(matOuterX, matOuterY, matOuterW, matOuterH);
      }

      // Subtle archival cotton rag matboard texture border
      if (typeof ctx.strokeRect === 'function') {
        ctx.strokeStyle = matPalette.textureTint;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          matOuterX + 1.5,
          matOuterY + 1.5,
          Math.max(4, matOuterW - 3),
          Math.max(4, matOuterH - 3)
        );
      }

      // Frame inner rabbet shadow cast onto outer perimeter of matboard
      const rabbetShadowDepth = Math.max(2, Math.min(6, Math.round(mouldingPx * 0.22)));
      ctx.fillStyle = 'rgba(18, 16, 14, 0.16)';
      if (typeof ctx.fillRect === 'function') {
        // Top rabbet shadow
        ctx.fillRect(matOuterX, matOuterY, matOuterW, rabbetShadowDepth);
        // Directional side rabbet shadow
        if (lightFromLeft) {
          ctx.fillRect(matOuterX, matOuterY, rabbetShadowDepth, matOuterH);
        } else {
          ctx.fillRect(
            matOuterX + matOuterW - rabbetShadowDepth,
            matOuterY,
            rabbetShadowDepth,
            matOuterH
          );
        }
      }

      // 45° Cream-Core Archival Bevel Cut around the inner artwork window
      const bevelPx = Math.max(2, Math.min(6, Math.round(matPx * 0.11)));
      const bx0 = artX - bevelPx;
      const by0 = artY - bevelPx;
      const bx1 = artX + artW + bevelPx;
      const by1 = artY + artH + bevelPx;
      const ax0 = artX;
      const ay0 = artY;
      const ax1 = artX + artW;
      const ay1 = artY + artH;

      // Top bevel (shadowed lip under top mat edge)
      drawPolygon(
        ctx,
        [
          [bx0, by0],
          [bx1, by0],
          [ax1, ay0],
          [ax0, ay0],
        ],
        BEVEL_CREAM_CORE_SHADOW_HEX
      );
      // Bottom bevel (catches downward room light -> bright cream core #FBF9F4)
      drawPolygon(
        ctx,
        [
          [ax0, ay1],
          [ax1, ay1],
          [bx1, by1],
          [bx0, by1],
        ],
        BEVEL_CREAM_CORE_LIT_HEX
      );
      // Left & Right bevels (lit vs shadowed by room horizontal light vector)
      drawPolygon(
        ctx,
        [
          [bx0, by0],
          [ax0, ay0],
          [ax0, ay1],
          [bx0, by1],
        ],
        lightFromLeft ? BEVEL_CREAM_CORE_SHADOW_HEX : BEVEL_CREAM_CORE_LIT_HEX
      );
      drawPolygon(
        ctx,
        [
          [ax1, ay0],
          [bx1, by0],
          [bx1, by1],
          [ax1, ay1],
        ],
        lightFromLeft ? BEVEL_CREAM_CORE_LIT_HEX : BEVEL_CREAM_CORE_SHADOW_HEX
      );

      // 45° bevel corner miter ticks
      const bevelCornerStroke = 'rgba(140, 132, 118, 0.45)';
      drawLine(ctx, bx0, by0, ax0, ay0, bevelCornerStroke, 0.8);
      drawLine(ctx, bx1, by0, ax1, ay0, bevelCornerStroke, 0.8);
      drawLine(ctx, bx1, by1, ax1, ay1, bevelCornerStroke, 0.8);
      drawLine(ctx, bx0, by1, ax0, ay1, bevelCornerStroke, 0.8);
    }

    // =========================================================================
    // PASS 5: Single / Diptych / Triptych Continuous Artwork Slicing
    // =========================================================================
    renderFallbackArtworkSlice(
      ctx,
      params.painting,
      artX,
      artY,
      artW,
      artH,
      panelIdx,
      geom.panelCount
    );

    if (offscreenArtCanvas && typeof ctx.drawImage === 'function') {
      const sx = Math.round((panelIdx / geom.panelCount) * fullArtWidthPx);
      const nextSx = Math.round(((panelIdx + 1) / geom.panelCount) * fullArtWidthPx);
      const sw = Math.max(1, nextSx - sx);
      try {
        ctx.drawImage(
          offscreenArtCanvas,
          sx,
          0,
          sw,
          fullArtHeightPx,
          artX,
          artY,
          artW,
          artH
        );
      } catch {
        // Fallback slice already rendered underneath
      }
    }

    // Subtle inner lip shadow where matboard or frame rabbet meets the artwork
    if (typeof ctx.strokeRect === 'function') {
      ctx.strokeStyle =
        mouldingPx === 0
          ? 'rgba(255, 255, 255, 0.24)'
          : 'rgba(18, 16, 14, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(artX + 0.5, artY + 0.5, artW - 1, artH - 1);
    }

    // Unframed Gallery Wrap 3D side return edge
    if (mouldingPx === 0 && typeof ctx.fillRect === 'function') {
      const wrapEdgePx = Math.max(2, Math.round(Math.min(panelW, panelH) * 0.014));
      ctx.fillStyle = params.frameSpec.secondaryHex;
      if (lightFromLeft) {
        ctx.fillRect(panelX + panelW - wrapEdgePx, panelY, wrapEdgePx, panelH);
      } else {
        ctx.fillRect(panelX, panelY, wrapEdgePx, panelH);
      }
      ctx.fillRect(panelX, panelY + panelH - wrapEdgePx, panelW, wrapEdgePx);
    }

    // =========================================================================
    // PASS 6: Room-Kelvin Ambient Tint & 4% Diagonal Museum-Glass Reflection
    // =========================================================================
    const kelvin = clamp(safeFinite(params.estimatedKelvin, 3400), 2400, 7000);
    let ambientTintFill: string | null = null;

    if (params.ambientMode === 'golden-hour') {
      ambientTintFill = 'rgba(255, 186, 108, 0.07)';
    } else if (params.ambientMode === 'evening-sconce') {
      ambientTintFill = 'rgba(28, 22, 18, 0.12)';
    } else if (kelvin < 3500) {
      ambientTintFill = 'rgba(255, 214, 165, 0.035)';
    } else if (kelvin > 4800) {
      ambientTintFill = 'rgba(214, 232, 255, 0.035)';
    }

    if (ambientTintFill && typeof ctx.fillRect === 'function') {
      ctx.fillStyle = ambientTintFill;
      ctx.fillRect(matOuterX, matOuterY, matOuterW, matOuterH);
    }

    // 4% Diagonal Museum-Glass Specular Reflection across framed/glazed area
    const glazeX = matOuterX;
    const glazeY = matOuterY;
    const glazeW = matOuterW;
    const glazeH = matOuterH;

    if (typeof ctx.createLinearGradient === 'function' && typeof ctx.fillRect === 'function') {
      const glassGrad = ctx.createLinearGradient(
        glazeX,
        glazeY,
        glazeX + glazeW,
        glazeY + glazeH
      );
      if (glassGrad && typeof glassGrad.addColorStop === 'function') {
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        glassGrad.addColorStop(0.36, 'rgba(255, 255, 255, 0.04)');
        glassGrad.addColorStop(0.48, 'rgba(255, 255, 255, 0.015)');
        glassGrad.addColorStop(0.62, 'rgba(255, 255, 255, 0.04)');
        glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = glassGrad;
        ctx.fillRect(glazeX, glazeY, glazeW, glazeH);
      }
    } else {
      // Fallback diagonal specular band polygon
      drawPolygon(
        ctx,
        [
          [glazeX + glazeW * 0.22, glazeY],
          [glazeX + glazeW * 0.46, glazeY],
          [glazeX + glazeW * 0.78, glazeY + glazeH],
          [glazeX + glazeW * 0.54, glazeY + glazeH],
        ],
        'rgba(255, 255, 255, 0.04)'
      );
    }
  }
}
