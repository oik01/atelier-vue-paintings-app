// src/App.tsx
// V2.4 Root Studio Application Shell — ATELIER VUE (Option 5 Wabi-Sabi Tactile Canvas Studio)
// Implements [SPEC PATCH #17] – [SPEC PATCH #28]:
// - Option 5 Monumental Masthead (`atelier-grand-masthead`) & Slogan ("Unique Art Pieces Made for You & Your Space")
// - Prominent 4-Card Illuminated Tactile Step Frieze (`workflow-step-nav`)
// - Zero AI Model Announcements anywhere in the UI
// - Non-Photo "Proceed by Describing What You Are Looking For" Direct Curation Path
// - Dedicated Add-Angle Upload & Camera Screen (`add-angle-upload-screen`)
// - 16 Curated Fine-Art Style Presets + Placement & Atmosphere Chips
// - Skippable Page 3 AI Scale & Measurement Calibration (`workflow-page-3-scale`) & Order-Stage Recommended Size

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AiGenerationStage,
  AiPromptConfiguration,
  AtelierWorkflowPageId,
  FRAME_PROFILES,
  FrameProfileId,
  GeneratedArtPiece,
  ImageCaliperSegment,
  MatColorId,
  MatWidthId,
  NormalizedCropBox,
  PrintPartnerId,
  PrintSizeId,
  PrintSubstrateId,
  ReimaginedRoomVariation,
  RoomAngleAsset,
  ScaleCalibrationQuestion,
  ScaleCalibrationResult,
} from './contracts/masterContract';
import {
  computeRecommendedScaleFromMeasurements,
  DEFAULT_SCALE_CALIBRATION_QUESTIONS,
  generateScaleQuestionsWithAi,
  regenerateIdenticalPrintFromCrop,
  reimagineRoomBatchWithAi,
  reimagineRoomWithAi,
} from './subsystems/openrouter-ai-engine';
import {
  AiPromptConfigurator,
  AtelierCreationProgressScreen,
  composeDefaultUiPrompt,
  createInitialPromptConfiguration,
  ReimaginedVariationsStrip,
  SAMPLE_ROOM_PHOTOS,
  ScaleCalibrationPage,
  UploadHeroStage,
} from './subsystems/upload-and-reimagine-ui';
import {
  HighResPrintMasterFileResult,
  ScreenshotAndPrintStudio,
} from './subsystems/screenshot-and-print-studio';
import {
  AcquirePrintModal,
  AcquirePrintModalMode,
  clearAtelierV2State,
  computePartnerPrintQuote,
  DEFAULT_STUDIO_MARKUP_PERCENT,
  loadAtelierV2State,
  recordPrintMasterDownload,
  recordVariationMetadata,
  saveAtelierV2State,
  triggerPrintFileDownload,
  V2_STORAGE_KEY,
  V2OrderConfirmation,
} from './subsystems/checkout-and-download';

export const V2_SESSION_WORKSPACE_KEY = 'atelier_vue_v24_clean_workspace';

interface PersistedWorkspaceSession {
  uploadedRoomDataUrl: string | null;
  uploadedRoomTitle: string;
  roomAngles?: RoomAngleAsset[];
  promptConfig: AiPromptConfiguration;
  scaleQuestions?: ScaleCalibrationQuestion[];
  hasAppliedScaleMeasurements?: boolean;
  variations: ReimaginedRoomVariation[];
  activeVariationId: string | null;
  selectedMatColorId: MatColorId;
}

function cloneDefaultScaleQuestions(): ScaleCalibrationQuestion[] {
  return DEFAULT_SCALE_CALIBRATION_QUESTIONS.map((q) => ({
    ...q,
    suggestedQuickValuesInches: q.suggestedQuickValuesInches.map((preset) => ({
      ...preset,
    })),
    userAnswerInches: null,
  }));
}

function loadWorkspaceSession(skipStorage: boolean): PersistedWorkspaceSession | null {
  if (skipStorage || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(V2_SESSION_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceSession>;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      uploadedRoomDataUrl:
        typeof parsed.uploadedRoomDataUrl === 'string' ? parsed.uploadedRoomDataUrl : null,
      uploadedRoomTitle:
        typeof parsed.uploadedRoomTitle === 'string' && parsed.uploadedRoomTitle.trim()
          ? parsed.uploadedRoomTitle
          : SAMPLE_ROOM_PHOTOS[0].name,
      roomAngles: Array.isArray(parsed.roomAngles) ? parsed.roomAngles : [],
      promptConfig: parsed.promptConfig
        ? createInitialPromptConfiguration(parsed.promptConfig)
        : createInitialPromptConfiguration(),
      scaleQuestions:
        Array.isArray(parsed.scaleQuestions) && parsed.scaleQuestions.length > 0
          ? parsed.scaleQuestions
          : cloneDefaultScaleQuestions(),
      hasAppliedScaleMeasurements: Boolean(parsed.hasAppliedScaleMeasurements),
      variations: Array.isArray(parsed.variations) ? parsed.variations : [],
      activeVariationId:
        typeof parsed.activeVariationId === 'string' ? parsed.activeVariationId : null,
      selectedMatColorId:
        parsed.selectedMatColorId === 'warm-museum-linen' ||
        parsed.selectedMatColorId === 'charcoal-conservation'
          ? parsed.selectedMatColorId
          : 'archival-ivory',
    };
  } catch {
    return null;
  }
}

function saveWorkspaceSession(
  session: PersistedWorkspaceSession,
  skipStorage: boolean
): void {
  if (skipStorage || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(V2_SESSION_WORKSPACE_KEY, JSON.stringify(session));
  } catch {
    try {
      const compactVariations = session.variations.slice(-3).map((v) => ({
        ...v,
        croppedScreenshotDataUrl: v.identicalPrintMasterDataUrl,
      }));
      window.localStorage.setItem(
        V2_SESSION_WORKSPACE_KEY,
        JSON.stringify({
          ...session,
          variations: compactVariations,
        })
      );
    } catch {
      try {
        const latestVariation = session.variations.slice(-1).map((v) => ({
          ...v,
          croppedScreenshotDataUrl: v.identicalPrintMasterDataUrl,
        }));
        window.localStorage.setItem(
          V2_SESSION_WORKSPACE_KEY,
          JSON.stringify({
            ...session,
            roomAngles: session.roomAngles?.slice(0, 2),
            variations: latestVariation,
          })
        );
      } catch {
        // Ignore storage quota restrictions
      }
    }
  }
}

const WORKFLOW_STEPS: Array<{
  id: AtelierWorkflowPageId;
  numeral: '01' | '02' | '03' | '04';
  testId: string;
  title: string;
  caption: string;
}> = [
  {
    id: 'page-1-space',
    numeral: '01',
    testId: 'nav-step-page-1-space',
    title: 'Share Your Space',
    caption:
      'Include at least one level, head-on photo of the wall (used for sizing), or describe your space.',
  },
  {
    id: 'page-2-curation',
    numeral: '02',
    testId: 'nav-step-page-2-curation',
    title: 'Shape Your Vision',
    caption:
      'Choose from 16 fine-art style presets, wall placement & multi-piece curation.',
  },
  {
    id: 'page-3-scale',
    numeral: '03',
    testId: 'nav-step-page-3-scale',
    title: 'Atelier Creation',
    caption:
      'Bespoke fine-art synthesis tailored to your wall, light & palette.',
  },
  {
    id: 'page-4-gallery',
    numeral: '04',
    testId: 'nav-step-page-4-gallery',
    title: 'Visualize, Size & Acquire',
    caption:
      'Approve your art piece, optionally calibrate size with calipers & order or download.',
  },
];

export interface AppProps {
  skipLocalStorageLoad?: boolean;
  initialVariations?: ReimaginedRoomVariation[];
}

