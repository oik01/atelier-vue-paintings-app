// @vitest-environment jsdom
// src/subsystems/checkout-and-download/__tests__/checkoutAndDownload.test.ts
// Tier 2 Independent Subsystem Verification Suite — V2 Subsystem 4 (checkout-and-download)

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FRAME_PROFILES,
  FrameProfileId,
  MatWidthId,
  PanelLayoutMode,
  PRINT_PARTNERS,
  PRINT_SIZES,
  PrintPartnerId,
  PrintSizeId,
  PrintSubstrateId,
  ReimaginedRoomVariation,
  ScaleCalibrationResult,
} from '../../../contracts/masterContract';
import {
  AcquirePrintModal,
  buildPrintOrderManifestJson,
  calculateFinerWorksOrderBreakdown,
  calculatePrintPricing,
  CheckoutAndOrderModal,
  clampStudioMarkupPercent,
  clearAtelierV2State,
  compareAllPartnerQuotes,
  compareAllPartnersPricing,
  computePartnerPrintQuote,
  computePrintDimensionsWithBleed,
  DEFAULT_STUDIO_MARKUP_PERCENT,
  DIGITAL_MASTER_LICENSE_USD,
  EMPTY_SHIPPING_ADDRESS,
  FinerWorksBrandAndSyncModal,
  getLastTriggeredDownload,
  loadAtelierV2State,
  MAT_COLOR_OPTIONS,
  MAT_WIDTH_OPTIONS,
  MAX_STUDIO_MARKUP_PERCENT,
  MIN_STUDIO_MARKUP_PERCENT,
  PRINT_SUBSTRATES,
  recordOrderConfirmation,
  recordPrintMasterDownload,
  recordVariationMetadata,
  renderPrintMasterWithBleedDataUrl,
  roundCents,
  SAMPLE_SHIPPING_ADDRESS,
  sanitizeDownloadFilename,
  sanitizeShippingText,
  saveAtelierV2State,
  submitFinerWorksPrintOrder,
  triggerPrintFileDownload,
  V2_STORAGE_KEY,
  V2OrderConfirmation,
  validateFinerWorksRecipientAddress,
  validateShippingAddress,
} from '../index';
import {
  DEFAULT_WHITE_LABEL_BRAND_ID,
  setActiveWhiteLabelBrand,
  WHITE_LABEL_BRAND_LIST,
} from '../../finerworks-catalog-sync';

// Configure React 18/19 act environment for deterministic synchronous DOM updates
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedHarness {
  container: HTMLDivElement;
  root: Root;
  unmount: () => void;
}

function mountElement(element: React.ReactElement): MountedHarness {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    },
  };
}

function createSampleVariation(overrides?: Partial<ReimaginedRoomVariation>): ReimaginedRoomVariation {
  return {
    id: 'var-astra-terracotta-01',
    createdAt: 1730000000000,
    engineId: 'astra',
    engineModelName: 'GPT-6 Astra (openai/gpt-6-astra)',
    imageModelName: 'google/gemini-nano-banana-2.1',
    placementAction: 'add-only',
    styleMode: 'ai-curated',
    promptUsed: 'Preserve exact room architecture and add an impasto terracotta study above the sofa.',
    originalRoomDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    reimaginedRoomDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    detectedCropBox: { ymin: 190, xmin: 270, ymax: 610, xmax: 730 },
    activeCropBox: { ymin: 195, xmin: 275, ymax: 615, xmax: 725 },
    croppedScreenshotDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="%23C89D7C"/></svg>',
    identicalPrintMasterDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3600"><rect width="2400" height="3600" fill="%23B85D3B"/></svg>',
    printMasterWidthPx: 2400,
    printMasterHeightPx: 3600,
    artworkTitle: 'Warm Ochre & Limestone Horizon',
    artworkDescription: 'Perspective-rectified archival impasto canvas matched to sunlit linen room tones.',
    roomStyleSummary: 'Warm minimalist travertine & oak living room at 3,400K.',
    ...overrides,
  };
}

