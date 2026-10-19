// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FRAME_PROFILES,
  FrameProfileId,
  MatColorId,
  MatWidthId,
  OrientationMode,
  PaintingSpec,
  PanelLayoutMode,
  PRINT_SIZES,
  PrintSizeId,
  RoomAsset,
  WallPlacementState,
} from '../../../contracts/masterContract';
import {
  computePhysicalFrameDimensions,
  computeShadowVectors,
  InRoomWallCanvas,
  parseMatWidthInches,
  QuickScrollFilmstrip,
  renderFramedArtworkToCanvas,
  sanitizeWallPlacement,
} from '../index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedRootEntry {
  root: Root;
  container: HTMLDivElement;
}

const activeRoots: MountedRootEntry[] = [];

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  activeRoots.push({ root, container });

  act(() => {
    root.render(ui);
  });

  return {
    container,
    rerender(nextUi: React.ReactElement) {
      act(() => {
        root.render(nextUi);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
    },
  };
}

afterEach(() => {
  while (activeRoots.length > 0) {
    const entry = activeRoots.pop();
    if (entry) {
      act(() => {
        entry.root.unmount();
      });
      entry.container.remove();
    }
  }
  document.body.innerHTML = '';
});

const screen = {
  getByTestId(testId: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (!el) {
      throw new Error(`Unable to find element with data-testid="${testId}"`);
    }
    return el;
  },
  queryByTestId(testId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  },
  getByRole(role: string, options?: { name?: RegExp | string }): HTMLElement {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(`[role="${role}"]`)
    );
    for (const el of candidates) {
      if (!options?.name) return el;
      const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
      if (
        options.name instanceof RegExp
          ? options.name.test(label)
          : label.includes(options.name)
      ) {
        return el;
      }
    }
    throw new Error(`Unable to find element with role="${role}"`);
  },
};

function dispatchPointerEvent(
  target: Element | Window,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: { pointerId?: number; clientX?: number; clientY?: number } = {}
) {
  act(() => {
    const evt = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: init.clientX ?? 0,
      clientY: init.clientY ?? 0,
    });
    Object.defineProperty(evt, 'pointerId', {
      value: init.pointerId ?? 1,
      configurable: true,
    });
    target.dispatchEvent(evt);
  });
}

function dispatchTouchEvent(
  target: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  init: {
    touches?: Array<{ clientX: number; clientY: number }>;
    changedTouches?: Array<{ clientX: number; clientY: number }>;
  }
) {
  act(() => {
    const evt = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(evt, 'touches', {
      value: init.touches ?? [],
      configurable: true,
    });
    Object.defineProperty(evt, 'changedTouches', {
      value: init.changedTouches ?? init.touches ?? [],
      configurable: true,
    });
    target.dispatchEvent(evt);
  });
}

