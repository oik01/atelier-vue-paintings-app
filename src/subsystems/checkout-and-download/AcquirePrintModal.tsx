import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileJson,
  Frame,
  Layers,
  MapPin,
  PackageCheck,
  Printer,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import {
  FRAME_PROFILES,
  FrameProfileId,
  GeneratedArtPiece,
  MatColorId,
  MatWidthId,
  OrientationMode,
  PaintingSpec,
  PRINT_PARTNERS,
  PRINT_SIZES,
  PrintPartnerId,
  PrintSizeId,
  PrintSubstrateId,
  ReimaginedRoomVariation,
  ScaleCalibrationResult,
} from '../../contracts/masterContract';
import {
  buildPrintOrderManifestJson,
  clampStudioMarkupPercent,
  compareAllPartnerQuotes,
  computePartnerPrintQuote,
  computePrintDimensionsWithBleed,
  DEFAULT_STUDIO_MARKUP_PERCENT,
  loadAtelierV2State,
  MAX_STUDIO_MARKUP_PERCENT,
  MIN_STUDIO_MARKUP_PERCENT,
  recordOrderConfirmation,
  SAMPLE_SHIPPING_ADDRESS,
  sanitizeDownloadFilename,
  saveAtelierV2State,
  ShippingAddressData,
  triggerPrintFileDownload,
  V2OrderConfirmation,
  validateShippingAddress,
} from './pricingAndOrderEngine';

export type AcquirePrintModalMode = 'download-master' | 'order-print';

export interface AcquirePrintModalProps {
  isOpen?: boolean;
  initialMode?: AcquirePrintModalMode;
  activeMode?: AcquirePrintModalMode;
  onClose?: () => void;
  onModeChange?: (mode: AcquirePrintModalMode) => void;
  variation?: ReimaginedRoomVariation | null;
  painting?: PaintingSpec | null;
  artworkTitle?: string;
  croppedScreenshotDataUrl?: string;
  identicalPrintMasterDataUrl?: string;
  reimaginedRoomDataUrl?: string;
  activeArtPieceIndex?: number;
  onSelectArtPiece?: (index: number) => void;
  scaleRecommendation?: ScaleCalibrationResult | null;
  sizeId?: PrintSizeId;
  frameId?: FrameProfileId;
  matWidthId?: MatWidthId;
  matColorId?: MatColorId;
  substrateId?: PrintSubstrateId;
  orientation?: OrientationMode;
  partnerId?: PrintPartnerId;
  studioMarkupPercent?: number;
  onSelectSize?: (sizeId: PrintSizeId) => void;
  onSelectFrame?: (frameId: FrameProfileId) => void;
  onSelectMatWidth?: (matWidthId: MatWidthId) => void;
  onSelectSubstrate?: (substrateId: PrintSubstrateId) => void;
  onSelectPartner?: (partnerId: PrintPartnerId) => void;
  onChangeMarkupPercent?: (percent: number) => void;
  onDownloadCompleted?: (confirmation: V2OrderConfirmation) => void;
  onOrderCompleted?: (confirmation: V2OrderConfirmation) => void;
}

const PRINT_SIZE_IDS: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];

const FRAME_PROFILE_IDS: FrameProfileId[] = [
  'unframed-canvas',
  'natural-white-oak',
  'american-black-walnut',
  'matte-gallery-black',
  'brushed-brass-float',
  'warm-travertine-ash',
];

const MAT_WIDTH_OPTIONS_LIST: Array<{ id: MatWidthId; label: string }> = [
  { id: 'none', label: 'No Matboard' },
  { id: '1.5in', label: '1.5" Gallery Mat' },
  { id: '2.5in', label: '2.5" Museum Mat' },
  { id: '3.5in', label: '3.5" Salon Mat' },
];

const SUBSTRATE_OPTIONS: Array<{
  id: PrintSubstrateId;
  label: string;
  detail: string;
}> = [
  {
    id: 'hahnemuhle-etching-310gsm',
    label: 'Hahnemühle German Etching 310gsm',
    detail: '100% alpha-cellulose archival fine art rag · velvety tactile tooth',
  },
  {
    id: 'archival-cotton-canvas-400gsm',
    label: 'Archival Cotton Canvas 400gsm',
    detail: 'Heavyweight poly-cotton museum weave · satin UV protective varnish',
  },
  {
    id: 'museum-matte-acrylic',
    label: 'Museum Matte Anti-Reflective Acrylic',
    detail: 'Optically clear face-mount gallery plexi · zero glare finish',
  },
];

const PARTNER_IDS: PrintPartnerId[] = ['prodigi', 'printful', 'finerworks'];

const MARKUP_PRESETS: number[] = [15, 18, 22];

const SAMPLE_COLLECTOR_ADDRESS: ShippingAddressData = SAMPLE_SHIPPING_ADDRESS;

const FALLBACK_ROOM_PREVIEW_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
      <rect width="800" height="600" fill="#EAE4D9"/>
      <rect x="0" y="450" width="800" height="150" fill="#D5CBBF"/>
      <rect x="270" y="90" width="260" height="290" fill="#F6F4EF" stroke="#4A3525" stroke-width="12"/>
      <circle cx="400" cy="215" r="72" fill="#B85D3B" opacity="0.85"/>
      <path d="M300 315 Q400 250 500 315 L500 355 L300 355 Z" fill="#2E4A3E" opacity="0.88"/>
      <rect x="190" y="420" width="420" height="90" rx="14" fill="#C9BEB0"/>
    </svg>`
  );

const FALLBACK_PRINT_MASTER_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
      <rect width="600" height="800" fill="#F4EFE6"/>
      <circle cx="300" cy="340" r="168" fill="#B85D3B" opacity="0.88"/>
      <path d="M60 560 Q300 400 540 560 L540 760 L60 760 Z" fill="#2E4A3E" opacity="0.9"/>
      <rect x="90" y="110" width="420" height="580" fill="none" stroke="#161514" stroke-width="2" opacity="0.18"/>
    </svg>`
  );

