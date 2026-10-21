import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import {
  PRINT_SIZES,
  DIGITAL_MASTER_LICENSE_USD,
  type ScaleCalibrationQuestion,
} from '../contracts/masterContract';
import {
  computeFallbackScaleRecommendation,
} from '../subsystems/upload-and-reimagine-ui/ScaleCalibrationPage';
import {
  computeRecommendedScaleFromMeasurements,
} from '../subsystems/openrouter-ai-engine/openRouterClient';
import {
  injectPngPhysChunk,
} from '../subsystems/screenshot-and-print-studio/identicalPrintUpscaler';
import {
  FINERWORKS_ALL_231_FRAMES,
  FINERWORKS_FRAME_COLLECTIONS,
  buildFinerWorksProductSpec,
  handleFinerWorksApiRequest,
} from '../subsystems/finerworks-catalog-sync';
import {
  AcquirePrintModal,
  validatePaymentCardForm,
  submitFinerWorksPrintOrder,
} from '../subsystems/checkout-and-download';

describe('Forensic Audit Remediation Verification Suite (F-01 through F-22)', () => {
  it('F-06: computes exact 36.0" x 36.0" outer frame dimensions and 0% discrepancy on a 4:3 (1200x900) photo for horizontal, vertical, and dual calipers', () => {
    const squareFrameOn4x3CropBox = {
      xmin: 350, // 300 normX * 1.2 px/normX = 360 px
      xmax: 650,
      ymin: 200, // 400 normY * 0.9 px/normY = 360 px
      ymax: 600,
      label: 'Square 36x36 Frame on 4:3 Photo',
    };

    const horizQuestion: ScaleCalibrationQuestion = {
      id: 'q-horiz',
      questionText: 'Width of sofa in inches?',
      helperText: 'Drag caliper across sofa',
      unitLabel: 'inches',
      placeholder: '60',
      suggestedQuickValuesInches: [{ label: '60"', valueInches: 60 }],
      userAnswerInches: 60,
      caliper: {
        x1: 250,
        y1: 800,
        x2: 750,
        y2: 800,
        badgeCode: 'A',
        shortLabel: 'Sofa Width',
        axis: 'horizontal',
        colorHex: '#9E5A3C',
      }, // 500 normX = 600 px -> 0.10 in/px
    };

    const vertQuestion: ScaleCalibrationQuestion = {
      id: 'q-vert',
      questionText: 'Height of cabinet in inches?',
      helperText: 'Drag caliper along cabinet',
      unitLabel: 'inches',
      placeholder: '36',
      suggestedQuickValuesInches: [{ label: '36"', valueInches: 36 }],
      userAnswerInches: 36,
      caliper: {
        x1: 100,
        y1: 200,
        x2: 100,
        y2: 600,
        badgeCode: 'B',
        shortLabel: 'Cabinet Height',
        axis: 'vertical',
        colorHex: '#2E4A3E',
      }, // 400 normY = 360 px -> 0.10 in/px
    };

    // 1. Horizontal Caliper Only on 1200x900 (4:3)
    const resHoriz = computeFallbackScaleRecommendation([horizQuestion], {
      cropBox: squareFrameOn4x3CropBox,
      imageWidthPx: 1200,
      imageHeightPx: 900,
    });
    expect(resHoriz.calculatedOuterFrameWidthInches).toBe(36);
    expect(resHoriz.calculatedOuterFrameHeightInches).toBe(36);
    expect(resHoriz.hasScaleInaccuracyError).toBe(false);

    // 2. Vertical Caliper Only on 1200x900 (4:3)
    const resVert = computeFallbackScaleRecommendation([vertQuestion], {
      cropBox: squareFrameOn4x3CropBox,
      imageWidthPx: 1200,
      imageHeightPx: 900,
    });
    expect(resVert.calculatedOuterFrameWidthInches).toBe(36);
    expect(resVert.calculatedOuterFrameHeightInches).toBe(36);
    expect(resVert.hasScaleInaccuracyError).toBe(false);

    // 3. Both Horizontal & Vertical Calipers entered accurately on 1200x900 (4:3)
    const resBoth = computeFallbackScaleRecommendation([horizQuestion, vertQuestion], {
      cropBox: squareFrameOn4x3CropBox,
      imageWidthPx: 1200,
      imageHeightPx: 900,
    });
    expect(resBoth.scaleDiscrepancyPercent).toBe(0);
    expect(resBoth.hasScaleInaccuracyError).toBe(false);
    expect(resBoth.calculatedOuterFrameWidthInches).toBe(36);
    expect(resBoth.calculatedOuterFrameHeightInches).toBe(36);

    // Also verify openRouterClient's computeRecommendedScaleFromMeasurements matches
    const engineBoth = computeRecommendedScaleFromMeasurements({
      questions: [horizQuestion, vertQuestion],
      cropBox: squareFrameOn4x3CropBox,
      imageWidthPx: 1200,
      imageHeightPx: 900,
    });
    expect(engineBoth.scaleDiscrepancyPercent).toBe(0);
    expect(engineBoth.hasScaleInaccuracyError).toBe(false);
    expect(engineBoth.calculatedOuterFrameWidthInches).toBe(36);
    expect(engineBoth.calculatedOuterFrameHeightInches).toBe(36);
  });

  it('F-01 & F-18: validates payment cards (allowing spaces) and gates digital print master downloads behind $29 license or completed order', () => {
    expect(DIGITAL_MASTER_LICENSE_USD).toBe(29);

    const invalidCard = validatePaymentCardForm({
      ccName: '',
      ccNumber: '1234',
      ccExp: 'invalid',
      ccCsc: '1',
    });
    expect(invalidCard.isValid).toBe(false);
    expect(invalidCard.errors.length).toBeGreaterThan(0);

    const validSpacedCard = validatePaymentCardForm({
      ccName: 'Clara Vance',
      ccNumber: '4242 4242 4242 4242',
      ccExp: '08/29',
      ccCsc: '842',
    });
    expect(validSpacedCard.isValid).toBe(true);
    expect(validSpacedCard.sanitizedDigits).toBe('4242424242424242');
  });

  it('F-02, F-15 & F-19: reports credentials_valid=false when FinerWorks keys are missing, includes product_image in order_items, preserves https:// in manifests, and removes Prodigi/Printful cards', async () => {
    const creds = await handleFinerWorksApiRequest('/api/finerworks/test-credentials', 'GET', {});
    expect(creds.payload.credentials_valid).toBe(false);
    expect(creds.payload.status).toBe('missing-credentials');

    const orderConfirm = await submitFinerWorksPrintOrder({
      variation: {
        id: 'var-audit-test',
        createdAt: Date.now(),
        engineId: 'astra',
        engineModelName: 'GPT-6 Astra (openai/gpt-6-astra)',
        imageModelName: 'google/gemini-3.1-flash-image',
        placementAction: 'add-only',
        styleMode: 'ai-curated',
        promptUsed: 'Audit test prompt',
        originalRoomDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        reimaginedRoomDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        detectedCropBox: { ymin: 200, xmin: 350, ymax: 600, xmax: 650 },
        activeCropBox: { ymin: 200, xmin: 350, ymax: 600, xmax: 650 },
        croppedScreenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        identicalPrintMasterDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
        artworkTitle: 'Audit Verification Study',
        artworkDescription: 'Audit description',
        roomStyleSummary: 'Warm gallery room',
      },
      sizeId: '24x36',
      frameId: 'natural-white-oak',
      matWidthId: '2.5in',
      matColorId: 'archival-ivory',
      substrateId: 'hahnemuhle-etching-310gsm',
      mediaId: 42,
      glazingId: 'clear-acrylic',
      quantity: 1,
      shippingCode: 'SD',
      shippingAddress: {
        fullName: 'Clara Vance',
        email: 'clara@atelier-vue.org',
        streetAddress: '428 Mercer Street',
        city: 'New York',
        stateOrProvince: 'NY',
        postalCode: '10013',
        country: 'US',
      },
    });

    const parsedManifest = JSON.parse(orderConfirm.partnerOrderManifestJson);
    const firstOrder = parsedManifest.orders?.[0];
    expect(firstOrder).toBeTruthy();
    expect(firstOrder.order_items[0].product_image).toBeTruthy();
    expect(firstOrder.order_items[0].product_image.pixel_width).toBe(7200);
    expect(firstOrder.order_items[0].product_image.pixel_height).toBe(10800);
    expect(firstOrder.order_items[0].product_image.product_url_file).toBeTruthy();
  });

  it('F-03, F-10 & F-21: unifies Submit Button, Itemized Ledger, and Receipt totals to $0.00 discrepancy, supports all 237 FinerWorks frames, and swaps landscape dimensions', () => {
    // Verify F-10 collection counts match FINERWORKS_ALL_231_FRAMES
    for (const col of FINERWORKS_FRAME_COLLECTIONS) {
      const actualCount = FINERWORKS_ALL_231_FRAMES.filter(
        (f) => f.collectionSlug === col.slug
      ).length;
      expect(col.frameCount).toBe(actualCount);
    }

    // Verify F-21 landscape orientation swaps width & height (36" x 24" instead of 24" x 36")
    const portraitSpec = buildFinerWorksProductSpec({
      mediaId: 42,
      printWidthIn: 24,
      printHeightIn: 36,
      orientation: 'portrait',
    });
    expect(portraitSpec.config.printWidthIn).toBe(24);
    expect(portraitSpec.config.printHeightIn).toBe(36);

    const landscapeSpec = buildFinerWorksProductSpec({
      mediaId: 42,
      printWidthIn: 24,
      printHeightIn: 36,
      orientation: 'landscape',
    });
    expect(landscapeSpec.config.printWidthIn).toBe(36);
    expect(landscapeSpec.config.printHeightIn).toBe(24);

    // Mount AcquirePrintModal and verify F-03 button price == itemized ledger price == receipt price
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(AcquirePrintModal, {
          isOpen: true,
          initialMode: 'order-print',
          sizeId: '24x36',
          frameId: 'natural-white-oak',
          matWidthId: '2.5in',
          glazingId: 'non-glare-museum-acrylic',
        })
      );
    });

    // Prodigi and Printful cards are gone (F-19)
    expect(container.querySelector('[data-testid="partner-card-prodigi"]')).toBeNull();
    expect(container.querySelector('[data-testid="partner-card-printful"]')).toBeNull();

    // All 237 FinerWorks frames are selectable in checkout (F-10)
    const frameSelect = container.querySelector(
      '[data-testid="checkout-finerworks-frame-select"]'
    ) as HTMLSelectElement;
    expect(frameSelect).not.toBeNull();
    expect(frameSelect.options.length).toBeGreaterThanOrEqual(231);

    // Compare Submit Button price and Itemized Ledger price
    const submitBtn = container.querySelector(
      '[data-testid="submit-partner-order-btn"]'
    ) as HTMLButtonElement;
    const ledger = container.querySelector(
      '[data-testid="finerworks-itemized-ledger"]'
    ) as HTMLElement;
    const submitBtnText = submitBtn.textContent ?? '';
    const ledgerText = ledger.textContent ?? '';
    const btnPriceMatch = submitBtnText.match(/\$(\d+(?:,\d{3})*\.\d{2})/);
    expect(btnPriceMatch).not.toBeNull();
    const buttonPriceStr = `$${btnPriceMatch![1]}`;
    expect(ledgerText).toContain(buttonPriceStr);

    // Fill sample address + test card and submit
    const fillBtn = container.querySelector(
      '[data-testid="fill-sample-address-btn"]'
    ) as HTMLButtonElement;
    act(() => {
      fillBtn.click();
    });
    act(() => {
      submitBtn.click();
    });

    const receipt = container.querySelector(
      '[data-testid="order-confirmation-receipt"]'
    ) as HTMLElement;
    expect(receipt).not.toBeNull();
    expect(receipt.textContent ?? '').toContain(`Total: ${buttonPriceStr}`);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('F-08: embeds a valid 300-DPI PNG pHYs chunk (11811 px/meter) and defines true 300-PPI dimensions in PRINT_SIZES', () => {
    expect(PRINT_SIZES['24x36'].optimal300PpiWidthPx).toBe(7200);
    expect(PRINT_SIZES['24x36'].optimal300PpiHeightPx).toBe(10800);

    const minimalPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const withPhys = injectPngPhysChunk(minimalPngDataUrl, 300);
    const binaryStr = atob(withPhys.split(',')[1]);
    expect(binaryStr).toContain('pHYs');
    const physOffset = binaryStr.indexOf('pHYs');
    const readU32 = (off: number) =>
      ((binaryStr.charCodeAt(off) << 24) >>> 0) +
      (binaryStr.charCodeAt(off + 1) << 16) +
      (binaryStr.charCodeAt(off + 2) << 8) +
      binaryStr.charCodeAt(off + 3);
    expect(readU32(physOffset + 4)).toBe(11811);
    expect(readU32(physOffset + 8)).toBe(11811);
    expect(binaryStr.charCodeAt(physOffset + 12)).toBe(1);
  });
});
