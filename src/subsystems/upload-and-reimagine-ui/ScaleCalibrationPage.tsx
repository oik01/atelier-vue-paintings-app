import React, { useEffect, useRef, useState } from 'react';
import {
  FinerWorksBuiltProductSpec,
  FinerWorksGlazingId,
  FRAME_PROFILES,
  FrameProfileId,
  ImageCaliperSegment,
  MatColorId,
  MatWidthId,
  NormalizedCropBox,
  PRINT_SIZES,
  PrintSizeId,
  RoomAngleAsset,
  ScaleCalibrationQuestion,
  ScaleCalibrationResult,
} from '../../contracts/masterContract';
import { buildFinerWorksProductSpec } from '../finerworks-catalog-sync';
import {
  refineArtworkOuterFrameBoxInCanvas,
  sanitizeNormalizedCropBox,
  synthesizeTightFrameDetectionLayerDataUrl,
} from '../openrouter-ai-engine';

export const DEFAULT_SCALE_CALIBRATION_QUESTIONS: ScaleCalibrationQuestion[] = [
  {
    id: 'reference-furniture-width',
    questionText:
      'What is the horizontal measurement of Caliper A on the same wall / same camera distance as the art piece?',
    helperText:
      'Align pinpoint Caliper A horizontally (0.0° True Horizontal) across a reference feature on the same wall plane (same distance from the camera as the painting) and enter its width in inches. One measurement is enough to calibrate.',
    unitLabel: 'inches',
    placeholder: 'e.g., 72',
    suggestedQuickValuesInches: [
      { label: '60" (5 ft)', valueInches: 60 },
      { label: '72" (6 ft)', valueInches: 72 },
      { label: '84" (7 ft)', valueInches: 84 },
      { label: '96" (8 ft)', valueInches: 96 },
    ],
    userAnswerInches: null,
    caliper: {
      badgeCode: 'A',
      shortLabel: 'Horizontal Same-Wall Span',
      axis: 'horizontal',
      x1: 210,
      y1: 725,
      x2: 790,
      y2: 725,
      colorHex: '#9E5A3C',
    },
  },
  {
    id: 'target-wall-width',
    questionText:
      'What is the vertical measurement of Caliper B on the same wall / same camera distance as the art piece?',
    helperText:
      'Optional 2nd measurement (Horizontal + Vertical is ideal): align pinpoint Caliper B vertically (90.0° True Vertical) on the same wall plane and enter its height in inches. Must agree within 5% of Caliper A scale.',
    unitLabel: 'inches',
    placeholder: 'e.g., 96',
    suggestedQuickValuesInches: [
      { label: '80" (6.7 ft)', valueInches: 80 },
      { label: '96" (8 ft)', valueInches: 96 },
      { label: '112" (9.3 ft)', valueInches: 112 },
      { label: '128" (10.7 ft)', valueInches: 128 },
    ],
    userAnswerInches: null,
    caliper: {
      badgeCode: 'B',
      shortLabel: 'Vertical Same-Wall Span',
      axis: 'vertical',
      x1: 145,
      y1: 115,
      x2: 145,
      y2: 889,
      colorHex: '#2E5A44',
    },
  },
  {
    id: 'wall-ceiling-height',
    questionText:
      'What is the secondary same-wall reference span (Caliper C)?',
    helperText:
      'Optional cross-check caliper on the same wall plane at the same camera distance.',
    unitLabel: 'inches',
    placeholder: 'e.g., 108',
    suggestedQuickValuesInches: [
      { label: '96" (8 ft)', valueInches: 96 },
      { label: '108" (9 ft)', valueInches: 108 },
      { label: '120" (10 ft)', valueInches: 120 },
      { label: '144" (12 ft)', valueInches: 144 },
    ],
    userAnswerInches: null,
    caliper: {
      badgeCode: 'C',
      shortLabel: 'Secondary Same-Wall Span',
      axis: 'horizontal',
      x1: 100,
      y1: 380,
      x2: 900,
      y2: 380,
      colorHex: '#3B5998',
    },
  },
];

export const DEFAULT_SCALE_QUESTIONS = DEFAULT_SCALE_CALIBRATION_QUESTIONS;

function parseMatInches(matWidthId?: MatWidthId): number {
  if (matWidthId === '1.5in') return 1.5;
  if (matWidthId === '2.5in') return 2.5;
  if (matWidthId === '3.5in') return 3.5;
  return 0;
}

export function computeCaliperAngleInfo(cal: ImageCaliperSegment): {
  angleDeg: number;
  isTrueHorizontal: boolean;
  isTrueVertical: boolean;
  statusLabel: string;
} {
  const dx = cal.x2 - cal.x1;
  const dy = cal.y2 - cal.y1;
  if (Math.abs(dy) <= 1 && Math.abs(dx) > 0) {
    return {
      angleDeg: 0,
      isTrueHorizontal: true,
      isTrueVertical: false,
      statusLabel: '0.0° True Horizontal (Clipped)',
    };
  }
  if (Math.abs(dx) <= 1 && Math.abs(dy) > 0) {
    return {
      angleDeg: 90,
      isTrueHorizontal: false,
      isTrueVertical: true,
      statusLabel: '90.0° True Vertical (Clipped)',
    };
  }
  const rawDeg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  const foldedDeg = rawDeg > 90 ? 180 - rawDeg : rawDeg;
  const rounded = Math.round(foldedDeg * 10) / 10;
  return {
    angleDeg: rounded,
    isTrueHorizontal: false,
    isTrueVertical: false,
    statusLabel: `${rounded}° Angle`,
  };
}

export function parseSvgNaturalDimensions(
  dataUrl?: string | null
): { width: number; height: number } | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/svg+xml')) {
    return null;
  }
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return null;
    const rawPayload = dataUrl.slice(commaIdx + 1);
    const decoded = dataUrl.includes(';base64,')
      ? typeof atob === 'function'
        ? atob(rawPayload)
        : ''
      : decodeURIComponent(rawPayload);
    const vbMatch = decoded.match(
      /viewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i
    );
    if (vbMatch) {
      const w = Number(vbMatch[1]);
      const h = Number(vbMatch[2]);
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        return { width: w, height: h };
      }
    }
    const wMatch = decoded.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
    const hMatch = decoded.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
    if (wMatch && hMatch) {
      const w = Number(wMatch[1]);
      const h = Number(hMatch[1]);
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        return { width: w, height: h };
      }
    }
  } catch {
    // Ignore malformed SVG URI
  }
  return null;
}

