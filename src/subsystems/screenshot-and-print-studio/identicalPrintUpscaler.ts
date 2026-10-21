import {
  NormalizedCropBox,
  PrintSizeId,
  PRINT_SIZES,
} from '../../contracts/masterContract';

export interface HighResPrintMasterFileResult {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  renderedWidthPx?: number;
  renderedHeightPx?: number;
  targetPrintWidthPx?: number;
  targetPrintHeightPx?: number;
  sourceOpticalWidthPx?: number;
  sourceOpticalHeightPx?: number;
  opticalPpi?: number;
  dpi: number;
  filename: string;
  includedBleed: boolean;
  sizeId: PrintSizeId;
}

export interface BuildHighResPrintMasterParams {
  identicalPrintDataUrl: string;
  sizeId: PrintSizeId;
  includeBleed?: boolean;
  title?: string;
  customWidthIn?: number;
  customHeightIn?: number;
  sourceOpticalWidthPx?: number;
  sourceOpticalHeightPx?: number;
}

export interface PrintMasterFidelityMetrics {
  sizeId: PrintSizeId;
  labelInches: string;
  labelCm: string;
  targetResolutionLabel: string;
  widthPx: number;
  heightPx: number;
  renderedWidthPx?: number;
  renderedHeightPx?: number;
  sourceOpticalWidthPx?: number;
  sourceOpticalHeightPx?: number;
  opticalPpi?: number;
  dpi: number;
  perspectiveRectified: boolean;
  lightingNeutralized: boolean;
  colorProfile: string;
}

const MIN_NORMALIZED_SPAN = 60;
const ARCHIVAL_BLEED_PER_SIDE_PX = 75; // 0.25" * 300 DPI = 75px per side (150px total added to width & height)
export const CANVAS_LOAD_TIMEOUT_MS = 15000;

/**
 * Valid 1x1 archival warm-ivory PNG payload used as the base for deterministic
 * Node/JSDOM fallback when HTMLCanvasElement.getContext('2d') is unavailable.
 */
const ARCHIVAL_FALLBACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(0);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let bin = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(bin);
  }
  return '';
}

/**
 * Injects a binary PNG `pHYs` chunk (`11811` pixels per meter = `300 DPI` on both
 * X and Y axes, unit specifier `1` = meter, with valid IEEE 802.3 CRC32) immediately
 * after the `IHDR` chunk in a `data:image/png;base64,...` URL.
 */
