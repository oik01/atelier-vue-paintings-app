// src/contracts/masterContract.ts
// MASTER FROZEN ARCHITECTURE CONTRACT (C_root) — DO NOT ALTER SIGNATURES

export type RoomPresetId =
  | 'nordic-linen-living'
  | 'midcentury-walnut-study'
  | 'terracotta-sunlit-loft'
  | 'minimalist-concrete-bedroom'
  | string; // Supports custom uploaded/captured room IDs ('custom-room-...')

export type AmbientLightingMode = 'daylight' | 'golden-hour' | 'evening-sconce';

export type HarmonyMode =
  | 'complementary-accent'
  | 'tonal-sanctuary'
  | 'warm-gallery-contrast'
  | 'chromatic-split';

export type PaintingStyleId =
  | 'impasto-oil'
  | 'japandi-plaster'
  | 'rothko-colorfield'
  | 'botanical-ink'
  | 'bauhaus-geometric'
  | 'coastal-nocturne';

export type PrintSizeId = '12x16' | '18x24' | '24x36' | '30x40' | '36x48';

export type PanelLayoutMode = 'single' | 'diptych' | 'triptych';

export type OrientationMode = 'portrait' | 'landscape' | 'square';

export type CanonicalFrameProfileId =
  | 'unframed-canvas'
  | 'natural-white-oak'
  | 'american-black-walnut'
  | 'matte-gallery-black'
  | 'brushed-brass-float'
  | 'warm-travertine-ash';

export type FrameProfileId = CanonicalFrameProfileId | (string & {});

export type FrameMouldingProfileStyle =
  | 'flat-contemporary'
  | 'sloped-bevel'
  | 'ornate-beaded'
  | 'rustic-barnwood'
  | 'floater-l-channel'
  | 'metallic-brushed'
  | 'italian-crown'
  | 'unframed';

export type MatWidthId = 'none' | '1.5in' | '2.5in' | '3.5in';

export type MatColorId = 'archival-ivory' | 'warm-museum-linen' | 'charcoal-conservation';

export type PrintPartnerId = 'prodigi' | 'printful' | 'finerworks';

export type PrintSubstrateId =
  | 'hahnemuhle-etching-310gsm'
  | 'archival-cotton-canvas-400gsm'
  | 'museum-matte-acrylic';

export interface ColorSwatch {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number]; // h: 0-360, s: 0-100, l: 0-100
  luminance: number; // 0-1
  populationRatio: number; // 0-1
  role: 'wall-dominant' | 'secondary-architecture' | 'warm-undertone' | 'cool-undertone' | 'accent';
  label: string;
}

export interface Point2D {
  x: number; // Normalized 0..1 relative to room image width
  y: number; // Normalized 0..1 relative to room image height
}