const fireEvent = {
  click(element: Element) {
    act(() => {
      element.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
  },
  change(element: Element, init: { target: { value: string } }) {
    act(() => {
      if (element instanceof HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        if (setter) {
          setter.call(element, init.target.value);
        } else {
          element.value = init.target.value;
        }
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  },
  pointerDown(
    target: Element | Window,
    init?: { pointerId?: number; clientX?: number; clientY?: number }
  ) {
    dispatchPointerEvent(target, 'pointerdown', init);
  },
  pointerMove(
    target: Element | Window,
    init?: { pointerId?: number; clientX?: number; clientY?: number }
  ) {
    dispatchPointerEvent(target, 'pointermove', init);
  },
  pointerUp(
    target: Element | Window,
    init?: { pointerId?: number; clientX?: number; clientY?: number }
  ) {
    dispatchPointerEvent(target, 'pointerup', init);
  },
  touchStart(
    target: Element,
    init: {
      touches: Array<{ clientX: number; clientY: number }>;
      changedTouches?: Array<{ clientX: number; clientY: number }>;
    }
  ) {
    dispatchTouchEvent(target, 'touchstart', init);
  },
  touchMove(
    target: Element,
    init: {
      touches: Array<{ clientX: number; clientY: number }>;
      changedTouches?: Array<{ clientX: number; clientY: number }>;
    }
  ) {
    dispatchTouchEvent(target, 'touchmove', init);
  },
  touchEnd(
    target: Element,
    init: {
      touches: Array<{ clientX: number; clientY: number }>;
      changedTouches?: Array<{ clientX: number; clientY: number }>;
    }
  ) {
    dispatchTouchEvent(target, 'touchend', init);
  },
  wheel(
    target: Element,
    init: { deltaX?: number; deltaY?: number; shiftKey?: boolean }
  ) {
    act(() => {
      const evt = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: init.deltaX ?? 0,
        deltaY: init.deltaY ?? 0,
        shiftKey: init.shiftKey ?? false,
      });
      target.dispatchEvent(evt);
    });
  },
};

function createMockPainting(overrides: Partial<PaintingSpec> = {}): PaintingSpec {
  return {
    id: 'painting-01',
    roomId: 'nordic-linen-living',
    catalogNumber: 'No. 01',
    title: 'Terracotta & Raw Umber Study',
    subtitle: 'Harmonized to 3,400K warm oak undertones',
    styleId: 'impasto-oil',
    harmonyMode: 'warm-gallery-contrast',
    seed: 4201,
    pigments: [
      {
        hex: '#E6DFD3',
        rgb: [230, 223, 211],
        pigmentName: 'Warm Linen',
        opacity: 0.95,
        viscosity: 0.6,
      },
      {
        hex: '#B85D3B',
        rgb: [184, 93, 59],
        pigmentName: 'Burnt Sienna',
        opacity: 0.9,
        viscosity: 0.85,
      },
      {
        hex: '#2E4A3E',
        rgb: [46, 74, 62],
        pigmentName: 'Deep Viridian',
        opacity: 0.85,
        viscosity: 0.75,
      },
      {
        hex: '#C8A97E',
        rgb: [200, 169, 126],
        pigmentName: 'Yellow Ochre',
        opacity: 0.8,
        viscosity: 0.65,
      },
      {
        hex: '#4A3525',
        rgb: [74, 53, 37],
        pigmentName: 'Raw Umber',
        opacity: 0.88,
        viscosity: 0.8,
      },
      {
        hex: '#F4F1EA',
        rgb: [244, 241, 234],
        pigmentName: 'Titanium Buff',
        opacity: 0.92,
        viscosity: 0.5,
      },
    ],
    lightAzimuthDeg: 315,
    lightElevationDeg: 42,
    aspectRatio: 0.75,
    recommendedSizeId: '24x36',
    recommendedFrameId: 'natural-white-oak',
    curatorialRationale: 'Balances warm oak floors with mineral plaster walls.',
    ...overrides,
  };
}

function createMockRoom(overrides: Partial<RoomAsset> = {}): RoomAsset {
  return {
    id: 'nordic-linen-living',
    name: 'Nordic Linen Living Room',
    architecturalStyle: 'Scandinavian Minimalist',
    wallWidthInches: 120,
    eyeLevelRatioY: 0.46,
    isCustomUpload: false,
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    createdAt: 1700000000000,
    analysis: {
      roomId: 'nordic-linen-living',
      dominantSwatches: [
        {
          hex: '#EAE4D8',
          rgb: [234, 228, 216],
          hsl: [40, 29, 88],
          luminance: 0.82,
          populationRatio: 0.44,
          role: 'wall-dominant',
          label: 'Warm Chalk Plaster',
        },
        {
          hex: '#C8A97E',
          rgb: [200, 169, 126],
          hsl: [35, 40, 64],
          luminance: 0.54,
          populationRatio: 0.22,
          role: 'warm-undertone',
          label: 'White Oak Parquet',
        },
        {
          hex: '#8C7A6B',
          rgb: [140, 122, 107],
          hsl: [27, 14, 48],
          luminance: 0.36,
          populationRatio: 0.14,
          role: 'secondary-architecture',
          label: 'Linen Sofa',
        },
        {
          hex: '#B85D3B',
          rgb: [184, 93, 59],
          hsl: [16, 51, 48],
          luminance: 0.32,
          populationRatio: 0.08,
          role: 'accent',
          label: 'Terracotta Vessel',
        },
        {
          hex: '#5D6B64',
          rgb: [93, 107, 100],
          hsl: [150, 7, 39],
          luminance: 0.28,
          populationRatio: 0.07,
          role: 'cool-undertone',
          label: 'Sage Foliage',
        },
        {
          hex: '#2C2825',
          rgb: [44, 40, 37],
          hsl: [26, 9, 16],
          luminance: 0.08,
          populationRatio: 0.05,
          role: 'secondary-architecture',
          label: 'Forged Iron Sconce',
        },
      ],
      estimatedKelvin: 3400,
      temperatureCategory: 'warm',
      averageLuminance: 0.72,
      lightVector: {
        azimuthDeg: 315,
        elevationDeg: 42,
        shadowOffsetX: 0.28,
        shadowOffsetY: 0.35,
        shadowSoftness: 0.55,
      },
      detectedWallZone: {
        centerX: 0.5,
        centerY: 0.44,
        widthRatio: 0.58,
        heightRatio: 0.48,
        confidence: 0.94,
        edgeEnergyScore: 0.12,
      },
      recommendedHarmony: 'warm-gallery-contrast',
      curatorialSummary: 'Soft northern clerestory daylight with warm white oak reflections.',
    },
    ...overrides,
  };
}

function createDefaultPlacement(
  overrides: Partial<WallPlacementState> = {}
): WallPlacementState {
  return {
    centerX: 0.5,
    centerY: 0.44,
    wallWidthInches: 120,
    perspectiveQuad: {
      topLeft: { x: 0.35, y: 0.25 },
      topRight: { x: 0.65, y: 0.25 },
      bottomRight: { x: 0.65, y: 0.65 },
      bottomLeft: { x: 0.35, y: 0.65 },
    },
    usePerspectiveWarp: false,
    interPanelGapInches: 2.0,
    ...overrides,
  };
}

function attachMockCanvas2D(canvas: HTMLCanvasElement) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];

  const mockCtx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
    fillRect: vi.fn(function (this: { fillStyle: string }, ...args: unknown[]) {
      fillStyles.push(String(this.fillStyle));
      calls.push({ method: 'fillRect', args });
    }),
    strokeRect: vi.fn(function (this: { strokeStyle: string }, ...args: unknown[]) {
      strokeStyles.push(String(this.strokeStyle));
      calls.push({ method: 'strokeRect', args });
    }),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    moveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'moveTo', args })),
    lineTo: vi.fn((...args: unknown[]) => calls.push({ method: 'lineTo', args })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    fill: vi.fn(function (this: { fillStyle: string }) {
      fillStyles.push(String(this.fillStyle));
      calls.push({ method: 'fill', args: [] });
    }),
    stroke: vi.fn(function (this: { strokeStyle: string }) {
      strokeStyles.push(String(this.strokeStyle));
      calls.push({ method: 'stroke', args: [] });
    }),
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    drawImage: vi.fn((...args: unknown[]) => calls.push({ method: 'drawImage', args })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  };

  vi.spyOn(canvas, 'getContext').mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D
  );

  return { mockCtx, calls, fillStyles, strokeStyles };
}

