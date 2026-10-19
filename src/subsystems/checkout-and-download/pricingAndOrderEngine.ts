// src/subsystems/checkout-and-download/pricingAndOrderEngine.ts
// V2 Subsystem 4 (Leaf 4A) — Partner Print Quote Engine, Bleed Dimension & Canvas Compositor,
// Ephemeral Off-DOM File Download Trigger, Shipping Validator & Quota-Safe LocalStorage Persistence

import {
  FRAME_PROFILES,
  FrameProfileId,
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
  ReimaginedRoomVariation,
} from '../../contracts/masterContract';

export const V2_STORAGE_KEY = 'atelier_vue_v2_state';
export const DEFAULT_STUDIO_MARKUP_PERCENT = 18;
export const MIN_STUDIO_MARKUP_PERCENT = 10;
export const MAX_STUDIO_MARKUP_PERCENT = 35;
export const DIGITAL_MASTER_LICENSE_USD = 29.0;

export interface PrintSubstrateSpec {
  id: PrintSubstrateId;
  name: string;
  shortName: string;
  shortLabel: string;
  description: string;
  gsmOrThickness: string;
  priceMultiplier: number;
  finishLabel: string;
}

export const PRINT_SUBSTRATES: Record<PrintSubstrateId, PrintSubstrateSpec> = {
  'hahnemuhle-etching-310gsm': {
    id: 'hahnemuhle-etching-310gsm',
    name: '310gsm Hahnemühle German Etching',
    shortName: '310gsm Etching Paper',
    shortLabel: 'Hahnemühle 310gsm',
    description: '100% alpha-cellulose mould-made archival fine art paper with velvety tactile tooth.',
    gsmOrThickness: '310 gsm',
    priceMultiplier: 1.0,
    finishLabel: 'Museum Matte Velvet',
  },
  'archival-cotton-canvas-400gsm': {
    id: 'archival-cotton-canvas-400gsm',
    name: '400gsm Archival Cotton Canvas',
    shortName: '400gsm Cotton Canvas',
    shortLabel: 'Cotton Canvas 400gsm',
    description: 'Heavyweight poly-cotton museum weave sealed with UV-protective satin archival varnish.',
    gsmOrThickness: '400 gsm',
    priceMultiplier: 1.18,
    finishLabel: 'Woven Archival Satin',
  },
  'museum-matte-acrylic': {
    id: 'museum-matte-acrylic',
    name: 'Museum Anti-Reflective Matte Acrylic',
    shortName: 'Museum Matte Acrylic',
    shortLabel: 'Museum Acrylic',
    description: 'Optical-grade 3mm anti-glare acrylic face-mounted over rigid Dibond aluminum backing.',
    gsmOrThickness: '3.0 mm Optical',
    priceMultiplier: 1.35,
    finishLabel: 'Zero-Glare Gallery Acrylic',
  },
};

export interface MatWidthOptionSpec {
  id: MatWidthId;
  label: string;
  inches: number;
  baseCostPerPanelUsd: number;
  description: string;
}

export const MAT_WIDTH_OPTIONS: Record<MatWidthId, MatWidthOptionSpec> = {
  none: {
    id: 'none',
    label: 'No Mat (Full Bleed)',
    inches: 0,
    baseCostPerPanelUsd: 0,
    description: 'Artwork framed edge-to-edge or float-mounted without matboard.',
  },
  '1.5in': {
    id: '1.5in',
    label: '1.5" Gallery Border',
    inches: 1.5,
    baseCostPerPanelUsd: 14.0,
    description: 'Subtle conservation border with 45° bevel cut.',
  },
  '2.5in': {
    id: '2.5in',
    label: '2.5" Museum Standard',
    inches: 2.5,
    baseCostPerPanelUsd: 22.0,
    description: 'Classic museum-proportioned 8-ply cotton rag matboard.',
  },
  '3.5in': {
    id: '3.5in',
    label: '3.5" Exhibition Wide',
    inches: 3.5,
    baseCostPerPanelUsd: 30.0,
    description: 'Dramatic architectural breathing room for collector editions.',
  },
};

export interface MatColorOptionSpec {
  id: MatColorId;
  name: string;
  hex: string;
  bevelHex: string;
  description: string;
}

export const MAT_COLOR_OPTIONS: Record<MatColorId, MatColorOptionSpec> = {
  'archival-ivory': {
    id: 'archival-ivory',
    name: 'Archival Ivory',
    hex: '#F6F3EC',
    bevelHex: '#FDFBF7',
    description: 'Warm acid-free cotton rag ivory',
  },
  'warm-museum-linen': {
    id: 'warm-museum-linen',
    name: 'Warm Museum Linen',
    hex: '#EAE3D5',
    bevelHex: '#F7F4EC',
    description: 'Unbleached natural oatmeal linen core',
  },
  'charcoal-conservation': {
    id: 'charcoal-conservation',
    name: 'Charcoal Conservation',
    hex: '#282624',
    bevelHex: '#E8E3D9',
    description: 'Deep carbon gallery mat with cream core bevel',
  },
};