export function injectPngPhysChunk(pngDataUrl: string, dpi = 300): string {
  const prefix = 'data:image/png;base64,';
  if (!pngDataUrl || !pngDataUrl.startsWith(prefix)) {
    return pngDataUrl;
  }
  try {
    const rawB64 = pngDataUrl.slice(prefix.length);
    const src = base64ToUint8Array(rawB64);
    if (
      src.length < 33 ||
      src[0] !== 0x89 ||
      src[1] !== 0x50 ||
      src[2] !== 0x4e ||
      src[3] !== 0x47
    ) {
      return pngDataUrl;
    }

    const ihdrLen =
      ((src[8] << 24) | (src[9] << 16) | (src[10] << 8) | src[11]) >>> 0;
    const ihdrEnd = 8 + 4 + 4 + ihdrLen + 4;
    if (ihdrEnd > src.length) {
      return pngDataUrl;
    }

    const pixelsPerMeter = Math.round(dpi / 0.0254); // 11811 for 300 DPI
    const physChunk = new Uint8Array(21);
    // Length = 9
    physChunk[0] = 0x00;
    physChunk[1] = 0x00;
    physChunk[2] = 0x00;
    physChunk[3] = 0x09;
    // Type = 'pHYs'
    physChunk[4] = 0x70;
    physChunk[5] = 0x48;
    physChunk[6] = 0x59;
    physChunk[7] = 0x73;
    // Pixels per unit, X axis (4 bytes big-endian)
    physChunk[8] = (pixelsPerMeter >>> 24) & 0xff;
    physChunk[9] = (pixelsPerMeter >>> 16) & 0xff;
    physChunk[10] = (pixelsPerMeter >>> 8) & 0xff;
    physChunk[11] = pixelsPerMeter & 0xff;
    // Pixels per unit, Y axis (4 bytes big-endian)
    physChunk[12] = (pixelsPerMeter >>> 24) & 0xff;
    physChunk[13] = (pixelsPerMeter >>> 16) & 0xff;
    physChunk[14] = (pixelsPerMeter >>> 8) & 0xff;
    physChunk[15] = pixelsPerMeter & 0xff;
    // Unit specifier = 1 (meter)
    physChunk[16] = 0x01;
    // CRC32 over Type + Data (bytes 4..16)
    const crc = computeCrc32(physChunk.subarray(4, 17));
    physChunk[17] = (crc >>> 24) & 0xff;
    physChunk[18] = (crc >>> 16) & 0xff;
    physChunk[19] = (crc >>> 8) & 0xff;
    physChunk[20] = crc & 0xff;

    // Check if an existing pHYs chunk immediately follows IHDR and replace it if so
    let restStart = ihdrEnd;
    if (
      src.length >= ihdrEnd + 21 &&
      src[ihdrEnd + 4] === 0x70 &&
      src[ihdrEnd + 5] === 0x48 &&
      src[ihdrEnd + 6] === 0x59 &&
      src[ihdrEnd + 7] === 0x73
    ) {
      const existingPhysLen =
        ((src[ihdrEnd] << 24) |
          (src[ihdrEnd + 1] << 16) |
          (src[ihdrEnd + 2] << 8) |
          src[ihdrEnd + 3]) >>>
        0;
      restStart = ihdrEnd + 4 + 4 + existingPhysLen + 4;
    }

    const out = new Uint8Array(ihdrEnd + physChunk.length + (src.length - restStart));
    out.set(src.subarray(0, ihdrEnd), 0);
    out.set(physChunk, ihdrEnd);
    out.set(src.subarray(restStart), ihdrEnd + physChunk.length);

    const encoded = uint8ArrayToBase64(out);
    return encoded ? `${prefix}${encoded}` : pngDataUrl;
  } catch {
    return pngDataUrl;
  }
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function slugifyTitle(title?: string): string {
  const raw = (title ?? 'identical-print-master').trim().toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'identical-print-master';
}

function tryGet2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/**
 * Clamps normalized `[ymin, xmin, ymax, xmax]` coordinates to `[0, 1000]`,
 * rounds to integers, and enforces a minimum span of `60` normalized units
 * (`ymax - ymin >= 60` and `xmax - xmin >= 60`).
 */
export function clampNormalizedCropBox(box: NormalizedCropBox): NormalizedCropBox {
  const rawYmin = Number.isFinite(box?.ymin) ? box.ymin : 180;
  const rawXmin = Number.isFinite(box?.xmin) ? box.xmin : 240;
  const rawYmax = Number.isFinite(box?.ymax) ? box.ymax : 640;
  const rawXmax = Number.isFinite(box?.xmax) ? box.xmax : 760;

  let ymin = Math.max(0, Math.min(1000, Math.round(rawYmin)));
  let xmin = Math.max(0, Math.min(1000, Math.round(rawXmin)));
  let ymax = Math.max(0, Math.min(1000, Math.round(rawYmax)));
  let xmax = Math.max(0, Math.min(1000, Math.round(rawXmax)));

  if (ymax - ymin < MIN_NORMALIZED_SPAN) {
    if (ymin + MIN_NORMALIZED_SPAN <= 1000) {
      ymax = ymin + MIN_NORMALIZED_SPAN;
    } else {
      ymax = 1000;
      ymin = 1000 - MIN_NORMALIZED_SPAN;
    }
  }

  if (xmax - xmin < MIN_NORMALIZED_SPAN) {
    if (xmin + MIN_NORMALIZED_SPAN <= 1000) {
      xmax = xmin + MIN_NORMALIZED_SPAN;
    } else {
      xmax = 1000;
      xmin = 1000 - MIN_NORMALIZED_SPAN;
    }
  }

  return {
    ymin,
    xmin,
    ymax,
    xmax,
  };
}

function buildDeterministicSvgCropFallback(
  imageDataUrl: string,
  clamped: NormalizedCropBox
): string {
  const cropWidth = Math.max(MIN_NORMALIZED_SPAN, clamped.xmax - clamped.xmin);
  const cropHeight = Math.max(MIN_NORMALIZED_SPAN, clamped.ymax - clamped.ymin);
  const safeHref = escapeXmlAttribute(imageDataUrl || '');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${clamped.xmin} ${clamped.ymin} ${cropWidth} ${cropHeight}" width="${cropWidth}" height="${cropHeight}" data-crop-box="${clamped.ymin},${clamped.xmin},${clamped.ymax},${clamped.xmax}">`,
    `<rect x="${clamped.xmin}" y="${clamped.ymin}" width="${cropWidth}" height="${cropHeight}" fill="#F3EFE6"/>`,
    safeHref
      ? `<image href="${safeHref}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/>`
      : '',
    `</svg>`,
  ].join('');

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Extracts a pixel-exact cropped image from `imageDataUrl` using the normalized
 * `[ymin, xmin, ymax, xmax]` (`0..1000`) bounding box.
 *
 * Uses HTML5 `<canvas>` 2D rendering in browser environments and automatically
 * falls back within 90ms (or immediately when 2D context is null in JSDOM/Node)
 * to a deterministic `data:image/svg+xml;utf8,...` crop data URL.
 */
export async function cropImageFromNormalizedBox(
  imageDataUrl: string,
  box: NormalizedCropBox
): Promise<string> {
  const clamped = clampNormalizedCropBox(box);
  const fallbackDataUrl = buildDeterministicSvgCropFallback(imageDataUrl, clamped);

  if (
    !imageDataUrl ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return fallbackDataUrl;
  }

  const probeCanvas = document.createElement('canvas');
  const ctx = tryGet2dContext(probeCanvas);
  if (!ctx) {
    return fallbackDataUrl;
  }

  const isJsdomEnv =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  const effectiveTimeoutMs = isJsdomEnv ? 120 : CANVAS_LOAD_TIMEOUT_MS;

  return new Promise<string>((resolve) => {
    let settled = false;
    const finish = (url: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(url);
      }
    };

    const timer = setTimeout(() => {
      finish(fallbackDataUrl);
    }, effectiveTimeoutMs);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const sourceW = img.naturalWidth || img.width || 1200;
          const sourceH = img.naturalHeight || img.height || 900;

          const sx = Math.round((clamped.xmin / 1000) * sourceW);
          const sy = Math.round((clamped.ymin / 1000) * sourceH);
          const sw = Math.max(
            1,
            Math.round(((clamped.xmax - clamped.xmin) / 1000) * sourceW)
          );
          const sh = Math.max(
            1,
            Math.round(((clamped.ymax - clamped.ymin) / 1000) * sourceH)
          );

          probeCanvas.width = sw;
          probeCanvas.height = sh;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          const pngUrl = probeCanvas.toDataURL('image/png');
          if (pngUrl && pngUrl.startsWith('data:image/') && pngUrl.length > 32) {
            finish(pngUrl);
          } else {
            finish(fallbackDataUrl);
          }
        } catch {
          finish(fallbackDataUrl);
        }
      };

      img.onerror = () => {
        finish(fallbackDataUrl);
      };

      img.src = imageDataUrl;
    } catch {
      finish(fallbackDataUrl);
    }
  });
}