export function computeFallbackScaleRecommendation(
  questions: ScaleCalibrationQuestion[],
  options?: {
    cropBox?: NormalizedCropBox;
    frameMouldingWidthInches?: number;
    matWidthInches?: number;
    imageWidthPx?: number;
    imageHeightPx?: number;
  }
): ScaleCalibrationResult {
  const safeQuestions =
    questions && questions.length > 0
      ? questions
      : DEFAULT_SCALE_CALIBRATION_QUESTIONS;

  const imageWidthPx =
    typeof options?.imageWidthPx === 'number' &&
    Number.isFinite(options.imageWidthPx) &&
    options.imageWidthPx > 0
      ? options.imageWidthPx
      : 1000;
  const imageHeightPx =
    typeof options?.imageHeightPx === 'number' &&
    Number.isFinite(options.imageHeightPx) &&
    options.imageHeightPx > 0
      ? options.imageHeightPx
      : 1000;

  const answered = safeQuestions.filter(
    (q) =>
      typeof q.userAnswerInches === 'number' &&
      Number.isFinite(q.userAnswerInches) &&
      q.userAnswerInches > 0
  );

  const findAnswer = (idKeyword: string, fallbackIndex: number): number | null => {
    const byId = safeQuestions.find((q) =>
      q.id.toLowerCase().includes(idKeyword)
    );
    if (
      byId &&
      typeof byId.userAnswerInches === 'number' &&
      Number.isFinite(byId.userAnswerInches) &&
      byId.userAnswerInches > 0
    ) {
      return byId.userAnswerInches;
    }
    const byIdx = safeQuestions[fallbackIndex];
    if (
      byIdx &&
      typeof byIdx.userAnswerInches === 'number' &&
      Number.isFinite(byIdx.userAnswerInches) &&
      byIdx.userAnswerInches > 0
    ) {
      return byIdx.userAnswerInches;
    }
    return null;
  };

  const furnitureWidth = findAnswer('furniture', 0);
  const wallWidth = findAnswer('wall', 1);
  const ceilingHeight = findAnswer('ceiling', 2);

  const estimatedWallWidthInches = Math.round(
    wallWidth ?? (furnitureWidth ? furnitureWidth * 1.35 : 104)
  );

  let targetArtWidth = 24;
  if (furnitureWidth && wallWidth) {
    targetArtWidth = Math.min(furnitureWidth * 0.41, wallWidth * 0.345);
  } else if (furnitureWidth) {
    targetArtWidth = furnitureWidth * 0.35;
  } else if (wallWidth) {
    targetArtWidth = wallWidth * 0.27;
  }

  if (ceilingHeight) {
    if (ceilingHeight >= 120) {
      targetArtWidth = Math.max(targetArtWidth, 30);
    } else if (ceilingHeight <= 90) {
      targetArtWidth = Math.min(targetArtWidth, 24);
    }
  }

  const box = options?.cropBox ?? { ymin: 180, xmin: 260, ymax: 560, xmax: 740 };
  const cropSpanNormX = Math.max(60, Math.min(950, Math.abs(box.xmax - box.xmin)));
  const cropSpanNormY = Math.max(60, Math.min(950, Math.abs(box.ymax - box.ymin)));

  const answeredScales: number[] = [];

  for (let i = 0; i < safeQuestions.length; i++) {
    const q = safeQuestions[i];
    const val = q.userAnswerInches;
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
      continue;
    }
    const fallbackDef =
      DEFAULT_SCALE_CALIBRATION_QUESTIONS.find(
        (dq) =>
          dq.id === q.id ||
          (q.caliper?.badgeCode && dq.caliper?.badgeCode === q.caliper.badgeCode)
      ) ?? DEFAULT_SCALE_CALIBRATION_QUESTIONS[i];
    const cal = q.caliper ?? fallbackDef?.caliper;

    const dxPx = cal
      ? ((cal.x2 - cal.x1) / 1000) * imageWidthPx
      : i === 0
        ? 0.435 * imageWidthPx
        : 0;
    const dyPx = cal
      ? ((cal.y2 - cal.y1) / 1000) * imageHeightPx
      : i === 0
        ? 0
        : 0.774 * imageHeightPx;
    const spanPx = Math.max(1, Math.hypot(dxPx, dyPx));

    const inchesPerPixel = val / spanPx;
    answeredScales.push(inchesPerPixel);
  }

  let scaleDiscrepancyPercent = 0;
  let hasScaleInaccuracyError = false;
  let scaleErrorExplanation: string | undefined = undefined;

  if (answeredScales.length >= 2) {
    const scale1 = answeredScales[0];
    const scale2 = answeredScales[1];
    const meanScale = (scale1 + scale2) / 2;
    scaleDiscrepancyPercent =
      Math.round((Math.abs(scale1 - scale2) / Math.max(1e-6, meanScale)) * 1000) / 10;
    if (scaleDiscrepancyPercent > 5.0) {
      hasScaleInaccuracyError = true;
      scaleErrorExplanation = `Measurement Inaccuracy Error: Your two measurements differ in scale by ${scaleDiscrepancyPercent}% (exceeds the 5% maximum tolerance). Please make sure both measurements are taken on the same wall at the same distance from the camera in a head-on level photo, and adjust the caliper endpoints or inch values so they agree within 5%.`;
    }
  }

  const mouldingW =
    typeof options?.frameMouldingWidthInches === 'number'
      ? Math.max(0, options.frameMouldingWidthInches)
      : 1.25;
  const matW =
    typeof options?.matWidthInches === 'number'
      ? Math.max(0, options.matWidthInches)
      : 0;
  const totalBorderDeduction = 2 * (mouldingW + matW);

  let calculatedOuterFrameWidthInches = Math.round(targetArtWidth * 10) / 10;
  let calculatedOuterFrameHeightInches = Math.round(targetArtWidth * 1.33 * 10) / 10;

  if (answeredScales.length > 0) {
    const avgInchesPerPixel =
      answeredScales.reduce((a, b) => a + b, 0) / answeredScales.length;
    const outerFrameWidthIn =
      (cropSpanNormX / 1000) * imageWidthPx * avgInchesPerPixel;
    const outerFrameHeightIn =
      (cropSpanNormY / 1000) * imageHeightPx * avgInchesPerPixel;

    calculatedOuterFrameWidthInches =
      Math.round(Math.max(8, Math.min(120, outerFrameWidthIn)) * 10) / 10;
    calculatedOuterFrameHeightInches =
      Math.round(Math.max(8, Math.min(120, outerFrameHeightIn)) * 10) / 10;
    targetArtWidth = Math.max(
      8,
      calculatedOuterFrameWidthInches - totalBorderDeduction
    );
  }

  const calculatedInnerPictureWidthInches =
    Math.round(
      Math.max(8, calculatedOuterFrameWidthInches - totalBorderDeduction) * 10
    ) / 10;
  const calculatedInnerPictureHeightInches =
    Math.round(
      Math.max(10, calculatedOuterFrameHeightInches - totalBorderDeduction) * 10
    ) / 10;

  let recommendedSizeId: PrintSizeId = '24x36';
  if (targetArtWidth < 16) {
    recommendedSizeId = '12x16';
  } else if (targetArtWidth < 22) {
    recommendedSizeId = '18x24';
  } else if (targetArtWidth < 28) {
    recommendedSizeId = '24x36';
  } else if (targetArtWidth < 34) {
    recommendedSizeId = '30x40';
  } else {
    recommendedSizeId = '36x48';
  }

  const sizeSpec = PRINT_SIZES[recommendedSizeId];
  const isCalibrated = answered.length > 0 && !hasScaleInaccuracyError;
  const suggestedEditionOuterWidthInches =
    Math.round((sizeSpec.widthInches + totalBorderDeduction) * 10) / 10;
  const suggestedEditionOuterHeightInches =
    Math.round((sizeSpec.heightInches + totalBorderDeduction) * 10) / 10;

  const rationale = hasScaleInaccuracyError
    ? scaleErrorExplanation!
    : isCalibrated
    ? `Recalibrated from ${answered.length} same-wall caliper measurement${
        answered.length === 1
          ? ''
          : `s (${scaleDiscrepancyPercent}% scale variance ≤ 5%)`
      } in your head-on photo: the white frame box around your painting measures ~${calculatedOuterFrameWidthInches}" × ${calculatedOuterFrameHeightInches}" outer frame (inner picture ~${calculatedInnerPictureWidthInches}" × ${calculatedInnerPictureHeightInches}"), making the ${
        sizeSpec.labelInches
      } edition our closest match.`
    : `Based on standard gallery proportions (${estimatedWallWidthInches}" reference wall span), ${sizeSpec.labelInches} (${sizeSpec.scaleDescription}) offers balanced focal presence. Place Caliper A on a feature on the same wall as the art piece to calibrate.`;

  return {
    isCalibrated,
    recommendedSizeId,
    recommendedDimensionsLabel: sizeSpec.labelInches,
    estimatedWallWidthInches,
    estimatedArtworkWidthInches: sizeSpec.widthInches,
    estimatedArtworkHeightInches: sizeSpec.heightInches,
    rationale,
    questionsAnsweredCount: answered.length,
    calculatedOuterFrameWidthInches,
    calculatedOuterFrameHeightInches,
    calculatedInnerPictureWidthInches,
    calculatedInnerPictureHeightInches,
    suggestedEditionOuterWidthInches,
    suggestedEditionOuterHeightInches,
    scaleDiscrepancyPercent,
    hasScaleInaccuracyError,
    scaleErrorExplanation,
  };
}

export const computeDefaultScaleRecommendation =
  computeFallbackScaleRecommendation;

const DEFAULT_CALIPERS: ImageCaliperSegment[] = [
  DEFAULT_SCALE_CALIBRATION_QUESTIONS[0].caliper!,
  DEFAULT_SCALE_CALIBRATION_QUESTIONS[1].caliper!,
  DEFAULT_SCALE_CALIBRATION_QUESTIONS[2].caliper!,
];

const ZOOM_PRESETS: number[] = [1, 1.5, 2, 3, 4];

export interface ScaleCalibrationPageProps {
  roomImageDataUrl: string | null;
  roomAngles?: RoomAngleAsset[];
  questions: ScaleCalibrationQuestion[];
  isLoadingQuestions?: boolean;
  scaleRecommendation: ScaleCalibrationResult;
  cropBox?: NormalizedCropBox;
  frameDetectionLayerDataUrl?: string;
  selectedFrameId?: FrameProfileId;
  selectedMatWidthId?: MatWidthId;
  selectedMediaId?: number;
  selectedMatColorId?: MatColorId;
  selectedGlazingId?: FinerWorksGlazingId;
  onApplyCustomFinerWorksDimensions?: (
    customWidthIn: number,
    customHeightIn: number,
    customSpec: FinerWorksBuiltProductSpec
  ) => void;
  isPostVisualizationModal?: boolean;
  headOnPhotoLabel?: string;
  artworkTitle?: string;
  onUpdateQuestionAnswer: (
    questionId: string,
    valueInches: number | null
  ) => void;
  onUpdateQuestionCaliper?: (
    questionId: string,
    caliper: ImageCaliperSegment
  ) => void;
  onUpdateCropBox?: (newBox: NormalizedCropBox) => void;
  onApplyScaleAndCreate: () => void;
  onSkipScaleAndCreate: () => void;
  onBackToCuration: () => void;
  onCloseSizingModal?: () => void;
}

