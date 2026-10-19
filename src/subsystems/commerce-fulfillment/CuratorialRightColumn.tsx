// src/subsystems/commerce-fulfillment/CuratorialRightColumn.tsx
// Leaf 4B — Adaptive Desktop Curatorial Column (>= 1024px) & Mobile 4-Zone Express Studio Deck (< 1024px)

import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Download,
  ExternalLink,
  Frame,
  Layers,
  Maximize2,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Truck,
} from 'lucide-react';
import {
  AmbientLightingMode,
  FRAME_PROFILES,
  FrameProfileId,
  FrameProfileSpec,
  HarmonyMode,
  MatColorId,
  MatWidthId,
  OrientationMode,
  PaintingSpec,
  PanelLayoutMode,
  PricingBreakdown,
  PRINT_PARTNERS,
  PRINT_SIZES,
  PrintPartnerId,
  PrintSizeId,
  PrintSubstrateId,
  RoomAsset,
} from '../../contracts/masterContract';
import {
  calculatePrintPricing,
  clampStudioMarkupPercent,
  compareAllPartnersPricing,
  DEFAULT_STUDIO_MARKUP_PERCENT,
  DIGITAL_MASTER_LICENSE_USD,
  MAT_COLOR_OPTIONS,
  MAT_WIDTH_OPTIONS,
  MAX_STUDIO_MARKUP_PERCENT,
  MIN_STUDIO_MARKUP_PERCENT,
  PRINT_SUBSTRATES,
} from './printPartnerPricingEngine';
import { useAtelierStore } from './studioStoreAndPersistence';
import { renderPaintingThumbnailDataUrl } from '../painting-synthesis';

export type MobileStudioDeckTab = 'express-scrubber' | 'room-harmony' | 'partner-pricing';

export interface CuratorialRightColumnProps {
  room?: RoomAsset;
  paintings?: PaintingSpec[];
  activePainting?: PaintingSpec;
  activePaintingId?: string;
  sizeId?: PrintSizeId;
  orientation?: OrientationMode;
  panelLayout?: PanelLayoutMode;
  frameId?: FrameProfileId;
  matWidthId?: MatWidthId;
  matColorId?: MatColorId;
  substrateId?: PrintSubstrateId;
  partnerId?: PrintPartnerId;
  studioMarkupPercent?: number;
  harmonyMode?: HarmonyMode;
  ambientLightingMode?: AmbientLightingMode;
  pricing?: PricingBreakdown;
  interPanelGapInches?: number;
  lookbookCount?: number;
  orderCount?: number;
  renderThumbnail?: (painting: PaintingSpec, width?: number, height?: number) => string;
  onSelectPainting?: (paintingId: string) => void;
  onSelectSize?: (sizeId: PrintSizeId) => void;
  onSelectOrientation?: (orientation: OrientationMode) => void;
  onSelectPanelLayout?: (panelLayout: PanelLayoutMode) => void;
  onSelectFrame?: (frameId: FrameProfileId) => void;
  onSelectMatWidth?: (matWidthId: MatWidthId) => void;
  onSelectMatColor?: (matColorId: MatColorId) => void;
  onSelectSubstrate?: (substrateId: PrintSubstrateId) => void;
  onSelectPartner?: (partnerId: PrintPartnerId) => void;
  onChangeMarkupPercent?: (percent: number) => void;
  onSelectHarmonyMode?: (mode: HarmonyMode) => void;
  onChangeAmbientLighting?: (mode: AmbientLightingMode) => void;
  onChangeInterPanelGap?: (gapInches: number) => void;
  onRegeneratePaintings?: () => void;
  onPinLookbook?: () => void;
  onOpenCheckout?: (initialTab?: 'partner-printed-edition' | 'digital-master-download') => void;
  onOpenLookbookDrawer?: (initialTab?: 'lookbook' | 'orders') => void;
  viewportMode?: 'auto' | 'mobile' | 'desktop';
  showMobileAcquisitionBar?: boolean;
  initialMobileTab?: MobileStudioDeckTab;
  className?: string;
}

const HARMONY_STRATEGIES: Array<{
  id: HarmonyMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'complementary-accent',
    label: 'Complementary Architectural Accent',
    shortLabel: 'Complementary',
    description: 'Balances dominant wall temperature with calibrated opposing chromatic focal energy.',
  },
  {
    id: 'tonal-sanctuary',
    label: 'Tonal Linen Sanctuary',
    shortLabel: 'Tonal Sanctuary',
    description: 'Low-contrast mineral and limewash values that echo the room envelope.',
  },
  {
    id: 'warm-gallery-contrast',
    label: 'Warm Gallery Contrast',
    shortLabel: 'Gallery Contrast',
    description: 'Anchors sunlit walls with grounded raw umber, ochre, and smoked terracotta.',
  },
  {
    id: 'chromatic-split',
    label: 'Split-Triadic Collector Study',
    shortLabel: 'Chromatic Split',
    description: 'Dual secondary undertones paired with a high-chroma curatorial accent note.',
  },
];

const AMBIENT_LIGHT_MODES: Array<{
  id: AmbientLightingMode;
  label: string;
  kelvinHint: string;
}> = [
  { id: 'daylight', label: 'North Daylight', kelvinHint: '5,200K' },
  { id: 'golden-hour', label: 'Golden Hour', kelvinHint: '3,400K' },
  { id: 'evening-sconce', label: 'Gallery Sconce', kelvinHint: '2,700K' },
];

const SIZE_ORDER: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];
const FRAME_ORDER: FrameProfileId[] = [
  'natural-white-oak',
  'american-black-walnut',
  'matte-gallery-black',
  'brushed-brass-float',
  'warm-travertine-ash',
  'unframed-canvas',
];
const MAT_WIDTH_ORDER: MatWidthId[] = ['none', '1.5in', '2.5in', '3.5in'];
const MAT_COLOR_ORDER: MatColorId[] = [
  'archival-ivory',
  'warm-museum-linen',
  'charcoal-conservation',
];
const PARTNER_ORDER: PrintPartnerId[] = ['prodigi', 'printful', 'finerworks'];
const SUBSTRATE_ORDER: PrintSubstrateId[] = [
  'hahnemuhle-etching-310gsm',
  'archival-cotton-canvas-400gsm',
  'museum-matte-acrylic',
];
const MARKUP_PRESETS: number[] = [12, 18, 25, 35];

const FALLBACK_ROOM: RoomAsset = {
  id: 'nordic-linen-living',
  name: 'Nordic Warm Linen Salon',
  architecturalStyle: 'Scandinavian Minimalist Plaster & White Oak',
  wallWidthInches: 120,
  eyeLevelRatioY: 0.45,
  isCustomUpload: false,
  imageDataUrl: '',
  createdAt: 1729200000000,
  analysis: {
    roomId: 'nordic-linen-living',
    dominantSwatches: [
      {
        hex: '#EDE8DF',
        rgb: [237, 232, 223],
        hsl: [39, 29, 90],
        luminance: 0.84,
        populationRatio: 0.36,
        role: 'wall-dominant',
        label: 'Warm Limewash Wall',
      },
      {
        hex: '#D7CCBC',
        rgb: [215, 204, 188],
        hsl: [36, 26, 79],
        luminance: 0.64,
        populationRatio: 0.22,
        role: 'secondary-architecture',
        label: 'Travertine Moulding',
      },
      {
        hex: '#C49F75',
        rgb: [196, 159, 117],
        hsl: [32, 40, 61],
        luminance: 0.42,
        populationRatio: 0.16,
        role: 'warm-undertone',
        label: 'Quarter-Sawn White Oak',
      },
      {
        hex: '#8C7A68',
        rgb: [140, 122, 104],
        hsl: [30, 15, 48],
        luminance: 0.24,
        populationRatio: 0.11,
        role: 'secondary-architecture',
        label: 'Bouclé & Raw Linen',
      },
      {
        hex: '#6E7B78',
        rgb: [110, 123, 120],
        hsl: [166, 6, 46],
        luminance: 0.21,
        populationRatio: 0.08,
        role: 'cool-undertone',
        label: 'Nordic Slate Shadow',
      },
      {
        hex: '#B85D3B',
        rgb: [184, 93, 59],
        hsl: [16, 51, 48],
        luminance: 0.22,
        populationRatio: 0.07,
        role: 'accent',
        label: 'Terracotta Vessel Accent',
      },
    ],
    estimatedKelvin: 3450,
    temperatureCategory: 'warm',
    averageLuminance: 0.72,
    lightVector: {
      azimuthDeg: 132,
      elevationDeg: 38,
      shadowOffsetX: 0.34,
      shadowOffsetY: 0.42,
      shadowSoftness: 0.65,
    },
    detectedWallZone: {
      centerX: 0.5,
      centerY: 0.44,
      widthRatio: 0.56,
      heightRatio: 0.48,
      confidence: 0.96,
      edgeEnergyScore: 0.12,
    },
    recommendedHarmony: 'complementary-accent',
    curatorialSummary:
      '3,450K warm gallery daylight from upper-left Clerestory (132° azimuth, 38° elevation); mineral limewash envelope pairs naturally with terracotta and slate indigo pigments.',
  },
};

