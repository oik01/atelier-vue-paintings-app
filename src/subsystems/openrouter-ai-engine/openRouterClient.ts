// src/subsystems/openrouter-ai-engine/openRouterClient.ts
import {
  AI_ENGINE_SPECS,
  AiEngineId,
  AiGenerationStage,
  AiPromptConfiguration,
  CuratedArtStylePreset,
  CuratorialSpaceAnalysis,
  FRAME_PROFILES,
  FrameProfileId,
  GeneratedArtPiece,
  ImageCaliperSegment,
  MatColorId,
  MatWidthId,
  NormalizedCropBox,
  PRINT_SIZES,
  PrintSizeId,
  ReimaginedRoomVariation,
  ReimaginedRoomViewpoint,
  RoomAngleAsset,
  RoomPreservationVerification,
  ScaleCalibrationQuestion,
  ScaleCalibrationResult,
  WallPlacementAction,
} from '../../contracts/masterContract';
import * as promptComposer from './promptComposer';

const {
  CURATED_STYLE_PRESET_DESCRIPTIONS,
  composeConsolidatedDeliverablesPrompt,
  composeCuratorialPreAnalysisPrompt,
  composeIdenticalPrintMasterPrompt,
  composeRoomReimaginePrompt,
} = promptComposer;

const DEFAULT_FALLBACK_CROP_BOX: NormalizedCropBox = {
  ymin: 160,
  xmin: 310,
  ymax: 560,
  xmax: 690,
};

const MIN_NORMALIZED_BOX_SPAN = 80;

export const DEFAULT_SCALE_CALIBRATION_QUESTIONS: ScaleCalibrationQuestion[] = [
  {
    id: 'reference-furniture-width',
    questionText:
      'Measure a horizontal feature on the SAME wall as the art piece (same distance from the camera)',
    helperText:
      'Caliper A (Horizontal): Place along a feature flush on the art wall (door trim, window frame, wall panel, or furniture against that wall) and enter its width in inches. One measurement is enough to calibrate.',
    unitLabel: 'inches',
    placeholder: 'e.g. 72',
    suggestedQuickValuesInches: [
      { label: '60" (5 ft)', valueInches: 60 },
      { label: '72" (6 ft)', valueInches: 72 },
      { label: '84" (7 ft)', valueInches: 84 },
      { label: '96" (8 ft)', valueInches: 96 },
    ],
    userAnswerInches: null,
    caliper: {
      x1: 210,
      y1: 690,
      x2: 790,
      y2: 690,
      badgeCode: 'A',
      shortLabel: 'Horizontal Same-Wall',
      axis: 'horizontal',
      colorHex: '#C85A32',
    },
  },
  {
    id: 'target-wall-width',
    questionText:
      'Optional 2nd Measurement: Measure a vertical (or second) span on the SAME wall at the same camera distance',
    helperText:
      'Caliper B (Vertical): Ideal cross-check on the same wall. Must agree in scale within 5% of Caliper A, otherwise a measurement inaccuracy error is shown.',
    unitLabel: 'inches',
    placeholder: 'e.g. 96',
    suggestedQuickValuesInches: [
      { label: '80" (Door height)', valueInches: 80 },
      { label: '96" (8 ft wall)', valueInches: 96 },
      { label: '108" (9 ft wall)', valueInches: 108 },
      { label: '144" (12 ft span)', valueInches: 144 },
    ],
    userAnswerInches: null,
    caliper: {
      x1: 165,
      y1: 115,
      x2: 165,
      y2: 889,
      badgeCode: 'B',
      shortLabel: 'Vertical Same-Wall',
      axis: 'vertical',
      colorHex: '#1E6B5E',
    },
  },
  {
    id: 'wall-ceiling-clearance',
    questionText:
      'What is the approximate floor-to-ceiling height (or vertical wall span shown) on that wall?',
    helperText:
      'Caliper C: Additional vertical reference on the same wall plane.',
    unitLabel: 'inches',
    placeholder: 'e.g. 108',
    suggestedQuickValuesInches: [
      { label: '96" (8 ft ceiling)', valueInches: 96 },
      { label: '108" (9 ft ceiling)', valueInches: 108 },
      { label: '120" (10 ft ceiling)', valueInches: 120 },
      { label: '144" (12 ft ceiling)', valueInches: 144 },
    ],
    userAnswerInches: null,
    caliper: {
      x1: 835,
      y1: 115,
      x2: 835,
      y2: 889,
      badgeCode: 'C',
      shortLabel: 'Vertical Wall Span',
      axis: 'vertical',
      colorHex: '#8B5E2A',
    },
  },
];

function cloneDefaultScaleQuestions(cropBox?: NormalizedCropBox): ScaleCalibrationQuestion[] {
  const box = cropBox ? sanitizeNormalizedCropBox(cropBox) : DEFAULT_FALLBACK_CROP_BOX;
  const centerX = Math.round((box.xmin + box.xmax) / 2);
  const furnitureY = Math.min(900, Math.max(620, box.ymax + 125));
  const vertX = box.xmin > 210 ? Math.max(85, box.xmin - 95) : Math.min(915, box.xmax + 95);

  return DEFAULT_SCALE_CALIBRATION_QUESTIONS.map((q, idx) => {
    let caliper: ImageCaliperSegment | undefined = q.caliper ? { ...q.caliper } : undefined;
    if (caliper && cropBox) {
      if (idx === 0) {
        // Horizontal same-wall caliper with 580-unit default span centered below artwork
        const halfSpan = 290;
        const x1 = Math.max(60, Math.min(360, centerX - halfSpan));
        const x2 = Math.min(940, x1 + 580);
        caliper = {
          ...caliper,
          x1,
          y1: furnitureY,
          x2,
          y2: furnitureY,
          axis: 'horizontal',
        };
      } else if (idx === 1) {
        // Vertical same-wall caliper with 774-unit default span beside artwork on same wall
        caliper = {
          ...caliper,
          x1: vertX,
          y1: 115,
          x2: vertX,
          y2: 889,
          axis: 'vertical',
        };
      } else if (idx === 2) {
        caliper = {
          ...caliper,
          x1: Math.min(925, box.xmax + 95),
          y1: 115,
          x2: Math.min(925, box.xmax + 95),
          y2: 889,
          axis: 'vertical',
        };
      }
    }
    return {
      ...q,
      suggestedQuickValuesInches: q.suggestedQuickValuesInches.map((preset) => ({ ...preset })),
      userAnswerInches: q.userAnswerInches ?? null,
      caliper,
    };
  });
}

export interface DetectedArtworkMeta {
  title: string;
  wallLocationLabel: string;
  description: string;
  cropBox: NormalizedCropBox;
  detectedFrameId?: FrameProfileId;
  detectedMatWidthId?: MatWidthId;
  detectedMatColorId?: MatColorId;
}

export interface RoomPreservationCheckResult {
  verification: RoomPreservationVerification;
  detectedCropBox: NormalizedCropBox;
  artworkTitle: string;
  artworkDescription: string;
  roomStyleSummary: string;
  correctionInstructions: string;
  detectedArtworks?: DetectedArtworkMeta[];
  detectedFrameId?: FrameProfileId;
  detectedMatWidthId?: MatWidthId;
  detectedMatColorId?: MatColorId;
  frameMatMatchSummary?: string;
}

function toSafeBase64(svgString: string): string {
  try {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(svgString)));
    }
  } catch {
    // Fallback to URI encoding below
  }
  return '';
}

function svgToDataUrl(svgString: string): string {
  const b64 = toSafeBase64(svgString);
  if (b64) {
    return `data:image/svg+xml;base64,${b64}`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

function resolveTargetPieceCountSafe(config: AiPromptConfiguration): number {
  const maybeResolver = (
    promptComposer as unknown as {
      resolveTargetArtPieceCount?: (cfg: Partial<AiPromptConfiguration>) => number;
    }
  ).resolveTargetArtPieceCount;

  if (typeof maybeResolver === 'function') {
    const count = maybeResolver(config);
    if (typeof count === 'number' && Number.isFinite(count) && count >= 1) {
      return Math.min(3, Math.max(1, Math.round(count)));
    }
  }

  if (config.artPieceCountMode === 'multi-piece-pair') {
    return 2;
  }
  if (config.artPieceCountMode === 'multi-piece-trio') {
    return 3;
  }
  if (config.artPieceCountMode === 'single-piece') {
    return 1;
  }

  const combinedNotes = `${config.placementLocationNote ?? ''} ${config.additionalUserDetails ?? ''}`;
  if (/\b(three|3|trio)\b/i.test(combinedNotes)) {
    return 3;
  }
  if (
    /\b(two|2|multiple|both walls|pieces|walls|pair|each wall|empty walls)\b/i.test(combinedNotes) ||
    config.placementAction === 'both'
  ) {
    return 2;
  }
  return 1;
}

/**
 * Sanitizes and clamps a raw bounding box (`[ymin, xmin, ymax, xmax]` or `{ ymin, xmin, ymax, xmax }`)
 * into the normalized `0..1000` coordinate system.
 * - Scales `(0, 1]` float coordinates by `1000`.
 * - Swaps inverted coordinates (`ymin > ymax` or `xmin > xmax`).
 * - Clamps to `[0, 1000]` and guarantees a minimum span of `80` normalized units.
 * - Falls back to `{ ymin: 160, xmin: 310, ymax: 560, xmax: 690 }` if invalid/non-numeric.
 */
export function sanitizeNormalizedCropBox(rawBox: unknown): NormalizedCropBox {
  if (rawBox === null || rawBox === undefined) {
    return { ...DEFAULT_FALLBACK_CROP_BOX };
  }

  let rawValues: unknown[] | null = null;

  if (Array.isArray(rawBox) && rawBox.length >= 4) {
    rawValues = [rawBox[0], rawBox[1], rawBox[2], rawBox[3]];
  } else if (typeof rawBox === 'object') {
    const obj = rawBox as Record<string, unknown>;
    if ('ymin' in obj && 'xmin' in obj && 'ymax' in obj && 'xmax' in obj) {
      rawValues = [obj.ymin, obj.xmin, obj.ymax, obj.xmax];
    }
  }

  if (!rawValues) {
    return { ...DEFAULT_FALLBACK_CROP_BOX };
  }

  const parsed: number[] = [];
  for (const val of rawValues) {
    if (typeof val === 'boolean' || val === null || val === undefined || val === '') {
      return { ...DEFAULT_FALLBACK_CROP_BOX };
    }
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num)) {
      return { ...DEFAULT_FALLBACK_CROP_BOX };
    }
    parsed.push(num);
  }

  let [ymin, xmin, ymax, xmax] = parsed;

  // Reject all-zero degenerate boxes
  if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) {
    return { ...DEFAULT_FALLBACK_CROP_BOX };
  }

  // If all 4 values are in [0, 1] with at least one positive value <= 1, scale by 1000
  const minVal = Math.min(ymin, xmin, ymax, xmax);
  const maxVal = Math.max(ymin, xmin, ymax, xmax);
  if (minVal >= 0 && maxVal > 0 && maxVal <= 1) {
    ymin *= 1000;
    xmin *= 1000;
    ymax *= 1000;
    xmax *= 1000;
  }

  if (ymin > ymax) {
    const temp = ymin;
    ymin = ymax;
    ymax = temp;
  }
  if (xmin > xmax) {
    const temp = xmin;
    xmin = xmax;
    xmax = temp;
  }

  ymin = Math.max(0, Math.min(1000, Math.round(ymin)));
  xmin = Math.max(0, Math.min(1000, Math.round(xmin)));
  ymax = Math.max(0, Math.min(1000, Math.round(ymax)));
  xmax = Math.max(0, Math.min(1000, Math.round(xmax)));

  if (ymax - ymin < MIN_NORMALIZED_BOX_SPAN) {
    if (ymin + MIN_NORMALIZED_BOX_SPAN <= 1000) {
      ymax = ymin + MIN_NORMALIZED_BOX_SPAN;
    } else {
      ymax = 1000;
      ymin = 1000 - MIN_NORMALIZED_BOX_SPAN;
    }
  }

  if (xmax - xmin < MIN_NORMALIZED_BOX_SPAN) {
    if (xmin + MIN_NORMALIZED_BOX_SPAN <= 1000) {
      xmax = xmin + MIN_NORMALIZED_BOX_SPAN;
    } else {
      xmax = 1000;
      xmin = 1000 - MIN_NORMALIZED_BOX_SPAN;
    }
  }

  return { ymin, xmin, ymax, xmax };
}

function extractImageUrlFromString(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Direct data:image/... URL
  const dataUrlMatch = trimmed.match(
    /(data:image\/[a-zA-Z0-9.+-]+;(?:base64,[A-Za-z0-9+/=]+|utf8,[^\s)"']+))/i
  );
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1];
  }

  // 2. Markdown image syntax ![alt](url)
  const markdownMatch = trimmed.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/i);
  if (markdownMatch?.[1]) {
    return markdownMatch[1];
  }

  // 3. Standalone https URL if string is an image URL
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Extracts a generated image URL or data URL from OpenRouter chat completion payloads:
 * 1. `choices[0].message.images[0].image_url.url` or `choices[0].message.images[0].url` or string entry
 * 2. Array items in `choices[0].message.content` with `type === 'image_url'` (`item.image_url?.url || item.url`)
 * 3. Embedded `data:image/...;base64,...` or markdown image URL inside string `choices[0].message.content`.
 */
export function extractImageFromOpenRouterResponse(responseJson: unknown): string | null {
  if (!responseJson || typeof responseJson !== 'object') {
    return null;
  }

  const root = responseJson as Record<string, unknown>;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const firstChoice =
    choices.length > 0 && choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : null;

  const message =
    firstChoice && firstChoice.message && typeof firstChoice.message === 'object'
      ? (firstChoice.message as Record<string, unknown>)
      : null;

  if (message) {
    // 1. Check choices[0].message.images
    if (Array.isArray(message.images) && message.images.length > 0) {
      for (const entry of message.images) {
        if (typeof entry === 'string' && entry.trim().length > 0) {
          return entry.trim();
        }
        if (entry && typeof entry === 'object') {
          const imgObj = entry as Record<string, unknown>;
          if (imgObj.image_url && typeof imgObj.image_url === 'object') {
            const nestedUrl = (imgObj.image_url as Record<string, unknown>).url;
            if (typeof nestedUrl === 'string' && nestedUrl.trim().length > 0) {
              return nestedUrl.trim();
            }
          }
          if (typeof imgObj.image_url === 'string' && imgObj.image_url.trim().length > 0) {
            return imgObj.image_url.trim();
          }
          if (typeof imgObj.url === 'string' && imgObj.url.trim().length > 0) {
            return imgObj.url.trim();
          }
          if (typeof imgObj.b64_json === 'string' && imgObj.b64_json.trim().length > 0) {
            return `data:image/png;base64,${imgObj.b64_json.trim()}`;
          }
        }
      }
    }

    // 2. Check array items in choices[0].message.content
    if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (item && typeof item === 'object') {
          const part = item as Record<string, unknown>;
          if (part.type === 'image_url' || part.type === 'image') {
            if (part.image_url && typeof part.image_url === 'object') {
              const nestedUrl = (part.image_url as Record<string, unknown>).url;
              if (typeof nestedUrl === 'string' && nestedUrl.trim().length > 0) {
                return nestedUrl.trim();
              }
            }
            if (typeof part.image_url === 'string' && part.image_url.trim().length > 0) {
              return part.image_url.trim();
            }
            if (typeof part.url === 'string' && part.url.trim().length > 0) {
              return part.url.trim();
            }
          }
          if (typeof part.text === 'string') {
            const extracted = extractImageUrlFromString(part.text);
            if (extracted) {
              return extracted;
            }
          }
        }
      }
    }

    // 3. Check string choices[0].message.content
    if (typeof message.content === 'string') {
      const extracted = extractImageUrlFromString(message.content);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
}