export const ScaleCalibrationPage: React.FC<ScaleCalibrationPageProps> = ({
  roomImageDataUrl,
  roomAngles = [],
  questions,
  isLoadingQuestions = false,
  scaleRecommendation,
  cropBox,
  frameDetectionLayerDataUrl,
  selectedFrameId = 'natural-white-oak',
  selectedMatWidthId = 'none',
  selectedMediaId,
  selectedMatColorId,
  selectedGlazingId,
  onApplyCustomFinerWorksDimensions,
  isPostVisualizationModal = false,
  headOnPhotoLabel,
  artworkTitle,
  onUpdateQuestionAnswer,
  onUpdateQuestionCaliper,
  onUpdateCropBox,
  onApplyScaleAndCreate,
  onSkipScaleAndCreate,
  onBackToCuration,
  onCloseSizingModal,
}) => {
  const [localAnswers, setLocalAnswers] = useState<
    Record<string, number | null>
  >({});
  const [localCalipers, setLocalCalipers] = useState<
    Record<string, ImageCaliperSegment>
  >({});
  const [activeCaliperIndex, setActiveCaliperIndex] = useState<number>(0);

  // Native Zoom-In state (1x up to 4x) & Orthogonal Angle Clipping (0° Horizontal / 90° Vertical)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isOrthoSnapEnabled, setIsOrthoSnapEnabled] = useState<boolean>(true);
  const [showFrameDetectionLayer, setShowFrameDetectionLayer] =
    useState<boolean>(true);

  // Editable / Auto-Aligned Outer Frame Box (`cropBox`) used to calculate physical frame & picture dimensions
  const [localCropBox, setLocalCropBox] = useState<NormalizedCropBox | null>(null);
  const [isAutoAligningFrameBox, setIsAutoAligningFrameBox] = useState<boolean>(false);

  // Track natural pixel dimensions of the displayed room image for isotropic [0..1000] -> pixel conversion
  const [imageNaturalDims, setImageNaturalDims] = useState<{
    width: number;
    height: number;
  }>({ width: 1000, height: 1000 });

  // User starts with 1 caliper, takes the measurement and leaves it, then has the option to add a 2nd measurement
  const initialAnsweredCount = (questions ?? []).filter(
    (q) =>
      typeof q.userAnswerInches === 'number' &&
      Number.isFinite(q.userAnswerInches) &&
      q.userAnswerInches > 0
  ).length;
  const [visibleCaliperCount, setVisibleCaliperCount] = useState<number>(
    initialAnsweredCount >= 2 ? 2 : 1
  );

  const [draggingHandle, setDraggingHandle] = useState<
    | {
        kind: 'caliper';
        questionId: string;
        endpoint: 'start' | 'end';
        caliper: ImageCaliperSegment;
      }
    | {
        kind: 'frame-corner';
        corner: 'nw' | 'ne' | 'sw' | 'se';
        startBox: NormalizedCropBox;
      }
    | null
  >(null);

  const [loupeCoords, setLoupeCoords] = useState<{
    normX: number;
    normY: number;
    label: string;
  } | null>(null);

  const imageStageRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const effectiveCropBox: NormalizedCropBox = sanitizeNormalizedCropBox(
    localCropBox ?? cropBox ?? { ymin: 180, xmin: 260, ymax: 560, xmax: 740 }
  );

  // Automatically snap the white frame box onto the rendered outer frame edges when the room image loads
  useEffect(() => {
    if (!roomImageDataUrl || roomImageDataUrl.startsWith('data:image/svg+xml')) {
      return;
    }
    let cancelled = false;
    const seedBox = sanitizeNormalizedCropBox(
      cropBox ?? { ymin: 180, xmin: 260, ymax: 560, xmax: 740 }
    );
    refineArtworkOuterFrameBoxInCanvas({
      reimaginedRoomDataUrl: roomImageDataUrl,
      coarseBox: seedBox,
    })
      .then((refined) => {
        if (cancelled) return;
        const changed =
          Math.abs(refined.xmin - seedBox.xmin) > 2 ||
          Math.abs(refined.ymin - seedBox.ymin) > 2 ||
          Math.abs(refined.xmax - seedBox.xmax) > 2 ||
          Math.abs(refined.ymax - seedBox.ymax) > 2;
        if (changed) {
          setLocalCropBox(refined);
          onUpdateCropBox?.(refined);
        }
      })
      .catch(() => {
        // Keep current cropBox
      });
    return () => {
      cancelled = true;
    };
  }, [roomImageDataUrl]);

  const handleAutoSnapFrameBox = async () => {
    if (!roomImageDataUrl) return;
    setIsAutoAligningFrameBox(true);
    try {
      const refined = await refineArtworkOuterFrameBoxInCanvas({
        reimaginedRoomDataUrl: roomImageDataUrl,
        coarseBox: effectiveCropBox,
      });
      setLocalCropBox(refined);
      onUpdateCropBox?.(refined);
    } finally {
      setIsAutoAligningFrameBox(false);
    }
  };

  const baseQuestions =
    questions && questions.length > 0
      ? questions
      : DEFAULT_SCALE_CALIBRATION_QUESTIONS;

  const effectiveQuestions: ScaleCalibrationQuestion[] = baseQuestions.map(
    (q, idx) => {
      const fallbackCaliper =
        DEFAULT_CALIPERS[idx] ?? DEFAULT_CALIPERS[0];
      return {
        ...q,
        caliper:
          localCalipers[q.id] ??
          q.caliper ?? {
            ...fallbackCaliper,
          },
        userAnswerInches:
          q.id in localAnswers
            ? localAnswers[q.id]
            : q.userAnswerInches !== undefined && q.userAnswerInches !== null
              ? q.userAnswerInches
              : null,
      };
    }
  );

  const visibleQuestions = effectiveQuestions.slice(0, visibleCaliperCount);

  const frameSpec =
    FRAME_PROFILES[selectedFrameId] ?? FRAME_PROFILES['natural-white-oak'];
  const matInches = parseMatInches(selectedMatWidthId);

  const fallbackComputed = computeFallbackScaleRecommendation(
    visibleQuestions,
    {
      cropBox: cropBox || localCropBox ? effectiveCropBox : undefined,
      frameMouldingWidthInches: frameSpec.mouldingWidthInches,
      matWidthInches: matInches,
      imageWidthPx: imageNaturalDims.width,
      imageHeightPx: imageNaturalDims.height,
    }
  );

  const hasLocalChanges =
    Object.keys(localAnswers).length > 0 ||
    Object.keys(localCalipers).length > 0 ||
    localCropBox !== null;

  const hasAnsweredVisibleQuestions = visibleQuestions.some(
    (q) =>
      typeof q.userAnswerInches === 'number' &&
      Number.isFinite(q.userAnswerInches) &&
      q.userAnswerInches > 0
  );

  const effectiveRecommendation: ScaleCalibrationResult =
    scaleRecommendation &&
    !hasLocalChanges &&
    !hasAnsweredVisibleQuestions &&
    (scaleRecommendation.isCalibrated || scaleRecommendation.hasScaleInaccuracyError)
      ? {
          ...fallbackComputed,
          ...scaleRecommendation,
        }
      : fallbackComputed;

  const handleSetAnswer = (questionId: string, valueInches: number | null) => {
    setLocalAnswers((prev) => ({
      ...prev,
      [questionId]: valueInches,
    }));
    onUpdateQuestionAnswer(questionId, valueInches);
  };

  const handleAddSecondCaliper = () => {
    setVisibleCaliperCount(2);
    setActiveCaliperIndex(1);
  };

  const handleRemoveSecondCaliper = () => {
    const secondQ = effectiveQuestions[1];
    if (secondQ) {
      handleSetAnswer(secondQ.id, null);
    }
    setVisibleCaliperCount(1);
    setActiveCaliperIndex(0);
  };

  // 1-Click True Horizontal (0°) or True Vertical (90°) Angle Clipping
  const handleSnapCaliperToAxis = (
    questionIndex: number,
    targetAxis: 'horizontal' | 'vertical'
  ) => {
    const targetQ = effectiveQuestions[questionIndex];
    if (!targetQ) return;
    const cal =
      targetQ.caliper ??
      DEFAULT_CALIPERS[questionIndex] ??
      DEFAULT_CALIPERS[0];
    const midX = Math.round((cal.x1 + cal.x2) / 2);
    const midY = Math.round((cal.y1 + cal.y2) / 2);
    const halfSpan = Math.max(
      45,
      Math.round(Math.hypot(cal.x2 - cal.x1, cal.y2 - cal.y1) / 2)
    );

    let nextCaliper: ImageCaliperSegment;
    if (targetAxis === 'horizontal') {
      const x1 = Math.max(15, Math.min(985 - halfSpan * 2, midX - halfSpan));
      const x2 = Math.max(x1 + 60, Math.min(985, x1 + halfSpan * 2));
      const y = Math.max(15, Math.min(985, midY));
      nextCaliper = {
        ...cal,
        x1,
        y1: y,
        x2,
        y2: y,
        axis: 'horizontal',
      };
    } else {
      const y1 = Math.max(15, Math.min(985 - halfSpan * 2, midY - halfSpan));
      const y2 = Math.max(y1 + 60, Math.min(985, y1 + halfSpan * 2));
      const x = Math.max(15, Math.min(985, midX));
      nextCaliper = {
        ...cal,
        x1: x,
        y1,
        x2: x,
        y2,
        axis: 'vertical',
      };
    }

    setLocalCalipers((prev) => ({
      ...prev,
      [targetQ.id]: nextCaliper,
    }));
    onUpdateQuestionCaliper?.(targetQ.id, nextCaliper);
  };

  const handleSetZoom = (nextZoom: number) => {
    const clamped = Math.max(1, Math.min(4, Math.round(nextZoom * 2) / 2));
    setZoomLevel(clamped);
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      handleSetZoom(zoomLevel + delta);
    }
  };

  const handlePointerMoveStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingHandle || !imageStageRef.current) return;
    const rect = imageStageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const rawNormX = Math.round(
      Math.max(8, Math.min(992, ((e.clientX - rect.left) / rect.width) * 1000))
    );
    const rawNormY = Math.round(
      Math.max(8, Math.min(992, ((e.clientY - rect.top) / rect.height) * 1000))
    );

    if (draggingHandle.kind === 'frame-corner') {
      const b = draggingHandle.startBox;
      let nextBox: NormalizedCropBox = { ...b };
      if (draggingHandle.corner === 'nw') {
        nextBox.xmin = Math.min(b.xmax - 80, rawNormX);
        nextBox.ymin = Math.min(b.ymax - 80, rawNormY);
      } else if (draggingHandle.corner === 'ne') {
        nextBox.xmax = Math.max(b.xmin + 80, rawNormX);
        nextBox.ymin = Math.min(b.ymax - 80, rawNormY);
      } else if (draggingHandle.corner === 'sw') {
        nextBox.xmin = Math.min(b.xmax - 80, rawNormX);
        nextBox.ymax = Math.max(b.ymin + 80, rawNormY);
      } else if (draggingHandle.corner === 'se') {
        nextBox.xmax = Math.max(b.xmin + 80, rawNormX);
        nextBox.ymax = Math.max(b.ymin + 80, rawNormY);
      }
      const sanitized = sanitizeNormalizedCropBox(nextBox);
      setLocalCropBox(sanitized);
      onUpdateCropBox?.(sanitized);
      setLoupeCoords({
        normX: rawNormX,
        normY: rawNormY,
        label: `Frame Corner (${draggingHandle.corner.toUpperCase()})`,
      });
      return;
    }

    // Caliper endpoint drag with True Horizontal (0°) & True Vertical (90°) magnetic angle clipping
    const currentCaliper =
      localCalipers[draggingHandle.questionId] ?? draggingHandle.caliper;
    const anchorX =
      draggingHandle.endpoint === 'start'
        ? currentCaliper.x2
        : currentCaliper.x1;
    const anchorY =
      draggingHandle.endpoint === 'start'
        ? currentCaliper.y2
        : currentCaliper.y1;

    let normX = rawNormX;
    let normY = rawNormY;
    let nextAxis: 'horizontal' | 'vertical' | 'diagonal' = currentCaliper.axis;

    const dx = rawNormX - anchorX;
    const dy = rawNormY - anchorY;

    if (isOrthoSnapEnabled || e.shiftKey) {
      // Clip to True Horizontal (0.0°) when within ±15° of horizontal or within 18 normalized units vertically
      if (Math.abs(dy) <= Math.abs(dx) * 0.27 || Math.abs(dy) <= 18) {
        normY = anchorY;
        nextAxis = 'horizontal';
      } else if (Math.abs(dx) <= Math.abs(dy) * 0.27 || Math.abs(dx) <= 18) {
        // Clip to True Vertical (90.0°) when within ±15° of vertical or within 18 normalized units horizontally
        normX = anchorX;
        nextAxis = 'vertical';
      } else {
        nextAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
      }
    }

    const updatedCaliper: ImageCaliperSegment =
      draggingHandle.endpoint === 'start'
        ? {
            ...currentCaliper,
            x1: normX,
            y1: normY,
            axis: nextAxis,
          }
        : {
            ...currentCaliper,
            x2: normX,
            y2: normY,
            axis: nextAxis,
          };

    setLocalCalipers((prev) => ({
      ...prev,
      [draggingHandle.questionId]: updatedCaliper,
    }));
    onUpdateQuestionCaliper?.(draggingHandle.questionId, updatedCaliper);

    const angleInfo = computeCaliperAngleInfo(updatedCaliper);
    setLoupeCoords({
      normX,
      normY,
      label: `Caliper ${updatedCaliper.badgeCode} · ${angleInfo.statusLabel}`,
    });
  };

  const handlePointerUpStage = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
      setLoupeCoords(null);
    }
  };

  const headOnRoomAngle =
    roomAngles.find((a) => a.isHeadOnSizingPhoto) ?? roomAngles[0];
  const resolvedHeadOnLabel =
    headOnPhotoLabel ||
    headOnRoomAngle?.label ||
    'Head-On Level Wall Photograph';

  // Exact un-clamped percentages mapped 1:1 to the uncropped natural-aspect-ratio image
  const artLeftPct = Math.max(0, Math.min(98, effectiveCropBox.xmin / 10));
  const artTopPct = Math.max(0, Math.min(98, effectiveCropBox.ymin / 10));
  const artWidthPct = Math.max(
    4,
    Math.min(100 - artLeftPct, (effectiveCropBox.xmax - effectiveCropBox.xmin) / 10)
  );
  const artHeightPct = Math.max(
    4,
    Math.min(100 - artTopPct, (effectiveCropBox.ymax - effectiveCropBox.ymin) / 10)
  );

  // Separate transparent Frame Detection Layer tightly locked to the frame molding (zero wall space)
  const activeFrameLayerDataUrl =
    localCropBox === null && frameDetectionLayerDataUrl
      ? frameDetectionLayerDataUrl
      : synthesizeTightFrameDetectionLayerDataUrl(effectiveCropBox);

  const frameSpanUnitsX = Math.max(
    1,
    Math.round(effectiveCropBox.xmax - effectiveCropBox.xmin)
  );
  const frameSpanUnitsY = Math.max(
    1,
    Math.round(effectiveCropBox.ymax - effectiveCropBox.ymin)
  );

  const primaryCaliperQuestion = visibleQuestions[0];
  const primaryCaliperSeg =
    primaryCaliperQuestion?.caliper ?? DEFAULT_CALIPERS[0];
  const primaryRulerSpanUnits = Math.max(
    1,
    Math.round(
      Math.hypot(
        primaryCaliperSeg.x2 - primaryCaliperSeg.x1,
        primaryCaliperSeg.y2 - primaryCaliperSeg.y1
      )
    )
  );
  const frameToRulerRatioPct = Math.round(
    (frameSpanUnitsX / primaryRulerSpanUnits) * 1000
  ) / 10;

  const recommendedSizeSpec =
    PRINT_SIZES[effectiveRecommendation.recommendedSizeId] ??
    PRINT_SIZES['24x36'];
  const isErrorBlocked = Boolean(effectiveRecommendation.hasScaleInaccuracyError);

  const standardFwSpec = buildFinerWorksProductSpec({
    mediaId: selectedMediaId ?? 42,
    printWidthIn: recommendedSizeSpec.widthInches,
    printHeightIn: recommendedSizeSpec.heightInches,
    frameProfileId: selectedFrameId,
    matWidthId: selectedMatWidthId,
    matColorId: selectedMatColorId ?? 'archival-ivory',
    glazingId: selectedGlazingId ?? 'clear-acrylic',
  });

  const customFwSpec = buildFinerWorksProductSpec({
    mediaId: selectedMediaId ?? 42,
    printWidthIn: Math.round(
      effectiveRecommendation.calculatedInnerPictureWidthInches ??
        recommendedSizeSpec.widthInches
    ),
    printHeightIn: Math.round(
      effectiveRecommendation.calculatedInnerPictureHeightInches ??
        recommendedSizeSpec.heightInches
    ),
    frameProfileId: selectedFrameId,
    matWidthId: selectedMatWidthId,
    matColorId: selectedMatColorId ?? 'archival-ivory',
    glazingId: selectedGlazingId ?? 'clear-acrylic',
  });

  return (
    <section
      data-testid="scale-calibration-page"
      aria-label="Interactive Caliper Room Scale and Frame Sizing Tool"
      className="w-full rounded-xl border-2 border-[#4A3B32] bg-[#FAF6EE] p-3 sm:p-5 shadow-[0_16px_38px_rgba(31,28,24,0.08)]"
    >
      <div className="rounded-lg border border-[#DFD7C8] bg-[#F5F0E6]/75 p-4 sm:p-6">
        {/* Top Navigation & Prominent Skip / Close Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 mb-5 border-b border-[#DFD7C8]">
          {isPostVisualizationModal && onCloseSizingModal ? (
            <button
              type="button"
              data-testid="close-caliper-sizing-modal-btn"
              onClick={onCloseSizingModal}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-4 py-2 text-xs sm:text-sm font-semibold text-[#1F1C18] hover:bg-[#EFECE6] transition-colors self-start sm:self-auto"
            >
              <span aria-hidden="true">←</span>
              <span>Back to Approved Painting &amp; Studio</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid="back-to-curation-from-scale-btn"
              onClick={onBackToCuration}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-4 py-2 text-xs sm:text-sm font-semibold text-[#1F1C18] hover:bg-[#EFECE6] transition-colors self-start sm:self-auto"
            >
              <span aria-hidden="true">←</span>
              <span>Back to Vision &amp; Presets</span>
            </button>
          )}
          {/* Accessible alias for test compatibility */}
          <button
            type="button"
            data-testid="scale-back-to-page-2-btn"
            onClick={
              isPostVisualizationModal && onCloseSizingModal
                ? onCloseSizingModal
                : onBackToCuration
            }
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          >
            Back
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              data-testid="sizing-head-on-photo-indicator"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#9E5A3C]/45 bg-[#FAF6EE] px-3 py-1 text-xs font-semibold text-[#9E5A3C]"
            >
              <span>★ Sizing Reference: Head-On Photo ({resolvedHeadOnLabel})</span>
            </span>

            <button
              type="button"
              data-testid="skip-scale-page-btn"
              onClick={
                isPostVisualizationModal && onCloseSizingModal
                  ? onCloseSizingModal
                  : onSkipScaleAndCreate
              }
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#9E5A3C]/40 bg-[#FAF6EE] px-4 py-2 text-xs sm:text-sm font-semibold text-[#9E5A3C] hover:bg-[#9E5A3C] hover:text-[#FAF6EE] transition-colors shadow-xs"
            >
              <span>
                {isPostVisualizationModal
                  ? 'Keep Current Size & Return to Gallery →'
                  : 'Skip Measurements & Create Art Piece(s) Now →'}
              </span>
            </button>
          </div>
        </div>

        {/* Title & Same-Wall / Same-Camera-Distance Measurement Instructions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
          <div className="max-w-4xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9E5A3C]">
              <span>
                {isPostVisualizationModal
                  ? 'Optional Post-Visualization Sizing Tool · Native Zoom & Pinpoint 0°/90° Calipers'
                  : 'Optional Same-Wall Caliper Scale Calibration'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-semibold text-[#1F1C18] tracking-tight">
              {isPostVisualizationModal
                ? `Calibrate "${artworkTitle || 'Your Approved Painting'}" Using Your Head-On Level Photo`
                : 'Calibrate Frame & Picture Size Using Your Head-On Level Photo'}
            </h2>
            <div
              data-testid="same-wall-measurement-instructions"
              className="rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] p-3 text-xs sm:text-sm text-[#4A3B32] leading-relaxed"
            >
              <strong className="text-[#1F1C18]">How to Calibrate Your Size:</strong>{' '}
              Use the <strong>Native Zoom (1×–4×)</strong> to zoom in closely and place
              the <strong>pinpoint caliper tips</strong> on a reference feature on the{' '}
              <strong className="text-[#9E5A3C]">
                same wall as the art piece (at the same distance from the camera)
              </strong>
              , then enter its measurement in inches. Calipers automatically{' '}
              <strong>clip onto True Horizontal (0°) and True Vertical (90°)</strong>{' '}
              angles. The <strong>white dashed frame box</strong> around your painting
              is aligned to the outer frame edges (and can also be fine-tuned via its 4
              corner points) so its width and height are directly calibrated from your
              caliper scale. <strong>One measurement is enough</strong>; if you add a{' '}
              <strong>2nd measurement (Caliper B)</strong>, both must agree in scale
              within <strong>5%</strong>.
            </div>
          </div>

          {isLoadingQuestions && (
            <div
              data-testid="scale-questions-loading-indicator"
              className="inline-flex items-center gap-2 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3.5 py-2 text-xs font-medium text-[#9E5A3C] shrink-0"
            >
              <span className="h-2 w-2 rounded-full bg-[#9E5A3C] animate-pulse" />
              <span>Positioning fine calipers on your head-on photo...</span>
            </div>
          )}
        </div>

        {/* =====================================================================
            5% SCALE DISCREPANCY ERROR BANNER (WHEN 2 MEASUREMENTS DIFFER > 5%)
           ===================================================================== */}
        {isErrorBlocked && (
          <div
            data-testid="scale-inaccuracy-error-banner"
            role="alert"
            className="mb-5 rounded-xl border-2 border-[#B91C1C] bg-[#FEF2F2] p-4 text-[#7F1D1D] shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#B91C1C]">
                ⚠ Measurement Inaccuracy Error · Scale Discrepancy{' '}
                {effectiveRecommendation.scaleDiscrepancyPercent}% (&gt; 5% Limit)
              </span>
              <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#991B1B]">
                Max Allowed Variance: 5.0%
              </span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#7F1D1D]">
              {effectiveRecommendation.scaleErrorExplanation}
            </p>
          </div>
        )}

        {/* =====================================================================
            INTERACTIVE PINPOINT CALIPER IMAGE STAGE + NATIVE ZOOM + ORTHO-SNAP
           ===================================================================== */}
        {roomImageDataUrl && (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left 7 Cols: Native Zoomable Image Stage with Pinpoint Calipers & Aligned White Frame Box */}
            <div className="lg:col-span-7 space-y-2.5">
              {/* Native Zoom & Angle Clipping Control Bar */}
              <div
                data-testid="caliper-zoom-toolbar"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-2 shadow-2xs"
              >
                {/* Native Zoom Controls */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#4A3B32] mr-1">
                    Zoom:
                  </span>
                  <button
                    type="button"
                    data-testid="caliper-zoom-out-btn"
                    onClick={() => handleSetZoom(zoomLevel - 0.5)}
                    disabled={zoomLevel <= 1}
                    aria-label="Zoom Out"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-[#C9BFA8] bg-[#F5F0E6] text-xs font-bold text-[#1F1C18] hover:bg-[#EFECE6] disabled:opacity-40 cursor-pointer"
                  >
                    −
                  </button>
                  {ZOOM_PRESETS.map((preset) => (
                    <button
                      key={`zoom-preset-${preset}`}
                      type="button"
                      data-testid={`caliper-zoom-preset-${preset}`}
                      aria-pressed={zoomLevel === preset}
                      onClick={() => handleSetZoom(preset)}
                      className={`h-7 px-2 inline-flex items-center justify-center rounded-lg border text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                        zoomLevel === preset
                          ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE]'
                          : 'border-[#DFD7C8] bg-[#F5F0E6] text-[#1F1C18] hover:bg-[#EFECE6]'
                      }`}
                    >
                      {preset}×
                    </button>
                  ))}
                  <button
                    type="button"
                    data-testid="caliper-zoom-in-btn"
                    onClick={() => handleSetZoom(zoomLevel + 0.5)}
                    disabled={zoomLevel >= 4}
                    aria-label="Zoom In"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-[#C9BFA8] bg-[#F5F0E6] text-xs font-bold text-[#1F1C18] hover:bg-[#EFECE6] disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                  {zoomLevel > 1 && (
                    <button
                      type="button"
                      data-testid="caliper-zoom-reset-btn"
                      onClick={() => handleSetZoom(1)}
                      className="h-7 px-2 inline-flex items-center justify-center rounded-lg border border-[#C9BFA8] bg-[#FAF6EE] text-[11px] font-medium text-[#57534E] hover:text-[#1F1C18] cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <span
                    data-testid="caliper-zoom-level-badge"
                    className="rounded bg-[#1F1C18]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#1F1C18]"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </span>
                </div>

                {/* Ortho-Snap (0° Horizontal / 90° Vertical) Toggle, Tight Frame Detection Layer Toggle & Auto-Align Frame Box */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="toggle-frame-detection-layer-btn"
                    aria-pressed={showFrameDetectionLayer}
                    onClick={() => setShowFrameDetectionLayer((prev) => !prev)}
                    className={`h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                      showFrameDetectionLayer
                        ? 'border-[#065F46] bg-[#ECFDF5] text-[#065F46]'
                        : 'border-[#C9BFA8] bg-[#F5F0E6] text-[#57534E]'
                    }`}
                  >
                    <span>
                      {showFrameDetectionLayer
                        ? '✓ Tight Frame Layer: ON'
                        : 'Tight Frame Layer: OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="caliper-ortho-snap-toggle"
                    aria-pressed={isOrthoSnapEnabled}
                    onClick={() => setIsOrthoSnapEnabled((prev) => !prev)}
                    className={`h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                      isOrthoSnapEnabled
                        ? 'border-[#065F46] bg-[#ECFDF5] text-[#065F46]'
                        : 'border-[#C9BFA8] bg-[#F5F0E6] text-[#57534E]'
                    }`}
                  >
                    <span>
                      {isOrthoSnapEnabled
                        ? '✓ Clip 0° Horiz / 90° Vert: ON'
                        : 'Clip 0° / 90°: OFF'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="auto-snap-frame-box-btn"
                    onClick={handleAutoSnapFrameBox}
                    disabled={isAutoAligningFrameBox}
                    className="h-7 px-2.5 inline-flex items-center gap-1 rounded-lg border border-[#4A3B32]/40 bg-[#F5F0E6] text-[11px] font-mono font-semibold text-[#1F1C18] hover:bg-[#EFECE6] cursor-pointer"
                  >
                    <span>
                      {isAutoAligningFrameBox
                        ? 'Aligning Frame Box...'
                        : '⊞ Auto-Align Frame Box'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Native Scroll/Pan Viewport Wrapping the Uncropped Natural-Aspect-Ratio Canvas */}
              <div
                ref={scrollViewportRef}
                data-testid="caliper-zoom-scroll-viewport"
                onWheel={handleWheelZoom}
                className="relative w-full max-h-[68vh] overflow-auto rounded-2xl border-2 border-[#4A3B32] bg-[#141210] shadow-md"
              >
                <div
                  ref={imageStageRef}
                  data-testid="caliper-image-canvas"
                  onPointerMove={handlePointerMoveStage}
                  onPointerUp={handlePointerUpStage}
                  onPointerLeave={handlePointerUpStage}
                  onDoubleClick={() => handleSetZoom(zoomLevel > 1 ? 1 : 2)}
                  style={{
                    width: `${zoomLevel * 100}%`,
                    minWidth: '100%',
                  }}
                  className="relative block select-none touch-none"
                >
                  {/* Full Uncropped Natural Aspect Ratio Image so 0..1000 Coordinates Align 100% Pixel-for-Pixel */}
                  <img
                    src={roomImageDataUrl}
                    alt="Head-On Space with Pinpoint Measurement Calipers"
                    data-testid="scale-room-reference-thumb"
                    draggable={false}
                    onLoad={(e) => {
                      const natW = e.currentTarget.naturalWidth;
                      const natH = e.currentTarget.naturalHeight;
                      if (natW > 0 && natH > 0) {
                        setImageNaturalDims({ width: natW, height: natH });
                      }
                    }}
                    className="block w-full h-auto select-none"
                  />

                  {/* Separate Transparent Frame Detection Layer (Tightly Locked to Outer Frame Edge with 0px Wall Space) */}
                  {showFrameDetectionLayer && (
                    <img
                      src={activeFrameLayerDataUrl}
                      alt="Tight Frame Detection Layer"
                      data-testid="frame-detection-layer-overlay"
                      draggable={false}
                      className="pointer-events-none absolute inset-0 h-full w-full z-10 select-none"
                    />
                  )}

                  {/* Aligned Outer Frame Boundary Box (`cropBox`) with 4 Pinpoint Corner Handles */}
                  <div
                    data-testid="caliper-artwork-box"
                    style={{
                      left: `${artLeftPct}%`,
                      top: `${artTopPct}%`,
                      width: `${artWidthPct}%`,
                      height: `${artHeightPct}%`,
                    }}
                    className="pointer-events-none absolute z-10 border border-[#34D399]/95 bg-transparent"
                  >
                    <div className="absolute -top-5 left-0 whitespace-nowrap rounded bg-[#1F1C18]/85 backdrop-blur-[2px] px-1.5 py-0.5 text-[10px] font-mono text-[#FAF6EE]">
                      {isErrorBlocked
                        ? 'Scale error (>5%)'
                        : `Outer Frame Box: ${effectiveRecommendation.calculatedOuterFrameWidthInches}"×${effectiveRecommendation.calculatedOuterFrameHeightInches}" · Art: ${effectiveRecommendation.calculatedInnerPictureWidthInches}"×${effectiveRecommendation.calculatedInnerPictureHeightInches}"`}
                    </div>

                    {/* 4 Pinpoint Corner Handles so the User Can Fine-Tune the White Frame Box Alignment */}
                    {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                      const posClass =
                        corner === 'nw'
                          ? 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'
                          : corner === 'ne'
                            ? 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'
                            : corner === 'sw'
                              ? 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'
                              : 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize';
                      return (
                        <button
                          key={`frame-corner-${corner}`}
                          type="button"
                          data-testid={`frame-box-handle-${corner}`}
                          aria-label={`Adjust Frame Box ${corner.toUpperCase()} Corner`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setDraggingHandle({
                              kind: 'frame-corner',
                              corner,
                              startBox: effectiveCropBox,
                            });
                          }}
                          className={`pointer-events-auto absolute z-30 h-4 w-4 bg-transparent flex items-center justify-center ${posClass}`}
                        >
                          <span className="h-[5px] w-[5px] bg-[#FAF6EE] ring-1 ring-[#1F1C18] rounded-[1px]" />
                        </button>
                      );
                    })}
                  </div>

                  {/* Ultra-Fine 1px Non-Scaling SVG Caliper Hairlines, Pinpoint Tips & 0°/90° Clip Guides */}
                  <svg
                    data-testid="caliper-svg-overlay"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    className="pointer-events-none absolute inset-0 h-full w-full z-20"
                  >
                    {visibleQuestions.map((q, idx) => {
                      const cal =
                        q.caliper ?? DEFAULT_CALIPERS[idx] ?? DEFAULT_CALIPERS[0];
                      const isSelected = activeCaliperIndex === idx;
                      const dx = cal.x2 - cal.x1;
                      const dy = cal.y2 - cal.y1;
                      const len = Math.max(1, Math.hypot(dx, dy));
                      // Very small pinpoint perpendicular end ticks (3.5 normalized units)
                      const jawHalfLen = isSelected ? 4.0 : 3.2;
                      const nx = (-dy / len) * jawHalfLen;
                      const ny = (dx / len) * jawHalfLen;
                      const angleInfo = computeCaliperAngleInfo(cal);

                      return (
                        <g
                          key={`svg-caliper-${q.id}`}
                          data-testid={`image-caliper-${idx}`}
                          opacity={isSelected ? 0.98 : 0.85}
                        >
                          {/* Full-Span True Horizontal (0°) or True Vertical (90°) Alignment Laser Guide */}
                          {angleInfo.isTrueHorizontal && (
                            <line
                              data-testid={`caliper-ortho-guide-line-${idx}`}
                              x1={0}
                              y1={cal.y1}
                              x2={1000}
                              y2={cal.y1}
                              stroke="#34D399"
                              strokeWidth={0.85}
                              strokeDasharray="4 4"
                              vectorEffect="non-scaling-stroke"
                              opacity={isSelected ? 0.75 : 0.4}
                            />
                          )}
                          {angleInfo.isTrueVertical && (
                            <line
                              data-testid={`caliper-ortho-guide-line-${idx}`}
                              x1={cal.x1}
                              y1={0}
                              x2={cal.x1}
                              y2={1000}
                              stroke="#34D399"
                              strokeWidth={0.85}
                              strokeDasharray="4 4"
                              vectorEffect="non-scaling-stroke"
                              opacity={isSelected ? 0.75 : 0.4}
                            />
                          )}

                          {/* Subtle 2px dark contrast shadow with non-scaling stroke */}
                          <line
                            x1={cal.x1}
                            y1={cal.y1}
                            x2={cal.x2}
                            y2={cal.y2}
                            stroke="rgba(20,18,16,0.65)"
                            strokeWidth={2.0}
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                          />
                          {/* Razor-sharp 1px caliper hairline */}
                          <line
                            x1={cal.x1}
                            y1={cal.y1}
                            x2={cal.x2}
                            y2={cal.y2}
                            stroke={cal.colorHex}
                            strokeWidth={isSelected ? 1.25 : 1.0}
                            vectorEffect="non-scaling-stroke"
                            strokeDasharray={
                              q.userAnswerInches ? undefined : '6 4'
                            }
                            strokeLinecap="round"
                          />
                          {/* Miniature Pinpoint Start Tick */}
                          <line
                            x1={cal.x1 - nx}
                            y1={cal.y1 - ny}
                            x2={cal.x1 + nx}
                            y2={cal.y1 + ny}
                            stroke="#FAF6EE"
                            strokeWidth={1.15}
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                          />
                          {/* Miniature Pinpoint End Tick */}
                          <line
                            x1={cal.x2 - nx}
                            y1={cal.y2 - ny}
                            x2={cal.x2 + nx}
                            y2={cal.y2 + ny}
                            stroke="#FAF6EE"
                            strokeWidth={1.15}
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Very Small Pinpoint Caliper Endpoint Handles (5×5px visible point inside invisible 20×20px hit target) */}
                  {visibleQuestions.map((q, idx) => {
                    const cal =
                      q.caliper ?? DEFAULT_CALIPERS[idx] ?? DEFAULT_CALIPERS[0];
                    const isSelected = activeCaliperIndex === idx;
                    const midX = (cal.x1 + cal.x2) / 20;
                    const midY = (cal.y1 + cal.y2) / 20;
                    const hasVal =
                      typeof q.userAnswerInches === 'number' &&
                      Number.isFinite(q.userAnswerInches) &&
                      q.userAnswerInches > 0;
                    const angleInfo = computeCaliperAngleInfo(cal);

                    return (
                      <React.Fragment key={`caliper-controls-${q.id}`}>
                        {/* Start Endpoint Pinpoint Vertex */}
                        <button
                          type="button"
                          data-testid={`caliper-handle-start-${idx}`}
                          aria-label={`Drag Caliper ${cal.badgeCode} Start Pinpoint`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setActiveCaliperIndex(idx);
                            setDraggingHandle({
                              kind: 'caliper',
                              questionId: q.id,
                              endpoint: 'start',
                              caliper: cal,
                            });
                            setLoupeCoords({
                              normX: cal.x1,
                              normY: cal.y1,
                              label: `Caliper ${cal.badgeCode} Start`,
                            });
                          }}
                          style={{
                            left: `${cal.x1 / 10}%`,
                            top: `${cal.y1 / 10}%`,
                          }}
                          className="absolute z-30 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-transparent cursor-crosshair flex items-center justify-center"
                        >
                          <span
                            style={{ backgroundColor: cal.colorHex }}
                            className="h-[5px] w-[5px] rounded-full ring-1 ring-[#FAF6EE] shadow-[0_0_2px_rgba(0,0,0,0.95)]"
                          />
                        </button>

                        {/* End Endpoint Pinpoint Vertex */}
                        <button
                          type="button"
                          data-testid={`caliper-handle-end-${idx}`}
                          aria-label={`Drag Caliper ${cal.badgeCode} End Pinpoint`}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setActiveCaliperIndex(idx);
                            setDraggingHandle({
                              kind: 'caliper',
                              questionId: q.id,
                              endpoint: 'end',
                              caliper: cal,
                            });
                            setLoupeCoords({
                              normX: cal.x2,
                              normY: cal.y2,
                              label: `Caliper ${cal.badgeCode} End`,
                            });
                          }}
                          style={{
                            left: `${cal.x2 / 10}%`,
                            top: `${cal.y2 / 10}%`,
                          }}
                          className="absolute z-30 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-transparent cursor-crosshair flex items-center justify-center"
                        >
                          <span
                            style={{ backgroundColor: cal.colorHex }}
                            className="h-[5px] w-[5px] rounded-full ring-1 ring-[#FAF6EE] shadow-[0_0_2px_rgba(0,0,0,0.95)]"
                          />
                        </button>

                        {/* Compact Micro-Badge Offset from the Caliper Line */}
                        <button
                          type="button"
                          data-testid={`caliper-midpoint-badge-${idx}`}
                          onClick={() => setActiveCaliperIndex(idx)}
                          style={{
                            left: `${midX}%`,
                            top: `${midY}%`,
                            borderColor: cal.colorHex,
                          }}
                          className={`absolute z-30 -translate-x-1/2 -translate-y-[135%] rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-semibold transition-transform ${
                            isSelected
                              ? 'bg-[#1F1C18]/90 text-[#FAF6EE]'
                              : 'bg-[#FAF6EE]/90 text-[#1F1C18]'
                          }`}
                        >
                          <span>
                            {cal.badgeCode}
                            {hasVal ? `: ${q.userAnswerInches}"` : ''} ·{' '}
                            {angleInfo.isTrueHorizontal
                              ? '0°H'
                              : angleInfo.isTrueVertical
                                ? '90°V'
                                : `${angleInfo.angleDeg}°`}
                          </span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Floating 4× Precision Crosshair Loupe While Dragging Any Pinpoint */}
                {loupeCoords && (
                  <div
                    data-testid="caliper-precision-loupe"
                    className="pointer-events-none absolute top-3 right-3 z-40 h-28 w-28 overflow-hidden rounded-xl border-2 border-[#FAF6EE] bg-[#141210] shadow-xl"
                  >
                    <div
                      style={{
                        backgroundImage: `url(${roomImageDataUrl})`,
                        backgroundSize: '400% 400%',
                        backgroundPosition: `${loupeCoords.normX / 10}% ${loupeCoords.normY / 10}%`,
                      }}
                      className="h-full w-full relative"
                    >
                      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#34D399]/80" />
                      <div className="absolute inset-y-0 left-1/2 w-[1px] bg-[#34D399]/80" />
                      <div className="absolute bottom-0 inset-x-0 bg-[#1F1C18]/85 px-1 py-0.5 text-center font-mono text-[8px] text-[#FAF6EE] truncate">
                        {loupeCoords.label}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div
                data-testid="frame-vs-ruler-comparison-readout"
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D1FAE5] bg-[#ECFDF5]/80 px-3 py-2 text-[11px] font-mono text-[#065F46]"
              >
                <span>
                  ✓ Tight Frame Layer (0px Wall Space): {frameSpanUnitsX}w × {frameSpanUnitsY}h units ([{effectiveCropBox.xmin}, {effectiveCropBox.ymin}] → [{effectiveCropBox.xmax}, {effectiveCropBox.ymax}])
                </span>
                <span>
                  vs. Calibrated Ruler A ({primaryRulerSpanUnits} units
                  {primaryCaliperQuestion?.userAnswerInches
                    ? ` = ${primaryCaliperQuestion.userAnswerInches}"`
                    : ''}
                  ): Frame Width = {frameToRulerRatioPct}% of Ruler Span
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#57534E]">
                <span>
                  Tip: Zoom in (1.5×–4×) or double-click the photo, then drag the{' '}
                  <strong>5px pinpoint tips</strong>. Calipers automatically clip onto{' '}
                  <strong>0° Horizontal</strong> or <strong>90° Vertical</strong>.
                </span>
                <span className="font-mono text-[#4A3B32]">
                  Frame Box: [{effectiveCropBox.xmin}, {effectiveCropBox.ymin}] → [
                  {effectiveCropBox.xmax}, {effectiveCropBox.ymax}]
                </span>
              </div>
            </div>

            {/* Right 5 Cols: Live Recalibrated Frame, Photo & Art Piece Details Card */}
            <div
              data-testid="caliper-recalibrated-dimensions-card"
              className="lg:col-span-5 rounded-2xl border-2 border-[#9E5A3C] bg-[#FAF6EE] p-4 sm:p-5 shadow-xs space-y-4"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#9E5A3C]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#9E5A3C]">
                    ★ Same-Wall Scale Calibration
                  </span>
                  {effectiveRecommendation.questionsAnsweredCount >= 2 &&
                    !isErrorBlocked && (
                      <span
                        data-testid="scale-within-tolerance-badge"
                        className="rounded-full bg-[#ECFDF5] border border-[#D1FAE5] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#065F46]"
                      >
                        ✓ Scale Verified ({effectiveRecommendation.scaleDiscrepancyPercent}% ≤ 5%)
                      </span>
                    )}
                </div>
                <h3 className="mt-1.5 font-serif text-lg font-semibold text-[#1F1C18]">
                  Calibrated Frame, Photo &amp; Art Piece Details
                </h3>
                <p className="mt-0.5 text-xs text-[#57534E]">
                  Calculated directly from the aligned{' '}
                  <span className="font-semibold text-[#1F1C18]">
                    white outer frame box
                  </span>{' '}
                  around your painting, your head-on same-wall caliper measurement
                  {effectiveRecommendation.questionsAnsweredCount === 1 ? '' : 's'}, and{' '}
                  <span className="font-semibold text-[#1F1C18]">
                    {frameSpec.name}
                  </span>{' '}
                  ({frameSpec.mouldingWidthInches}&quot; moulding
                  {matInches > 0 ? ` + ${matInches}" matboard` : ', full-bleed no mat'}).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-3">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-[#57534E]">
                    Generated Outer Frame Size
                  </span>
                  <span
                    data-testid="calculated-outer-frame-dims"
                    className="mt-1 block font-serif text-lg sm:text-xl font-bold text-[#1F1C18]"
                  >
                    {isErrorBlocked
                      ? 'Resolve >5% Error'
                      : `${effectiveRecommendation.calculatedOuterFrameWidthInches}" × ${effectiveRecommendation.calculatedOuterFrameHeightInches}"`}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#57534E]">
                    Includes {frameSpec.mouldingWidthInches}&quot; frame
                    {matInches > 0 ? ` & ${matInches}" mat` : ''}
                  </span>
                </div>

                <div className="rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] p-3">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-[#57534E]">
                    Generated Inner Photo Size
                  </span>
                  <span
                    data-testid="calculated-inner-picture-dims"
                    className="mt-1 block font-serif text-lg sm:text-xl font-bold text-[#9E5A3C]"
                  >
                    {isErrorBlocked
                      ? 'Resolve >5% Error'
                      : `${effectiveRecommendation.calculatedInnerPictureWidthInches}" × ${effectiveRecommendation.calculatedInnerPictureHeightInches}"`}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#57534E]">
                    Unframed canvas / print area
                  </span>
                </div>
              </div>

              {/* Recommended Art Piece Details & Suggested Edition Box */}
              <div
                data-testid="scale-page-recommendation-preview"
                className={`rounded-xl border p-3.5 ${
                  isErrorBlocked
                    ? 'border-[#B91C1C]/50 bg-[#FEF2F2]'
                    : 'border-[#9E5A3C]/50 bg-[#F5F0E6]/90'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9E5A3C]">
                    Recommended Art Piece Details
                  </span>
                  {effectiveRecommendation.isCalibrated && (
                    <span className="rounded-full bg-[#ECFDF5] border border-[#D1FAE5] px-2 py-0.5 text-[10px] font-semibold text-[#065F46]">
                      Calibrated ({effectiveRecommendation.questionsAnsweredCount}{' '}
                      {effectiveRecommendation.questionsAnsweredCount === 1
                        ? 'Caliper'
                        : 'Calipers'}
                      )
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    data-testid="scale-recommended-dimensions-label"
                    className="font-serif text-2xl sm:text-3xl font-bold text-[#1F1C18]"
                  >
                    <span data-testid="scale-live-recommended-size">
                      {effectiveRecommendation.recommendedDimensionsLabel}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-[#4A3B32]">
                    Outer Framed:{' '}
                    {effectiveRecommendation.suggestedEditionOuterWidthInches}&quot; ×{' '}
                    {effectiveRecommendation.suggestedEditionOuterHeightInches}&quot;
                  </span>
                </div>

                <div
                  data-testid="recommended-art-piece-details"
                  className="mt-2 rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] p-2.5 text-xs text-[#1F1C18] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#57534E]">Recommended Print Canvas:</span>
                    <span className="font-semibold text-right">
                      {recommendedSizeSpec.labelInches} ({recommendedSizeSpec.labelCm})
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#57534E]">Matched Frame &amp; Mat:</span>
                    <span className="font-semibold text-right">
                      {frameSpec.name}
                      {matInches > 0 ? ` + ${matInches}" Mat` : ' · Full-Bleed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#57534E]">Total Outer Wall Footprint:</span>
                    <span className="font-semibold text-[#9E5A3C] text-right">
                      {effectiveRecommendation.suggestedEditionOuterWidthInches}&quot; ×{' '}
                      {effectiveRecommendation.suggestedEditionOuterHeightInches}&quot;
                    </span>
                  </div>
                </div>

                {/* Archival Standard vs. Custom-Milled Specification Card (Requirement #6) */}
                <div
                  data-testid="caliper-finerworks-custom-spec-card"
                  className="mt-2.5 rounded-lg border border-[#DFD7C8] bg-[#FAF6EE] p-3 text-xs text-[#1F1C18] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#DFD7C8] pb-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#9E5A3C]">
                      Archival Standard vs. Custom-Milled Spec
                    </span>
                    <span className="font-mono text-[10px] text-[#57534E] text-right">
                      300 PPI Archival Master
                    </span>
                  </div>

                  <div
                    data-testid="caliper-finerworks-standard-sku"
                    className="rounded border border-[#DFD7C8]/80 bg-[#F5F0E6]/70 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#4A3B32]">
                        Nearest Standard Archival Edition:
                      </span>
                      <span className="font-semibold text-[#1F1C18] text-right">
                        {recommendedSizeSpec.labelInches} (Outer{' '}
                        {standardFwSpec.physicalDimensions.frameOuterWidthIn}&quot; ×{' '}
                        {standardFwSpec.physicalDimensions.frameOuterHeightIn}&quot;)
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 font-mono text-[10px] text-[#57534E]">
                      <span>Standard Archival SKU:</span>
                      <span className="break-all rounded bg-[#EAE3D5]/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#2E4A3E]">
                        {standardFwSpec.productCode}
                      </span>
                    </div>
                  </div>

                  <div
                    data-testid="caliper-finerworks-custom-sku"
                    className="rounded border border-[#9E5A3C]/40 bg-[#F5F0E6] p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#9E5A3C]">
                        Exact Custom-Milled Archival Edition:
                      </span>
                      <span className="font-semibold text-[#1F1C18] text-right">
                        {customFwSpec.physicalDimensions.printWidthIn}&quot; ×{' '}
                        {customFwSpec.physicalDimensions.printHeightIn}&quot; (Outer{' '}
                        {customFwSpec.physicalDimensions.frameOuterWidthIn}&quot; ×{' '}
                        {customFwSpec.physicalDimensions.frameOuterHeightIn}&quot;)
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 font-mono text-[10px] text-[#57534E]">
                      <span>
                        300 PPI Master: {customFwSpec.physicalDimensions.optimalWidthPx300Ppi}×
                        {customFwSpec.physicalDimensions.optimalHeightPx300Ppi} px
                      </span>
                      <span className="break-all rounded bg-[#EAE3D5]/70 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#2E4A3E]">
                        {customFwSpec.productCode}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid="apply-custom-finerworks-size-btn"
                    disabled={isErrorBlocked}
                    onClick={() => {
                      onApplyCustomFinerWorksDimensions?.(
                        customFwSpec.physicalDimensions.printWidthIn,
                        customFwSpec.physicalDimensions.printHeightIn,
                        customFwSpec
                      );
                      if (onCloseSizingModal) {
                        onCloseSizingModal();
                      } else {
                        onApplyScaleAndCreate();
                      }
                    }}
                    className={`w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      isErrorBlocked
                        ? 'border-[#C9BFA8] bg-[#DFD7C8] text-[#78716C] cursor-not-allowed'
                        : 'border-[#9E5A3C] bg-[#FAF6EE] text-[#9E5A3C] hover:bg-[#9E5A3C] hover:text-[#FAF6EE] cursor-pointer'
                    }`}
                  >
                    <span>
                      {`Apply Custom-Milled Archival Edition (${customFwSpec.physicalDimensions.printWidthIn}" × ${customFwSpec.physicalDimensions.printHeightIn}")`}
                    </span>
                  </button>
                </div>

                <p className="mt-2 text-xs text-[#57534E] leading-relaxed">
                  {effectiveRecommendation.rationale}
                </p>

                <button
                  type="button"
                  data-testid="scale-create-art-submit-btn"
                  disabled={isErrorBlocked}
                  onClick={onApplyScaleAndCreate}
                  className={`mt-3 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-xs ${
                    isErrorBlocked
                      ? 'bg-[#C9BFA8] text-[#78716C] cursor-not-allowed'
                      : 'bg-[#9E5A3C] text-[#FAF6EE] hover:bg-[#874B30] cursor-pointer'
                  }`}
                >
                  <span>
                    {isErrorBlocked
                      ? 'Fix >5% Scale Discrepancy Between Calipers to Apply'
                      : isPostVisualizationModal
                        ? `Apply Recommended Art Piece Size (${effectiveRecommendation.recommendedDimensionsLabel}) →`
                        : `Use Recommended Size (${effectiveRecommendation.recommendedDimensionsLabel}) & Create →`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progressive Caliper Measurement Cards: Start with 1 Caliper -> Option to Add 2nd Caliper */}
        <div
          data-testid="scale-questions-list"
          className="grid grid-cols-1 gap-4 mb-6"
        >
          {visibleQuestions.map((question, index) => {
            const currentVal = question.userAnswerInches;
            const hasAnswer =
              typeof currentVal === 'number' &&
              Number.isFinite(currentVal) &&
              currentVal > 0;
            const cal =
              question.caliper ?? DEFAULT_CALIPERS[index] ?? DEFAULT_CALIPERS[0];
            const angleInfo = computeCaliperAngleInfo(cal);

            return (
              <div
                key={question.id || `scale-q-${index}`}
                data-testid={`scale-question-card-${index}`}
                onClick={() => setActiveCaliperIndex(index)}
                className={`rounded-xl border p-4 sm:p-5 transition-all ${
                  hasAnswer
                    ? 'border-[#9E5A3C] bg-[#FAF6EE] shadow-xs'
                    : activeCaliperIndex === index
                      ? 'border-[#4A3B32] bg-[#FAF6EE]'
                      : 'border-[#DFD7C8] bg-[#FAF6EE]/90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        style={{ backgroundColor: cal.colorHex }}
                        className="inline-flex h-6 px-2.5 items-center justify-center rounded-full text-xs font-mono font-bold text-[#FAF6EE]"
                      >
                        Caliper {cal.badgeCode} ·{' '}
                        {cal.axis === 'vertical'
                          ? 'Vertical Same-Wall'
                          : 'Horizontal Same-Wall'}
                      </span>

                      {/* Angle Status Badge & 1-Click True Horizontal (0°) / True Vertical (90°) Clip Buttons */}
                      <span
                        data-testid={`caliper-angle-status-${index}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                          angleInfo.isTrueHorizontal || angleInfo.isTrueVertical
                            ? 'bg-[#ECFDF5] border border-[#D1FAE5] text-[#065F46]'
                            : 'bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]'
                        }`}
                      >
                        {angleInfo.isTrueHorizontal || angleInfo.isTrueVertical
                          ? `✓ ${angleInfo.statusLabel}`
                          : angleInfo.statusLabel}
                      </span>

                      <button
                        type="button"
                        data-testid={`snap-caliper-horizontal-btn-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSnapCaliperToAxis(index, 'horizontal');
                        }}
                        className={`h-6 px-2 rounded-md border font-mono text-[10px] font-semibold cursor-pointer ${
                          angleInfo.isTrueHorizontal
                            ? 'border-[#065F46] bg-[#065F46] text-[#FAF6EE]'
                            : 'border-[#C9BFA8] bg-[#F5F0E6] text-[#4A3B32] hover:bg-[#EFECE6]'
                        }`}
                      >
                        ― Clip Horizontal (0°)
                      </button>

                      <button
                        type="button"
                        data-testid={`snap-caliper-vertical-btn-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSnapCaliperToAxis(index, 'vertical');
                        }}
                        className={`h-6 px-2 rounded-md border font-mono text-[10px] font-semibold cursor-pointer ${
                          angleInfo.isTrueVertical
                            ? 'border-[#065F46] bg-[#065F46] text-[#FAF6EE]'
                            : 'border-[#C9BFA8] bg-[#F5F0E6] text-[#4A3B32] hover:bg-[#EFECE6]'
                        }`}
                      >
                        ∣ Clip Vertical (90°)
                      </button>
                    </div>

                    <label
                      htmlFor={`scale-question-input-${index}`}
                      className="block text-sm sm:text-base font-semibold text-[#1F1C18] mt-1"
                    >
                      {question.questionText}
                    </label>
                    <p className="text-xs text-[#57534E] mt-0.5">
                      {question.helperText}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start shrink-0">
                    {hasAnswer && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] border border-[#D1FAE5] px-2.5 py-0.5 text-xs font-semibold text-[#065F46]">
                        <span>
                          ✓ Caliper {cal.badgeCode}: {currentVal}&quot; (Left in Place)
                        </span>
                      </span>
                    )}
                    {index === 1 && visibleCaliperCount >= 2 && (
                      <button
                        type="button"
                        data-testid="remove-second-caliper-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSecondCaliper();
                        }}
                        className="min-h-[44px] px-3 py-1 rounded-lg border border-[#C9BFA8] bg-[#F5F0E6] text-xs font-medium text-[#57534E] hover:bg-[#EFECE6] hover:text-[#1F1C18]"
                      >
                        Remove 2nd Measurement
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick-Select Measurement Pills + Numeric Inches Input */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:pl-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {question.suggestedQuickValuesInches.map((item) => {
                      const isSelectedQuickVal =
                        currentVal === item.valueInches;
                      return (
                        <button
                          key={`${question.id}-${item.valueInches}`}
                          type="button"
                          data-testid={`scale-quick-val-${index}-${item.valueInches}`}
                          aria-pressed={isSelectedQuickVal}
                          onClick={() =>
                            handleSetAnswer(question.id, item.valueInches)
                          }
                          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                            isSelectedQuickVal
                              ? 'border-[#9E5A3C] bg-[#9E5A3C] text-[#FAF6EE] shadow-xs'
                              : 'border-[#DFD7C8] bg-[#F5F0E6] text-[#1F1C18] hover:bg-[#EFECE6]'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id={`scale-question-input-${index}`}
                      type="number"
                      min={12}
                      max={600}
                      step={1}
                      data-testid={`scale-question-input-${index}`}
                      placeholder={question.placeholder || 'Inches'}
                      value={
                        typeof currentVal === 'number' &&
                        Number.isFinite(currentVal)
                          ? String(currentVal)
                          : ''
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          handleSetAnswer(question.id, null);
                          return;
                        }
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed) && parsed > 0) {
                          handleSetAnswer(question.id, parsed);
                        } else {
                          handleSetAnswer(question.id, null);
                        }
                      }}
                      className="min-h-[44px] w-28 sm:w-32 rounded-lg border border-[#DFD7C8] bg-white px-3 py-2 text-base font-medium text-[#1F1C18] focus:border-[#9E5A3C] focus:outline-none"
                    />
                    <span className="text-xs font-medium text-[#57534E]">
                      {question.unitLabel || 'inches'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Option to Add a 2nd Measurement After Starting with 1 Caliper */}
          {visibleCaliperCount === 1 && effectiveQuestions.length > 1 && (
            <div
              data-testid="add-second-caliper-card"
              className="rounded-xl border border-dashed border-[#9E5A3C]/60 bg-[#FAF6EE]/90 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="space-y-0.5">
                <span className="inline-block font-mono text-[11px] font-bold uppercase tracking-wider text-[#2E5A44]">
                  Optional 2nd Same-Wall Measurement (Horizontal + Vertical Ideal)
                </span>
                <p className="text-xs text-[#57534E]">
                  One measurement is enough to calibrate. Leave <strong>Caliper A</strong> in place and add a second measurement (<strong>Caliper B · Vertical Same-Wall</strong>) to verify scale consistency within 5%.
                </p>
              </div>
              <button
                type="button"
                data-testid="add-second-caliper-btn"
                onClick={handleAddSecondCaliper}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#2E5A44] bg-[#2E5A44] text-[#FAF6EE] text-xs sm:text-sm font-semibold hover:bg-[#234735] transition-colors shrink-0 cursor-pointer shadow-2xs"
              >
                + Add Another Measurement (Caliper B)
              </button>
            </div>
          )}
        </div>

        {/* Fallback Recommendation Card when no roomImageDataUrl is provided */}
        {!roomImageDataUrl && (
          <div
            data-testid="scale-page-recommendation-preview"
            className="mb-6 rounded-xl border-2 border-[#9E5A3C] bg-[#FAF6EE] p-4 sm:p-5 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#9E5A3C] mb-1">
                  <span>★ Suggested Print Scale for Your Space</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span
                    data-testid="scale-recommended-dimensions-label"
                    className="text-2xl sm:text-3xl font-serif font-bold text-[#1F1C18]"
                  >
                    <span data-testid="scale-live-recommended-size">
                      {effectiveRecommendation.recommendedDimensionsLabel}
                    </span>
                  </span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                  {effectiveRecommendation.rationale}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Bar: Apply Suggested Size OR Skip */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#DFD7C8]">
          <button
            type="button"
            data-testid="skip-scale-page-bottom-btn"
            onClick={
              isPostVisualizationModal && onCloseSizingModal
                ? onCloseSizingModal
                : onSkipScaleAndCreate
            }
            className="min-h-[48px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-5 py-3 text-sm font-semibold text-[#57534E] hover:bg-[#EFECE6] hover:text-[#1F1C18] transition-colors"
          >
            {isPostVisualizationModal
              ? 'Cancel & Return to Painting'
              : 'Skip Measurements & Create Now →'}
          </button>

          <div className="flex items-center gap-2">
            {/* Accessible alias for test compatibility when no roomImageDataUrl */}
            {!roomImageDataUrl && (
              <button
                type="button"
                data-testid="scale-create-art-submit-btn"
                disabled={isErrorBlocked}
                onClick={onApplyScaleAndCreate}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                Apply Caliper Measurements
              </button>
            )}
            <button
              type="button"
              data-testid="apply-scale-and-create-btn"
              disabled={isErrorBlocked}
              onClick={onApplyScaleAndCreate}
              className={`w-full sm:w-auto min-h-[48px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm sm:text-base font-semibold shadow-md ${
                isErrorBlocked
                  ? 'bg-[#C9BFA8] text-[#78716C] cursor-not-allowed'
                  : 'bg-[#9E5A3C] text-[#FAF6EE] hover:bg-[#874B30] cursor-pointer'
              }`}
            >
              <span>
                {isErrorBlocked
                  ? 'Fix >5% Scale Discrepancy to Apply Size'
                  : isPostVisualizationModal
                    ? `Apply Recommended Art Piece Size (${effectiveRecommendation.recommendedDimensionsLabel}) →`
                    : 'Save Caliper Measurements & Create Art Piece(s) →'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScaleCalibrationPage;
