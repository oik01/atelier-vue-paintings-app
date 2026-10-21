// @vitest-environment jsdom
// src/__tests__/appIntegration.test.tsx
// V2.4 Root End-to-End Integration Test Suite across all 4 Subsystems & Workflow Pages:
// - Option 5 Wabi-Sabi Tactile Canvas Studio Masthead (`atelier-grand-masthead`) & Slogan ("Unique Art Pieces Made for You & Your Space")
// - Prominent 4-Card Illuminated Step Frieze (`workflow-step-nav`: 01 Share Your Space, 02 Shape Your Vision, 03 Scale & Create, 04 Visualize & Acquire)
// - Dedicated Add-Angle Upload & Camera Screen (`add-angle-upload-screen`: `add-angle-upload-file-btn` & `add-angle-use-camera-btn`)
// - 16 Curated Fine-Art Style Presets + Quick Wall Placement & Palette/Mood Preset Chips
// - Skippable Page 3 AI Scale & Measurement Calibration (`workflow-page-3-scale`) & Order-Stage Recommended Size (`scale-recommendation-banner`, `recommended-size-badge`, `modal-scale-recommendation-banner`)
// - Multi-Angle & Multi-Piece Workflow with Unobstructed In-Room Visualization & Zero AI Model Announcements

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import {
  clearAtelierV2State,
  getLastTriggeredDownload,
  loadAtelierV2State,
} from '../subsystems/checkout-and-download';

// Enable React 18 act() environment flag for JSDOM
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedApp {
  container: HTMLDivElement;
  root: Root;
  getByTestId: (testId: string) => HTMLElement;
  queryByTestId: (testId: string) => HTMLElement | null;
  unmount: () => void;
}

function mountApp(): MountedApp {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  const queryByTestId = (testId: string): HTMLElement | null => {
    return (
      container.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ??
      document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
    );
  };

  const getByTestId = (testId: string): HTMLElement => {
    const el = queryByTestId(testId);
    if (!el) {
      throw new Error(`Unable to find element with data-testid="${testId}"`);
    }
    return el;
  };

  const unmount = () => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };

  return { container, root, getByTestId, queryByTestId, unmount };
}

function clickElement(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function clickAndFlushPipeline(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 160));
  });
}

function setTextInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const prototype =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  act(() => {
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setSelectValue(el: HTMLSelectElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value'
  )?.set;
  act(() => {
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function assertZeroAiModelOrSecretTerms(text: string): void {
  const lower = text.toLowerCase();
  expect(lower).not.toContain('astra');
  expect(lower).not.toContain('gemini argon');
  expect(lower).not.toContain('gpt-6');
  expect(lower).not.toContain('nano banana');
  expect(lower).not.toContain('screenshot');
  expect(lower).not.toContain('crop box');
  expect(lower).not.toContain('bbox');
  expect(lower).not.toContain('2nd-prompt');
}

function createMockOpenRouterFetch() {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};

    // Vision Preservation Verification, Artwork Localization & AI Scale Calibration Questions (response_format: { type: 'json_object' })
    if (parsedBody?.response_format?.type === 'json_object') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  furniture_preserved: true,
                  room_dimensions_preserved: true,
                  only_difference_is_wall_art: true,
                  verification_summary:
                    'Verified: all furniture, lighting, and room dimensions are 100% preserved; only wall art was updated.',
                  room_style:
                    'Warm plaster gallery interior with natural morning daylight and white oak accents.',
                  artwork_bbox_normalized: [165, 295, 555, 705],
                  artwork_title: 'Terracotta & Raw Linen Impasto Study',
                  artwork_description:
                    'Tactile palette-knife oil composition in warm ochre, burnt sienna, and mineral ivory.',
                }),
              },
            },
          ],
        }),
      };
    }

    // Multimodal Image Synthesis Call
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#EAE2D3"/><rect x="350" y="150" width="500" height="380" fill="#B85D3B"/></svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;

    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Generated studio image.',
              images: [
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
              ],
            },
          },
        ],
      }),
    };
  });
}