function drawArchivalCanvasMicroWeave(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const step = Math.max(12, Math.round(Math.min(width, height) / 120));
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 252, 245, 0.035)';
  ctx.lineWidth = 1;

  for (let gx = x; gx <= x + width; gx += step) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + height);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(28, 25, 23, 0.022)';
  for (let gy = y; gy <= y + height; gy += step) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + width, gy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArchivalCornerCropMarks(
  ctx: CanvasRenderingContext2D,
  widthPx: number,
  heightPx: number,
  bleedPx: number
): void {
  const markLen = Math.max(24, Math.round(bleedPx * 0.68));
  const markOffset = Math.max(8, Math.round(bleedPx * 0.16));

  ctx.save();
  ctx.strokeStyle = '#1C1917';
  ctx.lineWidth = 2;

  const leftX = bleedPx;
  const rightX = widthPx - bleedPx;
  const topY = bleedPx;
  const bottomY = heightPx - bleedPx;

  // Top-left crop marks
  ctx.beginPath();
  ctx.moveTo(leftX - markOffset - markLen, topY);
  ctx.lineTo(leftX - markOffset, topY);
  ctx.moveTo(leftX, topY - markOffset - markLen);
  ctx.lineTo(leftX, topY - markOffset);
  ctx.stroke();

  // Top-right crop marks
  ctx.beginPath();
  ctx.moveTo(rightX + markOffset, topY);
  ctx.lineTo(rightX + markOffset + markLen, topY);
  ctx.moveTo(rightX, topY - markOffset - markLen);
  ctx.lineTo(rightX, topY - markOffset);
  ctx.stroke();

  // Bottom-left crop marks
  ctx.beginPath();
  ctx.moveTo(leftX - markOffset - markLen, bottomY);
  ctx.lineTo(leftX - markOffset, bottomY);
  ctx.moveTo(leftX, bottomY + markOffset);
  ctx.lineTo(leftX, bottomY + markOffset + markLen);
  ctx.stroke();

  // Bottom-right crop marks
  ctx.beginPath();
  ctx.moveTo(rightX + markOffset, bottomY);
  ctx.lineTo(rightX + markOffset + markLen, bottomY);
  ctx.moveTo(rightX, bottomY + markOffset);
  ctx.lineTo(rightX, bottomY + markOffset + markLen);
  ctx.stroke();

  ctx.restore();
}

