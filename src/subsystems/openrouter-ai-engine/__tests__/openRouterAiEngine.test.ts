import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_ENGINE_SPECS,
  CURATED_STYLE_PRESET_DESCRIPTIONS,
  CURATED_STYLE_PRESET_LIST,
  DEFAULT_SCALE_CALIBRATION_QUESTIONS,
  STYLE_PRESET_DESCRIPTIONS,
  type AiGenerationStage,
  type CuratedArtStylePreset,
  type RoomAngleAsset,
  composeArtworkDetectionPrompt,
  composeIdenticalPrintMasterPrompt,
  composeRoomPreservationCheckPrompt,
  composeRoomReimaginePrompt,
  composeScaleQuestionsPrompt,
  computeRecommendedScaleFromMeasurements,
  createDefaultAiPromptConfig,
  cropImageFromDataUrl,
  extractImageFromOpenRouterResponse,
  generateSampleRoomPhotos,
  generateScaleQuestionsWithAi,
  regenerateIdenticalPrintFromCrop,
  reimagineRoomWithAi,
  resolveTargetArtPieceCount,
  sanitizeNormalizedCropBox,
  verifyRoomPreservationWithAi,
} from '../index';

describe('V2, V2.1, V2.2 & V2.4 Subsystem 1: openrouter-ai-engine', () => {
  describe('Contract & AI_ENGINE_SPECS verification', () => {
    it('maps Astra and Gemini Argon to exact OpenRouter model identifiers', () => {
      expect(AI_ENGINE_SPECS.astra).toBeDefined();
      expect(AI_ENGINE_SPECS.astra.id).toBe('astra');
      expect(AI_ENGINE_SPECS.astra.label).toBe('Astra');
      expect(AI_ENGINE_SPECS.astra.visionModelId).toBe('openai/gpt-6-astra');
      expect(AI_ENGINE_SPECS.astra.imageModelId).toBe('google/gemini-nano-banana-2.1');

      expect(AI_ENGINE_SPECS['gemini-argon']).toBeDefined();
      expect(AI_ENGINE_SPECS['gemini-argon'].id).toBe('gemini-argon');
      expect(AI_ENGINE_SPECS['gemini-argon'].label).toBe('Gemini Argon');
      expect(AI_ENGINE_SPECS['gemini-argon'].visionModelId).toBe('google/gemini-4-argon');
      expect(AI_ENGINE_SPECS['gemini-argon'].imageModelId).toBe('google/gemini-nano-banana-2.1');
    });

    it('exports all 16 CuratedArtStylePreset descriptions, STYLE_PRESET_DESCRIPTIONS, and list metadata ([SPEC PATCH #24])', () => {
      const expectedPresets: CuratedArtStylePreset[] = [
        'impasto-oil',
        'minimalist-abstract',
        'warm-midcentury',
        'wabi-sabi-plaster',
        'impressionist-landscape',
        'bauhaus-geometric',
        'botanical-ink',
        'rothko-colorfield',
        'nordic-monochrome',
        'mediterranean-fresco',
        'contemporary-figurative',
        'japanese-woodblock',
        'sculptural-paper-relief',
        'abstract-expressionist',
        'classical-still-life',
        'desert-earth-strata',
      ];

      expect(CURATED_STYLE_PRESET_LIST).toHaveLength(16);
      expect(STYLE_PRESET_DESCRIPTIONS).toBe(CURATED_STYLE_PRESET_DESCRIPTIONS);
      for (const presetId of expectedPresets) {
        const meta = CURATED_STYLE_PRESET_DESCRIPTIONS[presetId];
        expect(meta).toBeDefined();
        expect(STYLE_PRESET_DESCRIPTIONS[presetId]).toBe(meta);
        expect(meta.id).toBe(presetId);
        expect(meta.label.length).toBeGreaterThan(2);
        expect(meta.promptDescriptor.length).toBeGreaterThan(15);
        expect(meta.samplePaletteHex).toHaveLength(4);
      }
    });
  });

  describe('Prompt Composition & V2.1 Preservation Mandates (promptComposer)', () => {
    it('composes distinct room reimagining prompts for add-only, replace-existing, and both ([SPEC PATCH #14])', () => {
      const addOnlyPrompt = composeRoomReimaginePrompt({
        placementAction: 'add-only',
        styleMode: 'ai-curated',
        stylePreset: 'impasto-oil',
        customStyleNote: '',
      });
      const replacePrompt = composeRoomReimaginePrompt({
        placementAction: 'replace-existing',
        styleMode: 'ai-curated',
        stylePreset: 'impasto-oil',
        customStyleNote: '',
      });
      const bothPrompt = composeRoomReimaginePrompt({
        placementAction: 'both',
        styleMode: 'ai-curated',
        stylePreset: 'impasto-oil',
        customStyleNote: '',
      });

      expect(addOnlyPrompt).toContain('ADD ART TO OPEN WALL ONLY');
      expect(addOnlyPrompt).toContain('Preserve all existing room decor');
      expect(replacePrompt).toContain('REPLACE EXISTING WALL ART');
      expect(replacePrompt).toContain('Replace any existing wall art, frames, or posters');
      expect(bothPrompt).toContain('BOTH REPLACE EXISTING ART & ADD NEW ART TO BLANK WALLS');
      expect(bothPrompt).toContain('BOTH replace any existing wall art/frames');
    });

    it('mandates strict furniture & room dimension preservation and pre-output self-check ([SPEC PATCH #12])', () => {
      const prompt = composeRoomReimaginePrompt({
        placementAction: 'add-only',
        styleMode: 'ai-curated',
        stylePreset: 'impasto-oil',
        customStyleNote: '',
      });

      expect(prompt).toContain('NON-NEGOTIABLE ROOM & FURNITURE PRESERVATION MANDATE');
      expect(prompt).toContain('STRICTLY NOT ALLOWED TO REMOVE OR ALTER FURNITURE');
      expect(prompt).toContain('STRICTLY NOT ALLOWED TO CHANGE ROOM DIMENSIONS');
      expect(prompt).toContain('MANDATORY PRE-OUTPUT SELF-VERIFICATION CHECK');
    });

    it('incorporates placementLocationNote, additionalUserDetails, angleLabel, and correctionInstructions ([SPEC PATCH #14 & #16])', () => {
      const prompt = composeRoomReimaginePrompt(
        {
          placementAction: 'both',
          placementLocationNote: 'Centered above the sofa and on the left return wall',
          styleMode: 'ai-curated',
          stylePreset: 'impasto-oil',
          customStyleNote: '',
          additionalUserDetails: 'Use warm ochre and raw linen undertones with a slim oak frame',
        },
        {
          variationIndex: 1,
          angleLabel: 'Angle 2 (Side Perspective)',
          angleIndex: 1,
          totalAngles: 2,
          correctionInstructions: 'Restore the floor lamp on the left side of the sofa.',
        }
      );

      expect(prompt).toContain('EXPECTED PLACEMENT LOCATION');
      expect(prompt).toContain('Centered above the sofa and on the left return wall');
      expect(prompt).toContain('ADDITIONAL USER DETAILS & PREFERENCES');
      expect(prompt).toContain('Use warm ochre and raw linen undertones with a slim oak frame');
      expect(prompt).toContain('MULTI-ANGLE VIEWPOINT CONTEXT (Angle 2 (Side Perspective)');
      expect(prompt).toContain('CRITICAL CORRECTION FROM PRIOR VERIFICATION CHECK');
      expect(prompt).toContain('Restore the floor lamp on the left side of the sofa.');
      expect(prompt).toContain('CURATORIAL VARIATION #2');
    });

    it('composes prompts for ai-curated vs all 16 specific-style presets, customStyleNote, and variationIndex', () => {
      const aiCuratedWithNote = composeRoomReimaginePrompt(
        {
          placementAction: 'add-only',
          styleMode: 'ai-curated',
          stylePreset: 'impasto-oil',
          customStyleNote: 'oversized horizontal canvas with warm ochre leaf',
        },
        0
      );
      expect(aiCuratedWithNote).toContain('AI AUTO-CURATED TO ROOM');
      expect(aiCuratedWithNote).toContain('oversized horizontal canvas with warm ochre leaf');
      expect(aiCuratedWithNote).not.toContain('CURATORIAL VARIATION #');

      const allPresets: CuratedArtStylePreset[] = [
        'impasto-oil',
        'minimalist-abstract',
        'warm-midcentury',
        'wabi-sabi-plaster',
        'impressionist-landscape',
        'bauhaus-geometric',
        'botanical-ink',
        'rothko-colorfield',
        'nordic-monochrome',
        'mediterranean-fresco',
        'contemporary-figurative',
        'japanese-woodblock',
        'sculptural-paper-relief',
        'abstract-expressionist',
        'classical-still-life',
        'desert-earth-strata',
      ];

      for (const preset of allPresets) {
        const meta = CURATED_STYLE_PRESET_DESCRIPTIONS[preset];
        const specificPrompt = composeRoomReimaginePrompt(
          {
            placementAction: 'replace-existing',
            styleMode: 'specific-style',
            stylePreset: preset,
            customStyleNote: 'deep walnut frame harmony',
          },
          2
        );
        expect(specificPrompt).toContain(`SPECIFIC CURATED STYLE — ${meta.label}`);
        expect(specificPrompt).toContain(meta.promptDescriptor);
        expect(specificPrompt).toContain('deep walnut frame harmony');
        expect(specificPrompt).toContain('CURATORIAL VARIATION #3');
      }
    });

    it('composes preservation check prompt, artwork detection prompt, and identical 1:1 print master prompt', () => {
      const preservationPrompt = composeRoomPreservationCheckPrompt({
        placementAction: 'both',
        placementLocationNote: 'Centered above the walnut credenza',
        angleLabel: 'Angle 1 (Main Wall)',
      });
      expect(preservationPrompt).toContain('Compare Image 1 (Original Uploaded Room Photo) and Image 2');
      expect(preservationPrompt).toContain('furniture_preserved');
      expect(preservationPrompt).toContain('room_dimensions_preserved');
      expect(preservationPrompt).toContain('only_difference_is_wall_art');
      expect(preservationPrompt).toContain('Centered above the walnut credenza');

      const addDetection = composeArtworkDetectionPrompt('add-only');
      const replaceDetection = composeArtworkDetectionPrompt('replace-existing');
      const bothDetection = composeArtworkDetectionPrompt('both');

      expect(addDetection).toContain('newly added primary fine-art painting');
      expect(replaceDetection).toContain('newly replaced primary fine-art painting');
      expect(bothDetection).toContain('newly added or replaced fine-art painting');
      expect(addDetection).toContain('"artwork_bbox_normalized": [ymin, xmin, ymax, xmax]');

      const printMasterPrompt = composeIdenticalPrintMasterPrompt({
        artworkTitle: 'Golden Terracotta Horizon',
        artworkDescription: 'Impasto palette knife strokes in burnt sienna and raw linen',
        styleMode: 'specific-style',
        stylePreset: 'impasto-oil',
      });

      expect(printMasterPrompt).toContain('STRICT 1:1 IDENTICAL FINE-ART PRINT MASTER RECONSTRUCTION');
      expect(printMasterPrompt).toContain('Golden Terracotta Horizon');
      expect(printMasterPrompt).toContain('Impasto palette knife strokes');
      expect(printMasterPrompt).toContain('Impasto Oil');
      expect(printMasterPrompt).toContain('perspective-rectified, borderless, frame-free');
    });

    it('creates default AI prompt config with V2.1 fields and pre-populated editablePromptText', () => {
      const defaultCfg = createDefaultAiPromptConfig();
      expect(defaultCfg.engineId).toBe('astra');
      expect(defaultCfg.placementAction).toBe('add-only');
      expect(defaultCfg.placementLocationNote).toBe('');
      expect(defaultCfg.additionalUserDetails).toBe('');
      expect(defaultCfg.styleMode).toBe('ai-curated');
      expect(defaultCfg.isPromptManuallyEdited).toBe(false);
      expect(defaultCfg.editablePromptText).toContain('ADD ART TO OPEN WALL ONLY');

      const customCfg = createDefaultAiPromptConfig({
        engineId: 'gemini-argon',
        placementAction: 'both',
        placementLocationNote: 'Above the sofa',
        additionalUserDetails: 'Minimalist warm earth tones',
        styleMode: 'specific-style',
        stylePreset: 'bauhaus-geometric',
      });
      expect(customCfg.engineId).toBe('gemini-argon');
      expect(customCfg.placementAction).toBe('both');
      expect(customCfg.placementLocationNote).toBe('Above the sofa');
      expect(customCfg.additionalUserDetails).toBe('Minimalist warm earth tones');
      expect(customCfg.editablePromptText).toContain('BOTH REPLACE EXISTING ART & ADD NEW ART');
      expect(customCfg.editablePromptText).toContain('Above the sofa');
      expect(customCfg.editablePromptText).toContain('Minimalist warm earth tones');
      expect(customCfg.editablePromptText).toContain('Bauhaus Geometric');
    });
  });

  describe('Sample Room Photos Generator with Multi-Angle Support ([SPEC PATCH #15])', () => {
    it('generates 3 sample room photos with valid data:image/ URLs, >=2 angles per room, and both add/replace scenarios', () => {
      const sampleRooms = generateSampleRoomPhotos();
      expect(sampleRooms).toHaveLength(3);

      for (const room of sampleRooms) {
        expect(room.id.length).toBeGreaterThan(3);
        expect(room.name.length).toBeGreaterThan(3);
        expect(room.subtitle.length).toBeGreaterThan(3);
        expect(room.dataUrl.startsWith('data:image/')).toBe(true);
        expect(Array.isArray(room.angles)).toBe(true);
        expect(room.angles.length).toBeGreaterThanOrEqual(2);
        expect(room.angles[0].label).toContain('Angle 1');
        expect(room.angles[1].label).toContain('Angle 2');
        expect(room.angles[0].dataUrl.startsWith('data:image/')).toBe(true);
        expect(room.angles[1].dataUrl.startsWith('data:image/')).toBe(true);
      }

      const withExistingArt = sampleRooms.filter((r) => r.hasExistingWallArt);
      const withoutExistingArt = sampleRooms.filter((r) => !r.hasExistingWallArt);

      expect(withExistingArt.length).toBeGreaterThanOrEqual(1);
      expect(withoutExistingArt.length).toBeGreaterThanOrEqual(1);
      expect(withExistingArt[0].suggestedPlacementAction).toBe('replace-existing');
      expect(withoutExistingArt[0].suggestedPlacementAction).toBe('add-only');
    });
  });

  describe('Bounding Box Sanitization & Multimodal Response Parsing (openRouterClient)', () => {
    it('sanitizes array and object crop boxes, scales (0,1] floats, swaps inverted coords, and enforces min span', () => {
      expect(sanitizeNormalizedCropBox([150, 280, 580, 720])).toEqual({
        ymin: 150,
        xmin: 280,
        ymax: 580,
        xmax: 720,
      });

      expect(
        sanitizeNormalizedCropBox({ ymin: 200, xmin: 300, ymax: 600, xmax: 750 })
      ).toEqual({
        ymin: 200,
        xmin: 300,
        ymax: 600,
        xmax: 750,
      });

      expect(sanitizeNormalizedCropBox([0.18, 0.25, 0.62, 0.75])).toEqual({
        ymin: 180,
        xmin: 250,
        ymax: 620,
        xmax: 750,
      });

      expect(sanitizeNormalizedCropBox([700, 850, 120, -40])).toEqual({
        ymin: 120,
        xmin: 0,
        ymax: 700,
        xmax: 850,
      });

      const tinyBox = sanitizeNormalizedCropBox([400, 500, 410, 505]);
      expect(tinyBox.ymax - tinyBox.ymin).toBeGreaterThanOrEqual(80);
      expect(tinyBox.xmax - tinyBox.xmin).toBeGreaterThanOrEqual(80);

      expect(sanitizeNormalizedCropBox(null)).toEqual({
        ymin: 160,
        xmin: 310,
        ymax: 560,
        xmax: 690,
      });
      expect(sanitizeNormalizedCropBox([0, 0, 0, 0])).toEqual({
        ymin: 160,
        xmin: 310,
        ymax: 560,
        xmax: 690,
      });
      expect(sanitizeNormalizedCropBox(['invalid', 100, 200, 300])).toEqual({
        ymin: 160,
        xmin: 310,
        ymax: 560,
        xmax: 690,
      });
    });

    it('extracts generated images across all OpenRouter multimodal response shapes', () => {
      const shape1 = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Here is your reimagined room.',
              images: [
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
                  },
                },
              ],
            },
          },
        ],
      };
      expect(extractImageFromOpenRouterResponse(shape1)).toBe(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'
      );

      const shape2 = {
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'Synthesized print master:' },
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
                  },
                },
              ],
            },
          },
        ],
      };
      expect(extractImageFromOpenRouterResponse(shape2)).toBe(
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
      );

      const shape3 = {
        choices: [
          {
            message: {
              content:
                'Generated image: ![Reimagined](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=)',
            },
          },
        ],
      };
      expect(extractImageFromOpenRouterResponse(shape3)).toBe(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
      );

      expect(extractImageFromOpenRouterResponse(null)).toBeNull();
      expect(extractImageFromOpenRouterResponse({ choices: [] })).toBeNull();
    });

    it('crops an image data URL deterministically in JSDOM', async () => {
      const sampleRooms = generateSampleRoomPhotos();
      const cropped = await cropImageFromDataUrl(sampleRooms[0].dataUrl, {
        ymin: 150,
        xmin: 250,
        ymax: 550,
        xmax: 750,
      });

      expect(cropped.dataUrl.startsWith('data:image/')).toBe(true);
      expect(cropped.widthPx).toBeGreaterThanOrEqual(64);
      expect(cropped.heightPx).toBeGreaterThanOrEqual(64);
    });
  });

  describe('V2.1 Closed-Loop Preservation Check, Auto-Retry & Multi-Angle Pipeline', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('verifies room preservation by sending BOTH originalRoomDataUrl and candidateReimaginedDataUrl to the vision judge ([SPEC PATCH #13])', async () => {
      let capturedBody: Record<string, unknown> = {};

      globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    furniture_preserved: true,
                    room_dimensions_preserved: true,
                    only_difference_is_wall_art: true,
                    discrepancies_found: '',
                    correction_instructions: '',
                    room_style: 'Sunlit Nordic Salon',
                    artwork_bbox_normalized: [170, 310, 550, 690],
                    artwork_title: 'Linen & Ochre Study I',
                    artwork_description: 'Tactile oil study in warm neutrals',
                  }),
                },
              },
            ],
          }),
        } as Response;
      });

      const result = await verifyRoomPreservationWithAi({
        originalRoomDataUrl: 'data:image/png;base64,ORIGINAL_ROOM_IMG',
        candidateReimaginedDataUrl: 'data:image/png;base64,CANDIDATE_REIMAGINED_IMG',
        engineId: 'astra',
        placementAction: 'add-only',
        placementLocationNote: 'Centered above the bouclé sofa',
        angleLabel: 'Angle 1 (Main Wall)',
      });

      expect(capturedBody.model).toBe('openai/gpt-6-astra');
      const messages = capturedBody.messages as Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
      const imageParts = messages[0].content.filter((c) => c.type === 'image_url');
      expect(imageParts).toHaveLength(2);
      expect(imageParts[0].image_url?.url).toBe('data:image/png;base64,ORIGINAL_ROOM_IMG');
      expect(imageParts[1].image_url?.url).toBe('data:image/png;base64,CANDIDATE_REIMAGINED_IMG');

      expect(result.verification.passed).toBe(true);
      expect(result.verification.furniturePreserved).toBe(true);
      expect(result.verification.roomDimensionsPreserved).toBe(true);
      expect(result.verification.onlyArtChanged).toBe(true);
      expect(result.verification.verifierModelId).toBe('openai/gpt-6-astra');
      expect(result.detectedCropBox).toEqual({
        ymin: 170,
        xmin: 310,
        ymax: 550,
        xmax: 690,
      });
    });

    it('executes the V2.1 pipeline for Astra with verifying-room-preservation stage', async () => {
      const stagesVisited: AiGenerationStage[] = [];
      const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

      const mockReimaginedUrl = 'data:image/png;base64,STAGE1_REIMAGINED_ROOM_IMAGE';
      const mockPrintMasterUrl = 'data:image/png;base64,STAGE3_IDENTICAL_PRINT_MASTER';

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
        fetchCalls.push({ url, body });

        // Call 1: Stage 1 Reimagine Room
        if (fetchCalls.length === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    images: [{ image_url: { url: mockReimaginedUrl } }],
                  },
                },
              ],
            }),
          } as Response;
        }

        // Call 2: Stage 2 Preservation Check + Vision Detection via openai/gpt-6-astra
        if (fetchCalls.length === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      furniture_preserved: true,
                      room_dimensions_preserved: true,
                      only_difference_is_wall_art: true,
                      discrepancies_found: '',
                      correction_instructions: '',
                      room_style: 'Warm Nordic Minimalist Salon',
                      artwork_bbox_normalized: [180, 320, 540, 680],
                      artwork_title: 'Ochre & Sienna Horizon III',
                      artwork_description: 'Sculptural impasto oil study in warm earth tones',
                    }),
                  },
                },
              ],
            }),
          } as Response;
        }

        // Call 3: Stage 3 Identical Print Master
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  images: [{ image_url: { url: mockPrintMasterUrl } }],
                },
              },
            ],
          }),
        } as Response;
      });

      const config = createDefaultAiPromptConfig({
        engineId: 'astra',
        placementAction: 'add-only',
        styleMode: 'specific-style',
        stylePreset: 'impasto-oil',
      });

      const variation = await reimagineRoomWithAi({
        roomImageDataUrl: 'data:image/png;base64,ORIGINAL_ROOM_PHOTO',
        config,
        variationIndex: 0,
        onStageChange: (stage) => stagesVisited.push(stage),
      });

      expect(stagesVisited).toEqual([
        'reimagining-room',
        'sprinkling-magic',
        'verifying-room-preservation',
        'detecting-and-cropping-art',
        'generating-identical-print',
        'completed',
      ]);

      expect(fetchCalls).toHaveLength(3);
      expect(fetchCalls[0].url).toBe('/api/openrouter/chat');
      expect(fetchCalls[0].body.model).toBe('google/gemini-nano-banana-2.1');
      expect(fetchCalls[1].body.model).toBe('openai/gpt-6-astra');
      expect(fetchCalls[2].body.model).toBe('google/gemini-nano-banana-2.1');

      expect(variation.engineId).toBe('astra');
      expect(variation.reimaginedRoomDataUrl).toBe(mockReimaginedUrl);
      expect(variation.identicalPrintMasterDataUrl).toBe(mockPrintMasterUrl);
      expect(variation.preservationVerification).toBeDefined();
      expect(variation.preservationVerification?.passed).toBe(true);
      expect(variation.preservationVerification?.attemptsUsed).toBe(1);
      expect(variation.viewpoints).toHaveLength(1);
    });

    it('automatically retries room generation with correction_instructions when first preservation check fails ([SPEC PATCH #13])', async () => {
      const stagesVisited: AiGenerationStage[] = [];
      const fetchCalls: Array<{ model: string; body: Record<string, unknown> }> = [];

      globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
        fetchCalls.push({ model: String(body.model), body });

        // Call 1: Attempt 1 Image Generation
        if (fetchCalls.length === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    images: [{ image_url: { url: 'data:image/png;base64,CANDIDATE_ATTEMPT_1_BAD' } }],
                  },
                },
              ],
            }),
          } as Response;
        }

        // Call 2: Attempt 1 Preservation Check -> FAILS (furniture_preserved: false)
        if (fetchCalls.length === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      furniture_preserved: false,
                      room_dimensions_preserved: true,
                      only_difference_is_wall_art: false,
                      discrepancies_found: 'The ceramic floor lamp next to the sofa was removed.',
                      correction_instructions: 'Keep the ceramic floor lamp on the left of the sofa 100% intact.',
                      room_style: 'Mid-Century Study',
                      artwork_bbox_normalized: [180, 320, 540, 680],
                      artwork_title: 'Draft Study',
                      artwork_description: 'Draft description',
                    }),
                  },
                },
              ],
            }),
          } as Response;
        }

        // Call 3: Attempt 2 Retry Image Generation with correction_instructions
        if (fetchCalls.length === 3) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    images: [{ image_url: { url: 'data:image/png;base64,CANDIDATE_ATTEMPT_2_FIXED' } }],
                  },
                },
              ],
            }),
          } as Response;
        }

        // Call 4: Attempt 2 Preservation Check -> PASSES
        if (fetchCalls.length === 4) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      furniture_preserved: true,
                      room_dimensions_preserved: true,
                      only_difference_is_wall_art: true,
                      discrepancies_found: '',
                      correction_instructions: '',
                      room_style: 'Mid-Century Study',
                      artwork_bbox_normalized: [190, 310, 550, 690],
                      artwork_title: 'Preserved Room Masterpiece',
                      artwork_description: 'Warm walnut & terracotta geometric study',
                    }),
                  },
                },
              ],
            }),
          } as Response;
        }

        // Call 5: Final Identical Print Master
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  images: [{ image_url: { url: 'data:image/png;base64,FINAL_PRINT_MASTER' } }],
                },
              },
            ],
          }),
        } as Response;
      });

      const config = createDefaultAiPromptConfig({
        engineId: 'gemini-argon',
        placementAction: 'replace-existing',
      });

      const variation = await reimagineRoomWithAi({
        roomImageDataUrl: 'data:image/png;base64,ORIGINAL_STUDY',
        config,
        onStageChange: (stage) => stagesVisited.push(stage),
      });

      expect(fetchCalls).toHaveLength(5);
      // Verify Call 3 included the correction instructions from Call 2
      const retryMessages = fetchCalls[2].body.messages as Array<{ role: string; content: unknown }>;
      const retryUserContent = JSON.stringify(retryMessages[1].content);
      expect(retryUserContent).toContain('Keep the ceramic floor lamp on the left of the sofa 100% intact.');

      expect(stagesVisited).toEqual([
        'reimagining-room',
        'sprinkling-magic',
        'verifying-room-preservation',
        'reimagining-room',
        'verifying-room-preservation',
        'detecting-and-cropping-art',
        'generating-identical-print',
        'completed',
      ]);

      expect(variation.reimaginedRoomDataUrl).toBe('data:image/png;base64,CANDIDATE_ATTEMPT_2_FIXED');
      expect(variation.preservationVerification?.passed).toBe(true);
      expect(variation.preservationVerification?.attemptsUsed).toBe(2);
      expect(variation.artworkTitle).toBe('Preserved Room Masterpiece');
    });

    it('processes multi-angle room uploads and returns viewpoints for every angle ([SPEC PATCH #15])', async () => {
      let callIndex = 0;

      globalThis.fetch = vi.fn(async () => {
        callIndex += 1;
        // Calls 1 & 3 are image generations for Angle 1 and Angle 2; Call 5 is print master
        if (callIndex === 1 || callIndex === 3 || callIndex === 5) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    images: [
                      {
                        image_url: {
                          url: `data:image/png;base64,GENERATED_IMG_CALL_${callIndex}`,
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          } as Response;
        }

        // Calls 2 & 4 are preservation checks for Angle 1 and Angle 2
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    furniture_preserved: true,
                    room_dimensions_preserved: true,
                    only_difference_is_wall_art: true,
                    discrepancies_found: '',
                    correction_instructions: '',
                    room_style: 'Multi-Angle Gallery Salon',
                    artwork_bbox_normalized: callIndex === 2 ? [160, 300, 540, 700] : [180, 360, 520, 740],
                    artwork_title: 'Multi-Angle Harmony I',
                    artwork_description: 'Coordinated multi-viewpoint painting',
                  }),
                },
              },
            ],
          }),
        } as Response;
      });

      const roomAngles: RoomAngleAsset[] = [
        {
          id: 'angle-main',
          label: 'Angle 1 (Main Wall)',
          dataUrl: 'data:image/png;base64,ANGLE_1_ORIGINAL',
        },
        {
          id: 'angle-side',
          label: 'Angle 2 (Side Perspective)',
          dataUrl: 'data:image/png;base64,ANGLE_2_ORIGINAL',
        },
      ];

      const config = createDefaultAiPromptConfig({
        engineId: 'astra',
        placementAction: 'both',
        placementLocationNote: 'Centered above the sofa',
      });

      const variation = await reimagineRoomWithAi({
        roomImageDataUrl: roomAngles[0].dataUrl,
        roomAngles,
        config,
      });

      expect(variation.viewpoints).toBeDefined();
      expect(variation.viewpoints).toHaveLength(2);
      expect(variation.activeViewpointIndex).toBe(0);

      const vp1 = variation.viewpoints![0];
      const vp2 = variation.viewpoints![1];

      expect(vp1.angleId).toBe('angle-main');
      expect(vp1.angleLabel).toBe('Angle 1 (Main Wall)');
      expect(vp1.reimaginedRoomDataUrl).toBe('data:image/png;base64,GENERATED_IMG_CALL_1');
      expect(vp1.preservationVerification.passed).toBe(true);
      expect(vp1.croppedScreenshotDataUrl.startsWith('data:image/')).toBe(true);

      expect(vp2.angleId).toBe('angle-side');
      expect(vp2.angleLabel).toBe('Angle 2 (Side Perspective)');
      expect(vp2.reimaginedRoomDataUrl).toBe('data:image/png;base64,GENERATED_IMG_CALL_3');
      expect(vp2.preservationVerification.passed).toBe(true);
      expect(vp2.detectedCropBox).toEqual({
        ymin: 180,
        xmin: 360,
        ymax: 520,
        xmax: 740,
      });
    });

    it('regenerates an identical print master when the user adjusts the crop box', async () => {
      const stages: AiGenerationStage[] = [];
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  images: [
                    {
                      image_url: {
                        url: 'data:image/png;base64,REGENERATED_CUSTOM_CROP_MASTER',
                      },
                    },
                  ],
                },
              },
            ],
          }),
        } as Response;
      });

      const regenerated = await regenerateIdenticalPrintFromCrop({
        reimaginedRoomDataUrl: 'data:image/png;base64,REIMAGINED_ROOM',
        cropBox: { ymin: 140, xmin: 260, ymax: 590, xmax: 740 },
        engineId: 'astra',
        artworkTitle: 'Custom Crop Study',
        artworkDescription: 'Refined gallery crop',
        onStageChange: (stage) => stages.push(stage),
      });

      expect(stages).toEqual([
        'detecting-and-cropping-art',
        'generating-identical-print',
        'completed',
      ]);
      expect(regenerated.croppedScreenshotDataUrl.startsWith('data:image/')).toBe(true);
      expect(regenerated.identicalPrintMasterDataUrl).toBe(
        'data:image/png;base64,REGENERATED_CUSTOM_CROP_MASTER'
      );
      expect(regenerated.printMasterWidthPx).toBeGreaterThanOrEqual(1800);
      expect(regenerated.printMasterHeightPx).toBeGreaterThanOrEqual(1800);
    });

    it('gracefully falls back to deterministic SVG data URLs when fetch rejects or is offline', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Network offline');
      });

      const config = createDefaultAiPromptConfig({
        engineId: 'astra',
        placementAction: 'add-only',
        styleMode: 'specific-style',
        stylePreset: 'wabi-sabi-plaster',
      });

      const variation = await reimagineRoomWithAi({
        roomImageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        config,
        variationIndex: 1,
      });

      expect(variation.reimaginedRoomDataUrl.startsWith('data:image/')).toBe(true);
      expect(variation.croppedScreenshotDataUrl.startsWith('data:image/')).toBe(true);
      expect(variation.identicalPrintMasterDataUrl.startsWith('data:image/')).toBe(true);
      expect(variation.preservationVerification?.passed).toBe(true);
      expect(variation.detectedCropBox).toEqual({
        ymin: 160,
        xmin: 310,
        ymax: 560,
        xmax: 690,
      });
    });

    it('resolves target art piece count accurately for explicit modes and auto-multi-wall notes ([SPEC PATCH #19])', () => {
      expect(resolveTargetArtPieceCount({ artPieceCountMode: 'single-piece' })).toBe(1);
      expect(resolveTargetArtPieceCount({ artPieceCountMode: 'multi-piece-pair' })).toBe(2);
      expect(resolveTargetArtPieceCount({ artPieceCountMode: 'multi-piece-trio' })).toBe(3);

      expect(
        resolveTargetArtPieceCount({
          artPieceCountMode: 'auto-multi-wall',
          placementLocationNote: 'Place two pieces on both walls',
        })
      ).toBe(2);

      expect(
        resolveTargetArtPieceCount({
          artPieceCountMode: 'auto-multi-wall',
          placementAction: 'both',
        })
      ).toBe(2);

      expect(
        resolveTargetArtPieceCount({
          artPieceCountMode: 'auto-multi-wall',
          additionalUserDetails: 'Create a coordinated trio of three botanical studies',
        })
      ).toBe(3);

      expect(
        resolveTargetArtPieceCount({
          artPieceCountMode: 'auto-multi-wall',
          placementAction: 'add-only',
          placementLocationNote: 'Centered above the sofa',
        })
      ).toBe(1);
    });

    it('populates variation.artPieces with 2 items for multi-piece-pair and 3 items for multi-piece-trio ([SPEC PATCH #19])', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Offline test synthesis');
      });

      const pairConfig = createDefaultAiPromptConfig({
        engineId: 'astra',
        artPieceCountMode: 'multi-piece-pair',
      });

      const pairVariation = await reimagineRoomWithAi({
        roomImageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        config: pairConfig,
      });

      expect(pairVariation.artPieces).toBeDefined();
      expect(pairVariation.artPieces).toHaveLength(2);
      for (const piece of pairVariation.artPieces!) {
        expect(piece.identicalPrintMasterDataUrl.startsWith('data:image/')).toBe(true);
        expect(piece.title.length).toBeGreaterThan(2);
        expect(piece.wallLocationLabel.length).toBeGreaterThan(2);
      }

      const trioConfig = createDefaultAiPromptConfig({
        engineId: 'gemini-argon',
        artPieceCountMode: 'multi-piece-trio',
      });

      const trioVariation = await reimagineRoomWithAi({
        roomImageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        config: trioConfig,
      });

      expect(trioVariation.artPieces).toBeDefined();
      expect(trioVariation.artPieces).toHaveLength(3);
      for (const piece of trioVariation.artPieces!) {
        expect(piece.identicalPrintMasterDataUrl.startsWith('data:image/')).toBe(true);
        expect(piece.title.length).toBeGreaterThan(2);
        expect(piece.wallLocationLabel.length).toBeGreaterThan(2);
      }
    });

    it('emits sprinkling-magic and ensures statusText and verification summaryNote contain zero forbidden technical tokens ([SPEC PATCH #18])', async () => {
      const stagesVisited: AiGenerationStage[] = [];
      const emittedStatusTexts: string[] = [];

      globalThis.fetch = vi.fn(async () => {
        throw new Error('Offline test synthesis');
      });

      const config = createDefaultAiPromptConfig({
        engineId: 'astra',
      });

      const variation = await reimagineRoomWithAi({
        roomImageDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        config,
        onStageChange: (stage, statusText) => {
          stagesVisited.push(stage);
          emittedStatusTexts.push(statusText);
        },
      });

      expect(stagesVisited).toContain('sprinkling-magic');

      const forbiddenTokens = [
        'cropping screenshot',
        'bounding box',
        'BBox',
        '2nd-Prompt',
        'openai/gpt-6-astra',
      ];

      const summaryNote = variation.preservationVerification?.summaryNote ?? '';
      for (const forbidden of forbiddenTokens) {
        const regex = new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        for (const statusText of emittedStatusTexts) {
          expect(statusText).not.toMatch(regex);
        }
        expect(summaryNote).not.toMatch(regex);
      }
    });

    it('composes scale questions prompt and generates custom or fallback 3-question calibration list ([SPEC PATCH #25])', async () => {
      const promptWithLocation = composeScaleQuestionsPrompt('Centered above the oak credenza');
      expect(promptWithLocation).toContain('Centered above the oak credenza');
      expect(promptWithLocation).toContain('"questions"');

      // 1. Custom 3-question JSON when OpenRouter responds
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    questions: [
                      {
                        id: 'reference-furniture-width',
                        questionText: 'How wide is the oak credenza below the main wall?',
                        helperText: 'Measure end-to-end across the credenza top.',
                        unitLabel: 'inches',
                        placeholder: '72',
                        suggestedQuickValuesInches: [
                          { label: '60" Credenza', valueInches: 60 },
                          { label: '72" Credenza', valueInches: 72 },
                        ],
                      },
                      {
                        id: 'target-wall-width',
                        questionText: 'What is the width of the open wall panel?',
                        helperText: 'Measure horizontal wall width.',
                        unitLabel: 'inches',
                        placeholder: '110',
                        suggestedQuickValuesInches: [{ label: '9 ft (108")', valueInches: 108 }],
                      },
                      {
                        id: 'ceiling-height',
                        questionText: 'What is the floor-to-ceiling height?',
                        helperText: 'Standard rooms are 96" to 108".',
                        unitLabel: 'inches',
                        placeholder: '108',
                        suggestedQuickValuesInches: [{ label: '9 ft (108")', valueInches: 108 }],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        } as Response;
      });

      const customQuestions = await generateScaleQuestionsWithAi({
        roomImageDataUrl: 'data:image/png;base64,ROOM_PHOTO_FOR_SCALE',
        placementLocationNote: 'Centered above the oak credenza',
        engineId: 'astra',
      });

      expect(customQuestions).toHaveLength(3);
      expect(customQuestions[0].id).toBe('reference-furniture-width');
      expect(customQuestions[0].questionText).toContain('oak credenza');
      expect(customQuestions[0].suggestedQuickValuesInches[0].valueInches).toBe(60);

      // 2. Fallback to DEFAULT_SCALE_CALIBRATION_QUESTIONS when roomImageDataUrl is omitted
      const fallbackNoPhoto = await generateScaleQuestionsWithAi({
        roomImageDataUrl: null,
      });
      expect(fallbackNoPhoto).toHaveLength(3);
      expect(fallbackNoPhoto[0].id).toBe(DEFAULT_SCALE_CALIBRATION_QUESTIONS[0].id);
      expect(fallbackNoPhoto[1].id).toBe(DEFAULT_SCALE_CALIBRATION_QUESTIONS[1].id);
      expect(fallbackNoPhoto[2].id).toBe(DEFAULT_SCALE_CALIBRATION_QUESTIONS[2].id);

      // 3. Fallback when fetch rejects
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Network unavailable');
      });
      const fallbackOffline = await generateScaleQuestionsWithAi({
        roomImageDataUrl: 'data:image/png;base64,ROOM_PHOTO_FOR_SCALE',
      });
      expect(fallbackOffline).toHaveLength(3);
      expect(fallbackOffline[0].questionText).toBe(
        DEFAULT_SCALE_CALIBRATION_QUESTIONS[0].questionText
      );
    });

    it('computes accurate PrintSizeId recommendations and dimensions across small, medium, and large room measurements ([SPEC PATCH #25])', () => {
      // Uncalibrated default when no questions are answered
      const uncalibrated = computeRecommendedScaleFromMeasurements({
        questions: DEFAULT_SCALE_CALIBRATION_QUESTIONS.map((q) => ({
          ...q,
          userAnswerInches: null,
        })),
      });
      expect(uncalibrated.isCalibrated).toBe(false);
      expect(uncalibrated.questionsAnsweredCount).toBe(0);
      expect(uncalibrated.recommendedSizeId).toBe('24x36');
      expect(uncalibrated.rationale.length).toBeGreaterThan(20);

      // Small measurements -> '12x16' or '18x24'
      const smallFromFurniture = computeRecommendedScaleFromMeasurements({
        questions: [
          {
            ...DEFAULT_SCALE_CALIBRATION_QUESTIONS[0],
            id: 'reference-furniture-width',
            userAnswerInches: 48,
          },
        ],
      });
      expect(['12x16', '18x24']).toContain(smallFromFurniture.recommendedSizeId);
      expect(smallFromFurniture.isCalibrated).toBe(true);
      expect(smallFromFurniture.questionsAnsweredCount).toBe(1);
      expect(smallFromFurniture.estimatedWallWidthInches).toBeGreaterThan(40);
      expect(smallFromFurniture.estimatedArtworkWidthInches).toBeGreaterThanOrEqual(10);
      expect(smallFromFurniture.estimatedArtworkHeightInches).toBeGreaterThanOrEqual(14);
      expect(smallFromFurniture.rationale).toContain('48"');

      const smallFromWall = computeRecommendedScaleFromMeasurements({
        questions: [
          {
            ...DEFAULT_SCALE_CALIBRATION_QUESTIONS[1],
            id: 'target-wall-width',
            userAnswerInches: 56,
          },
        ],
      });
      expect(['12x16', '18x24']).toContain(smallFromWall.recommendedSizeId);
      expect(smallFromWall.estimatedWallWidthInches).toBe(56);

      // Medium measurements -> '24x36'
      const mediumFromFurniture = computeRecommendedScaleFromMeasurements({
        questions: [
          {
            ...DEFAULT_SCALE_CALIBRATION_QUESTIONS[0],
            id: 'reference-furniture-width',
            userAnswerInches: 78,
          },
        ],
      });
      expect(mediumFromFurniture.recommendedSizeId).toBe('24x36');
      expect(mediumFromFurniture.isCalibrated).toBe(true);
      expect(mediumFromFurniture.questionsAnsweredCount).toBe(1);
      expect(mediumFromFurniture.rationale).toContain('24" × 36"');

      const mediumFromWall = computeRecommendedScaleFromMeasurements({
        questions: [
          {
            ...DEFAULT_SCALE_CALIBRATION_QUESTIONS[1],
            id: 'target-wall-width',
            userAnswerInches: 100,
          },
        ],
      });
      expect(mediumFromWall.recommendedSizeId).toBe('24x36');
      expect(mediumFromWall.estimatedWallWidthInches).toBe(100);

      // Large measurements -> '30x40' or '36x48'
      const largeFromFurniture = computeRecommendedScaleFromMeasurements({
        questions: [
          {
            ...DEFAULT_SCALE_CALIBRATION_QUESTIONS[0],
            id: 'reference-furniture-width',
            userAnswerInches: 108,
          },
          {
            ...DEFAULT_SCALE_CALIBRATION_QUESTIONS[1],
            id: 'target-wall-width',
            userAnswerInches: 144,
          },
        ],
      });
      expect(['30x40', '36x48']).toContain(largeFromFurniture.recommendedSizeId);
      expect(largeFromFurniture.isCalibrated).toBe(true);
      expect(largeFromFurniture.questionsAnsweredCount).toBe(2);
      expect(largeFromFurniture.estimatedWallWidthInches).toBe(144);
      expect(largeFromFurniture.estimatedArtworkWidthInches).toBeGreaterThanOrEqual(28);
      expect(largeFromFurniture.estimatedArtworkHeightInches).toBeGreaterThanOrEqual(32);
      expect(largeFromFurniture.rationale).toContain('108"');
      expect(largeFromFurniture.rationale).toContain('144"');
    });
  });
});
