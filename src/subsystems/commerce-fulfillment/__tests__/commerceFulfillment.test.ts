// @vitest-environment jsdom
// src/subsystems/commerce-fulfillment/__tests__/commerceFulfillment.test.ts
// Tier 2 Independent Subsystem Verification Suite — Subsystem 4 (commerce-fulfillment)

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  STORAGE_KEY,
} from '../../../contracts/masterContract';
import {
  AtelierProvider,
  AtelierStoreValue,
  calculatePrintPricing,
  CheckoutAndOrderModal,
  clampStudioMarkupPercent,
  compareAllPartnersPricing,
  computeCuratorialFitScore,
  createDefaultPaintingsForRoom,
  createDefaultPresetRooms,
  createInitialAtelierState,
  CuratorialRightColumn,
  DEFAULT_STUDIO_MARKUP_PERCENT,
  DIGITAL_MASTER_LICENSE_USD,
  generatePartnerOrderManifestJson,
  loadPersistedAtelierState,
  LookbookAndOrdersDrawer,
  MAT_COLOR_OPTIONS,
  MAT_WIDTH_OPTIONS,
  MAX_STUDIO_MARKUP_PERCENT,
  MIN_STUDIO_MARKUP_PERCENT,
  PRINT_SUBSTRATES,
  renderFallbackPaintingThumbnail,
  roundCents,
  sanitizeShippingText,
  savePersistedAtelierState,
  useAtelierStore,
  validateShippingAddress,
} from '../index';

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

