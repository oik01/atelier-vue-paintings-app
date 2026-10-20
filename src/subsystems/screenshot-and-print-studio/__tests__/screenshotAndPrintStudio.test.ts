import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FrameProfileId,
  GeneratedArtPiece,
  MatWidthId,
  NormalizedCropBox,
  PrintSizeId,
  PRINT_SIZES,
  ReimaginedRoomVariation,
  ReimaginedRoomViewpoint,
  RoomPreservationVerification,
} from '../../../contracts/masterContract';
import { FINERWORKS_MEDIA_SPECS } from '../../finerworks-catalog-sync';
import {
  ArtworkScreenshotCropper,
  buildHighResPrintMasterFile,
  clampNormalizedCropBox,
  computeSideBySideFidelityMetrics,
  cropImageFromNormalizedBox,
  HighResPrintMasterFileResult,
  InRoomSpaceVisualizer,
  ScreenshotAndPrintStudio,
  SizeAndFrameScroller,
} from '../index';

function createMockPreservationVerification(
  overrides: Partial<RoomPreservationVerification> = {}
): RoomPreservationVerification {
  return {
    passed: true,
    furniturePreserved: true,
    roomDimensionsPreserved: true,
    onlyArtChanged: true,
    verifierModelId: 'openai/gpt-6-astra',
    summaryNote:
      'Spatial Fidelity Assured · Pre-existing furnishings & room dimensions faithfully preserved',
    attemptsUsed: 1,
    ...overrides,
  };
}

function createMockVariation(
  overrides: Partial<ReimaginedRoomVariation> = {}
): ReimaginedRoomVariation {
  const defaultPreservation =
    overrides.preservationVerification ?? createMockPreservationVerification();
  const detectedCropBox = overrides.detectedCropBox ?? {
    ymin: 180,
    xmin: 260,
    ymax: 580,
    xmax: 740,
  };
  const activeCropBox = overrides.activeCropBox ?? {
    ymin: 200,
    xmin: 300,
    ymax: 600,
    xmax: 700,
  };
  const originalRoomDataUrl =
    overrides.originalRoomDataUrl ?? 'data:image/png;base64,ORIGINAL_ROOM_BASE64';
  const reimaginedRoomDataUrl =
    overrides.reimaginedRoomDataUrl ??
    'data:image/png;base64,REIMAGINED_ROOM_BASE64';
  const croppedScreenshotDataUrl =
    overrides.croppedScreenshotDataUrl ??
    'data:image/png;base64,CROPPED_SCREENSHOT_BASE64';

  const defaultViewpoints: ReimaginedRoomViewpoint[] = [
    {
      angleId: 'angle-1-main',
      angleLabel: 'Main Wall Straight-On',
      originalRoomDataUrl,
      reimaginedRoomDataUrl,
      detectedCropBox,
      activeCropBox,
      croppedScreenshotDataUrl,
      preservationVerification: defaultPreservation,
    },
  ];

  const defaultArtPieces: GeneratedArtPiece[] = [
    {
      id: 'piece-01',
      index: 0,
      title: overrides.artworkTitle ?? 'Ochre & Travertine Study No. IV',
      wallLocationLabel: 'Primary Focal Wall Above Sofa',
      description:
        overrides.artworkDescription ??
        'Impasto linen study harmonized to warm oak undertones.',
      identicalPrintMasterDataUrl:
        overrides.identicalPrintMasterDataUrl ??
        'data:image/png;base64,IDENTICAL_PRINT_MASTER_BASE64',
      printMasterWidthPx: 2400,
      printMasterHeightPx: 3600,
    },
  ];

  return {
    id: 'variation-test-01',
    createdAt: 1730000000000,
    engineId: 'astra',
    engineModelName: 'GPT-6 Astra (openai/gpt-6-astra)',
    imageModelName: 'google/gemini-nano-banana-2.1',
    placementAction: 'add-only',
    styleMode: 'ai-curated',
    promptUsed: 'Curate a warm minimalist impasto oil painting above the sofa.',
    originalRoomDataUrl,
    reimaginedRoomDataUrl,
    detectedCropBox,
    activeCropBox,
    croppedScreenshotDataUrl,
    identicalPrintMasterDataUrl:
      'data:image/png;base64,IDENTICAL_PRINT_MASTER_BASE64',
    printMasterWidthPx: 2400,
    printMasterHeightPx: 3600,
    artworkTitle: 'Ochre & Travertine Study No. IV',
    artworkDescription: 'Impasto linen study harmonized to warm oak undertones.',
    roomStyleSummary: 'Nordic linen living room with warm afternoon daylight.',
    viewpoints: defaultViewpoints,
    activeViewpointIndex: 0,
    preservationVerification: defaultPreservation,
    artPieces: defaultArtPieces,
    activeArtPieceIndex: 0,
    ...overrides,
  };
}