const FALLBACK_PAINTINGS: PaintingSpec[] = [
  {
    id: 'painting-no-01',
    roomId: 'nordic-linen-living',
    catalogNumber: 'No. 01',
    title: 'Terracotta & Raw Umber Study',
    subtitle: 'Harmonized to 3,450K warm oak undertones',
    styleId: 'impasto-oil',
    harmonyMode: 'complementary-accent',
    seed: 101,
    pigments: [
      { hex: '#B85D3B', rgb: [184, 93, 59], pigmentName: 'Burnt Sienna', opacity: 0.92, viscosity: 0.88 },
      { hex: '#E8DFD1', rgb: [232, 223, 209], pigmentName: 'Titanium Buff', opacity: 0.95, viscosity: 0.76 },
      { hex: '#3E515B', rgb: [62, 81, 91], pigmentName: 'Payne’s Grey', opacity: 0.85, viscosity: 0.64 },
      { hex: '#C8A374', rgb: [200, 163, 116], pigmentName: 'Yellow Ochre', opacity: 0.88, viscosity: 0.72 },
      { hex: '#543D31', rgb: [84, 61, 49], pigmentName: 'Raw Umber', opacity: 0.9, viscosity: 0.81 },
      { hex: '#2E4A3E', rgb: [46, 74, 62], pigmentName: 'Terre Verte', opacity: 0.78, viscosity: 0.69 },
    ],
    lightAzimuthDeg: 132,
    lightElevationDeg: 38,
    aspectRatio: 0.6667,
    recommendedSizeId: '24x36',
    recommendedFrameId: 'natural-white-oak',
    curatorialRationale:
      'Heavy palette-knife impasto ridges catch the 132° directional daylight, bridging the warm white oak joinery with deep slate and burnt sienna counter-notes.',
  },
  {
    id: 'painting-no-02',
    roomId: 'nordic-linen-living',
    catalogNumber: 'No. 02',
    title: 'Monolith in Alabaster & Chalk',
    subtitle: 'Architectural limewash relief calibrated for low-contrast calm',
    styleId: 'japandi-plaster',
    harmonyMode: 'tonal-sanctuary',
    seed: 202,
    pigments: [
      { hex: '#EFECE6', rgb: [239, 236, 230], pigmentName: 'Slaked Lime', opacity: 0.96, viscosity: 0.94 },
      { hex: '#D6CBB9', rgb: [214, 203, 185], pigmentName: 'Roman Travertine', opacity: 0.91, viscosity: 0.89 },
      { hex: '#A5937D', rgb: [165, 147, 125], pigmentName: 'Warm Pumice', opacity: 0.86, viscosity: 0.82 },
      { hex: '#6E6257', rgb: [110, 98, 87], pigmentName: 'Smoked Umber', opacity: 0.8, viscosity: 0.75 },
      { hex: '#C7B8A3', rgb: [199, 184, 163], pigmentName: 'Unbleached Linen', opacity: 0.9, viscosity: 0.85 },
      { hex: '#B85D3B', rgb: [184, 93, 59], pigmentName: 'Venetian Red Trace', opacity: 0.68, viscosity: 0.6 },
    ],
    lightAzimuthDeg: 132,
    lightElevationDeg: 38,
    aspectRatio: 0.6667,
    recommendedSizeId: '24x36',
    recommendedFrameId: 'warm-travertine-ash',
    curatorialRationale:
      'Carved plaster arches cast authentic micro-shadows aligned to your room’s light vector while preserving serene monochromatic continuity.',
  },
  {
    id: 'painting-no-03',
    roomId: 'nordic-linen-living',
    catalogNumber: 'No. 03',
    title: 'Nocturne Over Ochre Horizon',
    subtitle: 'Luminous color-field glazes with deep archival forest ground',
    styleId: 'rothko-colorfield',
    harmonyMode: 'warm-gallery-contrast',
    seed: 303,
    pigments: [
      { hex: '#2E4A3E', rgb: [46, 74, 62], pigmentName: 'Archival Viridian', opacity: 0.84, viscosity: 0.45 },
      { hex: '#B85D3B', rgb: [184, 93, 59], pigmentName: 'Cadmium Red Ochre', opacity: 0.82, viscosity: 0.48 },
      { hex: '#D8A968', rgb: [216, 169, 104], pigmentName: 'Naples Yellow', opacity: 0.79, viscosity: 0.42 },
      { hex: '#23282B', rgb: [35, 40, 43], pigmentName: 'Lamp Black Glaze', opacity: 0.88, viscosity: 0.5 },
      { hex: '#E5DCCB', rgb: [229, 220, 203], pigmentName: 'Warm Parchment', opacity: 0.76, viscosity: 0.4 },
      { hex: '#7D4E38', rgb: [125, 78, 56], pigmentName: 'Roasted Umber', opacity: 0.85, viscosity: 0.46 },
    ],
    lightAzimuthDeg: 132,
    lightElevationDeg: 38,
    aspectRatio: 0.6667,
    recommendedSizeId: '30x40',
    recommendedFrameId: 'american-black-walnut',
    curatorialRationale:
      'Feathered translucent oil glazes establish a contemplative focal anchor that grounds bright plaster walls without visual clutter.',
  },
  {
    id: 'painting-no-04',
    roomId: 'nordic-linen-living',
    catalogNumber: 'No. 04',
    title: 'Constructivist Equilibrium IV',
    subtitle: 'Balanced geometric forms in mineral charcoal, brass & linen',
    styleId: 'bauhaus-geometric',
    harmonyMode: 'chromatic-split',
    seed: 404,
    pigments: [
      { hex: '#1F1E1C', rgb: [31, 30, 28], pigmentName: 'Mars Black', opacity: 0.95, viscosity: 0.65 },
      { hex: '#E9E2D4', rgb: [233, 226, 212], pigmentName: 'Flake White Linen', opacity: 0.94, viscosity: 0.62 },
      { hex: '#B85D3B', rgb: [184, 93, 59], pigmentName: 'Vermilion Ochre', opacity: 0.91, viscosity: 0.68 },
      { hex: '#B69553', rgb: [182, 149, 83], pigmentName: 'Raw Brass Ochre', opacity: 0.89, viscosity: 0.64 },
      { hex: '#4B636E', rgb: [75, 99, 110], pigmentName: 'Prussian Slate', opacity: 0.87, viscosity: 0.6 },
      { hex: '#C8B9A2', rgb: [200, 185, 162], pigmentName: 'Stone Khaki', opacity: 0.9, viscosity: 0.63 },
    ],
    lightAzimuthDeg: 132,
    lightElevationDeg: 38,
    aspectRatio: 0.6667,
    recommendedSizeId: '24x36',
    recommendedFrameId: 'matte-gallery-black',
    curatorialRationale:
      'Crisp architectural geometry echoes modern cabinetry lines while introducing warm brass and vermilion focal tension.',
  },
];

/**
 * Built-in deterministic SVG data-URL thumbnail generator fallback for any `PaintingSpec`.
 * Synthesizes a gallery-grade miniature composition based on `pigments`, `styleId`, and `seed`.
 */
