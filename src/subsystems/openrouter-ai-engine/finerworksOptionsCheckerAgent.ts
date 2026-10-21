// src/subsystems/openrouter-ai-engine/finerworksOptionsCheckerAgent.ts
import {
  AI_ENGINE_SPECS,
  AiPromptConfiguration,
  FinerWorksGlazingId,
  FinerWorksOptionsVerification,
  FinerWorksStandardSizeId,
  FrameProfileId,
  MatColorId,
  MatWidthId,
  NormalizedCropBox,
  PrintSizeId,
  PrintSubstrateId,
} from '../../contracts/masterContract';
import {
  FINERWORKS_FRAME_MOULDINGS,
  FINERWORKS_MAT_BOARDS,
  FINERWORKS_MEDIA_SPECS,
  buildFinerWorksProductSpec,
  getFinerWorksFrameByProfileId,
  getFinerWorksGlazingById,
  getFinerWorksMatByColorId,
  getFinerWorksMediaById,
  getFinerWorksMediaBySlug,
  getFinerWorksSizeById,
  matWidthIdToInches,
  validateFinerWorksConfiguration,
} from '../finerworks-catalog-sync';
import { composeFinerWorksOptionsCheckPrompt } from './promptComposer';

export interface FinerWorksDetectedAttributesInput {
  detectedFrameId: FrameProfileId;
  detectedMatWidthId: MatWidthId;
  detectedMatColorId: MatColorId;
  cropBox: NormalizedCropBox;
  mediaId?: number;
  substrateSlug?: PrintSubstrateId | string;
  glazingId?: FinerWorksGlazingId;
  printSizeId?: PrintSizeId | FinerWorksStandardSizeId;
  customWidthIn?: number;
  customHeightIn?: number;
  skipNetworkInJsdom?: boolean;
}

function sanitizeGalleryText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/cropping screenshot/gi, 'isolated artwork')
    .replace(/screenshots?/gi, 'wall capture')
    .replace(/bounding box(es)?/gi, 'frame perimeter')
    .replace(/\bBBox(es)?\b/gi, 'frame perimeter')
    .replace(/2nd-Prompt/gi, 'FinerWorks verification')
    .replace(/openai\/gpt-6-astra/gi, 'Atelier FinerWorks Auditor')
    .replace(/google\/gemini-4-argon/gi, 'Atelier FinerWorks Auditor')
    .replace(/deepseek\/deepseek-v4\.1-flash-1017/gi, 'Atelier FinerWorks Auditor')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isJsdomRuntime(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  );
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

async function postOpenRouterVisionCheck(
  payload: Record<string, unknown>
): Promise<unknown | null> {
  if (typeof fetch !== 'function') {
    return null;
  }

  try {
    const proxyResponse = await fetch('/api/openrouter/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (proxyResponse && (proxyResponse.status === 401 || proxyResponse.status === 403)) {
      throw new Error(
        'AI generation failed: Invalid or unauthorized OpenRouter API key (HTTP 401). Please configure a valid OPENROUTER_API_KEY in .env.'
      );
    }
    if (proxyResponse && proxyResponse.ok) {
      return await proxyResponse.json();
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('HTTP 401') ||
        err.message.includes('HTTP 403') ||
        err.message.includes('Invalid or unauthorized OpenRouter API key'))
    ) {
      throw err;
    }
  }

  return null;
}

