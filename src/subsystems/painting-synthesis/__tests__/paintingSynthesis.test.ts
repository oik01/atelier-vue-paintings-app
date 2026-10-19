// src/subsystems/painting-synthesis/__tests__/paintingSynthesis.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PRINT_SIZES,
  type WallAnalysisResult,
  type HarmonyMode,
  type PaintingStyleId,
  type OrientationMode,
  type AmbientLightingMode,
  type PaintingSpec,
} from '../../../contracts/masterContract';
import * as PaintingSynthesisBarrel from '../index';
import {
  mulberry32,
  hashRoomToSeed,
  derivePigmentStopsForStyle,
  generatePaintingsForRoom,
  FINE_ART_PIGMENT_LIBRARY,
} from '../harmonyPaletteGenerator';
import {
  noise2D,
  fbm2D,
  renderPaintingToCanvas,
  renderPaintingThumbnailDataUrl,
  clearPaintingThumbnailCache,
  getThumbnailCacheSize,
  getThumbnailCacheStats,
  MAX_THUMBNAIL_CACHE_ENTRIES,
  encodeDeterministicPngDataUrl,
} from '../proceduralArtRenderers';
import {
  resolveOrientedPrintDimensions,
  exportHighResPrintMaster,
  triggerBrowserDownload,
} from '../highResPrintExporter';

// ---------------------------------------------------------------------------
// Fixtures: Warm Terracotta Room (2950K) vs. Cool Nordic Slate Room (5600K)
// ---------------------------------------------------------------------------

function createWarmTerracottaRoomAnalysis(): WallAnalysisResult {
  return {
    roomId: 'terracotta-sunlit-loft',
    dominantSwatches: [
      {
        hex: '#C87D55',
        rgb: [200, 125, 85],
        hsl: [21, 52, 56],
        luminance: 0.54,
        populationRatio: 0.34,
        role: 'wall-dominant',
        label: 'Sunbaked Terracotta Lime',
      },
      {
        hex: '#A45A38',
        rgb: [164, 90, 56],
        hsl: [19, 49, 43],
        luminance: 0.39,
        populationRatio: 0.22,
        role: 'secondary-architecture',
        label: 'Fired Adobe Timber',
      },
      {
        hex: '#DDA35E',
        rgb: [221, 163, 94],
        hsl: [33, 65, 62],
        luminance: 0.63,
        populationRatio: 0.16,
        role: 'warm-undertone',
        label: 'Saffron Ochre Plaster',
      },
      {
        hex: '#7C5D4B',
        rgb: [124, 93, 75],
        hsl: [22, 25, 39],
        luminance: 0.36,
        populationRatio: 0.12,
        role: 'cool-undertone',
        label: 'Smoked Umber Shadow',
      },
      {
        hex: '#D45B3E',
        rgb: [212, 91, 62],
        hsl: [12, 64, 54],
        luminance: 0.48,
        populationRatio: 0.09,
        role: 'accent',
        label: 'Vermilion Kiln Glaze',
      },
      {
        hex: '#EADBC8',
        rgb: [234, 219, 200],
        hsl: [34, 46, 85],
        luminance: 0.85,
        populationRatio: 0.07,
        role: 'secondary-architecture',
        label: 'Warm Travertine Sill',
      },
    ],
    estimatedKelvin: 2950,
    temperatureCategory: 'warm',
    averageLuminance: 0.56,
    lightVector: {
      azimuthDeg: 315,
      elevationDeg: 38,
      shadowOffsetX: 0.42,
      shadowOffsetY: 0.35,
      shadowSoftness: 0.55,
    },
    detectedWallZone: {
      centerX: 0.5,
      centerY: 0.44,
      widthRatio: 0.52,
      heightRatio: 0.46,
      confidence: 0.94,
      edgeEnergyScore: 0.12,
    },
    recommendedHarmony: 'warm-gallery-contrast',
    curatorialSummary: 'Warm 2,950K sunlit terracotta loft with rich ochre and sienna undertones.',
  };
}