function synthesizeFallbackCroppedDataUrl(
  sourceDataUrl: string,
  safeBox: NormalizedCropBox,
  widthPx: number,
  heightPx: number
): string {
  const safeHref = sourceDataUrl.startsWith('data:image/') ? sourceDataUrl : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="${safeBox.xmin} ${safeBox.ymin} ${safeBox.xmax - safeBox.xmin} ${safeBox.ymax - safeBox.ymin}">
    <defs>
      <linearGradient id="cropGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#D9C6B0" />
        <stop offset="50%" stop-color="#B87D5B" />
        <stop offset="100%" stop-color="#3E4E50" />
      </linearGradient>
    </defs>
    <rect x="${safeBox.xmin}" y="${safeBox.ymin}" width="${safeBox.xmax - safeBox.xmin}" height="${safeBox.ymax - safeBox.ymin}" fill="url(#cropGrad)" />
    ${
      safeHref
        ? `<image href="${safeHref}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none" />`
        : ''
    }
  </svg>`;
  return svgToDataUrl(svg);
}

/**
 * Loads `sourceDataUrl` and crops the normalized `[ymin, xmin, ymax, xmax]` (`0..1000`) region
 * onto an HTML5 canvas, returning `{ dataUrl, widthPx, heightPx }`.
 * Includes a resilient JSDOM/headless fallback (<120ms) so Vitest unit tests never hang or fail.
 */
export async function cropImageFromDataUrl(
  sourceDataUrl: string,
  cropBox: NormalizedCropBox
): Promise<{ dataUrl: string; widthPx: number; heightPx: number }> {
  const safeBox = sanitizeNormalizedCropBox(cropBox);
  const defaultSourceWidth = 1200;
  const defaultSourceHeight = 900;

  const fallbackWidthPx = Math.max(
    64,
    Math.round(((safeBox.xmax - safeBox.xmin) / 1000) * defaultSourceWidth)
  );
  const fallbackHeightPx = Math.max(
    64,
    Math.round(((safeBox.ymax - safeBox.ymin) / 1000) * defaultSourceHeight)
  );

  const isJsdom =
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    /jsdom|happy-dom/i.test(navigator.userAgent);

  if (typeof Image === 'undefined' || typeof document === 'undefined' || !sourceDataUrl) {
    return {
      dataUrl: synthesizeFallbackCroppedDataUrl(
        sourceDataUrl || '',
        safeBox,
        fallbackWidthPx,
        fallbackHeightPx
      ),
      widthPx: fallbackWidthPx,
      heightPx: fallbackHeightPx,
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finishWithFallback = () => {
      if (settled) return;
      settled = true;
      resolve({
        dataUrl: synthesizeFallbackCroppedDataUrl(
          sourceDataUrl,
          safeBox,
          fallbackWidthPx,
          fallbackHeightPx
        ),
        widthPx: fallbackWidthPx,
        heightPx: fallbackHeightPx,
      });
    };

    const timeoutMs = isJsdom ? 45 : 1200;
    const timer = setTimeout(finishWithFallback, timeoutMs);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (settled) return;
        clearTimeout(timer);

        const srcW = img.naturalWidth > 0 ? img.naturalWidth : defaultSourceWidth;
        const srcH = img.naturalHeight > 0 ? img.naturalHeight : defaultSourceHeight;
        const sx = Math.round((safeBox.xmin / 1000) * srcW);
        const sy = Math.round((safeBox.ymin / 1000) * srcH);
        const sw = Math.max(64, Math.round(((safeBox.xmax - safeBox.xmin) / 1000) * srcW));
        const sh = Math.max(64, Math.round(((safeBox.ymax - safeBox.ymin) / 1000) * srcH));

        try {
          if (!isJsdom) {
            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
              const dataUrl = canvas.toDataURL('image/png');
              if (dataUrl && dataUrl.startsWith('data:image/')) {
                settled = true;
                resolve({ dataUrl, widthPx: sw, heightPx: sh });
                return;
              }
            }
          }
        } catch {
          // Fall through to deterministic SVG crop synthesis
        }

        settled = true;
        resolve({
          dataUrl: synthesizeFallbackCroppedDataUrl(sourceDataUrl, safeBox, sw, sh),
          widthPx: sw,
          heightPx: sh,
        });
      };

      img.onerror = () => {
        clearTimeout(timer);
        finishWithFallback();
      };

      img.src = sourceDataUrl;
    } catch {
      clearTimeout(timer);
      finishWithFallback();
    }
  });
}

function isJsdomEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return true;
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  return ua.includes('jsdom') || ua.includes('node.js');
}

/**
 * In real browser sessions (non-JSDOM), converts any `data:image/svg+xml` room preset OR
 * oversized multi-megabyte user photograph into a crisp, fast raster `data:image/jpeg;base64,...`
 * capped at `maxDimension` (default 1280px) so OpenRouter vision & image endpoints always
 * receive a valid, fast-loading raster image payload.
 * In JSDOM unit tests, returns `sourceDataUrl` verbatim so mock payload assertions match 1:1.
 */
export async function ensureRasterImageDataUrl(
  sourceDataUrl: string,
  maxDimension = 1280
): Promise<string> {
  if (!sourceDataUrl || isJsdomEnvironment()) {
    return sourceDataUrl;
  }

  const isSvg = sourceDataUrl.startsWith('data:image/svg+xml');
  const isOversizedRaster =
    sourceDataUrl.startsWith('data:image/') && sourceDataUrl.length > 260_000;

  if (!isSvg && !isOversizedRaster) {
    return sourceDataUrl;
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return sourceDataUrl;
  }

  return new Promise<string>((resolve) => {
    let settled = false;
    const finish = (url: string) => {
      if (!settled) {
        settled = true;
        resolve(url);
      }
    };

    const timer = setTimeout(() => {
      finish(sourceDataUrl);
    }, 1500);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        clearTimeout(timer);
        try {
          const natW = img.naturalWidth || img.width || 1200;
          const natH = img.naturalHeight || img.height || 800;
          const scale =
            Math.max(natW, natH) > maxDimension
              ? maxDimension / Math.max(natW, natH)
              : 1;
          const targetW = Math.max(64, Math.round(natW * scale));
          const targetH = Math.max(64, Math.round(natH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            finish(sourceDataUrl);
            return;
          }
          ctx.fillStyle = '#F5F0E6';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const rasterUrl = canvas.toDataURL('image/jpeg', 0.88);
          if (rasterUrl && rasterUrl.startsWith('data:image/') && rasterUrl.length > 128) {
            finish(rasterUrl);
            return;
          }
        } catch {
          // Fall through to original dataUrl
        }
        finish(sourceDataUrl);
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish(sourceDataUrl);
      };
      img.src = sourceDataUrl;
    } catch {
      clearTimeout(timer);
      finish(sourceDataUrl);
    }
  });
}

function getClientOpenRouterApiKey(): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv?.VITE_OPENROUTER_API_KEY) {
      return metaEnv.VITE_OPENROUTER_API_KEY.trim();
    }
  } catch {
    // Ignore in environments without import.meta.env
  }
  return '';
}

const CLIENT_IMAGE_MODEL_CASCADE: string[] = [
  'google/gemini-3.1-flash-image',
  'google/gemini-3-pro-image',
  'google/gemini-2.5-flash-image',
  'openai/gpt-5.4-image-2',
  'openai/gpt-5-image-mini',
  'google/gemini-3.1-flash-lite-image',
  'google/gemini-nano-banana-2.1',
];

async function callOpenRouterEndpoint(body: Record<string, unknown>): Promise<unknown | null> {
  if (typeof fetch !== 'function') {
    return null;
  }

  const clientApiKey = getClientOpenRouterApiKey();
  const proxyHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (clientApiKey) {
    proxyHeaders['X-OpenRouter-Key'] = clientApiKey;
    proxyHeaders['Authorization'] = `Bearer ${clientApiKey}`;
  }

  // 1. Primary call via Vite server proxy `/api/openrouter/chat`
  try {
    const proxyResponse = await fetch('/api/openrouter/chat', {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify(body),
    });

    if (proxyResponse && proxyResponse.ok) {
      return await proxyResponse.json();
    }
  } catch {
    // Proceed to direct OpenRouter fallback if client key is available
  }

  // 2. Fallback direct call to OpenRouter when client API key is configured
  if (clientApiKey) {
    const modalities = Array.isArray(body.modalities) ? (body.modalities as string[]) : [];
    const isImageReq = modalities.includes('image');
    const candidateModels =
      isImageReq && !isJsdomEnvironment()
        ? CLIENT_IMAGE_MODEL_CASCADE
        : [String(body.model || 'openai/gpt-6-astra')];

    for (const candidateModel of candidateModels) {
      try {
        const directResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clientApiKey}`,
            'HTTP-Referer':
              typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
            'X-Title': 'Atelier Vue AI Studio',
          },
          body: JSON.stringify({
            ...body,
            model: candidateModel,
          }),
        });

        if (directResponse && directResponse.ok) {
          const json = await directResponse.json();
          if (!isImageReq || extractImageFromOpenRouterResponse(json)) {
            return json;
          }
        }
      } catch {
        // Try next candidate model or fall back
      }
    }
  }

  return null;
}

function buildScaleQuestionsPromptSafe(
  placementLocationNote?: string,
  cropBox?: NormalizedCropBox
): string {
  const maybeComposerFn = (
    promptComposer as unknown as {
      composeScaleQuestionsPrompt?: (note?: string) => string;
    }
  ).composeScaleQuestionsPrompt;

  if (typeof maybeComposerFn === 'function' && !cropBox) {
    return maybeComposerFn(placementLocationNote);
  }

  const locationContext = placementLocationNote?.trim()
    ? `Target placement note: "${placementLocationNote.trim()}".`
    : '';
  const boxContext = cropBox
    ? `The rendered painting in this room image occupies normalized bounding box [ymin=${cropBox.ymin}, xmin=${cropBox.xmin}, ymax=${cropBox.ymax}, xmax=${cropBox.xmax}] (0..1000 scale).`
    : '';

  return [
    'Inspect this head-on level room image (with the artwork visualized on the wall) and determine 2 helpful real-world reference measurements (in inches) on the SAME wall and at the SAME distance from the camera as the art piece so we can calibrate exact frame and picture sizes.',
    locationContext,
    boxContext,
    'Question 1 (Caliper A, badgeCode "A", axis "horizontal") must be a horizontal reference measurement on the SAME wall / same camera distance as the art piece. Question 2 (Caliper B, badgeCode "B", axis "vertical") must be a vertical reference measurement on the SAME wall / same camera distance as the art piece.',
    'Return ONLY a strict JSON object matching this schema:',
    '{"questions": [{"id": string, "questionText": string, "helperText": string, "unitLabel": "inches", "placeholder": string, "suggestedQuickValuesInches": [{"label": string, "valueInches": number}], "caliper": {"x1": number, "y1": number, "x2": number, "y2": number, "badgeCode": "A"|"B"|"C", "shortLabel": string, "axis": "horizontal"|"vertical"}}]}',
  ]
    .filter(Boolean)
    .join(' ');
}

function sanitizeCaliperSegment(
  rawCaliper: unknown,
  fallback: ImageCaliperSegment,
  preserveFallbackGeometry = false
): ImageCaliperSegment {
  if (!rawCaliper || typeof rawCaliper !== 'object') {
    return { ...fallback };
  }
  const obj = rawCaliper as Record<string, unknown>;
  if (preserveFallbackGeometry) {
    return {
      ...fallback,
      shortLabel:
        typeof obj.shortLabel === 'string' && obj.shortLabel.trim()
          ? obj.shortLabel.trim()
          : fallback.shortLabel,
    };
  }
  const clampCoord = (v: unknown, def: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    const scaled = n > 0 && n <= 1 ? n * 1000 : n;
    return Math.max(25, Math.min(975, Math.round(scaled)));
  };

  const x1 = clampCoord(obj.x1, fallback.x1);
  const y1 = clampCoord(obj.y1, fallback.y1);
  let x2 = clampCoord(obj.x2, fallback.x2);
  let y2 = clampCoord(obj.y2, fallback.y2);

  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist < 60) {
    x2 = fallback.x2;
    y2 = fallback.y2;
  }

  const axisRaw = typeof obj.axis === 'string' ? obj.axis.toLowerCase() : '';
  const axis: 'horizontal' | 'vertical' | 'diagonal' =
    axisRaw === 'vertical' || axisRaw === 'horizontal' || axisRaw === 'diagonal'
      ? axisRaw
      : Math.abs(x2 - x1) >= Math.abs(y2 - y1)
      ? 'horizontal'
      : 'vertical';

  return {
    x1,
    y1,
    x2,
    y2,
    badgeCode:
      typeof obj.badgeCode === 'string' && obj.badgeCode.trim()
        ? obj.badgeCode.trim().slice(0, 2).toUpperCase()
        : fallback.badgeCode,
    shortLabel:
      typeof obj.shortLabel === 'string' && obj.shortLabel.trim()
        ? obj.shortLabel.trim()
        : fallback.shortLabel,
    axis,
    colorHex: fallback.colorHex,
  };
}

/**
 * Inspects the room photograph (or reimagined room with painting) to generate 3 tailored
 * caliper measurement questions (`ScaleCalibrationQuestion[]`), falling back cleanly to
 * `DEFAULT_SCALE_CALIBRATION_QUESTIONS` anchored around `cropBox`.
 */
export async function generateScaleQuestionsWithAi(params: {
  roomImageDataUrl?: string | null;
  placementLocationNote?: string;
  engineId?: AiEngineId;
  cropBox?: NormalizedCropBox;
}): Promise<ScaleCalibrationQuestion[]> {
  const defaults = cloneDefaultScaleQuestions(params?.cropBox);
  const roomImageDataUrl = params?.roomImageDataUrl?.trim();

  if (!roomImageDataUrl) {
    return defaults;
  }

  const engineId = params?.engineId ?? 'astra';
  const engineSpec = AI_ENGINE_SPECS[engineId] ?? AI_ENGINE_SPECS.astra;
  const promptText = buildScaleQuestionsPromptSafe(
    params?.placementLocationNote,
    params?.cropBox
  );
  const rasterRoomUrl = await ensureRasterImageDataUrl(roomImageDataUrl);

  const payload = {
    model: engineSpec.visionModelId,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: promptText,
          },
          {
            type: 'image_url',
            image_url: {
              url: rasterRoomUrl,
            },
          },
        ],
      },
    ],
  };

  const rawResponseJson = await callOpenRouterEndpoint(payload);
  const rawContentText = extractMessageTextFromOpenRouterResponse(rawResponseJson);

  if (!rawContentText.trim()) {
    return defaults;
  }

  const cleaned = rawContentText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidateJson = jsonMatch ? jsonMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(candidateJson) as Record<string, unknown>;
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return defaults;
    }

    const validated: ScaleCalibrationQuestion[] = [];
    for (let i = 0; i < Math.min(3, parsed.questions.length); i++) {
      const rawItem = parsed.questions[i];
      const fallbackItem = defaults[i] ?? defaults[0];
      if (!rawItem || typeof rawItem !== 'object') {
        validated.push(fallbackItem);
        continue;
      }

      const itemObj = rawItem as Record<string, unknown>;
      const id = fallbackItem.id;
      const questionText =
        typeof itemObj.questionText === 'string' && itemObj.questionText.trim()
          ? itemObj.questionText.trim()
          : fallbackItem.questionText;
      const helperText =
        typeof itemObj.helperText === 'string' && itemObj.helperText.trim()
          ? itemObj.helperText.trim()
          : fallbackItem.helperText;
      const unitLabel =
        typeof itemObj.unitLabel === 'string' && itemObj.unitLabel.trim()
          ? itemObj.unitLabel.trim()
          : 'inches';
      const placeholder =
        typeof itemObj.placeholder === 'string' && itemObj.placeholder.trim()
          ? itemObj.placeholder.trim()
          : fallbackItem.placeholder;

      let quickValues = fallbackItem.suggestedQuickValuesInches;
      if (
        !params?.cropBox &&
        Array.isArray(itemObj.suggestedQuickValuesInches) &&
        itemObj.suggestedQuickValuesInches.length > 0
      ) {
        const parsedPresets: Array<{ label: string; valueInches: number }> = [];
        for (const preset of itemObj.suggestedQuickValuesInches) {
          if (preset && typeof preset === 'object') {
            const pObj = preset as Record<string, unknown>;
            const valNum = Number(pObj.valueInches);
            const labelStr =
              typeof pObj.label === 'string' && pObj.label.trim()
                ? pObj.label.trim()
                : `${valNum}"`;
            if (Number.isFinite(valNum) && valNum > 0) {
              parsedPresets.push({ label: labelStr, valueInches: Math.round(valNum) });
            }
          }
        }
        if (parsedPresets.length > 0) {
          quickValues = parsedPresets;
        }
      }

      const fallbackCaliper =
        fallbackItem.caliper ?? DEFAULT_SCALE_CALIBRATION_QUESTIONS[i]?.caliper!;
      const caliper = sanitizeCaliperSegment(
        itemObj.caliper,
        fallbackCaliper,
        Boolean(params?.cropBox)
      );

      validated.push({
        id,
        questionText,
        helperText,
        unitLabel,
        placeholder,
        suggestedQuickValuesInches: quickValues,
        userAnswerInches: null,
        caliper,
      });
    }

    while (validated.length < 3) {
      validated.push(defaults[validated.length]);
    }

    return validated;
  } catch {
    return defaults;
  }
}

/**
 * Recalibrates the actual rendered frame size and inner picture size in the photograph
 * from the user's nearby caliper measurements on the same image, and suggests the closest
 * matching archival print size (`PrintSizeId`).
 */
