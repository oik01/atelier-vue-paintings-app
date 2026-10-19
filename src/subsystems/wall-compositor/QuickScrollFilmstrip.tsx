import React, { useEffect, useMemo, useRef } from 'react';
import {
  FRAME_PROFILES,
  FrameProfileId,
  MatWidthId,
  OrientationMode,
  PaintingSpec,
  PaintingStyleId,
  PanelLayoutMode,
  PRINT_SIZES,
  PrintSizeId,
} from '../../contracts/masterContract';
import { renderPaintingToCanvas } from '../painting-synthesis';

export interface QuickScrollFilmstripProps {
  paintings: PaintingSpec[];
  activePaintingId: string;
  sizeId: PrintSizeId;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  onSelectPainting: (id: string) => void;
  onSelectSize: (id: PrintSizeId) => void;
  onSelectOrientation: (o: OrientationMode) => void;
  onSelectPanelLayout: (l: PanelLayoutMode) => void;
  onSelectFrame: (id: FrameProfileId) => void;
  onSelectMatWidth: (m: MatWidthId) => void;
  onRegenerateBatch: () => void;
}

const PRINT_SIZE_ORDER: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];

const ORIENTATION_OPTIONS: Array<{ id: OrientationMode; label: string; ratioHint: string }> = [
  { id: 'portrait', label: 'Portrait', ratioHint: '3:4' },
  { id: 'landscape', label: 'Landscape', ratioHint: '4:3' },
  { id: 'square', label: 'Square', ratioHint: '1:1' },
];

const PANEL_LAYOUT_OPTIONS: Array<{ id: PanelLayoutMode; label: string; panels: number }> = [
  { id: 'single', label: 'Single', panels: 1 },
  { id: 'diptych', label: 'Diptych · 2', panels: 2 },
  { id: 'triptych', label: 'Triptych · 3', panels: 3 },
];

const FRAME_PROFILE_ORDER: FrameProfileId[] = [
  'unframed-canvas',
  'natural-white-oak',
  'american-black-walnut',
  'matte-gallery-black',
  'brushed-brass-float',
  'warm-travertine-ash',
];

const FRAME_SHORT_LABELS: Record<FrameProfileId, string> = {
  'unframed-canvas': 'Unframed Wrap',
  'natural-white-oak': 'White Oak',
  'american-black-walnut': 'Black Walnut',
  'matte-gallery-black': 'Matte Black',
  'brushed-brass-float': 'Brass Float',
  'warm-travertine-ash': 'Travertine Ash',
};

const MAT_WIDTH_OPTIONS: Array<{ id: MatWidthId; label: string }> = [
  { id: 'none', label: 'No Mat' },
  { id: '1.5in', label: '1.5"' },
  { id: '2.5in', label: '2.5"' },
  { id: '3.5in', label: '3.5"' },
];

const STYLE_LABELS: Record<PaintingStyleId, string> = {
  'impasto-oil': 'Impasto Oil',
  'japandi-plaster': 'Japandi Plaster',
  'rothko-colorfield': 'Color Field',
  'botanical-ink': 'Botanical Ink',
  'bauhaus-geometric': 'Bauhaus Study',
  'coastal-nocturne': 'Coastal Nocturne',
};

/**
 * Deterministic fast Mulberry32 PRNG for miniature filmstrip canvas rendering.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Module-level cache of pre-rendered offscreen ImageData / DataURL thumbnails
 * keyed by painting ID + seed + style + pigment signature so switching size,
 * frame, mat, or panel layout in Row 2 executes in <1ms with zero re-synthesis.
 */
const thumbnailImageDataCache = new Map<string, ImageData>();

function renderMiniaturePaintingToContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  painting: PaintingSpec
): void {
  const pigmentKey = (painting.pigments ?? []).map((p) => p.hex).join(',');
  const cacheKey = `${painting.id}:${painting.seed}:${painting.styleId}:${width}x${height}:${pigmentKey}`;

  const cached = thumbnailImageDataCache.get(cacheKey);
  if (cached) {
    try {
      ctx.putImageData(cached, 0, 0);
      return;
    } catch {
      // Fall through to direct draw if context rejects putImageData
    }
  }

  const rand = mulberry32((painting.seed || 101) + width * 31);
  const pigments =
    painting.pigments && painting.pigments.length > 0
      ? painting.pigments
      : [
          { hex: '#D8CFC2', rgb: [216, 207, 194] as [number, number, number], pigmentName: 'Warm Linen', opacity: 1, viscosity: 0.5 },
          { hex: '#B85D3B', rgb: [184, 93, 59] as [number, number, number], pigmentName: 'Terracotta', opacity: 0.85, viscosity: 0.8 },
          { hex: '#2E4A3E', rgb: [46, 74, 62] as [number, number, number], pigmentName: 'Forest Umber', opacity: 0.8, viscosity: 0.7 },
          { hex: '#C8A97E', rgb: [200, 169, 126] as [number, number, number], pigmentName: 'Raw Ochre', opacity: 0.75, viscosity: 0.6 },
        ];

  const c0 = pigments[0]?.hex ?? '#E5DFD3';
  const c1 = pigments[1]?.hex ?? '#B85D3B';
  const c2 = pigments[2]?.hex ?? '#4A5D52';
  const c3 = pigments[3]?.hex ?? '#C8A97E';
  const c4 = pigments[4]?.hex ?? c1;
  const c5 = pigments[5]?.hex ?? c2;

  // Base woven canvas ground
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, width, height);

  if (painting.styleId === 'rothko-colorfield') {
    const gradTop = ctx.createLinearGradient(0, 0, 0, height * 0.58);
    gradTop.addColorStop(0, c1);
    gradTop.addColorStop(1, c2);
    ctx.fillStyle = gradTop;
    ctx.fillRect(width * 0.08, height * 0.08, width * 0.84, height * 0.46);

    const gradBottom = ctx.createLinearGradient(0, height * 0.55, 0, height * 0.92);
    gradBottom.addColorStop(0, c3);
    gradBottom.addColorStop(1, c4);
    ctx.fillStyle = gradBottom;
    ctx.fillRect(width * 0.09, height * 0.58, width * 0.82, height * 0.33);
  } else if (painting.styleId === 'bauhaus-geometric') {
    ctx.fillStyle = c1;
    ctx.fillRect(width * 0.1, height * 0.12, width * 0.45, height * 0.52);

    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.arc(width * 0.62, height * 0.58, Math.min(width, height) * 0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = c3;
    ctx.fillRect(width * 0.18, height * 0.7, width * 0.65, height * 0.16);
  } else if (painting.styleId === 'japandi-plaster') {
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.55, width * 0.34, Math.PI, 0, false);
    ctx.lineTo(width * 0.84, height * 0.88);
    ctx.lineTo(width * 0.16, height * 0.88);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = c1;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const y = height * (0.2 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(width * 0.15, y);
      ctx.quadraticCurveTo(width * 0.5, y - 6 + rand() * 12, width * 0.85, y);
      ctx.stroke();
    }
  } else if (painting.styleId === 'coastal-nocturne') {
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.56);
    sky.addColorStop(0, c2);
    sky.addColorStop(1, c0);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.56);

    const sea = ctx.createLinearGradient(0, height * 0.56, 0, height);
    sea.addColorStop(0, c1);
    sea.addColorStop(1, c4);
    ctx.fillStyle = sea;
    ctx.fillRect(0, height * 0.56, width, height * 0.44);

    ctx.fillStyle = c3;
    for (let i = 0; i < 10; i++) {
      const y = height * (0.58 + i * 0.038);
      const w = width * (0.25 + rand() * 0.45);
      ctx.fillRect((width - w) * 0.5, y, w, 1.4);
    }
  } else if (painting.styleId === 'botanical-ink') {
    ctx.strokeStyle = c2;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(width * 0.28, height * 0.9);
    ctx.quadraticCurveTo(width * 0.48, height * 0.5, width * 0.68, height * 0.14);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const t = (i + 1) / 7;
      const bx = width * (0.28 + t * 0.4);
      const by = height * (0.9 - t * 0.72);
      const side = i % 2 === 0 ? 1 : -1;
      ctx.fillStyle = i % 2 === 0 ? c1 : c4;
      ctx.beginPath();
      ctx.ellipse(bx + side * 8, by - 3, 7, 3.5, side * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // impasto-oil default expressive knife strokes
    const palette = [c1, c2, c3, c4, c5];
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = palette[i % palette.length];
      const rx = rand() * width * 0.85;
      const ry = rand() * height * 0.85;
      const rw = width * (0.18 + rand() * 0.35);
      const rh = height * (0.08 + rand() * 0.18);
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  // Subtle woven linen highlight along top-left light edge
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    if (thumbnailImageDataCache.size > 64) {
      const oldestKey = thumbnailImageDataCache.keys().next().value;
      if (oldestKey) thumbnailImageDataCache.delete(oldestKey);
    }
    thumbnailImageDataCache.set(cacheKey, imgData);
  } catch {
    // Ignore getImageData errors in restricted/mock environments
  }
}