describe('Subsystem 3: screenshot-and-print-studio (V2.2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // LEAF 3B: identicalPrintUpscaler.ts
  // =========================================================================
  describe('Leaf 3B: identicalPrintUpscaler.ts', () => {
    it('1. clampNormalizedCropBox clamps bounds to [0..1000], rounds floats, and enforces minimum 60 span', () => {
      const clampedOut = clampNormalizedCropBox({
        ymin: -45.7,
        xmin: 120.4,
        ymax: 1180.9,
        xmax: 999.6,
      });
      expect(clampedOut).toEqual({
        ymin: 0,
        xmin: 120,
        ymax: 1000,
        xmax: 1000,
      });

      const collapsedMid = clampNormalizedCropBox({
        ymin: 400,
        xmin: 500,
        ymax: 410,
        xmax: 490,
      });
      expect(collapsedMid.ymax - collapsedMid.ymin).toBeGreaterThanOrEqual(60);
      expect(collapsedMid.xmax - collapsedMid.xmin).toBeGreaterThanOrEqual(60);
      expect(collapsedMid).toEqual({
        ymin: 400,
        xmin: 500,
        ymax: 460,
        xmax: 560,
      });

      const collapsedEdge = clampNormalizedCropBox({
        ymin: 980,
        xmin: 975,
        ymax: 990,
        xmax: 985,
      });
      expect(collapsedEdge).toEqual({
        ymin: 940,
        xmin: 940,
        ymax: 1000,
        xmax: 1000,
      });
    });

    it('2. cropImageFromNormalizedBox extracts normalized [ymin, xmin, ymax, xmax] crop deterministically in JSDOM', async () => {
      const box: NormalizedCropBox = { ymin: 150, xmin: 220, ymax: 650, xmax: 780 };
      const croppedUrl = await cropImageFromNormalizedBox(
        'data:image/png;base64,REIMAGINED_WALL_SOURCE',
        box
      );

      expect(croppedUrl.startsWith('data:image/')).toBe(true);
      const decoded = decodeURIComponent(croppedUrl);
      expect(decoded).toContain('data-crop-box="150,220,650,780"');
      expect(decoded).toContain('viewBox="220 150 560 500"');
    });

    it('3. buildHighResPrintMasterFile produces exact 300-DPI resolutions across all 5 PrintSizeIds', async () => {
      const expectedDimensions: Record<PrintSizeId, [number, number]> = {
        '12x16': [1800, 2400],
        '18x24': [2100, 2800],
        '24x36': [2400, 3600],
        '30x40': [2700, 3600],
        '36x48': [3000, 4000],
      };

      const sizeIds = Object.keys(expectedDimensions) as PrintSizeId[];
      for (const sizeId of sizeIds) {
        const result = await buildHighResPrintMasterFile({
          identicalPrintDataUrl: 'data:image/png;base64,IDENTICAL_PRINT_SOURCE',
          sizeId,
          includeBleed: false,
          title: 'Warm Travertine Relief',
        });

        const [expectedW, expectedH] = expectedDimensions[sizeId];
        expect(result.sizeId).toBe(sizeId);
        expect(result.widthPx).toBe(expectedW);
        expect(result.heightPx).toBe(expectedH);
        expect(result.dpi).toBe(300);
        expect(result.includedBleed).toBe(false);
        expect(result.filename).toBe(
          `atelier-vue-warm-travertine-relief-${sizeId}-300dpi.png`
        );
        expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      }
    });

    it('4. buildHighResPrintMasterFile adds +150px (+0.25" @ 300 DPI per side) when includeBleed is true and sanitizes filenames', async () => {
      const resultWithBleed = await buildHighResPrintMasterFile({
        identicalPrintDataUrl: 'data:image/png;base64,IDENTICAL_PRINT_SOURCE',
        sizeId: '24x36',
        includeBleed: true,
        title: '  No. 07: Ochre & Raw Umber!!  ',
      });

      expect(resultWithBleed.widthPx).toBe(2400 + 150);
      expect(resultWithBleed.heightPx).toBe(3600 + 150);
      expect(resultWithBleed.dpi).toBe(300);
      expect(resultWithBleed.includedBleed).toBe(true);
      expect(resultWithBleed.filename).toBe(
        'atelier-vue-no-07-ochre-raw-umber-24x36-300dpi-bleed.png'
      );
      expect(resultWithBleed.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('5. computeSideBySideFidelityMetrics computes accurate resolution labels and archival flags', () => {
      const standardMetrics = computeSideBySideFidelityMetrics('30x40', false);
      expect(standardMetrics).toEqual({
        sizeId: '30x40',
        labelInches: PRINT_SIZES['30x40'].labelInches,
        labelCm: PRINT_SIZES['30x40'].labelCm,
        targetResolutionLabel: '2700 × 3600 px @ 300 DPI',
        widthPx: 2700,
        heightPx: 3600,
        dpi: 300,
        perspectiveRectified: true,
        lightingNeutralized: true,
        colorProfile: 'sRGB IEC61966-2.1 Archival (300 DPI)',
      });

      const bleedMetrics = computeSideBySideFidelityMetrics('36x48', true);
      expect(bleedMetrics.widthPx).toBe(3150);
      expect(bleedMetrics.heightPx).toBe(4150);
      expect(bleedMetrics.targetResolutionLabel).toContain(
        '3150 × 4150 px @ 300 DPI (+0.25" Archival Bleed)'
      );
    });
  });

  // =========================================================================
  // LEAF 3A: ArtworkScreenshotCropper.tsx / InRoomSpaceVisualizer
  // =========================================================================
  describe('Leaf 3A: ArtworkScreenshotCropper.tsx / InRoomSpaceVisualizer', () => {
    it('6. [SPEC PATCH #20] renders unobstructed in-room-visualization-stage with ZERO screenshot-crop-box or captured-screenshot-preview elements', async () => {
      const variation = createMockVariation();

      expect(InRoomSpaceVisualizer).toBe(ArtworkScreenshotCropper);

      await act(async () => {
        root.render(
          React.createElement(InRoomSpaceVisualizer, {
            variation,
          })
        );
      });

      expect(
        container.querySelector('[data-testid="artwork-screenshot-cropper"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="in-room-visualization-stage"]')
      ).not.toBeNull();

      // Strictly NO crop box or cropped screenshot preview in the reimagined view
      expect(
        container.querySelector('[data-testid="screenshot-crop-box"]')
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="captured-screenshot-preview"]')
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="resynthesize-print-from-crop-btn"]')
      ).toBeNull();
    });

    it('7. [SPEC PATCH #18 & #23] leaks zero secret-revealing strings (/screenshot|crop box|bbox|2nd-prompt/i) and zero AI model names (/astra|gemini argon|gpt-6|nano banana|openrouter/i) even when raw variation fields contain technical or model text', async () => {
      const variation = createMockVariation({
        engineModelName: 'GPT-6 Astra (openai/gpt-6-astra)',
        imageModelName: 'google/gemini-nano-banana-2.1',
        artworkTitle: '2nd-Prompt BBox Screenshot Study by Gemini Argon',
        artworkDescription:
          'Extracted from crop box via 2nd-prompt OpenRouter GPT-6 Astra pipeline.',
        roomStyleSummary:
          'Captured screenshot with BBox coordinates [200,300] using Nano Banana.',
        preservationVerification: createMockPreservationVerification({
          summaryNote:
            '2nd-Prompt verification of BBox crop box and screenshot passed via google/gemini-4-argon.',
        }),
      });

      await act(async () => {
        root.render(
          React.createElement(ArtworkScreenshotCropper, {
            variation,
          })
        );
      });

      const renderedText = container.textContent || '';
      expect(renderedText).not.toMatch(/screenshot|crop box|bbox|2nd-prompt/i);
      expect(renderedText).not.toMatch(
        /astra|gemini argon|gpt-6|nano banana|openrouter/i
      );
      expect(renderedText).toContain('Atelier Vue Bespoke Commission');
    });

    it('8. toggles between Reimagined Space and Original Room via mode-reimagined-btn, mode-original-btn, and toggle-compare-original-btn', async () => {
      const variation = createMockVariation();

      await act(async () => {
        root.render(
          React.createElement(ArtworkScreenshotCropper, {
            variation,
          })
        );
      });

      const stageImg = container.querySelector(
        '[data-testid="in-room-visualization-stage"] img'
      ) as HTMLImageElement;
      const modeReimaginedBtn = container.querySelector(
        '[data-testid="mode-reimagined-btn"]'
      ) as HTMLButtonElement;
      const modeOriginalBtn = container.querySelector(
        '[data-testid="mode-original-btn"]'
      ) as HTMLButtonElement;
      const toggleCompareBtn = container.querySelector(
        '[data-testid="toggle-compare-original-btn"]'
      ) as HTMLButtonElement;

      expect(stageImg.getAttribute('src')).toBe(variation.reimaginedRoomDataUrl);
      expect(modeReimaginedBtn.getAttribute('aria-pressed')).toBe('true');
      expect(modeOriginalBtn.getAttribute('aria-pressed')).toBe('false');

      // Switch to Original Room via mode-original-btn
      await act(async () => {
        modeOriginalBtn.click();
      });

      expect(stageImg.getAttribute('src')).toBe(variation.originalRoomDataUrl);
      expect(modeOriginalBtn.getAttribute('aria-pressed')).toBe('true');
      expect(modeReimaginedBtn.getAttribute('aria-pressed')).toBe('false');

      // Switch back to Reimagined Space via mode-reimagined-btn
      await act(async () => {
        modeReimaginedBtn.click();
      });

      expect(stageImg.getAttribute('src')).toBe(variation.reimaginedRoomDataUrl);
      expect(modeReimaginedBtn.getAttribute('aria-pressed')).toBe('true');

      // Toggle via toggle-compare-original-btn
      await act(async () => {
        toggleCompareBtn.click();
      });

      expect(stageImg.getAttribute('src')).toBe(variation.originalRoomDataUrl);
      expect(toggleCompareBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('9. [SPEC PATCH #13 & #18] renders preservation-verification-badge with Spatial Fidelity Assured copy and check pills', async () => {
      const variation = createMockVariation({
        preservationVerification: createMockPreservationVerification({
          summaryNote:
            '2nd-Prompt BBox verification with openai/gpt-6-astra and screenshot crop box',
        }),
      });

      await act(async () => {
        root.render(
          React.createElement(ArtworkScreenshotCropper, {
            variation,
          })
        );
      });

      const badge = container.querySelector(
        '[data-testid="preservation-verification-badge"]'
      ) as HTMLElement;
      expect(badge).not.toBeNull();
      expect(badge.textContent).toContain(
        'Spatial Fidelity Assured · Pre-existing furnishings & room dimensions faithfully preserved'
      );
      expect(badge.textContent).toContain('Furnishings Intact');
      expect(badge.textContent).toContain('Room Dimensions True');
      expect(badge.textContent).toContain('Seamless Wall Integration');
      expect(badge.textContent).not.toMatch(
        /screenshot|crop box|bbox|2nd-prompt|openai\/gpt-6-astra/i
      );
    });

    it('10. [SPEC PATCH #15] switches between multiple room viewpoints via viewpoint-selector-strip and fires onSelectViewpoint', async () => {
      const vp1: ReimaginedRoomViewpoint = {
        angleId: 'vp-angle-1',
        angleLabel: 'Angle 1 (Main Sofa Wall)',
        originalRoomDataUrl: 'data:image/png;base64,VP1_ORIGINAL_ROOM',
        reimaginedRoomDataUrl: 'data:image/png;base64,VP1_REIMAGINED_ROOM',
        detectedCropBox: { ymin: 180, xmin: 260, ymax: 580, xmax: 740 },
        activeCropBox: { ymin: 200, xmin: 300, ymax: 600, xmax: 700 },
        croppedScreenshotDataUrl: 'data:image/png;base64,VP1_CROPPED_SCREENSHOT',
        preservationVerification: createMockPreservationVerification(),
      };

      const vp2: ReimaginedRoomViewpoint = {
        angleId: 'vp-angle-2',
        angleLabel: 'Angle 2 (Side Dining Perspective)',
        originalRoomDataUrl: 'data:image/png;base64,VP2_ORIGINAL_ROOM',
        reimaginedRoomDataUrl: 'data:image/png;base64,VP2_REIMAGINED_ROOM',
        detectedCropBox: { ymin: 220, xmin: 400, ymax: 520, xmax: 820 },
        activeCropBox: { ymin: 250, xmin: 450, ymax: 550, xmax: 850 },
        croppedScreenshotDataUrl: 'data:image/png;base64,VP2_CROPPED_SCREENSHOT',
        preservationVerification: createMockPreservationVerification(),
      };

      const variation = createMockVariation({
        viewpoints: [vp1, vp2],
      });
      const onSelectViewpoint = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(ArtworkScreenshotCropper, {
            variation,
            onSelectViewpoint,
          })
        );
      });

      const strip = container.querySelector(
        '[data-testid="viewpoint-selector-strip"]'
      );
      const pill0 = container.querySelector(
        '[data-testid="viewpoint-pill-0"]'
      ) as HTMLButtonElement;
      const pill1 = container.querySelector(
        '[data-testid="viewpoint-pill-1"]'
      ) as HTMLButtonElement;
      const stageImg = container.querySelector(
        '[data-testid="in-room-visualization-stage"] img'
      ) as HTMLImageElement;

      expect(strip).not.toBeNull();
      expect(pill0.getAttribute('aria-selected')).toBe('true');
      expect(stageImg.getAttribute('src')).toBe(vp1.reimaginedRoomDataUrl);

      await act(async () => {
        pill1.click();
      });

      expect(pill1.getAttribute('aria-selected')).toBe('true');
      expect(stageImg.getAttribute('src')).toBe(vp2.reimaginedRoomDataUrl);
      expect(onSelectViewpoint).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          angleId: 'vp-angle-2',
          angleLabel: 'Angle 2 (Side Dining Perspective)',
        })
      );

      // Compare original room on Viewpoint 2
      const toggleCompareBtn = container.querySelector(
        '[data-testid="toggle-compare-original-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        toggleCompareBtn.click();
      });
      expect(stageImg.getAttribute('src')).toBe(vp2.originalRoomDataUrl);
    });

    it('11. [SPEC PATCH #19] renders art-piece-selector-strip for multiple generated art pieces and fires onSelectArtPiece', async () => {
      const piece1: GeneratedArtPiece = {
        id: 'art-piece-1',
        index: 0,
        title: 'Sienna & Raw Linen I',
        wallLocationLabel: 'North Hearth Wall',
        description: 'Warm mineral pigment study.',
        identicalPrintMasterDataUrl: 'data:image/png;base64,PIECE_1_MASTER',
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
      };
      const piece2: GeneratedArtPiece = {
        id: 'art-piece-2',
        index: 1,
        title: 'Travertine Horizon II',
        wallLocationLabel: 'East Alcove Wall',
        description: 'Companion limestone texture study.',
        identicalPrintMasterDataUrl: 'data:image/png;base64,PIECE_2_MASTER',
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
      };

      const variation = createMockVariation({
        artPieces: [piece1, piece2],
      });
      const onSelectArtPiece = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(ArtworkScreenshotCropper, {
            variation,
            onSelectArtPiece,
          })
        );
      });

      const strip = container.querySelector(
        '[data-testid="art-piece-selector-strip"]'
      );
      const pill0 = container.querySelector(
        '[data-testid="art-piece-pill-0"]'
      ) as HTMLButtonElement;
      const pill1 = container.querySelector(
        '[data-testid="art-piece-pill-1"]'
      ) as HTMLButtonElement;

      expect(strip).not.toBeNull();
      expect(pill0).not.toBeNull();
      expect(pill1).not.toBeNull();
      expect(pill0.textContent).toContain('Sienna & Raw Linen I');
      expect(pill0.textContent).toContain('North Hearth Wall');
      expect(pill1.textContent).toContain('Travertine Horizon II');
      expect(pill1.textContent).toContain('East Alcove Wall');

      await act(async () => {
        pill1.click();
      });

      expect(pill1.getAttribute('aria-selected')).toBe('true');
      expect(onSelectArtPiece).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          id: 'art-piece-2',
          title: 'Travertine Horizon II',
        })
      );
    });
  });

  // =========================================================================
  // LEAF 3C: SizeAndFrameScroller.tsx & ScreenshotAndPrintStudio
  // =========================================================================
  describe('Leaf 3C: SizeAndFrameScroller.tsx & ScreenshotAndPrintStudio', () => {
    it('12. renders Stage 3 print-master-stage, framed-print-preview, and horizontal snap scrollers', async () => {
      const variation = createMockVariation();

      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
          })
        );
      });

      expect(
        container.querySelector('[data-testid="size-and-frame-scroller"]')
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="print-master-stage"]')
      ).not.toBeNull();

      const framedPreview = container.querySelector(
        '[data-testid="framed-print-preview"]'
      ) as HTMLElement;
      expect(framedPreview).not.toBeNull();
      expect(framedPreview.getAttribute('data-size-id')).toBe('24x36');
      expect(framedPreview.getAttribute('data-frame-id')).toBe('natural-white-oak');

      const sizeScroller = container.querySelector(
        '[data-testid="size-scroller"]'
      ) as HTMLElement;
      const frameScroller = container.querySelector(
        '[data-testid="frame-scroller"]'
      ) as HTMLElement;
      const matScroller = container.querySelector(
        '[data-testid="mat-scroller"]'
      ) as HTMLElement;

      expect(sizeScroller.className).toContain('overflow-x-auto');
      expect(sizeScroller.className).toContain('snap-x');
      expect(frameScroller.className).toContain('overflow-x-auto');
      expect(matScroller.className).toContain('overflow-x-auto');

      // [SPEC PATCH #23] Verify zero AI model names and Atelier Vue Bespoke Commission provenance
      const renderedText = container.textContent || '';
      expect(renderedText).toContain('Atelier Vue Bespoke Commission');
      expect(renderedText).not.toMatch(
        /astra|gemini argon|gpt-6|nano banana|openrouter/i
      );
    });

    it('13. selects across all 5 Print Sizes (size-option-12x16 through size-option-36x48)', async () => {
      const onSelectSize = vi.fn();
      const allSizes: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];

      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            onSelectSize,
            onSelectFrame: vi.fn(),
          })
        );
      });

      for (const sizeId of allSizes) {
        const btn = container.querySelector(
          `[data-testid="size-option-${sizeId}"]`
        ) as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.className).toContain('min-h-[44px]');

        await act(async () => {
          btn.click();
        });
        expect(onSelectSize).toHaveBeenLastCalledWith(sizeId);
      }
      expect(onSelectSize).toHaveBeenCalledTimes(5);
    });

    it('14. selects across all 6 Frame Profiles (frame-option-unframed-canvas through frame-option-warm-travertine-ash)', async () => {
      const onSelectFrame = vi.fn();
      const allFrames: FrameProfileId[] = [
        'unframed-canvas',
        'natural-white-oak',
        'american-black-walnut',
        'matte-gallery-black',
        'brushed-brass-float',
        'warm-travertine-ash',
      ];

      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            onSelectSize: vi.fn(),
            onSelectFrame,
          })
        );
      });

      for (const frameId of allFrames) {
        const btn = container.querySelector(
          `[data-testid="frame-option-${frameId}"]`
        ) as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.className).toContain('min-h-[44px]');

        await act(async () => {
          btn.click();
        });
        expect(onSelectFrame).toHaveBeenLastCalledWith(frameId);
      }
      expect(onSelectFrame).toHaveBeenCalledTimes(6);
    });

    it('15. selects across all 4 Matboard widths (mat-option-none through mat-option-3.5in) and toggles +0.25" archival bleed trim guides', async () => {
      const onSelectMatWidth = vi.fn();
      const onToggleBleed = vi.fn();
      const allMats: MatWidthId[] = ['none', '1.5in', '2.5in', '3.5in'];

      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
            onSelectMatWidth,
            onToggleBleed,
          })
        );
      });

      const framedPreview = container.querySelector(
        '[data-testid="framed-print-preview"]'
      ) as HTMLElement;

      for (const matId of allMats) {
        const btn = container.querySelector(
          `[data-testid="mat-option-${matId}"]`
        ) as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.className).toContain('min-h-[44px]');

        await act(async () => {
          btn.click();
        });
        expect(onSelectMatWidth).toHaveBeenLastCalledWith(matId);
        expect(framedPreview.getAttribute('data-mat-width')).toBe(matId);
      }

      const bleedCheckbox = container.querySelector(
        '[data-testid="toggle-print-bleed-checkbox"]'
      ) as HTMLInputElement;
      expect(bleedCheckbox.checked).toBe(false);
      expect(
        container.querySelector('[data-testid="print-bleed-trim-guides"]')
      ).toBeNull();

      await act(async () => {
        bleedCheckbox.click();
      });

      expect(onToggleBleed).toHaveBeenCalledWith(true);
      expect(bleedCheckbox.checked).toBe(true);
      expect(
        container.querySelector('[data-testid="print-bleed-trim-guides"]')
      ).not.toBeNull();
    });

    it('16. [SPEC PATCH #19] switches between multiple art pieces in SizeAndFrameScroller via framing-art-piece-selector and downloads the selected piece print master', async () => {
      const piece1: GeneratedArtPiece = {
        id: 'frame-piece-1',
        index: 0,
        title: 'Amber Ochre Study I',
        wallLocationLabel: 'West Living Room Wall',
        description: 'Warm impasto study.',
        identicalPrintMasterDataUrl: 'data:image/png;base64,FRAME_PIECE_1_PNG',
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
      };
      const piece2: GeneratedArtPiece = {
        id: 'frame-piece-2',
        index: 1,
        title: 'Cobalt & Slate Study II',
        wallLocationLabel: 'North Study Niche',
        description: 'Deep mineral contrast study.',
        identicalPrintMasterDataUrl: 'data:image/png;base64,FRAME_PIECE_2_PNG',
        printMasterWidthPx: 2700,
        printMasterHeightPx: 3600,
      };

      const variation = createMockVariation({
        artPieces: [piece1, piece2],
      });
      const onSelectArtPiece = vi.fn();
      const onDirectDownloadPrint = vi.fn();
      const onOpenPrintOrderModal = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '30x40',
            selectedFrameId: 'american-black-walnut',
            includeBleed: true,
            estimatedRetailPriceUsd: 348.5,
            onSelectArtPiece,
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
            onDirectDownloadPrint,
            onOpenPrintOrderModal,
          })
        );
      });

      const selector = container.querySelector(
        '[data-testid="framing-art-piece-selector"]'
      );
      const pill0 = container.querySelector(
        '[data-testid="framing-art-piece-pill-0"]'
      ) as HTMLButtonElement;
      const pill1 = container.querySelector(
        '[data-testid="framing-art-piece-pill-1"]'
      ) as HTMLButtonElement;
      const framedPreview = container.querySelector(
        '[data-testid="framed-print-preview"]'
      ) as HTMLElement;
      const framedImg = framedPreview.querySelector('img') as HTMLImageElement;

      expect(selector).not.toBeNull();
      expect(pill0.getAttribute('aria-pressed')).toBe('true');
      expect(framedPreview.getAttribute('data-piece-index')).toBe('0');
      expect(framedImg.getAttribute('src')).toBe(piece1.identicalPrintMasterDataUrl);

      // Select Piece 2
      await act(async () => {
        pill1.click();
      });

      expect(onSelectArtPiece).toHaveBeenCalledWith(1, piece2);
      expect(pill1.getAttribute('aria-pressed')).toBe('true');
      expect(framedPreview.getAttribute('data-piece-index')).toBe('1');
      expect(framedImg.getAttribute('src')).toBe(piece2.identicalPrintMasterDataUrl);
      expect(container.textContent).toContain('Cobalt & Slate Study II');
      expect(container.textContent).toContain('North Study Niche');

      // Trigger direct 300-DPI download for Piece 2
      const downloadBtn = container.querySelector(
        '[data-testid="direct-download-print-btn"]'
      ) as HTMLButtonElement;
      const orderModalBtn = container.querySelector(
        '[data-testid="open-print-order-modal-btn"]'
      ) as HTMLButtonElement;

      await act(async () => {
        downloadBtn.click();
      });

      expect(onDirectDownloadPrint).toHaveBeenCalledTimes(1);
      const downloadResult = onDirectDownloadPrint.mock
        .calls[0][0] as HighResPrintMasterFileResult;
      expect(downloadResult.sizeId).toBe('30x40');
      expect(downloadResult.widthPx).toBe(2850);
      expect(downloadResult.heightPx).toBe(3750);
      expect(downloadResult.dpi).toBe(300);
      expect(downloadResult.includedBleed).toBe(true);
      expect(downloadResult.filename).toBe(
        'atelier-vue-cobalt-slate-study-ii-300dpi-bleed.png'.replace(
          '-300dpi',
          '-30x40-300dpi'
        )
      );
      expect(
        container.querySelector('[data-testid="download-confirmation-badge"]')
      ).not.toBeNull();

      await act(async () => {
        orderModalBtn.click();
      });
      expect(onOpenPrintOrderModal).toHaveBeenCalledTimes(1);
    });

    it('17. ScreenshotAndPrintStudio composite component synchronizes multi-viewpoint and multi-art-piece selection across InRoomSpaceVisualizer and SizeAndFrameScroller, with zero <a href> links and zero secret-revealing strings', async () => {
      const vp1: ReimaginedRoomViewpoint = {
        angleId: 'studio-vp-1',
        angleLabel: 'Primary Living Wall',
        originalRoomDataUrl: 'data:image/png;base64,STUDIO_VP1_ORIG',
        reimaginedRoomDataUrl: 'data:image/png;base64,STUDIO_VP1_REIMAGINED',
        detectedCropBox: { ymin: 180, xmin: 260, ymax: 580, xmax: 740 },
        activeCropBox: { ymin: 200, xmin: 300, ymax: 600, xmax: 700 },
        croppedScreenshotDataUrl: 'data:image/png;base64,STUDIO_VP1_CROPPED',
        preservationVerification: createMockPreservationVerification(),
      };
      const vp2: ReimaginedRoomViewpoint = {
        angleId: 'studio-vp-2',
        angleLabel: 'Corner Reading Nook View',
        originalRoomDataUrl: 'data:image/png;base64,STUDIO_VP2_ORIG',
        reimaginedRoomDataUrl: 'data:image/png;base64,STUDIO_VP2_REIMAGINED',
        detectedCropBox: { ymin: 210, xmin: 350, ymax: 560, xmax: 790 },
        activeCropBox: { ymin: 240, xmin: 380, ymax: 540, xmax: 780 },
        croppedScreenshotDataUrl: 'data:image/png;base64,STUDIO_VP2_CROPPED',
        preservationVerification: createMockPreservationVerification(),
      };

      const piece1: GeneratedArtPiece = {
        id: 'studio-piece-1',
        index: 0,
        title: 'Warm Alabaster Relief I',
        wallLocationLabel: 'Over Linen Sofa',
        description: 'Hand-troweled plaster composition.',
        identicalPrintMasterDataUrl: 'data:image/png;base64,STUDIO_PIECE_1_MASTER',
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
      };
      const piece2: GeneratedArtPiece = {
        id: 'studio-piece-2',
        index: 1,
        title: 'Umber & Terracotta Study II',
        wallLocationLabel: 'Reading Nook Feature Wall',
        description: 'Warm earth pigment counterpoint.',
        identicalPrintMasterDataUrl: 'data:image/png;base64,STUDIO_PIECE_2_MASTER',
        printMasterWidthPx: 2400,
        printMasterHeightPx: 3600,
      };

      const variation = createMockVariation({
        viewpoints: [vp1, vp2],
        artPieces: [piece1, piece2],
      });
      const onSelectViewpoint = vi.fn();
      const onSelectArtPiece = vi.fn();
      const onSelectSize = vi.fn();
      const onSelectFrame = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(ScreenshotAndPrintStudio, {
            variation,
            onSelectViewpoint,
            onSelectArtPiece,
            onSelectSize,
            onSelectFrame,
          })
        );
      });

      expect(
        container.querySelector('[data-testid="screenshot-and-print-studio"]')
      ).not.toBeNull();

      // Switch viewpoint in InRoomSpaceVisualizer
      const vp2Pill = container.querySelector(
        '[data-testid="viewpoint-pill-1"]'
      ) as HTMLButtonElement;
      await act(async () => {
        vp2Pill.click();
      });
      expect(onSelectViewpoint).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ angleId: 'studio-vp-2' })
      );

      // Select Art Piece 2 in InRoomSpaceVisualizer and verify SizeAndFrameScroller synchronizes
      const inRoomPiece2Pill = container.querySelector(
        '[data-testid="art-piece-pill-1"]'
      ) as HTMLButtonElement;
      await act(async () => {
        inRoomPiece2Pill.click();
      });

      expect(onSelectArtPiece).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ id: 'studio-piece-2' })
      );

      const framedPreview = container.querySelector(
        '[data-testid="framed-print-preview"]'
      ) as HTMLElement;
      const framedImg = framedPreview.querySelector('img') as HTMLImageElement;
      expect(framedPreview.getAttribute('data-piece-index')).toBe('1');
      expect(framedImg.getAttribute('src')).toBe(piece2.identicalPrintMasterDataUrl);

      // Select Size and Frame inside the composite studio
      const size36x48Btn = container.querySelector(
        '[data-testid="size-option-36x48"]'
      ) as HTMLButtonElement;
      const frameBrassBtn = container.querySelector(
        '[data-testid="frame-option-brushed-brass-float"]'
      ) as HTMLButtonElement;

      await act(async () => {
        size36x48Btn.click();
        frameBrassBtn.click();
      });

      expect(onSelectSize).toHaveBeenCalledWith('36x48');
      expect(onSelectFrame).toHaveBeenCalledWith('brushed-brass-float');
      expect(framedPreview.getAttribute('data-size-id')).toBe('36x48');
      expect(framedPreview.getAttribute('data-frame-id')).toBe(
        'brushed-brass-float'
      );

      // Verify zero <a href> links, zero secret-revealing strings, and zero AI model names exist in the DOM
      expect(container.querySelectorAll('a[href]').length).toBe(0);
      expect(
        container.querySelector('[data-testid="screenshot-crop-box"]')
      ).toBeNull();
      expect(
        container.querySelector('[data-testid="captured-screenshot-preview"]')
      ).toBeNull();
      expect(container.textContent || '').not.toMatch(
        /screenshot|crop box|bbox|2nd-prompt/i
      );
      expect(container.textContent || '').not.toMatch(
        /astra|gemini argon|gpt-6|nano banana|openrouter/i
      );
      expect(container.textContent || '').toContain(
        'Atelier Vue Bespoke Commission'
      );
    });

    it('18. [SPEC PATCH #28] renders scale-recommendation-banner, recommended-size-badge inside size-option/size-pill, and apply-recommended-size-btn when scaleRecommendation is calibrated', async () => {
      const scaleRecommendation = {
        isCalibrated: true,
        recommendedSizeId: '30x40' as PrintSizeId,
        recommendedDimensionsLabel: '30" × 40"',
        estimatedWallWidthInches: 108,
        estimatedArtworkWidthInches: 30,
        estimatedArtworkHeightInches: 40,
        rationale:
          'Calibrated from your 84" sofa and 108" wall span so the print matches the exact proportion in your room.',
        questionsAnsweredCount: 3,
      };

      const variation = createMockVariation({
        scaleRecommendation,
      });
      const onSelectSize = vi.fn();

      // 1) Mount SizeAndFrameScroller with selectedSizeId = '24x36' (different from recommended '30x40')
      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            scaleRecommendation,
            onSelectSize,
            onSelectFrame: vi.fn(),
          })
        );
      });

      const banner = container.querySelector(
        '[data-testid="scale-recommendation-banner"]'
      ) as HTMLElement;
      expect(banner).not.toBeNull();
      expect(banner.textContent).toContain(
        'Recommended Size for Your Space: 30" × 40"'
      );
      expect(banner.textContent).toContain(
        'Calibrated from your 84" sofa and 108" wall span'
      );

      // Verify ★ Recommended badge inside size-option-30x40 and size-pill-30x40
      const sizeOption30x40 = container.querySelector(
        '[data-testid="size-option-30x40"]'
      ) as HTMLElement;
      const sizePill30x40 = container.querySelector(
        '[data-testid="size-pill-30x40"]'
      ) as HTMLElement;
      expect(sizeOption30x40).not.toBeNull();
      expect(sizePill30x40).not.toBeNull();
      const recommendedBadge = sizePill30x40.querySelector(
        '[data-testid="recommended-size-badge"]'
      ) as HTMLElement;
      expect(recommendedBadge).not.toBeNull();
      expect(recommendedBadge.textContent).toContain('★ Recommended');

      // Clicking apply-recommended-size-btn invokes onSelectSize('30x40')
      const applyBtn = container.querySelector(
        '[data-testid="apply-recommended-size-btn"]'
      ) as HTMLButtonElement;
      expect(applyBtn).not.toBeNull();
      expect(applyBtn.textContent).toContain(
        'Select Recommended Size (30" × 40")'
      );

      await act(async () => {
        applyBtn.click();
      });
      expect(onSelectSize).toHaveBeenCalledWith('30x40');

      // 2) Re-render with selectedSizeId = '30x40' (or mount ScreenshotAndPrintStudio which defaults to recommendedSizeId)
      await act(async () => {
        root.render(
          React.createElement(ScreenshotAndPrintStudio, {
            variation,
          })
        );
      });

      const studioBanner = container.querySelector(
        '[data-testid="scale-recommendation-banner"]'
      ) as HTMLElement;
      expect(studioBanner).not.toBeNull();
      expect(studioBanner.textContent).toContain(
        '✓ Active Size Matches Your Room Measurements'
      );
      expect(
        container.querySelector('[data-testid="apply-recommended-size-btn"]')
      ).toBeNull();

      const framedPreview = container.querySelector(
        '[data-testid="framed-print-preview"]'
      ) as HTMLElement;
      expect(framedPreview.getAttribute('data-size-id')).toBe('30x40');
    });
  });

  // =========================================================================
  // LEAF 3D: FinerWorks v3 Dual-Verification Provenance & Framing Studio (Taste Directives #5 & #6)
  // =========================================================================
  describe('Leaf 3D: FinerWorks v3 Dual-Verification Provenance & Framing Studio (Taste Directives #5 & #6)', () => {
    function triggerNumberInputChange(
      element: HTMLInputElement,
      nextValue: string
    ): void {
      const descriptor = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      );
      if (descriptor?.set) {
        descriptor.set.call(element, nextValue);
      } else {
        element.value = nextValue;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    it('19. [Taste Directive #5] ArtworkScreenshotCropper renders dual-verification-provenance-bar with Agent 1 preservation-verification-badge, Agent 2 finerworks-verification-badge (with data-product-code), and progressive-disclosure dual-audit-receipt-drawer with zero leaked model/secret names', async () => {
      const variation = createMockVariation({
        finerworksProductCode:
          'FW-FP-M42-24x36-FRM-WALNUT-150-MAT-2.5in-GLZ-CLEAR',
        finerworksMediaId: 42,
        detectedFrameId: 'american-black-walnut',
        detectedMatWidthId: '2.5in',
        finerworksVerification: {
          passed: true,
          frameOptionValid: true,
          mattingAndGlazingValid: true,
          sizingAndAspectRatioValid: true,
          substrateSurfaceAuthentic: true,
          matchedFinerWorksProductCode:
            'FW-FP-M42-24x36-FRM-WALNUT-150-MAT-2.5in-GLZ-CLEAR',
          matchedFrameProfileId: 'american-black-walnut',
          matchedFinishesSummary:
            'American Black Walnut · Hahnemühle Etching · 2.5in Mat · Clear Acrylic',
          matchedSizeLabel: '24" × 36" (Outer 32" × 44")',
          matchedMediaId: 42,
          verifierModelId: 'google/gemini-4-argon',
          verificationSummary:
            '2nd-prompt verification via google/gemini-4-argon confirmed BBox crop and FinerWorks compliance.',
          discrepanciesFound: [],
          attemptsUsed: 1,
        },
      });

      await act(async () => {
        root.render(
          React.createElement(ArtworkScreenshotCropper, {
            variation,
          })
        );
      });

      const dualBar = container.querySelector(
        '[data-testid="dual-verification-provenance-bar"]'
      ) as HTMLElement;
      const agent1Badge = container.querySelector(
        '[data-testid="preservation-verification-badge"]'
      ) as HTMLElement;
      const agent2Badge = container.querySelector(
        '[data-testid="finerworks-verification-badge"]'
      ) as HTMLElement;
      const toggleAuditBtn = container.querySelector(
        '[data-testid="toggle-dual-audit-receipt-btn"]'
      ) as HTMLButtonElement;

      expect(dualBar).not.toBeNull();
      expect(agent1Badge).not.toBeNull();
      expect(agent1Badge.textContent).toContain(
        '✓ Room & Furnishings 100% Preserved'
      );
      expect(agent2Badge).not.toBeNull();
      expect(agent2Badge.textContent).toContain(
        '✓ Archival Frame, Mat & Scale Verified'
      );
      expect(agent2Badge.getAttribute('data-product-code')).toBe(
        'FW-FP-M42-24x36-FRM-WALNUT-150-MAT-2.5in-GLZ-CLEAR'
      );
      expect(toggleAuditBtn).not.toBeNull();
      expect(toggleAuditBtn.textContent).toContain('Inspect Dual Audit ▾');

      // Audit receipt drawer is closed by default
      expect(
        container.querySelector('[data-testid="dual-audit-receipt-drawer"]')
      ).toBeNull();

      // Open dual-audit-receipt-drawer
      await act(async () => {
        toggleAuditBtn.click();
      });

      const auditDrawer = container.querySelector(
        '[data-testid="dual-audit-receipt-drawer"]'
      ) as HTMLElement;
      expect(auditDrawer).not.toBeNull();
      expect(toggleAuditBtn.textContent).toContain('Inspect Dual Audit ▴');

      // Verify Agent 1 and Agent 2 audit check pills
      expect(
        auditDrawer.querySelector('[data-testid="audit-check-furniture"]')
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector('[data-testid="audit-check-room-dimensions"]')
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector('[data-testid="audit-check-only-art-changed"]')
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector('[data-testid="audit-check-frame-option"]')
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector('[data-testid="audit-check-matting-glazing"]')
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector('[data-testid="audit-check-sizing-aspect"]')
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector(
          '[data-testid="audit-check-substrate-surface"]'
        )
      ).not.toBeNull();
      expect(
        auditDrawer.querySelector(
          '[data-testid="audit-matched-product-code"]'
        )?.textContent
      ).toBe('FW-FP-M42-24x36-FRM-WALNUT-150-MAT-2.5in-GLZ-CLEAR');

      // Verify zero leaked model or technical secret strings inside the open drawer
      const fullVisibleText = (container.textContent || '').toLowerCase();
      expect(fullVisibleText).not.toMatch(
        /screenshot|crop|2nd-prompt|bounding box|bbox|prompt/i
      );
      expect(fullVisibleText).not.toMatch(
        /astra|gemini|argon|gpt-6|nano banana|openrouter/i
      );
      expect(container.querySelectorAll('a[href]').length).toBe(0);
    });

    it('20. [Taste Directive #6] SizeAndFrameScroller renders proportional moulding scaling, floater-frame-shadow-gap on brushed-brass-float, framed-glazing-reflection-overlay on acrylic glazing, and finerworks-physical-footprint-pill', async () => {
      const variation = createMockVariation();

      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            selectedGlazingId: 'clear-acrylic',
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
          })
        );
      });

      const framedPreview = container.querySelector(
        '[data-testid="framed-print-preview"]'
      ) as HTMLElement;
      const footprintPill = container.querySelector(
        '[data-testid="finerworks-physical-footprint-pill"]'
      ) as HTMLElement;

      expect(framedPreview).not.toBeNull();
      expect(footprintPill).not.toBeNull();
      expect(footprintPill.textContent).toContain('Outer Frame:');
      expect(footprintPill.textContent).toContain('300 PPI Optimal');
      expect(parseInt(framedPreview.style.borderWidth, 10)).toBeGreaterThan(0);

      // Clear acrylic glazing overlay is visible on natural-white-oak + paper
      const glazingOverlay = container.querySelector(
        '[data-testid="framed-glazing-reflection-overlay"]'
      ) as HTMLElement;
      expect(glazingOverlay).not.toBeNull();
      expect(glazingOverlay.getAttribute('data-glazing-type')).toBe(
        'clear-acrylic'
      );
      expect(
        container.querySelector('[data-testid="floater-frame-shadow-gap"]')
      ).toBeNull();

      // Switch to non-glare-museum-acrylic and brushed-brass-float
      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '24x36',
            selectedFrameId: 'brushed-brass-float',
            selectedGlazingId: 'non-glare-museum-acrylic',
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
          })
        );
      });

      const floatGap = container.querySelector(
        '[data-testid="floater-frame-shadow-gap"]'
      ) as HTMLElement;
      expect(floatGap).not.toBeNull();
      expect(floatGap.getAttribute('data-float-offset-inches')).toBe('0.35');

      // Re-render with natural-white-oak + non-glare-museum-acrylic to verify non-glare overlay
      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '24x36',
            selectedFrameId: 'natural-white-oak',
            selectedGlazingId: 'non-glare-museum-acrylic',
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
          })
        );
      });
      const museumGlazingOverlay = container.querySelector(
        '[data-testid="framed-glazing-reflection-overlay"]'
      ) as HTMLElement;
      expect(museumGlazingOverlay).not.toBeNull();
      expect(museumGlazingOverlay.getAttribute('data-glazing-type')).toBe(
        'non-glare-museum-acrylic'
      );
    });

    it('21. [Taste Directive #6] SizeAndFrameScroller & ScreenshotAndPrintStudio render all 10 FINERWORKS_MEDIA_SPECS in finerworks-media-scroller and auto-reset matWidthId and glazingId to "none" with finerworks-canvas-compatibility-notice when selecting Stretched Canvas (12), Metal (21), or Acrylic (31)', async () => {
      const variation = createMockVariation({
        detectedMatWidthId: '2.5in',
        finerworksMediaId: 42,
        finerworksGlazingId: 'clear-acrylic',
      });
      const onSelectMedia = vi.fn();
      const onSelectMatWidth = vi.fn();
      const onSelectGlazing = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(ScreenshotAndPrintStudio, {
            variation,
            onSelectMedia,
            onSelectMatWidth,
            onSelectGlazing,
          })
        );
      });

      const mediaScroller = container.querySelector(
        '[data-testid="finerworks-media-scroller"]'
      );
      expect(mediaScroller).not.toBeNull();

      expect(FINERWORKS_MEDIA_SPECS).toHaveLength(10);
      for (const media of FINERWORKS_MEDIA_SPECS) {
        expect(
          container.querySelector(
            `[data-testid="finerworks-media-btn-${media.mediaId}"]`
          )
        ).not.toBeNull();
      }

      // Initially on MediaID 42 (Hahnemühle Etching), compatibility notice is hidden
      expect(
        container.querySelector(
          '[data-testid="finerworks-canvas-compatibility-notice"]'
        )
      ).toBeNull();

      // Click Stretched Canvas (12), Metal (21), and Acrylic (31) -> auto-resets matWidthId and glazingId to 'none'
      for (const nonMattableId of [12, 21, 31]) {
        const mediaBtn = container.querySelector(
          `[data-testid="finerworks-media-btn-${nonMattableId}"]`
        ) as HTMLButtonElement;
        await act(async () => {
          mediaBtn.click();
        });

        expect(onSelectMedia).toHaveBeenCalledWith(
          nonMattableId,
          expect.objectContaining({ mediaId: nonMattableId, canMat: false })
        );
        expect(onSelectMatWidth).toHaveBeenCalledWith('none');
        expect(onSelectGlazing).toHaveBeenCalledWith(
          'none',
          expect.objectContaining({ glazingId: 'none' })
        );

        const framedPreview = container.querySelector(
          '[data-testid="framed-print-preview"]'
        ) as HTMLElement;
        expect(framedPreview.getAttribute('data-media-id')).toBe(
          String(nonMattableId)
        );
        expect(framedPreview.getAttribute('data-mat-width')).toBe('none');
        expect(framedPreview.getAttribute('data-glazing-id')).toBe('none');
        expect(
          container.querySelector(
            '[data-testid="finerworks-canvas-compatibility-notice"]'
          )
        ).not.toBeNull();
      }
    });

    it('22. [Taste Directive #6] SizeAndFrameScroller toggles extended-finerworks-sizes-panel (all 10 sizes + custom exact-inch inputs), switches glazing in finerworks-glazing-strip, and toggles finerworks-spec-details-drawer in finerworks-live-spec-bar', async () => {
      const variation = createMockVariation();
      const onSelectFinerWorksSize = vi.fn();
      const onChangeCustomDimensions = vi.fn();
      const onSelectGlazing = vi.fn();
      const onFinerWorksProductSpecChange = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(ScreenshotAndPrintStudio, {
            variation,
            onSelectFinerWorksSize,
            onChangeCustomDimensions,
            onSelectGlazing,
            onFinerWorksProductSpecChange,
          })
        );
      });

      // 1. Extended FinerWorks Sizes Panel & Custom Exact-Inch Inputs
      const toggleExtendedBtn = container.querySelector(
        '[data-testid="toggle-extended-finerworks-sizes-btn"]'
      ) as HTMLButtonElement;
      expect(toggleExtendedBtn).not.toBeNull();
      expect(
        container.querySelector(
          '[data-testid="extended-finerworks-sizes-panel"]'
        )
      ).toBeNull();

      await act(async () => {
        toggleExtendedBtn.click();
      });

      const extendedPanel = container.querySelector(
        '[data-testid="extended-finerworks-sizes-panel"]'
      ) as HTMLElement;
      expect(extendedPanel).not.toBeNull();

      const expectedFwSizes = [
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
      ];
      for (const fwSizeId of expectedFwSizes) {
        const sizeBtn = extendedPanel.querySelector(
          `[data-testid="finerworks-size-btn-${fwSizeId}"]`
        ) as HTMLButtonElement;
        expect(sizeBtn).not.toBeNull();
      }

      // Click 40x60 size button
      const btn40x60 = extendedPanel.querySelector(
        '[data-testid="finerworks-size-btn-40x60"]'
      ) as HTMLButtonElement;
      await act(async () => {
        btn40x60.click();
      });
      expect(onSelectFinerWorksSize).toHaveBeenCalledWith('40x60', 40, 60);

      // Test custom exact-inch inputs
      const customWInput = extendedPanel.querySelector(
        '[data-testid="finerworks-custom-width-input"]'
      ) as HTMLInputElement;
      const customHInput = extendedPanel.querySelector(
        '[data-testid="finerworks-custom-height-input"]'
      ) as HTMLInputElement;
      const applyCustomBtn = extendedPanel.querySelector(
        '[data-testid="apply-custom-dimensions-btn"]'
      ) as HTMLButtonElement;

      expect(customWInput).not.toBeNull();
      expect(customHInput).not.toBeNull();
      expect(applyCustomBtn).not.toBeNull();

      await act(async () => {
        triggerNumberInputChange(customWInput, '22');
        triggerNumberInputChange(customHInput, '33');
      });
      await act(async () => {
        applyCustomBtn.click();
      });

      expect(onChangeCustomDimensions).toHaveBeenCalledWith(22, 33);
      expect(onSelectFinerWorksSize).toHaveBeenCalledWith('custom', 22, 33);

      // 2. FinerWorks Glazing Strip
      const glazingStrip = container.querySelector(
        '[data-testid="finerworks-glazing-strip"]'
      );
      expect(glazingStrip).not.toBeNull();

      const glazingNoneBtn = container.querySelector(
        '[data-testid="glazing-option-btn-none"]'
      ) as HTMLButtonElement;
      const glazingClearBtn = container.querySelector(
        '[data-testid="glazing-option-btn-clear-acrylic"]'
      ) as HTMLButtonElement;
      const glazingMuseumBtn = container.querySelector(
        '[data-testid="glazing-option-btn-non-glare-museum-acrylic"]'
      ) as HTMLButtonElement;

      expect(glazingNoneBtn).not.toBeNull();
      expect(glazingClearBtn).not.toBeNull();
      expect(glazingMuseumBtn).not.toBeNull();

      await act(async () => {
        glazingMuseumBtn.click();
      });
      expect(onSelectGlazing).toHaveBeenCalledWith(
        'non-glare-museum-acrylic',
        expect.objectContaining({ glazingId: 'non-glare-museum-acrylic' })
      );

      // 3. FinerWorks Live Spec Bar & Spec Details Drawer
      const liveSpecBar = container.querySelector(
        '[data-testid="finerworks-live-spec-bar"]'
      );
      const activeSkuCode = container.querySelector(
        '[data-testid="finerworks-active-product-code"]'
      );
      const livePricePill = container.querySelector(
        '[data-testid="finerworks-live-price-pill"]'
      );
      const toggleSpecBtn = container.querySelector(
        '[data-testid="toggle-finerworks-spec-details-btn"]'
      ) as HTMLButtonElement;

      expect(liveSpecBar).not.toBeNull();
      expect(activeSkuCode).not.toBeNull();
      expect(activeSkuCode?.textContent).toContain('5M42M9S22X33');
      expect(livePricePill).not.toBeNull();
      expect(livePricePill?.textContent).toContain('Wholesale:');
      expect(livePricePill?.textContent).toContain('Suggested Retail:');
      expect(toggleSpecBtn).not.toBeNull();
      expect(
        container.querySelector('[data-testid="finerworks-spec-details-drawer"]')
      ).toBeNull();

      await act(async () => {
        toggleSpecBtn.click();
      });

      const specDrawer = container.querySelector(
        '[data-testid="finerworks-spec-details-drawer"]'
      );
      expect(specDrawer).not.toBeNull();
      expect(specDrawer?.textContent).toContain(
        'Itemized Archival Edition Breakdown'
      );
      expect(specDrawer?.textContent).toContain('Physical Geometry & Weight');
      expect(onFinerWorksProductSpecChange).toHaveBeenCalled();

      expect(container.querySelectorAll('a[href]').length).toBe(0);
      const visibleText = (container.textContent || '').toLowerCase();
      expect(visibleText).not.toMatch(
        /screenshot|crop|2nd-prompt|bounding box|bbox|prompt/i
      );
      expect(visibleText).not.toMatch(
        /astra|gemini|argon|gpt-6|nano banana|openrouter/i
      );
    });

    it('23. supports true 300-DPI high-resolution mastering up to 40"×60" (12,000 × 18,000 px @ 300 DPI) and renders archival-300dpi-qc-badge', async () => {
      const metrics40x60 = computeSideBySideFidelityMetrics('36x48', false, 40, 60);
      expect(metrics40x60.widthPx).toBe(12000);
      expect(metrics40x60.heightPx).toBe(18000);
      expect(metrics40x60.dpi).toBe(300);
      expect(metrics40x60.labelInches).toBe('40" × 60"');
      expect(metrics40x60.targetResolutionLabel).toBe('12000 × 18000 px @ 300 DPI');

      const master40x60 = await buildHighResPrintMasterFile({
        identicalPrintDataUrl: 'data:image/png;base64,IDENTICAL_PRINT_SOURCE',
        sizeId: '36x48',
        includeBleed: false,
        title: 'Museum Grand Scale Edition',
        customWidthIn: 40,
        customHeightIn: 60,
      });
      expect(master40x60.widthPx).toBe(12000);
      expect(master40x60.heightPx).toBe(18000);
      expect(master40x60.dpi).toBe(300);
      expect(master40x60.filename).toBe(
        'atelier-vue-museum-grand-scale-edition-40x60-300dpi.png'
      );

      const variation = createMockVariation();
      await act(async () => {
        root.render(
          React.createElement(SizeAndFrameScroller, {
            variation,
            selectedSizeId: '36x48',
            selectedFrameId: 'natural-white-oak',
            selectedFinerWorksSizeId: '40x60',
            customPrintWidthIn: 40,
            customPrintHeightIn: 60,
            onSelectSize: vi.fn(),
            onSelectFrame: vi.fn(),
          })
        );
      });

      const qcBadge = container.querySelector(
        '[data-testid="archival-300dpi-qc-badge"]'
      ) as HTMLElement;
      expect(qcBadge).not.toBeNull();
      expect(qcBadge.textContent).toContain('300 DPI Archival Quality Verified');
      expect(qcBadge.textContent).toContain(
        'Zero-Grain High-Definition Master up to 40" × 60"'
      );
    });

    it('24. consolidates the 3 Reimagined Space options onto a single swipeable/iterative stage with prev/next arrows and pagination dots', async () => {
      const opt1 = createMockVariation({
        id: 'opt-1',
        artworkTitle: 'Collection I: Travertine Dawn',
        reimaginedRoomDataUrl: 'data:image/png;base64,OPT_1_ROOM',
      });
      const opt2 = createMockVariation({
        id: 'opt-2',
        artworkTitle: 'Collection II: Ochre Horizon',
        reimaginedRoomDataUrl: 'data:image/png;base64,OPT_2_ROOM',
      });
      const opt3 = createMockVariation({
        id: 'opt-3',
        artworkTitle: 'Collection III: Slate Nocturne',
        reimaginedRoomDataUrl: 'data:image/png;base64,OPT_3_ROOM',
      });

      const onSelectVariation = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(ScreenshotAndPrintStudio, {
            variation: opt1,
            variations: [opt1, opt2, opt3],
            activeVariationId: 'opt-1',
            onSelectVariation,
          })
        );
      });

      // Redundant external option switcher bar is sr-only so options are only displayed on the single large stage
      const externalBar = container.querySelector(
        '[data-testid="visualizer-option-switcher-bar"]'
      ) as HTMLElement;
      expect(externalBar).not.toBeNull();
      expect(externalBar.className).toContain('sr-only');

      // Stage has swipeable carousel controls and pagination dots
      const prevBtn = container.querySelector(
        '[data-testid="stage-prev-option-btn"]'
      ) as HTMLButtonElement;
      const nextBtn = container.querySelector(
        '[data-testid="stage-next-option-btn"]'
      ) as HTMLButtonElement;
      const indicator = container.querySelector(
        '[data-testid="stage-options-carousel-indicator"]'
      ) as HTMLElement;
      const dot1 = container.querySelector(
        '[data-testid="stage-option-dot-1"]'
      ) as HTMLButtonElement;
      const activeBadge = container.querySelector(
        '[data-testid="stage-active-option-badge"]'
      ) as HTMLElement;

      expect(prevBtn).not.toBeNull();
      expect(nextBtn).not.toBeNull();
      expect(indicator).not.toBeNull();
      expect(activeBadge.textContent).toContain('Option 1 of 3');
      expect(activeBadge.textContent).toContain(
        'Swipe or click ← / → to browse all 3 options'
      );

      // Click Next Option arrow -> advances from Option 1 to Option 2
      await act(async () => {
        nextBtn.click();
      });
      expect(onSelectVariation).toHaveBeenLastCalledWith('opt-2');

      // Click Option 2 dot directly
      await act(async () => {
        dot1.click();
      });
      expect(onSelectVariation).toHaveBeenLastCalledWith('opt-2');

      // Click Prev Option arrow -> wraps from Option 1 to Option 3
      await act(async () => {
        prevBtn.click();
      });
      expect(onSelectVariation).toHaveBeenLastCalledWith('opt-3');
    });
  });
});