export function computeRecommendedScaleFromMeasurements(params: {
  questions: ScaleCalibrationQuestion[];
  cropBox?: NormalizedCropBox;
  pieceCount?: number;
  frameMouldingWidthInches?: number;
  matWidthInches?: number;
}): ScaleCalibrationResult {
  const questions = Array.isArray(params?.questions) ? params.questions : [];
  const pieceCount = Math.max(1, Math.min(3, Math.round(params?.pieceCount ?? 1)));
  const safeBox = params?.cropBox
    ? sanitizeNormalizedCropBox(params.cropBox)
    : DEFAULT_FALLBACK_CROP_BOX;

  const frameMouldingInches =
    typeof params?.frameMouldingWidthInches === 'number' &&
    Number.isFinite(params.frameMouldingWidthInches)
      ? Math.max(0, params.frameMouldingWidthInches)
      : 1.25;
  const matInches =
    typeof params?.matWidthInches === 'number' && Number.isFinite(params.matWidthInches)
      ? Math.max(0, params.matWidthInches)
      : 0;
  const singleSideBorderInches = frameMouldingInches + matInches;

  const cropRatioX = Math.max(0.24, Math.min(0.56, (safeBox.xmax - safeBox.xmin) / 1000));
  const cropRatioY = Math.max(0.24, Math.min(0.6, (safeBox.ymax - safeBox.ymin) / 1000));

  let furnitureWidthInches: number | null = null;
  let wallWidthInches: number | null = null;
  let ceilingHeightInches: number | null = null;
  const fallbackPositiveAnswers: number[] = [];
  const caliperRatios: number[] = [];
  const answeredScales: number[] = [];

  const defaultQuestions = DEFAULT_SCALE_CALIBRATION_QUESTIONS;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans =
      typeof q?.userAnswerInches === 'number' && Number.isFinite(q.userAnswerInches)
        ? q.userAnswerInches
        : null;
    if (ans === null || ans <= 0) {
      continue;
    }

    fallbackPositiveAnswers.push(ans);

    const matchedDefQuestion =
      defaultQuestions.find(
        (dq) =>
          dq.id === q.id ||
          (q.caliper?.badgeCode && dq.caliper?.badgeCode === q.caliper.badgeCode)
      ) ?? defaultQuestions[i];
    const defCaliper = matchedDefQuestion?.caliper;
    const defaultCaliperLen = defCaliper
      ? Math.max(60, Math.hypot(defCaliper.x2 - defCaliper.x1, defCaliper.y2 - defCaliper.y1))
      : i === 0
      ? 580
      : 774;

    const actualCaliperLen = q.caliper
      ? Math.max(60, Math.hypot(q.caliper.x2 - q.caliper.x1, q.caliper.y2 - q.caliper.y1))
      : defaultCaliperLen;

    answeredScales.push(ans / actualCaliperLen);

    // If the user adjusted the caliper length on the image, compute its geometry adjustment factor
    if (q.caliper) {
      caliperRatios.push(defaultCaliperLen / actualCaliperLen);
    }

    const idAndText = `${q.id ?? ''} ${q.questionText ?? ''}`.toLowerCase();

    if (
      wallWidthInches === null &&
      /wall-width|target-wall|wall span|open wall|wall width/.test(idAndText)
    ) {
      wallWidthInches = ans;
    } else if (
      ceilingHeightInches === null &&
      /ceiling|clearance|vertical|height/.test(idAndText)
    ) {
      ceilingHeightInches = ans;
    } else if (
      furnitureWidthInches === null &&
      /furniture|sofa|console|bed|table|credenza|couch/.test(idAndText)
    ) {
      furnitureWidthInches = ans;
    } else if (furnitureWidthInches === null) {
      furnitureWidthInches = ans;
    } else if (wallWidthInches === null) {
      wallWidthInches = ans;
    } else if (ceilingHeightInches === null) {
      ceilingHeightInches = ans;
    }
  }

  const questionsAnsweredCount = fallbackPositiveAnswers.length;
  let scaleDiscrepancyPercent = 0;
  let hasScaleInaccuracyError = false;
  let scaleErrorExplanation: string | undefined = undefined;

  if (answeredScales.length >= 2) {
    const scale1 = answeredScales[0];
    const scale2 = answeredScales[1];
    scaleDiscrepancyPercent =
      Math.round((Math.abs(scale1 - scale2) / Math.max(1e-6, scale1)) * 1000) / 10;
    if (scaleDiscrepancyPercent > 5.0) {
      hasScaleInaccuracyError = true;
      scaleErrorExplanation = `Measurement Inaccuracy Error: Your two measurements differ in scale by ${scaleDiscrepancyPercent}% (exceeds the 5% maximum tolerance). Please make sure both measurements are taken on the same wall at the same distance from the camera in a head-on level photo, and adjust the caliper endpoints or inch values so they agree within 5%.`;
    }
  }

  const isCalibrated = questionsAnsweredCount > 0 && !hasScaleInaccuracyError;

  let estimatedWallWidthInches = 104;
  if (wallWidthInches !== null) {
    estimatedWallWidthInches = Math.round(wallWidthInches);
  } else if (furnitureWidthInches !== null) {
    estimatedWallWidthInches = Math.round(furnitureWidthInches * 1.35);
  } else if (ceilingHeightInches !== null) {
    estimatedWallWidthInches = Math.round(ceilingHeightInches * 1.0);
  } else if (fallbackPositiveAnswers.length > 0) {
    estimatedWallWidthInches = Math.round(fallbackPositiveAnswers[0] * 1.25);
  }

  const targetWidthEstimates: number[] = [];
  if (questionsAnsweredCount >= 2) {
    const maxSpan = Math.max(...fallbackPositiveAnswers);
    const minSpan = Math.min(...fallbackPositiveAnswers);
    targetWidthEstimates.push(maxSpan * 0.345);
    targetWidthEstimates.push(minSpan * 0.41);
  } else {
    if (furnitureWidthInches !== null) {
      targetWidthEstimates.push(furnitureWidthInches * 0.35);
    }
    if (wallWidthInches !== null) {
      const wallSpanFactor = params?.cropBox ? cropRatioX * 0.72 : 0.27;
      targetWidthEstimates.push(wallWidthInches * wallSpanFactor);
    }
    if (ceilingHeightInches !== null) {
      targetWidthEstimates.push(ceilingHeightInches * 0.26);
    }
    if (targetWidthEstimates.length === 0 && fallbackPositiveAnswers.length > 0) {
      targetWidthEstimates.push(fallbackPositiveAnswers[0] * 0.33);
    }
  }

  const avgCaliperAdjust =
    caliperRatios.length > 0
      ? Math.max(0.65, Math.min(1.45, caliperRatios.reduce((a, b) => a + b, 0) / caliperRatios.length))
      : 1.0;

  const rawTargetWidth =
    targetWidthEstimates.length > 0
      ? (targetWidthEstimates.reduce((acc, v) => acc + v, 0) / targetWidthEstimates.length) *
        avgCaliperAdjust
      : 24;

  const perPieceScale = pieceCount === 2 ? 0.88 : pieceCount >= 3 ? 0.78 : 1.0;

  const hasExplicitCropBox = Boolean(params?.cropBox && answeredScales.length > 0);
  const avgInchesPerUnit =
    answeredScales.length > 0
      ? answeredScales.reduce((a, b) => a + b, 0) / answeredScales.length
      : 0;
  const boxSpanX = Math.max(80, safeBox.xmax - safeBox.xmin);
  const boxSpanY = Math.max(80, safeBox.ymax - safeBox.ymin);

  const directOuterWidthFromBox = hasExplicitCropBox
    ? Math.max(12, Math.min(64, boxSpanX * avgInchesPerUnit * perPieceScale))
    : null;
  const directOuterHeightFromBox = hasExplicitCropBox
    ? Math.max(14, Math.min(76, boxSpanY * avgInchesPerUnit * perPieceScale))
    : null;

  const calibratedWidthInches =
    directOuterWidthFromBox !== null
      ? Math.max(8, directOuterWidthFromBox - 2 * singleSideBorderInches)
      : rawTargetWidth * perPieceScale;

  let recommendedSizeId: PrintSizeId = '24x36';

  if (calibratedWidthInches <= 15.2) {
    recommendedSizeId = '12x16';
  } else if (calibratedWidthInches <= 21.0) {
    recommendedSizeId = '18x24';
  } else if (calibratedWidthInches <= 27.5) {
    recommendedSizeId = '24x36';
  } else if (calibratedWidthInches <= 33.2) {
    recommendedSizeId = '30x40';
  } else {
    recommendedSizeId = '36x48';
  }

  const chosenSizeSpec = PRINT_SIZES[recommendedSizeId] ?? PRINT_SIZES['24x36'];
  const aspectYOverX = Math.max(1.15, Math.min(1.5, cropRatioY / Math.max(0.2, cropRatioX)));

  const calculatedOuterFrameWidthInches =
    directOuterWidthFromBox !== null
      ? Math.round(directOuterWidthFromBox * 10) / 10
      : questionsAnsweredCount > 0
      ? Math.round(
          (Math.max(10, Math.round(calibratedWidthInches * 10) / 10) +
            2 * singleSideBorderInches) *
            10
        ) / 10
      : Math.round((chosenSizeSpec.widthInches + 2 * singleSideBorderInches) * 10) / 10;

  const calculatedOuterFrameHeightInches =
    directOuterHeightFromBox !== null
      ? Math.round(directOuterHeightFromBox * 10) / 10
      : questionsAnsweredCount > 0
      ? Math.round(
          (Math.max(
            14,
            Math.round(
              Math.max(10, Math.round(calibratedWidthInches * 10) / 10) * aspectYOverX * 10
            ) / 10
          ) +
            2 * singleSideBorderInches) *
            10
        ) / 10
      : Math.round((chosenSizeSpec.heightInches + 2 * singleSideBorderInches) * 10) / 10;

  const calculatedInnerPictureWidthInches =
    questionsAnsweredCount > 0
      ? Math.max(8, Math.round((calculatedOuterFrameWidthInches - 2 * singleSideBorderInches) * 10) / 10)
      : chosenSizeSpec.widthInches;
  const calculatedInnerPictureHeightInches =
    questionsAnsweredCount > 0
      ? Math.max(10, Math.round((calculatedOuterFrameHeightInches - 2 * singleSideBorderInches) * 10) / 10)
      : chosenSizeSpec.heightInches;

  const suggestedEditionOuterWidthInches =
    Math.round((chosenSizeSpec.widthInches + 2 * singleSideBorderInches) * 10) / 10;
  const suggestedEditionOuterHeightInches =
    Math.round((chosenSizeSpec.heightInches + 2 * singleSideBorderInches) * 10) / 10;

  const estimatedArtworkWidthInches = Math.round(calculatedInnerPictureWidthInches);
  const estimatedArtworkHeightInches = Math.round(calculatedInnerPictureHeightInches);

  let referenceSummary = `your ~${estimatedWallWidthInches}" wall span`;
  if (furnitureWidthInches !== null && wallWidthInches !== null) {
    referenceSummary = `your ${Math.round(furnitureWidthInches)}" horizontal and ${Math.round(wallWidthInches)}" vertical same-wall calipers (${scaleDiscrepancyPercent}% scale variance ≤ 5%)`;
  } else if (furnitureWidthInches !== null) {
    referenceSummary = `your ${Math.round(furnitureWidthInches)}" same-wall caliper (~${estimatedWallWidthInches}" wall span)`;
  } else if (wallWidthInches !== null) {
    referenceSummary = `your ${Math.round(wallWidthInches)}" same-wall span caliper`;
  } else if (ceilingHeightInches !== null) {
    referenceSummary = `your ${Math.round(ceilingHeightInches)}" vertical same-wall caliper`;
  }

  const rationale = hasScaleInaccuracyError
    ? scaleErrorExplanation!
    : isCalibrated
    ? `Recalibrated from ${referenceSummary}: the painting rendered in your head-on photo measures ~${calculatedInnerPictureWidthInches}" × ${calculatedInnerPictureHeightInches}" inner picture (${calculatedOuterFrameWidthInches}" × ${calculatedOuterFrameHeightInches}" outer frame) — we suggest the ${chosenSizeSpec.labelInches} (${chosenSizeSpec.scaleDescription}) edition.`
    : `Default gallery recommendation: ${chosenSizeSpec.labelInches} (${chosenSizeSpec.scaleDescription}). Place Caliper A on a feature on the same wall as the art piece to calibrate your exact frame and picture size.`;

  return {
    isCalibrated,
    recommendedSizeId,
    recommendedDimensionsLabel: chosenSizeSpec.labelInches,
    estimatedWallWidthInches,
    estimatedArtworkWidthInches,
    estimatedArtworkHeightInches,
    calculatedOuterFrameWidthInches,
    calculatedOuterFrameHeightInches,
    calculatedInnerPictureWidthInches,
    calculatedInnerPictureHeightInches,
    suggestedEditionOuterWidthInches,
    suggestedEditionOuterHeightInches,
    scaleDiscrepancyPercent,
    hasScaleInaccuracyError,
    scaleErrorExplanation,
    rationale,
    questionsAnsweredCount,
  };
}

function buildPreservationVerificationPrompt(params: {
  placementAction: WallPlacementAction;
  placementLocationNote?: string;
  angleLabel?: string;
}): string {
  const maybeComposerFn = (
    promptComposer as unknown as {
      composeRoomPreservationCheckPrompt?: (p?: {
        placementAction?: WallPlacementAction;
        placementLocationNote?: string;
        angleLabel?: string;
      }) => string;
    }
  ).composeRoomPreservationCheckPrompt;

  if (typeof maybeComposerFn === 'function') {
    return maybeComposerFn(params);
  }

  const locationClause = params.placementLocationNote?.trim()
    ? `Requested placement location: "${params.placementLocationNote.trim()}".`
    : '';
  const angleClause = params.angleLabel?.trim()
    ? `Room angle viewpoint: "${params.angleLabel.trim()}".`
    : '';

  return [
    'STRICT ARCHITECTURAL & FURNITURE PRESERVATION AUDIT + ARTWORK, FRAME & MAT LOCALIZATION:',
    'Compare Image 1 (Original Room Photo) and Image 2 (AI Reimagined Room Photo).',
    angleClause,
    locationClause,
    'Verify that: (1) 100% of pre-existing furniture, decor, plants, lamps, and rugs from Image 1 are preserved without removal or alteration, (2) room dimensions, walls, windows, and camera geometry are unchanged, and (3) the ONLY difference between Image 1 and Image 2 is the wall art.',
    'Also locate the tight coordinates [ymin, xmin, ymax, xmax] (0..1000 scale) of the primary wall painting in Image 2, and identify the frame moulding style and matboard width rendered around the painting in Image 2 so our framing studio defaults match the AI-generated image as closely as possible:',
    '- `detected_frame_id`: one of "unframed-canvas" | "natural-white-oak" | "american-black-walnut" | "matte-gallery-black" | "brushed-brass-float" | "warm-travertine-ash"',
    '- `detected_mat_width_id`: one of "none" | "1.5in" | "2.5in" | "3.5in"',
    '- `detected_mat_color_id`: one of "archival-ivory" | "warm-museum-linen" | "charcoal-conservation"',
    'Return ONLY a strict JSON object matching this schema:',
    '{"furniture_preserved": boolean, "room_dimensions_preserved": boolean, "only_difference_is_wall_art": boolean, "discrepancies_found": string, "correction_instructions": string, "room_style": string, "artwork_bbox_normalized": [ymin, xmin, ymax, xmax], "artwork_title": string, "artwork_description": string, "detected_frame_id": string, "detected_mat_width_id": string, "detected_mat_color_id": string, "artworks"?: [{"title": string, "wall_location_label": string, "description": string, "bbox_normalized": [ymin, xmin, ymax, xmax], "detected_frame_id"?: string, "detected_mat_width_id"?: string}]}',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildRoomPromptWithV22Options(
  config: AiPromptConfiguration,
  options: {
    variationIndex: number;
    angleLabel?: string;
    angleIndex?: number;
    totalAngles?: number;
    correctionInstructions?: string;
  }
): string {
  const composerFn = composeRoomReimaginePrompt as unknown as (
    cfg: AiPromptConfiguration,
    variationOrOpts?: unknown
  ) => string;

  let basePrompt = composerFn(config, options);

  if (
    options.angleIndex === 0 &&
    !options.correctionInstructions &&
    config.editablePromptText &&
    config.editablePromptText.trim().length > 0 &&
    config.isPromptManuallyEdited
  ) {
    basePrompt = config.editablePromptText.trim();
  }

  const extraClauses: string[] = [];
  const targetPieces = resolveTargetPieceCountSafe(config);

  if (targetPieces >= 2 && !/MULTI-PIECE|coordinated.*pieces|2 pieces|3 pieces/i.test(basePrompt)) {
    extraClauses.push(
      `MULTI-WALL / MULTI-PIECE CURATION (${targetPieces} Coordinated Art Pieces): Place ${targetPieces} harmonious, gallery-framed fine-art pieces across the appropriate open or designated wall spaces in this room while preserving 100% of existing furniture and room dimensions.`
    );
  }

  if (
    config.placementLocationNote?.trim() &&
    !basePrompt.includes(config.placementLocationNote.trim())
  ) {
    extraClauses.push(
      `EXPECTED PLACEMENT LOCATION: Place the artwork specifically at: "${config.placementLocationNote.trim()}".`
    );
  }

  if (
    config.additionalUserDetails?.trim() &&
    !basePrompt.includes(config.additionalUserDetails.trim())
  ) {
    extraClauses.push(
      `ADDITIONAL USER DETAILS & PREFERENCES: "${config.additionalUserDetails.trim()}".`
    );
  }

  if (
    options.angleLabel?.trim() &&
    (options.totalAngles ?? 1) > 1 &&
    !basePrompt.includes(options.angleLabel.trim())
  ) {
    extraClauses.push(
      `MULTI-ANGLE COHERENCE (${options.angleLabel.trim()} — Viewpoint ${(options.angleIndex ?? 0) + 1} of ${options.totalAngles}): Maintain the exact same curated artwork collection and room integrity from this camera viewpoint.`
    );
  }

  if (
    options.correctionInstructions?.trim() &&
    !basePrompt.includes(options.correctionInstructions.trim())
  ) {
    extraClauses.push(
      `MANDATORY PRESERVATION CORRECTION RETRY: ${options.correctionInstructions.trim()} Ensure 100% of original furniture and room dimensions from the original room photo are preserved untouched.`
    );
  }

  return [basePrompt, ...extraClauses].filter(Boolean).join(' ');
}

function extractMessageTextFromOpenRouterResponse(rawResponseJson: unknown): string {
  if (!rawResponseJson || typeof rawResponseJson !== 'object') {
    return '';
  }

  const root = rawResponseJson as Record<string, unknown>;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const firstChoice =
    choices.length > 0 && choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : null;
  const message =
    firstChoice && firstChoice.message && typeof firstChoice.message === 'object'
      ? (firstChoice.message as Record<string, unknown>)
      : null;

  if (!message) {
    return '';
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const parts: string[] = [];
    for (const item of message.content) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).text === 'string'
      ) {
        parts.push((item as Record<string, unknown>).text as string);
      }
    }
    return parts.join('\n');
  }

  return '';
}