export interface ComputePartnerPrintQuoteParams {
  partnerId: PrintPartnerId;
  sizeId: PrintSizeId;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  substrateId?: PrintSubstrateId;
  panelLayout?: PanelLayoutMode;
  studioMarkupPercent?: number;
}

export interface ShippingAddressData {
  fullName: string;
  email: string;
  streetAddress: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
}

export type ShippingAddressInput = ShippingAddressData;

export const SAMPLE_SHIPPING_ADDRESS: ShippingAddressData = {
  fullName: 'Clara Vance',
  email: 'clara.vance@atelier-collector.org',
  streetAddress: '428 Mercer Street, Penthouse B',
  city: 'New York',
  stateOrProvince: 'NY',
  postalCode: '10013',
  country: 'United States',
};

export const EMPTY_SHIPPING_ADDRESS: ShippingAddressData = {
  fullName: '',
  email: '',
  streetAddress: '',
  city: '',
  stateOrProvince: '',
  postalCode: '',
  country: 'United States',
};

export interface ShippingValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof ShippingAddressData, string>>;
  sanitized: ShippingAddressData;
}

export interface V2OrderConfirmation {
  id: string;
  createdAt: number;
  orderType: 'digital-master-download' | 'partner-printed-edition';
  variationId: string;
  artworkTitle: string;
  sizeId: PrintSizeId;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
  substrateId: PrintSubstrateId;
  orientation: OrientationMode;
  includePrintBleed: boolean;
  printMasterWidthPx: number;
  printMasterHeightPx: number;
  pricing: PricingBreakdown;
  shippingAddress?: ShippingAddressData;
  partnerOrderManifestJson: string;
  status: 'completed-download' | 'dispatched-to-partner';
}

export interface AtelierV2PersistedState {
  version: 2;
  preferredPartnerId: PrintPartnerId;
  preferredMarkupPercent: number;
  preferredSizeId: PrintSizeId;
  preferredFrameId: FrameProfileId;
  preferredMatWidthId: MatWidthId;
  preferredSubstrateId: PrintSubstrateId;
  includePrintBleed: boolean;
  orders: V2OrderConfirmation[];
  downloadsCount: number;
  savedVariationsMeta: Array<{
    id: string;
    createdAt: number;
    artworkTitle: string;
    engineId: string;
    printMasterWidthPx: number;
    printMasterHeightPx: number;
  }>;
  lastUpdatedAt: number;
}

/**
 * Deterministic cent rounding avoiding IEEE-754 representation drift.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Clamps the slight studio curation markup percentage to [10%, 35%],
 * defaulting undefined/NaN to 18%.
 */
export function clampStudioMarkupPercent(markupPercent?: number): number {
  if (
    markupPercent === undefined ||
    markupPercent === null ||
    Number.isNaN(markupPercent) ||
    !Number.isFinite(markupPercent)
  ) {
    return DEFAULT_STUDIO_MARKUP_PERCENT;
  }
  return Math.min(MAX_STUDIO_MARKUP_PERCENT, Math.max(MIN_STUDIO_MARKUP_PERCENT, markupPercent));
}

/**
 * Computes transparent print-on-demand partner wholesale cost + slight studio premium + insured shipping
 * with strict cent-level ledger invariants:
 * - partnerWholesaleSubtotalUsd === roundCents(partnerBasePrintCostUsd + partnerFrameAndMatCostUsd)
 * - studioMarkupDollarUsd === roundCents(partnerWholesaleSubtotalUsd * (studioMarkupPercent / 100))
 * - physicalRetailTotalUsd === roundCents(partnerWholesaleSubtotalUsd + studioMarkupDollarUsd + insuredShippingUsd)
 */