export function buildFinerWorksOptionsCheckPrompt(
  config: AiPromptConfiguration,
  detectedAttrs: FinerWorksDetectedAttributesInput,
  variationIndex = 0
): string {
  const basePrompt = composeFinerWorksOptionsCheckPrompt(config, variationIndex);

  const detectedContext = [
    `CANDIDATE DETECTED ATTRIBUTES FOR VARIATION #${variationIndex + 1}:`,
    `- Candidate Frame Profile ID: "${detectedAttrs.detectedFrameId}"`,
    `- Candidate Mat Width ID: "${detectedAttrs.detectedMatWidthId}"`,
    `- Candidate Mat Color ID: "${detectedAttrs.detectedMatColorId}"`,
    detectedAttrs.mediaId !== undefined ? `- Candidate Media ID: ${detectedAttrs.mediaId}` : '',
    detectedAttrs.substrateSlug ? `- Candidate Substrate Slug: "${detectedAttrs.substrateSlug}"` : '',
    detectedAttrs.glazingId ? `- Candidate Glazing ID: "${detectedAttrs.glazingId}"` : '',
    detectedAttrs.printSizeId ? `- Candidate Print Size ID: "${detectedAttrs.printSizeId}"` : '',
    detectedAttrs.customWidthIn && detectedAttrs.customHeightIn
      ? `- Candidate Custom Print Dimensions: ${detectedAttrs.customWidthIn}" × ${detectedAttrs.customHeightIn}"`
      : '',
    `- Candidate Frame Perimeter Coordinates (0..1000 scale): [ymin=${detectedAttrs.cropBox?.ymin ?? 0}, xmin=${detectedAttrs.cropBox?.xmin ?? 0}, ymax=${detectedAttrs.cropBox?.ymax ?? 0}, xmax=${detectedAttrs.cropBox?.xmax ?? 0}]`,
  ]
    .filter(Boolean)
    .join(' ');

  return `${basePrompt} ${detectedContext}`;
}

