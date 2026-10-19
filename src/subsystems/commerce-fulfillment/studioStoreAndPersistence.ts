// src/subsystems/commerce-fulfillment/studioStoreAndPersistence.ts
// Leaf 4A — Central Atelier Studio Store, Undo/Redo History, Shipping Sanitization & LocalStorage Persistence

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AmbientLightingMode,
  ColorSwatch,
  FRAME_PROFILES,
  FrameProfileId,
  HarmonyMode,
  HighResExportResult,
  LookbookPin,
  MatColorId,
  MatWidthId,
  OrderRecord,
  OrientationMode,
  PaintingSpec,
  PaintingStyleId,
  PanelLayoutMode,
  PigmentStop,
  PricingBreakdown,
  PRINT_PARTNERS,
  PRINT_SIZES,
  PrintPartnerId,
  PrintSizeId,
  PrintSubstrateId,
  RoomAsset,
  RoomPresetId,
  STORAGE_KEY,
  WallAnalysisResult,
  WallPlacementState,
} from '../../contracts/masterContract';
import {
  calculatePrintPricing,
  clampStudioMarkupPercent,
  compareAllPartnersPricing,
  DEFAULT_STUDIO_MARKUP_PERCENT,
  generatePartnerOrderManifestJson,
  MAT_COLOR_OPTIONS,
  MAT_WIDTH_OPTIONS,
  PRINT_SUBSTRATES,
} from './printPartnerPricingEngine';
import { generateInitialPresetRooms } from '../room-vision';
import { generatePaintingsForRoom } from '../painting-synthesis';

// ---------------------------------------------------------------------------
// 1. Shipping Validation & Input Sanitization
// ---------------------------------------------------------------------------

export interface ShippingAddressInput {
  fullName: string;
  email: string;
  streetAddress: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
}

export interface ShippingValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof ShippingAddressInput, string>>;
  sanitized: ShippingAddressInput;
}

/**
 * Strips HTML/script tags, angle brackets, inline JS handlers, and control characters,
 * then collapses internal whitespace and trims.
 */
export function sanitizeShippingText(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]{1,14}[A-Za-z0-9]$/;

