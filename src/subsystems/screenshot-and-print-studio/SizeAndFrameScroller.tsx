import React, { useEffect, useMemo, useState } from 'react';
import {
  FrameProfileId,
  FRAME_PROFILES,
  GeneratedArtPiece,
  MatColorId,
  MatWidthId,
  PrintSizeId,
  PRINT_SIZES,
  ReimaginedRoomVariation,
  ScaleCalibrationResult,
} from '../../contracts/masterContract';
import {
  buildHighResPrintMasterFile,
  computeSideBySideFidelityMetrics,
  HighResPrintMasterFileResult,
} from './identicalPrintUpscaler';

export interface SizeAndFrameScrollerProps {
  variation?: ReimaginedRoomVariation;
  identicalPrintDataUrl?: string;
  croppedScreenshotDataUrl?: string;
  artworkTitle?: string;
  activeArtPieceIndex?: number;
  selectedSizeId: PrintSizeId;
  selectedFrameId: FrameProfileId;
  selectedMatWidthId?: MatWidthId;
  selectedMatColorId?: MatColorId;
  includeBleed?: boolean;
  isDownloadingPrint?: boolean;
  estimatedRetailPriceUsd?: number;
  scaleRecommendation?: ScaleCalibrationResult | null;
  onOpenCaliperSizingTool?: () => void;
  onSelectArtPiece?: (index: number, piece: GeneratedArtPiece) => void;
  onSelectSize: (sizeId: PrintSizeId) => void;
  onSelectFrame: (frameId: FrameProfileId) => void;
  onSelectMatWidth?: (matWidthId: MatWidthId) => void;
  onSelectMatColor?: (matColorId: MatColorId) => void;
  onToggleBleed?: (includeBleed: boolean) => void;
  onDirectDownloadPrint?: (result: HighResPrintMasterFileResult) => void | Promise<void>;
  onOpenPrintOrderModal?: () => void;
  // Convenient optional aliases for root integration compatibility
  onDownloadPrint?: (result: HighResPrintMasterFileResult) => void | Promise<void>;
  onOrderPrintedVersion?: () => void;
}

const ORDERED_SIZE_IDS: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];

const ORDERED_FRAME_IDS: FrameProfileId[] = [
  'unframed-canvas',
  'natural-white-oak',
  'american-black-walnut',
  'matte-gallery-black',
  'brushed-brass-float',
  'warm-travertine-ash',
];

const MAT_WIDTH_OPTIONS: Array<{
  id: MatWidthId;
  label: string;
  inchesNumber: number;
  paddingPx: number;
  description: string;
}> = [
  {
    id: 'none',
    label: 'No Mat',
    inchesNumber: 0,
    paddingPx: 0,
    description: 'Full-bleed artwork to frame edge',
  },
  {
    id: '1.5in',
    label: '1.5" Gallery Mat',
    inchesNumber: 1.5,
    paddingPx: 14,
    description: 'Subtle archival conservation border',
  },
  {
    id: '2.5in',
    label: '2.5" Museum Mat',
    inchesNumber: 2.5,
    paddingPx: 22,
    description: 'Classic exhibition proportion',
  },
  {
    id: '3.5in',
    label: '3.5" Salon Mat',
    inchesNumber: 3.5,
    paddingPx: 30,
    description: 'Generous collector surround',
  },
];

const MAT_COLOR_OPTIONS: Array<{
  id: MatColorId;
  label: string;
  hex: string;
  bevelHex: string;
}> = [
  {
    id: 'archival-ivory',
    label: 'Archival Ivory',
    hex: '#FAF6EE',
    bevelHex: '#DFD7C8',
  },
  {
    id: 'warm-museum-linen',
    label: 'Warm Museum Linen',
    hex: '#F5F0E6',
    bevelHex: '#D5CBB8',
  },
  {
    id: 'charcoal-conservation',
    label: 'Charcoal Conservation',
    hex: '#1F1C18',
    bevelHex: '#4A3B32',
  },
];

