import React, { useEffect, useState } from 'react';
import {
  FinerWorksBuiltProductSpec,
  FinerWorksGlazingId,
  FinerWorksGlazingSpec,
  FinerWorksMediaSpec,
  FinerWorksStandardSizeId,
  FrameProfileId,
  GeneratedArtPiece,
  MatColorId,
  MatWidthId,
  NormalizedCropBox,
  PrintSizeId,
  ReimaginedRoomVariation,
  ReimaginedRoomViewpoint,
  ScaleCalibrationResult,
} from '../../contracts/masterContract';
import {
  ArtworkScreenshotCropper,
  ArtworkScreenshotCropperProps,
  InRoomSpaceVisualizer,
  InRoomSpaceVisualizerProps,
} from './ArtworkScreenshotCropper';
import { HighResPrintMasterFileResult } from './identicalPrintUpscaler';
import { SizeAndFrameScroller } from './SizeAndFrameScroller';

export * from './identicalPrintUpscaler';
export * from './ArtworkScreenshotCropper';
export * from './SizeAndFrameScroller';
export { InRoomSpaceVisualizer };
export type { InRoomSpaceVisualizerProps };

export interface ScreenshotAndPrintStudioProps {
  variation: ReimaginedRoomVariation;
  variations?: ReimaginedRoomVariation[];
  activeVariationId?: string | null;
  onSelectVariation?: (variationId: string) => void;
  activeCropBox?: NormalizedCropBox;
  croppedScreenshotDataUrl?: string;
  identicalPrintDataUrl?: string;
  activeViewpointIndex?: number;
  activeArtPieceIndex?: number;
  artworkTitle?: string;
  isSynthesizingPrint?: boolean;
  selectedSizeId?: PrintSizeId;
  selectedFrameId?: FrameProfileId;
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
  onSelectOrientation?: (orientation: 'landscape' | 'portrait' | 'square') => void;
  onOpenDownloadLicenseModal?: () => void;
  onSelectViewpoint?: (
    viewpointIndex: number,
    viewpoint: ReimaginedRoomViewpoint
  ) => void;
  onSelectArtPiece?: (
    artPieceIndex: number,
    artPiece: GeneratedArtPiece
  ) => void;
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
  onSelectSize?: (sizeId: PrintSizeId) => void;
  onSelectFrame?: (frameId: FrameProfileId) => void;
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
  onOpenPrintOrderModal?: () => void;
  // Convenient aliases for flexible Root integration
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
  onDownloadPrint?: (result: HighResPrintMasterFileResult) => void | Promise<void>;
  onOrderPrintedVersion?: () => void;
}