export function renderFallbackPaintingThumbnail(
  painting: PaintingSpec,
  width = 160,
  height = 200
): string {
  const p0 = painting.pigments[0]?.hex ?? '#B85D3B';
  const p1 = painting.pigments[1]?.hex ?? '#EFECE6';
  const p2 = painting.pigments[2]?.hex ?? '#2E4A3E';
  const p3 = painting.pigments[3]?.hex ?? '#C8A97E';
  const p4 = painting.pigments[4]?.hex ?? '#4A3525';
  const p5 = painting.pigments[5]?.hex ?? '#5C5852';

  const shift = (painting.seed % 19) - 9;
  let bodyMotif = '';

  switch (painting.styleId) {
    case 'rothko-colorfield':
      bodyMotif = `
        <rect x="0" y="0" width="${width}" height="${height}" fill="${p1}" />
        <rect x="14" y="14" width="${width - 28}" height="${Math.round(height * 0.44)}" rx="6" fill="${p0}" opacity="0.9" />
        <rect x="18" y="${Math.round(height * 0.48)}" width="${width - 36}" height="${Math.round(height * 0.24)}" rx="5" fill="${p2}" opacity="0.88" />
        <rect x="16" y="${Math.round(height * 0.75)}" width="${width - 32}" height="${Math.round(height * 0.16)}" rx="4" fill="${p3}" opacity="0.85" />
      `;
      break;
    case 'japandi-plaster':
      bodyMotif = `
        <rect x="0" y="0" width="${width}" height="${height}" fill="${p0}" />
        <path d="M 18 ${height - 16} L 18 76 A 62 62 0 0 1 ${width - 18} 76 L ${width - 18} ${height - 16} Z" fill="${p1}" opacity="0.92" />
        <circle cx="${Math.round(width * 0.54 + shift)}" cy="${Math.round(height * 0.44)}" r="34" fill="none" stroke="${p2}" stroke-width="5" opacity="0.65" />
        <path d="M 0 ${Math.round(height * 0.72)} Q ${Math.round(width * 0.5)} ${Math.round(height * 0.62)} ${width} ${Math.round(height * 0.76)} L ${width} ${height} L 0 ${height} Z" fill="${p3}" opacity="0.55" />
      `;
      break;
    case 'bauhaus-geometric':
      bodyMotif = `
        <rect x="0" y="0" width="${width}" height="${height}" fill="${p1}" />
        <rect x="16" y="20" width="${Math.round(width * 0.48)}" height="${Math.round(height * 0.52)}" fill="${p0}" opacity="0.92" />
        <circle cx="${Math.round(width * 0.64)}" cy="${Math.round(height * 0.58)}" r="40" fill="${p2}" opacity="0.9" />
        <rect x="${Math.round(width * 0.22)}" y="${Math.round(height * 0.68)}" width="${Math.round(width * 0.62)}" height="24" fill="${p3}" opacity="0.92" />
        <line x1="12" y1="${Math.round(height * 0.35)}" x2="${width - 12}" y2="${Math.round(height * 0.35)}" stroke="${p4}" stroke-width="3" />
      `;
      break;
    case 'botanical-ink':
      bodyMotif = `
        <rect x="0" y="0" width="${width}" height="${height}" fill="${p1}" />
        <circle cx="${Math.round(width * 0.55)}" cy="${Math.round(height * 0.42)}" r="46" fill="${p3}" opacity="0.45" />
        <path d="M ${Math.round(width * 0.35)} ${height - 14} Q ${Math.round(width * 0.52)} ${Math.round(height * 0.5)} ${Math.round(width * 0.66)} 24" fill="none" stroke="${p0}" stroke-width="4" stroke-linecap="round" />
        <ellipse cx="${Math.round(width * 0.42)}" cy="${Math.round(height * 0.56)}" rx="22" ry="11" transform="rotate(-28 ${Math.round(width * 0.42)} ${Math.round(height * 0.56)})" fill="${p2}" opacity="0.85" />
        <ellipse cx="${Math.round(width * 0.64)}" cy="${Math.round(height * 0.42)}" rx="24" ry="11" transform="rotate(24 ${Math.round(width * 0.64)} ${Math.round(height * 0.42)})" fill="${p4}" opacity="0.85" />
      `;
      break;
    case 'coastal-nocturne':
      bodyMotif = `
        <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.56)}" fill="${p1}" />
        <rect x="0" y="${Math.round(height * 0.52)}" width="${width}" height="${Math.round(height * 0.48)}" fill="${p0}" />
        <rect x="0" y="${Math.round(height * 0.5)}" width="${width}" height="14" fill="${p3}" opacity="0.78" />
        <rect x="16" y="${Math.round(height * 0.68)}" width="${width - 32}" height="8" rx="4" fill="${p2}" opacity="0.65" />
      `;
      break;
    case 'impasto-oil':
    default:
      bodyMotif = `
        <rect x="0" y="0" width="${width}" height="${height}" fill="${p1}" />
        <path d="M -10 ${Math.round(height * 0.34)} Q ${Math.round(width * 0.48)} ${Math.round(height * 0.18 + shift)} ${width + 10} ${Math.round(height * 0.4)} L ${width + 10} ${Math.round(height * 0.75)} L -10 ${Math.round(height * 0.68)} Z" fill="${p0}" opacity="0.9" />
        <rect x="18" y="${Math.round(height * 0.22)}" width="${width - 36}" height="28" rx="4" fill="${p3}" opacity="0.82" />
        <path d="M 10 ${Math.round(height * 0.66)} Q ${Math.round(width * 0.52)} ${Math.round(height * 0.54)} ${width - 12} ${Math.round(height * 0.72)} L ${width - 12} ${height - 14} L 10 ${height - 18} Z" fill="${p2}" opacity="0.88" />
        <rect x="26" y="${Math.round(height * 0.48)}" width="${width - 52}" height="14" rx="3" fill="${p4}" opacity="0.76" />
        <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.3)}" r="16" fill="${p5}" opacity="0.6" />
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bodyMotif}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

/**
 * Computes a deterministic Curatorial Room Fit percentage (91%..99%) based on
 * alignment with the room's recommended color harmony, artwork scale, and frame moulding.
 */
export function computeCuratorialFitScore(params: {
  room: RoomAsset;
  painting: PaintingSpec;
  harmonyMode: HarmonyMode;
  sizeId: PrintSizeId;
  frameId: FrameProfileId;
}): number {
  let score = 93;
  if (params.harmonyMode === params.room.analysis.recommendedHarmony) {
    score += 2;
  }
  if (params.painting.harmonyMode === params.harmonyMode) {
    score += 1;
  }
  if (params.sizeId === params.painting.recommendedSizeId) {
    score += 2;
  }
  if (params.frameId === params.painting.recommendedFrameId) {
    score += 1;
  }
  return Math.max(91, Math.min(99, score));
}

/**
 * Renders a realistic dual-tone mitered frame corner preview swatch.
 */
const FrameMiterCornerSwatch: React.FC<{
  frame: FrameProfileSpec;
  size?: 'sm' | 'md';
}> = ({ frame, size = 'md' }) => {
  const dimClass = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  return (
    <div
      className={`${dimClass} relative rounded-[4px] overflow-hidden border border-[#E2DDD3] shrink-0 shadow-inner`}
      style={{ backgroundColor: frame.primaryHex }}
      aria-hidden="true"
    >
      {/* Top horizontal moulding bar */}
      <div
        className="absolute inset-x-0 top-0 h-[44%]"
        style={{
          background: `linear-gradient(180deg, ${frame.highlightHex} 0%, ${frame.primaryHex} 75%, ${frame.secondaryHex} 100%)`,
        }}
      />
      {/* Left vertical moulding bar */}
      <div
        className="absolute inset-y-0 left-0 w-[44%]"
        style={{
          background: `linear-gradient(90deg, ${frame.highlightHex} 0%, ${frame.primaryHex} 75%, ${frame.secondaryHex} 100%)`,
        }}
      />
      {/* 45-degree miter seam line */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
        <line
          x1="0"
          y1="0"
          x2="17"
          y2="17"
          stroke={frame.secondaryHex}
          strokeWidth="1.2"
          opacity="0.75"
        />
      </svg>
      {/* Inner mat/canvas corner reveal */}
      <div
        className="absolute bottom-0 right-0 w-[56%] h-[56%] rounded-tl-[2px]"
        style={{
          backgroundColor: frame.isFloatFrame ? '#161514' : '#F6F4EF',
          padding: frame.isFloatFrame ? '2px 0 0 2px' : '0',
        }}
      >
        <div className="w-full h-full bg-[#EFECE6] border-t border-l border-[#D5CFC2]" />
      </div>
    </div>
  );
};

export const CuratorialRightColumn: React.FC<CuratorialRightColumnProps> = (props) => {
  // Attempt to consume AtelierStore if rendered inside <AtelierProvider>; gracefully handle standalone usage
  let rawStore: Record<string, any> | null = null;
  try {
    rawStore = (useAtelierStore() as unknown) as Record<string, any>;
  } catch {
    rawStore = null;
  }

  const storeState: Record<string, any> =
    rawStore && typeof rawStore.state === 'object' && rawStore.state !== null
      ? { ...rawStore, ...rawStore.state }
      : rawStore ?? {};

  const storeActions: Record<string, any> =
    rawStore && typeof rawStore.actions === 'object' && rawStore.actions !== null
      ? { ...rawStore, ...rawStore.actions }
      : rawStore ?? {};

  // Local fallback state when neither explicit props nor store are controlling a value
  const [localMobileTab, setLocalMobileTab] = useState<MobileStudioDeckTab>(
    props.initialMobileTab ?? 'express-scrubber'
  );
  const [localPaintingId, setLocalPaintingId] = useState<string>(
    props.activePainting?.id ?? props.activePaintingId ?? FALLBACK_PAINTINGS[0].id
  );
  const [localSizeId, setLocalSizeId] = useState<PrintSizeId>(props.sizeId ?? '24x36');
  const [localOrientation, setLocalOrientation] = useState<OrientationMode>(
    props.orientation ?? 'portrait'
  );
  const [localPanelLayout, setLocalPanelLayout] = useState<PanelLayoutMode>(
    props.panelLayout ?? 'single'
  );
  const [localFrameId, setLocalFrameId] = useState<FrameProfileId>(
    props.frameId ?? 'natural-white-oak'
  );
  const [localMatWidthId, setLocalMatWidthId] = useState<MatWidthId>(props.matWidthId ?? '2.5in');
  const [localMatColorId, setLocalMatColorId] = useState<MatColorId>(
    props.matColorId ?? 'archival-ivory'
  );
  const [localSubstrateId, setLocalSubstrateId] = useState<PrintSubstrateId>(
    props.substrateId ?? 'hahnemuhle-etching-310gsm'
  );
  const [localPartnerId, setLocalPartnerId] = useState<PrintPartnerId>(
    props.partnerId ?? 'prodigi'
  );
  const [localMarkupPercent, setLocalMarkupPercent] = useState<number>(
    clampStudioMarkupPercent(props.studioMarkupPercent ?? DEFAULT_STUDIO_MARKUP_PERCENT)
  );
  const [localHarmonyMode, setLocalHarmonyMode] = useState<HarmonyMode>(
    props.harmonyMode ?? 'complementary-accent'
  );
  const [localAmbientLighting, setLocalAmbientLighting] = useState<AmbientLightingMode>(
    props.ambientLightingMode ?? 'daylight'
  );
  const [localInterPanelGap, setLocalInterPanelGap] = useState<number>(
    props.interPanelGapInches ?? 2.0
  );
  const [justPinnedFeedback, setJustPinnedFeedback] = useState(false);

  // Resolved values (Explicit Props -> AtelierStore -> Local Fallback)
  const room: RoomAsset =
    props.room ??
    storeState.room ??
    storeState.activeRoom ??
    storeState.currentRoom ??
    FALLBACK_ROOM;

  const paintings: PaintingSpec[] =
    (props.paintings && props.paintings.length > 0
      ? props.paintings
      : storeState.activePaintings && storeState.activePaintings.length > 0
      ? storeState.activePaintings
      : storeState.paintings && storeState.paintings.length > 0
      ? storeState.paintings
      : storeState.availablePaintings && storeState.availablePaintings.length > 0
      ? storeState.availablePaintings
      : FALLBACK_PAINTINGS) as PaintingSpec[];

  const resolvedPaintingId: string =
    props.activePainting?.id ??
    props.activePaintingId ??
    storeState.activePainting?.id ??
    storeState.activePaintingId ??
    storeState.selectedPaintingId ??
    localPaintingId;

  const activePainting: PaintingSpec =
    props.activePainting ??
    paintings.find((p) => p.id === resolvedPaintingId) ??
    storeState.activePainting ??
    paintings[0] ??
    FALLBACK_PAINTINGS[0];

  const sizeId: PrintSizeId =
    props.sizeId ??
    storeState.sizeId ??
    storeState.selectedSizeId ??
    storeState.activeSizeId ??
    localSizeId;

  const orientation: OrientationMode =
    props.orientation ??
    storeState.orientation ??
    storeState.selectedOrientation ??
    localOrientation;

  const panelLayout: PanelLayoutMode =
    props.panelLayout ??
    storeState.panelLayout ??
    storeState.selectedPanelLayout ??
    localPanelLayout;

  const frameId: FrameProfileId =
    props.frameId ??
    storeState.frameId ??
    storeState.selectedFrameId ??
    localFrameId;

  const matWidthId: MatWidthId =
    props.matWidthId ??
    storeState.matWidthId ??
    storeState.selectedMatWidthId ??
    localMatWidthId;

  const matColorId: MatColorId =
    props.matColorId ??
    storeState.matColorId ??
    storeState.selectedMatColorId ??
    localMatColorId;

  const substrateId: PrintSubstrateId =
    props.substrateId ??
    storeState.substrateId ??
    storeState.selectedSubstrateId ??
    localSubstrateId;

  const partnerId: PrintPartnerId =
    props.partnerId ??
    storeState.partnerId ??
    storeState.selectedPartnerId ??
    localPartnerId;

  const studioMarkupPercent: number = clampStudioMarkupPercent(
    props.studioMarkupPercent ??
      storeState.studioMarkupPercent ??
      storeState.markupPercent ??
      localMarkupPercent
  );

  const harmonyMode: HarmonyMode =
    props.harmonyMode ??
    storeState.harmonyMode ??
    storeState.selectedHarmonyMode ??
    localHarmonyMode;

  const ambientLightingMode: AmbientLightingMode =
    props.ambientLightingMode ??
    storeState.ambientLightingMode ??
    storeState.ambientLighting ??
    localAmbientLighting;

  const interPanelGapInches: number =
    props.interPanelGapInches ??
    storeState.activePlacement?.interPanelGapInches ??
    storeState.placement?.interPanelGapInches ??
    storeState.wallPlacement?.interPanelGapInches ??
    storeState.interPanelGapInches ??
    localInterPanelGap;

  const lookbookCount: number =
    props.lookbookCount ??
    (Array.isArray(storeState.pinnedLookbook)
      ? storeState.pinnedLookbook.length
      : Array.isArray(storeState.lookbookPins)
      ? storeState.lookbookPins.length
      : Array.isArray(storeState.lookbook)
      ? storeState.lookbook.length
      : 0);

  const orderCount: number =
    props.orderCount ??
    (Array.isArray(storeState.orders)
      ? storeState.orders.length
      : Array.isArray(storeState.orderHistory)
      ? storeState.orderHistory.length
      : 0);

  // Live pricing breakdown (always consistent with current selections)
  const pricing: PricingBreakdown = useMemo(() => {
    if (
      props.pricing &&
      props.pricing.partnerId === partnerId &&
      props.pricing.sizeId === sizeId &&
      props.pricing.frameId === frameId &&
      props.pricing.matWidthId === matWidthId &&
      props.pricing.substrateId === substrateId &&
      props.pricing.panelLayout === panelLayout &&
      props.pricing.studioMarkupPercent === studioMarkupPercent
    ) {
      return props.pricing;
    }
    return calculatePrintPricing({
      partnerId,
      sizeId,
      frameId,
      matWidthId,
      substrateId,
      panelLayout,
      studioMarkupPercent,
    });
  }, [
    props.pricing,
    partnerId,
    sizeId,
    frameId,
    matWidthId,
    substrateId,
    panelLayout,
    studioMarkupPercent,
  ]);

  // Partner comparison prices across Prodigi, Printful, and FinerWorks
  const partnerComparison = useMemo(
    () =>
      compareAllPartnersPricing({
        sizeId,
        frameId,
        matWidthId,
        substrateId,
        panelLayout,
        studioMarkupPercent,
      }),
    [sizeId, frameId, matWidthId, substrateId, panelLayout, studioMarkupPercent]
  );

  // Precomputed retail prices per print size for live price pills
  const priceBySize = useMemo(() => {
    const map: Record<PrintSizeId, number> = {
      '12x16': 0,
      '18x24': 0,
      '24x36': 0,
      '30x40': 0,
      '36x48': 0,
    };
    for (const sId of SIZE_ORDER) {
      map[sId] = calculatePrintPricing({
        partnerId,
        sizeId: sId,
        frameId,
        matWidthId,
        substrateId,
        panelLayout,
        studioMarkupPercent,
      }).physicalRetailTotalUsd;
    }
    return map;
  }, [partnerId, frameId, matWidthId, substrateId, panelLayout, studioMarkupPercent]);

  const fitScorePercent = useMemo(
    () =>
      computeCuratorialFitScore({
        room,
        painting: activePainting,
        harmonyMode,
        sizeId,
        frameId,
      }),
    [room, activePainting, harmonyMode, sizeId, frameId]
  );

  // Unified Action Handlers (invoke explicit prop callback AND store action AND local state fallback)
  const handleSelectPainting = (paintingId: string) => {
    setLocalPaintingId(paintingId);
    props.onSelectPainting?.(paintingId);
    const fn =
      storeActions.selectPainting ??
      storeActions.setActivePaintingId ??
      storeActions.setActivePainting;
    if (typeof fn === 'function') {
      fn(paintingId);
    }
  };

  const handleSelectSize = (nextSize: PrintSizeId) => {
    setLocalSizeId(nextSize);
    props.onSelectSize?.(nextSize);
    const fn = storeActions.selectSize ?? storeActions.setSizeId ?? storeActions.setSize;
    if (typeof fn === 'function') {
      fn(nextSize);
    }
  };

  const handleSelectOrientation = (nextOrientation: OrientationMode) => {
    setLocalOrientation(nextOrientation);
    props.onSelectOrientation?.(nextOrientation);
    const fn = storeActions.selectOrientation ?? storeActions.setOrientation;
    if (typeof fn === 'function') {
      fn(nextOrientation);
    }
  };

  const handleSelectPanelLayout = (nextLayout: PanelLayoutMode) => {
    setLocalPanelLayout(nextLayout);
    props.onSelectPanelLayout?.(nextLayout);
    const fn = storeActions.selectPanelLayout ?? storeActions.setPanelLayout;
    if (typeof fn === 'function') {
      fn(nextLayout);
    }
  };

  const handleSelectFrame = (nextFrame: FrameProfileId) => {
    setLocalFrameId(nextFrame);
    props.onSelectFrame?.(nextFrame);
    const fn = storeActions.selectFrame ?? storeActions.setFrameId ?? storeActions.setFrame;
    if (typeof fn === 'function') {
      fn(nextFrame);
    }
  };

  const handleSelectMatWidth = (nextMatWidth: MatWidthId) => {
    setLocalMatWidthId(nextMatWidth);
    props.onSelectMatWidth?.(nextMatWidth);
    const fn =
      storeActions.selectMatWidth ?? storeActions.setMatWidthId ?? storeActions.setMatWidth;
    if (typeof fn === 'function') {
      fn(nextMatWidth);
    }
  };

  const handleSelectMatColor = (nextMatColor: MatColorId) => {
    setLocalMatColorId(nextMatColor);
    props.onSelectMatColor?.(nextMatColor);
    const fn =
      storeActions.selectMatColor ?? storeActions.setMatColorId ?? storeActions.setMatColor;
    if (typeof fn === 'function') {
      fn(nextMatColor);
    }
  };

  const handleSelectSubstrate = (nextSubstrate: PrintSubstrateId) => {
    setLocalSubstrateId(nextSubstrate);
    props.onSelectSubstrate?.(nextSubstrate);
    const fn =
      storeActions.selectSubstrate ?? storeActions.setSubstrateId ?? storeActions.setSubstrate;
    if (typeof fn === 'function') {
      fn(nextSubstrate);
    }
  };

  const handleSelectPartner = (nextPartner: PrintPartnerId) => {
    setLocalPartnerId(nextPartner);
    props.onSelectPartner?.(nextPartner);
    const fn = storeActions.selectPartner ?? storeActions.setPartnerId ?? storeActions.setPartner;
    if (typeof fn === 'function') {
      fn(nextPartner);
    }
  };

  const handleChangeMarkup = (nextPercent: number) => {
    const clamped = clampStudioMarkupPercent(nextPercent);
    setLocalMarkupPercent(clamped);
    props.onChangeMarkupPercent?.(clamped);
    const fn =
      storeActions.setStudioMarkupPercent ??
      storeActions.changeMarkupPercent ??
      storeActions.setMarkupPercent;
    if (typeof fn === 'function') {
      fn(clamped);
    }
  };

  const handleSelectHarmony = (nextHarmony: HarmonyMode) => {
    setLocalHarmonyMode(nextHarmony);
    props.onSelectHarmonyMode?.(nextHarmony);
    const fn = storeActions.setHarmonyMode ?? storeActions.selectHarmonyMode;
    if (typeof fn === 'function') {
      fn(nextHarmony);
    }
  };

  const handleChangeAmbientLighting = (nextLighting: AmbientLightingMode) => {
    setLocalAmbientLighting(nextLighting);
    props.onChangeAmbientLighting?.(nextLighting);
    const fn =
      storeActions.setAmbientLightingMode ??
      storeActions.selectAmbientLighting ??
      storeActions.setAmbientLighting;
    if (typeof fn === 'function') {
      fn(nextLighting);
    }
  };

  const handleChangeInterPanelGap = (nextGap: number) => {
    const clampedGap = Math.max(1.0, Math.min(4.0, Math.round(nextGap * 10) / 10));
    setLocalInterPanelGap(clampedGap);
    props.onChangeInterPanelGap?.(clampedGap);
    if (typeof storeActions.updateWallPlacement === 'function') {
      storeActions.updateWallPlacement({ interPanelGapInches: clampedGap });
    } else if (typeof storeActions.setInterPanelGapInches === 'function') {
      storeActions.setInterPanelGapInches(clampedGap);
    } else if (typeof storeActions.updatePlacement === 'function') {
      storeActions.updatePlacement({ interPanelGapInches: clampedGap });
    }
  };

  const handleRegeneratePaintings = () => {
    props.onRegeneratePaintings?.();
    const fn =
      storeActions.regeneratePaintingsBatch ??
      storeActions.regeneratePaintings ??
      storeActions.synthesizeNewSeries ??
      storeActions.regenerateSeries;
    if (typeof fn === 'function') {
      fn();
    }
  };

  const handlePinLookbook = () => {
    props.onPinLookbook?.();
    const fn =
      storeActions.pinCurrentWallToLookbook ??
      storeActions.pinCurrentToLookbook ??
      storeActions.pinLookbook ??
      storeActions.addLookbookPin;
    if (typeof fn === 'function') {
      fn();
    }
    setJustPinnedFeedback(true);
    setTimeout(() => setJustPinnedFeedback(false), 1600);
  };

  const handleOpenCheckout = (
    tab: 'partner-printed-edition' | 'digital-master-download' = 'partner-printed-edition'
  ) => {
    props.onOpenCheckout?.(tab);
    const fn =
      storeActions.openCheckoutModal ??
      storeActions.openCheckout ??
      storeActions.setCheckoutModalOpen;
    if (typeof fn === 'function') {
      fn(tab);
    }
  };

  const handleOpenLookbookDrawer = (tab: 'lookbook' | 'orders' = 'lookbook') => {
    props.onOpenLookbookDrawer?.(tab);
    const fn =
      storeActions.openLookbookDrawer ??
      storeActions.openDrawer ??
      storeActions.setLookbookDrawerOpen;
    if (typeof fn === 'function') {
      fn(tab);
    }
  };

  const getThumbnailSrc = (painting: PaintingSpec, width = 140, height = 175): string => {
    if (props.renderThumbnail) {
      const customUrl = props.renderThumbnail(painting, width, height);
      if (customUrl) {
        return customUrl;
      }
    }
    try {
      const proceduralUrl = renderPaintingThumbnailDataUrl(painting, orientation);
      if (proceduralUrl) {
        return proceduralUrl;
      }
    } catch {
      // Fallback to SVG thumbnail below
    }
    return renderFallbackPaintingThumbnail(painting, width, height);
  };

  const activeSizeSpec = PRINT_SIZES[sizeId] ?? PRINT_SIZES['24x36'];
  const activeFrameSpec = FRAME_PROFILES[frameId] ?? FRAME_PROFILES['natural-white-oak'];
  const activePartnerSpec = PRINT_PARTNERS[partnerId] ?? PRINT_PARTNERS.prodigi;
  const activeMatWidthSpec = MAT_WIDTH_OPTIONS[matWidthId] ?? MAT_WIDTH_OPTIONS['2.5in'];
  const activeMatColorSpec = MAT_COLOR_OPTIONS[matColorId] ?? MAT_COLOR_OPTIONS['archival-ivory'];
  const activeSubstrateSpec =
    PRINT_SUBSTRATES[substrateId] ?? PRINT_SUBSTRATES['hahnemuhle-etching-310gsm'];

  const viewportMode = props.viewportMode ?? 'auto';
  const showMobileAcquisitionBar = props.showMobileAcquisitionBar !== false;

  const mobileVisibilityClass =
    viewportMode === 'mobile'
      ? 'flex flex-col'
      : viewportMode === 'desktop'
      ? 'hidden'
      : 'flex flex-col lg:hidden';

  const desktopVisibilityClass =
    viewportMode === 'desktop'
      ? 'flex flex-col'
      : viewportMode === 'mobile'
      ? 'hidden'
      : 'hidden lg:flex lg:flex-col';

  return (
    <aside
      aria-label="Curatorial Studio & Fulfillment Controls"
      className={`w-full max-w-full overflow-x-hidden bg-[#EFECE6] text-[#161514] border-t lg:border-t-0 lg:border-l border-[#E2DDD3] select-none ${
        props.className ?? ''
      }`}
    >
      {/* =====================================================================
          A. MOBILE & COMPACT TABLET 4-ZONE EXPRESS STUDIO DECK (< 1024px)
         ===================================================================== */}
      <div
        data-testid="mobile-studio-deck"
        className={`${mobileVisibilityClass} w-full max-w-full h-full max-h-full overflow-hidden flex flex-col bg-[#EFECE6]`}
      >
        {/* 1. Compact Active Artwork Summary Bar ([SPEC PATCH #20]) */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-1.5 bg-[#F6F4EF] border-b border-[#E2DDD3]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono tabular-nums text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#EFECE6] text-[#5C5852] border border-[#E2DDD3]">
                {activePainting.catalogNumber}
              </span>
              <span className="font-serif text-sm font-medium text-[#161514] truncate">
                {activePainting.title}
              </span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#2E4A3E]/10 text-[#2E4A3E]">
                <Sparkles className="w-3 h-3" />
                {fitScorePercent}% Room Match
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#5C5852] mt-0.5 truncate">
              <span className="font-mono tabular-nums font-medium text-[#161514]">
                {activeSizeSpec.labelInches}
              </span>
              <span>·</span>
              <span className="truncate">{activeFrameSpec.name}</span>
              {panelLayout !== 'single' && (
                <>
                  <span>·</span>
                  <span className="uppercase font-mono text-[10px] text-[#B85D3B] font-semibold">
                    {panelLayout}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            data-testid="mobile-pin-lookbook-btn"
            onClick={handlePinLookbook}
            className="min-h-[44px] px-3 py-1 rounded-[6px] bg-[#FFFFFF] hover:bg-[#F6F4EF] active:bg-[#EFECE6] text-[#161514] border border-[#E2DDD3] flex items-center gap-1.5 text-xs font-medium shrink-0 transition-colors shadow-sm"
          >
            {justPinnedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#2E4A3E]" />
                <span className="text-[#2E4A3E]">Pinned</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-[#B85D3B]" />
                <span>Pin Setup</span>
                {lookbookCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] px-1 rounded bg-[#EFECE6] text-[#5C5852]">
                    {lookbookCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* 2. Sticky Mobile Mode Pill Switcher (min-h-[44px] buttons) */}
        <div
          role="tablist"
          aria-label="Mobile Studio Deck Mode"
          className="shrink-0 grid grid-cols-3 gap-1.5 px-3 py-1 bg-[#EFECE6] border-b border-[#E2DDD3]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={localMobileTab === 'express-scrubber'}
            data-testid="mobile-tab-express-scrubber"
            onClick={() => setLocalMobileTab('express-scrubber')}
            className={`min-h-[44px] px-1.5 py-1 rounded-[6px] text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all ${
              localMobileTab === 'express-scrubber'
                ? 'bg-[#161514] text-[#FFFFFF] shadow-sm'
                : 'bg-[#F6F4EF] text-[#5C5852] border border-[#E2DDD3] hover:text-[#161514]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Scrubber</span>
            <span className="hidden sm:inline">Express Scrubber</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={localMobileTab === 'room-harmony'}
            data-testid="mobile-tab-room-harmony"
            onClick={() => setLocalMobileTab('room-harmony')}
            className={`min-h-[44px] px-1.5 py-1 rounded-[6px] text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all ${
              localMobileTab === 'room-harmony'
                ? 'bg-[#161514] text-[#FFFFFF] shadow-sm'
                : 'bg-[#F6F4EF] text-[#5C5852] border border-[#E2DDD3] hover:text-[#161514]'
            }`}
          >
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Harmony</span>
            <span className="hidden sm:inline">Room &amp; Harmony</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={localMobileTab === 'partner-pricing'}
            data-testid="mobile-tab-partner-pricing"
            onClick={() => setLocalMobileTab('partner-pricing')}
            className={`min-h-[44px] px-1.5 py-1 rounded-[6px] text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-all ${
              localMobileTab === 'partner-pricing'
                ? 'bg-[#161514] text-[#FFFFFF] shadow-sm'
                : 'bg-[#F6F4EF] text-[#5C5852] border border-[#E2DDD3] hover:text-[#161514]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Pricing</span>
            <span className="hidden sm:inline">Partner Pricing</span>
          </button>
        </div>

        {/* 3. Active Mobile Deck Panel */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-1.5 space-y-1.5 max-w-full">
          {localMobileTab === 'express-scrubber' && (
            <div className="space-y-1.5" data-testid="mobile-view-express-scrubber">
              {/* Row 1 — Painting Options Carousel (w-[68%] sm:w-[210px] for 25%-35% next-card peek at 390px) */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#5C5852]">
                    1 · Curated Works ({paintings.length})
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-[#5C5852]">
                    Swipe to compare →
                  </span>
                </div>
                <div
                  data-testid="mobile-scrubber-paintings"
                  className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5 no-scrollbar"
                >
                  {paintings.map((painting) => {
                    const isSelected = painting.id === activePainting.id;
                    return (
                      <button
                        key={painting.id}
                        type="button"
                        data-testid={`mobile-painting-card-${painting.id}`}
                        onClick={() => handleSelectPainting(painting.id)}
                        className={`w-[68%] sm:w-[210px] shrink-0 snap-start min-h-[48px] px-2 py-1 rounded-[6px] text-left flex items-center gap-2 transition-all border ${
                          isSelected
                            ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                            : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                        }`}
                      >
                        <img
                          src={getThumbnailSrc(painting, 88, 110)}
                          alt={painting.title}
                          className="w-9 h-11 object-cover rounded-[4px] border border-[#E2DDD3] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono tabular-nums text-[10px] uppercase tracking-wider text-[#5C5852]">
                              {painting.catalogNumber}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-medium text-[#B85D3B]">Active</span>
                            )}
                          </div>
                          <p className="font-serif text-xs font-medium text-[#161514] truncate">
                            {painting.title}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            {painting.pigments.slice(0, 4).map((stop, idx) => (
                              <span
                                key={`${painting.id}-pigment-${idx}`}
                                className="w-2.5 h-2.5 rounded-full border border-black/15"
                                style={{ backgroundColor: stop.hex }}
                                title={stop.pigmentName}
                              />
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    data-testid="mobile-regenerate-btn"
                    onClick={handleRegeneratePaintings}
                    className="min-h-[48px] px-3 py-1 rounded-[6px] shrink-0 snap-start bg-[#FFFFFF] border border-[#E2DDD3] hover:border-[#B85D3B] text-[#161514] flex items-center gap-1.5 text-xs font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#B85D3B]" />
                    <span>New Batch</span>
                  </button>
                </div>
              </div>

              {/* Row 2 — Physical Scale & Multi-Panel Layout Carousel */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#5C5852]">
                    2 · Scale, Panel Split &amp; Orientation
                  </span>
                  <span className="font-mono tabular-nums text-[10px] text-[#161514]">
                    {activeSizeSpec.labelInches} ({activeSizeSpec.labelCm})
                  </span>
                </div>
                <div
                  data-testid="mobile-scrubber-sizes"
                  className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5 no-scrollbar"
                >
                  {SIZE_ORDER.map((sId) => {
                    const spec = PRINT_SIZES[sId];
                    const isSelected = sId === sizeId;
                    const sizePrice = priceBySize[sId];
                    return (
                      <button
                        key={sId}
                        type="button"
                        data-testid={`mobile-size-pill-${sId}`}
                        onClick={() => handleSelectSize(sId)}
                        className={`w-[38%] sm:w-[135px] shrink-0 snap-start min-h-[44px] px-2.5 py-1 rounded-[6px] text-left transition-all border ${
                          isSelected
                            ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] text-[#161514] shadow-sm'
                            : 'bg-[#F6F4EF] border-[#E2DDD3] text-[#5C5852] hover:text-[#161514]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono tabular-nums text-xs font-semibold text-[#161514]">
                            {spec.labelInches}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] font-medium text-[#B85D3B]">
                            ${sizePrice.toFixed(0)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#5C5852] truncate">
                          {spec.scaleDescription}
                        </p>
                      </button>
                    );
                  })}

                  {/* Multi-Panel Layout Pills */}
                  {(
                    [
                      { id: 'single', label: 'Single' },
                      { id: 'diptych', label: 'Diptych 2×' },
                      { id: 'triptych', label: 'Triptych 3×' },
                    ] as Array<{ id: PanelLayoutMode; label: string }>
                  ).map((item) => {
                    const isSelected = panelLayout === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`mobile-panel-pill-${item.id}`}
                        onClick={() => handleSelectPanelLayout(item.id)}
                        className={`min-h-[44px] px-3 py-1 rounded-[6px] shrink-0 snap-start text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                            : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}

                  {/* Orientation Pills */}
                  {(
                    [
                      { id: 'portrait', label: 'Portrait' },
                      { id: 'landscape', label: 'Landscape' },
                      { id: 'square', label: 'Square' },
                    ] as Array<{ id: OrientationMode; label: string }>
                  ).map((item) => {
                    const isSelected = orientation === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`mobile-orientation-pill-${item.id}`}
                        onClick={() => handleSelectOrientation(item.id)}
                        className={`min-h-[44px] px-3 py-1 rounded-[6px] shrink-0 snap-start text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                            : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3 — Museum Frame & Matboard Swatches Carousel */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[#5C5852]">
                    3 · Frame Moulding &amp; Conservation Mat
                  </span>
                  <span className="text-[10px] text-[#5C5852] truncate max-w-[180px]">
                    {activeFrameSpec.name} · {activeMatWidthSpec.label}
                  </span>
                </div>
                <div
                  data-testid="mobile-scrubber-frames"
                  className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5 no-scrollbar"
                >
                  {FRAME_ORDER.map((fId) => {
                    const fSpec = FRAME_PROFILES[fId];
                    const isSelected = fId === frameId;
                    return (
                      <button
                        key={fId}
                        type="button"
                        data-testid={`mobile-frame-pill-${fId}`}
                        onClick={() => handleSelectFrame(fId)}
                        className={`w-[42%] sm:w-[150px] shrink-0 snap-start min-h-[44px] px-2.5 py-1 rounded-[6px] text-left flex items-center gap-2 transition-all border ${
                          isSelected
                            ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                            : 'bg-[#F6F4EF] border-[#E2DDD3]'
                        }`}
                      >
                        <FrameMiterCornerSwatch frame={fSpec} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-[#161514] truncate">
                            {fSpec.name}
                          </p>
                          <p className="font-mono tabular-nums text-[10px] text-[#5C5852]">
                            {fSpec.mouldingWidthInches > 0
                              ? `${fSpec.mouldingWidthInches}" profile`
                              : 'Gallery Edge'}
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {/* 4 Mat Width Pills */}
                  {MAT_WIDTH_ORDER.map((mId) => {
                    const mSpec = MAT_WIDTH_OPTIONS[mId];
                    const isSelected = mId === matWidthId;
                    const shortLabel = mId === 'none' ? 'No Mat' : `${mSpec.inches}" Mat`;
                    return (
                      <button
                        key={mId}
                        type="button"
                        data-testid={`mobile-mat-width-pill-${mId}`}
                        onClick={() => handleSelectMatWidth(mId)}
                        className={`min-h-[44px] px-3 py-1 rounded-[6px] shrink-0 snap-start font-mono tabular-nums text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                            : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3]'
                        }`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}

                  {/* 3 Mat Color Swatches */}
                  {MAT_COLOR_ORDER.map((cId) => {
                    const cSpec = MAT_COLOR_OPTIONS[cId];
                    const isSelected = cId === matColorId;
                    return (
                      <button
                        key={cId}
                        type="button"
                        data-testid={`mobile-mat-color-pill-${cId}`}
                        onClick={() => handleSelectMatColor(cId)}
                        className={`min-h-[44px] px-2.5 py-1 rounded-[6px] shrink-0 snap-start flex items-center gap-1.5 text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] text-[#161514]'
                            : 'bg-[#F6F4EF] border-[#E2DDD3] text-[#5C5852]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: cSpec.hex }}
                        />
                        <span>{cSpec.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Room & Harmony View */}
          {localMobileTab === 'room-harmony' && (
            <div className="space-y-2.5" data-testid="mobile-view-room-harmony">
              {/* Room 6-Swatch Colorimetric Provenance Bar */}
              <div className="p-2.5 rounded-[6px] bg-[#F6F4EF] border border-[#E2DDD3]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-[#161514]">{room.name}</span>
                  <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px] text-[#5C5852]">
                    <span className="px-1.5 py-0.5 rounded bg-[#EFECE6] border border-[#E2DDD3]">
                      {room.analysis.estimatedKelvin}K
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#EFECE6] border border-[#E2DDD3]">
                      {room.analysis.lightVector.azimuthDeg}° /{' '}
                      {room.analysis.lightVector.elevationDeg}°
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {room.analysis.dominantSwatches.slice(0, 6).map((swatch, idx) => (
                    <div
                      key={`${swatch.hex}-${idx}`}
                      className="flex flex-col items-center text-center"
                    >
                      <div
                        className="w-full h-6 rounded-[4px] border border-black/15"
                        style={{ backgroundColor: swatch.hex }}
                        title={`${swatch.label} (${swatch.hex})`}
                      />
                      <span className="font-mono tabular-nums text-[9px] text-[#5C5852] mt-0.5">
                        {swatch.hex}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4 Curatorial Harmony Strategy Cards */}
              <div className="grid grid-cols-2 gap-2">
                {HARMONY_STRATEGIES.map((strategy) => {
                  const isSelected = harmonyMode === strategy.id;
                  return (
                    <button
                      key={strategy.id}
                      type="button"
                      data-testid={`mobile-harmony-card-${strategy.id}`}
                      onClick={() => handleSelectHarmony(strategy.id)}
                      className={`min-h-[44px] p-2.5 rounded-[6px] text-left border transition-all ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                          : 'bg-[#F6F4EF] border-[#E2DDD3]'
                      }`}
                    >
                      <p className="text-xs font-medium text-[#161514]">{strategy.shortLabel}</p>
                      <p className="text-[10px] text-[#5C5852] line-clamp-2 mt-0.5">
                        {strategy.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Ambient Lighting Pills */}
              <div className="flex items-center gap-1.5">
                {AMBIENT_LIGHT_MODES.map((mode) => {
                  const isSelected = ambientLightingMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      data-testid={`mobile-lighting-pill-${mode.id}`}
                      onClick={() => handleChangeAmbientLighting(mode.id)}
                      className={`flex-1 min-h-[44px] px-2 py-1.5 rounded-[6px] text-xs font-medium border flex items-center justify-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                          : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Painting Pigment Recipe & Curatorial Rationale */}
              <div className="p-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2DDD3] space-y-2">
                <p className="text-xs text-[#5C5852] leading-relaxed">
                  {activePainting.curatorialRationale}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {activePainting.pigments.map((pigment, idx) => (
                    <span
                      key={`${pigment.pigmentName}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#F6F4EF] border border-[#E2DDD3] text-[11px] text-[#161514]"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20"
                        style={{ backgroundColor: pigment.hex }}
                      />
                      <span>{pigment.pigmentName}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mode 3: Partner Pricing & Markup View */}
          {localMobileTab === 'partner-pricing' && (
            <div className="space-y-2.5" data-testid="mobile-view-partner-pricing">
              {/* Print Partner Selector Cards */}
              <div className="grid grid-cols-3 gap-2">
                {PARTNER_ORDER.map((pId) => {
                  const pSpec = PRINT_PARTNERS[pId];
                  const pQuote = partnerComparison[pId];
                  const isSelected = pId === partnerId;
                  return (
                    <button
                      key={pId}
                      type="button"
                      data-testid={`mobile-partner-card-${pId}`}
                      onClick={() => handleSelectPartner(pId)}
                      className={`min-h-[44px] p-2 rounded-[6px] text-left border transition-all ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                          : 'bg-[#F6F4EF] border-[#E2DDD3]'
                      }`}
                    >
                      <p className="text-xs font-semibold text-[#161514] truncate">{pSpec.name}</p>
                      <p className="font-mono text-[10px] text-[#2E4A3E] truncate">
                        {pSpec.websiteDomain}
                      </p>
                      <p className="font-mono tabular-nums text-xs font-semibold text-[#B85D3B] mt-1">
                        ${pQuote.physicalRetailTotalUsd.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[#5C5852] truncate">
                        {pSpec.estimatedProductionDays}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Archival Substrate Selector */}
              <div className="grid grid-cols-3 gap-1.5">
                {SUBSTRATE_ORDER.map((subId) => {
                  const subSpec = PRINT_SUBSTRATES[subId];
                  const isSelected = subId === substrateId;
                  return (
                    <button
                      key={subId}
                      type="button"
                      data-testid={`mobile-substrate-pill-${subId}`}
                      onClick={() => handleSelectSubstrate(subId)}
                      className={`min-h-[44px] px-2 py-1.5 rounded-[6px] text-left border transition-all ${
                        isSelected
                          ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                          : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3]'
                      }`}
                    >
                      <p className="text-[11px] font-medium truncate">{subSpec.shortName}</p>
                      <p
                        className={`font-mono tabular-nums text-[10px] ${
                          isSelected ? 'text-[#EFECE6]' : 'text-[#5C5852]'
                        }`}
                      >
                        {subSpec.gsmOrThickness}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Studio Markup Slider (10%-40%, default 18%) */}
              <div className="p-2.5 rounded-[6px] bg-[#F6F4EF] border border-[#E2DDD3]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="mobile-markup-slider-input" className="font-medium text-[#161514]">
                    Atelier Studio Curation Markup
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-[#B85D3B]">
                    +{studioMarkupPercent}% (+${pricing.studioMarkupDollarUsd.toFixed(2)})
                  </span>
                </div>
                <input
                  id="mobile-markup-slider-input"
                  data-testid="mobile-markup-slider"
                  type="range"
                  min={MIN_STUDIO_MARKUP_PERCENT}
                  max={MAX_STUDIO_MARKUP_PERCENT}
                  step={1}
                  value={studioMarkupPercent}
                  onChange={(e) => handleChangeMarkup(Number(e.target.value))}
                  className="w-full h-2 accent-[#B85D3B] cursor-pointer"
                />
              </div>

              {/* Transparent Partner Cost vs Studio Markup Ledger */}
              <div className="p-2.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2DDD3] font-mono tabular-nums text-xs space-y-1">
                <div className="flex justify-between text-[#5C5852]">
                  <span>
                    Partner Base Print ({activePartnerSpec.websiteDomain} · {pricing.panelCount}p)
                  </span>
                  <span>${pricing.partnerBasePrintCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#5C5852]">
                  <span>Partner Frame &amp; Archival Matting</span>
                  <span>${pricing.partnerFrameAndMatCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#161514] font-medium pt-1 border-t border-[#E2DDD3]">
                  <span>Partner Wholesale Subtotal</span>
                  <span>${pricing.partnerWholesaleSubtotalUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#2E4A3E]">
                  <span>Atelier Studio Curation (+{pricing.studioMarkupPercent}%)</span>
                  <span>+${pricing.studioMarkupDollarUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#5C5852]">
                  <span>Insured Art Courier Shipping</span>
                  <span>${pricing.insuredShippingUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-[#161514] pt-1 border-t border-[#E2DDD3]">
                  <span>Total Delivered Edition</span>
                  <span>${pricing.physicalRetailTotalUsd.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Zone 4 — Pinned Bottom Mobile Acquisition Bar ([SPEC PATCH #21]) */}
        {showMobileAcquisitionBar && (
          <div
            data-testid="mobile-acquisition-bar"
            className="shrink-0 z-20 min-h-[56px] px-3.5 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] bg-[#FFFFFF] border-t border-[#E2DDD3] flex items-center justify-between gap-2 shadow-[0_-4px_16px_rgba(22,21,20,0.06)]"
          >
            <div className="min-w-0">
              <div className="font-mono tabular-nums text-sm font-semibold text-[#161514]">
                ${pricing.physicalRetailTotalUsd.toFixed(2)}
              </div>
              <div className="font-mono tabular-nums text-[10px] text-[#5C5852] truncate">
                {activePartnerSpec.websiteDomain} · incl. +{pricing.studioMarkupPercent}% studio
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="mobile-cta-download-master"
                onClick={() => handleOpenCheckout('digital-master-download')}
                className="min-h-[44px] px-3 py-1.5 rounded-[6px] bg-[#F6F4EF] hover:bg-[#EFECE6] text-[#161514] border border-[#E2DDD3] font-mono tabular-nums text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#5C5852]" />
                <span>Download (${DIGITAL_MASTER_LICENSE_USD.toFixed(0)})</span>
              </button>

              <button
                type="button"
                data-testid="mobile-cta-order-print"
                onClick={() => handleOpenCheckout('partner-printed-edition')}
                className="min-h-[44px] px-4 py-1.5 rounded-[6px] bg-[#B85D3B] hover:bg-[#a34f30] text-[#FFFFFF] text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span>Order Print</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          B. DESKTOP UNIFIED SCANNABLE RIGHT CURATORIAL COLUMN (>= 1024px)
          No 3-tab wall! Single scrollable container + Sticky Bottom Ledger & CTAs
         ===================================================================== */}
      <div
        data-testid="desktop-curatorial-column"
        className={`${desktopVisibilityClass} h-full max-h-full overflow-hidden bg-[#EFECE6]`}
      >
        {/* Scrollable Curatorial Sections 1..4 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* SECTION 1 — Artwork Provenance, Room Colorimetry & Harmony Strategy */}
          <section
            aria-label="Artwork Provenance & Room Colorimetry"
            className="space-y-4 pb-5 border-b border-[#E2DDD3]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-xs uppercase tracking-widest px-2 py-0.5 rounded bg-[#F6F4EF] border border-[#E2DDD3] text-[#5C5852]">
                    {activePainting.catalogNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums text-xs font-medium px-2 py-0.5 rounded bg-[#2E4A3E]/10 text-[#2E4A3E]">
                    <Sparkles className="w-3.5 h-3.5" />
                    {fitScorePercent}% Room Match
                  </span>
                </div>
                <h2 className="font-serif text-xl font-normal text-[#161514] mt-1.5 leading-snug">
                  {activePainting.title}
                </h2>
                <p className="text-xs text-[#5C5852] mt-0.5">{activePainting.subtitle}</p>
              </div>

              <button
                type="button"
                data-testid="desktop-regenerate-btn"
                onClick={handleRegeneratePaintings}
                className="min-h-[40px] px-3 py-1.5 rounded-[6px] bg-[#FFFFFF] hover:bg-[#F6F4EF] text-[#161514] border border-[#E2DDD3] hover:border-[#B85D3B] text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#B85D3B]" />
                <span>Synthesize New Series</span>
              </button>
            </div>

            {/* Compact Desktop Series Selector Strip (Balanced 3x2 Grid for 6 Works) */}
            <div className="grid grid-cols-3 gap-2">
              {paintings.map((painting) => {
                const isSelected = painting.id === activePainting.id;
                return (
                  <button
                    key={painting.id}
                    type="button"
                    data-testid={`desktop-painting-card-${painting.id}`}
                    onClick={() => handleSelectPainting(painting.id)}
                    className={`p-1.5 rounded-[6px] text-left transition-all border ${
                      isSelected
                        ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                        : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <img
                      src={getThumbnailSrc(painting, 110, 138)}
                      alt={painting.title}
                      className="w-full h-16 object-cover rounded-[4px] border border-[#E2DDD3]"
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono tabular-nums text-[10px] text-[#5C5852]">
                        {painting.catalogNumber}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/15"
                        style={{ backgroundColor: painting.pigments[0]?.hex ?? '#B85D3B' }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Curatorial Rationale & 6 PigmentStop Recipe Badges */}
            <div className="p-3 rounded-[6px] bg-[#F6F4EF] border border-[#E2DDD3] space-y-2.5">
              <p className="text-xs text-[#161514] leading-relaxed">
                {activePainting.curatorialRationale}
              </p>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#5C5852] mb-1.5">
                  Synthesized 6-Pigment Recipe
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activePainting.pigments.map((pigment, idx) => (
                    <span
                      key={`${pigment.pigmentName}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-[#FFFFFF] border border-[#E2DDD3] text-[11px] text-[#161514]"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: pigment.hex }}
                      />
                      <span>{pigment.pigmentName}</span>
                      <span className="font-mono tabular-nums text-[10px] text-[#5C5852]">
                        {pigment.hex}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Room 6 Dominant Swatches Strip + Kelvin & Light Vector Badge */}
            <div className="p-3 rounded-[6px] bg-[#FFFFFF] border border-[#E2DDD3] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#161514]">
                  Wall Colorimetric DNA · {room.name}
                </span>
                <div className="flex items-center gap-1.5 font-mono tabular-nums text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-[#F6F4EF] border border-[#E2DDD3] text-[#161514]">
                    {room.analysis.estimatedKelvin}K {room.analysis.temperatureCategory}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F6F4EF] border border-[#E2DDD3] text-[#5C5852]">
                    Light {room.analysis.lightVector.azimuthDeg}° /{' '}
                    {room.analysis.lightVector.elevationDeg}°
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {room.analysis.dominantSwatches.slice(0, 6).map((swatch, idx) => (
                  <div
                    key={`${swatch.hex}-${idx}`}
                    className="p-1 rounded bg-[#F6F4EF] border border-[#E2DDD3] text-center"
                  >
                    <div
                      className="w-full h-5 rounded-[3px] border border-black/10"
                      style={{ backgroundColor: swatch.hex }}
                      title={`${swatch.label} (${swatch.role})`}
                    />
                    <div className="font-mono tabular-nums text-[10px] text-[#161514] mt-1">
                      {swatch.hex}
                    </div>
                    <div className="text-[9px] text-[#5C5852] truncate">{swatch.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4 Harmony Mode Selector Buttons & Ambient Lighting */}
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-[#5C5852]">
                Curatorial Harmony Strategy
              </div>
              <div className="grid grid-cols-2 gap-2">
                {HARMONY_STRATEGIES.map((strategy) => {
                  const isSelected = harmonyMode === strategy.id;
                  return (
                    <button
                      key={strategy.id}
                      type="button"
                      data-testid={`desktop-harmony-btn-${strategy.id}`}
                      onClick={() => handleSelectHarmony(strategy.id)}
                      className={`min-h-[40px] p-2.5 rounded-[6px] text-left border transition-all ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                          : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="text-xs font-medium text-[#161514]">
                        {strategy.shortLabel}
                      </div>
                      <div className="text-[11px] text-[#5C5852] line-clamp-1 mt-0.5">
                        {strategy.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Ambient Lighting Selector Pills */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {AMBIENT_LIGHT_MODES.map((mode) => {
                  const isSelected = ambientLightingMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      data-testid={`desktop-lighting-btn-${mode.id}`}
                      onClick={() => handleChangeAmbientLighting(mode.id)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-[6px] text-xs font-medium border flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                          : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3] hover:text-[#161514]'
                      }`}
                    >
                      <span className="truncate">{mode.label}</span>
                      <span className="font-mono tabular-nums text-[10px] opacity-80">
                        {mode.kelvinHint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 2 — Physical Scale, Orientation & Multi-Panel Split */}
          <section
            aria-label="Physical Scale, Orientation & Multi-Panel Split"
            className="space-y-4 pb-5 border-b border-[#E2DDD3]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4 text-[#B85D3B]" />
                <h3 className="font-serif text-base font-normal text-[#161514]">
                  Physical Scale &amp; Triptych / Diptych Split
                </h3>
              </div>
              <span className="font-mono tabular-nums text-xs text-[#5C5852]">
                300 DPI Archival Master
              </span>
            </div>

            {/* 5 Print Size Cards */}
            <div className="grid grid-cols-5 gap-1.5">
              {SIZE_ORDER.map((sId) => {
                const spec = PRINT_SIZES[sId];
                const isSelected = sId === sizeId;
                const sizePrice = priceBySize[sId];
                return (
                  <button
                    key={sId}
                    type="button"
                    data-testid={`desktop-size-card-${sId}`}
                    onClick={() => handleSelectSize(sId)}
                    className={`p-2 rounded-[6px] text-left transition-all border ${
                      isSelected
                        ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                        : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="font-mono tabular-nums text-xs font-semibold text-[#161514]">
                      {spec.labelInches}
                    </div>
                    <div className="font-mono tabular-nums text-[10px] text-[#5C5852]">
                      {spec.labelCm}
                    </div>
                    <div className="text-[10px] text-[#5C5852] truncate mt-1">
                      {spec.scaleDescription}
                    </div>
                    <div className="font-mono tabular-nums text-xs font-semibold text-[#B85D3B] mt-1">
                      ${sizePrice.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Orientation & Multi-Panel Layout Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#5C5852] mb-1.5">
                  Canvas Orientation
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'portrait', label: 'Portrait' },
                      { id: 'landscape', label: 'Landscape' },
                      { id: 'square', label: 'Square' },
                    ] as Array<{ id: OrientationMode; label: string }>
                  ).map((item) => {
                    const isSelected = orientation === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`desktop-orientation-btn-${item.id}`}
                        onClick={() => handleSelectOrientation(item.id)}
                        className={`min-h-[38px] px-2 py-1.5 rounded-[6px] text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                            : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3] hover:text-[#161514]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#5C5852] mb-1.5">
                  Multi-Panel Split
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'single', label: 'Single Panel' },
                      { id: 'diptych', label: 'Diptych 2-Panel' },
                      { id: 'triptych', label: 'Triptych 3-Panel' },
                    ] as Array<{ id: PanelLayoutMode; label: string }>
                  ).map((item) => {
                    const isSelected = panelLayout === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`desktop-panel-btn-${item.id}`}
                        onClick={() => handleSelectPanelLayout(item.id)}
                        className={`min-h-[38px] px-2 py-1.5 rounded-[6px] text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                            : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3] hover:text-[#161514]'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Inter-Panel Gap Slider (1.0" to 4.0") when Diptych / Triptych is active */}
            {panelLayout !== 'single' && (
              <div className="p-3 rounded-[6px] bg-[#F6F4EF] border border-[#E2DDD3]">
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="desktop-gap-slider-input" className="font-medium text-[#161514]">
                    Architectural Inter-Panel Reveal Gap ({panelLayout.toUpperCase()})
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-[#B85D3B]">
                    {interPanelGapInches.toFixed(1)}&quot;
                  </span>
                </div>
                <input
                  id="desktop-gap-slider-input"
                  data-testid="desktop-inter-panel-gap-slider"
                  type="range"
                  min={1.0}
                  max={4.0}
                  step={0.5}
                  value={interPanelGapInches}
                  onChange={(e) => handleChangeInterPanelGap(Number(e.target.value))}
                  className="w-full h-2 accent-[#B85D3B] cursor-pointer"
                />
              </div>
            )}
          </section>

          {/* SECTION 3 — Museum Frame Moulding & Conservation Matboard */}
          <section
            aria-label="Museum Frame Moulding & Conservation Matboard"
            className="space-y-4 pb-5 border-b border-[#E2DDD3]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Frame className="w-4 h-4 text-[#B85D3B]" />
                <h3 className="font-serif text-base font-normal text-[#161514]">
                  Museum Frame Moulding &amp; Conservation Matboard
                </h3>
              </div>
              <span className="font-mono tabular-nums text-xs text-[#5C5852]">
                {activeFrameSpec.mouldingWidthInches > 0
                  ? `${activeFrameSpec.mouldingWidthInches}" Moulding`
                  : 'Mirrored Gallery Edge'}
              </span>
            </div>

            {/* 6 Frame Profile Cards */}
            <div className="grid grid-cols-2 gap-2">
              {FRAME_ORDER.map((fId) => {
                const fSpec = FRAME_PROFILES[fId];
                const isSelected = fId === frameId;
                return (
                  <button
                    key={fId}
                    type="button"
                    data-testid={`desktop-frame-card-${fId}`}
                    onClick={() => handleSelectFrame(fId)}
                    className={`p-2.5 rounded-[6px] text-left flex items-start gap-2.5 transition-all border ${
                      isSelected
                        ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                        : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <FrameMiterCornerSwatch frame={fSpec} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-[#161514] truncate">
                          {fSpec.name}
                        </span>
                        <span className="font-mono tabular-nums text-[10px] text-[#5C5852]">
                          {fSpec.depthInches}&quot;D
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5C5852] line-clamp-2 mt-0.5">
                        {fSpec.materialDescription}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 4 Mat Width Pills & 3 Mat Color Swatches */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#5C5852] mb-1.5">
                  8-Ply Cotton Rag Mat Reveal
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MAT_WIDTH_ORDER.map((mId) => {
                    const mSpec = MAT_WIDTH_OPTIONS[mId];
                    const isSelected = mId === matWidthId;
                    const shortLabel = mId === 'none' ? 'No Mat' : `${mSpec.inches}"`;
                    return (
                      <button
                        key={mId}
                        type="button"
                        data-testid={`desktop-mat-width-btn-${mId}`}
                        onClick={() => handleSelectMatWidth(mId)}
                        className={`min-h-[38px] px-2 py-1.5 rounded-[6px] font-mono tabular-nums text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                            : 'bg-[#F6F4EF] text-[#5C5852] border-[#E2DDD3] hover:text-[#161514]'
                        }`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-[#5C5852] mb-1.5">
                  Conservation Mat Tone ({activeMatColorSpec.name})
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MAT_COLOR_ORDER.map((cId) => {
                    const cSpec = MAT_COLOR_OPTIONS[cId];
                    const isSelected = cId === matColorId;
                    return (
                      <button
                        key={cId}
                        type="button"
                        data-testid={`desktop-mat-color-btn-${cId}`}
                        onClick={() => handleSelectMatColor(cId)}
                        className={`min-h-[38px] px-2 py-1.5 rounded-[6px] flex items-center gap-1.5 text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] text-[#161514]'
                            : 'bg-[#F6F4EF] border-[#E2DDD3] text-[#5C5852] hover:text-[#161514]'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: cSpec.hex }}
                        />
                        <span className="truncate">{cSpec.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4 — Print Fulfillment Partner, Archival Substrate & Transparent Markup Slider */}
          <section
            aria-label="Print Fulfillment Partner, Archival Substrate & Markup"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#2E4A3E]" />
                <h3 className="font-serif text-base font-normal text-[#161514]">
                  Print Fulfillment Partner &amp; Archival Substrate
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#2E4A3E]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Direct Guild Dispatch
              </span>
            </div>

            {/* 3 Partner Network Cards */}
            <div className="space-y-2">
              {PARTNER_ORDER.map((pId) => {
                const pSpec = PRINT_PARTNERS[pId];
                const pQuote = partnerComparison[pId];
                const isSelected = pId === partnerId;
                return (
                  <button
                    key={pId}
                    type="button"
                    data-testid={`desktop-partner-card-${pId}`}
                    onClick={() => handleSelectPartner(pId)}
                    className={`w-full p-3 rounded-[6px] text-left transition-all border ${
                      isSelected
                        ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                        : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-[#161514] truncate">
                          {pSpec.name}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#2E4A3E]/10 text-[#2E4A3E]">
                          {pSpec.websiteDomain}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-sm font-semibold text-[#161514]">
                        ${pQuote.physicalRetailTotalUsd.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#5C5852] mt-1">
                      <span className="truncate">{pSpec.archivalCertification}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {pSpec.estimatedProductionDays}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 3 Print Substrate Pills */}
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#5C5852] mb-1.5">
                Archival Substrate ({activeSubstrateSpec.finishLabel})
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SUBSTRATE_ORDER.map((subId) => {
                  const subSpec = PRINT_SUBSTRATES[subId];
                  const isSelected = subId === substrateId;
                  return (
                    <button
                      key={subId}
                      type="button"
                      data-testid={`desktop-substrate-btn-${subId}`}
                      onClick={() => handleSelectSubstrate(subId)}
                      className={`p-2.5 rounded-[6px] text-left border transition-all ${
                        isSelected
                          ? 'bg-[#FFFFFF] border-2 border-[#B85D3B] shadow-sm'
                          : 'bg-[#F6F4EF] border-[#E2DDD3] hover:bg-[#FFFFFF]'
                      }`}
                    >
                      <div className="text-xs font-medium text-[#161514] leading-tight">
                        {subSpec.shortName}
                      </div>
                      <div className="font-mono tabular-nums text-[10px] text-[#5C5852] mt-1">
                        {subSpec.gsmOrThickness}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Atelier Curation & Color-Calibration Markup Slider (10%-40%, default 18%) */}
            <div className="p-3.5 rounded-[6px] bg-[#F6F4EF] border border-[#E2DDD3] space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="desktop-markup-slider-input"
                  className="text-xs font-medium text-[#161514]"
                >
                  Atelier Curation &amp; Color-Calibration Markup
                </label>
                <span className="font-mono tabular-nums text-xs font-semibold text-[#B85D3B]">
                  +{studioMarkupPercent}% (+${pricing.studioMarkupDollarUsd.toFixed(2)})
                </span>
              </div>

              <input
                id="desktop-markup-slider-input"
                data-testid="desktop-markup-slider"
                type="range"
                min={MIN_STUDIO_MARKUP_PERCENT}
                max={MAX_STUDIO_MARKUP_PERCENT}
                step={1}
                value={studioMarkupPercent}
                onChange={(e) => handleChangeMarkup(Number(e.target.value))}
                className="w-full h-2 accent-[#B85D3B] cursor-pointer"
              />

              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <span className="text-[11px] text-[#5C5852]">Quick Studio Fee Tiers:</span>
                <div className="flex items-center gap-1">
                  {MARKUP_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      data-testid={`desktop-markup-preset-${preset}`}
                      onClick={() => handleChangeMarkup(preset)}
                      className={`px-2 py-0.5 rounded font-mono tabular-nums text-[11px] border transition-colors ${
                        studioMarkupPercent === preset
                          ? 'bg-[#161514] text-[#FFFFFF] border-[#161514]'
                          : 'bg-[#FFFFFF] text-[#5C5852] border-[#E2DDD3] hover:text-[#161514]'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* SECTION 5 — Sticky Transparent Partner Pricing Ledger & Dual Acquisition Footer ([SPEC PATCH #14]) */}
        <div
          data-testid="desktop-pricing-ledger"
          className="shrink-0 px-5 py-4 bg-[#FFFFFF] border-t border-[#E2DDD3] space-y-3 shadow-[0_-8px_24px_rgba(22,21,20,0.05)]"
        >
          {/* Everlane / Stripe-Press Style Line-by-Line Cost Breakdown */}
          <div className="space-y-1 font-mono tabular-nums text-xs">
            <div className="flex items-center justify-between text-[#5C5852]">
              <span>
                Partner Base Print ({activePartnerSpec.websiteDomain} · {pricing.panelCount}p)
              </span>
              <span data-testid="ledger-base-print-cost">
                ${pricing.partnerBasePrintCostUsd.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#5C5852]">
              <span>Partner Frame &amp; Archival Matting</span>
              <span data-testid="ledger-frame-mat-cost">
                ${pricing.partnerFrameAndMatCostUsd.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#161514] font-medium pt-1 border-t border-[#E2DDD3]">
              <span>Partner Wholesale Subtotal</span>
              <span data-testid="ledger-wholesale-subtotal">
                ${pricing.partnerWholesaleSubtotalUsd.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#2E4A3E]">
              <span>Atelier Studio Curation Premium (+{pricing.studioMarkupPercent}%)</span>
              <span data-testid="ledger-studio-markup">
                +${pricing.studioMarkupDollarUsd.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[#5C5852]">
              <span>Insured Art Courier Shipping</span>
              <span data-testid="ledger-insured-shipping">
                ${pricing.insuredShippingUsd.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-[#161514] pt-1.5 border-t border-[#E2DDD3]">
              <span>Total Delivered Edition Price</span>
              <span data-testid="ledger-retail-total">
                ${pricing.physicalRetailTotalUsd.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Primary & Secondary Acquisition CTAs */}
          <div className="space-y-2">
            <button
              type="button"
              data-testid="cta-order-printed-edition"
              onClick={() => handleOpenCheckout('partner-printed-edition')}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-[6px] bg-[#B85D3B] hover:bg-[#a34f30] text-[#FFFFFF] text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>
                Order Partner Printed Edition — ${pricing.physicalRetailTotalUsd.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              data-testid="cta-download-print-master"
              onClick={() => handleOpenCheckout('digital-master-download')}
              className="w-full min-h-[42px] px-4 py-2 rounded-[6px] bg-[#F6F4EF] hover:bg-[#EFECE6] text-[#161514] border border-[#E2DDD3] text-xs font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#5C5852]" />
              <span>
                Instant 300-DPI Print Master — ${DIGITAL_MASTER_LICENSE_USD.toFixed(2)}
              </span>
            </button>
          </div>

          {/* Utility Row: Pin Current Wall to Lookbook & Saved Lookbook Drawer Trigger */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              data-testid="cta-pin-lookbook"
              onClick={handlePinLookbook}
              className="flex-1 min-h-[36px] px-3 py-1.5 rounded-[6px] bg-[#F6F4EF] hover:bg-[#EFECE6] text-[#161514] border border-[#E2DDD3] text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              {justPinnedFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#2E4A3E]" />
                  <span className="text-[#2E4A3E]">Pinned to Lookbook</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3.5 h-3.5 text-[#B85D3B]" />
                  <span>Pin Current Wall to Lookbook</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="cta-open-lookbook-drawer"
              onClick={() => handleOpenLookbookDrawer('lookbook')}
              className="min-h-[36px] px-3 py-1.5 rounded-[6px] bg-[#F6F4EF] hover:bg-[#EFECE6] text-[#5C5852] hover:text-[#161514] border border-[#E2DDD3] text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Saved Lookbook &amp; Orders</span>
              {(lookbookCount > 0 || orderCount > 0) && (
                <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.2 rounded bg-[#FFFFFF] border border-[#E2DDD3] text-[#161514]">
                  {lookbookCount + orderCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