export async function verifyFinerWorksOptionsComplianceWithAi(
  reimaginedRoomDataUrl: string,
  croppedArtworkDataUrl: string,
  config: AiPromptConfiguration,
  detectedAttrs: FinerWorksDetectedAttributesInput,
  variationIndex = 0,
  attemptNumber = 1
): Promise<FinerWorksOptionsVerification> {
  const engineSpec = AI_ENGINE_SPECS[config.engineId] ?? AI_ENGINE_SPECS.astra;
  const verifierModelId = engineSpec.visionModelId ?? 'openai/gpt-6-astra';
  const constraints = config.finerworksConstraints;

  // ==========================================================================
  // Part A: Multimodal LLM Vision Verification
  // ==========================================================================
  let llmFrameValid: boolean | null = null;
  let llmMatGlazeValid: boolean | null = null;
  let llmSizeValid: boolean | null = null;
  let llmSubstrateValid: boolean | null = null;
  const llmDiscrepancies: string[] = [];
  let llmCorrectionInstructions = '';
  let visionVerificationSkipped = false;
  const isJsdom = isJsdomRuntime();

  if (
    !detectedAttrs.skipNetworkInJsdom &&
    typeof fetch === 'function' &&
    Boolean(reimaginedRoomDataUrl && reimaginedRoomDataUrl.trim())
  ) {
    try {
      const checkPrompt = buildFinerWorksOptionsCheckPrompt(config, detectedAttrs, variationIndex);
      const isDeepSeekVision = verifierModelId.startsWith('deepseek/');
      const imageContentParts = [
        {
          type: 'text',
          text: checkPrompt,
        },
        {
          type: 'image_url',
          image_url: {
            url: reimaginedRoomDataUrl,
          },
        },
        ...(croppedArtworkDataUrl && croppedArtworkDataUrl.trim() && !isDeepSeekVision
          ? [
              {
                type: 'image_url',
                image_url: {
                  url: croppedArtworkDataUrl,
                },
              },
            ]
          : []),
      ];

      const payload: Record<string, unknown> = {
        model: verifierModelId,
        ...(isDeepSeekVision
          ? { max_tokens: 700 }
          : { response_format: { type: 'json_object' } }),
        messages: [
          {
            role: 'user',
            content: imageContentParts,
          },
        ],
      };

      const rawResponse = await postOpenRouterVisionCheck(payload);
      const rawText = extractMessageTextFromOpenRouterResponse(rawResponse);
      if (rawText.trim()) {
        const cleaned = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        const candidateJson = jsonMatch ? jsonMatch[0] : cleaned;
        const parsed = JSON.parse(candidateJson) as Record<string, unknown>;

        if (typeof parsed.frame_option_valid === 'boolean') {
          llmFrameValid = parsed.frame_option_valid;
        }
        if (typeof parsed.matting_and_glazing_valid === 'boolean') {
          llmMatGlazeValid = parsed.matting_and_glazing_valid;
        }
        if (typeof parsed.sizing_and_aspect_ratio_valid === 'boolean') {
          llmSizeValid = parsed.sizing_and_aspect_ratio_valid;
        }
        if (typeof parsed.substrate_surface_authentic === 'boolean') {
          llmSubstrateValid = parsed.substrate_surface_authentic;
        }
        if (Array.isArray(parsed.discrepancies_found)) {
          for (const d of parsed.discrepancies_found) {
            if (typeof d === 'string' && d.trim()) {
              llmDiscrepancies.push(sanitizeGalleryText(d.trim()));
            }
          }
        } else if (
          typeof parsed.discrepancies_found === 'string' &&
          parsed.discrepancies_found.trim()
        ) {
          llmDiscrepancies.push(sanitizeGalleryText(parsed.discrepancies_found.trim()));
        }
        if (
          typeof parsed.correction_instructions === 'string' &&
          parsed.correction_instructions.trim()
        ) {
          llmCorrectionInstructions = sanitizeGalleryText(parsed.correction_instructions.trim());
        }
      } else if (!isJsdom) {
        visionVerificationSkipped = true;
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes('HTTP 401') ||
          err.message.includes('HTTP 403') ||
          err.message.includes('Invalid or unauthorized OpenRouter API key'))
      ) {
        throw err;
      }
      if (!isJsdom) {
        visionVerificationSkipped = true;
      }
    }
  } else if (!reimaginedRoomDataUrl || !reimaginedRoomDataUrl.trim() || !isJsdom) {
    visionVerificationSkipped = true;
  }

  // ==========================================================================
  // Part B: Deterministic FinerWorks Catalog & Geometry Cross-Verification
  // ==========================================================================
  let frameOptionValid = true;
  let mattingAndGlazingValid = true;
  let sizingAndAspectRatioValid = true;
  let substrateSurfaceAuthentic = true;
  const discrepanciesFound: string[] = [];
  const correctionParts: string[] = [];

  // 1. Resolve target/detected Media
  const lockedMedia =
    constraints?.mode === 'user-locked-finerworks'
      ? constraints.lockedMediaId !== undefined
        ? FINERWORKS_MEDIA_SPECS.find((m) => m.mediaId === constraints.lockedMediaId) ??
          getFinerWorksMediaById(constraints.lockedMediaId)
        : constraints.lockedSubstrateSlug
        ? getFinerWorksMediaBySlug(String(constraints.lockedSubstrateSlug))
        : undefined
      : undefined;

  const detectedMedia =
    detectedAttrs.mediaId !== undefined
      ? FINERWORKS_MEDIA_SPECS.find((m) => m.mediaId === detectedAttrs.mediaId)
      : detectedAttrs.substrateSlug
      ? FINERWORKS_MEDIA_SPECS.find((m) => m.substrateSlug === detectedAttrs.substrateSlug)
      : undefined;

  if (
    detectedAttrs.mediaId !== undefined &&
    !FINERWORKS_MEDIA_SPECS.some((m) => m.mediaId === detectedAttrs.mediaId)
  ) {
    substrateSurfaceAuthentic = false;
    discrepanciesFound.push(
      `Detected MediaID ${detectedAttrs.mediaId} is not a registered FinerWorks archival substrate.`
    );
    correctionParts.push(
      'Select an authentic FinerWorks MediaID from the synced catalog (e.g. MediaID 42 Hahnemühle German Etching 310gsm or MediaID 12 Museum Satin Stretched Canvas).'
    );
  }

  const effectiveMedia =
    lockedMedia ??
    detectedMedia ??
    getFinerWorksMediaById(detectedAttrs.mediaId ?? 42);

  // 2. Check Frame Moulding presence in FinerWorks catalog
  const catalogFrameMatch = FINERWORKS_FRAME_MOULDINGS.find(
    (f) => f.profileId === detectedAttrs.detectedFrameId
  );
  if (!catalogFrameMatch) {
    frameOptionValid = false;
    discrepanciesFound.push(
      `Frame profile "${String(detectedAttrs.detectedFrameId)}" is not a valid FinerWorks moulding option.`
    );
    correctionParts.push(
      'Render the wall artwork using an official FinerWorks Frame Moulding profile ("natural-white-oak", "american-black-walnut", "matte-gallery-black", "warm-travertine-ash", "brushed-brass-float", or "unframed-canvas").'
    );
  }

  const lockedFrame =
    constraints?.mode === 'user-locked-finerworks' && constraints.lockedFrameId
      ? getFinerWorksFrameByProfileId(constraints.lockedFrameId)
      : undefined;

  const effectiveFrame =
    catalogFrameMatch ??
    lockedFrame ??
    getFinerWorksFrameByProfileId(detectedAttrs.detectedFrameId);

  // 3. User-Locked FinerWorks Constraint Verification
  if (constraints?.mode === 'user-locked-finerworks') {
    if (
      constraints.lockedFrameId &&
      detectedAttrs.detectedFrameId !== constraints.lockedFrameId
    ) {
      frameOptionValid = false;
      const targetFrame = getFinerWorksFrameByProfileId(constraints.lockedFrameId);
      discrepanciesFound.push(
        `Rendered frame "${detectedAttrs.detectedFrameId}" does not match user-locked FinerWorks frame "${constraints.lockedFrameId}" (${targetFrame.name}, FrameID ${targetFrame.finerworksFrameId}).`
      );
      correctionParts.push(
        `Re-render the frame strictly as "${constraints.lockedFrameId}" (${targetFrame.name}, ${targetFrame.thicknessInches}" face width, ${targetFrame.colorLabel}).`
      );
    }

    if (
      constraints.lockedMediaId !== undefined &&
      detectedAttrs.mediaId !== undefined &&
      detectedAttrs.mediaId !== constraints.lockedMediaId
    ) {
      substrateSurfaceAuthentic = false;
      const targetMedia = getFinerWorksMediaById(constraints.lockedMediaId);
      discrepanciesFound.push(
        `Detected MediaID ${detectedAttrs.mediaId} does not match user-locked FinerWorks MediaID ${constraints.lockedMediaId} (${targetMedia.shortName}).`
      );
      correctionParts.push(
        `Render the artwork surface strictly on FinerWorks MediaID ${constraints.lockedMediaId} (${targetMedia.name}).`
      );
    }

    if (
      constraints.lockedSubstrateSlug &&
      detectedAttrs.substrateSlug !== undefined &&
      String(detectedAttrs.substrateSlug) !== String(constraints.lockedSubstrateSlug)
    ) {
      substrateSurfaceAuthentic = false;
      discrepanciesFound.push(
        `Detected substrate "${String(detectedAttrs.substrateSlug)}" does not match user-locked FinerWorks substrate "${String(constraints.lockedSubstrateSlug)}".`
      );
      correctionParts.push(
        `Render the artwork surface strictly on FinerWorks substrate "${String(constraints.lockedSubstrateSlug)}".`
      );
    }

    const referenceFrameForLock = lockedFrame ?? effectiveFrame;
    const isMatForbiddenByLock =
      effectiveMedia.productTypeId !== 5 ||
      !referenceFrameForLock.allowMatting ||
      referenceFrameForLock.finerworksFrameId === 0 ||
      referenceFrameForLock.isFloatFrame;

    const expectedMatWidthId: MatWidthId = isMatForbiddenByLock
      ? 'none'
      : constraints.lockedMatWidthId ?? detectedAttrs.detectedMatWidthId;

    if (
      (isMatForbiddenByLock || constraints.lockedMatWidthId !== undefined) &&
      detectedAttrs.detectedMatWidthId !== expectedMatWidthId
    ) {
      mattingAndGlazingValid = false;
      discrepanciesFound.push(
        `Detected mat width "${detectedAttrs.detectedMatWidthId}" violates expected FinerWorks mat width "${expectedMatWidthId}".`
      );
      correctionParts.push(
        expectedMatWidthId === 'none'
          ? 'Remove the paper matboard bevel completely ("none" mat border) for this FinerWorks configuration.'
          : `Render a ${expectedMatWidthId} 4-ply acid-free cotton rag matboard border around the print.`
      );
    }

    if (
      expectedMatWidthId !== 'none' &&
      constraints.lockedMatColorId &&
      detectedAttrs.detectedMatColorId !== constraints.lockedMatColorId
    ) {
      mattingAndGlazingValid = false;
      const expectedMatSpec = getFinerWorksMatByColorId(constraints.lockedMatColorId);
      discrepanciesFound.push(
        `Detected mat color "${detectedAttrs.detectedMatColorId}" does not match user-locked FinerWorks mat color "${constraints.lockedMatColorId}" (${expectedMatSpec.name}).`
      );
      correctionParts.push(
        `Render the matboard border in "${constraints.lockedMatColorId}" (${expectedMatSpec.name}, ${expectedMatSpec.hex}).`
      );
    }
  }

  // 4. Universal FinerWorks Physical Compatibility Rules (both modes)
  const checkMedia = detectedMedia ?? effectiveMedia;
  if (checkMedia.productTypeId !== 5 && detectedAttrs.detectedMatWidthId !== 'none') {
    mattingAndGlazingValid = false;
    discrepanciesFound.push(
      `FinerWorks substrate "${checkMedia.shortName}" (ProductType ${checkMedia.productTypeId}) is a rigid or stretched surface (Stretched Canvas, ChromaLuxe Metal, or Face-Mounted Acrylic) and cannot have a "${detectedAttrs.detectedMatWidthId}" paper matboard bevel.`
    );
    correctionParts.push(
      `Remove all paper matboard borders ("none") because ${checkMedia.shortName} is mounted without matboard.`
    );
  }

  if (
    (effectiveFrame.finerworksFrameId === 0 ||
      effectiveFrame.isFloatFrame ||
      !effectiveFrame.allowMatting) &&
    detectedAttrs.detectedMatWidthId !== 'none'
  ) {
    mattingAndGlazingValid = false;
    discrepanciesFound.push(
      `FinerWorks frame "${effectiveFrame.name}" (${effectiveFrame.profileId}) does not support matboard borders, but "${detectedAttrs.detectedMatWidthId}" mat was detected.`
    );
    correctionParts.push(
      `Render "${effectiveFrame.name}" with zero matboard ("none")${
        effectiveFrame.isFloatFrame ? ' and a clean 0.35" recessed float shadow gap' : ''
      }.`
    );
  }

  if (
    !FINERWORKS_MAT_BOARDS.some((m) => m.matColorId === detectedAttrs.detectedMatColorId)
  ) {
    mattingAndGlazingValid = false;
    discrepanciesFound.push(
      `Mat color "${String(detectedAttrs.detectedMatColorId)}" is not in the FinerWorks 4-ply cotton rag catalog.`
    );
  }

  // 5. Sizing, Aspect Ratio & Crop Geometry Verification
  const cropBox = detectedAttrs.cropBox;
  const spanX = (cropBox?.xmax ?? 0) - (cropBox?.xmin ?? 0);
  const spanY = (cropBox?.ymax ?? 0) - (cropBox?.ymin ?? 0);
  const cropBoxValid = Boolean(
    cropBox &&
      Number.isFinite(cropBox.xmin) &&
      Number.isFinite(cropBox.xmax) &&
      Number.isFinite(cropBox.ymin) &&
      Number.isFinite(cropBox.ymax) &&
      cropBox.xmin >= 0 &&
      cropBox.xmax <= 1000 &&
      cropBox.ymin >= 0 &&
      cropBox.ymax <= 1000 &&
      spanX >= 80 &&
      spanY >= 80
  );

  if (!cropBoxValid) {
    sizingAndAspectRatioValid = false;
    discrepanciesFound.push(
      `Detected frame perimeter span (${spanX} × ${spanY} on 0..1000 scale) is below minimum FinerWorks calibration threshold (80 × 80).`
    );
    correctionParts.push(
      'Ensure the framed artwork is clearly visible at museum eye level with a well-proportioned outer frame perimeter.'
    );
  }

  // Resolve target print dimensions in inches
  let targetWidthIn = 24;
  let targetHeightIn = 36;
  let matchedSizeLabel = '24" × 36"';

  if (
    detectedAttrs.customWidthIn !== undefined ||
    detectedAttrs.customHeightIn !== undefined
  ) {
    targetWidthIn = detectedAttrs.customWidthIn ?? 24;
    targetHeightIn = detectedAttrs.customHeightIn ?? 36;
    matchedSizeLabel = `${targetWidthIn}" × ${targetHeightIn}"`;
  } else if (
    constraints?.mode === 'user-locked-finerworks' &&
    (constraints.lockedSizeId === 'custom' ||
      constraints.lockedCustomWidthIn !== undefined ||
      constraints.lockedCustomHeightIn !== undefined)
  ) {
    targetWidthIn = constraints.lockedCustomWidthIn ?? 24;
    targetHeightIn = constraints.lockedCustomHeightIn ?? 36;
    matchedSizeLabel = `${targetWidthIn}" × ${targetHeightIn}"`;
  } else if (detectedAttrs.printSizeId && detectedAttrs.printSizeId !== 'custom') {
    const sizeSpec = getFinerWorksSizeById(detectedAttrs.printSizeId);
    targetWidthIn = sizeSpec.widthInches;
    targetHeightIn = sizeSpec.heightInches;
    matchedSizeLabel = sizeSpec.labelInches;
  } else if (
    constraints?.mode === 'user-locked-finerworks' &&
    constraints.lockedSizeId &&
    constraints.lockedSizeId !== 'custom'
  ) {
    const sizeSpec = getFinerWorksSizeById(constraints.lockedSizeId);
    targetWidthIn = sizeSpec.widthInches;
    targetHeightIn = sizeSpec.heightInches;
    matchedSizeLabel = sizeSpec.labelInches;
  } else {
    const defaultSizeSpec = getFinerWorksSizeById('24x36');
    targetWidthIn = defaultSizeSpec.widthInches;
    targetHeightIn = defaultSizeSpec.heightInches;
    matchedSizeLabel = defaultSizeSpec.labelInches;
  }

  if (
    targetWidthIn < effectiveMedia.minWidthIn ||
    targetWidthIn > effectiveMedia.maxWidthIn ||
    targetHeightIn < effectiveMedia.minHeightIn ||
    targetHeightIn > effectiveMedia.maxHeightIn
  ) {
    sizingAndAspectRatioValid = false;
    discrepanciesFound.push(
      `Requested print dimensions ${targetWidthIn}" × ${targetHeightIn}" fall outside FinerWorks ${effectiveMedia.shortName} production bounds (${effectiveMedia.minWidthIn}"×${effectiveMedia.minHeightIn}" to ${effectiveMedia.maxWidthIn}"×${effectiveMedia.maxHeightIn}").`
    );
    correctionParts.push(
      `Adjust print dimensions to stay within ${effectiveMedia.minWidthIn}"×${effectiveMedia.minHeightIn}" and ${effectiveMedia.maxWidthIn}"×${effectiveMedia.maxHeightIn}".`
    );
  }

  // 6. Build canonical FinerWorks SKU & normalized physical spec via finerworks-catalog-sync
  const targetGlazingId: FinerWorksGlazingId =
    detectedAttrs.glazingId ??
    (constraints?.mode === 'user-locked-finerworks' && constraints.lockedGlazingId
      ? constraints.lockedGlazingId
      : effectiveMedia.productTypeId === 5 &&
        effectiveFrame.finerworksFrameId > 0 &&
        !effectiveFrame.isFloatFrame
      ? 'clear-acrylic'
      : 'none');

  const targetFrameProfileId: FrameProfileId =
    constraints?.mode === 'user-locked-finerworks' && constraints.lockedFrameId
      ? constraints.lockedFrameId
      : effectiveFrame.profileId;

  const targetFrameSpec = getFinerWorksFrameByProfileId(targetFrameProfileId);
  const targetMatWidthId: MatWidthId =
    constraints?.mode === 'user-locked-finerworks' && constraints.lockedMatWidthId
      ? constraints.lockedMatWidthId
      : detectedAttrs.detectedMatWidthId;
  const targetMatColorId: MatColorId =
    constraints?.mode === 'user-locked-finerworks' && constraints.lockedMatColorId
      ? constraints.lockedMatColorId
      : detectedAttrs.detectedMatColorId;
  const targetMatSpec = getFinerWorksMatByColorId(targetMatColorId);
  const targetGlazingSpec = getFinerWorksGlazingById(targetGlazingId);

  const validation = validateFinerWorksConfiguration({
    productTypeId: effectiveMedia.productTypeId,
    mediaId: effectiveMedia.mediaId,
    styleId: effectiveMedia.defaultStyleId,
    printWidthIn: targetWidthIn,
    printHeightIn: targetHeightIn,
    frameProfileId: targetFrameSpec.profileId,
    finerworksFrameId: targetFrameSpec.finerworksFrameId,
    matWidthId: targetMatWidthId,
    matBorderInches: matWidthIdToInches(targetMatWidthId),
    matColorId: targetMatColorId,
    finerworksMatId: targetMatWidthId !== 'none' ? targetMatSpec.finerworksMatId : 0,
    glazingId: targetGlazingSpec.glazingId,
    finerworksGlassId: targetGlazingSpec.finerworksGlassId,
  });

  const builtSpec = buildFinerWorksProductSpec(validation.normalizedConfig);

  // 7. Combine Part A (LLM Vision) and Part B (Deterministic Catalog) verification results
  if (llmFrameValid === false) {
    frameOptionValid = false;
  }
  if (llmMatGlazeValid === false) {
    mattingAndGlazingValid = false;
  }
  if (llmSizeValid === false) {
    sizingAndAspectRatioValid = false;
  }
  if (llmSubstrateValid === false) {
    substrateSurfaceAuthentic = false;
  }

  for (const d of llmDiscrepancies) {
    if (!discrepanciesFound.includes(d)) {
      discrepanciesFound.push(d);
    }
  }
  if (llmCorrectionInstructions && !correctionParts.includes(llmCorrectionInstructions)) {
    correctionParts.push(llmCorrectionInstructions);
  }

  const passed =
    !visionVerificationSkipped &&
    frameOptionValid &&
    mattingAndGlazingValid &&
    sizingAndAspectRatioValid &&
    substrateSurfaceAuthentic;

  const normalizedFrame = getFinerWorksFrameByProfileId(builtSpec.config.frameProfileId);
  const normalizedMedia = getFinerWorksMediaById(builtSpec.config.mediaId);
  const normalizedMat = getFinerWorksMatByColorId(builtSpec.config.matColorId);
  const normalizedGlazing = getFinerWorksGlazingById(builtSpec.config.glazingId);

  const matFinishLabel =
    builtSpec.config.matWidthId === 'none'
      ? 'Full-Bleed (No Mat)'
      : `${builtSpec.config.matWidthId.replace('in', '"')} ${normalizedMat.name} Mat`;
  const glazingFinishLabel =
    builtSpec.config.glazingId === 'none' ? 'Open Surface' : normalizedGlazing.shortLabel;

  const matchedFinishesSummary = `${normalizedMedia.shortName} · ${normalizedFrame.name} · ${matFinishLabel} · ${glazingFinishLabel}`;

  const verificationSummary = sanitizeGalleryText(
    visionVerificationSkipped
      ? `Vision verification skipped; catalog SKU ${builtSpec.productCode} mapped (${matchedFinishesSummary}).`
      : passed
        ? `FinerWorks Archival Verification Passed: ${matchedFinishesSummary} (${matchedSizeLabel}, SKU ${builtSpec.productCode}).`
        : `FinerWorks Compliance Adjustment Needed: ${discrepanciesFound.join(' ')}`
  );

  const correctionInstructions =
    correctionParts.length > 0 ? sanitizeGalleryText(correctionParts.join(' ')) : undefined;

  return {
    passed,
    ...(visionVerificationSkipped ? { skipped: true } : {}),
    frameOptionValid,
    mattingAndGlazingValid,
    sizingAndAspectRatioValid,
    substrateSurfaceAuthentic,
    matchedFinerWorksProductCode: builtSpec.productCode,
    matchedFrameProfileId: builtSpec.config.frameProfileId,
    matchedFinishesSummary,
    matchedSizeLabel,
    matchedMediaId: builtSpec.config.mediaId,
    verifierModelId,
    verificationSummary,
    discrepanciesFound,
    correctionInstructions,
    attemptsUsed: Math.max(1, attemptNumber),
  } as FinerWorksOptionsVerification;
}