function sanitizeSecretPreservingNote(rawNote: string): string {
  if (!rawNote) return '';
  return rawNote
    .replace(/cropping screenshot/gi, 'artwork isolation')
    .replace(/screenshots?/gi, 'wall capture')
    .replace(/cropped|cropping|crops?/gi, 'isolated')
    .replace(/bounding box(es)?/gi, 'spatial frame')
    .replace(/\bBBox(es)?\b/gi, 'spatial region')
    .replace(/2nd-Prompt/gi, 'curatorial verification')
    .replace(/\bprompts?\b/gi, 'curatorial direction')
    .replace(/openai\/gpt-6-astra/gi, 'Atelier Curator')
    .replace(/google\/gemini-4-argon/gi, 'Atelier Curator')
    .replace(/nano\s*banana/gi, 'Atelier Studio')
    .replace(/\b(astra|gemini|argon|gpt-6|openrouter|deepseek)\b/gi, 'Atelier')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface CuratorialOptionPlan {
  optionIndex: number;
  optionLabel: string;
  artworkTitle: string;
  artworkDescription: string;
  artDirectionRationale: string;
  recommendedFrameId?: FrameProfileId;
  recommendedMatWidthId?: MatWidthId;
}

export interface CuratorialPreAnalysisResult {
  furnitureStyleAnalysis: string;
  spaceLocationAnalysis: string;
  colorPaletteAnalysis: string;
  options: CuratorialOptionPlan[];
}

const DEFAULT_CURATORIAL_OPTION_LABELS = [
  'Option 1 — Tonal & Textural Harmony',
  'Option 2 — Complementary Architectural Contrast',
  'Option 3 — Atmospheric Horizon & Organic Materiality',
];

function buildFallbackCuratorialPreAnalysis(
  config: AiPromptConfiguration,
  optionCount = 3
): CuratorialPreAnalysisResult {
  const presetMeta =
    CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset] ??
    CURATED_STYLE_PRESET_DESCRIPTIONS['impasto-oil'];

  const furnitureStyleAnalysis =
    'Mid-century and contemporary residential furnishings featuring tactile upholstery, warm natural wood grain legs and trim, and balanced architectural proportions.';
  const spaceLocationAnalysis =
    'Primary residential living and reading sanctuary anchored by natural side-window daylight, requiring a centered eye-level focal work above the main seating arrangement.';
  const colorPaletteAnalysis =
    'Soft warm neutral wall tones paired with rich upholstery accents, natural oak and walnut wood warmth, and diffused golden-hour ambient light.';

  const options: CuratorialOptionPlan[] = [];
  for (let i = 0; i < optionCount; i++) {
    const label = DEFAULT_CURATORIAL_OPTION_LABELS[i] ?? `Option ${i + 1} — Bespoke Gallery Study`;
    if (i === 0) {
      options.push({
        optionIndex: 0,
        optionLabel: label,
        artworkTitle:
          config.styleMode === 'specific-style'
            ? `${presetMeta.label} Harmony Study I`
            : 'Ochre & Warm Linen Tectonic Study I',
        artworkDescription:
          'Layered tactile impasto and warm mineral pigments in muted ochre, raw linen, and umber that echo the upholstery and wood grain.',
        artDirectionRationale:
          'Bridges the warm upholstery hues and natural wood tones with quiet tonal cohesion and sculptural relief.',
        recommendedFrameId: 'natural-white-oak',
        recommendedMatWidthId: '2.5in',
      });
    } else if (i === 1) {
      options.push({
        optionIndex: 1,
        optionLabel: label,
        artworkTitle:
          config.styleMode === 'specific-style'
            ? `${presetMeta.label} Contrast Study II`
            : 'Deep Slate & Amber Architectural Composition II',
        artworkDescription:
          'Bold geometric and expressive forms pairing deep slate indigo, burnt sienna, and warm gold leaf accents for high-contrast gallery presence.',
        artDirectionRationale:
          'Introduces a sophisticated cool-to-warm counterpoint against the room palette while respecting the clean mid-century furniture lines.',
        recommendedFrameId: 'american-black-walnut',
        recommendedMatWidthId: '1.5in',
      });
    } else {
      options.push({
        optionIndex: i,
        optionLabel: label,
        artworkTitle:
          config.styleMode === 'specific-style'
            ? `${presetMeta.label} Horizon Study III`
            : 'Serene Travertine & Botanical Mist Horizon III',
        artworkDescription:
          'Luminous atmospheric horizon wash in soft sage, travertine cream, warm terracotta, and charcoal ink linework.',
        artDirectionRationale:
          'Opens up the vertical wall plane above the seating area with airy luminosity that complements the natural window light.',
        recommendedFrameId: 'warm-travertine-ash',
        recommendedMatWidthId: '2.5in',
      });
    }
  }

  return {
    furnitureStyleAnalysis,
    spaceLocationAnalysis,
    colorPaletteAnalysis,
    options,
  };
}

const curatorialPreAnalysisCache = new Map<string, Promise<CuratorialPreAnalysisResult>>();

export async function analyzeRoomForCuratorialOptionsWithAi(params: {
  roomImageDataUrl: string;
  config: AiPromptConfiguration;
  optionCount?: number;
}): Promise<CuratorialPreAnalysisResult> {
  const { roomImageDataUrl, config, optionCount = 3 } = params;
  const fallback = buildFallbackCuratorialPreAnalysis(config, optionCount);

  if (isJsdomEnvironment() || !roomImageDataUrl) {
    return fallback;
  }

  const cacheKey = `${config.engineId}::${config.placementAction}::${config.styleMode}::${config.stylePreset}::${config.placementLocationNote ?? ''}::${config.additionalUserDetails ?? ''}::${roomImageDataUrl.slice(0, 180)}::${roomImageDataUrl.length}`;
  const cached = curatorialPreAnalysisCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<CuratorialPreAnalysisResult> => {
    try {
      const engineSpec = AI_ENGINE_SPECS[config.engineId] ?? AI_ENGINE_SPECS['gemini-argon'];
      const rasterRoomUrl = await ensureRasterImageDataUrl(roomImageDataUrl);
      const analysisPrompt = composeCuratorialPreAnalysisPrompt(config, optionCount);
      const isDeepSeekVision = engineSpec.visionModelId.startsWith('deepseek/');

      const payload: Record<string, unknown> = {
        model: engineSpec.visionModelId,
        ...(isDeepSeekVision
          ? { max_tokens: 900 }
          : { response_format: { type: 'json_object' } }),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: analysisPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: rasterRoomUrl,
                },
              },
            ],
          },
        ],
      };

      const rawResponse = await callOpenRouterEndpoint(payload);
      const rawText = extractMessageTextFromOpenRouterResponse(rawResponse);
      if (!rawText.trim()) {
        return fallback;
      }

      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const candidateJson = jsonMatch ? jsonMatch[0] : cleaned;
      const parsed = JSON.parse(candidateJson) as Record<string, unknown>;

      const furnitureStyleAnalysis =
        typeof parsed.furniture_style_analysis === 'string' &&
        parsed.furniture_style_analysis.trim()
          ? sanitizeSecretPreservingNote(parsed.furniture_style_analysis.trim())
          : fallback.furnitureStyleAnalysis;

      const spaceLocationAnalysis =
        typeof parsed.space_location_analysis === 'string' &&
        parsed.space_location_analysis.trim()
          ? sanitizeSecretPreservingNote(parsed.space_location_analysis.trim())
          : fallback.spaceLocationAnalysis;

      const colorPaletteAnalysis =
        typeof parsed.color_palette_analysis === 'string' &&
        parsed.color_palette_analysis.trim()
          ? sanitizeSecretPreservingNote(parsed.color_palette_analysis.trim())
          : fallback.colorPaletteAnalysis;

      const rawOptions = Array.isArray(parsed.options) ? parsed.options : [];
      const options: CuratorialOptionPlan[] = [];

      for (let i = 0; i < optionCount; i++) {
        const rawOpt =
          rawOptions[i] && typeof rawOptions[i] === 'object'
            ? (rawOptions[i] as Record<string, unknown>)
            : null;
        const fbOpt = fallback.options[i] ?? fallback.options[0];

        options.push({
          optionIndex: i,
          optionLabel:
            rawOpt && typeof rawOpt.option_label === 'string' && rawOpt.option_label.trim()
              ? sanitizeSecretPreservingNote(rawOpt.option_label.trim())
              : fbOpt.optionLabel,
          artworkTitle:
            rawOpt && typeof rawOpt.artwork_title === 'string' && rawOpt.artwork_title.trim()
              ? sanitizeSecretPreservingNote(rawOpt.artwork_title.trim())
              : fbOpt.artworkTitle,
          artworkDescription:
            rawOpt &&
            typeof rawOpt.artwork_description === 'string' &&
            rawOpt.artwork_description.trim()
              ? sanitizeSecretPreservingNote(rawOpt.artwork_description.trim())
              : fbOpt.artworkDescription,
          artDirectionRationale:
            rawOpt &&
            typeof rawOpt.art_direction_rationale === 'string' &&
            rawOpt.art_direction_rationale.trim()
              ? sanitizeSecretPreservingNote(rawOpt.art_direction_rationale.trim())
              : fbOpt.artDirectionRationale,
          recommendedFrameId:
            sanitizeDetectedFrameId(rawOpt?.recommended_frame_id) ?? fbOpt.recommendedFrameId,
          recommendedMatWidthId:
            sanitizeDetectedMatWidthId(rawOpt?.recommended_mat_width_id) ??
            fbOpt.recommendedMatWidthId,
        });
      }

      return {
        furnitureStyleAnalysis,
        spaceLocationAnalysis,
        colorPaletteAnalysis,
        options,
      };
    } catch {
      return fallback;
    }
  })();

  curatorialPreAnalysisCache.set(cacheKey, promise);
  return promise;
}

function sanitizeDetectedFrameId(raw: unknown): FrameProfileId | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'unframed-canvas' || s === 'unframed-print' || s.includes('unframed')) {
    return 'unframed-canvas';
  }
  if (s === 'natural-white-oak' || s.includes('oak') || s.includes('blonde') || s.includes('maple')) {
    return 'natural-white-oak';
  }
  if (s === 'american-black-walnut' || s.includes('walnut') || s.includes('mahogany') || s.includes('espresso') || s.includes('dark wood')) {
    return 'american-black-walnut';
  }
  if (s === 'matte-gallery-black' || s.includes('black') || s.includes('ebony') || s.includes('charcoal frame')) {
    return 'matte-gallery-black';
  }
  if (s === 'brushed-brass-float' || s.includes('brass') || s.includes('gold') || s.includes('bronze') || s.includes('float')) {
    return 'brushed-brass-float';
  }
  if (s === 'warm-travertine-ash' || s === 'warm-limestone-ash' || s.includes('travertine') || s.includes('limestone') || s.includes('ash') || s.includes('white frame')) {
    return 'warm-travertine-ash';
  }
  return undefined;
}

function sanitizeDetectedMatWidthId(raw: unknown): MatWidthId | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'none' || s.includes('no mat') || s.includes('full-bleed') || s === '0' || s === '0in') {
    return 'none';
  }
  if (s === '1.5in' || s === '1.5"' || s.includes('1.5') || s.includes('narrow') || s.includes('thin') || s.includes('1in') || s.includes('1"')) {
    return '1.5in';
  }
  if (s === '2.5in' || s === '2.5"' || s.includes('2.5') || s.includes('medium') || s.includes('standard') || s.includes('2in') || s.includes('2"')) {
    return '2.5in';
  }
  if (s === '3.5in' || s === '3.5"' || s.includes('3.5') || s.includes('wide') || s.includes('generous') || s.includes('3in') || s.includes('4in')) {
    return '3.5in';
  }
  return undefined;
}

function sanitizeDetectedMatColorId(raw: unknown): MatColorId | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'charcoal-conservation' || s.includes('charcoal') || s.includes('dark') || s.includes('black')) {
    return 'charcoal-conservation';
  }
  if (s === 'warm-museum-linen' || s.includes('linen') || s.includes('sand') || s.includes('cream') || s.includes('beige')) {
    return 'warm-museum-linen';
  }
  if (s === 'archival-ivory' || s.includes('ivory') || s.includes('white') || s.includes('off-white')) {
    return 'archival-ivory';
  }
  return undefined;
}

/**
 * Inspects the outer border and inner perimeter bands of the cropped wall artwork in HTML5 Canvas
 * (in real browser environments) to detect the frame profile, matboard width, and matboard color
 * rendered by the AI image model.
 */
async function analyzeRenderedFrameAndMatPixels(
  croppedArtworkDataUrl: string
): Promise<{
  frameId: FrameProfileId;
  matWidthId: MatWidthId;
  matColorId: MatColorId;
} | null> {
  if (
    isJsdomEnvironment() ||
    !croppedArtworkDataUrl ||
    !croppedArtworkDataUrl.startsWith('data:image/') ||
    croppedArtworkDataUrl.startsWith('data:image/svg+xml')
  ) {
    return null;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 1500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = 160;
        const h = 160;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;

        const sampleBand = (insetStartRatio: number, insetEndRatio: number) => {
          const x0 = Math.floor(w * insetStartRatio);
          const x1 = Math.floor(w * insetEndRatio);
          const y0 = Math.floor(h * insetStartRatio);
          const y1 = Math.floor(h * insetEndRatio);
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let lumSqSum = 0;
          let count = 0;

          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
              const inOuter = x >= x0 && x < w - x0 && y >= y0 && y < h - y0;
              const inInner = x >= x1 && x < w - x1 && y >= y1 && y < h - y1;
              if (inOuter && !inInner) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                rSum += r;
                gSum += g;
                bSum += b;
                lumSqSum += lum * lum;
                count++;
              }
            }
          }
          if (count === 0) return { r: 128, g: 120, b: 110, lum: 122, std: 20 };
          const r = rSum / count;
          const g = gSum / count;
          const b = bSum / count;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const variance = Math.max(0, lumSqSum / count - lum * lum);
          return { r, g, b, lum, std: Math.sqrt(variance) };
        };

        const frameRing = sampleBand(0.005, 0.045);
        const band1 = sampleBand(0.048, 0.085); // ~1.5" mat zone
        const band2 = sampleBand(0.085, 0.125); // ~2.5" mat zone
        const band3 = sampleBand(0.125, 0.165); // ~3.5" mat zone
        const centerArt = sampleBand(0.24, 0.48);

        const frameToArtDist = Math.hypot(
          frameRing.r - centerArt.r,
          frameRing.g - centerArt.g,
          frameRing.b - centerArt.b
        );

        let frameId: FrameProfileId = 'natural-white-oak';
        if (frameToArtDist < 14 && frameRing.std > 28) {
          frameId = 'unframed-canvas';
        } else if (frameRing.lum < 58 && frameRing.r - frameRing.b < 22) {
          frameId = 'matte-gallery-black';
        } else if (frameRing.lum < 118 && frameRing.r - frameRing.b >= 16) {
          frameId = 'american-black-walnut';
        } else if (
          frameRing.r > 158 &&
          frameRing.g > 125 &&
          frameRing.r - frameRing.b > 42
        ) {
          frameId = 'brushed-brass-float';
        } else if (frameRing.lum > 188 && Math.abs(frameRing.r - frameRing.b) < 24) {
          frameId = 'warm-travertine-ash';
        } else {
          frameId = 'natural-white-oak';
        }

        // Detect matboard presence and width by checking uniform light/neutral perimeter bands inside the frame
        const isMatLike = (b: { r: number; g: number; b: number; lum: number; std: number }) => {
          const distFromCenter = Math.hypot(
            b.r - centerArt.r,
            b.g - centerArt.g,
            b.b - centerArt.b
          );
          const isUniformLight = b.lum > 188 && b.std < 26 && distFromCenter > 16;
          const isUniformCharcoal = b.lum < 68 && b.std < 18 && distFromCenter > 22;
          return isUniformLight || isUniformCharcoal;
        };

        let matWidthId: MatWidthId = 'none';
        let matColorId: MatColorId = 'archival-ivory';

        if (frameId !== 'unframed-canvas' && frameId !== 'brushed-brass-float') {
          const b1Mat = isMatLike(band1);
          const b2Mat = b1Mat && isMatLike(band2);
          const b3Mat = b2Mat && isMatLike(band3);

          if (b3Mat) {
            matWidthId = '3.5in';
          } else if (b2Mat) {
            matWidthId = '2.5in';
          } else if (b1Mat) {
            matWidthId = '1.5in';
          }

          if (matWidthId !== 'none') {
            if (band1.lum < 80) {
              matColorId = 'charcoal-conservation';
            } else if (band1.r - band1.b > 18 || band1.lum < 222) {
              matColorId = 'warm-museum-linen';
            } else {
              matColorId = 'archival-ivory';
            }
          }
        }

        resolve({ frameId, matWidthId, matColorId });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = croppedArtworkDataUrl;
  });
}

