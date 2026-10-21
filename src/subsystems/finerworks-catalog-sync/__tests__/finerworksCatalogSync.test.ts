import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WHITE_LABEL_BRAND_ID,
  FINERWORKS_CATALOG_SYNC_STORAGE_KEY,
  FINERWORKS_FRAME_MOULDINGS,
  FINERWORKS_GLAZING_SPECS,
  FINERWORKS_MAT_BOARDS,
  FINERWORKS_MEDIA_SPECS,
  FINERWORKS_SIZE_OPTIONS,
  FINERWORKS_SYNC_VERSION,
  WHITE_LABEL_BRAND_IDENTITIES,
  WHITE_LABEL_BRAND_LIST,
  WHITE_LABEL_BRAND_STORAGE_KEY,
  buildFinerWorksProductSpec,
  buildPrecomputedPriceMatrix,
  computeFinerWorksShippingQuotes,
  getActiveWhiteLabelBrand,
  getFinerWorksCatalogSnapshot,
  getFinerWorksFrameByFrameId,
  getFinerWorksFrameByProfileId,
  getFinerWorksGlazingByGlassId,
  getFinerWorksGlazingById,
  getFinerWorksMatByColorId,
  getFinerWorksMatByMatId,
  getFinerWorksMediaById,
  getFinerWorksMediaBySlug,
  getFinerWorksSizeById,
  getWhiteLabelBrandById,
  handleFinerWorksApiRequest,
  inchesToMatWidthId,
  lookupSyncedFinerWorksPrice,
  mapPrintSizeToFinerWorksSize,
  matWidthIdToInches,
  parseFinerWorksProductCode,
  renderCertificateOfAuthenticityHtml,
  renderPackingSlipHtmlPreview,
  resolveFinerWorksApiKeys,
  setActiveWhiteLabelBrand,
  startFinerWorksAutoSyncDaemon,
  syncFinerWorksCatalogAndPrices,
  validateFinerWorksConfiguration,
  type FinerWorksStandardSizeId,
  type WhiteLabelBrandId,
} from '../index';