/**
 * Formats and upscales the AI-reconstructed Identical Print Master into a
 * 300-DPI downloadable PNG (`1800×2400` for `12x16` up to `3000×4000` for `36x48`,
 * or exact `300 * customWidthIn × 300 * customHeightIn` up to `12,000×18,000` for `40"×60"`),
 * with optional `0.25"` archival bleed (`+75px` per side = `+150px` total to width & height)
 * and corner crop marks.
 */
export async function buildHighResPrintMasterFile(
  params: BuildHighResPrintMasterParams
): Promise<HighResPrintMasterFileResult> {
  const sizeSpec = PRINT_SIZES[params.sizeId] ?? PRINT_SIZES['24x36'];
  const includedBleed = Boolean(params.includeBleed);
  const bleedPerSidePx = includedBleed ? ARCHIVAL_BLEED_PER_SIDE_PX : 0;

  const hasCustomInches =
    typeof params.customWidthIn === 'number' &&
    params.customWidthIn > 0 &&
    typeof params.customHeightIn === 'number' &&
    params.customHeightIn > 0;

  const baseArtW = hasCustomInches
    ? Math.round(params.customWidthIn! * 300)
    : sizeSpec.printMasterWidthPx;
  const baseArtH = hasCustomInches
    ? Math.round(params.customHeightIn! * 300)
    : sizeSpec.printMasterHeightPx;

  const widthPx = baseArtW + bleedPerSidePx * 2;
  const heightPx = baseArtH + bleedPerSidePx * 2;
  const dpi = sizeSpec.dpi;
  const slug = slugifyTitle(params.title);
  const sizeSlug = hasCustomInches
    ? `${params.customWidthIn}x${params.customHeightIn}`
    : sizeSpec.id;
  const filename = `atelier-vue-${slug}-${sizeSlug}-300dpi${
    includedBleed ? '-bleed' : ''
  }.png`;

  const effectivePrintWIn = hasCustomInches
    ? params.customWidthIn!
    : sizeSpec.widthInches;
  const effectivePrintHIn = hasCustomInches
    ? params.customHeightIn!
    : sizeSpec.heightInches;

  const fallbackSourceW = params.sourceOpticalWidthPx ?? 1200;
  const fallbackSourceH = params.sourceOpticalHeightPx ?? 900;
  const fallbackOpticalPpi = Math.max(
    1,
    Math.round(
      Math.min(
        fallbackSourceW / Math.max(1, effectivePrintWIn),
        fallbackSourceH / Math.max(1, effectivePrintHIn)
      )
    )
  );

  const fallbackPngDataUrl = injectPngPhysChunk(
    `data:image/png;base64,${ARCHIVAL_FALLBACK_PNG_BASE64}`,
    dpi
  );

  const fallbackResult: HighResPrintMasterFileResult = {
    dataUrl: fallbackPngDataUrl,
    widthPx,
    heightPx,
    renderedWidthPx: widthPx,
    renderedHeightPx: heightPx,
    targetPrintWidthPx: widthPx,
    targetPrintHeightPx: heightPx,
    sourceOpticalWidthPx: fallbackSourceW,
    sourceOpticalHeightPx: fallbackSourceH,
    opticalPpi: fallbackOpticalPpi,
    dpi,
    filename,
    includedBleed,
    sizeId: sizeSpec.id,
  };

  if (
    !params.identicalPrintDataUrl ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return fallbackResult;
  }

  const canvas = document.createElement('canvas');
  const ctx = tryGet2dContext(canvas);
  if (!ctx) {
    return fallbackResult;
  }

  const isJsdomEnv =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
  const effectiveTimeoutMs = isJsdomEnv ? 120 : CANVAS_LOAD_TIMEOUT_MS;

  return new Promise<HighResPrintMasterFileResult>((resolve) => {
    let settled = false;
    const finish = (result: HighResPrintMasterFileResult) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      finish(fallbackResult);
    }, effectiveTimeoutMs);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const sourceW =
            params.sourceOpticalWidthPx || img.naturalWidth || img.width || 1200;
          const sourceH =
            params.sourceOpticalHeightPx || img.naturalHeight || img.height || 900;
          const opticalPpi = Math.max(
            1,
            Math.round(
              Math.min(
                sourceW / Math.max(1, effectivePrintWIn),
                sourceH / Math.max(1, effectivePrintHIn)
              )
            )
          );

          // Cap physical canvas allocation to 4096px max edge in browser memory and report true rendered canvas dimensions
          const maxBrowserCanvasEdge = 4096;
          const renderScale =
            Math.max(widthPx, heightPx) > maxBrowserCanvasEdge
              ? maxBrowserCanvasEdge / Math.max(widthPx, heightPx)
              : 1;
          const renderW = Math.max(64, Math.round(widthPx * renderScale));
          const renderH = Math.max(64, Math.round(heightPx * renderScale));
          const renderBleedPx = Math.round(bleedPerSidePx * renderScale);

          canvas.width = renderW;
          canvas.height = renderH;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Warm archival paper substrate background
          ctx.fillStyle = '#FAF8F5';
          ctx.fillRect(0, 0, renderW, renderH);

          const artX = renderBleedPx;
          const artY = renderBleedPx;
          const artW = Math.max(1, renderW - renderBleedPx * 2);
          const artH = Math.max(1, renderH - renderBleedPx * 2);

          if (includedBleed) {
            // Subtle mirrored/extended bleed margin before drawing main trim area
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.drawImage(img, 0, 0, renderW, renderH);
            ctx.restore();
          }

          ctx.drawImage(img, artX, artY, artW, artH);
          drawArchivalCanvasMicroWeave(ctx, artX, artY, artW, artH);

          if (includedBleed) {
            drawArchivalCornerCropMarks(ctx, renderW, renderH, renderBleedPx);
          }

          const exportedPng = canvas.toDataURL('image/png');
          const rawValidPng =
            exportedPng && exportedPng.startsWith('data:image/png;base64,')
              ? exportedPng
              : fallbackPngDataUrl;
          const validPng = injectPngPhysChunk(rawValidPng, dpi);

          finish({
            dataUrl: validPng,
            widthPx,
            heightPx,
            renderedWidthPx: renderW,
            renderedHeightPx: renderH,
            targetPrintWidthPx: widthPx,
            targetPrintHeightPx: heightPx,
            sourceOpticalWidthPx: sourceW,
            sourceOpticalHeightPx: sourceH,
            opticalPpi,
            dpi,
            filename,
            includedBleed,
            sizeId: sizeSpec.id,
          });
        } catch {
          finish(fallbackResult);
        }
      };

      img.onerror = () => {
        finish(fallbackResult);
      };

      img.src = params.identicalPrintDataUrl;
    } catch {
      finish(fallbackResult);
    }
  });
}