export function validateShippingAddress(input: ShippingAddressInput): ShippingValidationResult {
  const sanitized: ShippingAddressInput = {
    fullName: sanitizeShippingText(input?.fullName ?? ''),
    email: sanitizeShippingText(input?.email ?? ''),
    streetAddress: sanitizeShippingText(input?.streetAddress ?? ''),
    city: sanitizeShippingText(input?.city ?? ''),
    stateOrProvince: sanitizeShippingText(input?.stateOrProvince ?? ''),
    postalCode: sanitizeShippingText(input?.postalCode ?? ''),
    country: sanitizeShippingText(input?.country ?? ''),
  };

  const errors: Partial<Record<keyof ShippingAddressInput, string>> = {};

  if (sanitized.fullName.length < 2) {
    errors.fullName = 'Please enter the collector or recipient full name (at least 2 characters).';
  }
  if (!EMAIL_REGEX.test(sanitized.email)) {
    errors.email = 'Please enter a valid archival courier notification email address.';
  }
  if (sanitized.streetAddress.length < 4) {
    errors.streetAddress = 'Please enter a complete street address for white-glove delivery.';
  }
  if (sanitized.city.length < 2) {
    errors.city = 'Please enter a valid city name.';
  }
  if (sanitized.stateOrProvince.length < 2) {
    errors.stateOrProvince = 'Please enter a valid state, province, or region.';
  }
  if (sanitized.postalCode.length < 3 || !POSTAL_CODE_REGEX.test(sanitized.postalCode)) {
    errors.postalCode = 'Please enter a valid postal or ZIP code (3–16 alphanumeric characters).';
  }
  if (sanitized.country.length < 2) {
    errors.country = 'Please specify a valid destination country.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

// ---------------------------------------------------------------------------
// 2. Deterministic Built-in Default Rooms & Paintings Generator
// ---------------------------------------------------------------------------

function buildRoomSvgDataUrl(
  wallTopHex: string,
  wallBottomHex: string,
  floorHex: string,
  trimHex: string,
  accentHex: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
    <defs>
      <linearGradient id="wallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${wallTopHex}" />
        <stop offset="100%" stop-color="${wallBottomHex}" />
      </linearGradient>
      <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${floorHex}" />
        <stop offset="100%" stop-color="${accentHex}" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1200" height="635" fill="url(#wallGrad)" />
    <rect x="0" y="622" width="1200" height="14" fill="${trimHex}" />
    <rect x="0" y="636" width="1200" height="164" fill="url(#floorGrad)" />
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (Number.isNaN(num)) {
    return [210, 204, 194];
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHslTuple(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hn < 60) {
    rPrime = c;
    gPrime = x;
  } else if (hn < 120) {
    rPrime = x;
    gPrime = c;
  } else if (hn < 180) {
    gPrime = c;
    bPrime = x;
  } else if (hn < 240) {
    gPrime = x;
    bPrime = c;
  } else if (hn < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
}

function makeSwatch(
  hex: string,
  populationRatio: number,
  role: ColorSwatch['role'],
  label: string
): ColorSwatch {
  const rgb = hexToRgbTuple(hex);
  const hsl = rgbToHslTuple(rgb[0], rgb[1], rgb[2]);
  const luminance =
    Math.round(((0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255) * 1000) / 1000;
  return {
    hex: hex.toUpperCase(),
    rgb,
    hsl,
    luminance,
    populationRatio,
    role,
    label,
  };
}

let cachedRealPresetRooms: RoomAsset[] | null = null;

export function createDefaultPresetRooms(): RoomAsset[] {
  try {
    if (!cachedRealPresetRooms) {
      const generated = generateInitialPresetRooms();
      if (Array.isArray(generated) && generated.length >= 4) {
        cachedRealPresetRooms = generated;
      }
    }
    if (cachedRealPresetRooms && cachedRealPresetRooms.length >= 4) {
      return cachedRealPresetRooms.map((room) => ({
        ...room,
        analysis: {
          ...room.analysis,
          dominantSwatches: room.analysis.dominantSwatches.map((s) => ({ ...s })),
          lightVector: { ...room.analysis.lightVector },
          detectedWallZone: { ...room.analysis.detectedWallZone },
        },
      }));
    }
  } catch {
    // Fallback to built-in rooms below if room-vision throws
  }
  return [
    {
      id: 'nordic-linen-living',
      name: 'Nordic Linen Living Room',
      architecturalStyle: 'Scandinavian Minimalist · Limewashed Plaster & White Oak',
      wallWidthInches: 120,
      eyeLevelRatioY: 0.45,
      isCustomUpload: false,
      imageDataUrl: buildRoomSvgDataUrl('#EAE5DC', '#DDD6C9', '#C8B496', '#F4F1EA', '#8F775A'),
      createdAt: 1710000000000,
      analysis: {
        roomId: 'nordic-linen-living',
        dominantSwatches: [
          makeSwatch('#E8E2D7', 0.36, 'wall-dominant', 'Chalk Limewash Wall'),
          makeSwatch('#D8CFC2', 0.24, 'secondary-architecture', 'Warm Travertine Shadow'),
          makeSwatch('#C5A882', 0.16, 'warm-undertone', 'Quarter-Sawn White Oak'),
          makeSwatch('#9D8E7E', 0.11, 'cool-undertone', 'Unbleached Belgian Linen'),
          makeSwatch('#6E5A46', 0.08, 'secondary-architecture', 'Aged Smoked Timber'),
          makeSwatch('#B85D3B', 0.05, 'accent', 'Terracotta Ceramic Vessel'),
        ],
        estimatedKelvin: 4250,
        temperatureCategory: 'neutral',
        averageLuminance: 0.78,
        lightVector: {
          azimuthDeg: 318,
          elevationDeg: 42,
          shadowOffsetX: 0.28,
          shadowOffsetY: 0.32,
          shadowSoftness: 0.68,
        },
        detectedWallZone: {
          centerX: 0.5,
          centerY: 0.45,
          widthRatio: 0.58,
          heightRatio: 0.48,
          confidence: 0.96,
          edgeEnergyScore: 0.08,
        },
        recommendedHarmony: 'warm-gallery-contrast',
        curatorialSummary:
          'High-luminance 4,250K Nordic plaster wall paired with quarter-sawn oak floors invites warm gallery contrast in burnt sienna, raw umber, and mineral bone.',
      },
    },
    {
      id: 'midcentury-walnut-study',
      name: 'Mid-Century Walnut Study',
      architecturalStyle: '1960s Architectural Modern · American Walnut & Brushed Brass',
      wallWidthInches: 114,
      eyeLevelRatioY: 0.46,
      isCustomUpload: false,
      imageDataUrl: buildRoomSvgDataUrl('#DCD4C6', '#C9BFAEE0', '#5E422C', '#4A3525', '#B69553'),
      createdAt: 1710000001000,
      analysis: {
        roomId: 'midcentury-walnut-study',
        dominantSwatches: [
          makeSwatch('#DAD1C2', 0.33, 'wall-dominant', 'Warm Parchment Plaster'),
          makeSwatch('#5A3E2B', 0.25, 'secondary-architecture', 'Heartwood Black Walnut'),
          makeSwatch('#8C623F', 0.16, 'warm-undertone', 'Cognac Saddle Leather'),
          makeSwatch('#B69553', 0.11, 'accent', 'Anodized Architectural Brass'),
          makeSwatch('#4A5550', 0.09, 'cool-undertone', 'Slate Library Patina'),
          makeSwatch('#2C221B', 0.06, 'secondary-architecture', 'Ebonized Espresso Trim'),
        ],
        estimatedKelvin: 3200,
        temperatureCategory: 'warm',
        averageLuminance: 0.58,
        lightVector: {
          azimuthDeg: 295,
          elevationDeg: 36,
          shadowOffsetX: 0.34,
          shadowOffsetY: 0.38,
          shadowSoftness: 0.54,
        },
        detectedWallZone: {
          centerX: 0.5,
          centerY: 0.46,
          widthRatio: 0.54,
          heightRatio: 0.46,
          confidence: 0.94,
          edgeEnergyScore: 0.11,
        },
        recommendedHarmony: 'complementary-accent',
        curatorialSummary:
          'Rich 3,200K walnut millwork and cognac undertones harmonize with complementary Prussian slate, oxidized verdigris, and warm ochre highlights.',
      },
    },
    {
      id: 'terracotta-sunlit-loft',
      name: 'Terracotta Sunlit Loft',
      architecturalStyle: 'Mediterranean Atelier · Roman Clay & Honed Travertine',
      wallWidthInches: 132,
      eyeLevelRatioY: 0.46,
      isCustomUpload: false,
      imageDataUrl: buildRoomSvgDataUrl('#E6D6C7', '#D6BFA9', '#B98767', '#EADFD3', '#8B5A3C'),
      createdAt: 1710000002000,
      analysis: {
        roomId: 'terracotta-sunlit-loft',
        dominantSwatches: [
          makeSwatch('#E4D3C3', 0.35, 'wall-dominant', 'Sunbaked Roman Clay'),
          makeSwatch('#C9A88E', 0.23, 'warm-undertone', 'Rose Sienna Limewash'),
          makeSwatch('#B67653', 0.16, 'accent', 'Mediterranean Terracotta Tile'),
          makeSwatch('#8E6A52', 0.12, 'secondary-architecture', 'Weathered Cedar Beam'),
          makeSwatch('#6D7A74', 0.08, 'cool-undertone', 'Olive Grove Sage'),
          makeSwatch('#F2EAE0', 0.06, 'secondary-architecture', 'Honed Alabaster Sill'),
        ],
        estimatedKelvin: 3450,
        temperatureCategory: 'warm',
        averageLuminance: 0.71,
        lightVector: {
          azimuthDeg: 240,
          elevationDeg: 48,
          shadowOffsetX: -0.26,
          shadowOffsetY: 0.29,
          shadowSoftness: 0.62,
        },
        detectedWallZone: {
          centerX: 0.5,
          centerY: 0.46,
          widthRatio: 0.62,
          heightRatio: 0.5,
          confidence: 0.95,
          edgeEnergyScore: 0.09,
        },
        recommendedHarmony: 'chromatic-split',
        curatorialSummary:
          'Sun-drenched 3,450K Roman clay walls pair effortlessly with split-complementary botanical ultramarine, mineral sage, and Venetian red.',
      },
    },
    {
      id: 'minimalist-concrete-bedroom',
      name: 'Minimalist Concrete Sanctuary',
      architecturalStyle: 'Monastic Gallery Loft · Board-Formed Concrete & Raw Silk',
      wallWidthInches: 126,
      eyeLevelRatioY: 0.47,
      isCustomUpload: false,
      imageDataUrl: buildRoomSvgDataUrl('#DDDBD6', '#C9C7C1', '#9E9B95', '#E8E6E1', '#5C5A56'),
      createdAt: 1710000003000,
      analysis: {
        roomId: 'minimalist-concrete-bedroom',
        dominantSwatches: [
          makeSwatch('#DAD8D2', 0.38, 'wall-dominant', 'Architectural Cast Concrete'),
          makeSwatch('#C2C0B9', 0.24, 'secondary-architecture', 'Brushed Pewter Plaster'),
          makeSwatch('#9F9B93', 0.15, 'cool-undertone', 'Weathered Basalt Stone'),
          makeSwatch('#EDEAE2', 0.1, 'warm-undertone', 'Raw Mulberry Silk Bedding'),
          makeSwatch('#5A5853', 0.08, 'secondary-architecture', 'Graphite Steel Reveal'),
          makeSwatch('#7B6B58', 0.05, 'accent', 'Smoked Driftwood Bench'),
        ],
        estimatedKelvin: 5100,
        temperatureCategory: 'cool',
        averageLuminance: 0.74,
        lightVector: {
          azimuthDeg: 330,
          elevationDeg: 52,
          shadowOffsetX: 0.22,
          shadowOffsetY: 0.25,
          shadowSoftness: 0.75,
        },
        detectedWallZone: {
          centerX: 0.5,
          centerY: 0.47,
          widthRatio: 0.6,
          heightRatio: 0.5,
          confidence: 0.97,
          edgeEnergyScore: 0.07,
        },
        recommendedHarmony: 'tonal-sanctuary',
        curatorialSummary:
          'Cool 5,100K daylight across monolithic concrete architecture calls for a quiet tonal sanctuary of titanium buff, paynes grey, and raw gesso.',
      },
    },
  ];
}

const STYLE_CATALOG_METADATA: Array<{
  styleId: PaintingStyleId;
  catalogNumber: string;
  titlePrefix: string;
  aspectRatio: number;
  recommendedSizeId: PrintSizeId;
  recommendedFrameId: FrameProfileId;
  pigmentLabels: [string, string, string, string, string, string];
}> = [
  {
    styleId: 'impasto-oil',
    catalogNumber: 'No. 01',
    titlePrefix: 'Impasto Palette Knife Study',
    aspectRatio: 0.75,
    recommendedSizeId: '24x36',
    recommendedFrameId: 'natural-white-oak',
    pigmentLabels: [
      'Titanium Unbleached Buff',
      'Burnt Sienna Earth',
      'Raw Umber Ridge',
      'Yellow Ochre Glaze',
      'Mineral Slate Undertone',
      'Lead White Impasto Crest',
    ],
  },
  {
    styleId: 'japandi-plaster',
    catalogNumber: 'No. 02',
    titlePrefix: 'Wabi-Sabi Limewash Relief',
    aspectRatio: 0.75,
    recommendedSizeId: '30x40',
    recommendedFrameId: 'warm-travertine-ash',
    pigmentLabels: [
      'Gessoed Travertine Chalk',
      'Warm Pumice Stone',
      'Smoked Matcha Clay',
      'Raw Linen Fiber',
      'Charcoal Sumi Wash',
      'Alabaster Trowel Highlight',
    ],
  },
  {
    styleId: 'rothko-colorfield',
    catalogNumber: 'No. 03',
    titlePrefix: 'Luminous Chromatic Field',
    aspectRatio: 0.75,
    recommendedSizeId: '30x40',
    recommendedFrameId: 'brushed-brass-float',
    pigmentLabels: [
      'Venetian Terracotta Veil',
      'Deep Cadence Ochre',
      'Prussian Twilight Mist',
      'Warm Crimson Lake',
      'Umber Horizon Ground',
      'Translucent Egg-Tempera Glow',
    ],
  },
  {
    styleId: 'botanical-ink',
    catalogNumber: 'No. 04',
    titlePrefix: 'Herbarium Sumi & Mineral Study',
    aspectRatio: 0.75,
    recommendedSizeId: '18x24',
    recommendedFrameId: 'american-black-walnut',
    pigmentLabels: [
      'Handmade Mulberry Paper',
      'Pine Soot Sumi Ink',
      'Oxidized Verdigris Leaf',
      'Sepia Walnut Gall',
      'Warm Clay Wash',
      'Pressed Linen Highlight',
    ],
  },
  {
    styleId: 'bauhaus-geometric',
    catalogNumber: 'No. 05',
    titlePrefix: 'Weimar Constructivist Composition',
    aspectRatio: 0.75,
    recommendedSizeId: '24x36',
    recommendedFrameId: 'matte-gallery-black',
    pigmentLabels: [
      'Archival Bone Ground',
      'Cadmium Terracotta Arc',
      'Bauhaus Ochre Plane',
      'Ultramarine Ash Block',
      'Graphite Rule Line',
      'Warm Parchment Counterpoint',
    ],
  },
  {
    styleId: 'coastal-nocturne',
    catalogNumber: 'No. 06',
    titlePrefix: 'Atmospheric Horizon Nocturne',
    aspectRatio: 0.75,
    recommendedSizeId: '36x48',
    recommendedFrameId: 'american-black-walnut',
    pigmentLabels: [
      'Paynes Grey Estuary Mist',
      'Warm Driftwood Horizon',
      'Indigo Pelagic Depth',
      'Silvered Salt Chalk',
      'Amber Lantern Reflection',
      'Chalk Gypsum Cloud',
    ],
  },
];

export function createDefaultPaintingsForRoom(
  room: RoomAsset,
  harmonyOverride?: HarmonyMode,
  seedOffset = 0
): PaintingSpec[] {
  try {
    const synthesized = generatePaintingsForRoom(
      room.analysis,
      harmonyOverride ?? room.analysis.recommendedHarmony,
      seedOffset
    );
    if (Array.isArray(synthesized) && synthesized.length >= 6) {
      return synthesized;
    }
  } catch {
    // Fallback below if painting-synthesis encounters an unexpected input
  }
  const analysis = room.analysis;
  const harmonyMode: HarmonyMode = harmonyOverride ?? analysis.recommendedHarmony;
  const primarySwatch = analysis.dominantSwatches[0] ?? makeSwatch('#E5DFD3', 0.4, 'wall-dominant', 'Wall');
  const [baseH, baseS, baseL] = primarySwatch.hsl;

  const harmonyHueOffsets: Record<HarmonyMode, [number, number, number, number, number, number]> = {
    'complementary-accent': [0, 180, 162, 24, 198, 12],
    'tonal-sanctuary': [0, 8, -8, 14, -14, 4],
    'warm-gallery-contrast': [14, -22, 34, 165, 8, -12],
    'chromatic-split': [0, 150, 210, 30, 175, -25],
  };

  const offsets = harmonyHueOffsets[harmonyMode] ?? harmonyHueOffsets['warm-gallery-contrast'];

  return STYLE_CATALOG_METADATA.map((meta, styleIdx) => {
    const deterministicSeed =
      Math.abs(
        room.id.split('').reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), 1000) +
          styleIdx * 137 +
          seedOffset * 997
      ) % 100000;

    const pigments: PigmentStop[] = offsets.map((hueDelta, pIdx) => {
      const styleHueShift = (styleIdx * 11 + pIdx * 7 + seedOffset * 19) % 36;
      const h = (baseH + hueDelta + styleHueShift + 360) % 360;
      const s =
        harmonyMode === 'tonal-sanctuary'
          ? Math.max(12, Math.min(34, baseS + (pIdx % 3) * 6))
          : Math.max(22, Math.min(72, baseS + 18 + ((pIdx * 11 + styleIdx * 5) % 28)));
      const lightnessSteps = [84, 62, 38, 48, 26, 91];
      const l = Math.max(
        16,
        Math.min(93, Math.round((lightnessSteps[pIdx] * 0.75 + baseL * 0.25) + ((seedOffset + pIdx) % 5) - 2))
      );
      const hex = hslToHex(h, s, l);
      return {
        hex,
        rgb: hexToRgbTuple(hex),
        pigmentName: meta.pigmentLabels[pIdx],
        opacity: Number((0.72 + (pIdx % 3) * 0.09).toFixed(2)),
        viscosity: Number((0.45 + ((styleIdx + pIdx) % 5) * 0.11).toFixed(2)),
      };
    });

    const harmonyLabel = harmonyMode
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return {
      id: `painting-${room.id}-${meta.styleId}-${harmonyMode}-${seedOffset}`,
      roomId: room.id,
      catalogNumber: meta.catalogNumber,
      title: `${meta.titlePrefix} · ${primarySwatch.label.split(' ')[0]}`,
      subtitle: `Calibrated for ${analysis.estimatedKelvin.toLocaleString()}K ${analysis.temperatureCategory} lighting · ${harmonyLabel}`,
      styleId: meta.styleId,
      harmonyMode,
      seed: deterministicSeed,
      pigments,
      lightAzimuthDeg: analysis.lightVector.azimuthDeg,
      lightElevationDeg: analysis.lightVector.elevationDeg,
      aspectRatio: meta.aspectRatio,
      recommendedSizeId: meta.recommendedSizeId,
      recommendedFrameId: meta.recommendedFrameId,
      curatorialRationale: `Synthesized specifically for ${room.name} (${analysis.estimatedKelvin}K) using ${harmonyLabel.toLowerCase()} pigment balancing against ${primarySwatch.label.toLowerCase()} (${primarySwatch.hex}).`,
    };
  });
}

export function createDefaultWallPlacementForRoom(room: RoomAsset): WallPlacementState {
  const centerX = room?.analysis?.detectedWallZone?.centerX ?? 0.5;
  const centerY = room?.eyeLevelRatioY ?? room?.analysis?.detectedWallZone?.centerY ?? 0.46;
  const wallWidthInches = room?.wallWidthInches ?? 120;

  return {
    centerX,
    centerY,
    wallWidthInches,
    perspectiveQuad: {
      topLeft: { x: 0.22, y: 0.16 },
      topRight: { x: 0.78, y: 0.16 },
      bottomRight: { x: 0.78, y: 0.76 },
      bottomLeft: { x: 0.22, y: 0.76 },
    },
    usePerspectiveWarp: false,
    interPanelGapInches: 2.0,
  };
}

// ---------------------------------------------------------------------------
// 3. State, Undo/Redo & Persistence under STORAGE_KEY = 'atelier_vue_state_v1'
// ---------------------------------------------------------------------------

export interface AtelierState {
  rooms: RoomAsset[];
  activeRoomId: RoomPresetId;
  paintingsByRoom: Record<string, PaintingSpec[]>;
  activePaintingId: string;
  ambientLightingMode: AmbientLightingMode;
  harmonyMode: HarmonyMode;
  sizeId: PrintSizeId;
  orientation: OrientationMode;
  panelLayout: PanelLayoutMode;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
  substrateId: PrintSubstrateId;
  partnerId: PrintPartnerId;
  studioMarkupPercent: number;
  wallPlacementByRoom: Record<string, WallPlacementState>;
  showDimensionGuides: boolean;
  beforeAfterSplit: number | null;
  pinnedLookbook: LookbookPin[];
  orders: OrderRecord[];
  seedOffset: number;
  isCheckoutModalOpen: boolean;
  activeCheckoutTab: 'partner-printed-edition' | 'digital-master-download';
  isLookbookDrawerOpen: boolean;
  activeDrawerTab: 'lookbook' | 'orders';
  isCameraModalOpen: boolean;
}

export interface CreateInitialAtelierStateOptions {
  initialRooms?: RoomAsset[];
  generatePaintingsFn?: (
    analysis: WallAnalysisResult,
    harmonyOverride?: HarmonyMode,
    seedOffset?: number
  ) => PaintingSpec[];
}

export function createInitialAtelierState(
  options?: CreateInitialAtelierStateOptions
): AtelierState {
  const rooms =
    options?.initialRooms && options.initialRooms.length > 0
      ? options.initialRooms
      : createDefaultPresetRooms();

  const paintingsByRoom: Record<string, PaintingSpec[]> = {};
  const wallPlacementByRoom: Record<string, WallPlacementState> = {};

  for (const room of rooms) {
    const generated = options?.generatePaintingsFn
      ? options.generatePaintingsFn(room.analysis, room.analysis.recommendedHarmony, 0)
      : createDefaultPaintingsForRoom(room, room.analysis.recommendedHarmony, 0);

    paintingsByRoom[room.id] =
      generated && generated.length > 0
        ? generated
        : createDefaultPaintingsForRoom(room, room.analysis.recommendedHarmony, 0);

    wallPlacementByRoom[room.id] = createDefaultWallPlacementForRoom(room);
  }

  const firstRoom = rooms[0];
  const firstPaintings = paintingsByRoom[firstRoom.id];
  const firstPainting = firstPaintings[0];

  return {
    rooms,
    activeRoomId: firstRoom.id,
    paintingsByRoom,
    activePaintingId: firstPainting.id,
    ambientLightingMode: 'daylight',
    harmonyMode: firstRoom.analysis.recommendedHarmony,
    sizeId: firstPainting.recommendedSizeId ?? '24x36',
    orientation: 'portrait',
    panelLayout: 'single',
    frameId: firstPainting.recommendedFrameId ?? 'natural-white-oak',
    matWidthId: '2.5in',
    matColorId: 'archival-ivory',
    substrateId: 'hahnemuhle-etching-310gsm',
    partnerId: 'prodigi',
    studioMarkupPercent: DEFAULT_STUDIO_MARKUP_PERCENT,
    wallPlacementByRoom,
    showDimensionGuides: false,
    beforeAfterSplit: null,
    pinnedLookbook: [],
    orders: [],
    seedOffset: 0,
    isCheckoutModalOpen: false,
    activeCheckoutTab: 'partner-printed-edition',
    isLookbookDrawerOpen: false,
    activeDrawerTab: 'lookbook',
    isCameraModalOpen: false,
  };
}

const VALID_HARMONY_MODES: HarmonyMode[] = [
  'complementary-accent',
  'tonal-sanctuary',
  'warm-gallery-contrast',
  'chromatic-split',
];

const VALID_LIGHTING_MODES: AmbientLightingMode[] = ['daylight', 'golden-hour', 'evening-sconce'];
const VALID_ORIENTATIONS: OrientationMode[] = ['portrait', 'landscape', 'square'];
const VALID_PANEL_LAYOUTS: PanelLayoutMode[] = ['single', 'diptych', 'triptych'];

export function loadPersistedAtelierState(fallbackState?: AtelierState): AtelierState {
  const base = fallbackState ?? createInitialAtelierState();
  if (typeof window === 'undefined' || !window.localStorage) {
    return base;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return base;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return base;
    }

    const customRooms: RoomAsset[] = Array.isArray(parsed.customRooms)
      ? parsed.customRooms.filter(
          (r: unknown): r is RoomAsset =>
            Boolean(r && typeof r === 'object' && 'id' in r && 'analysis' in r)
        )
      : Array.isArray(parsed.rooms)
      ? parsed.rooms.filter(
          (r: unknown): r is RoomAsset =>
            Boolean(
              r &&
                typeof r === 'object' &&
                'id' in r &&
                'isCustomUpload' in r &&
                (r as RoomAsset).isCustomUpload
            )
        )
      : [];

    const existingIds = new Set(base.rooms.map((r) => r.id));
    const mergedRooms = [
      ...base.rooms,
      ...customRooms.filter((r) => !existingIds.has(r.id)),
    ];

    const mergedPaintingsByRoom: Record<string, PaintingSpec[]> = {
      ...base.paintingsByRoom,
    };
    if (parsed.paintingsByRoom && typeof parsed.paintingsByRoom === 'object') {
      for (const [rId, list] of Object.entries(parsed.paintingsByRoom)) {
        if (Array.isArray(list) && list.length > 0) {
          mergedPaintingsByRoom[rId] = list as PaintingSpec[];
        }
      }
    }
    for (const room of mergedRooms) {
      if (!mergedPaintingsByRoom[room.id] || mergedPaintingsByRoom[room.id].length === 0) {
        mergedPaintingsByRoom[room.id] = createDefaultPaintingsForRoom(room);
      }
    }

    const activeRoomId =
      typeof parsed.activeRoomId === 'string' &&
      mergedRooms.some((r) => r.id === parsed.activeRoomId)
        ? (parsed.activeRoomId as RoomPresetId)
        : base.activeRoomId;

    const roomPaintings = mergedPaintingsByRoom[activeRoomId] ?? base.paintingsByRoom[base.activeRoomId];
    const activePaintingId =
      typeof parsed.activePaintingId === 'string' &&
      roomPaintings.some((p) => p.id === parsed.activePaintingId)
        ? parsed.activePaintingId
        : roomPaintings[0]?.id ?? base.activePaintingId;

    const sizeId =
      typeof parsed.sizeId === 'string' && parsed.sizeId in PRINT_SIZES
        ? (parsed.sizeId as PrintSizeId)
        : base.sizeId;

    const orientation =
      typeof parsed.orientation === 'string' &&
      VALID_ORIENTATIONS.includes(parsed.orientation as OrientationMode)
        ? (parsed.orientation as OrientationMode)
        : base.orientation;

    const panelLayout =
      typeof parsed.panelLayout === 'string' &&
      VALID_PANEL_LAYOUTS.includes(parsed.panelLayout as PanelLayoutMode)
        ? (parsed.panelLayout as PanelLayoutMode)
        : base.panelLayout;

    const frameId =
      typeof parsed.frameId === 'string' && parsed.frameId in FRAME_PROFILES
        ? (parsed.frameId as FrameProfileId)
        : base.frameId;

    const matWidthId =
      typeof parsed.matWidthId === 'string' && parsed.matWidthId in MAT_WIDTH_OPTIONS
        ? (parsed.matWidthId as MatWidthId)
        : base.matWidthId;

    const matColorId =
      typeof parsed.matColorId === 'string' && parsed.matColorId in MAT_COLOR_OPTIONS
        ? (parsed.matColorId as MatColorId)
        : base.matColorId;

    const substrateId =
      typeof parsed.substrateId === 'string' && parsed.substrateId in PRINT_SUBSTRATES
        ? (parsed.substrateId as PrintSubstrateId)
        : base.substrateId;

    const partnerId =
      typeof parsed.partnerId === 'string' && parsed.partnerId in PRINT_PARTNERS
        ? (parsed.partnerId as PrintPartnerId)
        : base.partnerId;

    const studioMarkupPercent = clampStudioMarkupPercent(
      typeof parsed.studioMarkupPercent === 'number'
        ? parsed.studioMarkupPercent
        : base.studioMarkupPercent
    );

    const harmonyMode =
      typeof parsed.harmonyMode === 'string' &&
      VALID_HARMONY_MODES.includes(parsed.harmonyMode as HarmonyMode)
        ? (parsed.harmonyMode as HarmonyMode)
        : base.harmonyMode;

    const ambientLightingMode =
      typeof parsed.ambientLightingMode === 'string' &&
      VALID_LIGHTING_MODES.includes(parsed.ambientLightingMode as AmbientLightingMode)
        ? (parsed.ambientLightingMode as AmbientLightingMode)
        : base.ambientLightingMode;

    const mergedPlacements: Record<string, WallPlacementState> = {
      ...base.wallPlacementByRoom,
    };
    for (const room of mergedRooms) {
      if (!mergedPlacements[room.id]) {
        mergedPlacements[room.id] = createDefaultWallPlacementForRoom(room);
      }
    }
    if (parsed.wallPlacementByRoom && typeof parsed.wallPlacementByRoom === 'object') {
      for (const [rId, placement] of Object.entries(parsed.wallPlacementByRoom)) {
        if (placement && typeof placement === 'object') {
          const basePlacement =
            mergedPlacements[rId] ??
            createDefaultWallPlacementForRoom(
              mergedRooms.find((r) => r.id === rId) ?? mergedRooms[0]
            );
          const p = placement as Partial<WallPlacementState>;
          mergedPlacements[rId] = {
            centerX: typeof p.centerX === 'number' ? p.centerX : basePlacement.centerX,
            centerY: typeof p.centerY === 'number' ? p.centerY : basePlacement.centerY,
            wallWidthInches:
              typeof p.wallWidthInches === 'number'
                ? p.wallWidthInches
                : basePlacement.wallWidthInches,
            perspectiveQuad: p.perspectiveQuad ?? basePlacement.perspectiveQuad,
            usePerspectiveWarp:
              typeof p.usePerspectiveWarp === 'boolean'
                ? p.usePerspectiveWarp
                : basePlacement.usePerspectiveWarp,
            interPanelGapInches:
              typeof p.interPanelGapInches === 'number'
                ? p.interPanelGapInches
                : basePlacement.interPanelGapInches,
          };
        }
      }
    }

    const pinnedLookbook: LookbookPin[] = Array.isArray(parsed.pinnedLookbook)
      ? parsed.pinnedLookbook.filter(
          (pin: unknown): pin is LookbookPin =>
            Boolean(pin && typeof pin === 'object' && 'id' in pin && 'painting' in pin)
        )
      : base.pinnedLookbook;

    const orders: OrderRecord[] = Array.isArray(parsed.orders)
      ? parsed.orders.filter(
          (ord: unknown): ord is OrderRecord =>
            Boolean(ord && typeof ord === 'object' && 'id' in ord && 'pricing' in ord)
        )
      : base.orders;

    const showDimensionGuides =
      typeof parsed.showDimensionGuides === 'boolean'
        ? parsed.showDimensionGuides
        : base.showDimensionGuides;

    const seedOffset =
      typeof parsed.seedOffset === 'number' && Number.isFinite(parsed.seedOffset)
        ? parsed.seedOffset
        : base.seedOffset;

    return {
      ...base,
      rooms: mergedRooms,
      activeRoomId,
      paintingsByRoom: mergedPaintingsByRoom,
      activePaintingId,
      ambientLightingMode,
      harmonyMode,
      sizeId,
      orientation,
      panelLayout,
      frameId,
      matWidthId,
      matColorId,
      substrateId,
      partnerId,
      studioMarkupPercent,
      wallPlacementByRoom: mergedPlacements,
      showDimensionGuides,
      pinnedLookbook,
      orders,
      seedOffset,
    };
  } catch {
    return base;
  }
}

export function savePersistedAtelierState(state: AtelierState): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  const customRooms = state.rooms.filter((r) => r.isCustomUpload);
  const snapshot = {
    schemaVersion: 1,
    savedAt: Date.now(),
    activeRoomId: state.activeRoomId,
    activePaintingId: state.activePaintingId,
    ambientLightingMode: state.ambientLightingMode,
    harmonyMode: state.harmonyMode,
    sizeId: state.sizeId,
    orientation: state.orientation,
    panelLayout: state.panelLayout,
    frameId: state.frameId,
    matWidthId: state.matWidthId,
    matColorId: state.matColorId,
    substrateId: state.substrateId,
    partnerId: state.partnerId,
    studioMarkupPercent: clampStudioMarkupPercent(state.studioMarkupPercent),
    wallPlacementByRoom: state.wallPlacementByRoom,
    showDimensionGuides: state.showDimensionGuides,
    pinnedLookbook: state.pinnedLookbook,
    orders: state.orders,
    seedOffset: state.seedOffset,
    customRooms,
    paintingsByRoom: state.paintingsByRoom,
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    // QuotaExceededError fallback: strip heavy custom room data URLs if storage quota is tight
    try {
      const compactSnapshot = {
        ...snapshot,
        customRooms: [],
        paintingsByRoom: {},
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compactSnapshot));
      return true;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Store Hook & Actions (AtelierProvider & useAtelierStore)
// ---------------------------------------------------------------------------

export interface AtelierStoreActions {
  selectRoom: (roomId: RoomPresetId) => void;
  addCustomRoom: (room: RoomAsset, paintings?: PaintingSpec[]) => void;
  setRoomsAndPaintings: (
    rooms: RoomAsset[],
    paintingsByRoom?: Record<string, PaintingSpec[]>
  ) => void;
  selectPainting: (paintingId: string) => void;
  cyclePainting: (delta: number) => void;
  setHarmonyMode: (mode: HarmonyMode) => void;
  regeneratePaintingsBatch: () => void;
  setPaintingsForRoom: (roomId: string, paintings: PaintingSpec[]) => void;
  selectSize: (sizeId: PrintSizeId) => void;
  cycleSize: (delta: number) => void;
  selectOrientation: (orientation: OrientationMode) => void;
  selectPanelLayout: (panelLayout: PanelLayoutMode) => void;
  selectFrame: (frameId: FrameProfileId) => void;
  cycleFrame: () => void;
  selectMatWidth: (matWidthId: MatWidthId) => void;
  selectMatColor: (matColorId: MatColorId) => void;
  selectSubstrate: (substrateId: PrintSubstrateId) => void;
  selectPartner: (partnerId: PrintPartnerId) => void;
  setStudioMarkupPercent: (percent: number) => void;
  setAmbientLightingMode: (mode: AmbientLightingMode) => void;
  updateWallPlacement: (patch: Partial<WallPlacementState>) => void;
  resetWallPlacement: () => void;
  toggleGuides: () => void;
  setBeforeAfterSplit: (split: number | null) => void;
  pinCurrentWallToLookbook: () => LookbookPin;
  removeLookbookPin: (pinId: string) => void;
  applyLookbookPin: (pinId: string) => void;
  clearLookbook: () => void;
  submitPartnerPrintOrder: (shippingAddress: ShippingAddressInput) => {
    ok: boolean;
    order?: OrderRecord;
    validation: ShippingValidationResult;
  };
  recordDigitalDownloadOrder: (exportResult?: Partial<HighResExportResult>) => OrderRecord;
  recordCompletedOrder: (
    order: Omit<OrderRecord, 'id' | 'createdAt' | 'partnerOrderPayloadJson'> & {
      id?: string;
      createdAt?: number;
      partnerOrderPayloadJson?: string;
    }
  ) => OrderRecord;
  clearOrders: () => void;
  openCheckoutModal: (tab?: 'partner-printed-edition' | 'digital-master-download') => void;
  closeCheckoutModal: () => void;
  openLookbookDrawer: (tab?: 'lookbook' | 'orders') => void;
  closeLookbookDrawer: () => void;
  openCameraModal: () => void;
  closeCameraModal: () => void;
  undo: () => void;
  redo: () => void;
  resetStudioToDefaults: () => void;
}

export interface AtelierStoreValue extends AtelierState, AtelierStoreActions {
  activeRoom: RoomAsset;
  activePaintings: PaintingSpec[];
  activePainting: PaintingSpec;
  activePlacement: WallPlacementState;
  activePricing: PricingBreakdown;
  allPartnersPricing: Record<PrintPartnerId, PricingBreakdown>;
  canUndo: boolean;
  canRedo: boolean;
}

export interface AtelierProviderProps {
  children: React.ReactNode;
  initialRooms?: RoomAsset[];
  generatePaintingsFn?: (
    analysis: WallAnalysisResult,
    harmonyOverride?: HarmonyMode,
    seedOffset?: number
  ) => PaintingSpec[];
  skipLocalStorageLoad?: boolean;
}

const PRINT_SIZE_ORDER: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];
const FRAME_PROFILE_ORDER: FrameProfileId[] = [
  'unframed-canvas',
  'natural-white-oak',
  'american-black-walnut',
  'matte-gallery-black',
  'brushed-brass-float',
  'warm-travertine-ash',
];

const MAX_HISTORY_STEPS = 30;

const AtelierStoreContext = createContext<AtelierStoreValue | null>(null);

function deriveActiveEntities(state: AtelierState) {
  const activeRoom =
    state.rooms.find((r) => r.id === state.activeRoomId) ??
    state.rooms[0] ??
    createDefaultPresetRooms()[0];

  const activePaintings =
    state.paintingsByRoom[activeRoom.id] && state.paintingsByRoom[activeRoom.id].length > 0
      ? state.paintingsByRoom[activeRoom.id]
      : createDefaultPaintingsForRoom(activeRoom, state.harmonyMode, state.seedOffset);

  const activePainting =
    activePaintings.find((p) => p.id === state.activePaintingId) ?? activePaintings[0];

  const activePlacement =
    state.wallPlacementByRoom[activeRoom.id] ?? createDefaultWallPlacementForRoom(activeRoom);

  const pricingParams = {
    sizeId: state.sizeId,
    frameId: state.frameId,
    matWidthId: state.matWidthId,
    substrateId: state.substrateId,
    panelLayout: state.panelLayout,
    studioMarkupPercent: state.studioMarkupPercent,
  };

  const activePricing = calculatePrintPricing({
    ...pricingParams,
    partnerId: state.partnerId,
  });

  const allPartnersPricing = compareAllPartnersPricing(pricingParams);

  return {
    activeRoom,
    activePaintings,
    activePainting,
    activePlacement,
    activePricing,
    allPartnersPricing,
  };
}

export function AtelierProvider(props: AtelierProviderProps): React.ReactElement {
  const { children, initialRooms, generatePaintingsFn, skipLocalStorageLoad } = props;

  const generatePaintingsRef = useRef(generatePaintingsFn);
  generatePaintingsRef.current = generatePaintingsFn;

  const synthesizePaintings = useCallback(
    (room: RoomAsset, harmonyOverride?: HarmonyMode, seedOffset = 0): PaintingSpec[] => {
      if (generatePaintingsRef.current) {
        const res = generatePaintingsRef.current(
          room.analysis,
          harmonyOverride ?? room.analysis.recommendedHarmony,
          seedOffset
        );
        if (Array.isArray(res) && res.length > 0) {
          return res;
        }
      }
      return createDefaultPaintingsForRoom(room, harmonyOverride, seedOffset);
    },
    []
  );

  const [state, setState] = useState<AtelierState>(() => {
    const initial = createInitialAtelierState({
      initialRooms,
      generatePaintingsFn,
    });
    return skipLocalStorageLoad ? initial : loadPersistedAtelierState(initial);
  });

  const stateRef = useRef<AtelierState>(state);
  stateRef.current = state;

  const pastRef = useRef<AtelierState[]>([]);
  const futureRef = useRef<AtelierState[]>([]);
  const [, setHistoryTick] = useState(0);

  const commitState = useCallback(
    (updater: (prev: AtelierState) => AtelierState, recordUndo = true) => {
      setState((prev) => {
        const next = updater(prev);
        if (next === prev) {
          return prev;
        }
        if (recordUndo) {
          pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY_STEPS - 1)), prev];
          futureRef.current = [];
        }
        stateRef.current = next;
        savePersistedAtelierState(next);
        return next;
      });
      if (recordUndo) {
        setHistoryTick((t) => t + 1);
      }
    },
    []
  );

  useEffect(() => {
    savePersistedAtelierState(state);
  }, [state]);

  const selectRoom = useCallback(
    (roomId: RoomPresetId) => {
      commitState((prev) => {
        const targetRoom = prev.rooms.find((r) => r.id === roomId);
        if (!targetRoom) {
          return prev;
        }
        const existingPaintings = prev.paintingsByRoom[targetRoom.id];
        const roomPaintings =
          existingPaintings && existingPaintings.length > 0
            ? existingPaintings
            : synthesizePaintings(
                targetRoom,
                targetRoom.analysis.recommendedHarmony,
                prev.seedOffset
              );
        const firstPainting = roomPaintings[0];
        const placement =
          prev.wallPlacementByRoom[targetRoom.id] ?? createDefaultWallPlacementForRoom(targetRoom);

        return {
          ...prev,
          activeRoomId: targetRoom.id,
          paintingsByRoom: {
            ...prev.paintingsByRoom,
            [targetRoom.id]: roomPaintings,
          },
          activePaintingId: firstPainting ? firstPainting.id : prev.activePaintingId,
          harmonyMode: targetRoom.analysis.recommendedHarmony,
          sizeId: firstPainting?.recommendedSizeId ?? prev.sizeId,
          frameId: firstPainting?.recommendedFrameId ?? prev.frameId,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [targetRoom.id]: placement,
          },
        };
      });
    },
    [commitState, synthesizePaintings]
  );

  const addCustomRoom = useCallback(
    (room: RoomAsset, paintings?: PaintingSpec[]) => {
      commitState((prev) => {
        const filteredRooms = prev.rooms.filter((r) => r.id !== room.id);
        const nextRooms = [...filteredRooms, room];
        const roomPaintings =
          paintings && paintings.length > 0
            ? paintings
            : synthesizePaintings(room, room.analysis.recommendedHarmony, prev.seedOffset);
        const firstPainting = roomPaintings[0];

        return {
          ...prev,
          rooms: nextRooms,
          activeRoomId: room.id,
          paintingsByRoom: {
            ...prev.paintingsByRoom,
            [room.id]: roomPaintings,
          },
          activePaintingId: firstPainting ? firstPainting.id : prev.activePaintingId,
          harmonyMode: room.analysis.recommendedHarmony,
          sizeId: firstPainting?.recommendedSizeId ?? prev.sizeId,
          frameId: firstPainting?.recommendedFrameId ?? prev.frameId,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [room.id]: createDefaultWallPlacementForRoom(room),
          },
          isCameraModalOpen: false,
        };
      });
    },
    [commitState, synthesizePaintings]
  );

  const setRoomsAndPaintings = useCallback(
    (rooms: RoomAsset[], paintingsByRoom?: Record<string, PaintingSpec[]>) => {
      if (!Array.isArray(rooms) || rooms.length === 0) {
        return;
      }
      commitState((prev) => {
        const nextPaintingsByRoom: Record<string, PaintingSpec[]> = {
          ...prev.paintingsByRoom,
          ...(paintingsByRoom ?? {}),
        };
        const nextPlacements: Record<string, WallPlacementState> = {
          ...prev.wallPlacementByRoom,
        };
        for (const room of rooms) {
          if (!nextPaintingsByRoom[room.id] || nextPaintingsByRoom[room.id].length === 0) {
            nextPaintingsByRoom[room.id] = synthesizePaintings(
              room,
              room.analysis.recommendedHarmony,
              prev.seedOffset
            );
          }
          if (!nextPlacements[room.id]) {
            nextPlacements[room.id] = createDefaultWallPlacementForRoom(room);
          }
        }
        const nextActiveRoom = rooms.find((r) => r.id === prev.activeRoomId) ?? rooms[0];
        const activeRoomPaintings = nextPaintingsByRoom[nextActiveRoom.id];
        const nextActivePainting =
          activeRoomPaintings.find((p) => p.id === prev.activePaintingId) ?? activeRoomPaintings[0];

        return {
          ...prev,
          rooms,
          activeRoomId: nextActiveRoom.id,
          paintingsByRoom: nextPaintingsByRoom,
          activePaintingId: nextActivePainting.id,
          wallPlacementByRoom: nextPlacements,
        };
      }, false);
    },
    [commitState, synthesizePaintings]
  );

  const selectPainting = useCallback(
    (paintingId: string) => {
      commitState((prev) => {
        const roomPaintings = prev.paintingsByRoom[prev.activeRoomId] ?? [];
        const found = roomPaintings.find((p) => p.id === paintingId);
        if (!found) {
          return prev;
        }
        return {
          ...prev,
          activePaintingId: found.id,
        };
      });
    },
    [commitState]
  );

  const cyclePainting = useCallback(
    (delta: number) => {
      commitState((prev) => {
        const list = prev.paintingsByRoom[prev.activeRoomId] ?? [];
        if (list.length === 0) {
          return prev;
        }
        const currentIdx = Math.max(
          0,
          list.findIndex((p) => p.id === prev.activePaintingId)
        );
        const nextIdx = ((currentIdx + delta) % list.length + list.length) % list.length;
        return {
          ...prev,
          activePaintingId: list[nextIdx].id,
        };
      });
    },
    [commitState]
  );

  const setHarmonyMode = useCallback(
    (mode: HarmonyMode) => {
      if (!VALID_HARMONY_MODES.includes(mode)) {
        return;
      }
      commitState((prev) => {
        const currentRoom = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
        const currentList = prev.paintingsByRoom[currentRoom.id] ?? [];
        const currentIdx = Math.max(
          0,
          currentList.findIndex((p) => p.id === prev.activePaintingId)
        );
        const regenerated = synthesizePaintings(currentRoom, mode, prev.seedOffset);
        const nextPainting = regenerated[currentIdx] ?? regenerated[0];

        return {
          ...prev,
          harmonyMode: mode,
          paintingsByRoom: {
            ...prev.paintingsByRoom,
            [currentRoom.id]: regenerated,
          },
          activePaintingId: nextPainting ? nextPainting.id : prev.activePaintingId,
        };
      });
    },
    [commitState, synthesizePaintings]
  );

  const regeneratePaintingsBatch = useCallback(() => {
    commitState((prev) => {
      const nextSeedOffset = prev.seedOffset + 1;
      const currentRoom = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
      const currentList = prev.paintingsByRoom[currentRoom.id] ?? [];
      const currentIdx = Math.max(
        0,
        currentList.findIndex((p) => p.id === prev.activePaintingId)
      );
      const regenerated = synthesizePaintings(currentRoom, prev.harmonyMode, nextSeedOffset);
      const nextPainting = regenerated[currentIdx] ?? regenerated[0];

      return {
        ...prev,
        seedOffset: nextSeedOffset,
        paintingsByRoom: {
          ...prev.paintingsByRoom,
          [currentRoom.id]: regenerated,
        },
        activePaintingId: nextPainting ? nextPainting.id : prev.activePaintingId,
      };
    });
  }, [commitState, synthesizePaintings]);

  const setPaintingsForRoom = useCallback(
    (roomId: string, paintings: PaintingSpec[]) => {
      if (!Array.isArray(paintings) || paintings.length === 0) {
        return;
      }
      commitState((prev) => {
        const isCurrentRoom = roomId === prev.activeRoomId;
        const nextActivePaintingId =
          isCurrentRoom && !paintings.some((p) => p.id === prev.activePaintingId)
            ? paintings[0].id
            : prev.activePaintingId;
        return {
          ...prev,
          paintingsByRoom: {
            ...prev.paintingsByRoom,
            [roomId]: paintings,
          },
          activePaintingId: nextActivePaintingId,
        };
      });
    },
    [commitState]
  );

  const selectSize = useCallback(
    (sizeId: PrintSizeId) => {
      if (!(sizeId in PRINT_SIZES)) {
        return;
      }
      commitState((prev) => (prev.sizeId === sizeId ? prev : { ...prev, sizeId }));
    },
    [commitState]
  );

  const cycleSize = useCallback(
    (delta: number) => {
      commitState((prev) => {
        const idx = Math.max(0, PRINT_SIZE_ORDER.indexOf(prev.sizeId));
        const nextIdx =
          ((idx + delta) % PRINT_SIZE_ORDER.length + PRINT_SIZE_ORDER.length) %
          PRINT_SIZE_ORDER.length;
        return {
          ...prev,
          sizeId: PRINT_SIZE_ORDER[nextIdx],
        };
      });
    },
    [commitState]
  );

  const selectOrientation = useCallback(
    (orientation: OrientationMode) => {
      if (!VALID_ORIENTATIONS.includes(orientation)) {
        return;
      }
      commitState((prev) => (prev.orientation === orientation ? prev : { ...prev, orientation }));
    },
    [commitState]
  );

  const selectPanelLayout = useCallback(
    (panelLayout: PanelLayoutMode) => {
      if (!VALID_PANEL_LAYOUTS.includes(panelLayout)) {
        return;
      }
      commitState((prev) => (prev.panelLayout === panelLayout ? prev : { ...prev, panelLayout }));
    },
    [commitState]
  );

  const selectFrame = useCallback(
    (frameId: FrameProfileId) => {
      if (!(frameId in FRAME_PROFILES)) {
        return;
      }
      commitState((prev) => (prev.frameId === frameId ? prev : { ...prev, frameId }));
    },
    [commitState]
  );

  const cycleFrame = useCallback(() => {
    commitState((prev) => {
      const idx = Math.max(0, FRAME_PROFILE_ORDER.indexOf(prev.frameId));
      const nextIdx = (idx + 1) % FRAME_PROFILE_ORDER.length;
      return {
        ...prev,
        frameId: FRAME_PROFILE_ORDER[nextIdx],
      };
    });
  }, [commitState]);

  const selectMatWidth = useCallback(
    (matWidthId: MatWidthId) => {
      if (!(matWidthId in MAT_WIDTH_OPTIONS)) {
        return;
      }
      commitState((prev) => (prev.matWidthId === matWidthId ? prev : { ...prev, matWidthId }));
    },
    [commitState]
  );

  const selectMatColor = useCallback(
    (matColorId: MatColorId) => {
      if (!(matColorId in MAT_COLOR_OPTIONS)) {
        return;
      }
      commitState((prev) => (prev.matColorId === matColorId ? prev : { ...prev, matColorId }));
    },
    [commitState]
  );

  const selectSubstrate = useCallback(
    (substrateId: PrintSubstrateId) => {
      if (!(substrateId in PRINT_SUBSTRATES)) {
        return;
      }
      commitState((prev) => (prev.substrateId === substrateId ? prev : { ...prev, substrateId }));
    },
    [commitState]
  );

  const selectPartner = useCallback(
    (partnerId: PrintPartnerId) => {
      if (!(partnerId in PRINT_PARTNERS)) {
        return;
      }
      commitState((prev) => (prev.partnerId === partnerId ? prev : { ...prev, partnerId }));
    },
    [commitState]
  );

  const setStudioMarkupPercent = useCallback(
    (percent: number) => {
      const clamped = clampStudioMarkupPercent(percent);
      commitState((prev) =>
        prev.studioMarkupPercent === clamped ? prev : { ...prev, studioMarkupPercent: clamped }
      );
    },
    [commitState]
  );

  const setAmbientLightingMode = useCallback(
    (mode: AmbientLightingMode) => {
      if (!VALID_LIGHTING_MODES.includes(mode)) {
        return;
      }
      commitState((prev) =>
        prev.ambientLightingMode === mode ? prev : { ...prev, ambientLightingMode: mode }
      );
    },
    [commitState]
  );

  const updateWallPlacement = useCallback(
    (patch: Partial<WallPlacementState>) => {
      commitState((prev) => {
        const currentRoom = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
        const currentPlacement =
          prev.wallPlacementByRoom[currentRoom.id] ?? createDefaultWallPlacementForRoom(currentRoom);

        const nextPlacement: WallPlacementState = {
          ...currentPlacement,
          ...patch,
          centerX:
            typeof patch.centerX === 'number'
              ? Math.max(0.05, Math.min(0.95, patch.centerX))
              : currentPlacement.centerX,
          centerY:
            typeof patch.centerY === 'number'
              ? Math.max(0.05, Math.min(0.95, patch.centerY))
              : currentPlacement.centerY,
          wallWidthInches:
            typeof patch.wallWidthInches === 'number'
              ? Math.max(36, Math.min(360, patch.wallWidthInches))
              : currentPlacement.wallWidthInches,
          interPanelGapInches:
            typeof patch.interPanelGapInches === 'number'
              ? Math.max(0.5, Math.min(8, patch.interPanelGapInches))
              : currentPlacement.interPanelGapInches,
        };

        return {
          ...prev,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [currentRoom.id]: nextPlacement,
          },
        };
      });
    },
    [commitState]
  );

  const resetWallPlacement = useCallback(() => {
    commitState((prev) => {
      const currentRoom = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
      return {
        ...prev,
        wallPlacementByRoom: {
          ...prev.wallPlacementByRoom,
          [currentRoom.id]: createDefaultWallPlacementForRoom(currentRoom),
        },
      };
    });
  }, [commitState]);

  const toggleGuides = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      showDimensionGuides: !prev.showDimensionGuides,
    }), false);
  }, [commitState]);

  const setBeforeAfterSplit = useCallback(
    (split: number | null) => {
      commitState(
        (prev) => ({
          ...prev,
          beforeAfterSplit:
            split === null || Number.isNaN(split) ? null : Math.max(0, Math.min(1, split)),
        }),
        false
      );
    },
    [commitState]
  );

  const pinCurrentWallToLookbook = useCallback((): LookbookPin => {
    const current = stateRef.current;
    const derived = deriveActiveEntities(current);
    const newPin: LookbookPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pinnedAt: Date.now(),
      roomId: derived.activeRoom.id,
      painting: derived.activePainting,
      sizeId: current.sizeId,
      orientation: current.orientation,
      panelLayout: current.panelLayout,
      frameId: current.frameId,
      matWidthId: current.matWidthId,
      matColorId: current.matColorId,
      substrateId: current.substrateId,
      placement: derived.activePlacement,
      retailPriceUsd: derived.activePricing.physicalRetailTotalUsd,
    };

    commitState((prev) => ({
      ...prev,
      pinnedLookbook: [newPin, ...prev.pinnedLookbook],
    }));

    return newPin;
  }, [commitState]);

  const removeLookbookPin = useCallback(
    (pinId: string) => {
      commitState((prev) => ({
        ...prev,
        pinnedLookbook: prev.pinnedLookbook.filter((p) => p.id !== pinId),
      }));
    },
    [commitState]
  );

  const applyLookbookPin = useCallback(
    (pinId: string) => {
      commitState((prev) => {
        const pin = prev.pinnedLookbook.find((p) => p.id === pinId);
        if (!pin) {
          return prev;
        }
        const roomPaintings = prev.paintingsByRoom[pin.roomId] ?? [];
        const hasPainting = roomPaintings.some((p) => p.id === pin.painting.id);
        const updatedRoomPaintings = hasPainting
          ? roomPaintings
          : [pin.painting, ...roomPaintings];

        return {
          ...prev,
          activeRoomId: pin.roomId,
          paintingsByRoom: {
            ...prev.paintingsByRoom,
            [pin.roomId]: updatedRoomPaintings,
          },
          activePaintingId: pin.painting.id,
          harmonyMode: pin.painting.harmonyMode,
          sizeId: pin.sizeId,
          orientation: pin.orientation,
          panelLayout: pin.panelLayout,
          frameId: pin.frameId,
          matWidthId: pin.matWidthId,
          matColorId: pin.matColorId,
          substrateId: pin.substrateId,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [pin.roomId]: pin.placement,
          },
        };
      });
    },
    [commitState]
  );

  const clearLookbook = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      pinnedLookbook: [],
    }));
  }, [commitState]);

  const submitPartnerPrintOrder = useCallback(
    (
      shippingAddress: ShippingAddressInput
    ): { ok: boolean; order?: OrderRecord; validation: ShippingValidationResult } => {
      const validation = validateShippingAddress(shippingAddress);
      if (!validation.isValid) {
        return { ok: false, validation };
      }

      const current = stateRef.current;
      const derived = deriveActiveEntities(current);
      const orderId = `AV-ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const orderWithoutPayload: Omit<OrderRecord, 'partnerOrderPayloadJson'> = {
        id: orderId,
        createdAt: Date.now(),
        orderType: 'partner-printed-edition',
        roomId: derived.activeRoom.id,
        painting: derived.activePainting,
        sizeId: current.sizeId,
        orientation: current.orientation,
        panelLayout: current.panelLayout,
        frameId: current.frameId,
        matWidthId: current.matWidthId,
        matColorId: current.matColorId,
        substrateId: current.substrateId,
        pricing: derived.activePricing,
        shippingAddress: validation.sanitized,
        status: 'dispatched-to-partner',
      };

      const fullOrder: OrderRecord = {
        ...orderWithoutPayload,
        partnerOrderPayloadJson: generatePartnerOrderManifestJson(orderWithoutPayload),
      };

      commitState((prev) => ({
        ...prev,
        orders: [fullOrder, ...prev.orders],
      }));

      return {
        ok: true,
        order: fullOrder,
        validation,
      };
    },
    [commitState]
  );

  const recordDigitalDownloadOrder = useCallback(
    (exportResult?: Partial<HighResExportResult>): OrderRecord => {
      const current = stateRef.current;
      const derived = deriveActiveEntities(current);
      const orderId = `AV-DIG-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const orderWithoutPayload: Omit<OrderRecord, 'partnerOrderPayloadJson'> = {
        id: orderId,
        createdAt: Date.now(),
        orderType: 'digital-master-download',
        roomId: derived.activeRoom.id,
        painting: derived.activePainting,
        sizeId: current.sizeId,
        orientation: current.orientation,
        panelLayout: current.panelLayout,
        frameId: current.frameId,
        matWidthId: current.matWidthId,
        matColorId: current.matColorId,
        substrateId: current.substrateId,
        pricing: derived.activePricing,
        status: 'completed-download',
      };

      const partnerOrderPayloadJson =
        exportResult?.productionManifestJson && exportResult.productionManifestJson.trim().length > 0
          ? exportResult.productionManifestJson
          : generatePartnerOrderManifestJson(orderWithoutPayload);

      const fullOrder: OrderRecord = {
        ...orderWithoutPayload,
        partnerOrderPayloadJson,
      };

      commitState((prev) => ({
        ...prev,
        orders: [fullOrder, ...prev.orders],
      }));

      return fullOrder;
    },
    [commitState]
  );

  const recordCompletedOrder = useCallback(
    (
      orderInput: Omit<OrderRecord, 'id' | 'createdAt' | 'partnerOrderPayloadJson'> & {
        id?: string;
        createdAt?: number;
        partnerOrderPayloadJson?: string;
      }
    ): OrderRecord => {
      const orderId =
        orderInput.id ??
        `AV-ORD-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`;
      const createdAt = orderInput.createdAt ?? Date.now();

      const orderWithoutPayload: Omit<OrderRecord, 'partnerOrderPayloadJson'> = {
        ...orderInput,
        id: orderId,
        createdAt,
      };

      const fullOrder: OrderRecord = {
        ...orderWithoutPayload,
        partnerOrderPayloadJson:
          orderInput.partnerOrderPayloadJson ??
          generatePartnerOrderManifestJson(orderWithoutPayload),
      };

      commitState((prev) => ({
        ...prev,
        orders: [fullOrder, ...prev.orders],
      }));

      return fullOrder;
    },
    [commitState]
  );

  const clearOrders = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      orders: [],
    }));
  }, [commitState]);

  const openCheckoutModal = useCallback(
    (tab?: 'partner-printed-edition' | 'digital-master-download') => {
      commitState(
        (prev) => ({
          ...prev,
          isCheckoutModalOpen: true,
          activeCheckoutTab: tab ?? prev.activeCheckoutTab,
        }),
        false
      );
    },
    [commitState]
  );

  const closeCheckoutModal = useCallback(() => {
    commitState(
      (prev) => ({
        ...prev,
        isCheckoutModalOpen: false,
      }),
      false
    );
  }, [commitState]);

  const openLookbookDrawer = useCallback(
    (tab?: 'lookbook' | 'orders') => {
      commitState(
        (prev) => ({
          ...prev,
          isLookbookDrawerOpen: true,
          activeDrawerTab: tab ?? prev.activeDrawerTab,
        }),
        false
      );
    },
    [commitState]
  );

  const closeLookbookDrawer = useCallback(() => {
    commitState(
      (prev) => ({
        ...prev,
        isLookbookDrawerOpen: false,
      }),
      false
    );
  }, [commitState]);

  const openCameraModal = useCallback(() => {
    commitState(
      (prev) => ({
        ...prev,
        isCameraModalOpen: true,
      }),
      false
    );
  }, [commitState]);

  const closeCameraModal = useCallback(() => {
    commitState(
      (prev) => ({
        ...prev,
        isCameraModalOpen: false,
      }),
      false
    );
  }, [commitState]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) {
      return;
    }
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [stateRef.current, ...futureRef.current.slice(0, MAX_HISTORY_STEPS - 1)];
    stateRef.current = previous;
    setState(previous);
    savePersistedAtelierState(previous);
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) {
      return;
    }
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY_STEPS - 1)), stateRef.current];
    stateRef.current = next;
    setState(next);
    savePersistedAtelierState(next);
    setHistoryTick((t) => t + 1);
  }, []);

  const resetStudioToDefaults = useCallback(() => {
    const fresh = createInitialAtelierState({
      initialRooms,
      generatePaintingsFn: generatePaintingsRef.current,
    });
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY_STEPS - 1)), stateRef.current];
    futureRef.current = [];
    stateRef.current = fresh;
    setState(fresh);
    savePersistedAtelierState(fresh);
    setHistoryTick((t) => t + 1);
  }, [initialRooms]);

  const derived = useMemo(() => deriveActiveEntities(state), [state]);

  const storeValue: AtelierStoreValue = useMemo(
    () => ({
      ...state,
      ...derived,
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
      selectRoom,
      addCustomRoom,
      setRoomsAndPaintings,
      selectPainting,
      cyclePainting,
      setHarmonyMode,
      regeneratePaintingsBatch,
      setPaintingsForRoom,
      selectSize,
      cycleSize,
      selectOrientation,
      selectPanelLayout,
      selectFrame,
      cycleFrame,
      selectMatWidth,
      selectMatColor,
      selectSubstrate,
      selectPartner,
      setStudioMarkupPercent,
      setAmbientLightingMode,
      updateWallPlacement,
      resetWallPlacement,
      toggleGuides,
      setBeforeAfterSplit,
      pinCurrentWallToLookbook,
      removeLookbookPin,
      applyLookbookPin,
      clearLookbook,
      submitPartnerPrintOrder,
      recordDigitalDownloadOrder,
      recordCompletedOrder,
      clearOrders,
      openCheckoutModal,
      closeCheckoutModal,
      openLookbookDrawer,
      closeLookbookDrawer,
      openCameraModal,
      closeCameraModal,
      undo,
      redo,
      resetStudioToDefaults,
    }),
    [
      state,
      derived,
      selectRoom,
      addCustomRoom,
      setRoomsAndPaintings,
      selectPainting,
      cyclePainting,
      setHarmonyMode,
      regeneratePaintingsBatch,
      setPaintingsForRoom,
      selectSize,
      cycleSize,
      selectOrientation,
      selectPanelLayout,
      selectFrame,
      cycleFrame,
      selectMatWidth,
      selectMatColor,
      selectSubstrate,
      selectPartner,
      setStudioMarkupPercent,
      setAmbientLightingMode,
      updateWallPlacement,
      resetWallPlacement,
      toggleGuides,
      setBeforeAfterSplit,
      pinCurrentWallToLookbook,
      removeLookbookPin,
      applyLookbookPin,
      clearLookbook,
      submitPartnerPrintOrder,
      recordDigitalDownloadOrder,
      recordCompletedOrder,
      clearOrders,
      openCheckoutModal,
      closeCheckoutModal,
      openLookbookDrawer,
      closeLookbookDrawer,
      openCameraModal,
      closeCameraModal,
      undo,
      redo,
      resetStudioToDefaults,
    ]
  );

  return React.createElement(AtelierStoreContext.Provider, { value: storeValue }, children);
}