const FALLBACK_PRINT_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <rect width="900" height="1200" fill="#F5F0E6"/>
      <rect x="70" y="90" width="760" height="1020" fill="#EAE2D3"/>
      <circle cx="450" cy="520" r="240" fill="#9E5A3C" opacity="0.82"/>
      <path d="M 140 890 Q 450 670 760 890 L 760 1050 L 140 1050 Z" fill="#4A3B32" opacity="0.85"/>
    </svg>`
  );

function sanitizeDisplayCopy(text?: string, fallback = ''): string {
  if (!text) return fallback;
  const cleaned = text
    .replace(
      /astra|gemini\s*argon|gemini\s*4|gpt-6|nano\s*banana|openrouter|openai\/[^\s,)]+|google\/[^\s,)]+/gi,
      'Atelier Vue'
    )
    .replace(/2nd-prompt/gi, 'Atelier')
    .replace(/bounding\s*box/gi, 'wall placement')
    .replace(/\bbbox\b/gi, 'placement')
    .replace(/crop\s*box/gi, 'frame')
    .replace(/cropped\s*screenshot/gi, 'bespoke edition')
    .replace(/screenshot/gi, 'edition')
    .replace(/\bcrop(ped|ping|s)?\b/gi, 'edition')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export const SizeAndFrameScroller: React.FC<SizeAndFrameScrollerProps> = ({
  variation,
  identicalPrintDataUrl,
  artworkTitle,
  activeArtPieceIndex,
  selectedSizeId,
  selectedFrameId,
  selectedMatWidthId,
  selectedMatColorId,
  includeBleed,
  isDownloadingPrint = false,
  estimatedRetailPriceUsd,
  scaleRecommendation,
  onOpenCaliperSizingTool,
  onSelectArtPiece,
  onSelectSize,
  onSelectFrame,
  onSelectMatWidth,
  onSelectMatColor,
  onToggleBleed,
  onDirectDownloadPrint,
  onOpenPrintOrderModal,
  onDownloadPrint,
  onOrderPrintedVersion,
}) => {
  const [internalArtPieceIndex, setInternalArtPieceIndex] = useState<number>(
    activeArtPieceIndex ?? variation?.activeArtPieceIndex ?? 0
  );
  const [internalMatWidthId, setInternalMatWidthId] = useState<MatWidthId>(
    variation?.detectedMatWidthId ?? '1.5in'
  );
  const [internalMatColorId, setInternalMatColorId] = useState<MatColorId>(
    variation?.detectedMatColorId ?? 'archival-ivory'
  );
  const [internalIncludeBleed, setInternalIncludeBleed] = useState<boolean>(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState<boolean>(false);
  const [lastDownloadedResult, setLastDownloadedResult] =
    useState<HighResPrintMasterFileResult | null>(null);

  useEffect(() => {
    if (typeof activeArtPieceIndex === 'number') {
      setInternalArtPieceIndex(activeArtPieceIndex);
    } else if (typeof variation?.activeArtPieceIndex === 'number') {
      setInternalArtPieceIndex(variation.activeArtPieceIndex);
    }
  }, [activeArtPieceIndex, variation?.activeArtPieceIndex, variation?.id]);

  const effectiveScaleRecommendation: ScaleCalibrationResult | null =
    scaleRecommendation !== undefined
      ? scaleRecommendation
      : variation?.scaleRecommendation ?? null;

  // Derive multi-piece array (or fallback single piece from variation)
  const artPieces: GeneratedArtPiece[] = useMemo(() => {
    if (variation?.artPieces && variation.artPieces.length > 0) {
      return variation.artPieces.map((piece, idx) => ({
        ...piece,
        title: sanitizeDisplayCopy(
          piece.title,
          `Atelier Vue Bespoke Edition ${idx + 1}`
        ),
        wallLocationLabel: sanitizeDisplayCopy(
          piece.wallLocationLabel,
          idx === 0 ? 'Primary Focal Wall' : `Wall Position ${idx + 1}`
        ),
        description: sanitizeDisplayCopy(
          piece.description,
          'Bespoke 300-DPI archival edition harmonized to your space.'
        ),
      }));
    }
    const defaultPiece: GeneratedArtPiece = {
      id: variation?.id ? `${variation.id}-piece-1` : 'atelier-piece-1',
      index: 0,
      title: sanitizeDisplayCopy(
        artworkTitle || variation?.artworkTitle,
        'Atelier Vue Bespoke Edition'
      ),
      wallLocationLabel: 'Primary Focal Wall',
      description: sanitizeDisplayCopy(
        variation?.artworkDescription || variation?.roomStyleSummary,
        'Bespoke 300-DPI archival edition harmonized to your room palette and lighting.'
      ),
      identicalPrintMasterDataUrl:
        identicalPrintDataUrl ||
        variation?.identicalPrintMasterDataUrl ||
        FALLBACK_PRINT_SVG,
      printMasterWidthPx: variation?.printMasterWidthPx || 2400,
      printMasterHeightPx: variation?.printMasterHeightPx || 3600,
    };
    return [defaultPiece];
  }, [
    variation?.artPieces,
    variation?.id,
    variation?.artworkTitle,
    variation?.artworkDescription,
    variation?.roomStyleSummary,
    variation?.identicalPrintMasterDataUrl,
    variation?.printMasterWidthPx,
    variation?.printMasterHeightPx,
    artworkTitle,
    identicalPrintDataUrl,
  ]);

  const rawSelectedPieceIndex =
    typeof activeArtPieceIndex === 'number'
      ? activeArtPieceIndex
      : internalArtPieceIndex;

  const clampedPieceIndex = Math.max(
    0,
    Math.min(artPieces.length - 1, rawSelectedPieceIndex)
  );
  const selectedPiece = artPieces[clampedPieceIndex] ?? artPieces[0];

  const activeSizeId: PrintSizeId =
    selectedSizeId && PRINT_SIZES[selectedSizeId] ? selectedSizeId : '24x36';
  const activeFrameId: FrameProfileId =
    selectedFrameId && FRAME_PROFILES[selectedFrameId]
      ? selectedFrameId
      : 'natural-white-oak';
  const activeMatWidthId: MatWidthId = selectedMatWidthId ?? internalMatWidthId;
  const activeMatColorId: MatColorId = selectedMatColorId ?? internalMatColorId;
  const activeIncludeBleed: boolean =
    includeBleed !== undefined ? includeBleed : internalIncludeBleed;

  const sizeSpec = PRINT_SIZES[activeSizeId];
  const frameSpec = FRAME_PROFILES[activeFrameId];
  const matWidthSpec =
    MAT_WIDTH_OPTIONS.find((m) => m.id === activeMatWidthId) ?? MAT_WIDTH_OPTIONS[0];
  const matColorSpec =
    MAT_COLOR_OPTIONS.find((c) => c.id === activeMatColorId) ?? MAT_COLOR_OPTIONS[0];

  const hasMultiplePieces = artPieces.length > 1;

  // Use the selected art piece's print master when multiple pieces exist, or explicit prop override
  const activePrintUrl =
    (hasMultiplePieces
      ? selectedPiece?.identicalPrintMasterDataUrl
      : identicalPrintDataUrl || selectedPiece?.identicalPrintMasterDataUrl) ||
    variation?.identicalPrintMasterDataUrl ||
    FALLBACK_PRINT_SVG;

  const activeTitle = sanitizeDisplayCopy(
    hasMultiplePieces
      ? selectedPiece?.title
      : artworkTitle || selectedPiece?.title || variation?.artworkTitle,
    'Atelier Vue Bespoke Edition'
  );

  const activeWallLocationLabel = sanitizeDisplayCopy(
    selectedPiece?.wallLocationLabel,
    'Primary Focal Wall'
  );

  const activeDescription = sanitizeDisplayCopy(
    selectedPiece?.description || variation?.artworkDescription,
    'Perspective-balanced, lighting-neutral 300-DPI archival edition ready for museum framing.'
  );

  const fidelityMetrics = useMemo(
    () => computeSideBySideFidelityMetrics(activeSizeId, activeIncludeBleed),
    [activeSizeId, activeIncludeBleed]
  );

  // Relative scale factor so larger physical sizes visibly scale the preview frame smoothly
  const previewScaleRatio = useMemo(() => {
    switch (activeSizeId) {
      case '12x16':
        return 0.78;
      case '18x24':
        return 0.85;
      case '24x36':
        return 0.92;
      case '30x40':
        return 0.96;
      case '36x48':
      default:
        return 1.0;
    }
  }, [activeSizeId]);

  const mouldingBorderPx = useMemo(() => {
    if (activeFrameId === 'unframed-canvas' || frameSpec.mouldingWidthInches <= 0) {
      return 0;
    }
    return Math.max(8, Math.round(frameSpec.mouldingWidthInches * 11));
  }, [activeFrameId, frameSpec.mouldingWidthInches]);

  const effectiveMatPaddingPx = useMemo(() => {
    if (activeMatWidthId === 'none') return 0;
    return matWidthSpec.paddingPx;
  }, [activeMatWidthId, matWidthSpec.paddingPx]);

  const handleSelectPiece = (idx: number, piece: GeneratedArtPiece) => {
    setInternalArtPieceIndex(idx);
    onSelectArtPiece?.(idx, piece);
  };

  const handleSelectMatWidth = (matWidthId: MatWidthId) => {
    setInternalMatWidthId(matWidthId);
    onSelectMatWidth?.(matWidthId);
  };

  const handleSelectMatColor = (matColorId: MatColorId) => {
    setInternalMatColorId(matColorId);
    onSelectMatColor?.(matColorId);
  };

  const handleToggleBleedChange = (nextBleed: boolean) => {
    setInternalIncludeBleed(nextBleed);
    onToggleBleed?.(nextBleed);
  };

  const handleDirectDownload = async () => {
    if (isGeneratingDownload || isDownloadingPrint) return;
    setIsGeneratingDownload(true);
    try {
      const result = await buildHighResPrintMasterFile({
        identicalPrintDataUrl: activePrintUrl,
        sizeId: activeSizeId,
        includeBleed: activeIncludeBleed,
        title: activeTitle,
      });
      setLastDownloadedResult(result);
      await onDirectDownloadPrint?.(result);
      await onDownloadPrint?.(result);
    } finally {
      setIsGeneratingDownload(false);
    }
  };

  const handleOpenOrderModal = () => {
    onOpenPrintOrderModal?.();
    onOrderPrintedVersion?.();
  };

  const isScaleCalibrated = Boolean(effectiveScaleRecommendation?.isCalibrated);
  const recommendedSizeId = effectiveScaleRecommendation?.recommendedSizeId;
  const recommendedDimensionsLabel =
    effectiveScaleRecommendation?.recommendedDimensionsLabel ||
    (recommendedSizeId && PRINT_SIZES[recommendedSizeId]
      ? PRINT_SIZES[recommendedSizeId].labelInches
      : '24" × 36"');
  const recommendedRationale = sanitizeDisplayCopy(
    effectiveScaleRecommendation?.rationale,
    'Scaled from your room measurements so the physical print matches the exact proportion shown on your wall.'
  );

  return (
    <section
      data-testid="size-and-frame-scroller"
      className="flex flex-col rounded-2xl border border-[#DFD7C8] bg-[#FAF6EE] shadow-sm overflow-hidden"
    >
      {/* Header Bar — Option 5 Wabi-Sabi Tactile Canvas Palette & Zero AI Model Announcements ([SPEC PATCH #21] & [#23]) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFD7C8] bg-[#F5F0E6]/85 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center rounded-full bg-[#9E5A3C] px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#FAF6EE]">
            Framing Studio
          </span>
          <div>
            <h3 className="font-serif text-lg leading-tight text-[#1F1C18] sm:text-xl">
              {activeTitle}
            </h3>
            <p className="text-xs text-[#655B50]">
              {activeWallLocationLabel} · {activeDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 font-mono text-[11px] font-medium text-[#4A3B32]">
            Atelier Vue Bespoke Commission
          </span>
          <span className="inline-flex items-center rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 font-mono text-[11px] font-medium text-[#9E5A3C]">
            Original Atelier Edition · 300-DPI Print Master
          </span>
        </div>
      </div>

      {/* Multi-Art-Piece Selector Bar ([SPEC PATCH #19]) */}
      {hasMultiplePieces && (
        <div
          data-testid="framing-art-piece-selector"
          className="border-b border-[#DFD7C8] bg-[#F5F0E6]/60 px-4 py-3 sm:px-5"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#1F1C18]">
              Select Bespoke Art Piece to Frame &amp; Acquire ({artPieces.length} Pieces in Space)
            </span>
            <span className="font-mono text-[11px] text-[#655B50]">
              Viewing Piece {clampedPieceIndex + 1} of {artPieces.length}
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto snap-x pb-1">
            {artPieces.map((piece, idx) => {
              const isSelected = idx === clampedPieceIndex;
              const pieceTitle = sanitizeDisplayCopy(
                piece.title,
                `Bespoke Piece ${idx + 1}`
              );
              const pieceWall = sanitizeDisplayCopy(
                piece.wallLocationLabel,
                `Wall Position ${idx + 1}`
              );
              return (
                <button
                  key={piece.id || `piece-${idx}`}
                  type="button"
                  data-testid={`framing-art-piece-pill-${idx}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectPiece(idx, piece)}
                  className={`flex min-h-[44px] min-w-[200px] snap-start shrink-0 items-center gap-3 rounded-xl border p-2 text-left transition-all ${
                    isSelected
                      ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE] shadow-xs'
                      : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] hover:border-[#9E5A3C]/50'
                  }`}
                >
                  <img
                    src={piece.identicalPrintMasterDataUrl || FALLBACK_PRINT_SVG}
                    alt={pieceTitle}
                    className="h-10 w-8 shrink-0 rounded object-cover border border-black/15"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono text-[10px] font-semibold uppercase ${
                          isSelected ? 'text-[#DFD7C8]' : 'text-[#9E5A3C]'
                        }`}
                      >
                        Piece {idx + 1}
                      </span>
                      <span
                        className={`truncate text-[10px] ${
                          isSelected ? 'text-[#FAF6EE]/75' : 'text-[#655B50]'
                        }`}
                      >
                        · {pieceWall}
                      </span>
                    </div>
                    <p className="truncate text-xs font-semibold">{pieceTitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Framed Print Master Stage */}
      <div
        data-testid="print-master-stage"
        className="relative flex flex-col items-center justify-center bg-gradient-to-b from-[#F5F0E6] via-[#EFE9DC] to-[#E8E0D0] px-4 py-6 sm:px-6 sm:py-8"
      >
        <div className="flex w-full max-w-4xl flex-col items-center justify-center">
          {/* Outer Museum Frame Moulding */}
          <div
            data-testid="framed-print-preview"
            data-frame-id={activeFrameId}
            data-size-id={activeSizeId}
            data-mat-width={activeMatWidthId}
            data-piece-index={clampedPieceIndex}
            style={{
              transform: `scale(${previewScaleRatio})`,
              transformOrigin: 'center center',
              borderWidth: `${mouldingBorderPx}px`,
              borderStyle: mouldingBorderPx > 0 ? 'solid' : 'none',
              borderColor: frameSpec.primaryHex,
              backgroundColor: frameSpec.isFloatFrame
                ? '#1F1C18'
                : effectiveMatPaddingPx > 0
                ? matColorSpec.hex
                : frameSpec.highlightHex,
              padding: frameSpec.isFloatFrame ? '7px' : '0px',
              boxShadow:
                activeFrameId === 'unframed-canvas'
                  ? '0 18px 38px rgba(31, 28, 24, 0.20), 4px 6px 0px #DFD7C8'
                  : `0 22px 46px rgba(31, 28, 24, 0.26), inset 0 0 0 2px ${frameSpec.secondaryHex}, inset 0 0 0 3px ${frameSpec.highlightHex}`,
            }}
            className="relative transition-all duration-300 ease-out"
          >
            {/* Conservation Matboard Layer */}
            <div
              style={{
                padding: `${effectiveMatPaddingPx}px`,
                backgroundColor:
                  effectiveMatPaddingPx > 0 ? matColorSpec.hex : 'transparent',
              }}
              className="relative transition-all duration-200"
            >
              {/* Matboard 45-deg Conservation Bevel */}
              <div
                style={{
                  boxShadow:
                    effectiveMatPaddingPx > 0
                      ? `inset 0 1px 4px rgba(31,28,24,0.22), 0 0 0 2px ${matColorSpec.bevelHex}`
                      : frameSpec.isFloatFrame
                      ? '0 0 0 1px rgba(0,0,0,0.65)'
                      : 'none',
                }}
                className="relative overflow-hidden bg-[#FAF6EE]"
              >
                {/* Optional +0.25" Bleed & Trim Guides Overlay */}
                {activeIncludeBleed && (
                  <div
                    data-testid="print-bleed-trim-guides"
                    className="pointer-events-none absolute inset-1.5 z-10 border border-dashed border-[#1F1C18]/45"
                  >
                    <span className="absolute right-1.5 top-1.5 rounded bg-[#1F1C18]/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#FAF6EE]">
                      +0.25&quot; Bleed
                    </span>
                  </div>
                )}

                <img
                  data-testid="identical-print-preview-img"
                  src={activePrintUrl}
                  alt={`${activeTitle} — ${sizeSpec.labelInches} in ${frameSpec.name}`}
                  className="block h-56 w-44 object-cover sm:h-64 sm:w-52"
                />
              </div>
            </div>
          </div>

          {/* Live Spec Caption Pill Under Frame */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 font-mono text-xs font-medium text-[#1F1C18] shadow-2xs">
              {sizeSpec.labelInches} ({sizeSpec.labelCm}) · {fidelityMetrics.widthPx}×
              {fidelityMetrics.heightPx} px @ {fidelityMetrics.dpi} DPI
            </span>
            <span className="rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 text-xs text-[#655B50] shadow-2xs">
              {frameSpec.name}
              {activeMatWidthId !== 'none'
                ? ` · ${matWidthSpec.label} (${matColorSpec.label})`
                : ' · Full-Bleed No Mat'}
            </span>
            {(selectedPiece?.detectedFrameId || variation?.detectedFrameId) && (
              <span
                data-testid="ai-matched-frame-mat-badge"
                className="rounded-full border border-[#9E5A3C]/45 bg-[#9E5A3C]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[#9E5A3C] shadow-2xs"
              >
                ★ Default Frame &amp; Mat Matched to Rendered Room Image
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Selectors Body */}
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        {/* V2.4 Recommended Size & Post-Visualization Caliper Sizing Banner ([SPEC PATCH #28]) */}
        {isScaleCalibrated && effectiveScaleRecommendation && (
          <div
            data-testid="scale-recommendation-banner"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#9E5A3C]/45 bg-[#F5F0E6] px-4 py-3.5 text-[#1F1C18]"
          >
            <div data-testid="recommended-size-callout-banner" className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#9E5A3C] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#FAF6EE]">
                  ★ Scale Calibrated via Calipers
                </span>
                <p className="font-serif text-sm sm:text-base font-semibold text-[#1F1C18]">
                  Recommended Size for Your Space: {recommendedDimensionsLabel}
                </p>
                {effectiveScaleRecommendation.calculatedOuterFrameWidthInches && (
                  <span className="rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-2.5 py-0.5 font-mono text-[10px] font-medium text-[#4A3B32]">
                    Photo Frame: {effectiveScaleRecommendation.calculatedOuterFrameWidthInches}&quot; ×{' '}
                    {effectiveScaleRecommendation.calculatedOuterFrameHeightInches}&quot; · Picture:{' '}
                    {effectiveScaleRecommendation.calculatedInnerPictureWidthInches}&quot; ×{' '}
                    {effectiveScaleRecommendation.calculatedInnerPictureHeightInches}&quot;
                  </span>
                )}
              </div>
              <p className="text-xs text-[#4A3B32] leading-relaxed">
                {recommendedRationale}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {recommendedSizeId && activeSizeId !== recommendedSizeId ? (
                <button
                  type="button"
                  data-testid="apply-recommended-size-btn"
                  onClick={() => onSelectSize(recommendedSizeId)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#9E5A3C] px-3.5 py-2 text-xs font-semibold text-[#FAF6EE] shadow-2xs transition-all hover:bg-[#874B30]"
                >
                  Select Recommended Size ({recommendedDimensionsLabel})
                </button>
              ) : (
                <span className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#9E5A3C]/35 bg-[#FAF6EE] px-3 py-1.5 font-mono text-[11px] font-medium text-[#9E5A3C]">
                  ✓ Active Size Matches Your Room Measurements
                </span>
              )}
            </div>
          </div>
        )}

        {/* 1. Physical Print Size Scroller */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
              1. Select Archival Print Size ({sizeSpec.scaleDescription})
            </label>
            <span className="font-mono text-[11px] text-[#655B50]">
              Scroll horizontally · 300 DPI Master
            </span>
          </div>

          <div
            data-testid="size-scroller"
            className="flex gap-2.5 overflow-x-auto snap-x pb-1.5"
          >
            {ORDERED_SIZE_IDS.map((sizeId) => {
              const spec = PRINT_SIZES[sizeId];
              const isSelected = activeSizeId === sizeId;
              const isRecommended =
                isScaleCalibrated && recommendedSizeId === sizeId;

              return (
                <button
                  key={sizeId}
                  type="button"
                  data-testid={`size-option-${sizeId}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectSize(sizeId)}
                  className={`flex min-h-[44px] min-w-[156px] snap-start shrink-0 flex-col items-start justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE] shadow-xs'
                      : isRecommended
                      ? 'border-[#9E5A3C] bg-[#F5F0E6] text-[#1F1C18] ring-1 ring-[#9E5A3C]/40 hover:bg-[#EFE9DC]'
                      : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50 hover:bg-[#F5F0E6]'
                  }`}
                >
                  <div
                    data-testid={`size-pill-${sizeId}`}
                    className="flex w-full flex-col items-start"
                  >
                    {isRecommended && (
                      <span
                        data-testid="recommended-size-badge"
                        className={`mb-1 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                            : 'bg-[#9E5A3C]/15 text-[#9E5A3C]'
                        }`}
                      >
                        <span data-testid={`recommended-size-badge-${sizeId}`}>
                          ★ Recommended
                        </span>
                      </span>
                    )}

                    <div className="flex w-full items-baseline justify-between gap-2">
                      <span className="font-serif text-base font-medium">
                        {spec.labelInches}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          isSelected ? 'text-[#FAF6EE]/80' : 'text-[#655B50]'
                        }`}
                      >
                        {spec.labelCm}
                      </span>
                    </div>
                    <span
                      className={`mt-1 text-[11px] font-medium ${
                        isSelected ? 'text-[#DFD7C8]' : 'text-[#655B50]'
                      }`}
                    >
                      {spec.scaleDescription}
                    </span>
                    <span
                      className={`mt-0.5 font-mono text-[10px] ${
                        isSelected ? 'text-[#FAF6EE]/75' : 'text-[#655B50]/85'
                      }`}
                    >
                      {spec.printMasterWidthPx}×{spec.printMasterHeightPx} px
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Museum Frame Moulding Scroller */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
              2. Select Museum Frame Moulding
            </label>
            <span className="text-xs text-[#655B50]">{frameSpec.name}</span>
          </div>

          <div
            data-testid="frame-scroller"
            className="flex gap-2.5 overflow-x-auto snap-x pb-1.5"
          >
            {ORDERED_FRAME_IDS.map((frameId) => {
              const spec = FRAME_PROFILES[frameId];
              const isSelected = activeFrameId === frameId;
              const detectedFrameForPiece =
                selectedPiece?.detectedFrameId ?? variation?.detectedFrameId;
              const isAiMatchedFrame = detectedFrameForPiece === frameId;

              return (
                <button
                  key={frameId}
                  type="button"
                  data-testid={`frame-option-${frameId}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectFrame(frameId)}
                  className={`flex min-h-[44px] min-w-[185px] max-w-[215px] snap-start shrink-0 flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE] shadow-xs'
                      : isAiMatchedFrame
                      ? 'border-[#9E5A3C] bg-[#F5F0E6] text-[#1F1C18] ring-1 ring-[#9E5A3C]/35 hover:bg-[#EFE9DC]'
                      : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50 hover:bg-[#F5F0E6]'
                  }`}
                >
                  <div>
                    {isAiMatchedFrame && (
                      <span
                        data-testid={`ai-matched-frame-pill-${frameId}`}
                        className={`mb-1.5 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                            : 'bg-[#9E5A3C]/15 text-[#9E5A3C]'
                        }`}
                      >
                        ★ Rendered Match
                      </span>
                    )}
                    <div className="flex items-center gap-2.5">
                      {/* Tactile Wood/Metal Moulding Swatch Chip */}
                      <span
                        style={{
                          background: `linear-gradient(135deg, ${spec.highlightHex} 0%, ${spec.primaryHex} 55%, ${spec.secondaryHex} 100%)`,
                        }}
                        className="h-5 w-5 shrink-0 rounded-full border border-black/20 shadow-inner"
                      />
                      <span className="text-xs font-semibold leading-snug">
                        {spec.name}
                      </span>
                    </div>
                  </div>
                  <p
                    className={`mt-1.5 line-clamp-2 text-[11px] leading-relaxed ${
                      isSelected ? 'text-[#FAF6EE]/80' : 'text-[#655B50]'
                    }`}
                  >
                    {spec.materialDescription}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Conservation Matboard Scroller & Mat Color + Bleed Options */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-2 flex items-center justify-between">
              <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
                3. Conservation Matboard Width
              </label>
              <span className="font-mono text-[11px] text-[#655B50]">
                8-Ply Acid-Free Cotton Rag
              </span>
            </div>

            <div
              data-testid="mat-scroller"
              className="flex gap-2 overflow-x-auto snap-x pb-1"
            >
              {MAT_WIDTH_OPTIONS.map((mat) => {
                const isSelected = activeMatWidthId === mat.id;
                const detectedMatForPiece =
                  selectedPiece?.detectedMatWidthId ?? variation?.detectedMatWidthId;
                const isAiMatchedMat = detectedMatForPiece === mat.id;

                return (
                  <button
                    key={mat.id}
                    type="button"
                    data-testid={`mat-option-${mat.id}`}
                    aria-pressed={isSelected}
                    onClick={() => handleSelectMatWidth(mat.id)}
                    className={`flex min-h-[44px] min-w-[122px] snap-start shrink-0 flex-col justify-center rounded-xl border px-3 py-2 text-left transition-all ${
                      isSelected
                        ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE]'
                        : isAiMatchedMat
                        ? 'border-[#9E5A3C] bg-[#F5F0E6] text-[#1F1C18] ring-1 ring-[#9E5A3C]/35'
                        : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50'
                    }`}
                  >
                    {isAiMatchedMat && (
                      <span
                        data-testid={`ai-matched-mat-pill-${mat.id}`}
                        className={`mb-1 inline-flex self-start items-center rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                            : 'bg-[#9E5A3C]/15 text-[#9E5A3C]'
                        }`}
                      >
                        ★ Rendered Match
                      </span>
                    )}
                    <span className="text-xs font-semibold">{mat.label}</span>
                    <span
                      className={`text-[10px] ${
                        isSelected ? 'text-[#FAF6EE]/75' : 'text-[#655B50]'
                      }`}
                    >
                      {mat.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mat Color & Print Bleed Toggle */}
          <div className="flex flex-col justify-between gap-2.5 lg:col-span-5">
            <div>
              <span className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#1F1C18]">
                Mat Tone &amp; Pre-Press Bleed
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {MAT_COLOR_OPTIONS.map((color) => {
                  const isSelected = activeMatColorId === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      data-testid={`mat-color-${color.id}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectMatColor(color.id)}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-all ${
                        isSelected
                          ? 'border-[#1F1C18] bg-[#1F1C18] font-medium text-[#FAF6EE]'
                          : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] hover:border-[#9E5A3C]/50'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: color.hex }}
                        className="h-3.5 w-3.5 rounded-full border border-black/25"
                      />
                      <span>{color.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/80 px-3 py-2 text-xs text-[#1F1C18] hover:border-[#9E5A3C]/50">
              <input
                type="checkbox"
                data-testid="toggle-print-bleed-checkbox"
                checked={activeIncludeBleed}
                onChange={(e) => handleToggleBleedChange(e.target.checked)}
                className="h-4 w-4 rounded border-[#655B50] accent-[#9E5A3C]"
              />
              <span className="font-medium">
                Include +0.25&quot; Archival Print Bleed &amp; Trim Guides
              </span>
            </label>
          </div>
        </div>

        {/* Download Confirmation Badge (when triggered) */}
        {lastDownloadedResult && (
          <div
            data-testid="download-confirmation-badge"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#9E5A3C]/35 bg-[#9E5A3C]/10 px-4 py-2.5 text-xs text-[#1F1C18]"
          >
            <span className="font-medium">
              Prepared 300-DPI Print Master: <strong className="font-mono">{lastDownloadedResult.filename}</strong>
            </span>
            <span className="font-mono text-[11px] text-[#4A3B32]">
              {lastDownloadedResult.widthPx}×{lastDownloadedResult.heightPx} px · {lastDownloadedResult.dpi} DPI
              {lastDownloadedResult.includedBleed ? ' · +0.25" Bleed' : ''}
            </span>
          </div>
        )}

        {/* Primary Action CTAs: Direct 300-DPI PNG Download or Order Printed & Framed */}
        <div className="grid grid-cols-1 gap-3 border-t border-[#DFD7C8] pt-4 sm:grid-cols-2">
          <button
            type="button"
            data-testid="direct-download-print-btn"
            disabled={isGeneratingDownload || isDownloadingPrint}
            onClick={handleDirectDownload}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#1F1C18] bg-[#FAF6EE] px-4 py-3 text-sm font-semibold text-[#1F1C18] transition-all hover:bg-[#F5F0E6] disabled:opacity-60"
          >
            <span>
              {isGeneratingDownload || isDownloadingPrint
                ? 'Preparing 300-DPI Print Master…'
                : `Download High-Res Print File (300 DPI PNG)`}
            </span>
          </button>

          <button
            type="button"
            data-testid="open-print-order-modal-btn"
            onClick={handleOpenOrderModal}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#9E5A3C] px-5 py-3 text-sm font-semibold text-[#FAF6EE] shadow-xs transition-all hover:bg-[#874B30]"
          >
            <span>
              Order Printed &amp; Framed Version
              {typeof estimatedRetailPriceUsd === 'number'
                ? ` · $${estimatedRetailPriceUsd.toFixed(2)}`
                : ` (${sizeSpec.labelInches})`}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default SizeAndFrameScroller;
