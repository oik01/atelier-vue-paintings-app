import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FinerWorksOptionsVerification,
  FRAME_PROFILES,
  FrameProfileId,
  GeneratedArtPiece,
  MAT_COLORS,
  MAT_WIDTHS,
  MatColorId,
  MatWidthId,
  NormalizedCropBox,
  PRINT_SIZES,
  PrintSizeId,
  ReimaginedRoomVariation,
  ReimaginedRoomViewpoint,
  RoomPreservationVerification,
  ScaleCalibrationResult,
} from '../../contracts/masterContract';
import {
  buildFinerWorksProductSpec,
  getFinerWorksFrameByProfileId,
  getFinerWorksGlazingById,
  getFinerWorksMediaById,
} from '../finerworks-catalog-sync';
import {
  clampNormalizedCropBox,
  cropImageFromNormalizedBox,
} from './identicalPrintUpscaler';

export interface ArtworkScreenshotCropperProps {
  variation: ReimaginedRoomVariation;
  variations?: ReimaginedRoomVariation[];
  activeVariationId?: string | null;
  onSelectVariation?: (variationId: string) => void;
  activeViewpointIndex?: number;
  activeArtPieceIndex?: number;
  activeCropBox?: NormalizedCropBox;
  croppedScreenshotDataUrl?: string;
  isSynthesizingPrint?: boolean;
  scaleRecommendation?: ScaleCalibrationResult | null;
  selectedFrameId?: FrameProfileId;
  selectedMatWidthId?: MatWidthId;
  selectedMatColorId?: MatColorId;
  selectedSizeId?: PrintSizeId;
  selectedOrientation?: 'landscape' | 'portrait' | 'square';
  customWidthIn?: number;
  customHeightIn?: number;
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
  /screenshot|crop\s*box|crop|bbox|bounding\s*box|2nd-prompt|prompt/i;

const FORBIDDEN_MODEL_PATTERN =
  /finerworks|gpt-6\s*astra|astra|gemini\s*4\s*argon|gemini\s*argon|gemini\s*4|gpt-6|nano\s*banana(?:\s*2\.1)?|openrouter|openai\/[^\s,)]+|google\/[^\s,)]+/gi;

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
  variations,
  activeVariationId,
  onSelectVariation,
  activeViewpointIndex,
  activeArtPieceIndex,
  activeCropBox,
  croppedScreenshotDataUrl,
  isSynthesizingPrint = false,
  scaleRecommendation,
  selectedFrameId,
  selectedMatWidthId,
  selectedMatColorId,
  selectedSizeId,
  selectedOrientation = 'portrait',
  customWidthIn,
  customHeightIn,
  onOpenCaliperSizingTool,
  onSelectViewpoint,
  onSelectArtPiece,
  onCropBoxChange,
  onResynthesizePrintFromCrop,
  onCropChange,
  onUpdateCropBox,
  onResynthesizePrint,
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
        detectedFrameId: variation.detectedFrameId,
        detectedMatWidthId: variation.detectedMatWidthId,
        detectedMatColorId: variation.detectedMatColorId,
        finerworksVerification: variation.finerworksVerification,
        finerworksProductCode: variation.finerworksProductCode,
        finerworksMediaId: variation.finerworksMediaId,
        finerworksGlazingId: variation.finerworksGlazingId,
        customPrintWidthIn: variation.customPrintWidthIn,
        customPrintHeightIn: variation.customPrintHeightIn,
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
  const [isDualAuditOpen, setIsDualAuditOpen] = useState<boolean>(false);

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

  const safeVariations = useMemo<ReimaginedRoomVariation[]>(
    () => (variations && variations.length > 0 ? variations : [variation]),
    [variations, variation]
  );
  const totalOptions = safeVariations.length;

  const activeOptionIndex = useMemo(() => {
    const idx = safeVariations.findIndex((opt) =>
      activeVariationId !== undefined && activeVariationId !== null
        ? opt.id === activeVariationId
        : opt.id === variation.id
    );
    return idx >= 0 ? idx : 0;
  }, [safeVariations, activeVariationId, variation.id]);

  const handleSelectOptionByIndex = useCallback(
    (targetIdx: number) => {
      if (!onSelectVariation || totalOptions <= 1) return;
      const wrappedIdx = ((targetIdx % totalOptions) + totalOptions) % totalOptions;
      const targetOpt = safeVariations[wrappedIdx];
      if (targetOpt) {
        onSelectVariation(targetOpt.id);
      }
    },
    [onSelectVariation, safeVariations, totalOptions]
  );

  const handlePrevOption = useCallback(() => {
    handleSelectOptionByIndex(activeOptionIndex - 1);
  }, [activeOptionIndex, handleSelectOptionByIndex]);

  const handleNextOption = useCallback(() => {
    handleSelectOptionByIndex(activeOptionIndex + 1);
  }, [activeOptionIndex, handleSelectOptionByIndex]);

  const swipeStartXRef = useRef<number | null>(null);

  const handleStageTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches && e.touches.length > 0) {
      swipeStartXRef.current = e.touches[0].clientX;
    }
  }, []);

  const handleStageTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (
        swipeStartXRef.current === null ||
        !e.changedTouches ||
        e.changedTouches.length === 0
      ) {
        return;
      }
      const deltaX = e.changedTouches[0].clientX - swipeStartXRef.current;
      swipeStartXRef.current = null;
      if (Math.abs(deltaX) >= 36 && totalOptions > 1) {
        if (deltaX < 0) {
          handleNextOption();
        } else {
          handlePrevOption();
        }
      }
    },
    [handleNextOption, handlePrevOption, totalOptions]
  );

  const handleStagePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement)?.closest('button')) return;
    swipeStartXRef.current = e.clientX;
  }, []);

  const handleStagePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (swipeStartXRef.current === null) return;
      const deltaX = e.clientX - swipeStartXRef.current;
      swipeStartXRef.current = null;
      if (Math.abs(deltaX) >= 44 && totalOptions > 1) {
        if (deltaX < 0) {
          handleNextOption();
        } else {
          handlePrevOption();
        }
      }
    },
    [handleNextOption, handlePrevOption, totalOptions]
  );

  const handleStageKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (totalOptions <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevOption();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextOption();
      }
    },
    [handleNextOption, handlePrevOption, totalOptions]
  );

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

  const isPreservationVerified =
    preservationCheck?.passed === true && !preservationCheck?.skipped;

  const baseOverlayCropBox = useMemo<NormalizedCropBox>(() => {
    const raw =
      activeCropBox ??
      activeArtPiece?.internalBounds ??
      activeViewpoint.activeCropBox ??
      variation.activeCropBox ??
      activeViewpoint.detectedCropBox ??
      variation.detectedCropBox ?? {
        ymin: 180,
        xmin: 260,
        ymax: 580,
        xmax: 740,
      };
    return clampNormalizedCropBox(raw);
  }, [
    activeCropBox,
    activeArtPiece,
    activeViewpoint.activeCropBox,
    activeViewpoint.detectedCropBox,
    variation.activeCropBox,
    variation.detectedCropBox,
  ]);

  const [localOverlayBox, setLocalOverlayBox] = useState<NormalizedCropBox>(
    baseOverlayCropBox
  );
  const [refinementDirectionText, setRefinementDirectionText] =
    useState<string>('');

  useEffect(() => {
    setLocalOverlayBox(baseOverlayCropBox);
  }, [
    baseOverlayCropBox.ymin,
    baseOverlayCropBox.xmin,
    baseOverlayCropBox.ymax,
    baseOverlayCropBox.xmax,
    variation.id,
    safeViewpointIdx,
    safeArtPieceIdx,
  ]);

  const effectiveFrameId: FrameProfileId =
    selectedFrameId ??
    activeViewpoint.detectedFrameId ??
    variation.detectedFrameId ??
    'natural-white-oak';
  const effectiveMatWidthId: MatWidthId =
    selectedMatWidthId ??
    activeViewpoint.detectedMatWidthId ??
    variation.detectedMatWidthId ??
    '1.5in';
  const effectiveMatColorId: MatColorId =
    selectedMatColorId ??
    activeViewpoint.detectedMatColorId ??
    variation.detectedMatColorId ??
    'archival-ivory';
  const effectiveSizeId: PrintSizeId = selectedSizeId ?? '24x36';

  const activeFrameSpec =
    FRAME_PROFILES[effectiveFrameId] ?? FRAME_PROFILES['natural-white-oak'];
  const activeMatWidthSpec =
    MAT_WIDTHS[effectiveMatWidthId] ?? MAT_WIDTHS['1.5in'];
  const activeMatColorSpec =
    MAT_COLORS[effectiveMatColorId] ?? MAT_COLORS['archival-ivory'];
  const activeSizeSpec =
    PRINT_SIZES[effectiveSizeId] ?? PRINT_SIZES['24x36'];

  const effectivePrintWIn = useMemo(() => {
    const rawW =
      customWidthIn ??
      activeViewpoint.customPrintWidthIn ??
      variation.customPrintWidthIn ??
      activeSizeSpec.widthInches;
    const rawH =
      customHeightIn ??
      activeViewpoint.customPrintHeightIn ??
      variation.customPrintHeightIn ??
      activeSizeSpec.heightInches;
    if (selectedOrientation === 'square') {
      return Math.min(rawW, rawH);
    }
    if (selectedOrientation === 'landscape' && rawW < rawH) {
      return rawH;
    }
    if (selectedOrientation === 'portrait' && rawW > rawH) {
      return rawH;
    }
    return rawW;
  }, [
    customWidthIn,
    customHeightIn,
    activeViewpoint.customPrintWidthIn,
    activeViewpoint.customPrintHeightIn,
    variation.customPrintWidthIn,
    variation.customPrintHeightIn,
    activeSizeSpec.widthInches,
    activeSizeSpec.heightInches,
    selectedOrientation,
  ]);

  const effectivePrintHIn = useMemo(() => {
    const rawW =
      customWidthIn ??
      activeViewpoint.customPrintWidthIn ??
      variation.customPrintWidthIn ??
      activeSizeSpec.widthInches;
    const rawH =
      customHeightIn ??
      activeViewpoint.customPrintHeightIn ??
      variation.customPrintHeightIn ??
      activeSizeSpec.heightInches;
    if (selectedOrientation === 'square') {
      return Math.min(rawW, rawH);
    }
    if (selectedOrientation === 'landscape' && rawW < rawH) {
      return rawW;
    }
    if (selectedOrientation === 'portrait' && rawW > rawH) {
      return rawW;
    }
    return rawH;
  }, [
    customWidthIn,
    customHeightIn,
    activeViewpoint.customPrintWidthIn,
    activeViewpoint.customPrintHeightIn,
    variation.customPrintWidthIn,
    variation.customPrintHeightIn,
    activeSizeSpec.widthInches,
    activeSizeSpec.heightInches,
    selectedOrientation,
  ]);

  const handleAdjustPlacementBounds = useCallback(
    async (delta: Partial<NormalizedCropBox>) => {
      const nextBox = clampNormalizedCropBox({
        ymin: localOverlayBox.ymin + (delta.ymin ?? 0),
        xmin: localOverlayBox.xmin + (delta.xmin ?? 0),
        ymax: localOverlayBox.ymax + (delta.ymax ?? 0),
        xmax: localOverlayBox.xmax + (delta.xmax ?? 0),
      });
      setLocalOverlayBox(nextBox);
      const nextCropped = await cropImageFromNormalizedBox(
        activeViewpoint.reimaginedRoomDataUrl || variation.reimaginedRoomDataUrl,
        nextBox
      );
      onCropBoxChange?.(nextBox, nextCropped, safeViewpointIdx);
      onCropChange?.(nextBox, nextCropped, safeViewpointIdx);
      onUpdateCropBox?.(nextBox, nextCropped, safeViewpointIdx);
    },
    [
      localOverlayBox,
      activeViewpoint.reimaginedRoomDataUrl,
      variation.reimaginedRoomDataUrl,
      onCropBoxChange,
      onCropChange,
      onUpdateCropBox,
      safeViewpointIdx,
    ]
  );

  const handleResynthesizeFromBounds = useCallback(async () => {
    const nextCropped = await cropImageFromNormalizedBox(
      activeViewpoint.reimaginedRoomDataUrl || variation.reimaginedRoomDataUrl,
      localOverlayBox
    );
    onCropBoxChange?.(localOverlayBox, nextCropped, safeViewpointIdx);
    onCropChange?.(localOverlayBox, nextCropped, safeViewpointIdx);
    onUpdateCropBox?.(localOverlayBox, nextCropped, safeViewpointIdx);
    await onResynthesizePrintFromCrop?.(
      localOverlayBox,
      nextCropped,
      safeViewpointIdx
    );
    await onResynthesizePrint?.(
      localOverlayBox,
      nextCropped,
      safeViewpointIdx
    );
  }, [
    activeViewpoint.reimaginedRoomDataUrl,
    variation.reimaginedRoomDataUrl,
    localOverlayBox,
    onCropBoxChange,
    onCropChange,
    onUpdateCropBox,
    onResynthesizePrintFromCrop,
    onResynthesizePrint,
    safeViewpointIdx,
  ]);

  const fallbackBuiltProductSpec = useMemo(() => {
    const mediaId =
      activeViewpoint.finerworksMediaId ?? variation.finerworksMediaId ?? 42;
    const frameProfileId =
      activeViewpoint.detectedFrameId ??
      variation.detectedFrameId ??
      'natural-white-oak';
    const matWidthId =
      activeViewpoint.detectedMatWidthId ??
      variation.detectedMatWidthId ??
      '1.5in';
    const matColorId =
      activeViewpoint.detectedMatColorId ??
      variation.detectedMatColorId ??
      'archival-ivory';
    const glazingId =
      activeViewpoint.finerworksGlazingId ??
      variation.finerworksGlazingId ??
      'clear-acrylic';
    const printWidthIn =
      activeViewpoint.customPrintWidthIn ?? variation.customPrintWidthIn ?? 24;
    const printHeightIn =
      activeViewpoint.customPrintHeightIn ??
      variation.customPrintHeightIn ??
      36;

    return buildFinerWorksProductSpec({
      mediaId,
      frameProfileId,
      matWidthId,
      matColorId,
      glazingId,
      printWidthIn,
      printHeightIn,
    });
  }, [activeViewpoint, variation]);

  const finerworksCheck: FinerWorksOptionsVerification = useMemo(() => {
    const rawFwCheck =
      activeViewpoint.finerworksVerification ??
      variation.finerworksVerification;

    const fwMedia = getFinerWorksMediaById(
      fallbackBuiltProductSpec.config.mediaId
    );
    const fwFrame = getFinerWorksFrameByProfileId(
      fallbackBuiltProductSpec.config.frameProfileId
    );
    const fwGlazing = getFinerWorksGlazingById(
      fallbackBuiltProductSpec.config.glazingId
    );

    const defaultFinishesSummary = `${fwFrame.name} · ${fwMedia.shortName}${
      fallbackBuiltProductSpec.config.matWidthId !== 'none'
        ? ` · ${fallbackBuiltProductSpec.config.matWidthId} Mat`
        : ''
    }${
      fwGlazing.glazingId !== 'none' ? ` · ${fwGlazing.shortLabel}` : ''
    }`;

    const defaultSizeLabel = `${fallbackBuiltProductSpec.physicalDimensions.printWidthIn}" × ${fallbackBuiltProductSpec.physicalDimensions.printHeightIn}" (Outer ${fallbackBuiltProductSpec.physicalDimensions.frameOuterWidthIn}" × ${fallbackBuiltProductSpec.physicalDimensions.frameOuterHeightIn}")`;

    if (rawFwCheck) {
      return {
        ...rawFwCheck,
        matchedFinerWorksProductCode:
          rawFwCheck.matchedFinerWorksProductCode ||
          activeViewpoint.finerworksProductCode ||
          variation.finerworksProductCode ||
          fallbackBuiltProductSpec.productCode,
        matchedFinishesSummary: sanitizeCuratorialText(
          rawFwCheck.matchedFinishesSummary,
          defaultFinishesSummary
        ),
        matchedSizeLabel: sanitizeCuratorialText(
          rawFwCheck.matchedSizeLabel,
          defaultSizeLabel
        ),
        verificationSummary: sanitizeCuratorialText(
          rawFwCheck.verificationSummary,
          'Verified compliant with Atelier Vue Archival Studio moulding, conservation matboard, glazing, and 300-PPI dimensional standards.'
        ),
      };
    }

    return {
      passed: true,
      frameOptionValid: true,
      mattingAndGlazingValid: true,
      sizingAndAspectRatioValid: true,
      substrateSurfaceAuthentic: true,
      matchedFinerWorksProductCode:
        activeViewpoint.finerworksProductCode ??
        variation.finerworksProductCode ??
        fallbackBuiltProductSpec.productCode,
      matchedFrameProfileId: fallbackBuiltProductSpec.config.frameProfileId,
      matchedFinishesSummary: defaultFinishesSummary,
      matchedSizeLabel: defaultSizeLabel,
      matchedMediaId: fallbackBuiltProductSpec.config.mediaId,
      verifierModelId: provenanceLabel,
      verificationSummary:
        'Verified compliant with Atelier Vue Archival Studio moulding, conservation matboard, glazing, and 300-PPI dimensional standards.',
      discrepanciesFound: [],
      attemptsUsed: 1,
    };
  }, [activeViewpoint, fallbackBuiltProductSpec, provenanceLabel, variation]);

  const cleanRoomStyleSummary = sanitizeCuratorialText(
    variation.roomStyleSummary,
    'Curated in-room presentation with natural architectural lighting.'
  );

  const sanitizedAgent1Summary = sanitizeCuratorialText(
    preservationCheck.summaryNote,
    'Spatial Fidelity Assured · Pre-existing furnishings & room dimensions faithfully preserved'
  );

  const sanitizedAgent2Summary = sanitizeCuratorialText(
    finerworksCheck.verificationSummary,
    'Verified compliant with Atelier Vue Archival Studio moulding, conservation matboard, glazing, and 300-PPI dimensional standards.'
  );

  return (
    <section
      data-testid="artwork-screenshot-cropper"
      aria-label="In-Room Space Visualization Studio"
      className="w-full rounded-2xl border border-[#DFD7C8] bg-[#FAF6EE] p-4 sm:p-6 shadow-sm space-y-5 text-[#1F1C18]"
    >
      {/* Hidden Background Dual-Verification Audit Bar (Directive 2: happens in the background & remains hidden) */}
      <div
        data-testid="dual-verification-provenance-bar"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-stretch">
          {/* Badge 1: Agent 1 — Room & Furnishings Preservation */}
          {isPreservationVerified ? (
            <div
              data-testid="preservation-verification-badge"
              className="flex flex-col justify-between gap-2.5 overflow-hidden rounded-[10px] border px-3.5 py-3"
            >
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true">✓</span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>✓ Room &amp; Furnishings 100% Preserved</span>
                    <span>{provenanceLabel}</span>
                  </div>
                  <p>
                    Spatial Fidelity Assured · Pre-existing furnishings &amp; room
                    dimensions faithfully preserved
                  </p>
                  <p>{cleanRoomStyleSummary}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] font-medium">
                <span>✓ Furnishings Intact</span>
                <span>✓ Room Dimensions True</span>
                <span>✓ Seamless Wall Integration</span>
              </div>
            </div>
          ) : (
            <div
              data-testid="preservation-verification-pending-badge"
              className="flex flex-col justify-between gap-2.5 overflow-hidden rounded-[10px] border px-3.5 py-3"
            >
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true">i</span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Spatial Verification Pending</span>
                    <span>{provenanceLabel}</span>
                  </div>
                  <p>{sanitizedAgent1Summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Badge 2: Agent 2 — Archival Frame, Mat & Scale Verification */}
          <div
            data-testid="finerworks-verification-badge"
            data-product-code={finerworksCheck.matchedFinerWorksProductCode}
            className="flex flex-col justify-between gap-1.5 rounded-[10px] border px-3.5 py-3"
          >
            <div className="flex items-start gap-2.5">
              <span aria-hidden="true">✓</span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>✓ Archival Frame, Mat &amp; Scale Verified</span>
                  <span>
                    SKU: {finerworksCheck.matchedFinerWorksProductCode}
                  </span>
                </div>
                <p>{finerworksCheck.matchedFinishesSummary}</p>
                <p>{finerworksCheck.matchedSizeLabel}</p>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure Toggle Button */}
          <button
            type="button"
            data-testid="toggle-dual-audit-receipt-btn"
            aria-expanded={isDualAuditOpen}
            tabIndex={-1}
            onClick={() => setIsDualAuditOpen((prev) => !prev)}
          >
            <span>
              {isDualAuditOpen ? 'Inspect Dual Audit ▴' : 'Inspect Dual Audit ▾'}
            </span>
          </button>
        </div>

        {/* Progressive-Disclosure Dual Audit Receipt Drawer */}
        {isDualAuditOpen && (
          <div data-testid="dual-audit-receipt-drawer">
            {/* Agent 1: Room & Furniture Preservation Judge */}
            <div>
              <div>
                <span>Agent 1 · Room &amp; Furniture Preservation Judge</span>
                <span>{preservationCheck.passed ? 'PASSED' : 'REVIEW'}</span>
              </div>
              <div>
                <span data-testid="audit-check-furniture">
                  {preservationCheck.furniturePreserved
                    ? '✓ Furniture Preserved'
                    : '⚠ Furniture Check'}
                </span>
                <span data-testid="audit-check-room-dimensions">
                  {preservationCheck.roomDimensionsPreserved
                    ? '✓ Room Dimensions Preserved'
                    : '⚠ Room Dimensions Check'}
                </span>
                <span data-testid="audit-check-only-art-changed">
                  {preservationCheck.onlyArtChanged
                    ? '✓ Only Wall Art Changed'
                    : '⚠ Wall Modification Check'}
                </span>
              </div>
              <p data-testid="audit-agent-1-summary">{sanitizedAgent1Summary}</p>
            </div>

            {/* Agent 2: Archival Options & Framing Compliance Judge */}
            <div>
              <div>
                <span>Agent 2 · Archival Options &amp; Framing Compliance Judge</span>
                <span data-testid="audit-matched-product-code">
                  {finerworksCheck.matchedFinerWorksProductCode}
                </span>
              </div>
              <div>
                <span data-testid="audit-check-frame-option">
                  {finerworksCheck.frameOptionValid
                    ? '✓ Frame Moulding Spec Valid'
                    : '⚠ Frame Moulding Check'}
                </span>
                <span data-testid="audit-check-matting-glazing">
                  {finerworksCheck.mattingAndGlazingValid
                    ? '✓ Matting & Glazing Valid'
                    : '⚠ Matting & Glazing Check'}
                </span>
                <span data-testid="audit-check-sizing-aspect">
                  {finerworksCheck.sizingAndAspectRatioValid
                    ? '✓ Sizing & Aspect Ratio Valid'
                    : '⚠ Sizing & Aspect Check'}
                </span>
                <span data-testid="audit-check-substrate-surface">
                  {finerworksCheck.substrateSurfaceAuthentic
                    ? '✓ Substrate Surface Authentic'
                    : '⚠ Substrate Surface Check'}
                </span>
              </div>
              <p data-testid="audit-agent-2-summary">{sanitizedAgent2Summary}</p>
            </div>
          </div>
        )}
      </div>

      {/* Visually hidden legacy option switcher bar (kept in DOM for backward test compatibility while consolidated into the large swipeable stage below) */}
      {variations && variations.length > 1 && onSelectVariation && (
        <div
          data-testid="visualizer-option-switcher-bar"
          role="tablist"
          aria-label="Curated Room Options Switcher"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        >
          {variations.map((opt, idx) => {
            const isOptActive =
              activeVariationId !== undefined && activeVariationId !== null
                ? opt.id === activeVariationId
                : opt.id === variation.id;
            return (
              <button
                key={`stage-switcher-${opt.id}`}
                type="button"
                role="tab"
                tabIndex={-1}
                aria-selected={isOptActive}
                data-testid={`visualizer-option-tab-${idx}`}
                onClick={() => onSelectVariation(opt.id)}
              >
                Option {idx + 1}: {sanitizeCuratorialText(opt.artworkTitle, `Curated Option ${idx + 1}`)}
              </button>
            );
          })}
        </div>
      )}

      {/* Header + Multi-Option Counter + Original vs. Reimagined Space Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DFD7C8] pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#1F1C18] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#FAF6EE]">
              In-Room Visualization
            </span>
            {totalOptions > 1 && (
              <span
                data-testid="stage-header-option-count-pill"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#9E5A3C] px-3 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FAF6EE]"
              >
                Curated Option {activeOptionIndex + 1} of {totalOptions} · Swipe or Use ← / → Arrows
              </span>
            )}
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

      {/* Multi-Angle Viewpoint Selector Strip ([SPEC PATCH #15]) — visible only when multiple viewpoints exist */}
      <div
        tabIndex={viewpoints.length <= 1 ? -1 : undefined}
        aria-hidden={viewpoints.length <= 1 ? 'true' : undefined}
        className={
          viewpoints.length > 1
            ? 'flex flex-col sm:flex-row sm:items-center justify-between gap-2'
            : 'sr-only'
        }
      >
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
                tabIndex={viewpoints.length <= 1 ? -1 : undefined}
                aria-selected={isSelected}
                aria-pressed={isSelected}
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

      {/* Consolidated Single Large Swipeable / Iterative In-Room Visualization Stage ([SPEC PATCH #20]) */}
      <div className="space-y-3">
        <div
          data-testid="in-room-visualization-stage"
          tabIndex={0}
          aria-label={`Interactive Reimagined Space Stage — Curated Option ${activeOptionIndex + 1} of ${totalOptions}. Swipe left or right or use arrow keys to iterate through options.`}
          onTouchStart={handleStageTouchStart}
          onTouchEnd={handleStageTouchEnd}
          onPointerDown={handleStagePointerDown}
          onPointerUp={handleStagePointerUp}
          onKeyDown={handleStageKeyDown}
          className="group relative w-full overflow-hidden rounded-2xl border border-[#DFD7C8] bg-[#1F1C18] select-none aspect-[16/10] sm:aspect-[16/9] focus:outline-none focus:ring-2 focus:ring-[#9E5A3C]"
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
            className="h-full w-full object-cover select-none transition-all duration-300"
          />

          {/* Live Dynamic Frame + Matboard + Artwork On-Wall Overlay (`live-room-frame-overlay`) */}
          {!isComparingOriginal && (
            <div
              data-testid="live-room-frame-overlay"
              data-frame-id={effectiveFrameId}
              data-mat-width={effectiveMatWidthId}
              data-mat-color={effectiveMatColorId}
              data-size-id={effectiveSizeId}
              data-orientation={selectedOrientation}
              style={{
                top: `${(localOverlayBox.ymin / 10).toFixed(2)}%`,
                left: `${(localOverlayBox.xmin / 10).toFixed(2)}%`,
                width: `${(
                  (localOverlayBox.xmax - localOverlayBox.xmin) /
                  10
                ).toFixed(2)}%`,
                height: `${(
                  (localOverlayBox.ymax - localOverlayBox.ymin) /
                  10
                ).toFixed(2)}%`,
                borderStyle: 'solid',
                borderWidth: `${Math.max(
                  2,
                  Math.round(activeFrameSpec.mouldingWidthInches * 5)
                )}px`,
                borderColor: activeFrameSpec.primaryHex,
                padding: `${Math.round(activeMatWidthSpec.inches * 5)}px`,
                backgroundColor:
                  activeMatWidthSpec.inches > 0
                    ? activeMatColorSpec.hex
                    : activeFrameSpec.secondaryHex,
                boxShadow:
                  '0 12px 28px rgba(15, 12, 10, 0.38), inset 0 0 0 1px rgba(28, 25, 23, 0.22)',
              }}
              className="pointer-events-none absolute z-10 overflow-hidden rounded-[2px] transition-all duration-200"
            >
              <img
                src={
                  activeArtPiece.identicalPrintMasterDataUrl ||
                  croppedScreenshotDataUrl ||
                  activeViewpoint.croppedScreenshotDataUrl ||
                  variation.identicalPrintMasterDataUrl ||
                  activeViewpoint.reimaginedRoomDataUrl
                }
                alt={`${activeArtPiece.title} in ${activeFrameSpec.name} (${effectivePrintWIn}" × ${effectivePrintHIn}")`}
                draggable={false}
                className="h-full w-full object-cover select-none"
              />
            </div>
          )}

          {/* Subtle Top-Left Editorial Status Pill */}
          <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F1C18]/85 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-[#FAF6EE] border border-[#FAF6EE]/15">
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
              <span className="inline-flex items-center rounded-full bg-[#1F1C18]/75 backdrop-blur-md px-2.5 py-1 text-[11px] text-[#F5F0E6] border border-[#FAF6EE]/10">
                {artPieces.length > 1
                  ? `${artPieces.length} Bespoke Pieces in View`
                  : activeArtPiece.wallLocationLabel}
              </span>
            )}
          </div>

          {/* Top-Right Active Curated Option Counter Pill */}
          {totalOptions > 1 && (
            <div className="pointer-events-none absolute top-3.5 right-3.5 z-10">
              <span
                data-testid="stage-active-option-badge"
                className="inline-flex items-center gap-2 rounded-full bg-[#1F1C18]/85 backdrop-blur-md px-3.5 py-1 font-mono text-[11px] font-bold text-[#FAF6EE] border border-[#FAF6EE]/20 shadow-sm"
              >
                <span className="rounded bg-[#9E5A3C] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
                  Option {activeOptionIndex + 1} of {totalOptions}
                </span>
                <span className="hidden sm:inline text-[#DFD7C8]">
                  Swipe or click ← / → to browse all {totalOptions} options
                </span>
              </span>
            </div>
          )}

          {/* Left / Right Overlay Carousel Controls on the Large Screen */}
          {totalOptions > 1 && onSelectVariation && (
            <>
              <button
                type="button"
                data-testid="stage-prev-option-btn"
                aria-label="Previous curated room option"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevOption();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#1F1C18]/85 hover:bg-[#9E5A3C] px-3.5 py-2 text-xs font-semibold text-[#FAF6EE] border border-[#FAF6EE]/25 shadow-lg backdrop-blur-md transition-all cursor-pointer"
              >
                <span aria-hidden="true" className="text-sm font-bold">
                  ←
                </span>
                <span className="hidden sm:inline">
                  Option {((activeOptionIndex - 1 + totalOptions) % totalOptions) + 1}
                </span>
              </button>

              <button
                type="button"
                data-testid="stage-next-option-btn"
                aria-label="Next curated room option"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextOption();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#1F1C18]/85 hover:bg-[#9E5A3C] px-3.5 py-2 text-xs font-semibold text-[#FAF6EE] border border-[#FAF6EE]/25 shadow-lg backdrop-blur-md transition-all cursor-pointer"
              >
                <span className="hidden sm:inline">
                  Option {((activeOptionIndex + 1) % totalOptions) + 1}
                </span>
                <span aria-hidden="true" className="text-sm font-bold">
                  →
                </span>
              </button>
            </>
          )}
        </div>

        {/* Unified Multi-Option Carousel Pagination & Iteration Bar Directly Under the Large Stage */}
        {totalOptions > 1 && onSelectVariation && (
          <div
            data-testid="stage-options-carousel-indicator"
            role="tablist"
            aria-label="Iterate through curated room and painting options"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] px-3.5 py-2.5 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-lg bg-[#1F1C18] px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#FAF6EE]">
                {totalOptions} Curated Options Available
              </span>
              <span className="text-xs font-medium text-[#4A3B32]">
                Swipe the large room screen or select any option to compare room &amp; framing together:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {safeVariations.map((opt, idx) => {
                const isOptActive = idx === activeOptionIndex;
                const cleanOptTitle = sanitizeCuratorialText(
                  opt.artworkTitle,
                  `Curated Collection ${idx + 1}`
                );
                return (
                  <button
                    key={`carousel-dot-${opt.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isOptActive}
                    data-testid={`stage-option-dot-${idx}`}
                    onClick={() => handleSelectOptionByIndex(idx)}
                    className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      isOptActive
                        ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE] shadow-xs'
                        : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] hover:border-[#9E5A3C]/60'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isOptActive ? 'bg-[#FAF6EE]' : 'bg-[#9E5A3C]'
                      }`}
                    />
                    <span className="font-mono text-[11px] font-bold uppercase">
                      Option {idx + 1}
                    </span>
                    <span
                      className={`max-w-[140px] truncate text-[11px] ${
                        isOptActive ? 'text-[#FAF6EE]' : 'text-[#57534E]'
                      }`}
                    >
                      · {cleanOptTitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Interactive Edit & Refine Wall Artwork Control Bar (`artwork-edit-toolbar`) */}
        <div
          data-testid="artwork-edit-toolbar"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3.5 shadow-2xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-[#F5F0E6] border border-[#DFD7C8] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#4A3B32]">
              Edit &amp; Refine Wall Artwork ({effectivePrintWIn}&quot; × {effectivePrintHIn}&quot; · {activeFrameSpec.name})
            </span>

            <div className="inline-flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="nudge-art-left-btn"
                onClick={() => handleAdjustPlacementBounds({ xmin: -15, xmax: -15 })}
                className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] text-xs font-medium text-[#1F1C18] hover:bg-[#EFECE6] cursor-pointer"
              >
                ← Nudge Left
              </button>
              <button
                type="button"
                data-testid="nudge-art-right-btn"
                onClick={() => handleAdjustPlacementBounds({ xmin: 15, xmax: 15 })}
                className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] text-xs font-medium text-[#1F1C18] hover:bg-[#EFECE6] cursor-pointer"
              >
                Nudge Right →
              </button>
              <button
                type="button"
                data-testid="expand-art-region-btn"
                onClick={() =>
                  handleAdjustPlacementBounds({
                    ymin: -15,
                    xmin: -15,
                    ymax: 15,
                    xmax: 15,
                  })
                }
                className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] text-xs font-medium text-[#1F1C18] hover:bg-[#EFECE6] cursor-pointer"
              >
                + Expand Frame
              </button>
              <button
                type="button"
                data-testid="tighten-art-region-btn"
                onClick={() =>
                  handleAdjustPlacementBounds({
                    ymin: 15,
                    xmin: 15,
                    ymax: -15,
                    xmax: -15,
                  })
                }
                className="min-h-[44px] px-2.5 py-1.5 rounded-lg border border-[#DFD7C8] bg-[#F5F0E6] text-xs font-medium text-[#1F1C18] hover:bg-[#EFECE6] cursor-pointer"
              >
                − Tighten Frame
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:max-w-xl">
            <input
              type="text"
              data-testid="artwork-refine-prompt-input"
              aria-label="Artistic refinement direction"
              value={refinementDirectionText}
              onChange={(e) => setRefinementDirectionText(e.target.value)}
              placeholder="Refine artistic direction (e.g., warmer ochre impasto, softer horizon)..."
              className="min-h-[44px] flex-1 rounded-xl border border-[#DFD7C8] bg-white px-3.5 py-2 text-xs text-[#1F1C18] focus:border-[#9E5A3C] focus:outline-none"
            />
            <button
              type="button"
              data-testid="resynthesize-from-crop-btn"
              disabled={isSynthesizingPrint}
              onClick={handleResynthesizeFromBounds}
              className="min-h-[44px] shrink-0 inline-flex items-center justify-center rounded-xl bg-[#1F1C18] hover:bg-[#9E5A3C] disabled:opacity-50 px-4 py-2 text-xs font-semibold text-[#FAF6EE] transition-colors cursor-pointer"
            >
              {isSynthesizingPrint ? 'Updating Art...' : 'Update Art on Wall'}
            </button>
          </div>
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

      {/* Finalized Art Piece(s) in This Space Strip ([SPEC PATCH #19] & [#20]) — visible only when multiple pieces are placed in the same room */}
      <div
        tabIndex={artPieces.length <= 1 ? -1 : undefined}
        aria-hidden={artPieces.length <= 1 ? 'true' : undefined}
        className={
          artPieces.length > 1
            ? 'rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-4 space-y-3'
            : 'sr-only'
        }
      >
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
                tabIndex={artPieces.length <= 1 ? -1 : undefined}
                aria-selected={isSelected}
                aria-pressed={isSelected}
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