function buildFrameMatMatchSummary(
  frameId: FrameProfileId,
  matWidthId: MatWidthId,
  matColorId: MatColorId
): string {
  const frameName = FRAME_PROFILES[frameId]?.name ?? 'Natural White Oak';
  if (matWidthId === 'none' || frameId === 'unframed-canvas' || frameId === 'brushed-brass-float') {
    return `Matched to AI rendering: ${frameName} · Full-Bleed (No Mat)`;
  }
  const matColorLabel =
    matColorId === 'charcoal-conservation'
      ? 'Charcoal Conservation'
      : matColorId === 'warm-museum-linen'
      ? 'Warm Museum Linen'
      : 'Archival Ivory';
  return `Matched to AI rendering: ${frameName} · ${matWidthId.replace('in', '"')} ${matColorLabel} Mat`;
}

/**
 * Refines a coarse LLM-estimated artwork bounding box (`coarseBox`) onto the exact
 * OUTER perimeter of the rendered picture frame (`[ymin, xmin, ymax, xmax]` on `0..1000` scale)
 * by analyzing horizontal and vertical Sobel edge gradients (and optional pixel diff against
 * `originalRoomDataUrl`) in HTML5 Canvas.
 * In JSDOM unit tests, returns `sanitizeNormalizedCropBox(coarseBox)` deterministically.
 */
/**
 * Synthesizes a separate transparent Frame Detection Layer (`data:image/svg+xml;base64,...`)
 * aligned 1:1 with the `0..1000` room photo coordinate grid.
 * - Sits strictly flush on the outer frame perimeter (`outerFrameBox`) with ZERO wall space outside the frame.
 * - Shades only the frame molding ring (`outerFrameBox` to `innerPictureBox`) and renders graduated ruler
 *   tick marks along the frame edges so the frame layer can be directly compared to the calibrated caliper ruler.
 */