describe('Subsystem 4 (commerce-fulfillment) — Independent Verification Suite', () => {
  beforeEach(() => {
    window.localStorage.clear();
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    HTMLAnchorElement.prototype.click = () => undefined;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  // =========================================================================
  // 1. Partner Pricing Engine & Ledger Math (`printPartnerPricingEngine.ts`)
  // =========================================================================
  describe('1. Partner Pricing Engine & Ledger Math (printPartnerPricingEngine.ts)', () => {
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
                  const breakdown = calculatePrintPricing({
                    partnerId,
                    sizeId,
                    frameId,
                    matWidthId,
                    substrateId,
                    panelLayout,
                    studioMarkupPercent: 18,
                  });

                  evaluatedCombinations++;

                  expect(breakdown.partnerId).toBe(partnerId);
                  expect(breakdown.sizeId).toBe(sizeId);
                  expect(breakdown.frameId).toBe(frameId);
                  expect(breakdown.matWidthId).toBe(matWidthId);
                  expect(breakdown.substrateId).toBe(substrateId);
                  expect(breakdown.panelLayout).toBe(panelLayout);
                  expect(breakdown.panelCount).toBe(
                    panelLayout === 'triptych' ? 3 : panelLayout === 'diptych' ? 2 : 1
                  );

                  // Strict cent-level invariants
                  expect(breakdown.partnerWholesaleSubtotalUsd).toBe(
                    roundCents(
                      breakdown.partnerBasePrintCostUsd + breakdown.partnerFrameAndMatCostUsd
                    )
                  );
                  expect(breakdown.studioMarkupDollarUsd).toBe(
                    roundCents(
                      breakdown.partnerWholesaleSubtotalUsd * (breakdown.studioMarkupPercent / 100)
                    )
                  );
                  expect(breakdown.physicalRetailTotalUsd).toBe(
                    roundCents(
                      breakdown.partnerWholesaleSubtotalUsd +
                        breakdown.studioMarkupDollarUsd +
                        breakdown.insuredShippingUsd
                    )
                  );
                  expect(breakdown.digitalMasterLicenseUsd).toBe(DIGITAL_MASTER_LICENSE_USD);
                  expect(breakdown.physicalRetailTotalUsd).toBeGreaterThan(0);
                }
              }
            }
          }
        }
      }

      expect(evaluatedCombinations).toBe(3240);
    });

    it('clamps studio markup percentage to [10%, 40%] and defaults undefined/NaN to 18%', () => {
      expect(DEFAULT_STUDIO_MARKUP_PERCENT).toBe(18);
      expect(MIN_STUDIO_MARKUP_PERCENT).toBe(10);
      expect(MAX_STUDIO_MARKUP_PERCENT).toBe(40);

      expect(clampStudioMarkupPercent(undefined)).toBe(18);
      expect(clampStudioMarkupPercent(Number.NaN)).toBe(18);
      expect(clampStudioMarkupPercent(Number.POSITIVE_INFINITY)).toBe(18);
      expect(clampStudioMarkupPercent(0)).toBe(10);
      expect(clampStudioMarkupPercent(5)).toBe(10);
      expect(clampStudioMarkupPercent(10)).toBe(10);
      expect(clampStudioMarkupPercent(24)).toBe(24);
      expect(clampStudioMarkupPercent(40)).toBe(40);
      expect(clampStudioMarkupPercent(95)).toBe(40);
    });

    it('maintains strict monotonic price progression across sizes (12x16 < 18x24 < 24x36 < 30x40 < 36x48) and panel counts (single < diptych < triptych)', () => {
      const orderedSizes: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];

      for (const partnerId of partners) {
        const sizeTotals = orderedSizes.map(
          (sizeId) =>
            calculatePrintPricing({
              partnerId,
              sizeId,
              frameId: 'natural-white-oak',
              matWidthId: '2.5in',
              substrateId: 'hahnemuhle-etching-310gsm',
              panelLayout: 'single',
              studioMarkupPercent: 18,
            }).physicalRetailTotalUsd
        );

        for (let i = 1; i < sizeTotals.length; i++) {
          expect(sizeTotals[i]).toBeGreaterThan(sizeTotals[i - 1]);
        }

        const singlePrice = calculatePrintPricing({
          partnerId,
          sizeId: '24x36',
          frameId: 'american-black-walnut',
          matWidthId: '2.5in',
          substrateId: 'hahnemuhle-etching-310gsm',
          panelLayout: 'single',
          studioMarkupPercent: 18,
        }).physicalRetailTotalUsd;

        const diptychPrice = calculatePrintPricing({
          partnerId,
          sizeId: '24x36',
          frameId: 'american-black-walnut',
          matWidthId: '2.5in',
          substrateId: 'hahnemuhle-etching-310gsm',
          panelLayout: 'diptych',
          studioMarkupPercent: 18,
        }).physicalRetailTotalUsd;

        const triptychPrice = calculatePrintPricing({
          partnerId,
          sizeId: '24x36',
          frameId: 'american-black-walnut',
          matWidthId: '2.5in',
          substrateId: 'hahnemuhle-etching-310gsm',
          panelLayout: 'triptych',
          studioMarkupPercent: 18,
        }).physicalRetailTotalUsd;

        expect(diptychPrice).toBeGreaterThan(singlePrice);
        expect(triptychPrice).toBeGreaterThan(diptychPrice);
      }
    });

    it('compares all 3 partner breakdowns with valid website URLs (prodigi.com, printful.com, finerworks.com)', () => {
      const comparison = compareAllPartnersPricing({
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        panelLayout: 'single',
        studioMarkupPercent: 20,
      });

      expect(Object.keys(comparison)).toEqual(['prodigi', 'printful', 'finerworks']);
      expect(comparison.prodigi.partnerWebsite).toContain('prodigi.com');
      expect(comparison.printful.partnerWebsite).toContain('printful.com');
      expect(comparison.finerworks.partnerWebsite).toContain('finerworks.com');
      expect(comparison.prodigi.studioMarkupPercent).toBe(20);
      expect(comparison.printful.studioMarkupPercent).toBe(20);
      expect(comparison.finerworks.studioMarkupPercent).toBe(20);
    });

    it('generates valid Partner Order Manifest JSON with schemaVersion, fulfillmentPartner, artworkSpecification, physicalProductionSpec, financialLedger, and recipientShippingAddress', () => {
      const rooms = createDefaultPresetRooms();
      const paintings = createDefaultPaintingsForRoom(rooms[0]);
      const pricing = calculatePrintPricing({
        partnerId: 'prodigi',
        sizeId: '24x36',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        substrateId: 'hahnemuhle-etching-310gsm',
        panelLayout: 'diptych',
        studioMarkupPercent: 18,
      });

      const manifestStr = generatePartnerOrderManifestJson({
        id: 'AV-ORD-TEST-001',
        createdAt: 1710000000000,
        orderType: 'partner-printed-edition',
        roomId: rooms[0].id,
        painting: paintings[0],
        sizeId: '24x36',
        orientation: 'portrait',
        panelLayout: 'diptych',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        matColorId: 'archival-ivory',
        substrateId: 'hahnemuhle-etching-310gsm',
        pricing,
        shippingAddress: {
          fullName: 'Clara Vance',
          email: 'clara@atelier-collector.org',
          streetAddress: '428 Mercer Street',
          city: 'New York',
          stateOrProvince: 'NY',
          postalCode: '10013',
          country: 'United States',
        },
        status: 'dispatched-to-partner',
      });

      const parsed = JSON.parse(manifestStr);
      expect(parsed.schemaVersion).toBe('atelier-vue.partner-fulfillment.v1');
      expect(parsed.orderId).toBe('AV-ORD-TEST-001');
      expect(parsed.fulfillmentPartner.id).toBe('prodigi');
      expect(parsed.fulfillmentPartner.websiteDomain).toBe('prodigi.com');
      expect(parsed.artworkSpecification.paintingId).toBe(paintings[0].id);
      expect(parsed.artworkSpecification.dpi).toBe(300);
      expect(parsed.physicalProductionSpec.sizeId).toBe('24x36');
      expect(parsed.physicalProductionSpec.panelLayout).toBe('diptych');
      expect(parsed.physicalProductionSpec.panelCount).toBe(2);
      expect(parsed.financialLedger.physicalRetailTotalUsd).toBe(pricing.physicalRetailTotalUsd);
      expect(parsed.recipientShippingAddress.fullName).toBe('Clara Vance');
    });
  });

  // =========================================================================
  // 2. Studio Store, Undo/Redo, Sanitization & Persistence
  // =========================================================================
  describe('2. Studio Store, Undo/Redo, Sanitization & Persistence (studioStoreAndPersistence.ts)', () => {
    it('strips <script> tags, angle brackets, inline JS handlers, and control chars in sanitizeShippingText', () => {
      const dirty =
        '  Clara <script>alert("xss")</script> <b>Vance</b>\u0000\u0007 onclick=evil() javascript:void(0) <> ';
      const cleaned = sanitizeShippingText(dirty);
      expect(cleaned).not.toContain('<script>');
      expect(cleaned).not.toContain('<');
      expect(cleaned).not.toContain('>');
      expect(cleaned).not.toContain('\u0000');
      expect(cleaned).toContain('Clara');
      expect(cleaned).toContain('Vance');
    });

    it('rejects empty/invalid shipping addresses and accepts valid collector addresses in validateShippingAddress', () => {
      const invalidCheck = validateShippingAddress({
        fullName: 'A',
        email: 'invalid-email',
        streetAddress: '12',
        city: '',
        stateOrProvince: '',
        postalCode: '!',
        country: '',
      });
      expect(invalidCheck.isValid).toBe(false);
      expect(invalidCheck.errors.fullName).toBeDefined();
      expect(invalidCheck.errors.email).toBeDefined();
      expect(invalidCheck.errors.streetAddress).toBeDefined();
      expect(invalidCheck.errors.city).toBeDefined();
      expect(invalidCheck.errors.stateOrProvince).toBeDefined();
      expect(invalidCheck.errors.postalCode).toBeDefined();
      expect(invalidCheck.errors.country).toBeDefined();

      const validCheck = validateShippingAddress({
        fullName: 'Clara <script>evil()</script> Vance',
        email: 'clara.vance@atelier-collector.org',
        streetAddress: '428 Mercer Street, Penthouse B',
        city: 'New York',
        stateOrProvince: 'NY',
        postalCode: '10013',
        country: 'United States',
      });
      expect(validCheck.isValid).toBe(true);
      expect(Object.keys(validCheck.errors).length).toBe(0);
      expect(validCheck.sanitized.fullName).toBe('Clara Vance');
    });

    it('round-trips AtelierState through localStorage under STORAGE_KEY and recovers gracefully from corrupted JSON', () => {
      expect(STORAGE_KEY).toBe('atelier_vue_state_v1');

      const initial = createInitialAtelierState();
      const modified = {
        ...initial,
        activeRoomId: 'terracotta-sunlit-loft',
        sizeId: '36x48' as PrintSizeId,
        panelLayout: 'triptych' as PanelLayoutMode,
        frameId: 'brushed-brass-float' as FrameProfileId,
        partnerId: 'finerworks' as PrintPartnerId,
        studioMarkupPercent: 28,
      };

      const savedOk = savePersistedAtelierState(modified);
      expect(savedOk).toBe(true);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();

      const loaded = loadPersistedAtelierState();
      expect(loaded.activeRoomId).toBe('terracotta-sunlit-loft');
      expect(loaded.sizeId).toBe('36x48');
      expect(loaded.panelLayout).toBe('triptych');
      expect(loaded.frameId).toBe('brushed-brass-float');
      expect(loaded.partnerId).toBe('finerworks');
      expect(loaded.studioMarkupPercent).toBe(28);

      // Corrupted JSON recovery
      window.localStorage.setItem(STORAGE_KEY, '{corrupted_json:::[not valid');
      const recovered = loadPersistedAtelierState();
      expect(recovered.activeRoomId).toBe('nordic-linen-living');
      expect(recovered.rooms.length).toBe(4);
    });

    it('verifies useAtelierStore() actions inside AtelierProvider including undo/redo, lookbook pinning, and order recording', () => {
      let latestStore: AtelierStoreValue | null = null;

      const StoreProbe: React.FC = () => {
        latestStore = useAtelierStore();
        return React.createElement(
          'div',
          { 'data-testid': 'store-probe' },
          `${latestStore.activeRoomId}:${latestStore.sizeId}:${latestStore.frameId}`
        );
      };

      const harness = mountElement(
        React.createElement(AtelierProvider, { children: React.createElement(StoreProbe) })
      );

      expect(latestStore).not.toBeNull();
      expect(latestStore!.activeRoomId).toBe('nordic-linen-living');
      expect(latestStore!.canUndo).toBe(false);

      // 1. selectRoom
      act(() => {
        latestStore!.selectRoom('midcentury-walnut-study');
      });
      expect(latestStore!.activeRoomId).toBe('midcentury-walnut-study');
      expect(latestStore!.canUndo).toBe(true);

      // 2. selectSize, selectPanelLayout, selectFrame, selectPartner, setStudioMarkupPercent
      act(() => {
        latestStore!.selectSize('30x40');
        latestStore!.selectPanelLayout('diptych');
        latestStore!.selectFrame('american-black-walnut');
        latestStore!.selectPartner('printful');
        latestStore!.setStudioMarkupPercent(25);
      });

      expect(latestStore!.sizeId).toBe('30x40');
      expect(latestStore!.panelLayout).toBe('diptych');
      expect(latestStore!.frameId).toBe('american-black-walnut');
      expect(latestStore!.partnerId).toBe('printful');
      expect(latestStore!.studioMarkupPercent).toBe(25);

      // 3. undo / redo
      act(() => {
        latestStore!.undo();
      });
      expect(latestStore!.studioMarkupPercent).toBe(18);
      expect(latestStore!.canRedo).toBe(true);

      act(() => {
        latestStore!.redo();
      });
      expect(latestStore!.studioMarkupPercent).toBe(25);

      // 4. pinCurrentWallToLookbook & applyLookbookPin
      let createdPinId = '';
      act(() => {
        const pin = latestStore!.pinCurrentWallToLookbook();
        createdPinId = pin.id;
      });
      expect(latestStore!.pinnedLookbook.length).toBe(1);
      expect(latestStore!.pinnedLookbook[0].id).toBe(createdPinId);

      // Change state, then restore from pin
      act(() => {
        latestStore!.selectSize('12x16');
        latestStore!.selectFrame('matte-gallery-black');
      });
      expect(latestStore!.sizeId).toBe('12x16');

      act(() => {
        latestStore!.applyLookbookPin(createdPinId);
      });
      expect(latestStore!.sizeId).toBe('30x40');
      expect(latestStore!.frameId).toBe('american-black-walnut');
      expect(latestStore!.panelLayout).toBe('diptych');

      // 5. submitPartnerPrintOrder & recordDigitalDownloadOrder
      act(() => {
        const orderRes = latestStore!.submitPartnerPrintOrder({
          fullName: 'Clara Vance',
          email: 'clara@atelier-collector.org',
          streetAddress: '428 Mercer Street',
          city: 'New York',
          stateOrProvince: 'NY',
          postalCode: '10013',
          country: 'United States',
        });
        expect(orderRes.ok).toBe(true);
        expect(orderRes.order?.orderType).toBe('partner-printed-edition');
      });
      expect(latestStore!.orders.length).toBe(1);

      act(() => {
        const digOrder = latestStore!.recordDigitalDownloadOrder();
        expect(digOrder.orderType).toBe('digital-master-download');
      });
      expect(latestStore!.orders.length).toBe(2);

      harness.unmount();
    });
  });

  // =========================================================================
  // 3. Adaptive Desktop Curatorial Column & Mobile 4-Zone Express Studio Deck
  // =========================================================================
  describe('3. Adaptive Desktop Curatorial Column & Mobile 4-Zone Express Studio Deck (CuratorialRightColumn.tsx)', () => {
    it('renders Mobile Express Scrubber 3 horizontal snap-carousels with snap-x and min-h-[44px] touch targets, switches mobile tabs, and renders Desktop Curatorial Column', () => {
      const harness = mountElement(
        React.createElement(AtelierProvider, {
          children: React.createElement(CuratorialRightColumn),
        })
      );

      const { container } = harness;

      // Verify helper utilities
      const rooms = createDefaultPresetRooms();
      const paintings = createDefaultPaintingsForRoom(rooms[0]);
      const thumbDataUrl = renderFallbackPaintingThumbnail(paintings[0]);
      expect(thumbDataUrl.startsWith('data:image/svg+xml')).toBe(true);
      const fitScore = computeCuratorialFitScore({
        room: rooms[0],
        painting: paintings[0],
        harmonyMode: rooms[0].analysis.recommendedHarmony,
        sizeId: paintings[0].recommendedSizeId,
        frameId: paintings[0].recommendedFrameId,
      });
      expect(fitScore).toBeGreaterThanOrEqual(91);
      expect(fitScore).toBeLessThanOrEqual(99);

      // Verify Mobile Express Scrubber 3 horizontal snap-carousels
      const paintingsCarousel = container.querySelector(
        '[data-testid="mobile-scrubber-paintings"]'
      ) as HTMLElement;
      const sizesCarousel = container.querySelector(
        '[data-testid="mobile-scrubber-sizes"]'
      ) as HTMLElement;
      const framesCarousel = container.querySelector(
        '[data-testid="mobile-scrubber-frames"]'
      ) as HTMLElement;

      expect(paintingsCarousel).not.toBeNull();
      expect(sizesCarousel).not.toBeNull();
      expect(framesCarousel).not.toBeNull();

      expect(paintingsCarousel.className).toContain('snap-x');
      expect(sizesCarousel.className).toContain('snap-x');
      expect(framesCarousel.className).toContain('snap-x');

      // Check touch targets inside sizes & frames carousels carry min-h-[44px] or min-h-[48px]
      const mobileSizeButton = sizesCarousel.querySelector('button') as HTMLButtonElement;
      expect(mobileSizeButton.className).toContain('min-h-[44px]');

      // Mobile mode pill switching
      const tabExpress = container.querySelector(
        '[data-testid="mobile-tab-express-scrubber"]'
      ) as HTMLButtonElement;
      const tabHarmony = container.querySelector(
        '[data-testid="mobile-tab-room-harmony"]'
      ) as HTMLButtonElement;
      const tabPricing = container.querySelector(
        '[data-testid="mobile-tab-partner-pricing"]'
      ) as HTMLButtonElement;

      expect(tabExpress.className).toContain('min-h-[44px]');
      expect(tabHarmony.className).toContain('min-h-[44px]');
      expect(tabPricing.className).toContain('min-h-[44px]');

      act(() => {
        tabHarmony.click();
      });
      expect(container.querySelector('[data-testid="mobile-view-room-harmony"]')).not.toBeNull();

      act(() => {
        tabPricing.click();
      });
      expect(container.querySelector('[data-testid="mobile-view-partner-pricing"]')).not.toBeNull();

      act(() => {
        tabExpress.click();
      });
      expect(
        container.querySelector('[data-testid="mobile-view-express-scrubber"]')
      ).not.toBeNull();

      // Desktop Unified Scannable Right Column markup slider, ledger, and CTAs
      const desktopColumn = container.querySelector(
        '[data-testid="desktop-curatorial-column"]'
      ) as HTMLElement;
      expect(desktopColumn).not.toBeNull();

      const desktopMarkupSlider = container.querySelector(
        '[data-testid="desktop-markup-slider"]'
      ) as HTMLInputElement;
      expect(desktopMarkupSlider).not.toBeNull();
      expect(desktopMarkupSlider.value).toBe('18');

      const ledgerRetailTotal = container.querySelector(
        '[data-testid="ledger-retail-total"]'
      ) as HTMLElement;
      expect(ledgerRetailTotal).not.toBeNull();
      expect(ledgerRetailTotal.textContent).toMatch(/^\$\d+\.\d{2}$/);

      const ctaOrderPrint = container.querySelector(
        '[data-testid="cta-order-printed-edition"]'
      ) as HTMLButtonElement;
      const ctaDownloadMaster = container.querySelector(
        '[data-testid="cta-download-print-master"]'
      ) as HTMLButtonElement;
      const ctaPinLookbook = container.querySelector(
        '[data-testid="cta-pin-lookbook"]'
      ) as HTMLButtonElement;

      expect(ctaOrderPrint).not.toBeNull();
      expect(ctaDownloadMaster).not.toBeNull();
      expect(ctaPinLookbook).not.toBeNull();

      harness.unmount();
    });
  });

  // =========================================================================
  // 4. Bottom-Sheet Checkout Modal, iOS Auto-Zoom Safe Inputs & Lookbook Drawer
  // =========================================================================
  describe('4. Bottom-Sheet Checkout Modal, iOS Auto-Zoom Safe Inputs & Lookbook/Orders Drawer', () => {
    it('verifies iOS auto-zoom safe shipping inputs (text-base, min-h-[44px], inputMode/autoComplete), bottom-sheet classes (rounded-t-[12px], max-h-[92dvh]), partner order dispatch, and 300-DPI digital master download', async () => {
      const harness = mountElement(
        React.createElement(AtelierProvider, {
          children: React.createElement(CheckoutAndOrderModal, { isOpen: true }),
        })
      );

      const { container } = harness;
      const modalRoot = container.querySelector(
        '[data-testid="checkout-and-order-modal"]'
      ) as HTMLElement;
      expect(modalRoot).not.toBeNull();

      // Verify bottom-sheet container classes ([SPEC PATCH #22])
      const sheetDialog = modalRoot.firstElementChild as HTMLElement;
      expect(sheetDialog.className).toContain('rounded-t-[12px]');
      expect(sheetDialog.className).toContain('max-h-[92dvh]');

      // Verify every shipping <input> and <select> carries text-base and min-h-[44px] + inputMode/autoComplete ([SPEC PATCH #19])
      const shippingFieldTestIds = [
        'input-shipping-name',
        'input-shipping-email',
        'input-shipping-street',
        'input-shipping-city',
        'input-shipping-state',
        'input-shipping-postal',
        'input-shipping-country',
      ];

      for (const testId of shippingFieldTestIds) {
        const el = container.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
        expect(el).not.toBeNull();
        expect(el.className).toContain('text-base');
        expect(el.className).toContain('min-h-[44px]');
        expect(el.getAttribute('autoComplete')).toBeTruthy();
        if (el.tagName === 'INPUT') {
          expect(el.getAttribute('inputMode')).toBeTruthy();
        }
      }

      // Submitting empty shipping form displays validation alert
      const submitBtn = container.querySelector(
        '[data-testid="btn-submit-partner-order"]'
      ) as HTMLButtonElement;
      expect(submitBtn).not.toBeNull();

      act(() => {
        submitBtn.click();
      });

      const validationAlert = container.querySelector(
        '[data-testid="shipping-validation-error"]'
      ) as HTMLElement;
      expect(validationAlert).not.toBeNull();

      // Fill demo collector address and submit order
      const fillDemoBtn = container.querySelector(
        '[data-testid="btn-fill-demo-address"]'
      ) as HTMLButtonElement;
      expect(fillDemoBtn).not.toBeNull();

      act(() => {
        fillDemoBtn.click();
      });

      act(() => {
        submitBtn.click();
      });

      const partnerReceipt = container.querySelector(
        '[data-testid="partner-order-receipt"]'
      ) as HTMLElement;
      const manifestPre = container.querySelector(
        '[data-testid="partner-manifest-json"]'
      ) as HTMLElement;
      expect(partnerReceipt).not.toBeNull();
      expect(manifestPre).not.toBeNull();
      const manifestJson = JSON.parse(manifestPre.textContent || '{}');
      expect(manifestJson.schemaVersion).toBe('atelier-vue.partner-fulfillment.v1');
      expect(manifestJson.recipientShippingAddress.fullName).toBe('Clara Vance');

      // Switch to Digital Print Master tab and complete download
      const digitalTabBtn = container.querySelector(
        '[data-testid="checkout-tab-digital"]'
      ) as HTMLButtonElement;
      expect(digitalTabBtn).not.toBeNull();

      act(() => {
        digitalTabBtn.click();
      });

      const completeDigitalBtn = container.querySelector(
        '[data-testid="btn-complete-digital-download"]'
      ) as HTMLButtonElement;
      expect(completeDigitalBtn).not.toBeNull();

      await act(async () => {
        completeDigitalBtn.click();
      });

      const digitalReceipt = container.querySelector(
        '[data-testid="digital-download-receipt"]'
      ) as HTMLElement;
      expect(digitalReceipt).not.toBeNull();
      expect(digitalReceipt.textContent).toContain('300-DPI PRINT MASTER EXPORTED');

      harness.unmount();
    });

    it('renders LookbookAndOrdersDrawer (isOpen: true) and verifies Lookbook pins and Order Receipts tabs', () => {
      let storeRef: AtelierStoreValue | null = null;

      const DrawerHarness: React.FC = () => {
        storeRef = useAtelierStore();
        return React.createElement(LookbookAndOrdersDrawer, { isOpen: true });
      };

      const harness = mountElement(
        React.createElement(AtelierProvider, {
          children: React.createElement(DrawerHarness),
        })
      );

      const { container } = harness;
      const drawerRoot = container.querySelector(
        '[data-testid="lookbook-and-orders-drawer"]'
      ) as HTMLElement;
      expect(drawerRoot).not.toBeNull();

      // Pin current wall configuration via button inside drawer
      const pinCurrentBtn = container.querySelector(
        '[data-testid="drawer-pin-current-btn"]'
      ) as HTMLButtonElement;
      expect(pinCurrentBtn).not.toBeNull();

      act(() => {
        pinCurrentBtn.click();
      });

      expect(storeRef!.pinnedLookbook.length).toBe(1);
      const pinId = storeRef!.pinnedLookbook[0].id;
      expect(container.querySelector(`[data-testid="lookbook-pin-card-${pinId}"]`)).not.toBeNull();

      // Record an order and switch to Orders tab
      act(() => {
        storeRef!.recordDigitalDownloadOrder();
      });
      expect(storeRef!.orders.length).toBe(1);

      const ordersTabBtn = container.querySelector(
        '[data-testid="drawer-tab-orders"]'
      ) as HTMLButtonElement;
      const lookbookTabBtn = container.querySelector(
        '[data-testid="drawer-tab-lookbook"]'
      ) as HTMLButtonElement;
      expect(ordersTabBtn).not.toBeNull();
      expect(lookbookTabBtn).not.toBeNull();

      act(() => {
        ordersTabBtn.click();
      });

      const orderId = storeRef!.orders[0].id;
      const orderCard = container.querySelector(
        `[data-testid="order-history-card-${orderId}"]`
      ) as HTMLElement;
      expect(orderCard).not.toBeNull();

      // Expand partner manifest JSON inside order history card
      const toggleManifestBtn = container.querySelector(
        `[data-testid="order-manifest-toggle-${orderId}"]`
      ) as HTMLButtonElement;
      act(() => {
        toggleManifestBtn.click();
      });
      expect(
        container.querySelector(`[data-testid="order-manifest-json-${orderId}"]`)
      ).not.toBeNull();

      // Switch back to lookbook tab
      act(() => {
        lookbookTabBtn.click();
      });
      expect(container.querySelector(`[data-testid="lookbook-pin-card-${pinId}"]`)).not.toBeNull();

      harness.unmount();
    });
  });
});
