export {
  type CuratedStylePresetMeta,
  type ComposeRoomReimagineOptions,
  CURATED_STYLE_PRESET_DESCRIPTIONS,
  STYLE_PRESET_DESCRIPTIONS,
  CURATED_STYLE_PRESET_LIST,
  resolveTargetArtPieceCount,
  composeRoomReimaginePrompt,
  composeConsolidatedDeliverablesPrompt,
  composeCuratorialPreAnalysisPrompt,
  composeRoomPreservationCheckPrompt,
  composeArtworkDetectionPrompt,
  composeIdenticalPrintMasterPrompt,
  composeScaleQuestionsPrompt,
  createDefaultAiPromptConfig,
} from './promptComposer';

export {
  type SampleRoomPhoto,
  generateSampleRoomPhotos,
} from './sampleRoomsGenerator';

export {
  type RoomPreservationCheckResult,
  type CuratorialOptionPlan,
  type CuratorialPreAnalysisResult,
  DEFAULT_SCALE_CALIBRATION_QUESTIONS,
  sanitizeNormalizedCropBox,
  extractImageFromOpenRouterResponse,
  cropImageFromDataUrl,
  synthesizeTightFrameDetectionLayerDataUrl,
  refineArtworkOuterFrameBoxInCanvas,
  verifyRoomPreservationWithAi,
  generateScaleQuestionsWithAi,
  computeRecommendedScaleFromMeasurements,
  analyzeRoomForCuratorialOptionsWithAi,
  reimagineRoomWithAi,
  reimagineRoomBatchWithAi,
  regenerateIdenticalPrintFromCrop,
} from './openRouterClient';

export {
  type AtelierWorkflowPageId,
  type ArtPieceCountMode,
  type GeneratedArtPiece,
  type ScaleCalibrationQuestion,
  type ScaleCalibrationResult,
  type AiEngineId,
  type WallPlacementAction,
  type ArtStyleSelectionMode,
  type CuratedArtStylePreset,
  type NormalizedCropBox,
  type RoomAngleAsset,
  type RoomPreservationVerification,
  type ReimaginedRoomViewpoint,
  type AiPromptConfiguration,
  type CuratorialSpaceAnalysis,
  type ReimaginedRoomVariation,
  type AiGenerationStage,
  AI_ENGINE_SPECS,
} from '../../contracts/masterContract';

export * from './promptComposer';
export * from './sampleRoomsGenerator';
export * from './openRouterClient';