function createCoolNordicSlateRoomAnalysis(): WallAnalysisResult {
  return {
    roomId: 'nordic-slate-sanctuary',
    dominantSwatches: [
      {
        hex: '#6B8299',
        rgb: [107, 130, 153],
        hsl: [210, 18, 51],
        luminance: 0.49,
        populationRatio: 0.36,
        role: 'wall-dominant',
        label: 'Fjord Slate Plaster',
      },
      {
        hex: '#465B70',
        rgb: [70, 91, 112],
        hsl: [210, 23, 36],
        luminance: 0.34,
        populationRatio: 0.21,
        role: 'secondary-architecture',
        label: 'Deep Baltic Steel',
      },
      {
        hex: '#8BA2B5',
        rgb: [139, 162, 181],
        hsl: [207, 23, 63],
        luminance: 0.62,
        populationRatio: 0.15,
        role: 'warm-undertone',
        label: 'Glacial Mist Grey',
      },
      {
        hex: '#2F4356',
        rgb: [47, 67, 86],
        hsl: [209, 29, 26],
        luminance: 0.25,
        populationRatio: 0.13,
        role: 'cool-undertone',
        label: 'Prussian Night Shadow',
      },
      {
        hex: '#3A7B8C',
        rgb: [58, 123, 140],
        hsl: [192, 41, 39],
        luminance: 0.41,
        populationRatio: 0.08,
        role: 'accent',
        label: 'Cobalt Sea Glass',
      },
      {
        hex: '#DCE4EC',
        rgb: [220, 228, 236],
        hsl: [210, 29, 89],
        luminance: 0.89,
        populationRatio: 0.07,
        role: 'secondary-architecture',
        label: 'Nordic Chalk Moulding',
      },
    ],
    estimatedKelvin: 5600,
    temperatureCategory: 'cool',
    averageLuminance: 0.52,
    lightVector: {
      azimuthDeg: 225,
      elevationDeg: 48,
      shadowOffsetX: -0.38,
      shadowOffsetY: 0.32,
      shadowSoftness: 0.68,
    },
    detectedWallZone: {
      centerX: 0.5,
      centerY: 0.45,
      widthRatio: 0.62,
      heightRatio: 0.48,
      confidence: 0.96,
      edgeEnergyScore: 0.09,
    },
    recommendedHarmony: 'tonal-sanctuary',
    curatorialSummary: 'Cool 5,600K Nordic daylight studio with coastal slate and cerulean undertones.',
  };
}

function computeMeanPaletteDeltaRgb(a: PaintingSpec, b: PaintingSpec): number {
  let sumDist = 0;
  const count = Math.min(a.pigments.length, b.pigments.length);
  for (let i = 0; i < count; i++) {
    const [r1, g1, b1] = a.pigments[i].rgb;
    const [r2, g2, b2] = b.pigments[i].rgb;
    sumDist += Math.hypot(r1 - r2, g1 - g2, b1 - b2);
  }
  return count > 0 ? sumDist / count : 0;
}

function computeCanvasMeanAbsPixelDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let diffSum = 0;
  let channelCount = 0;
  for (let i = 0; i < len; i += 4) {
    diffSum +=
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
    channelCount += 3;
  }
  return channelCount > 0 ? diffSum / channelCount : 0;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Subsystem 2: painting-synthesis (Leaf 2A, Leaf 2B, Leaf 2C & Barrel Integration)', () => {
  beforeEach(() => {
    clearPaintingThumbnailCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // LEAF 2A: harmonyPaletteGenerator.ts
  // =========================================================================
  describe('Leaf 2A — Room-to-Pigment Curatorial Harmony & Palette Generator', () => {
    it('1. mulberry32 and hashRoomToSeed are deterministic, bounded in [0, 1), and sensitive to all parameters', () => {
      const seedA1 = hashRoomToSeed('nordic-linen-living', 'impasto-oil', 'complementary-accent', 0);
      const seedA2 = hashRoomToSeed('nordic-linen-living', 'impasto-oil', 'complementary-accent', 0);
      const seedDiffRoom = hashRoomToSeed('terracotta-sunlit-loft', 'impasto-oil', 'complementary-accent', 0);
      const seedDiffStyle = hashRoomToSeed('nordic-linen-living', 'rothko-colorfield', 'complementary-accent', 0);
      const seedDiffHarmony = hashRoomToSeed('nordic-linen-living', 'impasto-oil', 'tonal-sanctuary', 0);
      const seedDiffOffset = hashRoomToSeed('nordic-linen-living', 'impasto-oil', 'complementary-accent', 1);

      expect(seedA1).toBe(seedA2);
      expect(seedA1).toBeGreaterThan(0);
      expect(seedA1).not.toBe(seedDiffRoom);
      expect(seedA1).not.toBe(seedDiffStyle);
      expect(seedA1).not.toBe(seedDiffHarmony);
      expect(seedA1).not.toBe(seedDiffOffset);

      const rng1 = mulberry32(seedA1);
      const rng2 = mulberry32(seedA2);
      for (let i = 0; i < 25; i++) {
        const val1 = rng1();
        const val2 = rng2();
        expect(val1).toBe(val2);
        expect(val1).toBeGreaterThanOrEqual(0);
        expect(val1).toBeLessThan(1);
      }

      // Defensive fallback on NaN seed
      const rngNaN = mulberry32(Number.NaN);
      const vNaN = rngNaN();
      expect(Number.isFinite(vNaN)).toBe(true);
      expect(vNaN).toBeGreaterThanOrEqual(0);
      expect(vNaN).toBeLessThan(1);
    });

    it('2. FINE_ART_PIGMENT_LIBRARY provides 36 unique historical pigments with valid hex, RGB, and HSL tuples', () => {
      expect(FINE_ART_PIGMENT_LIBRARY.length).toBe(36);
      const names = new Set<string>();
      for (const entry of FINE_ART_PIGMENT_LIBRARY) {
        expect(entry.name.length).toBeGreaterThan(2);
        expect(names.has(entry.name)).toBe(false);
        names.add(entry.name);
        expect(entry.hex).toMatch(/^#[0-9A-F]{6}$/i);
        expect(entry.rgb).toHaveLength(3);
        expect(entry.hsl).toHaveLength(3);
      }
    });

    it('3. generatePaintingsForRoom returns 6 canonical PaintingSpec items (No. 01..No. 06) with 6 distinct pigments and 91%–98% Match rationale', () => {
      const warmAnalysis = createWarmTerracottaRoomAnalysis();
      const paintings = generatePaintingsForRoom(warmAnalysis);

      expect(paintings).toHaveLength(6);

      const expectedStyles: PaintingStyleId[] = [
        'impasto-oil',
        'japandi-plaster',
        'rothko-colorfield',
        'botanical-ink',
        'bauhaus-geometric',
        'coastal-nocturne',
      ];
      const expectedCatalogNumbers = ['No. 01', 'No. 02', 'No. 03', 'No. 04', 'No. 05', 'No. 06'];

      paintings.forEach((spec, idx) => {
        expect(spec.styleId).toBe(expectedStyles[idx]);
        expect(spec.catalogNumber).toBe(expectedCatalogNumbers[idx]);
        expect(spec.roomId).toBe(warmAnalysis.roomId);
        expect(spec.harmonyMode).toBe(warmAnalysis.recommendedHarmony);
        expect(spec.aspectRatio).toBe(0.75);
        expect(spec.lightAzimuthDeg).toBe(315);
        expect(spec.lightElevationDeg).toBe(38);
        expect(spec.title).toContain('&');
        expect(spec.subtitle).toContain('2,950K');

        // Curatorial rationale must include 91%–98% Match and room provenance
        const matchRegex = /^(9[1-8])% Match — Calibrated to /;
        expect(spec.curatorialRationale).toMatch(matchRegex);
        expect(spec.curatorialRationale).toContain('2,950K');
        expect(spec.curatorialRationale).toContain('315°');

        // Exactly 6 distinct PigmentStop entries per painting
        expect(spec.pigments).toHaveLength(6);
        const pigmentNames = new Set(spec.pigments.map((p) => p.pigmentName));
        expect(pigmentNames.size).toBe(6);

        for (const p of spec.pigments) {
          expect(p.hex).toMatch(/^#[0-9A-F]{6}$/);
          // Gallery-safe RGB bounds [8, 248] (no pure #000000 or #FFFFFF)
          expect(p.rgb[0]).toBeGreaterThanOrEqual(8);
          expect(p.rgb[0]).toBeLessThanOrEqual(248);
          expect(p.rgb[1]).toBeGreaterThanOrEqual(8);
          expect(p.rgb[1]).toBeLessThanOrEqual(248);
          expect(p.rgb[2]).toBeGreaterThanOrEqual(8);
          expect(p.rgb[2]).toBeLessThanOrEqual(248);
          expect(p.opacity).toBeGreaterThanOrEqual(0.1);
          expect(p.opacity).toBeLessThanOrEqual(1.0);
          expect(p.viscosity).toBeGreaterThanOrEqual(0.1);
          expect(p.viscosity).toBeLessThanOrEqual(1.0);
        }
      });
    });

    it('4. Quantitative Room Colorimetric Differentiation: Warm Terracotta (2950K) vs. Cool Nordic Slate (5600K) produces Delta RGB > 35 across all styles', () => {
      const warmRoom = createWarmTerracottaRoomAnalysis();
      const coolRoom = createCoolNordicSlateRoomAnalysis();

      const warmSpecs = generatePaintingsForRoom(warmRoom, 'complementary-accent');
      const coolSpecs = generatePaintingsForRoom(coolRoom, 'complementary-accent');

      for (let i = 0; i < 6; i++) {
        const deltaRgb = computeMeanPaletteDeltaRgb(warmSpecs[i], coolSpecs[i]);
        expect(deltaRgb).toBeGreaterThan(35);
      }
    });

    it('5. Harmony Mode Differentiation: all 4 HarmonyMode strategies produce measurably distinct palettes for the same room', () => {
      const room = createWarmTerracottaRoomAnalysis();
      const harmonyModes: HarmonyMode[] = [
        'complementary-accent',
        'tonal-sanctuary',
        'warm-gallery-contrast',
        'chromatic-split',
      ];

      const collectionsByMode = harmonyModes.map((mode) => generatePaintingsForRoom(room, mode));

      for (let i = 0; i < harmonyModes.length; i++) {
        for (let j = i + 1; j < harmonyModes.length; j++) {
          const specA = collectionsByMode[i][0]; // impasto-oil under mode i
          const specB = collectionsByMode[j][0]; // impasto-oil under mode j
          expect(specA.id).not.toBe(specB.id);
          expect(specA.harmonyMode).toBe(harmonyModes[i]);
          expect(specB.harmonyMode).toBe(harmonyModes[j]);
          expect(specA.subtitle).not.toBe(specB.subtitle);

          const delta = computeMeanPaletteDeltaRgb(specA, specB);
          expect(delta).toBeGreaterThan(15);
        }
      }
    });

    it('6. Determinism & seedOffset variation: identical calls are bit-for-bit identical while seedOffset shifts seeds and palettes', () => {
      const room = createCoolNordicSlateRoomAnalysis();
      const run1 = generatePaintingsForRoom(room, 'chromatic-split', 0);
      const run2 = generatePaintingsForRoom(room, 'chromatic-split', 0);
      const runOffset = generatePaintingsForRoom(room, 'chromatic-split', 7);

      expect(run1).toEqual(run2);
      for (let i = 0; i < 6; i++) {
        expect(run1[i].seed).not.toBe(runOffset[i].seed);
        expect(run1[i].id).not.toBe(runOffset[i].id);
      }
    });

    it('7. Defensive normalization handles empty/partial dominantSwatches, NaN Kelvin, and wallZone size adaptation', () => {
      const malformedAnalysis = {
        roomId: '   ',
        dominantSwatches: [
          {
            hex: '#808080',
            rgb: [128, 128, 128] as [number, number, number],
            hsl: [Number.NaN, 0, 50] as [number, number, number],
            luminance: Number.NaN,
            populationRatio: Number.NaN,
            role: 'wall-dominant' as const,
            label: '',
          },
        ],
        estimatedKelvin: Number.NaN,
        temperatureCategory: 'neutral' as const,
        averageLuminance: 0.5,
        lightVector: {
          azimuthDeg: Number.NaN,
          elevationDeg: Number.NaN,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          shadowSoftness: 0.5,
        },
        detectedWallZone: {
          centerX: 0.5,
          centerY: 0.5,
          widthRatio: 0.25, // narrow wall zone -> botanical-ink (index 3) recommends 18x24
          heightRatio: 0.4,
          confidence: 0.8,
          edgeEnergyScore: 0.1,
        },
        recommendedHarmony: 'complementary-accent' as HarmonyMode,
        curatorialSummary: '',
      };

      const specs = generatePaintingsForRoom(malformedAnalysis);
      expect(specs).toHaveLength(6);
      expect(specs[0].roomId).toBe('default-room');
      expect(specs[3].recommendedSizeId).toBe('18x24');

      // Also test completely empty swatches array
      const emptySpecs = derivePigmentStopsForStyle([], 3200, 'japandi-plaster', 'tonal-sanctuary', 42);
      expect(emptySpecs).toHaveLength(6);
      for (const stop of emptySpecs) {
        expect(stop.hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(Number.isFinite(stop.opacity)).toBe(true);
        expect(Number.isFinite(stop.viscosity)).toBe(true);
      }
    });
  });

  // =========================================================================
  // LEAF 2B: proceduralArtRenderers.ts
  // =========================================================================
  describe('Leaf 2B — Tactile Procedural Art Renderers, Relief Normals & Bounded LRU Cache', () => {
    it('8. noise2D and fbm2D are deterministic, smooth, and bounded in [0, 1]', () => {
      const n1 = noise2D(1.25, 3.75, 101);
      const n2 = noise2D(1.25, 3.75, 101);
      const nDiffSeed = noise2D(1.25, 3.75, 202);
      expect(n1).toBe(n2);
      expect(n1).not.toBe(nDiffSeed);
      expect(n1).toBeGreaterThanOrEqual(0);
      expect(n1).toBeLessThanOrEqual(1);

      const f1 = fbm2D(2.4, 1.8, 999, 5);
      const f2 = fbm2D(2.4, 1.8, 999, 5);
      expect(f1).toBe(f2);
      expect(f1).toBeGreaterThanOrEqual(0);
      expect(f1).toBeLessThanOrEqual(1);
    });

    it('9. renderPaintingToCanvas renders all 6 PaintingStyleId styles across portrait, landscape, and square orientations', () => {
      const room = createWarmTerracottaRoomAnalysis();
      const specs = generatePaintingsForRoom(room);
      const orientations: OrientationMode[] = ['portrait', 'landscape', 'square'];

      for (const spec of specs) {
        for (const orientation of orientations) {
          const canvas = document.createElement('canvas');
          renderPaintingToCanvas(canvas, spec, { orientation });

          if (orientation === 'portrait') {
            expect(canvas.width).toBe(360);
            expect(canvas.height).toBe(480);
          } else if (orientation === 'landscape') {
            expect(canvas.width).toBe(480);
            expect(canvas.height).toBe(360);
          } else {
            expect(canvas.width).toBe(400);
            expect(canvas.height).toBe(400);
          }

          const ctx = canvas.getContext('2d')!;
          expect(ctx).not.toBeNull();
          const img = ctx.getImageData(0, 0, 32, 32);
          expect(img.data.length).toBe(32 * 32 * 4);
          // Verify non-zero opaque pixel synthesis
          expect(img.data[3]).toBe(255);
          const sumRgb = img.data[0] + img.data[1] + img.data[2];
          expect(sumRgb).toBeGreaterThan(0);
        }
      }
    });

    it('10. renderPaintingToCanvas differentiates across all 3 AmbientLightingMode settings (daylight, golden-hour, evening-sconce)', () => {
      const spec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[0];
      const modes: AmbientLightingMode[] = ['daylight', 'golden-hour', 'evening-sconce'];

      const buffers = modes.map((ambientMode) => {
        const canvas = document.createElement('canvas');
        renderPaintingToCanvas(canvas, spec, {
          width: 96,
          height: 128,
          orientation: 'portrait',
          ambientMode,
        });
        return canvas.getContext('2d')!.getImageData(0, 0, 96, 128).data;
      });

      const diffDayVsGolden = computeCanvasMeanAbsPixelDiff(buffers[0], buffers[1]);
      const diffDayVsSconce = computeCanvasMeanAbsPixelDiff(buffers[0], buffers[2]);
      const diffGoldenVsSconce = computeCanvasMeanAbsPixelDiff(buffers[1], buffers[2]);

      expect(diffDayVsGolden).toBeGreaterThan(2.5);
      expect(diffDayVsSconce).toBeGreaterThan(2.5);
      expect(diffGoldenVsSconce).toBeGreaterThan(2.5);
    });

    it('11. Directional height-map relief lighting (dH/dx, dH/dy): changing lightAzimuthDeg (45° vs 225°) produces measurably distinct pixels and PNG output', () => {
      const baseSpec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[0];
      const specAzimuth45: PaintingSpec = { ...baseSpec, lightAzimuthDeg: 45, lightElevationDeg: 35 };
      const specAzimuth225: PaintingSpec = { ...baseSpec, lightAzimuthDeg: 225, lightElevationDeg: 35 };

      const canvas45 = document.createElement('canvas');
      const canvas225 = document.createElement('canvas');

      renderPaintingToCanvas(canvas45, specAzimuth45, { width: 96, height: 128 });
      renderPaintingToCanvas(canvas225, specAzimuth225, { width: 96, height: 128 });

      const pixels45 = canvas45.getContext('2d')!.getImageData(0, 0, 96, 128).data;
      const pixels225 = canvas225.getContext('2d')!.getImageData(0, 0, 96, 128).data;

      const reliefPixelDiff = computeCanvasMeanAbsPixelDiff(pixels45, pixels225);
      expect(reliefPixelDiff).toBeGreaterThan(4.0);

      const png45 = encodeDeterministicPngDataUrl(specAzimuth45, 96, 128, 'portrait');
      const png225 = encodeDeterministicPngDataUrl(specAzimuth225, 96, 128, 'portrait');
      expect(png45).not.toBe(png225);
    });

    it('12. All 6 PaintingStyleId procedural engines produce mutually distinct pixel fields and PNG data URLs', () => {
      const specs = generatePaintingsForRoom(createCoolNordicSlateRoomAnalysis());
      const pngs = new Set<string>();
      const pixelBuffers: Uint8ClampedArray[] = [];

      for (const spec of specs) {
        const canvas = document.createElement('canvas');
        renderPaintingToCanvas(canvas, spec, { width: 64, height: 64, orientation: 'square' });
        pixelBuffers.push(canvas.getContext('2d')!.getImageData(0, 0, 64, 64).data);
        pngs.add(encodeDeterministicPngDataUrl(spec, 64, 64, 'square'));
      }

      expect(pngs.size).toBe(6);
      for (let i = 0; i < pixelBuffers.length; i++) {
        for (let j = i + 1; j < pixelBuffers.length; j++) {
          expect(computeCanvasMeanAbsPixelDiff(pixelBuffers[i], pixelBuffers[j])).toBeGreaterThan(5);
        }
      }
    });

    it('13. renderPaintingThumbnailDataUrl returns valid PNG data URLs, serves cached hits in <16ms, and differentiates by orientation', () => {
      const spec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[1]; // japandi-plaster

      const portraitUrl = renderPaintingThumbnailDataUrl(spec, 'portrait');
      const landscapeUrl = renderPaintingThumbnailDataUrl(spec, 'landscape');
      const squareUrl = renderPaintingThumbnailDataUrl(spec, 'square');

      expect(portraitUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(landscapeUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(squareUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(portraitUrl).not.toBe(landscapeUrl);
      expect(portraitUrl).not.toBe(squareUrl);
      expect(landscapeUrl).not.toBe(squareUrl);

      // Verify binary PNG header signature (\x89PNG\r\n\x1a\n)
      const base64Payload = portraitUrl.split(',')[1];
      const binaryStr = atob(base64Payload);
      expect(binaryStr.charCodeAt(0)).toBe(137);
      expect(binaryStr.slice(1, 4)).toBe('PNG');
      expect(binaryStr).toContain('IHDR');
      expect(binaryStr).toContain('IDAT');
      expect(binaryStr).toContain('IEND');

      // Verify memoized cache hit completes in <16ms
      const t0 = performance.now();
      const cachedHit = renderPaintingThumbnailDataUrl(spec, 'portrait');
      const elapsedMs = performance.now() - t0;

      expect(cachedHit).toBe(portraitUrl);
      expect(elapsedMs).toBeLessThan(16);
      expect(getThumbnailCacheSize()).toBe(3);
    });

    it('14. Bounded LRU thumbnail cache enforces MAX_THUMBNAIL_CACHE_ENTRIES = 48 and refreshes MRU order on cache hits', () => {
      const baseSpec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[0];
      expect(MAX_THUMBNAIL_CACHE_ENTRIES).toBe(48);

      // Populate exactly 48 entries (seed 1..48)
      for (let i = 1; i <= 48; i++) {
        renderPaintingThumbnailDataUrl({ ...baseSpec, id: `spec-${i}`, seed: i }, 'portrait');
      }
      expect(getThumbnailCacheSize()).toBe(48);

      // Touch spec-1 so it is refreshed to Most-Recently-Used (MRU)
      renderPaintingThumbnailDataUrl({ ...baseSpec, id: 'spec-1', seed: 1 }, 'portrait');

      // Insert 16 additional distinct thumbnails (49..64)
      for (let i = 49; i <= 64; i++) {
        renderPaintingThumbnailDataUrl({ ...baseSpec, id: `spec-${i}`, seed: i }, 'portrait');
        expect(getThumbnailCacheSize()).toBeLessThanOrEqual(48);
      }

      const stats = getThumbnailCacheStats();
      expect(stats.size).toBe(48);
      expect(stats.maxEntries).toBe(48);

      // spec-1 was refreshed after 48, so after 16 evictions it must STILL be in the cache,
      // whereas spec-2 (never touched) must have been evicted!
      const hasSpec1 = stats.keys.some((k) => k.startsWith('spec-1::'));
      const hasSpec2 = stats.keys.some((k) => k.startsWith('spec-2::'));
      const hasSpec64 = stats.keys.some((k) => k.startsWith('spec-64::'));

      expect(hasSpec1).toBe(true);
      expect(hasSpec2).toBe(false);
      expect(hasSpec64).toBe(true);

      clearPaintingThumbnailCache();
      expect(getThumbnailCacheSize()).toBe(0);
    });

    it('15. renderPaintingToCanvas handles malformed/empty spec.pigments and highResDetail without throwing', () => {
      const baseSpec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[4];
      const malformedSpec: PaintingSpec = {
        ...baseSpec,
        pigments: [],
      };
      const canvas = document.createElement('canvas');
      expect(() =>
        renderPaintingToCanvas(canvas, malformedSpec, {
          width: 240,
          height: 320,
          highResDetail: true,
        })
      ).not.toThrow();
      expect(canvas.width).toBe(240);
      expect(canvas.height).toBe(320);
    });
  });

  // =========================================================================
  // LEAF 2C: highResPrintExporter.ts & index.ts
  // =========================================================================
  describe('Leaf 2C — 300-DPI Archival Print Master Exporter, Bleed/Crop Marks, COA & Download Trigger', () => {
    it('16. resolveOrientedPrintDimensions calculates accurate trim & bleed pixel dimensions across portrait, landscape, and square', () => {
      const size24x36 = PRINT_SIZES['24x36']; // 2400 x 3600 @ 300 DPI

      const portraitTrim = resolveOrientedPrintDimensions(size24x36, 'portrait', {
        targetWidthPx: 2400,
        targetHeightPx: 3600,
        dpi: 300,
        includePrintBleed: false,
        colorProfileLabel: 'sRGB IEC61966-2.1',
      });
      expect(portraitTrim).toEqual({
        artworkWidthPx: 2400,
        artworkHeightPx: 3600,
        bleedPx: 0,
        totalWidthPx: 2400,
        totalHeightPx: 3600,
        effectiveDpi: 300,
      });

      const landscapeBleed = resolveOrientedPrintDimensions(size24x36, 'landscape', {
        targetWidthPx: 2400,
        targetHeightPx: 3600,
        dpi: 300,
        includePrintBleed: true,
        colorProfileLabel: 'AdobeRGB (1998) Archival',
      });
      // At 300 DPI, 0.25" bleed = 75px on each side (+150px total width and height)
      expect(landscapeBleed).toEqual({
        artworkWidthPx: 3600,
        artworkHeightPx: 2400,
        bleedPx: 75,
        totalWidthPx: 3750,
        totalHeightPx: 2550,
        effectiveDpi: 300,
      });

      const squareBleed = resolveOrientedPrintDimensions(size24x36, 'square', {
        targetWidthPx: 2400,
        targetHeightPx: 3600,
        dpi: 300,
        includePrintBleed: true,
        colorProfileLabel: 'sRGB IEC61966-2.1',
      });
      expect(squareBleed).toEqual({
        artworkWidthPx: 2400,
        artworkHeightPx: 2400,
        bleedPx: 75,
        totalWidthPx: 2550,
        totalHeightPx: 2550,
        effectiveDpi: 300,
      });
    });

    it('17. exportHighResPrintMaster (includePrintBleed: false) reports progress 10->55->85->100 and returns exact trim dimensions', async () => {
      const spec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[0];
      const sizeSpec = PRINT_SIZES['18x24'];
      const progressSteps: number[] = [];

      const result = await exportHighResPrintMaster(
        spec,
        sizeSpec,
        'portrait',
        {
          targetWidthPx: 450,
          targetHeightPx: 600,
          dpi: 300,
          includePrintBleed: false,
          colorProfileLabel: 'sRGB IEC61966-2.1',
        },
        (pct) => progressSteps.push(pct)
      );

      expect(progressSteps).toEqual([10, 55, 85, 100]);
      expect(result.paintingId).toBe(spec.id);
      expect(result.title).toBe(spec.title);
      expect(result.widthPx).toBe(450);
      expect(result.heightPx).toBe(600);
      expect(result.dpi).toBe(300);
      expect(result.includedBleed).toBe(false);
      expect(result.blobSizeBytes).toBeGreaterThan(100);
      expect(result.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    });

    it('18. exportHighResPrintMaster (includePrintBleed: true) expands canvas by +2*bleedPx and renders archival bleed/crop marks', async () => {
      const spec = generatePaintingsForRoom(createCoolNordicSlateRoomAnalysis())[2]; // rothko-colorfield
      const sizeSpec = PRINT_SIZES['24x36'];
      const progressSteps: number[] = [];

      const result = await exportHighResPrintMaster(
        spec,
        sizeSpec,
        'landscape',
        {
          targetWidthPx: 600,
          targetHeightPx: 800,
          dpi: 300,
          includePrintBleed: true,
          colorProfileLabel: 'AdobeRGB (1998) Archival',
        },
        (pct) => progressSteps.push(pct)
      );

      // For 800x600 landscape at 300 DPI: bleedPx = min(75, round(600 * 0.12) = 72) -> 72px
      expect(progressSteps).toEqual([10, 55, 85, 100]);
      expect(result.includedBleed).toBe(true);
      expect(result.widthPx).toBe(800 + 72 * 2);
      expect(result.heightPx).toBe(600 + 72 * 2);
      expect(result.dpi).toBe(300);
      expect(result.blobSizeBytes).toBeGreaterThan(100);
      expect(result.certificateHtml).toContain('Included (+0.25&quot; / 72 px Archival Bleed');
      expect(result.certificateHtml).toContain('AdobeRGB (1998) Archival');
    });

    it('19. certificateHtml includes all 6 pigments, verification digest, and strictly escapes XSS payloads in title/rationale', async () => {
      const baseSpec = generatePaintingsForRoom(createWarmTerracottaRoomAnalysis())[3];
      const maliciousSpec: PaintingSpec = {
        ...baseSpec,
        title: 'Botanical <script>alert("xss")</script> & "Ochre"',
        subtitle: '3,000K <img src=x onerror=alert(1)>',
        curatorialRationale: '96% Match — <svg onload="evil()"> & \'quotes\'',
      };

      const result = await exportHighResPrintMaster(
        maliciousSpec,
        PRINT_SIZES['18x24'],
        'portrait',
        {
          targetWidthPx: 300,
          targetHeightPx: 400,
          dpi: 300,
          includePrintBleed: true,
          colorProfileLabel: 'sRGB IEC61966-2.1',
        }
      );

      expect(result.certificateHtml).toContain('<!DOCTYPE html>');
      expect(result.certificateHtml).toContain('Certificate of Authenticity');
      expect(result.certificateHtml).toMatch(/AV-[0-9A-F]{8}-[0-9A-F]{8}/);

      // Verify all 6 pigment stops P-01..P-06 are listed
      for (let i = 1; i <= 6; i++) {
        expect(result.certificateHtml).toContain(`P-0${i}`);
      }

      // Verify raw script/img/svg tags are escaped and never injected unescaped
      expect(result.certificateHtml).not.toContain('<script>alert("xss")</script>');
      expect(result.certificateHtml).not.toContain('<img src=x');
      expect(result.certificateHtml).not.toContain('<svg onload=');
      expect(result.certificateHtml).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.certificateHtml).toContain('&#39;quotes&#39;');
    });

    it('20. productionManifestJson conforms to schemaVersion 1.0.0 with complete pigmentFormula and oriented physical dimensions', async () => {
      const spec = generatePaintingsForRoom(createCoolNordicSlateRoomAnalysis())[5]; // coastal-nocturne
      const result = await exportHighResPrintMaster(
        spec,
        PRINT_SIZES['30x40'],
        'landscape',
        {
          targetWidthPx: 400,
          targetHeightPx: 300,
          dpi: 300,
          includePrintBleed: true,
          colorProfileLabel: 'AdobeRGB (1998) Archival',
        }
      );

      const manifest = JSON.parse(result.productionManifestJson);
      expect(manifest.schemaVersion).toBe('1.0.0');
      expect(manifest.issuer).toBe('Atelier Vue Archival Print Studio');
      expect(manifest.verificationHash).toMatch(/^AV-[0-9A-F]{8}-[0-9A-F]{8}$/);
      expect(manifest.paintingSpec.id).toBe(spec.id);
      expect(manifest.paintingSpec.styleId).toBe('coastal-nocturne');
      expect(manifest.orientation).toBe('landscape');
      expect(manifest.printSizeSpec.id).toBe('30x40');
      expect(manifest.printSizeSpec.widthInches).toBe(40);
      expect(manifest.printSizeSpec.heightInches).toBe(30);
      expect(manifest.exportDimensions.artworkWidthPx).toBe(400);
      expect(manifest.exportDimensions.artworkHeightPx).toBe(300);
      expect(manifest.exportDimensions.bleedPx).toBe(36);
      expect(manifest.exportDimensions.totalWidthPx).toBe(472);
      expect(manifest.exportDimensions.totalHeightPx).toBe(372);
      expect(manifest.colorProfile).toBe('AdobeRGB (1998) Archival');
      expect(manifest.bleedIncluded).toBe(true);
      expect(manifest.pigmentFormula).toHaveLength(6);
      expect(manifest.pigmentFormula[0].stopIndex).toBe(1);
    });

    it('21. triggerBrowserDownload sanitizes filenames, appends default extensions, triggers anchor click, and supports Blob URLs for >1.5MB payloads', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const removeSpy = vi.spyOn(document.body, 'removeChild');

      // Case 1: Unsafe filename without extension + PNG dataUrl
      triggerBrowserDownload('data:image/png;base64,iVBORw0KGgo=', '../../Atelier: "No. 01"?!');
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const anchor1 = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor1.download).toBe('Atelier-No.-01.png');
      expect(removeSpy).toHaveBeenCalledWith(anchor1);

      // Case 2: HTML dataUrl without extension auto-appends .html
      triggerBrowserDownload('data:text/html;charset=utf-8,<html></html>', 'certificate-of-authenticity');
      const anchor2 = appendSpy.mock.calls[1][0] as HTMLAnchorElement;
      expect(anchor2.download).toBe('certificate-of-authenticity.html');

      // Case 3: Large >1.5MB dataUrl uses Blob + URL.createObjectURL
      const fakeBlobUrl = 'blob:https://atelier-vue.local/master-123';
      const origCreateObjectURL = URL.createObjectURL;
      const createObjUrlMock = vi.fn().mockReturnValue(fakeBlobUrl);
      URL.createObjectURL = createObjUrlMock;

      try {
        const largeBase64 = 'A'.repeat(1_600_000);
        triggerBrowserDownload(`data:image/png;base64,${largeBase64}`, 'grand-master.png');

        expect(createObjUrlMock).toHaveBeenCalledTimes(1);
        const anchor3 = appendSpy.mock.calls[2][0] as HTMLAnchorElement;
        expect(anchor3.href).toBe(fakeBlobUrl);
        expect(anchor3.download).toBe('grand-master.png');
      } finally {
        URL.createObjectURL = origCreateObjectURL;
      }
    });

    it('22. Barrel export (index.ts) exposes all C_root & C_sub symbols and executes end-to-end room-to-print synthesis', async () => {
      expect(typeof PaintingSynthesisBarrel.generatePaintingsForRoom).toBe('function');
      expect(typeof PaintingSynthesisBarrel.mulberry32).toBe('function');
      expect(typeof PaintingSynthesisBarrel.hashRoomToSeed).toBe('function');
      expect(typeof PaintingSynthesisBarrel.derivePigmentStopsForStyle).toBe('function');
      expect(Array.isArray(PaintingSynthesisBarrel.FINE_ART_PIGMENT_LIBRARY)).toBe(true);
      expect(typeof PaintingSynthesisBarrel.renderPaintingToCanvas).toBe('function');
      expect(typeof PaintingSynthesisBarrel.renderPaintingThumbnailDataUrl).toBe('function');
      expect(typeof PaintingSynthesisBarrel.clearPaintingThumbnailCache).toBe('function');
      expect(typeof PaintingSynthesisBarrel.getThumbnailCacheSize).toBe('function');
      expect(typeof PaintingSynthesisBarrel.getThumbnailCacheStats).toBe('function');
      expect(typeof PaintingSynthesisBarrel.encodeDeterministicPngDataUrl).toBe('function');
      expect(typeof PaintingSynthesisBarrel.exportHighResPrintMaster).toBe('function');
      expect(typeof PaintingSynthesisBarrel.triggerBrowserDownload).toBe('function');
      expect(typeof PaintingSynthesisBarrel.resolveOrientedPrintDimensions).toBe('function');

      // End-to-End Subsystem 2 Pipeline Verification
      const room = createWarmTerracottaRoomAnalysis();
      const collection = PaintingSynthesisBarrel.generatePaintingsForRoom(room, 'complementary-accent', 0);
      expect(collection).toHaveLength(6);

      const selected = collection[0];
      const thumbUrl = PaintingSynthesisBarrel.renderPaintingThumbnailDataUrl(selected, 'portrait');
      expect(thumbUrl.startsWith('data:image/png;base64,')).toBe(true);

      const exported = await PaintingSynthesisBarrel.exportHighResPrintMaster(
        selected,
        PRINT_SIZES[selected.recommendedSizeId],
        'portrait',
        {
          targetWidthPx: 360,
          targetHeightPx: 540,
          dpi: 300,
          includePrintBleed: true,
          colorProfileLabel: 'sRGB IEC61966-2.1',
        }
      );

      expect(exported.paintingId).toBe(selected.id);
      expect(exported.includedBleed).toBe(true);
      expect(exported.widthPx).toBeGreaterThan(360);
      expect(exported.heightPx).toBeGreaterThan(540);
    });
  });
});