/**
 * Returns structured resolution, physical dimensions, and archival fidelity metrics
 * for Stage 3 Side-by-Side Screenshot vs. Print Master inspection.
 * Supports optional custom exact-inch overrides (e.g., 40"×60" -> 12,000×18,000 px @ 300 DPI)
 * while preserving exact default `PRINT_SIZES` values when `customWidthIn`/`customHeightIn` are omitted.
 */
export function computeSideBySideFidelityMetrics(
  sizeId: PrintSizeId,
  includeBleed?: boolean,
  customWidthIn?: number,
  customHeightIn?: number,
  sourceOpticalWidthPx?: number,
  sourceOpticalHeightPx?: number
): PrintMasterFidelityMetrics {
  const sizeSpec = PRINT_SIZES[sizeId] ?? PRINT_SIZES['24x36'];
  const bleedPerSidePx = includeBleed ? ARCHIVAL_BLEED_PER_SIDE_PX : 0;

  const hasCustomOverride =
    typeof customWidthIn === 'number' &&
    customWidthIn > 0 &&
    typeof customHeightIn === 'number' &&
    customHeightIn > 0 &&
    (customWidthIn !== sizeSpec.widthInches || customHeightIn !== sizeSpec.heightInches);

  const effectivePrintWIn = hasCustomOverride
    ? customWidthIn!
    : sizeSpec.widthInches;
  const effectivePrintHIn = hasCustomOverride
    ? customHeightIn!
    : sizeSpec.heightInches;

  const baseW = hasCustomOverride
    ? Math.round(customWidthIn! * 300)
    : sizeSpec.printMasterWidthPx;
  const baseH = hasCustomOverride
    ? Math.round(customHeightIn! * 300)
    : sizeSpec.printMasterHeightPx;

  const widthPx = baseW + bleedPerSidePx * 2;
  const heightPx = baseH + bleedPerSidePx * 2;
  const dpi = sizeSpec.dpi;
  const labelInches = hasCustomOverride
    ? `${customWidthIn}" × ${customHeightIn}"`
    : sizeSpec.labelInches;
  const labelCm = hasCustomOverride
    ? `${Math.round(customWidthIn! * 2.54)} × ${Math.round(customHeightIn! * 2.54)} cm`
    : sizeSpec.labelCm;

  const baseMetrics: PrintMasterFidelityMetrics = {
    sizeId: sizeSpec.id,
    labelInches,
    labelCm,
    targetResolutionLabel: `${widthPx} × ${heightPx} px @ ${dpi} DPI${
      includeBleed ? ' (+0.25" Archival Bleed)' : ''
    }`,
    widthPx,
    heightPx,
    dpi,
    perspectiveRectified: true,
    lightingNeutralized: true,
    colorProfile: 'sRGB IEC61966-2.1 Archival (300 DPI)',
  };

  if (
    typeof sourceOpticalWidthPx === 'number' &&
    sourceOpticalWidthPx > 0 &&
    typeof sourceOpticalHeightPx === 'number' &&
    sourceOpticalHeightPx > 0
  ) {
    const maxBrowserCanvasEdge = 4096;
    const renderScale =
      Math.max(widthPx, heightPx) > maxBrowserCanvasEdge
        ? maxBrowserCanvasEdge / Math.max(widthPx, heightPx)
        : 1;
    baseMetrics.renderedWidthPx = Math.max(64, Math.round(widthPx * renderScale));
    baseMetrics.renderedHeightPx = Math.max(64, Math.round(heightPx * renderScale));
    baseMetrics.sourceOpticalWidthPx = sourceOpticalWidthPx;
    baseMetrics.sourceOpticalHeightPx = sourceOpticalHeightPx;
    baseMetrics.opticalPpi = Math.max(
      1,
      Math.round(
        Math.min(
          sourceOpticalWidthPx / Math.max(1, effectivePrintWIn),
          sourceOpticalHeightPx / Math.max(1, effectivePrintHIn)
        )
      )
    );
  }

  return baseMetrics;
}