interface PaintingThumbnailCanvasProps {
  painting: PaintingSpec;
  width: number;
  height: number;
}

const PaintingThumbnailCanvas: React.FC<PaintingThumbnailCanvasProps> = React.memo(
  ({ painting, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = canvas.getContext('2d');
      } catch {
        ctx = null;
      }
      if (!ctx) return;
      renderMiniaturePaintingToContext(ctx, width, height, painting);
      try {
        renderPaintingToCanvas(canvas, painting, {
          width,
          height,
          orientation: 'portrait',
          ambientMode: 'daylight',
          highResDetail: false,
        });
      } catch {
        // Fallback already rendered by renderMiniaturePaintingToContext
      }
    }, [painting, width, height]);

    const fallbackGradient = useMemo(() => {
      const c0 = painting.pigments?.[0]?.hex ?? '#E5DFD3';
      const c1 = painting.pigments?.[1]?.hex ?? '#B85D3B';
      const c2 = painting.pigments?.[2]?.hex ?? '#2E4A3E';
      return `linear-gradient(135deg, ${c0} 0%, ${c1} 52%, ${c2} 100%)`;
    }, [painting.pigments]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        data-testid={`filmstrip-canvas-${painting.id}`}
        data-painting-id={painting.id}
        data-style-id={painting.styleId}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: fallbackGradient,
          display: 'block',
        }}
        className="rounded-[1px] shadow-inner"
      />
    );
  }
);

PaintingThumbnailCanvas.displayName = 'PaintingThumbnailCanvas';