export const ScreenshotAndPrintStudio: React.FC<ScreenshotAndPrintStudioProps> = ({
  variation,
  variations,
  activeVariationId,
  onSelectVariation,
  activeCropBox,
  croppedScreenshotDataUrl,
  identicalPrintDataUrl,
  activeViewpointIndex,
  activeArtPieceIndex,
  artworkTitle,
  isSynthesizingPrint = false,
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
  onOpenCaliperSizingTool,
  onSelectOrientation,
  onOpenDownloadLicenseModal,
  onSelectViewpoint,
  onSelectArtPiece,
  onCropBoxChange,
  onResynthesizePrintFromCrop,
  onSelectSize,
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
  onOpenPrintOrderModal,
  onCropChange,
  onUpdateCropBox,
  onResynthesizePrint,
  onDownloadPrint,
  onOrderPrintedVersion,
}) => {
  const effectiveScaleRecommendation =
    scaleRecommendation !== undefined
      ? scaleRecommendation
      : variation.scaleRecommendation ?? null;

  const initialDefaultSize: PrintSizeId =
    effectiveScaleRecommendation?.isCalibrated &&
    effectiveScaleRecommendation.recommendedSizeId
      ? effectiveScaleRecommendation.recommendedSizeId
      : '24x36';

  const [internalSizeId, setInternalSizeId] =
    useState<PrintSizeId>(initialDefaultSize);
  const [internalFrameId, setInternalFrameId] =
    useState<FrameProfileId>(variation.detectedFrameId ?? 'natural-white-oak');
  const [internalMatWidthId, setInternalMatWidthId] = useState<MatWidthId>(
    variation.detectedMatWidthId ?? '1.5in'
  );
  const [internalMatColorId, setInternalMatColorId] =
    useState<MatColorId>(variation.detectedMatColorId ?? 'archival-ivory');
  const [internalMediaId, setInternalMediaId] = useState<number>(
    selectedMediaId ??
      variation.finerworksMediaId ??
      variation.finerworksVerification?.matchedMediaId ??
      42
  );
  const [internalGlazingId, setInternalGlazingId] = useState<FinerWorksGlazingId>(
    selectedGlazingId ?? variation.finerworksGlazingId ?? 'clear-acrylic'
  );
  const [internalIncludeBleed, setInternalIncludeBleed] = useState<boolean>(false);
  const [internalOrientation, setInternalOrientation] = useState<
    'landscape' | 'portrait' | 'square'
  >(selectedOrientation ?? 'portrait');
  const [internalViewpointIndex, setInternalViewpointIndex] = useState<number>(
    activeViewpointIndex ?? variation.activeViewpointIndex ?? 0
  );
  const [internalArtPieceIndex, setInternalArtPieceIndex] = useState<number>(
    activeArtPieceIndex ?? variation.activeArtPieceIndex ?? 0
  );
  const [croppedUrlByViewpoint, setCroppedUrlByViewpoint] = useState<
    Record<number, string>
  >({});

  // Sync internalSizeId when scaleRecommendation is calibrated and selectedSizeId is uncontrolled
  useEffect(() => {
    if (
      selectedSizeId === undefined &&
      effectiveScaleRecommendation?.isCalibrated &&
      effectiveScaleRecommendation.recommendedSizeId
    ) {
      setInternalSizeId(effectiveScaleRecommendation.recommendedSizeId);
    }
  }, [
    selectedSizeId,
    effectiveScaleRecommendation?.isCalibrated,
    effectiveScaleRecommendation?.recommendedSizeId,
  ]);

  // Sync controlled activeViewpointIndex when updated by parent
  useEffect(() => {
    if (typeof activeViewpointIndex === 'number') {
      setInternalViewpointIndex(activeViewpointIndex);
    }
  }, [activeViewpointIndex]);

  // Sync controlled activeArtPieceIndex when updated by parent
  useEffect(() => {
    if (typeof activeArtPieceIndex === 'number') {
      setInternalArtPieceIndex(activeArtPieceIndex);
    } else if (typeof variation.activeArtPieceIndex === 'number') {
      setInternalArtPieceIndex(variation.activeArtPieceIndex);
    }
  }, [activeArtPieceIndex, variation.activeArtPieceIndex]);

  // Reset per-variation local state when variation ID changes
  useEffect(() => {
    setCroppedUrlByViewpoint({});
    if (activeViewpointIndex === undefined) {
      setInternalViewpointIndex(variation.activeViewpointIndex ?? 0);
    }
    if (activeArtPieceIndex === undefined) {
      setInternalArtPieceIndex(variation.activeArtPieceIndex ?? 0);
    }
    if (selectedFrameId === undefined && variation.detectedFrameId) {
      setInternalFrameId(variation.detectedFrameId);
    }
    if (selectedMatWidthId === undefined && variation.detectedMatWidthId) {
      setInternalMatWidthId(variation.detectedMatWidthId);
    }
    if (selectedMatColorId === undefined && variation.detectedMatColorId) {
      setInternalMatColorId(variation.detectedMatColorId);
    }
    if (selectedMediaId === undefined) {
      setInternalMediaId(
        variation.finerworksMediaId ??
          variation.finerworksVerification?.matchedMediaId ??
          42
      );
    }
    if (selectedGlazingId === undefined) {
      setInternalGlazingId(variation.finerworksGlazingId ?? 'clear-acrylic');
    }
  }, [
    variation.id,
    variation.activeViewpointIndex,
    variation.activeArtPieceIndex,
    variation.detectedFrameId,
    variation.detectedMatWidthId,
    variation.detectedMatColorId,
    variation.finerworksMediaId,
    variation.finerworksVerification?.matchedMediaId,
    variation.finerworksGlazingId,
    activeViewpointIndex,
    activeArtPieceIndex,
    selectedFrameId,
    selectedMatWidthId,
    selectedMatColorId,
    selectedMediaId,
    selectedGlazingId,
  ]);

  const effectiveViewpointIndex =
    typeof activeViewpointIndex === 'number'
      ? activeViewpointIndex
      : internalViewpointIndex;

  const effectiveArtPieceIndex =
    typeof activeArtPieceIndex === 'number'
      ? activeArtPieceIndex
      : internalArtPieceIndex;

  const activeViewpoint: ReimaginedRoomViewpoint | undefined =
    variation.viewpoints && variation.viewpoints.length > 0
      ? variation.viewpoints[
          Math.max(
            0,
            Math.min(variation.viewpoints.length - 1, effectiveViewpointIndex)
          )
        ]
      : undefined;

  const effectiveSizeId = selectedSizeId ?? internalSizeId;
  const effectiveFrameId = selectedFrameId ?? internalFrameId;
  const effectiveMatWidthId = selectedMatWidthId ?? internalMatWidthId;
  const effectiveMatColorId = selectedMatColorId ?? internalMatColorId;
  const effectiveMediaId = selectedMediaId ?? internalMediaId;
  const effectiveGlazingId = selectedGlazingId ?? internalGlazingId;
  const effectiveIncludeBleed =
    includeBleed !== undefined ? includeBleed : internalIncludeBleed;
  const effectiveOrientation = selectedOrientation ?? internalOrientation;

  const handleSelectOrientation = (
    orientation: 'landscape' | 'portrait' | 'square'
  ) => {
    setInternalOrientation(orientation);
    onSelectOrientation?.(orientation);
  };

  const effectiveCroppedUrl =
    croppedScreenshotDataUrl ??
    croppedUrlByViewpoint[effectiveViewpointIndex] ??
    activeViewpoint?.croppedScreenshotDataUrl ??
    variation.croppedScreenshotDataUrl;

  const handleSelectViewpoint = (
    viewpointIndex: number,
    viewpoint: ReimaginedRoomViewpoint
  ) => {
    setInternalViewpointIndex(viewpointIndex);
    if (viewpoint?.croppedScreenshotDataUrl) {
      setCroppedUrlByViewpoint((prev) => ({
        ...prev,
        [viewpointIndex]: prev[viewpointIndex] ?? viewpoint.croppedScreenshotDataUrl,
      }));
    }
    onSelectViewpoint?.(viewpointIndex, viewpoint);
  };

  const handleSelectArtPiece = (
    artPieceIndex: number,
    artPiece: GeneratedArtPiece
  ) => {
    setInternalArtPieceIndex(artPieceIndex);
    onSelectArtPiece?.(artPieceIndex, artPiece);
  };

  const handleCropBoxChange = (
    newBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => {
    const targetIdx =
      typeof viewpointIndex === 'number' ? viewpointIndex : effectiveViewpointIndex;
    setCroppedUrlByViewpoint((prev) => ({
      ...prev,
      [targetIdx]: croppedDataUrl,
    }));
    onCropBoxChange?.(newBox, croppedDataUrl, targetIdx);
    onCropChange?.(newBox, croppedDataUrl, targetIdx);
    onUpdateCropBox?.(newBox, croppedDataUrl, targetIdx);
  };

  const handleResynthesizePrintFromCrop = (
    cropBox: NormalizedCropBox,
    croppedDataUrl: string,
    viewpointIndex?: number
  ) => {
    const targetIdx =
      typeof viewpointIndex === 'number' ? viewpointIndex : effectiveViewpointIndex;
    onResynthesizePrintFromCrop?.(cropBox, croppedDataUrl, targetIdx);
    onResynthesizePrint?.(cropBox, croppedDataUrl, targetIdx);
  };

  const handleSelectSize = (sizeId: PrintSizeId) => {
    setInternalSizeId(sizeId);
    onSelectSize?.(sizeId);
  };

  const handleSelectFrame = (frameId: FrameProfileId) => {
    setInternalFrameId(frameId);
    onSelectFrame?.(frameId);
  };

  const handleSelectMatWidth = (matWidthId: MatWidthId) => {
    setInternalMatWidthId(matWidthId);
    onSelectMatWidth?.(matWidthId);
  };

  const handleSelectMatColor = (matColorId: MatColorId) => {
    setInternalMatColorId(matColorId);
    onSelectMatColor?.(matColorId);
  };

  const handleSelectMedia = (mediaId: number, mediaSpec: FinerWorksMediaSpec) => {
    setInternalMediaId(mediaId);
    onSelectMedia?.(mediaId, mediaSpec);
  };

  const handleSelectGlazing = (
    glazingId: FinerWorksGlazingId,
    glazingSpec: FinerWorksGlazingSpec
  ) => {
    setInternalGlazingId(glazingId);
    onSelectGlazing?.(glazingId, glazingSpec);
  };

  const handleToggleBleed = (nextBleed: boolean) => {
    setInternalIncludeBleed(nextBleed);
    onToggleBleed?.(nextBleed);
  };

  const cropperProps: ArtworkScreenshotCropperProps = {
    variation,
    variations,
    activeVariationId,
    onSelectVariation,
    activeCropBox,
    croppedScreenshotDataUrl: effectiveCroppedUrl,
    activeViewpointIndex: effectiveViewpointIndex,
    activeArtPieceIndex: effectiveArtPieceIndex,
    isSynthesizingPrint,
    scaleRecommendation: effectiveScaleRecommendation,
    selectedFrameId: effectiveFrameId,
    selectedMatWidthId: effectiveMatWidthId,
    selectedMatColorId: effectiveMatColorId,
    selectedSizeId: effectiveSizeId,
    selectedOrientation: effectiveOrientation,
    customWidthIn: customPrintWidthIn,
    customHeightIn: customPrintHeightIn,
    onOpenCaliperSizingTool,
    onSelectViewpoint: handleSelectViewpoint,
    onSelectArtPiece: handleSelectArtPiece,
    onCropBoxChange: handleCropBoxChange,
    onResynthesizePrintFromCrop: handleResynthesizePrintFromCrop,
  };

  return React.createElement(
    'div',
    {
      'data-testid': 'screenshot-and-print-studio',
      className: 'flex w-full flex-col gap-6',
    },
    React.createElement(ArtworkScreenshotCropper, cropperProps),
    React.createElement(SizeAndFrameScroller, {
      variation,
      identicalPrintDataUrl,
      croppedScreenshotDataUrl: effectiveCroppedUrl,
      artworkTitle,
      activeArtPieceIndex: effectiveArtPieceIndex,
      selectedSizeId: effectiveSizeId,
      selectedFrameId: effectiveFrameId,
      selectedMatWidthId: effectiveMatWidthId,
      selectedMatColorId: effectiveMatColorId,
      selectedMediaId: effectiveMediaId,
      selectedGlazingId: effectiveGlazingId,
      selectedFinerWorksSizeId,
      selectedOrientation: effectiveOrientation,
      customPrintWidthIn,
      customPrintHeightIn,
      includeBleed: effectiveIncludeBleed,
      isDownloadingPrint,
      hasUnlockedDigitalMaster,
      estimatedRetailPriceUsd,
      scaleRecommendation: effectiveScaleRecommendation,
      onOpenCaliperSizingTool,
      onSelectOrientation: handleSelectOrientation,
      onOpenDownloadLicenseModal,
      onSelectArtPiece: handleSelectArtPiece,
      onSelectSize: handleSelectSize,
      onSelectFrame: handleSelectFrame,
      onSelectMatWidth: handleSelectMatWidth,
      onSelectMatColor: handleSelectMatColor,
      onSelectMedia: handleSelectMedia,
      onSelectGlazing: handleSelectGlazing,
      onSelectFinerWorksSize,
      onChangeCustomDimensions,
      onFinerWorksProductSpecChange,
      onToggleBleed: handleToggleBleed,
      onDirectDownloadPrint,
      onOpenPrintOrderModal,
      onDownloadPrint,
      onOrderPrintedVersion,
    })
  );
};

export default ScreenshotAndPrintStudio;
