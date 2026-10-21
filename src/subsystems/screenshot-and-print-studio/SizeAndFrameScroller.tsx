import React, { useEffect, useMemo, useState } from 'react';
import {
  FinerWorksBuiltProductSpec,
  FinerWorksFrameMouldingSpec,
  FinerWorksGlazingId,
  FinerWorksGlazingSpec,
  FinerWorksMediaSpec,
  FinerWorksStandardSizeId,
  FrameMouldingProfileStyle,
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
  buildFinerWorksProductSpec,
  FINERWORKS_ALL_231_FRAMES,
  FINERWORKS_FRAME_COLLECTIONS,
  FINERWORKS_FRAME_MOULDINGS,
  FINERWORKS_GLAZING_SPECS,
  FINERWORKS_MEDIA_SPECS,
  FINERWORKS_SIZE_OPTIONS,
  getFinerWorksFrameByProfileId,
  getFinerWorksGlazingById,
  getFinerWorksMediaById,
  getFinerWorksSizeById,
} from '../finerworks-catalog-sync';
import { stripOuterFrameAndMatFromArtworkDataUrl } from '../openrouter-ai-engine';
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
  selectedMediaId?: number;
  selectedGlazingId?: FinerWorksGlazingId;
  selectedFinerWorksSizeId?: FinerWorksStandardSizeId;
  selectedOrientation?: 'landscape' | 'portrait' | 'square';
  customPrintWidthIn?: number;
  customPrintHeightIn?: number;
  includeBleed?: boolean;
  isDownloadingPrint?: boolean;
  hasUnlockedDigitalMaster?: boolean;
  estimatedRetailPriceUsd?: number;
  scaleRecommendation?: ScaleCalibrationResult | null;
  onOpenCaliperSizingTool?: () => void;
  onSelectArtPiece?: (index: number, piece: GeneratedArtPiece) => void;
  onSelectSize: (sizeId: PrintSizeId) => void;
  onSelectOrientation?: (orientation: 'landscape' | 'portrait' | 'square') => void;
  onSelectFrame: (frameId: FrameProfileId) => void;
  onSelectMatWidth?: (matWidthId: MatWidthId) => void;
  onSelectMatColor?: (matColorId: MatColorId) => void;
  onSelectMedia?: (mediaId: number, mediaSpec: FinerWorksMediaSpec) => void;
  onSelectGlazing?: (
    glazingId: FinerWorksGlazingId,
    glazingSpec: FinerWorksGlazingSpec
  ) => void;
  onSelectFinerWorksSize?: (
    sizeId: FinerWorksStandardSizeId,
    widthIn: number,
    heightIn: number
  ) => void;
  onChangeCustomDimensions?: (widthIn: number, heightIn: number) => void;
  onFinerWorksProductSpecChange?: (spec: FinerWorksBuiltProductSpec) => void;
  onToggleBleed?: (includeBleed: boolean) => void;
  onDirectDownloadPrint?: (result: HighResPrintMasterFileResult) => void | Promise<void>;
  onOpenDownloadLicenseModal?: () => void;
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
      /finerworks|astra|gemini\s*argon|gemini\s*4|gpt-6|nano\s*banana|openrouter|openai\/[^\s,)]+|google\/[^\s,)]+/gi,
      'Atelier Vue'
    )
    .replace(/2nd-prompt/gi, 'Atelier')
    .replace(/\bprompt\b/gi, 'direction')
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