describe('ATELIER VUE V2.4 — Option 5 Wabi-Sabi Tactile Canvas Studio End-to-End Integration', () => {
  let mounted: MountedApp | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    clearAtelierV2State();
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', createMockOpenRouterFetch());
  });

  afterEach(() => {
    if (mounted) {
      mounted.unmount();
      mounted = null;
    }
    vi.unstubAllGlobals();
  });

  it('1. renders Option 5 Monumental Masthead ("ATELIER VUE"), Slogan ("Unique Art Pieces Made for You & Your Space"), 4-Card Illuminated Step Frieze (01..04 with Scale & Create), Non-Photo Description Path, zero <a href> links, and zero AI model names', () => {
    mounted = mountApp();

    // Option 5 Monumental Masthead & Slogan ([SPEC PATCH #21])
    expect(mounted.getByTestId('studio-header')).toBeTruthy();
    expect(mounted.getByTestId('atelier-grand-masthead')).toBeTruthy();
    expect(mounted.getByTestId('header-brand-title').textContent).toBe('ATELIER VUE');
    const sloganEl = mounted.getByTestId('atelier-masthead-slogan');
    expect(sloganEl.textContent).toBe(
      'Unique Art Pieces Made for You & Your Space'
    );
    expect(sloganEl.textContent).not.toContain('Home');

    // Prominent 4-Card Illuminated Step Frieze ([SPEC PATCH #22] & [#27])
    expect(mounted.getByTestId('workflow-step-nav')).toBeTruthy();
    const step1 = mounted.getByTestId('nav-step-page-1-space');
    const step2 = mounted.getByTestId('nav-step-page-2-curation');
    const step3 = mounted.getByTestId('nav-step-page-3-scale');
    const step4 = mounted.getByTestId('nav-step-page-4-gallery') as HTMLButtonElement;

    expect(step1.getAttribute('aria-pressed')).toBe('true');
    expect(step1.textContent).toContain('01');
    expect(step1.textContent).toContain('Share Your Space');
    expect(step2.textContent).toContain('02');
    expect(step2.textContent).toContain('Shape Your Vision');
    expect(step3.textContent).toContain('03');
    expect(step3.textContent).toContain('Atelier Creation');
    expect(step4.textContent).toContain('04');
    expect(step4.textContent).toContain('Visualize, Size & Acquire');
    expect(step4.disabled).toBe(true);

    // Page 1 (Share Your Space): Head-On Level Photo Instructions + Upload Dropzone + Non-Photo Description Section
    expect(mounted.getByTestId('workflow-page-1-space')).toBeTruthy();
    expect(mounted.getByTestId('head-on-photo-instruction-banner')).toBeTruthy();
    expect(mounted.getByTestId('head-on-photo-instruction-banner').textContent).toContain(
      'head-on to the wall in a level manner'
    );
    expect(mounted.getByTestId('upload-room-dropzone')).toBeTruthy();
    expect(mounted.getByTestId('upload-room-file-btn')).toBeTruthy();
    expect(mounted.getByTestId('take-room-photo-btn')).toBeTruthy();
    expect(mounted.getByTestId('non-photo-describe-section')).toBeTruthy();
    expect(mounted.getByTestId('describe-without-photo-input')).toBeTruthy();
    expect(mounted.getByTestId('proceed-by-describing-btn')).toBeTruthy();

    // Pages 2, 3, and 4 are NOT stacked on Page 1
    expect(mounted.queryByTestId('workflow-page-2-curation')).toBeNull();
    expect(mounted.queryByTestId('workflow-page-3-scale')).toBeNull();
    expect(mounted.queryByTestId('workflow-page-3-creating')).toBeNull();
    expect(mounted.queryByTestId('workflow-page-4-gallery')).toBeNull();

    // Strict Zero Broken Links & Zero AI Model Announcements ([SPEC PATCH #23])
    expect(document.querySelectorAll('a').length).toBe(0);
    assertZeroAiModelOrSecretTerms(mounted.container.textContent ?? '');
  });

  it('2. opens the dedicated Add-Angle Upload & Camera Screen (`add-angle-upload-screen`) when clicking `add-room-angle-btn`, supports designating the Head-On Photo (`isHeadOnSizingPhoto`), and completes Multi-Angle & Multi-Piece creation', async () => {
    mounted = mountApp();

    // Page 1: Capture primary room photo via in-app camera viewfinder (Angle 1)
    clickElement(mounted.getByTestId('take-room-photo-btn'));
    expect(mounted.getByTestId('camera-capture-modal')).toBeTruthy();
    clickElement(mounted.getByTestId('camera-shutter-btn'));

    expect(mounted.getByTestId('uploaded-room-preview-card')).toBeTruthy();
    expect(mounted.getByTestId('head-on-photo-badge')).toBeTruthy();
    expect(mounted.getByTestId('room-angle-card-0')).toBeTruthy();
    expect(mounted.queryByTestId('room-angle-card-1')).toBeNull();

    // [SPEC PATCH #25]: Click `+ Add Another Angle / Viewpoint` (`add-room-angle-btn`)
    clickElement(mounted.getByTestId('add-room-angle-btn'));
    const addAngleScreen = mounted.getByTestId('add-angle-upload-screen');
    expect(addAngleScreen).toBeTruthy();
    expect(mounted.getByTestId('new-angle-label-input')).toBeTruthy();
    expect(mounted.getByTestId('new-angle-is-head-on-checkbox')).toBeTruthy();
    expect(mounted.getByTestId('add-angle-upload-file-btn')).toBeTruthy();
    expect(mounted.getByTestId('add-angle-use-camera-btn')).toBeTruthy();
    expect(mounted.getByTestId('close-add-angle-screen-btn')).toBeTruthy();

    // Customize the 2nd angle label and capture via `add-angle-use-camera-btn` + `camera-shutter-btn`
    const angleLabelInput = mounted.getByTestId(
      'new-angle-label-input'
    ) as HTMLInputElement;
    setTextInputValue(angleLabelInput, 'Angle 2 (Dining Corner View)');

    clickElement(mounted.getByTestId('add-angle-use-camera-btn'));
    expect(mounted.getByTestId('camera-capture-modal')).toBeTruthy();
    clickElement(mounted.getByTestId('camera-shutter-btn'));

    // Verify `add-angle-upload-screen` closed and both Angle 1 and Angle 2 are in `uploaded-room-angles-gallery`
    expect(mounted.queryByTestId('add-angle-upload-screen')).toBeNull();
    expect(mounted.getByTestId('uploaded-room-angles-gallery')).toBeTruthy();
    expect(mounted.getByTestId('room-angle-card-0')).toBeTruthy();
    expect(mounted.getByTestId('room-angle-card-1')).toBeTruthy();
    expect(mounted.getByTestId('room-angle-card-1').textContent).toContain(
      'Angle 2 (Dining Corner View)'
    );

    // Continue to Page 2 (Shape Your Vision) and select Coordinated Pair (2 Pieces)
    clickElement(mounted.getByTestId('goto-page-2-curation-btn'));
    expect(mounted.getByTestId('workflow-page-2-curation')).toBeTruthy();
    clickElement(mounted.getByTestId('piece-count-multi-piece-pair'));

    // Click submit — transitions through Page 3 Creating to Page 4 Gallery
    await clickAndFlushPipeline(mounted.getByTestId('reimagine-room-submit-btn'));

    // Automatically lands on Page 4 (Visualize, Size & Acquire)
    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();
    expect(mounted.getByTestId('reimagined-variations-strip')).toBeTruthy();
    expect(mounted.getByTestId('screenshot-and-print-studio')).toBeTruthy();

    // Multi-angle viewpoint switching (`viewpoint-pill-0` -> `viewpoint-pill-1`)
    expect(mounted.getByTestId('viewpoint-selector-strip')).toBeTruthy();
    expect(mounted.getByTestId('viewpoint-head-on-badge-0')).toBeTruthy();
    const pill0 = mounted.getByTestId('viewpoint-pill-0');
    const pill1 = mounted.getByTestId('viewpoint-pill-1');
    expect(pill0.getAttribute('aria-pressed')).toBe('true');
    expect(pill1.getAttribute('aria-pressed')).toBe('false');

    clickElement(pill1);
    expect(mounted.getByTestId('viewpoint-pill-1').getAttribute('aria-pressed')).toBe(
      'true'
    );

    // Multi-art-piece selector strip (`art-piece-pill-0` & `art-piece-pill-1`)
    expect(mounted.getByTestId('art-piece-selector-strip')).toBeTruthy();
    clickElement(mounted.getByTestId('art-piece-pill-1'));
    expect(
      mounted.getByTestId('art-piece-pill-1').getAttribute('aria-selected') ??
        mounted.getByTestId('art-piece-pill-1').getAttribute('aria-pressed')
    ).toBe('true');

    assertZeroAiModelOrSecretTerms(mounted.container.textContent ?? '');
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  it('3. supports 16 expanded style presets + placement/mood chips on Page 2, generates the art piece, opens the single-trigger optional Size Calibration Window on Page 4, and highlights the Recommended Print Size on Page 4 and in AcquirePrintModal', async () => {
    mounted = mountApp();

    // Proceed via non-photo description path from Page 1 -> Page 2
    const describeTextarea = mounted.getByTestId(
      'describe-without-photo-input'
    ) as HTMLTextAreaElement;
    setTextInputValue(
      describeTextarea,
      'Sunlit travertine living room with wide oak sofa and high gallery ceiling.'
    );
    clickElement(mounted.getByTestId('proceed-by-describing-btn'));

    expect(mounted.getByTestId('workflow-page-2-curation')).toBeTruthy();
    // Verify size calibration window is NOT triggered on Page 2
    expect(mounted.queryByTestId('goto-page-3-scale-btn')).toBeNull();

    // [SPEC PATCH #26] Verify 16 expanded fine-art style presets are rendered and interactive
    expect(mounted.getByTestId('style-preset-impasto-oil')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-wabi-sabi-plaster')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-rothko-colorfield')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-nordic-monochrome')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-mediterranean-fresco')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-contemporary-figurative')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-japanese-woodblock')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-sculptural-paper-relief')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-abstract-expressionist')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-classical-still-life')).toBeTruthy();
    expect(mounted.getByTestId('style-preset-desert-earth-strata')).toBeTruthy();

    clickElement(mounted.getByTestId('style-preset-rothko-colorfield'));
    expect(
      mounted.getByTestId('style-preset-rothko-colorfield').getAttribute('aria-pressed')
    ).toBe('true');

    clickElement(mounted.getByTestId('style-preset-desert-earth-strata'));
    expect(
      mounted
        .getByTestId('style-preset-desert-earth-strata')
        .getAttribute('aria-pressed')
    ).toBe('true');

    // Test Quick Wall Placement chip and Quick Palette & Mood chip
    clickElement(mounted.getByTestId('placement-preset-chip-0'));
    const placementInput = mounted.getByTestId(
      'placement-location-input'
    ) as HTMLInputElement;
    expect(placementInput.value).toBe('Centered above main sofa');

    clickElement(mounted.getByTestId('details-preset-chip-0'));
    const detailsInput = mounted.getByTestId(
      'additional-user-details-input'
    ) as HTMLTextAreaElement;
    expect(detailsInput.value).toContain('Warm Linen, Ochre & Terracotta');

    // Generate the art piece and transition to Page 4
    await clickAndFlushPipeline(mounted.getByTestId('reimagine-room-submit-btn'));
    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();

    // Open the optional Size Calibration Window from its ONLY trigger point (`approve-and-size-painting-btn`)
    expect(mounted.queryByTestId('open-scale-calibration-from-gallery-btn')).toBeNull();
    expect(mounted.queryByTestId('open-caliper-sizing-modal-btn')).toBeNull();
    await clickAndFlushPipeline(mounted.getByTestId('approve-and-size-painting-btn'));

    expect(mounted.getByTestId('caliper-sizing-modal')).toBeTruthy();
    expect(mounted.getByTestId('scale-calibration-page')).toBeTruthy();
    expect(mounted.getByTestId('sizing-head-on-photo-indicator')).toBeTruthy();
    expect(mounted.getByTestId('same-wall-measurement-instructions')).toBeTruthy();

    // Starts with 1 caliper (Caliper A)
    const qInput0 = mounted.getByTestId('scale-question-input-0') as HTMLInputElement;
    expect(qInput0).toBeTruthy();
    expect(mounted.queryByTestId('scale-question-input-1')).toBeNull();

    // Enter a single measurement on Caliper A (84 inches) — one measurement is enough to calibrate
    setTextInputValue(qInput0, '84');
    expect(qInput0.value).toBe('84');

    const scalePreview = mounted.getByTestId('scale-page-recommendation-preview');
    expect(scalePreview).toBeTruthy();
    expect(scalePreview.textContent).toContain('Calibrated');
    expect(mounted.getByTestId('scale-recommended-dimensions-label')).toBeTruthy();

    // Click "Apply Calibrated Size (...) to Painting →" (`apply-scale-and-create-btn`)
    await clickAndFlushPipeline(mounted.getByTestId('apply-scale-and-create-btn'));

    // [SPEC PATCH #28] Verify Page 4 Gallery displays the Scale Recommendation Banner & Recommended Size Badge
    expect(mounted.queryByTestId('caliper-sizing-modal')).toBeNull();
    const galleryBanner = mounted.getByTestId('scale-recommendation-banner');
    expect(galleryBanner).toBeTruthy();
    expect(galleryBanner.textContent).toContain('Recommended Size for Your Space');
    expect(mounted.getByTestId('recommended-size-badge')).toBeTruthy();

    // Open AcquirePrintModal and verify `modal-scale-recommendation-banner` is displayed
    clickElement(mounted.getByTestId('open-print-order-modal-btn'));
    expect(mounted.getByTestId('acquire-print-modal')).toBeTruthy();
    const modalScaleBanner = mounted.getByTestId('modal-scale-recommendation-banner');
    expect(modalScaleBanner).toBeTruthy();
    expect(modalScaleBanner.textContent).toContain(
      'Recommended Size Based on Your Room Measurements'
    );

    assertZeroAiModelOrSecretTerms(document.body.textContent ?? '');
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  it('4. supports skipping the optional Size Calibration Window completely, scrolls sizes (12x16–36x48) and frames on Page 4, downloads the 300-DPI print file, and dispatches a partner order', async () => {
    mounted = mountApp();

    // Page 1 -> Page 2 -> Reimagine Room directly (without opening the optional sizing window)
    clickElement(mounted.getByTestId('proceed-by-describing-btn'));
    await clickAndFlushPipeline(mounted.getByTestId('reimagine-room-submit-btn'));

    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();
    const framedPreview = mounted.getByTestId('framed-print-preview');
    expect(framedPreview.getAttribute('data-size-id')).toBe('24x36');
    expect(framedPreview.getAttribute('data-frame-id')).toBe('natural-white-oak');

    // Scroll through all 5 print sizes (12x16 to 36x48)
    for (const sizeId of ['12x16', '18x24', '24x36', '30x40', '36x48'] as const) {
      clickElement(mounted.getByTestId(`size-option-${sizeId}`));
      expect(framedPreview.getAttribute('data-size-id')).toBe(sizeId);
    }

    // Scroll through museum frame profiles
    clickElement(mounted.getByTestId('frame-option-brushed-brass-float'));
    expect(framedPreview.getAttribute('data-frame-id')).toBe('brushed-brass-float');

    // Trigger direct 300-DPI print file download from Page 4
    await clickAndFlushPipeline(mounted.getByTestId('direct-download-print-btn'));

    expect(mounted.getByTestId('download-confirmation-badge')).toBeTruthy();
    const lastDownload = getLastTriggeredDownload();
    expect(lastDownload).not.toBeNull();
    expect(lastDownload?.filename).toContain('36x48');

    // Open AcquirePrintModal from "Order Printed & Framed Version" CTA
    clickElement(mounted.getByTestId('open-print-order-modal-btn'));
    const modal = mounted.getByTestId('acquire-print-modal');
    expect(modal).toBeTruthy();

    // Switch to Mode 1 (Download High-Res Print Master) inside modal and trigger download
    clickElement(mounted.getByTestId('tab-download-master'));
    expect(mounted.getByTestId('side-by-side-print-verification')).toBeTruthy();
    clickElement(mounted.getByTestId('modal-download-highres-btn'));
    expect(mounted.getByTestId('download-success-banner')).toBeTruthy();

    // Switch to Mode 2 (Order Printed & Framed Version)
    clickElement(mounted.getByTestId('tab-order-print'));
    expect(mounted.getByTestId('pricing-breakdown-ledger')).toBeTruthy();

    // Select Print Partner (FinerWorks) and adjust markup pill (+22%)
    clickElement(mounted.getByTestId('partner-card-finerworks'));
    clickElement(mounted.getByTestId('markup-pill-22'));

    // Fill collector sample shipping address and submit order
    clickElement(mounted.getByTestId('fill-sample-address-btn'));
    clickElement(mounted.getByTestId('submit-partner-order-btn'));

    // Verify confirmed order receipt is rendered and persisted
    const receipt = mounted.getByTestId('order-confirmation-receipt');
    expect(receipt).toBeTruthy();
    expect(receipt.textContent).toMatch(/STATUS: (DISPATCHED|QUEUED)/);

    const persistedV2 = loadAtelierV2State();
    expect(persistedV2.orders.length).toBeGreaterThanOrEqual(1);
    assertZeroAiModelOrSecretTerms(document.body.textContent ?? '');
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  it('5. persists variations, selectedSizeId, and selectedFrameId across page reload (unmount + remount), and supports "Start Fresh" (reset-workspace-btn) to return to Page 1', async () => {
    mounted = mountApp();

    // Page 1 -> Page 2: Configure Replace Existing Art and generate
    clickElement(mounted.getByTestId('proceed-by-describing-btn'));
    clickElement(mounted.getByTestId('placement-action-replace-existing'));

    await clickAndFlushPipeline(mounted.getByTestId('reimagine-room-submit-btn'));

    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();
    clickElement(mounted.getByTestId('size-option-30x40'));
    clickElement(mounted.getByTestId('frame-option-matte-gallery-black'));

    // Unmount and remount <App /> to simulate browser reload
    mounted.unmount();
    mounted = mountApp();

    // Verify persisted state restores directly to Page 4 Gallery with all preferences intact
    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();
    expect(mounted.getByTestId('progressive-three-stage-studio')).toBeTruthy();
    const framedPreview = mounted.getByTestId('framed-print-preview');
    expect(framedPreview.getAttribute('data-size-id')).toBe('30x40');
    expect(framedPreview.getAttribute('data-frame-id')).toBe('matte-gallery-black');

    // Click "Start Fresh" (`reset-workspace-btn`) to return to Page 1 with nothing uploaded
    clickElement(mounted.getByTestId('reset-workspace-btn'));
    expect(mounted.getByTestId('workflow-page-1-space')).toBeTruthy();
    expect(mounted.getByTestId('upload-room-dropzone')).toBeTruthy();
    expect(mounted.getByTestId('non-photo-describe-section')).toBeTruthy();
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  it('6. auto-matches default frame & mat width to the AI-generated room image, starts the Caliper Sizing Window with 1 sleek caliper, allows adding Caliper B, flags a >5% scale inaccuracy error when measurements disagree, and sizes the frame/photo when within <=5%', async () => {
    mounted = mountApp();

    // Page 1 -> Page 2 -> Reimagine Room directly
    clickElement(mounted.getByTestId('proceed-by-describing-btn'));
    await clickAndFlushPipeline(mounted.getByTestId('reimagine-room-submit-btn'));

    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();

    // 1. Verify Default Frame & Mat Width Matched to Rendered Room Image
    const aiMatchedBadge = mounted.getByTestId('ai-matched-frame-mat-badge');
    expect(aiMatchedBadge).toBeTruthy();
    expect(aiMatchedBadge.textContent).toContain(
      'Default Frame & Mat Matched to Rendered Room Image'
    );

    const framedPreview = mounted.getByTestId('framed-print-preview');
    const matchedFrameId = framedPreview.getAttribute('data-frame-id');
    const matchedMatId = framedPreview.getAttribute('data-mat-width');
    expect(matchedFrameId).toBeTruthy();
    expect(matchedMatId).toBeTruthy();
    expect(mounted.getByTestId(`ai-matched-frame-pill-${matchedFrameId}`)).toBeTruthy();
    expect(mounted.getByTestId(`ai-matched-mat-pill-${matchedMatId}`)).toBeTruthy();

    // 2. Verify "Approve Painting & Open Optional Sizing Tool" bar beneath visualization stage
    expect(mounted.getByTestId('approve-painting-sizing-bar')).toBeTruthy();
    const approveAndSizeBtn = mounted.getByTestId('approve-and-size-painting-btn');
    expect(approveAndSizeBtn).toBeTruthy();

    // Click to open the dedicated Post-Visualization Caliper Sizing Window modal
    await clickAndFlushPipeline(approveAndSizeBtn);

    const caliperModal = mounted.getByTestId('caliper-sizing-modal');
    expect(caliperModal).toBeTruthy();
    expect(mounted.getByTestId('caliper-image-canvas')).toBeTruthy();
    expect(mounted.getByTestId('caliper-svg-overlay')).toBeTruthy();
    expect(mounted.getByTestId('caliper-artwork-box')).toBeTruthy();

    // 3. Starts with ONLY 1 Caliper (Caliper A) visible
    expect(mounted.getByTestId('image-caliper-0')).toBeTruthy();
    expect(mounted.getByTestId('scale-question-card-0')).toBeTruthy();
    expect(mounted.queryByTestId('image-caliper-1')).toBeNull();
    expect(mounted.queryByTestId('scale-question-card-1')).toBeNull();

    // 4. User enters 1st measurement on Caliper A (72") and leaves it
    const qInput0 = mounted.getByTestId('scale-question-input-0') as HTMLInputElement;
    setTextInputValue(qInput0, '72');

    // 5. User clicks "+ Add Another Measurement (Caliper B)" to add 2nd caliper
    clickElement(mounted.getByTestId('add-second-caliper-btn'));
    expect(mounted.getByTestId('image-caliper-1')).toBeTruthy();
    expect(mounted.getByTestId('scale-question-card-1')).toBeTruthy();

    // 6. Enter a mismatched 2nd measurement (>5% scale difference: 72" vs 140") -> triggers Measurement Inaccuracy Error
    const qInput1 = mounted.getByTestId('scale-question-input-1') as HTMLInputElement;
    setTextInputValue(qInput1, '140');
    const errorBanner = mounted.getByTestId('scale-inaccuracy-error-banner');
    expect(errorBanner).toBeTruthy();
    expect(errorBanner.textContent).toContain('Measurement Inaccuracy Error');
    expect(
      (mounted.getByTestId('scale-create-art-submit-btn') as HTMLButtonElement).disabled
    ).toBe(true);

    // 7. Enter a matching 2nd measurement within <=5% scale tolerance (72" on span 580 and 96" on span 774 -> 0.1% diff)
    setTextInputValue(qInput1, '96');
    expect(mounted.queryByTestId('scale-inaccuracy-error-banner')).toBeNull();
    expect(mounted.getByTestId('scale-within-tolerance-badge')).toBeTruthy();

    // Verify recalibrated actual Outer Frame Size, Inner Picture Size, Suggested Print Size, and Recommended Art Piece Details
    const recalibratedCard = mounted.getByTestId('caliper-recalibrated-dimensions-card');
    expect(recalibratedCard).toBeTruthy();
    expect(mounted.getByTestId('calculated-outer-frame-dims').textContent).toContain('"');
    expect(mounted.getByTestId('calculated-inner-picture-dims').textContent).toContain('"');
    expect(mounted.getByTestId('scale-live-recommended-size').textContent).toContain('"');
    expect(mounted.getByTestId('recommended-art-piece-details')).toBeTruthy();

    // Click "Apply Calibrated Size (...) to Painting →" inside the Caliper Sizing Window
    await clickAndFlushPipeline(mounted.getByTestId('scale-create-art-submit-btn'));

    // Modal should close and apply the calibrated size to the painting on Page 4
    expect(mounted.queryByTestId('caliper-sizing-modal')).toBeNull();
    expect(mounted.getByTestId('recommended-size-callout-banner')).toBeTruthy();
    expect(mounted.getByTestId('recommended-size-badge')).toBeTruthy();
    assertZeroAiModelOrSecretTerms(document.body.textContent ?? '');
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  it('7. completes full FinerWorks v3 & White-Label Brand Identity workflow: inspects 5 gallery brands, switches active brand, locks FinerWorks substrate/frame/size on Page 2, verifies Dual AI Checker Agent badges & audit drawer on Page 4, updates media/glazing & live SKU, selects carrier shipping EX, previews 600×180 packing slip & COA, and completes a FinerWorks order', async () => {
    mounted = mountApp();

    // 1. Verify initial flagship White-Label Brand badge in masthead and open Brand & FinerWorks Studio modal
    const brandBadge = mounted.getByTestId('active-white-label-brand-badge');
    expect(brandBadge.textContent).toContain('Atelier Vue');
    expect(brandBadge.textContent).toContain('New Orleans');

    clickElement(mounted.getByTestId('open-brand-and-sync-modal-btn'));
    expect(mounted.getByTestId('finerworks-brand-and-sync-modal')).toBeTruthy();

    // Inspect all 5 White-Label Brand Identities
    const brandIds = [
      'atelier-koma',
      'galerie-vauban',
      'werkstatt-neue',
      'stillwater-press',
      'the-nocturne-archive',
    ] as const;
    for (const id of brandIds) {
      expect(mounted.getByTestId(`brand-option-card-${id}`)).toBeTruthy();
    }

    // Switch active brand to Galerie Vauban and verify header badge & modal previews update
    clickElement(mounted.getByTestId('brand-option-card-galerie-vauban'));
    expect(mounted.getByTestId('active-white-label-brand-badge').textContent).toContain(
      'Galerie Vauban'
    );
    expect(
      (mounted.getByTestId('brand-modal-packing-slip-preview').textContent ?? '').toUpperCase()
    ).toContain('GALERIE VAUBAN');
    expect(
      (mounted.getByTestId('brand-modal-coa-preview').textContent ?? '').toUpperCase()
    ).toContain('GALERIE VAUBAN');

    // Close Brand & FinerWorks Studio modal
    clickElement(mounted.getByTestId('close-brand-and-sync-modal-btn'));
    expect(mounted.queryByTestId('finerworks-brand-and-sync-modal')).toBeNull();

    // 2. Navigate to Page 2, toggle FinerWorks Locked Mode, and lock substrate/frame/size
    clickElement(mounted.getByTestId('proceed-by-describing-btn'));
    expect(mounted.getByTestId('workflow-page-2-curation')).toBeTruthy();
    expect(mounted.getByTestId('finerworks-pre-config-section')).toBeTruthy();

    clickElement(mounted.getByTestId('finerworks-mode-locked'));
    expect(mounted.getByTestId('finerworks-locked-options-grid')).toBeTruthy();

    const lockMediaSelect = mounted.getByTestId(
      'finerworks-lock-media-select'
    ) as HTMLSelectElement;
    const lockFrameSelect = mounted.getByTestId(
      'finerworks-lock-frame-select'
    ) as HTMLSelectElement;
    const lockSizeSelect = mounted.getByTestId(
      'finerworks-lock-size-select'
    ) as HTMLSelectElement;

    setSelectValue(lockMediaSelect, '41'); // Museum Fine Art Matte Rag 310gsm
    setSelectValue(lockFrameSelect, 'american-black-walnut');
    setSelectValue(lockSizeSelect, '24x36');

    const lockedSkuPreview = mounted.getByTestId('finerworks-locked-sku-preview');
    expect(lockedSkuPreview.textContent).toContain('5M41');

    // 3. Generate reimagined room variations and verify Dual AI Checker Agent badges & drawer on Page 4
    await clickAndFlushPipeline(mounted.getByTestId('reimagine-room-submit-btn'));
    expect(mounted.getByTestId('workflow-page-4-gallery')).toBeTruthy();

    const provenanceBar = mounted.getByTestId('dual-verification-provenance-bar');
    expect(provenanceBar).toBeTruthy();
    expect(mounted.getByTestId('preservation-verification-badge')).toBeTruthy();
    expect(mounted.getByTestId('finerworks-verification-badge')).toBeTruthy();

    // Open Progressive-Disclosure Dual Audit Receipt Drawer
    expect(mounted.queryByTestId('dual-audit-receipt-drawer')).toBeNull();
    clickElement(mounted.getByTestId('toggle-dual-audit-receipt-btn'));
    const auditDrawer = mounted.getByTestId('dual-audit-receipt-drawer');
    expect(auditDrawer).toBeTruthy();
    expect(mounted.getByTestId('audit-check-furniture')).toBeTruthy();
    expect(mounted.getByTestId('audit-check-room-dimensions')).toBeTruthy();
    expect(mounted.getByTestId('audit-check-only-art-changed')).toBeTruthy();
    expect(mounted.getByTestId('audit-check-frame-option')).toBeTruthy();
    expect(mounted.getByTestId('audit-check-matting-glazing')).toBeTruthy();
    expect(mounted.getByTestId('audit-check-sizing-aspect')).toBeTruthy();
    expect(mounted.getByTestId('audit-check-substrate-surface')).toBeTruthy();
    expect(mounted.getByTestId('audit-matched-product-code')).toBeTruthy();

    // 4. Change FinerWorks media & glazing on Page 4 and verify live SKU updates dynamically
    expect(mounted.getByTestId('finerworks-media-scroller')).toBeTruthy();
    expect(mounted.getByTestId('finerworks-glazing-strip')).toBeTruthy();

    const initialProductCode =
      mounted.getByTestId('finerworks-active-product-code').textContent ?? '';
    expect(initialProductCode.length).toBeGreaterThan(5);

    clickElement(mounted.getByTestId('finerworks-media-btn-45')); // Cold Press Watercolor Archival 315gsm
    clickElement(
      mounted.getByTestId('glazing-option-btn-non-glare-museum-acrylic')
    );

    const updatedProductCode =
      mounted.getByTestId('finerworks-active-product-code').textContent ?? '';
    expect(updatedProductCode).toContain('5M45');
    expect(updatedProductCode).toContain('G2');
    expect(updatedProductCode).not.toBe(initialProductCode);

    // 5. Open Checkout Modal (AcquirePrintModal), select carrier shipping EX, preview 600×180 Packing Slip & COA, and complete order
    clickElement(mounted.getByTestId('open-print-order-modal-btn'));
    expect(mounted.getByTestId('acquire-print-modal')).toBeTruthy();
    expect(mounted.getByTestId('finerworks-shipping-options-group')).toBeTruthy();

    const shippingExBtn = mounted.getByTestId('shipping-option-EX');
    clickElement(shippingExBtn);
    expect(shippingExBtn.getAttribute('aria-pressed')).toBe('true');

    // Preview 600×180 White-Label Packing Slip & COA
    expect(mounted.queryByTestId('white-label-packing-slip-preview')).toBeNull();
    clickElement(mounted.getByTestId('toggle-packing-slip-preview-btn'));
    const packingSlipPreview = mounted.getByTestId(
      'white-label-packing-slip-preview'
    );
    expect(packingSlipPreview).toBeTruthy();
    expect((packingSlipPreview.textContent ?? '').toUpperCase()).toContain('GALERIE VAUBAN');

    // Fill sample address and submit FinerWorks order
    clickElement(mounted.getByTestId('fill-sample-address-btn'));
    clickElement(mounted.getByTestId('submit-partner-order-btn'));

    const orderReceipt = mounted.getByTestId('order-confirmation-receipt');
    expect(orderReceipt).toBeTruthy();
    expect(orderReceipt.textContent).toMatch(/STATUS: (DISPATCHED|QUEUED)/);
    expect((orderReceipt.textContent ?? '').toUpperCase()).toContain('GALERIE VAUBAN');
    expect(orderReceipt.textContent).toContain(updatedProductCode);

    assertZeroAiModelOrSecretTerms(document.body.textContent ?? '');
    expect(document.querySelectorAll('a').length).toBe(0);
  });
});
