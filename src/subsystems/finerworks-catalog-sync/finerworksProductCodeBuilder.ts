// src/subsystems/finerworks-catalog-sync/finerworksProductCodeBuilder.ts
import type {
  FinerWorksBuiltProductSpec,
  FinerWorksDynamicProductConfig,
  FinerWorksGlazingId,
  FinerWorksProductTypeId,
  FrameProfileId,
  MatColorId,
  MatWidthId,
  OrientationMode,
} from '../../contracts/masterContract';
import {
  FINERWORKS_MEDIA_SPECS,
  getFinerWorksFrameByFrameId,
  getFinerWorksFrameByProfileId,
  getFinerWorksGlazingByGlassId,
  getFinerWorksGlazingById,
  getFinerWorksMatByColorId,
  getFinerWorksMatByMatId,
  getFinerWorksMediaById,
} from './finerworksCatalogRegistry';

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundDim(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function matWidthIdToInches(matWidthId?: MatWidthId): number {
  switch (matWidthId) {
    case '1.5in':
      return 1.5;
    case '2.5in':
      return 2.5;
    case '3.5in':
      return 3.5;
    case 'none':
    default:
      return 0;
  }
}

export function inchesToMatWidthId(borderInches: number): MatWidthId {
  if (!Number.isFinite(borderInches) || borderInches <= 0) {
    return 'none';
  }
  if (borderInches <= 2.0) {
    return '1.5in';
  }
  if (borderInches <= 3.0) {
    return '2.5in';
  }
  return '3.5in';
}

function resolveDefaultMediaForProductType(productTypeId?: FinerWorksProductTypeId): number {
  switch (productTypeId) {
    case 1:
      return 12;
    case 2:
      return 21;
    case 3:
      return 31;
    case 5:
    default:
      return 42;
  }
}

export function validateFinerWorksConfiguration(
  config: FinerWorksDynamicProductConfig & { orientation?: OrientationMode }
): {
  valid: boolean;
  notes: string[];
  normalizedConfig: FinerWorksDynamicProductConfig;
} {
  const notes: string[] = [];

  // 1. Resolve Media & Product Type
  const candidateMediaId =
    typeof config.mediaId === 'number' && config.mediaId > 0
      ? config.mediaId
      : resolveDefaultMediaForProductType(config.productTypeId);

  const exactMedia = FINERWORKS_MEDIA_SPECS.find((m) => m.mediaId === candidateMediaId);
  if (!exactMedia && config.mediaId !== undefined) {
    notes.push(
      `Unknown FinerWorks MediaID ${config.mediaId}; normalized to Hahnemühle German Etching 310gsm (MediaID 42).`
    );
  }
  const media = exactMedia ?? getFinerWorksMediaById(candidateMediaId);

  if (config.productTypeId && config.productTypeId !== media.productTypeId) {
    notes.push(
      `ProductTypeId ${config.productTypeId} did not match MediaID ${media.mediaId} (${media.shortName}); aligned to ProductTypeId ${media.productTypeId}.`
    );
  }

  const productTypeId: FinerWorksProductTypeId = media.productTypeId;
  const styleId =
    typeof config.styleId === 'number' && config.styleId > 0 ? config.styleId : media.defaultStyleId;

  // 2. Validate & clamp print dimensions (F-21: respect orientation when provided)
  const rawWidth =
    typeof config.printWidthIn === 'number' && Number.isFinite(config.printWidthIn) && config.printWidthIn > 0
      ? config.printWidthIn
      : 24;
  const rawHeight =
    typeof config.printHeightIn === 'number' &&
    Number.isFinite(config.printHeightIn) &&
    config.printHeightIn > 0
      ? config.printHeightIn
      : 36;

  let printWidthIn = rawWidth;
  let printHeightIn = rawHeight;

  if (config.orientation === 'landscape' && printWidthIn < printHeightIn) {
    const tmp = printWidthIn;
    printWidthIn = printHeightIn;
    printHeightIn = tmp;
  } else if (config.orientation === 'portrait' && printWidthIn > printHeightIn) {
    const tmp = printWidthIn;
    printWidthIn = printHeightIn;
    printHeightIn = tmp;
  }

  if (printWidthIn < media.minWidthIn) {
    notes.push(
      `Print width ${printWidthIn}" is below ${media.shortName} minimum (${media.minWidthIn}"); clamped to ${media.minWidthIn}".`
    );
    printWidthIn = media.minWidthIn;
  } else if (printWidthIn > media.maxWidthIn) {
    notes.push(
      `Print width ${printWidthIn}" exceeds ${media.shortName} maximum (${media.maxWidthIn}"); clamped to ${media.maxWidthIn}".`
    );
    printWidthIn = media.maxWidthIn;
  }

  if (printHeightIn < media.minHeightIn) {
    notes.push(
      `Print height ${printHeightIn}" is below ${media.shortName} minimum (${media.minHeightIn}"); clamped to ${media.minHeightIn}".`
    );
    printHeightIn = media.minHeightIn;
  } else if (printHeightIn > media.maxHeightIn) {
    notes.push(
      `Print height ${printHeightIn}" exceeds ${media.shortName} maximum (${media.maxHeightIn}"); clamped to ${media.maxHeightIn}".`
    );
    printHeightIn = media.maxHeightIn;
  }

  printWidthIn = roundDim(printWidthIn);
  printHeightIn = roundDim(printHeightIn);

  // 3. Resolve Frame Moulding
  let frame =
    config.frameProfileId && config.frameProfileId !== 'unframed-canvas'
      ? getFinerWorksFrameByProfileId(config.frameProfileId)
      : typeof config.finerworksFrameId === 'number' && config.finerworksFrameId > 0
        ? getFinerWorksFrameByFrameId(config.finerworksFrameId)
        : config.frameProfileId
          ? getFinerWorksFrameByProfileId(config.frameProfileId)
          : getFinerWorksFrameByFrameId(config.finerworksFrameId ?? 0);

  const frameProfileId: FrameProfileId = frame.profileId;
  const finerworksFrameId: number = frame.finerworksFrameId;

  if (media.productTypeId === 5 && frame.isFloatFrame) {
    notes.push(
      `Floater frame (${frame.name}) is intended for stretched canvas, metal, or acrylic panels; matting and glazing are disabled for float mounting.`
    );
  }

  // 4. Resolve Matting & Glazing
  const requestedMatInches =
    typeof config.matBorderInches === 'number' && config.matBorderInches > 0
      ? config.matBorderInches
      : matWidthIdToInches(config.matWidthId);
  const requestedMatWidthId: MatWidthId =
    config.matWidthId && config.matWidthId !== 'none'
      ? config.matWidthId
      : inchesToMatWidthId(requestedMatInches);
  const requestedMat = requestedMatInches > 0 || (config.finerworksMatId ?? 0) > 0;

  let resolvedGlazing =
    typeof config.finerworksGlassId === 'number' &&
    config.finerworksGlassId > 0 &&
    (!config.glazingId || config.glazingId === 'none')
      ? getFinerWorksGlazingByGlassId(config.finerworksGlassId)
      : config.glazingId
        ? getFinerWorksGlazingById(config.glazingId)
        : getFinerWorksGlazingByGlassId(config.finerworksGlassId ?? 0);

  const requestedGlazing = resolvedGlazing.finerworksGlassId > 0;

  let matWidthId: MatWidthId = requestedMatWidthId;
  let matBorderInches: number = requestedMatInches;
  let matColorId: MatColorId = config.matColorId ?? 'archival-ivory';
  let finerworksMatId: number = 0;
  let glazingId: FinerWorksGlazingId = resolvedGlazing.glazingId;
  let finerworksGlassId: number = resolvedGlazing.finerworksGlassId;

  if (matBorderInches > 0) {
    const matSpec =
      typeof config.finerworksMatId === 'number' && config.finerworksMatId > 0
        ? getFinerWorksMatByMatId(config.finerworksMatId)
        : getFinerWorksMatByColorId(matColorId);
    finerworksMatId = matSpec.finerworksMatId;
    matColorId = matSpec.matColorId;
  } else {
    matWidthId = 'none';
    matBorderInches = 0;
    finerworksMatId = 0;
  }

  // Compatibility Rule A: Non-paper substrates (Canvas=1, Metal=2, Acrylic=3) cannot be matted or glazed
  if (media.productTypeId !== 5) {
    if (requestedMat) {
      notes.push(
        `${media.shortName} (Product Type ${media.productTypeId}) is a rigid/stretched surface and cannot use archival mat board; mat border reset to none.`
      );
    }
    if (requestedGlazing) {
      notes.push(
        `${media.shortName} (Product Type ${media.productTypeId}) does not use acrylic glazing; glazing reset to none.`
      );
    }
    matWidthId = 'none';
    matBorderInches = 0;
    finerworksMatId = 0;
    glazingId = 'none';
    finerworksGlassId = 0;
  }

  // Compatibility Rule B: Unframed editions cannot include frame matting or glazing in FinerWorks SKU
  if (frame.finerworksFrameId === 0) {
    if (matBorderInches > 0 || finerworksMatId > 0) {
      notes.push(
        'Unframed prints cannot include a frame-mounted mat board in FinerWorks; mat border reset to none.'
      );
    }
    if (finerworksGlassId > 0 || glazingId !== 'none') {
      notes.push(
        'Unframed prints cannot include framing acrylic glazing; glazing reset to none.'
      );
    }
    matWidthId = 'none';
    matBorderInches = 0;
    finerworksMatId = 0;
    glazingId = 'none';
    finerworksGlassId = 0;
  }

  // Compatibility Rule C: Float frames cannot include matting or glazing
  if (frame.isFloatFrame) {
    if (matBorderInches > 0 || finerworksMatId > 0) {
      notes.push(
        `${frame.name} is an open-shadow-gap floater frame and does not support mat boards; mat border reset to none.`
      );
    }
    if (finerworksGlassId > 0 || glazingId !== 'none') {
      notes.push(
        `${frame.name} is an open-face floater frame and does not support acrylic glazing; glazing reset to none.`
      );
    }
    matWidthId = 'none';
    matBorderInches = 0;
    finerworksMatId = 0;
    glazingId = 'none';
    finerworksGlassId = 0;
  }

  const quantity = Math.max(1, Math.round(config.quantity ?? 1));
  const colorCorrect = config.colorCorrect ?? true;

  const normalizedConfig: FinerWorksDynamicProductConfig = {
    productTypeId,
    mediaId: media.mediaId,
    styleId,
    printWidthIn,
    printHeightIn,
    frameProfileId,
    finerworksFrameId,
    matWidthId,
    matBorderInches,
    matColorId,
    finerworksMatId,
    glazingId,
    finerworksGlassId,
    quantity,
    colorCorrect,
  };

  return {
    valid: true,
    notes,
    normalizedConfig,
  };
}

export function buildFinerWorksProductSpec(
  input: Partial<FinerWorksDynamicProductConfig> & { orientation?: OrientationMode }
): FinerWorksBuiltProductSpec {
  const defaultMediaId =
    typeof input.mediaId === 'number' && input.mediaId > 0
      ? input.mediaId
      : resolveDefaultMediaForProductType(input.productTypeId);
  const initialMedia = getFinerWorksMediaById(defaultMediaId);

  const initialFrame =
    typeof input.finerworksFrameId === 'number' && input.finerworksFrameId > 0
      ? getFinerWorksFrameByFrameId(input.finerworksFrameId)
      : input.frameProfileId
        ? getFinerWorksFrameByProfileId(input.frameProfileId)
        : getFinerWorksFrameByFrameId(input.finerworksFrameId ?? 0);

  const initialMatWidthId: MatWidthId =
    input.matWidthId ??
    (typeof input.matBorderInches === 'number' && input.matBorderInches > 0
      ? inchesToMatWidthId(input.matBorderInches)
      : 'none');
  const initialMatBorderInches =
    typeof input.matBorderInches === 'number' && input.matBorderInches > 0
      ? input.matBorderInches
      : matWidthIdToInches(initialMatWidthId);
  const initialMatColorId: MatColorId = input.matColorId ?? 'archival-ivory';
  const initialMatId =
    initialMatBorderInches > 0
      ? typeof input.finerworksMatId === 'number' && input.finerworksMatId > 0
        ? input.finerworksMatId
        : getFinerWorksMatByColorId(initialMatColorId).finerworksMatId
      : input.finerworksMatId ?? 0;

  const initialGlazing =
    typeof input.finerworksGlassId === 'number' &&
    input.finerworksGlassId > 0 &&
    (!input.glazingId || input.glazingId === 'none')
      ? getFinerWorksGlazingByGlassId(input.finerworksGlassId)
      : input.glazingId
        ? getFinerWorksGlazingById(input.glazingId)
        : getFinerWorksGlazingByGlassId(input.finerworksGlassId ?? 0);

  let seedWidthIn = input.printWidthIn ?? 24;
  let seedHeightIn = input.printHeightIn ?? 36;
  if (input.orientation === 'landscape' && seedWidthIn < seedHeightIn) {
    const tmp = seedWidthIn;
    seedWidthIn = seedHeightIn;
    seedHeightIn = tmp;
  } else if (input.orientation === 'portrait' && seedWidthIn > seedHeightIn) {
    const tmp = seedWidthIn;
    seedWidthIn = seedHeightIn;
    seedHeightIn = tmp;
  }

  const seedConfig: FinerWorksDynamicProductConfig & { orientation?: OrientationMode } = {
    productTypeId: input.productTypeId ?? initialMedia.productTypeId,
    mediaId: input.mediaId ?? initialMedia.mediaId,
    styleId: input.styleId ?? initialMedia.defaultStyleId,
    printWidthIn: seedWidthIn,
    printHeightIn: seedHeightIn,
    frameProfileId: input.frameProfileId ?? initialFrame.profileId,
    finerworksFrameId: input.finerworksFrameId ?? initialFrame.finerworksFrameId,
    matWidthId: initialMatWidthId,
    matBorderInches: initialMatBorderInches,
    matColorId: initialMatColorId,
    finerworksMatId: initialMatId,
    glazingId: initialGlazing.glazingId,
    finerworksGlassId: initialGlazing.finerworksGlassId,
    quantity: input.quantity ?? 1,
    colorCorrect: input.colorCorrect ?? true,
    orientation: input.orientation,
  };

  const { valid, notes, normalizedConfig } = validateFinerWorksConfiguration(seedConfig);

  const media = getFinerWorksMediaById(normalizedConfig.mediaId);
  const frame = getFinerWorksFrameByFrameId(normalizedConfig.finerworksFrameId);
  const mat = getFinerWorksMatByMatId(normalizedConfig.finerworksMatId);
  const glazing = getFinerWorksGlazingByGlassId(normalizedConfig.finerworksGlassId);

  const {
    productTypeId,
    mediaId,
    styleId,
    printWidthIn,
    printHeightIn,
    finerworksFrameId,
    matBorderInches,
    finerworksMatId,
    finerworksGlassId,
  } = normalizedConfig;

  // Physical Geometry
  const matWindowWidthIn = roundDim(printWidthIn);
  const matWindowHeightIn = roundDim(printHeightIn);
  const matOuterWidthIn = roundDim(printWidthIn + 2 * matBorderInches);
  const matOuterHeightIn = roundDim(printHeightIn + 2 * matBorderInches);

  const floatGapIn = frame.isFloatFrame ? frame.floatOffsetInches : 0;
  const frameInteriorWidthIn = roundDim(matOuterWidthIn + 2 * floatGapIn);
  const frameInteriorHeightIn = roundDim(matOuterHeightIn + 2 * floatGapIn);

  const mouldingProjectionPerSide =
    frame.finerworksFrameId === 0 ? 0 : Math.max(0, frame.thicknessInches - frame.rabbetInches);
  const frameOuterWidthIn =
    frame.finerworksFrameId === 0
      ? printWidthIn
      : roundDim(frameInteriorWidthIn + 2 * mouldingProjectionPerSide);
  const frameOuterHeightIn =
    frame.finerworksFrameId === 0
      ? printHeightIn
      : roundDim(frameInteriorHeightIn + 2 * mouldingProjectionPerSide);

  const wallDepthIn =
    frame.finerworksFrameId > 0
      ? frame.depthInches
      : productTypeId === 1
        ? 1.5
        : productTypeId === 2 || productTypeId === 3
          ? 0.75
          : 0.1;

  const isRigidShipment =
    frame.finerworksFrameId > 0 || productTypeId !== 5 || matBorderInches > 0;

  const printAreaSqIn = printWidthIn * printHeightIn;
  const framePerimeterIn = 2 * (frameInteriorWidthIn + frameInteriorHeightIn);
  const baseWeightOz =
    productTypeId === 3
      ? printAreaSqIn * 0.14
      : productTypeId === 2
        ? printAreaSqIn * 0.09
        : productTypeId === 1
          ? printAreaSqIn * 0.08
          : printAreaSqIn * 0.03;
  const frameWeightOz = frame.finerworksFrameId > 0 ? framePerimeterIn * 0.55 : 0;
  const glazingWeightOz = finerworksGlassId > 0 ? frameInteriorWidthIn * frameInteriorHeightIn * 0.045 : 0;
  const estimatedWeightOz = Math.max(8, Math.round(baseWeightOz + frameWeightOz + glazingWeightOz));

  const optimalWidthPx300Ppi = Math.round(printWidthIn * 300);
  const optimalHeightPx300Ppi = Math.round(printHeightIn * 300);

  // Dynamic FinerWorks v3 Product SKU Code
  let productCode = `${productTypeId}M${mediaId}M${styleId}S${Math.round(printWidthIn)}X${Math.round(printHeightIn)}`;

  if (finerworksFrameId > 0) {
    productCode += `F${finerworksFrameId}S${Math.round(frameInteriorWidthIn)}X${Math.round(frameInteriorHeightIn)}`;
  }

  if (finerworksMatId > 0 && matBorderInches > 0) {
    productCode += `J${finerworksMatId}S${Math.round(matWindowWidthIn)}X${Math.round(matWindowHeightIn)}`;
  }

  if (finerworksGlassId > 0) {
    productCode += `G${finerworksGlassId}`;
  }

  // Itemized FinerWorks Pricing
  const productQty = Math.max(1, Math.round(normalizedConfig.quantity ?? 1));
  const basePrintPriceUsd = roundCents(
    Math.max(media.minimumUnitPriceUsd, printAreaSqIn * media.baseRatePerSqInchUsd)
  );
  const addFramePriceUsd =
    frame.finerworksFrameId === 0
      ? 0
      : roundCents(
          frame.startingPriceUsd +
            2 * (frameInteriorWidthIn + frameInteriorHeightIn) * frame.ratePerLinearInchUsd
        );
  const addMat1PriceUsd =
    finerworksMatId === 0 || matBorderInches <= 0
      ? 0
      : roundCents(
          mat.startingPriceUsd + matOuterWidthIn * matOuterHeightIn * mat.ratePerOuterSqInchUsd
        );
  const addGlazingPriceUsd =
    finerworksGlassId === 0
      ? 0
      : roundCents(
          glazing.startingPriceUsd +
            frameInteriorWidthIn * frameInteriorHeightIn * glazing.ratePerSqInchUsd
        );

  const volumeDiscountPercent =
    productQty >= 10 ? 15 : productQty >= 5 ? 10 : productQty >= 2 ? 5 : 0;
  const unitSubtotal =
    basePrintPriceUsd + addFramePriceUsd + addMat1PriceUsd + addGlazingPriceUsd;
  const wholesaleTotalUsd = roundCents(
    unitSubtotal * productQty * (1 - volumeDiscountPercent / 100)
  );
  const suggestedGeoRetailUsd = roundCents(wholesaleTotalUsd * 1.5);

  return {
    productCode,
    valid,
    validationNotes: notes,
    config: normalizedConfig,
    physicalDimensions: {
      printWidthIn,
      printHeightIn,
      matWindowWidthIn,
      matWindowHeightIn,
      matOuterWidthIn,
      matOuterHeightIn,
      frameInteriorWidthIn,
      frameInteriorHeightIn,
      frameOuterWidthIn,
      frameOuterHeightIn,
      wallDepthIn,
      estimatedWeightOz,
      isRigidShipment,
      optimalWidthPx300Ppi,
      optimalHeightPx300Ppi,
    },
    pricing: {
      productQty,
      basePrintPriceUsd,
      addFramePriceUsd,
      addMat1PriceUsd,
      addGlazingPriceUsd,
      volumeDiscountPercent,
      wholesaleTotalUsd,
      suggestedGeoRetailUsd,
    },
  };
}

export function parseFinerWorksProductCode(
  productCode: string
): (FinerWorksBuiltProductSpec & FinerWorksDynamicProductConfig) | null {
  if (!productCode || typeof productCode !== 'string') {
    return null;
  }

  const trimmed = productCode.trim().toUpperCase();
  const baseMatch = trimmed.match(/^([1235])M(\d+)M(\d+)S(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)/);
  if (!baseMatch) {
    return null;
  }

  const productTypeId = Number(baseMatch[1]) as FinerWorksProductTypeId;
  const mediaId = Number(baseMatch[2]);
  const styleId = Number(baseMatch[3]);
  const printWidthIn = Number(baseMatch[4]);
  const printHeightIn = Number(baseMatch[5]);

  const parsed: Partial<FinerWorksDynamicProductConfig> = {
    productTypeId,
    mediaId,
    styleId,
    printWidthIn,
    printHeightIn,
    frameProfileId: 'unframed-canvas',
    finerworksFrameId: 0,
    matWidthId: 'none',
    matBorderInches: 0,
    matColorId: 'archival-ivory',
    finerworksMatId: 0,
    glazingId: 'none',
    finerworksGlassId: 0,
  };

  let frameInteriorWidthIn = printWidthIn;

  const frameMatch = trimmed.match(/F(\d+)S(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)/);
  if (frameMatch) {
    const finerworksFrameId = Number(frameMatch[1]);
    frameInteriorWidthIn = Number(frameMatch[2]);
    const frameSpec = getFinerWorksFrameByFrameId(finerworksFrameId);
    parsed.finerworksFrameId = finerworksFrameId;
    parsed.frameProfileId = frameSpec.profileId;
  }

  const matMatch = trimmed.match(/J(\d+)S(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)/);
  if (matMatch) {
    const finerworksMatId = Number(matMatch[1]);
    const matWindowWidthIn = Number(matMatch[2]);
    const matSpec = getFinerWorksMatByMatId(finerworksMatId);
    const inferredBorder = Math.max(0, roundDim((frameInteriorWidthIn - matWindowWidthIn) / 2));
    const matBorderInches = inferredBorder > 0 ? inferredBorder : 2.5;
    parsed.finerworksMatId = finerworksMatId;
    parsed.matColorId = matSpec.matColorId;
    parsed.matBorderInches = matBorderInches;
    parsed.matWidthId = inchesToMatWidthId(matBorderInches);
  }

  const glazingMatch = trimmed.match(/G(\d+)/);
  if (glazingMatch) {
    const finerworksGlassId = Number(glazingMatch[1]);
    const glazingSpec = getFinerWorksGlazingByGlassId(finerworksGlassId);
    parsed.finerworksGlassId = finerworksGlassId;
    parsed.glazingId = glazingSpec.glazingId;
  }

  const built = buildFinerWorksProductSpec(parsed);
  return {
    ...built.config,
    ...built,
  };
}