describe('Subsystem 1: finerworks-catalog-sync', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    setActiveWhiteLabelBrand(DEFAULT_WHITE_LABEL_BRAND_ID);
  });

  describe('1. Catalog Registry', () => {
    it('defines all 10 FINERWORKS_MEDIA_SPECS across Product Types 5, 1, 2, and 3', () => {
      expect(FINERWORKS_MEDIA_SPECS).toHaveLength(10);

      const mediaIds = FINERWORKS_MEDIA_SPECS.map((m) => m.mediaId);
      expect(mediaIds).toEqual([6, 41, 42, 45, 48, 12, 14, 21, 22, 31]);

      const fineArtPapers = FINERWORKS_MEDIA_SPECS.filter((m) => m.productTypeId === 5);
      expect(fineArtPapers.map((m) => m.mediaId)).toEqual([6, 41, 42, 45, 48]);
      for (const paper of fineArtPapers) {
        expect(paper.canFrame).toBe(true);
        expect(paper.canMat).toBe(true);
        expect(paper.canGlaze).toBe(true);
        expect(paper.defaultStyleId).toBe(9);
      }

      const canvases = FINERWORKS_MEDIA_SPECS.filter((m) => m.productTypeId === 1);
      expect(canvases.map((m) => m.mediaId)).toEqual([12, 14]);
      for (const canvas of canvases) {
        expect(canvas.canFrame).toBe(true);
        expect(canvas.canMat).toBe(false);
        expect(canvas.canGlaze).toBe(false);
        expect(canvas.defaultStyleId).toBe(15);
      }

      const metals = FINERWORKS_MEDIA_SPECS.filter((m) => m.productTypeId === 2);
      expect(metals.map((m) => m.mediaId)).toEqual([21, 22]);
      for (const metal of metals) {
        expect(metal.canFrame).toBe(true);
        expect(metal.canMat).toBe(false);
        expect(metal.canGlaze).toBe(false);
        expect(metal.defaultStyleId).toBe(16);
      }

      const acrylics = FINERWORKS_MEDIA_SPECS.filter((m) => m.productTypeId === 3);
      expect(acrylics.map((m) => m.mediaId)).toEqual([31]);
      expect(acrylics[0].canFrame).toBe(true);
      expect(acrylics[0].canMat).toBe(false);
      expect(acrylics[0].canGlaze).toBe(false);
      expect(acrylics[0].defaultStyleId).toBe(25);
    });

    it('defines all 6 core FINERWORKS_FRAME_MOULDINGS plus all 231 full-catalogue frame mouldings with exact physical specs', () => {
      expect(FINERWORKS_FRAME_MOULDINGS.length).toBeGreaterThanOrEqual(231);

      const frameIds = FINERWORKS_FRAME_MOULDINGS.slice(0, 6).map((f) => f.finerworksFrameId);
      expect(frameIds).toEqual([0, 96, 131, 204, 312, 458]);

      const unframed = getFinerWorksFrameByFrameId(0);
      expect(unframed.profileId).toBe('unframed-canvas');
      expect(unframed.thicknessInches).toBe(0);
      expect(unframed.depthInches).toBe(1.5);
      expect(unframed.rabbetInches).toBe(0);
      expect(unframed.floatOffsetInches).toBe(0);

      const oak = getFinerWorksFrameByFrameId(131);
      expect(oak.profileId).toBe('natural-white-oak');
      expect(oak.thicknessInches).toBe(1.25);
      expect(oak.depthInches).toBe(1.75);
      expect(oak.rabbetInches).toBe(0.25);
      expect(oak.floatOffsetInches).toBe(0);

      const brassFloat = getFinerWorksFrameByFrameId(458);
      expect(brassFloat.profileId).toBe('brushed-brass-float');
      expect(brassFloat.thicknessInches).toBe(0.85);
      expect(brassFloat.depthInches).toBe(2.0);
      expect(brassFloat.rabbetInches).toBe(0);
      expect(brassFloat.floatOffsetInches).toBe(0.35);
      expect(brassFloat.isFloatFrame).toBe(true);
    });

    it('defines FINERWORKS_MAT_BOARDS, FINERWORKS_GLAZING_SPECS, and FINERWORKS_SIZE_OPTIONS', () => {
      expect(FINERWORKS_MAT_BOARDS.map((m) => m.finerworksMatId)).toEqual([1, 2, 3, 4]);
      expect(FINERWORKS_GLAZING_SPECS.map((g) => g.finerworksGlassId)).toEqual([0, 1, 2]);

      const expectedSizes: FinerWorksStandardSizeId[] = [
        '8x10',
        '11x14',
        '12x16',
        '16x20',
        '18x24',
        '20x30',
        '24x36',
        '30x40',
        '36x48',
        '40x60',
        'custom',
      ];
      expect(FINERWORKS_SIZE_OPTIONS.map((s) => s.id)).toEqual(expectedSizes);
    });

    it('supports all catalog lookup and mapping helper functions', () => {
      expect(getFinerWorksMediaById(41).substrateSlug).toBe('hahnemuhle-photo-rag-308gsm');
      expect(getFinerWorksMediaById(9999).mediaId).toBe(42);

      expect(getFinerWorksMediaBySlug('hahnemuhle-etching-310gsm').mediaId).toBe(42);
      expect(getFinerWorksMediaBySlug('unknown-slug').mediaId).toBe(42);

      expect(getFinerWorksFrameByProfileId('american-black-walnut').finerworksFrameId).toBe(204);
      expect(getFinerWorksFrameByFrameId(312).profileId).toBe('warm-travertine-ash');

      expect(getFinerWorksMatByColorId('archival-ivory').finerworksMatId).toBe(2);
      expect(getFinerWorksMatByColorId('warm-museum-linen').finerworksMatId).toBe(3);
      expect(getFinerWorksMatByColorId('charcoal-conservation').finerworksMatId).toBe(4);
      expect(getFinerWorksMatByMatId(1).name).toBe('Pure Conservation White');

      expect(getFinerWorksGlazingById('clear-acrylic').finerworksGlassId).toBe(1);
      expect(getFinerWorksGlazingById('non-glare-museum-acrylic').finerworksGlassId).toBe(2);
      expect(getFinerWorksGlazingByGlassId(0).glazingId).toBe('none');

      expect(getFinerWorksSizeById('18x24').optimalPrintWidthPx).toBe(5400);
      expect(getFinerWorksSizeById('18x24').optimalPrintHeightPx).toBe(7200);
      expect(mapPrintSizeToFinerWorksSize('30x40').widthInches).toBe(30);
      expect(mapPrintSizeToFinerWorksSize('30x40').heightInches).toBe(40);
    });
  });

  describe('2. Dynamic Product Code Builder & Validator', () => {
    it('builds canonical framed + matted + glazed fine art paper SKU ("5M41M9S18X24F131S23X29J2S18X24G1")', () => {
      const spec = buildFinerWorksProductSpec({
        productTypeId: 5,
        mediaId: 41,
        styleId: 9,
        printWidthIn: 18,
        printHeightIn: 24,
        frameProfileId: 'natural-white-oak',
        finerworksFrameId: 131,
        matWidthId: '2.5in',
        matBorderInches: 2.5,
        matColorId: 'archival-ivory',
        finerworksMatId: 2,
        glazingId: 'clear-acrylic',
        finerworksGlassId: 1,
        quantity: 1,
      });

      expect(spec.valid).toBe(true);
      expect(spec.productCode).toBe('5M41M9S18X24F131S23X29J2S18X24G1');
      expect(spec.physicalDimensions.matOuterWidthIn).toBe(23);
      expect(spec.physicalDimensions.matOuterHeightIn).toBe(29);
      expect(spec.physicalDimensions.frameInteriorWidthIn).toBe(23);
      expect(spec.physicalDimensions.frameInteriorHeightIn).toBe(29);
      expect(spec.physicalDimensions.frameOuterWidthIn).toBe(25);
      expect(spec.physicalDimensions.frameOuterHeightIn).toBe(31);
      expect(spec.physicalDimensions.optimalWidthPx300Ppi).toBe(5400);
      expect(spec.physicalDimensions.optimalHeightPx300Ppi).toBe(7200);
    });

    it('builds unframed print code ("5M42M9S24X36") and float-framed canvas code ("1M12M15S24X36F458S25X37")', () => {
      const unframedSpec = buildFinerWorksProductSpec({
        productTypeId: 5,
        mediaId: 42,
        styleId: 9,
        printWidthIn: 24,
        printHeightIn: 36,
        frameProfileId: 'unframed-canvas',
        finerworksFrameId: 0,
        matWidthId: 'none',
        glazingId: 'none',
      });
      expect(unframedSpec.productCode).toBe('5M42M9S24X36');
      expect(unframedSpec.physicalDimensions.frameOuterWidthIn).toBe(24);
      expect(unframedSpec.physicalDimensions.frameOuterHeightIn).toBe(36);

      const floatCanvasSpec = buildFinerWorksProductSpec({
        productTypeId: 1,
        mediaId: 12,
        styleId: 15,
        printWidthIn: 24,
        printHeightIn: 36,
        frameProfileId: 'brushed-brass-float',
        finerworksFrameId: 458,
      });
      expect(floatCanvasSpec.productCode).toBe('1M12M15S24X36F458S25X37');
      expect(floatCanvasSpec.physicalDimensions.frameInteriorWidthIn).toBeCloseTo(24.7, 2);
      expect(floatCanvasSpec.physicalDimensions.frameInteriorHeightIn).toBeCloseTo(36.7, 2);
    });

    it('strips matting and glazing when productTypeId is 1 (Canvas), 2 (Metal), or 3 (Acrylic)', () => {
      const nonPaperInputs = [
        { productTypeId: 1 as const, mediaId: 12, styleId: 15 },
        { productTypeId: 2 as const, mediaId: 21, styleId: 16 },
        { productTypeId: 3 as const, mediaId: 31, styleId: 25 },
      ];

      for (const item of nonPaperInputs) {
        const spec = buildFinerWorksProductSpec({
          ...item,
          printWidthIn: 20,
          printHeightIn: 30,
          frameProfileId: 'matte-gallery-black',
          finerworksFrameId: 96,
          matWidthId: '2.5in',
          matBorderInches: 2.5,
          matColorId: 'archival-ivory',
          finerworksMatId: 2,
          glazingId: 'non-glare-museum-acrylic',
          finerworksGlassId: 2,
        });

        expect(spec.config.matBorderInches).toBe(0);
        expect(spec.config.finerworksMatId).toBe(0);
        expect(spec.config.finerworksGlassId).toBe(0);
        expect(spec.config.matWidthId).toBe('none');
        expect(spec.config.glazingId).toBe('none');
        expect(spec.productCode).not.toMatch(/J\d+/);
        expect(spec.productCode).not.toMatch(/G\d+/);
        expect(spec.validationNotes.length).toBeGreaterThan(0);
      }
    });

    it('round-trips framed/matted/glazed, float-framed, and unframed product codes via parseFinerWorksProductCode and returns null on malformed strings', () => {
      const framedCode = '5M41M9S18X24F131S23X29J2S18X24G1';
      const parsedFramed = parseFinerWorksProductCode(framedCode);
      expect(parsedFramed).not.toBeNull();
      expect(parsedFramed?.productCode).toBe(framedCode);
      expect(parsedFramed?.productTypeId).toBe(5);
      expect(parsedFramed?.mediaId).toBe(41);
      expect(parsedFramed?.finerworksFrameId).toBe(131);
      expect(parsedFramed?.finerworksMatId).toBe(2);
      expect(parsedFramed?.matBorderInches).toBe(2.5);
      expect(parsedFramed?.finerworksGlassId).toBe(1);

      const floatCode = '1M12M15S24X36F458S25X37';
      const parsedFloat = parseFinerWorksProductCode(floatCode);
      expect(parsedFloat).not.toBeNull();
      expect(parsedFloat?.productCode).toBe(floatCode);
      expect(parsedFloat?.productTypeId).toBe(1);
      expect(parsedFloat?.mediaId).toBe(12);
      expect(parsedFloat?.finerworksFrameId).toBe(458);
      expect(parsedFloat?.finerworksMatId).toBe(0);

      const unframedCode = '5M42M9S24X36';
      const parsedUnframed = parseFinerWorksProductCode(unframedCode);
      expect(parsedUnframed).not.toBeNull();
      expect(parsedUnframed?.productCode).toBe(unframedCode);
      expect(parsedUnframed?.finerworksFrameId).toBe(0);

      expect(parseFinerWorksProductCode('')).toBeNull();
      expect(parseFinerWorksProductCode('NOT_A_FINERWORKS_CODE')).toBeNull();
      expect(parseFinerWorksProductCode('9M99M99S10X10')).toBeNull();
    });

    it('applies exact volume discounts for quantities 1 (0%), 2 (5%), 5 (10%), and 10 (15%)', () => {
      const q1 = buildFinerWorksProductSpec({ mediaId: 42, printWidthIn: 18, printHeightIn: 24, quantity: 1 });
      const q2 = buildFinerWorksProductSpec({ mediaId: 42, printWidthIn: 18, printHeightIn: 24, quantity: 2 });
      const q5 = buildFinerWorksProductSpec({ mediaId: 42, printWidthIn: 18, printHeightIn: 24, quantity: 5 });
      const q10 = buildFinerWorksProductSpec({ mediaId: 42, printWidthIn: 18, printHeightIn: 24, quantity: 10 });

      expect(q1.pricing.volumeDiscountPercent).toBe(0);
      expect(q2.pricing.volumeDiscountPercent).toBe(5);
      expect(q5.pricing.volumeDiscountPercent).toBe(10);
      expect(q10.pricing.volumeDiscountPercent).toBe(15);

      const unitPrice = q1.pricing.wholesaleTotalUsd;
      expect(q2.pricing.wholesaleTotalUsd).toBeCloseTo(unitPrice * 2 * 0.95, 1);
      expect(q5.pricing.wholesaleTotalUsd).toBeCloseTo(unitPrice * 5 * 0.9, 1);
      expect(q10.pricing.wholesaleTotalUsd).toBeCloseTo(unitPrice * 10 * 0.85, 1);

      expect(matWidthIdToInches('2.5in')).toBe(2.5);
      expect(inchesToMatWidthId(2.5)).toBe('2.5in');
      expect(validateFinerWorksConfiguration(q1.config).valid).toBe(true);
    });
  });

  describe('3. Auto-Sync Service', () => {
    it('getFinerWorksCatalogSnapshot() returns a valid snapshot (v3.2.0) and persists to localStorage', () => {
      const snapshot = getFinerWorksCatalogSnapshot();
      expect(snapshot.syncVersion).toBe(FINERWORKS_SYNC_VERSION);
      expect(snapshot.syncVersion).toBe('3.2.0');
      expect(snapshot.mediaSpecs).toHaveLength(10);
      expect(snapshot.frameMouldings.length).toBeGreaterThanOrEqual(231);
      expect(Object.keys(snapshot.cachedPriceMatrix).length).toBeGreaterThan(50);
      expect(snapshot.totalOptionsSyncedCount).toBeGreaterThan(80);

      const storedRaw = localStorage.getItem(FINERWORKS_CATALOG_SYNC_STORAGE_KEY);
      expect(storedRaw).toBeTruthy();
      const parsedStored = JSON.parse(storedRaw!);
      expect(parsedStored.syncVersion).toBe('3.2.0');
    });

    it('syncFinerWorksCatalogAndPrices() updates lastSyncedAt and works seamlessly offline/in test mode', async () => {
      const synced = await syncFinerWorksCatalogAndPrices({ forceNetwork: false });
      expect(synced.syncVersion).toBe('3.2.0');
      expect(synced.lastSyncedAt).toBeGreaterThan(0);
      expect(synced.mediaSpecs).toHaveLength(10);
      expect(synced.totalOptionsSyncedCount).toBeGreaterThan(0);
    });

    it('startFinerWorksAutoSyncDaemon() invokes callback immediately and returns a clean stop disposer', () => {
      const onUpdate = vi.fn();
      const stopDaemon = startFinerWorksAutoSyncDaemon(60_000, onUpdate);
      expect(typeof stopDaemon).toBe('function');
      expect(onUpdate).toHaveBeenCalled();
      const emittedSnapshot = onUpdate.mock.calls[0][0];
      expect(emittedSnapshot.syncVersion).toBe('3.2.0');
      stopDaemon();
    });

    it('lookupSyncedFinerWorksPrice() returns accurate synced pricing from cachedPriceMatrix', () => {
      const matrix = buildPrecomputedPriceMatrix();
      expect(Object.keys(matrix).length).toBeGreaterThan(0);

      const lookedUp = lookupSyncedFinerWorksPrice({
        productTypeId: 5,
        mediaId: 42,
        printWidthIn: 24,
        printHeightIn: 36,
        frameProfileId: 'natural-white-oak',
        finerworksFrameId: 131,
        matWidthId: '2.5in',
        matBorderInches: 2.5,
        matColorId: 'archival-ivory',
        finerworksMatId: 2,
        glazingId: 'clear-acrylic',
        finerworksGlassId: 1,
        quantity: 1,
      });

      expect(lookedUp.productCode).toBe('5M42M9S24X36F131S29X41J2S24X36G1');
      expect(lookedUp.pricing.wholesaleTotalUsd).toBeGreaterThan(0);
      expect(lookedUp.pricing.suggestedGeoRetailUsd).toBeGreaterThan(
        lookedUp.pricing.wholesaleTotalUsd
      );
    });
  });

  describe('4. White-Label Brand Identity Registry', () => {
    it('defines all 5 curated brand identities with atelier-koma as default and valid 600x180 SVG logos', () => {
      const expectedBrandIds: WhiteLabelBrandId[] = [
        'atelier-koma',
        'galerie-vauban',
        'werkstatt-neue',
        'stillwater-press',
        'the-nocturne-archive',
      ];

      expect(DEFAULT_WHITE_LABEL_BRAND_ID).toBe('atelier-koma');
      expect(WHITE_LABEL_BRAND_LIST.map((b) => b.id)).toEqual(expectedBrandIds);

      for (const brandId of expectedBrandIds) {
        const brand = WHITE_LABEL_BRAND_IDENTITIES[brandId];
        expect(brand).toBeDefined();
        expect(brand.logoSvgMarkup).toContain('viewBox="0 0 600 180"');
        expect(brand.logoSvgMarkup).toContain('width="600" height="180"');
        expect(brand.logoDataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
        expect(brand.businessInfo.company_name.length).toBeGreaterThan(3);
        expect(brand.businessInfo.address_1.length).toBeGreaterThan(3);
        expect(brand.packingSlipSpec.unboxingCareInstructions.length).toBeGreaterThanOrEqual(3);
        expect(brand.coaSpec.certificateTitle.length).toBeGreaterThan(5);
      }
    });

    it('persists brand selection and custom businessInfo overrides via getActiveWhiteLabelBrand and setActiveWhiteLabelBrand', () => {
      expect(getActiveWhiteLabelBrand().id).toBe('atelier-koma');

      const updated = setActiveWhiteLabelBrand('galerie-vauban', {
        company_name: 'Salon Vauban Private Editions',
        city: 'Boston',
      });

      expect(updated.id).toBe('galerie-vauban');
      expect(updated.businessInfo.company_name).toBe('Salon Vauban Private Editions');
      expect(updated.businessInfo.city).toBe('Boston');

      const rehydrated = getActiveWhiteLabelBrand();
      expect(rehydrated.id).toBe('galerie-vauban');
      expect(rehydrated.businessInfo.company_name).toBe('Salon Vauban Private Editions');

      const stored = localStorage.getItem(WHITE_LABEL_BRAND_STORAGE_KEY);
      expect(stored).toContain('galerie-vauban');
      expect(getWhiteLabelBrandById('werkstatt-neue').brandName).toBe('Werkstatt Neue');
    });

    it('renders Packing Slip and COA HTML with brand details, collector & artwork details, zero mention of "FinerWorks", and zero <a href tags', () => {
      const slipHtml = renderPackingSlipHtmlPreview('atelier-koma', {
        collectorName: 'Evelyn Sterling',
        artworkTitle: 'Sunlit Travertine Horizon II',
        substrateLabel: 'Hahnemühle Photo Rag 308gsm',
        frameLabel: 'Natural White Oak',
        dimensionsLabel: '18" × 24"',
        productCode: '5M41M9S18X24F131S23X29J2S18X24G1',
      });

      expect(slipHtml).toContain('Evelyn Sterling');
      expect(slipHtml).toContain('Sunlit Travertine Horizon II');
      expect(slipHtml).toContain('viewBox="0 0 600 180"');
      expect(slipHtml.toLowerCase()).not.toContain('finerworks');
      expect(slipHtml.toLowerCase()).not.toContain('<a href');

      const coaHtml = renderCertificateOfAuthenticityHtml('the-nocturne-archive', {
        collectorName: 'Evelyn Sterling',
        artworkTitle: 'Nocturne in Raw Umber',
        substrateLabel: 'Museo Max 365gsm',
        frameLabel: 'American Black Walnut',
        dimensionsLabel: '24" × 36"',
        productCode: '5M45M9S24X36F204S29X41J4S24X36G2',
      });

      expect(coaHtml).toContain('Evelyn Sterling');
      expect(coaHtml).toContain('Nocturne in Raw Umber');
      expect(coaHtml).toContain('The Nocturne Archive');
      expect(coaHtml).toContain('viewBox="0 0 600 180"');
      expect(coaHtml.toLowerCase()).not.toContain('finerworks');
      expect(coaHtml.toLowerCase()).not.toContain('<a href');
    });
  });

  describe('5. Server Proxy (handleFinerWorksApiRequest & computeFinerWorksShippingQuotes)', () => {
    it('computes 4 insured shipping quotes via computeFinerWorksShippingQuotes and resolves API keys', () => {
      const spec = buildFinerWorksProductSpec({
        productTypeId: 5,
        mediaId: 41,
        printWidthIn: 18,
        printHeightIn: 24,
        frameProfileId: 'natural-white-oak',
        finerworksFrameId: 131,
      });

      const quotes = computeFinerWorksShippingQuotes({
        productSpec: spec,
        stateCode: 'NY',
        countryCode: 'US',
        orderPo: 'FW-PO-TEST-01',
      });

      expect(quotes).toHaveLength(4);
      expect(quotes.map((q) => q.shippingClassCode)).toEqual(['EC', 'SD', 'EX', 'ON']);
      for (const quote of quotes) {
        expect(quote.rateUsd).toBeGreaterThan(0);
        expect(quote.calculatedTotal.orderGrandTotalUsd).toBeGreaterThan(
          quote.calculatedTotal.orderSubtotalUsd
        );
      }

      const keyCheck = resolveFinerWorksApiKeys({
        FINERWORKS_WEB_API_KEY: 'test-web-key',
        FINERWORKS_APP_KEY: 'test-app-key',
      });
      expect(keyCheck.hasLiveCredentials).toBe(true);
    });

    it('handles all 10 FinerWorks v3 proxy endpoints with HTTP 200 and canonical payloads', async () => {
      // 1. catalog-sync
      const syncRes = await handleFinerWorksApiRequest('/api/finerworks/catalog-sync', 'POST', {});
      expect(syncRes.statusCode).toBe(200);
      expect(syncRes.payload.status).toEqual({ success: true, code: 200 });
      expect(syncRes.payload.snapshot).toBeDefined();

      // 2. prices
      const pricesRes = await handleFinerWorksApiRequest('/api/finerworks/prices', 'POST', {
        products: [
          {
            product_code: '5M41M9S18X24F131S23X29J2S18X24G1',
            product_qty: 2,
          },
        ],
      });
      expect(pricesRes.statusCode).toBe(200);
      const pricesList = pricesRes.payload.prices as Array<Record<string, unknown>>;
      expect(pricesList).toHaveLength(1);
      expect(pricesList[0].product_qty).toBe(2);
      expect(pricesList[0].volume_discount_percent).toBe(5);

      // 3. build-product-code
      const buildRes = await handleFinerWorksApiRequest(
        '/api/finerworks/build-product-code',
        'POST',
        {
          productTypeId: 5,
          mediaId: 41,
          styleId: 9,
          printWidthIn: 18,
          printHeightIn: 24,
          frameProfileId: 'natural-white-oak',
          finerworksFrameId: 131,
          matWidthId: '2.5in',
          matColorId: 'archival-ivory',
          glazingId: 'clear-acrylic',
        }
      );
      expect(buildRes.statusCode).toBe(200);
      expect(buildRes.payload.product_code).toBe('5M41M9S18X24F131S23X29J2S18X24G1');

      // 4. validate-product
      const validateProdRes = await handleFinerWorksApiRequest(
        '/api/finerworks/validate-product',
        'POST',
        {
          product_code: '5M41M9S18X24F131S23X29J2S18X24G1',
        }
      );
      expect(validateProdRes.statusCode).toBe(200);
      expect(validateProdRes.payload.valid).toBe(true);

      // 5. validate-address
      const validateAddrRes = await handleFinerWorksApiRequest(
        '/api/finerworks/validate-address',
        'POST',
        {
          recipient: {
            first_name: 'Sora',
            last_name: 'Takahashi',
            address_1: '458 Broome Street',
            city: 'New York',
            state_code: 'NY',
            zip_postal_code: '10013',
            country_code: 'US',
          },
        }
      );
      expect(validateAddrRes.statusCode).toBe(200);
      expect(validateAddrRes.payload.address_valid).toBe(true);

      // 6. shipping-options
      const shippingRes = await handleFinerWorksApiRequest(
        '/api/finerworks/shipping-options',
        'POST',
        {
          product_code: '5M41M9S18X24F131S23X29J2S18X24G1',
          stateCode: 'NY',
          countryCode: 'US',
        }
      );
      expect(shippingRes.statusCode).toBe(200);
      expect(Array.isArray(shippingRes.payload.shipping_options)).toBe(true);
      expect((shippingRes.payload.shipping_options as unknown[]).length).toBe(4);

      // 7. submit-order
      const submitRes = await handleFinerWorksApiRequest('/api/finerworks/submit-order', 'POST', {
        brandId: 'atelier-koma',
        validate_only: true,
        orders: [
          {
            order_po: 'FW-PO-2026-99',
            shipping_code: 'SD',
            order_items: [{ product_code: '5M41M9S18X24F131S23X29J2S18X24G1', product_qty: 1 }],
          },
        ],
      });
      expect(submitRes.statusCode).toBe(200);
      expect(submitRes.payload.validate_only).toBe(true);
      expect(
        (submitRes.payload.order_confirmation as Record<string, unknown>).white_label_applied
      ).toBe(true);

      // 8. order-status
      const statusRes = await handleFinerWorksApiRequest('/api/finerworks/order-status', 'POST', {
        order_po: 'FW-PO-2026-99',
      });
      expect(statusRes.statusCode).toBe(200);
      expect((statusRes.payload.order_status as Record<string, unknown>).order_po).toBe(
        'FW-PO-2026-99'
      );

      // 9. test-credentials (honest false when no credentials configured)
      const credsRes = await handleFinerWorksApiRequest(
        '/api/finerworks/test-credentials',
        'GET',
        {}
      );
      expect(credsRes.statusCode).toBe(200);
      expect(credsRes.payload.credentials_valid).toBe(false);
      expect(credsRes.payload.status).toBe('missing-credentials');

      // 10. update-branding
      const brandRes = await handleFinerWorksApiRequest(
        '/api/finerworks/update-branding',
        'PUT',
        {
          brandId: 'stillwater-press',
          business_info: {
            company_name: 'Stillwater Archival Press Guild',
          },
        }
      );
      expect(brandRes.statusCode).toBe(200);
      expect(brandRes.payload.company_logo_url_dims).toBe('600x180');
      expect((brandRes.payload.active_brand as { id: string }).id).toBe('stillwater-press');
    });
  });
});