export function computePartnerPrintQuote(params: ComputePartnerPrintQuoteParams): PricingBreakdown {
  const partner = PRINT_PARTNERS[params.partnerId] ?? PRINT_PARTNERS.prodigi;
  const size = PRINT_SIZES[params.sizeId] ?? PRINT_SIZES['24x36'];
  const frame = FRAME_PROFILES[params.frameId] ?? FRAME_PROFILES['natural-white-oak'];
  const substrate =
    PRINT_SUBSTRATES[params.substrateId ?? 'hahnemuhle-etching-310gsm'] ??
    PRINT_SUBSTRATES['hahnemuhle-etching-310gsm'];
  const matOption = MAT_WIDTH_OPTIONS[params.matWidthId] ?? MAT_WIDTH_OPTIONS['2.5in'];

  const normalizedPanelLayout: PanelLayoutMode =
    params.panelLayout === 'triptych'
      ? 'triptych'
      : params.panelLayout === 'diptych'
      ? 'diptych'
      : 'single';
  const panelCount =
    normalizedPanelLayout === 'triptych' ? 3 : normalizedPanelLayout === 'diptych' ? 2 : 1;

  const sqInches = size.widthInches * size.heightInches;
  const panelPrintFactor = 1 + (panelCount - 1) * 0.08;

  const partnerBasePrintCostUsd = roundCents(
    partner.baseRatePerSqInch * sqInches * substrate.priceMultiplier * panelPrintFactor
  );

  const perimeterInches = 2 * (size.widthInches + size.heightInches);
  const frameMouldingCost =
    frame.id === 'unframed-canvas'
      ? roundCents(perimeterInches * 0.24 * panelCount)
      : roundCents(perimeterInches * 0.82 * frame.priceMultiplier * (1 + (panelCount - 1) * 0.65));

  const matCost = roundCents(matOption.baseCostPerPanelUsd * panelCount);
  const partnerFrameAndMatCostUsd = roundCents(frameMouldingCost + matCost);

  const partnerWholesaleSubtotalUsd = roundCents(
    partnerBasePrintCostUsd + partnerFrameAndMatCostUsd
  );

  const studioMarkupPercent = clampStudioMarkupPercent(params.studioMarkupPercent);
  const studioMarkupDollarUsd = roundCents(
    partnerWholesaleSubtotalUsd * (studioMarkupPercent / 100)
  );

  const insuredShippingUsd = roundCents(
    partner.shippingFlatRateUsd + (size.widthInches >= 30 ? 8.5 : 0) + (panelCount - 1) * 4.5
  );

  const physicalRetailTotalUsd = roundCents(
    partnerWholesaleSubtotalUsd + studioMarkupDollarUsd + insuredShippingUsd
  );

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    partnerWebsite: partner.websiteDomain,
    sizeId: size.id,
    frameId: frame.id,
    matWidthId: matOption.id,
    substrateId: substrate.id,
    panelLayout: normalizedPanelLayout,
    panelCount,
    partnerBasePrintCostUsd,
    partnerFrameAndMatCostUsd,
    partnerWholesaleSubtotalUsd,
    studioMarkupPercent,
    studioMarkupDollarUsd,
    insuredShippingUsd,
    physicalRetailTotalUsd,
    digitalMasterLicenseUsd: DIGITAL_MASTER_LICENSE_USD,
  };
}

export const calculatePrintPricing: typeof computePartnerPrintQuote = computePartnerPrintQuote;

/**
 * Compares the exact physical & wholesale quotes across all 3 archival print partners
 * (Prodigi Fine Art Guild, Printful Museum Line, FinerWorks Archival Lab).
 */
export function compareAllPartnerQuotes(
  params: Omit<ComputePartnerPrintQuoteParams, 'partnerId'>
): Record<PrintPartnerId, PricingBreakdown> {
  return {
    prodigi: computePartnerPrintQuote({ ...params, partnerId: 'prodigi' }),
    printful: computePartnerPrintQuote({ ...params, partnerId: 'printful' }),
    finerworks: computePartnerPrintQuote({ ...params, partnerId: 'finerworks' }),
  };
}

export const compareAllPartnersPricing: typeof compareAllPartnerQuotes = compareAllPartnerQuotes;

/**
 * Computes exact trim inches, total inches (adding +0.25" per side = +0.50" total width and height
 * when includePrintBleed is true), and exact pixel dimensions at 300 DPI.
 */
export function computePrintDimensionsWithBleed(
  sizeId: PrintSizeId,
  includePrintBleed: boolean,
  orientation: OrientationMode = 'portrait'
): {
  trimWidthInches: number;
  trimHeightInches: number;
  totalWidthInches: number;
  totalHeightInches: number;
  widthPx: number;
  heightPx: number;
  dpi: number;
  bleedInches: number;
} {
  const size = PRINT_SIZES[sizeId] ?? PRINT_SIZES['24x36'];
  const dpi = size.dpi || 300;

  let trimWidthInches = size.widthInches;
  let trimHeightInches = size.heightInches;
  let baseWidthPx = size.printMasterWidthPx;
  let baseHeightPx = size.printMasterHeightPx;

  if (orientation === 'landscape') {
    trimWidthInches = Math.max(size.widthInches, size.heightInches);
    trimHeightInches = Math.min(size.widthInches, size.heightInches);
    baseWidthPx = Math.max(size.printMasterWidthPx, size.printMasterHeightPx);
    baseHeightPx = Math.min(size.printMasterWidthPx, size.printMasterHeightPx);
  } else if (orientation === 'square') {
    trimWidthInches = Math.min(size.widthInches, size.heightInches);
    trimHeightInches = Math.min(size.widthInches, size.heightInches);
    baseWidthPx = Math.min(size.printMasterWidthPx, size.printMasterHeightPx);
    baseHeightPx = Math.min(size.printMasterWidthPx, size.printMasterHeightPx);
  }

  const bleedInches = includePrintBleed ? 0.25 : 0;
  const totalWidthInches = roundCents(trimWidthInches + bleedInches * 2);
  const totalHeightInches = roundCents(trimHeightInches + bleedInches * 2);

  const extraBleedPx = includePrintBleed ? Math.round(bleedInches * 2 * dpi) : 0; // +150px at 300 DPI
  const widthPx = baseWidthPx + extraBleedPx;
  const heightPx = baseHeightPx + extraBleedPx;

  return {
    trimWidthInches,
    trimHeightInches,
    totalWidthInches,
    totalHeightInches,
    widthPx,
    heightPx,
    dpi,
    bleedInches,
  };
}