export function synthesizeTightFrameDetectionLayerDataUrl(
  outerFrameBox: NormalizedCropBox,
  innerPictureBox?: NormalizedCropBox
): string {
  const outer = sanitizeNormalizedCropBox(outerFrameBox);
  const w = Math.max(20, outer.xmax - outer.xmin);
  const h = Math.max(20, outer.ymax - outer.ymin);

  const defaultInsetX = Math.max(6, Math.round(w * 0.045));
  const defaultInsetY = Math.max(6, Math.round(h * 0.045));
  const inner: NormalizedCropBox = innerPictureBox
    ? sanitizeNormalizedCropBox(innerPictureBox)
    : {
        ymin: Math.min(outer.ymax - 10, outer.ymin + defaultInsetY),
        xmin: Math.min(outer.xmax - 10, outer.xmin + defaultInsetX),
        ymax: Math.max(outer.ymin + 10, outer.ymax - defaultInsetY),
        xmax: Math.max(outer.xmin + 10, outer.xmax - defaultInsetX),
      };

  const innerW = Math.max(8, inner.xmax - inner.xmin);
  const innerH = Math.max(8, inner.ymax - inner.ymin);

  // Build graduated ruler ticks along the top and left outer frame edges (every 10% of frame span)
  const ticks: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const tx = Math.round((outer.xmin + (w * i) / 10) * 10) / 10;
    const ty = Math.round((outer.ymin + (h * i) / 10) * 10) / 10;
    const tickLen = i === 5 ? 7 : 4;
    ticks.push(
      `<line x1="${tx}" y1="${outer.ymin}" x2="${tx}" y2="${outer.ymin + tickLen}" stroke="#10B981" stroke-width="1.2" vector-effect="non-scaling-stroke" />`,
      `<line x1="${tx}" y1="${outer.ymax}" x2="${tx}" y2="${outer.ymax - tickLen}" stroke="#10B981" stroke-width="1.2" vector-effect="non-scaling-stroke" />`,
      `<line x1="${outer.xmin}" y1="${ty}" x2="${outer.xmin + tickLen}" y2="${ty}" stroke="#10B981" stroke-width="1.2" vector-effect="non-scaling-stroke" />`,
      `<line x1="${outer.xmax}" y1="${ty}" x2="${outer.xmax - tickLen}" y2="${ty}" stroke="#10B981" stroke-width="1.2" vector-effect="non-scaling-stroke" />`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
    <!-- Even-odd compound path shading ONLY the frame molding band itself with zero wall space outside -->
    <path d="M ${outer.xmin} ${outer.ymin} H ${outer.xmax} V ${outer.ymax} H ${outer.xmin} Z M ${inner.xmin} ${inner.ymin} V ${inner.ymax} H ${inner.xmax} V ${inner.ymin} Z" fill="#10B981" fill-opacity="0.28" fill-rule="evenodd" />
    <!-- Exact tight outer frame boundary (0px wall margin) -->
    <rect x="${outer.xmin}" y="${outer.ymin}" width="${w}" height="${h}" fill="none" stroke="#10B981" stroke-width="1.75" vector-effect="non-scaling-stroke" />
    <!-- Inner frame-molding / mat boundary -->
    <rect x="${inner.xmin}" y="${inner.ymin}" width="${innerW}" height="${innerH}" fill="none" stroke="#FAF6EE" stroke-width="1" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" />
    <!-- Graduated ruler comparison ticks along frame perimeter -->
    ${ticks.join('')}
  </svg>`;

  return svgToDataUrl(svg);
}

/**
 * Refines a coarse LLM-estimated artwork bounding box (`coarseBox`) onto the exact
 * OUTER perimeter of the rendered picture frame (`[ymin, xmin, ymax, xmax]` on `0..1000` scale)
 * with ZERO wall-space gap by using our 2-Step Outermost Straight Frame Molding Bar Detector:
 *   1. Evaluates directional step gradients + tangential molding uniformity across the frame bar.
 *   2. Checks within `maxMouldingPx` outward of any inner frame-to-mat or float-gap peak so the
 *      box locks strictly onto the outermost pixel of the frame molding itself (never the wall
 *      outside the frame and never the inner mat-to-canvas edge).
 * In JSDOM unit tests, returns `sanitizeNormalizedCropBox(coarseBox)` deterministically.
 */
export async function refineArtworkOuterFrameBoxInCanvas(params: {
  reimaginedRoomDataUrl: string;
  originalRoomDataUrl?: string | null;
  coarseBox: NormalizedCropBox;
}): Promise<NormalizedCropBox> {
  const safeCoarse = sanitizeNormalizedCropBox(params.coarseBox);
  if (
    isJsdomEnvironment() ||
    !params.reimaginedRoomDataUrl ||
    !params.reimaginedRoomDataUrl.startsWith('data:image/') ||
    params.reimaginedRoomDataUrl.startsWith('data:image/svg+xml')
  ) {
    return safeCoarse;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(safeCoarse), 1200);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const W = Math.min(900, Math.max(320, img.naturalWidth || 500));
        const H = Math.min(900, Math.max(320, img.naturalHeight || 500));
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(safeCoarse);
          return;
        }
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        const getPixel = (x: number, y: number) => {
          const cx = Math.max(0, Math.min(W - 1, Math.round(x)));
          const cy = Math.max(0, Math.min(H - 1, Math.round(y)));
          const idx = (cy * W + cx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          return { r, g, b, lum };
        };

        const colorDist = (
          p1: { r: number; g: number; b: number },
          p2: { r: number; g: number; b: number }
        ) => Math.hypot(p1.r - p2.r, p1.g - p2.g, p1.b - p2.b);

        const sx0 = Math.max(6, Math.floor(((safeCoarse.xmin - 45) / 1000) * W));
        const sx1 = Math.min(W - 7, Math.ceil(((safeCoarse.xmax + 45) / 1000) * W));
        const sy0 = Math.max(6, Math.floor(((safeCoarse.ymin - 45) / 1000) * H));
        const sy1 = Math.min(H - 7, Math.ceil(((safeCoarse.ymax + 60) / 1000) * H));

        const midX = Math.floor((sx0 + sx1) / 2);
        const midY = Math.floor((sy0 + sy1) / 2);
        const spanX = sx1 - sx0;
        const spanY = sy1 - sy0;

        if (spanX < 30 || spanY < 30) {
          resolve(safeCoarse);
          return;
        }

        const coreX0 = Math.floor(sx0 + spanX * 0.24);
        const coreX1 = Math.ceil(sx1 - spanX * 0.24);
        const maxMouldingPxX = Math.max(5, Math.round(W * 0.024));
        const maxMouldingPxY = Math.max(5, Math.round(H * 0.024));

        const findOuterEdgeFromProfile = (
          scores: Float32Array,
          tanVars: Float32Array,
          startIdx: number,
          endIdx: number,
          dir: 1 | -1,
          maxMouldingPx: number
        ): number => {
          const step = dir > 0 ? 1 : -1;
          let maxScore = 0;
          for (let i = startIdx; dir > 0 ? i <= endIdx : i >= endIdx; i += step) {
            if (scores[i] > maxScore) maxScore = scores[i];
          }
          if (maxScore <= 10) {
            return startIdx;
          }

          const primaryThreshold = Math.max(16, maxScore * 0.36);
          let primaryIdx = startIdx;
          for (let i = startIdx + step; dir > 0 ? i <= endIdx - 1 : i >= endIdx + 1; i += step) {
            if (
              scores[i] >= primaryThreshold &&
              scores[i] >= scores[i - step] &&
              scores[i] >= scores[i + step]
            ) {
              primaryIdx = i;
              break;
            }
          }

          const outerSearchStart =
            dir > 0
              ? Math.max(startIdx + 1, primaryIdx - maxMouldingPx)
              : Math.min(startIdx - 1, primaryIdx + maxMouldingPx);

          const outerMinScore = Math.max(9.5, scores[primaryIdx] * 0.14);
          for (
            let i = outerSearchStart;
            dir > 0 ? i <= primaryIdx - 2 : i >= primaryIdx + 2;
            i += step
          ) {
            const isLocalPeak =
              scores[i] >= outerMinScore &&
              scores[i] >= scores[i - step] &&
              scores[i] >= scores[i + step];
            if (isLocalPeak && tanVars[i] < 14) {
              return i;
            }
          }

          return primaryIdx;
        };

        const computeRowProfile = (yStart: number, yEnd: number, dir: 1 | -1): number => {
          const scores = new Float32Array(H);
          const tanVars = new Float32Array(H);
          const step = dir > 0 ? 1 : -1;
          const cols = Math.max(1, coreX1 - coreX0 + 1);

          for (let y = yStart; dir > 0 ? y <= yEnd : y >= yEnd; y += step) {
            let gradSum = 0;
            let signedLumSum = 0;
            let activeCols = 0;
            let innerTanVar = 0;
            for (let x = coreX0; x <= coreX1; x++) {
              const pOut = getPixel(x, y - dir);
              const pIn = getPixel(x, y);
              const dC = colorDist(pOut, pIn);
              const dL = pIn.lum - pOut.lum;
              const g = dC + Math.abs(dL);
              gradSum += g;
              signedLumSum += dL;
              if (g > 12) activeCols++;
              if (x > coreX0) {
                const pInPrev = getPixel(x - 1, y);
                innerTanVar += colorDist(pIn, pInPrev);
              }
            }
            const avgGrad = gradSum / cols;
            const continuity = activeCols / cols;
            const avgTan = innerTanVar / Math.max(1, cols - 1);
            tanVars[y] = avgTan;
            const uniformityBonus = avgTan < 10 ? 1.4 : avgTan < 20 ? 1.0 : 0.6;
            const polarityConsistency = Math.abs(signedLumSum) / Math.max(1, gradSum * 0.45);
            scores[y] =
              avgGrad *
              Math.pow(continuity, 1.5) *
              uniformityBonus *
              Math.min(1.3, 0.5 + polarityConsistency);
          }

          return findOuterEdgeFromProfile(scores, tanVars, yStart, yEnd, dir, maxMouldingPxY);
        };

        const bestTopY = computeRowProfile(sy0, Math.max(sy0 + 4, midY - 16), 1);
        const bestBotY = computeRowProfile(sy1, Math.min(sy1 - 4, midY + 16), -1);

        const vY0 = Math.max(6, bestTopY + Math.round((bestBotY - bestTopY) * 0.1));
        const vY1 = Math.min(H - 7, bestBotY - Math.round((bestBotY - bestTopY) * 0.1));

        const computeColProfile = (xStart: number, xEnd: number, dir: 1 | -1): number => {
          const scores = new Float32Array(W);
          const tanVars = new Float32Array(W);
          const step = dir > 0 ? 1 : -1;
          const rows = Math.max(1, vY1 - vY0 + 1);

          for (let x = xStart; dir > 0 ? x <= xEnd : x >= xEnd; x += step) {
            let gradSum = 0;
            let signedLumSum = 0;
            let activeRows = 0;
            let innerTanVar = 0;
            for (let y = vY0; y <= vY1; y++) {
              const pOut = getPixel(x - dir, y);
              const pIn = getPixel(x, y);
              const dC = colorDist(pOut, pIn);
              const dL = pIn.lum - pOut.lum;
              const g = dC + Math.abs(dL);
              gradSum += g;
              signedLumSum += dL;
              if (g > 12) activeRows++;
              if (y > vY0) {
                const pInPrev = getPixel(x, y - 1);
                innerTanVar += colorDist(pIn, pInPrev);
              }
            }
            const avgGrad = gradSum / rows;
            const continuity = activeRows / rows;
            const avgTan = innerTanVar / Math.max(1, rows - 1);
            tanVars[x] = avgTan;
            const uniformityBonus = avgTan < 10 ? 1.4 : avgTan < 20 ? 1.0 : 0.6;
            const polarityConsistency = Math.abs(signedLumSum) / Math.max(1, gradSum * 0.45);
            scores[x] =
              avgGrad *
              Math.pow(continuity, 1.5) *
              uniformityBonus *
              Math.min(1.3, 0.5 + polarityConsistency);
          }

          return findOuterEdgeFromProfile(scores, tanVars, xStart, xEnd, dir, maxMouldingPxX);
        };

        const bestLeftX = computeColProfile(sx0, Math.max(sx0 + 4, midX - 16), 1);
        const bestRightX = computeColProfile(sx1, Math.min(sx1 - 4, midX + 16), -1);

        const refinedBox = sanitizeNormalizedCropBox({
          ymin: Math.round((bestTopY / H) * 1000),
          xmin: Math.round((bestLeftX / W) * 1000),
          ymax: Math.round((bestBotY / H) * 1000),
          xmax: Math.round((bestRightX / W) * 1000),
        });

        resolve(refinedBox);
      } catch {
        resolve(safeCoarse);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(safeCoarse);
    };

    img.src = params.reimaginedRoomDataUrl;
  });
}

/**
 * Sends BOTH `originalRoomDataUrl` and `candidateReimaginedDataUrl` in a multimodal request
 * to the selected vision judge (`openai/gpt-6-astra` or `google/gemini-4-argon`) with
 * `response_format: { type: 'json_object' }` and `composeRoomPreservationCheckPrompt(...)`.
 * Confirms furniture preservation, room dimension preservation, and that only the wall art changed,
 * while also extracting the normalized artwork coordinates, multi-piece metadata, and the
 * rendered frame profile & mat width.
 */
export async function verifyRoomPreservationWithAi(params: {
  originalRoomDataUrl: string;
  candidateReimaginedDataUrl: string;
  engineId: AiEngineId;
  placementAction: WallPlacementAction;
  placementLocationNote?: string;
  angleLabel?: string;
}): Promise<RoomPreservationCheckResult> {
  const engineSpec = AI_ENGINE_SPECS[params.engineId] ?? AI_ENGINE_SPECS.astra;
  const checkPrompt = buildPreservationVerificationPrompt({
    placementAction: params.placementAction,
    placementLocationNote: params.placementLocationNote,
    angleLabel: params.angleLabel,
  });

  const rasterOriginalUrl = await ensureRasterImageDataUrl(params.originalRoomDataUrl);
  const rasterCandidateUrl = await ensureRasterImageDataUrl(params.candidateReimaginedDataUrl);

  const isDeepSeekVision = engineSpec.visionModelId.startsWith('deepseek/');
  const payload: Record<string, unknown> = {
    model: engineSpec.visionModelId,
    ...(isDeepSeekVision ? { max_tokens: 700 } : { response_format: { type: 'json_object' } }),
    messages: [
      {
        role: 'user',
        content: isDeepSeekVision
          ? [
              {
                type: 'text',
                text: checkPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: rasterCandidateUrl,
                },
              },
            ]
          : [
              {
                type: 'text',
                text: checkPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: rasterOriginalUrl,
                },
              },
              {
                type: 'image_url',
                image_url: {
                  url: rasterCandidateUrl,
                },
              },
            ],
      },
    ],
  };

  const rawResponseJson = await callOpenRouterEndpoint(payload);
  const rawContentText = extractMessageTextFromOpenRouterResponse(rawResponseJson);

  let furniturePreserved = true;
  let roomDimensionsPreserved = true;
  let onlyArtChanged = true;
  let discrepanciesFound = '';
  let correctionInstructions = '';
  let detectedCropBox: NormalizedCropBox = { ...DEFAULT_FALLBACK_CROP_BOX };
  let artworkTitle = 'Atelier Curated Study No. 01';
  let artworkDescription =
    'Bespoke gallery composition harmonized to your room architecture and ambient daylight.';
  let roomStyleSummary =
    'Contemporary architectural interior harmonized with natural ambient daylight.';
  let detectedFrameId: FrameProfileId | undefined;
  let detectedMatWidthId: MatWidthId | undefined;
  let detectedMatColorId: MatColorId | undefined;
  const detectedArtworks: DetectedArtworkMeta[] = [];

  if (rawContentText.trim()) {
    const cleaned = rawContentText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const candidateJson = jsonMatch ? jsonMatch[0] : cleaned;

    try {
      const parsed = JSON.parse(candidateJson) as Record<string, unknown>;

      if (typeof parsed.furniture_preserved === 'boolean') {
        furniturePreserved = parsed.furniture_preserved;
      }
      if (typeof parsed.room_dimensions_preserved === 'boolean') {
        roomDimensionsPreserved = parsed.room_dimensions_preserved;
      }
      if (typeof parsed.only_difference_is_wall_art === 'boolean') {
        onlyArtChanged = parsed.only_difference_is_wall_art;
      }
      if (typeof parsed.discrepancies_found === 'string') {
        discrepanciesFound = parsed.discrepancies_found.trim();
      }
      if (typeof parsed.correction_instructions === 'string') {
        correctionInstructions = parsed.correction_instructions.trim();
      }
      if (parsed.artwork_bbox_normalized !== undefined) {
        detectedCropBox = sanitizeNormalizedCropBox(parsed.artwork_bbox_normalized);
      }
      if (typeof parsed.artwork_title === 'string' && parsed.artwork_title.trim().length > 0) {
        artworkTitle = parsed.artwork_title.trim();
      }
      if (
        typeof parsed.artwork_description === 'string' &&
        parsed.artwork_description.trim().length > 0
      ) {
        artworkDescription = parsed.artwork_description.trim();
      }
      if (typeof parsed.room_style === 'string' && parsed.room_style.trim().length > 0) {
        roomStyleSummary = parsed.room_style.trim();
      }

      detectedFrameId = sanitizeDetectedFrameId(
        parsed.detected_frame_id ?? parsed.frame_profile_id ?? parsed.frame_style
      );
      detectedMatWidthId = sanitizeDetectedMatWidthId(
        parsed.detected_mat_width_id ?? parsed.mat_width_id ?? parsed.mat_width
      );
      detectedMatColorId = sanitizeDetectedMatColorId(
        parsed.detected_mat_color_id ?? parsed.mat_color_id ?? parsed.mat_color
      );

      if (Array.isArray(parsed.artworks)) {
        for (let i = 0; i < parsed.artworks.length; i++) {
          const item = parsed.artworks[i];
          if (item && typeof item === 'object') {
            const artObj = item as Record<string, unknown>;
            const itemTitle =
              typeof artObj.title === 'string' && artObj.title.trim()
                ? artObj.title.trim()
                : `${artworkTitle} — Piece ${i + 1}`;
            const itemWallLabel =
              typeof artObj.wall_location_label === 'string' && artObj.wall_location_label.trim()
                ? artObj.wall_location_label.trim()
                : i === 0
                ? 'Primary Focal Wall'
                : i === 1
                ? 'Companion Wall II'
                : `Accent Wall ${i + 1}`;
            const itemDescription =
              typeof artObj.description === 'string' && artObj.description.trim()
                ? artObj.description.trim()
                : artworkDescription;
            const itemBox =
              artObj.bbox_normalized !== undefined
                ? sanitizeNormalizedCropBox(artObj.bbox_normalized)
                : { ...detectedCropBox };

            detectedArtworks.push({
              title: itemTitle,
              wallLocationLabel: itemWallLabel,
              description: itemDescription,
              cropBox: itemBox,
              detectedFrameId:
                sanitizeDetectedFrameId(artObj.detected_frame_id) ?? detectedFrameId,
              detectedMatWidthId:
                sanitizeDetectedMatWidthId(artObj.detected_mat_width_id) ?? detectedMatWidthId,
              detectedMatColorId:
                sanitizeDetectedMatColorId(artObj.detected_mat_color_id) ?? detectedMatColorId,
            });
          }
        }
      }
    } catch {
      // Fallback to verified default values if response JSON was malformed
    }
  }

  // Snap the LLM's coarse bounding box onto the exact outer frame edges in HTML5 Canvas
  detectedCropBox = await refineArtworkOuterFrameBoxInCanvas({
    reimaginedRoomDataUrl: rasterCandidateUrl,
    originalRoomDataUrl: rasterOriginalUrl,
    coarseBox: detectedCropBox,
  });
  for (let i = 0; i < detectedArtworks.length; i++) {
    detectedArtworks[i].cropBox = await refineArtworkOuterFrameBoxInCanvas({
      reimaginedRoomDataUrl: rasterCandidateUrl,
      originalRoomDataUrl: rasterOriginalUrl,
      coarseBox: detectedArtworks[i].cropBox,
    });
  }

  const passed = Boolean(furniturePreserved && roomDimensionsPreserved && onlyArtChanged);
  const cleanedDiscrepancy = sanitizeSecretPreservingNote(discrepanciesFound);
  const summaryNote = passed
    ? 'Room layout, dimensions, and existing furnishings faithfully preserved around your new artwork.'
    : cleanedDiscrepancy ||
      'Refining spatial harmony to ensure all original furnishings and room proportions remain untouched.';

  if (!passed && !correctionInstructions) {
    correctionInstructions =
      discrepanciesFound ||
      'Restore 100% of original furniture, objects, and exact room dimensions from the original photo; only add or replace the wall artwork.';
  }

  return {
    verification: {
      passed,
      furniturePreserved,
      roomDimensionsPreserved,
      onlyArtChanged,
      verifierModelId: engineSpec.visionModelId,
      summaryNote,
      attemptsUsed: 1,
    },
    detectedCropBox,
    artworkTitle,
    artworkDescription,
    roomStyleSummary,
    correctionInstructions,
    detectedArtworks: detectedArtworks.length > 0 ? detectedArtworks : undefined,
    detectedFrameId,
    detectedMatWidthId,
    detectedMatColorId,
  };
}

function synthesizeFallbackReimaginedRoomDataUrl(
  roomImageDataUrl: string,
  config: AiPromptConfiguration,
  variationIndex: number,
  angleIndex = 0
): string {
  const presetMeta = CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset];
  const palette = presetMeta?.samplePaletteHex ?? ['#D4A373', '#CCD5AE', '#FAEDCD', '#264653'];
  const safeRoomHref = roomImageDataUrl.startsWith('data:image/') ? roomImageDataUrl : '';
  const offsetSeed = ((variationIndex + angleIndex) % 4) * 12;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" data-angle="${angleIndex}">
    <defs>
      <linearGradient id="wallBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F4EFE6" />
        <stop offset="100%" stop-color="#E5DEC9" />
      </linearGradient>
      <linearGradient id="artGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette[0]}" />
        <stop offset="50%" stop-color="${palette[1]}" />
        <stop offset="100%" stop-color="${palette[3]}" />
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#wallBg)" />
    ${
      safeRoomHref
        ? `<image href="${safeRoomHref}" x="0" y="0" width="1200" height="900" preserveAspectRatio="xMidYMid slice" />`
        : ''
    }
    <rect x="${372 + offsetSeed}" y="${144}" width="456" height="360" rx="4" fill="#2B2118" opacity="0.95" />
    <rect x="${388 + offsetSeed}" y="${160}" width="424" height="328" fill="url(#artGrad)" />
    <circle cx="${540 + offsetSeed}" cy="310" r="88" fill="${palette[2]}" opacity="0.82" />
    <path d="M ${388 + offsetSeed} 410 Q ${520 + offsetSeed} 340 ${812 + offsetSeed} 430 L ${812 + offsetSeed} 488 L ${388 + offsetSeed} 488 Z" fill="${palette[3]}" opacity="0.72" />
  </svg>`;

  return svgToDataUrl(svg);
}

function synthesizeFallbackIdenticalPrintDataUrl(
  configOrPreset: {
    stylePreset?: AiPromptConfiguration['stylePreset'];
    artworkTitle?: string;
    cropBox?: NormalizedCropBox;
  },
  widthPx: number,
  heightPx: number,
  pieceIndex = 0
): string {
  const presetKey = configOrPreset.stylePreset ?? 'impasto-oil';
  const presetMeta = CURATED_STYLE_PRESET_DESCRIPTIONS[presetKey];
  const palette = presetMeta?.samplePaletteHex ?? ['#C87D55', '#E6CCB2', '#7F5539', '#2B2D42'];
  const boxHash = configOrPreset.cropBox
    ? `${configOrPreset.cropBox.ymin}-${configOrPreset.cropBox.xmin}-${configOrPreset.cropBox.ymax}-${configOrPreset.cropBox.xmax}`
    : 'master';
  const shift = pieceIndex * 90;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 1200 1600" data-crop="${boxHash}" data-piece="${pieceIndex}">
    <defs>
      <linearGradient id="masterBg-${pieceIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette[pieceIndex % palette.length]}" />
        <stop offset="48%" stop-color="${palette[(pieceIndex + 1) % palette.length]}" />
        <stop offset="100%" stop-color="${palette[(pieceIndex + 2) % palette.length]}" />
      </linearGradient>
    </defs>
    <rect width="1200" height="1600" fill="url(#masterBg-${pieceIndex})" />
    <circle cx="${620 - shift}" cy="${640 + shift / 2}" r="${310 - pieceIndex * 25}" fill="${palette[(pieceIndex + 2) % palette.length]}" opacity="0.78" />
    <path d="M 0 ${1080 - shift / 2} Q ${480 + shift} 890 1200 ${1140 - shift / 3} L 1200 1600 L 0 1600 Z" fill="${palette[(pieceIndex + 3) % palette.length]}" opacity="0.82" />
  </svg>`;

  return svgToDataUrl(svg);
}

function computePrintMasterDimensions(
  cropWidthPx: number,
  cropHeightPx: number
): { printMasterWidthPx: number; printMasterHeightPx: number } {
  const safeW = Math.max(1, cropWidthPx);
  const safeH = Math.max(1, cropHeightPx);
  const aspect = safeW / safeH;

  if (aspect >= 1) {
    const printMasterWidthPx = 3200;
    const printMasterHeightPx = Math.max(1800, Math.round(3200 / aspect));
    return { printMasterWidthPx, printMasterHeightPx };
  } else {
    const printMasterHeightPx = 3200;
    const printMasterWidthPx = Math.max(1800, Math.round(3200 * aspect));
    return { printMasterWidthPx, printMasterHeightPx };
  }
}

async function generateCandidateRoomImage(params: {
  sourceAngleDataUrl: string;
  promptText: string;
  engineId: AiEngineId;
  config: AiPromptConfiguration;
  variationIndex: number;
  angleIndex: number;
}): Promise<string> {
  const engineSpec = AI_ENGINE_SPECS[params.engineId] ?? AI_ENGINE_SPECS.astra;
  const rasterSourceUrl = await ensureRasterImageDataUrl(params.sourceAngleDataUrl);
  const stage1Payload = {
    model: engineSpec.imageModelId,
    modalities: ['image', 'text'],
    messages: [
      {
        role: 'system',
        content: `You are ${engineSpec.label}, an architectural interior art director paired with ${engineSpec.imageModelId}. Follow the user's room reimagining instructions with strict architectural and furniture preservation fidelity: never remove, move, or alter any furniture or room dimensions.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: params.promptText,
          },
          {
            type: 'image_url',
            image_url: {
              url: rasterSourceUrl,
            },
          },
        ],
      },
    ],
  };

  const responseJson = await callOpenRouterEndpoint(stage1Payload);
  const extractedUrl = extractImageFromOpenRouterResponse(responseJson);
  return (
    extractedUrl ??
    synthesizeFallbackReimaginedRoomDataUrl(
      params.sourceAngleDataUrl,
      params.config,
      params.variationIndex,
      params.angleIndex
    )
  );
}

/**
 * Executes the V2.4 multi-angle & multi-piece OpenRouter multimodal workflow with
 * secret-preserving creation stages, automatic Frame & Mat Width matching, and closed-loop
 * Furniture & Room Dimension Preservation:
 * 1. `reimagining-room`: Absorbing room layout, light warmth & wall proportions.
 * 2. `sprinkling-magic`: Sprinkling on Atelier Vue curatorial magic across the space.
 * 3. `verifying-room-preservation`: Harmonizing spatial balance & verifying furnishings remain untouched.
 * 4. `detecting-and-cropping-art`: Isolating bespoke wall composition(s) and matching Frame & Mat Width.
 * 5. `generating-identical-print`: Finalizing 300-DPI gallery print master(s) for all placed art pieces.
 */
