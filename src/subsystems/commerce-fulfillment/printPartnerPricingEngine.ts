// src/subsystems/commerce-fulfillment/printPartnerPricingEngine.ts
// Leaf 4A — Print-on-Demand Partner Pricing Engine, Archival Substrate/Mat Catalog & Partner API Manifest Generator

import {
  FRAME_PROFILES,
  FrameProfileId,
  MatColorId,
  MatWidthId,
  OrderRecord,
  PanelLayoutMode,
  PricingBreakdown,
  PRINT_PARTNERS,
  PRINT_SIZES,
  PrintPartnerId,
  PrintSizeId,
  PrintSubstrateId,
} from '../../contracts/masterContract';

export const DEFAULT_STUDIO_MARKUP_PERCENT = 18;
export const MIN_STUDIO_MARKUP_PERCENT = 10;
export const MAX_STUDIO_MARKUP_PERCENT = 40;
export const DIGITAL_MASTER_LICENSE_USD = 29.0;

export interface PrintSubstrateSpec {
  id: PrintSubstrateId;
  name: string;
  shortName: string;
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
    description: '100% alpha-cellulose mould-made archival fine art paper with velvety tactile tooth.',
    gsmOrThickness: '310 gsm',
    priceMultiplier: 1.0,
    finishLabel: 'Museum Matte Velvet',
  },
  'archival-cotton-canvas-400gsm': {
    id: 'archival-cotton-canvas-400gsm',
    name: '400gsm Archival Cotton Canvas',
    shortName: '400gsm Cotton Canvas',
    description: 'Heavyweight poly-cotton museum weave sealed with UV-protective satin archival varnish.',
    gsmOrThickness: '400 gsm',
    priceMultiplier: 1.18,
    finishLabel: 'Woven Archival Satin',
  },
  'museum-matte-acrylic': {
    id: 'museum-matte-acrylic',
    name: 'Museum Anti-Reflective Matte Acrylic',
    shortName: 'Museum Matte Acrylic',
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

export interface CalculatePrintPricingParams {
  partnerId: PrintPartnerId;
  sizeId: PrintSizeId;
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  substrateId: PrintSubstrateId;
  panelLayout: PanelLayoutMode;
  studioMarkupPercent?: number;
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
 * Clamps the studio curation & color-calibration markup percentage to [10%, 40%],
 * defaulting undefined/NaN to 18%.
 */
export function clampStudioMarkupPercent(markupPercent?: number): number {
  if (markupPercent === undefined || markupPercent === null || Number.isNaN(markupPercent) || !Number.isFinite(markupPercent)) {
    return DEFAULT_STUDIO_MARKUP_PERCENT;
  }
  return Math.min(MAX_STUDIO_MARKUP_PERCENT, Math.max(MIN_STUDIO_MARKUP_PERCENT, markupPercent));
}

/**
 * Computes transparent print-on-demand partner wholesale cost + studio curation markup + insured shipping
 * with strict cent-level ledger invariants:
 * - partnerWholesaleSubtotalUsd === roundCents(partnerBasePrintCostUsd + partnerFrameAndMatCostUsd)
 * - studioMarkupDollarUsd === roundCents(partnerWholesaleSubtotalUsd * (studioMarkupPercent / 100))
 * - physicalRetailTotalUsd === roundCents(partnerWholesaleSubtotalUsd + studioMarkupDollarUsd + insuredShippingUsd)
 */
export function calculatePrintPricing(params: CalculatePrintPricingParams): PricingBreakdown {
  const partner = PRINT_PARTNERS[params.partnerId] ?? PRINT_PARTNERS.prodigi;
  const size = PRINT_SIZES[params.sizeId] ?? PRINT_SIZES['24x36'];
  const frame = FRAME_PROFILES[params.frameId] ?? FRAME_PROFILES['natural-white-oak'];
  const substrate = PRINT_SUBSTRATES[params.substrateId] ?? PRINT_SUBSTRATES['hahnemuhle-etching-310gsm'];
  const matOption = MAT_WIDTH_OPTIONS[params.matWidthId] ?? MAT_WIDTH_OPTIONS['2.5in'];

  const normalizedPanelLayout: PanelLayoutMode =
    params.panelLayout === 'triptych' ? 'triptych' : params.panelLayout === 'diptych' ? 'diptych' : 'single';
  const panelCount = normalizedPanelLayout === 'triptych' ? 3 : normalizedPanelLayout === 'diptych' ? 2 : 1;

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

  const partnerWholesaleSubtotalUsd = roundCents(partnerBasePrintCostUsd + partnerFrameAndMatCostUsd);

  const studioMarkupPercent = clampStudioMarkupPercent(params.studioMarkupPercent);
  const studioMarkupDollarUsd = roundCents(partnerWholesaleSubtotalUsd * (studioMarkupPercent / 100));

  const insuredShippingUsd = roundCents(
    partner.shippingFlatRateUsd + (size.widthInches >= 30 ? 8.5 : 0) + (panelCount - 1) * 4.5
  );

  const physicalRetailTotalUsd = roundCents(
    partnerWholesaleSubtotalUsd + studioMarkupDollarUsd + insuredShippingUsd
  );

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    partnerWebsite: partner.websiteUrl,
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

/**
 * Compares the exact physical & wholesale pricing across all 3 archival print partners
 * (Prodigi Fine Art Guild, Printful Museum Line, FinerWorks Archival Lab).
 */
export function compareAllPartnersPricing(
  params: Omit<CalculatePrintPricingParams, 'partnerId'>
): Record<PrintPartnerId, PricingBreakdown> {
  return {
    prodigi: calculatePrintPricing({ ...params, partnerId: 'prodigi' }),
    printful: calculatePrintPricing({ ...params, partnerId: 'printful' }),
    finerworks: calculatePrintPricing({ ...params, partnerId: 'finerworks' }),
  };
}

/**
 * Generates a structured JSON manifest for partner API fulfillment handoff and archival records.
 */
export function generatePartnerOrderManifestJson(
  order: Omit<OrderRecord, 'partnerOrderPayloadJson'>
): string {
  const partner = PRINT_PARTNERS[order.pricing.partnerId] ?? PRINT_PARTNERS.prodigi;
  const sizeSpec = PRINT_SIZES[order.sizeId] ?? PRINT_SIZES['24x36'];
  const frameSpec = FRAME_PROFILES[order.frameId] ?? FRAME_PROFILES['natural-white-oak'];
  const substrateSpec = PRINT_SUBSTRATES[order.substrateId] ?? PRINT_SUBSTRATES['hahnemuhle-etching-310gsm'];
  const matWidthSpec = MAT_WIDTH_OPTIONS[order.matWidthId] ?? MAT_WIDTH_OPTIONS['2.5in'];
  const matColorSpec = MAT_COLOR_OPTIONS[order.matColorId] ?? MAT_COLOR_OPTIONS['archival-ivory'];

  const targetWidthPx =
    order.orientation === 'landscape'
      ? Math.max(sizeSpec.printMasterWidthPx, sizeSpec.printMasterHeightPx)
      : order.orientation === 'square'
      ? Math.min(sizeSpec.printMasterWidthPx, sizeSpec.printMasterHeightPx)
      : sizeSpec.printMasterWidthPx;

  const targetHeightPx =
    order.orientation === 'landscape'
      ? Math.min(sizeSpec.printMasterWidthPx, sizeSpec.printMasterHeightPx)
      : order.orientation === 'square'
      ? Math.min(sizeSpec.printMasterWidthPx, sizeSpec.printMasterHeightPx)
      : sizeSpec.printMasterHeightPx;

  const payload = {
    schemaVersion: 'atelier-vue.partner-fulfillment.v1',
    manifestId: order.id.startsWith('AV-') ? order.id : `AV-MANIFEST-${order.id}`,
    orderId: order.id,
    createdAtIso: new Date(order.createdAt).toISOString(),
    orderType: order.orderType,
    status: order.status,
    roomId: order.roomId,
    fulfillmentPartner: {
      id: partner.id,
      name: partner.name,
      websiteDomain: partner.websiteDomain,
      websiteUrl: partner.websiteUrl,
      apiEndpoint: `${partner.websiteUrl}/api/v4/orders`,
      fulfillmentRegion: partner.fulfillmentRegion,
      archivalCertification: partner.archivalCertification,
      estimatedProductionDays: partner.estimatedProductionDays,
      baseRatePerSqInch: partner.baseRatePerSqInch,
      shippingFlatRateUsd: partner.shippingFlatRateUsd,
    },
    artworkSpecification: {
      id: order.painting.id,
      paintingId: order.painting.id,
      catalogNumber: order.painting.catalogNumber,
      title: order.painting.title,
      subtitle: order.painting.subtitle,
      styleId: order.painting.styleId,
      harmonyMode: order.painting.harmonyMode,
      seed: order.painting.seed,
      pigments: order.painting.pigments,
      pigmentRecipe: order.painting.pigments,
      targetResolutionPx: {
        widthPx: targetWidthPx,
        heightPx: targetHeightPx,
      },
      dpi: sizeSpec.dpi ?? 300,
      colorProfile: 'AdobeRGB (1998) Archival',
    },
    physicalProductionSpec: {
      sizeId: sizeSpec.id,
      labelInches: sizeSpec.labelInches,
      labelCm: sizeSpec.labelCm,
      widthInches: sizeSpec.widthInches,
      heightInches: sizeSpec.heightInches,
      orientation: order.orientation,
      panelLayout: order.panelLayout,
      panelCount: order.pricing.panelCount,
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
      ...order.pricing,
      currency: 'USD',
      pricingFormulaNote: `Partner Wholesale ($${order.pricing.partnerWholesaleSubtotalUsd.toFixed(
        2
      )}) + Atelier Curation & Color-Calibration Markup (${order.pricing.studioMarkupPercent}% = $${order.pricing.studioMarkupDollarUsd.toFixed(
        2
      )}) + Insured Art Courier Shipping ($${order.pricing.insuredShippingUsd.toFixed(
        2
      )}) = $${order.pricing.physicalRetailTotalUsd.toFixed(2)} USD`,
    },
    recipientShippingAddress: order.shippingAddress ?? null,
  };

  return JSON.stringify(payload, null, 2);
}