/**
 * Generates a print-ready high-resolution data URL, adding +0.25" archival bleed border
 * and precision corner crop marks when includePrintBleed is true (with safe fallback in jsdom).
 */
export async function renderPrintMasterWithBleedDataUrl(
  sourceDataUrl: string,
  options: {
    widthPx: number;
    heightPx: number;
    includePrintBleed: boolean;
    title?: string;
  }
): Promise<string> {
  const widthPx = Math.max(300, Math.round(options.widthPx || 2400));
  const heightPx = Math.max(300, Math.round(options.heightPx || 3600));
  const safeTitle = (options.title || 'Atelier Vue Archival Print Master').replace(/[<>"'&]/g, '');

  const buildArchivalSvgDataUrl = (): string => {
    const bleedMarginPx = options.includePrintBleed ? 75 : 0;
    const innerWidth = Math.max(100, widthPx - bleedMarginPx * 2);
    const innerHeight = Math.max(100, heightPx - bleedMarginPx * 2);
    const cropMarksMarkup = options.includePrintBleed
      ? `<g id="archival-crop-marks" stroke="#141413" stroke-width="2" opacity="0.85">
          <line x1="18" y1="${bleedMarginPx}" x2="${bleedMarginPx - 12}" y2="${bleedMarginPx}" />
          <line x1="${bleedMarginPx}" y1="18" x2="${bleedMarginPx}" y2="${bleedMarginPx - 12}" />
          <line x1="${widthPx - bleedMarginPx + 12}" y1="${bleedMarginPx}" x2="${widthPx - 18}" y2="${bleedMarginPx}" />
          <line x1="${widthPx - bleedMarginPx}" y1="18" x2="${widthPx - bleedMarginPx}" y2="${bleedMarginPx - 12}" />
          <line x1="18" y1="${heightPx - bleedMarginPx}" x2="${bleedMarginPx - 12}" y2="${heightPx - bleedMarginPx}" />
          <line x1="${bleedMarginPx}" y1="${heightPx - bleedMarginPx + 12}" x2="${bleedMarginPx}" y2="${heightPx - 18}" />
          <line x1="${widthPx - bleedMarginPx + 12}" y1="${heightPx - bleedMarginPx}" x2="${widthPx - 18}" y2="${heightPx - bleedMarginPx}" />
          <line x1="${widthPx - bleedMarginPx}" y1="${heightPx - bleedMarginPx + 12}" x2="${widthPx - bleedMarginPx}" y2="${heightPx - 18}" />
        </g>`
      : '';

    const embeddedHref =
      sourceDataUrl && sourceDataUrl.startsWith('data:image/')
        ? sourceDataUrl
        : '';

    const imageElement = embeddedHref
      ? `<image x="${bleedMarginPx}" y="${bleedMarginPx}" width="${innerWidth}" height="${innerHeight}" preserveAspectRatio="xMidYMid slice" href="${embeddedHref.replace(/"/g, '&quot;')}" />`
      : `<rect x="${bleedMarginPx}" y="${bleedMarginPx}" width="${innerWidth}" height="${innerHeight}" fill="#C89D7C" />`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}" data-bleed="${options.includePrintBleed ? '0.25in' : 'none'}" data-dpi="300" data-title="${safeTitle}">
      <rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#FAF8F5" />
      ${imageElement}
      ${cropMarksMarkup}
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  if (!options.includePrintBleed && sourceDataUrl && sourceDataUrl.startsWith('data:image/')) {
    return sourceDataUrl;
  }

  const isJsdom =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  if (isJsdom || typeof document === 'undefined') {
    return buildArchivalSvgDataUrl();
  }

  try {
    const canvas = document.createElement('canvas');
    // Use a scaled render buffer to keep memory fast while encoding exact metadata
    const maxRenderDim = 1600;
    const scale = Math.min(1, maxRenderDim / Math.max(widthPx, heightPx));
    canvas.width = Math.max(200, Math.round(widthPx * scale));
    canvas.height = Math.max(200, Math.round(heightPx * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return buildArchivalSvgDataUrl();
    }

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bleedPx = options.includePrintBleed ? Math.round(75 * scale) : 0;
    const innerW = canvas.width - bleedPx * 2;
    const innerH = canvas.height - bleedPx * 2;

    if (sourceDataUrl && sourceDataUrl.startsWith('data:image/')) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => resolve(), 60);
        img.onload = () => {
          clearTimeout(timer);
          try {
            ctx.drawImage(img, bleedPx, bleedPx, innerW, innerH);
          } catch {
            // Fallback fill if taint or decode error
          }
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve();
        };
        img.src = sourceDataUrl;
      });
    } else {
      ctx.fillStyle = '#C89D7C';
      ctx.fillRect(bleedPx, bleedPx, innerW, innerH);
    }

    if (options.includePrintBleed && bleedPx >= 6) {
      ctx.strokeStyle = '#141413';
      ctx.lineWidth = Math.max(1, Math.round(2 * scale));
      const pad = Math.max(2, Math.round(12 * scale));
      const tickEnd = Math.max(pad + 2, bleedPx - Math.round(6 * scale));

      ctx.beginPath();
      // Top-left crop mark
      ctx.moveTo(pad, bleedPx);
      ctx.lineTo(tickEnd, bleedPx);
      ctx.moveTo(bleedPx, pad);
      ctx.lineTo(bleedPx, tickEnd);
      // Top-right crop mark
      ctx.moveTo(canvas.width - tickEnd, bleedPx);
      ctx.lineTo(canvas.width - pad, bleedPx);
      ctx.moveTo(canvas.width - bleedPx, pad);
      ctx.lineTo(canvas.width - bleedPx, tickEnd);
      // Bottom-left crop mark
      ctx.moveTo(pad, canvas.height - bleedPx);
      ctx.lineTo(tickEnd, canvas.height - bleedPx);
      ctx.moveTo(bleedPx, canvas.height - tickEnd);
      ctx.lineTo(bleedPx, canvas.height - pad);
      // Bottom-right crop mark
      ctx.moveTo(canvas.width - tickEnd, canvas.height - bleedPx);
      ctx.lineTo(canvas.width - pad, canvas.height - bleedPx);
      ctx.moveTo(canvas.width - bleedPx, canvas.height - tickEnd);
      ctx.lineTo(canvas.width - bleedPx, canvas.height - pad);
      ctx.stroke();
    }

    const outUrl = canvas.toDataURL('image/png');
    if (outUrl && outUrl.startsWith('data:image/png') && outUrl.length > 64) {
      return outUrl;
    }
    return buildArchivalSvgDataUrl();
  } catch {
    return buildArchivalSvgDataUrl();
  }
}