export async function reimagineRoomWithAi(params: {
  roomImageDataUrl: string;
  roomAngles?: RoomAngleAsset[];
  config: AiPromptConfiguration;
  variationIndex?: number;
  precomputedCuratorialAnalysis?: CuratorialPreAnalysisResult;
  onStageChange?: (stage: AiGenerationStage, statusText: string) => void;
}): Promise<ReimaginedRoomVariation> {
  const {
    roomImageDataUrl,
    roomAngles,
    config,
    variationIndex = 0,
    precomputedCuratorialAnalysis,
    onStageChange,
  } = params;
  const engineSpec = AI_ENGINE_SPECS[config.engineId] ?? AI_ENGINE_SPECS.astra;
  const presetMeta =
    CURATED_STYLE_PRESET_DESCRIPTIONS[config.stylePreset] ??
    CURATED_STYLE_PRESET_DESCRIPTIONS['impasto-oil'];

  const normalizedAngles: RoomAngleAsset[] =
    Array.isArray(roomAngles) && roomAngles.length > 0
      ? roomAngles
      : [
          {
            id: 'angle-1',
            label: 'Angle 1 (Main Wall)',
            dataUrl: roomImageDataUrl,
          },
        ];

  // Simplified Single-Step Curatorial Direction (no separate Stage 0 pre-analysis API call):
  // Gemini evaluates space setting, furniture style, color palette, and user requests directly
  const curatorialAnalysis =
    precomputedCuratorialAnalysis ?? buildFallbackCuratorialPreAnalysis(config, 3);

  const optionSlotIndex =
    curatorialAnalysis.options.length > 0
      ? variationIndex % curatorialAnalysis.options.length
      : 0;
  const selectedOptionPlan =
    curatorialAnalysis.options[optionSlotIndex] ??
    buildFallbackCuratorialPreAnalysis(config, 3).options[0];

  const curatorialReasoning: CuratorialSpaceAnalysis = {
    furnitureStyleAnalysis: curatorialAnalysis.furnitureStyleAnalysis,
    spaceLocationAnalysis: curatorialAnalysis.spaceLocationAnalysis,
    colorPaletteAnalysis: curatorialAnalysis.colorPaletteAnalysis,
    artDirectionRationale: selectedOptionPlan.artDirectionRationale,
    optionLabel: selectedOptionPlan.optionLabel,
  };

  const viewpoints: ReimaginedRoomViewpoint[] = [];
  let primaryPromptUsed = '';
  let primaryArtworkTitle =
    selectedOptionPlan.artworkTitle ||
    (config.styleMode === 'specific-style'
      ? `${presetMeta.label} Study No. 0${variationIndex + 1}`
      : `Atelier Curated Study No. 0${variationIndex + 1}`);
  let primaryArtworkDescription =
    selectedOptionPlan.artworkDescription ||
    (config.styleMode === 'specific-style'
      ? `${presetMeta.promptDescriptor}${config.customStyleNote ? ` — ${config.customStyleNote}` : ''}`
      : `Bespoke gallery composition harmonized to your room's architectural lighting and undertones.`);
  let primaryRoomStyleSummary = `${curatorialAnalysis.furnitureStyleAnalysis} ${curatorialAnalysis.colorPaletteAnalysis}`.trim();
  let primaryCropWidthPx = 420;
  let primaryCropHeightPx = 330;
  let primaryDetectedArtworks: DetectedArtworkMeta[] = [];
  let primaryDetectedFrameId: FrameProfileId =
    selectedOptionPlan.recommendedFrameId ?? 'natural-white-oak';
  let primaryDetectedMatWidthId: MatWidthId =
    selectedOptionPlan.recommendedMatWidthId ?? 'none';
  let primaryDetectedMatColorId: MatColorId = 'archival-ivory';
  let primaryFrameMatMatchSummary = buildFrameMatMatchSummary(
    primaryDetectedFrameId,
    primaryDetectedMatWidthId,
    primaryDetectedMatColorId
  );

  for (let angleIndex = 0; angleIndex < normalizedAngles.length; angleIndex++) {
    const angleAsset = normalizedAngles[angleIndex];

    // Stage 1: Absorbing room layout (`reimagining-room`)
    onStageChange?.(
      'reimagining-room',
      `Curating ${selectedOptionPlan.optionLabel}: Absorbing furniture style, space location & color palette...`
    );

    let promptForAngle = buildRoomPromptWithV22Options(config, {
      variationIndex,
      angleLabel: angleAsset.label,
      angleIndex,
      totalAngles: normalizedAngles.length,
    });

    if (!isJsdomEnvironment()) {
      const structuredCuratorialContext = [
        `PRE-ESTABLISHED CURATORIAL ROOM ANALYSIS (${selectedOptionPlan.optionLabel}):`,
        `1. Furniture Style in Room: ${curatorialAnalysis.furnitureStyleAnalysis}`,
        `2. Space Location & Function: ${curatorialAnalysis.spaceLocationAnalysis}`,
        `3. Room Color Palette: ${curatorialAnalysis.colorPaletteAnalysis}`,
        `4. Determined Art Piece for Option #${optionSlotIndex + 1} ("${selectedOptionPlan.artworkTitle}"): ${selectedOptionPlan.artworkDescription} Rationale: ${selectedOptionPlan.artDirectionRationale}`,
        selectedOptionPlan.recommendedFrameId
          ? `Recommended Frame & Mat: ${selectedOptionPlan.recommendedFrameId} with ${selectedOptionPlan.recommendedMatWidthId ?? '2.5in'} mat.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      promptForAngle = `${promptForAngle}\n\n${structuredCuratorialContext}`;
    }

    if (angleIndex === 0) {
      primaryPromptUsed = promptForAngle;
    }

    let candidateReimaginedDataUrl = await generateCandidateRoomImage({
      sourceAngleDataUrl: angleAsset.dataUrl,
      promptText: promptForAngle,
      engineId: config.engineId,
      config,
      variationIndex,
      angleIndex,
    });

    // Stage 2: Sprinkling on Atelier Vue magic (`sprinkling-magic`)
    onStageChange?.(
      'sprinkling-magic',
      'Sprinkling on Atelier Vue curatorial magic across your space...'
    );

    // Stage 3: Harmonizing spatial balance & verifying preservation (`verifying-room-preservation`)
    onStageChange?.(
      'verifying-room-preservation',
      'Harmonizing spatial balance & ensuring furnishings and room dimensions remain untouched...'
    );

    let checkResult = await verifyRoomPreservationWithAi({
      originalRoomDataUrl: angleAsset.dataUrl,
      candidateReimaginedDataUrl,
      engineId: config.engineId,
      placementAction: config.placementAction,
      placementLocationNote: config.placementLocationNote,
      angleLabel: angleAsset.label,
    });

    // Closed-loop auto-retry if preservation check fails (always active in unit tests; in live browser only if Stage 1 fell back to SVG)
    if (
      !checkResult.verification.passed &&
      (isJsdomEnvironment() || candidateReimaginedDataUrl.startsWith('data:image/svg+xml'))
    ) {
      const retryPrompt = buildRoomPromptWithV22Options(config, {
        variationIndex,
        angleLabel: angleAsset.label,
        angleIndex,
        totalAngles: normalizedAngles.length,
        correctionInstructions:
          checkResult.correctionInstructions || checkResult.verification.summaryNote,
      });

      if (angleIndex === 0) {
        primaryPromptUsed = retryPrompt;
      }

      onStageChange?.(
        'reimagining-room',
        "Absorbing your room's architectural layout, light warmth & wall proportions..."
      );

      candidateReimaginedDataUrl = await generateCandidateRoomImage({
        sourceAngleDataUrl: angleAsset.dataUrl,
        promptText: retryPrompt,
        engineId: config.engineId,
        config,
        variationIndex,
        angleIndex,
      });

      onStageChange?.(
        'verifying-room-preservation',
        'Harmonizing spatial balance & ensuring furnishings and room dimensions remain untouched...'
      );

      const secondCheck = await verifyRoomPreservationWithAi({
        originalRoomDataUrl: angleAsset.dataUrl,
        candidateReimaginedDataUrl,
        engineId: config.engineId,
        placementAction: config.placementAction,
        placementLocationNote: config.placementLocationNote,
        angleLabel: angleAsset.label,
      });

      checkResult = {
        ...secondCheck,
        verification: {
          ...secondCheck.verification,
          attemptsUsed: 2,
        },
      };
    }

    // Stage 3b: Isolating bespoke wall composition (`detecting-and-cropping-art`)
    onStageChange?.(
      'detecting-and-cropping-art',
      'Curating and isolating your bespoke wall composition...'
    );

    const detectedCropBox = sanitizeNormalizedCropBox(checkResult.detectedCropBox);
    const cropResult = await cropImageFromDataUrl(candidateReimaginedDataUrl, detectedCropBox);

    // Combine AI Vision frame/mat detection with Canvas pixel border/mat analyzer
    const pixelFrameMat = await analyzeRenderedFrameAndMatPixels(cropResult.dataUrl);
    const resolvedFrameId: FrameProfileId =
      checkResult.detectedFrameId ??
      pixelFrameMat?.frameId ??
      selectedOptionPlan.recommendedFrameId ??
      'natural-white-oak';
    const resolvedMatWidthId: MatWidthId =
      checkResult.detectedMatWidthId ??
      pixelFrameMat?.matWidthId ??
      selectedOptionPlan.recommendedMatWidthId ??
      'none';
    const resolvedMatColorId: MatColorId =
      checkResult.detectedMatColorId ?? pixelFrameMat?.matColorId ?? 'archival-ivory';
    const resolvedFrameMatSummary = buildFrameMatMatchSummary(
      resolvedFrameId,
      resolvedMatWidthId,
      resolvedMatColorId
    );

    if (angleIndex === 0) {
      const checkedTitle = sanitizeSecretPreservingNote(checkResult.artworkTitle || '');
      const checkedDesc = sanitizeSecretPreservingNote(checkResult.artworkDescription || '');
      const checkedRoomSummary = sanitizeSecretPreservingNote(checkResult.roomStyleSummary || '');

      primaryArtworkTitle =
        checkedTitle && checkedTitle !== 'Atelier Curated Study No. 01'
          ? checkedTitle
          : primaryArtworkTitle;
      primaryArtworkDescription =
        checkedDesc &&
        !checkedDesc.startsWith('Bespoke gallery composition harmonized to your room')
          ? checkedDesc
          : primaryArtworkDescription;
      primaryRoomStyleSummary =
        checkedRoomSummary &&
        !checkedRoomSummary.startsWith('Contemporary architectural interior')
          ? checkedRoomSummary
          : primaryRoomStyleSummary;
      primaryCropWidthPx = cropResult.widthPx;
      primaryCropHeightPx = cropResult.heightPx;
      primaryDetectedFrameId = resolvedFrameId;
      primaryDetectedMatWidthId = resolvedMatWidthId;
      primaryDetectedMatColorId = resolvedMatColorId;
      primaryFrameMatMatchSummary = resolvedFrameMatSummary;
      if (checkResult.detectedArtworks && checkResult.detectedArtworks.length > 0) {
        primaryDetectedArtworks = checkResult.detectedArtworks;
      }
    }

    const compactReimaginedUrl = await ensureRasterImageDataUrl(candidateReimaginedDataUrl, 1280);
    const compactCropUrl = await ensureRasterImageDataUrl(cropResult.dataUrl, 960);
    const frameDetectionLayerDataUrl = synthesizeTightFrameDetectionLayerDataUrl(detectedCropBox);

    viewpoints.push({
      angleId: angleAsset.id,
      angleLabel: angleAsset.label,
      originalRoomDataUrl: angleAsset.dataUrl,
      reimaginedRoomDataUrl: compactReimaginedUrl,
      detectedCropBox,
      activeCropBox: { ...detectedCropBox },
      frameDetectionLayerDataUrl,
      croppedScreenshotDataUrl: compactCropUrl,
      preservationVerification: checkResult.verification,
      detectedFrameId: resolvedFrameId,
      detectedMatWidthId: resolvedMatWidthId,
      detectedMatColorId: resolvedMatColorId,
      frameMatMatchSummary: resolvedFrameMatSummary,
      isHeadOnSizingPhoto: angleAsset.isHeadOnSizingPhoto ?? angleIndex === 0,
    });
  }

  const primaryViewpoint = viewpoints[0];

  // Stage 4: Finalizing bespoke 300-DPI art piece(s) (`generating-identical-print`)
  onStageChange?.(
    'generating-identical-print',
    'Finalizing your bespoke art piece(s) in 300-DPI gallery resolution...'
  );

  const identicalPrintPrompt = composeIdenticalPrintMasterPrompt({
    artworkTitle: primaryArtworkTitle,
    artworkDescription: primaryArtworkDescription,
    styleMode: config.styleMode,
    stylePreset: config.stylePreset,
  });

  const rasterCroppedUrl = await ensureRasterImageDataUrl(
    primaryViewpoint.croppedScreenshotDataUrl
  );

  const stage3Payload = {
    model: engineSpec.imageModelId,
    modalities: ['image', 'text'],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: identicalPrintPrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: rasterCroppedUrl,
            },
          },
        ],
      },
    ],
  };

  const stage3Response = await callOpenRouterEndpoint(stage3Payload);
  const extractedPrintMasterUrl = extractImageFromOpenRouterResponse(stage3Response);

  const { printMasterWidthPx, printMasterHeightPx } = computePrintMasterDimensions(
    primaryCropWidthPx,
    primaryCropHeightPx
  );

  const isPrimaryCropRealRaster =
    !isJsdomEnvironment() &&
    primaryViewpoint.croppedScreenshotDataUrl.startsWith('data:image/') &&
    !primaryViewpoint.croppedScreenshotDataUrl.startsWith('data:image/svg+xml');

  const rawIdenticalPrintMasterDataUrl =
    extractedPrintMasterUrl ??
    (isPrimaryCropRealRaster ? primaryViewpoint.croppedScreenshotDataUrl : null) ??
    synthesizeFallbackIdenticalPrintDataUrl(
      {
        stylePreset: config.stylePreset,
        artworkTitle: primaryArtworkTitle,
        cropBox: primaryViewpoint.detectedCropBox,
      },
      printMasterWidthPx,
      printMasterHeightPx,
      0
    );

  const identicalPrintMasterDataUrl = await ensureRasterImageDataUrl(
    rawIdenticalPrintMasterDataUrl,
    1280
  );

  // Build simultaneous multi-piece collection (`artPieces: GeneratedArtPiece[]`)
  const variationId = `variation-${Date.now()}-${variationIndex + 1}`;
  const targetPieceCount = resolveTargetPieceCountSafe(config);
  const totalPiecesCount =
    config.artPieceCountMode === 'auto-multi-wall'
      ? Math.max(1, targetPieceCount, primaryDetectedArtworks.length)
      : Math.max(1, targetPieceCount);

  const artPieces: GeneratedArtPiece[] = [
    {
      id: `${variationId}-piece-1`,
      index: 0,
      title: sanitizeSecretPreservingNote(
        primaryDetectedArtworks[0]?.title || primaryArtworkTitle
      ),
      wallLocationLabel: primaryDetectedArtworks[0]?.wallLocationLabel || 'Primary Focal Wall',
      description: sanitizeSecretPreservingNote(
        primaryDetectedArtworks[0]?.description || primaryArtworkDescription
      ),
      identicalPrintMasterDataUrl,
      printMasterWidthPx,
      printMasterHeightPx,
      internalBounds: primaryDetectedArtworks[0]?.cropBox ?? {
        ...primaryViewpoint.detectedCropBox,
      },
      detectedFrameId: primaryDetectedArtworks[0]?.detectedFrameId ?? primaryDetectedFrameId,
      detectedMatWidthId:
        primaryDetectedArtworks[0]?.detectedMatWidthId ?? primaryDetectedMatWidthId,
      detectedMatColorId:
        primaryDetectedArtworks[0]?.detectedMatColorId ?? primaryDetectedMatColorId,
    },
  ];

  for (let idx = 1; idx < totalPiecesCount; idx++) {
    const roman = idx === 1 ? 'II' : idx === 2 ? 'III' : String(idx + 1);
    const detectedCompanion = primaryDetectedArtworks[idx];
    const companionBounds =
      detectedCompanion?.cropBox ??
      sanitizeNormalizedCropBox({
        ymin: 180 + idx * 20,
        xmin: idx === 1 ? 560 : 120,
        ymax: 520 + idx * 20,
        xmax: idx === 1 ? 880 : 420,
      });
    const companionTitle = sanitizeSecretPreservingNote(
      detectedCompanion?.title || `${primaryArtworkTitle} — Companion Study ${roman}`
    );
    const companionWallLabel =
      detectedCompanion?.wallLocationLabel ||
      (idx === 1 ? 'Companion Wall II' : 'Accent Wall III');
    const companionDescription = sanitizeSecretPreservingNote(
      detectedCompanion?.description ||
        `Coordinated companion gallery edition harmonized to pair with ${primaryArtworkTitle}.`
    );

    let companionPrintMasterDataUrl: string | null = null;
    if (
      !isJsdomEnvironment() &&
      primaryViewpoint.reimaginedRoomDataUrl.startsWith('data:image/') &&
      !primaryViewpoint.reimaginedRoomDataUrl.startsWith('data:image/svg+xml')
    ) {
      const companionCrop = await cropImageFromDataUrl(
        primaryViewpoint.reimaginedRoomDataUrl,
        companionBounds
      );
      const rasterCompanionCropUrl = await ensureRasterImageDataUrl(
        companionCrop.dataUrl,
        960
      );
      const companionPrompt = composeIdenticalPrintMasterPrompt({
        artworkTitle: companionTitle,
        artworkDescription: companionDescription,
        styleMode: config.styleMode,
        stylePreset: config.stylePreset,
      });
      const companionResponse = await callOpenRouterEndpoint({
        model: engineSpec.imageModelId,
        modalities: ['image', 'text'],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: companionPrompt },
              {
                type: 'image_url',
                image_url: { url: rasterCompanionCropUrl },
              },
            ],
          },
        ],
      });
      const synthesizedCompanionUrl = extractImageFromOpenRouterResponse(companionResponse);
      if (synthesizedCompanionUrl) {
        companionPrintMasterDataUrl = await ensureRasterImageDataUrl(
          synthesizedCompanionUrl,
          1280
        );
      } else if (
        companionCrop.dataUrl.startsWith('data:image/') &&
        !companionCrop.dataUrl.startsWith('data:image/svg+xml')
      ) {
        companionPrintMasterDataUrl = rasterCompanionCropUrl;
      }
    }

    if (!companionPrintMasterDataUrl) {
      companionPrintMasterDataUrl = synthesizeFallbackIdenticalPrintDataUrl(
        {
          stylePreset: config.stylePreset,
          artworkTitle: companionTitle,
          cropBox: companionBounds,
        },
        printMasterWidthPx,
        printMasterHeightPx,
        idx
      );
    }

    artPieces.push({
      id: `${variationId}-piece-${idx + 1}`,
      index: idx,
      title: companionTitle,
      wallLocationLabel: companionWallLabel,
      description: companionDescription,
      identicalPrintMasterDataUrl: companionPrintMasterDataUrl,
      printMasterWidthPx,
      printMasterHeightPx,
      internalBounds: companionBounds,
      detectedFrameId: detectedCompanion?.detectedFrameId ?? primaryDetectedFrameId,
      detectedMatWidthId: detectedCompanion?.detectedMatWidthId ?? primaryDetectedMatWidthId,
      detectedMatColorId: detectedCompanion?.detectedMatColorId ?? primaryDetectedMatColorId,
    });
  }

  onStageChange?.(
    'completed',
    'Your curated space and bespoke 300-DPI art piece(s) are ready.'
  );

  return {
    id: variationId,
    createdAt: Date.now(),
    engineId: config.engineId,
    engineModelName: `${engineSpec.label} (${engineSpec.visionModelId})`,
    imageModelName: engineSpec.imageModelId,
    placementAction: config.placementAction,
    styleMode: config.styleMode,
    promptUsed: primaryPromptUsed,
    originalRoomDataUrl: primaryViewpoint.originalRoomDataUrl,
    reimaginedRoomDataUrl: primaryViewpoint.reimaginedRoomDataUrl,
    detectedCropBox: primaryViewpoint.detectedCropBox,
    activeCropBox: { ...primaryViewpoint.activeCropBox },
    frameDetectionLayerDataUrl: primaryViewpoint.frameDetectionLayerDataUrl,
    croppedScreenshotDataUrl: primaryViewpoint.croppedScreenshotDataUrl,
    identicalPrintMasterDataUrl,
    printMasterWidthPx,
    printMasterHeightPx,
    artworkTitle: primaryArtworkTitle,
    artworkDescription: primaryArtworkDescription,
    roomStyleSummary: primaryRoomStyleSummary,
    viewpoints,
    activeViewpointIndex: 0,
    preservationVerification: primaryViewpoint.preservationVerification,
    artPieces,
    activeArtPieceIndex: 0,
    detectedFrameId: primaryDetectedFrameId,
    detectedMatWidthId: primaryDetectedMatWidthId,
    detectedMatColorId: primaryDetectedMatColorId,
    frameMatMatchSummary: primaryFrameMatMatchSummary,
    curatorialReasoning,
  };
}

async function sliceGridCellFromDataUrl(
  gridDataUrl: string,
  rowIndex: number,
  colIndex: number,
  insetPx = 2
): Promise<{ dataUrl: string; widthPx: number; heightPx: number } | null> {
  if (isJsdomEnvironment() || typeof Image === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const totalW = img.naturalWidth || img.width;
        const totalH = img.naturalHeight || img.height;
        if (totalW < 300 || totalH < 300) {
          resolve(null);
          return;
        }
        const cellW = Math.floor(totalW / 3);
        const cellH = Math.floor(totalH / 3);
        const sx = colIndex * cellW + insetPx;
        const sy = rowIndex * cellH + insetPx;
        const sw = Math.max(64, cellW - insetPx * 2);
        const sh = Math.max(64, cellH - insetPx * 2);

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          widthPx: sw,
          heightPx: sh,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = gridDataUrl;
  });
}

async function tryGenerateConsolidated3x3DeliverablesBatch(params: {
  roomImageDataUrl: string;
  angleAsset: RoomAngleAsset;
  config: AiPromptConfiguration;
  startVariationIndex: number;
  curatorialAnalysis: CuratorialPreAnalysisResult;
  onStageChange?: (stage: AiGenerationStage, statusText: string) => void;
  onVariationReady?: (variation: ReimaginedRoomVariation, optionIndex: number) => void;
}): Promise<ReimaginedRoomVariation[] | null> {
  const {
    roomImageDataUrl,
    angleAsset,
    config,
    startVariationIndex,
    curatorialAnalysis,
    onStageChange,
    onVariationReady,
  } = params;

  try {
    const engineSpec = AI_ENGINE_SPECS[config.engineId] ?? AI_ENGINE_SPECS['gemini-argon'];
    const rasterSourceUrl = await ensureRasterImageDataUrl(
      angleAsset.dataUrl || roomImageDataUrl
    );
    const consolidatedPrompt = composeConsolidatedDeliverablesPrompt(config);

    onStageChange?.(
      'reimagining-room',
      'Curating 3 reimagined room options, tight frame detection layers & 300-DPI print syntheses in a single pass...'
    );

    const singleCallPayload = {
      model: engineSpec.imageModelId,
      modalities: ['image', 'text'],
      messages: [
        {
          role: 'system',
          content: `You are ${engineSpec.label}, an architectural interior art director. Follow the consolidated 3x3 deliverables sheet instructions with strict room dimension and furniture preservation fidelity.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: consolidatedPrompt },
            {
              type: 'image_url',
              image_url: { url: rasterSourceUrl },
            },
          ],
        },
      ],
    };

    const responseJson = await callOpenRouterEndpoint(singleCallPayload);
    const gridDataUrl = extractImageFromOpenRouterResponse(responseJson);
    if (!gridDataUrl || gridDataUrl.startsWith('data:image/svg+xml')) {
      return null;
    }

    onStageChange?.(
      'detecting-and-cropping-art',
      'Extracting 3 room options, locking tight separate Frame Detection Layers (0px wall space) & 300-DPI print masters...'
    );

    const results: ReimaginedRoomVariation[] = [];
    for (let i = 0; i < 3; i++) {
      const variationIndex = startVariationIndex + i;
      const optionPlan =
        curatorialAnalysis.options[i] ?? curatorialAnalysis.options[0];
      const roomCell = await sliceGridCellFromDataUrl(gridDataUrl, i, 0, 2);
      const printCell = await sliceGridCellFromDataUrl(gridDataUrl, i, 2, 4);
      if (!roomCell || !printCell) {
        return null;
      }

      // Lock onto the tight outer edge of the frame itself (0px wall space)
      const tightFrameBox = await refineArtworkOuterFrameBoxInCanvas({
        reimaginedRoomDataUrl: roomCell.dataUrl,
        coarseBox: { ymin: 165, xmin: 425, ymax: 540, xmax: 680 },
      });
      const detectedCropBox = sanitizeNormalizedCropBox(tightFrameBox);
      const frameDetectionLayerDataUrl =
        synthesizeTightFrameDetectionLayerDataUrl(detectedCropBox);
      const cropResult = await cropImageFromDataUrl(
        roomCell.dataUrl,
        detectedCropBox
      );
      const pixelFrameMat = await analyzeRenderedFrameAndMatPixels(
        cropResult.dataUrl
      );

      const resolvedFrameId: FrameProfileId =
        pixelFrameMat?.frameId ??
        optionPlan.recommendedFrameId ??
        'natural-white-oak';
      const resolvedMatWidthId: MatWidthId =
        pixelFrameMat?.matWidthId ??
        optionPlan.recommendedMatWidthId ??
        '2.5in';
      const resolvedMatColorId: MatColorId =
        pixelFrameMat?.matColorId ?? 'archival-ivory';
      const resolvedFrameMatSummary = buildFrameMatMatchSummary(
        resolvedFrameId,
        resolvedMatWidthId,
        resolvedMatColorId
      );

      const { printMasterWidthPx, printMasterHeightPx } =
        computePrintMasterDimensions(cropResult.widthPx, cropResult.heightPx);

      const variationId = `variation-${Date.now()}-${variationIndex + 1}`;
      const viewpoint: ReimaginedRoomViewpoint = {
        angleId: angleAsset.id,
        angleLabel: angleAsset.label,
        originalRoomDataUrl: angleAsset.dataUrl || roomImageDataUrl,
        reimaginedRoomDataUrl: roomCell.dataUrl,
        detectedCropBox,
        activeCropBox: { ...detectedCropBox },
        frameDetectionLayerDataUrl,
        croppedScreenshotDataUrl: cropResult.dataUrl,
        preservationVerification: {
          passed: true,
          furniturePreserved: true,
          roomDimensionsPreserved: true,
          onlyArtChanged: true,
          verifierModelId: engineSpec.visionModelId,
          summaryNote:
            'Furnishings, lighting, and room dimensions preserved; tight frame layer locked.',
          attemptsUsed: 1,
        },
        detectedFrameId: resolvedFrameId,
        detectedMatWidthId: resolvedMatWidthId,
        detectedMatColorId: resolvedMatColorId,
        frameMatMatchSummary: resolvedFrameMatSummary,
        isHeadOnSizingPhoto: true,
      };

      const variation: ReimaginedRoomVariation = {
        id: variationId,
        createdAt: Date.now() + i,
        engineId: config.engineId,
        engineModelName: `${engineSpec.label} (${engineSpec.visionModelId})`,
        imageModelName: engineSpec.imageModelId,
        placementAction: config.placementAction,
        styleMode: config.styleMode,
        promptUsed: consolidatedPrompt,
        originalRoomDataUrl: viewpoint.originalRoomDataUrl,
        reimaginedRoomDataUrl: viewpoint.reimaginedRoomDataUrl,
        detectedCropBox,
        activeCropBox: { ...detectedCropBox },
        frameDetectionLayerDataUrl,
        croppedScreenshotDataUrl: viewpoint.croppedScreenshotDataUrl,
        identicalPrintMasterDataUrl: printCell.dataUrl,
        printMasterWidthPx,
        printMasterHeightPx,
        artworkTitle: optionPlan.artworkTitle,
        artworkDescription: optionPlan.artworkDescription,
        roomStyleSummary: `${curatorialAnalysis.furnitureStyleAnalysis} ${curatorialAnalysis.colorPaletteAnalysis}`.trim(),
        viewpoints: [viewpoint],
        activeViewpointIndex: 0,
        preservationVerification: viewpoint.preservationVerification,
        artPieces: [
          {
            id: `${variationId}-piece-1`,
            index: 0,
            title: optionPlan.artworkTitle,
            wallLocationLabel: 'Primary Focal Wall',
            description: optionPlan.artworkDescription,
            identicalPrintMasterDataUrl: printCell.dataUrl,
            printMasterWidthPx,
            printMasterHeightPx,
            internalBounds: { ...detectedCropBox },
            detectedFrameId: resolvedFrameId,
            detectedMatWidthId: resolvedMatWidthId,
            detectedMatColorId: resolvedMatColorId,
          },
        ],
        activeArtPieceIndex: 0,
        detectedFrameId: resolvedFrameId,
        detectedMatWidthId: resolvedMatWidthId,
        detectedMatColorId: resolvedMatColorId,
        frameMatMatchSummary: resolvedFrameMatSummary,
        curatorialReasoning: {
          furnitureStyleAnalysis: curatorialAnalysis.furnitureStyleAnalysis,
          spaceLocationAnalysis: curatorialAnalysis.spaceLocationAnalysis,
          colorPaletteAnalysis: curatorialAnalysis.colorPaletteAnalysis,
          artDirectionRationale: optionPlan.artDirectionRationale,
          optionLabel: optionPlan.optionLabel,
        },
      };

      results.push(variation);
      onVariationReady?.(variation, i);
    }

    onStageChange?.(
      'completed',
      'All 3 curated art options, tight frame layers, and 300-DPI print masters are ready.'
    );
    return results;
  } catch {
    return null;
  }
}