export interface PerspectiveQuad {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface WallAnalysisResult {
  roomId: string;
  dominantSwatches: ColorSwatch[]; // Exactly 6 sorted swatches
  estimatedKelvin: number; // e.g., 2700..6500
  temperatureCategory: 'warm' | 'neutral' | 'cool';
  averageLuminance: number; // 0..1
  lightVector: {
    azimuthDeg: number; // 0..360 (direction light comes FROM)
    elevationDeg: number; // 15..75
    shadowOffsetX: number; // Normalized shadow cast X (-1..1)
    shadowOffsetY: number; // Normalized shadow cast Y (0..1)
    shadowSoftness: number; // 0.2..1.0
  };
  detectedWallZone: {
    centerX: number; // Normalized 0..1
    centerY: number; // Normalized 0..1
    widthRatio: number; // Normalized 0.2..0.75
    heightRatio: number; // Normalized 0.2..0.65
    confidence: number; // 0..1
    edgeEnergyScore: number;
  };
  recommendedHarmony: HarmonyMode;
  curatorialSummary: string;
}

export interface RoomAsset {
  id: RoomPresetId;
  name: string;
  architecturalStyle: string;
  wallWidthInches: number; // Default physical reference width of visible wall (e.g. 120 inches)
  eyeLevelRatioY: number; // Default 57" museum eye-level line Y ratio (e.g. 0.46)
  isCustomUpload: boolean;
  imageDataUrl: string; // Data URL or synthesized room canvas data URL
  analysis: WallAnalysisResult;
  createdAt: number;
}

export interface PigmentStop {
  hex: string;
  rgb: [number, number, number];
  pigmentName: string;
  opacity: number; // 0.1..1.0
  viscosity: number; // 0.1..1.0 (impasto thickness)
}

export interface PaintingSpec {
  id: string;
  roomId: string;
  catalogNumber: string; // e.g. "No. 01"
  title: string; // e.g. "Terracotta & Raw Umber Study"
  subtitle: string; // e.g. "Harmonized to 3,350K warm oak undertones"
  styleId: PaintingStyleId;
  harmonyMode: HarmonyMode;
  seed: number;
  pigments: PigmentStop[]; // 6 curated pigments
  lightAzimuthDeg: number;
  lightElevationDeg: number;
  aspectRatio: number; // width / height
  recommendedSizeId: PrintSizeId;
  recommendedFrameId: FrameProfileId;
  curatorialRationale: string;
}

export interface PrintSizeSpec {
  id: PrintSizeId;
  labelInches: string; // e.g. '24" × 36"'
  labelCm: string; // e.g. '61 × 91 cm'
  widthInches: number;
  heightInches: number;
  printMasterWidthPx: number; // @ 300 DPI (or scaled high-res master)
  printMasterHeightPx: number;
  dpi: number;
  scaleDescription: string;
}

export interface FrameProfileSpec {
  id: FrameProfileId;
  name: string;
  materialDescription: string;
  mouldingWidthInches: number;
  depthInches: number;
  primaryHex: string;
  secondaryHex: string;
  highlightHex: string;
  isFloatFrame: boolean;
  priceMultiplier: number;
  sku?: string;
  manufacturerId?: string;
  collectionId?: number;
  collectionName?: string;
  collectionSlug?: string;
  categoryGroup?: string;
  cornerImageUrl?: string;
  remoteCornerImageUrl?: string;
  profileImageUrl?: string;
  collectionImageUrl?: string;
  mouldingProfileStyle?: FrameMouldingProfileStyle;
}

export interface WallPlacementState {
  centerX: number; // Normalized 0..1 on room canvas
  centerY: number; // Normalized 0..1 on room canvas
  wallWidthInches: number; // Calibrated physical wall width (default 120)
  perspectiveQuad: PerspectiveQuad;
  usePerspectiveWarp: boolean;
  interPanelGapInches: number; // For diptych/triptych (default 2.0)
}

export interface PrintPartnerSpec {
  id: PrintPartnerId;
  name: string;
  websiteDomain: string;
  websiteUrl: string;
  fulfillmentRegion: string;
  archivalCertification: string;
  estimatedProductionDays: string;
  baseRatePerSqInch: number;
  shippingFlatRateUsd: number;
}

export interface PricingBreakdown {
  partnerId: PrintPartnerId;
  partnerName: string;
  partnerWebsite: string;
  sizeId: PrintSizeId;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  substrateId: PrintSubstrateId;
  panelLayout: PanelLayoutMode;
  panelCount: number;
  partnerBasePrintCostUsd: number;
  partnerFrameAndMatCostUsd: number;
  partnerWholesaleSubtotalUsd: number;
  studioMarkupPercent: number; // e.g. 18 (for 18%)
  studioMarkupDollarUsd: number;
  insuredShippingUsd: number;
  physicalRetailTotalUsd: number;
  digitalMasterLicenseUsd: number; // e.g. 29.00
}

export interface HighResExportOptions {
  targetWidthPx: number;
  targetHeightPx: number;
  dpi: number;
  includePrintBleed: boolean; // +0.25" bleed & crop marks
  colorProfileLabel: 'sRGB IEC61966-2.1' | 'AdobeRGB (1998) Archival';
}

export interface HighResExportResult {
  paintingId: string;
  title: string;
  dataUrl: string;
  blobSizeBytes: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
  includedBleed: boolean;
  certificateHtml: string;
  productionManifestJson: string;
}

export interface LookbookPin {
  id: string;
  pinnedAt: number;
  roomId: string;
  painting: PaintingSpec;
  sizeId: PrintSizeId;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
  substrateId: PrintSubstrateId;
  placement: WallPlacementState;
  retailPriceUsd: number;
}

export interface OrderRecord {
  id: string;
  createdAt: number;
  orderType: 'digital-master-download' | 'partner-printed-edition';
  roomId: string;
  painting: PaintingSpec;
  sizeId: PrintSizeId;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
  substrateId: PrintSubstrateId;
  pricing: PricingBreakdown;
  shippingAddress?: {
    fullName: string;
    email: string;
    streetAddress: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
    country: string;
  };
  partnerOrderPayloadJson: string;
  status: 'completed-download' | 'dispatched-to-partner';
}

export const PRINT_SIZES: Record<PrintSizeId, PrintSizeSpec> = {
  '12x16': {
    id: '12x16',
    labelInches: '12" × 16"',
    labelCm: '30 × 41 cm',
    widthInches: 12,
    heightInches: 16,
    printMasterWidthPx: 1800,
    printMasterHeightPx: 2400,
    dpi: 300,
    scaleDescription: 'Intimate Study',
  },
  '18x24': {
    id: '18x24',
    labelInches: '18" × 24"',
    labelCm: '46 × 61 cm',
    widthInches: 18,
    heightInches: 24,
    printMasterWidthPx: 2100,
    printMasterHeightPx: 2800,
    dpi: 300,
    scaleDescription: 'Gallery Standard',
  },
  '24x36': {
    id: '24x36',
    labelInches: '24" × 36"',
    labelCm: '61 × 91 cm',
    widthInches: 24,
    heightInches: 36,
    printMasterWidthPx: 2400,
    printMasterHeightPx: 3600,
    dpi: 300,
    scaleDescription: 'Statement Focal Piece',
  },
  '30x40': {
    id: '30x40',
    labelInches: '30" × 40"',
    labelCm: '76 × 102 cm',
    widthInches: 30,
    heightInches: 40,
    printMasterWidthPx: 2700,
    printMasterHeightPx: 3600,
    dpi: 300,
    scaleDescription: 'Grand Salon Scale',
  },
  '36x48': {
    id: '36x48',
    labelInches: '36" × 48"',
    labelCm: '91 × 122 cm',
    widthInches: 36,
    heightInches: 48,
    printMasterWidthPx: 3000,
    printMasterHeightPx: 4000,
    dpi: 300,
    scaleDescription: 'Architectural Collector Scale',
  },
};

export const FRAME_PROFILES: Record<FrameProfileId, FrameProfileSpec> = {
  'unframed-canvas': {
    id: 'unframed-canvas',
    name: 'Unframed Gallery Wrap',
    materialDescription: '1.5" Deep Kiln-Dried Pine Stretcher · Mirrored Edge',
    mouldingWidthInches: 0,
    depthInches: 1.5,
    primaryHex: '#E5E0D5',
    secondaryHex: '#C9C2B4',
    highlightHex: '#F5F2EB',
    isFloatFrame: false,
    priceMultiplier: 1.0,
    sku: 'F0',
    collectionName: 'Unframed Gallery Standard',
    categoryGroup: 'Contemporary & Modern',
    mouldingProfileStyle: 'unframed',
  },
  'natural-white-oak': {
    id: 'natural-white-oak',
    name: 'Natural White Oak',
    materialDescription: 'Quarter-Sawn Appalachian White Oak · Raw Matte Wax',
    mouldingWidthInches: 1.25,
    depthInches: 1.75,
    primaryHex: '#C8A97E',
    secondaryHex: '#A6865B',
    highlightHex: '#DFC59E',
    isFloatFrame: false,
    priceMultiplier: 1.38,
    sku: 'F131',
    manufacturerId: 'W2112',
    collectionName: 'Nature Wood',
    categoryGroup: 'Natural Woods & Hardwoods',
    cornerImageUrl: '/frames/w2112_3d.jpg',
    mouldingProfileStyle: 'flat-contemporary',
  },
  'american-black-walnut': {
    id: 'american-black-walnut',
    name: 'American Black Walnut',
    materialDescription: 'Solid Heartwood Walnut · Hand-Rubbed Oil Finish',
    mouldingWidthInches: 1.35,
    depthInches: 1.75,
    primaryHex: '#4A3525',
    secondaryHex: '#2F2015',
    highlightHex: '#694E38',
    isFloatFrame: false,
    priceMultiplier: 1.48,
    sku: 'F204',
    manufacturerId: 'W3021',
    collectionName: 'Nature Wood',
    categoryGroup: 'Natural Woods & Hardwoods',
    cornerImageUrl: '/frames/w3021_3d.jpg',
    mouldingProfileStyle: 'flat-contemporary',
  },
  'matte-gallery-black': {
    id: 'matte-gallery-black',
    name: 'Museum Matte Ash Black',
    materialDescription: 'Ebonized Ash Wood · Subtle Open Grain',
    mouldingWidthInches: 1.15,
    depthInches: 1.6,
    primaryHex: '#1C1B1A',
    secondaryHex: '#0E0D0C',
    highlightHex: '#33312F',
    isFloatFrame: false,
    priceMultiplier: 1.32,
    sku: 'F96',
    manufacturerId: '201-421R',
    collectionName: 'Gallery Contemporary',
    categoryGroup: 'Contemporary & Modern',
    cornerImageUrl: '/frames/201-421r_3d.jpg',
    mouldingProfileStyle: 'flat-contemporary',
  },
  'brushed-brass-float': {
    id: 'brushed-brass-float',
    name: 'Gilded Brass Float Frame',
    materialDescription: 'Anodized Architectural Brass · 0.35" Shadow Gap',
    mouldingWidthInches: 0.85,
    depthInches: 2.0,
    primaryHex: '#B69553',
    secondaryHex: '#7E6430',
    highlightHex: '#DEC284',
    isFloatFrame: true,
    priceMultiplier: 1.62,
    sku: 'F458',
    manufacturerId: 'P2007',
    collectionName: 'Modern Float',
    categoryGroup: 'Canvas Floater Frames',
    cornerImageUrl: '/frames/p2007_3d.jpg',
    mouldingProfileStyle: 'floater-l-channel',
  },
  'warm-travertine-ash': {
    id: 'warm-travertine-ash',
    name: 'Warm Limestone & Ash',
    materialDescription: 'Gessoed Gallery Ash · Warm Alabaster Lacquer',
    mouldingWidthInches: 1.25,
    depthInches: 1.6,
    primaryHex: '#EAE5DC',
    secondaryHex: '#CBC4B7',
    highlightHex: '#F8F6F1',
    isFloatFrame: false,
    priceMultiplier: 1.35,
    sku: 'F312',
    manufacturerId: '201-421RW',
    collectionName: 'Gallery Contemporary',
    categoryGroup: 'Contemporary & Modern',
    cornerImageUrl: '/frames/201-421rw_3d.jpg',
    mouldingProfileStyle: 'flat-contemporary',
  },
} as Record<FrameProfileId, FrameProfileSpec>;

export const PRINT_PARTNERS: Record<PrintPartnerId, PrintPartnerSpec> = {
  prodigi: {
    id: 'prodigi',
    name: 'Prodigi Fine Art Guild',
    websiteDomain: 'prodigi.com',
    websiteUrl: 'https://www.prodigi.com',
    fulfillmentRegion: 'US / UK / EU Archival Hubs',
    archivalCertification: 'Fine Art Trade Guild Certified · 100+ Yr Archival Pigment',
    estimatedProductionDays: '3–4 business days',
    baseRatePerSqInch: 0.068,
    shippingFlatRateUsd: 16.5,
  },
  printful: {
    id: 'printful',
    name: 'Printful Museum Line',
    websiteDomain: 'printful.com',
    websiteUrl: 'https://www.printful.com',
    fulfillmentRegion: 'North America & Europe Express',
    archivalCertification: 'Museum-Grade Giclée · Ayous & Oak Renewable Wood',
    estimatedProductionDays: '2–4 business days',
    baseRatePerSqInch: 0.062,
    shippingFlatRateUsd: 14.0,
  },
  finerworks: {
    id: 'finerworks',
    name: 'FinerWorks Archival Lab',
    websiteDomain: 'finerworks.com',
    websiteUrl: 'https://finerworks.com',
    fulfillmentRegion: 'San Antonio Master Print Lab (USA)',
    archivalCertification: 'Hahnemühle Certified Studio · 12-Color Lucia Pro Ink',
    estimatedProductionDays: '4–6 business days',
    baseRatePerSqInch: 0.076,
    shippingFlatRateUsd: 18.0,
  },
};

export const STORAGE_KEY = 'atelier_vue_state_v1';

// V2 & V2.1 AI ROOM REIMAGINING & SCREENSHOT-TO-PRINT CONTRACTS

export type AiEngineId =
  | 'astra'
  | 'gemini-argon'
  | 'astra-sota'
  | 'gemini-argon-pro'
  | 'deepseek-sota';

export type WallPlacementAction = 'add-only' | 'replace-existing' | 'both';

export type ArtStyleSelectionMode = 'ai-curated' | 'specific-style';

export type CuratedArtStylePreset =
  | 'impasto-oil'
  | 'minimalist-abstract'
  | 'warm-midcentury'
  | 'wabi-sabi-plaster'
  | 'impressionist-landscape'
  | 'bauhaus-geometric'
  | 'botanical-ink'
  | 'rothko-colorfield'
  | 'nordic-monochrome'
  | 'mediterranean-fresco'
  | 'contemporary-figurative'
  | 'japanese-woodblock'
  | 'sculptural-paper-relief'
  | 'abstract-expressionist'
  | 'classical-still-life'
  | 'desert-earth-strata';

export interface NormalizedCropBox {
  ymin: number; // 0..1000 normalized top
  xmin: number; // 0..1000 normalized left
  ymax: number; // 0..1000 normalized bottom
  xmax: number; // 0..1000 normalized right
}

export interface RoomAngleAsset {
  id: string;
  label: string; // e.g., "Angle 1 (Main Wall)", "Angle 2 (Side Perspective)"
  dataUrl: string;
  hasExistingWallArt?: boolean;
  /** Indicates this photo is looking head-on at the wall in a level manner and is the one used for sizing */
  isHeadOnSizingPhoto?: boolean;
}

export interface RoomPreservationVerification {
  passed: boolean;
  furniturePreserved: boolean;
  roomDimensionsPreserved: boolean;
  onlyArtChanged: boolean;
  verifierModelId: string;
  summaryNote: string;
  attemptsUsed: number;
}

export interface ReimaginedRoomViewpoint {
  angleId: string;
  angleLabel: string;
  originalRoomDataUrl: string;
  reimaginedRoomDataUrl: string;
  detectedCropBox: NormalizedCropBox;
  activeCropBox: NormalizedCropBox;
  /** Tight inner picture/mat boundary inside the outer frame molding */
  innerPictureBox?: NormalizedCropBox;
  /** Separate transparent Frame Detection Layer overlaid on the photo (flush on the frame with zero wall space) */
  frameDetectionLayerDataUrl?: string;
  croppedScreenshotDataUrl: string;
  preservationVerification: RoomPreservationVerification;
  detectedFrameId?: FrameProfileId;
  detectedMatWidthId?: MatWidthId;
  detectedMatColorId?: MatColorId;
  frameMatMatchSummary?: string;
  /** Indicates this viewpoint corresponds to the level head-on photo used for sizing */
  isHeadOnSizingPhoto?: boolean;
  finerworksVerification?: FinerWorksOptionsVerification;
  finerworksProductCode?: string;
  finerworksMediaId?: number;
  finerworksGlazingId?: FinerWorksGlazingId;
  customPrintWidthIn?: number;
  customPrintHeightIn?: number;
}

export type AtelierWorkflowPageId =
  | 'page-1-space'
  | 'page-2-curation'
  | 'page-3-scale'
  | 'page-3-creating'
  | 'page-4-gallery';

export type ArtPieceCountMode =
  | 'auto-multi-wall'
  | 'single-piece'
  | 'multi-piece-pair'
  | 'multi-piece-trio';

export interface ImageCaliperSegment {
  /** Normalized 0..1000 start X on the room image */
  x1: number;
  /** Normalized 0..1000 start Y on the room image */
  y1: number;
  /** Normalized 0..1000 end X on the room image */
  x2: number;
  /** Normalized 0..1000 end Y on the room image */
  y2: number;
  /** Short caliper badge code shown on the image ('A' | 'B' | 'C') */
  badgeCode: string;
  /** Short caliper label shown on the image (e.g., 'Furniture Width', 'Wall Span', 'Vertical Clearance') */
  shortLabel: string;
  /** Orientation of the measurement on the image */
  axis: 'horizontal' | 'vertical' | 'diagonal';
  /** Hex accent color of the caliper on the image */
  colorHex: string;
}

export interface ScaleCalibrationQuestion {
  id: string;
  questionText: string;
  helperText: string;
  unitLabel: string; // e.g. 'inches'
  placeholder: string;
  suggestedQuickValuesInches: Array<{ label: string; valueInches: number }>;
  userAnswerInches?: number | null;
  caliper?: ImageCaliperSegment;
}

export interface ScaleCalibrationResult {
  isCalibrated: boolean;
  recommendedSizeId: PrintSizeId;
  recommendedSizeSpec?: PrintSizeSpec;
  recommendedDimensionsLabel: string;
  estimatedWallWidthInches: number;
  estimatedWallHeightInches?: number;
  estimatedArtworkWidthInches: number;
  estimatedArtworkHeightInches: number;
  /** Recalibrated outer frame width in inches in the photo based on nearby caliper measurements */
  calculatedOuterFrameWidthInches?: number;
  /** Recalibrated outer frame height in inches in the photo based on nearby caliper measurements */
  calculatedOuterFrameHeightInches?: number;
  /** Recalibrated inner picture/print width in inches in the photo (after subtracting frame & mat width) */
  calculatedInnerPictureWidthInches?: number;
  /** Recalibrated inner picture/print height in inches in the photo (after subtracting frame & mat width) */
  calculatedInnerPictureHeightInches?: number;
  /** Standard print edition outer framed width in inches (including selected frame & mat) */
  suggestedEditionOuterWidthInches?: number;
  /** Standard print edition outer framed height in inches (including selected frame & mat) */
  suggestedEditionOuterHeightInches?: number;
  /** Percentage difference in scale between Caliper 1 and Caliper 2 when two measurements are given */
  scaleDiscrepancyPercent?: number;
  /** True when two measurements differ in scale by more than 5% (> 5.0%), triggering a measurement inaccuracy error */
  hasScaleInaccuracyError?: boolean;
  /** Human-readable error message when two measurements differ in scale by more than 5% */
  scaleErrorExplanation?: string;
  rationale: string;
  questionsAnsweredCount: number;
}

export interface GeneratedArtPiece {
  id: string;
  index: number;
  title: string;
  wallLocationLabel: string;
  description: string;
  identicalPrintMasterDataUrl: string;
  printMasterWidthPx: number;
  printMasterHeightPx: number;
  internalBounds?: NormalizedCropBox;
  detectedFrameId?: FrameProfileId;
  detectedMatWidthId?: MatWidthId;
  detectedMatColorId?: MatColorId;
}

export interface AiPromptConfiguration {
  engineId: AiEngineId;
  placementAction: WallPlacementAction;
  placementLocationNote?: string; // User-typed expected placement location
  artPieceCountMode?: ArtPieceCountMode;
  styleMode: ArtStyleSelectionMode;
  stylePreset: CuratedArtStylePreset;
  customStyleNote: string;
  additionalUserDetails?: string; // User-typed additional details (internal prompt stays hidden)
  editablePromptText: string; // Internal compiled prompt (not shown as raw prompt in UI)
  isPromptManuallyEdited: boolean;
  finerworksConstraints?: FinerWorksPromptConstraintConfig;
}

export interface CuratorialSpaceAnalysis {
  furnitureStyleAnalysis: string;
  spaceLocationAnalysis: string;
  colorPaletteAnalysis: string;
  artDirectionRationale: string;
  optionLabel?: string;
}

export interface ReimaginedRoomVariation {
  id: string;
  createdAt: number;
  engineId: AiEngineId;
  engineModelName: string; // e.g. 'GPT-6 Astra (openai/gpt-6-astra)' or 'Gemini 4 Argon (google/gemini-4-argon)'
  imageModelName: string; // e.g. 'google/gemini-nano-banana-2.1'
  placementAction: WallPlacementAction;
  styleMode: ArtStyleSelectionMode;
  promptUsed: string;
  originalRoomDataUrl: string;
  reimaginedRoomDataUrl: string;
  detectedCropBox: NormalizedCropBox;
  activeCropBox: NormalizedCropBox;
  /** Tight inner picture/mat boundary inside the outer frame molding */
  innerPictureBox?: NormalizedCropBox;
  /** Separate transparent Frame Detection Layer overlaid on the photo (flush on the frame with zero wall space) */
  frameDetectionLayerDataUrl?: string;
  croppedScreenshotDataUrl: string;
  identicalPrintMasterDataUrl: string;
  printMasterWidthPx: number;
  printMasterHeightPx: number;
  artworkTitle: string;
  artworkDescription: string;
  roomStyleSummary: string;
  curatorialReasoning?: CuratorialSpaceAnalysis;
  viewpoints?: ReimaginedRoomViewpoint[];
  activeViewpointIndex?: number;
  preservationVerification?: RoomPreservationVerification;
  artPieces?: GeneratedArtPiece[];
  activeArtPieceIndex?: number;
  scaleRecommendation?: ScaleCalibrationResult | null;
  detectedFrameId?: FrameProfileId;
  detectedMatWidthId?: MatWidthId;
  detectedMatColorId?: MatColorId;
  frameMatMatchSummary?: string;
  finerworksVerification?: FinerWorksOptionsVerification;
  finerworksProductCode?: string;
  finerworksMediaId?: number;
  finerworksGlazingId?: FinerWorksGlazingId;
  customPrintWidthIn?: number;
  customPrintHeightIn?: number;
}

export type AiGenerationStage =
  | 'idle'
  | 'reimagining-room'
  | 'sprinkling-magic'
  | 'verifying-room-preservation'
  | 'detecting-and-cropping-art'
  | 'generating-identical-print'
  | 'completed'
  | 'error';

export const AI_ENGINE_SPECS: Record<
  AiEngineId,
  {
    id: AiEngineId;
    label: string;
    visionModelId: string;
    imageModelId: string;
    badge: string;
    description: string;
  }
> = {
  astra: {
    id: 'astra',
    label: 'Astra',
    visionModelId: 'openai/gpt-6-astra',
    imageModelId: 'google/gemini-nano-banana-2.1',
    badge: 'GPT-6 Astra + Multimodal Image Gen',
    description:
      'Uses OpenAI GPT-6 Astra for room spatial analysis & artwork localization paired with studio image synthesis.',
  },
  'gemini-argon': {
    id: 'gemini-argon',
    label: 'Gemini Argon',
    visionModelId: 'google/gemini-4-argon',
    imageModelId: 'google/gemini-nano-banana-2.1',
    badge: 'Gemini 4 Argon + Nano Banana 2.1',
    description:
      'Uses Google Gemini 4 Argon for architectural lighting & harmony direction paired with native Gemini image synthesis.',
  },
  'astra-sota': {
    id: 'astra-sota',
    label: 'Astra SOTA',
    visionModelId: 'openai/gpt-6-astra',
    imageModelId: 'openai/gpt-5.4-image-2',
    badge: 'GPT-6 Astra + GPT-5.4 Image 2',
    description:
      'Uses flagship OpenAI GPT-6 Astra for room vision & preservation paired with OpenAI GPT-5.4 Image 2 synthesis.',
  },
  'gemini-argon-pro': {
    id: 'gemini-argon-pro',
    label: 'Gemini Argon Pro',
    visionModelId: 'google/gemini-4-argon',
    imageModelId: 'google/gemini-3-pro-image',
    badge: 'Gemini 4 Argon + Gemini 3 Pro Image',
    description:
      'Uses flagship Google Gemini 4 Argon for spatial direction paired with Google Gemini 3 Pro Image synthesis.',
  },
  'deepseek-sota': {
    id: 'deepseek-sota',
    label: 'DeepSeek V4.1',
    visionModelId: 'deepseek/deepseek-v4.1-flash-1017',
    imageModelId: 'google/gemini-3.1-flash-image',
    badge: 'DeepSeek V4.1 Vision + Flash Image',
    description:
      'Uses DeepSeek V4.1 multimodal vision for room curatorial direction & preservation paired with fast studio image synthesis.',
  },
};

// ============================================================================
// FINERWORKS API V3, AUTO-SYNC CATALOG, DUAL AI CHECKER & WHITE-LABEL CONTRACTS
// ============================================================================

export type FinerWorksProductTypeId = 5 | 1 | 2 | 3; // 5=Fine Art Paper, 1=Canvas, 2=Metal, 3=Acrylic

export type FinerWorksGlazingId = 'none' | 'clear-acrylic' | 'non-glare-museum-acrylic';

export type FinerWorksStandardSizeId =
  | '8x10'
  | '11x14'
  | '12x16'
  | '16x20'
  | '18x24'
  | '20x30'
  | '24x36'
  | '30x40'
  | '36x48'
  | '40x60'
  | 'custom';

export type WhiteLabelBrandId =
  | 'atelier-koma'
  | 'galerie-vauban'
  | 'werkstatt-neue'
  | 'stillwater-press'
  | 'the-nocturne-archive';

export interface FinerWorksMediaSpec {
  mediaId: number; // FinerWorks MediaID (e.g. 6, 41, 42, 45, 48, 12, 14, 21, 22, 31)
  productTypeId: FinerWorksProductTypeId;
  substrateSlug: PrintSubstrateId | string;
  name: string;
  shortName: string;
  description: string;
  gsmOrThicknessLabel: string;
  surfaceFinish:
    | 'matte-rag'
    | 'textured-etching'
    | 'satin-canvas'
    | 'metallic-canvas'
    | 'gloss-metal'
    | 'brushed-metal'
    | 'face-mounted-acrylic';
  defaultStyleId: number; // FinerWorks MountingID / StyleID (e.g. 9, 10, 15, 16, 25)
  canFrame: boolean;
  canMat: boolean;
  canGlaze: boolean;
  compatibleFrameClassIds: number[]; // 1=Standard Wood/Metal, 2=Deep Profile, 3=Floater Frame
  minWidthIn: number;
  minHeightIn: number;
  maxWidthIn: number;
  maxHeightIn: number;
  bleedInches: number;
  baseRatePerSqInchUsd: number;
  minimumUnitPriceUsd: number;
}

export interface FinerWorksFrameCollectionSpec {
  collectionId: number;
  slug: string;
  name: string;
  title: string;
  description: string;
  categoryGroup: string;
  frameCount: number;
  collectionImageUrl: string;
  localCollectionImagePath: string;
}

export interface FinerWorksFrameMouldingSpec {
  finerworksFrameId: number; // FinerWorks FrameID (0=Unframed, or 1..596 across all 231 frames)
  profileId: FrameProfileId;
  collectionId: number;
  collectionName: string;
  collectionSlug?: string;
  collectionDescription?: string;
  categoryGroup?: string;
  sku?: string;
  manufacturerId?: string;
  name: string;
  shortLabel: string;
  materialDescription: string;
  composite: 'Solid Hardwood' | 'Anodized Aluminum' | 'Gessoed Ash' | 'Stretcher Bar' | (string & {});
  colorLabel: string;
  thicknessInches: number; // Face width of moulding in inches
  depthInches: number; // Wall projection depth in inches
  rabbetInches: number; // Inner recess lip overlap in inches (typically 0.25" or 0.375")
  lipInches: number;
  floatOffsetInches: number; // Shadow gap for canvas/metal floater frames (e.g. 0.35")
  minWidthIn: number;
  minHeightIn: number;
  maxWidthIn: number;
  maxHeightIn: number;
  allowGlazing: boolean;
  allowMatting: boolean;
  isFloatFrame: boolean;
  frameClassId: number; // 1=Standard, 2=Gallery Deep, 3=Floater, 0=Unframed
  startingPriceUsd: number;
  ratePerLinearInchUsd: number;
  primaryHex: string;
  secondaryHex: string;
  highlightHex: string;
  cornerImageUrl?: string; // Local catalogue corner sample image (/frames/<basename>_3d.jpg)
  remoteCornerImageUrl?: string; // Remote FinerWorks 3D corner image URL
  profileImageUrl?: string;
  flatCornerImageUrl?: string;
  studio360ImageUrl?: string;
  collectionImageUrl?: string;
  mouldingProfileStyle?: FrameMouldingProfileStyle;
}

export interface FinerWorksMatBoardSpec {
  finerworksMatId: number; // 0=None, 1=Pure White, 2=Archival Ivory, 3=Warm Museum Linen, 4=Charcoal Conservation
  matColorId: MatColorId;
  name: string;
  hex: string;
  coreColor: string;
  plyThickness: number; // 4-Ply
  composite: string; // "4-Ply Acid-Free Archival Cotton Rag"
  minWidthIn: number;
  minHeightIn: number;
  maxWidthIn: number;
  maxHeightIn: number;
  startingPriceUsd: number;
  ratePerOuterSqInchUsd: number;
}

export interface FinerWorksGlazingSpec {
  finerworksGlassId: number; // 0=None, 1=Premium Clear Acrylic, 2=Non-Glare Museum Matte Acrylic
  glazingId: FinerWorksGlazingId;
  name: string;
  shortLabel: string;
  description: string;
  uvFilteringPercent: number;
  startingPriceUsd: number;
  ratePerSqInchUsd: number;
}

export interface FinerWorksSizeOptionSpec {
  id: FinerWorksStandardSizeId;
  legacySizeId: PrintSizeId; // Maps cleanly to PrintSizeId for backward compatibility
  widthInches: number;
  heightInches: number;
  labelInches: string;
  labelCm: string;
  aspectRatioLabel: string;
  optimalPrintWidthPx: number; // @ 300 PPI
  optimalPrintHeightPx: number; // @ 300 PPI
  scaleCategory: string;
}

export interface FinerWorksDynamicProductConfig {
  productTypeId: FinerWorksProductTypeId;
  mediaId: number;
  styleId: number;
  printWidthIn: number;
  printHeightIn: number;
  frameProfileId: FrameProfileId;
  finerworksFrameId: number;
  matWidthId: MatWidthId;
  matBorderInches: number;
  matColorId: MatColorId;
  finerworksMatId: number;
  glazingId: FinerWorksGlazingId;
  finerworksGlassId: number;
  quantity?: number;
  colorCorrect?: boolean;
}

export interface FinerWorksBuiltProductSpec {
  productCode: string; // e.g., "5M41M9S18X24F131S23X29J2S18X24G1"
  valid: boolean;
  validationNotes: string[];
  config: FinerWorksDynamicProductConfig;
  physicalDimensions: {
    printWidthIn: number;
    printHeightIn: number;
    matWindowWidthIn: number;
    matWindowHeightIn: number;
    matOuterWidthIn: number;
    matOuterHeightIn: number;
    frameInteriorWidthIn: number;
    frameInteriorHeightIn: number;
    frameOuterWidthIn: number;
    frameOuterHeightIn: number;
    wallDepthIn: number;
    estimatedWeightOz: number;
    isRigidShipment: boolean;
    optimalWidthPx300Ppi: number;
    optimalHeightPx300Ppi: number;
  };
  pricing: {
    productQty: number;
    basePrintPriceUsd: number; // FinerWorks product_price
    addFramePriceUsd: number; // FinerWorks add_frame_price
    addMat1PriceUsd: number; // FinerWorks add_mat_1_price
    addGlazingPriceUsd: number; // FinerWorks add_glazing_price
    volumeDiscountPercent: number;
    wholesaleTotalUsd: number; // FinerWorks total_price
    suggestedGeoRetailUsd: number; // FinerWorks geo_price
  };
}

export interface FinerWorksCatalogSyncSnapshot {
  syncVersion: string;
  lastSyncedAt: number;
  syncSource: 'finerworks-v3-live-api' | 'finerworks-v3-verified-catalog-engine';
  apiConnected: boolean;
  isTestMode: boolean;
  mediaSpecs: FinerWorksMediaSpec[];
  frameMouldings: FinerWorksFrameMouldingSpec[];
  matBoards: FinerWorksMatBoardSpec[];
  glazingOptions: FinerWorksGlazingSpec[];
  sizeOptions: FinerWorksSizeOptionSpec[];
  cachedPriceMatrix: Record<string, FinerWorksBuiltProductSpec['pricing']>;
  totalOptionsSyncedCount: number;
  autoRefreshIntervalMs: number;
}

export interface FinerWorksPromptConstraintConfig {
  mode: 'curator-selects-finerworks' | 'user-locked-finerworks';
  lockedMediaId?: number;
  lockedSubstrateSlug?: PrintSubstrateId | string;
  lockedFrameId?: FrameProfileId;
  lockedMatWidthId?: MatWidthId;
  lockedMatColorId?: MatColorId;
  lockedGlazingId?: FinerWorksGlazingId;
  lockedSizeId?: FinerWorksStandardSizeId;
  lockedCustomWidthIn?: number;
  lockedCustomHeightIn?: number;
}

/**
 * Separate AI Checker Agent #2: FinerWorks Options & Framing Compliance Verification
 * (Independent from RoomPreservationVerification which checks room & furniture dimensions)
 */
export interface FinerWorksOptionsVerification {
  passed: boolean;
  frameOptionValid: boolean;
  mattingAndGlazingValid: boolean;
  sizingAndAspectRatioValid: boolean;
  substrateSurfaceAuthentic: boolean;
  matchedFinerWorksProductCode: string;
  matchedFrameProfileId: FrameProfileId;
  matchedFinishesSummary: string;
  matchedSizeLabel: string;
  matchedMediaId: number;
  verifierModelId: string;
  verificationSummary: string;
  discrepanciesFound: string[];
  correctionInstructions?: string;
  attemptsUsed: number;
}

export interface WhiteLabelBusinessInfo {
  first_name: string;
  last_name: string;
  company_name: string;
  address_1: string;
  address_2: string;
  city: string;
  state_code: string;
  zip_postal_code: string;
  country_code: string;
  phone: string;
  email: string;
  website: string;
}

export interface WhiteLabelBrandIdentitySpec {
  id: WhiteLabelBrandId;
  brandName: string;
  tagline: string;
  establishedYear: string;
  originCity: string;
  brandPersonaDescription: string;
  isFlagshipDefault?: boolean;
  logoSvgMarkup: string; // 600x180 SVG
  logoDataUrl: string; // data:image/svg+xml;utf8,... for immediate <img src> and canvas 600x180 JPG export
  businessInfo: WhiteLabelBusinessInfo;
  packingSlipSpec: {
    headerTitle: string;
    collectorGreeting: string;
    curatorialNoteTemplate: string;
    unboxingCareInstructions: string[];
    accentHex: string;
    secondaryHex: string;
    paperTintHex: string;
  };
  coaSpec: {
    certificateTitle: string;
    archivalGuaranteeStatement: string;
    editionNamingFormat: string;
    chiefCuratorName: string;
    chiefCuratorTitle: string;
    embossedSealLabel: string;
  };
}

export interface FinerWorksShippingOptionQuote {
  id: number;
  shippingCode: string; // e.g. "14", "SD", "EC", "EX", "ON"
  shippingClassCode: 'EC' | 'SD' | 'EX' | 'ON';
  carrier: 'USPS' | 'UPS' | 'FedEx';
  shippingMethod: string;
  transitTime: string;
  rateUsd: number;
  calculatedTotal: {
    orderPo: string;
    orderSubtotalUsd: number;
    orderShippingRateUsd: number;
    orderDiscountUsd: number;
    orderSalesTaxUsd: number;
    orderSalesTaxRate: number;
    orderGrandTotalUsd: number;
  };
}

