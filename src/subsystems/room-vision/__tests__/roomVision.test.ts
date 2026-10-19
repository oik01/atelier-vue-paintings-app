import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomAsset, WallAnalysisResult } from '../../../contracts/masterContract';
import * as RoomVisionBarrel from '../index';
import {
  CameraCaptureModal,
  PRESET_ROOM_DEFINITIONS,
  analyzeRoomDataUrl,
  analyzeRoomImagePixels,
  createCapturedRoomAssetFromViewfinder,
  createDeterministicImageDataFromSeed,
  createRoomAssetFromUpload,
  generateInitialPresetRooms,
  renderPresetRoomToCanvas,
  synthesizePresetRoomImageData,
} from '../index';

function makeSyntheticImageData(
  width: number,
  height: number,
  pixelGenerator: (x: number, y: number, xn: number, yn: number) => [number, number, number, number]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const yn = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const xn = (x + 0.5) / width;
      const [r, g, b, a] = pixelGenerator(x, y, xn, yn);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

function euclideanRgbDistance(
  rgbA: [number, number, number],
  rgbB: [number, number, number]
): number {
  const dr = rgbA[0] - rgbB[0];
  const dg = rgbA[1] - rgbB[1];
  const db = rgbA[2] - rgbB[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function assertValidWallAnalysis(analysis: WallAnalysisResult, expectedRoomId?: string): void {
  if (expectedRoomId !== undefined) {
    expect(analysis.roomId).toBe(expectedRoomId);
  } else {
    expect(analysis.roomId.length).toBeGreaterThan(0);
  }

  expect(analysis.dominantSwatches).toHaveLength(6);

  const hexSet = new Set<string>();
  const roles = new Set<string>();
  let ratioSum = 0;

  for (let i = 0; i < analysis.dominantSwatches.length; i++) {
    const sw = analysis.dominantSwatches[i];
    expect(sw.hex).toMatch(/^#[0-9A-F]{6}$/);
    hexSet.add(sw.hex);
    roles.add(sw.role);

    expect(sw.rgb).toHaveLength(3);
    for (const ch of sw.rgb) {
      expect(ch).toBeGreaterThanOrEqual(0);
      expect(ch).toBeLessThanOrEqual(255);
    }

    expect(sw.hsl).toHaveLength(3);
    expect(sw.hsl[0]).toBeGreaterThanOrEqual(0);
    expect(sw.hsl[0]).toBeLessThanOrEqual(360);
    expect(sw.hsl[1]).toBeGreaterThanOrEqual(0);
    expect(sw.hsl[1]).toBeLessThanOrEqual(100);
    expect(sw.hsl[2]).toBeGreaterThanOrEqual(0);
    expect(sw.hsl[2]).toBeLessThanOrEqual(100);

    expect(sw.luminance).toBeGreaterThanOrEqual(0);
    expect(sw.luminance).toBeLessThanOrEqual(1);
    expect(sw.populationRatio).toBeGreaterThan(0);
    expect(sw.populationRatio).toBeLessThanOrEqual(1);
    expect(sw.label.trim().length).toBeGreaterThan(2);

    if (i > 0) {
      expect(analysis.dominantSwatches[i - 1].populationRatio).toBeGreaterThanOrEqual(
        sw.populationRatio
      );
    }
    ratioSum += sw.populationRatio;
  }

  expect(hexSet.size).toBe(6);
  expect(Math.abs(ratioSum - 1.0)).toBeLessThan(1e-3);
  expect(roles.has('wall-dominant')).toBe(true);
  expect(roles.has('secondary-architecture')).toBe(true);
  expect(roles.has('warm-undertone')).toBe(true);
  expect(roles.has('cool-undertone')).toBe(true);
  expect(roles.has('accent')).toBe(true);

  expect(analysis.estimatedKelvin).toBeGreaterThanOrEqual(2700);
  expect(analysis.estimatedKelvin).toBeLessThanOrEqual(6500);
  expect(['warm', 'neutral', 'cool']).toContain(analysis.temperatureCategory);
  expect(analysis.averageLuminance).toBeGreaterThanOrEqual(0);
  expect(analysis.averageLuminance).toBeLessThanOrEqual(1);

  expect(analysis.lightVector.azimuthDeg).toBeGreaterThanOrEqual(0);
  expect(analysis.lightVector.azimuthDeg).toBeLessThanOrEqual(360);
  expect(analysis.lightVector.elevationDeg).toBeGreaterThanOrEqual(15);
  expect(analysis.lightVector.elevationDeg).toBeLessThanOrEqual(75);
  expect(analysis.lightVector.shadowOffsetX).toBeGreaterThanOrEqual(-1);
  expect(analysis.lightVector.shadowOffsetX).toBeLessThanOrEqual(1);
  expect(analysis.lightVector.shadowOffsetY).toBeGreaterThanOrEqual(0);
  expect(analysis.lightVector.shadowOffsetY).toBeLessThanOrEqual(1);
  expect(analysis.lightVector.shadowSoftness).toBeGreaterThanOrEqual(0.2);
  expect(analysis.lightVector.shadowSoftness).toBeLessThanOrEqual(1.0);

  expect(analysis.detectedWallZone.centerX).toBeGreaterThanOrEqual(0.25);
  expect(analysis.detectedWallZone.centerX).toBeLessThanOrEqual(0.75);
  expect(analysis.detectedWallZone.centerY).toBeGreaterThanOrEqual(0.25);
  expect(analysis.detectedWallZone.centerY).toBeLessThanOrEqual(0.55);
  expect(analysis.detectedWallZone.widthRatio).toBeGreaterThanOrEqual(0.2);
  expect(analysis.detectedWallZone.widthRatio).toBeLessThanOrEqual(0.75);
  expect(analysis.detectedWallZone.heightRatio).toBeGreaterThanOrEqual(0.2);
  expect(analysis.detectedWallZone.heightRatio).toBeLessThanOrEqual(0.65);
  expect(analysis.detectedWallZone.confidence).toBeGreaterThanOrEqual(0.5);
  expect(analysis.detectedWallZone.confidence).toBeLessThanOrEqual(1.0);

  expect([
    'complementary-accent',
    'tonal-sanctuary',
    'warm-gallery-contrast',
    'chromatic-split',
  ]).toContain(analysis.recommendedHarmony);
  expect(analysis.curatorialSummary.length).toBeGreaterThan(25);
}

describe('Subsystem 1 (room-vision) Comprehensive Integration & Contract Verification', () => {
  describe('1. Master Contract & Barrel Exports Verification (index.ts)', () => {
    it('exports all required C_root and C_sub functions, constants, and components from index.ts', () => {
      expect(typeof RoomVisionBarrel.generateInitialPresetRooms).toBe('function');
      expect(typeof RoomVisionBarrel.analyzeRoomImagePixels).toBe('function');
      expect(typeof RoomVisionBarrel.analyzeRoomDataUrl).toBe('function');
      expect(typeof RoomVisionBarrel.createRoomAssetFromUpload).toBe('function');
      expect(typeof RoomVisionBarrel.CameraCaptureModal).toBe('function');
      expect(Array.isArray(RoomVisionBarrel.PRESET_ROOM_DEFINITIONS)).toBe(true);
      expect(RoomVisionBarrel.PRESET_ROOM_DEFINITIONS).toHaveLength(4);
      expect(typeof RoomVisionBarrel.synthesizePresetRoomImageData).toBe('function');
      expect(typeof RoomVisionBarrel.renderPresetRoomToCanvas).toBe('function');
      expect(typeof RoomVisionBarrel.createCapturedRoomAssetFromViewfinder).toBe('function');
      expect(typeof RoomVisionBarrel.createDeterministicImageDataFromSeed).toBe('function');
    });
  });

  describe('2. Pre-Seeded Architectural Room Studio (generateInitialPresetRooms & renderPresetRoomToCanvas)', () => {
    it('generates all 4 preset rooms with complete metadata, valid SVG/Canvas data URLs, and full WallAnalysisResult', () => {
      const rooms = generateInitialPresetRooms();
      expect(rooms).toHaveLength(4);

      const expectedIds = [
        'nordic-linen-living',
        'midcentury-walnut-study',
        'terracotta-sunlit-loft',
        'minimalist-concrete-bedroom',
      ];
      expect(rooms.map((r) => r.id)).toEqual(expectedIds);

      for (const room of rooms) {
        expect(room.isCustomUpload).toBe(false);
        expect(room.name.trim().length).toBeGreaterThan(5);
        expect(room.architecturalStyle.trim().length).toBeGreaterThan(5);
        expect(room.wallWidthInches).toBeGreaterThan(80);
        expect(room.eyeLevelRatioY).toBeGreaterThan(0.35);
        expect(room.eyeLevelRatioY).toBeLessThan(0.55);
        expect(room.imageDataUrl.startsWith('data:image/')).toBe(true);
        expect(room.createdAt).toBeGreaterThan(0);
        assertValidWallAnalysis(room.analysis, room.id);
      }
    });

    it('produces quantitatively distinct colorimetry profiles across warm terracotta, walnut study, and cool concrete rooms', () => {
      const rooms = generateInitialPresetRooms();
      const byId = Object.fromEntries(rooms.map((r) => [r.id, r])) as Record<string, RoomAsset>;

      const nordic = byId['nordic-linen-living'];
      const walnut = byId['midcentury-walnut-study'];
      const terracotta = byId['terracotta-sunlit-loft'];
      const concrete = byId['minimalist-concrete-bedroom'];

      // Terracotta and Walnut rooms classify as warm (< 3900K)
      expect(terracotta.analysis.temperatureCategory).toBe('warm');
      expect(terracotta.analysis.estimatedKelvin).toBeLessThan(3900);

      expect(walnut.analysis.temperatureCategory).toBe('warm');
      expect(walnut.analysis.estimatedKelvin).toBeLessThan(3900);

      // Minimalist concrete bedroom classifies as cool (> 4600K)
      expect(concrete.analysis.temperatureCategory).toBe('cool');
      expect(concrete.analysis.estimatedKelvin).toBeGreaterThan(4600);

      // Nordic linen living room has high wall reflectance (> 0.65)
      expect(nordic.analysis.averageLuminance).toBeGreaterThan(0.65);

      // Euclidean RGB distance between primary wall-dominant swatch of terracotta vs concrete is > 18
      const deltaE = euclideanRgbDistance(
        terracotta.analysis.dominantSwatches[0].rgb,
        concrete.analysis.dominantSwatches[0].rgb
      );
      expect(deltaE).toBeGreaterThan(18);

      // Directional shadows match architectural window placement
      expect(nordic.analysis.lightVector.shadowOffsetX).toBeGreaterThan(0);
      expect(terracotta.analysis.lightVector.shadowOffsetX).toBeLessThan(0);
    });

    it('renders non-blank ImageData on HTMLCanvasElement and responds to panX, panY, and lightingShift options', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 210;

      const daylightData = renderPresetRoomToCanvas(canvas, 'nordic-linen-living', {
        panX: 0,
        panY: 0,
        lightingShift: 'daylight',
      });
      expect(daylightData.width).toBe(320);
      expect(daylightData.height).toBe(210);

      const eveningData = renderPresetRoomToCanvas(canvas, 'nordic-linen-living', {
        panX: 0.2,
        panY: -0.1,
        lightingShift: 'warm-evening',
      });

      const daylightAnalysis = analyzeRoomImagePixels(daylightData, 'nordic-daylight');
      const eveningAnalysis = analyzeRoomImagePixels(eveningData, 'nordic-evening');

      // Warm evening lighting shifts Kelvin warmer (lower) compared to neutral daylight
      expect(eveningAnalysis.estimatedKelvin).toBeLessThan(daylightAnalysis.estimatedKelvin);
    });
  });

  describe('3. Computer-Vision Wall Colorimetry Analyzer (analyzeRoomImagePixels & analyzeRoomDataUrl)', () => {
    it('detects uncluttered open wall zone via 3x3 Sobel gradient + 2D integral image away from edge clutter', () => {
      // Synthetic room with heavy checkerboard edge clutter on the left half (x < 0.48)
      // and smooth plaster wall on the right half (x >= 0.48)
      const leftCluttered = makeSyntheticImageData(160, 105, (x, y, xn, yn) => {
        if (yn < 0.7) {
          if (xn < 0.48) {
            const isDark = (x + y) % 2 === 0;
            return isDark ? [25, 25, 25, 255] : [245, 245, 245, 255];
          }
          return [232, 226, 214, 255];
        }
        return [160, 130, 100, 255];
      });

      const rightOpenResult = analyzeRoomImagePixels(leftCluttered, 'test-left-clutter');
      expect(rightOpenResult.detectedWallZone.centerX).toBeGreaterThan(0.5);

      // Synthetic room with heavy edge clutter on the right half (x > 0.52)
      // and smooth plaster wall on the left half (x <= 0.52)
      const rightCluttered = makeSyntheticImageData(160, 105, (x, y, xn, yn) => {
        if (yn < 0.7) {
          if (xn > 0.52) {
            const isDark = (x + y) % 2 === 0;
            return isDark ? [20, 20, 20, 255] : [248, 248, 248, 255];
          }
          return [232, 226, 214, 255];
        }
        return [160, 130, 100, 255];
      });

      const leftOpenResult = analyzeRoomImagePixels(rightCluttered, 'test-right-clutter');
      expect(leftOpenResult.detectedWallZone.centerX).toBeLessThan(0.5);
    });

    it('estimates directional lightVector shadowOffsetX and azimuthDeg accurately from horizontal wall brightness gradients', () => {
      // Left side brighter than right side -> light from left -> shadow casts right (shadowOffsetX > 0, azimuth in [180, 360])
      const leftLitWall = makeSyntheticImageData(160, 105, (_x, _y, xn, yn) => {
        if (yn < 0.7) {
          const v = Math.round(245 - xn * 110);
          return [v, v - 4, v - 10, 255];
        }
        return [140, 120, 100, 255];
      });

      const leftLitAnalysis = analyzeRoomImagePixels(leftLitWall, 'left-lit-room');
      expect(leftLitAnalysis.lightVector.shadowOffsetX).toBeGreaterThan(0);
      expect(leftLitAnalysis.lightVector.azimuthDeg).toBeGreaterThanOrEqual(180);
      expect(leftLitAnalysis.lightVector.azimuthDeg).toBeLessThanOrEqual(360);

      // Right side brighter than left side -> light from right -> shadow casts left (shadowOffsetX < 0, azimuth in [0, 180])
      const rightLitWall = makeSyntheticImageData(160, 105, (_x, _y, xn, yn) => {
        if (yn < 0.7) {
          const v = Math.round(135 + xn * 110);
          return [v, v - 4, v - 10, 255];
        }
        return [140, 120, 100, 255];
      });

      const rightLitAnalysis = analyzeRoomImagePixels(rightLitWall, 'right-lit-room');
      expect(rightLitAnalysis.lightVector.shadowOffsetX).toBeLessThan(0);
      expect(rightLitAnalysis.lightVector.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(rightLitAnalysis.lightVector.azimuthDeg).toBeLessThanOrEqual(180);
    });

    it('resolves analyzeRoomDataUrl for both valid SVG data URLs and empty fallback strings', async () => {
      const presetRooms = generateInitialPresetRooms();
      const fromSvgUrl = await analyzeRoomDataUrl(
        presetRooms[2].imageDataUrl,
        'terracotta-sunlit-loft'
      );
      assertValidWallAnalysis(fromSvgUrl, 'terracotta-sunlit-loft');
      expect(fromSvgUrl.temperatureCategory).toBe('warm');

      const fromEmpty = await analyzeRoomDataUrl('', 'minimalist-concrete-bedroom');
      assertValidWallAnalysis(fromEmpty, 'minimalist-concrete-bedroom');
      expect(fromEmpty.temperatureCategory).toBe('cool');
    });
  });

  describe('4. Desktop & Mobile Room Upload (createRoomAssetFromUpload)', () => {
    it('accepts horizontal desktop photos, vertical 390x844 mobile portrait photos, and .heic/.webp files', async () => {
      const desktopSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#EAE4D8"/></svg>`;
      const desktopFile = new File([desktopSvg], 'my-scandi-salon.svg', {
        type: 'image/svg+xml',
      });
      const desktopAsset = await createRoomAssetFromUpload(desktopFile);
      expect(desktopAsset.isCustomUpload).toBe(true);
      expect(desktopAsset.id.startsWith('custom-room-')).toBe(true);
      expect(desktopAsset.name).toBe('my scandi salon');
      expect(desktopAsset.imageDataUrl.startsWith('data:image/')).toBe(true);
      assertValidWallAnalysis(desktopAsset.analysis, desktopAsset.id);

      // Mobile vertical portrait photo (390x844)
      const mobilePortraitSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="390" height="844" fill="#D9B8A3"/><rect y="600" width="390" height="244" fill="#7A4E32"/></svg>`;
      const mobileFile = new File([mobilePortraitSvg], 'iphone_portrait_wall_390x844.png', {
        type: 'image/png',
      });
      const mobileAsset = await createRoomAssetFromUpload(mobileFile);
      expect(mobileAsset.isCustomUpload).toBe(true);
      expect(mobileAsset.id.startsWith('custom-room-')).toBe(true);
      expect(mobileAsset.wallWidthInches).toBe(120);
      assertValidWallAnalysis(mobileAsset.analysis, mobileAsset.id);

      // iOS HEIC camera upload with empty MIME type (extension-based recognition)
      const heicBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
      const heicFile = new File([heicBytes], 'IMG_4821_terracotta_loft.HEIC', {
        type: '',
      });
      const heicAsset = await createRoomAssetFromUpload(heicFile);
      expect(heicAsset.isCustomUpload).toBe(true);
      expect(heicAsset.name).toContain('IMG 4821 terracotta loft');
      assertValidWallAnalysis(heicAsset.analysis, heicAsset.id);
    });

    it('rejects empty (0-byte) files, corrupted files, and unsupported non-image files with descriptive errors', async () => {
      const emptyFile = new File([], 'empty-room.jpg', { type: 'image/jpeg' });
      await expect(createRoomAssetFromUpload(emptyFile)).rejects.toThrow(/empty/i);

      const pdfFile = new File(['%PDF-1.5 fake document'], 'floorplan.pdf', {
        type: 'application/pdf',
      });
      await expect(createRoomAssetFromUpload(pdfFile)).rejects.toThrow(/unsupported/i);

      const txtFile = new File(['just plain text'], 'notes.txt', {
        type: 'text/plain',
      });
      await expect(createRoomAssetFromUpload(txtFile)).rejects.toThrow(/unsupported/i);

      const corruptFile = new File(['corrupt_data_payload'], 'corrupt-image.jpg', {
        type: 'image/jpeg',
      });
      await expect(createRoomAssetFromUpload(corruptFile)).rejects.toThrow(/corrupt/i);
    });
  });

  describe('5. Mobile-First CameraCaptureModal Ergonomics ([SPEC PATCH #19] & [SPEC PATCH #22])', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
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

    it('renders nothing when isOpen={false} and renders mobile-first bottom sheet when isOpen={true}', async () => {
      const onClose = vi.fn();
      const onCaptureRoom = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(CameraCaptureModal, {
            isOpen: false,
            onClose,
            onCaptureRoom,
          })
        );
      });
      expect(container.querySelector('[data-testid="camera-capture-modal"]')).toBeNull();

      await act(async () => {
        root.render(
          React.createElement(CameraCaptureModal, {
            isOpen: true,
            onClose,
            onCaptureRoom,
          })
        );
      });

      const modalBackdrop = container.querySelector(
        '[data-testid="camera-capture-modal"]'
      ) as HTMLElement | null;
      const modalSheet = container.querySelector(
        '[data-testid="camera-modal-sheet"]'
      ) as HTMLElement | null;

      expect(modalBackdrop).not.toBeNull();
      expect(modalSheet).not.toBeNull();

      // Verify [SPEC PATCH #19] mobile bottom-sheet anchoring classes
      expect(modalBackdrop?.className).toContain('items-end');
      expect(modalSheet?.className).toContain('rounded-t-[12px]');
      expect(modalSheet?.className).toContain('max-h-[92dvh]');
      expect(modalSheet?.className).toContain('flex-col');
    });

    it('enforces >= 44x44px touch targets on all buttons and 16px (text-base) on room name input to prevent iOS auto-zoom', async () => {
      await act(async () => {
        root.render(
          React.createElement(CameraCaptureModal, {
            isOpen: true,
            onClose: vi.fn(),
            onCaptureRoom: vi.fn(),
          })
        );
      });

      const buttons = Array.from(container.querySelectorAll('button'));
      expect(buttons.length).toBeGreaterThanOrEqual(9);
      for (const btn of buttons) {
        expect(btn.className).toContain('min-h-[44px]');
        expect(btn.className).toContain('min-w-[44px]');
      }

      const nameInput = container.querySelector(
        '#camera-room-name-input'
      ) as HTMLInputElement | null;
      expect(nameInput).not.toBeNull();
      expect(nameInput?.className).toContain('text-base');
      expect(nameInput?.className).toContain('min-h-[44px]');

      const nativeFileInput = container.querySelector(
        '[data-testid="camera-native-file-input"]'
      ) as HTMLInputElement | null;
      expect(nativeFileInput).not.toBeNull();
      expect(nativeFileInput?.getAttribute('capture')).toBe('environment');
    });

    it('supports template switching, lighting toggles, pointer drag-to-pan on viewfinder canvas, and shutter capture', async () => {
      const onClose = vi.fn();
      const onCaptureRoom = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(CameraCaptureModal, {
            isOpen: true,
            onClose,
            onCaptureRoom,
          })
        );
      });

      // Switch to Terracotta Sunlit Loft template
      const terracottaBtn = container.querySelector(
        '[data-testid="viewfinder-template-terracotta-sunlit-loft"]'
      ) as HTMLButtonElement;
      expect(terracottaBtn).not.toBeNull();

      await act(async () => {
        terracottaBtn.click();
      });

      // Switch lighting shift to Warm Evening
      const warmEveningBtn = container.querySelector(
        '[data-testid="camera-lighting-warm-evening"]'
      ) as HTMLButtonElement;
      await act(async () => {
        warmEveningBtn.click();
      });

      // Adjust camera pan sliders (camera-pan-x-slider and camera-pan-y-slider)
      const panXSlider = container.querySelector(
        '[data-testid="camera-pan-x-slider"]'
      ) as HTMLInputElement;
      const panYSlider = container.querySelector(
        '[data-testid="camera-pan-y-slider"]'
      ) as HTMLInputElement;
      expect(panXSlider).not.toBeNull();
      expect(panYSlider).not.toBeNull();

      await act(async () => {
        const nativeValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        nativeValueSetter?.call(panXSlider, '0.12');
        panXSlider.dispatchEvent(new Event('change', { bubbles: true }));
        nativeValueSetter?.call(panYSlider, '-0.08');
        panYSlider.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Perform pointer drag-to-pan on viewfinder canvas
      const viewfinderCanvas = container.querySelector(
        '[data-testid="camera-viewfinder-canvas"]'
      ) as HTMLCanvasElement;
      expect(viewfinderCanvas).not.toBeNull();

      const createPointerEvt = (
        type: string,
        coords: { clientX: number; clientY: number; pointerId: number }
      ) => {
        const evt = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: coords.clientX,
          clientY: coords.clientY,
        });
        Object.defineProperty(evt, 'pointerId', { value: coords.pointerId });
        return evt;
      };

      await act(async () => {
        viewfinderCanvas.dispatchEvent(
          createPointerEvt('pointerdown', { clientX: 200, clientY: 200, pointerId: 1 })
        );
        viewfinderCanvas.dispatchEvent(
          createPointerEvt('pointermove', { clientX: 320, clientY: 160, pointerId: 1 })
        );
        viewfinderCanvas.dispatchEvent(
          createPointerEvt('pointerup', { clientX: 320, clientY: 160, pointerId: 1 })
        );
      });

      // Click shutter capture button
      const shutterBtn = container.querySelector(
        '[data-testid="camera-shutter-capture-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        shutterBtn.click();
      });

      expect(onCaptureRoom).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      const capturedAsset: RoomAsset = onCaptureRoom.mock.calls[0][0];
      expect(capturedAsset.isCustomUpload).toBe(true);
      expect(capturedAsset.id.startsWith('custom-room-')).toBe(true);
      expect(capturedAsset.name).toContain('Sunlit Terracotta Loft');
      assertValidWallAnalysis(capturedAsset.analysis, capturedAsset.id);
    });

    it('toggles Front/Rear camera facing mode and stops hardware MediaStream tracks on close', async () => {
      const stopSpy = vi.fn();
      const fakeTrack = { stop: stopSpy } as unknown as MediaStreamTrack;
      const fakeStream = {
        getTracks: () => [fakeTrack],
        getVideoTracks: () => [fakeTrack],
      } as unknown as MediaStream;

      const getUserMediaMock = vi.fn().mockResolvedValue(fakeStream);
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: getUserMediaMock },
        configurable: true,
        writable: true,
      });

      const onClose = vi.fn();
      const onCaptureRoom = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(CameraCaptureModal, {
            isOpen: true,
            onClose,
            onCaptureRoom,
          })
        );
      });

      expect(getUserMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: { ideal: 'environment' },
          }),
        })
      );

      const flipBtn = container.querySelector(
        '[data-testid="camera-flip-facing-btn"]'
      ) as HTMLButtonElement;
      expect(flipBtn.getAttribute('data-facing-mode')).toBe('environment');

      // Flip from Rear ('environment') to Front ('user')
      await act(async () => {
        flipBtn.click();
      });

      expect(flipBtn.getAttribute('data-facing-mode')).toBe('user');
      expect(getUserMediaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: { ideal: 'user' },
          }),
        })
      );

      // Closing modal must stop active hardware stream tracks
      const closeBtn = container.querySelector(
        '[data-testid="camera-modal-close-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        closeBtn.click();
      });

      expect(stopSpy).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('creates a custom RoomAsset via createCapturedRoomAssetFromViewfinder directly', () => {
      const asset = createCapturedRoomAssetFromViewfinder({
        basePresetId: 'minimalist-concrete-bedroom',
        customName: 'North Gallery Concrete Loft',
        panX: -0.12,
        panY: 0.08,
        lightingShift: 'morning',
      });

      expect(asset.isCustomUpload).toBe(true);
      expect(asset.id.startsWith('custom-room-')).toBe(true);
      expect(asset.name).toBe('North Gallery Concrete Loft');
      assertValidWallAnalysis(asset.analysis, asset.id);

      const seedPixels = createDeterministicImageDataFromSeed('minimalist-concrete-bedroom', 64, 64);
      expect(seedPixels.width).toBe(64);
      expect(seedPixels.height).toBe(64);
      const synthPixels = synthesizePresetRoomImageData('terracotta-sunlit-loft', 64, 64);
      expect(synthPixels.width).toBe(64);
      expect(synthPixels.height).toBe(64);
    });

    it('processes native OS camera / photo roll file selection via camera-native-file-input', async () => {
      const onClose = vi.fn();
      const onCaptureRoom = vi.fn();

      await act(async () => {
        root.render(
          React.createElement(CameraCaptureModal, {
            isOpen: true,
            onClose,
            onCaptureRoom,
          })
        );
      });

      const fileInput = container.querySelector(
        '[data-testid="camera-native-file-input"]'
      ) as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      expect(fileInput.getAttribute('capture')).toBe('environment');

      const svgPayload = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#D9B8A3"/></svg>`;
      const uploadedFile = new File([svgPayload], 'mobile_camera_wall.svg', {
        type: 'image/svg+xml',
      });

      Object.defineProperty(fileInput, 'files', {
        value: [uploadedFile],
        configurable: true,
      });

      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await vi.waitFor(() => {
        expect(onCaptureRoom).toHaveBeenCalledTimes(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      const uploadedAsset: RoomAsset = onCaptureRoom.mock.calls[0][0];
      expect(uploadedAsset.isCustomUpload).toBe(true);
      expect(uploadedAsset.name).toBe('mobile camera wall');
      assertValidWallAnalysis(uploadedAsset.analysis, uploadedAsset.id);
    });
  });
});