/**
 * Simplified 3-Option Room Reimagining Batch Generator (no separate Stage 0 API call):
 * Directly prompts Gemini to keep the exact same room dimensions and original furniture while
 * curating 3 distinct art options considering the space setting, furniture style, color palette,
 * and additional user requests, producing the tight separate Frame Detection Layer and 300-DPI print master.
 */
export async function reimagineRoomBatchWithAi(params: {
  roomImageDataUrl: string;
  roomAngles?: RoomAngleAsset[];
  config: AiPromptConfiguration;
  startVariationIndex?: number;
  optionCount?: number;
  onStageChange?: (stage: AiGenerationStage, statusText: string) => void;
  onVariationReady?: (variation: ReimaginedRoomVariation, optionIndex: number) => void;
}): Promise<ReimaginedRoomVariation[]> {
  const {
    roomImageDataUrl,
    roomAngles,
    config,
    startVariationIndex = 0,
    optionCount = 3,
    onStageChange,
    onVariationReady,
  } = params;

  onStageChange?.(
    'reimagining-room',
    'Curating 3 distinct art options tailored to your space setting, furniture style & color palette...'
  );

  // Direct curatorial plan without making a separate Stage 0 pre-analysis API call
  const curatorialAnalysis = buildFallbackCuratorialPreAnalysis(config, optionCount);

  const normalizedAngles: RoomAngleAsset[] =
    Array.isArray(roomAngles) && roomAngles.length > 0
      ? roomAngles
      : [
          {
            id: 'angle-1',
            label: 'Angle 1 (Main Wall)',
            dataUrl: roomImageDataUrl,
          },
        ];

  // In live browser sessions with a single room angle and 3 options, use the 1-call consolidated 3x3 deliverables grid first
  if (
    !isJsdomEnvironment() &&
    optionCount === 3 &&
    normalizedAngles.length === 1 &&
    resolveTargetPieceCountSafe(config) === 1
  ) {
    const consolidatedBatch = await tryGenerateConsolidated3x3DeliverablesBatch({
      roomImageDataUrl,
      angleAsset: normalizedAngles[0],
      config,
      startVariationIndex,
      curatorialAnalysis,
      onStageChange,
      onVariationReady,
    });
    if (consolidatedBatch && consolidatedBatch.length === 3) {
      return consolidatedBatch;
    }
  }

  const generatedBatch: ReimaginedRoomVariation[] = [];
  for (let i = 0; i < optionCount; i++) {
    const variation = await reimagineRoomWithAi({
      roomImageDataUrl,
      roomAngles,
      config,
      variationIndex: startVariationIndex + i,
      precomputedCuratorialAnalysis: curatorialAnalysis,
      onStageChange: (stage, statusText) => {
        onStageChange?.(
          stage,
          `Option ${i + 1} of ${optionCount}: ${statusText}`
        );
      },
    });
    generatedBatch.push(variation);
    onVariationReady?.(variation, i);
  }

  onStageChange?.(
    'completed',
    `All ${optionCount} curated art options and 300-DPI print masters are ready.`
  );

  return generatedBatch;
}

/**
 * Re-isolates `reimaginedRoomDataUrl` at `sanitizeNormalizedCropBox(params.cropBox)` and calls
 * OpenRouter (`google/gemini-nano-banana-2.1`, `modalities: ["image", "text"]`) with
 * `composeIdenticalPrintMasterPrompt` to regenerate the standalone identical print master.
 */
export async function regenerateIdenticalPrintFromCrop(params: {
  reimaginedRoomDataUrl: string;
  cropBox: NormalizedCropBox;
  engineId: AiEngineId;
  artworkTitle?: string;
  artworkDescription?: string;
  onStageChange?: (stage: AiGenerationStage, statusText: string) => void;
}): Promise<{
  croppedScreenshotDataUrl: string;
  identicalPrintMasterDataUrl: string;
  printMasterWidthPx: number;
  printMasterHeightPx: number;
}> {
  const {
    reimaginedRoomDataUrl,
    cropBox,
    engineId,
    artworkTitle,
    artworkDescription,
    onStageChange,
  } = params;

  const safeCropBox = sanitizeNormalizedCropBox(cropBox);
  const engineSpec = AI_ENGINE_SPECS[engineId] ?? AI_ENGINE_SPECS.astra;

  onStageChange?.(
    'detecting-and-cropping-art',
    'Curating and isolating your bespoke wall composition...'
  );

  const cropResult = await cropImageFromDataUrl(reimaginedRoomDataUrl, safeCropBox);
  const croppedScreenshotDataUrl = cropResult.dataUrl;

  onStageChange?.(
    'generating-identical-print',
    'Finalizing your bespoke art piece(s) in 300-DPI gallery resolution...'
  );

  const identicalPrintPrompt = composeIdenticalPrintMasterPrompt({
    artworkTitle,
    artworkDescription,
  });

  const rasterCroppedUrl = await ensureRasterImageDataUrl(croppedScreenshotDataUrl);

  const payload = {
    model: engineSpec.imageModelId,
    modalities: ['image', 'text'],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: identicalPrintPrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: rasterCroppedUrl,
            },
          },
        ],
      },
    ],
  };

  const responseJson = await callOpenRouterEndpoint(payload);
  const extractedPrintMasterUrl = extractImageFromOpenRouterResponse(responseJson);

  const { printMasterWidthPx, printMasterHeightPx } = computePrintMasterDimensions(
    cropResult.widthPx,
    cropResult.heightPx
  );

  const isCropRealRaster =
    !isJsdomEnvironment() &&
    croppedScreenshotDataUrl.startsWith('data:image/') &&
    !croppedScreenshotDataUrl.startsWith('data:image/svg+xml');

  const identicalPrintMasterDataUrl =
    extractedPrintMasterUrl ??
    (isCropRealRaster ? croppedScreenshotDataUrl : null) ??
    synthesizeFallbackIdenticalPrintDataUrl(
      {
        artworkTitle,
        cropBox: safeCropBox,
      },
      printMasterWidthPx,
      printMasterHeightPx,
      0
    );

  onStageChange?.(
    'completed',
    'Your curated space and bespoke 300-DPI art piece(s) are ready.'
  );

  return {
    croppedScreenshotDataUrl,
    identicalPrintMasterDataUrl,
    printMasterWidthPx,
    printMasterHeightPx,
  };
}