/**
 * Sanitizes an artwork title into a clean, filesystem-safe download filename.
 */
export function sanitizeDownloadFilename(
  rawTitle: string,
  suffix?: string,
  extension: string = 'png'
): string {
  const baseSlug = (rawTitle || 'atelier-vue-print-master')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'atelier-vue-print-master';

  const cleanSuffix = suffix
    ? suffix
        .toLowerCase()
        .replace(/[^a-z0-9.+-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : '';

  const cleanExt = (extension || 'png').replace(/^\.+/, '').toLowerCase() || 'png';
  return cleanSuffix ? `${baseSlug}-${cleanSuffix}.${cleanExt}` : `${baseSlug}.${cleanExt}`;
}

let lastTriggeredDownloadRecord: {
  dataUrl: string;
  filename: string;
  timestamp: number;
} | null = null;

/**
 * Programmatically triggers a client-side file download using an ephemeral off-DOM anchor
 * element, cleaning up immediately so zero <a> tags ever remain in the DOM.
 */
export function triggerPrintFileDownload(dataUrl: string, filename: string): void {
  const safeFilename =
    filename && filename.trim().length > 0
      ? filename.trim()
      : 'atelier-vue-print-master-300dpi.png';
  const safeDataUrl =
    dataUrl && dataUrl.trim().length > 0
      ? dataUrl
      : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  lastTriggeredDownloadRecord = {
    dataUrl: safeDataUrl,
    filename: safeFilename,
    timestamp: Date.now(),
  };

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const ephemeralAnchor = document.createElement('a');
    ephemeralAnchor.href = safeDataUrl;
    ephemeralAnchor.download = safeFilename;
    ephemeralAnchor.rel = 'noopener';
    ephemeralAnchor.style.display = 'none';
    try {
      ephemeralAnchor.click();
    } catch {
      // Ignore synthetic click exceptions in non-browser environments
    } finally {
      if (ephemeralAnchor.parentNode) {
        ephemeralAnchor.parentNode.removeChild(ephemeralAnchor);
      }
    }
  }
}

export function getLastTriggeredDownload(): {
  dataUrl: string;
  filename: string;
  timestamp: number;
} | null {
  return lastTriggeredDownloadRecord ? { ...lastTriggeredDownloadRecord } : null;
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

export function validateShippingAddress(address: ShippingAddressData): ShippingValidationResult {
  const sanitized: ShippingAddressData = {
    fullName: sanitizeShippingText(address?.fullName ?? ''),
    email: sanitizeShippingText(address?.email ?? ''),
    streetAddress: sanitizeShippingText(address?.streetAddress ?? ''),
    city: sanitizeShippingText(address?.city ?? ''),
    stateOrProvince: sanitizeShippingText(address?.stateOrProvince ?? ''),
    postalCode: sanitizeShippingText(address?.postalCode ?? ''),
    country: sanitizeShippingText(address?.country ?? ''),
  };

  const errors: Partial<Record<keyof ShippingAddressData, string>> = {};

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

/**
 * Generates a structured JSON fulfillment manifest with zero external URLs.
 */
export function buildPrintOrderManifestJson(params: {
  orderId: string;
  artworkTitle: string;
  variation?: ReimaginedRoomVariation | null;
  painting?: PaintingSpec | null;
  sizeId: PrintSizeId;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId?: MatColorId;
  substrateId?: PrintSubstrateId;
  orientation?: OrientationMode;
  includePrintBleed?: boolean;
  pricing: PricingBreakdown;
  shippingAddress?: ShippingAddressData;
}): string {
  const partner = PRINT_PARTNERS[params.pricing.partnerId] ?? PRINT_PARTNERS.prodigi;
  const sizeSpec = PRINT_SIZES[params.sizeId] ?? PRINT_SIZES['24x36'];
  const frameSpec = FRAME_PROFILES[params.frameId] ?? FRAME_PROFILES['natural-white-oak'];
  const substrateSpec =
    PRINT_SUBSTRATES[params.substrateId ?? params.pricing.substrateId ?? 'hahnemuhle-etching-310gsm'] ??
    PRINT_SUBSTRATES['hahnemuhle-etching-310gsm'];
  const matWidthSpec = MAT_WIDTH_OPTIONS[params.matWidthId] ?? MAT_WIDTH_OPTIONS['2.5in'];
  const matColorSpec =
    MAT_COLOR_OPTIONS[params.matColorId ?? 'archival-ivory'] ?? MAT_COLOR_OPTIONS['archival-ivory'];

  const orientation: OrientationMode = params.orientation ?? 'portrait';
  const includePrintBleed = Boolean(params.includePrintBleed);
  const dimensions = computePrintDimensionsWithBleed(sizeSpec.id, includePrintBleed, orientation);

  const sanitizedPartnerDomain = (partner.websiteDomain || 'prodigi.com').replace(
    /^https?:\/\/(www\.)?/i,
    ''
  );
  const sanitizedPricingWebsite = (params.pricing.partnerWebsite || sanitizedPartnerDomain).replace(
    /^https?:\/\/(www\.)?/i,
    ''
  );

  const manifestPayload = {
    schemaVersion: 'atelier-vue.v2.print-fulfillment-manifest',
    manifestId: params.orderId.startsWith('AV-')
      ? params.orderId
      : `AV-MANIFEST-${params.orderId}`,
    orderId: params.orderId,
    createdAtIso: new Date().toISOString(),
    dispatchMode: 'in-app-partner-fulfillment-ticket',
    fulfillmentPartner: {
      id: partner.id,
      name: partner.name,
      partnerDomain: sanitizedPartnerDomain,
      fulfillmentRegion: partner.fulfillmentRegion,
      archivalCertification: partner.archivalCertification,
      estimatedProductionDays: partner.estimatedProductionDays,
      baseRatePerSqInch: partner.baseRatePerSqInch,
      shippingFlatRateUsd: partner.shippingFlatRateUsd,
    },
    artworkSpecification: {
      variationId: params.variation?.id ?? params.painting?.id ?? 'standalone-print-master',
      title:
        params.artworkTitle ||
        params.variation?.artworkTitle ||
        params.painting?.title ||
        'Atelier Vue Archival Edition',
      commissionProvenance: 'Atelier Vue Original Commission',
      editionStandard: 'Archival 300-DPI Studio Edition',
      placementAction: params.variation?.placementAction ?? 'add-only',
      styleMode: params.variation?.styleMode ?? 'ai-curated',
      artPiecesCount: params.variation?.artPieces?.length ?? 1,
      colorProfile: 'AdobeRGB (1998) / sRGB IEC61966-2.1 Archival',
    },
    physicalProductionSpec: {
      sizeId: sizeSpec.id,
      labelInches: sizeSpec.labelInches,
      labelCm: sizeSpec.labelCm,
      orientation,
      includePrintBleed,
      trimWidthInches: dimensions.trimWidthInches,
      trimHeightInches: dimensions.trimHeightInches,
      totalWidthInches: dimensions.totalWidthInches,
      totalHeightInches: dimensions.totalHeightInches,
      bleedInches: dimensions.bleedInches,
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      dpi: dimensions.dpi,
      substrateId: substrateSpec.id,
      substrateName: substrateSpec.name,
      substrateFinish: substrateSpec.finishLabel,
      frameId: frameSpec.id,
      frameName: frameSpec.name,
      frameMaterialDescription: frameSpec.materialDescription,
      matWidthId: matWidthSpec.id,
      matWidthLabel: matWidthSpec.label,
      matWidthInches: matWidthSpec.inches,
      matColorId: matColorSpec.id,
      matColorName: matColorSpec.name,
      matColorHex: matColorSpec.hex,
    },
    financialLedger: {
      ...params.pricing,
      partnerWebsite: sanitizedPricingWebsite,
      currency: 'USD',
      pricingFormulaNote: `Partner Wholesale ($${params.pricing.partnerWholesaleSubtotalUsd.toFixed(
        2
      )}) + Slight Studio Premium (${
        params.pricing.studioMarkupPercent
      }% = $${params.pricing.studioMarkupDollarUsd.toFixed(
        2
      )}) + Insured Art Shipping ($${params.pricing.insuredShippingUsd.toFixed(
        2
      )}) = $${params.pricing.physicalRetailTotalUsd.toFixed(2)} USD`,
    },
    recipientShippingAddress: params.shippingAddress
      ? validateShippingAddress(params.shippingAddress).sanitized
      : null,
  };

  return JSON.stringify(manifestPayload, null, 2);
}

// ---------------------------------------------------------------------------
// Persistent Storage (atelier_vue_v2_state) with QuotaExceededError Resilience
// ---------------------------------------------------------------------------

function createDefaultAtelierV2State(): AtelierV2PersistedState {
  return {
    version: 2,
    preferredPartnerId: 'prodigi',
    preferredMarkupPercent: DEFAULT_STUDIO_MARKUP_PERCENT,
    preferredSizeId: '24x36',
    preferredFrameId: 'natural-white-oak',
    preferredMatWidthId: '2.5in',
    preferredSubstrateId: 'hahnemuhle-etching-310gsm',
    includePrintBleed: false,
    orders: [],
    downloadsCount: 0,
    savedVariationsMeta: [],
    lastUpdatedAt: Date.now(),
  };
}

let inMemoryV2State: AtelierV2PersistedState = createDefaultAtelierV2State();

function compactOrderRecord(
  order: V2OrderConfirmation,
  aggressive: boolean
): V2OrderConfirmation {
  const maxManifestLength = aggressive ? 512 : 4096;
  const manifest =
    typeof order.partnerOrderManifestJson === 'string' &&
    order.partnerOrderManifestJson.length <= maxManifestLength &&
    !order.partnerOrderManifestJson.includes('data:image/')
      ? order.partnerOrderManifestJson
      : JSON.stringify({
          orderId: order.id,
          artworkTitle: order.artworkTitle,
          sizeId: order.sizeId,
          frameId: order.frameId,
          totalUsd: order.pricing?.physicalRetailTotalUsd ?? 0,
        });

  return {
    ...order,
    partnerOrderManifestJson: manifest,
  };
}

function sanitizeAndCompactState(
  raw: Partial<AtelierV2PersistedState>,
  aggressive: boolean = false
): AtelierV2PersistedState {
  const defaults = createDefaultAtelierV2State();
  const maxOrders = aggressive ? 3 : 20;
  const maxVariations = aggressive ? 3 : 25;

  const ordersArray = Array.isArray(raw.orders) ? raw.orders : defaults.orders;
  const compactedOrders = ordersArray
    .slice(0, maxOrders)
    .map((order) => compactOrderRecord(order, aggressive));

  const variationsArray = Array.isArray(raw.savedVariationsMeta)
    ? raw.savedVariationsMeta
    : defaults.savedVariationsMeta;
  const compactedVariations = variationsArray.slice(0, maxVariations).map((item) => ({
    id: String(item.id || 'var-default'),
    createdAt: Number(item.createdAt) || Date.now(),
    artworkTitle: String(item.artworkTitle || 'Untitled Study').slice(0, 140),
    engineId: String(item.engineId || 'astra'),
    printMasterWidthPx: Number(item.printMasterWidthPx) || 2400,
    printMasterHeightPx: Number(item.printMasterHeightPx) || 3600,
  }));

  const preferredPartnerId: PrintPartnerId =
    raw.preferredPartnerId && PRINT_PARTNERS[raw.preferredPartnerId]
      ? raw.preferredPartnerId
      : defaults.preferredPartnerId;

  const preferredSizeId: PrintSizeId =
    raw.preferredSizeId && PRINT_SIZES[raw.preferredSizeId]
      ? raw.preferredSizeId
      : defaults.preferredSizeId;

  const preferredFrameId: FrameProfileId =
    raw.preferredFrameId && FRAME_PROFILES[raw.preferredFrameId]
      ? raw.preferredFrameId
      : defaults.preferredFrameId;

  const preferredMatWidthId: MatWidthId =
    raw.preferredMatWidthId && MAT_WIDTH_OPTIONS[raw.preferredMatWidthId]
      ? raw.preferredMatWidthId
      : defaults.preferredMatWidthId;

  const preferredSubstrateId: PrintSubstrateId =
    raw.preferredSubstrateId && PRINT_SUBSTRATES[raw.preferredSubstrateId]
      ? raw.preferredSubstrateId
      : defaults.preferredSubstrateId;

  return {
    version: 2,
    preferredPartnerId,
    preferredMarkupPercent: clampStudioMarkupPercent(raw.preferredMarkupPercent),
    preferredSizeId,
    preferredFrameId,
    preferredMatWidthId,
    preferredSubstrateId,
    includePrintBleed:
      typeof raw.includePrintBleed === 'boolean'
        ? raw.includePrintBleed
        : defaults.includePrintBleed,
    orders: compactedOrders,
    downloadsCount:
      typeof raw.downloadsCount === 'number' && Number.isFinite(raw.downloadsCount)
        ? Math.max(0, Math.floor(raw.downloadsCount))
        : defaults.downloadsCount,
    savedVariationsMeta: compactedVariations,
    lastUpdatedAt: Number(raw.lastUpdatedAt) || Date.now(),
  };
}

export function loadAtelierV2State(): AtelierV2PersistedState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...inMemoryV2State };
  }
  try {
    const rawJson = window.localStorage.getItem(V2_STORAGE_KEY);
    if (!rawJson) {
      return { ...inMemoryV2State };
    }
    const parsed = JSON.parse(rawJson) as Partial<AtelierV2PersistedState>;
    const hydrated = sanitizeAndCompactState(parsed, false);
    // If inMemoryV2State has newer orders due to a previous QuotaExceeded fallback, preserve them
    if (
      inMemoryV2State.orders.length > hydrated.orders.length &&
      inMemoryV2State.lastUpdatedAt >= hydrated.lastUpdatedAt
    ) {
      return { ...inMemoryV2State };
    }
    inMemoryV2State = hydrated;
    return { ...hydrated };
  } catch {
    return { ...inMemoryV2State };
  }
}