function buildMouldingRailBackground(
  spec: FinerWorksFrameMouldingSpec,
  side: 'top' | 'right' | 'bottom' | 'left'
): string {
  const p = spec.primaryHex;
  const s = spec.secondaryHex;
  const h = spec.highlightHex;
  const style: FrameMouldingProfileStyle = spec.mouldingProfileStyle || 'flat-contemporary';

  // Angle maps from outer frame edge -> inner rabbet lip for each of the 4 rails
  const angle =
    side === 'top'
      ? '180deg'
      : side === 'bottom'
      ? '0deg'
      : side === 'left'
      ? '90deg'
      : '270deg';

  if (style === 'ornate-beaded') {
    return `linear-gradient(${angle}, ${s} 0%, ${h} 16%, ${p} 34%, ${s} 50%, ${h} 68%, ${p} 84%, ${s} 100%)`;
  }
  if (style === 'italian-crown') {
    return `linear-gradient(${angle}, ${h} 0%, ${p} 30%, ${s} 52%, ${h} 58%, ${p} 86%, ${s} 100%)`;
  }
  if (style === 'sloped-bevel') {
    return `linear-gradient(${angle}, ${h} 0%, ${s} 26%, ${p} 58%, ${h} 86%, ${s} 100%)`;
  }
  if (style === 'rustic-barnwood') {
    return `linear-gradient(${angle}, ${p} 0%, ${h} 22%, ${s} 48%, ${p} 74%, ${s} 100%)`;
  }
  if (style === 'floater-l-channel') {
    return `linear-gradient(${angle}, ${h} 0%, ${p} 42%, ${s} 72%, #0E0D0C 73%, #0E0D0C 100%)`;
  }
  if (style === 'metallic-brushed') {
    return `linear-gradient(${angle}, ${h} 0%, ${p} 38%, ${s} 78%, ${h} 92%, ${s} 100%)`;
  }
  // flat-contemporary or unframed
  if (side === 'top' || side === 'left') {
    return `linear-gradient(${angle}, ${h} 0%, ${p} 58%, ${s} 100%)`;
  }
  return `linear-gradient(${angle}, ${p} 0%, ${s} 68%, ${h} 94%, ${s} 100%)`;
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
  selectedMediaId,
  selectedGlazingId,
  selectedFinerWorksSizeId,
  selectedOrientation,
  customPrintWidthIn,
  customPrintHeightIn,
  includeBleed,
  isDownloadingPrint = false,
  hasUnlockedDigitalMaster = false,
  estimatedRetailPriceUsd,
  scaleRecommendation,
  onSelectArtPiece,
  onSelectSize,
  onSelectOrientation,
  onSelectFrame,
  onSelectMatWidth,
  onSelectMatColor,
  onSelectMedia,
  onSelectGlazing,
  onSelectFinerWorksSize,
  onChangeCustomDimensions,
  onFinerWorksProductSpecChange,
  onToggleBleed,
  onDirectDownloadPrint,
  onOpenDownloadLicenseModal,
  onOpenPrintOrderModal,
  onDownloadPrint,
  onOrderPrintedVersion,
}) => {
  const [internalArtPieceIndex, setInternalArtPieceIndex] = useState<number>(
    activeArtPieceIndex ?? variation?.activeArtPieceIndex ?? 0
  );
  const [internalOrientation, setInternalOrientation] = useState<
    'landscape' | 'portrait' | 'square'
  >(selectedOrientation ?? 'portrait');
  const [internalMatWidthId, setInternalMatWidthId] = useState<MatWidthId>(
    variation?.detectedMatWidthId ?? '1.5in'
  );
  const [internalMatColorId, setInternalMatColorId] = useState<MatColorId>(
    variation?.detectedMatColorId ?? 'archival-ivory'
  );
  const [internalMediaId, setInternalMediaId] = useState<number>(
    selectedMediaId ??
      variation?.finerworksMediaId ??
      variation?.finerworksVerification?.matchedMediaId ??
      42
  );
  const [internalGlazingId, setInternalGlazingId] = useState<FinerWorksGlazingId>(
    selectedGlazingId ?? variation?.finerworksGlazingId ?? 'clear-acrylic'
  );
  const [internalFinerWorksSizeOverride, setInternalFinerWorksSizeOverride] = useState<{
    sizeId: FinerWorksStandardSizeId;
    forParentSizeId: PrintSizeId;
  } | null>(null);
  const [internalCustomWidthIn, setInternalCustomWidthIn] = useState<number>(
    customPrintWidthIn ??
      variation?.customPrintWidthIn ??
      (PRINT_SIZES[selectedSizeId]?.widthInches ?? 24)
  );
  const [internalCustomHeightIn, setInternalCustomHeightIn] = useState<number>(
    customPrintHeightIn ??
      variation?.customPrintHeightIn ??
      (PRINT_SIZES[selectedSizeId]?.heightInches ?? 36)
  );
  const [draftCustomWidth, setDraftCustomWidth] = useState<string>(
    String(
      customPrintWidthIn ??
        variation?.customPrintWidthIn ??
        (PRINT_SIZES[selectedSizeId]?.widthInches ?? 24)
    )
  );
  const [draftCustomHeight, setDraftCustomHeight] = useState<string>(
    String(
      customPrintHeightIn ??
        variation?.customPrintHeightIn ??
        (PRINT_SIZES[selectedSizeId]?.heightInches ?? 36)
    )
  );
  const [isExtendedSizesOpen, setIsExtendedSizesOpen] = useState<boolean>(false);
  const [isSpecDetailsOpen, setIsSpecDetailsOpen] = useState<boolean>(false);
  const [internalIncludeBleed, setInternalIncludeBleed] = useState<boolean>(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState<boolean>(false);
  const [lastDownloadedResult, setLastDownloadedResult] =
    useState<HighResPrintMasterFileResult | null>(null);
  const [frameCatalogMode, setFrameCatalogMode] = useState<string>('curated');
  const [frameSearchQuery, setFrameSearchQuery] = useState<string>('');

  useEffect(() => {
    if (typeof activeArtPieceIndex === 'number') {
      setInternalArtPieceIndex(activeArtPieceIndex);
    } else if (typeof variation?.activeArtPieceIndex === 'number') {
      setInternalArtPieceIndex(variation.activeArtPieceIndex);
    }
  }, [activeArtPieceIndex, variation?.activeArtPieceIndex, variation?.id]);

  useEffect(() => {
    if (typeof selectedMediaId === 'number') {
      setInternalMediaId(selectedMediaId);
    }
  }, [selectedMediaId]);

  useEffect(() => {
    if (selectedGlazingId) {
      setInternalGlazingId(selectedGlazingId);
    }
  }, [selectedGlazingId]);

  useEffect(() => {
    if (selectedOrientation) {
      setInternalOrientation(selectedOrientation);
    }
  }, [selectedOrientation]);

  useEffect(() => {
    if (typeof customPrintWidthIn === 'number') {
      setInternalCustomWidthIn(customPrintWidthIn);
      setDraftCustomWidth(String(customPrintWidthIn));
    }
  }, [customPrintWidthIn]);

  useEffect(() => {
    if (typeof customPrintHeightIn === 'number') {
      setInternalCustomHeightIn(customPrintHeightIn);
      setDraftCustomHeight(String(customPrintHeightIn));
    }
  }, [customPrintHeightIn]);

  const effectiveOrientation: 'landscape' | 'portrait' | 'square' =
    selectedOrientation ?? internalOrientation;

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

  const activeMediaId: number = selectedMediaId ?? internalMediaId;
  const activeMediaSpec: FinerWorksMediaSpec = useMemo(
    () => getFinerWorksMediaById(activeMediaId),
    [activeMediaId]
  );

  const rawMatWidthId: MatWidthId = selectedMatWidthId ?? internalMatWidthId;
  const activeMatWidthId: MatWidthId = activeMediaSpec.canMat
    ? rawMatWidthId
    : 'none';
  const activeMatColorId: MatColorId = selectedMatColorId ?? internalMatColorId;
  const activeIncludeBleed: boolean =
    includeBleed !== undefined ? includeBleed : internalIncludeBleed;

  const finerWorksFrameSpec = useMemo(
    () => getFinerWorksFrameByProfileId(activeFrameId),
    [activeFrameId]
  );

  const rawGlazingId: FinerWorksGlazingId = selectedGlazingId ?? internalGlazingId;
  const effectiveGlazingId: FinerWorksGlazingId =
    !activeMediaSpec.canGlaze ||
    !finerWorksFrameSpec.allowGlazing ||
    activeFrameId === 'unframed-canvas'
      ? 'none'
      : rawGlazingId;

  const effectiveFinerWorksSizeId: FinerWorksStandardSizeId = useMemo(() => {
    if (selectedFinerWorksSizeId) {
      return selectedFinerWorksSizeId;
    }
    if (
      internalFinerWorksSizeOverride &&
      internalFinerWorksSizeOverride.forParentSizeId === activeSizeId
    ) {
      return internalFinerWorksSizeOverride.sizeId;
    }
    return activeSizeId;
  }, [activeSizeId, internalFinerWorksSizeOverride, selectedFinerWorksSizeId]);

  const effectiveFinerWorksSizeSpec = useMemo(
    () => getFinerWorksSizeById(effectiveFinerWorksSizeId),
    [effectiveFinerWorksSizeId]
  );

  const effectivePrintWidthIn: number = useMemo(() => {
    let rawW =
      effectiveFinerWorksSizeId === 'custom'
        ? customPrintWidthIn ?? internalCustomWidthIn
        : customPrintWidthIn ?? effectiveFinerWorksSizeSpec.widthInches;
    const rawH =
      effectiveFinerWorksSizeId === 'custom'
        ? customPrintHeightIn ?? internalCustomHeightIn
        : customPrintHeightIn ?? effectiveFinerWorksSizeSpec.heightInches;
    if (
      effectiveFinerWorksSizeId !== 'custom' &&
      customPrintWidthIn === undefined &&
      customPrintHeightIn === undefined
    ) {
      if (effectiveOrientation === 'landscape') {
        rawW = Math.max(rawW, rawH);
      } else if (effectiveOrientation === 'square') {
        rawW = Math.min(rawW, rawH);
      } else {
        rawW = Math.min(rawW, rawH);
      }
    }
    return Math.max(
      activeMediaSpec.minWidthIn,
      Math.min(activeMediaSpec.maxWidthIn, rawW)
    );
  }, [
    activeMediaSpec.maxWidthIn,
    activeMediaSpec.minWidthIn,
    customPrintHeightIn,
    customPrintWidthIn,
    effectiveFinerWorksSizeId,
    effectiveFinerWorksSizeSpec.heightInches,
    effectiveFinerWorksSizeSpec.widthInches,
    effectiveOrientation,
    internalCustomHeightIn,
    internalCustomWidthIn,
  ]);

  const effectivePrintHeightIn: number = useMemo(() => {
    const rawW =
      effectiveFinerWorksSizeId === 'custom'
        ? customPrintWidthIn ?? internalCustomWidthIn
        : customPrintWidthIn ?? effectiveFinerWorksSizeSpec.widthInches;
    let rawH =
      effectiveFinerWorksSizeId === 'custom'
        ? customPrintHeightIn ?? internalCustomHeightIn
        : customPrintHeightIn ?? effectiveFinerWorksSizeSpec.heightInches;
    if (
      effectiveFinerWorksSizeId !== 'custom' &&
      customPrintWidthIn === undefined &&
      customPrintHeightIn === undefined
    ) {
      if (effectiveOrientation === 'landscape') {
        rawH = Math.min(rawW, rawH);
      } else if (effectiveOrientation === 'square') {
        rawH = Math.min(rawW, rawH);
      } else {
        rawH = Math.max(rawW, rawH);
      }
    }
    return Math.max(
      activeMediaSpec.minHeightIn,
      Math.min(activeMediaSpec.maxHeightIn, rawH)
    );
  }, [
    activeMediaSpec.maxHeightIn,
    activeMediaSpec.minHeightIn,
    customPrintHeightIn,
    customPrintWidthIn,
    effectiveFinerWorksSizeId,
    effectiveFinerWorksSizeSpec.heightInches,
    effectiveFinerWorksSizeSpec.widthInches,
    effectiveOrientation,
    internalCustomHeightIn,
    internalCustomWidthIn,
  ]);

  const liveBuiltProductSpec: FinerWorksBuiltProductSpec = useMemo(
    () =>
      buildFinerWorksProductSpec({
        productTypeId: activeMediaSpec.productTypeId,
        mediaId: activeMediaSpec.mediaId,
        styleId: activeMediaSpec.defaultStyleId,
        printWidthIn: effectivePrintWidthIn,
        printHeightIn: effectivePrintHeightIn,
        frameProfileId: activeFrameId,
        finerworksFrameId: finerWorksFrameSpec.finerworksFrameId,
        matWidthId: activeMatWidthId,
        matColorId: activeMatColorId,
        glazingId: effectiveGlazingId,
      }),
    [
      activeFrameId,
      activeMatColorId,
      activeMatWidthId,
      activeMediaSpec.defaultStyleId,
      activeMediaSpec.mediaId,
      activeMediaSpec.productTypeId,
      effectiveGlazingId,
      effectivePrintHeightIn,
      effectivePrintWidthIn,
      finerWorksFrameSpec.finerworksFrameId,
    ]
  );

  useEffect(() => {
    onFinerWorksProductSpecChange?.(liveBuiltProductSpec);
  }, [liveBuiltProductSpec, onFinerWorksProductSpecChange]);

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

  const [cleanInnerPrintUrl, setCleanInnerPrintUrl] = useState<string>(activePrintUrl);

  useEffect(() => {
    let cancelled = false;
    setCleanInnerPrintUrl(activePrintUrl);
    if (
      activePrintUrl &&
      activePrintUrl.startsWith('data:image/') &&
      !activePrintUrl.startsWith('data:image/svg+xml')
    ) {
      stripOuterFrameAndMatFromArtworkDataUrl(activePrintUrl, {
        frameId:
          selectedPiece?.detectedFrameId ??
          variation?.detectedFrameId ??
          activeFrameId,
        matWidthId:
          selectedPiece?.detectedMatWidthId ??
          variation?.detectedMatWidthId ??
          activeMatWidthId,
        onlyStripIfBorderDetected: true,
      })
        .then((cleanedResult) => {
          if (!cancelled && cleanedResult?.dataUrl) {
            setCleanInnerPrintUrl(cleanedResult.dataUrl);
          }
        })
        .catch(() => {
          // keep activePrintUrl on fallback
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    activePrintUrl,
    selectedPiece?.detectedFrameId,
    selectedPiece?.detectedMatWidthId,
    variation?.detectedFrameId,
    variation?.detectedMatWidthId,
    activeFrameId,
    activeMatWidthId,
  ]);

  const visibleFrameSpecs: FinerWorksFrameMouldingSpec[] = useMemo(() => {
    const query = frameSearchQuery.trim().toLowerCase();
    const canonicalSpecs = ORDERED_FRAME_IDS.map((id) =>
      getFinerWorksFrameByProfileId(id)
    );

    let pool: FinerWorksFrameMouldingSpec[];
    if (frameCatalogMode === 'curated' && !query) {
      const activeSpec = getFinerWorksFrameByProfileId(activeFrameId);
      const isCanonical = ORDERED_FRAME_IDS.includes(activeSpec.profileId);
      pool = isCanonical ? canonicalSpecs : [activeSpec, ...canonicalSpecs];
    } else if (frameCatalogMode === 'all' || (frameCatalogMode === 'curated' && query)) {
      pool = FINERWORKS_FRAME_MOULDINGS;
    } else {
      const collectionFrames = FINERWORKS_ALL_231_FRAMES.filter(
        (f) => f.collectionSlug === frameCatalogMode
      );
      pool = collectionFrames.length > 0 ? collectionFrames : FINERWORKS_FRAME_MOULDINGS;
    }

    if (!query) {
      return pool;
    }

    return pool.filter((f) => {
      const haystack = `${f.name} ${f.sku || ''} ${f.finerworksFrameId} ${
        f.collectionName || ''
      } ${f.materialDescription}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeFrameId, frameCatalogMode, frameSearchQuery]);

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

  const isExtendedOrCustomSizeActive =
    effectiveFinerWorksSizeId !== activeSizeId ||
    effectiveOrientation !== 'portrait' ||
    typeof customPrintWidthIn === 'number' ||
    typeof customPrintHeightIn === 'number';

  const fidelityMetrics = useMemo(
    () =>
      computeSideBySideFidelityMetrics(
        activeSizeId,
        activeIncludeBleed,
        isExtendedOrCustomSizeActive ? effectivePrintWidthIn : undefined,
        isExtendedOrCustomSizeActive ? effectivePrintHeightIn : undefined
      ),
    [
      activeSizeId,
      activeIncludeBleed,
      isExtendedOrCustomSizeActive,
      effectivePrintWidthIn,
      effectivePrintHeightIn,
    ]
  );

  const handleSelectOrientation = (
    nextOrientation: 'landscape' | 'portrait' | 'square'
  ) => {
    setInternalOrientation(nextOrientation);
    onSelectOrientation?.(nextOrientation);
    if (
      effectiveFinerWorksSizeId === 'custom' ||
      typeof customPrintWidthIn === 'number' ||
      typeof customPrintHeightIn === 'number'
    ) {
      const curW = customPrintWidthIn ?? internalCustomWidthIn;
      const curH = customPrintHeightIn ?? internalCustomHeightIn;
      const nextW =
        nextOrientation === 'landscape'
          ? Math.max(curW, curH)
          : nextOrientation === 'square'
          ? Math.min(curW, curH)
          : Math.min(curW, curH);
      const nextH =
        nextOrientation === 'landscape'
          ? Math.min(curW, curH)
          : nextOrientation === 'square'
          ? Math.min(curW, curH)
          : Math.max(curW, curH);
      setInternalCustomWidthIn(nextW);
      setInternalCustomHeightIn(nextH);
      setDraftCustomWidth(String(nextW));
      setDraftCustomHeight(String(nextH));
      onChangeCustomDimensions?.(nextW, nextH);
    }
  };

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
    if (
      activeFrameId === 'unframed-canvas' ||
      finerWorksFrameSpec.thicknessInches <= 0
    ) {
      return 0;
    }
    return Math.max(
      10,
      Math.round(
        (finerWorksFrameSpec.thicknessInches / Math.max(8, effectivePrintWidthIn)) *
          230
      )
    );
  }, [
    activeFrameId,
    effectivePrintWidthIn,
    finerWorksFrameSpec.thicknessInches,
  ]);

  const effectiveMatPaddingPx = useMemo(() => {
    if (activeMatWidthId === 'none' || !activeMediaSpec.canMat) return 0;
    return matWidthSpec.paddingPx;
  }, [activeMatWidthId, activeMediaSpec.canMat, matWidthSpec.paddingPx]);

  const handleSelectPiece = (idx: number, piece: GeneratedArtPiece) => {
    setInternalArtPieceIndex(idx);
    onSelectArtPiece?.(idx, piece);
  };

  const handleSelectCoreSize = (sizeId: PrintSizeId) => {
    const spec = PRINT_SIZES[sizeId];
    setInternalFinerWorksSizeOverride(null);
    setInternalCustomWidthIn(spec.widthInches);
    setInternalCustomHeightIn(spec.heightInches);
    setDraftCustomWidth(String(spec.widthInches));
    setDraftCustomHeight(String(spec.heightInches));
    onSelectSize(sizeId);
    onSelectFinerWorksSize?.(sizeId, spec.widthInches, spec.heightInches);
  };

  const handleSelectExtendedFinerWorksSize = (
    fwSizeId: FinerWorksStandardSizeId
  ) => {
    const fwSpec = getFinerWorksSizeById(fwSizeId);
    setInternalFinerWorksSizeOverride({
      sizeId: fwSizeId,
      forParentSizeId: fwSpec.legacySizeId,
    });
    if (fwSizeId !== 'custom') {
      setInternalCustomWidthIn(fwSpec.widthInches);
      setInternalCustomHeightIn(fwSpec.heightInches);
      setDraftCustomWidth(String(fwSpec.widthInches));
      setDraftCustomHeight(String(fwSpec.heightInches));
      onSelectSize(fwSpec.legacySizeId);
      onSelectFinerWorksSize?.(fwSizeId, fwSpec.widthInches, fwSpec.heightInches);
    } else {
      const clampedW = Math.max(
        activeMediaSpec.minWidthIn,
        Math.min(activeMediaSpec.maxWidthIn, internalCustomWidthIn)
      );
      const clampedH = Math.max(
        activeMediaSpec.minHeightIn,
        Math.min(activeMediaSpec.maxHeightIn, internalCustomHeightIn)
      );
      onSelectSize(fwSpec.legacySizeId);
      onSelectFinerWorksSize?.('custom', clampedW, clampedH);
    }
  };

  const handleApplyCustomDimensions = () => {
    const parsedW = Number(draftCustomWidth);
    const parsedH = Number(draftCustomHeight);
    const clampedW = Math.max(
      activeMediaSpec.minWidthIn,
      Math.min(
        activeMediaSpec.maxWidthIn,
        Number.isFinite(parsedW) && parsedW > 0 ? parsedW : effectivePrintWidthIn
      )
    );
    const clampedH = Math.max(
      activeMediaSpec.minHeightIn,
      Math.min(
        activeMediaSpec.maxHeightIn,
        Number.isFinite(parsedH) && parsedH > 0 ? parsedH : effectivePrintHeightIn
      )
    );
    setInternalCustomWidthIn(clampedW);
    setInternalCustomHeightIn(clampedH);
    setDraftCustomWidth(String(clampedW));
    setDraftCustomHeight(String(clampedH));
    setInternalFinerWorksSizeOverride({
      sizeId: 'custom',
      forParentSizeId: activeSizeId,
    });
    onChangeCustomDimensions?.(clampedW, clampedH);
    onSelectFinerWorksSize?.('custom', clampedW, clampedH);
  };

  const handleSelectMediaSpec = (media: FinerWorksMediaSpec) => {
    setInternalMediaId(media.mediaId);
    onSelectMedia?.(media.mediaId, media);
    if (!media.canMat) {
      setInternalMatWidthId('none');
      onSelectMatWidth?.('none');
      setInternalGlazingId('none');
      onSelectGlazing?.('none', getFinerWorksGlazingById('none'));
    }
  };

  const handleSelectGlazingOption = (glazingSpec: FinerWorksGlazingSpec) => {
    setInternalGlazingId(glazingSpec.glazingId);
    onSelectGlazing?.(glazingSpec.glazingId, glazingSpec);
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
        identicalPrintDataUrl: cleanInnerPrintUrl || activePrintUrl,
        sizeId: activeSizeId,
        includeBleed: activeIncludeBleed,
        title: activeTitle,
        customWidthIn: isExtendedOrCustomSizeActive ? effectivePrintWidthIn : undefined,
        customHeightIn: isExtendedOrCustomSizeActive ? effectivePrintHeightIn : undefined,
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
        <div className="flex w-full max-w-5xl flex-col items-center justify-center">
          <div className="flex w-full flex-col items-center justify-center gap-6 lg:flex-row lg:items-center lg:justify-center">
            {/* Outer Museum Frame Moulding */}
            <div
              data-testid="framed-print-preview"
              data-frame-id={activeFrameId}
              data-size-id={activeSizeId}
              data-mat-width={activeMatWidthId}
              data-piece-index={clampedPieceIndex}
              data-media-id={activeMediaSpec.mediaId}
              data-glazing-id={effectiveGlazingId}
              data-product-code={liveBuiltProductSpec.productCode}
              data-moulding-style={finerWorksFrameSpec.mouldingProfileStyle || 'flat-contemporary'}
              style={{
                transform: `scale(${previewScaleRatio})`,
                transformOrigin: 'center center',
                borderWidth: `${mouldingBorderPx}px`,
                borderStyle: mouldingBorderPx > 0 ? 'solid' : 'none',
                borderColor: frameSpec.primaryHex,
                backgroundColor: finerWorksFrameSpec.isFloatFrame
                  ? '#1F1C18'
                  : effectiveMatPaddingPx > 0
                  ? matColorSpec.hex
                  : frameSpec.highlightHex,
                padding: finerWorksFrameSpec.isFloatFrame ? '7px' : '0px',
                boxShadow:
                  activeFrameId === 'unframed-canvas'
                    ? '0 18px 38px rgba(31, 28, 24, 0.20), 4px 6px 0px #DFD7C8'
                    : `0 24px 52px rgba(31, 28, 24, 0.30), inset 0 0 0 2px ${frameSpec.secondaryHex}, inset 0 0 0 3px ${frameSpec.highlightHex}`,
              }}
              className="relative transition-all duration-300 ease-out"
            >
              {/* 4-Rail 45° Mitered Museum Moulding Overlay (Sits over the outer frame border with authentic bevel & corner join geometry) */}
              {mouldingBorderPx > 0 && (
                <div
                  data-testid="mitered-frame-rails-overlay"
                  style={{
                    position: 'absolute',
                    inset: `-${mouldingBorderPx}px`,
                    pointerEvents: 'none',
                    zIndex: 15,
                  }}
                >
                  {/* Top Mitered Rail */}
                  <div
                    data-testid="mitered-rail-top"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: `${mouldingBorderPx}px`,
                      background: buildMouldingRailBackground(finerWorksFrameSpec, 'top'),
                      clipPath: `polygon(0 0, 100% 0, calc(100% - ${mouldingBorderPx}px) 100%, ${mouldingBorderPx}px 100%)`,
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.28), inset 0 -1px 2px rgba(0,0,0,0.35)',
                    }}
                  />
                  {/* Bottom Mitered Rail */}
                  <div
                    data-testid="mitered-rail-bottom"
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${mouldingBorderPx}px`,
                      background: buildMouldingRailBackground(finerWorksFrameSpec, 'bottom'),
                      clipPath: `polygon(${mouldingBorderPx}px 0, calc(100% - ${mouldingBorderPx}px) 0, 100% 100%, 0 100%)`,
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.20), inset 0 -2px 3px rgba(0,0,0,0.45)',
                    }}
                  />
                  {/* Left Mitered Rail */}
                  <div
                    data-testid="mitered-rail-left"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `${mouldingBorderPx}px`,
                      background: buildMouldingRailBackground(finerWorksFrameSpec, 'left'),
                      clipPath: `polygon(0 0, ${mouldingBorderPx}px ${mouldingBorderPx}px, ${mouldingBorderPx}px calc(100% - ${mouldingBorderPx}px), 0 100%)`,
                      boxShadow: 'inset 1px 0 1px rgba(255,255,255,0.25), inset -1px 0 2px rgba(0,0,0,0.32)',
                    }}
                  />
                  {/* Right Mitered Rail */}
                  <div
                    data-testid="mitered-rail-right"
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: `${mouldingBorderPx}px`,
                      background: buildMouldingRailBackground(finerWorksFrameSpec, 'right'),
                      clipPath: `polygon(100% 0, 100% 100%, calc(100% - ${mouldingBorderPx}px) calc(100% - ${mouldingBorderPx}px), calc(100% - ${mouldingBorderPx}px) ${mouldingBorderPx}px)`,
                      boxShadow: 'inset -2px 0 3px rgba(0,0,0,0.42), inset 1px 0 1px rgba(255,255,255,0.18)',
                    }}
                  />
                  {/* Inner Rabbet Lip Shadow Ring */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: `${mouldingBorderPx}px`,
                      boxShadow: `inset 0 2px 5px rgba(0,0,0,0.34), 0 0 0 1px ${finerWorksFrameSpec.secondaryHex}`,
                    }}
                  />
                </div>
              )}

              {/* Floater Frame Shadow Gap Channel (0.35" Open Shadow Gap) */}
              {finerWorksFrameSpec.isFloatFrame && (
                <div
                  data-testid="floater-frame-shadow-gap"
                  data-float-offset-inches={finerWorksFrameSpec.floatOffsetInches}
                  className="pointer-events-none absolute inset-0 border-4 border-[#0E0D0C] shadow-inner"
                />
              )}

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
                        : finerWorksFrameSpec.isFloatFrame
                        ? '0 0 0 1px rgba(0,0,0,0.65)'
                        : 'none',
                  }}
                  className="relative overflow-hidden bg-[#FAF6EE]"
                >
                  {/* Subtle Optical Glazing Reflection Overlay */}
                  {effectiveGlazingId !== 'none' && (
                    <div
                      data-testid="framed-glazing-reflection-overlay"
                      data-glazing-type={effectiveGlazingId}
                      style={{
                        background:
                          effectiveGlazingId === 'non-glare-museum-acrylic'
                            ? 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 45%, transparent 70%)'
                            : 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 42%, transparent 65%)',
                      }}
                      className="pointer-events-none absolute inset-0 z-10"
                    />
                  )}

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
                    src={cleanInnerPrintUrl || activePrintUrl}
                    alt={`${activeTitle} — ${sizeSpec.labelInches} in ${frameSpec.name}`}
                    className={
                      selectedOrientation === 'landscape'
                        ? 'block h-48 w-64 object-cover sm:h-56 sm:w-72'
                        : selectedOrientation === 'square'
                        ? 'block h-56 w-56 object-cover sm:h-60 sm:w-60'
                        : selectedOrientation === 'portrait'
                        ? 'block h-56 w-44 object-cover sm:h-64 sm:w-52'
                        : (selectedPiece?.internalBounds ?? variation?.detectedCropBox)
                        ? (selectedPiece?.internalBounds ?? variation!.detectedCropBox).xmax -
                            (selectedPiece?.internalBounds ?? variation!.detectedCropBox).xmin >=
                          (selectedPiece?.internalBounds ?? variation!.detectedCropBox).ymax -
                            (selectedPiece?.internalBounds ?? variation!.detectedCropBox).ymin
                          ? 'block h-48 w-64 object-cover sm:h-56 sm:w-72'
                          : 'block h-56 w-44 object-cover sm:h-64 sm:w-52'
                        : 'block h-48 w-64 object-cover sm:h-56 sm:w-72'
                    }
                  />
                </div>
              </div>
            </div>

            {/* Active Moulding 3D Corner Sample Reference Card (Real Catalogue Photograph) */}
            {finerWorksFrameSpec.cornerImageUrl && (
              <div
                data-testid="active-frame-corner-sample-card"
                className="flex w-full max-w-[230px] shrink-0 flex-col rounded-xl border border-[#DFD7C8] bg-[#FAF6EE]/95 p-3 shadow-xs"
              >
                <div className="mb-1.5 flex items-center justify-between gap-1.5">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9E5A3C]">
                    3D Corner Sample
                  </span>
                  <span className="rounded bg-[#1F1C18] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#FAF6EE]">
                    SKU {finerWorksFrameSpec.sku || `AV-${finerWorksFrameSpec.finerworksFrameId}`}
                  </span>
                </div>
                <div className="relative h-28 w-full overflow-hidden rounded-lg border border-[#DFD7C8] bg-[#EFE9DC]">
                  <img
                    data-testid="active-frame-corner-sample-img"
                    src={finerWorksFrameSpec.cornerImageUrl}
                    alt={`${frameSpec.name} 3D Corner Sample`}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-2 truncate font-serif text-xs font-semibold text-[#1F1C18]">
                  {sanitizeDisplayCopy(frameSpec.name, frameSpec.name)}
                </p>
                <p className="truncate font-mono text-[10px] text-[#655B50]">
                  {sanitizeDisplayCopy(
                    finerWorksFrameSpec.collectionName || 'Curated Gallery Moulding',
                    'Curated Gallery Moulding'
                  )}
                </p>
                <p className="mt-1 font-mono text-[10px] text-[#4A3B32]">
                  {finerWorksFrameSpec.thicknessInches}&quot; face ·{' '}
                  {finerWorksFrameSpec.depthInches}&quot; depth ·{' '}
                  {finerWorksFrameSpec.rabbetInches}&quot; rabbet
                </p>
              </div>
            )}
          </div>

          {/* Physical Frame Footprint Pill */}
          <div
            data-testid="finerworks-physical-footprint-pill"
            className="mt-4 rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3.5 py-1.5 font-mono text-[11px] font-medium text-[#1F1C18] shadow-2xs text-center"
          >
            Outer Frame: {liveBuiltProductSpec.physicalDimensions.frameOuterWidthIn}&quot; ×{' '}
            {liveBuiltProductSpec.physicalDimensions.frameOuterHeightIn}&quot; · Print:{' '}
            {liveBuiltProductSpec.physicalDimensions.printWidthIn}&quot; ×{' '}
            {liveBuiltProductSpec.physicalDimensions.printHeightIn}&quot; · Moulding:{' '}
            {finerWorksFrameSpec.thicknessInches}&quot; face /{' '}
            {finerWorksFrameSpec.rabbetInches}&quot; rabbet · 300 PPI Optimal
          </div>

          {/* Live Spec Caption Pill Under Frame */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 font-mono text-xs font-medium text-[#1F1C18] shadow-2xs">
              {fidelityMetrics.labelInches} ({fidelityMetrics.labelCm}) · {fidelityMetrics.widthPx}×
              {fidelityMetrics.heightPx} px @ {fidelityMetrics.dpi} DPI
            </span>
            <span
              data-testid="archival-300dpi-qc-badge"
              className="rounded-full border border-[#2E4A3E]/35 bg-[#2E4A3E]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[#2E4A3E] shadow-2xs"
            >
              ✓ 300 DPI Archival Quality Verified · Zero-Grain High-Definition Master up to 40&quot; × 60&quot;
            </span>
            <span
              data-testid="source-optical-ppi-badge"
              className="rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 font-mono text-[11px] font-medium text-[#4A3B32] shadow-2xs"
            >
              Optical Source: ~{Math.max(1, Math.round(1200 / Math.max(1, effectivePrintWidthIn)))} PPI → Upscaled 300-DPI PNG (pHYs 11811 ppm)
            </span>
            <span className="rounded-full border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1 text-xs text-[#655B50] shadow-2xs">
              {frameSpec.name} · {activeMediaSpec.shortName}
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
                  onClick={() => handleSelectCoreSize(recommendedSizeId)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#9E5A3C] px-3.5 py-2 text-xs font-semibold text-[#FAF6EE] shadow-2xs transition-all hover:bg-[#874B30]"
                >
                  Select Recommended Size ({recommendedDimensionsLabel})
                </button>
              ) : (
                <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#9E5A3C]/35 bg-[#FAF6EE] px-3 py-1.5 font-mono text-[11px] font-medium text-[#9E5A3C]">
                  ✓ Active Size Matches Your Room Measurements
                </span>
              )}
            </div>
          </div>
        )}

        {/* Archival Media / Substrate Selector */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
              Archival Media &amp; Substrate ({activeMediaSpec.shortName})
            </label>
            <span className="font-mono text-[11px] text-[#655B50]">
              Archival Media #{activeMediaSpec.mediaId} · {activeMediaSpec.gsmOrThicknessLabel}
            </span>
          </div>

          <div
            data-testid="finerworks-media-scroller"
            className="flex gap-2.5 overflow-x-auto snap-x pb-1.5"
          >
            {FINERWORKS_MEDIA_SPECS.map((media) => {
              const isSelected = activeMediaSpec.mediaId === media.mediaId;
              return (
                <button
                  key={media.mediaId}
                  type="button"
                  data-testid={`finerworks-media-btn-${media.mediaId}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectMediaSpec(media)}
                  className={`flex min-h-[44px] min-w-[175px] snap-start shrink-0 flex-col items-start justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                    isSelected
                      ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE] shadow-xs'
                      : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50 hover:bg-[#F5F0E6]'
                  }`}
                >
                  <span className="text-xs font-semibold leading-snug">
                    {media.shortName}
                  </span>
                  <div className="mt-1 flex w-full items-center justify-between gap-2 font-mono text-[10px]">
                    <span className={isSelected ? 'text-[#DFD7C8]' : 'text-[#655B50]'}>
                      {media.gsmOrThicknessLabel}
                    </span>
                    <span className={isSelected ? 'text-[#FAF6EE]/75' : 'text-[#9E5A3C]'}>
                      {media.surfaceFinish}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {!activeMediaSpec.canMat && (
            <div
              data-testid="finerworks-canvas-compatibility-notice"
              className="mt-2 rounded-xl border border-[#9E5A3C]/40 bg-[#F5F0E6] px-3.5 py-2 text-xs text-[#4A3B32]"
            >
              Archival Note: Stretched Canvas, ChromaLuxe Metal &amp; Face-Mounted Acrylic
              editions are mounted without paper mat board or front acrylic glazing per
              Atelier Vue museum standards.
            </div>
          )}
        </div>

        {/* 1. Physical Print Size Scroller */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
              1. Select Archival Print Size ({sizeSpec.scaleDescription})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div
                data-testid="print-orientation-selector"
                className="inline-flex items-center gap-1 rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-1"
              >
                {(['portrait', 'landscape', 'square'] as const).map((orient) => {
                  const isOrientSelected = effectiveOrientation === orient;
                  return (
                    <button
                      key={orient}
                      type="button"
                      data-testid={`orientation-btn-${orient}`}
                      aria-pressed={isOrientSelected}
                      onClick={() => handleSelectOrientation(orient)}
                      className={`min-h-[44px] rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                        isOrientSelected
                          ? 'bg-[#1F1C18] text-[#FAF6EE]'
                          : 'text-[#4A3B32] hover:bg-[#DFD7C8]/50'
                      }`}
                    >
                      {orient}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                data-testid="toggle-extended-finerworks-sizes-btn"
                aria-expanded={isExtendedSizesOpen}
                onClick={() => setIsExtendedSizesOpen((prev) => !prev)}
                className="min-h-[44px] rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#1F1C18] hover:bg-[#DFD7C8]/60 transition-colors cursor-pointer"
              >
                {isExtendedSizesOpen
                  ? 'All 10 Archival Sizes & Custom Exact-Inch Sizing ▴'
                  : 'All 10 Archival Sizes & Custom Exact-Inch Sizing ▾'}
              </button>
            </div>
          </div>

          <div
            data-testid="size-scroller-strip"
            className="overflow-x-auto snap-x"
          >
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
                    onClick={() => handleSelectCoreSize(sizeId)}
                    className={`flex min-h-[44px] min-w-[156px] snap-start shrink-0 flex-col items-start justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE] shadow-xs'
                        : isRecommended
                        ? 'border-[#9E5A3C] bg-[#F5F0E6] text-[#1F1C18] ring-1 ring-[#9E5A3C]/40 hover:bg-[#EFE9DC]'
                        : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50 hover:bg-[#F5F0E6]'
                    }`}
                  >
                    <div
                      data-testid={`size-option-btn-${sizeId}`}
                      className="flex min-h-[44px] w-full flex-col items-start justify-between"
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
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extended 10 FinerWorks Standard Sizes + Custom Exact-Inch Sizing Panel */}
          {isExtendedSizesOpen && (
            <div
              data-testid="extended-finerworks-sizes-panel"
              className="mt-3 rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-3.5 space-y-3"
            >
              <div className="flex flex-wrap gap-2">
                {FINERWORKS_SIZE_OPTIONS.map((fwSize) => {
                  const isFwSelected = effectiveFinerWorksSizeId === fwSize.id;
                  return (
                    <button
                      key={fwSize.id}
                      type="button"
                      data-testid={`finerworks-size-btn-${fwSize.id}`}
                      aria-pressed={isFwSelected}
                      onClick={() => handleSelectExtendedFinerWorksSize(fwSize.id)}
                      className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-left text-xs transition-all ${
                        isFwSelected
                          ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE]'
                          : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] hover:border-[#9E5A3C]/50'
                      }`}
                    >
                      <span className="font-semibold">{fwSize.labelInches}</span>{' '}
                      <span
                        className={`font-mono text-[10px] ${
                          isFwSelected ? 'text-[#DFD7C8]' : 'text-[#655B50]'
                        }`}
                      >
                        ({fwSize.scaleCategory})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-end gap-2.5 border-t border-[#DFD7C8] pt-3">
                <div>
                  <label
                    htmlFor="finerworks-custom-width-input"
                    className="block font-mono text-[10px] font-semibold uppercase text-[#4A3B32]"
                  >
                    Custom Width (in · {activeMediaSpec.minWidthIn}&quot;–{activeMediaSpec.maxWidthIn}&quot;)
                  </label>
                  <input
                    id="finerworks-custom-width-input"
                    data-testid="finerworks-custom-width-input"
                    type="number"
                    min={activeMediaSpec.minWidthIn}
                    max={activeMediaSpec.maxWidthIn}
                    step="0.5"
                    value={draftCustomWidth}
                    onChange={(e) => setDraftCustomWidth(e.target.value)}
                    className="mt-1 min-h-[44px] w-28 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 font-mono text-xs text-[#1F1C18]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="finerworks-custom-height-input"
                    className="block font-mono text-[10px] font-semibold uppercase text-[#4A3B32]"
                  >
                    Custom Height (in · {activeMediaSpec.minHeightIn}&quot;–{activeMediaSpec.maxHeightIn}&quot;)
                  </label>
                  <input
                    id="finerworks-custom-height-input"
                    data-testid="finerworks-custom-height-input"
                    type="number"
                    min={activeMediaSpec.minHeightIn}
                    max={activeMediaSpec.maxHeightIn}
                    step="0.5"
                    value={draftCustomHeight}
                    onChange={(e) => setDraftCustomHeight(e.target.value)}
                    className="mt-1 min-h-[44px] w-28 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 font-mono text-xs text-[#1F1C18]"
                  />
                </div>
                <button
                  type="button"
                  data-testid="apply-custom-dimensions-btn"
                  onClick={handleApplyCustomDimensions}
                  className="min-h-[44px] rounded-xl bg-[#9E5A3C] px-4 py-2 text-xs font-semibold text-[#FAF6EE] hover:bg-[#874B30] transition-colors cursor-pointer"
                >
                  Apply Exact-Inch Size
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Museum Frame Moulding Scroller (Curated Signatures + All 27 Collections / 231 Mouldings with Real 3D Corner Samples) */}
        <div>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
                2. Select Museum Frame Moulding ({FINERWORKS_FRAME_COLLECTIONS.length} Collections ·{' '}
                {FINERWORKS_ALL_231_FRAMES.length} Mouldings)
              </label>
              <p className="text-[11px] text-[#655B50]">
                Active: {sanitizeDisplayCopy(frameSpec.name, frameSpec.name)} · SKU{' '}
                {finerWorksFrameSpec.sku || `AV-${finerWorksFrameSpec.finerworksFrameId}`} ·{' '}
                {sanitizeDisplayCopy(
                  finerWorksFrameSpec.collectionName || 'Curated Gallery Moulding',
                  'Curated Gallery Moulding'
                )}
              </p>
            </div>
            <span className="rounded-full border border-[#DFD7C8] bg-[#F5F0E6] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#4A3B32]">
              Showing {visibleFrameSpecs.length} Moulding{visibleFrameSpecs.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* 27-Collection & 231-Frame Filter Bar */}
          <div
            data-testid="frame-collection-filter-bar"
            className="mb-3 flex flex-col gap-2 rounded-xl border border-[#DFD7C8] bg-[#F5F0E6]/75 p-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="frame-filter-curated"
                aria-pressed={frameCatalogMode === 'curated' && !frameSearchQuery}
                onClick={() => {
                  setFrameCatalogMode('curated');
                  setFrameSearchQuery('');
                }}
                className={`min-h-[44px] rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                  frameCatalogMode === 'curated' && !frameSearchQuery
                    ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] hover:border-[#9E5A3C]/50'
                }`}
              >
                Curated Signatures (6)
              </button>

              <button
                type="button"
                data-testid="frame-filter-all-231"
                aria-pressed={frameCatalogMode === 'all'}
                onClick={() => {
                  setFrameCatalogMode('all');
                }}
                className={`min-h-[44px] rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                  frameCatalogMode === 'all'
                    ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE]'
                    : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#1F1C18] hover:border-[#9E5A3C]/50'
                }`}
              >
                All {FINERWORKS_ALL_231_FRAMES.length} Catalogue Mouldings ({FINERWORKS_FRAME_COLLECTIONS.length} Collections)
              </button>

              <select
                aria-label="Filter frame mouldings by collection"
                data-testid="frame-collection-select"
                value={frameCatalogMode}
                onChange={(e) => setFrameCatalogMode(e.target.value)}
                className="min-h-[44px] rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 font-mono text-[11px] font-medium text-[#1F1C18]"
              >
                <option value="curated">Curated Signatures (6 Mouldings)</option>
                <option value="all">
                  All {FINERWORKS_FRAME_COLLECTIONS.length} Collections ({FINERWORKS_ALL_231_FRAMES.length} Mouldings)
                </option>
                {FINERWORKS_FRAME_COLLECTIONS.map((col) => (
                  <option key={col.collectionId} value={col.slug}>
                    {sanitizeDisplayCopy(col.title, col.title)} ({col.frameCount} Mouldings)
                  </option>
                ))}
              </select>

              <input
                type="search"
                aria-label="Search frame mouldings by name, SKU, or finish"
                data-testid="frame-catalog-search-input"
                placeholder="Search SKU, walnut, gold, barnwood, float..."
                value={frameSearchQuery}
                onChange={(e) => setFrameSearchQuery(e.target.value)}
                className="min-h-[44px] min-w-[210px] flex-1 rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 font-mono text-[11px] text-[#1F1C18] placeholder:text-[#655B50]/70"
              />
            </div>

            {/* Horizontal 27-Collection Quick-Filter Strip */}
            <div
              data-testid="frame-collections-pill-strip"
              className="flex gap-1.5 overflow-x-auto snap-x pb-1"
            >
              {FINERWORKS_FRAME_COLLECTIONS.map((col) => {
                const isActiveCol = frameCatalogMode === col.slug;
                return (
                  <button
                    key={col.collectionId}
                    type="button"
                    data-testid={`frame-collection-pill-${col.slug}`}
                    aria-pressed={isActiveCol}
                    onClick={() => setFrameCatalogMode(col.slug)}
                    className={`min-h-[44px] shrink-0 snap-start rounded-lg border px-2.5 py-1 font-mono text-[10px] font-medium transition-colors cursor-pointer ${
                      isActiveCol
                        ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE]'
                        : 'border-[#DFD7C8] bg-[#FAF6EE] text-[#4A3B32] hover:border-[#9E5A3C]/50'
                    }`}
                  >
                    {sanitizeDisplayCopy(col.title, col.title)} ({col.frameCount})
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-testid="frame-scroller-strip"
            className="overflow-x-auto snap-x"
          >
            <div
              data-testid="frame-scroller"
              className="flex gap-2.5 overflow-x-auto snap-x pb-1.5"
            >
              {visibleFrameSpecs.map((fwFrame) => {
                const frameId = fwFrame.profileId;
                const spec = FRAME_PROFILES[frameId] ?? fwFrame;
                const isSelected = activeFrameId === frameId;
                const detectedFrameForPiece =
                  selectedPiece?.detectedFrameId ?? variation?.detectedFrameId;
                const isAiMatchedFrame = detectedFrameForPiece === frameId;

                const frameOptionSpec = buildFinerWorksProductSpec({
                  productTypeId: activeMediaSpec.productTypeId,
                  mediaId: activeMediaSpec.mediaId,
                  styleId: activeMediaSpec.defaultStyleId,
                  printWidthIn: effectivePrintWidthIn,
                  printHeightIn: effectivePrintHeightIn,
                  frameProfileId: frameId,
                  finerworksFrameId: fwFrame.finerworksFrameId,
                  matWidthId: activeMatWidthId,
                  matColorId: activeMatColorId,
                  glazingId: effectiveGlazingId,
                });
                const framePriceDelta =
                  Math.round((frameOptionSpec.pricing.addFramePriceUsd * 1.5 + Number.EPSILON) * 100) /
                  100;

                return (
                  <button
                    key={frameId}
                    type="button"
                    data-testid={`frame-option-${frameId}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectFrame(frameId)}
                    className={`group flex min-h-[44px] min-w-[195px] max-w-[230px] snap-start shrink-0 flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE] shadow-xs'
                        : isAiMatchedFrame
                        ? 'border-[#9E5A3C] bg-[#F5F0E6] text-[#1F1C18] ring-1 ring-[#9E5A3C]/35 hover:bg-[#EFE9DC]'
                        : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50 hover:bg-[#F5F0E6]'
                    }`}
                  >
                    <div
                      data-testid={`frame-option-btn-${frameId}`}
                      className="flex min-h-[44px] w-full flex-col justify-between"
                    >
                      <div>
                        {/* Real 3D Corner Photograph from Catalogue */}
                        {fwFrame.cornerImageUrl && (
                          <div className="relative mb-2 h-24 w-full overflow-hidden rounded-lg border border-black/15 bg-[#EFE9DC]">
                            <img
                              data-testid={`frame-corner-thumb-${frameId}`}
                              src={fwFrame.cornerImageUrl}
                              alt={`${sanitizeDisplayCopy(spec.name, spec.name)} 3D corner sample`}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <span className="absolute bottom-1 right-1 rounded bg-[#1F1C18]/85 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#FAF6EE]">
                              SKU {fwFrame.sku || `AV-${fwFrame.finerworksFrameId}`}
                            </span>
                          </div>
                        )}
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
                        <div className="flex items-center gap-2">
                          {/* Tactile Wood/Metal Moulding Swatch Chip */}
                          <span
                            style={{
                              background: `linear-gradient(135deg, ${spec.highlightHex} 0%, ${spec.primaryHex} 55%, ${spec.secondaryHex} 100%)`,
                            }}
                            className="h-4 w-4 shrink-0 rounded-full border border-black/20 shadow-inner"
                          />
                          <span className="line-clamp-1 text-xs font-semibold leading-snug">
                            {sanitizeDisplayCopy(spec.name, spec.name)}
                          </span>
                        </div>
                        {fwFrame.collectionName && (
                          <p
                            className={`mt-0.5 truncate font-mono text-[10px] ${
                              isSelected ? 'text-[#DFD7C8]/85' : 'text-[#9E5A3C]'
                            }`}
                          >
                            {sanitizeDisplayCopy(fwFrame.collectionName, fwFrame.collectionName)}
                          </p>
                        )}
                      </div>
                      <p
                        className={`mt-1.5 line-clamp-2 text-[11px] leading-relaxed ${
                          isSelected ? 'text-[#FAF6EE]/80' : 'text-[#655B50]'
                        }`}
                      >
                        {sanitizeDisplayCopy(spec.materialDescription, spec.materialDescription)}
                      </p>
                      <span
                        className={`mt-1.5 font-mono text-[10px] ${
                          isSelected ? 'text-[#DFD7C8]' : 'text-[#9E5A3C]'
                        }`}
                      >
                        {frameId === 'unframed-canvas'
                          ? `Unframed · ${fwFrame.depthInches}" depth · +$0.00`
                          : `${fwFrame.thicknessInches}" face · ${fwFrame.depthInches}" depth · +$${framePriceDelta.toFixed(2)}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
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
                4-Ply Acid-Free Archival Cotton Rag
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

        {/* 4. FinerWorks Framing Glazing Selector */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="font-mono text-xs font-semibold uppercase tracking-wider text-[#1F1C18]">
              4. Archival Acrylic Glazing &amp; UV Filtration
            </label>
            <span className="font-mono text-[11px] text-[#655B50]">
              Optical Shatter-Resistant Acrylic
            </span>
          </div>

          <div
            data-testid="finerworks-glazing-strip"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          >
            {FINERWORKS_GLAZING_SPECS.map((g) => {
              const isSelected = effectiveGlazingId === g.glazingId;
              const glazingOptionSpec = buildFinerWorksProductSpec({
                productTypeId: activeMediaSpec.productTypeId,
                mediaId: activeMediaSpec.mediaId,
                styleId: activeMediaSpec.defaultStyleId,
                printWidthIn: effectivePrintWidthIn,
                printHeightIn: effectivePrintHeightIn,
                frameProfileId: activeFrameId,
                matWidthId: activeMatWidthId,
                matColorId: activeMatColorId,
                glazingId: g.glazingId,
              });
              const glazingPriceDelta =
                Math.round(
                  (glazingOptionSpec.pricing.addGlazingPriceUsd * 1.5 + Number.EPSILON) * 100
                ) / 100;

              return (
                <button
                  key={g.glazingId}
                  type="button"
                  data-testid={`glazing-option-btn-${g.glazingId}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectGlazingOption(g)}
                  className={`flex min-h-[44px] flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-[#1F1C18] bg-[#1F1C18] text-[#FAF6EE]'
                      : 'border-[#DFD7C8] bg-[#F5F0E6]/70 text-[#1F1C18] hover:border-[#9E5A3C]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{g.shortLabel}</span>
                    <span
                      className={`font-mono text-[10px] font-semibold ${
                        isSelected ? 'text-[#DFD7C8]' : 'text-[#9E5A3C]'
                      }`}
                    >
                      {g.uvFilteringPercent > 0
                        ? `${g.uvFilteringPercent}% UV · +$${glazingPriceDelta.toFixed(2)}`
                        : '+$0.00'}
                    </span>
                  </div>
                  <span
                    className={`mt-1 text-[10px] ${
                      isSelected ? 'text-[#FAF6EE]/75' : 'text-[#655B50]'
                    }`}
                  >
                    {g.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Archival Live Specification & Auto-Sync Bar */}
        <div
          data-testid="finerworks-live-spec-bar"
          className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-3.5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#4A3B32]">
                Atelier Edition SKU:
              </span>
              <span
                data-testid="finerworks-active-product-code"
                className="rounded-lg bg-[#1F1C18] px-2.5 py-1 font-mono text-xs font-semibold text-[#FAF6EE]"
              >
                {liveBuiltProductSpec.productCode}
              </span>
              <span
                data-testid="finerworks-live-price-pill"
                className="rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] px-2.5 py-1 font-mono text-xs font-medium text-[#1F1C18]"
              >
                Edition Price: ${liveBuiltProductSpec.pricing.suggestedGeoRetailUsd.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              data-testid="toggle-finerworks-spec-details-btn"
              aria-expanded={isSpecDetailsOpen}
              onClick={() => setIsSpecDetailsOpen((prev) => !prev)}
              className="min-h-[44px] rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] hover:bg-[#DFD7C8]/60 px-3 py-1.5 font-mono text-xs font-semibold text-[#1F1C18] transition-colors cursor-pointer"
            >
              {isSpecDetailsOpen ? 'Spec & SKU Details ▴' : 'Spec & SKU Details ▾'}
            </button>
          </div>

          {isSpecDetailsOpen && (
            <div
              data-testid="finerworks-spec-details-drawer"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3 font-mono text-[11px] text-[#1F1C18]"
            >
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-[#9E5A3C]">
                  Itemized Archival Edition Breakdown
                </p>
                <p>
                  Base Print ({activeMediaSpec.shortName}): $
                  {(
                    Math.round(
                      (liveBuiltProductSpec.pricing.basePrintPriceUsd * 1.5 + Number.EPSILON) * 100
                    ) / 100
                  ).toFixed(2)}
                </p>
                <p>
                  Frame Moulding ({finerWorksFrameSpec.shortLabel}): +$
                  {(
                    Math.round(
                      (liveBuiltProductSpec.pricing.addFramePriceUsd * 1.5 + Number.EPSILON) * 100
                    ) / 100
                  ).toFixed(2)}
                </p>
                <p>
                  Conservation Matboard ({activeMatWidthId}): +$
                  {(
                    Math.round(
                      (liveBuiltProductSpec.pricing.addMat1PriceUsd * 1.5 + Number.EPSILON) * 100
                    ) / 100
                  ).toFixed(2)}
                </p>
                <p>
                  Acrylic Glazing ({effectiveGlazingId}): +$
                  {(
                    Math.round(
                      (liveBuiltProductSpec.pricing.addGlazingPriceUsd * 1.5 + Number.EPSILON) *
                        100
                    ) / 100
                  ).toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-[#9E5A3C]">
                  Physical Geometry &amp; Weight
                </p>
                <p>
                  Outer Frame: {liveBuiltProductSpec.physicalDimensions.frameOuterWidthIn}&quot; ×{' '}
                  {liveBuiltProductSpec.physicalDimensions.frameOuterHeightIn}&quot;
                </p>
                <p>
                  Frame Interior: {liveBuiltProductSpec.physicalDimensions.frameInteriorWidthIn}&quot; ×{' '}
                  {liveBuiltProductSpec.physicalDimensions.frameInteriorHeightIn}&quot;
                </p>
                <p>
                  Mat Outer: {liveBuiltProductSpec.physicalDimensions.matOuterWidthIn}&quot; ×{' '}
                  {liveBuiltProductSpec.physicalDimensions.matOuterHeightIn}&quot;
                </p>
                <p>
                  Estimated Weight: {liveBuiltProductSpec.physicalDimensions.estimatedWeightOz} oz
                </p>
                {liveBuiltProductSpec.validationNotes.length > 0 && (
                  <p className="text-[#655B50]">
                    Note: {liveBuiltProductSpec.validationNotes.join(' ')}
                  </p>
                )}
              </div>
            </div>
          )}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-[#4A3B32]">
                {lastDownloadedResult.widthPx}×{lastDownloadedResult.heightPx} px · {lastDownloadedResult.dpi} DPI
                {lastDownloadedResult.includedBleed ? ' · +0.25" Bleed' : ''}
              </span>
              {onOpenDownloadLicenseModal && (
                <button
                  type="button"
                  data-testid="open-download-license-verification-btn"
                  onClick={onOpenDownloadLicenseModal}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#1F1C18] bg-[#FAF6EE] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#1F1C18] hover:bg-[#F5F0E6]"
                >
                  Inspect Print Master &amp; License ($29.00)
                </button>
              )}
            </div>
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
                : hasUnlockedDigitalMaster || Boolean(lastDownloadedResult)
                ? 'Download High-Res Print File (300 DPI PNG · License Active)'
                : 'Download High-Res Print File (300 DPI PNG · $29.00 Digital License)'}
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
                : ` · $${liveBuiltProductSpec.pricing.suggestedGeoRetailUsd.toFixed(2)} (${sizeSpec.labelInches})`}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default SizeAndFrameScroller;