export const QuickScrollFilmstrip: React.FC<QuickScrollFilmstripProps> = ({
  paintings,
  activePaintingId,
  sizeId,
  orientation,
  panelLayout,
  frameId,
  matWidthId,
  onSelectPainting,
  onSelectSize,
  onSelectOrientation,
  onSelectPanelLayout,
  onSelectFrame,
  onSelectMatWidth,
  onRegenerateBatch,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const activeFrameSpec = FRAME_PROFILES[frameId] ?? FRAME_PROFILES['natural-white-oak'];
  const isMatSuppressedByFrame =
    frameId === 'unframed-canvas' || activeFrameSpec.isFloatFrame;

  const thumbnailDims = useMemo(() => {
    if (orientation === 'landscape') return { width: 52, height: 39 };
    if (orientation === 'square') return { width: 44, height: 44 };
    return { width: 40, height: 52 };
  }, [orientation]);

  const handleHorizontalScroll = (direction: -1 | 1) => {
    const el = scrollContainerRef.current;
    if (el && typeof el.scrollBy === 'function') {
      el.scrollBy({ left: direction * 248, behavior: 'smooth' });
    }
    if (paintings.length > 0) {
      const currentIdx = paintings.findIndex((p) => p.id === activePaintingId);
      const nextIdx =
        currentIdx === -1
          ? 0
          : (currentIdx + direction + paintings.length) % paintings.length;
      const target = paintings[nextIdx];
      if (target && target.id !== activePaintingId) {
        onSelectPainting(target.id);
      }
    }
  };

  return (
    <section
      aria-label="Quick-Scroll Curatorial Dock"
      data-testid="quick-scroll-filmstrip"
      className="w-full max-w-full overflow-hidden bg-[#F6F4EF] border-t border-[#E2DDD3] text-[#161514] select-none"
    >
      {/* ROW 1: Synthesized Room Paintings Filmstrip */}
      <div className="px-3.5 pt-2.5 pb-2 border-b border-[#E2DDD3] bg-[#EFECE6]/70 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 max-w-full">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#5C5852] font-semibold truncate">
              Curated Room Series
            </span>
            <span className="text-[11px] font-mono tabular-nums text-[#5C5852] bg-[#F6F4EF] border border-[#E2DDD3] px-1.5 py-0.5 rounded-[3px] shrink-0">
              {paintings.length} {paintings.length === 1 ? 'Study' : 'Studies'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleHorizontalScroll(-1)}
              data-testid="filmstrip-scroll-left"
              aria-label="Scroll paintings left"
              title="Previous painting (←)"
              className="min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[30px] h-11 w-11 md:h-[30px] md:w-[30px] inline-flex items-center justify-center rounded-[4px] bg-[#FFFFFF] border border-[#E2DDD3] text-[#161514] hover:border-[#5C5852] active:scale-95 transition shrink-0"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => handleHorizontalScroll(1)}
              data-testid="filmstrip-scroll-right"
              aria-label="Scroll paintings right"
              title="Next painting (→)"
              className="min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[30px] h-11 w-11 md:h-[30px] md:w-[30px] inline-flex items-center justify-center rounded-[4px] bg-[#FFFFFF] border border-[#E2DDD3] text-[#161514] hover:border-[#5C5852] active:scale-95 transition shrink-0"
            >
              ›
            </button>

            <button
              type="button"
              onClick={onRegenerateBatch}
              data-testid="regenerate-paintings-btn"
              className="ml-1 min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[30px] h-11 md:h-[30px] px-2.5 inline-flex items-center justify-center gap-1.5 rounded-[4px] bg-[#FFFFFF] hover:bg-[#F6F4EF] border border-[#E2DDD3] hover:border-[#B85D3B] text-[11px] font-medium text-[#161514] transition shadow-[0_1px_1px_rgba(22,21,20,0.04)] shrink-0"
            >
              <span className="text-[#B85D3B] font-mono text-xs leading-none">↻</span>
              <span className="whitespace-nowrap">Synthesize New Variations</span>
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          role="listbox"
          aria-label="Synthesized room paintings"
          className="flex items-stretch gap-2.5 overflow-x-auto snap-x snap-mandatory scroll-smooth max-w-full pb-1 scrollbar-thin"
        >
          {paintings.map((painting) => {
            const isActive = painting.id === activePaintingId;
            const styleLabel = STYLE_LABELS[painting.styleId] ?? painting.styleId;
            const previewPigments = (painting.pigments ?? []).slice(0, 4);

            return (
              <button
                key={painting.id}
                type="button"
                role="option"
                aria-selected={isActive}
                data-testid={`filmstrip-painting-${painting.id}`}
                data-catalog-number={painting.catalogNumber}
                onClick={() => onSelectPainting(painting.id)}
                className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] text-left snap-start shrink-0 w-[238px] sm:w-[228px] min-h-[56px] transition-all border ${
                  isActive
                    ? 'bg-[#FFFFFF] border-[#B85D3B] ring-1 ring-[#B85D3B] shadow-[0_2px_8px_rgba(184,93,59,0.14)]'
                    : 'bg-[#FFFFFF]/90 border-[#E2DDD3] hover:bg-[#FFFFFF] hover:border-[#5C5852]/50'
                }`}
              >
                {/* Miniature framed artwork preview */}
                <div
                  className="relative shrink-0 flex items-center justify-center rounded-[2px] p-[3px] transition-colors"
                  style={{
                    backgroundColor:
                      frameId === 'unframed-canvas'
                        ? '#EFECE6'
                        : activeFrameSpec.primaryHex,
                    border:
                      frameId === 'unframed-canvas'
                        ? '1px solid #E2DDD3'
                        : `1.5px solid ${activeFrameSpec.secondaryHex}`,
                    boxShadow: '0 2px 4px rgba(22, 21, 20, 0.14)',
                  }}
                >
                  <PaintingThumbnailCanvas
                    painting={painting}
                    width={thumbnailDims.width}
                    height={thumbnailDims.height}
                  />
                </div>

                {/* Metadata & Pigment Swatch Dots */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <span className="font-mono tabular-nums text-[10px] font-semibold tracking-wider text-[#5C5852]">
                      {painting.catalogNumber}
                    </span>
                    {isActive && (
                      <span
                        data-testid="active-on-wall-badge"
                        className="px-1.5 py-[1px] rounded-[2px] bg-[#B85D3B] text-[#FFFFFF] font-mono text-[9px] font-semibold tracking-[0.08em] uppercase"
                      >
                        ON WALL
                      </span>
                    )}
                  </div>

                  <div className="text-[12px] font-medium text-[#161514] truncate leading-tight">
                    {painting.title}
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-1.5">
                    <span className="text-[10px] text-[#5C5852] truncate">
                      {styleLabel}
                    </span>

                    <div
                      className="flex items-center gap-1 shrink-0"
                      aria-label="Curated pigment stops"
                    >
                      {previewPigments.map((pigment, idx) => (
                        <span
                          key={`${painting.id}-pigment-${idx}`}
                          title={`${pigment.pigmentName} (${pigment.hex})`}
                          className="w-2.5 h-2.5 rounded-full border border-[#161514]/15"
                          style={{ backgroundColor: pigment.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ROW 2: Multi-Axis Quick Scrubber Bar (Size + Orientation + Panel Layout + Frame Moulding + Mat Width) */}
      <div className="px-3.5 py-2 bg-[#F6F4EF] flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] max-w-full overflow-hidden">
        {/* Axis 1: Physical Print Size Pills */}
        <div
          className="flex items-center gap-1.5 max-w-full min-w-0"
          role="group"
          aria-label="Physical Print Size"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5C5852] mr-0.5 shrink-0">
            Size
          </span>
          <div className="inline-flex items-center gap-0.5 bg-[#EFECE6] p-0.5 rounded-[5px] border border-[#E2DDD3] overflow-x-auto snap-x snap-mandatory max-w-full">
            {PRINT_SIZE_ORDER.map((id) => {
              const spec = PRINT_SIZES[id];
              const isSelected = sizeId === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`filmstrip-size-${id}`}
                  aria-pressed={isSelected}
                  title={`${spec.labelInches} (${spec.labelCm}) — ${spec.scaleDescription}`}
                  onClick={() => onSelectSize(id)}
                  className={`min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[32px] snap-start shrink-0 flex items-center justify-center px-2 py-1 rounded-[4px] font-mono tabular-nums text-[11px] whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#B85D3B] text-[#FFFFFF] font-semibold shadow-sm'
                      : 'text-[#161514] hover:bg-[#FFFFFF]/70'
                  }`}
                >
                  {spec.labelInches}
                </button>
              );
            })}
          </div>
        </div>

        {/* Axis 2: Orientation Pills */}
        <div
          className="flex items-center gap-1.5 max-w-full min-w-0"
          role="group"
          aria-label="Artwork Orientation"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5C5852] mr-0.5 shrink-0">
            Aspect
          </span>
          <div className="inline-flex items-center gap-0.5 bg-[#EFECE6] p-0.5 rounded-[5px] border border-[#E2DDD3] overflow-x-auto snap-x snap-mandatory max-w-full">
            {ORIENTATION_OPTIONS.map((opt) => {
              const isSelected = orientation === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`filmstrip-orientation-${opt.id}`}
                  aria-pressed={isSelected}
                  title={`${opt.label} (${opt.ratioHint})`}
                  onClick={() => onSelectOrientation(opt.id)}
                  className={`min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[32px] snap-start shrink-0 flex items-center justify-center px-2 py-1 rounded-[4px] text-[11px] whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#161514] text-[#FFFFFF] font-medium shadow-sm'
                      : 'text-[#161514] hover:bg-[#FFFFFF]/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Axis 3: Panel Split Pills (Single / Diptych / Triptych) */}
        <div
          className="flex items-center gap-1.5 max-w-full min-w-0"
          role="group"
          aria-label="Panel Split Layout"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5C5852] mr-0.5 shrink-0">
            Layout
          </span>
          <div className="inline-flex items-center gap-0.5 bg-[#EFECE6] p-0.5 rounded-[5px] border border-[#E2DDD3] overflow-x-auto snap-x snap-mandatory max-w-full">
            {PANEL_LAYOUT_OPTIONS.map((opt) => {
              const isSelected = panelLayout === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`filmstrip-layout-${opt.id}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectPanelLayout(opt.id)}
                  className={`min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[32px] snap-start shrink-0 flex items-center justify-center px-2 py-1 rounded-[4px] font-mono tabular-nums text-[11px] whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#161514] text-[#FFFFFF] font-medium shadow-sm'
                      : 'text-[#161514] hover:bg-[#FFFFFF]/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Axis 4: Frame Moulding Swatch Pills */}
        <div
          className="flex items-center gap-1.5 max-w-full min-w-0"
          role="group"
          aria-label="Frame Moulding Profile"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5C5852] mr-0.5 shrink-0">
            Frame
          </span>
          <div className="inline-flex items-center gap-1 bg-[#EFECE6] p-0.5 rounded-[5px] border border-[#E2DDD3] overflow-x-auto snap-x snap-mandatory max-w-full">
            {FRAME_PROFILE_ORDER.map((id) => {
              const spec = FRAME_PROFILES[id];
              const isSelected = frameId === id;
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`filmstrip-frame-${id}`}
                  aria-pressed={isSelected}
                  aria-label={spec.name}
                  title={`${spec.name} — ${spec.materialDescription}`}
                  onClick={() => onSelectFrame(id)}
                  className={`min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[32px] snap-start shrink-0 flex items-center justify-center gap-1.5 px-2 py-1 rounded-[4px] text-[11px] whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-[#FFFFFF] text-[#161514] font-semibold border-[#B85D3B] ring-1 ring-[#B85D3B] shadow-sm'
                      : 'bg-transparent text-[#161514] border-transparent hover:bg-[#FFFFFF]/70'
                  }`}
                >
                  {/* Realistic 2-Tone Mitered Frame Swatch Chip */}
                  <span
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-[1px] shrink-0 border border-[#161514]/20 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${spec.highlightHex} 0%, ${spec.primaryHex} 48%, ${spec.secondaryHex} 100%)`,
                    }}
                  >
                    <span className="absolute inset-[2.5px] bg-[#F6F4EF] border border-[#161514]/15" />
                  </span>
                  <span>{FRAME_SHORT_LABELS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Axis 5: Archival Mat Width Pills */}
        <div
          className="flex items-center gap-1.5 max-w-full min-w-0"
          role="group"
          aria-label="Archival Mat Width"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5C5852] mr-0.5 shrink-0">
            Mat
          </span>
          <div className="inline-flex items-center gap-0.5 bg-[#EFECE6] p-0.5 rounded-[5px] border border-[#E2DDD3] overflow-x-auto snap-x snap-mandatory max-w-full">
            {MAT_WIDTH_OPTIONS.map((opt) => {
              const isSelected = matWidthId === opt.id;
              const isSubtleDisabledHint = isMatSuppressedByFrame && opt.id !== 'none';
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`filmstrip-mat-${opt.id}`}
                  aria-pressed={isSelected}
                  title={
                    isSubtleDisabledHint
                      ? `${activeFrameSpec.name} mounts without a paper matboard`
                      : `Archival conservation matboard (${opt.label})`
                  }
                  onClick={() => onSelectMatWidth(opt.id)}
                  className={`min-h-[44px] min-w-[44px] md:min-h-[30px] md:min-w-[32px] snap-start shrink-0 flex items-center justify-center px-2 py-1 rounded-[4px] font-mono tabular-nums text-[11px] whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#B85D3B] text-[#FFFFFF] font-semibold shadow-sm'
                      : isSubtleDisabledHint
                        ? 'text-[#5C5852]/65 hover:bg-[#FFFFFF]/50'
                        : 'text-[#161514] hover:bg-[#FFFFFF]/70'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {isMatSuppressedByFrame && (
            <span
              data-testid="mat-suppressed-hint"
              className="text-[10px] font-mono text-[#5C5852] italic shrink-0"
            >
              (0″ on {frameId === 'unframed-canvas' ? 'Gallery Wrap' : 'Float Frame'})
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