export function saveAtelierV2State(
  patch: Partial<AtelierV2PersistedState>
): { saved: boolean; quotaExceeded: boolean; state: AtelierV2PersistedState } {
  const current = loadAtelierV2State();
  const merged = sanitizeAndCompactState(
    {
      ...current,
      ...patch,
      lastUpdatedAt: Date.now(),
    },
    false
  );

  inMemoryV2State = merged;

  if (typeof window === 'undefined' || !window.localStorage) {
    return { saved: false, quotaExceeded: false, state: merged };
  }

  try {
    window.localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(merged));
    return { saved: true, quotaExceeded: false, state: merged };
  } catch {
    // QuotaExceededError or storage restriction — compact aggressively and retry once
    const aggressiveState = sanitizeAndCompactState(merged, true);
    inMemoryV2State = aggressiveState;
    try {
      window.localStorage.removeItem(V2_STORAGE_KEY);
      window.localStorage.setItem(V2_STORAGE_KEY, JSON.stringify(aggressiveState));
      return { saved: true, quotaExceeded: true, state: aggressiveState };
    } catch {
      return { saved: false, quotaExceeded: true, state: aggressiveState };
    }
  }
}

export function recordOrderConfirmation(order: V2OrderConfirmation): {
  saved: boolean;
  quotaExceeded: boolean;
  orders: V2OrderConfirmation[];
} {
  const current = loadAtelierV2State();
  const deduplicated = current.orders.filter((existing) => existing.id !== order.id);
  const nextOrders = [compactOrderRecord(order, false), ...deduplicated];
  const nextDownloadsCount =
    order.orderType === 'digital-master-download'
      ? current.downloadsCount + 1
      : current.downloadsCount;

  const result = saveAtelierV2State({
    orders: nextOrders,
    downloadsCount: nextDownloadsCount,
  });

  return {
    saved: result.saved,
    quotaExceeded: result.quotaExceeded,
    orders: result.state.orders,
  };
}