describe('V2 Subsystem 4 (checkout-and-download) — Independent Verification Suite', () => {
  beforeEach(() => {
    clearAtelierV2State();
    window.localStorage.clear();
    HTMLAnchorElement.prototype.click = () => undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    clearAtelierV2State();
    window.localStorage.clear();
  });

  // =========================================================================
  // 1. Partner Print Quote Calculator (`computePartnerPrintQuote` & `compareAllPartnerQuotes`)
  // =========================================================================
  describe('1. Partner Print Quote Calculator (computePartnerPrintQuote & compareAllPartnerQuotes)', () => {
    const partners = Object.keys(PRINT_PARTNERS) as PrintPartnerId[];
    const sizes = Object.keys(PRINT_SIZES) as PrintSizeId[];
    const frames = Object.keys(FRAME_PROFILES) as FrameProfileId[];
    const matWidths = Object.keys(MAT_WIDTH_OPTIONS) as MatWidthId[];
    const substrates = Object.keys(PRINT_SUBSTRATES) as PrintSubstrateId[];
    const layouts: PanelLayoutMode[] = ['single', 'diptych', 'triptych'];

    it('enforces exact cent-level ledger invariants across all 3 partners, 5 sizes, 6 frames, 4 mat widths, 3 substrates, and 3 panel layouts (3,240 combinations)', () => {
      expect(partners).toEqual(['prodigi', 'printful', 'finerworks']);
      expect(sizes).toEqual(['12x16', '18x24', '24x36', '30x40', '36x48']);
      expect(frames.length).toBe(6);
      expect(matWidths).toEqual(['none', '1.5in', '2.5in', '3.5in']);
      expect(substrates).toEqual([
        'hahnemuhle-etching-310gsm',
        'archival-cotton-canvas-400gsm',
        'museum-matte-acrylic',
      ]);
      expect(Object.keys(MAT_COLOR_OPTIONS)).toEqual([
        'archival-ivory',
        'warm-museum-linen',
        'charcoal-conservation',
      ]);

      let evaluatedCombinations = 0;

      for (const partnerId of partners) {
        for (const sizeId of sizes) {
          for (const frameId of frames) {
            for (const matWidthId of matWidths) {
              for (const substrateId of substrates) {
                for (const panelLayout of layouts) {
                  const quote = computePartnerPrintQuote({
                    partnerId,
                    sizeId,
                    frameId,
                    matWidthId,
                    substrateId,
                    panelLayout,
                    studioMarkupPercent: 18,
                  });

                  evaluatedCombinations++;

                  expect(quote.partnerId).toBe(partnerId);
                  expect(quote.sizeId).toBe(sizeId);
                  expect(quote.frameId).toBe(frameId);
                  expect(quote.matWidthId).toBe(matWidthId);
                  expect(quote.substrateId).toBe(substrateId);
                  expect(quote.panelLayout).toBe(panelLayout);
                  expect(quote.panelCount).toBe(
                    panelLayout === 'triptych' ? 3 : panelLayout === 'diptych' ? 2 : 1
                  );

                  // Strict cent-exact ledger invariants
                  expect(quote.partnerWholesaleSubtotalUsd).toBe(
                    roundCents(quote.partnerBasePrintCostUsd + quote.partnerFrameAndMatCostUsd)
                  );
                  expect(quote.studioMarkupDollarUsd).toBe(
                    roundCents(quote.partnerWholesaleSubtotalUsd * (quote.studioMarkupPercent / 100))
                  );
                  expect(quote.physicalRetailTotalUsd).toBe(
                    roundCents(
                      quote.partnerWholesaleSubtotalUsd +
                        quote.studioMarkupDollarUsd +
                        quote.insuredShippingUsd
                    )
                  );
                  expect(quote.digitalMasterLicenseUsd).toBe(DIGITAL_MASTER_LICENSE_USD);
                  expect(quote.physicalRetailTotalUsd).toBeGreaterThan(0);
                }
              }
            }
          }
        }
      }

      expect(evaluatedCombinations).toBe(3240);
    });

    it('clamps studio markup percentage to [10%, 35%] and defaults undefined/NaN to 18%', () => {
      expect(DEFAULT_STUDIO_MARKUP_PERCENT).toBe(18);
      expect(MIN_STUDIO_MARKUP_PERCENT).toBe(10);
      expect(MAX_STUDIO_MARKUP_PERCENT).toBe(35);

      expect(clampStudioMarkupPercent(undefined)).toBe(18);
      expect(clampStudioMarkupPercent(Number.NaN)).toBe(18);
      expect(clampStudioMarkupPercent(Number.POSITIVE_INFINITY)).toBe(18);
      expect(clampStudioMarkupPercent(-5)).toBe(10);
      expect(clampStudioMarkupPercent(4)).toBe(10);
      expect(clampStudioMarkupPercent(10)).toBe(10);
      expect(clampStudioMarkupPercent(15)).toBe(15);
      expect(clampStudioMarkupPercent(18)).toBe(18);
      expect(clampStudioMarkupPercent(22)).toBe(22);
      expect(clampStudioMarkupPercent(35)).toBe(35);
      expect(clampStudioMarkupPercent(65)).toBe(35);
    });

    it('compares all 3 partner quotes and maintains alias parity with calculatePrintPricing & compareAllPartnersPricing', () => {
      const comparison = compareAllPartnerQuotes({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        panelLayout: 'single',
        studioMarkupPercent: 22,
      });

      expect(Object.keys(comparison)).toEqual(['prodigi', 'printful', 'finerworks']);
      expect(comparison.prodigi.partnerWebsite).toBe('prodigi.com');
      expect(comparison.printful.partnerWebsite).toBe('printful.com');
      expect(comparison.finerworks.partnerWebsite).toBe('finerworks.com');
      expect(comparison.prodigi.studioMarkupPercent).toBe(22);
      expect(comparison.printful.studioMarkupPercent).toBe(22);
      expect(comparison.finerworks.studioMarkupPercent).toBe(22);

      // Verify backward-compatible function aliases
      expect(calculatePrintPricing).toBe(computePartnerPrintQuote);
      expect(compareAllPartnersPricing).toBe(compareAllPartnerQuotes);
      expect(CheckoutAndOrderModal).toBe(AcquirePrintModal);
    });
  });

  // =========================================================================
  // 2. 300-DPI Print Dimensions & Bleed Math (`computePrintDimensionsWithBleed` & `renderPrintMasterWithBleedDataUrl`)
  // =========================================================================
  describe('2. 300-DPI Print Dimensions & Bleed Math (computePrintDimensionsWithBleed & renderPrintMasterWithBleedDataUrl)', () => {
    it('computes exact 2400×3600 px for 24x36 (2550×3750 px with +0.25" bleed) and 3000×4000 px for 36x48 (3150×4150 px with +0.25" bleed)', () => {
      const dim24x36NoBleed = computePrintDimensionsWithBleed('24x36', false, 'portrait');
      expect(dim24x36NoBleed).toEqual({
        trimWidthInches: 24,
        trimHeightInches: 36,
        totalWidthInches: 24,
        totalHeightInches: 36,
        widthPx: 2400,
        heightPx: 3600,
        dpi: 300,
        bleedInches: 0,
      });

      const dim24x36WithBleed = computePrintDimensionsWithBleed('24x36', true, 'portrait');
      expect(dim24x36WithBleed).toEqual({
        trimWidthInches: 24,
        trimHeightInches: 36,
        totalWidthInches: 24.5,
        totalHeightInches: 36.5,
        widthPx: 2550,
        heightPx: 3750,
        dpi: 300,
        bleedInches: 0.25,
      });

      const dim36x48NoBleed = computePrintDimensionsWithBleed('36x48', false, 'portrait');
      expect(dim36x48NoBleed).toEqual({
        trimWidthInches: 36,
        trimHeightInches: 48,
        totalWidthInches: 36,
        totalHeightInches: 48,
        widthPx: 3000,
        heightPx: 4000,
        dpi: 300,
        bleedInches: 0,
      });

      const dim36x48WithBleed = computePrintDimensionsWithBleed('36x48', true, 'portrait');
      expect(dim36x48WithBleed).toEqual({
        trimWidthInches: 36,
        trimHeightInches: 48,
        totalWidthInches: 36.5,
        totalHeightInches: 48.5,
        widthPx: 3150,
        heightPx: 4150,
        dpi: 300,
        bleedInches: 0.25,
      });

      // Landscape & Square orientation checks
      const dim24x36Landscape = computePrintDimensionsWithBleed('24x36', false, 'landscape');
      expect(dim24x36Landscape.widthPx).toBe(3600);
      expect(dim24x36Landscape.heightPx).toBe(2400);

      const dim24x36Square = computePrintDimensionsWithBleed('24x36', true, 'square');
      expect(dim24x36Square.widthPx).toBe(2550);
      expect(dim24x36Square.heightPx).toBe(2550);
    });

    it('renders high-resolution print master data URLs with archival bleed and crop marks in renderPrintMasterWithBleedDataUrl', async () => {
      const rawSource = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const withoutBleed = await renderPrintMasterWithBleedDataUrl(rawSource, {
        widthPx: 2400,
        heightPx: 3600,
        includePrintBleed: false,
        title: 'Ochre Study',
      });
      expect(withoutBleed).toBe(rawSource);

      const withBleed = await renderPrintMasterWithBleedDataUrl(rawSource, {
        widthPx: 2550,
        heightPx: 3750,
        includePrintBleed: true,
        title: 'Ochre Study',
      });
      expect(withBleed.startsWith('data:image/')).toBe(true);
      const decodedSvg = decodeURIComponent(withBleed);
      expect(decodedSvg).toContain('archival-crop-marks');
      expect(decodedSvg).toContain('width="2550"');
      expect(decodedSvg).toContain('height="3750"');
      expect(decodedSvg).toContain('data-bleed="0.25in"');
    });
  });

  // =========================================================================
  // 3. Ephemeral Off-DOM Download Trigger (`triggerPrintFileDownload` & `sanitizeDownloadFilename`)
  // =========================================================================
  describe('3. Ephemeral Off-DOM Download Trigger (triggerPrintFileDownload & sanitizeDownloadFilename)', () => {
    it('sanitizes filenames cleanly and triggers off-DOM download leaving zero <a> elements in document.body', () => {
      const filename = sanitizeDownloadFilename(
        'Warm Ochre & Limestone Horizon #01!',
        '24x36-2400x3600px-300dpi',
        '.PNG'
      );
      expect(filename).toBe('warm-ochre-limestone-horizon-01-24x36-2400x3600px-300dpi.png');

      const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      triggerPrintFileDownload(sampleDataUrl, filename);

      const lastRecord = getLastTriggeredDownload();
      expect(lastRecord).not.toBeNull();
      expect(lastRecord!.filename).toBe(filename);
      expect(lastRecord!.dataUrl).toBe(sampleDataUrl);
      expect(lastRecord!.timestamp).toBeGreaterThan(0);

      // Must leave zero <a> tags anywhere in document
      expect(document.querySelectorAll('a').length).toBe(0);
    });
  });

  // =========================================================================
  // 4. Shipping Validation & Zero-External-URL Order Manifest (`validateShippingAddress` & `buildPrintOrderManifestJson`)
  // =========================================================================
  describe('4. Shipping Validation & Zero-External-URL Order Manifest (validateShippingAddress & buildPrintOrderManifestJson)', () => {
    it('rejects empty/invalid fields, accepts SAMPLE_SHIPPING_ADDRESS, and strips < and > tags', () => {
      const emptyCheck = validateShippingAddress(EMPTY_SHIPPING_ADDRESS);
      expect(emptyCheck.isValid).toBe(false);
      expect(emptyCheck.errors.fullName).toBeDefined();
      expect(emptyCheck.errors.email).toBeDefined();
      expect(emptyCheck.errors.streetAddress).toBeDefined();
      expect(emptyCheck.errors.city).toBeDefined();
      expect(emptyCheck.errors.stateOrProvince).toBeDefined();
      expect(emptyCheck.errors.postalCode).toBeDefined();

      const validSampleCheck = validateShippingAddress(SAMPLE_SHIPPING_ADDRESS);
      expect(validSampleCheck.isValid).toBe(true);
      expect(Object.keys(validSampleCheck.errors).length).toBe(0);

      const xssDirtyAddress = {
        ...SAMPLE_SHIPPING_ADDRESS,
        fullName: 'Clara <script>alert(1)</script> <b>Vance</b>',
        streetAddress: '428 <img src=x onerror=evil()> Mercer Street',
      };
      const sanitizedCheck = validateShippingAddress(xssDirtyAddress);
      expect(sanitizedCheck.isValid).toBe(true);
      expect(sanitizedCheck.sanitized.fullName).toBe('Clara Vance');
      expect(sanitizedCheck.sanitized.streetAddress).toBe('428 Mercer Street');
      expect(sanitizeShippingText('<a href="https://evil.example">Link</a>')).toBe('Link');
    });

    it('produces a valid JSON order manifest containing zero http:// or https:// external URLs', () => {
      const variation = createSampleVariation();
      const pricing = computePartnerPrintQuote({
        partnerId: 'prodigi',
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        studioMarkupPercent: 18,
      });

      const manifestStr = buildPrintOrderManifestJson({
        orderId: 'AV2-ORD-9901',
        artworkTitle: variation.artworkTitle,
        variation,
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        matColorId: 'archival-ivory',
        substrateId: 'hahnemuhle-etching-310gsm',
        includePrintBleed: true,
        pricing,
        shippingAddress: SAMPLE_SHIPPING_ADDRESS,
      });

      expect(manifestStr).not.toContain('http://');
      expect(manifestStr).not.toContain('https://');

      const parsed = JSON.parse(manifestStr);
      expect(parsed.schemaVersion).toBe('atelier-vue.v2.print-fulfillment-manifest');
      expect(parsed.orderId).toBe('AV2-ORD-9901');
      expect(parsed.fulfillmentPartner.id).toBe('prodigi');
      expect(parsed.fulfillmentPartner.partnerDomain).toBe('prodigi.com');
      expect(parsed.physicalProductionSpec.widthPx).toBe(2550);
      expect(parsed.physicalProductionSpec.heightPx).toBe(3750);
      expect(parsed.physicalProductionSpec.includePrintBleed).toBe(true);
      expect(parsed.financialLedger.physicalRetailTotalUsd).toBe(pricing.physicalRetailTotalUsd);
      expect(parsed.recipientShippingAddress.fullName).toBe('Clara Vance');
    });
  });

  // =========================================================================
  // 5. `localStorage` (`atelier_vue_v2_state`) Persistence & `QuotaExceededError` Safety
  // =========================================================================
  describe('5. localStorage (atelier_vue_v2_state) Persistence & QuotaExceededError Safety', () => {
    it('persists and hydrates state, order confirmations, downloads, and variation metadata under atelier_vue_v2_state', () => {
      expect(V2_STORAGE_KEY).toBe('atelier_vue_v2_state');

      const initial = loadAtelierV2State();
      expect(initial.version).toBe(2);
      expect(initial.preferredPartnerId).toBe('finerworks');
      expect(initial.preferredMarkupPercent).toBe(18);

      const saveRes = saveAtelierV2State({
        preferredPartnerId: 'finerworks',
        preferredMarkupPercent: 22,
        preferredSizeId: '30x40',
        preferredFrameId: 'brushed-brass-float',
        includePrintBleed: true,
      });
      expect(saveRes.saved).toBe(true);
      expect(saveRes.quotaExceeded).toBe(false);

      const variation = createSampleVariation();
      recordVariationMetadata(variation);

      const pricing = computePartnerPrintQuote({
        partnerId: 'finerworks',
        sizeId: '30x40',
        frameId: 'brushed-brass-float',
        matWidthId: '2.5in',
        studioMarkupPercent: 22,
      });

      const order: V2OrderConfirmation = {
        id: 'AV2-ORD-PERSIST-1',
        createdAt: Date.now(),
        orderType: 'partner-printed-edition',
        variationId: variation.id,
        artworkTitle: variation.artworkTitle,
        sizeId: '30x40',
        frameId: 'brushed-brass-float',
        matWidthId: '2.5in',
        matColorId: 'archival-ivory',
        substrateId: 'hahnemuhle-etching-310gsm',
        orientation: 'portrait',
        includePrintBleed: true,
        printMasterWidthPx: 2850,
        printMasterHeightPx: 3750,
        pricing,
        shippingAddress: SAMPLE_SHIPPING_ADDRESS,
        partnerOrderManifestJson: '{"orderId":"AV2-ORD-PERSIST-1"}',
        status: 'dispatched-to-partner',
      };

      const orderRec = recordOrderConfirmation(order);
      expect(orderRec.saved).toBe(true);
      expect(orderRec.orders.length).toBe(1);

      const dlRec = recordPrintMasterDownload();
      expect(dlRec.downloadsCount).toBe(1);

      const reloaded = loadAtelierV2State();
      expect(reloaded.preferredPartnerId).toBe('finerworks');
      expect(reloaded.preferredMarkupPercent).toBe(22);
      expect(reloaded.preferredSizeId).toBe('30x40');
      expect(reloaded.includePrintBleed).toBe(true);
      expect(reloaded.orders.length).toBe(1);
      expect(reloaded.orders[0].id).toBe('AV2-ORD-PERSIST-1');
      expect(reloaded.savedVariationsMeta.length).toBe(1);
      expect(reloaded.savedVariationsMeta[0].id).toBe(variation.id);
      expect(reloaded.downloadsCount).toBe(1);
    });

    it('recovers gracefully when localStorage.setItem throws QuotaExceededError without throwing uncaught exceptions', () => {
      const quotaError = new DOMException('QuotaExceededError: Storage limit reached', 'QuotaExceededError');
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      expect(() => {
        const res = saveAtelierV2State({
          preferredPartnerId: 'printful',
          preferredMarkupPercent: 15,
        });
        expect(res.quotaExceeded).toBe(true);
        expect(res.state.preferredPartnerId).toBe('printful');
        expect(res.state.preferredMarkupPercent).toBe(15);
      }).not.toThrow();

      // In-memory fallback still retains the latest state
      const recovered = loadAtelierV2State();
      expect(recovered.preferredPartnerId).toBe('printful');
      expect(recovered.preferredMarkupPercent).toBe(15);

      setItemSpy.mockRestore();
    });
  });

  // =========================================================================
  // 6. `AcquirePrintModal` Mode 1 (`download-master`) UI, Multi-Art-Piece Set & Interactions
  // =========================================================================
  describe('6. AcquirePrintModal Mode 1 (download-master) UI, Multi-Art-Piece Set & Interactions', () => {
    it('renders side-by-side in-room preview & print master verification, toggles +0.25" bleed with exact pixel updates, and triggers high-res print master download', () => {
      const variation = createSampleVariation();
      const completedDownloads: V2OrderConfirmation[] = [];

      const harness = mountElement(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'download-master',
          variation,
          sizeId: '24x36',
          onDownloadCompleted: (conf) => completedDownloads.push(conf),
        })
      );

      const { container } = harness;

      // Side-by-side verification card
      const verificationCard = container.querySelector(
        '[data-testid="side-by-side-print-verification"]'
      ) as HTMLElement;
      expect(verificationCard).not.toBeNull();

      const roomPreviewImg = container.querySelector(
        '[data-testid="verification-room-preview-img"]'
      ) as HTMLImageElement;
      const masterImg = container.querySelector(
        '[data-testid="verification-print-master-img"]'
      ) as HTMLImageElement;
      const wallLocationBadge = container.querySelector(
        '[data-testid="verification-wall-location-badge"]'
      ) as HTMLElement;

      expect(roomPreviewImg).not.toBeNull();
      expect(masterImg).not.toBeNull();
      expect(wallLocationBadge.textContent).toContain('Primary Wall Placement');

      // Initial dimensions for 24x36 without bleed: 2400 × 3600 px @ 300 DPI
      const dimensionsBadge = container.querySelector(
        '[data-testid="print-master-dimensions"]'
      ) as HTMLElement;
      expect(dimensionsBadge).not.toBeNull();
      expect(dimensionsBadge.textContent).toContain('2400 × 3600 px @ 300 DPI');

      // Toggle +0.25" bleed on -> 2550 × 3750 px @ 300 DPI
      const bleedToggle = container.querySelector(
        '[data-testid="toggle-print-bleed"]'
      ) as HTMLButtonElement;
      expect(bleedToggle).not.toBeNull();

      act(() => {
        bleedToggle.click();
      });

      expect(dimensionsBadge.textContent).toContain('2550 × 3750 px @ 300 DPI');
      expect(container.querySelector('[data-testid="bleed-trim-marks-overlay"]')).not.toBeNull();

      // Switch to 36x48 size pill -> 3150 × 4150 px with bleed
      const sizePill36x48 = container.querySelector(
        '[data-testid="modal-size-pill-36x48"]'
      ) as HTMLButtonElement;
      act(() => {
        sizePill36x48.click();
      });
      expect(dimensionsBadge.textContent).toContain('3150 × 4150 px @ 300 DPI');

      // Click Download High-Res Print File (.PNG)
      const downloadBtn = container.querySelector(
        '[data-testid="modal-download-highres-btn"]'
      ) as HTMLButtonElement;
      expect(downloadBtn).not.toBeNull();

      act(() => {
        downloadBtn.click();
      });

      const successBanner = container.querySelector(
        '[data-testid="download-success-banner"]'
      ) as HTMLElement;
      expect(successBanner).not.toBeNull();
      expect(successBanner.textContent).toContain('3150 × 4150 px @ 300 DPI');
      expect(completedDownloads.length).toBe(1);
      expect(completedDownloads[0].orderType).toBe('digital-master-download');
      expect(completedDownloads[0].printMasterWidthPx).toBe(3150);
      expect(completedDownloads[0].printMasterHeightPx).toBe(4150);

      // Also test secondary Download In-Room Space Preview (.PNG) button
      const roomPreviewBtn = container.querySelector(
        '[data-testid="modal-download-room-preview-btn"]'
      ) as HTMLButtonElement;
      act(() => {
        roomPreviewBtn.click();
      });
      expect(getLastTriggeredDownload()?.filename).toContain('in-room-space-preview.png');

      harness.unmount();
    });

    it('supports Multi-Art-Piece selection (Piece 1, Piece 2) and 1-click Download All Art Pieces (300 DPI Set) ([SPEC PATCH #19])', () => {
      const variationWithMultiPieces = createSampleVariation({
        artPieces: [
          {
            id: 'piece-01',
            index: 0,
            title: 'Warm Ochre Diptych I',
            wallLocationLabel: 'Main Sofa Wall',
            description: 'First coordinated impasto study.',
            identicalPrintMasterDataUrl:
              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3600"><rect width="2400" height="3600" fill="%23B85D3B"/></svg>',
            printMasterWidthPx: 2400,
            printMasterHeightPx: 3600,
          },
          {
            id: 'piece-02',
            index: 1,
            title: 'Travertine Sanctuary II',
            wallLocationLabel: 'Adjacent Reading Nook Wall',
            description: 'Second coordinated impasto study.',
            identicalPrintMasterDataUrl:
              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3600"><rect width="2400" height="3600" fill="%232E4A3E"/></svg>',
            printMasterWidthPx: 2400,
            printMasterHeightPx: 3600,
          },
        ],
        activeArtPieceIndex: 0,
      });

      const selectedIndices: number[] = [];
      const completedDownloads: V2OrderConfirmation[] = [];

      const harness = mountElement(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'download-master',
          variation: variationWithMultiPieces,
          sizeId: '24x36',
          onSelectArtPiece: (idx) => selectedIndices.push(idx),
          onDownloadCompleted: (conf) => completedDownloads.push(conf),
        })
      );

      const { container } = harness;

      const selectorStrip = container.querySelector(
        '[data-testid="modal-art-piece-selector"]'
      ) as HTMLElement;
      expect(selectorStrip).not.toBeNull();

      const pill0 = container.querySelector(
        '[data-testid="modal-art-piece-pill-0"]'
      ) as HTMLButtonElement;
      const pill1 = container.querySelector(
        '[data-testid="modal-art-piece-pill-1"]'
      ) as HTMLButtonElement;
      expect(pill0).not.toBeNull();
      expect(pill1).not.toBeNull();

      // Initially Piece 1 is active
      expect(container.querySelector('#acquire-print-modal-title')?.textContent).toBe(
        'Warm Ochre Diptych I'
      );

      // Select Piece 2
      act(() => {
        pill1.click();
      });

      expect(selectedIndices).toEqual([1]);
      expect(container.querySelector('#acquire-print-modal-title')?.textContent).toBe(
        'Travertine Sanctuary II'
      );
      expect(
        container.querySelector('[data-testid="verification-wall-location-badge"]')?.textContent
      ).toContain('Adjacent Reading Nook Wall');

      // Click Download All Art Pieces (300 DPI Set)
      const downloadAllBtn = container.querySelector(
        '[data-testid="modal-download-all-pieces-btn"]'
      ) as HTMLButtonElement;
      expect(downloadAllBtn).not.toBeNull();

      act(() => {
        downloadAllBtn.click();
      });

      expect(completedDownloads.length).toBe(2);
      const successBanner = container.querySelector(
        '[data-testid="download-success-banner"]'
      ) as HTMLElement;
      expect(successBanner).not.toBeNull();
      expect(successBanner.textContent).toContain('2 Archival 300-DPI Print Masters');

      harness.unmount();
    });
  });

  // =========================================================================
  // 7. `AcquirePrintModal` Mode 2 (`order-print`) UI, Partner Selection, Slight-Premium Ledger, Shipping Validation & Order Receipt
  // =========================================================================
  describe('7. AcquirePrintModal Mode 2 (order-print) UI, Partner Selection, Slight-Premium Ledger, Shipping Validation & Order Receipt', () => {
    it('switches to order-print mode, selects partners, adjusts markup presets (15%, 18%, 22%), validates shipping, fills sample address, submits order, and downloads JSON manifest', () => {
      const variation = createSampleVariation();
      const completedOrders: V2OrderConfirmation[] = [];

      const harness = mountElement(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'download-master',
          variation,
          sizeId: '24x36',
          frameId: 'natural-white-oak',
          matWidthId: '2.5in',
          onOrderCompleted: (ord) => completedOrders.push(ord),
        })
      );

      const { container } = harness;

      // Switch to Mode 2 tab
      const orderTab = container.querySelector(
        '[data-testid="tab-order-print"]'
      ) as HTMLButtonElement;
      expect(orderTab).not.toBeNull();

      act(() => {
        orderTab.click();
      });

      expect(container.querySelector('[data-testid="mode-order-print-panel"]')).not.toBeNull();

      // Verify FinerWorks partner selection card exists exclusively (Prodigi & Printful removed per F-19)
      const prodigiCard = container.querySelector(
        '[data-testid="partner-card-prodigi"]'
      );
      const printfulCard = container.querySelector(
        '[data-testid="partner-card-printful"]'
      );
      const finerworksCard = container.querySelector(
        '[data-testid="partner-card-finerworks"]'
      ) as HTMLButtonElement;

      expect(prodigiCard).toBeNull();
      expect(printfulCard).toBeNull();
      expect(finerworksCard.tagName).toBe('BUTTON');

      // Select FinerWorks
      act(() => {
        finerworksCard.click();
      });
      expect(finerworksCard.getAttribute('aria-pressed')).toBe('true');

      // Test markup preset pills (15%, 18%, 22%)
      const markupPill15 = container.querySelector(
        '[data-testid="markup-pill-15"]'
      ) as HTMLButtonElement;
      const markupPill22 = container.querySelector(
        '[data-testid="markup-pill-22"]'
      ) as HTMLButtonElement;
      const markupPill18 = container.querySelector(
        '[data-testid="markup-pill-18"]'
      ) as HTMLButtonElement;

      act(() => {
        markupPill15.click();
      });
      const expectedFw15 = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        glazingId: 'clear-acrylic',
        markupPercent: 15,
      });
      const quote15 = expectedFw15.shippingQuotes.find((q) => q.shippingClassCode === 'SD') ?? expectedFw15.shippingQuotes[0];
      expect(
        container.querySelector('[data-testid="ledger-total-price"]')?.textContent
      ).toBe(`$${quote15.calculatedTotal.orderGrandTotalUsd.toFixed(2)}`);

      act(() => {
        markupPill22.click();
      });
      const expectedFw22 = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        glazingId: 'clear-acrylic',
        markupPercent: 22,
      });
      const quote22 = expectedFw22.shippingQuotes.find((q) => q.shippingClassCode === 'SD') ?? expectedFw22.shippingQuotes[0];
      expect(
        container.querySelector('[data-testid="ledger-total-price"]')?.textContent
      ).toBe(`$${quote22.calculatedTotal.orderGrandTotalUsd.toFixed(2)}`);

      act(() => {
        markupPill18.click();
      });

      // Verify pricing breakdown ledger fields match authoritative FinerWorks v3 breakdown
      const ledger = container.querySelector(
        '[data-testid="pricing-breakdown-ledger"]'
      ) as HTMLElement;
      expect(ledger).not.toBeNull();
      const expectedFw18 = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        glazingId: 'clear-acrylic',
        markupPercent: 18,
      });
      const quote18 = expectedFw18.shippingQuotes.find((q) => q.shippingClassCode === 'SD') ?? expectedFw18.shippingQuotes[0];
      expect(
        container.querySelector('[data-testid="ledger-base-print-cost"]')?.textContent
      ).toBe(`$${expectedFw18.builtProduct.pricing.basePrintPriceUsd.toFixed(2)}`);
      expect(
        container.querySelector('[data-testid="ledger-wholesale-subtotal"]')?.textContent
      ).toBe(`$${expectedFw18.wholesaleTotalUsd.toFixed(2)}`);
      expect(
        container.querySelector('[data-testid="ledger-studio-markup"]')?.textContent
      ).toBe(`+$${expectedFw18.studioMarkupDollarUsd.toFixed(2)}`);
      expect(
        container.querySelector('[data-testid="ledger-total-price"]')?.textContent
      ).toBe(`$${quote18.calculatedTotal.orderGrandTotalUsd.toFixed(2)}`);

      // Submit empty shipping form -> expect validation error alert
      const submitOrderBtn = container.querySelector(
        '[data-testid="submit-partner-order-btn"]'
      ) as HTMLButtonElement;
      expect(submitOrderBtn).not.toBeNull();

      act(() => {
        submitOrderBtn.click();
      });

      const validationError = container.querySelector(
        '[data-testid="shipping-validation-error"]'
      ) as HTMLElement;
      expect(validationError).not.toBeNull();
      expect(completedOrders.length).toBe(0);

      // Click Fill Sample Shipping Address
      const fillSampleBtn = container.querySelector(
        '[data-testid="fill-sample-address-btn"]'
      ) as HTMLButtonElement;
      expect(fillSampleBtn).not.toBeNull();

      act(() => {
        fillSampleBtn.click();
      });

      expect(container.querySelector('[data-testid="shipping-validation-error"]')).toBeNull();

      // Submit valid order
      act(() => {
        submitOrderBtn.click();
      });

      expect(completedOrders.length).toBe(1);
      expect(completedOrders[0].status).toBe('dispatched-to-partner');
      expect(completedOrders[0].pricing.partnerId).toBe('finerworks');

      // Verify Order Confirmation Receipt is rendered
      const receipt = container.querySelector(
        '[data-testid="order-confirmation-receipt"]'
      ) as HTMLElement;
      expect(receipt).not.toBeNull();
      expect(receipt.textContent).toContain('Clara Vance');
      expect(receipt.textContent).toContain('FinerWorks Archival Lab');

      // Click Download Order Manifest (.JSON)
      const downloadManifestBtn = container.querySelector(
        '[data-testid="download-order-manifest-btn"]'
      ) as HTMLButtonElement;
      expect(downloadManifestBtn).not.toBeNull();

      act(() => {
        downloadManifestBtn.click();
      });

      const lastDl = getLastTriggeredDownload();
      expect(lastDl).not.toBeNull();
      expect(lastDl!.filename).toContain('order-manifest.json');
      expect(lastDl!.dataUrl.startsWith('data:application/json')).toBe(true);

      harness.unmount();
    });
  });

  // =========================================================================
  // 8. Strict Zero `<a href>` External Links, Secret-Preserving Terminology, Zero AI Model Announcements & Mobile Ergonomics (`[SPEC PATCH #2]`, `[SPEC PATCH #11]`, `[SPEC PATCH #18]`, `[SPEC PATCH #20]` & `[SPEC PATCH #23]`)
  // =========================================================================
  describe('8. Strict Zero <a href> External Links, Secret-Preserving Terminology, Zero AI Model Announcements & Mobile Ergonomics ([SPEC PATCH #2], [SPEC PATCH #11], [SPEC PATCH #18], [SPEC PATCH #20] & [SPEC PATCH #23])', () => {
    it('renders zero <a> elements, zero internal pipeline words (screenshot/crop/bbox), zero AI model announcements (Astra/Gemini Argon/GPT-6/Nano Banana/OpenRouter), and enforces text-base + min-h-[44px] on all shipping inputs across Mode 1, Mode 2, and Order Receipt states', () => {
      const variation = createSampleVariation();
      const forbiddenPipelineRegex = /\b(screenshot|crop|cropped|cropping|bounding box|bbox)\b/i;
      const forbiddenAiModelRegex = /\b(astra|gemini argon|gpt-6|gemini 4|nano banana|openrouter)\b/i;

      const harness = mountElement(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'download-master',
          variation,
        })
      );

      const { container } = harness;

      // 1. Mode 1 (download-master) zero <a>, secret-preserving text, and zero AI model announcements audit
      expect(container.querySelectorAll('a').length).toBe(0);
      expect(container.textContent || '').not.toMatch(forbiddenPipelineRegex);
      expect(container.textContent || '').not.toMatch(forbiddenAiModelRegex);
      expect(container.textContent || '').toContain('Atelier Vue Original Commission');

      // Verify modal shell mobile bottom-sheet classes
      const dialog = container.querySelector('[data-testid="acquire-print-modal"]') as HTMLElement;
      expect(dialog.className).toContain('rounded-t-[12px]');
      expect(dialog.className).toContain('max-h-[92dvh]');

      // 2. Switch to Mode 2 (order-print) and audit zero <a> + secret-preserving text + zero AI models + mobile input classes
      const orderTab = container.querySelector(
        '[data-testid="tab-order-print"]'
      ) as HTMLButtonElement;
      act(() => {
        orderTab.click();
      });

      expect(container.querySelectorAll('a').length).toBe(0);
      expect(container.textContent || '').not.toMatch(forbiddenPipelineRegex);
      expect(container.textContent || '').not.toMatch(forbiddenAiModelRegex);

      const shippingInputTestIds = [
        'shipping-input-fullName',
        'shipping-input-email',
        'shipping-input-streetAddress',
        'shipping-input-city',
        'shipping-input-stateOrProvince',
        'shipping-input-postalCode',
        'shipping-input-country',
      ];

      for (const testId of shippingInputTestIds) {
        const inputEl = container.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
        expect(inputEl).not.toBeNull();
        expect(inputEl.className).toContain('text-base');
        expect(inputEl.className).toContain('min-h-[44px]');
      }

      // 3. Complete order and verify Order Confirmation Receipt state also has zero <a> tags, zero pipeline jargon & zero AI model names
      const fillBtn = container.querySelector(
        '[data-testid="fill-sample-address-btn"]'
      ) as HTMLButtonElement;
      const submitBtn = container.querySelector(
        '[data-testid="submit-partner-order-btn"]'
      ) as HTMLButtonElement;

      act(() => {
        fillBtn.click();
      });
      act(() => {
        submitBtn.click();
      });

      expect(container.querySelector('[data-testid="order-confirmation-receipt"]')).not.toBeNull();
      expect(container.querySelectorAll('a').length).toBe(0);
      expect(container.textContent || '').not.toMatch(forbiddenPipelineRegex);
      expect(container.textContent || '').not.toMatch(forbiddenAiModelRegex);

      harness.unmount();
    });
  });

  // =========================================================================
  // 9. V2.4 Order-Stage Recommended Print Size Callout & Badge (`[SPEC PATCH #28]`)
  // =========================================================================
  describe('9. V2.4 Order-Stage Recommended Print Size Callout & Badge ([SPEC PATCH #28])', () => {
    it('renders modal-scale-recommendation-banner, recommended-size-badge on the matching size pill, and switches to the recommended size when modal-select-recommended-size-btn is clicked', () => {
      const sampleScaleRecommendation: ScaleCalibrationResult = {
        isCalibrated: true,
        recommendedSizeId: '30x40',
        recommendedSizeSpec: PRINT_SIZES['30x40'],
        recommendedDimensionsLabel: `${PRINT_SIZES['30x40'].labelInches} (${PRINT_SIZES['30x40'].labelCm})`,
        rationale:
          'Calibrated to your 84-inch sofa width using the 0.62 interior design proportion rule.',
        estimatedWallWidthInches: 132,
        estimatedArtworkWidthInches: 30,
        estimatedArtworkHeightInches: 40,
        questionsAnsweredCount: 1,
      };

      const selectedSizes: PrintSizeId[] = [];
      const variation = createSampleVariation({
        scaleRecommendation: sampleScaleRecommendation,
      });

      const harness = mountElement(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'download-master',
          variation,
          sizeId: '24x36',
          scaleRecommendation: sampleScaleRecommendation,
          onSelectSize: (sizeId) => selectedSizes.push(sizeId),
        })
      );

      const { container } = harness;

      // 1. Verify recommendation banner is rendered
      const banner = container.querySelector(
        '[data-testid="modal-scale-recommendation-banner"]'
      ) as HTMLElement;
      expect(banner).not.toBeNull();
      expect(banner.textContent).toContain(
        `★ Recommended Size Based on Your Room Measurements: ${sampleScaleRecommendation.recommendedDimensionsLabel}`
      );
      expect(banner.textContent).toContain(sampleScaleRecommendation.rationale);

      // 2. Verify ★ Recommended badge is rendered on the 30x40 size pill
      const pill30x40 = container.querySelector(
        '[data-testid="modal-size-pill-30x40"]'
      ) as HTMLButtonElement;
      expect(pill30x40).not.toBeNull();
      const badge = pill30x40.querySelector(
        '[data-testid="recommended-size-badge"]'
      ) as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain('★ Recommended');

      // 3. Verify 1-click Switch to Recommended button is shown when 24x36 != 30x40
      const switchBtn = container.querySelector(
        '[data-testid="modal-select-recommended-size-btn"]'
      ) as HTMLButtonElement;
      expect(switchBtn).not.toBeNull();
      expect(switchBtn.textContent).toContain(
        `Switch to Recommended ${sampleScaleRecommendation.recommendedDimensionsLabel}`
      );

      // 4. Click Switch to Recommended button -> updates selected size to 30x40 and hides switch button
      act(() => {
        switchBtn.click();
      });

      expect(selectedSizes).toContain('30x40');
      expect(
        container.querySelector('[data-testid="print-master-dimensions"]')?.textContent
      ).toContain('2700 × 3600 px @ 300 DPI');
      expect(
        container.querySelector('[data-testid="modal-select-recommended-size-btn"]')
      ).toBeNull();

      // 5. Switch to Mode 2 (order-print) and verify badge & banner remain visible and zero <a> tags exist
      const orderTab = container.querySelector(
        '[data-testid="tab-order-print"]'
      ) as HTMLButtonElement;
      act(() => {
        orderTab.click();
      });

      expect(
        container.querySelector('[data-testid="modal-scale-recommendation-banner"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="recommended-size-badge"]')
      ).not.toBeNull();
      expect(container.querySelectorAll('a').length).toBe(0);

      harness.unmount();
    });
  });

  // =========================================================================
  // 10. FinerWorks v3 Pricing, Carrier Shipping, Address Validation & Order Submission Engine
  // =========================================================================
  describe('10. FinerWorks v3 Pricing, Carrier Shipping, Address Validation & Order Submission Engine', () => {
    beforeEach(() => {
      setActiveWhiteLabelBrand(DEFAULT_WHITE_LABEL_BRAND_ID);
    });

    it('calculates FinerWorks v3 breakdown across standard sizes, custom dimensions, framing, matting, glazing, volume discounts (qty 1, 2, 5, 10), and shipping classes (EC, SD, EX, ON)', () => {
      const stdBreakdown = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        matColorId: 'archival-ivory',
        substrateId: 'hahnemuhle-etching-310gsm',
        glazingId: 'clear-acrylic',
        quantity: 1,
        markupPercent: 18,
        shippingClassCode: 'SD',
        stateCode: 'NY',
      });

      expect(stdBreakdown.builtProduct.productCode).toContain('5M42');
      expect(stdBreakdown.builtProduct.productCode).toContain('S24X36');
      expect(stdBreakdown.builtProduct.productCode).toContain('F131');
      expect(stdBreakdown.shippingQuotes.length).toBe(4);
      expect(stdBreakdown.shippingQuotes.map((q) => q.shippingClassCode)).toEqual([
        'EC',
        'SD',
        'EX',
        'ON',
      ]);
      expect(stdBreakdown.selectedShippingQuote.shippingClassCode).toBe('SD');
      expect(stdBreakdown.retailSubtotalUsd).toBe(
        roundCents(stdBreakdown.wholesaleTotalUsd + stdBreakdown.studioMarkupDollarUsd)
      );
      expect(stdBreakdown.grandTotalUsd).toBe(
        roundCents(
          stdBreakdown.retailSubtotalUsd +
            stdBreakdown.shippingRateUsd +
            stdBreakdown.salesTaxUsd
        )
      );

      // Custom caliper dimensions (e.g. 26" x 38")
      const customBreakdown = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        customWidthIn: 26,
        customHeightIn: 38,
        frameId: 'american-black-walnut',
        matWidthId: '1.5in',
        glazingId: 'non-glare-museum-acrylic',
        quantity: 1,
        shippingClassCode: 'EX',
      });
      expect(customBreakdown.builtProduct.physicalDimensions.printWidthIn).toBe(26);
      expect(customBreakdown.builtProduct.physicalDimensions.printHeightIn).toBe(38);
      expect(customBreakdown.builtProduct.productCode).toContain('S26X38');
      expect(customBreakdown.selectedShippingQuote.shippingClassCode).toBe('EX');

      // Volume discount tiers: 1 (0%), 2 (5%), 5 (10%), 10 (15%)
      const qty1 = calculateFinerWorksOrderBreakdown({
        sizeId: '18x24',
        frameId: 'unframed-canvas',
        matWidthId: 'none',
        quantity: 1,
      });
      const qty2 = calculateFinerWorksOrderBreakdown({
        sizeId: '18x24',
        frameId: 'unframed-canvas',
        matWidthId: 'none',
        quantity: 2,
      });
      const qty5 = calculateFinerWorksOrderBreakdown({
        sizeId: '18x24',
        frameId: 'unframed-canvas',
        matWidthId: 'none',
        quantity: 5,
      });
      const qty10 = calculateFinerWorksOrderBreakdown({
        sizeId: '18x24',
        frameId: 'unframed-canvas',
        matWidthId: 'none',
        quantity: 10,
      });

      expect(qty1.builtProduct.pricing.volumeDiscountPercent).toBe(0);
      expect(qty2.builtProduct.pricing.volumeDiscountPercent).toBe(5);
      expect(qty5.builtProduct.pricing.volumeDiscountPercent).toBe(10);
      expect(qty10.builtProduct.pricing.volumeDiscountPercent).toBe(15);
      expect(qty10.wholesaleTotalUsd / 10).toBeLessThan(qty1.wholesaleTotalUsd);

      // Verify all 4 shipping classes (EC, SD, EX, ON) increase in speed/cost
      const shipEc = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        shippingClassCode: 'EC',
      });
      const shipOn = calculateFinerWorksOrderBreakdown({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        shippingClassCode: 'ON',
      });
      expect(shipEc.selectedShippingQuote.shippingClassCode).toBe('EC');
      expect(shipOn.selectedShippingQuote.shippingClassCode).toBe('ON');
      expect(shipOn.shippingRateUsd).toBeGreaterThan(shipEc.shippingRateUsd);
    });

    it('validates recipient addresses via validateFinerWorksRecipientAddress and submits FinerWorks v3 orders with 50-char title truncation, test_mode: true, payment_token: "xxxx", white-label COA/packing slip, and zero URLs in manifest', async () => {
      const invalidCheck = await validateFinerWorksRecipientAddress(EMPTY_SHIPPING_ADDRESS);
      expect(invalidCheck.valid).toBe(false);
      expect(Object.keys(invalidCheck.errors).length).toBeGreaterThan(0);

      const validCheck = await validateFinerWorksRecipientAddress(SAMPLE_SHIPPING_ADDRESS);
      expect(validCheck.valid).toBe(true);
      expect(validCheck.normalizedAddress.stateOrProvince).toBe('NY');
      expect(validCheck.finerworksStatus).toContain('Verified');

      const longTitleVariation = createSampleVariation({
        artworkTitle:
          'Monumental Terracotta & Sunlit Travertine Horizon Study With Extended Curatorial Subtitle Beyond Fifty Characters',
      });

      const confirmation = await submitFinerWorksPrintOrder({
        variation: longTitleVariation,
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        matColorId: 'archival-ivory',
        substrateId: 'hahnemuhle-etching-310gsm',
        glazingId: 'clear-acrylic',
        shippingAddress: SAMPLE_SHIPPING_ADDRESS,
        shippingCode: 'EX',
        giftMessage: 'For the Mercer Street Architectural Collection.',
        brandId: 'galerie-vauban',
        testMode: true,
        markupPercent: 18,
        quantity: 2,
      });

      expect(confirmation.artworkTitle.length).toBeLessThanOrEqual(50);
      expect(confirmation.whiteLabelBrandName).toBe('Galerie Vauban');
      expect(confirmation.finerworksProductCode).toContain('5M42');
      expect(confirmation.shippingCarrier).toBe('FedEx');
      expect(confirmation.packingSlipHtml).toContain('GALERIE VAUBAN');
      expect(confirmation.packingSlipHtml).toContain('data-logo-dimensions="600x180"');
      expect(confirmation.packingSlipHtml.toLowerCase()).not.toContain('finerworks');
      expect(confirmation.coaHtml).toContain('Henri Delacroix');
      expect(confirmation.coaHtml.toLowerCase()).not.toContain('finerworks');
      expect(confirmation.partnerOrderManifestJson).not.toContain('http://');
      expect(confirmation.partnerOrderManifestJson).not.toContain('https://');

      const parsedManifest = JSON.parse(confirmation.partnerOrderManifestJson);
      expect(parsedManifest.test_mode).toBe(true);
      expect(parsedManifest.payment_token).toBe('xxxx');
      expect(parsedManifest.product_title.length).toBeLessThanOrEqual(50);
      expect(parsedManifest.logo_dims).toBe('600x180');
      expect(parsedManifest.coa.brandId).toBe('galerie-vauban');
    });
  });

  // =========================================================================
  // 11. AcquirePrintModal FinerWorks v3 Checkout, Brand Picker, Carrier Rates & Packing Slip Preview
  // =========================================================================
  describe('11. AcquirePrintModal FinerWorks v3 Checkout, Brand Picker, Carrier Rates & Packing Slip Preview', () => {
    it('supports switching brands via checkout-brand-picker-select, viewing checkout-finerworks-product-code, selecting carrier shipping options (EC, SD, EX, ON), entering a gift note, and toggling white-label-packing-slip-preview', () => {
      setActiveWhiteLabelBrand('atelier-koma');
      const variation = createSampleVariation();
      const forbiddenPipelineRegex = /\b(screenshot|crop|cropped|cropping|bounding box|bbox)\b/i;
      const forbiddenAiModelRegex = /\b(astra|gemini argon|gpt-6|gemini 4|nano banana|openrouter)\b/i;

      const harness = mountElement(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'order-print',
          variation,
          sizeId: '24x36',
          frameId: 'natural-white-oak',
          matWidthId: '2.5in',
        })
      );

      const { container } = harness;

      // 1. Verify FinerWorks SKU product code badge is displayed
      const skuBadge = container.querySelector(
        '[data-testid="checkout-finerworks-product-code"]'
      ) as HTMLElement;
      expect(skuBadge).not.toBeNull();
      expect(skuBadge.textContent).toContain('5M42');

      // 2. Switch white-label brand via checkout-brand-picker-select
      const brandSelect = container.querySelector(
        '[data-testid="checkout-brand-picker-select"]'
      ) as HTMLSelectElement;
      expect(brandSelect).not.toBeNull();
      expect(brandSelect.value).toBe('atelier-koma');

      act(() => {
        brandSelect.value = 'stillwater-press';
        brandSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(brandSelect.value).toBe('stillwater-press');
      expect(container.textContent).toContain('Stillwater Press');

      // 3. Verify all 4 carrier shipping options (EC, SD, EX, ON) exist and are selectable
      const shippingGroup = container.querySelector(
        '[data-testid="finerworks-shipping-options-group"]'
      );
      expect(shippingGroup).not.toBeNull();

      for (const code of ['EC', 'SD', 'EX', 'ON'] as const) {
        const optionBtn = container.querySelector(
          `[data-testid="shipping-option-${code}"]`
        ) as HTMLButtonElement;
        expect(optionBtn).not.toBeNull();
        act(() => {
          optionBtn.click();
        });
        expect(optionBtn.getAttribute('aria-pressed')).toBe('true');
      }

      // 4. Enter collector gift note
      const giftInput = container.querySelector(
        '[data-testid="checkout-gift-message-input"]'
      ) as HTMLInputElement;
      expect(giftInput).not.toBeNull();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      act(() => {
        nativeInputValueSetter?.call(
          giftInput,
          'Dedicated to the Hudson River Private Collection'
        );
        giftInput.dispatchEvent(new Event('input', { bubbles: true }));
        giftInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(giftInput.value).toBe('Dedicated to the Hudson River Private Collection');

      // 5. Toggle white-label packing slip & COA preview
      const togglePreviewBtn = container.querySelector(
        '[data-testid="toggle-packing-slip-preview-btn"]'
      ) as HTMLButtonElement;
      expect(togglePreviewBtn).not.toBeNull();
      expect(
        container.querySelector('[data-testid="white-label-packing-slip-preview"]')
      ).toBeNull();

      act(() => {
        togglePreviewBtn.click();
      });

      const previewContainer = container.querySelector(
        '[data-testid="white-label-packing-slip-preview"]'
      ) as HTMLElement;
      expect(previewContainer).not.toBeNull();
      expect(previewContainer.innerHTML).toContain('width="600"');
      expect(previewContainer.innerHTML).toContain('height="180"');
      expect(previewContainer.textContent).toContain('STILLWATER PRESS');
      expect(previewContainer.textContent).toContain(
        'Dedicated to the Hudson River Private Collection'
      );

      // Verify zero <a> tags and zero forbidden AI/pipeline terms
      expect(container.querySelectorAll('a').length).toBe(0);
      expect(container.textContent || '').not.toMatch(forbiddenPipelineRegex);
      expect(container.textContent || '').not.toMatch(forbiddenAiModelRegex);

      harness.unmount();
    });
  });

  // =========================================================================
  // 12. FinerWorksBrandAndSyncModal 5-Brand Identity Picker & Auto-Sync Status Studio
  // =========================================================================
  describe('12. FinerWorksBrandAndSyncModal 5-Brand Identity Picker & Auto-Sync Status Studio', () => {
    it('switches between all 5 white-label gallery brands, updates live 600x180 packing slip & COA previews, switches to tab-finerworks-sync-status, filters catalog items, and triggers manual sync', async () => {
      setActiveWhiteLabelBrand('atelier-koma');
      const selectedBrands: string[] = [];
      let syncCompletedCount = 0;

      const harness = mountElement(
        React.createElement(FinerWorksBrandAndSyncModal, {
          isOpen: true,
          onSelectBrand: (brand) => selectedBrands.push(brand.id),
          onSyncCatalogNow: () => {
            syncCompletedCount++;
          },
        })
      );

      const { container } = harness;

      expect(
        container.querySelector('[data-testid="finerworks-brand-and-sync-modal"]')
      ).not.toBeNull();

      // 1. Verify all 5 brand cards exist and can be clicked
      for (const brand of WHITE_LABEL_BRAND_LIST) {
        const cardBtn = container.querySelector(
          `[data-testid="brand-option-card-${brand.id}"]`
        ) as HTMLButtonElement;
        expect(cardBtn).not.toBeNull();

        act(() => {
          cardBtn.click();
        });

        expect(cardBtn.getAttribute('aria-pressed')).toBe('true');

        const slipPreview = container.querySelector(
          '[data-testid="brand-modal-packing-slip-preview"]'
        ) as HTMLElement;
        const coaPreview = container.querySelector(
          '[data-testid="brand-modal-coa-preview"]'
        ) as HTMLElement;

        expect(slipPreview).not.toBeNull();
        expect(coaPreview).not.toBeNull();
        expect(slipPreview.textContent).toContain(brand.businessInfo.company_name);
        expect(coaPreview.textContent).toContain(brand.coaSpec.chiefCuratorName);
        expect(slipPreview.textContent?.toLowerCase()).not.toContain('finerworks');
        expect(coaPreview.textContent?.toLowerCase()).not.toContain('finerworks');
      }

      expect(selectedBrands).toEqual([
        'atelier-koma',
        'galerie-vauban',
        'werkstatt-neue',
        'stillwater-press',
        'the-nocturne-archive',
      ]);

      // 2. Switch to FinerWorks v3 Catalog & Price Sync tab
      const syncTabBtn = container.querySelector(
        '[data-testid="tab-finerworks-sync-status"]'
      ) as HTMLButtonElement;
      expect(syncTabBtn).not.toBeNull();

      act(() => {
        syncTabBtn.click();
      });

      expect(
        container.querySelector('[data-testid="finerworks-sync-metrics-grid"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="finerworks-media-specs-list"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="finerworks-frame-mouldings-list"]')
      ).not.toBeNull();

      // 3. Filter catalog items via finerworks-catalog-search-input
      const searchInput = container.querySelector(
        '[data-testid="finerworks-catalog-search-input"]'
      ) as HTMLInputElement;
      expect(searchInput).not.toBeNull();

      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      act(() => {
        nativeSetter?.call(searchInput, 'ChromaLuxe');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      const mediaList = container.querySelector(
        '[data-testid="finerworks-media-specs-list"]'
      ) as HTMLElement;
      expect(mediaList.textContent).toContain('ChromaLuxe');
      expect(mediaList.textContent).toContain('2 of 10');

      // 4. Trigger manual FinerWorks catalog sync
      const triggerSyncBtn = container.querySelector(
        '[data-testid="trigger-finerworks-sync-btn"]'
      ) as HTMLButtonElement;
      expect(triggerSyncBtn).not.toBeNull();

      await act(async () => {
        triggerSyncBtn.click();
      });

      expect(syncCompletedCount).toBe(1);
      expect(container.querySelectorAll('a').length).toBe(0);

      harness.unmount();
    });
  });
});