describe('Subsystem 3 (wall-compositor) — Integration & Verification Suite', () => {
  describe('Leaf 3A: framingAndMattingRenderer.ts', () => {
    it('parseMatWidthInches returns 0, 1.5, 2.5, 3.5 for standard frames and suppresses mat (0) on unframed-canvas or brushed-brass-float', () => {
      const whiteOak = FRAME_PROFILES['natural-white-oak'];
      const unframed = FRAME_PROFILES['unframed-canvas'];
      const brassFloat = FRAME_PROFILES['brushed-brass-float'];

      expect(parseMatWidthInches('none', whiteOak)).toBe(0);
      expect(parseMatWidthInches('1.5in', whiteOak)).toBe(1.5);
      expect(parseMatWidthInches('2.5in', whiteOak)).toBe(2.5);
      expect(parseMatWidthInches('3.5in', whiteOak)).toBe(3.5);

      // Without frameSpec provided
      expect(parseMatWidthInches('2.5in')).toBe(2.5);

      // Suppressed on unframed gallery wrap and float frame
      expect(parseMatWidthInches('2.5in', unframed)).toBe(0);
      expect(parseMatWidthInches('3.5in', brassFloat)).toBe(0);
    });

    it('sanitizeWallPlacement clamps out-of-range/NaN/Infinity values and enforces non-inverting perspectiveQuad (minSpan >= 0.08)', () => {
      const sanitizedDefaults = sanitizeWallPlacement(null);
      expect(sanitizedDefaults.centerX).toBe(0.5);
      expect(sanitizedDefaults.centerY).toBe(0.46);
      expect(sanitizedDefaults.wallWidthInches).toBe(120);
      expect(sanitizedDefaults.interPanelGapInches).toBe(2.0);

      const adversarial = sanitizeWallPlacement({
        centerX: -5,
        centerY: Number.POSITIVE_INFINITY,
        wallWidthInches: Number.NaN,
        interPanelGapInches: 99,
        usePerspectiveWarp: true,
        perspectiveQuad: {
          topLeft: { x: 0.85, y: 0.85 },
          topRight: { x: 0.2, y: 0.85 },
          bottomRight: { x: 0.2, y: 0.2 },
          bottomLeft: { x: 0.85, y: 0.2 },
        },
      });

      expect(adversarial.centerX).toBe(0.12);
      expect(adversarial.centerY).toBe(0.46);
      expect(adversarial.wallWidthInches).toBe(120);
      expect(adversarial.interPanelGapInches).toBe(6.0);
      expect(adversarial.usePerspectiveWarp).toBe(true);

      const q = adversarial.perspectiveQuad;
      expect(q.topRight.x - q.topLeft.x).toBeGreaterThanOrEqual(0.08 - 1e-6);
      expect(q.bottomRight.x - q.bottomLeft.x).toBeGreaterThanOrEqual(0.08 - 1e-6);
      expect(q.bottomLeft.y - q.topLeft.y).toBeGreaterThanOrEqual(0.08 - 1e-6);
      expect(q.bottomRight.y - q.topRight.y).toBeGreaterThanOrEqual(0.08 - 1e-6);
    });

    it('computePhysicalFrameDimensions enforces exact physical scaling (36x48 is 3x 12x16), orientation switching, and single/diptych/triptych splits', () => {
      const small = computePhysicalFrameDimensions({
        sizeSpec: PRINT_SIZES['12x16'],
        orientation: 'portrait',
        panelLayout: 'single',
        frameSpec: FRAME_PROFILES['unframed-canvas'],
        matWidthId: 'none',
        wallWidthInches: 120,
      });

      const collector = computePhysicalFrameDimensions({
        sizeSpec: PRINT_SIZES['36x48'],
        orientation: 'portrait',
        panelLayout: 'single',
        frameSpec: FRAME_PROFILES['unframed-canvas'],
        matWidthId: 'none',
        wallWidthInches: 120,
      });

      expect(collector.artworkWidthInches).toBe(small.artworkWidthInches * 3);
      expect(collector.artworkHeightInches).toBe(small.artworkHeightInches * 3);
      expect(collector.outerWallWidthRatio).toBeCloseTo(small.outerWallWidthRatio * 3, 4);

      // Landscape flips width > height; Square averages width & height
      const landscape = computePhysicalFrameDimensions({
        sizeSpec: PRINT_SIZES['24x36'],
        orientation: 'landscape',
        panelLayout: 'single',
        frameSpec: FRAME_PROFILES['natural-white-oak'],
        matWidthId: '2.5in',
        wallWidthInches: 120,
      });
      expect(landscape.artworkWidthInches).toBe(36);
      expect(landscape.artworkHeightInches).toBe(24);
      expect(landscape.effectiveMatWidthInches).toBe(2.5);
      expect(landscape.mouldingWidthInches).toBe(1.25);
      // Outer width = 36 + 2 * (1.25 + 2.5) = 43.5"
      expect(landscape.totalOuterWidthInches).toBeCloseTo(43.5, 4);

      const square = computePhysicalFrameDimensions({
        sizeSpec: PRINT_SIZES['24x36'],
        orientation: 'square',
        panelLayout: 'single',
        frameSpec: FRAME_PROFILES['natural-white-oak'],
        matWidthId: 'none',
        wallWidthInches: 120,
      });
      expect(square.artworkWidthInches).toBe(30);
      expect(square.artworkHeightInches).toBe(30);

      // Diptych (2 panels) and Triptych (3 panels) include inter-panel gaps and per-panel borders
      const diptych = computePhysicalFrameDimensions({
        sizeSpec: PRINT_SIZES['24x36'],
        orientation: 'landscape',
        panelLayout: 'diptych',
        frameSpec: FRAME_PROFILES['natural-white-oak'],
        matWidthId: '1.5in',
        wallWidthInches: 120,
        interPanelGapInches: 2.0,
      });
      expect(diptych.panelCount).toBe(2);
      expect(diptych.panelArtworkWidthInches).toBeCloseTo(18, 4);
      expect(diptych.interPanelGapInches).toBe(2.0);
      expect(diptych.totalOuterWidthInches).toBeCloseTo(
        2 * diptych.singlePanelOuterWidthInches + 2.0,
        4
      );

      const triptych = computePhysicalFrameDimensions({
        sizeSpec: PRINT_SIZES['24x36'],
        orientation: 'landscape',
        panelLayout: 'triptych',
        frameSpec: FRAME_PROFILES['brushed-brass-float'],
        matWidthId: '2.5in', // suppressed on float frame
        wallWidthInches: 120,
        interPanelGapInches: 2.5,
      });
      expect(triptych.panelCount).toBe(3);
      expect(triptych.effectiveMatWidthInches).toBe(0);
      expect(triptych.floatGapInches).toBe(0.35);
      expect(triptych.panelArtworkWidthInches).toBeCloseTo(12, 4);
      expect(triptych.totalOuterWidthInches).toBeCloseTo(
        3 * triptych.singlePanelOuterWidthInches + 2 * 2.5,
        4
      );
    });

    it('computeShadowVectors produces 3-layer shadows and inverts horizontal cast direction for left (315°) vs right (135°) light azimuth', () => {
      const leftLight = computeShadowVectors({
        lightVector: {
          azimuthDeg: 315,
          elevationDeg: 45,
          shadowOffsetX: 0.3,
          shadowOffsetY: 0.35,
          shadowSoftness: 0.5,
        },
        ambientMode: 'daylight',
        frameDepthInches: 1.5,
      });

      const rightLight = computeShadowVectors({
        lightVector: {
          azimuthDeg: 135,
          elevationDeg: 45,
          shadowOffsetX: -0.3,
          shadowOffsetY: 0.35,
          shadowSoftness: 0.5,
        },
        ambientMode: 'daylight',
        frameDepthInches: 1.5,
      });

      expect(leftLight.directionalCast.offsetX).toBeGreaterThan(0);
      expect(rightLight.directionalCast.offsetX).toBeLessThan(0);
      expect(leftLight.contactOcclusion.offsetX).toBeGreaterThan(0);
      expect(rightLight.contactOcclusion.offsetX).toBeLessThan(0);
      expect(leftLight.ambientPenumbra.blur).toBeGreaterThan(
        leftLight.directionalCast.blur
      );
      expect(leftLight.directionalCast.blur).toBeGreaterThan(
        leftLight.contactOcclusion.blur
      );

      // Deep frame casts further shadow than shallow frame
      const deepFrameShadow = computeShadowVectors({
        lightVector: {
          azimuthDeg: 315,
          elevationDeg: 45,
          shadowOffsetX: 0.3,
          shadowOffsetY: 0.35,
          shadowSoftness: 0.5,
        },
        ambientMode: 'golden-hour',
        frameDepthInches: 2.5,
      });
      expect(deepFrameShadow.directionalCast.offsetX).toBeGreaterThan(
        leftLight.directionalCast.offsetX
      );

      const eveningShadow = computeShadowVectors({
        lightVector: {
          azimuthDeg: 315,
          elevationDeg: 45,
          shadowOffsetX: 0.3,
          shadowOffsetY: 0.35,
          shadowSoftness: 0.5,
        },
        ambientMode: 'evening-sconce',
        frameDepthInches: 1.75,
      });
      expect(eveningShadow.contactOcclusion.opacity).toBeGreaterThan(
        leftLight.contactOcclusion.opacity
      );
    });

    it('renderFramedArtworkToCanvas renders all 6 frame profiles, all 4 mat widths, all 3 mat colors, multi-panel splits, 45° cream-core bevel (#FBF9F4), and 4% museum glazing', () => {
      const painting = createMockPainting();
      const room = createMockRoom();
      const canvas = document.createElement('canvas');
      const { fillStyles } = attachMockCanvas2D(canvas);

      const frameIds: FrameProfileId[] = [
        'unframed-canvas',
        'natural-white-oak',
        'american-black-walnut',
        'matte-gallery-black',
        'brushed-brass-float',
        'warm-travertine-ash',
      ];
      const matWidths: MatWidthId[] = ['none', '1.5in', '2.5in', '3.5in'];
      const matColors: MatColorId[] = [
        'archival-ivory',
        'warm-museum-linen',
        'charcoal-conservation',
      ];

      for (const frameId of frameIds) {
        renderFramedArtworkToCanvas(canvas, {
          painting,
          sizeSpec: PRINT_SIZES['24x36'],
          orientation: 'portrait',
          panelLayout: 'single',
          frameSpec: FRAME_PROFILES[frameId],
          matWidthId: '2.5in',
          matColorId: 'archival-ivory',
          lightVector: room.analysis.lightVector,
          ambientMode: 'daylight',
          estimatedKelvin: 3400,
        });

        expect(canvas.getAttribute('data-rendered-frame')).toBe(frameId);
        expect(canvas.getAttribute('data-glass-glaze')).toBe('true');
        expect(canvas.getAttribute('data-bevel-core')).toBe('#FBF9F4');

        if (frameId === 'unframed-canvas' || frameId === 'brushed-brass-float') {
          expect(canvas.getAttribute('data-rendered-mat')).toBe('none');
        } else {
          expect(canvas.getAttribute('data-rendered-mat')).toBe('2.5in');
          expect(canvas.getAttribute('data-mitered-corners')).toBe('true');
        }
      }

      for (const matWidthId of matWidths) {
        for (const matColorId of matColors) {
          renderFramedArtworkToCanvas(canvas, {
            painting,
            sizeSpec: PRINT_SIZES['18x24'],
            orientation: 'landscape',
            panelLayout: 'diptych',
            frameSpec: FRAME_PROFILES['american-black-walnut'],
            matWidthId,
            matColorId,
            lightVector: room.analysis.lightVector,
            ambientMode: 'golden-hour',
            estimatedKelvin: 3100,
          });
          expect(canvas.getAttribute('data-rendered-mat')).toBe(matWidthId);
          expect(canvas.getAttribute('data-rendered-mat-color')).toBe(matColorId);
          expect(canvas.getAttribute('data-rendered-panels')).toBe('2');
        }
      }

      // Verify cream-core bevel (#FBF9F4) and mat surface colors were drawn to canvas context
      expect(
        fillStyles.some((style) => style.toUpperCase() === '#FBF9F4')
      ).toBe(true);
      expect(
        fillStyles.some((style) => style.toUpperCase() === '#F7F4EC')
      ).toBe(true);
      expect(
        fillStyles.some((style) => style.toUpperCase() === '#252422')
      ).toBe(true);
    });
  });

  describe('Leaf 3B: InRoomWallCanvas.tsx — Desktop & Mobile Touch Gesture Parity', () => {
    let defaultProps: React.ComponentProps<typeof InRoomWallCanvas>;

    beforeEach(() => {
      defaultProps = {
        room: createMockRoom(),
        painting: createMockPainting(),
        sizeId: '24x36',
        orientation: 'portrait',
        panelLayout: 'single',
        frameId: 'natural-white-oak',
        matWidthId: '2.5in',
        matColorId: 'archival-ivory',
        ambientMode: 'daylight',
        placement: createDefaultPlacement(),
        showGuides: false,
        beforeAfterSplit: null,
        onUpdatePlacement: vi.fn(),
        onToggleGuides: vi.fn(),
        onChangeAmbientMode: vi.fn(),
        onChangeBeforeAfter: vi.fn(),
        onCyclePainting: vi.fn(),
        onCycleSize: vi.fn(),
        onCycleFrame: vi.fn(),
        onPinLookbook: vi.fn(),
      };
    });

    it('renders gallery-clean default stage when showGuides=false and reveals 57" eye-level centerline, dimension callouts, and 44x44px corner handles when showGuides=true', () => {
      const { rerender } = render(
        React.createElement(InRoomWallCanvas, { ...defaultProps, showGuides: false })
      );

      expect(screen.queryByTestId('contextual-guides-overlay')).toBeNull();
      expect(screen.queryByTestId('perspective-handle-topLeft')).toBeNull();

      rerender(
        React.createElement(InRoomWallCanvas, { ...defaultProps, showGuides: true })
      );

      expect(screen.getByTestId('contextual-guides-overlay')).toBeTruthy();
      expect(screen.getByTestId('eye-level-guide-line').textContent).toContain(
        '57″ Museum Eye-Level Centerline'
      );
      expect(screen.getByTestId('dimension-callout-horizontal').textContent).toContain(
        '24" × 36" Print'
      );
      expect(screen.getByTestId('dimension-callout-vertical')).toBeTruthy();

      const corners = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;
      for (const key of corners) {
        const handle = screen.getByTestId(`perspective-handle-${key}`);
        expect(handle.className).toContain('min-w-[44px]');
        expect(handle.className).toContain('min-h-[44px]');
        expect(handle.className).toContain('touch-none');
      }
    });

    it('enforces Mobile HUD Micro-Restraint ([SPEC PATCH #20]): wall-gallery-placard is hidden on mobile (hidden md:flex) and top HUD pills use compact micro-pills', () => {
      render(React.createElement(InRoomWallCanvas, defaultProps));

      const placard = screen.getByTestId('wall-gallery-placard');
      expect(placard.className).toContain('hidden');
      expect(placard.className).toContain('md:flex');

      const telemetryPill = screen.getByTestId('room-telemetry-pill');
      expect(telemetryPill.className).toContain('min-h-[38px]');
      expect(telemetryPill.className).toContain('min-w-[38px]');

      const toggleGuidesBtn = screen.getByTestId('toggle-guides-btn');
      expect(toggleGuidesBtn.className).toContain('min-h-[38px]');
      expect(toggleGuidesBtn.className).toContain('min-w-[38px]');
    });

    it('supports single-pointer touch/mouse drag to reposition the painting and snaps to the 57" museum eye-level line', () => {
      const onUpdatePlacement = vi.fn();
      render(
        React.createElement(InRoomWallCanvas, {
          ...defaultProps,
          placement: createDefaultPlacement({ centerX: 0.4, centerY: 0.4 }),
          onUpdatePlacement,
        })
      );

      const stage = screen.getByTestId('in-room-wall-stage');
      expect(stage.className).toContain('touch-none');
      expect(stage.style.touchAction).toBe('none');

      const artworkContainer = screen.getByTestId('wall-mounted-artwork-container');
      expect(artworkContainer.className).toContain('touch-none');

      // Drag from centerY=0.40 down by +39px on a 650px-tall stage -> 0.40 + 0.06 = 0.46 (room.eyeLevelRatioY)
      fireEvent.pointerDown(artworkContainer, {
        pointerId: 1,
        clientX: 400,
        clientY: 260,
      });
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 500,
        clientY: 299,
      });
      fireEvent.pointerUp(window, {
        pointerId: 1,
        clientX: 500,
        clientY: 299,
      });

      expect(onUpdatePlacement).toHaveBeenCalled();
      const lastCall =
        onUpdatePlacement.mock.calls[onUpdatePlacement.mock.calls.length - 1][0];
      expect(lastCall.centerY).toBeCloseTo(0.46, 3); // Snapped to 57" eyeLevelRatioY
      expect(lastCall.centerX).toBeCloseTo(0.5, 3); // Snapped to wall center 0.5
    });

    it('supports two-finger pinch-to-scale (both TouchEvents and dual PointerEvents) to step up/down PRINT_SIZES without jumping artwork coordinates', () => {
      const onCycleSize = vi.fn();
      const onUpdatePlacement = vi.fn();
      render(
        React.createElement(InRoomWallCanvas, {
          ...defaultProps,
          onCycleSize,
          onUpdatePlacement,
        })
      );

      const stage = screen.getByTestId('in-room-wall-stage');

      // 1. TouchEvent two-finger spread (+40px >= 28px threshold) -> onCycleSize(1)
      fireEvent.touchStart(stage, {
        touches: [
          { clientX: 150, clientY: 300 },
          { clientX: 200, clientY: 300 }, // initial distance = 50px
        ],
      });
      fireEvent.touchMove(stage, {
        touches: [
          { clientX: 130, clientY: 300 },
          { clientX: 220, clientY: 300 }, // new distance = 90px (+40px spread)
        ],
      });
      expect(onCycleSize).toHaveBeenCalledWith(1);

      // Pinch inward from 90px down to 50px (-40px <= -28px threshold) -> onCycleSize(-1)
      fireEvent.touchMove(stage, {
        touches: [
          { clientX: 150, clientY: 300 },
          { clientX: 200, clientY: 300 },
        ],
      });
      expect(onCycleSize).toHaveBeenCalledWith(-1);
      fireEvent.touchEnd(stage, { touches: [], changedTouches: [] });

      // 2. Dual PointerEvent two-finger spread on stage
      onCycleSize.mockClear();
      fireEvent.pointerDown(stage, { pointerId: 10, clientX: 150, clientY: 300 });
      fireEvent.pointerDown(stage, { pointerId: 11, clientX: 200, clientY: 300 });
      fireEvent.pointerMove(stage, { pointerId: 11, clientX: 235, clientY: 300 }); // dist 50 -> 85 (+35px)
      expect(onCycleSize).toHaveBeenCalledWith(1);

      // Ensure pinch did NOT erroneously trigger single-finger artwork coordinate drag
      expect(onUpdatePlacement).not.toHaveBeenCalled();
    });

    it('supports horizontal touch swipe on stage background to cycle paintings forward and backward', () => {
      const onCyclePainting = vi.fn();
      render(
        React.createElement(InRoomWallCanvas, { ...defaultProps, onCyclePainting })
      );

      const stage = screen.getByTestId('in-room-wall-stage');

      // Swipe left (dx = -70px) -> next painting (+1)
      fireEvent.pointerDown(stage, { pointerId: 21, clientX: 250, clientY: 200 });
      fireEvent.pointerMove(stage, { pointerId: 21, clientX: 180, clientY: 205 });
      fireEvent.pointerUp(stage, { pointerId: 21, clientX: 180, clientY: 205 });
      expect(onCyclePainting).toHaveBeenCalledWith(1);

      // Swipe right (dx = +75px) -> previous painting (-1)
      onCyclePainting.mockClear();
      fireEvent.pointerDown(stage, { pointerId: 22, clientX: 150, clientY: 200 });
      fireEvent.pointerMove(stage, { pointerId: 22, clientX: 225, clientY: 202 });
      fireEvent.pointerUp(stage, { pointerId: 22, clientX: 225, clientY: 202 });
      expect(onCyclePainting).toHaveBeenCalledWith(-1);
    });

    it('supports perspective corner drag, Before/After 44px divider & slider, ambient mode switcher, wall scale calibrator, and Wheel / Shift+Wheel scrubbing', () => {
      const onUpdatePlacement = vi.fn();
      const onChangeAmbientMode = vi.fn();
      const onChangeBeforeAfter = vi.fn();
      const onCyclePainting = vi.fn();
      const onCycleSize = vi.fn();

      render(
        React.createElement(InRoomWallCanvas, {
          ...defaultProps,
          showGuides: true,
          beforeAfterSplit: 50,
          panelLayout: 'diptych',
          onUpdatePlacement,
          onChangeAmbientMode,
          onChangeBeforeAfter,
          onCyclePainting,
          onCycleSize,
        })
      );

      // 1. Drag perspective corner handle
      const topLeftHandle = screen.getByTestId('perspective-handle-topLeft');
      fireEvent.pointerDown(topLeftHandle, { pointerId: 5, clientX: 350, clientY: 160 });
      fireEvent.pointerMove(window, { pointerId: 5, clientX: 380, clientY: 180 });
      fireEvent.pointerUp(window, { pointerId: 5, clientX: 380, clientY: 180 });
      expect(onUpdatePlacement).toHaveBeenCalledWith(
        expect.objectContaining({ usePerspectiveWarp: true })
      );

      // 2. Before/After divider has >= 44px touch target & range slider updates split
      const divider = screen.getByTestId('before-after-divider');
      expect(divider.className).toContain('min-w-[44px]');
      expect(divider.className).toContain('min-h-[44px]');

      const slider = screen.getByTestId('before-after-slider');
      fireEvent.change(slider, { target: { value: '72' } });
      expect(onChangeBeforeAfter).toHaveBeenCalledWith(72);

      // 3. Ambient mode buttons
      fireEvent.click(screen.getByTestId('ambient-mode-golden-hour'));
      expect(onChangeAmbientMode).toHaveBeenCalledWith('golden-hour');
      fireEvent.click(screen.getByTestId('ambient-mode-evening-sconce'));
      expect(onChangeAmbientMode).toHaveBeenCalledWith('evening-sconce');

      // 4. Wall Scale Calibrator popover & inter-panel gap slider
      fireEvent.click(screen.getByTestId('toggle-wall-calibrator-btn'));
      expect(screen.getByTestId('wall-calibrator-popover')).toBeTruthy();

      fireEvent.change(screen.getByTestId('wall-width-slider'), {
        target: { value: '144' },
      });
      expect(onUpdatePlacement).toHaveBeenCalledWith({ wallWidthInches: 144 });

      fireEvent.change(screen.getByTestId('inter-panel-gap-slider'), {
        target: { value: '3' },
      });
      expect(onUpdatePlacement).toHaveBeenCalledWith({ interPanelGapInches: 3 });

      // 5. Wheel & Shift+Wheel scrubbing
      const stage = screen.getByTestId('in-room-wall-stage');
      fireEvent.wheel(stage, { deltaY: 40 });
      expect(onCyclePainting).toHaveBeenCalledWith(1);

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 500);
      fireEvent.wheel(stage, { deltaY: -40, shiftKey: true });
      expect(onCycleSize).toHaveBeenCalledWith(-1);
      vi.restoreAllMocks();
    });
  });

  describe('Leaf 3C: QuickScrollFilmstrip.tsx — 5-Axis Curatorial Dock & Mobile Ergonomics', () => {
    const paintings = [
      createMockPainting({
        id: 'painting-01',
        catalogNumber: 'No. 01',
        title: 'Terracotta & Raw Umber Study',
        styleId: 'impasto-oil',
      }),
      createMockPainting({
        id: 'painting-02',
        catalogNumber: 'No. 02',
        title: 'Nordic Limewash Arch',
        styleId: 'japandi-plaster',
      }),
      createMockPainting({
        id: 'painting-03',
        catalogNumber: 'No. 03',
        title: 'Saffron & Slate Horizon',
        styleId: 'rothko-colorfield',
      }),
    ];

    it('renders Row 1 horizontal snap-scroll filmstrip with peeking card widths (w-[238px]), ON WALL badge, and 44px touch targets across all 5 axes', () => {
      const onSelectPainting = vi.fn();
      const onSelectSize = vi.fn();
      const onSelectOrientation = vi.fn();
      const onSelectPanelLayout = vi.fn();
      const onSelectFrame = vi.fn();
      const onSelectMatWidth = vi.fn();
      const onRegenerateBatch = vi.fn();

      const { rerender } = render(
        React.createElement(QuickScrollFilmstrip, {
          paintings,
          activePaintingId: 'painting-01',
          sizeId: '24x36',
          orientation: 'portrait',
          panelLayout: 'single',
          frameId: 'natural-white-oak',
          matWidthId: '2.5in',
          onSelectPainting,
          onSelectSize,
          onSelectOrientation,
          onSelectPanelLayout,
          onSelectFrame,
          onSelectMatWidth,
          onRegenerateBatch,
        })
      );

      const dock = screen.getByTestId('quick-scroll-filmstrip');
      expect(dock.className).toContain('max-w-full');

      const listbox = screen.getByRole('listbox', {
        name: /Synthesized room paintings/i,
      });
      expect(listbox.className).toContain('overflow-x-auto');
      expect(listbox.className).toContain('snap-x');
      expect(listbox.className).toContain('snap-mandatory');

      const firstCard = screen.getByTestId('filmstrip-painting-painting-01');
      expect(firstCard.className).toContain('w-[238px]');
      expect(firstCard.className).toContain('snap-start');
      expect(screen.getByTestId('active-on-wall-badge').textContent).toBe('ON WALL');

      // Select second painting
      fireEvent.click(screen.getByTestId('filmstrip-painting-painting-02'));
      expect(onSelectPainting).toHaveBeenCalledWith('painting-02');

      // Regenerate button
      const regenBtn = screen.getByTestId('regenerate-paintings-btn');
      expect(regenBtn.className).toContain('min-h-[44px]');
      fireEvent.click(regenBtn);
      expect(onRegenerateBatch).toHaveBeenCalledTimes(1);

      // Verify all 5 Print Sizes have min-h-[44px] and fire onSelectSize
      const sizeIds: PrintSizeId[] = ['12x16', '18x24', '24x36', '30x40', '36x48'];
      for (const id of sizeIds) {
        const btn = screen.getByTestId(`filmstrip-size-${id}`);
        expect(btn.className).toContain('min-h-[44px]');
        fireEvent.click(btn);
        expect(onSelectSize).toHaveBeenCalledWith(id);
      }

      // Verify all 3 Orientations have min-h-[44px] and fire onSelectOrientation
      const orientations: OrientationMode[] = ['portrait', 'landscape', 'square'];
      for (const o of orientations) {
        const btn = screen.getByTestId(`filmstrip-orientation-${o}`);
        expect(btn.className).toContain('min-h-[44px]');
        fireEvent.click(btn);
        expect(onSelectOrientation).toHaveBeenCalledWith(o);
      }

      // Verify all 3 Panel Layouts have min-h-[44px] and fire onSelectPanelLayout
      const layouts: PanelLayoutMode[] = ['single', 'diptych', 'triptych'];
      for (const l of layouts) {
        const btn = screen.getByTestId(`filmstrip-layout-${l}`);
        expect(btn.className).toContain('min-h-[44px]');
        fireEvent.click(btn);
        expect(onSelectPanelLayout).toHaveBeenCalledWith(l);
      }

      // Verify all 6 Frame Profiles have min-h-[44px] and fire onSelectFrame
      const frameIds: FrameProfileId[] = [
        'unframed-canvas',
        'natural-white-oak',
        'american-black-walnut',
        'matte-gallery-black',
        'brushed-brass-float',
        'warm-travertine-ash',
      ];
      for (const f of frameIds) {
        const btn = screen.getByTestId(`filmstrip-frame-${f}`);
        expect(btn.className).toContain('min-h-[44px]');
        fireEvent.click(btn);
        expect(onSelectFrame).toHaveBeenCalledWith(f);
      }

      // Verify all 4 Mat Widths have min-h-[44px] and fire onSelectMatWidth
      const mats: MatWidthId[] = ['none', '1.5in', '2.5in', '3.5in'];
      for (const m of mats) {
        const btn = screen.getByTestId(`filmstrip-mat-${m}`);
        expect(btn.className).toContain('min-h-[44px]');
        fireEvent.click(btn);
        expect(onSelectMatWidth).toHaveBeenCalledWith(m);
      }

      // Verify mat-suppressed hint appears when frameId is unframed-canvas or brushed-brass-float
      expect(screen.queryByTestId('mat-suppressed-hint')).toBeNull();
      rerender(
        React.createElement(QuickScrollFilmstrip, {
          paintings,
          activePaintingId: 'painting-01',
          sizeId: '24x36',
          orientation: 'portrait',
          panelLayout: 'single',
          frameId: 'brushed-brass-float',
          matWidthId: '2.5in',
          onSelectPainting,
          onSelectSize,
          onSelectOrientation,
          onSelectPanelLayout,
          onSelectFrame,
          onSelectMatWidth,
          onRegenerateBatch,
        })
      );
      expect(screen.getByTestId('mat-suppressed-hint').textContent).toContain(
        'Float Frame'
      );
    });
  });
});