export function recordPrintMasterDownload(confirmation?: V2OrderConfirmation): {
  saved: boolean;
  quotaExceeded: boolean;
  downloadsCount: number;
  state: AtelierV2PersistedState;
} {
  if (confirmation) {
    const res = recordOrderConfirmation(confirmation);
    const state = loadAtelierV2State();
    return {
      saved: res.saved,
      quotaExceeded: res.quotaExceeded,
      downloadsCount: state.downloadsCount,
      state,
    };
  }
  const current = loadAtelierV2State();
  const res = saveAtelierV2State({
    downloadsCount: current.downloadsCount + 1,
  });
  return {
    saved: res.saved,
    quotaExceeded: res.quotaExceeded,
    downloadsCount: res.state.downloadsCount,
    state: res.state,
  };
}

export function recordVariationMetadata(variation: ReimaginedRoomVariation): void {
  if (!variation || !variation.id) {
    return;
  }
  const current = loadAtelierV2State();
  const filtered = current.savedVariationsMeta.filter((item) => item.id !== variation.id);
  saveAtelierV2State({
    savedVariationsMeta: [
      {
        id: variation.id,
        createdAt: variation.createdAt || Date.now(),
        artworkTitle: variation.artworkTitle || 'Reimagined Wall Study',
        engineId: variation.engineId || 'astra',
        printMasterWidthPx: variation.printMasterWidthPx || 2400,
        printMasterHeightPx: variation.printMasterHeightPx || 3600,
      },
      ...filtered,
    ],
  });
}

export function clearAtelierV2State(): void {
  inMemoryV2State = createDefaultAtelierV2State();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(V2_STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }
  }
}