// ---------------------------------------------------------------------------
// 5. Standalone Fallback Store (for isolated component tests outside Provider)
// ---------------------------------------------------------------------------

let fallbackStateSingleton: AtelierState | null = null;
const fallbackListeners = new Set<() => void>();

function getFallbackState(): AtelierState {
  if (!fallbackStateSingleton) {
    fallbackStateSingleton = loadPersistedAtelierState(createInitialAtelierState());
  }
  return fallbackStateSingleton;
}

function updateFallbackState(updater: (prev: AtelierState) => AtelierState): void {
  const prev = getFallbackState();
  const next = updater(prev);
  fallbackStateSingleton = next;
  savePersistedAtelierState(next);
  fallbackListeners.forEach((listener) => listener());
}

function buildFallbackStoreValue(): AtelierStoreValue {
  const current = getFallbackState();
  const derived = deriveActiveEntities(current);

  return {
    ...current,
    ...derived,
    canUndo: false,
    canRedo: false,
    selectRoom: (roomId) =>
      updateFallbackState((prev) => {
        const target = prev.rooms.find((r) => r.id === roomId);
        if (!target) return prev;
        const paintings =
          prev.paintingsByRoom[target.id] ?? createDefaultPaintingsForRoom(target);
        return {
          ...prev,
          activeRoomId: target.id,
          activePaintingId: paintings[0]?.id ?? prev.activePaintingId,
          harmonyMode: target.analysis.recommendedHarmony,
        };
      }),
    addCustomRoom: (room, paintings) =>
      updateFallbackState((prev) => {
        const roomPaintings = paintings ?? createDefaultPaintingsForRoom(room);
        return {
          ...prev,
          rooms: [...prev.rooms.filter((r) => r.id !== room.id), room],
          activeRoomId: room.id,
          paintingsByRoom: { ...prev.paintingsByRoom, [room.id]: roomPaintings },
          activePaintingId: roomPaintings[0]?.id ?? prev.activePaintingId,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [room.id]: createDefaultWallPlacementForRoom(room),
          },
          isCameraModalOpen: false,
        };
      }),
    setRoomsAndPaintings: (rooms, paintingsByRoom) =>
      updateFallbackState((prev) => ({
        ...prev,
        rooms,
        paintingsByRoom: paintingsByRoom ?? prev.paintingsByRoom,
      })),
    selectPainting: (paintingId) =>
      updateFallbackState((prev) => ({ ...prev, activePaintingId: paintingId })),
    cyclePainting: (delta) =>
      updateFallbackState((prev) => {
        const list = prev.paintingsByRoom[prev.activeRoomId] ?? [];
        if (list.length === 0) return prev;
        const idx = Math.max(
          0,
          list.findIndex((p) => p.id === prev.activePaintingId)
        );
        const nextIdx = ((idx + delta) % list.length + list.length) % list.length;
        return { ...prev, activePaintingId: list[nextIdx].id };
      }),
    setHarmonyMode: (mode) =>
      updateFallbackState((prev) => {
        const room = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
        const regenerated = createDefaultPaintingsForRoom(room, mode, prev.seedOffset);
        return {
          ...prev,
          harmonyMode: mode,
          paintingsByRoom: { ...prev.paintingsByRoom, [room.id]: regenerated },
          activePaintingId: regenerated[0]?.id ?? prev.activePaintingId,
        };
      }),
    regeneratePaintingsBatch: () =>
      updateFallbackState((prev) => {
        const nextSeed = prev.seedOffset + 1;
        const room = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
        const regenerated = createDefaultPaintingsForRoom(room, prev.harmonyMode, nextSeed);
        return {
          ...prev,
          seedOffset: nextSeed,
          paintingsByRoom: { ...prev.paintingsByRoom, [room.id]: regenerated },
          activePaintingId: regenerated[0]?.id ?? prev.activePaintingId,
        };
      }),
    setPaintingsForRoom: (roomId, paintings) =>
      updateFallbackState((prev) => ({
        ...prev,
        paintingsByRoom: { ...prev.paintingsByRoom, [roomId]: paintings },
      })),
    selectSize: (sizeId) => updateFallbackState((prev) => ({ ...prev, sizeId })),
    cycleSize: (delta) =>
      updateFallbackState((prev) => {
        const idx = Math.max(0, PRINT_SIZE_ORDER.indexOf(prev.sizeId));
        const nextIdx =
          ((idx + delta) % PRINT_SIZE_ORDER.length + PRINT_SIZE_ORDER.length) %
          PRINT_SIZE_ORDER.length;
        return { ...prev, sizeId: PRINT_SIZE_ORDER[nextIdx] };
      }),
    selectOrientation: (orientation) =>
      updateFallbackState((prev) => ({ ...prev, orientation })),
    selectPanelLayout: (panelLayout) =>
      updateFallbackState((prev) => ({ ...prev, panelLayout })),
    selectFrame: (frameId) => updateFallbackState((prev) => ({ ...prev, frameId })),
    cycleFrame: () =>
      updateFallbackState((prev) => {
        const idx = Math.max(0, FRAME_PROFILE_ORDER.indexOf(prev.frameId));
        return {
          ...prev,
          frameId: FRAME_PROFILE_ORDER[(idx + 1) % FRAME_PROFILE_ORDER.length],
        };
      }),
    selectMatWidth: (matWidthId) => updateFallbackState((prev) => ({ ...prev, matWidthId })),
    selectMatColor: (matColorId) => updateFallbackState((prev) => ({ ...prev, matColorId })),
    selectSubstrate: (substrateId) => updateFallbackState((prev) => ({ ...prev, substrateId })),
    selectPartner: (partnerId) => updateFallbackState((prev) => ({ ...prev, partnerId })),
    setStudioMarkupPercent: (percent) =>
      updateFallbackState((prev) => ({
        ...prev,
        studioMarkupPercent: clampStudioMarkupPercent(percent),
      })),
    setAmbientLightingMode: (mode) =>
      updateFallbackState((prev) => ({ ...prev, ambientLightingMode: mode })),
    updateWallPlacement: (patch) =>
      updateFallbackState((prev) => {
        const currentPlacement =
          prev.wallPlacementByRoom[prev.activeRoomId] ??
          createDefaultWallPlacementForRoom(prev.rooms[0]);
        return {
          ...prev,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [prev.activeRoomId]: { ...currentPlacement, ...patch },
          },
        };
      }),
    resetWallPlacement: () =>
      updateFallbackState((prev) => {
        const room = prev.rooms.find((r) => r.id === prev.activeRoomId) ?? prev.rooms[0];
        return {
          ...prev,
          wallPlacementByRoom: {
            ...prev.wallPlacementByRoom,
            [room.id]: createDefaultWallPlacementForRoom(room),
          },
        };
      }),
    toggleGuides: () =>
      updateFallbackState((prev) => ({
        ...prev,
        showDimensionGuides: !prev.showDimensionGuides,
      })),
    setBeforeAfterSplit: (split) =>
      updateFallbackState((prev) => ({ ...prev, beforeAfterSplit: split })),
    pinCurrentWallToLookbook: () => {
      const pin: LookbookPin = {
        id: `pin-${Date.now()}`,
        pinnedAt: Date.now(),
        roomId: derived.activeRoom.id,
        painting: derived.activePainting,
        sizeId: current.sizeId,
        orientation: current.orientation,
        panelLayout: current.panelLayout,
        frameId: current.frameId,
        matWidthId: current.matWidthId,
        matColorId: current.matColorId,
        substrateId: current.substrateId,
        placement: derived.activePlacement,
        retailPriceUsd: derived.activePricing.physicalRetailTotalUsd,
      };
      updateFallbackState((prev) => ({
        ...prev,
        pinnedLookbook: [pin, ...prev.pinnedLookbook],
      }));
      return pin;
    },
    removeLookbookPin: (pinId) =>
      updateFallbackState((prev) => ({
        ...prev,
        pinnedLookbook: prev.pinnedLookbook.filter((p) => p.id !== pinId),
      })),
    applyLookbookPin: (pinId) =>
      updateFallbackState((prev) => {
        const pin = prev.pinnedLookbook.find((p) => p.id === pinId);
        if (!pin) return prev;
        return {
          ...prev,
          activeRoomId: pin.roomId,
          activePaintingId: pin.painting.id,
          sizeId: pin.sizeId,
          orientation: pin.orientation,
          panelLayout: pin.panelLayout,
          frameId: pin.frameId,
          matWidthId: pin.matWidthId,
          matColorId: pin.matColorId,
          substrateId: pin.substrateId,
        };
      }),
    clearLookbook: () => updateFallbackState((prev) => ({ ...prev, pinnedLookbook: [] })),
    submitPartnerPrintOrder: (shippingAddress) => {
      const validation = validateShippingAddress(shippingAddress);
      if (!validation.isValid) {
        return { ok: false, validation };
      }
      const orderWithoutPayload: Omit<OrderRecord, 'partnerOrderPayloadJson'> = {
        id: `AV-ORD-${Date.now()}`,
        createdAt: Date.now(),
        orderType: 'partner-printed-edition',
        roomId: derived.activeRoom.id,
        painting: derived.activePainting,
        sizeId: current.sizeId,
        orientation: current.orientation,
        panelLayout: current.panelLayout,
        frameId: current.frameId,
        matWidthId: current.matWidthId,
        matColorId: current.matColorId,
        substrateId: current.substrateId,
        pricing: derived.activePricing,
        shippingAddress: validation.sanitized,
        status: 'dispatched-to-partner',
      };
      const order: OrderRecord = {
        ...orderWithoutPayload,
        partnerOrderPayloadJson: generatePartnerOrderManifestJson(orderWithoutPayload),
      };
      updateFallbackState((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
      return { ok: true, order, validation };
    },
    recordDigitalDownloadOrder: (exportResult) => {
      const orderWithoutPayload: Omit<OrderRecord, 'partnerOrderPayloadJson'> = {
        id: `AV-DIG-${Date.now()}`,
        createdAt: Date.now(),
        orderType: 'digital-master-download',
        roomId: derived.activeRoom.id,
        painting: derived.activePainting,
        sizeId: current.sizeId,
        orientation: current.orientation,
        panelLayout: current.panelLayout,
        frameId: current.frameId,
        matWidthId: current.matWidthId,
        matColorId: current.matColorId,
        substrateId: current.substrateId,
        pricing: derived.activePricing,
        status: 'completed-download',
      };
      const order: OrderRecord = {
        ...orderWithoutPayload,
        partnerOrderPayloadJson:
          exportResult?.productionManifestJson ??
          generatePartnerOrderManifestJson(orderWithoutPayload),
      };
      updateFallbackState((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
      return order;
    },
    recordCompletedOrder: (orderInput) => {
      const orderWithoutPayload: Omit<OrderRecord, 'partnerOrderPayloadJson'> = {
        ...orderInput,
        id: orderInput.id ?? `AV-ORD-${Date.now()}`,
        createdAt: orderInput.createdAt ?? Date.now(),
      };
      const order: OrderRecord = {
        ...orderWithoutPayload,
        partnerOrderPayloadJson:
          orderInput.partnerOrderPayloadJson ??
          generatePartnerOrderManifestJson(orderWithoutPayload),
      };
      updateFallbackState((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
      return order;
    },
    clearOrders: () => updateFallbackState((prev) => ({ ...prev, orders: [] })),
    openCheckoutModal: (tab) =>
      updateFallbackState((prev) => ({
        ...prev,
        isCheckoutModalOpen: true,
        activeCheckoutTab: tab ?? prev.activeCheckoutTab,
      })),
    closeCheckoutModal: () =>
      updateFallbackState((prev) => ({ ...prev, isCheckoutModalOpen: false })),
    openLookbookDrawer: (tab) =>
      updateFallbackState((prev) => ({
        ...prev,
        isLookbookDrawerOpen: true,
        activeDrawerTab: tab ?? prev.activeDrawerTab,
      })),
    closeLookbookDrawer: () =>
      updateFallbackState((prev) => ({ ...prev, isLookbookDrawerOpen: false })),
    openCameraModal: () =>
      updateFallbackState((prev) => ({ ...prev, isCameraModalOpen: true })),
    closeCameraModal: () =>
      updateFallbackState((prev) => ({ ...prev, isCameraModalOpen: false })),
    undo: () => undefined,
    redo: () => undefined,
    resetStudioToDefaults: () =>
      updateFallbackState(() => createInitialAtelierState()),
  };
}

export function useAtelierStore(): AtelierStoreValue {
  const context = useContext(AtelierStoreContext);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (context) {
      return;
    }
    const listener = () => setTick((t) => t + 1);
    fallbackListeners.add(listener);
    return () => {
      fallbackListeners.delete(listener);
    };
  }, [context]);

  if (context) {
    return context;
  }

  return buildFallbackStoreValue();
}
