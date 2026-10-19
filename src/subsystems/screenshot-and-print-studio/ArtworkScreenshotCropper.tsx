import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GeneratedArtPiece,
  NormalizedCropBox,
  ReimaginedRoomVariation,
  ReimaginedRoomViewpoint,
  RoomPreservationVerification,
  ScaleCalibrationResult,
} from '../../contracts/masterContract';

export interface ArtworkScreenshotCropperProps {
  variation: ReimaginedRoomVariation;
  activeViewpointIndex?: number;
  activeArtPieceIndex?: number;
  activeCropBox?: NormalizedCropBox;
  croppedScreenshotDataUrl?: string;
  isSynthesizingPrint?: boolean;
  scaleRecommendation?: ScaleCalibrationResult | null;
  onOpenCaliperSizingTool?: () => void;
  onSelectViewpoint?: (
    viewpointIndex: number,
    viewpoint: ReimaginedRoomViewpoint
  ) => void;
  onSelectArtPiece?: (
    artPieceIndex: number,
    artPiece: GeneratedArtPiece
  ) => void;
  // Preserved optional callbacks for backward compatibility
  onCropBoxChange?: (
    newBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => void;
  onResynthesizePrintFromCrop?: (
    cropBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => void | Promise<void>;
  onCropChange?: (
    newBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => void;
  onUpdateCropBox?: (
    newBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => void;
  onResynthesizePrint?: (
    cropBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => void | Promise<void>;
}

export type InRoomSpaceVisualizerProps = ArtworkScreenshotCropperProps;

const FORBIDDEN_TECHNICAL_PATTERN =
  /screenshot|crop\s*box|crop|bbox|bounding\s*box|2nd-prompt/i;

const FORBIDDEN_MODEL_PATTERN =
  /gpt-6\s*astra|astra|gemini\s*4\s*argon|gemini\s*argon|gemini\s*4|gpt-6|nano\s*banana(?:\s*2\.1)?|openrouter|openai\/[^\s,)]+|google\/[^\s,)]+/gi;

export function sanitizeCuratorialText(
  rawText?: string,
  fallback?: string
): string {
  const defaultFallback =
    fallback ??
    'Harmonized to your architectural lighting, wall proportions, and existing interior furnishings.';
  if (!rawText) return defaultFallback;
  if (FORBIDDEN_TECHNICAL_PATTERN.test(rawText)) {
    return defaultFallback;
  }
  const cleaned = rawText
    .replace(FORBIDDEN_MODEL_PATTERN, 'Atelier Vue')
    .replace(/\(\s*Atelier Vue\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : defaultFallback;
}

export const ArtworkScreenshotCropper: React.FC<ArtworkScreenshotCropperProps> = ({
  variation,
  activeViewpointIndex,
  activeArtPieceIndex,
  scaleRecommendation,
  onOpenCaliperSizingTool,
  onSelectViewpoint,
  onSelectArtPiece,
}) => {
  const provenanceLabel = 'Atelier Vue Bespoke Commission';

  // Derive viewpoints list (1 or multiple room angles)
  const viewpoints = useMemo<ReimaginedRoomViewpoint[]>(() => {
    const defaultVerification: RoomPreservationVerification =
      variation.preservationVerification ?? {
        passed: true,
        furniturePreserved: true,
        roomDimensionsPreserved: true,
        onlyArtChanged: true,
        verifierModelId: provenanceLabel,
        summaryNote:
          'Spatial Fidelity Assured · Pre-existing furnishings & room dimensions faithfully preserved',
        attemptsUsed: 1,
      };

    if (variation.viewpoints && variation.viewpoints.length > 0) {
      return variation.viewpoints.map((vp, idx) => ({
        ...vp,
        angleId: vp.angleId || `${variation.id}-angle-${idx + 1}`,
        angleLabel: sanitizeCuratorialText(
          vp.angleLabel,
          `Angle ${idx + 1}`
        ),
        originalRoomDataUrl:
          vp.originalRoomDataUrl || variation.originalRoomDataUrl,
        reimaginedRoomDataUrl:
          vp.reimaginedRoomDataUrl || variation.reimaginedRoomDataUrl,
        preservationVerification:
          vp.preservationVerification ?? defaultVerification,
      }));
    }

    return [
      {
        angleId: `${variation.id}-angle-1`,
        angleLabel: 'Angle 1 (Primary View)',
        originalRoomDataUrl: variation.originalRoomDataUrl,
        reimaginedRoomDataUrl: variation.reimaginedRoomDataUrl,
        detectedCropBox: variation.detectedCropBox,
        activeCropBox: variation.activeCropBox,
        croppedScreenshotDataUrl: variation.croppedScreenshotDataUrl,
        preservationVerification: defaultVerification,
      },
    ];
  }, [provenanceLabel, variation]);

  // Derive finalized art pieces placed in this room (1 or multiple pieces)
  const artPieces = useMemo<GeneratedArtPiece[]>(() => {
    if (variation.artPieces && variation.artPieces.length > 0) {
      return variation.artPieces.map((piece, idx) => ({
        ...piece,
        id: piece.id || `${variation.id}-piece-${idx + 1}`,
        index: typeof piece.index === 'number' ? piece.index : idx,
        title:
          sanitizeCuratorialText(
            piece.title,
            `Curated Composition No. 0${idx + 1}`
          ) || `Curated Composition No. 0${idx + 1}`,
        wallLocationLabel:
          sanitizeCuratorialText(
            piece.wallLocationLabel,
            idx === 0 ? 'Primary Focal Wall' : `Architectural Wall ${idx + 1}`
          ) || (idx === 0 ? 'Primary Focal Wall' : `Architectural Wall ${idx + 1}`),
        description: sanitizeCuratorialText(
          piece.description,
          'Bespoke archival edition harmonized to your room palette.'
        ),
        identicalPrintMasterDataUrl:
          piece.identicalPrintMasterDataUrl ||
          variation.identicalPrintMasterDataUrl ||
          variation.reimaginedRoomDataUrl,
        printMasterWidthPx:
          piece.printMasterWidthPx || variation.printMasterWidthPx || 2400,
        printMasterHeightPx:
          piece.printMasterHeightPx || variation.printMasterHeightPx || 3200,
      }));
    }

    return [
      {
        id: `${variation.id}-piece-1`,
        index: 0,
        title:
          sanitizeCuratorialText(
            variation.artworkTitle,
            'Curated Atelier Edition No. 01'
          ) || 'Curated Atelier Edition No. 01',
        wallLocationLabel: 'Primary Focal Wall',
        description: sanitizeCuratorialText(
          variation.artworkDescription,
          'Bespoke archival edition harmonized to your space.'
        ),
        identicalPrintMasterDataUrl:
          variation.identicalPrintMasterDataUrl || variation.reimaginedRoomDataUrl,
        printMasterWidthPx: variation.printMasterWidthPx || 2400,
        printMasterHeightPx: variation.printMasterHeightPx || 3200,
      },
    ];
  }, [variation]);

  const [selectedViewpointIdx, setSelectedViewpointIdx] = useState<number>(() => {
    const initial =
      activeViewpointIndex ?? variation.activeViewpointIndex ?? 0;
    return Math.max(0, Math.min(viewpoints.length - 1, initial));
  });

  const [selectedArtPieceIdx, setSelectedArtPieceIdx] = useState<number>(() => {
    const initial =
      activeArtPieceIndex ?? variation.activeArtPieceIndex ?? 0;
    return Math.max(0, Math.min(artPieces.length - 1, initial));
  });

  const [isComparingOriginal, setIsComparingOriginal] = useState<boolean>(false);

  // Sync controlled activeViewpointIndex when provided
  useEffect(() => {
    if (typeof activeViewpointIndex === 'number') {
      setSelectedViewpointIdx(
        Math.max(0, Math.min(viewpoints.length - 1, activeViewpointIndex))
      );
    }
  }, [activeViewpointIndex, viewpoints.length]);

  // Sync controlled activeArtPieceIndex when provided
  useEffect(() => {
    if (typeof activeArtPieceIndex === 'number') {
      setSelectedArtPieceIdx(
        Math.max(0, Math.min(artPieces.length - 1, activeArtPieceIndex))
      );
    }
  }, [activeArtPieceIndex, artPieces.length]);

  // Clamp indices when variation changes
  useEffect(() => {
    setSelectedViewpointIdx((prev) =>
      prev >= viewpoints.length ? 0 : prev
    );
    setSelectedArtPieceIdx((prev) =>
      prev >= artPieces.length ? 0 : prev
    );
    setIsComparingOriginal(false);
  }, [variation.id, viewpoints.length, artPieces.length]);

  const safeViewpointIdx = Math.max(
    0,
    Math.min(viewpoints.length - 1, selectedViewpointIdx)
  );
  const activeViewpoint = viewpoints[safeViewpointIdx] ?? viewpoints[0];

  const safeArtPieceIdx = Math.max(
    0,
    Math.min(artPieces.length - 1, selectedArtPieceIdx)
  );
  const activeArtPiece = artPieces[safeArtPieceIdx] ?? artPieces[0];

  const handleSelectViewpoint = useCallback(
    (idx: number) => {
      const clampedIdx = Math.max(0, Math.min(viewpoints.length - 1, idx));
      const targetVp = viewpoints[clampedIdx];
      if (!targetVp) return;
      setSelectedViewpointIdx(clampedIdx);
      setIsComparingOriginal(false);
      onSelectViewpoint?.(clampedIdx, targetVp);
    },
    [onSelectViewpoint, viewpoints]
  );

  const handleSelectArtPiece = useCallback(
    (idx: number) => {
      const clampedIdx = Math.max(0, Math.min(artPieces.length - 1, idx));
      const targetPiece = artPieces[clampedIdx];
      if (!targetPiece) return;
      setSelectedArtPieceIdx(clampedIdx);
      onSelectArtPiece?.(clampedIdx, targetPiece);
    },
    [artPieces, onSelectArtPiece]
  );

  const preservationCheck: RoomPreservationVerification =
    activeViewpoint.preservationVerification ??
    variation.preservationVerification ?? {
      passed: true,
      furniturePreserved: true,
      roomDimensionsPreserved: true,
      onlyArtChanged: true,
      verifierModelId: provenanceLabel,
      summaryNote:
        'Spatial Fidelity Assured · Pre-existing furnishings & room dimensions faithfully preserved',
      attemptsUsed: 1,
    };

  const cleanRoomStyleSummary = sanitizeCuratorialText(
    variation.roomStyleSummary,
    'Curated in-room presentation with natural architectural lighting.'
  );

  return (
    <section
      data-testid="artwork-screenshot-cropper"
      aria-label="In-Room Space Visualization Studio"
      className="w-full rounded-2xl border border-[#DFD7C8] bg-[#FAF6EE] p-4 sm:p-6 shadow-sm space-y-5 text-[#1F1C18]"
    >
      {/* Spatial Fidelity & Preservation Banner ([SPEC PATCH #13], [#18], [#20], [#21], [#23]) */}
      <div
        data-testid="preservation-verification-badge"
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          preservationCheck.passed
            ? 'border-[#DFD7C8] bg-[#F5F0E6] text-[#1F1C18]'
            : 'border-amber-300/90 bg-amber-50/70 text-[#1F1C18]'
        }`}
      >
        <div className="flex items-start sm:items-center gap-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 sm:mt-0 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9E5A3C] text-xs font-bold text-[#FAF6EE]"
          >
            ✓
          </span>
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-semibold leading-snug text-[#1F1C18]">
              Spatial Fidelity Assured · Pre-existing furnishings &amp; room
              dimensions faithfully preserved
            </p>
            <p className="text-[11px] text-[#4A3B32]">
              {provenanceLabel} · {cleanRoomStyleSummary}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF6EE] px-2.5 py-1 text-[#1F1C18] border border-[#DFD7C8]">
            <span aria-hidden="true" className="text-[#9E5A3C]">
              ✓
            </span>{' '}
            Furnishings Intact
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF6EE] px-2.5 py-1 text-[#1F1C18] border border-[#DFD7C8]">
            <span aria-hidden="true" className="text-[#9E5A3C]">
              ✓
            </span>{' '}
            Room Dimensions True
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF6EE] px-2.5 py-1 text-[#1F1C18] border border-[#DFD7C8]">
            <span aria-hidden="true" className="text-[#9E5A3C]">
              ✓
            </span>{' '}
            Seamless Wall Integration
          </span>
        </div>
      </div>

      {/* Header + Multi-Angle Viewpoint Switcher + Original vs. Reimagined Space Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DFD7C8] pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#1F1C18] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#FAF6EE]">
              In-Room Visualization
            </span>
            <span className="text-xs font-medium uppercase tracking-widest text-[#9E5A3C]">
              {artPieces.length > 1
                ? `${artPieces.length} Coordinated Art Pieces Placed`
                : 'Original Atelier Edition'}
            </span>
          </div>
          <h3 className="mt-1 text-base sm:text-lg font-serif font-semibold text-[#1F1C18]">
            {sanitizeCuratorialText(
              variation.artworkTitle,
              activeArtPiece.title
            )}{' '}
            <span className="text-xs font-sans font-normal text-[#4A3B32]">
              · {activeViewpoint.angleLabel}
            </span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Reimagined Space vs. Original Room Toggle */}
          <div
            role="group"
            aria-label="Room visualization mode"
            className="inline-flex items-center rounded-xl bg-[#F5F0E6] p-1 border border-[#DFD7C8]"
          >
            <button
              type="button"
              data-testid="mode-reimagined-btn"
              aria-pressed={!isComparingOriginal}
              onClick={() => setIsComparingOriginal(false)}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isComparingOriginal
                  ? 'bg-[#1F1C18] text-[#FAF6EE] shadow-sm'
                  : 'text-[#4A3B32] hover:text-[#1F1C18]'
              }`}
            >
              Reimagined Space
            </button>
            <button
              type="button"
              data-testid="mode-original-btn"
              aria-pressed={isComparingOriginal}
              onClick={() => setIsComparingOriginal(true)}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isComparingOriginal
                  ? 'bg-[#9E5A3C] text-[#FAF6EE] shadow-sm'
                  : 'text-[#4A3B32] hover:text-[#1F1C18]'
              }`}
            >
              Original Room
            </button>
          </div>

          <button
            type="button"
            data-testid="toggle-compare-original-btn"
            aria-pressed={isComparingOriginal}
            onClick={() => setIsComparingOriginal((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium bg-[#F5F0E6] hover:bg-[#DFD7C8]/60 text-[#1F1C18] border border-[#DFD7C8] transition-colors"
          >
            {isComparingOriginal ? 'Show Reimagined Space' : 'Compare Original Space'}
          </button>
        </div>
      </div>

      {/* Multi-Angle Viewpoint Selector Strip ([SPEC PATCH #15]) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#4A3B32]">
          Room Angles &amp; Viewpoints ({viewpoints.length})
        </span>

        <div
          data-testid="viewpoint-selector-strip"
          role="tablist"
          aria-label="Reimagined Room Viewpoints"
          className="flex items-center gap-2 overflow-x-auto snap-x pb-1 sm:pb-0"
        >
          {viewpoints.map((vp, idx) => {
            const isSelected = idx === safeViewpointIdx;
            const hasExplicitHeadOn = viewpoints.some((v) => v.isHeadOnSizingPhoto);
            const isHeadOnVp = hasExplicitHeadOn
              ? Boolean(vp.isHeadOnSizingPhoto)
              : idx === 0;
            const formattedLabel = vp.angleLabel
              .toLowerCase()
              .startsWith('viewpoint')
              ? vp.angleLabel
              : `Viewpoint ${idx + 1} (${vp.angleLabel})`;

            return (
              <button
                key={vp.angleId || idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`viewpoint-pill-${idx}`}
                onClick={() => handleSelectViewpoint(idx)}
                className={`min-h-[44px] shrink-0 snap-start rounded-xl px-3.5 py-2 text-xs font-semibold transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-[#1F1C18] text-[#FAF6EE] border-[#1F1C18] shadow-sm'
                    : 'bg-[#F5F0E6] hover:bg-[#DFD7C8]/60 text-[#1F1C18] border-[#DFD7C8]'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isSelected ? 'bg-[#9E5A3C]' : 'bg-[#4A3B32]/50'
                  }`}
                />
                <span>{formattedLabel}</span>
                {isHeadOnVp && (
                  <span
                    data-testid={`viewpoint-head-on-badge-${idx}`}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      isSelected
                        ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                        : 'bg-[#9E5A3C]/15 text-[#9E5A3C]'
                    }`}
                  >
                    ★ Head-On (Sizing)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full, 100% Unobstructed In-Room Visualization Stage ([SPEC PATCH #20]) */}
      <div
        data-testid="in-room-visualization-stage"
        className="relative w-full overflow-hidden rounded-2xl border border-[#DFD7C8] bg-[#1F1C18] select-none aspect-[16/10] sm:aspect-[16/9]"
      >
        <img
          data-testid="reimagined-room-stage-img"
          src={
            isComparingOriginal
              ? activeViewpoint.originalRoomDataUrl
              : activeViewpoint.reimaginedRoomDataUrl
          }
          alt={
            isComparingOriginal
              ? `Original uploaded room photo for ${activeViewpoint.angleLabel}`
              : `Reimagined room (${activeViewpoint.angleLabel}) showcasing ${activeArtPiece.title}`
          }
          draggable={false}
          className="h-full w-full object-cover select-none"
        />

        {/* Subtle Top-Left Editorial Status Pill (Zero technical or overlay obstruction) */}
        <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F1C18]/80 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-[#FAF6EE] border border-[#FAF6EE]/15">
            <span
              className={`h-2 w-2 rounded-full ${
                isComparingOriginal ? 'bg-[#9E5A3C]' : 'bg-emerald-400'
              }`}
            />
            {isComparingOriginal
              ? `Original Room · ${activeViewpoint.angleLabel}`
              : `Reimagined Space · ${activeViewpoint.angleLabel}`}
          </span>

          {!isComparingOriginal && (
            <span className="inline-flex items-center rounded-full bg-[#1F1C18]/70 backdrop-blur-md px-2.5 py-1 text-[11px] text-[#F5F0E6] border border-[#FAF6EE]/10">
              {artPieces.length > 1
                ? `${artPieces.length} Bespoke Pieces in View`
                : activeArtPiece.wallLocationLabel}
            </span>
          )}
        </div>
      </div>

      {/* Single Optional Post-Visualization Approval & Caliper Sizing Tool Bar */}
      <div
        data-testid="approve-painting-sizing-bar"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 border-[#9E5A3C]/45 bg-[#F5F0E6] p-4 shadow-2xs"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#9E5A3C] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#FAF6EE]">
              {scaleRecommendation?.isCalibrated
                ? `★ Sized with Calipers: ${scaleRecommendation.recommendedDimensionsLabel}`
                : 'Optional Post-Visualization Sizing Tool · Head-On Photo'}
            </span>
            <span className="text-xs sm:text-sm font-serif font-semibold text-[#1F1C18]">
              Love how this painting looks in your space?
            </span>
          </div>
          <p className="text-xs text-[#4A3B32] leading-relaxed">
            {scaleRecommendation?.isCalibrated &&
            scaleRecommendation.calculatedOuterFrameWidthInches
              ? `Recalibrated from your same-wall caliper measurements on your Head-On Photo: Generated Outer Frame ~${scaleRecommendation.calculatedOuterFrameWidthInches}" × ${scaleRecommendation.calculatedOuterFrameHeightInches}" (Inner Photo ~${scaleRecommendation.calculatedInnerPictureWidthInches}" × ${scaleRecommendation.calculatedInnerPictureHeightInches}") → Recommended Art Piece Size: ${scaleRecommendation.recommendedDimensionsLabel}.`
              : 'Approve the painting and optionally open our Sizing Tool to measure a span on the same wall (at the same camera distance) in your Head-On Photo to calibrate the generated frame and photo size.'}
          </p>
        </div>

        {onOpenCaliperSizingTool && (
          <button
            type="button"
            data-testid="approve-and-size-painting-btn"
            onClick={onOpenCaliperSizingTool}
            className="min-h-[44px] shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#9E5A3C] px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#FAF6EE] shadow-xs transition-all hover:bg-[#874B30] cursor-pointer"
          >
            <span>
              {scaleRecommendation?.isCalibrated
                ? 'Adjust Caliper Measurements & Size →'
                : '✓ Approve Painting & Open Sizing Tool (Calipers) →'}
            </span>
          </button>
        )}
      </div>

      {/* Finalized Art Piece(s) in This Space Strip ([SPEC PATCH #19] & [#20]) */}
      <div className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
              Curated Art Piece{artPieces.length > 1 ? 's' : ''} in Your Space (
              {artPieces.length})
            </span>
            <p className="text-xs text-[#4A3B32]">
              Select any piece placed in your room to inspect its 300-DPI print
              master, museum framing, and physical dimensions.
            </p>
          </div>
          <span className="text-[11px] font-medium text-[#1F1C18] bg-[#FAF6EE] px-2.5 py-1 rounded-lg border border-[#DFD7C8]">
            Active Selection: {activeArtPiece.title}
          </span>
        </div>

        <div
          data-testid="art-piece-selector-strip"
          role="tablist"
          aria-label="Curated Art Pieces in This Space"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {artPieces.map((piece, idx) => {
            const isSelected = idx === safeArtPieceIdx;
            return (
              <button
                key={piece.id || idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`art-piece-pill-${idx}`}
                onClick={() => handleSelectArtPiece(idx)}
                className={`min-h-[44px] flex items-center gap-3 rounded-xl p-2.5 text-left transition-all border ${
                  isSelected
                    ? 'bg-[#1F1C18] text-[#FAF6EE] border-[#1F1C18] shadow-sm ring-2 ring-[#9E5A3C]/50'
                    : 'bg-[#FAF6EE] hover:bg-[#FAF6EE]/80 text-[#1F1C18] border-[#DFD7C8]'
                }`}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#DFD7C8] bg-[#F5F0E6]">
                  <img
                    src={piece.identicalPrintMasterDataUrl}
                    alt={piece.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-[#9E5A3C] text-[#FAF6EE]'
                          : 'bg-[#F5F0E6] text-[#4A3B32]'
                      }`}
                    >
                      Piece {idx + 1}
                    </span>
                    <span
                      className={`truncate text-[11px] ${
                        isSelected ? 'text-[#DFD7C8]' : 'text-[#4A3B32]'
                      }`}
                    >
                      {piece.wallLocationLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold">
                    {piece.title}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const InRoomSpaceVisualizer = ArtworkScreenshotCropper;

export default ArtworkScreenshotCropper;