export const App: React.FC<AppProps> = ({
  skipLocalStorageLoad = false,
  initialVariations,
}) => {
  // Hydrate persisted state when localStorage has existing V2.4 data
  const initialHydration = useMemo(() => {
    if (typeof window !== 'undefined') {
      const search = window.location?.search ?? '';
      if (search.includes('fresh=1') || search.includes('reset=1')) {
        try {
          window.localStorage?.removeItem(V2_SESSION_WORKSPACE_KEY);
          window.localStorage?.removeItem('atelier_vue_v23_clean_workspace');
          window.localStorage?.removeItem('atelier_vue_v22_clean_workspace');
          window.localStorage?.removeItem('atelier_vue_v2_session_workspace');
        } catch {
          // Ignore storage errors
        }
        clearAtelierV2State();
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          // Ignore history errors
        }
        return {
          v2Store: null,
          session: null,
        };
      }
    }
    if (skipLocalStorageLoad) {
      return {
        v2Store: null,
        session: null,
      };
    }
    const hasStoredV2 =
      typeof window !== 'undefined' &&
      Boolean(window.localStorage?.getItem(V2_STORAGE_KEY));
    if (!hasStoredV2 && typeof window !== 'undefined' && window.localStorage) {
      clearAtelierV2State();
    }
    const v2Store = hasStoredV2 ? loadAtelierV2State() : null;
    const session = loadWorkspaceSession(skipLocalStorageLoad);
    return { v2Store, session };
  }, [skipLocalStorageLoad]);

  // Step 1: Uploaded or Selected Room Photo & Multi-Angle State
  const [uploadedRoomDataUrl, setUploadedRoomDataUrl] = useState<string | null>(
    () => initialHydration.session?.uploadedRoomDataUrl ?? null
  );
  const [uploadedRoomTitle, setUploadedRoomTitle] = useState<string>(
    () => initialHydration.session?.uploadedRoomTitle ?? SAMPLE_ROOM_PHOTOS[0].name
  );
  const [roomAngles, setRoomAngles] = useState<RoomAngleAsset[]>(
    () => initialHydration.session?.roomAngles ?? []
  );

  // Step 2: Curation Configuration State (defaults to Gemini Argon in live browser sessions)
  const [promptConfig, setPromptConfig] = useState<AiPromptConfiguration>(() => {
    const isJsdom =
      typeof navigator !== 'undefined' &&
      /jsdom|happy-dom/i.test(navigator.userAgent || '');
    const defaultEngineId = isJsdom ? 'astra' : 'gemini-argon';
    const base =
      initialHydration.session?.promptConfig ??
      createInitialPromptConfiguration({ engineId: defaultEngineId });
    if (typeof window !== 'undefined' && window.location?.search) {
      const engineParam = new URLSearchParams(window.location.search).get('engine');
      if (
        engineParam === 'astra' ||
        engineParam === 'gemini-argon' ||
        engineParam === 'astra-sota' ||
        engineParam === 'gemini-argon-pro' ||
        engineParam === 'deepseek-sota'
      ) {
        return {
          ...base,
          engineId: engineParam,
        };
      }
    }
    return base;
  });
  const [generationStage, setGenerationStage] = useState<AiGenerationStage>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 3 (V2.4): Optional AI Room Scale & Measurement Calibration State ([SPEC PATCH #27])
  const [scaleQuestions, setScaleQuestions] = useState<ScaleCalibrationQuestion[]>(
    () => initialHydration.session?.scaleQuestions ?? cloneDefaultScaleQuestions()
  );
  const [isLoadingScaleQuestions, setIsLoadingScaleQuestions] = useState<boolean>(false);
  const [hasAppliedScaleMeasurements, setHasAppliedScaleMeasurements] = useState<boolean>(
    () => initialHydration.session?.hasAppliedScaleMeasurements ?? false
  );

  // Step 3 & 4: Variations, Active Variation, Active Viewpoint, Active Art Piece & Active Workflow Page
  const [variations, setVariations] = useState<ReimaginedRoomVariation[]>(
    () => initialVariations ?? initialHydration.session?.variations ?? []
  );
  const [activeVariationId, setActiveVariationId] = useState<string | null>(() => {
    if (initialVariations && initialVariations.length > 0) {
      return initialVariations[0].id;
    }
    return initialHydration.session?.activeVariationId ?? null;
  });
  const [activePage, setActivePage] = useState<AtelierWorkflowPageId>(() => {
    const restoredCount =
      (initialVariations?.length ?? 0) ||
      (initialHydration.session?.variations?.length ?? 0);
    return restoredCount > 0 ? 'page-4-gallery' : 'page-1-space';
  });
  const [activeViewpointIndex, setActiveViewpointIndex] = useState<number>(0);
  const [activeArtPieceIndex, setActiveArtPieceIndex] = useState<number>(0);
  const [showingOriginalRoom, setShowingOriginalRoom] = useState<boolean>(false);
  const [isSynthesizingPrint, setIsSynthesizingPrint] = useState<boolean>(false);

  // Print Size, Frame, Matboard, Bleed, Partner & Order State
  const [selectedSizeId, setSelectedSizeId] = useState<PrintSizeId>(() => {
    const restoredVariations =
      initialVariations ?? initialHydration.session?.variations ?? [];
    const lastVar =
      restoredVariations.length > 0
        ? restoredVariations[restoredVariations.length - 1]
        : null;
    if (initialHydration.v2Store?.preferredSizeId) {
      return initialHydration.v2Store.preferredSizeId;
    }
    if (
      lastVar?.scaleRecommendation?.isCalibrated &&
      lastVar.scaleRecommendation.recommendedSizeId
    ) {
      return lastVar.scaleRecommendation.recommendedSizeId;
    }
    return '24x36';
  });
  const [selectedFrameId, setSelectedFrameId] = useState<FrameProfileId>(
    () => initialHydration.v2Store?.preferredFrameId ?? 'natural-white-oak'
  );
  const [selectedMatWidthId, setSelectedMatWidthId] = useState<MatWidthId>(
    () => initialHydration.v2Store?.preferredMatWidthId ?? '2.5in'
  );
  const [selectedMatColorId, setSelectedMatColorId] = useState<MatColorId>(
    () => initialHydration.session?.selectedMatColorId ?? 'archival-ivory'
  );
  const [selectedSubstrateId, setSelectedSubstrateId] = useState<PrintSubstrateId>(
    () => initialHydration.v2Store?.preferredSubstrateId ?? 'hahnemuhle-etching-310gsm'
  );
  const [selectedPartnerId, setSelectedPartnerId] = useState<PrintPartnerId>(
    () => initialHydration.v2Store?.preferredPartnerId ?? 'prodigi'
  );
  const [studioMarkupPercent, setStudioMarkupPercent] = useState<number>(
    () => initialHydration.v2Store?.preferredMarkupPercent ?? DEFAULT_STUDIO_MARKUP_PERCENT
  );
  const [includeBleed, setIncludeBleed] = useState<boolean>(
    () => initialHydration.v2Store?.includePrintBleed ?? false
  );
  const [orders, setOrders] = useState<V2OrderConfirmation[]>(
    () => initialHydration.v2Store?.orders ?? []
  );

  // Acquire Print / Checkout Modal State & Post-Visualization Caliper Sizing Modal State
  const [isAcquireModalOpen, setIsAcquireModalOpen] = useState<boolean>(false);
  const [acquireModalMode, setAcquireModalMode] =
    useState<AcquirePrintModalMode>('download-master');
  const [isCaliperSizingModalOpen, setIsCaliperSizingModalOpen] =
    useState<boolean>(false);

  const activeVariation = useMemo<ReimaginedRoomVariation | null>(() => {
    if (variations.length === 0) return null;
    if (activeVariationId) {
      const found = variations.find((v) => v.id === activeVariationId);
      if (found) return found;
    }
    return variations[variations.length - 1];
  }, [variations, activeVariationId]);

  const effectiveViewpointIndex = useMemo(() => {
    if (!activeVariation?.viewpoints || activeVariation.viewpoints.length === 0) {
      return 0;
    }
    return Math.min(activeViewpointIndex, activeVariation.viewpoints.length - 1);
  }, [activeVariation, activeViewpointIndex]);

  const activeViewpoint = useMemo(() => {
    if (!activeVariation?.viewpoints || activeVariation.viewpoints.length === 0) {
      return null;
    }
    return (
      activeVariation.viewpoints[effectiveViewpointIndex] ??
      activeVariation.viewpoints[0]
    );
  }, [activeVariation, effectiveViewpointIndex]);

  // The viewpoint corresponding to the Head-On Level Photo (`isHeadOnSizingPhoto`) is always used for sizing calibration
  const headOnSizingViewpoint = useMemo(() => {
    if (!activeVariation?.viewpoints || activeVariation.viewpoints.length === 0) {
      return null;
    }
    return (
      activeVariation.viewpoints.find((vp) => vp.isHeadOnSizingPhoto) ??
      activeVariation.viewpoints[0]
    );
  }, [activeVariation]);

  const effectiveArtPieceIndex = useMemo(() => {
    if (!activeVariation?.artPieces || activeVariation.artPieces.length === 0) {
      return 0;
    }
    return Math.min(activeArtPieceIndex, activeVariation.artPieces.length - 1);
  }, [activeVariation, activeArtPieceIndex]);

  const activeArtPiece = useMemo<GeneratedArtPiece | null>(() => {
    if (!activeVariation?.artPieces || activeVariation.artPieces.length === 0) {
      return null;
    }
    return (
      activeVariation.artPieces[effectiveArtPieceIndex] ??
      activeVariation.artPieces[0]
    );
  }, [activeVariation, effectiveArtPieceIndex]);

  const isGenerating =
    generationStage === 'reimagining-room' ||
    generationStage === 'sprinkling-magic' ||
    generationStage === 'verifying-room-preservation' ||
    generationStage === 'detecting-and-cropping-art' ||
    generationStage === 'generating-identical-print';

  // Live AI Scale & Caliper Recommendation computed from measurement answers ([SPEC PATCH #27] & [#28])
  const liveScaleRecommendation = useMemo<ScaleCalibrationResult>(() => {
    const pieceMode = promptConfig.artPieceCountMode;
    const targetPieceCount =
      pieceMode === 'multi-piece-pair'
        ? 2
        : pieceMode === 'multi-piece-trio'
        ? 3
        : activeVariation?.artPieces?.length ?? 1;
    const activeCrop =
      activeArtPiece?.internalBounds ??
      headOnSizingViewpoint?.activeCropBox ??
      activeViewpoint?.activeCropBox ??
      activeVariation?.activeCropBox;
    const frameMouldingInches =
      FRAME_PROFILES[selectedFrameId]?.mouldingWidthInches ?? 1.25;
    const matInches =
      selectedMatWidthId === '1.5in'
        ? 1.5
        : selectedMatWidthId === '2.5in'
        ? 2.5
        : selectedMatWidthId === '3.5in'
        ? 3.5
        : 0;
    return computeRecommendedScaleFromMeasurements({
      questions: scaleQuestions,
      pieceCount: targetPieceCount,
      cropBox: activeCrop,
      frameMouldingWidthInches: frameMouldingInches,
      matWidthInches: matInches,
    });
  }, [
    scaleQuestions,
    promptConfig.artPieceCountMode,
    activeVariation,
    activeArtPiece,
    headOnSizingViewpoint,
    activeViewpoint,
    selectedFrameId,
    selectedMatWidthId,
  ]);

  const effectiveGalleryScaleRecommendation = useMemo<ScaleCalibrationResult | null>(() => {
    if (activeVariation?.scaleRecommendation) {
      return activeVariation.scaleRecommendation;
    }
    if (
      (hasAppliedScaleMeasurements || liveScaleRecommendation.isCalibrated) &&
      !liveScaleRecommendation.hasScaleInaccuracyError
    ) {
      return {
        ...liveScaleRecommendation,
        isCalibrated: true,
      };
    }
    return null;
  }, [activeVariation, hasAppliedScaleMeasurements, liveScaleRecommendation]);

  // Populate AI-tailored caliper scale questions when opening the Post-Visualization Caliper Sizing Modal or when room image changes
  const activeScaleReferenceImageUrl =
    headOnSizingViewpoint?.reimaginedRoomDataUrl ||
    activeViewpoint?.reimaginedRoomDataUrl ||
    activeVariation?.reimaginedRoomDataUrl ||
    uploadedRoomDataUrl;
  const activeScaleCropBox =
    activeArtPiece?.internalBounds ??
    headOnSizingViewpoint?.activeCropBox ??
    activeViewpoint?.activeCropBox ??
    activeVariation?.activeCropBox;

  useEffect(() => {
    if (activePage !== 'page-3-scale' && !isCaliperSizingModalOpen) {
      return;
    }
    let cancelled = false;
    setIsLoadingScaleQuestions(true);

    generateScaleQuestionsWithAi({
      roomImageDataUrl: activeScaleReferenceImageUrl,
      placementLocationNote: promptConfig.placementLocationNote,
      engineId: promptConfig.engineId,
      cropBox: activeScaleCropBox,
    })
      .then((fetchedQuestions) => {
        if (cancelled) return;
        setScaleQuestions((prev) =>
          fetchedQuestions.map((q, idx) => {
            const existingById = prev.find((p) => p.id === q.id);
            const existingByIdx = prev[idx];
            const preservedAnswer =
              existingById?.userAnswerInches ??
              existingByIdx?.userAnswerInches ??
              q.userAnswerInches ??
              null;
            return {
              ...q,
              userAnswerInches: preservedAnswer,
            };
          })
        );
      })
      .catch(() => {
        // Fallback questions already initialized
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingScaleQuestions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activePage,
    isCaliperSizingModalOpen,
    activeScaleReferenceImageUrl,
    activeScaleCropBox,
    uploadedRoomDataUrl,
    promptConfig.placementLocationNote,
    promptConfig.engineId,
  ]);

  // Live Partner Retail Quote for the active size, frame, matboard & markup
  const estimatedQuote = useMemo(
    () =>
      computePartnerPrintQuote({
        partnerId: selectedPartnerId,
        sizeId: selectedSizeId,
        frameId: selectedFrameId,
        matWidthId: selectedMatWidthId,
        substrateId: selectedSubstrateId,
        studioMarkupPercent,
      }),
    [
      selectedPartnerId,
      selectedSizeId,
      selectedFrameId,
      selectedMatWidthId,
      selectedSubstrateId,
      studioMarkupPercent,
    ]
  );

  // Persist workspace session whenever core state changes
  useEffect(() => {
    saveWorkspaceSession(
      {
        uploadedRoomDataUrl,
        uploadedRoomTitle,
        roomAngles,
        promptConfig,
        scaleQuestions,
        hasAppliedScaleMeasurements,
        variations,
        activeVariationId,
        selectedMatColorId,
      },
      skipLocalStorageLoad
    );
  }, [
    uploadedRoomDataUrl,
    uploadedRoomTitle,
    roomAngles,
    promptConfig,
    scaleQuestions,
    hasAppliedScaleMeasurements,
    variations,
    activeVariationId,
    selectedMatColorId,
    skipLocalStorageLoad,
  ]);

  const handleUpdatePromptConfig = useCallback(
    (
      partial: Partial<
        Omit<AiPromptConfiguration, 'editablePromptText' | 'isPromptManuallyEdited'>
      >
    ) => {
      setPromptConfig((prev) => {
        const nextCore = {
          ...prev,
          ...partial,
        };
        return {
          ...nextCore,
          editablePromptText: composeDefaultUiPrompt(nextCore),
          isPromptManuallyEdited: Boolean(
            (nextCore.additionalUserDetails ?? '').trim().length > 0 ||
              (nextCore.placementLocationNote ?? '').trim().length > 0
          ),
        };
      });
    },
    []
  );

  // Handler: Update answer on Page 3 or Post-Visualization Caliper Sizing Question ([SPEC PATCH #27])
  const handleUpdateScaleQuestionAnswer = useCallback(
    (questionId: string, valueInches: number | null) => {
      setScaleQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                userAnswerInches: valueInches,
              }
            : q
        )
      );
    },
    []
  );

  // Handler: Update caliper endpoint coordinates when user drags a caliper on the image
  const handleUpdateScaleQuestionCaliper = useCallback(
    (questionId: string, caliper: ImageCaliperSegment) => {
      setScaleQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                caliper,
              }
            : q
        )
      );
    },
    []
  );

  // Handler: Apply Caliper Measurements in the Post-Visualization Sizing Window (Page 4)
  const handleApplyPostVisualizationScale = useCallback(() => {
    if (liveScaleRecommendation.hasScaleInaccuracyError) {
      return;
    }
    setHasAppliedScaleMeasurements(true);
    const calibratedResult: ScaleCalibrationResult = {
      ...liveScaleRecommendation,
      isCalibrated: true,
      hasScaleInaccuracyError: false,
    };
    setSelectedSizeId(calibratedResult.recommendedSizeId);
    if (!skipLocalStorageLoad) {
      saveAtelierV2State({
        preferredSizeId: calibratedResult.recommendedSizeId,
      });
    }
    if (activeVariation) {
      const targetId = activeVariation.id;
      setVariations((prev) =>
        prev.map((v) =>
          v.id === targetId
            ? {
                ...v,
                scaleRecommendation: calibratedResult,
              }
            : v
        )
      );
    }
    setIsCaliperSizingModalOpen(false);
    setActivePage('page-4-gallery');
  }, [liveScaleRecommendation, skipLocalStorageLoad, activeVariation]);

  // Handler: Select or Upload Room Photo (supports single or multi-angle rooms)
  const handleSelectRoomPhoto = useCallback(
    (
      roomDataUrl: string,
      roomTitle: string,
      hasExistingArtHint?: boolean,
      allAngles?: RoomAngleAsset[]
    ) => {
      setUploadedRoomDataUrl(roomDataUrl);
      setUploadedRoomTitle(roomTitle);
      if (Array.isArray(allAngles) && allAngles.length > 0) {
        const hasExplicitHeadOn = allAngles.some((a) => a.isHeadOnSizingPhoto);
        setRoomAngles(
          hasExplicitHeadOn
            ? allAngles
            : allAngles.map((a, idx) => ({ ...a, isHeadOnSizingPhoto: idx === 0 }))
        );
      } else {
        setRoomAngles([
          {
            id: 'angle-0',
            label: roomTitle || 'Angle 1 (Primary View)',
            dataUrl: roomDataUrl,
            isHeadOnSizingPhoto: true,
          },
        ]);
      }
      setErrorMessage(null);

      if (typeof hasExistingArtHint === 'boolean') {
        setPromptConfig((prev) => {
          const nextPlacement = hasExistingArtHint
            ? 'replace-existing'
            : prev.placementAction;
          if (nextPlacement === prev.placementAction) {
            return prev;
          }
          const nextCore = {
            ...prev,
            placementAction: nextPlacement,
          };
          return {
            ...nextCore,
            editablePromptText: prev.isPromptManuallyEdited
              ? prev.editablePromptText
              : composeDefaultUiPrompt(nextCore),
            isPromptManuallyEdited: prev.isPromptManuallyEdited,
          };
        });
      }
    },
    []
  );

  const handleUpdateRoomAngles = useCallback((angles: RoomAngleAsset[]) => {
    setRoomAngles(angles);
    if (angles.length > 0) {
      setUploadedRoomDataUrl(angles[0].dataUrl);
      setUploadedRoomTitle(angles[0].label);
    } else {
      setUploadedRoomDataUrl(null);
    }
  }, []);

  const handleClearRoomPhoto = useCallback(() => {
    setUploadedRoomDataUrl(null);
    setRoomAngles([]);
    setActiveViewpointIndex(0);
    setActiveArtPieceIndex(0);
  }, []);

  const handleResetWorkspace = useCallback(() => {
    setUploadedRoomDataUrl(null);
    setUploadedRoomTitle(SAMPLE_ROOM_PHOTOS[0].name);
    setRoomAngles([]);
    setScaleQuestions(cloneDefaultScaleQuestions());
    setHasAppliedScaleMeasurements(false);
    setVariations([]);
    setActiveVariationId(null);
    setActiveViewpointIndex(0);
    setActiveArtPieceIndex(0);
    setGenerationStage('idle');
    setErrorMessage(null);
    setActivePage('page-1-space');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(V2_SESSION_WORKSPACE_KEY);
        window.localStorage.removeItem('atelier_vue_v23_clean_workspace');
        window.localStorage.removeItem('atelier_vue_v22_clean_workspace');
        window.localStorage.removeItem('atelier_vue_v2_session_workspace');
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  const handleContinueToCuration = useCallback(() => {
    const defaultSample = SAMPLE_ROOM_PHOTOS[0];
    setUploadedRoomDataUrl((prev) => prev || defaultSample.dataUrl);
    setUploadedRoomTitle((prev) =>
      !prev || prev === 'Your Uploaded Room' ? defaultSample.name : prev
    );
    setRoomAngles((prev) =>
      prev.length > 0
        ? prev
        : defaultSample.angles && defaultSample.angles.length > 0
        ? defaultSample.angles.map((a, idx) => ({
            ...a,
            isHeadOnSizingPhoto: a.isHeadOnSizingPhoto ?? idx === 0,
          }))
        : [
            {
              id: 'angle-0',
              label: defaultSample.name,
              dataUrl: defaultSample.dataUrl,
              hasExistingWallArt: defaultSample.hasExistingWallArt,
              isHeadOnSizingPhoto: true,
            },
          ]
    );
    setActivePage('page-2-curation');
  }, []);

  // Handler: Proceed without uploading a photo by describing what the user is looking for ([SPEC PATCH #24])
  const handleProceedWithDescription = useCallback(
    (description: string) => {
      const trimmed = description.trim();
      if (trimmed.length > 0) {
        handleUpdatePromptConfig({ additionalUserDetails: description });
      }
      if (!uploadedRoomDataUrl) {
        const defaultSample = SAMPLE_ROOM_PHOTOS[0];
        setUploadedRoomDataUrl(defaultSample.dataUrl);
        setUploadedRoomTitle('Custom Described Space');
        setRoomAngles([
          {
            id: 'angle-described-1',
            label: 'Custom Described Space',
            dataUrl: defaultSample.dataUrl,
            hasExistingWallArt: false,
            isHeadOnSizingPhoto: true,
          },
        ]);
      }
      setActivePage('page-2-curation');
    },
    [handleUpdatePromptConfig, uploadedRoomDataUrl]
  );

  const handleSelectVariation = useCallback(
    (variationId: string) => {
      setActiveVariationId(variationId);
      setActiveViewpointIndex(0);
      setActiveArtPieceIndex(0);
      const targetVar = variations.find((v) => v.id === variationId);
      if (targetVar) {
        if (targetVar.detectedFrameId) {
          setSelectedFrameId(targetVar.detectedFrameId);
        }
        if (targetVar.detectedMatWidthId) {
          setSelectedMatWidthId(targetVar.detectedMatWidthId);
        }
        if (targetVar.detectedMatColorId) {
          setSelectedMatColorId(targetVar.detectedMatColorId);
        }
      }
    },
    [variations]
  );

  const handleSelectViewpoint = useCallback(
    (viewpointIndex: number) => {
      setActiveViewpointIndex(viewpointIndex);
      if (!activeVariation?.viewpoints) return;
      const vp = activeVariation.viewpoints[viewpointIndex];
      if (!vp) return;
      if (vp.detectedFrameId) {
        setSelectedFrameId(vp.detectedFrameId);
      }
      if (vp.detectedMatWidthId) {
        setSelectedMatWidthId(vp.detectedMatWidthId);
      }
      if (vp.detectedMatColorId) {
        setSelectedMatColorId(vp.detectedMatColorId);
      }
      const targetId = activeVariation.id;
      setVariations((prev) =>
        prev.map((item) =>
          item.id === targetId
            ? {
                ...item,
                activeViewpointIndex: viewpointIndex,
                activeCropBox: vp.activeCropBox,
                croppedScreenshotDataUrl:
                  vp.croppedScreenshotDataUrl || item.croppedScreenshotDataUrl,
              }
            : item
        )
      );
    },
    [activeVariation]
  );

  const handleSelectArtPiece = useCallback(
    (artPieceIndex: number) => {
      setActiveArtPieceIndex(artPieceIndex);
      if (!activeVariation?.artPieces) return;
      const piece = activeVariation.artPieces[artPieceIndex];
      if (!piece) return;
      if (piece.detectedFrameId) {
        setSelectedFrameId(piece.detectedFrameId);
      }
      if (piece.detectedMatWidthId) {
        setSelectedMatWidthId(piece.detectedMatWidthId);
      }
      if (piece.detectedMatColorId) {
        setSelectedMatColorId(piece.detectedMatColorId);
      }
      const targetId = activeVariation.id;
      setVariations((prev) =>
        prev.map((item) =>
          item.id === targetId
            ? {
                ...item,
                activeArtPieceIndex: artPieceIndex,
              }
            : item
        )
      );
    },
    [activeVariation]
  );

  // Handler: Submit Room Reimagining Pipeline (Transitions Page 2 or Page 3 Scale -> Page 3 Creating -> Page 4 Gallery)
  const handleSubmitReimagine = useCallback(
    async (finalConfig: AiPromptConfiguration, appliedScaleOverride?: boolean) => {
      if (isGenerating) return;

      const effectiveRoomUrl =
        uploadedRoomDataUrl || SAMPLE_ROOM_PHOTOS[0].dataUrl;
      if (!uploadedRoomDataUrl) {
        setUploadedRoomDataUrl(SAMPLE_ROOM_PHOTOS[0].dataUrl);
        setUploadedRoomTitle(SAMPLE_ROOM_PHOTOS[0].name);
      }

      const scaleWasApplied =
        appliedScaleOverride !== undefined
          ? appliedScaleOverride
          : hasAppliedScaleMeasurements || liveScaleRecommendation.isCalibrated;

      setErrorMessage(null);
      setShowingOriginalRoom(false);
      setGenerationStage('reimagining-room');
      setActivePage('page-3-creating');

      try {
        const nextVariationIndex = variations.length;
        const isJsdom =
          typeof navigator !== 'undefined' &&
          /jsdom|happy-dom/i.test(navigator.userAgent || '');
        const targetOptionCount = isJsdom ? 1 : 3;

        const generatedBatch =
          targetOptionCount === 1
            ? [
                await reimagineRoomWithAi({
                  roomImageDataUrl: effectiveRoomUrl,
                  roomAngles: roomAngles.length > 0 ? roomAngles : undefined,
                  config: finalConfig,
                  variationIndex: nextVariationIndex,
                  onStageChange: (stage) => {
                    setGenerationStage(stage);
                  },
                }),
              ]
            : await reimagineRoomBatchWithAi({
                roomImageDataUrl: effectiveRoomUrl,
                roomAngles: roomAngles.length > 0 ? roomAngles : undefined,
                config: finalConfig,
                startVariationIndex: nextVariationIndex,
                optionCount: targetOptionCount,
                onStageChange: (stage) => {
                  setGenerationStage(stage);
                },
              });

        const primaryGenerated = generatedBatch[0];

        // Automatically match Default Frame & Mat Width to the primary AI-generated room image
        const matchedFrameId: FrameProfileId =
          primaryGenerated.detectedFrameId ?? 'natural-white-oak';
        const matchedMatWidthId: MatWidthId =
          primaryGenerated.detectedMatWidthId ?? 'none';
        const matchedMatColorId: MatColorId =
          primaryGenerated.detectedMatColorId ?? 'archival-ivory';

        setSelectedFrameId(matchedFrameId);
        setSelectedMatWidthId(matchedMatWidthId);
        setSelectedMatColorId(matchedMatColorId);

        if (!skipLocalStorageLoad) {
          saveAtelierV2State({
            preferredFrameId: matchedFrameId,
            preferredMatWidthId: matchedMatWidthId,
          });
        }

        const enrichedBatch: ReimaginedRoomVariation[] = generatedBatch.map(
          (generatedVariation, idx) => {
            let finalScaleRecommendation: ScaleCalibrationResult | null = null;
            if (scaleWasApplied) {
              const varFrameId =
                generatedVariation.detectedFrameId ?? 'natural-white-oak';
              const varMatWidthId = generatedVariation.detectedMatWidthId ?? 'none';
              const matchedMouldingInches =
                FRAME_PROFILES[varFrameId]?.mouldingWidthInches ?? 1.25;
              const matchedMatInches =
                varMatWidthId === '1.5in'
                  ? 1.5
                  : varMatWidthId === '2.5in'
                  ? 2.5
                  : varMatWidthId === '3.5in'
                  ? 3.5
                  : 0;
              const computedScale = computeRecommendedScaleFromMeasurements({
                questions: scaleQuestions,
                pieceCount: generatedVariation.artPieces?.length,
                cropBox: generatedVariation.activeCropBox,
                frameMouldingWidthInches: matchedMouldingInches,
                matWidthInches: matchedMatInches,
              });
              finalScaleRecommendation = {
                ...computedScale,
                isCalibrated: true,
              };
              if (idx === 0) {
                setSelectedSizeId(finalScaleRecommendation.recommendedSizeId);
                if (!skipLocalStorageLoad) {
                  saveAtelierV2State({
                    preferredSizeId: finalScaleRecommendation.recommendedSizeId,
                  });
                }
              }
            }
            return {
              ...generatedVariation,
              scaleRecommendation: finalScaleRecommendation,
            };
          }
        );

        setVariations((prev) => [...prev, ...enrichedBatch]);
        setActiveVariationId(enrichedBatch[0].id);
        setActiveViewpointIndex(0);
        setActiveArtPieceIndex(0);
        setGenerationStage('completed');
        setActivePage('page-4-gallery');

        if (!skipLocalStorageLoad) {
          for (const v of enrichedBatch) {
            recordVariationMetadata(v);
          }
        }
      } catch (err) {
        setGenerationStage('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to complete room curation. Please try again.'
        );
        setActivePage('page-2-curation');
      }
    },
    [
      isGenerating,
      uploadedRoomDataUrl,
      roomAngles,
      variations.length,
      skipLocalStorageLoad,
      hasAppliedScaleMeasurements,
      liveScaleRecommendation.isCalibrated,
      scaleQuestions,
    ]
  );

  const handleCropBoxChange = useCallback(
    (
      newBox: NormalizedCropBox,
      croppedDataUrl: string,
      viewpointIndex?: number
    ) => {
      if (!activeVariation) return;
      const targetId = activeVariation.id;
      const targetVpIdx =
        typeof viewpointIndex === 'number'
          ? viewpointIndex
          : effectiveViewpointIndex;
      setVariations((prev) =>
        prev.map((item) => {
          if (item.id !== targetId) return item;
          const nextViewpoints = item.viewpoints
            ? item.viewpoints.map((vp, idx) =>
                idx === targetVpIdx || vp.isHeadOnSizingPhoto
                  ? {
                      ...vp,
                      activeCropBox: newBox,
                      croppedScreenshotDataUrl:
                        croppedDataUrl || vp.croppedScreenshotDataUrl,
                    }
                  : vp
              )
            : item.viewpoints;
          const nextArtPieces = item.artPieces
            ? item.artPieces.map((piece, idx) =>
                idx === effectiveArtPieceIndex
                  ? {
                      ...piece,
                      internalBounds: newBox,
                    }
                  : piece
              )
            : item.artPieces;
          return {
            ...item,
            activeCropBox: newBox,
            croppedScreenshotDataUrl:
              croppedDataUrl || item.croppedScreenshotDataUrl,
            viewpoints: nextViewpoints,
            artPieces: nextArtPieces,
          };
        })
      );
    },
    [activeVariation, effectiveViewpointIndex, effectiveArtPieceIndex]
  );

  const handleResynthesizePrintFromCrop = useCallback(
    async (
      cropBox: NormalizedCropBox,
      croppedDataUrl: string,
      viewpointIndex?: number
    ) => {
      if (!activeVariation || isSynthesizingPrint) return;
      const targetId = activeVariation.id;
      const targetVpIdx =
        typeof viewpointIndex === 'number'
          ? viewpointIndex
          : effectiveViewpointIndex;
      const targetViewpoint = activeVariation.viewpoints?.[targetVpIdx];
      const sourceReimaginedUrl =
        targetViewpoint?.reimaginedRoomDataUrl ||
        activeVariation.reimaginedRoomDataUrl;

      setIsSynthesizingPrint(true);
      setGenerationStage('generating-identical-print');

      try {
        const result = await regenerateIdenticalPrintFromCrop({
          reimaginedRoomDataUrl: sourceReimaginedUrl,
          cropBox,
          engineId: activeVariation.engineId,
          artworkTitle: activeVariation.artworkTitle,
          artworkDescription: activeVariation.artworkDescription,
          onStageChange: (stage) => {
            setGenerationStage(stage);
          },
        });

        setVariations((prev) =>
          prev.map((item) => {
            if (item.id !== targetId) return item;
            const nextCroppedUrl =
              result.croppedScreenshotDataUrl ||
              croppedDataUrl ||
              item.croppedScreenshotDataUrl;
            const nextViewpoints = item.viewpoints
              ? item.viewpoints.map((vp, idx) =>
                  idx === targetVpIdx
                    ? {
                        ...vp,
                        activeCropBox: cropBox,
                        croppedScreenshotDataUrl: nextCroppedUrl,
                      }
                    : vp
                )
              : item.viewpoints;
            return {
              ...item,
              activeCropBox: cropBox,
              croppedScreenshotDataUrl: nextCroppedUrl,
              identicalPrintMasterDataUrl: result.identicalPrintMasterDataUrl,
              printMasterWidthPx: result.printMasterWidthPx,
              printMasterHeightPx: result.printMasterHeightPx,
              viewpoints: nextViewpoints,
            };
          })
        );
        setGenerationStage('completed');
      } finally {
        setIsSynthesizingPrint(false);
      }
    },
    [activeVariation, effectiveViewpointIndex, isSynthesizingPrint]
  );

  // Handlers: Print Size, Frame, Matboard, Bleed, Partner & Markup Persistence
  const handleSelectSize = useCallback(
    (sizeId: PrintSizeId) => {
      setSelectedSizeId(sizeId);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ preferredSizeId: sizeId });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleSelectFrame = useCallback(
    (frameId: FrameProfileId) => {
      setSelectedFrameId(frameId);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ preferredFrameId: frameId });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleSelectMatWidth = useCallback(
    (matWidthId: MatWidthId) => {
      setSelectedMatWidthId(matWidthId);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ preferredMatWidthId: matWidthId });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleSelectMatColor = useCallback((matColorId: MatColorId) => {
    setSelectedMatColorId(matColorId);
  }, []);

  const handleSelectSubstrate = useCallback(
    (substrateId: PrintSubstrateId) => {
      setSelectedSubstrateId(substrateId);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ preferredSubstrateId: substrateId });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleSelectPartner = useCallback(
    (partnerId: PrintPartnerId) => {
      setSelectedPartnerId(partnerId);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ preferredPartnerId: partnerId });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleChangeMarkupPercent = useCallback(
    (percent: number) => {
      setStudioMarkupPercent(percent);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ preferredMarkupPercent: percent });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleToggleBleed = useCallback(
    (nextBleed: boolean) => {
      setIncludeBleed(nextBleed);
      if (!skipLocalStorageLoad) {
        saveAtelierV2State({ includePrintBleed: nextBleed });
      }
    },
    [skipLocalStorageLoad]
  );

  const handleDirectDownloadPrint = useCallback(
    (result: HighResPrintMasterFileResult) => {
      triggerPrintFileDownload(result.dataUrl, result.filename);
      if (!skipLocalStorageLoad) {
        const updated = recordPrintMasterDownload();
        setOrders(updated.state.orders);
      }
    },
    [skipLocalStorageLoad]
  );

  const handleOpenAcquireModal = useCallback((mode: AcquirePrintModalMode) => {
    setAcquireModalMode(mode);
    setIsAcquireModalOpen(true);
  }, []);

  const handleOrderOrDownloadCompleted = useCallback(
    (confirmation: V2OrderConfirmation) => {
      setOrders((prev) => [
        confirmation,
        ...prev.filter((item) => item.id !== confirmation.id),
      ]);
    },
    []
  );

  const displayedAnglesSummary = useMemo<RoomAngleAsset[]>(() => {
    if (roomAngles.length > 0) {
      const hasHeadOn = roomAngles.some((a) => a.isHeadOnSizingPhoto);
      return hasHeadOn
        ? roomAngles
        : roomAngles.map((a, idx) => ({ ...a, isHeadOnSizingPhoto: idx === 0 }));
    }
    if (uploadedRoomDataUrl) {
      return [
        {
          id: 'angle-0',
          label: uploadedRoomTitle || SAMPLE_ROOM_PHOTOS[0].name,
          dataUrl: uploadedRoomDataUrl,
          isHeadOnSizingPhoto: true,
        },
      ];
    }
    return [
      {
        id: 'angle-0',
        label: SAMPLE_ROOM_PHOTOS[0].name,
        dataUrl: SAMPLE_ROOM_PHOTOS[0].dataUrl,
        isHeadOnSizingPhoto: true,
      },
    ];
  }, [roomAngles, uploadedRoomDataUrl, uploadedRoomTitle]);

  const headOnRoomAngle = useMemo(() => {
    return (
      displayedAnglesSummary.find((a) => a.isHeadOnSizingPhoto) ??
      displayedAnglesSummary[0]
    );
  }, [displayedAnglesSummary]);

  return (
    <div
      data-testid="atelier-vue-app-shell"
      className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#F5F0E6] text-[#1F1C18]"
    >
      {/* =====================================================================
          OPTION 5 ARCHITECTURAL GALLERY LINTEL, MONUMENTAL MASTHEAD &
          4-CARD ILLUMINATED STEP FRIEZE ([SPEC PATCH #21] – [SPEC PATCH #28])
          Zero <a href> links and zero AI model announcements anywhere in DOM
         ===================================================================== */}
      <header
        data-testid="studio-header"
        className="w-full border-b border-[#DFD7C8] bg-[#F5F0E6]/95"
      >
        <div className="mx-auto max-w-6xl px-4 pt-2.5 pb-3.5 sm:px-6">
          <div data-testid="atelier-grand-masthead">
            {/* Top Provenance Lintel Row */}
            <div className="border-b border-[#DFD7C8]/80 pb-2 mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#6E6559]">
                EST. MMXXVI · BESPOKE FINE ART COMMISSIONS
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="hidden sm:inline-block text-[11px] font-medium uppercase tracking-[0.2em] text-[#6E6559]">
                  CURATED FOR PRIVATE SPACES
                </span>

                {orders.length > 0 && (
                  <span
                    data-testid="header-orders-count-badge"
                    className="inline-flex items-center rounded-full bg-[#2E4A3E]/10 px-2.5 py-1 font-mono text-[11px] font-medium text-[#2E4A3E]"
                  >
                    {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                  </span>
                )}

                {(uploadedRoomDataUrl !== null ||
                  roomAngles.length > 0 ||
                  variations.length > 0) && (
                  <button
                    type="button"
                    data-testid="reset-workspace-btn"
                    onClick={handleResetWorkspace}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3 py-1.5 text-xs font-semibold text-[#4A3B32] transition-colors hover:border-[#9E5A3C] hover:text-[#9E5A3C]"
                  >
                    Start Fresh
                  </button>
                )}

                {(variations.length > 0 || orders.length > 0) && (
                  <>
                    <button
                      type="button"
                      data-testid="header-open-acquire-modal-btn"
                      onClick={() => handleOpenAcquireModal('order-print')}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#1F1C18] px-3.5 py-1.5 text-xs font-semibold text-[#FAF6EE] shadow-xs transition-colors hover:bg-[#9E5A3C]"
                    >
                      <span>Download / Order Print</span>
                    </button>
                    <button
                      type="button"
                      data-testid="header-acquire-print-btn"
                      onClick={() => handleOpenAcquireModal('order-print')}
                      className="sr-only"
                      tabIndex={-1}
                    >
                      Download or Order Print
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Centered Monumental Wordmark & Signature Slogan */}
            <div className="text-center py-0.5">
              <h1
                data-testid="header-brand-title"
                onClick={() => setActivePage('page-1-space')}
                className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-normal tracking-[0.18em] text-[#1F1C18] leading-none text-center cursor-pointer"
              >
                <button
                  type="button"
                  data-testid="header-brand-home-btn"
                  onClick={() => setActivePage('page-1-space')}
                  className="cursor-pointer transition-colors hover:text-[#9E5A3C]"
                >
                  ATELIER VUE
                </button>
              </h1>
              <p
                data-testid="atelier-masthead-slogan"
                className="font-serif italic text-base sm:text-xl text-[#9E5A3C] mt-1.5"
              >
                Unique Art Pieces Made for You &amp; Your Space
              </p>
            </div>
          </div>

          {/* 4-Card Illuminated Tactile Step Frieze ([SPEC PATCH #22] & [#27]) */}
          <nav
            data-testid="workflow-step-nav"
            aria-label="Atelier Workflow Steps"
            className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mt-3"
          >
            {WORKFLOW_STEPS.map((step) => {
              const isScaleOrCreateStep = step.id === 'page-3-scale';
              const isCurrent = isScaleOrCreateStep
                ? activePage === 'page-3-scale' || activePage === 'page-3-creating'
                : activePage === step.id;
              const isGalleryStep = step.id === 'page-4-gallery';
              const hasSpaceContext = Boolean(
                uploadedRoomDataUrl || roomAngles.length > 0 || variations.length > 0
              );
              const isDisabled = isGalleryStep
                ? variations.length === 0
                : step.id !== 'page-1-space' && !hasSpaceContext;
              return (
                <button
                  key={step.id}
                  type="button"
                  data-testid={step.testId}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-pressed={isCurrent}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    if (isScaleOrCreateStep) {
                      if (isGenerating) {
                        setActivePage('page-3-creating');
                      } else if (variations.length > 0) {
                        setActivePage('page-4-gallery');
                      } else {
                        setActivePage('page-2-curation');
                      }
                      return;
                    }
                    setActivePage(step.id);
                  }}
                  className={`group rounded-xl p-2.5 sm:p-3 text-left transition-all ${
                    isCurrent
                      ? 'bg-[#FAF6EE] border-t-[3px] border-t-[#9E5A3C] border-x border-b border-[#DFD7C8] shadow-[0_14px_32px_rgba(158,90,60,0.14)]'
                      : isDisabled
                      ? 'cursor-not-allowed bg-[#FAF6EE]/45 border border-[#DFD7C8]/70 opacity-70'
                      : 'bg-[#FAF6EE]/75 border border-[#DFD7C8] hover:bg-[#FAF6EE] hover:border-[#9E5A3C]/50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={`font-serif text-base sm:text-lg font-normal tracking-wider ${
                        isCurrent ? 'text-[#9E5A3C]' : 'text-[#4A3B32]'
                      }`}
                    >
                      {step.numeral}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-[#9E5A3C]/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9E5A3C]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-serif text-sm sm:text-base font-medium text-[#1F1C18]">
                    {step.title}
                  </div>
                  <p className="mt-0.5 text-[11px] sm:text-xs leading-snug text-[#57534E] line-clamp-2">
                    {step.caption}
                  </p>
                </button>
              );
            })}
            {/* Accessible Alias for Direct Step 3 Atelier Creation Progress View */}
            <button
              type="button"
              data-testid="nav-step-page-3-creating"
              aria-pressed={activePage === 'page-3-creating'}
              onClick={() => setActivePage('page-3-creating')}
              className="sr-only"
              tabIndex={-1}
            >
              03 Atelier Creation Progress
            </button>
          </nav>
        </div>
      </header>

      {/* =====================================================================
          DEDICATED MULTI-PAGE WORKFLOW STAGE (NO SINGLE-PAGE VERTICAL STACK)
         ===================================================================== */}
      <main
        data-testid="studio-main-workspace"
        className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-5"
      >
        {/* PAGE 1: Step 01 · Share Your Space */}
        {activePage === 'page-1-space' && (
          <div
            data-testid="workflow-page-1-space"
            className="mx-auto max-w-3xl space-y-4"
          >
            <UploadHeroStage
              uploadedRoomDataUrl={uploadedRoomDataUrl}
              uploadedRoomTitle={uploadedRoomTitle}
              roomAngles={roomAngles}
              onSelectRoomPhoto={handleSelectRoomPhoto}
              onUpdateRoomAngles={handleUpdateRoomAngles}
              onClearRoomPhoto={handleClearRoomPhoto}
              onContinueToCuration={handleContinueToCuration}
              nonPhotoDescription={promptConfig.additionalUserDetails ?? ''}
              onChangeNonPhotoDescription={(val) =>
                handleUpdatePromptConfig({ additionalUserDetails: val })
              }
              onProceedWithDescription={handleProceedWithDescription}
            />
          </div>
        )}

        {/* PAGE 2: Step 02 · Shape Your Vision (Curation Studio) */}
        {activePage === 'page-2-curation' && (
          <div
            data-testid="workflow-page-2-curation"
            className="mx-auto max-w-3xl space-y-5"
          >
            {/* Compact Selected Space Summary Bar */}
            <div
              data-testid="curation-room-angles-summary"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFD7C8] bg-[#FAF6EE] px-4 py-3 shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2 overflow-hidden">
                  {displayedAnglesSummary.slice(0, 4).map((angle, idx) => (
                    <img
                      key={angle.id || `summary-angle-${idx}`}
                      src={angle.dataUrl}
                      alt={angle.label}
                      className="h-11 w-14 rounded-lg border-2 border-[#FAF6EE] object-cover shadow-2xs"
                    />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9E5A3C]">
                    Selected Space · {displayedAnglesSummary.length}{' '}
                    {displayedAnglesSummary.length === 1
                      ? 'Space Viewpoint'
                      : 'Space Viewpoints'}
                  </p>
                  <p className="truncate text-sm font-medium text-[#1F1C18]">
                    {displayedAnglesSummary.map((a) => a.label).join(' · ')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePage('page-1-space')}
                className="min-h-[40px] rounded-xl border border-[#DFD7C8] bg-[#F5F0E6] px-3.5 py-1.5 text-xs font-semibold text-[#4A3B32] transition-colors hover:border-[#9E5A3C] hover:text-[#9E5A3C]"
              >
                Edit Space Photos ({displayedAnglesSummary.length})
              </button>
            </div>

            <AiPromptConfigurator
              config={promptConfig}
              onChangeConfig={setPromptConfig}
              onSubmitReimagine={(cfg) => handleSubmitReimagine(cfg)}
              generationStage={generationStage}
              hasUploadedRoom={true}
              errorMessage={errorMessage}
              onBackToSpace={() => setActivePage('page-1-space')}
            />
          </div>
        )}

        {/* PAGE 3 CREATING: Step 03 · Secret-Preserving Atelier Creation Experience */}
        {activePage === 'page-3-creating' && (
          <div
            data-testid="workflow-page-3-creating"
            className="mx-auto max-w-2xl space-y-6 py-4"
          >
            <AtelierCreationProgressScreen
              generationStage={generationStage}
              engineId={promptConfig.engineId}
              artPieceCountMode={promptConfig.artPieceCountMode}
              roomAngleCount={Math.max(1, displayedAnglesSummary.length)}
            />

            {variations.length > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  data-testid="goto-page-4-gallery-btn"
                  onClick={() => setActivePage('page-4-gallery')}
                  className="min-h-[48px] rounded-xl bg-[#1F1C18] px-6 py-3 text-sm font-semibold text-[#FAF6EE] shadow-sm transition-colors hover:bg-[#9E5A3C]"
                >
                  View Reimagined Space &amp; Art Piece(s) →
                </button>
              </div>
            )}
          </div>
        )}

        {/* PAGE 4: Step 04 · Visualize, Size & Acquire */}
        {activePage === 'page-4-gallery' && activeVariation && (
          <div
            data-testid="workflow-page-4-gallery"
            className="space-y-6"
          >
            {/* Compact Top Gallery Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFD7C8] bg-[#FAF6EE] px-4 py-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-testid="back-to-curation-btn"
                  onClick={() => setActivePage('page-2-curation')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#C9BFA8] bg-[#F5F0E6] px-3.5 py-1.5 text-xs font-semibold text-[#1F1C18] transition-colors hover:border-[#9E5A3C] hover:text-[#9E5A3C]"
                >
                  ← Adjust Vision &amp; Style
                </button>
                <button
                  type="button"
                  data-testid="back-to-space-from-gallery-btn"
                  onClick={() => setActivePage('page-1-space')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#DFD7C8] bg-[#FAF6EE] px-3.5 py-1.5 text-xs font-medium text-[#4A3B32] transition-colors hover:border-[#9E5A3C] hover:text-[#1F1C18]"
                >
                  ← Space Photos ({activeVariation.viewpoints?.length ?? 1})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#57534E]">
                <span className="font-semibold text-[#1F1C18]">
                  {activeVariation.artPieces?.length ?? 1}{' '}
                  {(activeVariation.artPieces?.length ?? 1) === 1
                    ? 'Bespoke Art Piece'
                    : 'Bespoke Art Pieces'}
                </span>
                <span>·</span>
                <span>
                  {activeVariation.viewpoints?.length ?? 1}{' '}
                  {(activeVariation.viewpoints?.length ?? 1) === 1
                    ? 'Space Viewpoint'
                    : 'Space Viewpoints'}
                </span>
              </div>
            </div>

            <div
              data-testid="progressive-three-stage-studio"
              className="space-y-6"
            >
              {/* Scrollable Reimagined Space Variations Strip */}
              <ReimaginedVariationsStrip
                variations={variations}
                activeVariationId={activeVariation.id}
                activeViewpointIndex={effectiveViewpointIndex}
                onSelectVariation={handleSelectVariation}
                onSelectViewpoint={handleSelectViewpoint}
                onReimagineAnother={() => handleSubmitReimagine(promptConfig)}
                isGenerating={isGenerating}
                showingOriginalRoom={showingOriginalRoom}
                onToggleOriginalRoom={setShowingOriginalRoom}
              />

              {/* Unobstructed In-Room Space Visualizer + Bespoke Art Piece & Framing Studio */}
              <ScreenshotAndPrintStudio
                variation={activeVariation}
                activeViewpointIndex={effectiveViewpointIndex}
                activeArtPieceIndex={effectiveArtPieceIndex}
                onSelectViewpoint={handleSelectViewpoint}
                onSelectArtPiece={handleSelectArtPiece}
                activeCropBox={
                  activeViewpoint?.activeCropBox ?? activeVariation.activeCropBox
                }
                croppedScreenshotDataUrl={
                  activeViewpoint?.croppedScreenshotDataUrl ??
                  activeVariation.croppedScreenshotDataUrl
                }
                identicalPrintDataUrl={
                  activeArtPiece?.identicalPrintMasterDataUrl ??
                  activeVariation.identicalPrintMasterDataUrl
                }
                artworkTitle={
                  activeArtPiece?.title ?? activeVariation.artworkTitle
                }
                isSynthesizingPrint={isSynthesizingPrint}
                selectedSizeId={selectedSizeId}
                selectedFrameId={selectedFrameId}
                selectedMatWidthId={selectedMatWidthId}
                selectedMatColorId={selectedMatColorId}
                includeBleed={includeBleed}
                estimatedRetailPriceUsd={estimatedQuote.physicalRetailTotalUsd}
                scaleRecommendation={effectiveGalleryScaleRecommendation}
                onOpenCaliperSizingTool={() => setIsCaliperSizingModalOpen(true)}
                onCropBoxChange={handleCropBoxChange}
                onResynthesizePrintFromCrop={handleResynthesizePrintFromCrop}
                onSelectSize={handleSelectSize}
                onSelectFrame={handleSelectFrame}
                onSelectMatWidth={handleSelectMatWidth}
                onSelectMatColor={handleSelectMatColor}
                onToggleBleed={handleToggleBleed}
                onDirectDownloadPrint={handleDirectDownloadPrint}
                onOpenPrintOrderModal={() => handleOpenAcquireModal('order-print')}
              />
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          DEDICATED POST-VISUALIZATION CALIPER SIZING WINDOW MODAL
          (Triggered ONLY at one optional point: via approve-and-size-painting-btn on Page 4,
           and always uses the Head-On Level Photo for calibration)
         ===================================================================== */}
      {isCaliperSizingModalOpen && activeVariation && (
        <div
          data-testid="caliper-sizing-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Dedicated Post-Visualization Caliper Sizing Window"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F1C18]/75 backdrop-blur-xs p-0 sm:p-4 overflow-hidden"
        >
          <div className="w-full max-w-5xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <ScaleCalibrationPage
              roomImageDataUrl={
                headOnSizingViewpoint?.reimaginedRoomDataUrl ||
                activeViewpoint?.reimaginedRoomDataUrl ||
                activeVariation.reimaginedRoomDataUrl
              }
              roomAngles={displayedAnglesSummary}
              questions={scaleQuestions}
              isLoadingQuestions={isLoadingScaleQuestions}
              scaleRecommendation={liveScaleRecommendation}
              cropBox={
                activeArtPiece?.internalBounds ??
                headOnSizingViewpoint?.activeCropBox ??
                activeViewpoint?.activeCropBox ??
                activeVariation.activeCropBox
              }
              frameDetectionLayerDataUrl={
                headOnSizingViewpoint?.frameDetectionLayerDataUrl ??
                activeViewpoint?.frameDetectionLayerDataUrl ??
                activeVariation.frameDetectionLayerDataUrl
              }
              selectedFrameId={selectedFrameId}
              selectedMatWidthId={selectedMatWidthId}
              artworkTitle={
                activeArtPiece?.title ?? activeVariation.artworkTitle
              }
              headOnPhotoLabel={
                headOnSizingViewpoint?.angleLabel || headOnRoomAngle?.label
              }
              isPostVisualizationModal={true}
              onUpdateQuestionAnswer={handleUpdateScaleQuestionAnswer}
              onUpdateQuestionCaliper={handleUpdateScaleQuestionCaliper}
              onUpdateCropBox={(newBox) => handleCropBoxChange(newBox, '')}
              onCloseSizingModal={() => setIsCaliperSizingModalOpen(false)}
              onSkipScaleAndCreate={() => setIsCaliperSizingModalOpen(false)}
              onApplyScaleAndCreate={handleApplyPostVisualizationScale}
              onBackToCuration={() => setIsCaliperSizingModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          DUAL CHECKOUT & HIGH-RES PRINT MASTER DOWNLOAD MODAL
         ===================================================================== */}
      <AcquirePrintModal
        isOpen={isAcquireModalOpen}
        activeMode={acquireModalMode}
        onClose={() => setIsAcquireModalOpen(false)}
        onModeChange={setAcquireModalMode}
        variation={activeVariation}
        activeArtPieceIndex={effectiveArtPieceIndex}
        onSelectArtPiece={handleSelectArtPiece}
        artworkTitle={
          activeArtPiece?.title ?? activeVariation?.artworkTitle
        }
        croppedScreenshotDataUrl={
          activeViewpoint?.croppedScreenshotDataUrl ??
          activeVariation?.croppedScreenshotDataUrl
        }
        identicalPrintMasterDataUrl={
          activeArtPiece?.identicalPrintMasterDataUrl ??
          activeVariation?.identicalPrintMasterDataUrl
        }
        reimaginedRoomDataUrl={
          activeViewpoint?.reimaginedRoomDataUrl ??
          activeVariation?.reimaginedRoomDataUrl
        }
        scaleRecommendation={effectiveGalleryScaleRecommendation}
        sizeId={selectedSizeId}
        frameId={selectedFrameId}
        matWidthId={selectedMatWidthId}
        matColorId={selectedMatColorId}
        substrateId={selectedSubstrateId}
        partnerId={selectedPartnerId}
        studioMarkupPercent={studioMarkupPercent}
        onSelectSize={handleSelectSize}
        onSelectFrame={handleSelectFrame}
        onSelectMatWidth={handleSelectMatWidth}
        onSelectSubstrate={handleSelectSubstrate}
        onSelectPartner={handleSelectPartner}
        onChangeMarkupPercent={handleChangeMarkupPercent}
        onDownloadCompleted={handleOrderOrDownloadCompleted}
        onOrderCompleted={handleOrderOrDownloadCompleted}
      />
    </div>
  );
};

export default App;