export const AcquirePrintModal: React.FC<AcquirePrintModalProps> = ({
  isOpen = true,
  initialMode = 'download-master',
  activeMode,
  onClose,
  onModeChange,
  variation,
  painting,
  artworkTitle,
  identicalPrintMasterDataUrl,
  reimaginedRoomDataUrl,
  activeArtPieceIndex,
  onSelectArtPiece,
  scaleRecommendation,
  sizeId,
  frameId,
  matWidthId,
  matColorId = 'archival-ivory',
  substrateId,
  orientation = 'portrait',
  partnerId,
  studioMarkupPercent,
  onSelectSize,
  onSelectFrame,
  onSelectMatWidth,
  onSelectSubstrate,
  onSelectPartner,
  onChangeMarkupPercent,
  onDownloadCompleted,
  onOrderCompleted,
}) => {
  const persisted = useMemo(() => loadAtelierV2State(), []);
  const effectiveScaleRecommendation = scaleRecommendation ?? variation?.scaleRecommendation ?? null;

  const [mode, setMode] = useState<AcquirePrintModalMode>(activeMode ?? initialMode);
  const [selectedArtPieceIndex, setSelectedArtPieceIndex] = useState<number>(
    activeArtPieceIndex ?? variation?.activeArtPieceIndex ?? 0
  );
  const [selectedSizeId, setSelectedSizeId] = useState<PrintSizeId>(
    sizeId ?? painting?.recommendedSizeId ?? persisted.preferredSizeId ?? '24x36'
  );
  const [selectedFrameId, setSelectedFrameId] = useState<FrameProfileId>(
    frameId ?? painting?.recommendedFrameId ?? persisted.preferredFrameId ?? 'natural-white-oak'
  );
  const [selectedMatWidthId, setSelectedMatWidthId] = useState<MatWidthId>(
    matWidthId ?? persisted.preferredMatWidthId ?? '2.5in'
  );
  const [selectedSubstrateId, setSelectedSubstrateId] = useState<PrintSubstrateId>(
    substrateId ?? persisted.preferredSubstrateId ?? 'hahnemuhle-etching-310gsm'
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState<PrintPartnerId>(
    partnerId ?? persisted.preferredPartnerId ?? 'prodigi'
  );
  const [markupPercent, setMarkupPercent] = useState<number>(
    clampStudioMarkupPercent(
      studioMarkupPercent ?? persisted.preferredMarkupPercent ?? DEFAULT_STUDIO_MARKUP_PERCENT
    )
  );
  const [includePrintBleed, setIncludePrintBleed] = useState<boolean>(
    persisted.includePrintBleed ?? false
  );

  const [downloadConfirmation, setDownloadConfirmation] = useState<{
    filename: string;
    kind: 'master' | 'room-preview' | 'multi-piece-set';
    count: number;
    widthPx: number;
    heightPx: number;
    timestamp: number;
  } | null>(null);

  const [shippingAddress, setShippingAddress] = useState<ShippingAddressData>({
    fullName: '',
    email: '',
    streetAddress: '',
    city: '',
    stateOrProvince: '',
    postalCode: '',
    country: 'US',
  });
  const [shippingErrors, setShippingErrors] = useState<
    Partial<Record<keyof ShippingAddressData, string>>
  >({});
  const [hasSubmittedInvalidAddress, setHasSubmittedInvalidAddress] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState<V2OrderConfirmation | null>(null);

  // Sync controlled props when updated by parent
  useEffect(() => {
    if (activeMode) {
      setMode(activeMode);
    }
  }, [activeMode]);

  useEffect(() => {
    if (typeof activeArtPieceIndex === 'number') {
      setSelectedArtPieceIndex(activeArtPieceIndex);
    } else if (typeof variation?.activeArtPieceIndex === 'number') {
      setSelectedArtPieceIndex(variation.activeArtPieceIndex);
    }
  }, [activeArtPieceIndex, variation?.activeArtPieceIndex]);

  useEffect(() => {
    if (sizeId) setSelectedSizeId(sizeId);
  }, [sizeId]);

  useEffect(() => {
    if (frameId) setSelectedFrameId(frameId);
  }, [frameId]);

  useEffect(() => {
    if (matWidthId) setSelectedMatWidthId(matWidthId);
  }, [matWidthId]);

  useEffect(() => {
    if (substrateId) setSelectedSubstrateId(substrateId);
  }, [substrateId]);

  useEffect(() => {
    if (partnerId) setSelectedPartnerId(partnerId);
  }, [partnerId]);

  useEffect(() => {
    if (typeof studioMarkupPercent === 'number') {
      setMarkupPercent(clampStudioMarkupPercent(studioMarkupPercent));
    }
  }, [studioMarkupPercent]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const artPieces: GeneratedArtPiece[] = useMemo(
    () => (Array.isArray(variation?.artPieces) ? variation!.artPieces! : []),
    [variation]
  );

  const safePieceIndex =
    artPieces.length > 0
      ? Math.min(Math.max(0, selectedArtPieceIndex), artPieces.length - 1)
      : 0;

  const activeArtPiece: GeneratedArtPiece | null =
    artPieces.length > 0 ? artPieces[safePieceIndex] ?? artPieces[0] : null;

  const effectiveArtworkTitle =
    activeArtPiece?.title?.trim() ||
    artworkTitle?.trim() ||
    variation?.artworkTitle?.trim() ||
    painting?.title?.trim() ||
    'Terracotta & Raw Umber Study';

  const effectiveWallLocationLabel =
    activeArtPiece?.wallLocationLabel?.trim() || 'Primary Wall Placement';

  const effectiveRoomPreviewUrl =
    reimaginedRoomDataUrl ||
    variation?.reimaginedRoomDataUrl ||
    FALLBACK_ROOM_PREVIEW_SVG;

  const effectiveIdenticalPrintMasterUrl =
    activeArtPiece?.identicalPrintMasterDataUrl ||
    identicalPrintMasterDataUrl ||
    variation?.identicalPrintMasterDataUrl ||
    FALLBACK_PRINT_MASTER_SVG;

  const printDimensions = useMemo(
    () =>
      computePrintDimensionsWithBleed(selectedSizeId, includePrintBleed, orientation),
    [selectedSizeId, includePrintBleed, orientation]
  );

  const trimDimensions = useMemo(
    () => computePrintDimensionsWithBleed(selectedSizeId, false, orientation),
    [selectedSizeId, orientation]
  );

  const allPartnerQuotes = useMemo(
    () =>
      compareAllPartnerQuotes({
        sizeId: selectedSizeId,
        frameId: selectedFrameId,
        matWidthId: selectedMatWidthId,
        substrateId: selectedSubstrateId,
        panelLayout: 'single',
        studioMarkupPercent: markupPercent,
      }),
    [
      selectedSizeId,
      selectedFrameId,
      selectedMatWidthId,
      selectedSubstrateId,
      markupPercent,
    ]
  );

  const currentPricing = useMemo(
    () =>
      computePartnerPrintQuote({
        partnerId: selectedPartnerId,
        sizeId: selectedSizeId,
        frameId: selectedFrameId,
        matWidthId: selectedMatWidthId,
        substrateId: selectedSubstrateId,
        panelLayout: 'single',
        studioMarkupPercent: markupPercent,
      }),
    [
      selectedPartnerId,
      selectedSizeId,
      selectedFrameId,
      selectedMatWidthId,
      selectedSubstrateId,
      markupPercent,
    ]
  );

  if (!isOpen) {
    return null;
  }

  const handleModeSwitch = (nextMode: AcquirePrintModalMode) => {
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  const handleSelectArtPiece = (index: number) => {
    setSelectedArtPieceIndex(index);
    onSelectArtPiece?.(index);
  };

  const handleSelectSize = (nextSize: PrintSizeId) => {
    setSelectedSizeId(nextSize);
    saveAtelierV2State({ preferredSizeId: nextSize });
    onSelectSize?.(nextSize);
  };

  const handleSelectFrame = (nextFrame: FrameProfileId) => {
    setSelectedFrameId(nextFrame);
    saveAtelierV2State({ preferredFrameId: nextFrame });
    onSelectFrame?.(nextFrame);
  };

  const handleSelectMatWidth = (nextMatWidth: MatWidthId) => {
    setSelectedMatWidthId(nextMatWidth);
    saveAtelierV2State({ preferredMatWidthId: nextMatWidth });
    onSelectMatWidth?.(nextMatWidth);
  };

  const handleSelectSubstrate = (nextSubstrate: PrintSubstrateId) => {
    setSelectedSubstrateId(nextSubstrate);
    saveAtelierV2State({ preferredSubstrateId: nextSubstrate });
    onSelectSubstrate?.(nextSubstrate);
  };

  const handleSelectPartner = (nextPartner: PrintPartnerId) => {
    setSelectedPartnerId(nextPartner);
    saveAtelierV2State({ preferredPartnerId: nextPartner });
    onSelectPartner?.(nextPartner);
  };

  const handleChangeMarkup = (nextMarkup: number) => {
    const clamped = clampStudioMarkupPercent(nextMarkup);
    setMarkupPercent(clamped);
    saveAtelierV2State({ preferredMarkupPercent: clamped });
    onChangeMarkupPercent?.(clamped);
  };

  const handleToggleBleed = () => {
    const nextBleed = !includePrintBleed;
    setIncludePrintBleed(nextBleed);
    saveAtelierV2State({ includePrintBleed: nextBleed });
  };

  const handleDownloadHighResMaster = () => {
    const suffix = `${selectedSizeId}-${printDimensions.widthPx}x${printDimensions.heightPx}px-300dpi${
      includePrintBleed ? '-with-bleed' : ''
    }`;
    const filename = sanitizeDownloadFilename(effectiveArtworkTitle, suffix, 'png');
    triggerPrintFileDownload(effectiveIdenticalPrintMasterUrl, filename);

    const orderId = `AV2-DL-${Date.now().toString(36).toUpperCase()}`;
    const manifestJson = buildPrintOrderManifestJson({
      orderId,
      artworkTitle: effectiveArtworkTitle,
      variation,
      sizeId: selectedSizeId,
      frameId: selectedFrameId,
      matWidthId: selectedMatWidthId,
      matColorId,
      substrateId: selectedSubstrateId,
      includePrintBleed,
      pricing: currentPricing,
    });

    const confirmation: V2OrderConfirmation = {
      id: orderId,
      createdAt: Date.now(),
      orderType: 'digital-master-download',
      variationId: activeArtPiece?.id ?? variation?.id ?? painting?.id ?? 'custom-variation',
      artworkTitle: effectiveArtworkTitle,
      sizeId: selectedSizeId,
      frameId: selectedFrameId,
      matWidthId: selectedMatWidthId,
      matColorId,
      substrateId: selectedSubstrateId,
      orientation,
      includePrintBleed,
      printMasterWidthPx: printDimensions.widthPx,
      printMasterHeightPx: printDimensions.heightPx,
      pricing: currentPricing,
      partnerOrderManifestJson: manifestJson,
      status: 'completed-download',
    };

    recordOrderConfirmation(confirmation);
    setDownloadConfirmation({
      filename,
      kind: 'master',
      count: 1,
      widthPx: printDimensions.widthPx,
      heightPx: printDimensions.heightPx,
      timestamp: Date.now(),
    });
    onDownloadCompleted?.(confirmation);
  };

  const handleDownloadAllArtPieces = () => {
    if (artPieces.length === 0) {
      handleDownloadHighResMaster();
      return;
    }

    let lastFilename = '';
    artPieces.forEach((piece, idx) => {
      const suffix = `piece-${idx + 1}-${selectedSizeId}-${printDimensions.widthPx}x${
        printDimensions.heightPx
      }px-300dpi${includePrintBleed ? '-with-bleed' : ''}`;
      const filename = sanitizeDownloadFilename(piece.title || `Art Piece ${idx + 1}`, suffix, 'png');
      lastFilename = filename;
      triggerPrintFileDownload(
        piece.identicalPrintMasterDataUrl || effectiveIdenticalPrintMasterUrl,
        filename
      );

      const orderId = `AV2-DL-SET-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
      const manifestJson = buildPrintOrderManifestJson({
        orderId,
        artworkTitle: piece.title || effectiveArtworkTitle,
        variation,
        sizeId: selectedSizeId,
        frameId: selectedFrameId,
        matWidthId: selectedMatWidthId,
        matColorId,
        substrateId: selectedSubstrateId,
        includePrintBleed,
        pricing: currentPricing,
      });

      const confirmation: V2OrderConfirmation = {
        id: orderId,
        createdAt: Date.now(),
        orderType: 'digital-master-download',
        variationId: piece.id || variation?.id || `piece-${idx + 1}`,
        artworkTitle: piece.title || effectiveArtworkTitle,
        sizeId: selectedSizeId,
        frameId: selectedFrameId,
        matWidthId: selectedMatWidthId,
        matColorId,
        substrateId: selectedSubstrateId,
        orientation,
        includePrintBleed,
        printMasterWidthPx: printDimensions.widthPx,
        printMasterHeightPx: printDimensions.heightPx,
        pricing: currentPricing,
        partnerOrderManifestJson: manifestJson,
        status: 'completed-download',
      };

      recordOrderConfirmation(confirmation);
      onDownloadCompleted?.(confirmation);
    });

    setDownloadConfirmation({
      filename: `${artPieces.length} Archival 300-DPI Print Masters (${lastFilename})`,
      kind: 'multi-piece-set',
      count: artPieces.length,
      widthPx: printDimensions.widthPx,
      heightPx: printDimensions.heightPx,
      timestamp: Date.now(),
    });
  };

  const handleDownloadRoomPreview = () => {
    const filename = sanitizeDownloadFilename(
      effectiveArtworkTitle,
      'in-room-space-preview',
      'png'
    );
    triggerPrintFileDownload(effectiveRoomPreviewUrl, filename);
    setDownloadConfirmation({
      filename,
      kind: 'room-preview',
      count: 1,
      widthPx: trimDimensions.widthPx,
      heightPx: trimDimensions.heightPx,
      timestamp: Date.now(),
    });
  };

  const handleFillSampleAddress = () => {
    setShippingAddress({ ...SAMPLE_COLLECTOR_ADDRESS });
    setShippingErrors({});
    setHasSubmittedInvalidAddress(false);
  };

  const handleShippingFieldChange = (
    field: keyof ShippingAddressData,
    value: string
  ) => {
    const updated = { ...shippingAddress, [field]: value };
    setShippingAddress(updated);
    if (hasSubmittedInvalidAddress) {
      const validation = validateShippingAddress(updated);
      setShippingErrors(validation.errors);
    }
  };

  const handlePlacePartnerOrder = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateShippingAddress(shippingAddress);
    if (!validation.isValid) {
      setShippingErrors(validation.errors);
      setHasSubmittedInvalidAddress(true);
      return;
    }

    setShippingErrors({});
    setHasSubmittedInvalidAddress(false);

    const orderId = `AV2-ORD-${Date.now().toString(36).toUpperCase()}`;
    const manifestJson = buildPrintOrderManifestJson({
      orderId,
      artworkTitle: effectiveArtworkTitle,
      variation,
      sizeId: selectedSizeId,
      frameId: selectedFrameId,
      matWidthId: selectedMatWidthId,
      matColorId,
      substrateId: selectedSubstrateId,
      includePrintBleed,
      pricing: currentPricing,
      shippingAddress: validation.sanitized,
    });

    const confirmation: V2OrderConfirmation = {
      id: orderId,
      createdAt: Date.now(),
      orderType: 'partner-printed-edition',
      variationId: activeArtPiece?.id ?? variation?.id ?? painting?.id ?? 'custom-variation',
      artworkTitle: effectiveArtworkTitle,
      sizeId: selectedSizeId,
      frameId: selectedFrameId,
      matWidthId: selectedMatWidthId,
      matColorId,
      substrateId: selectedSubstrateId,
      orientation,
      includePrintBleed,
      printMasterWidthPx: printDimensions.widthPx,
      printMasterHeightPx: printDimensions.heightPx,
      pricing: currentPricing,
      shippingAddress: validation.sanitized,
      partnerOrderManifestJson: manifestJson,
      status: 'dispatched-to-partner',
    };

    recordOrderConfirmation(confirmation);
    setOrderReceipt(confirmation);
    onOrderCompleted?.(confirmation);
  };

  const handleDownloadOrderManifest = () => {
    if (!orderReceipt) return;
    const filename = sanitizeDownloadFilename(
      `${orderReceipt.artworkTitle}-${orderReceipt.id}`,
      'order-manifest',
      'json'
    );
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(
      orderReceipt.partnerOrderManifestJson
    )}`;
    triggerPrintFileDownload(dataUrl, filename);
  };

  const selectedSizeSpec = PRINT_SIZES[selectedSizeId];
  const selectedFrameSpec = FRAME_PROFILES[selectedFrameId];
  const selectedPartnerSpec = PRINT_PARTNERS[selectedPartnerId];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#161514]/60 backdrop-blur-[4px] md:items-center md:p-6"
      data-testid="acquire-print-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="acquire-print-modal-title"
        data-testid="acquire-print-modal"
        className="relative flex max-h-[92dvh] w-full flex-col self-end overflow-hidden rounded-t-[12px] border border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] shadow-2xl md:max-h-[90dvh] md:max-w-4xl md:self-center md:rounded-[12px]"
      >
        {/* Top Header & Segmented Mode Switcher */}
        <div className="border-b border-[#E2DDD3] bg-[#FFFFFF] px-4 py-3.5 md:px-6 md:py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#5C5852]">
                <span>Atelier Vue Print &amp; Edition Studio</span>
                <span className="text-[#E2DDD3]">•</span>
                <span className="font-mono text-[#2E4A3E]">300 DPI Archival Master</span>
                {activeArtPiece && (
                  <>
                    <span className="text-[#E2DDD3]">•</span>
                    <span className="text-[#B85D3B]">{effectiveWallLocationLabel}</span>
                  </>
                )}
              </div>
              <h2
                id="acquire-print-modal-title"
                className="mt-0.5 font-serif text-xl tracking-tight text-[#161514] md:text-2xl"
              >
                {effectiveArtworkTitle}
              </h2>
            </div>

            <button
              type="button"
              data-testid="close-acquire-modal-btn"
              aria-label="Close print acquisition modal"
              onClick={() => onClose?.()}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] transition-colors hover:bg-[#EFECE6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Multi-Art-Piece Selector Strip when multiple pieces are generated */}
          {artPieces.length > 1 && (
            <div
              data-testid="modal-art-piece-selector"
              className="mt-3 rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] p-2.5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                  Curated Art Pieces in Your Space ({artPieces.length} Pieces)
                </span>
                <button
                  type="button"
                  data-testid="modal-download-all-pieces-btn"
                  onClick={handleDownloadAllArtPieces}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-[#2E4A3E] px-3 py-1.5 text-xs font-medium text-[#FFFFFF] shadow-sm transition-colors hover:bg-[#243B31]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download All Art Pieces (300 DPI Set)</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {artPieces.map((piece, idx) => {
                  const isSelected = idx === safePieceIndex;
                  return (
                    <button
                      key={piece.id || idx}
                      type="button"
                      data-testid={`modal-art-piece-pill-${idx}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectArtPiece(idx)}
                      className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-all ${
                        isSelected
                          ? 'border-[#161514] bg-[#161514] text-[#FFFFFF] shadow-sm'
                          : 'border-[#E2DDD3] bg-[#FFFFFF] text-[#161514] hover:bg-[#EFECE6]'
                      }`}
                    >
                      <span className="font-mono font-semibold">Piece {idx + 1}</span>
                      <span className={isSelected ? 'text-[#EFECE6]' : 'text-[#5C5852]'}>·</span>
                      <span className="font-medium">{piece.title}</span>
                      {piece.wallLocationLabel && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            isSelected
                              ? 'bg-[#FFFFFF]/15 text-[#EFECE6]'
                              : 'bg-[#EFECE6] text-[#5C5852]'
                          }`}
                        >
                          {piece.wallLocationLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dual Mode Switcher */}
          <div
            role="tablist"
            aria-label="Acquisition Mode"
            className="mt-3.5 grid grid-cols-1 gap-2 rounded-lg border border-[#E2DDD3] bg-[#EFECE6] p-1 sm:grid-cols-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'download-master'}
              data-testid="tab-download-master"
              onClick={() => handleModeSwitch('download-master')}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                mode === 'download-master'
                  ? 'bg-[#FFFFFF] text-[#161514] shadow-sm'
                  : 'text-[#5C5852] hover:text-[#161514]'
              }`}
            >
              <Download className="h-4 w-4 text-[#2E4A3E]" />
              <span>Download High-Res Print Master (300 DPI)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'order-print'}
              data-testid="tab-order-print"
              onClick={() => handleModeSwitch('order-print')}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                mode === 'order-print'
                  ? 'bg-[#FFFFFF] text-[#161514] shadow-sm'
                  : 'text-[#5C5852] hover:text-[#161514]'
              }`}
            >
              <Printer className="h-4 w-4 text-[#B85D3B]" />
              <span>Order Printed &amp; Framed Version (Slight Premium)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          {effectiveScaleRecommendation?.isCalibrated && (
            <div
              data-testid="modal-scale-recommendation-banner"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#2E4A3E]/35 bg-[#2E4A3E]/8 px-4 py-3"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-[#2E4A3E] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#FFFFFF]">
                    ★ Recommended Size Based on Your Room Measurements: {effectiveScaleRecommendation.recommendedDimensionsLabel}
                  </span>
                  <span className="font-mono text-[11px] text-[#5C5852] tabular-nums">
                    ({(effectiveScaleRecommendation.recommendedSizeSpec ?? PRINT_SIZES[effectiveScaleRecommendation.recommendedSizeId]).printMasterWidthPx} × {(effectiveScaleRecommendation.recommendedSizeSpec ?? PRINT_SIZES[effectiveScaleRecommendation.recommendedSizeId]).printMasterHeightPx} px @ 300 DPI)
                  </span>
                </div>
                <p className="text-xs text-[#161514]">
                  {effectiveScaleRecommendation.rationale}
                </p>
              </div>

              {selectedSizeId !== effectiveScaleRecommendation.recommendedSizeId && (
                <button
                  type="button"
                  data-testid="modal-select-recommended-size-btn"
                  onClick={() => handleSelectSize(effectiveScaleRecommendation.recommendedSizeId)}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg bg-[#2E4A3E] px-3.5 py-2 text-xs font-medium text-[#FFFFFF] shadow-sm transition-colors hover:bg-[#243B31]"
                >
                  <span>
                    Switch to Recommended {effectiveScaleRecommendation.recommendedDimensionsLabel}
                  </span>
                </button>
              )}
            </div>
          )}

          {mode === 'download-master' ? (
            <div className="space-y-5" data-testid="mode-download-master-panel">
              {/* Side-by-Side Preview: In-Room Space Visualization vs. 300-DPI Archival Print Master */}
              <div
                data-testid="side-by-side-print-verification"
                className="rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                      In-Room Space Preview &amp; 300-DPI Archival Print Master
                    </span>
                    <p className="text-xs text-[#5C5852]">
                      Inspect your curated space alongside the standalone, frame-free, lighting-neutral 300-DPI archival print master.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFECE6] px-2.5 py-1 font-mono text-[11px] text-[#161514]">
                    <Sparkles className="h-3 w-3 text-[#B85D3B]" />
                    Atelier Vue Original Commission
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Left Card: In-Room Space Preview */}
                  <div className="flex flex-col rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#161514]">
                        <Eye className="h-3.5 w-3.5 text-[#B85D3B]" />
                        1. In-Room Space Preview
                      </span>
                      <span
                        data-testid="verification-wall-location-badge"
                        className="rounded bg-[#EFECE6] px-1.5 py-0.5 font-mono text-[10px] text-[#5C5852]"
                      >
                        {effectiveWallLocationLabel}
                      </span>
                    </div>

                    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded border border-[#E2DDD3] bg-[#EFECE6]">
                      <img
                        src={effectiveRoomPreviewUrl}
                        alt={`${effectiveArtworkTitle} in-room space preview`}
                        data-testid="verification-room-preview-img"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#5C5852]">
                      Your room with bespoke wall art harmonized to existing furnishings and natural lighting.
                    </p>
                  </div>

                  {/* Right Card: Standalone High-Res Print Master (300 DPI) */}
                  <div className="flex flex-col rounded-lg border border-[#2E4A3E]/30 bg-[#F6F4EF] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#161514]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2E4A3E]" />
                        2. Standalone 300-DPI Print Master
                      </span>
                      <span className="rounded bg-[#2E4A3E]/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#2E4A3E] tabular-nums">
                        300 DPI · Flat 2D
                      </span>
                    </div>

                    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded border border-[#E2DDD3] bg-[#FFFFFF] p-2">
                      <img
                        src={effectiveIdenticalPrintMasterUrl}
                        alt={`${effectiveArtworkTitle} 300 DPI archival print master`}
                        data-testid="verification-print-master-img"
                        className="max-h-full max-w-full object-contain shadow-sm"
                      />

                      {includePrintBleed && (
                        <div
                          data-testid="bleed-trim-marks-overlay"
                          className="pointer-events-none absolute inset-2 border border-dashed border-[#B85D3B]/75"
                        >
                          <span className="absolute right-1.5 top-1.5 rounded bg-[#161514]/80 px-1.5 py-0.5 font-mono text-[9px] text-[#FFFFFF]">
                            +0.25&quot; BLEED &amp; TRIM MARKS
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-[#5C5852]">
                      Perspective-flattened, frame-free, lighting-neutral canvas ready for archival fine-art printing.
                    </p>
                  </div>
                </div>
              </div>

              {/* Print Size Selector & Exact Pixel Dimensions Readout */}
              <div className="rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                    Target Archival Print Size &amp; 300-DPI Master Resolution
                  </label>
                  <div
                    data-testid="print-master-dimensions"
                    className="rounded-md bg-[#EFECE6] px-2.5 py-1 font-mono text-xs font-medium text-[#161514] tabular-nums"
                  >
                    {printDimensions.widthPx} × {printDimensions.heightPx} px @ {printDimensions.dpi} DPI
                    {includePrintBleed
                      ? ` (${printDimensions.totalWidthInches}" × ${printDimensions.totalHeightInches}" w/ +0.25" bleed; trim ${trimDimensions.widthPx} × ${trimDimensions.heightPx} px)`
                      : ` (${selectedSizeSpec.labelInches} · ${selectedSizeSpec.labelCm})`}
                  </div>
                </div>

                {/* Size Selector Pills */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {PRINT_SIZE_IDS.map((id) => {
                    const spec = PRINT_SIZES[id];
                    const active = selectedSizeId === id;
                    const isRecommended =
                      Boolean(effectiveScaleRecommendation?.isCalibrated) &&
                      effectiveScaleRecommendation?.recommendedSizeId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-testid={`modal-size-pill-${id}`}
                        onClick={() => handleSelectSize(id)}
                        className={`flex min-h-[44px] flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition-all ${
                          active
                            ? 'border-[#161514] bg-[#161514] text-[#FFFFFF]'
                            : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <span className="font-mono text-xs font-semibold tabular-nums">
                            {spec.labelInches}
                          </span>
                          {isRecommended && (
                            <span
                              data-testid="recommended-size-badge"
                              className={`rounded px-1 py-0.5 font-mono text-[9px] font-semibold ${
                                active
                                  ? 'bg-[#2E4A3E] text-[#FFFFFF]'
                                  : 'bg-[#2E4A3E]/15 text-[#2E4A3E]'
                              }`}
                            >
                              ★ Recommended
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono text-[10px] tabular-nums ${
                            active ? 'text-[#EFECE6]' : 'text-[#5C5852]'
                          }`}
                        >
                          {spec.printMasterWidthPx}×{spec.printMasterHeightPx} px
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Bleed & Corner Registration Marks Toggle */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DDD3] pt-3">
                  <div>
                    <span className="text-xs font-medium text-[#161514]">
                      Include +0.25&quot; Archival Print Bleed &amp; Corner Registration Marks
                    </span>
                    <p className="text-[11px] text-[#5C5852]">
                      Adds 75 px per edge at 300 DPI (+150 px total width &amp; height) for precision guillotine trimming.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={includePrintBleed}
                    data-testid="toggle-print-bleed"
                    onClick={handleToggleBleed}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                      includePrintBleed
                        ? 'border-[#2E4A3E] bg-[#2E4A3E] text-[#FFFFFF]'
                        : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                    }`}
                  >
                    <span>
                      {includePrintBleed
                        ? '+0.25" Bleed Enabled'
                        : 'Add +0.25" Bleed & Trim Marks'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Download Confirmation Banner */}
              {downloadConfirmation && (
                <div
                  data-testid="download-success-banner"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#2E4A3E]/40 bg-[#2E4A3E]/10 px-4 py-3 text-xs text-[#161514]"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2E4A3E]" />
                    <div>
                      <p className="font-medium text-[#161514]">
                        High-Resolution File Exported:{' '}
                        <span className="font-mono">{downloadConfirmation.filename}</span>
                      </p>
                      <p className="text-[11px] text-[#5C5852]">
                        {downloadConfirmation.widthPx} × {downloadConfirmation.heightPx} px @ 300 DPI · sRGB IEC61966-2.1 Archival Profile
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('order-print')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#2E4A3E] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#2E4A3E] hover:bg-[#F6F4EF]"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Or Order Framed Print</span>
                  </button>
                </div>
              )}

              {/* Primary & Secondary Download Action Bar */}
              <div className="flex flex-col gap-3 rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#161514]">
                    Ready for Immediate Local or Print-Shop Production
                  </div>
                  <div className="font-mono text-[11px] text-[#5C5852] tabular-nums">
                    Format: Lossless PNG · {printDimensions.widthPx} × {printDimensions.heightPx} px · 300 DPI
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    data-testid="modal-download-room-preview-btn"
                    onClick={handleDownloadRoomPreview}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-3.5 py-2.5 text-xs font-medium text-[#161514] transition-colors hover:bg-[#EFECE6]"
                  >
                    <Eye className="h-4 w-4 text-[#5C5852]" />
                    <span>Download In-Room Space Preview (.PNG)</span>
                  </button>

                  <button
                    type="button"
                    data-testid="modal-download-highres-btn"
                    onClick={handleDownloadHighResMaster}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#2E4A3E] px-5 py-2.5 text-xs font-medium text-[#FFFFFF] shadow-sm transition-colors hover:bg-[#243B31] sm:text-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download High-Res Print File (.PNG)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* MODE 2: ORDER PRINTED & FRAMED VERSION (SLIGHT PREMIUM) */
            <div className="space-y-5" data-testid="mode-order-print-panel">
              {/* Step 1: Size, Frame, Matboard & Substrate Configuration */}
              <div className="rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                      1. Select Edition Size, Museum Frame &amp; Archival Substrate
                    </span>
                    <p className="text-xs text-[#5C5852]">
                      Customize physical dimensions and framing before dispatching to our print partners.
                    </p>
                  </div>
                  <span className="rounded bg-[#EFECE6] px-2.5 py-1 font-mono text-xs font-medium text-[#161514] tabular-nums">
                    {selectedSizeSpec.labelInches} · {selectedFrameSpec.name}
                  </span>
                </div>

                {/* Size Pills */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#161514]">
                    Physical Print Dimensions
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PRINT_SIZE_IDS.map((id) => {
                      const spec = PRINT_SIZES[id];
                      const active = selectedSizeId === id;
                      const isRecommended =
                        Boolean(effectiveScaleRecommendation?.isCalibrated) &&
                        effectiveScaleRecommendation?.recommendedSizeId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-testid={`modal-size-pill-${id}`}
                          onClick={() => handleSelectSize(id)}
                          className={`flex min-h-[44px] flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left transition-all ${
                            active
                              ? 'border-[#161514] bg-[#161514] text-[#FFFFFF]'
                              : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-1">
                            <span className="font-mono text-xs font-semibold tabular-nums">
                              {spec.labelInches}
                            </span>
                            {isRecommended && (
                              <span
                                data-testid="recommended-size-badge"
                                className={`rounded px-1 py-0.5 font-mono text-[9px] font-semibold ${
                                  active
                                    ? 'bg-[#2E4A3E] text-[#FFFFFF]'
                                    : 'bg-[#2E4A3E]/15 text-[#2E4A3E]'
                                }`}
                              >
                                ★ Recommended
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] ${
                              active ? 'text-[#EFECE6]' : 'text-[#5C5852]'
                            }`}
                          >
                            {spec.scaleDescription}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Frame Profile Pills */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#161514]">
                    <Frame className="h-3.5 w-3.5 text-[#B85D3B]" />
                    <span>Museum Moulding &amp; Frame Profile</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {FRAME_PROFILE_IDS.map((id) => {
                      const spec = FRAME_PROFILES[id];
                      const active = selectedFrameId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-testid={`modal-frame-pill-${id}`}
                          onClick={() => handleSelectFrame(id)}
                          className={`flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
                            active
                              ? 'border-[#161514] bg-[#161514] text-[#FFFFFF]'
                              : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                          }`}
                        >
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-black/20"
                            style={{ backgroundColor: spec.primaryHex }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{spec.name}</div>
                            <div
                              className={`truncate text-[10px] ${
                                active ? 'text-[#EFECE6]' : 'text-[#5C5852]'
                              }`}
                            >
                              {spec.materialDescription}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Matboard & Substrate Row */}
                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#161514]">
                      Conservation Matboard Border
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAT_WIDTH_OPTIONS_LIST.map((mat) => {
                        const active = selectedMatWidthId === mat.id;
                        return (
                          <button
                            key={mat.id}
                            type="button"
                            data-testid={`modal-mat-pill-${mat.id}`}
                            onClick={() => handleSelectMatWidth(mat.id)}
                            className={`min-h-[44px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? 'border-[#161514] bg-[#161514] text-[#FFFFFF]'
                                : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                            }`}
                          >
                            {mat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#161514]">
                      <Layers className="h-3.5 w-3.5 text-[#2E4A3E]" />
                      <span>Archival Substrate Medium</span>
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {SUBSTRATE_OPTIONS.map((sub) => {
                        const active = selectedSubstrateId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            data-testid={`modal-substrate-pill-${sub.id}`}
                            onClick={() => handleSelectSubstrate(sub.id)}
                            className={`flex min-h-[44px] flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left transition-colors ${
                              active
                                ? 'border-[#161514] bg-[#161514] text-[#FFFFFF]'
                                : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                            }`}
                          >
                            <span className="text-xs font-medium">{sub.label}</span>
                            <span
                              className={`text-[10px] ${
                                active ? 'text-[#EFECE6]' : 'text-[#5C5852]'
                              }`}
                            >
                              {sub.detail}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: In-App Printing Partner Selection Cards (Zero External Links) */}
              <div className="rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                      2. Choose Archival Printing Partner (Direct In-App Fulfillment)
                    </span>
                    <p className="text-xs text-[#5C5852]">
                      Compare live partner wholesale print &amp; framing rates alongside our transparent studio markup.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#2E4A3E]/10 px-2.5 py-1 text-[11px] font-medium text-[#2E4A3E]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified Partner Rates · In-App Direct Dispatch
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {PARTNER_IDS.map((id) => {
                    const spec = PRINT_PARTNERS[id];
                    const quote = allPartnerQuotes[id];
                    const active = selectedPartnerId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-testid={`partner-card-${id}`}
                        aria-pressed={active}
                        onClick={() => handleSelectPartner(id)}
                        className={`flex flex-col justify-between rounded-[12px] border p-3.5 text-left transition-all ${
                          active
                            ? 'border-[#B85D3B] bg-[#F6F4EF] ring-1 ring-[#B85D3B]'
                            : 'border-[#E2DDD3] bg-[#FFFFFF] hover:bg-[#F6F4EF]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-serif text-base font-medium text-[#161514]">
                              {spec.name}
                            </span>
                            <span className="rounded bg-[#EFECE6] px-1.5 py-0.5 font-mono text-[10px] text-[#5C5852]">
                              {spec.websiteDomain}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] font-medium text-[#2E4A3E]">
                            {spec.archivalCertification}
                          </p>
                          <p className="mt-1 text-[11px] text-[#5C5852]">
                            {spec.fulfillmentRegion} · {spec.estimatedProductionDays}
                          </p>
                        </div>

                        <div className="mt-3 border-t border-[#E2DDD3] pt-2.5">
                          <div className="flex items-center justify-between text-[11px] text-[#5C5852]">
                            <span>Partner Base Cost:</span>
                            <span className="font-mono font-medium text-[#161514] tabular-nums">
                              ${quote.partnerWholesaleSubtotalUsd.toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-[#161514]">
                            <span>Total w/ +{quote.studioMarkupPercent}% &amp; Ship:</span>
                            <span className="font-mono text-sm text-[#B85D3B] tabular-nums">
                              ${quote.physicalRetailTotalUsd.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Transparent Slight-Premium Pricing Ledger */}
              <div
                data-testid="pricing-breakdown-ledger"
                className="rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                      3. Transparent Partner Cost + Slight Studio Premium Ledger
                    </span>
                    <p className="text-xs text-[#5C5852]">
                      Full open-book breakdown of {selectedPartnerSpec.name} wholesale costs and our slight AI curation &amp; 300-DPI mastering fee.
                    </p>
                  </div>

                  {/* Markup Preset Pills */}
                  <div className="flex items-center gap-1.5">
                    {MARKUP_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        data-testid={`markup-pill-${preset}`}
                        onClick={() => handleChangeMarkup(preset)}
                        className={`min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition-colors ${
                          markupPercent === preset
                            ? 'border-[#B85D3B] bg-[#B85D3B] text-[#FFFFFF]'
                            : 'border-[#E2DDD3] bg-[#F6F4EF] text-[#161514] hover:bg-[#EFECE6]'
                        }`}
                      >
                        +{preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Configurable Slight Premium Slider */}
                <div className="mb-4 rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="studio-markup-slider"
                      className="font-medium text-[#161514]"
                    >
                      Slight Studio Curation &amp; Print Mastering Premium:{' '}
                      <span className="font-mono font-semibold text-[#B85D3B]">
                        +{currentPricing.studioMarkupPercent}%
                      </span>
                    </label>
                    <span className="font-mono text-[11px] text-[#5C5852] tabular-nums">
                      Range: {MIN_STUDIO_MARKUP_PERCENT}% – {MAX_STUDIO_MARKUP_PERCENT}%
                    </span>
                  </div>
                  <input
                    id="studio-markup-slider"
                    type="range"
                    min={MIN_STUDIO_MARKUP_PERCENT}
                    max={MAX_STUDIO_MARKUP_PERCENT}
                    step={1}
                    value={markupPercent}
                    data-testid="markup-percent-slider"
                    onChange={(e) => handleChangeMarkup(Number(e.target.value))}
                    className="mt-2 h-2 w-full cursor-pointer accent-[#B85D3B]"
                  />
                </div>

                {/* Itemized Ledger Rows */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 text-[#5C5852]">
                    <span>
                      Base Printing Cost at Partner ({selectedPartnerSpec.name} ·{' '}
                      {selectedSizeSpec.labelInches})
                    </span>
                    <span
                      data-testid="ledger-base-print-cost"
                      className="font-mono font-medium text-[#161514] tabular-nums"
                    >
                      ${currentPricing.partnerBasePrintCostUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-[#5C5852]">
                    <span>
                      Partner Frame &amp; Conservation Matting ({selectedFrameSpec.name} · Mat:{' '}
                      {selectedMatWidthId})
                    </span>
                    <span
                      data-testid="ledger-frame-mat-cost"
                      className="font-mono font-medium text-[#161514] tabular-nums"
                    >
                      ${currentPricing.partnerFrameAndMatCostUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#E2DDD3] py-1.5 font-medium text-[#161514]">
                    <span>Partner Wholesale Production Subtotal</span>
                    <span
                      data-testid="ledger-wholesale-subtotal"
                      className="font-mono tabular-nums"
                    >
                      ${currentPricing.partnerWholesaleSubtotalUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-[#B85D3B]">
                    <span>
                      Slight Studio Premium (+{currentPricing.studioMarkupPercent}% over base partner cost)
                    </span>
                    <span
                      data-testid="ledger-studio-markup"
                      className="font-mono font-semibold tabular-nums"
                    >
                      +${currentPricing.studioMarkupDollarUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 text-[#5C5852]">
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-[#5C5852]" />
                      Insured Fine-Art Crate &amp; Courier Shipping
                    </span>
                    <span
                      data-testid="ledger-shipping-cost"
                      className="font-mono font-medium text-[#161514] tabular-nums"
                    >
                      ${currentPricing.insuredShippingUsd.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t-2 border-[#161514] pt-2.5 text-sm font-semibold text-[#161514]">
                    <span>Total Retail Printed &amp; Framed Edition Price</span>
                    <span
                      data-testid="ledger-total-price"
                      className="font-mono text-base text-[#161514] tabular-nums"
                    >
                      ${currentPricing.physicalRetailTotalUsd.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 4: Collector Shipping Form OR Persistent Order Confirmation Receipt */}
              {orderReceipt ? (
                <div
                  data-testid="order-confirmation-receipt"
                  className="rounded-[12px] border-2 border-[#2E4A3E] bg-[#FFFFFF] p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2DDD3] pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <PackageCheck className="h-6 w-6 text-[#2E4A3E]" />
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2E4A3E]">
                          Confirmed Print Partner Fulfillment Ticket
                        </span>
                        <h3 className="font-serif text-lg text-[#161514]">
                          Order {orderReceipt.id} Dispatched to {orderReceipt.pricing.partnerName}
                        </h3>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#2E4A3E]/10 px-3 py-1 font-mono text-xs font-semibold text-[#2E4A3E]">
                      STATUS: DISPATCHED
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                    <div className="space-y-1.5 rounded-lg bg-[#F6F4EF] p-3">
                      <div className="font-semibold uppercase tracking-[0.06em] text-[#5C5852]">
                        Edition &amp; Partner Specification
                      </div>
                      <p className="text-[#161514]">
                        <span className="text-[#5C5852]">Artwork:</span>{' '}
                        <strong>{orderReceipt.artworkTitle}</strong>
                      </p>
                      <p className="text-[#161514]">
                        <span className="text-[#5C5852]">Partner Lab:</span>{' '}
                        {orderReceipt.pricing.partnerName}
                      </p>
                      <p className="text-[#161514]">
                        <span className="text-[#5C5852]">Size &amp; Frame:</span>{' '}
                        {PRINT_SIZES[orderReceipt.sizeId].labelInches} ·{' '}
                        {FRAME_PROFILES[orderReceipt.frameId].name}
                      </p>
                      <p className="font-mono text-[#161514] tabular-nums">
                        <span className="font-sans text-[#5C5852]">Print Master:</span>{' '}
                        {orderReceipt.printMasterWidthPx} × {orderReceipt.printMasterHeightPx} px @ 300 DPI
                      </p>
                    </div>

                    <div className="space-y-1.5 rounded-lg bg-[#F6F4EF] p-3">
                      <div className="font-semibold uppercase tracking-[0.06em] text-[#5C5852]">
                        Collector Destination &amp; Total Paid
                      </div>
                      {orderReceipt.shippingAddress && (
                        <>
                          <p className="font-medium text-[#161514]">
                            {orderReceipt.shippingAddress.fullName}
                          </p>
                          <p className="text-[#5C5852]">
                            {orderReceipt.shippingAddress.streetAddress},{' '}
                            {orderReceipt.shippingAddress.city},{' '}
                            {orderReceipt.shippingAddress.stateOrProvince}{' '}
                            {orderReceipt.shippingAddress.postalCode} (
                            {orderReceipt.shippingAddress.country})
                          </p>
                        </>
                      )}
                      <p className="pt-1 font-mono text-sm font-semibold text-[#161514] tabular-nums">
                        Total Charged: ${orderReceipt.pricing.physicalRetailTotalUsd.toFixed(2)}{' '}
                        <span className="text-[11px] font-normal text-[#5C5852]">
                          (Base ${orderReceipt.pricing.partnerWholesaleSubtotalUsd.toFixed(2)} +{' '}
                          {orderReceipt.pricing.studioMarkupPercent}% premium + shipping)
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E2DDD3] pt-3.5">
                    <button
                      type="button"
                      data-testid="download-order-manifest-btn"
                      onClick={handleDownloadOrderManifest}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#161514] bg-[#F6F4EF] px-4 py-2 text-xs font-medium text-[#161514] transition-colors hover:bg-[#EFECE6]"
                    >
                      <FileJson className="h-4 w-4 text-[#B85D3B]" />
                      <span>Download Order Manifest (.JSON)</span>
                    </button>

                    <button
                      type="button"
                      data-testid="receipt-download-highres-btn"
                      onClick={handleDownloadHighResMaster}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#2E4A3E] px-4 py-2 text-xs font-medium text-[#FFFFFF] transition-colors hover:bg-[#243B31]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download High-Res Print File (.PNG)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handlePlacePartnerOrder}
                  noValidate
                  data-testid="shipping-address-form"
                  className="rounded-[12px] border border-[#E2DDD3] bg-[#FFFFFF] p-4 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#B85D3B]" />
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5C5852]">
                        4. Collector Delivery Destination
                      </span>
                    </div>

                    <button
                      type="button"
                      data-testid="fill-sample-address-btn"
                      onClick={handleFillSampleAddress}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-3 py-1.5 text-xs font-medium text-[#161514] transition-colors hover:bg-[#EFECE6]"
                    >
                      <span>Fill Sample Shipping Address</span>
                    </button>
                  </div>

                  {Object.keys(shippingErrors).length > 0 && (
                    <div
                      role="alert"
                      data-testid="shipping-validation-error"
                      className="rounded-lg border border-[#B85D3B] bg-[#B85D3B]/10 px-3.5 py-2.5 text-xs text-[#161514]"
                    >
                      <p className="font-semibold text-[#B85D3B]">
                        Please complete all required collector shipping fields:
                      </p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px]">
                        {Object.values(shippingErrors).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="shipping-fullName"
                        className="mb-1 block text-xs font-medium text-[#161514]"
                      >
                        Collector Full Name
                      </label>
                      <input
                        id="shipping-fullName"
                        type="text"
                        data-testid="shipping-input-fullName"
                        value={shippingAddress.fullName}
                        onChange={(e) =>
                          handleShippingFieldChange('fullName', e.target.value)
                        }
                        placeholder="Clara Vance"
                        className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-3 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="shipping-email"
                        className="mb-1 block text-xs font-medium text-[#161514]"
                      >
                        Email for Tracking &amp; Certificate
                      </label>
                      <input
                        id="shipping-email"
                        type="email"
                        data-testid="shipping-input-email"
                        value={shippingAddress.email}
                        onChange={(e) => handleShippingFieldChange('email', e.target.value)}
                        placeholder="collector@domain.com"
                        className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-3 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="shipping-streetAddress"
                        className="mb-1 block text-xs font-medium text-[#161514]"
                      >
                        Street Address &amp; Suite
                      </label>
                      <input
                        id="shipping-streetAddress"
                        type="text"
                        data-testid="shipping-input-streetAddress"
                        value={shippingAddress.streetAddress}
                        onChange={(e) =>
                          handleShippingFieldChange('streetAddress', e.target.value)
                        }
                        placeholder="428 Mercer Street, Penthouse B"
                        className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-3 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="shipping-city"
                        className="mb-1 block text-xs font-medium text-[#161514]"
                      >
                        City
                      </label>
                      <input
                        id="shipping-city"
                        type="text"
                        data-testid="shipping-input-city"
                        value={shippingAddress.city}
                        onChange={(e) => handleShippingFieldChange('city', e.target.value)}
                        placeholder="New York"
                        className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-3 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label
                          htmlFor="shipping-state"
                          className="mb-1 block text-xs font-medium text-[#161514]"
                        >
                          State
                        </label>
                        <input
                          id="shipping-state"
                          type="text"
                          data-testid="shipping-input-stateOrProvince"
                          value={shippingAddress.stateOrProvince}
                          onChange={(e) =>
                            handleShippingFieldChange('stateOrProvince', e.target.value)
                          }
                          placeholder="NY"
                          className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-2.5 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="shipping-postalCode"
                          className="mb-1 block text-xs font-medium text-[#161514]"
                        >
                          Postal
                        </label>
                        <input
                          id="shipping-postalCode"
                          type="text"
                          data-testid="shipping-input-postalCode"
                          value={shippingAddress.postalCode}
                          onChange={(e) =>
                            handleShippingFieldChange('postalCode', e.target.value)
                          }
                          placeholder="10013"
                          className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-2.5 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="shipping-country"
                          className="mb-1 block text-xs font-medium text-[#161514]"
                        >
                          Country
                        </label>
                        <input
                          id="shipping-country"
                          type="text"
                          data-testid="shipping-input-country"
                          value={shippingAddress.country}
                          onChange={(e) =>
                            handleShippingFieldChange('country', e.target.value)
                          }
                          placeholder="US"
                          className="min-h-[44px] w-full rounded-lg border border-[#E2DDD3] bg-[#F6F4EF] px-2.5 py-2 text-base text-[#161514] placeholder:text-[#5C5852]/60 focus:border-[#161514] focus:bg-[#FFFFFF] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DDD3] pt-3">
                    <div className="text-xs text-[#5C5852]">
                      Dispatches 300-DPI master ({printDimensions.widthPx}×{printDimensions.heightPx} px) to{' '}
                      <strong className="text-[#161514]">{selectedPartnerSpec.name}</strong>
                    </div>

                    <button
                      type="submit"
                      data-testid="submit-partner-order-btn"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#B85D3B] px-5 py-2.5 text-xs font-medium text-[#FFFFFF] shadow-sm transition-colors hover:bg-[#A04E2F] sm:text-sm"
                    >
                      <Printer className="h-4 w-4" />
                      <span>
                        Place Printed &amp; Framed Order (${currentPricing.physicalRetailTotalUsd.toFixed(2)})
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CheckoutAndOrderModal = AcquirePrintModal;
export default AcquirePrintModal;
